import Foundation

/// Service for calendar operations via gateway
class CalendarService {
    private let gateway: GatewaySession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(gateway: GatewaySession) {
        self.gateway = gateway
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
    }

    // MARK: - Calendar Accounts

    /// Get all calendar accounts
    func getCalendarAccounts() async throws -> [CalendarAccount] {
        let response = try await gateway.request("calendar.list_accounts", params: [:])
        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        return try decoder.decode([CalendarAccount].self, from: data)
    }

    /// Get primary calendar account
    func getPrimaryCalendarAccount() async throws -> CalendarAccount {
        let response = try await gateway.request("calendar.get_primary_account", params: [:])
        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        return try decoder.decode(CalendarAccount.self, from: data)
    }

    // MARK: - Calendar Events

    /// Fetch calendar events with pagination
    func getCalendarEvents(accountId: String, limit: Int = 20, skip: Int = 0) async throws -> (events: [CalendarEvent], hasMore: Bool) {
        let response = try await gateway.request(
            "calendar.list_events",
            params: [
                "account_id": accountId,
                "limit": limit,
                "skip": skip
            ]
        )

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        let result = try decoder.decode(CalendarEventListResponse.self, from: data)
        return (result.events, result.hasMore)
    }

    /// Get event detail
    func getEventDetail(_ eventId: String) async throws -> CalendarEvent {
        let response = try await gateway.request(
            "calendar.get_event",
            params: ["id": eventId]
        )

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        return try decoder.decode(CalendarEvent.self, from: data)
    }

    /// Get event attendees
    func getEventAttendees(_ eventId: String) async throws -> [EventAttendee] {
        let response = try await gateway.request(
            "calendar.get_attendees",
            params: ["event_id": eventId]
        )

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        let result = try decoder.decode(AttendeeListResponse.self, from: data)
        return result.attendees
    }

    // MARK: - Event Search

    /// Search calendar events
    func searchEvents(filter: CalendarSearchFilter, limit: Int = 20) async throws -> [CalendarEvent] {
        var params: [String: Any] = ["limit": limit]

        if !filter.query.isEmpty {
            params["query"] = filter.query
        }
        if let startDate = filter.startDate {
            params["start_date"] = ISO8601DateFormatter().string(from: startDate)
        }
        if let endDate = filter.endDate {
            params["end_date"] = ISO8601DateFormatter().string(from: endDate)
        }
        if let accountId = filter.accountId {
            params["account_id"] = accountId
        }
        if let provider = filter.provider {
            params["provider"] = provider.rawValue
        }
        if let eventType = filter.eventType {
            params["event_type"] = eventType.rawValue
        }
        if let hasConflicts = filter.hasConflicts {
            params["has_conflicts"] = hasConflicts
        }
        if let attendeeEmail = filter.attendeeEmail {
            params["attendee_email"] = attendeeEmail
        }

        let response = try await gateway.request("calendar.search_events", params: params)
        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        let result = try decoder.decode(EventSearchResponse.self, from: data)
        return result.results
    }

    // MARK: - Event Management

    /// Create calendar event
    func createEvent(_ event: CalendarEvent) async throws -> CalendarEvent {
        var params: [String: Any] = [
            "account_id": event.accountId,
            "title": event.title,
            "start_time": ISO8601DateFormatter().string(from: event.startTime),
            "end_time": ISO8601DateFormatter().string(from: event.endTime),
            "is_all_day": event.isAllDay,
            "event_type": event.eventType.rawValue
        ]

        if let description = event.description {
            params["description"] = description
        }
        if let location = event.location {
            params["location"] = location
        }

        let response = try await gateway.request("calendar.create_event", params: params)
        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        return try decoder.decode(CalendarEvent.self, from: data)
    }

    /// Update calendar event
    func updateEvent(_ eventId: String, title: String?, description: String?, startTime: Date?, endTime: Date?) async throws -> CalendarEvent {
        var params: [String: Any] = ["id": eventId]

        if let title = title {
            params["title"] = title
        }
        if let description = description {
            params["description"] = description
        }
        if let startTime = startTime {
            params["start_time"] = ISO8601DateFormatter().string(from: startTime)
        }
        if let endTime = endTime {
            params["end_time"] = ISO8601DateFormatter().string(from: endTime)
        }

        let response = try await gateway.request("calendar.update_event", params: params)
        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        return try decoder.decode(CalendarEvent.self, from: data)
    }

    /// Delete calendar event
    func deleteEvent(_ eventId: String, hardDelete: Bool = false) async throws {
        _ = try await gateway.request(
            "calendar.delete_event",
            params: [
                "id": eventId,
                "hard_delete": hardDelete
            ]
        )
    }

    // MARK: - Conflict Detection

    /// Check for conflicts
    func checkConflicts(_ eventId: String) async throws -> [CalendarEvent] {
        let response = try await gateway.request(
            "calendar.check_conflicts",
            params: ["event_id": eventId]
        )

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        let result = try decoder.decode(ConflictResponse.self, from: data)
        return result.conflicts
    }

    /// Mark conflicts
    func markConflicts(_ eventId: String) async throws -> CalendarEvent {
        let response = try await gateway.request(
            "calendar.mark_conflicts",
            params: ["event_id": eventId]
        )

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        return try decoder.decode(CalendarEvent.self, from: data)
    }

    // MARK: - Analytics

    /// Get calendar statistics
    func getCalendarStats(accountId: String? = nil) async throws -> CalendarAnalytics {
        var params: [String: Any] = [:]
        if let accountId = accountId {
            params["account_id"] = accountId
        }

        let response = try await gateway.request("calendar.analytics", params: params)
        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        return try decoder.decode(CalendarAnalytics.self, from: data)
    }

    // MARK: - Sync

    /// Start calendar sync
    func startSync(accountId: String) async throws {
        _ = try await gateway.request(
            "calendar.start_sync",
            params: ["account_id": accountId]
        )
    }
}

// MARK: - Response Types

private struct CalendarEventListResponse: Codable {
    let events: [CalendarEvent]
    let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case events
        case hasMore = "has_more"
    }
}

private struct AttendeeListResponse: Codable {
    let attendees: [EventAttendee]
}

private struct EventSearchResponse: Codable {
    let results: [CalendarEvent]
}

private struct ConflictResponse: Codable {
    let conflicts: [CalendarEvent]
}
