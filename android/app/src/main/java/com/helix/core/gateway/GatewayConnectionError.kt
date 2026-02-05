/**
 * Gateway Connection Error Types - Helix Android
 */

package com.helix.core.gateway

enum class GatewayErrorCode {
    CONNECTION_FAILED,
    AUTH_REJECTED,
    PROTOCOL_MISMATCH,
    TIMEOUT,
    NETWORK_ERROR,
    INVALID_FRAME,
    REQUEST_FAILED
}

class GatewayConnectionError(
    val code: GatewayErrorCode,
    message: String,
    val retryable: Boolean = true,
    val retryAfterMs: Long? = null,
    val underlyingError: Throwable? = null
) : Exception(message) {

    val recoverySuggestion: String
        get() = when (code) {
            GatewayErrorCode.CONNECTION_FAILED ->
                "Failed to connect to gateway. Check your network and try again."
            GatewayErrorCode.AUTH_REJECTED ->
                "Authentication failed. Check your instance key and auth token."
            GatewayErrorCode.PROTOCOL_MISMATCH ->
                "Protocol version mismatch. Update your app."
            GatewayErrorCode.TIMEOUT ->
                "Connection timed out. Check your network and try again."
            GatewayErrorCode.NETWORK_ERROR ->
                "Network error. Check your internet connection."
            GatewayErrorCode.INVALID_FRAME ->
                "Received invalid frame from gateway."
            GatewayErrorCode.REQUEST_FAILED ->
                "Request failed. Try again."
        }

    val debugInfo: String
        get() {
            var info = "[$code] $message"
            if (underlyingError != null) {
                info += "\n  Caused by: $underlyingError"
            }
            if (retryAfterMs != null) {
                info += "\n  Retry after: ${retryAfterMs}ms"
            }
            return info
        }

    override fun toString(): String = debugInfo

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is GatewayConnectionError) return false

        if (code != other.code) return false
        if (message != other.message) return false

        return true
    }

    override fun hashCode(): Int {
        var result = code.hashCode()
        result = 31 * result + (message?.hashCode() ?: 0)
        return result
    }
}
