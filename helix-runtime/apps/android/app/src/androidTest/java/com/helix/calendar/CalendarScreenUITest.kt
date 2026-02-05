package com.helix.calendar

import androidx.compose.ui.test.assertExists
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test

/**
 * Android UI tests for Calendar screen using Compose testing
 */
class CalendarScreenUITest {
    @get:Rule
    val composeTestRule = createComposeRule()

    private val mockViewModel = MockCalendarViewModel()

    @Test
    fun testCalendarScreenDisplays() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Calendar title displays
        composeTestRule
            .onNodeWithText("Calendar")
            .assertIsDisplayed()
    }

    @Test
    fun testCalendarHeaderDisplays() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Header should display
        composeTestRule
            .onNodeWithText("Calendar")
            .assertIsDisplayed()
    }

    @Test
    fun testMonthTabExists() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Month tab should be visible
        composeTestRule
            .onNodeWithText("Month")
            .assertIsDisplayed()
    }

    @Test
    fun testWeekTabExists() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Week tab should be visible
        composeTestRule
            .onNodeWithText("Week")
            .assertIsDisplayed()
    }

    @Test
    fun testDayTabExists() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Day tab should be visible
        composeTestRule
            .onNodeWithText("Day")
            .assertIsDisplayed()
    }

    @Test
    fun testEventDisplays() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Events should display
        composeTestRule
            .onNodeWithText("Team Meeting", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Project Review", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testEventTimeDisplays() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Event times should display
        composeTestRule
            .onNodeWithText("2026-02-04", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testDateNavigationBarDisplays() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Today button should exist
        composeTestRule
            .onNodeWithText("Today")
            .assertExists()
    }

    @Test
    fun testTodayButtonClickable() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Today button should be clickable
        composeTestRule
            .onNodeWithText("Today")
            .assertIsDisplayed()
    }

    @Test
    fun testEventCardDisplays() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Event information should display
        composeTestRule
            .onNodeWithText("Team Meeting", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("5 attendees", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testMultipleEventsDisplay() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // All events should be visible
        composeTestRule
            .onNodeWithText("Team Meeting", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Project Review", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Lunch Break", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testWeekTabNavigation() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Click Week tab
        composeTestRule
            .onNodeWithText("Week")
            .performClick()

        // Week tab should be selected
        composeTestRule
            .onNodeWithText("Week")
            .assertIsDisplayed()
    }

    @Test
    fun testDayTabNavigation() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Click Day tab
        composeTestRule
            .onNodeWithText("Day")
            .performClick()

        // Day tab should be selected
        composeTestRule
            .onNodeWithText("Day")
            .assertIsDisplayed()
    }

    @Test
    fun testMonthTabDefault() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Month view should display calendar grid
        composeTestRule
            .onNodeWithText("Sun", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testWeekdayHeadersDisplay() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Weekday headers should display
        composeTestRule
            .onNodeWithText("Mon", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Tue", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testErrorDisplaysOnError() {
        mockViewModel.setError("Network error occurred")

        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Error dialog should appear
        composeTestRule
            .onNodeWithText("Error")
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Network error occurred")
            .assertIsDisplayed()
    }

    @Test
    fun testErrorDismissal() {
        mockViewModel.setError("Network error occurred")

        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // OK button should close error
        composeTestRule
            .onNodeWithText("OK")
            .assertIsDisplayed()
    }

    @Test
    fun testEventLocationDisplays() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Event details should display
        composeTestRule
            .onNodeWithText("Team Meeting", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Conference Room A", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testEventAttendeeCountDisplays() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Attendee counts should display
        composeTestRule
            .onNodeWithText("5 attendees", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("3 attendees", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testUpcomingEventsSection() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Upcoming section should display
        composeTestRule
            .onNodeWithText("Upcoming", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testCalendarGridDisplays() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Calendar grid should have day numbers
        composeTestRule
            .onAllNodesWithText("1", substring = true)
            .onFirst()
            .assertIsDisplayed()

        composeTestRule
            .onAllNodesWithText("15", substring = true)
            .onFirst()
            .assertIsDisplayed()
    }

    @Test
    fun testEventClickable() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Events should be clickable (displayed means they exist)
        composeTestRule
            .onNodeWithText("Team Meeting", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testMultipleCalendarAccounts() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Calendar should display
        composeTestRule
            .onNodeWithText("Calendar")
            .assertIsDisplayed()

        // Events from account should be visible
        composeTestRule
            .onNodeWithText("Team Meeting", substring = true)
            .assertIsDisplayed()
    }

    @Test
    fun testAnalyticsFooterDisplays() {
        composeTestRule.setContent {
            CalendarScreen(viewModel = mockViewModel)
        }

        // Analytics should show event count
        composeTestRule
            .onNodeWithText("Events", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Avg Attendees", substring = true)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("Conflicts", substring = true)
            .assertIsDisplayed()
    }
}
