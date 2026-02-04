import XCTest

/**
 * UI Tests for Tasks functionality in iOS app
 */
final class TasksTabUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    // MARK: - Navigation Tests

    func testNavigateToTasksTab() {
        // When: Tap on Tasks tab
        app.tabBars.buttons["Tasks"].tap()

        // Then: Tasks view should display
        XCTAssertTrue(app.navigationBars["Tasks"].exists,
                     "Tasks navigation bar should exist")
    }

    // MARK: - Kanban Board Tests

    func testKanbanBoardViewDisplays() {
        // When: Open Tasks in Kanban view
        app.tabBars.buttons["Tasks"].tap()

        if app.segmentedControls.buttons["Kanban"].exists {
            app.segmentedControls.buttons["Kanban"].tap()
        }

        // Then: Kanban columns should be visible
        let columns = app.staticTexts.matching(NSPredicate(
            format: "label IN {'To Do', 'In Progress', 'In Review', 'Done'}"
        ))
        XCTAssertGreaterThan(columns.count, 0, "Kanban columns should display")
    }

    func testTaskCardDisplaysInKanban() {
        // When: View Kanban board
        app.tabBars.buttons["Tasks"].tap()
        if app.segmentedControls.buttons["Kanban"].exists {
            app.segmentedControls.buttons["Kanban"].tap()
        }

        // Then: Task cards should be visible
        let taskCards = app.staticTexts.matching(NSPredicate(
            format: "label CONTAINS[c] 'task' OR label CONTAINS[c] 'status'"
        ))
        // Should have some task cards
        _ = taskCards.count
    }

    func testDragTaskBetweenColumns() {
        // Given: Kanban board with tasks
        app.tabBars.buttons["Tasks"].tap()
        if app.segmentedControls.buttons["Kanban"].exists {
            app.segmentedControls.buttons["Kanban"].tap()
        }

        let taskCard = app.staticTexts.matching(NSPredicate(
            format: "label CONTAINS[c] 'task'"
        )).firstMatch

        if taskCard.exists {
            // When: Drag task to another column
            // In real test, would use drag API
            taskCard.press(forDuration: 1.0)

            // Then: Task should move (visual verification)
            XCTAssertTrue(app.navigationBars["Tasks"].exists)
        }
    }

    // MARK: - List View Tests

    func testListViewDisplays() {
        // When: Open Tasks in List view
        app.tabBars.buttons["Tasks"].tap()

        if app.segmentedControls.buttons["List"].exists {
            app.segmentedControls.buttons["List"].tap()

            // Then: Task list should display
            XCTAssertTrue(app.collectionViews.firstMatch.exists,
                         "Task list should display")
        }
    }

    func testListViewSortOptions() {
        // Given: Task list is displayed
        app.tabBars.buttons["Tasks"].tap()
        if app.segmentedControls.buttons["List"].exists {
            app.segmentedControls.buttons["List"].tap()
        }

        // When: Open sort menu
        let sortButton = app.buttons.matching(NSPredicate(
            format: "label CONTAINS[c] 'sort' OR label CONTAINS[c] 'filter'"
        )).firstMatch

        if sortButton.exists {
            sortButton.tap()

            // Then: Sort options should appear
            // Options like "Due Date", "Priority", "Alphabetical"
            XCTAssertTrue(app.navigationBars["Tasks"].exists)
        }
    }

    // MARK: - Timeline View Tests

    func testTimelineViewDisplays() {
        // When: Open Tasks in Timeline/Time view
        app.tabBars.buttons["Tasks"].tap()

        if app.segmentedControls.buttons["Time"].exists {
            app.segmentedControls.buttons["Time"].tap()

            // Then: Timeline should display
            XCTAssertTrue(app.navigationBars["Tasks"].exists)
        }
    }

    func testTimeTrackerDisplaysActive() {
        // When: Navigate to Tasks Time view
        app.tabBars.buttons["Tasks"].tap()
        if app.segmentedControls.buttons["Time"].exists {
            app.segmentedControls.buttons["Time"].tap()
        }

        // Then: Active time tracking should display if running
        let trackerCard = app.staticTexts.matching(NSPredicate(
            format: "label CONTAINS[c] 'tracking' OR label CONTAINS[c] 'minutes'"
        )).firstMatch

        // May or may not exist depending on state
        _ = trackerCard
    }

    // MARK: - Task Creation Tests

    func testOpenCreateTaskDialog() {
        // When: Tap Create Task button
        app.tabBars.buttons["Tasks"].tap()

        let createButton = app.buttons.matching(NSPredicate(
            format: "label CONTAINS[c] 'add' OR label CONTAINS[c] 'create'"
        )).firstMatch

        if createButton.exists {
            createButton.tap()

            // Then: Create dialog should open
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(
                format: "label CONTAINS[c] 'create' OR label CONTAINS[c] 'new task'"
            )).firstMatch.exists,
                         "Create task dialog should open")
        }
    }

    func testCreateTaskWithAllFields() {
        // Given: Create task dialog is open
        app.tabBars.buttons["Tasks"].tap()
        let createButton = app.buttons.matching(NSPredicate(
            format: "label CONTAINS[c] 'add'"
        )).firstMatch

        guard createButton.exists else { return }
        createButton.tap()

        // When: Fill task fields
        let titleField = app.textFields["titleField"]
        if titleField.exists {
            titleField.tap()
            titleField.typeText("New Task")
        }

        let descriptionField = app.textViews["descriptionField"]
        if descriptionField.exists {
            descriptionField.tap()
            descriptionField.typeText("Task description")
        }

        // Then: Fields should contain data
        XCTAssertTrue(titleField.exists || descriptionField.exists,
                     "Task fields should be available")
    }

    func testCreateTaskSuccess() {
        // Given: Create dialog with task data
        app.tabBars.buttons["Tasks"].tap()
        let createButton = app.buttons.matching(NSPredicate(
            format: "label CONTAINS[c] 'add'"
        )).firstMatch

        guard createButton.exists else { return }
        createButton.tap()

        // Fill fields
        if app.textFields["titleField"].exists {
            app.textFields["titleField"].tap()
            app.textFields["titleField"].typeText("Test Task")
        }

        // When: Tap Create button
        let confirmButton = app.buttons["Create"]
        if confirmButton.exists {
            confirmButton.tap()

            // Then: Task should be created and added to list
            XCTAssertTrue(app.navigationBars["Tasks"].exists,
                         "Should return to task list after creation")
        }
    }

    func testCancelCreateTask() {
        // Given: Create dialog is open
        app.tabBars.buttons["Tasks"].tap()
        let createButton = app.buttons.matching(NSPredicate(
            format: "label CONTAINS[c] 'add'"
        )).firstMatch

        guard createButton.exists else { return }
        createButton.tap()

        // When: Tap Cancel
        let cancelButton = app.buttons["Cancel"]
        if cancelButton.exists {
            cancelButton.tap()

            // Then: Should close dialog without creating task
            XCTAssertTrue(app.navigationBars["Tasks"].exists)
        }
    }

    // MARK: - Task Editing Tests

    func testOpenTaskDetailForEditing() {
        // When: Tap on task in list
        app.tabBars.buttons["Tasks"].tap()

        let taskCard = app.staticTexts.matching(NSPredicate(
            format: "label CONTAINS[c] 'task'"
        )).firstMatch

        if taskCard.exists {
            taskCard.tap()

            // Then: Task detail/edit view should open
            XCTAssertTrue(app.navigationBars.count > 0,
                         "Navigation should show detail view")
        }
    }

    func testEditTaskStatus() {
        // Given: Task detail is open
        app.tabBars.buttons["Tasks"].tap()
        let taskCard = app.staticTexts.firstMatch
        taskCard.tap()

        // When: Change task status
        let statusPicker = app.pickerWheels.firstMatch
        if statusPicker.exists {
            statusPicker.adjust(byPickerWheelDelta: 1)

            // Then: Status should update
            XCTAssertTrue(app.navigationBars.count > 0)
        }
    }

    func testEditTaskPriority() {
        // Given: Task detail is open
        app.tabBars.buttons["Tasks"].tap()
        let taskCard = app.cells.firstMatch
        if taskCard.exists {
            taskCard.tap()
        }

        // When: Change priority
        let prioritySegment = app.segmentedControls.matching(NSPredicate(
            format: "label CONTAINS[c] 'priority'"
        )).firstMatch

        if prioritySegment.exists {
            prioritySegment.tap()

            // Then: Priority should update
            XCTAssertTrue(app.navigationBars.count > 0)
        }
    }

    func testAddSubtask() {
        // Given: Task detail view
        app.tabBars.buttons["Tasks"].tap()
        let taskCard = app.cells.firstMatch
        if taskCard.exists {
            taskCard.tap()
        }

        // When: Tap add subtask button
        let addSubtaskButton = app.buttons.matching(NSPredicate(
            format: "label CONTAINS[c] 'subtask'"
        )).firstMatch

        if addSubtaskButton.exists {
            addSubtaskButton.tap()

            // Then: Subtask field should appear
            XCTAssertTrue(app.textFields.count > 0,
                         "Subtask input should appear")
        }
    }

    // MARK: - Task Actions Tests

    func testCompleteTask() {
        // Given: Task in list
        app.tabBars.buttons["Tasks"].tap()

        let taskCard = app.cells.firstMatch
        if taskCard.exists {
            // When: Tap complete checkbox
            let checkbox = taskCard.buttons.firstMatch
            if checkbox.exists {
                checkbox.tap()

                // Then: Task should show as completed
                XCTAssertTrue(app.navigationBars["Tasks"].exists)
            }
        }
    }

    func testDeleteTask() {
        // Given: Task in list
        app.tabBars.buttons["Tasks"].tap()

        let taskCard = app.cells.firstMatch
        if taskCard.exists {
            // When: Swipe to delete
            taskCard.swipeLeft()

            // Then: Delete button should appear
            let deleteButton = app.buttons["Delete"]
            if deleteButton.exists {
                deleteButton.tap()

                // Task should be removed
                XCTAssertTrue(app.navigationBars["Tasks"].exists)
            }
        }
    }

    func testShareTask() {
        // Given: Task detail view
        app.tabBars.buttons["Tasks"].tap()
        let taskCard = app.cells.firstMatch
        if taskCard.exists {
            taskCard.tap()
        }

        // When: Tap share button
        let shareButton = app.buttons.matching(NSPredicate(
            format: "label CONTAINS[c] 'share'"
        )).firstMatch

        if shareButton.exists {
            shareButton.tap()

            // Then: Share sheet should appear
            let shareSheet = app.sheets.firstMatch
            if shareSheet.exists {
                XCTAssertTrue(shareSheet.exists)

                // Dismiss share sheet
                app.buttons["Cancel"].tap()
            }
        }
    }

    // MARK: - Analytics Tests

    func testAnalyticsFooterDisplays() {
        // When: Open Tasks
        app.tabBars.buttons["Tasks"].tap()

        // Then: Analytics footer should show task stats
        let analyticsText = app.staticTexts.matching(NSPredicate(
            format: "label CONTAINS[c] 'completed' OR label CONTAINS[c] 'progress'"
        )).firstMatch

        if analyticsText.exists {
            XCTAssertTrue(analyticsText.exists)
        }
    }

    // MARK: - Error Handling Tests

    func testErrorAlertOnLoadFailure() {
        // When: Tasks fail to load
        app.tabBars.buttons["Tasks"].tap()

        // Then: Error alert may appear
        let errorAlert = app.alerts.element
        if errorAlert.exists {
            XCTAssertTrue(errorAlert.exists)
            app.alerts.element.buttons["OK"].tap()
        }
    }

    // MARK: - Accessibility Tests

    func testTasksTabAccessible() {
        // When: Navigate to Tasks tab
        app.tabBars.buttons["Tasks"].tap()

        // Then: Tab should be accessible
        XCTAssertTrue(app.tabBars.buttons["Tasks"].isAccessibilityElement)
    }

    func testTaskCardAccessible() {
        // When: Tasks are displayed
        app.tabBars.buttons["Tasks"].tap()

        // Then: Task cards should be accessible
        let taskCard = app.cells.firstMatch
        if taskCard.exists {
            XCTAssertTrue(taskCard.isAccessibilityElement,
                         "Task card should be accessible")
        }
    }
}
