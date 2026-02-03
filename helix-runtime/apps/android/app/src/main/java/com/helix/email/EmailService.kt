package com.helix.email

import android.util.Log
import com.helix.gateway.GatewaySession
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlin.coroutines.suspendCancellableCoroutine

class EmailService(private val gateway: GatewaySession) {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    // MARK: - Email Operations

    suspend fun fetchEmails(
        accountId: String,
        limit: Int = 50,
        offset: Int = 0,
    ): List<Email> = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "email.list",
                params = mapOf(
                    "account_id" to accountId,
                    "limit" to limit,
                    "offset" to offset,
                ),
            ) { response ->
                try {
                    val emails = (response as? JsonElement)?.jsonArray?.map {
                        json.decodeFromJsonElement(Email.serializer(), it)
                    } ?: emptyList()
                    continuation.resume(emails)
                } catch (e: Exception) {
                    continuation.resumeWithException(EmailError.DecodingError(e.message ?: "Unknown"))
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun getEmail(id: String): Email = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "email.get",
                params = mapOf("id" to id),
            ) { response ->
                try {
                    val email = json.decodeFromJsonElement(
                        Email.serializer(),
                        response as JsonElement
                    )
                    continuation.resume(email)
                } catch (e: Exception) {
                    continuation.resumeWithException(EmailError.DecodingError(e.message ?: "Unknown"))
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun searchEmails(filter: EmailSearchFilter, limit: Int = 50): List<Email> =
        suspendCancellableCoroutine { continuation ->
            try {
                val params = mutableMapOf<String, Any>(
                    "query" to filter.query,
                    "limit" to limit,
                )

                filter.from?.let { params["from"] = it }
                filter.to?.let { params["to"] = it }
                filter.beforeDate?.let { params["before_date"] = it }
                filter.afterDate?.let { params["after_date"] = it }
                filter.hasAttachment?.let { params["has_attachment"] = it }
                filter.isRead?.let { params["is_read"] = it }
                filter.isStarred?.let { params["is_starred"] = it }
                if (filter.labels.isNotEmpty()) params["labels"] = filter.labels

                gateway.request(
                    method = "email.search",
                    params = params,
                ) { response ->
                    try {
                        val emails = (response as? JsonElement)?.jsonArray?.map {
                            json.decodeFromJsonElement(Email.serializer(), it)
                        } ?: emptyList()
                        continuation.resume(emails)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            EmailError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun markAsRead(id: String, isRead: Boolean = true): Unit =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "email.mark_read",
                    params = mapOf("id" to id, "is_read" to isRead),
                ) { _ ->
                    continuation.resume(Unit)
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun markAsStarred(id: String, isStarred: Boolean = true): Unit =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "email.mark_starred",
                    params = mapOf("id" to id, "is_starred" to isStarred),
                ) { _ ->
                    continuation.resume(Unit)
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun addLabel(id: String, label: String): Unit =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "email.add_label",
                    params = mapOf("id" to id, "label" to label),
                ) { _ ->
                    continuation.resume(Unit)
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun removeLabel(id: String, label: String): Unit =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "email.remove_label",
                    params = mapOf("id" to id, "label" to label),
                ) { _ ->
                    continuation.resume(Unit)
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun deleteEmail(id: String): Unit = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "email.delete",
                params = mapOf("id" to id),
            ) { _ ->
                continuation.resume(Unit)
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun sendEmail(
        accountId: String,
        to: List<String>,
        subject: String,
        body: String,
        cc: List<String> = emptyList(),
        bcc: List<String> = emptyList(),
    ): Email = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "email.send",
                params = mapOf(
                    "account_id" to accountId,
                    "to" to to,
                    "subject" to subject,
                    "body" to body,
                    "cc" to cc,
                    "bcc" to bcc,
                ),
            ) { response ->
                try {
                    val email = json.decodeFromJsonElement(
                        Email.serializer(),
                        response as JsonElement
                    )
                    continuation.resume(email)
                } catch (e: Exception) {
                    continuation.resumeWithException(
                        EmailError.DecodingError(e.message ?: "Unknown")
                    )
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun saveDraft(
        accountId: String,
        to: List<String>,
        subject: String,
        body: String,
        cc: List<String> = emptyList(),
        bcc: List<String> = emptyList(),
    ): EmailDraft = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "email.draft.save",
                params = mapOf(
                    "account_id" to accountId,
                    "to" to to,
                    "subject" to subject,
                    "body" to body,
                    "cc" to cc,
                    "bcc" to bcc,
                ),
            ) { response ->
                try {
                    val draft = json.decodeFromJsonElement(
                        EmailDraft.serializer(),
                        response as JsonElement
                    )
                    continuation.resume(draft)
                } catch (e: Exception) {
                    continuation.resumeWithException(
                        EmailError.DecodingError(e.message ?: "Unknown")
                    )
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun getAnalytics(accountId: String): EmailAnalytics =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "email.analytics",
                    params = mapOf("account_id" to accountId),
                ) { response ->
                    try {
                        val analytics = json.decodeFromJsonElement(
                            EmailAnalytics.serializer(),
                            response as JsonElement
                        )
                        continuation.resume(analytics)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            EmailError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun getAttachmentUrl(emailId: String, attachmentId: String): String =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "email.attachment.url",
                    params = mapOf("email_id" to emailId, "attachment_id" to attachmentId),
                ) { response ->
                    try {
                        val url = (response as? JsonElement)?.jsonObject?.get("url")?.toString()
                            ?: throw EmailError.DecodingError("No URL in response")
                        continuation.resume(url)
                    } catch (e: Exception) {
                        continuation.resumeWithException(e)
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun getThread(threadId: String): List<Email> =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "email.thread.get",
                    params = mapOf("thread_id" to threadId),
                ) { response ->
                    try {
                        val emails = (response as? JsonElement)?.jsonArray?.map {
                            json.decodeFromJsonElement(Email.serializer(), it)
                        } ?: emptyList()
                        continuation.resume(emails)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            EmailError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }
}
