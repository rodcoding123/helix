package com.helix.sync

import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

/**
 * Real-Time Sync Client for Android
 *
 * Handles cross-platform synchronization via Gateway WebSocket connection
 * Manages offline queue, conflict detection, and presence tracking
 */
class RealtimeSyncClient(
    private val gatewayUrl: String,
    private val userId: String,
    private val deviceId: String,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO + Job())
) {
    enum class ConnectionStatus {
        DISCONNECTED, CONNECTING, CONNECTED, ERROR
    }

    // MARK: - Properties

    private var webSocket: WebSocket? = null
    private val offlineQueue = OfflineSyncQueue(userId, deviceId)

    private val _connectionStatus = MutableStateFlow(ConnectionStatus.DISCONNECTED)
    val connectionStatus: StateFlow<ConnectionStatus> = _connectionStatus.asStateFlow()

    private val _conflicts = MutableStateFlow<List<ConflictType>>(emptyList())
    val conflicts: StateFlow<List<ConflictType>> = _conflicts.asStateFlow()

    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline.asStateFlow()

    // Event flows
    private val _deltaFlow = MutableSharedFlow<DeltaChange>()
    val deltaFlow: SharedFlow<DeltaChange> = _deltaFlow.asSharedFlow()

    private val _conflictFlow = MutableSharedFlow<ConflictType>()
    val conflictFlow: SharedFlow<ConflictType> = _conflictFlow.asSharedFlow()

    private val logger = SyncLogger(TAG)

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    // MARK: - Connection Management

    fun connect() {
        logger.d("Connecting to gateway: $gatewayUrl")
        _connectionStatus.value = ConnectionStatus.CONNECTING

        val request = Request.Builder()
            .url(gatewayUrl)
            .build()

        webSocket = httpClient.newWebSocket(request, SyncWebSocketListener(this))
    }

    fun disconnect() {
        webSocket?.close(1000, "Disconnect requested")
        webSocket = null
        _connectionStatus.value = ConnectionStatus.DISCONNECTED
        logger.i("Disconnected from sync gateway")
    }

    // MARK: - Message Handling (Internal)

    internal fun onWebSocketOpen() {
        scope.launch {
            _connectionStatus.emit(ConnectionStatus.CONNECTED)
            logger.i("Connected to sync gateway")

            // Send auth message
            val authMessage = buildJsonObject {
                put("type", "auth")
                put("userId", userId)
                put("deviceId", deviceId)
                put("platform", "android")
            }

            sendMessage(authMessage)
        }
    }

    internal fun onWebSocketMessage(text: String) {
        scope.launch {
            try {
                val json = Json.parseToJsonElement(text).jsonObject

                val messageType = json["type"]?.jsonPrimitive?.content ?: return@launch
                val payload = json["payload"]?.jsonObject ?: return@launch

                when (messageType) {
                    "sync.delta" -> handleDeltaMessage(payload)
                    "sync.conflict" -> handleConflictMessage(payload)
                    "sync.ack" -> handleAckMessage(payload)
                    "error" -> handleErrorMessage(payload)
                    else -> logger.d("Unknown message type: $messageType")
                }
            } catch (e: Exception) {
                logger.e("Failed to parse WebSocket message: ${e.message}")
            }
        }
    }

    internal fun onWebSocketError(throwable: Throwable) {
        logger.e("WebSocket error: ${throwable.message}")
        _connectionStatus.value = ConnectionStatus.ERROR
        attemptReconnect()
    }

    internal fun onWebSocketClosed() {
        logger.i("WebSocket closed")
        _connectionStatus.value = ConnectionStatus.DISCONNECTED
    }

    private fun handleDeltaMessage(payload: JsonObject) {
        val delta = DeltaChange(
            entity_type = payload["entity_type"]?.jsonPrimitive?.content ?: "",
            entity_id = payload["entity_id"]?.jsonPrimitive?.content ?: "",
            operation = payload["operation"]?.jsonPrimitive?.content ?: "",
            changed_fields = payload["changed_fields"]?.jsonObject?.toMap() ?: emptyMap(),
            vector_clock = payload["vector_clock"]?.jsonObject?.toMap() ?: emptyMap(),
            timestamp = payload["timestamp"]?.jsonPrimitive?.long ?: System.currentTimeMillis()
        )

        scope.launch {
            _deltaFlow.emit(delta)
        }
    }

    private fun handleConflictMessage(payload: JsonObject) {
        val conflict = ConflictType(
            id = payload["id"]?.jsonPrimitive?.content ?: "",
            entity_type = payload["entity_type"]?.jsonPrimitive?.content ?: "",
            entity_id = payload["entity_id"]?.jsonPrimitive?.content ?: "",
            local_version = payload["local_version"]?.jsonObject?.toMap() ?: emptyMap(),
            remote_version = payload["remote_version"]?.jsonObject?.toMap() ?: emptyMap(),
            timestamp = payload["timestamp"]?.jsonPrimitive?.long ?: System.currentTimeMillis()
        )

        scope.launch {
            _conflicts.update { it + conflict }
            _conflictFlow.emit(conflict)
            logger.w("Conflict detected: ${conflict.entity_type}:${conflict.entity_id}")
        }
    }

    private fun handleAckMessage(payload: JsonObject) {
        val changeId = payload["change_id"]?.jsonPrimitive?.content ?: return
        logger.d("Change acknowledged: $changeId")
    }

    private fun handleErrorMessage(payload: JsonObject) {
        val message = payload["message"]?.jsonPrimitive?.content ?: "Unknown error"
        logger.e("Sync error: $message")
        _connectionStatus.value = ConnectionStatus.ERROR
    }

    // MARK: - Message Sending

    private fun sendMessage(message: JsonObject) {
        val text = message.toString()
        webSocket?.send(text) ?: logger.w("WebSocket not connected, queuing message")
    }

    // MARK: - Change Management

    suspend fun applyLocalChange(change: QueuedChange) {
        val message = buildJsonObject {
            put("type", "sync.change")
            put("entity_type", change.entity_type)
            put("entity_id", change.entity_id)
            put("operation", change.operation)
            put("data", JsonObject(change.data))
            put("timestamp", System.currentTimeMillis())
        }

        if (_isOffline.value) {
            offlineQueue.enqueue(change)
            logger.d("Queued change (offline): ${change.entity_type}:${change.entity_id}")
        } else {
            sendMessage(message)
            logger.d("Sent change: ${change.entity_type}:${change.entity_id}")
        }
    }

    fun resolveConflict(conflictId: String, resolution: Map<String, Any>) {
        val message = buildJsonObject {
            put("type", "sync.resolve_conflict")
            put("conflict_id", conflictId)
            put("resolution", JsonObject(resolution.mapValues { (_, v) ->
                when (v) {
                    is String -> JsonPrimitive(v)
                    is Number -> JsonPrimitive(v)
                    is Boolean -> JsonPrimitive(v)
                    else -> JsonPrimitive(v.toString())
                }
            }))
        }

        sendMessage(message)
        logger.i("Resolved conflict: $conflictId")
    }

    // MARK: - Offline Queue Sync

    suspend fun syncOfflineQueue() {
        val queued = offlineQueue.getAllQueued()

        for (change in queued) {
            try {
                val message = buildJsonObject {
                    put("type", "sync.change")
                    put("entity_type", change.entity_type)
                    put("entity_id", change.entity_id)
                    put("operation", change.operation)
                    put("data", JsonObject(change.data))
                    put("timestamp", change.timestamp)
                }

                sendMessage(message)
                offlineQueue.markSynced(change.id)
                logger.d("Synced queued change: ${change.id}")
            } catch (e: Exception) {
                logger.w("Failed to sync queued change: ${e.message}")
            }
        }
    }

    // MARK: - Network Monitoring

    fun setOfflineStatus(isOffline: Boolean) {
        scope.launch {
            _isOffline.emit(isOffline)

            if (!isOffline && _connectionStatus.value == ConnectionStatus.DISCONNECTED) {
                connect()
                syncOfflineQueue()
            }
        }
    }

    private fun attemptReconnect() {
        scope.launch {
            delay(3000)
            connect()
        }
    }

    fun clearConflicts() {
        scope.launch {
            _conflicts.emit(emptyList())
        }
    }

    fun cancel() {
        disconnect()
        scope.cancel()
    }

    companion object {
        private const val TAG = "RealtimeSyncClient"
    }
}

// MARK: - WebSocket Listener

private class SyncWebSocketListener(private val client: RealtimeSyncClient) : WebSocketListener() {
    override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
        client.onWebSocketOpen()
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
        client.onWebSocketMessage(text)
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
        client.onWebSocketError(t)
    }

    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        client.onWebSocketClosed()
    }
}

// MARK: - Supporting Types

data class DeltaChange(
    val entity_type: String,
    val entity_id: String,
    val operation: String,
    val changed_fields: Map<String, Any>,
    val vector_clock: Map<String, Any>,
    val timestamp: Long
)

data class QueuedChange(
    val id: String,
    val entity_type: String,
    val entity_id: String,
    val operation: String,
    val data: Map<String, Any>,
    val timestamp: Long
)

data class ConflictType(
    val id: String,
    val entity_type: String,
    val entity_id: String,
    val local_version: Map<String, Any>,
    val remote_version: Map<String, Any>,
    val timestamp: Long
)

// MARK: - Offline Queue

class OfflineSyncQueue(private val userId: String, private val deviceId: String) {
    private val queue = mutableListOf<QueuedChange>()
    private val logger = SyncLogger("OfflineSyncQueue")

    suspend fun enqueue(change: QueuedChange) {
        queue.add(change)
        logger.d("Enqueued change: ${change.id}")
    }

    suspend fun getAllQueued(): List<QueuedChange> {
        return queue.toList()
    }

    suspend fun markSynced(changeId: String) {
        queue.removeAll { it.id == changeId }
        logger.d("Marked synced: $changeId")
    }

    suspend fun clear() {
        queue.clear()
        logger.i("Offline queue cleared")
    }
}

// MARK: - Logger

class SyncLogger(private val tag: String) {
    fun d(message: String) = Log.d(tag, message)
    fun i(message: String) = Log.i(tag, message)
    fun w(message: String) = Log.w(tag, message)
    fun e(message: String) = Log.e(tag, message)
}

// MARK: - JSON Extensions

private fun JsonObject.toMap(): Map<String, Any> {
    return this.mapValues { (_, v) ->
        when (v) {
            is JsonPrimitive -> {
                when {
                    v.isString -> v.content
                    v.content.toDoubleOrNull() != null -> v.content.toDouble()
                    v.content.toLongOrNull() != null -> v.content.toLong()
                    else -> v.content
                }
            }
            is JsonObject -> v.toMap()
            is JsonArray -> v.map {
                when (it) {
                    is JsonPrimitive -> it.content
                    is JsonObject -> it.toMap()
                    is JsonArray -> it.jsonArray.map { "..." }
                    else -> it.toString()
                }
            }
            else -> v.toString()
        }
    }
}
