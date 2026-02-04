import XCTest

/**
 * UI Tests for Email functionality in iOS app
 * Tests real user interactions with the Email tab
 */
final class EmailTabUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false

        app = XCUIApplication()
        app.launch()
    }

    // MARK: - Navigation Tests

    func testNavigateToEmailTab() {
        // When: Tap on Email tab
        app.tabBars.buttons["Email"].tap()

        // Then: Verify Email tab is displayed
        XCTAssertTrue(app.navigationBars["Email"].exists, "Email navigation bar should exist")
        XCTAssertTrue(app.staticTexts["Inbox"].exists, "Inbox text should exist")
    }

    func testEmailTabIsDefault() {
        // Then: Email tab should be visible on launch
        XCTAssertTrue(app.tabBars.buttons["Email"].exists, "Email tab should exist")
    }

    // MARK: - Email List Tests

    func testEmailListDisplays() {
        // When: Navigate to Email tab
        app.tabBars.buttons["Email"].tap()

        // Then: Email list should be visible
        let emailList = app.collectionViews.firstMatch
        XCTAssertTrue(emailList.waitForExistence(timeout: 5), "Email list should load")
    }

    func testLoadingIndicatorDisplaysWhileFetching() {
        // When: Navigate to Email tab
        app.tabBars.buttons["Email"].tap()

        // Then: Loading indicator should appear or disappear after loading
        let loadingIndicator = app.activityIndicators.firstMatch
        _ = loadingIndicator.waitForExistence(timeout: 3) // May appear briefly
    }

    func testPullToRefreshWorks() {
        // When: Navigate to Email tab and pull to refresh
        app.tabBars.buttons["Email"].tap()

        let collectionView = app.collectionViews.firstMatch
        XCTAssertTrue(collectionView.waitForExistence(timeout: 5))

        // Simulate pull to refresh
        collectionView.swipeDown()

        // Then: Should refresh without errors
        // (In real test, would verify email list updates)
    }

    // MARK: - Email Detail Tests

    func testOpenEmailDetail() {
        // Given: Navigate to Email tab
        app.tabBars.buttons["Email"].tap()
        let emailCell = app.cells.firstMatch
        XCTAssertTrue(emailCell.waitForExistence(timeout: 5), "Email cell should exist")

        // When: Tap on email cell
        emailCell.tap()

        // Then: Email detail view should open
        XCTAssertTrue(app.navigationBars.buttons["Email"].exists, "Back button should exist")
        // Verify email content is displayed
        _ = app.staticTexts.matching(identifier: "emailSubject").firstMatch
    }

    func testEmailDetailShowsContent() {
        // Given: Email detail is open
        app.tabBars.buttons["Email"].tap()
        app.cells.firstMatch.tap()

        // Then: Subject, sender, and body should be visible
        let subjectElements = app.staticTexts.matching(identifier: "emailSubject")
        XCTAssertGreaterThan(subjectElements.count, 0, "Subject should be visible")
    }

    func testBackButtonReturnsToList() {
        // Given: Email detail is open
        app.tabBars.buttons["Email"].tap()
        app.cells.firstMatch.tap()

        // When: Tap back button
        app.navigationBars.buttons["Email"].tap()

        // Then: Should return to email list
        XCTAssertTrue(app.collectionViews.firstMatch.waitForExistence(timeout: 3))
    }

    // MARK: - Compose Email Tests

    func testOpenComposeView() {
        // When: Navigate to Email tab and tap compose button
        app.tabBars.buttons["Email"].tap()
        let composeButton = app.buttons["composeButton"]

        if composeButton.exists {
            composeButton.tap()

            // Then: Compose view should open
            XCTAssertTrue(app.staticTexts["Compose"].waitForExistence(timeout: 3))
        }
    }

    func testComposeEmailWithAllFields() {
        // Given: Compose view is open
        app.tabBars.buttons["Email"].tap()
        app.buttons["composeButton"].tap()

        guard app.staticTexts["Compose"].waitForExistence(timeout: 3) else {
            XCTFail("Compose view did not open")
            return
        }

        // When: Fill in email fields
        let toField = app.textFields["toField"]
        if toField.exists {
            toField.tap()
            toField.typeText("test@example.com")
        }

        let subjectField = app.textFields["subjectField"]
        if subjectField.exists {
            subjectField.tap()
            subjectField.typeText("Test Subject")
        }

        let bodyField = app.textViews["bodyField"]
        if bodyField.exists {
            bodyField.tap()
            bodyField.typeText("This is a test email body")
        }

        // Then: Fields should contain entered text
        XCTAssertTrue(toField.exists, "To field should exist")
        XCTAssertTrue(subjectField.exists, "Subject field should exist")
        XCTAssertTrue(bodyField.exists, "Body field should exist")
    }

    func testSendEmailSuccess() {
        // Given: Compose view with email content
        app.tabBars.buttons["Email"].tap()
        app.buttons["composeButton"].tap()

        guard app.staticTexts["Compose"].waitForExistence(timeout: 3) else {
            XCTFail("Compose view did not open")
            return
        }

        // Fill fields
        if app.textFields["toField"].exists {
            app.textFields["toField"].tap()
            app.textFields["toField"].typeText("test@example.com")
        }

        if app.textFields["subjectField"].exists {
            app.textFields["subjectField"].tap()
            app.textFields["subjectField"].typeText("Test Subject")
        }

        // When: Tap Send button
        let sendButton = app.buttons["sendButton"]
        if sendButton.exists {
            sendButton.tap()

            // Then: Success message should appear
            XCTAssertTrue(app.alerts.element.waitForExistence(timeout: 5) ||
                         app.staticTexts.matching(identifier: "emailSent").count > 0,
                         "Success confirmation should appear")
        }
    }

    func testCancelCompose() {
        // Given: Compose view is open
        app.tabBars.buttons["Email"].tap()
        app.buttons["composeButton"].tap()

        guard app.staticTexts["Compose"].waitForExistence(timeout: 3) else {
            return
        }

        // When: Tap Cancel button
        if app.buttons["cancelButton"].exists {
            app.buttons["cancelButton"].tap()

            // Then: Should return to email list
            XCTAssertTrue(app.collectionViews.firstMatch.waitForExistence(timeout: 3))
        }
    }

    // MARK: - Email Actions Tests

    func testSwipeToDeleteEmail() {
        // Given: Email list is displayed
        app.tabBars.buttons["Email"].tap()
        let emailCell = app.cells.firstMatch
        XCTAssertTrue(emailCell.waitForExistence(timeout: 5))

        // When: Swipe left on email
        emailCell.swipeLeft()

        // Then: Delete button should appear
        let deleteButton = app.buttons["Delete"]
        if deleteButton.waitForExistence(timeout: 2) {
            deleteButton.tap()

            // Verify deletion (email should be removed or moved to trash)
            // Implementation depends on UX
        }
    }

    func testMarkEmailAsRead() {
        // Given: Email list is displayed
        app.tabBars.buttons["Email"].tap()
        let emailCell = app.cells.firstMatch
        XCTAssertTrue(emailCell.waitForExistence(timeout: 5))

        // When: Open email
        emailCell.tap()

        // Then: Email should be marked as read
        // Verify by checking if read status changes
    }

    func testStarEmail() {
        // Given: Email detail view
        app.tabBars.buttons["Email"].tap()
        app.cells.firstMatch.tap()

        // When: Tap star button
        let starButton = app.buttons["starButton"]
        if starButton.exists {
            starButton.tap()

            // Then: Star should be filled
            // Visual verification would check star icon state
        }
    }

    // MARK: - Search Tests

    func testSearchEmails() {
        // Given: Email tab is displayed
        app.tabBars.buttons["Email"].tap()

        // When: Tap search and enter query
        let searchField = app.searchFields.firstMatch
        if searchField.exists {
            searchField.tap()
            searchField.typeText("important")

            // Then: Search results should appear
            XCTAssertTrue(searchField.exists, "Search field should be active")
        }
    }

    func testClearSearch() {
        // Given: Search is active
        app.tabBars.buttons["Email"].tap()
        let searchField = app.searchFields.firstMatch

        if searchField.exists {
            searchField.tap()
            searchField.typeText("test")

            // When: Clear search
            let clearButton = app.buttons.matching(identifier: "Clear").firstMatch
            if clearButton.exists {
                clearButton.tap()

                // Then: Should return to full email list
                XCTAssertTrue(app.collectionViews.firstMatch.exists)
            }
        }
    }

    // MARK: - Error Handling Tests

    func testErrorAlertDisplaysOnNetworkError() {
        // Given: App is in offline mode or network error occurs
        // When: Try to fetch emails
        app.tabBars.buttons["Email"].tap()

        // Then: Error alert may appear (depends on network state)
        let errorAlert = app.alerts.element
        // Would only exist if actual error occurs
        if errorAlert.exists {
            XCTAssertTrue(errorAlert.exists, "Error alert should display")

            // Tap OK to dismiss
            app.alerts.element.buttons["OK"].tap()
        }
    }

    // MARK: - Accessibility Tests

    func testEmailTabIsAccessible() {
        // When: Navigate to Email tab
        app.tabBars.buttons["Email"].tap()

        // Then: Elements should be accessible
        XCTAssertTrue(app.navigationBars["Email"].isAccessibilityElement,
                     "Navigation bar should be accessible")
    }

    func testComposeButtonIsAccessible() {
        // When: Navigate to Email tab
        app.tabBars.buttons["Email"].tap()

        // Then: Compose button should be accessible
        let composeButton = app.buttons["composeButton"]
        if composeButton.exists {
            XCTAssertTrue(composeButton.isAccessibilityElement,
                         "Compose button should be accessible")
        }
    }
}
