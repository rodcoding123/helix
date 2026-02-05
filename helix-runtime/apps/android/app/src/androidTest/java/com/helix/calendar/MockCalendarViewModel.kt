package com.helix.calendar

import kotlinx.coroutines.flow.StateFlow
import java.util.Date

/**
 * Mock CalendarService for testing
 */
class MockCalendarService : CalendarService {
    private var accounts = listOf<CalendarAccount>()
    private var events = listOf<CalendarEvent>()
    private var error: CalendarError? = null

    fun setAccounts(accounts: List<CalendarAccount>) {
        this.accounts = accounts
    }

    fun setEvents(events: List<CalendarEvent>) {
        this.events = events
    }

    fun setError(errorMessage: String) {
        this.error = CalendarError.NetworkError(errorMessage)
    }

    override suspend fun fetchAccounts(): List<CalendarAccount> {
        if (error != null) {
            throw error!!
        }
        return accounts
    }

    override suspend fun fetchEvents(accountId: String): List<CalendarEvent> {
        if (error != null) {
            throw error!!
        }
        return events
    }

    override suspend fun createEvent(
        accountId: String,
        title: String,
        description: String?,
        startTime: String,
        endTime: String,
        location: String?,
        attendees: List<String>,
    ): CalendarEvent = CalendarEvent(
        id = "event_new",
        userId = "user_1",
        accountId = accountId,
        title = title,
        description = description,
        location = location,
        startTime = startTime,
        endTime = endTime,
        createdAt = "2026-02-04T10:00:00Z",
        updatedAt = "2026-02-04T10:00:00Z",
    )

    override suspend fun deleteEvent(accountId: String, eventId: String) {}

    override suspend fun updateEvent(
        accountId: String,
        eventId: String,
        title: String?,
        description: String?,
        startTime: String?,
        endTime: String?,
    ): CalendarEvent = CalendarEvent(
        id = eventId,
        userId = "user_1",
        accountId = accountId,
        title = title ?: "Event",
        description = description,
        startTime = startTime ?: "",
        endTime = endTime ?: "",
        createdAt = "2026-02-04T10:00:00Z",
        updatedAt = "2026-02-04T10:00:00Z",
    )

    override suspend fun getAnalytics(accountId: String): CalendarAnalytics = CalendarAnalytics(
        totalEvents = 42,
        averageAttendees = 3.5,
        conflictCount = 2,
    )
}

/**
 * Interface for CalendarService dependency injection
 */
interface CalendarService {
    suspend fun fetchAccounts(): List<CalendarAccount>
    suspend fun fetchEvents(accountId: String): List<CalendarEvent>
    suspend fun createEvent(
        accountId: String,
        title: String,
        description: String? = null,
        startTime: String,
        endTime: String,
        location: String? = null,
        attendees: List<String> = emptyList(),
    ): CalendarEvent

    suspend fun deleteEvent(accountId: String, eventId: String)

    suspend fun updateEvent(
        accountId: String,
        eventId: String,
        title: String? = null,
        description: String? = null,
        startTime: String? = null,
        endTime: String? = null,
    ): CalendarEvent

    suspend fun getAnalytics(accountId: String): CalendarAnalytics
}

/**
 * Mock CalendarViewModel for UI testing
 */
class MockCalendarViewModel(
    private val mockService: MockCalendarService = MockCalendarService(),
) : CalendarViewModel(mockService) {

    private val testAccounts = listOf(
        CalendarAccount(
            id = "account_1",
            userId = "user_1",
            provider = "google",
            displayName = "Personal Calendar",
            email = "user@example.com",
            isDefault = true,
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
        ),
    )

    private val testEvents = listOf(
        CalendarEvent(
            id = "event_1",
            userId = "user_1",
            accountId = "account_1",
            title = "Team Meeting",
            description = "Weekly sync up",
            location = "Conference Room A",
            startTime = "2026-02-04T10:00:00Z",
            endTime = "2026-02-04T11:00:00Z",
            attendeeCount = 5,
            createdAt = "2026-02-01T00:00:00Z",
            updatedAt = "2026-02-01T00:00:00Z",
        ),
        CalendarEvent(
            id = "event_2",
            userId = "user_1",
            accountId = "account_1",
            title = "Project Review",
            description = "Q1 project review",
            location = "Virtual",
            startTime = "2026-02-05T14:00:00Z",
            endTime = "2026-02-05T15:00:00Z",
            attendeeCount = 3,
            createdAt = "2026-02-02T00:00:00Z",
            updatedAt = "2026-02-02T00:00:00Z",
        ),
        CalendarEvent(
            id = "event_3",
            userId = "user_1",
            accountId = "account_1",
            title = "Lunch Break",
            description = null,
            location = "Cafeteria",
            startTime = "2026-02-04T12:00:00Z",
            endTime = "2026-02-04T13:00:00Z",
            attendeeCount = 1,
            createdAt = "2026-02-03T00:00:00Z",
            updatedAt = "2026-02-03T00:00:00Z",
        ),
    )

    init {
        mockService.setAccounts(testAccounts)
        mockService.setEvents(testEvents)
        loadAccounts()
    }

    fun setError(errorMessage: String) {
        mockService.setError(errorMessage)
    }

    fun setEvents(events: List<CalendarEvent>) {
        mockService.setEvents(events)
    }
}
