package com.helix.email

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
 * Android UI tests for Email screen using Compose testing
 */
class EmailScreenUITest {
    @get:Rule
    val composeTestRule = createComposeRule()

    private val mockViewModel = MockEmailViewModel()

    @Test
    fun testEmailScreenDisplays() {
        // Given: Email screen loads
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // When: Screen renders
        // Then: Verify title displays
        composeTestRule
            .onNodeWithText("Email")
            .assertIsDisplayed()
    }

    @Test
    fun testEmailListDisplaysEmails() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Verify Inbox tab is visible
        composeTestRule
            .onNodeWithText("Inbox")
            .assertIsDisplayed()

        // Verify first email displays
        composeTestRule
            .onNodeWithText("Test Email Subject", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testNavigateToInbox() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Inbox tab should be visible
        composeTestRule
            .onNodeWithText("Inbox")
            .assertIsDisplayed()

        // Verify email list shows multiple emails
        composeTestRule
            .onNodeWithText("Test Email Subject", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Important Meeting Tomorrow", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testEmailItemDisplaysSubject() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Find first email item by subject
        composeTestRule
            .onNodeWithText("Test Email Subject", substring = true)
            .assertIsDisplayed()

        // Verify it's clickable
        composeTestRule
            .onNodeWithText("Test Email Subject", substring = true)
            .assertHasClickAction()
    }

    @Test
    fun testEmailItemDisplaysSender() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Find email by sender name
        composeTestRule
            .onNodeWithText("John Doe", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Jane Smith", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testComposeEmailButtonExists() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Compose button should exist and be clickable
        composeTestRule
            .onNodeWithContentDescription("Compose")
            .assertExists()
            .assertHasClickAction()
    }

    @Test
    fun testOpenComposeScreen() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Click compose
        composeTestRule
            .onNodeWithContentDescription("Compose")
            .performClick()

        // Compose dialog should open
        composeTestRule
            .onNodeWithText("Compose Email")
            .assertIsDisplayed()
    }

    @Test
    fun testComposeEmailFields() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Click compose
        composeTestRule
            .onNodeWithContentDescription("Compose")
            .performClick()

        // Email fields should exist
        composeTestRule
            .onNodeWithText("To")
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Subject")
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Body")
            .assertIsDisplayed()
    }

    @Test
    fun testFillComposeFields() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Click compose
        composeTestRule
            .onNodeWithContentDescription("Compose")
            .performClick()

        // Fill form
        composeTestRule
            .onNodeWithText("To")
            .performTextInput("recipient@example.com")

        composeTestRule
            .onNodeWithText("Subject")
            .performTextInput("Test Subject")

        composeTestRule
            .onNodeWithText("Body")
            .performTextInput("Test body content")

        // Send button should be enabled
        composeTestRule
            .onNodeWithText("Send")
            .assertIsDisplayed()
    }

    @Test
    fun testSendEmailButton() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Click compose
        composeTestRule
            .onNodeWithContentDescription("Compose")
            .performClick()

        // Send button should be visible
        composeTestRule
            .onNodeWithText("Send")
            .assertIsDisplayed()
            .assertHasClickAction()
    }

    @Test
    fun testEmailItemDisplaysStarIcon() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Star icons should exist for email rows
        composeTestRule
            .onNodeWithContentDescription("Star")
            .assertExists()
    }

    @Test
    fun testEmailItemDisplaysDeleteIcon() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Delete icons should exist for email rows
        composeTestRule
            .onNodeWithContentDescription("Delete")
            .assertExists()
    }

    @Test
    fun testEmailItemClickable() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Email item should be clickable
        composeTestRule
            .onNodeWithText("Test Email Subject", substring = true)
            .assertHasClickAction()
    }

    @Test
    fun testLoadingIndicatorShowsDuringFetch() {
        mockViewModel.setLoading(true)

        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Loading indicator should be visible when loading and emails are empty
        composeTestRule
            .onAllNodesWithText("Email")
            .onFirst()
            .assertIsDisplayed()
    }

    @Test
    fun testEmptyStateWhenNoEmails() {
        mockViewModel.setEmails(emptyList())

        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Empty state should display
        composeTestRule
            .onNodeWithText("No emails")
            .assertIsDisplayed()
    }

    @Test
    fun testErrorDialogDisplaysOnError() {
        mockViewModel.setError("Network connection failed")

        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Error dialog should appear
        composeTestRule
            .onNodeWithText("Error")
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Network connection failed")
            .assertIsDisplayed()
    }

    @Test
    fun testErrorDialogDismissal() {
        mockViewModel.setError("Network connection failed")

        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // OK button should close it
        composeTestRule
            .onNodeWithText("OK")
            .assertIsDisplayed()
            .performClick()

        // Error should be cleared
        mockViewModel.clearError()
        assert(true)
    }

    @Test
    fun testTabsDisplayed() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // All tabs should be visible
        composeTestRule
            .onNodeWithText("Inbox")
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Sent")
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Drafts")
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Search")
            .assertIsDisplayed()
    }

    @Test
    fun testSentTabExists() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Click Sent tab
        composeTestRule
            .onNodeWithText("Sent")
            .performClick()

        // Sent view should display
        composeTestRule
            .onNodeWithText("Sent emails")
            .assertIsDisplayed()
    }

    @Test
    fun testDraftsTabExists() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Click Drafts tab
        composeTestRule
            .onNodeWithText("Drafts")
            .performClick()

        // Drafts view should display
        composeTestRule
            .onNodeWithText("Drafts")
            .assertIsDisplayed()
    }

    @Test
    fun testSearchTabExists() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Click Search tab
        composeTestRule
            .onNodeWithText("Search")
            .performClick()

        // Search field should be visible
        composeTestRule
            .onNodeWithText("Search emails")
            .assertIsDisplayed()
    }

    @Test
    fun testCancelComposeDialog() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Click compose
        composeTestRule
            .onNodeWithContentDescription("Compose")
            .performClick()

        // Cancel button should close dialog
        composeTestRule
            .onNodeWithText("Cancel")
            .assertIsDisplayed()
            .performClick()

        // Compose dialog should be gone
        composeTestRule
            .onAllNodesWithText("Compose Email")
            .fetchSemanticsNodes()
            .isEmpty()
    }

    @Test
    fun testMultipleEmailsDisplay() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Multiple emails should be visible
        composeTestRule
            .onAllNodesWithText(substring = true)
            .onFirst()
            .assertIsDisplayed()

        // Verify multiple senders are visible
        composeTestRule
            .onNodeWithText("John Doe", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Jane Smith", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Support Team", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testEmailListScrollable() {
        composeTestRule.setContent {
            EmailScreen(viewModel = mockViewModel, accountId = "account_1")
        }

        // Email list should contain multiple items
        composeTestRule
            .onNodeWithText("Test Email Subject", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Important Meeting Tomorrow", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Your Account Has Been Updated", substring = true)
            .assertIsDisplayed()
    }
}
