package com.helix.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(
    viewModel: CalendarViewModel,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedTabIndex by remember { mutableStateOf(0) }

    LaunchedEffect(Unit) {
        viewModel.loadAccounts()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Calendar") },
                actions = {
                    val account = uiState.selectedAccountId?.let { accountId ->
                        uiState.accounts.find { it.id == accountId }
                    }
                    if (account != null) {
                        Text(
                            text = account.displayName,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(end = 16.dp),
                        )
                    }
                },
            )
        },
        modifier = modifier,
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            if (uiState.isLoading && uiState.events.isEmpty()) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                )
            } else {
                Column {
                    // Date navigation
                    DateNavigationBar(
                        currentDate = uiState.currentDate,
                        onPrevious = { viewModel.goToPreviousMonth() },
                        onToday = { viewModel.goToToday() },
                        onNext = { viewModel.goToNextMonth() },
                    )

                    // View selector
                    TabRow(selectedTabIndex = selectedTabIndex) {
                        Tab(
                            selected = selectedTabIndex == 0,
                            onClick = {
                                selectedTabIndex = 0
                                viewModel.setViewType(CalendarViewType.Month)
                            },
                            text = { Text("Month") },
                        )
                        Tab(
                            selected = selectedTabIndex == 1,
                            onClick = {
                                selectedTabIndex = 1
                                viewModel.setViewType(CalendarViewType.Week)
                            },
                            text = { Text("Week") },
                        )
                        Tab(
                            selected = selectedTabIndex == 2,
                            onClick = {
                                selectedTabIndex = 2
                                viewModel.setViewType(CalendarViewType.Day)
                            },
                            text = { Text("Day") },
                        )
                    }

                    // Content based on selected view
                    when (selectedTabIndex) {
                        0 -> MonthCalendarView(
                            viewModel = viewModel,
                            events = uiState.eventsForMonth(),
                        )

                        1 -> WeekCalendarView()
                        2 -> DayCalendarView()
                    }

                    // Analytics footer
                    if (uiState.analytics != null) {
                        AnalyticsFooter(analytics = uiState.analytics!!)
                    }
                }
            }

            if (uiState.error != null) {
                AlertDialog(
                    onDismissRequest = { viewModel.clearError() },
                    title = { Text("Error") },
                    text = { Text(uiState.error?.localizedMessage ?: "Unknown error") },
                    confirmButton = {
                        Button(onClick = { viewModel.clearError() }) {
                            Text("OK")
                        }
                    },
                )
            }
        }
    }
}

@Composable
fun DateNavigationBar(
    currentDate: java.util.Date,
    onPrevious: () -> Unit,
    onToday: () -> Unit,
    onNext: () -> Unit,
) {
    val dateFormat = SimpleDateFormat("MMMM yyyy", Locale.getDefault())

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onPrevious) {
            Icon(Icons.Filled.ChevronLeft, contentDescription = "Previous")
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = dateFormat.format(currentDate),
                style = MaterialTheme.typography.titleMedium,
            )
        }

        Row {
            Button(onClick = onToday) {
                Text("Today")
            }
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(onClick = onNext) {
                Icon(Icons.Filled.ChevronRight, contentDescription = "Next")
            }
        }
    }
}

@Composable
fun MonthCalendarView(
    viewModel: CalendarViewModel,
    events: List<CalendarEvent>,
) {
    val weekDays = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        // Weekday headers
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
            ) {
                weekDays.forEach { day ->
                    Text(
                        text = day,
                        modifier = Modifier
                            .weight(1f)
                            .padding(8.dp),
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
        }

        // Calendar grid
        items(6) { week ->
            Row(modifier = Modifier.fillMaxWidth()) {
                repeat(7) { day ->
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(60.dp)
                            .padding(4.dp)
                            .background(Color.LightGray.copy(alpha = 0.2f))
                            .padding(4.dp),
                        contentAlignment = Alignment.TopStart,
                    ) {
                        val dayNumber = week * 7 + day + 1
                        if (dayNumber <= 31) {
                            Column {
                                Text(
                                    text = dayNumber.toString(),
                                    style = MaterialTheme.typography.labelSmall,
                                )
                                if (events.any { event ->
                                    event.startTime.contains("${dayNumber.toString().padStart(2, '0')}")
                                }) {
                                    Box(
                                        modifier = Modifier
                                            .width(4.dp)
                                            .height(4.dp)
                                            .background(Color.Blue)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Upcoming events
        if (events.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    "Upcoming",
                    style = MaterialTheme.typography.titleSmall,
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            items(events.take(3)) { event ->
                EventCard(event = event)
            }
        }
    }
}

@Composable
fun WeekCalendarView() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("Week view coming soon")
    }
}

@Composable
fun DayCalendarView() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("Day view coming soon")
    }
}

@Composable
fun EventCard(event: CalendarEvent) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
        ) {
            Text(
                text = event.title,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = event.startTime,
                style = MaterialTheme.typography.labelSmall,
                color = Color.Gray,
            )
            if (event.attendeeCount > 0) {
                Text(
                    text = "${event.attendeeCount} attendees",
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}

@Composable
fun AnalyticsFooter(analytics: CalendarAnalytics) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.secondaryContainer)
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = analytics.totalEvents.toString(),
                style = MaterialTheme.typography.titleSmall,
            )
            Text(
                "Events",
                style = MaterialTheme.typography.labelSmall,
            )
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = String.format("%.1f", analytics.averageAttendees),
                style = MaterialTheme.typography.titleSmall,
            )
            Text(
                "Avg Attendees",
                style = MaterialTheme.typography.labelSmall,
            )
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = analytics.conflictCount.toString(),
                style = MaterialTheme.typography.titleSmall,
                color = if (analytics.conflictCount > 0) Color.Red else Color.Green,
            )
            Text(
                "Conflicts",
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}
