/**
 * OpenClaw Frame Type Definitions - Helix Android
 * Implements the exact frame protocol from web/src/lib/gateway-connection.ts
 */

package com.helix.core.gateway

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonElement

// MARK: - Request Frame

@Serializable
data class RequestFrame(
    val type: String = "req",
    val id: String,
    val method: String,
    val params: JsonObject? = null
)

// MARK: - Response Frame

@Serializable
data class ResponseFrame(
    val type: String = "res",
    val id: String,
    val ok: Boolean,
    val payload: JsonObject? = null,
    val error: FrameError? = null
)

@Serializable
data class FrameError(
    val code: String,
    val message: String,
    val details: JsonElement? = null,
    val retryable: Boolean? = null,
    val retryAfterMs: Long? = null
)

// MARK: - Event Frame

@Serializable
data class EventFrame(
    val type: String = "event",
    val event: String,
    val payload: JsonObject? = null,
    val seq: Int? = null
)

// MARK: - Discriminated Union

sealed class GatewayFrame {
    data class Request(val frame: RequestFrame) : GatewayFrame()
    data class Response(val frame: ResponseFrame) : GatewayFrame()
    data class Event(val frame: EventFrame) : GatewayFrame()
}

// MARK: - Connection Challenge

@Serializable
data class ConnectChallengePayload(
    val nonce: String? = null
)

// MARK: - Connect Request Client Info

@Serializable
data class ConnectRequestClient(
    val id: String,
    val displayName: String,
    val version: String,
    val platform: String,
    val mode: String,
    val instanceId: String
)

// MARK: - Connect Request Auth

@Serializable
data class ConnectRequestAuth(
    val token: String
)

// MARK: - Hello OK Response

@Serializable
data class HelloOKPayload(
    val type: String,
    val serverName: String? = null,
    val protocol: Int,
    val policy: GatewayPolicy? = null
)

@Serializable
data class GatewayPolicy(
    val tickIntervalMs: Int? = null,
    val maxIdleMs: Int? = null
)

// MARK: - Tick Event

@Serializable
data class TickEventPayload(
    val ts: Long
)

// MARK: - Constants

const val PROTOCOL_VERSION = 3
const val CONNECT_TIMEOUT_MS = 15000L
const val REQUEST_TIMEOUT_MS = 60000L
const val DEFAULT_TICK_INTERVAL_MS = 30000
