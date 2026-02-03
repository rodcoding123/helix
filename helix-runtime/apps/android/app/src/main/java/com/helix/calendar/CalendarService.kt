package com.helix.calendar

import com.helix.gateway.GatewaySession
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlin.coroutines.suspendCancellableCoroutine

class CalendarService(private val gateway: GatewaySession) {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    // MARK: - Calendar Account Operations

    suspend fun getCalendarAccounts(): List<CalendarAccount> =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "calendar.accounts.list",
                    params = emptyMap(),
                ) { response ->
                    try {
                        val accounts = (response as? JsonElement)?.jsonArray?.map {
                            json.decodeFromJsonElement(CalendarAccount.serializer(), it)
                        } ?: emptyList()
                        continuation.resume(accounts)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            CalendarError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun getPrimaryCalendarAccount(): CalendarAccount =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "calendar.accounts.primary",
                    params = emptyMap(),
                ) { response ->
                    try {
                        val account = json.decodeFromJsonElement(
                            CalendarAccount.serializer(),
                            response as JsonElement
                        )
                        continuation.resume(account)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            CalendarError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    // MARK: - Event Operations

    suspend fun getCalendarEvents(
        accountId: String,
        limit: Int = 50,
        offset: Int = 0,
    ): List<CalendarEvent> = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "calendar.events.list",
                params = mapOf(
                    "account_id" to accountId,
                    "limit" to limit,
                    "offset" to offset,
                ),
            ) { response ->
                try {
                    val events = (response as? JsonElement)?.jsonArray?.map {
                        json.decodeFromJsonElement(CalendarEvent.serializer(), it)
                    } ?: emptyList()
                    continuation.resume(events)
                } catch (e: Exception) {
                    continuation.resumeWithException(
                        CalendarError.DecodingError(e.message ?: "Unknown")
                    )
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun getEventDetail(id: String): CalendarEvent =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "calendar.events.get",
                    params = mapOf("id" to id),
                ) { response ->
                    try {
                        val event = json.decodeFromJsonElement(
                            CalendarEvent.serializer(),
                            response as JsonElement
                        )
                        continuation.resume(event)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            CalendarError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun getEventAttendees(eventId: String): List<EventAttendee> =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "calendar.events.attendees",
                    params = mapOf("event_id" to eventId),
                ) { response ->
                    try {
                        val attendees = (response as? JsonElement)?.jsonArray?.map {
                            json.decodeFromJsonElement(EventAttendee.serializer(), it)
                        } ?: emptyList()
                        continuation.resume(attendees)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            CalendarError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun searchEvents(filter: CalendarSearchFilter): List<CalendarEvent> =
        suspendCancellableCoroutine { continuation ->
            try {
                val params = mutableMapOf<String, Any>(
                    "query" to filter.query,
                )

                filter.accountId?.let { params["account_id"] = it }
                filter.eventType?.let { params["event_type"] = it }
                filter.hasConflicts?.let { params["has_conflicts"] = it }

                gateway.request(
                    method = "calendar.events.search",
                    params = params,
                ) { response ->
                    try {
                        val events = (response as? JsonElement)?.jsonArray?.map {
                            json.decodeFromJsonElement(CalendarEvent.serializer(), it)
                        } ?: emptyList()
                        continuation.resume(events)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            CalendarError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun createEvent(
        accountId: String,
        title: String,
        startTime: String,
        endTime: String,
        description: String? = null,
        location: String? = null,
    ): CalendarEvent = suspendCancellableCoroutine { continuation ->
        try {
            val params = mutableMapOf<String, Any>(
                "account_id" to accountId,
                "title" to title,
                "start_time" to startTime,
                "end_time" to endTime,
            )

            description?.let { params["description"] = it }
            location?.let { params["location"] = it }

            gateway.request(
                method = "calendar.events.create",
                params = params,
            ) { response ->
                try {
                    val event = json.decodeFromJsonElement(
                        CalendarEvent.serializer(),
                        response as JsonElement
                    )
                    continuation.resume(event)
                } catch (e: Exception) {
                    continuation.resumeWithException(
                        CalendarError.DecodingError(e.message ?: "Unknown")
                    )
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun updateEvent(
        id: String,
        title: String? = null,
        description: String? = null,
        startTime: String? = null,
        endTime: String? = null,
        location: String? = null,
    ): CalendarEvent = suspendCancellableCoroutine { continuation ->
        try {
            val params = mutableMapOf<String, Any>("id" to id)

            title?.let { params["title"] = it }
            description?.let { params["description"] = it }
            startTime?.let { params["start_time"] = it }
            endTime?.let { params["end_time"] = it }
            location?.let { params["location"] = it }

            gateway.request(
                method = "calendar.events.update",
                params = params,
            ) { response ->
                try {
                    val event = json.decodeFromJsonElement(
                        CalendarEvent.serializer(),
                        response as JsonElement
                    )
                    continuation.resume(event)
                } catch (e: Exception) {
                    continuation.resumeWithException(
                        CalendarError.DecodingError(e.message ?: "Unknown")
                    )
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun deleteEvent(id: String): Unit = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "calendar.events.delete",
                params = mapOf("id" to id),
            ) { _ ->
                continuation.resume(Unit)
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    // MARK: - Conflict Detection

    suspend fun checkConflicts(eventId: String): List<CalendarEvent> =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "calendar.conflicts.check",
                    params = mapOf("event_id" to eventId),
                ) { response ->
                    try {
                        val conflicts = (response as? JsonElement)?.jsonArray?.map {
                            json.decodeFromJsonElement(CalendarEvent.serializer(), it)
                        } ?: emptyList()
                        continuation.resume(conflicts)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            CalendarError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun markConflicts(eventId: String, hasConflict: Boolean): Unit =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "calendar.conflicts.mark",
                    params = mapOf("event_id" to eventId, "has_conflict" to hasConflict),
                ) { _ ->
                    continuation.resume(Unit)
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    // MARK: - Analytics

    suspend fun getCalendarStats(accountId: String): CalendarAnalytics =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "calendar.stats",
                    params = mapOf("account_id" to accountId),
                ) { response ->
                    try {
                        val stats = json.decodeFromJsonElement(
                            CalendarAnalytics.serializer(),
                            response as JsonElement
                        )
                        continuation.resume(stats)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            CalendarError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    // MARK: - Sync

    suspend fun startSync(accountId: String): Unit = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "calendar.sync.start",
                params = mapOf("account_id" to accountId),
            ) { _ ->
                continuation.resume(Unit)
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }
}
