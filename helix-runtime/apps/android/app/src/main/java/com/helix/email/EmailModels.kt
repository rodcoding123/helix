package com.helix.email

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.Date

// MARK: - Email Models

@Serializable
data class Email(
    val id: String,
    @SerialName("user_id")
    val userId: String,
    @SerialName("account_id")
    val accountId: String,
    val from: EmailAddress,
    val to: List<EmailAddress>,
    val cc: List<EmailAddress> = emptyList(),
    val bcc: List<EmailAddress> = emptyList(),
    val subject: String,
    val body: String,
    @SerialName("html_body")
    val htmlBody: String? = null,
    @SerialName("is_read")
    val isRead: Boolean = false,
    @SerialName("is_starred")
    val isStarred: Boolean = false,
    val labels: List<String> = emptyList(),
    @SerialName("thread_id")
    val threadId: String? = null,
    @SerialName("message_id")
    val messageId: String,
    @SerialName("in_reply_to")
    val inReplyTo: String? = null,
    val attachments: List<EmailAttachment> = emptyList(),
    val headers: Map<String, String> = emptyMap(),
    @SerialName("received_at")
    val receivedAt: String,
    @SerialName("created_at")
    val createdAt: String,
    @SerialName("updated_at")
    val updatedAt: String,
    @SerialName("deleted_at")
    val deletedAt: String? = null,
    @SerialName("is_deleted")
    val isDeleted: Boolean = false,
) {
    val displayDate: String
        get() = receivedAt.takeLast(10) // Simple formatting: YYYY-MM-DD
}

@Serializable
data class EmailAddress(
    val name: String? = null,
    val email: String,
) {
    val displayName: String
        get() = name ?: email
}

@Serializable
data class EmailDraft(
    val id: String,
    @SerialName("user_id")
    val userId: String,
    @SerialName("account_id")
    val accountId: String,
    val to: List<EmailAddress>,
    val cc: List<EmailAddress> = emptyList(),
    val bcc: List<EmailAddress> = emptyList(),
    val subject: String,
    val body: String,
    val attachments: List<EmailAttachment> = emptyList(),
    @SerialName("created_at")
    val createdAt: String,
    @SerialName("updated_at")
    val updatedAt: String,
)

@Serializable
data class EmailAttachment(
    val id: String,
    val filename: String,
    @SerialName("content_type")
    val contentType: String,
    @SerialName("size_bytes")
    val sizeBytes: Long,
    val url: String? = null,
)

@Serializable
data class EmailSearchFilter(
    val query: String = "",
    val from: String? = null,
    val to: String? = null,
    @SerialName("before_date")
    val beforeDate: String? = null,
    @SerialName("after_date")
    val afterDate: String? = null,
    @SerialName("has_attachment")
    val hasAttachment: Boolean? = null,
    @SerialName("is_read")
    val isRead: Boolean? = null,
    @SerialName("is_starred")
    val isStarred: Boolean? = null,
    val labels: List<String> = emptyList(),
)

@Serializable
data class EmailAnalytics(
    @SerialName("total_emails")
    val totalEmails: Int,
    @SerialName("unread_count")
    val unreadCount: Int,
    @SerialName("starred_count")
    val starredCount: Int,
    @SerialName("total_size_bytes")
    val totalSizeBytes: Long,
    @SerialName("sender_stats")
    val senderStats: List<EmailSenderStats> = emptyList(),
    @SerialName("frequency_data")
    val frequencyData: EmailFrequencyData? = null,
)

@Serializable
data class EmailSenderStats(
    val email: String,
    val name: String? = null,
    @SerialName("email_count")
    val emailCount: Int,
    @SerialName("last_email_at")
    val lastEmailAt: String,
)

@Serializable
data class EmailFrequencyData(
    @SerialName("by_day_of_week")
    val byDayOfWeek: Map<String, Int> = emptyMap(),
    @SerialName("by_hour_of_day")
    val byHourOfDay: Map<String, Int> = emptyMap(),
    @SerialName("by_sender")
    val bySender: Map<String, Int> = emptyMap(),
)

@Serializable
data class EmailPaginationInfo(
    @SerialName("current_page")
    val currentPage: Int,
    @SerialName("page_size")
    val pageSize: Int,
    @SerialName("total_count")
    val totalCount: Int,
    @SerialName("has_more")
    val hasMore: Boolean,
)

// MARK: - Error Handling

sealed class EmailError : Exception() {
    object ServiceUnavailable : EmailError()
    object InvalidEmailData : EmailError()
    object EmailNotFound : EmailError()
    object UnauthorizedAccess : EmailError()
    data class NetworkError(val message: String) : EmailError()
    data class DecodingError(val message: String) : EmailError()
    object UnknownError : EmailError()

    val localizedMessage: String
        get() = when (this) {
            ServiceUnavailable -> "Email service is unavailable. Please try again later."
            InvalidEmailData -> "Invalid email data provided."
            EmailNotFound -> "Email not found."
            UnauthorizedAccess -> "You don't have permission to access this email."
            is NetworkError -> "Network error: ${this.message}"
            is DecodingError -> "Failed to decode email data: ${this.message}"
            UnknownError -> "An unknown error occurred."
        }
}
