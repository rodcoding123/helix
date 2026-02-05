/**
 * High-level Gateway Messages - Helix Android
 * Maps from low-level frame events to semantic message types
 */

package com.helix.core.gateway

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

sealed class GatewayMessage {
    abstract val timestamp: Long

    data class Thinking(
        val content: String,
        override val timestamp: Long = System.currentTimeMillis()
    ) : GatewayMessage() {
        override fun toString() = "💭 Thinking: ${content.take(50)}"
    }

    data class ToolCall(
        val name: String,
        val input: JsonObject,
        override val timestamp: Long = System.currentTimeMillis()
    ) : GatewayMessage() {
        override fun toString() = "🔧 Tool: $name"
    }

    data class ToolResult(
        val output: String,
        override val timestamp: Long = System.currentTimeMillis()
    ) : GatewayMessage() {
        override fun toString() = "✓ Result: ${output.take(50)}"
    }

    data class Error(
        val message: String,
        override val timestamp: Long = System.currentTimeMillis()
    ) : GatewayMessage() {
        override fun toString() = "❌ Error: $message"
    }

    data class Complete(
        val content: String? = null,
        override val timestamp: Long = System.currentTimeMillis()
    ) : GatewayMessage() {
        override fun toString() = "✅ Complete: ${(content ?: "no content").take(50)}"
    }

    data class Heartbeat(
        override val timestamp: Long
    ) : GatewayMessage() {
        override fun toString() = "💓 Heartbeat"
    }
}

// MARK: - Mapping from Chat Events

fun mapChatEvent(event: String, payload: JsonObject): GatewayMessage? {
    return when (event) {
        "thinking" -> {
            val content = extractString(payload, "content") ?: extractString(payload, "text")
            content?.let { GatewayMessage.Thinking(it) }
        }

        "tool_use", "tool_call" -> {
            val toolName = extractString(payload, "toolName") ?: extractString(payload, "name") ?: "unknown"
            val toolInput = extractObject(payload, "toolInput") ?: extractObject(payload, "input") ?: JsonObject(emptyMap())
            GatewayMessage.ToolCall(toolName, toolInput)
        }

        "tool_result" -> {
            val output = extractString(payload, "toolOutput") ?: extractString(payload, "output")
            output?.let { GatewayMessage.ToolResult(it) }
        }

        "complete", "done" -> {
            val content = extractString(payload, "content") ?: extractString(payload, "text")
            GatewayMessage.Complete(content)
        }

        "error" -> {
            val message = extractString(payload, "content") ?: extractString(payload, "error") ?: "Unknown error"
            GatewayMessage.Error(message)
        }

        else -> null
    }
}

private fun extractString(json: JsonObject, key: String): String? {
    return try {
        json[key]?.jsonPrimitive?.content
    } catch (e: Exception) {
        null
    }
}

private fun extractObject(json: JsonObject, key: String): JsonObject? {
    return try {
        json[key] as? JsonObject
    } catch (e: Exception) {
        null
    }
}
