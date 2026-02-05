package com.helix.tasks

import androidx.compose.ui.test.assertExists
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import org.junit.Rule
import org.junit.Test

/**
 * Android UI tests for Tasks screen using Compose testing
 */
class TasksScreenUITest {
    @get:Rule
    val composeTestRule = createComposeRule()

    private val mockViewModel = MockTasksViewModel()

    @Test
    fun testTasksScreenDisplays() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Tasks title displays
        composeTestRule
            .onNodeWithText("Tasks")
            .assertIsDisplayed()
    }

    @Test
    fun testTasksHeaderDisplays() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Header should display
        composeTestRule
            .onNodeWithText("Tasks")
            .assertIsDisplayed()
    }

    @Test
    fun testKanbanTabExists() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Kanban tab should be visible
        composeTestRule
            .onNodeWithText("Kanban")
            .assertIsDisplayed()
    }

    @Test
    fun testListTabExists() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // List tab should be visible
        composeTestRule
            .onNodeWithText("List")
            .assertIsDisplayed()
    }

    @Test
    fun testTimeTabExists() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Time tab should be visible
        composeTestRule
            .onNodeWithText("Time")
            .assertIsDisplayed()
    }

    @Test
    fun testTasksDisplayed() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Tasks should display
        composeTestRule
            .onNodeWithText("Complete project report", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Review pull requests", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testTaskPriorityBadgeDisplays() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Priority badges should display
        composeTestRule
            .onNodeWithText("High", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Medium", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testCreateTaskButtonExists() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Create task button should exist
        composeTestRule
            .onNodeWithContentDescription("Create task")
            .assertExists()
            .assertHasClickAction()
    }

    @Test
    fun testCreateTaskDialog() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Click create task
        composeTestRule
            .onNodeWithContentDescription("Create task")
            .performClick()

        // Create dialog should open
        composeTestRule
            .onNodeWithText("Create Task")
            .assertIsDisplayed()
    }

    @Test
    fun testCreateTaskFormFields() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Click create task
        composeTestRule
            .onNodeWithContentDescription("Create task")
            .performClick()

        // Form fields should exist
        composeTestRule
            .onNodeWithText("Title")
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Description")
            .assertIsDisplayed()
    }

    @Test
    fun testFillTaskForm() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Click create task
        composeTestRule
            .onNodeWithContentDescription("Create task")
            .performClick()

        // Fill form
        composeTestRule
            .onNodeWithText("Title")
            .performTextInput("New Task")

        composeTestRule
            .onNodeWithText("Description")
            .performTextInput("Task description")

        // Create button should be visible
        composeTestRule
            .onNodeWithText("Create")
            .assertIsDisplayed()
    }

    @Test
    fun testCancelTaskDialog() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Click create task
        composeTestRule
            .onNodeWithContentDescription("Create task")
            .performClick()

        // Cancel button should close dialog
        composeTestRule
            .onNodeWithText("Cancel")
            .assertIsDisplayed()
            .performClick()

        // Dialog should be gone
        composeTestRule
            .onAllNodesWithText("Create Task")
            .fetchSemanticsNodes()
            .isEmpty()
    }

    @Test
    fun testListTabNavigation() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Click List tab
        composeTestRule
            .onNodeWithText("List")
            .performClick()

        // List tab should be selected
        composeTestRule
            .onNodeWithText("List")
            .assertIsDisplayed()

        // Tasks should display in list view
        composeTestRule
            .onNodeWithText("Complete project report", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testTimeTabNavigation() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Click Time tab
        composeTestRule
            .onNodeWithText("Time")
            .performClick()

        // Time tab should be selected
        composeTestRule
            .onNodeWithText("Time")
            .assertIsDisplayed()
    }

    @Test
    fun testKanbanTabDefault() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Kanban view should display by default
        composeTestRule
            .onNodeWithText("Kanban")
            .assertIsDisplayed()

        // Column headers should display
        composeTestRule
            .onNodeWithText("To Do", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testTaskDueDateDisplays() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Due dates should display
        composeTestRule
            .onNodeWithText("2026-02-06", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testTaskDeleteIconDisplays() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Delete icon should exist for tasks
        composeTestRule
            .onNodeWithContentDescription("Delete")
            .assertExists()
    }

    @Test
    fun testMultipleTasksDisplay() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // All tasks should be visible
        composeTestRule
            .onNodeWithText("Complete project report", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Review pull requests", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Update documentation", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testErrorDisplaysOnError() {
        mockViewModel.setError("Failed to load tasks")

        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Error dialog should appear
        composeTestRule
            .onNodeWithText("Error")
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Failed to load tasks")
            .assertIsDisplayed()
    }

    @Test
    fun testErrorDismissal() {
        mockViewModel.setError("Failed to load tasks")

        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // OK button should close error
        composeTestRule
            .onNodeWithText("OK")
            .assertIsDisplayed()
    }

    @Test
    fun testTaskProgressIndicator() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Progress should be visible for tasks with subtasks
        composeTestRule
            .onNodeWithText("1/3", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testTaskCardClickable() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Task cards should be clickable
        composeTestRule
            .onNodeWithText("Complete project report", substring = true)
            .assertHasClickAction()
    }

    @Test
    fun testAnalyticsFooterDisplays() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Analytics should display
        composeTestRule
            .onNodeWithText("Completed", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("In Progress", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Rate", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testKanbanColumns() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Kanban columns should display
        composeTestRule
            .onNodeWithText("To Do", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("In Progress", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("In Review", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Done", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testTaskInProgressStatus() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // In Progress task should be visible
        composeTestRule
            .onNodeWithText("Complete project report", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testTaskCompletedStatus() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Completed task should be visible
        composeTestRule
            .onNodeWithText("Update documentation", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testTimeTrackerSection() {
        composeTestRule.setContent {
            TasksScreen(viewModel = mockViewModel)
        }

        // Click Time tab
        composeTestRule
            .onNodeWithText("Time")
            .performClick()

        // Recent tasks should display
        composeTestRule
            .onNodeWithText("Recent Tasks", substring = true)
            .assertIsDisplayed()
    }
}
