/**
 * Gateway WebSocket Connection Service - Helix Android
 * Implements OpenClaw frame-based protocol with challenge → connect → hello-ok handshake
 * Reference: web/src/lib/gateway-connection.ts
 */

package com.helix.core.gateway

import android.app.Application
import android.content.Context
import android.os.Build
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.*
import okhttp3.*
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.coroutines.suspendCancellableCoroutine

enum class ConnectionStatus {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    RECONNECTING,
    ERROR;

    val isConnected: Boolean get() = this == CONNECTED

    override fun toString(): String = when (this) {
        DISCONNECTED -> "Disconnected"
        CONNECTING -> "Connecting..."
        CONNECTED -> "Connected"
        RECONNECTING -> "Reconnecting..."
        ERROR -> "Error"
    }
}

class GatewayConnection private constructor(
    private val context: Context,
    private val instanceKey: String,
    private val authTokenProvider: suspend () -> String?
) {
    companion object {
        @Volatile
        private var instance: GatewayConnection? = null

        fun initialize(
            context: Context,
            instanceKey: String,
            authTokenProvider: suspend () -> String?
        ): GatewayConnection {
            return instance ?: synchronized(this) {
                val newInstance = GatewayConnection(context, instanceKey, authTokenProvider)
                instance = newInstance
                newInstance
            }
        }

        fun getInstance(): GatewayConnection {
            return instance ?: throw IllegalStateException("GatewayConnection not initialized")
        }
    }

    // MARK: - State

    private val _connectionStatus = MutableStateFlow<ConnectionStatus>(ConnectionStatus.DISCONNECTED)
    val connectionStatus: StateFlow<ConnectionStatus> = _connectionStatus.asStateFlow()

    private val _lastMessage = MutableStateFlow<GatewayMessage?>(null)
    val lastMessage: StateFlow<GatewayMessage?> = _lastMessage.asStateFlow()

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _lastError = MutableStateFlow<GatewayConnectionError?>(null)
    val lastError: StateFlow<GatewayConnectionError?> = _lastError.asStateFlow()

    // MARK: - Properties

    private var webSocket: WebSocket? = null
    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MINUTES) // No read timeout for WebSocket
        .writeTimeout(30, TimeUnit.SECONDS)
        .pingInterval(30, TimeUnit.SECONDS) // Keep-alive
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 5
    private var reconnectDelay: Long = 1000

    private var tickWatchJob: Job? = null
    private var lastTickTime: Long = 0
    private var tickIntervalMs: Int = DEFAULT_TICK_INTERVAL_MS

    private val pendingRequests = ConcurrentHashMap<String, PendingRequest>()
    private var connectContinuation: CancellableContinuation<Unit>? = null

    private val messageSubscribers = ConcurrentHashMap<UUID, (GatewayMessage) -> Unit>()

    private var shouldReconnectOnForeground = false
    private val lifecycleScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private var gatewayUrl: String? = null

    // MARK: - Initialization

    init {
        observeLifecycle()
    }

    suspend fun initialize(gatewayUrl: String? = null) {
        this.gatewayUrl = gatewayUrl

        // Try to load saved config
        val configStorage = GatewayConfigStorage(context)
        val savedConfig = configStorage.loadConfig()
        if (this.gatewayUrl == null && savedConfig != null) {
            this.gatewayUrl = savedConfig.gatewayUrl
        }
    }

    // MARK: - Connection Management

    suspend fun connect() = withContext(Dispatchers.IO) {
        val url = buildGatewayUrl()

        updateStatus(ConnectionStatus.CONNECTING)
        shouldReconnectOnForeground = true

        suspendCancellableCoroutine<Unit> { continuation ->
            connectContinuation = continuation

            val request = Request.Builder()
                .url(url)
                .build()

            webSocket = okHttpClient.newWebSocket(request, webSocketListener)

            // Timeout handler
            lifecycleScope.launch {
                delay(CONNECT_TIMEOUT_MS)
                if (connectionStatus.value == ConnectionStatus.CONNECTING) {
                    val error = GatewayConnectionError(
                        code = GatewayErrorCode.TIMEOUT,
                        message = "Connection handshake timeout",
                        retryable = true
                    )
                    updateStatus(ConnectionStatus.ERROR)
                    _lastError.value = error
                    continuation.resumeWithException(error)
                }
            }
        }
    }

    fun disconnect() {
        shouldReconnectOnForeground = false
        stopTickWatch()
        rejectPendingRequests("Disconnected")
        webSocket?.close(1000, "Closed by client")
        webSocket = null
        updateStatus(ConnectionStatus.DISCONNECTED)
    }

    suspend fun reconnect() {
        if (reconnectAttempts >= maxReconnectAttempts) {
            val error = GatewayConnectionError(
                code = GatewayErrorCode.CONNECTION_FAILED,
                message = "Max reconnection attempts reached",
                retryable = false
            )
            updateStatus(ConnectionStatus.ERROR)
            _lastError.value = error
            return
        }

        reconnectAttempts++
        val delay = reconnectDelay * Math.pow(2.0, (reconnectAttempts - 1).toDouble()).toLong()

        updateStatus(ConnectionStatus.RECONNECTING)

        delay(delay)

        try {
            connect()
        } catch (e: Exception) {
            reconnect()
        }
    }

    // MARK: - Message Publishing

    suspend fun sendMessage(content: String) {
        if (!isConnected.value) {
            throw GatewayConnectionError(
                code = GatewayErrorCode.CONNECTION_FAILED,
                message = "Not connected to gateway",
                retryable = true
            )
        }

        val params = buildJsonObject {
            put("message", content)
        }

        val frame = RequestFrame(
            id = UUID.randomUUID().toString(),
            method = "chat.send",
            params = params
        )

        sendFrame(GatewayFrame.Request(frame))
    }

    suspend fun sendRequest(method: String, params: JsonObject? = null): JsonObject {
        if (!isConnected.value) {
            throw GatewayConnectionError(
                code = GatewayErrorCode.CONNECTION_FAILED,
                message = "Not connected to gateway",
                retryable = true
            )
        }

        return suspendCancellableCoroutine { continuation ->
            val id = UUID.randomUUID().toString()

            val timeoutJob = lifecycleScope.launch {
                delay(REQUEST_TIMEOUT_MS)
                pendingRequests.remove(id)
                val error = GatewayConnectionError(
                    code = GatewayErrorCode.TIMEOUT,
                    message = "Request timeout: $method",
                    retryable = true
                )
                if (continuation.isActive) {
                    continuation.resumeWithException(error)
                }
            }

            val pending = PendingRequest(
                continuation = continuation,
                job = timeoutJob,
                createdAt = System.currentTimeMillis()
            )

            pendingRequests[id] = pending

            val frame = RequestFrame(
                id = id,
                method = method,
                params = params
            )

            sendFrame(GatewayFrame.Request(frame))
        }
    }

    suspend fun interrupt() {
        val frame = RequestFrame(
            id = UUID.randomUUID().toString(),
            method = "chat.abort",
            params = null
        )
        sendFrame(GatewayFrame.Request(frame))
    }

    // MARK: - Message Subscription

    fun subscribe(handler: (GatewayMessage) -> Unit): UUID {
        val id = UUID.randomUUID()
        messageSubscribers[id] = handler
        return id
    }

    fun unsubscribe(id: UUID) {
        messageSubscribers.remove(id)
    }

    private fun publishMessage(message: GatewayMessage) {
        _lastMessage.value = message

        for (handler in messageSubscribers.values) {
            handler(message)
        }
    }

    // MARK: - WebSocket Listener

    private val webSocketListener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            reconnectAttempts = 0
            // Don't resolve yet - wait for challenge → connect → hello-ok
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            handleFrameData(text)
        }

        override fun onMessage(webSocket: WebSocket, bytes: okio.ByteString) {
            handleFrameData(bytes.utf8())
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            handleWebSocketError(t)
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(1000, null)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            stopTickWatch()
            rejectPendingRequests("Connection closed")
            updateStatus(ConnectionStatus.DISCONNECTED)

            lifecycleScope.launch {
                reconnect()
            }
        }
    }

    // MARK: - Frame Handling

    private fun handleFrameData(data: String) {
        try {
            val jsonElement = Json.parseToJsonElement(data)
            val jsonObject = jsonElement.jsonObject
            val type = jsonObject["type"]?.jsonPrimitive?.content

            val frame = when (type) {
                "req" -> GatewayFrame.Request(json.decodeFromString<RequestFrame>(data))
                "res" -> GatewayFrame.Response(json.decodeFromString<ResponseFrame>(data))
                "event" -> GatewayFrame.Event(json.decodeFromString<EventFrame>(data))
                else -> return
            }

            handleFrame(frame)
        } catch (e: Exception) {
            println("[Gateway] Failed to parse frame: ${e.message}")
            val error = GatewayConnectionError(
                code = GatewayErrorCode.INVALID_FRAME,
                message = "Failed to parse frame: ${e.message}",
                underlyingError = e
            )
            _lastError.value = error
        }
    }

    private fun handleFrame(frame: GatewayFrame) {
        when (frame) {
            is GatewayFrame.Event -> handleEvent(frame.frame)
            is GatewayFrame.Response -> handleResponse(frame.frame)
            is GatewayFrame.Request -> {
                // Server-initiated requests (rare) - acknowledge
                val response = ResponseFrame(
                    id = frame.frame.id,
                    ok = true,
                    payload = buildJsonObject { put("status", "acknowledged") },
                    error = null
                )
                sendFrame(GatewayFrame.Response(response))
            }
        }
    }

    private fun handleEvent(frame: EventFrame) {
        when (frame.event) {
            "connect.challenge" -> {
                val nonce = frame.payload?.get("nonce")?.jsonPrimitive?.content
                sendConnectRequest(nonce)
            }

            "tick" -> {
                val ts = frame.payload?.get("ts")?.jsonPrimitive?.long
                if (ts != null) {
                    lastTickTime = ts
                    publishMessage(GatewayMessage.Heartbeat(timestamp = ts))
                }
            }

            "chat.event" -> {
                val eventType = frame.payload?.get("event")?.jsonPrimitive?.content
                    ?: frame.payload?.get("type")?.jsonPrimitive?.content ?: ""
                if (eventType.isNotEmpty() && frame.payload != null) {
                    mapChatEvent(eventType, frame.payload)
                }
            }

            "agent.event" -> {
                val eventType = frame.payload?.get("event")?.jsonPrimitive?.content
                    ?: frame.payload?.get("type")?.jsonPrimitive?.content ?: ""
                if (eventType.isNotEmpty() && frame.payload != null) {
                    mapAgentEvent(eventType, frame.payload)
                }
            }

            "shutdown" -> {
                val error = GatewayConnectionError(
                    code = GatewayErrorCode.CONNECTION_FAILED,
                    message = "Server shutting down",
                    retryable = true,
                    retryAfterMs = 5000
                )
                updateStatus(ConnectionStatus.ERROR)
                _lastError.value = error
            }

            else -> {
                // Forward unknown events
                if (frame.payload != null) {
                    publishMessage(GatewayMessage.Complete(content = frame.payload.toString()))
                }
            }
        }
    }

    private fun handleResponse(frame: ResponseFrame) {
        val pending = pendingRequests.remove(frame.id)

        if (pending != null) {
            pending.job.cancel()

            if (frame.ok) {
                pending.continuation.resume(frame.payload ?: JsonObject(emptyMap()))
            } else {
                val errorMsg = frame.error?.message ?: "Request failed"
                val code = mapErrorCode(frame.error?.code)
                val error = GatewayConnectionError(
                    code = code,
                    message = errorMsg,
                    retryable = frame.error?.retryable ?: false,
                    retryAfterMs = frame.error?.retryAfterMs
                )
                if (pending.continuation.isActive) {
                    pending.continuation.resumeWithException(error)
                }
            }
            return
        }

        // Handle hello-ok response (connection handshake completion)
        if (frame.ok) {
            val helloOk = parseHelloOk(frame.payload)
            if (helloOk) {
                onConnected(payload = frame.payload ?: JsonObject(emptyMap()))
                return
            }
        }

        // Handle connection rejection
        if (!frame.ok) {
            val errorMsg = frame.error?.message ?: "Connection rejected"
            val code = mapErrorCode(frame.error?.code)
            val error = GatewayConnectionError(
                code = code,
                message = errorMsg,
                retryable = false
            )
            updateStatus(ConnectionStatus.ERROR)
            _lastError.value = error
            connectContinuation?.resumeWithException(error)
            connectContinuation = null
        }
    }

    private fun sendConnectRequest(nonce: String?) {
        lifecycleScope.launch {
            val authToken = authTokenProvider() ?: ""

            val clientInfo = buildJsonObject {
                put("id", "helix.android.app")
                put("displayName", "Helix Android")
                put("version", appVersion())
                put("platform", "android")
                put("mode", "mobile")
                put("instanceId", instanceKey)
            }

            val authObj = buildJsonObject {
                put("token", authToken)
            }

            val params = buildJsonObject {
                put("minProtocol", PROTOCOL_VERSION)
                put("maxProtocol", PROTOCOL_VERSION)
                put("client", clientInfo)
                put("role", "operator")
                put("scopes", buildJsonArray { add("operator.admin") })
                put("auth", authObj)
                put("userAgent", userAgent())
            }

            val frame = RequestFrame(
                id = UUID.randomUUID().toString(),
                method = "connect",
                params = params
            )

            val timeoutJob = lifecycleScope.launch {
                delay(CONNECT_TIMEOUT_MS)
                pendingRequests.remove(frame.id)
                val error = GatewayConnectionError(
                    code = GatewayErrorCode.TIMEOUT,
                    message = "Connect handshake timeout",
                    retryable = true
                )
                updateStatus(ConnectionStatus.ERROR)
                _lastError.value = error
                connectContinuation?.resumeWithException(error)
                connectContinuation = null
            }

            val pending = PendingRequest(
                continuation = suspendCancellableCoroutine { },
                job = timeoutJob,
                createdAt = System.currentTimeMillis()
            )

            pendingRequests[frame.id] = pending

            sendFrame(GatewayFrame.Request(frame))
        }
    }

    private fun onConnected(payload: JsonObject) {
        // Extract policy
        val policy = payload["policy"]?.jsonObject
        if (policy != null) {
            val tickIntervalMs = policy["tickIntervalMs"]?.jsonPrimitive?.int
            if (tickIntervalMs != null) {
                this.tickIntervalMs = tickIntervalMs
            }
        }

        lastTickTime = System.currentTimeMillis()
        startTickWatch()
        updateStatus(ConnectionStatus.CONNECTED)
        reconnectAttempts = 0

        connectContinuation?.resume(Unit)
        connectContinuation = null
    }

    private fun sendFrame(frame: GatewayFrame) {
        if (webSocket?.state() != WebSocket.OPEN) {
            return
        }

        try {
            val json = when (frame) {
                is GatewayFrame.Request -> json.encodeToString(frame.frame)
                is GatewayFrame.Response -> json.encodeToString(frame.frame)
                is GatewayFrame.Event -> json.encodeToString(frame.frame)
            }
            webSocket?.send(json)
        } catch (e: Exception) {
            println("[Gateway] Encode error: ${e.message}")
        }
    }

    // MARK: - Heartbeat Management

    private fun startTickWatch() {
        stopTickWatch()

        val interval = Math.max(tickIntervalMs.toLong(), 1000)

        tickWatchJob = lifecycleScope.launch {
            while (isActive) {
                delay(interval)

                val now = System.currentTimeMillis()
                val gap = (now - lastTickTime).toInt()

                if (gap > (tickIntervalMs * 2.5).toInt()) {
                    println("[Gateway] Tick timeout: ${gap}ms since last tick")
                    disconnect()
                    reconnect()
                    break
                }
            }
        }
    }

    private fun stopTickWatch() {
        tickWatchJob?.cancel()
        tickWatchJob = null
    }

    // MARK: - Event Mapping

    private fun mapChatEvent(event: String, payload: JsonObject) {
        val message = mapChatEvent(event, payload)
        if (message != null) {
            publishMessage(message)
        }
    }

    private fun mapAgentEvent(event: String, payload: JsonObject) {
        mapChatEvent(event, payload)
    }

    // MARK: - Error Handling

    private fun handleWebSocketError(error: Throwable) {
        val gatewayError = GatewayConnectionError(
            code = GatewayErrorCode.NETWORK_ERROR,
            message = error.localizedMessage ?: "Unknown error",
            retryable = true,
            underlyingError = error
        )
        updateStatus(ConnectionStatus.ERROR)
        _lastError.value = gatewayError

        lifecycleScope.launch {
            reconnect()
        }
    }

    private fun rejectPendingRequests(reason: String) {
        for ((_, pending) in pendingRequests) {
            pending.job.cancel()
            val error = GatewayConnectionError(
                code = GatewayErrorCode.CONNECTION_FAILED,
                message = reason,
                retryable = true
            )
            if (pending.continuation.isActive) {
                pending.continuation.resumeWithException(error)
            }
        }
        pendingRequests.clear()
    }

    // MARK: - URL Building

    private fun buildGatewayUrl(): String {
        if (!gatewayUrl.isNullOrEmpty()) {
            return if (gatewayUrl!!.contains("?")) {
                "${gatewayUrl}&instanceKey=$instanceKey"
            } else {
                "${gatewayUrl}?instanceKey=$instanceKey"
            }
        }

        // Default cloud gateway
        return "wss://gateway.helix-project.org/v1/connect?instanceKey=$instanceKey"
    }

    // MARK: - Helpers

    private fun updateStatus(status: ConnectionStatus) {
        _connectionStatus.value = status
        _isConnected.value = status.isConnected
    }

    private fun appVersion(): String {
        return context.packageManager
            .getPackageInfo(context.packageName, 0)
            .versionName ?: "1.0.0"
    }

    private fun userAgent(): String {
        val device = Build.DEVICE
        val osVersion = Build.VERSION.RELEASE
        return "Helix/${appVersion()} Android $osVersion ($device)"
    }

    private fun parseHelloOk(payload: JsonObject?): Boolean {
        if (payload == null) return false
        val type = payload["type"]?.jsonPrimitive?.content
        return type == "hello-ok"
    }

    private fun mapErrorCode(code: String?): GatewayErrorCode {
        return when (code) {
            "UNAUTHORIZED", "AUTH_FAILED" -> GatewayErrorCode.AUTH_REJECTED
            "PROTOCOL_MISMATCH", "INVALID_PROTOCOL" -> GatewayErrorCode.PROTOCOL_MISMATCH
            "TIMEOUT" -> GatewayErrorCode.TIMEOUT
            else -> GatewayErrorCode.CONNECTION_FAILED
        }
    }

    // MARK: - Lifecycle Observation

    private fun observeLifecycle() {
        ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                if (shouldReconnectOnForeground && !isConnected.value) {
                    lifecycleScope.launch {
                        connect()
                    }
                }
            }

            override fun onStop(owner: LifecycleOwner) {
                shouldReconnectOnForeground = isConnected.value
                disconnect()
            }
        })
    }
}

// MARK: - Pending Request

private data class PendingRequest(
    val continuation: CancellableContinuation<JsonObject>,
    val job: Job,
    val createdAt: Long
)
