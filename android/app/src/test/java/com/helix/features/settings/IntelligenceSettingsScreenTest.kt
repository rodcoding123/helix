/**
 * Intelligence Settings Tests - Phase 8 Android
 * Unit tests for IntelligenceSettingsScreen and IntelligenceSettingsViewModel
 * Tests: Toggle operations, Update budget, Save settings, UI interactions
 */

package com.helix.features.settings

import androidx.lifecycle.viewModelScope
import com.helix.features.settings.IntelligenceSettingsViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*

@OptIn(ExperimentalCoroutinesApi::class)
class IntelligenceSettingsViewModelTest {

    private lateinit var viewModel: IntelligenceSettingsViewModel
    private val testDispatcher = StandardTestDispatcher()

    private val mockOperations = listOf(
        AIOperation(
            id = "email-compose",
            name = "Email Compose",
            description = "AI-powered email composition",
            primaryModel = "deepseek-v3.2",
            fallbackModel = "gemini-2.0-flash",
            costCriticality = "LOW",
            estimatedCostUsd = 0.0015,
            enabled = true
        ),
        AIOperation(
            id = "calendar-prep",
            name = "Calendar Prep",
            description = "Meeting preparation assistance",
            primaryModel = "deepseek-v3.2",
            fallbackModel = "gemini-2.0-flash",
            costCriticality = "MEDIUM",
            estimatedCostUsd = 0.0025,
            enabled = true
        ),
        AIOperation(
            id = "task-prioritize",
            name = "Task Prioritization",
            description = "AI-powered task prioritization",
            primaryModel = "deepseek-v3.2",
            fallbackModel = "gemini-2.0-flash",
            costCriticality = "LOW",
            estimatedCostUsd = 0.0018,
            enabled = true
        ),
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        viewModel = IntelligenceSettingsViewModel()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // MARK: - Operation Loading Tests

    @Test
    fun testLoadOperationsPopulatesState() = runTest {
        // Given
        viewModel.loadOperations()
        advanceUntilIdle()

        // When
        val operations = viewModel.operations.value

        // Then
        assertTrue(operations.isNotEmpty())
        assertEquals(3, operations.size)
        assertEquals("email-compose", operations[0].id)
    }

    @Test
    fun testOperationsHaveCorrectData() = runTest {
        // Given
        viewModel.loadOperations()
        advanceUntilIdle()

        // When
        val operations = viewModel.operations.value
        val firstOp = operations[0]

        // Then
        assertEquals("Email Compose", firstOp.name)
        assertEquals("AI-powered email composition", firstOp.description)
        assertTrue(firstOp.enabled)
        assertEquals(0.0015, firstOp.estimatedCostUsd, 0.0001)
    }

    // MARK: - Budget Tests

    @Test
    fun testLoadSettingsPopulatesState() = runTest {
        // Given
        viewModel.loadSettings()
        advanceUntilIdle()

        // When
        val settings = viewModel.budgetSettings.value

        // Then
        assertEquals(50.0, settings.dailyLimitUsd, 0.0)
        assertEquals(1000.0, settings.monthlyLimitUsd, 0.0)
        assertEquals(80.0, settings.warningThreshold, 0.0)
    }

    @Test
    fun testUpdateDailyBudget() {
        // Given
        val newAmount = 75.0

        // When
        viewModel.updateDailyBudget(newAmount)

        // Then
        assertEquals(newAmount, viewModel.budgetSettings.value.dailyLimitUsd, 0.0)
    }

    @Test
    fun testUpdateMonthlyBudget() {
        // Given
        val newAmount = 2000.0

        // When
        viewModel.updateMonthlyBudget(newAmount)

        // Then
        assertEquals(newAmount, viewModel.budgetSettings.value.monthlyLimitUsd, 0.0)
    }

    @Test
    fun testUpdateWarningThreshold() {
        // Given
        val newThreshold = 90.0

        // When
        viewModel.updateWarningThreshold(newThreshold)

        // Then
        assertEquals(newThreshold, viewModel.budgetSettings.value.warningThreshold, 0.0)
    }

    @Test
    fun testWarningThresholdMinBound() {
        // Given
        // When
        viewModel.updateWarningThreshold(0.0)

        // Then
        assertEquals(0.0, viewModel.budgetSettings.value.warningThreshold, 0.0)
    }

    @Test
    fun testWarningThresholdMaxBound() {
        // Given
        // When
        viewModel.updateWarningThreshold(100.0)

        // Then
        assertEquals(100.0, viewModel.budgetSettings.value.warningThreshold, 0.0)
    }

    // MARK: - Operation Toggle Tests

    @Test
    fun testToggleOperationEnabled() = runTest {
        // Given
        viewModel.loadOperations()
        advanceUntilIdle()
        val firstOp = viewModel.operations.value[0]
        val initialState = firstOp.enabled

        // When
        viewModel.toggleOperation(firstOp.id)

        // Then
        val updatedOps = viewModel.operations.value
        val updated = updatedOps.find { it.id == firstOp.id }
        assertNotNull(updated)
        assertEquals(!initialState, updated?.enabled)
    }

    @Test
    fun testToggleOperationMultipleTimes() = runTest {
        // Given
        viewModel.loadOperations()
        advanceUntilIdle()
        val firstOp = viewModel.operations.value[0]

        // When
        viewModel.toggleOperation(firstOp.id)
        viewModel.toggleOperation(firstOp.id)

        // Then - Should be back to original state
        val updated = viewModel.operations.value.find { it.id == firstOp.id }
        assertEquals(firstOp.enabled, updated?.enabled)
    }

    @Test
    fun testToggleMultipleDifferentOperations() = runTest {
        // Given
        viewModel.loadOperations()
        advanceUntilIdle()
        val ops = viewModel.operations.value
        val firstOp = ops[0]
        val secondOp = ops[1]

        // When
        viewModel.toggleOperation(firstOp.id)
        viewModel.toggleOperation(secondOp.id)

        // Then
        val updated = viewModel.operations.value
        val updatedFirst = updated.find { it.id == firstOp.id }
        val updatedSecond = updated.find { it.id == secondOp.id }

        assertEquals(!firstOp.enabled, updatedFirst?.enabled)
        assertEquals(!secondOp.enabled, updatedSecond?.enabled)
    }

    // MARK: - Save Tests

    @Test
    fun testSaveSettingsSetsIsSaving() = runTest {
        // Given
        val initialValue = viewModel.isSaving.value

        // When
        viewModel.saveSettings()
        advanceUntilIdle()

        // Then
        assertFalse(viewModel.isSaving.value)
    }

    @Test
    fun testSaveSettingsSetsLastSaved() = runTest {
        // Given
        val beforeSave = viewModel.lastSaved.value

        // When
        viewModel.saveSettings()
        advanceUntilIdle()

        // Then
        val afterSave = viewModel.lastSaved.value
        assertNotNull(afterSave)
        assertTrue(afterSave ?: 0L > beforeSave ?: 0L)
    }

    // MARK: - Integration Tests

    @Test
    fun testCompleteWorkflow() = runTest {
        // Given
        viewModel.loadOperations()
        viewModel.loadSettings()
        advanceUntilIdle()

        val initialOpsCount = viewModel.operations.value.size
        val initialDaily = viewModel.budgetSettings.value.dailyLimitUsd

        // When - Perform multiple operations
        viewModel.toggleOperation(viewModel.operations.value[0].id)
        viewModel.updateDailyBudget(100.0)
        viewModel.updateMonthlyBudget(2000.0)
        viewModel.updateWarningThreshold(90.0)
        viewModel.saveSettings()
        advanceUntilIdle()

        // Then - Verify all changes were applied
        assertEquals(initialOpsCount, viewModel.operations.value.size)
        assertNotEquals(initialDaily, viewModel.budgetSettings.value.dailyLimitUsd)
        assertEquals(100.0, viewModel.budgetSettings.value.dailyLimitUsd, 0.0)
        assertEquals(2000.0, viewModel.budgetSettings.value.monthlyLimitUsd, 0.0)
        assertEquals(90.0, viewModel.budgetSettings.value.warningThreshold, 0.0)
        assertNotNull(viewModel.lastSaved.value)
    }

    @Test
    fun testOperationGrouping() = runTest {
        // Given
        viewModel.loadOperations()
        advanceUntilIdle()

        // When
        val allOps = viewModel.operations.value
        val emailOps = allOps.filter { it.id.contains("email") }
        val calendarOps = allOps.filter { it.id.contains("calendar") }
        val taskOps = allOps.filter { it.id.contains("task") }
        val analyticsOps = allOps.filter { it.id.contains("analytics") }

        // Then
        assertTrue(emailOps.size + calendarOps.size + taskOps.size + analyticsOps.size > 0)
    }

    @Test
    fun testOperationDataIntegrity() = runTest {
        // Given
        viewModel.loadOperations()
        advanceUntilIdle()

        // When
        val operations = viewModel.operations.value

        // Then - Verify each operation has required fields
        for (op in operations) {
            assertFalse("Operation ID should not be empty", op.id.isEmpty())
            assertFalse("Operation name should not be empty", op.name.isEmpty())
            assertTrue("Cost should be non-negative", op.estimatedCostUsd >= 0)
            assertTrue(
                "Criticality should be valid",
                listOf("LOW", "MEDIUM", "HIGH").contains(op.costCriticality)
            )
            assertFalse("Primary model should not be empty", op.primaryModel.isEmpty())
            assertFalse("Fallback model should not be empty", op.fallbackModel.isEmpty())
        }
    }

    @Test
    fun testBudgetConsistency() = runTest {
        // Given
        viewModel.loadSettings()
        advanceUntilIdle()

        // When - Update budgets in sequence
        viewModel.updateDailyBudget(25.0)
        viewModel.updateMonthlyBudget(500.0)

        val daily = viewModel.budgetSettings.value.dailyLimitUsd
        val monthly = viewModel.budgetSettings.value.monthlyLimitUsd

        // Then - Values should be set correctly
        assertEquals(25.0, daily, 0.0)
        assertEquals(500.0, monthly, 0.0)
        // Monthly should reasonably be >= daily
        assertTrue(monthly >= daily)
    }

    @Test
    fun testResetSettingsAfterModification() = runTest {
        // Given
        viewModel.loadSettings()
        advanceUntilIdle()
        viewModel.updateDailyBudget(200.0)

        // When
        viewModel.loadSettings()
        advanceUntilIdle()

        // Then - Should reload default values
        assertEquals(50.0, viewModel.budgetSettings.value.dailyLimitUsd, 0.0)
    }

    @Test
    fun testMultipleConsecutiveSaves() = runTest {
        // Given
        viewModel.loadSettings()
        advanceUntilIdle()

        // When - Save multiple times
        viewModel.updateDailyBudget(100.0)
        viewModel.saveSettings()
        advanceUntilIdle()

        val firstSaveTime = viewModel.lastSaved.value

        viewModel.updateDailyBudget(150.0)
        viewModel.saveSettings()
        advanceUntilIdle()

        val secondSaveTime = viewModel.lastSaved.value

        // Then - Second save time should be later
        assertNotNull(firstSaveTime)
        assertNotNull(secondSaveTime)
        assertTrue(secondSaveTime ?: 0L > firstSaveTime ?: 0L)
    }
}
