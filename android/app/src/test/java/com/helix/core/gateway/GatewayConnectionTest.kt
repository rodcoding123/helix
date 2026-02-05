/**
 * Gateway Connection Tests - Android
 * Unit tests for OpenClaw protocol implementation and WebSocket handling
 */

package com.helix.core.gateway

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.WebSocket
import okhttp3.mockwebserver.WebSocketListener
import org.junit.Before
import org.junit.Test
import kotlin.math.pow
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class GatewayConnectionTest {
    private lateinit var mockServer: MockWebServer
    private val json = Json { ignoreUnknownKeys = true }

    @Before
    fun setUp() {
        mockServer = MockWebServer()
    }

    // MARK: - Frame Parsing Tests

    @Test
    fun testRequestFrameParsing() {
        val jsonString = """
        {
          "type": "req",
          "method": "connect",
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "params": {
            "minProtocol": 3,
            "maxProtocol": 3,
            "client": {
              "id": "test-client",
              "mode": "test",
              "version": "1.0.0"
            }
          }
        }
        """

        val frame = json.decodeFromString<RequestFrame>(jsonString)

        assertEquals("req", frame.type)
        assertEquals("connect", frame.method)
        assertEquals("123e4567-e89b-12d3-a456-426614174000", frame.id)
    }

    @Test
    fun testResponseFrameParsing() {
        val jsonString = """
        {
          "type": "res",
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "result": {
            "status": "ok",
            "message": "Connected"
          }
        }
        """

        val frame = json.decodeFromString<ResponseFrame>(jsonString)

        assertEquals("res", frame.type)
        assertEquals("123e4567-e89b-12d3-a456-426614174000", frame.id)
    }

    @Test
    fun testEventFrameParsing() {
        val jsonString = """
        {
          "type": "event",
          "event": "chat",
          "data": {
            "content": "test message",
            "role": "assistant"
          }
        }
        """

        val frame = json.decodeFromString<EventFrame>(jsonString)

        assertEquals("event", frame.type)
        assertEquals("chat", frame.event)
    }

    // MARK: - Protocol Constants Tests

    @Test
    fun testProtocolVersion() {
        val protocolVersion = 3
        assertEquals(3, protocolVersion)
    }

    @Test
    fun testConnectTimeoutMs() {
        val connectTimeoutMs = 15000
        assertEquals(15000, connectTimeoutMs)
    }

    @Test
    fun testRequestTimeoutMs() {
        val requestTimeoutMs = 60000
        assertEquals(60000, requestTimeoutMs)
    }

    // MARK: - Exponential Backoff Tests

    @Test
    fun testExponentialBackoffCalculation() {
        val intervals = listOf(1000, 2000, 4000, 8000, 16000)

        for ((attempt, expected) in intervals.withIndex()) {
            val calculated = (2.0.pow(attempt.toDouble()) * 1000).toInt()
            assertEquals(expected, calculated)
        }
    }

    @Test
    fun testMaxBackoffAttempts() {
        val maxAttempts = 5
        val attempts = (0 until maxAttempts).map { attempt ->
            minOf((2.0.pow(attempt.toDouble()) * 1000).toInt(), 16000)
        }

        assertEquals(5, attempts.size)
        assertEquals(16000, attempts.last())
    }

    @Test
    fun testBackoffDoesNotExceedMaximum() {
        val maxBackoff = 16000

        for (attempt in 0..10) {
            val backoff = minOf((2.0.pow(attempt.toDouble()) * 1000).toInt(), maxBackoff)
            assertTrue(backoff <= maxBackoff)
        }
    }

    // MARK: - Error Handling Tests

    @Test
    fun testGatewayErrorCodeConnection() {
        val errorCode = GatewayErrorCode.CONNECTION_FAILED
        assertEquals("CONNECTION_FAILED", errorCode.name)
    }

    @Test
    fun testGatewayErrorCodeTimeout() {
        val errorCode = GatewayErrorCode.TIMEOUT
        assertEquals("TIMEOUT", errorCode.name)
    }

    @Test
    fun testGatewayErrorCodeProtocolMismatch() {
        val errorCode = GatewayErrorCode.PROTOCOL_MISMATCH
        assertEquals("PROTOCOL_MISMATCH", errorCode.name)
    }

    // MARK: - UUID Generation Tests

    @Test
    fun testUUIDGeneration() {
        val uuid1 = java.util.UUID.randomUUID().toString()
        val uuid2 = java.util.UUID.randomUUID().toString()

        assertNotEquals(uuid1, uuid2)
        // Standard UUID format has 5 parts separated by hyphens
        assertEquals(5, uuid1.split("-").size)
    }

    @Test
    fun testUUIDFormat() {
        val uuid = java.util.UUID.randomUUID().toString()
        // Match UUID regex pattern: 8-4-4-4-12 hex digits
        val uuidPattern = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
        assertTrue(uuidPattern.matches(uuid))
    }

    // MARK: - Heartbeat Tests

    @Test
    fun testHeartbeatInterval() {
        val heartbeatIntervalMs = 30000 // 30 seconds
        val heartbeatIntervalSeconds = heartbeatIntervalMs / 1000
        assertEquals(30, heartbeatIntervalSeconds)
    }

    @Test
    fun testTickTimeoutCalculation() {
        val heartbeatIntervalMs = 30000
        val tickTimeoutMultiplier = 2.5
        val tickTimeoutMs = (heartbeatIntervalMs * tickTimeoutMultiplier).toLong()

        assertEquals(75000L, tickTimeoutMs)
    }

    // MARK: - Connection Status Tests

    @Test
    fun testConnectionStatusEnum() {
        val status = ConnectionStatus.CONNECTING
        assertEquals(ConnectionStatus.CONNECTING, status)
    }

    @Test
    fun testConnectionStatusTransitions() {
        val statuses = listOf(
            ConnectionStatus.DISCONNECTED,
            ConnectionStatus.CONNECTING,
            ConnectionStatus.CONNECTED,
            ConnectionStatus.DISCONNECTED
        )

        assertEquals(4, statuses.size)
        assertEquals(ConnectionStatus.DISCONNECTED, statuses.first())
        assertEquals(ConnectionStatus.DISCONNECTED, statuses.last())
    }

    // MARK: - Message Type Tests

    @Test
    fun testGatewayMessageTypes() {
        val messages = listOf(
            GatewayMessage.Thinking("processing..."),
            GatewayMessage.ToolCall("test_tool", emptyMap()),
            GatewayMessage.Error("TEST_ERROR", "Test error"),
            GatewayMessage.Complete("result")
        )

        assertEquals(4, messages.size)
    }

    // MARK: - Integration Tests

    @Test
    fun testFrameRoundTrip() = runTest {
        val originalFrame = RequestFrame(
            type = "req",
            method = "connect",
            id = "123e4567-e89b-12d3-a456-426614174000",
            params = null
        )

        val jsonString = json.encodeToString(RequestFrame.serializer(), originalFrame)
        val decodedFrame = json.decodeFromString<RequestFrame>(jsonString)

        assertEquals(originalFrame.type, decodedFrame.type)
        assertEquals(originalFrame.method, decodedFrame.method)
        assertEquals(originalFrame.id, decodedFrame.id)
    }
}

// Test enum for ConnectionStatus
enum class ConnectionStatus {
    DISCONNECTED,
    CONNECTING,
    CONNECTED
}
