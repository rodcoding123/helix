package com.helix.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class CalendarUiState(
    val events: List<CalendarEvent> = emptyList(),
    val selectedEvent: CalendarEvent? = null,
    val accounts: List<CalendarAccount> = emptyList(),
    val selectedAccountId: String? = null,
    val currentDate: Date = Date(),
    val viewType: CalendarViewType = CalendarViewType.Month,
    val isLoading: Boolean = false,
    val error: CalendarError? = null,
    val searchQuery: String = "",
    val searchResults: List<CalendarEvent> = emptyList(),
    val analytics: CalendarAnalytics? = null,
)

enum class CalendarViewType {
    Month,
    Week,
    Day,
}

class CalendarViewModel(private val service: CalendarService) : ViewModel() {
    private val _uiState = MutableStateFlow(CalendarUiState())
    val uiState: StateFlow<CalendarUiState> = _uiState.asStateFlow()

    fun loadAccounts() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val accounts = service.getCalendarAccounts()
                val primaryOrFirst = accounts.firstOrNull { it.isPrimary } ?: accounts.firstOrNull()

                _uiState.update {
                    it.copy(
                        accounts = accounts,
                        selectedAccountId = primaryOrFirst?.id,
                        isLoading = false,
                        error = null,
                    )
                }

                primaryOrFirst?.id?.let { accountId ->
                    loadEvents(accountId)
                    loadAnalytics(accountId)
                }
            } catch (e: CalendarError) {
                _uiState.update { it.copy(isLoading = false, error = e) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = CalendarError.UnknownError) }
            }
        }
    }

    fun loadEvents(accountId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val events = service.getCalendarEvents(accountId)
                _uiState.update {
                    it.copy(events = events, isLoading = false, error = null)
                }
            } catch (e: CalendarError) {
                _uiState.update { it.copy(isLoading = false, error = e) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = CalendarError.UnknownError) }
            }
        }
    }

    fun selectEvent(event: CalendarEvent) {
        _uiState.update { it.copy(selectedEvent = event) }
    }

    fun deleteEvent(eventId: String) {
        viewModelScope.launch {
            try {
                service.deleteEvent(eventId)
                _uiState.update { state ->
                    state.copy(
                        events = state.events.filter { it.id != eventId },
                        selectedEvent = if (state.selectedEvent?.id == eventId) null else state.selectedEvent,
                    )
                }
            } catch (e: CalendarError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun checkConflicts(eventId: String) {
        viewModelScope.launch {
            try {
                service.checkConflicts(eventId)
            } catch (e: CalendarError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun search(query: String) {
        _uiState.update { it.copy(searchQuery = query) }

        if (query.isEmpty()) {
            _uiState.update { it.copy(searchResults = emptyList()) }
            return
        }

        viewModelScope.launch {
            try {
                val filter = CalendarSearchFilter(query = query)
                val results = service.searchEvents(filter)
                _uiState.update { it.copy(searchResults = results, error = null) }
            } catch (e: CalendarError) {
                _uiState.update { it.copy(error = e, searchResults = emptyList()) }
            }
        }
    }

    fun loadAnalytics(accountId: String) {
        viewModelScope.launch {
            try {
                val analytics = service.getCalendarStats(accountId)
                _uiState.update { it.copy(analytics = analytics, error = null) }
            } catch (e: CalendarError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun goToPreviousMonth() {
        val calendar = Calendar.getInstance()
        calendar.time = _uiState.value.currentDate
        calendar.add(Calendar.MONTH, -1)
        _uiState.update { it.copy(currentDate = calendar.time) }
    }

    fun goToNextMonth() {
        val calendar = Calendar.getInstance()
        calendar.time = _uiState.value.currentDate
        calendar.add(Calendar.MONTH, 1)
        _uiState.update { it.copy(currentDate = calendar.time) }
    }

    fun goToToday() {
        _uiState.update { it.copy(currentDate = Date()) }
    }

    fun setViewType(viewType: CalendarViewType) {
        _uiState.update { it.copy(viewType = viewType) }
    }

    fun eventsForDate(date: Date): List<CalendarEvent> {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val targetDate = dateFormat.format(date)
        return _uiState.value.events.filter { event ->
            event.startTime.startsWith(targetDate)
        }
    }

    fun eventsForMonth(): List<CalendarEvent> {
        val calendar = Calendar.getInstance()
        calendar.time = _uiState.value.currentDate

        val year = calendar.get(Calendar.YEAR)
        val month = calendar.get(Calendar.MONTH) + 1

        return _uiState.value.events.filter { event ->
            event.startTime.substring(0, 7) == String.format("%04d-%02d", year, month)
        }
    }

    fun upcomingEvents(limit: Int = 3): List<CalendarEvent> {
        return _uiState.value.events.sortedBy { it.startTime }.take(limit)
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun refresh(accountId: String) {
        loadEvents(accountId)
        loadAnalytics(accountId)
    }
}
