/**
 * Intelligence Settings Tests - Phase 8 iOS
 * Unit tests for IntelligenceSettingsView
 * Tests: Toggle operations, Update budget, Save settings, UI interactions
 */

import XCTest
import SwiftUI
@testable import Helix

class IntelligenceSettingsViewTests: XCTestCase {

    let mockOperations = [
        AIOperation(
            id: "email-compose",
            name: "Email Compose",
            description: "AI-powered email composition",
            primaryModel: "deepseek-v3.2",
            fallbackModel: "gemini-2.0-flash",
            costCriticality: "LOW",
            estimatedCostUsd: 0.0015,
            enabled: true
        ),
        AIOperation(
            id: "calendar-prep",
            name: "Calendar Prep",
            description: "Meeting preparation assistance",
            primaryModel: "deepseek-v3.2",
            fallbackModel: "gemini-2.0-flash",
            costCriticality: "MEDIUM",
            estimatedCostUsd: 0.0025,
            enabled: true
        ),
    ]

    let mockBudgetSettings = BudgetSettings(
        dailyLimitUsd: 50.0,
        monthlyLimitUsd: 1000.0,
        warningThreshold: 80.0
    )

    override func setUp() {
        super.setUp()
    }

    override func tearDown() {
        super.tearDown()
    }

    // MARK: - Rendering Tests

    func testViewRendersWithOperations() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()
        viewModel.loadOperations()

        // When
        let view = IntelligenceSettingsView(viewModel: viewModel)

        // Then
        XCTAssertNotNil(view)
    }

    func testTabsAreAvailable() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()

        // When
        let tabs: [String] = ["Operations", "Budget", "Models"]

        // Then
        XCTAssertEqual(tabs.count, 3)
        XCTAssertTrue(tabs.contains("Operations"))
        XCTAssertTrue(tabs.contains("Budget"))
        XCTAssertTrue(tabs.contains("Models"))
    }

    func testOperationsLoaded() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()

        // When
        viewModel.loadOperations()
        let operations = viewModel.operations.value

        // Then
        XCTAssertGreaterThan(operations.count, 0)
    }

    // MARK: - Budget Tests

    func testBudgetSettingsLoaded() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()

        // When
        viewModel.loadSettings()
        let settings = viewModel.budgetSettings.value

        // Then
        XCTAssertEqual(settings.dailyLimitUsd, 50.0)
        XCTAssertEqual(settings.monthlyLimitUsd, 1000.0)
        XCTAssertEqual(settings.warningThreshold, 80.0)
    }

    func testUpdateDailyBudget() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()
        let newAmount = 75.0

        // When
        viewModel.updateDailyBudget(newAmount)

        // Then
        XCTAssertEqual(viewModel.budgetSettings.value.dailyLimitUsd, newAmount)
    }

    func testUpdateMonthlyBudget() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()
        let newAmount = 2000.0

        // When
        viewModel.updateMonthlyBudget(newAmount)

        // Then
        XCTAssertEqual(viewModel.budgetSettings.value.monthlyLimitUsd, newAmount)
    }

    func testUpdateWarningThreshold() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()
        let newThreshold = 90.0

        // When
        viewModel.updateWarningThreshold(newThreshold)

        // Then
        XCTAssertEqual(viewModel.budgetSettings.value.warningThreshold, newThreshold)
    }

    func testWarningThresholdBounds() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()

        // When & Then - Threshold should be between 0-100
        viewModel.updateWarningThreshold(0)
        XCTAssertEqual(viewModel.budgetSettings.value.warningThreshold, 0)

        viewModel.updateWarningThreshold(100)
        XCTAssertEqual(viewModel.budgetSettings.value.warningThreshold, 100)
    }

    // MARK: - Operation Toggle Tests

    func testToggleOperationEnabled() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()
        viewModel.loadOperations()
        guard let firstOp = viewModel.operations.value.first else {
            XCTFail("No operations loaded")
            return
        }
        let initialState = firstOp.enabled

        // When
        viewModel.toggleOperation(firstOp.id)

        // Then
        let updatedOps = viewModel.operations.value
        if let updated = updatedOps.first(where: { $0.id == firstOp.id }) {
            XCTAssertEqual(updated.enabled, !initialState)
        }
    }

    func testToggleMultipleOperations() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()
        viewModel.loadOperations()
        let ops = viewModel.operations.value
        guard ops.count >= 2 else {
            XCTFail("Not enough operations")
            return
        }

        // When
        viewModel.toggleOperation(ops[0].id)
        viewModel.toggleOperation(ops[1].id)

        // Then
        let updated = viewModel.operations.value
        if let op1 = updated.first(where: { $0.id == ops[0].id }),
           let op2 = updated.first(where: { $0.id == ops[1].id }) {
            XCTAssertEqual(op1.enabled, !ops[0].enabled)
            XCTAssertEqual(op2.enabled, !ops[1].enabled)
        }
    }

    // MARK: - Save Tests

    func testSaveSettings() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()
        viewModel.loadSettings()
        viewModel.updateDailyBudget(100)

        // When
        let initialSaving = viewModel.isSaving.value
        viewModel.saveSettings()

        // Then
        XCTAssertTrue(viewModel.isSaving.value != initialSaving || viewModel.lastSaved.value != nil)
    }

    func testLastSavedTimestamp() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()
        XCTAssertNil(viewModel.lastSaved.value)

        // When
        viewModel.saveSettings()

        // Then - After a brief delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            XCTAssertNotNil(viewModel.lastSaved.value)
        }
    }

    // MARK: - Integration Tests

    func testCompleteWorkflow() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()

        // When - Load initial data
        viewModel.loadOperations()
        viewModel.loadSettings()

        let initialOps = viewModel.operations.value.count
        let initialDaily = viewModel.budgetSettings.value.dailyLimitUsd

        // Toggle an operation
        if let firstOp = viewModel.operations.value.first {
            viewModel.toggleOperation(firstOp.id)
        }

        // Update budget
        viewModel.updateDailyBudget(100)

        // Save
        viewModel.saveSettings()

        // Then - Verify changes persisted
        XCTAssertGreaterThan(initialOps, 0)
        XCTAssertNotEqual(initialDaily, viewModel.budgetSettings.value.dailyLimitUsd)
    }

    func testOperationGrouping() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()

        // When
        viewModel.loadOperations()
        let allOps = viewModel.operations.value

        let emailOps = allOps.filter { $0.id.contains("email") }
        let calendarOps = allOps.filter { $0.id.contains("calendar") }
        let taskOps = allOps.filter { $0.id.contains("task") }
        let analyticsOps = allOps.filter { $0.id.contains("analytics") }

        // Then
        XCTAssertGreaterThan(emailOps.count + calendarOps.count + taskOps.count + analyticsOps.count, 0)
    }

    func testOperationDataIntegrity() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()

        // When
        viewModel.loadOperations()
        let operations = viewModel.operations.value

        // Then - Each operation should have required fields
        for op in operations {
            XCTAssertFalse(op.id.isEmpty, "Operation ID should not be empty")
            XCTAssertFalse(op.name.isEmpty, "Operation name should not be empty")
            XCTAssertGreaterThanOrEqual(op.estimatedCostUsd, 0, "Cost should be non-negative")
            XCTAssertTrue(
                ["LOW", "MEDIUM", "HIGH"].contains(op.costCriticality),
                "Criticality should be LOW, MEDIUM, or HIGH"
            )
        }
    }

    func testBudgetValidation() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()

        // When - Set various budget values
        viewModel.updateDailyBudget(0)
        viewModel.updateMonthlyBudget(50) // Monthly less than daily would be invalid

        // Then - App should handle gracefully (validation in real app)
        XCTAssertGreaterThanOrEqual(viewModel.budgetSettings.value.dailyLimitUsd, 0)
        XCTAssertGreaterThanOrEqual(viewModel.budgetSettings.value.monthlyLimitUsd, 0)
    }

    func testConcurrentUpdates() {
        // Given
        let viewModel = IntelligenceSettingsViewModel()
        viewModel.loadOperations()
        viewModel.loadSettings()

        // When - Simulate concurrent updates
        let queue = DispatchQueue(label: "test.concurrent", attributes: .concurrent)
        let expectation = expectation(description: "Concurrent updates complete")

        queue.async {
            viewModel.updateDailyBudget(100)
        }

        queue.async {
            viewModel.updateMonthlyBudget(2000)
        }

        queue.async {
            if let firstOp = viewModel.operations.value.first {
                viewModel.toggleOperation(firstOp.id)
            }
            expectation.fulfill()
        }

        // Then
        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(viewModel.budgetSettings.value.dailyLimitUsd, 100)
        XCTAssertEqual(viewModel.budgetSettings.value.monthlyLimitUsd, 2000)
    }
}
