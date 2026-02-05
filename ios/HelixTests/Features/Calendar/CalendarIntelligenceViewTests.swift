import XCTest
@testable import Helix

@MainActor
class CalendarIntelligenceViewTests: XCTestCase {

  func testCalendarIntelligenceViewRendering() {
    let view = CalendarIntelligenceView()
    XCTAssertNotNil(view)
  }

  func testCalendarEventModel() {
    let attendees = ["alice@example.com", "bob@example.com"]
    let start = Date()
    let end = start.addingTimeInterval(3600)

    let event = CalendarEvent(
      id: UUID(),
      title: "Team Meeting",
      startTime: start,
      endTime: end,
      attendees: attendees,
      description: "Weekly sync"
    )

    XCTAssertEqual(event.title, "Team Meeting")
    XCTAssertEqual(event.attendees.count, 2)
    XCTAssertEqual(event.description, "Weekly sync")
  }

  func testMeetingPrepDataModel() {
    let prep = MeetingPrepData(
      summary: "Meeting overview",
      keyPoints: ["Point 1", "Point 2", "Point 3"],
      suggestedTopics: ["Topic A", "Topic B"],
      preparationEstimate: 15
    )

    XCTAssertEqual(prep.summary, "Meeting overview")
    XCTAssertEqual(prep.keyPoints.count, 3)
    XCTAssertEqual(prep.preparationEstimate, 15)
  }

  func testTimeSuggestionModel() {
    let dateTime = Date().addingTimeInterval(86400) // Tomorrow
    let suggestion = TimeSuggestion(
      id: UUID(),
      dateTime: dateTime,
      qualityScore: 85.5,
      reason: "All attendees available",
      attendeeAvailability: 0.95
    )

    XCTAssertEqual(suggestion.qualityScore, 85.5)
    XCTAssertEqual(suggestion.attendeeAvailability, 0.95)
    XCTAssertEqual(suggestion.reason, "All attendees available")
  }

  func testMeetingMinutesToStart() {
    let now = Date()
    let soon = now.addingTimeInterval(600) // 10 minutes
    let later = now.addingTimeInterval(3600) // 60 minutes

    let soonEvent = CalendarEvent(
      id: UUID(),
      title: "Soon",
      startTime: soon,
      endTime: soon.addingTimeInterval(3600),
      attendees: [],
      description: nil
    )

    let laterEvent = CalendarEvent(
      id: UUID(),
      title: "Later",
      startTime: later,
      endTime: later.addingTimeInterval(3600),
      attendees: [],
      description: nil
    )

    XCTAssert(soonEvent.minutesToStart <= 15)
    XCTAssertGreaterThan(laterEvent.minutesToStart, 15)
  }

  func testDateRange() {
    let start = Date()
    let end = start.addingTimeInterval(7 * 24 * 3600) // 7 days

    var range = DateRange(start: start, end: end)
    XCTAssertLessThan(range.start, range.end)

    range.start = end
    XCTAssertGreaterThanOrEqual(range.start, range.end)
  }

  func testTimeSuggestionQualityScore() {
    let highQuality = TimeSuggestion(
      id: UUID(),
      dateTime: Date(),
      qualityScore: 95.0,
      reason: "Optimal time",
      attendeeAvailability: 1.0
    )

    let mediumQuality = TimeSuggestion(
      id: UUID(),
      dateTime: Date(),
      qualityScore: 65.0,
      reason: "Some conflicts",
      attendeeAvailability: 0.7
    )

    let lowQuality = TimeSuggestion(
      id: UUID(),
      dateTime: Date(),
      qualityScore: 35.0,
      reason: "Poor availability",
      attendeeAvailability: 0.3
    )

    XCTAssertGreater(highQuality.qualityScore, mediumQuality.qualityScore)
    XCTAssertGreater(mediumQuality.qualityScore, lowQuality.qualityScore)
  }
}

@MainActor
class CalendarIntelligenceViewModelTests: XCTestCase {
  var viewModel: CalendarIntelligenceViewModel!

  override func setUp() {
    super.setUp()
    viewModel = CalendarIntelligenceViewModel()
  }

  override func tearDown() {
    viewModel = nil
    super.tearDown()
  }

  func testInitialState() {
    XCTAssertEqual(viewModel.selectedTab, .prep)
    XCTAssertFalse(viewModel.isLoading)
    XCTAssertNil(viewModel.error)
    XCTAssertTrue(viewModel.calendarOperations.isEmpty)
    XCTAssertTrue(viewModel.upcomingMeetings.isEmpty)
    XCTAssertTrue(viewModel.preparationData.isEmpty)
    XCTAssertTrue(viewModel.suggestedTimes.isEmpty)
  }

  func testToggleOperation() {
    viewModel.calendarOperations["calendar-prep"] = true
    viewModel.calendarOperations["calendar-time"] = false

    viewModel.toggleOperation("calendar-prep")
    XCTAssertFalse(viewModel.calendarOperations["calendar-prep"] ?? true)

    viewModel.toggleOperation("calendar-time")
    XCTAssertTrue(viewModel.calendarOperations["calendar-time"] ?? false)
  }

  func testIsOperationEnabled() {
    viewModel.calendarOperations["calendar-prep"] = true
    viewModel.calendarOperations["calendar-time"] = false

    XCTAssertTrue(viewModel.isOperationEnabled("calendar-prep"))
    XCTAssertFalse(viewModel.isOperationEnabled("calendar-time"))
    XCTAssertFalse(viewModel.isOperationEnabled("nonexistent"))
  }

  func testUpcomingMeetingsLoading() {
    let meetings = (0..<3).map { i in
      CalendarEvent(
        id: UUID(),
        title: "Meeting \(i)",
        startTime: Date().addingTimeInterval(Double(i) * 3600),
        endTime: Date().addingTimeInterval(Double(i) * 3600 + 1800),
        attendees: ["attendee@example.com"],
        description: nil
      )
    }

    viewModel.upcomingMeetings = meetings
    XCTAssertEqual(viewModel.upcomingMeetings.count, 3)
  }

  func testPreparationDataStorage() {
    let meetingId = UUID()
    let prep = MeetingPrepData(
      summary: "Test summary",
      keyPoints: ["Point 1", "Point 2"],
      suggestedTopics: ["Topic 1"],
      preparationEstimate: 10
    )

    viewModel.preparationData[meetingId] = prep
    XCTAssertEqual(viewModel.preparationData[meetingId]?.summary, "Test summary")
    XCTAssertEqual(viewModel.preparationData[meetingId]?.keyPoints.count, 2)
  }

  func testSuggestedTimesStorage() {
    let suggestions = (0..<5).map { i in
      TimeSuggestion(
        id: UUID(),
        dateTime: Date().addingTimeInterval(Double(i) * 3600),
        qualityScore: Double(100 - i * 10),
        reason: "Reason \(i)",
        attendeeAvailability: 0.9 - Double(i) * 0.1
      )
    }

    viewModel.suggestedTimes = suggestions
    XCTAssertEqual(viewModel.suggestedTimes.count, 5)

    // Verify ordering by quality score
    let sorted = viewModel.suggestedTimes.sorted { $0.qualityScore > $1.qualityScore }
    XCTAssertGreater(sorted[0].qualityScore, sorted[1].qualityScore)
  }

  func testTabSelection() {
    viewModel.selectedTab = .prep
    XCTAssertEqual(viewModel.selectedTab, .prep)

    viewModel.selectedTab = .timeSuggestion
    XCTAssertEqual(viewModel.selectedTab, .timeSuggestion)
  }

  func testLoadingStateTransitions() {
    XCTAssertFalse(viewModel.isLoading)

    viewModel.isLoading = true
    XCTAssertTrue(viewModel.isLoading)

    viewModel.isLoading = false
    XCTAssertFalse(viewModel.isLoading)
  }

  func testErrorStateHandling() {
    let errorMessage = "Test error occurred"
    viewModel.error = errorMessage

    XCTAssertEqual(viewModel.error, errorMessage)

    viewModel.error = nil
    XCTAssertNil(viewModel.error)
  }

  func testMultipleMeetingPrep() {
    let meetings = (0..<3).map { i in
      CalendarEvent(
        id: UUID(),
        title: "Meeting \(i)",
        startTime: Date().addingTimeInterval(Double(i) * 7200),
        endTime: Date().addingTimeInterval(Double(i) * 7200 + 3600),
        attendees: ["user\(i)@example.com"],
        description: "Description \(i)"
      )
    }

    viewModel.upcomingMeetings = meetings

    for meeting in meetings {
      let prep = MeetingPrepData(
        summary: "Summary for \(meeting.title)",
        keyPoints: ["Point A", "Point B"],
        suggestedTopics: ["Topic"],
        preparationEstimate: 15
      )
      viewModel.preparationData[meeting.id] = prep
    }

    XCTAssertEqual(viewModel.preparationData.count, 3)

    for meeting in meetings {
      XCTAssertNotNil(viewModel.preparationData[meeting.id])
    }
  }

  func testCalendarEventWithMultipleAttendees() {
    let attendees = ["alice@example.com", "bob@example.com", "charlie@example.com"]
    let event = CalendarEvent(
      id: UUID(),
      title: "Team Sync",
      startTime: Date(),
      endTime: Date().addingTimeInterval(3600),
      attendees: attendees,
      description: "Weekly team meeting"
    )

    viewModel.upcomingMeetings = [event]
    XCTAssertEqual(viewModel.upcomingMeetings[0].attendees.count, 3)
  }

  func testMeetingPrepWithEmptyKeyPoints() {
    let prep = MeetingPrepData(
      summary: "Summary",
      keyPoints: [],
      suggestedTopics: ["Topic 1"],
      preparationEstimate: 5
    )

    XCTAssertTrue(prep.keyPoints.isEmpty)
    XCTAssertEqual(prep.suggestedTopics.count, 1)
  }

  func testTimeSuggestionsOrdering() {
    let suggestions = [
      TimeSuggestion(
        id: UUID(),
        dateTime: Date(),
        qualityScore: 85.0,
        reason: "Good",
        attendeeAvailability: 0.85
      ),
      TimeSuggestion(
        id: UUID(),
        dateTime: Date(),
        qualityScore: 95.0,
        reason: "Excellent",
        attendeeAvailability: 0.95
      ),
      TimeSuggestion(
        id: UUID(),
        dateTime: Date(),
        qualityScore: 75.0,
        reason: "Fair",
        attendeeAvailability: 0.75
      ),
    ]

    viewModel.suggestedTimes = suggestions.sorted { $0.qualityScore > $1.qualityScore }

    XCTAssertEqual(viewModel.suggestedTimes[0].qualityScore, 95.0)
    XCTAssertEqual(viewModel.suggestedTimes[1].qualityScore, 85.0)
    XCTAssertEqual(viewModel.suggestedTimes[2].qualityScore, 75.0)
  }

  func testPrepDataMultipleKeyPoints() {
    let prep = MeetingPrepData(
      summary: "Overview",
      keyPoints: ["A", "B", "C", "D", "E"],
      suggestedTopics: ["T1", "T2"],
      preparationEstimate: 20
    )

    XCTAssertEqual(prep.keyPoints.count, 5)
    let limited = prep.keyPoints.prefix(3)
    XCTAssertEqual(limited.count, 3)
  }

  func testOperationLoadingSequence() {
    viewModel.calendarOperations = [
      "calendar-prep": true,
      "calendar-time": true
    ]

    let enabledCount = viewModel.calendarOperations.values.filter { $0 }.count
    XCTAssertEqual(enabledCount, 2)
  }

  func testMeetingInSoonWindow() {
    let now = Date()
    let inFifteenMinutes = now.addingTimeInterval(900)

    let soon = CalendarEvent(
      id: UUID(),
      title: "Soon",
      startTime: inFifteenMinutes,
      endTime: inFifteenMinutes.addingTimeInterval(3600),
      attendees: [],
      description: nil
    )

    XCTAssertLessThanOrEqual(soon.minutesToStart, 15)
  }

  func testMultipleSuggestedTimesWithVariingAvailability() {
    let suggestions = (0..<5).map { i in
      TimeSuggestion(
        id: UUID(),
        dateTime: Date().addingTimeInterval(Double(i) * 86400),
        qualityScore: Double(100 - i * 5),
        reason: "Availability: \(Int((1.0 - Double(i) * 0.1) * 100))%",
        attendeeAvailability: max(0.0, 1.0 - Double(i) * 0.1)
      )
    }

    viewModel.suggestedTimes = suggestions
    XCTAssertEqual(viewModel.suggestedTimes.count, 5)

    let fullAvailability = viewModel.suggestedTimes.filter { $0.attendeeAvailability >= 0.9 }
    XCTAssertGreater(fullAvailability.count, 0)
  }

  func testErrorClearingOnNewOperation() {
    viewModel.error = "Previous error"
    XCTAssertEqual(viewModel.error, "Previous error")

    viewModel.error = nil
    XCTAssertNil(viewModel.error)
  }

  func testEmptyOperationsState() {
    XCTAssertTrue(viewModel.calendarOperations.isEmpty)
    XCTAssertFalse(viewModel.isOperationEnabled("any-operation"))
  }
}
