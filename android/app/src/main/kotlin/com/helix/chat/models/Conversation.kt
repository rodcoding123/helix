package com.helix.chat.models

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Conversation Data Model
 *
 * Represents a chat session with metadata.
 * Session-based for multi-conversation support.
 */
@Serializable
@Entity(tableName = "conversations")
data class Conversation(
    @PrimaryKey
    @SerialName("session_key")
    val sessionKey: String,

    @SerialName("user_id")
    val userId: String,

    val title: String,
    val description: String? = null,

    @SerialName("created_at")
    val createdAt: String, // ISO8601

    @SerialName("updated_at")
    val updatedAt: String, // ISO8601

    @SerialName("last_message_at")
    val lastMessageAt: String? = null, // ISO8601

    @SerialName("message_count")
    val messageCount: Int = 0,

    val metadata: ConversationMetadata? = null
) {
    // Computed properties
    val isArchived: Boolean
        get() = metadata?.isArchived == true

    val isStarred: Boolean
        get() = metadata?.isStarred == true

    val formattedCreatedAt: String
        get() = formatDate(createdAt)

    val formattedLastMessageAt: String?
        get() = lastMessageAt?.let { formatDate(it) }

    val isRecent: Boolean
        get() {
            return try {
                val instant = java.time.Instant.parse(lastMessageAt ?: updatedAt)
                val now = java.time.Instant.now()
                java.time.Duration.between(instant, now).toHours() < 24
            } catch (e: Exception) {
                false
            }
        }

    companion object {
        fun formatDate(isoString: String): String {
            return try {
                val instant = java.time.Instant.parse(isoString)
                val date = java.time.LocalDate.ofInstant(instant, java.time.ZoneId.systemDefault())
                val now = java.time.LocalDate.now()

                when {
                    date == now -> "Today"
                    date == now.minusDays(1) -> "Yesterday"
                    date.year == now.year -> {
                        val formatter = java.time.format.DateTimeFormatter.ofPattern("MMM d")
                        date.format(formatter)
                    }
                    else -> {
                        val formatter = java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy")
                        date.format(formatter)
                    }
                }
            } catch (e: Exception) {
                "—"
            }
        }
    }
}

@Serializable
data class ConversationMetadata(
    @SerialName("is_archived")
    val isArchived: Boolean = false,

    @SerialName("is_starred")
    val isStarred: Boolean = false,

    @SerialName("agent_info")
    val agentInfo: AgentInfo? = null,

    @SerialName("tags")
    val tags: List<String>? = null
)

@Serializable
data class AgentInfo(
    val name: String,
    val model: String? = null,
    val version: String? = null
)

// Wrapper for API responses
@Serializable
data class ConversationResponse(
    val conversations: List<Conversation>
)

@Serializable
data class SingleConversationResponse(
    val conversation: Conversation
)
