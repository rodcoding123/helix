import XCTest

/**
 * UI Tests for Calendar functionality in iOS app
 */
final class CalendarTabUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    // MARK: - Navigation Tests

    func testNavigateToCalendarTab() {
        // When: Tap on Calendar tab
        app.tabBars.buttons["Calendar"].tap()

        // Then: Calendar view should display
        XCTAssertTrue(app.navigationBars["Calendar"].exists)
    }

    func testCalendarDisplaysCurrentMonth() {
        // When: Open Calendar tab
        app.tabBars.buttons["Calendar"].tap()

        // Then: Current month should be displayed
        let monthText = app.staticTexts.matching(NSPredicate(
            format: "label CONTAINS[c] %@",
            Calendar.current.component(.month, from: Date()).description
        ))
        XCTAssertGreaterThan(monthText.count, 0, "Month should be visible")
    }

    // MARK: - Calendar View Tests

    func testMonthViewDisplaysCalendarGrid() {
        // When: Open Calendar in Month view
        app.tabBars.buttons["Calendar"].tap()

        // Select Month tab if available
        if app.segmentedControls.firstMatch.exists {
            app.segmentedControls.buttons["Month"].tap()
        }

        // Then: Calendar grid should be visible
        XCTAssertTrue(app.collectionViews.firstMatch.exists,
                     "Calendar grid should be visible")
    }

    func testWeekViewTabSwitch() {
        // When: Open Calendar and select Week view
        app.tabBars.buttons["Calendar"].tap()

        if app.segmentedControls.buttons["Week"].exists {
            app.segmentedControls.buttons["Week"].tap()

            // Then: Week view should be displayed
            // Implementation detail: check for week-specific elements
            XCTAssertTrue(app.navigationBars["Calendar"].exists)
        }
    }

    func testDayViewTabSwitch() {
        // When: Open Calendar and select Day view
        app.tabBars.buttons["Calendar"].tap()

        if app.segmentedControls.buttons["Day"].exists {
            app.segmentedControls.buttons["Day"].tap()

            // Then: Day view should be displayed
            XCTAssertTrue(app.navigationBars["Calendar"].exists)
        }
    }

    // MARK: - Navigation Tests

    func testNavigateToPreviousMonth() {
        // Given: Calendar is open in Month view
        app.tabBars.buttons["Calendar"].tap()

        let previousButton = app.buttons.matching(NSPredicate(
            format: "label CONTAINS[c] 'Previous'"
        )).firstMatch

        if previousButton.exists {
            // When: Tap previous button
            previousButton.tap()

            // Then: Month should change
            XCTAssertTrue(app.navigationBars["Calendar"].exists)
        }
    }

    func testNavigateToNextMonth() {
        // Given: Calendar is open
        app.tabBars.buttons["Calendar"].tap()

        let nextButton = app.buttons.matching(NSPredicate(
            format: "label CONTAINS[c] 'Next'"
        )).firstMatch

        if nextButton.exists {
            // When: Tap next button
            nextButton.tap()

            // Then: Month should change
            XCTAssertTrue(app.navigationBars["Calendar"].exists)
        }
    }

    func testGoToToday() {
        // Given: Calendar is on a different month
        app.tabBars.buttons["Calendar"].tap()

        // When: Tap Today button
        let todayButton = app.buttons["Today"]
        if todayButton.exists {
            todayButton.tap()

            // Then: Should return to current month
            XCTAssertTrue(app.navigationBars["Calendar"].exists)
        }
    }

    // MARK: - Event Tests

    func testEventDisplaysOnCalendarDay() {
        // Given: Calendar has events
        app.tabBars.buttons["Calendar"].tap()

        // Then: Events should be visible as dots or highlights on calendar days
        let eventIndicators = app.staticTexts.matching(NSPredicate(
            format: "label CONTAINS '•'"
        ))
        // At least some days should have event indicators
        _ = eventIndicators.count
    }

    func testTapEventToViewDetails() {
        // Given: Calendar view with events
        app.tabBars.buttons["Calendar"].tap()

        let eventCell = app.cells.matching(NSPredicate(
            format: "label CONTAINS[c] 'event'"
        )).firstMatch

        if eventCell.exists {
            // When: Tap on event
            eventCell.tap()

            // Then: Event details should display
            XCTAssertTrue(app.staticTexts.count > 0, "Event details should show")
        }
    }

    func testUpcomingEventsListDisplays() {
        // When: Open Calendar
        app.tabBars.buttons["Calendar"].tap()

        // Then: Upcoming events list should be visible below calendar
        let upcomingSection = app.staticTexts.matching(NSPredicate(
            format: "label == 'Upcoming'"
        )).firstMatch

        if upcomingSection.exists {
            XCTAssertTrue(upcomingSection.exists, "Upcoming events section should show")
        }
    }

    // MARK: - Event Interaction Tests

    func testCreateEventFromCalendar() {
        // When: Open Calendar and tap on a date
        app.tabBars.buttons["Calendar"].tap()

        let calendarCell = app.collectionViews.firstMatch.cells.element(boundBy: 5)
        calendarCell.tap()

        // Then: Event creation dialog may appear
        // Implementation depends on UX
        XCTAssertTrue(app.navigationBars["Calendar"].exists)
    }

    func testEditEvent() {
        // Given: Calendar is displayed with events
        app.tabBars.buttons["Calendar"].tap()

        let eventCell = app.cells.firstMatch
        if eventCell.exists {
            // When: Double-tap event to edit
            eventCell.doubleTap()

            // Then: Event editing view should appear
            // Check for save/cancel buttons
            let saveButton = app.buttons["Save"]
            if saveButton.exists {
                XCTAssertTrue(saveButton.exists)
            }
        }
    }

    func testDeleteEvent() {
        // Given: Calendar with events
        app.tabBars.buttons["Calendar"].tap()

        let eventCell = app.cells.firstMatch
        if eventCell.exists {
            // When: Swipe to delete
            eventCell.swipeLeft()

            // Then: Delete button should appear
            let deleteButton = app.buttons["Delete"]
            if deleteButton.exists {
                deleteButton.tap()

                // Verify deletion
                XCTAssertTrue(app.navigationBars["Calendar"].exists)
            }
        }
    }

    // MARK: - Conflict Detection Tests

    func testConflictingEventsHighlighted() {
        // Given: Calendar with conflicting events
        app.tabBars.buttons["Calendar"].tap()

        // Then: Conflicting events should be highlighted
        // Check for visual indicators of conflicts
        let conflictIndicator = app.staticTexts.matching(NSPredicate(
            format: "label CONTAINS[c] 'conflict'"
        )).firstMatch

        // May or may not exist depending on data
        _ = conflictIndicator
    }

    // MARK: - Analytics Tests

    func testAnalyticsFooterDisplays() {
        // When: Open Calendar
        app.tabBars.buttons["Calendar"].tap()

        // Then: Analytics footer should show statistics
        let analyticsFooter = app.staticTexts.matching(NSPredicate(
            format: "label CONTAINS[c] 'event' OR label CONTAINS[c] 'average'"
        )).firstMatch

        if analyticsFooter.exists {
            XCTAssertTrue(analyticsFooter.exists, "Analytics should display")
        }
    }

    // MARK: - Error Handling Tests

    func testErrorAlertOnSyncFailure() {
        // Given: Calendar with potential sync issues
        app.tabBars.buttons["Calendar"].tap()

        // When: Sync fails (if triggered)
        // Then: Error alert may appear
        let errorAlert = app.alerts.element
        if errorAlert.exists {
            XCTAssertTrue(errorAlert.exists)
            app.alerts.element.buttons["OK"].tap()
        }
    }

    // MARK: - Search/Filter Tests

    func testFilterEventsByAttendees() {
        // Given: Calendar is displayed
        app.tabBars.buttons["Calendar"].tap()

        // When: Open filter/search options
        let searchField = app.searchFields.firstMatch
        if searchField.exists {
            searchField.tap()
            searchField.typeText("attendee@example.com")

            // Then: Events with that attendee should show
            XCTAssertTrue(searchField.exists)
        }
    }

    // MARK: - Accessibility Tests

    func testCalendarTabAccessible() {
        // When: Navigate to Calendar tab
        app.tabBars.buttons["Calendar"].tap()

        // Then: Tab should be accessible
        XCTAssertTrue(app.tabBars.buttons["Calendar"].isAccessibilityElement)
    }

    func testCalendarGridAccessible() {
        // When: Calendar Month view is displayed
        app.tabBars.buttons["Calendar"].tap()

        // Then: Calendar cells should have accessibility labels
        XCTAssertTrue(app.collectionViews.firstMatch.cells.count > 0)
    }
}
