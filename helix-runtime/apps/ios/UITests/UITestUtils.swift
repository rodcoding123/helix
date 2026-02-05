import XCTest

/**
 * Utility class providing common UI testing helper functions
 * Reduces code duplication and improves test readability
 */
class UITestUtils {
    // MARK: - Constants

    static let defaultTimeout: TimeInterval = 5
    static let shortTimeout: TimeInterval = 2
    static let longTimeout: TimeInterval = 10

    // MARK: - Element Visibility

    /**
     * Waits for an element to appear with specified timeout
     * - Parameters:
     *   - element: XCUIElement to wait for
     *   - timeout: How long to wait in seconds (default: 5)
     * - Returns: true if element appeared, false if timeout
     */
    static func waitForElementToAppear(
        _ element: XCUIElement,
        timeout: TimeInterval = UITestUtils.defaultTimeout
    ) -> Bool {
        return element.waitForExistence(timeout: timeout)
    }

    /**
     * Waits for an element to disappear with specified timeout
     * - Parameters:
     *   - element: XCUIElement to wait to disappear
     *   - timeout: How long to wait in seconds (default: 5)
     * - Returns: true if element disappeared, false if timeout
     */
    static func waitForElementToDisappear(
        _ element: XCUIElement,
        timeout: TimeInterval = UITestUtils.defaultTimeout
    ) -> Bool {
        let endDate = Date().addingTimeInterval(timeout)
        while Date() < endDate {
            if !element.exists {
                return true
            }
            usleep(100_000) // Sleep for 0.1 seconds
        }
        return false
    }

    // MARK: - Tapping

    /**
     * Safely taps element if it exists and is hittable
     * - Parameters:
     *   - element: XCUIElement to tap
     * - Returns: true if tap was performed, false if element not available
     */
    static func tapIfExists(_ element: XCUIElement) -> Bool {
        if element.exists && element.isHittable {
            element.tap()
            return true
        }
        return false
    }

    /**
     * Taps an element by index in a collection
     * - Parameters:
     *   - elements: XCUIElementQuery to search
     *   - index: Index of element to tap
     * - Returns: true if tap was performed, false if index out of bounds
     */
    static func tapElementByIndex(_ elements: XCUIElementQuery, index: UInt) -> Bool {
        let element = elements.element(boundBy: index)
        if element.exists && element.isHittable {
            element.tap()
            return true
        }
        return false
    }

    /**
     * Double-taps an element
     * - Parameters:
     *   - element: XCUIElement to double-tap
     * - Returns: true if double-tap was performed, false if element not available
     */
    static func doubleTapIfExists(_ element: XCUIElement) -> Bool {
        if element.exists && element.isHittable {
            element.doubleTap()
            return true
        }
        return false
    }

    /**
     * Long-presses an element
     * - Parameters:
     *   - element: XCUIElement to long-press
     *   - duration: How long to press in seconds (default: 1.0)
     * - Returns: true if long-press was performed, false if element not available
     */
    static func longPressIfExists(
        _ element: XCUIElement,
        duration: TimeInterval = 1.0
    ) -> Bool {
        if element.exists && element.isHittable {
            element.press(forDuration: duration)
            return true
        }
        return false
    }

    // MARK: - Text Input

    /**
     * Safely fills a text field with text
     * - Parameters:
     *   - textField: XCUIElement that is a text field
     *   - text: Text to enter
     * - Returns: true if text was entered, false if field not available
     */
    static func fillTextField(_ textField: XCUIElement, withText text: String) -> Bool {
        guard textField.exists && textField.isHittable else { return false }
        textField.tap()
        textField.typeText(text)
        return true
    }

    /**
     * Clears a text field and enters new text
     * - Parameters:
     *   - textField: XCUIElement that is a text field
     *   - text: Text to enter
     * - Returns: true if text was entered, false if field not available
     */
    static func clearAndFillTextField(
        _ textField: XCUIElement,
        withText text: String
    ) -> Bool {
        guard textField.exists && textField.isHittable else { return false }
        textField.tap()

        // Select all text
        let selectAllButton = XCUIApplication().menuItems["Select All"]
        if selectAllButton.exists {
            selectAllButton.tap()
        } else {
            // Fallback: triple-tap to select all
            textField.doubleTap()
        }

        // Type new text
        textField.typeText(text)
        return true
    }

    /**
     * Types text slowly to allow UI to respond
     * - Parameters:
     *   - textField: XCUIElement that is a text field
     *   - text: Text to enter character by character
     * - Returns: true if text was entered, false if field not available
     */
    static func typeTextSlowly(_ textField: XCUIElement, text: String) -> Bool {
        guard textField.exists && textField.isHittable else { return false }
        textField.tap()

        for character in text {
            textField.typeText(String(character))
            usleep(50_000) // Small delay between characters
        }
        return true
    }

    // MARK: - Alerts

    /**
     * Dismisses an alert by tapping OK button
     * - Parameters:
     *   - app: XCUIApplication instance
     * - Returns: true if alert was dismissed, false if no alert present
     */
    static func dismissAlert(_ app: XCUIApplication) -> Bool {
        let alert = app.alerts.element
        if alert.exists {
            let okButton = alert.buttons["OK"]
            if okButton.exists {
                okButton.tap()
                return true
            }
        }
        return false
    }

    /**
     * Taps a specific button on an alert
     * - Parameters:
     *   - app: XCUIApplication instance
     *   - buttonLabel: Label of the button to tap
     * - Returns: true if button was tapped, false if not found
     */
    static func tapAlertButton(_ app: XCUIApplication, buttonLabel: String) -> Bool {
        let alert = app.alerts.element
        if alert.exists {
            let button = alert.buttons[buttonLabel]
            if button.exists {
                button.tap()
                return true
            }
        }
        return false
    }

    // MARK: - Scrolling

    /**
     * Scrolls a collection view to the bottom
     * - Parameters:
     *   - collectionView: XCUIElement that is a collection view
     */
    static func scrollToBottom(_ collectionView: XCUIElement) {
        for _ in 0..<10 {
            collectionView.swipeUp()
            usleep(100_000) // Brief pause between swipes
        }
    }

    /**
     * Scrolls a collection view to the top
     * - Parameters:
     *   - collectionView: XCUIElement that is a collection view
     */
    static func scrollToTop(_ collectionView: XCUIElement) {
        for _ in 0..<10 {
            collectionView.swipeDown()
            usleep(100_000) // Brief pause between swipes
        }
    }

    /**
     * Swipes to delete a cell
     * - Parameters:
     *   - cell: XCUIElement that is a table/collection view cell
     * - Returns: true if delete button appeared, false otherwise
     */
    static func swipeToDelete(_ cell: XCUIElement) -> Bool {
        guard cell.exists && cell.isHittable else { return false }
        cell.swipeLeft()
        usleep(300_000) // Wait for delete button to appear
        let deleteButton = XCUIApplication().buttons["Delete"]
        return deleteButton.exists
    }

    // MARK: - Waiters

    /**
     * Waits for loading indicator to disappear
     * - Parameters:
     *   - app: XCUIApplication instance
     *   - timeout: How long to wait in seconds (default: 10)
     * - Returns: true if loading completed, false if timeout
     */
    static func waitForLoadingToComplete(
        _ app: XCUIApplication,
        timeout: TimeInterval = UITestUtils.longTimeout
    ) -> Bool {
        let loadingIndicator = app.activityIndicators.firstMatch
        if !loadingIndicator.exists {
            return true // Not loading
        }
        return waitForElementToDisappear(loadingIndicator, timeout: timeout)
    }

    /**
     * Waits for specific text to appear
     * - Parameters:
     *   - app: XCUIApplication instance
     *   - text: Text to wait for
     *   - timeout: How long to wait in seconds (default: 5)
     * - Returns: true if text appeared, false if timeout
     */
    static func waitForText(
        _ app: XCUIApplication,
        text: String,
        timeout: TimeInterval = UITestUtils.defaultTimeout
    ) -> Bool {
        let element = app.staticTexts[text]
        return element.waitForExistence(timeout: timeout)
    }

    /**
     * Waits for a navigation bar to appear
     * - Parameters:
     *   - app: XCUIApplication instance
     *   - title: Navigation bar title
     *   - timeout: How long to wait in seconds (default: 5)
     * - Returns: true if navigation bar appeared, false if timeout
     */
    static func waitForNavigationBar(
        _ app: XCUIApplication,
        title: String,
        timeout: TimeInterval = UITestUtils.defaultTimeout
    ) -> Bool {
        let navBar = app.navigationBars[title]
        return navBar.waitForExistence(timeout: timeout)
    }

    // MARK: - Predicates

    /**
     * Creates a predicate for matching text containing substring
     * - Parameters:
     *   - substring: Text to search for
     * - Returns: NSPredicate for use with element queries
     */
    static func predicateForTextContaining(_ substring: String) -> NSPredicate {
        return NSPredicate(format: "label CONTAINS[c] %@", substring)
    }

    /**
     * Creates a predicate for matching exact text
     * - Parameters:
     *   - text: Exact text to match
     * - Returns: NSPredicate for use with element queries
     */
    static func predicateForExactText(_ text: String) -> NSPredicate {
        return NSPredicate(format: "label == %@", text)
    }

    // MARK: - Navigation

    /**
     * Navigates to a specific tab
     * - Parameters:
     *   - app: XCUIApplication instance
     *   - tabName: Name of the tab button
     * - Returns: true if tap was performed, false if tab not found
     */
    static func navigateToTab(_ app: XCUIApplication, tabName: String) -> Bool {
        let tabButton = app.tabBars.buttons[tabName]
        if tabButton.exists && tabButton.isHittable {
            tabButton.tap()
            return true
        }
        return false
    }

    /**
     * Taps back button in navigation
     * - Parameters:
     *   - app: XCUIApplication instance
     * - Returns: true if back button was tapped, false if not found
     */
    static func tapBackButton(_ app: XCUIApplication) -> Bool {
        let backButton = app.navigationBars.element.buttons.element(boundBy: 0)
        if backButton.exists && backButton.isHittable {
            backButton.tap()
            return true
        }
        return false
    }

    // MARK: - Utilities

    /**
     * Gets the count of elements matching a query
     * - Parameters:
     *   - query: XCUIElementQuery to count
     * - Returns: Number of elements matching the query
     */
    static func elementCount(_ query: XCUIElementQuery) -> UInt {
        return query.count
    }

    /**
     * Checks if any elements match a query
     * - Parameters:
     *   - query: XCUIElementQuery to check
     * - Returns: true if at least one element matches, false otherwise
     */
    static func hasElements(_ query: XCUIElementQuery) -> Bool {
        return query.count > 0
    }

    /**
     * Pauses execution for a specified duration
     * - Parameters:
     *   - seconds: Duration to pause in seconds
     */
    static func pause(seconds: TimeInterval) {
        Thread.sleep(forTimeInterval: seconds)
    }

    /**
     * Gets accessibility identifier from element
     * - Parameters:
     *   - element: XCUIElement to get identifier from
     * - Returns: Accessibility identifier string, or empty string if not set
     */
    static func getAccessibilityIdentifier(_ element: XCUIElement) -> String {
        return element.identifier
    }

    /**
     * Checks if element is accessible
     * - Parameters:
     *   - element: XCUIElement to check
     * - Returns: true if element is accessible, false otherwise
     */
    static func isAccessible(_ element: XCUIElement) -> Bool {
        return element.isAccessibilityElement
    }
}

// MARK: - Extension for convenient chaining

extension XCUIElement {
    /**
     * Convenience method to wait for element existence
     * - Returns: self for method chaining
     */
    @discardableResult
    func waitToAppear(timeout: TimeInterval = 5) -> Self {
        _ = self.waitForExistence(timeout: timeout)
        return self
    }

    /**
     * Convenience method to safely tap if exists
     * - Returns: true if tapped, false otherwise
     */
    func tapIfPossible() -> Bool {
        if self.exists && self.isHittable {
            self.tap()
            return true
        }
        return false
    }
}
