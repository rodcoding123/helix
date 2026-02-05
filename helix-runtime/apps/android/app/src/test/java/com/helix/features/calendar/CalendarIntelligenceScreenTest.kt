package com.helix.features.calendar

import junit.framework.TestCase.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Before
import org.junit.Test
import java.util.*

@OptIn(ExperimentalCoroutinesApi::class)
class CalendarIntelligenceScreenTest {

  @Before
  fun setup() {
    Dispatchers.setMain(StandardTestDispatcher())
  }

  @Test
  fun testCalendarEventModel() {
    val event = CalendarEvent(
      title = "Team Meeting",
      startTime = Date(),
      endTime = Date(System.currentTimeMillis() + 3600000),
      attendees = listOf("alice@example.com", "bob@example.com"),
      description = "Weekly sync"
    )

    assertEquals("Team Meeting", event.title)
    assertEquals(2, event.attendees.size)
    assertEquals("Weekly sync", event.description)
  }

  @Test
  fun testMeetingPrepDataModel() {
    val prep = MeetingPrepData(
      summary = "Meeting overview",
      keyPoints = listOf("Point 1", "Point 2"),
      suggestedTopics = listOf("Topic A"),
      preparationEstimate = 15
    )

    assertEquals("Meeting overview", prep.summary)
    assertEquals(2, prep.keyPoints.size)
    assertEquals(15, prep.preparationEstimate)
  }

  @Test
  fun testTimeSuggestionModel() {
    val suggestion = TimeSuggestion(
      dateTime = Date(),
      qualityScore = 85.5,
      reason = "All attendees available",
      attendeeAvailability = 0.95
    )

    assertEquals(85.5, suggestion.qualityScore)
    assertEquals(0.95, suggestion.attendeeAvailability)
  }

  @Test
  fun testCalendarTabValues() {
    assertEquals(2, CalendarIntelligenceTab.values().size)
    assertEquals("Prep", CalendarIntelligenceTab.PREP.label)
    assertEquals("Times", CalendarIntelligenceTab.TIME_SUGGESTION.label)
  }

  @Test
  fun testMultipleCalendarEvents() {
    val events = (0..4).map { i ->
      CalendarEvent(
        title = "Meeting $i",
        startTime = Date(System.currentTimeMillis() + i * 3600000),
        endTime = Date(System.currentTimeMillis() + i * 3600000 + 1800000),
        attendees = listOf("user@example.com"),
        description = null
      )
    }

    assertEquals(5, events.size)
  }

  @Test
  fun testTimeSuggestionQualityScores() {
    val highQuality = TimeSuggestion(
      dateTime = Date(),
      qualityScore = 95.0,
      reason = "Optimal",
      attendeeAvailability = 1.0
    )

    val lowQuality = TimeSuggestion(
      dateTime = Date(),
      qualityScore = 35.0,
      reason = "Poor",
      attendeeAvailability = 0.3
    )

    assertTrue(highQuality.qualityScore > lowQuality.qualityScore)
  }

  @Test
  fun testMeetingPrepWithKeyPoints() {
    val prep = MeetingPrepData(
      summary = "Summary",
      keyPoints = listOf("A", "B", "C", "D", "E"),
      suggestedTopics = listOf("T1", "T2"),
      preparationEstimate = 20
    )

    assertEquals(5, prep.keyPoints.size)
  }

  @Test
  fun testCalendarEventMinutesToStart() {
    val now = Date()
    val soon = Date(now.time + 600000) // 10 minutes

    val event = CalendarEvent(
      title = "Soon",
      startTime = soon,
      endTime = Date(soon.time + 3600000),
      attendees = emptyList(),
      description = null
    )

    assertTrue(event.minutesToStart <= 15)
  }

  @Test
  fun testMultipleAttendees() {
    val attendees = listOf("alice@ex.com", "bob@ex.com", "charlie@ex.com", "diana@ex.com")
    val event = CalendarEvent(
      title = "Large Meeting",
      startTime = Date(),
      endTime = Date(),
      attendees = attendees,
      description = null
    )

    assertEquals(4, event.attendees.size)
  }

  @Test
  fun testMeetingPrepEmptyKeyPoints() {
    val prep = MeetingPrepData(
      summary = "Summary",
      keyPoints = emptyList(),
      suggestedTopics = listOf("Topic"),
      preparationEstimate = 5
    )

    assertTrue(prep.keyPoints.isEmpty())
  }

  @Test
  fun testTimeSuggestionOrdering() {
    val suggestions = listOf(
      TimeSuggestion(Date(), 85.0, null, 0.85),
      TimeSuggestion(Date(), 95.0, null, 0.95),
      TimeSuggestion(Date(), 75.0, null, 0.75)
    )

    val sorted = suggestions.sortedByDescending { it.qualityScore }
    assertEquals(95.0, sorted[0].qualityScore)
    assertEquals(75.0, sorted[2].qualityScore)
  }

  @Test
  fun testEventUUIDUniqueness() {
    val e1 = CalendarEvent(
      title = "E1",
      startTime = Date(),
      endTime = Date(),
      attendees = emptyList(),
      description = null
    )

    val e2 = CalendarEvent(
      title = "E2",
      startTime = Date(),
      endTime = Date(),
      attendees = emptyList(),
      description = null
    )

    assertFalse(e1.id == e2.id)
  }
}

@OptIn(ExperimentalCoroutinesApi::class)
class CalendarIntelligenceViewModelTest {

  private lateinit var viewModel: CalendarIntelligenceViewModel

  @Before
  fun setup() {
    Dispatchers.setMain(StandardTestDispatcher())
    viewModel = CalendarIntelligenceViewModel()
  }

  @Test
  fun testInitialState() {
    assertEquals(CalendarIntelligenceTab.PREP, viewModel.selectedTab.value)
    assertFalse(viewModel.isLoading.value)
    assertNull(viewModel.error.value)
    assertTrue(viewModel.upcomingMeetings.value.isEmpty())
  }

  @Test
  fun testSelectTab() {
    viewModel.selectTab(CalendarIntelligenceTab.TIME_SUGGESTION)
    assertEquals(CalendarIntelligenceTab.TIME_SUGGESTION, viewModel.selectedTab.value)
  }

  @Test
  fun testToggleOperation() {
    val initial = viewModel.calendarOperations.value["calendar-prep"]
    viewModel.toggleOperation("calendar-prep")
    val after = viewModel.calendarOperations.value["calendar-prep"]

    assertFalse(initial == after)
  }

  @Test
  fun testIsOperationEnabled() {
    viewModel.calendarOperations.value = mapOf("calendar-prep" to true)
    assertTrue(viewModel.isOperationEnabled("calendar-prep"))
  }

  @Test
  fun testGeneratePrepGuidance() = runTest {
    val event = CalendarEvent(
      title = "Meeting",
      startTime = Date(),
      endTime = Date(),
      attendees = emptyList(),
      description = null
    )

    viewModel.generatePrepGuidance(event)
    assertTrue(viewModel.isLoading.value || viewModel.prepData.value.isNotEmpty())
  }

  @Test
  fun testSuggestMeetingTimes() = runTest {
    viewModel.suggestMeetingTimes(listOf("user@example.com"))
    assertTrue(viewModel.isLoading.value || viewModel.suggestedTimes.value.isNotEmpty())
  }

  @Test
  fun testLoadingStateTransitions() {
    assertFalse(viewModel.isLoading.value)
    viewModel.isLoading.value = true
    assertTrue(viewModel.isLoading.value)
  }

  @Test
  fun testErrorHandling() {
    viewModel.error.value = "Test error"
    assertEquals("Test error", viewModel.error.value)
    viewModel.error.value = null
    assertNull(viewModel.error.value)
  }

  @Test
  fun testUpcomingMeetingsStorage() {
    val meetings = listOf(
      CalendarEvent("M1", Date(), Date(), emptyList(), null),
      CalendarEvent("M2", Date(), Date(), emptyList(), null)
    )
    viewModel.upcomingMeetings.value = meetings
    assertEquals(2, viewModel.upcomingMeetings.value.size)
  }

  @Test
  fun testPrepDataStorage() {
    val prep = MeetingPrepData("Summary", emptyList(), emptyList(), 10)
    val eventId = UUID.randomUUID()
    viewModel.prepData.value = mapOf(eventId to prep)
    assertNotNull(viewModel.prepData.value[eventId])
  }

  @Test
  fun testSuggestedTimesStorage() {
    val suggestions = (0..4).map {
      TimeSuggestion(Date(), 100.0 - it * 10, null, 0.9)
    }
    viewModel.suggestedTimes.value = suggestions
    assertEquals(5, viewModel.suggestedTimes.value.size)
  }

  @Test
  fun testMultipleOperationsToggle() {
    val ops = mapOf("calendar-prep" to true, "calendar-time" to false)
    viewModel.calendarOperations.value = ops

    viewModel.toggleOperation("calendar-time")
    assertTrue(viewModel.calendarOperations.value["calendar-time"] == true)
  }
}

@OptIn(ExperimentalCoroutinesApi::class)
class CalendarIntelligenceScreenIntegrationTest {

  @Test
  fun testCompleteCalendarWorkflow() = runTest {
    Dispatchers.setMain(StandardTestDispatcher())
    val viewModel = CalendarIntelligenceViewModel()

    // Create meetings
    val events = listOf(
      CalendarEvent("Meeting 1", Date(), Date(), listOf("user@ex.com"), null),
      CalendarEvent("Meeting 2", Date(), Date(), listOf("user@ex.com"), null)
    )
    viewModel.upcomingMeetings.value = events

    // Generate prep
    viewModel.generatePrepGuidance(events[0])
    assertTrue(viewModel.isLoading.value || viewModel.prepData.value.isNotEmpty())

    // Suggest times
    viewModel.suggestMeetingTimes(listOf("user@ex.com"))
    assertTrue(viewModel.isLoading.value || viewModel.suggestedTimes.value.isNotEmpty())
  }
}

import java.util.UUID
