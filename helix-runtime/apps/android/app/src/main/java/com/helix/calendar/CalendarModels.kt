package com.helix.calendar

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// MARK: - Calendar Models

@Serializable
data class CalendarEvent(
    val id: String,
    @SerialName("user_id")
    val userId: String,
    @SerialName("account_id")
    val accountId: String,
    val title: String,
    val description: String? = null,
    val location: String? = null,
    @SerialName("start_time")
    val startTime: String,
    @SerialName("end_time")
    val endTime: String,
    val timezone: String? = null,
    @SerialName("attendee_count")
    val attendeeCount: Int = 0,
    val status: EventStatus = EventStatus.Confirmed,
    @SerialName("event_type")
    val eventType: EventType = EventType.Event,
    @SerialName("is_busy")
    val isBusy: Boolean = true,
    @SerialName("has_conflict")
    val hasConflict: Boolean = false,
    @SerialName("conflict_severity")
    val conflictSeverity: ConflictSeverity = ConflictSeverity.None,
    val attendees: List<EventAttendee> = emptyList(),
    @SerialName("created_at")
    val createdAt: String,
    @SerialName("updated_at")
    val updatedAt: String,
    @SerialName("deleted_at")
    val deletedAt: String? = null,
    @SerialName("is_deleted")
    val isDeleted: Boolean = false,
)

enum class EventStatus {
    Confirmed,
    Tentative,
    Cancelled,
}

enum class EventType {
    Event,
    Task,
    FocusTime,
    OOO,
}

enum class ConflictSeverity {
    None,
    Warning,
    Critical,
}

@Serializable
data class EventAttendee(
    val id: String,
    val name: String,
    val email: String,
    @SerialName("response_status")
    val responseStatus: String = "needsAction",
    @SerialName("is_optional")
    val isOptional: Boolean = false,
)

@Serializable
data class CalendarAccount(
    val id: String,
    @SerialName("user_id")
    val userId: String,
    val provider: String,
    @SerialName("account_email")
    val accountEmail: String,
    @SerialName("display_name")
    val displayName: String,
    @SerialName("is_primary")
    val isPrimary: Boolean = false,
    @SerialName("sync_status")
    val syncStatus: String = "synced",
    @SerialName("last_synced_at")
    val lastSyncedAt: String? = null,
    @SerialName("created_at")
    val createdAt: String,
    @SerialName("updated_at")
    val updatedAt: String,
)

@Serializable
data class CalendarSettings(
    @SerialName("time_format")
    val timeFormat: String = "12h",
    @SerialName("week_start_day")
    val weekStartDay: Int = 0,
    @SerialName("conflict_warning")
    val conflictWarning: Boolean = true,
    @SerialName("notify_attendees")
    val notifyAttendees: Boolean = true,
)

@Serializable
data class CalendarAnalytics(
    @SerialName("total_events")
    val totalEvents: Int,
    @SerialName("average_attendees")
    val averageAttendees: Double,
    @SerialName("busiest_day")
    val busiestDay: String,
    @SerialName("conflict_count")
    val conflictCount: Int,
)

@Serializable
data class CalendarSearchFilter(
    val query: String = "",
    @SerialName("account_id")
    val accountId: String? = null,
    @SerialName("event_type")
    val eventType: String? = null,
    @SerialName("has_conflicts")
    val hasConflicts: Boolean? = null,
)

// MARK: - Error Handling

sealed class CalendarError : Exception() {
    object ServiceUnavailable : CalendarError()
    object InvalidEventData : CalendarError()
    object EventNotFound : CalendarError()
    object UnauthorizedAccess : CalendarError()
    data class NetworkError(val message: String) : CalendarError()
    data class DecodingError(val message: String) : CalendarError()
    object UnknownError : CalendarError()

    val localizedMessage: String
        get() = when (this) {
            ServiceUnavailable -> "Calendar service is unavailable. Please try again later."
            InvalidEventData -> "Invalid event data provided."
            EventNotFound -> "Event not found."
            UnauthorizedAccess -> "You don't have permission to access this event."
            is NetworkError -> "Network error: ${this.message}"
            is DecodingError -> "Failed to decode event data: ${this.message}"
            UnknownError -> "An unknown error occurred."
        }
}
