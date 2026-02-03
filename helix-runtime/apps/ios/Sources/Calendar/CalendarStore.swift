import Foundation
import Observation

/// Calendar state store
@Observable
final class CalendarStore {
    // MARK: - Properties

    var events: [CalendarEvent] = []
    var selectedEvent: CalendarEvent?
    var isLoading = false
    var error: CalendarError?

    var accounts: [CalendarAccount] = []
    var selectedAccountId: String?

    var currentDate = Date()
    var viewType: CalendarViewType = .month

    var analytics: CalendarAnalytics?
    var isLoadingAnalytics = false

    var searchResults: [CalendarEvent] = []
    var isSearching = false

    // MARK: - Service

    private let service: CalendarService

    // MARK: - Initialization

    init(service: CalendarService) {
        self.service = service
    }

    // MARK: - Account Management

    func loadAccounts() async {
        isLoading = true
        error = nil

        do {
            accounts = try await service.getCalendarAccounts()
            if let primary = accounts.first(where: { $0.isPrimary }) {
                selectedAccountId = primary.id
            } else if !accounts.isEmpty {
                selectedAccountId = accounts[0].id
            }
        } catch {
            self.error = CalendarError.loadAccountsFailed(error.localizedDescription)
        }

        isLoading = false
    }

    // MARK: - Event Loading

    func loadEvents() async {
        guard let accountId = selectedAccountId else { return }

        isLoading = true
        error = nil

        do {
            let result = try await service.getCalendarEvents(accountId: accountId)
            events = result.events
        } catch {
            self.error = CalendarError.loadEventsFailed(error.localizedDescription)
        }

        isLoading = false
    }

    func selectEvent(_ event: CalendarEvent) {
        selectedEvent = event
    }

    // MARK: - Event Actions

    func deleteEvent(_ event: CalendarEvent) async {
        do {
            try await service.deleteEvent(event.id)
            events.removeAll { $0.id == event.id }
            if selectedEvent?.id == event.id {
                selectedEvent = nil
            }
        } catch {
            self.error = CalendarError.deleteFailed(error.localizedDescription)
        }
    }

    // MARK: - Conflict Detection

    func checkConflicts(for event: CalendarEvent) async -> [CalendarEvent] {
        do {
            return try await service.checkConflicts(event.id)
        } catch {
            self.error = CalendarError.conflictCheckFailed(error.localizedDescription)
            return []
        }
    }

    // MARK: - Search

    func search(filter: CalendarSearchFilter) async {
        guard !filter.isEmpty else {
            searchResults = []
            return
        }

        isSearching = true
        error = nil

        do {
            searchResults = try await service.searchEvents(filter: filter)
        } catch {
            self.error = CalendarError.searchFailed(error.localizedDescription)
        }

        isSearching = false
    }

    // MARK: - Analytics

    func loadAnalytics() async {
        isLoadingAnalytics = true
        error = nil

        do {
            analytics = try await service.getCalendarStats(accountId: selectedAccountId)
        } catch {
            self.error = CalendarError.analyticsFailed(error.localizedDescription)
        }

        isLoadingAnalytics = false
    }

    // MARK: - Sync

    func startSync() async {
        guard let accountId = selectedAccountId else { return }

        do {
            try await service.startSync(accountId: accountId)
            await loadEvents()
        } catch {
            self.error = CalendarError.syncFailed(error.localizedDescription)
        }
    }

    // MARK: - Date Navigation

    func goToPreviousMonth() {
        currentDate = Calendar.current.date(byAdding: .month, value: -1, to: currentDate) ?? currentDate
    }

    func goToNextMonth() {
        currentDate = Calendar.current.date(byAdding: .month, value: 1, to: currentDate) ?? currentDate
    }

    func goToToday() {
        currentDate = Date()
    }

    // MARK: - Events for Display

    func eventsForDate(_ date: Date) -> [CalendarEvent] {
        events.filter { event in
            Calendar.current.isDate(event.startTime, inSameDayAs: date)
        }
    }

    func eventsForMonth(_ date: Date) -> [CalendarEvent] {
        let calendar = Calendar.current
        let range = calendar.range(of: .day, in: .month, for: date) ?? 1...1
        let month = calendar.component(.month, from: date)
        let year = calendar.component(.year, from: date)

        return events.filter { event in
            let eventMonth = calendar.component(.month, from: event.startTime)
            let eventYear = calendar.component(.year, from: event.startTime)
            return eventMonth == month && eventYear == year
        }
    }

    func eventsForWeek(_ date: Date) -> [CalendarEvent] {
        let calendar = Calendar.current
        let weekStart = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)) ?? date

        return events.filter { event in
            let weekEnd = calendar.date(byAdding: .day, value: 7, to: weekStart) ?? date
            return event.startTime >= weekStart && event.startTime < weekEnd
        }
    }

    func upcomingEvents(limit: Int = 5) -> [CalendarEvent] {
        let now = Date()
        return events
            .filter { $0.startTime >= now }
            .sorted { $0.startTime < $1.startTime }
            .prefix(limit)
            .map { $0 }
    }

    func conflictingEvents() -> [CalendarEvent] {
        events.filter { $0.hasConflict }
    }
}

// MARK: - View Type

enum CalendarViewType {
    case month
    case week
    case day
}

// MARK: - Error Types

enum CalendarError: LocalizedError {
    case loadAccountsFailed(String)
    case loadEventsFailed(String)
    case createFailed(String)
    case updateFailed(String)
    case deleteFailed(String)
    case searchFailed(String)
    case conflictCheckFailed(String)
    case analyticsFailed(String)
    case syncFailed(String)
    case networkError(String)
    case decodingError(String)

    var errorDescription: String? {
        switch self {
        case .loadAccountsFailed(let msg):
            return "Failed to load calendar accounts: \(msg)"
        case .loadEventsFailed(let msg):
            return "Failed to load events: \(msg)"
        case .createFailed(let msg):
            return "Failed to create event: \(msg)"
        case .updateFailed(let msg):
            return "Failed to update event: \(msg)"
        case .deleteFailed(let msg):
            return "Failed to delete event: \(msg)"
        case .searchFailed(let msg):
            return "Search failed: \(msg)"
        case .conflictCheckFailed(let msg):
            return "Conflict check failed: \(msg)"
        case .analyticsFailed(let msg):
            return "Failed to load analytics: \(msg)"
        case .syncFailed(let msg):
            return "Sync failed: \(msg)"
        case .networkError(let msg):
            return "Network error: \(msg)"
        case .decodingError(let msg):
            return "Decoding error: \(msg)"
        }
    }
}
