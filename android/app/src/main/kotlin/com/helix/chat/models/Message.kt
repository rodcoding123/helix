package com.helix.chat.models

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Message Data Model
 *
 * Represents a single message in a conversation.
 * Includes offline sync tracking for seamless offline-first operation.
 */
@Serializable
@Entity(tableName = "messages")
data class Message(
    @PrimaryKey
    val id: String,

    @SerialName("session_key")
    val sessionKey: String,

    @SerialName("user_id")
    val userId: String,

    val role: MessageRole,
    val content: String,
    val timestamp: String, // ISO8601

    @SerialName("client_id")
    val clientId: String? = null, // Idempotency key

    @SerialName("is_pending")
    val isPending: Boolean? = false, // Awaiting sync

    @SerialName("synced_at")
    val syncedAt: String? = null, // When synced to server

    val platform: String? = "android",

    @SerialName("device_id")
    val deviceId: String? = null, // Device fingerprint

    val metadata: Map<String, String>? = null,

    @SerialName("tool_calls")
    val toolCalls: List<ToolCall>? = null,

    @SerialName("tool_results")
    val toolResults: List<ToolResult>? = null,

    val thinking: String? = null // Extended thinking
) {
    @Serializable
    enum class MessageRole {
        @SerialName("user")
        USER,

        @SerialName("assistant")
        ASSISTANT,

        @SerialName("system")
        SYSTEM
    }

    // Computed properties
    val isAssistant: Boolean
        get() = role == MessageRole.ASSISTANT

    val isUser: Boolean
        get() = role == MessageRole.USER

    val needsSync: Boolean
        get() = isPending == true && syncedAt == null

    val formattedTime: String
        get() = formatTime(timestamp)

    val formattedDate: String
        get() = formatDate(timestamp)

    companion object {
        fun formatTime(isoString: String): String {
            // Parse ISO8601 and format as HH:mm
            return try {
                val instant = java.time.Instant.parse(isoString)
                val time = java.time.LocalTime.ofInstant(instant, java.time.ZoneId.systemDefault())
                String.format("%02d:%02d", time.hour, time.minute)
            } catch (e: Exception) {
                "00:00"
            }
        }

        fun formatDate(isoString: String): String {
            // Parse ISO8601 and format as MMM d
            return try {
                val instant = java.time.Instant.parse(isoString)
                val date = java.time.LocalDate.ofInstant(instant, java.time.ZoneId.systemDefault())
                val monthDay = java.time.format.DateTimeFormatter.ofPattern("MMM d")
                date.format(monthDay)
            } catch (e: Exception) {
                "—"
            }
        }
    }
}

@Serializable
data class ToolCall(
    val id: String,
    val name: String,
    val input: Map<String, Any>? = null
)

@Serializable
data class ToolResult(
    val toolCallId: String,
    val content: String
)

// Enum for safer serialization handling
@Serializable
enum class MessageMetadataKey {
    @SerialName("room_id")
    ROOM_ID,

    @SerialName("is_draft")
    IS_DRAFT,

    @SerialName("edited_at")
    EDITED_AT
}
