import Foundation

/// Calendar event
struct CalendarEvent: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let userId: String
    let accountId: String
    let externalEventId: String
    let title: String
    let description: String?
    let location: String?
    let startTime: Date
    let endTime: Date
    let durationMinutes: Int
    let isAllDay: Bool
    let timezone: String
    let recurrenceRule: String?
    let organizerEmail: String
    let organizerName: String?
    let attendeeCount: Int
    let isOrganizer: Bool
    let status: EventStatus
    let eventType: EventType
    let isBusy: Bool
    let isPublic: Bool
    let hasConflict: Bool
    let conflictSeverity: ConflictSeverity
    let hasAttachments: Bool
    let attachmentCount: Int
    let isDeleted: Bool
    let createdAt: Date
    let updatedAt: Date
    let syncedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, userId, accountId, externalEventId = "external_event_id"
        case title, description, location, startTime = "start_time"
        case endTime = "end_time", durationMinutes = "duration_minutes"
        case isAllDay = "is_all_day", timezone
        case recurrenceRule = "recurrence_rule"
        case organizerEmail = "organizer_email", organizerName = "organizer_name"
        case attendeeCount = "attendee_count", isOrganizer = "is_organizer"
        case status, eventType = "event_type", isBusy = "is_busy", isPublic = "is_public"
        case hasConflict = "has_conflict", conflictSeverity = "conflict_severity"
        case hasAttachments = "has_attachments", attachmentCount = "attachment_count"
        case isDeleted = "is_deleted", createdAt = "created_at"
        case updatedAt = "updated_at", syncedAt = "synced_at"
    }
}

enum EventStatus: String, Codable {
    case confirmed
    case tentative
    case cancelled
}

enum EventType: String, Codable {
    case event
    case task
    case focustime
    case ooo // Out of office
}

enum ConflictSeverity: String, Codable {
    case none
    case warning
    case critical
}

/// Calendar event attendee
struct EventAttendee: Identifiable, Codable, Equatable {
    let id: String
    let email: String
    let name: String?
    let responseStatus: AttendeeResponseStatus
    let isOptional: Bool
    let isOrganizer: Bool

    enum CodingKeys: String, CodingKey {
        case id, email, name
        case responseStatus = "response_status"
        case isOptional = "is_optional"
        case isOrganizer = "is_organizer"
    }
}

enum AttendeeResponseStatus: String, Codable {
    case needsAction = "needs_action"
    case declined
    case tentative
    case accepted
}

/// Calendar account
struct CalendarAccount: Identifiable, Codable, Equatable {
    let id: String
    let userId: String
    let provider: CalendarProvider
    let emailAddress: String
    let displayName: String
    let isPrimary: Bool
    let isEnabled: Bool
    let syncStatus: SyncStatus
    let lastSync: Date?
    let lastSyncError: String?
    let nextSync: Date?
    let autoSyncEnabled: Bool
    let syncIntervalMinutes: Int
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, userId, provider
        case emailAddress = "email_address"
        case displayName = "display_name"
        case isPrimary = "is_primary"
        case isEnabled = "is_enabled"
        case syncStatus = "sync_status"
        case lastSync = "last_sync"
        case lastSyncError = "last_sync_error"
        case nextSync = "next_sync"
        case autoSyncEnabled = "auto_sync_enabled"
        case syncIntervalMinutes = "sync_interval_minutes"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

enum CalendarProvider: String, Codable {
    case google
    case outlook
    case appleicloud = "apple_icloud"
}

enum SyncStatus: String, Codable {
    case idle
    case syncing
    case error
}

/// Calendar settings
struct CalendarSettings: Codable, Equatable {
    let userId: String
    let defaultCalendarProvider: CalendarProvider
    let timeFormat: TimeFormat
    let weekStartDay: Int // 0 = Sunday, 1 = Monday
    let showConflictWarnings: Bool
    let conflictWarningMinutesBefore: Int
    let timezoneName: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case defaultCalendarProvider = "default_calendar_provider"
        case timeFormat = "time_format"
        case weekStartDay = "week_start_day"
        case showConflictWarnings = "show_conflict_warnings"
        case conflictWarningMinutesBefore = "conflict_warning_minutes_before"
        case timezoneName = "timezone_name"
    }
}

enum TimeFormat: String, Codable {
    case h12 = "12h"
    case h24 = "24h"
}

/// Calendar analytics
struct CalendarAnalytics: Codable, Equatable {
    let totalEvents: Int
    let upcomingEvents: Int
    let averageEventDuration: Int
    let averageAttendees: Int
    let busiestDay: String
    let totalMeetingHours: Int
    let conflictCount: Int
    let meetingsByProvider: [String: Int]

    enum CodingKeys: String, CodingKey {
        case totalEvents = "total_events"
        case upcomingEvents = "upcoming_events"
        case averageEventDuration = "average_event_duration"
        case averageAttendees = "average_attendees"
        case busiestDay = "busiest_day"
        case totalMeetingHours = "total_meeting_hours"
        case conflictCount = "conflict_count"
        case meetingsByProvider = "meetings_by_provider"
    }
}

/// Calendar search filter
struct CalendarSearchFilter: Equatable {
    var query: String = ""
    var startDate: Date?
    var endDate: Date?
    var accountId: String?
    var provider: CalendarProvider?
    var eventType: EventType?
    var hasConflicts: Bool?
    var attendeeEmail: String?

    var isEmpty: Bool {
        query.isEmpty && startDate == nil && endDate == nil && accountId == nil &&
            provider == nil && eventType == nil && hasConflicts == nil && attendeeEmail == nil
    }
}
