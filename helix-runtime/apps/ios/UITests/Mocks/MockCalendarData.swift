import Foundation

/**
 * Mock calendar data for UI testing
 * Provides sample events for testing calendar tab functionality
 */
struct MockCalendarData {
    // MARK: - Mock Event Model

    struct Event {
        let id: String
        let title: String
        let description: String
        let startDate: Date
        let endDate: Date
        let location: String
        let attendees: [String]
        let isAllDay: Bool
        let color: String
        let hasConflict: Bool
        let isRecurring: Bool
        let recurrencePattern: String?
        let reminders: [TimeInterval]
    }

    // MARK: - Sample Data

    static let sampleEvents: [Event] = [
        Event(
            id: "event_001",
            title: "Team Standup",
            description: "Daily team synchronization meeting",
            startDate: Date().addingTimeInterval(86400), // Tomorrow 10 AM
            endDate: Date().addingTimeInterval(86400 + 1800), // 30 minutes
            location: "Conference Room B",
            attendees: ["alice@company.com", "bob@company.com", "charlie@company.com"],
            isAllDay: false,
            color: "Blue",
            hasConflict: false,
            isRecurring: true,
            recurrencePattern: "Daily",
            reminders: [600, 300] // 10 and 5 minutes before
        ),
        Event(
            id: "event_002",
            title: "Project Planning Session",
            description: "Discuss Phase 8 requirements and timeline",
            startDate: Date().addingTimeInterval(172800), // 2 days from now at 2 PM
            endDate: Date().addingTimeInterval(172800 + 3600), // 1 hour
            location: "Main Conference Room",
            attendees: ["manager@company.com", "dev@company.com", "designer@company.com"],
            isAllDay: false,
            color: "Green",
            hasConflict: false,
            isRecurring: false,
            recurrencePattern: nil,
            reminders: [900] // 15 minutes before
        ),
        Event(
            id: "event_003",
            title: "Lunch",
            description: "Team lunch break",
            startDate: Date().addingTimeInterval(43200 + 86400), // Tomorrow at 12 PM
            endDate: Date().addingTimeInterval(43200 + 86400 + 3600), // 1 hour
            location: "Downtown Bistro",
            attendees: ["alice@company.com", "bob@company.com"],
            isAllDay: false,
            color: "Yellow",
            hasConflict: false,
            isRecurring: true,
            recurrencePattern: "Weekly on Tuesday",
            reminders: [300] // 5 minutes before
        ),
        Event(
            id: "event_004",
            title: "Code Review Meeting",
            description: "Review PR #1234 for feature implementation",
            startDate: Date().addingTimeInterval(259200), // 3 days from now at 3 PM
            endDate: Date().addingTimeInterval(259200 + 5400), // 1.5 hours
            location: "Zoom - Link in email",
            attendees: ["dev@company.com", "lead@company.com"],
            isAllDay: false,
            color: "Red",
            hasConflict: true, // Overlaps with another event
            isRecurring: false,
            recurrencePattern: nil,
            reminders: [600] // 10 minutes before
        ),
        Event(
            id: "event_005",
            title: "Company All-Hands",
            description: "Monthly company meeting and updates",
            startDate: Date().addingTimeInterval(432000), // 5 days from now
            endDate: Date().addingTimeInterval(432000 + 5400), // 1.5 hours
            location: "Main Auditorium",
            attendees: [], // All-hands meeting
            isAllDay: false,
            color: "Purple",
            hasConflict: false,
            isRecurring: true,
            recurrencePattern: "Monthly",
            reminders: [1800, 600] // 30 and 10 minutes before
        ),
        Event(
            id: "event_006",
            title: "Birthday Celebration",
            description: "Sarah's birthday party",
            startDate: Date().addingTimeInterval(518400), // 6 days from now
            endDate: Date().addingTimeInterval(518400 + 28800), // All day
            location: "Office Kitchen",
            attendees: ["sarah@company.com", "alice@company.com", "bob@company.com"],
            isAllDay: true,
            color: "Pink",
            hasConflict: false,
            isRecurring: false,
            recurrencePattern: nil,
            reminders: [86400] // 1 day before
        ),
        Event(
            id: "event_007",
            title: "Client Presentation",
            description: "Quarterly results presentation to key clients",
            startDate: Date().addingTimeInterval(604800), // 1 week from now at 9 AM
            endDate: Date().addingTimeInterval(604800 + 7200), // 2 hours
            location: "Client Office - Downtown",
            attendees: ["client@externaldomain.com", "manager@company.com", "dev@company.com"],
            isAllDay: false,
            color: "Orange",
            hasConflict: false,
            isRecurring: false,
            recurrencePattern: nil,
            reminders: [3600, 600] // 1 hour and 10 minutes before
        ),
    ]

    // MARK: - Sample Event for Creation

    static let newEvent = Event(
        id: "event_new",
        title: "New Event",
        description: "Test event description",
        startDate: Date().addingTimeInterval(86400),
        endDate: Date().addingTimeInterval(86400 + 3600),
        location: "Test Location",
        attendees: [],
        isAllDay: false,
        color: "Blue",
        hasConflict: false,
        isRecurring: false,
        recurrencePattern: nil,
        reminders: [300]
    )

    // MARK: - Helper Methods

    /**
     * Returns event by ID
     * - Parameters:
     *   - id: Event identifier
     * - Returns: Event if found, nil otherwise
     */
    static func eventByID(_ id: String) -> Event? {
        return sampleEvents.first { $0.id == id }
    }

    /**
     * Returns all-day events only
     * - Returns: Array of all-day events
     */
    static func allDayEvents() -> [Event] {
        return sampleEvents.filter { $0.isAllDay }
    }

    /**
     * Returns recurring events only
     * - Returns: Array of recurring events
     */
    static func recurringEvents() -> [Event] {
        return sampleEvents.filter { $0.isRecurring }
    }

    /**
     * Returns events with conflicts
     * - Returns: Array of conflicting events
     */
    static func conflictingEvents() -> [Event] {
        return sampleEvents.filter { $0.hasConflict }
    }

    /**
     * Returns events for a specific date
     * - Parameters:
     *   - date: Date to filter by
     * - Returns: Array of events on that date
     */
    static func eventsForDate(_ date: Date) -> [Event] {
        let calendar = Calendar.current
        let targetComponents = calendar.dateComponents([.year, .month, .day], from: date)

        return sampleEvents.filter {
            let eventComponents = calendar.dateComponents([.year, .month, .day], from: $0.startDate)
            return eventComponents == targetComponents
        }
    }

    /**
     * Returns upcoming events within a time range
     * - Parameters:
     *   - days: Number of days to look ahead
     * - Returns: Array of upcoming events
     */
    static func upcomingEvents(withinDays days: Int) -> [Event] {
        let now = Date()
        let endDate = now.addingTimeInterval(TimeInterval(days * 86400))

        return sampleEvents.filter { $0.startDate >= now && $0.startDate <= endDate }
            .sorted { $0.startDate < $1.startDate }
    }

    /**
     * Returns events at specific location
     * - Parameters:
     *   - location: Location string to search for
     * - Returns: Array of events at location
     */
    static func eventsAtLocation(_ location: String) -> [Event] {
        return sampleEvents.filter {
            $0.location.lowercased().contains(location.lowercased())
        }
    }

    /**
     * Returns events with specific attendee
     * - Parameters:
     *   - email: Attendee email address
     * - Returns: Array of events with attendee
     */
    static func eventsWithAttendee(_ email: String) -> [Event] {
        return sampleEvents.filter { $0.attendees.contains(where: { $0.lowercased() == email.lowercased() }) }
    }

    /**
     * Returns events matching search query
     * - Parameters:
     *   - query: Search text
     * - Returns: Array of matching events
     */
    static func searchEvents(query: String) -> [Event] {
        let lowercaseQuery = query.lowercased()
        return sampleEvents.filter {
            $0.title.lowercased().contains(lowercaseQuery) ||
            $0.description.lowercased().contains(lowercaseQuery) ||
            $0.location.lowercased().contains(lowercaseQuery)
        }
    }

    /**
     * Returns events sorted by date
     * - Returns: Sorted array of events
     */
    static func eventsSortedByDate() -> [Event] {
        return sampleEvents.sorted { $0.startDate < $1.startDate }
    }

    /**
     * Calculates total events in current month
     * - Returns: Count of events in current month
     */
    static func eventsInCurrentMonth() -> Int {
        let calendar = Calendar.current
        let now = Date()
        let monthRange = calendar.range(of: .month, in: .year, for: now)!

        return sampleEvents.filter {
            let eventMonth = calendar.dateComponents([.month], from: $0.startDate).month
            let currentMonth = calendar.dateComponents([.month], from: now).month
            return eventMonth == currentMonth
        }.count
    }

    /**
     * Calculates average event duration in minutes
     * - Returns: Average duration or 0 if no events
     */
    static func averageEventDuration() -> Int {
        guard !sampleEvents.isEmpty else { return 0 }
        let totalDuration = sampleEvents.reduce(0) { sum, event in
            let duration = Int(event.endDate.timeIntervalSince(event.startDate)) / 60
            return sum + duration
        }
        return totalDuration / sampleEvents.count
    }
}

// MARK: - Extension for Testing

extension MockCalendarData.Event: Identifiable {}
