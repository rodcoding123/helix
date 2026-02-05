package com.helix.features.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.*

/// Calendar Intelligence Screen for Android
/// Integrates meeting prep and time suggestion operations
@Composable
fun CalendarIntelligenceScreen(
  viewModel: CalendarIntelligenceViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
  val selectedTab by viewModel.selectedTab.collectAsState()
  val isLoading by viewModel.isLoading.collectAsState()
  val error by viewModel.error.collectAsState()

  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    // Header
    OperationHeaderRow(
      operations = viewModel.calendarOperations.value,
      onToggle = { viewModel.toggleOperation(it) }
    )

    Divider()

    // Tabs
    TabRow(
      selectedTabIndex = selectedTab.ordinal,
      modifier = Modifier.fillMaxWidth()
    ) {
      CalendarIntelligenceTab.values().forEachIndexed { index, tab ->
        Tab(
          selected = selectedTab.ordinal == index,
          onClick = { viewModel.selectTab(tab) },
          text = { Text(tab.label) }
        )
      }
    }

    // Content
    Box(modifier = Modifier.weight(1f)) {
      when (selectedTab) {
        CalendarIntelligenceTab.PREP -> PrepContent(viewModel, isLoading, error)
        CalendarIntelligenceTab.TIME_SUGGESTION -> TimeSuggestionContent(viewModel, isLoading, error)
      }
    }
  }
}

@Composable
private fun PrepContent(
  viewModel: CalendarIntelligenceViewModel,
  isLoading: Boolean,
  error: String?
) {
  val meetings by viewModel.upcomingMeetings.collectAsState()
  val prepData by viewModel.prepData.collectAsState()

  Column(modifier = Modifier.fillMaxSize()) {
    if (meetings.isEmpty() && !isLoading) {
      Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
      ) {
        Column(
          horizontalAlignment = Alignment.CenterHorizontally,
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          Icon(
            imageVector = Icons.Default.CalendarMonth,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.secondary
          )
          Text("No upcoming meetings")
        }
      }
    } else {
      LazyColumn(
        modifier = Modifier
          .weight(1f)
          .fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
      ) {
        items(meetings) { meeting ->
          MeetingPrepCard(
            meeting = meeting,
            prep = prepData[meeting.id],
            onGeneratePrep = { viewModel.generatePrepGuidance(meeting) }
          )
        }
      }
    }

    if (isLoading) {
      Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
      ) {
        CircularProgressIndicator()
      }
    }

    if (!error.isNullOrEmpty()) {
      Text(
        text = error,
        color = MaterialTheme.colorScheme.error,
        fontSize = 12.sp,
        modifier = Modifier.padding(16.dp)
      )
    }
  }
}

@Composable
private fun TimeSuggestionContent(
  viewModel: CalendarIntelligenceViewModel,
  isLoading: Boolean,
  error: String?
) {
  var attendeeInput by remember { mutableStateOf("") }
  val suggestions by viewModel.suggestedTimes.collectAsState()

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp)
  ) {
    Text(
      text = "Find Meeting Times",
      fontSize = 20.sp,
      fontWeight = FontWeight.Bold
    )

    // Attendee input
    Text(text = "Attendees", fontWeight = FontWeight.SemiBold)
    TextField(
      value = attendeeInput,
      onValueChange = { attendeeInput = it },
      modifier = Modifier
        .fillMaxWidth()
        .height(80.dp),
      placeholder = { Text("Enter email addresses (comma-separated)") },
      singleLine = false,
      shape = MaterialTheme.shapes.medium
    )

    // Suggested times
    if (suggestions.isNotEmpty()) {
      Text("Recommended Times", fontWeight = FontWeight.SemiBold)
      LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(suggestions) { suggestion ->
          TimeSuggestionCard(suggestion, viewModel)
        }
      }
    }

    // Find button
    Button(
      onClick = {
        val attendees = attendeeInput.split(",").map { it.trim() }
        viewModel.suggestMeetingTimes(attendees)
      },
      enabled = !isLoading && attendeeInput.isNotEmpty() && viewModel.isOperationEnabled("calendar-time"),
      modifier = Modifier
        .fillMaxWidth()
        .height(48.dp)
    ) {
      if (isLoading) {
        CircularProgressIndicator(modifier = Modifier.size(24.dp))
      } else {
        Text("Find Times")
      }
    }

    // Error
    if (!error.isNullOrEmpty()) {
      Text(
        text = error,
        color = MaterialTheme.colorScheme.error,
        fontSize = 12.sp
      )
    }
  }
}

@Composable
private fun MeetingPrepCard(
  meeting: CalendarEvent,
  prep: MeetingPrepData?,
  onGeneratePrep: () -> Unit
) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(
      containerColor = MaterialTheme.colorScheme.surfaceVariant
    )
  ) {
    Column(
      modifier = Modifier.padding(12.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      Text(meeting.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
      Text(formatTime(meeting.startTime), fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)

      if (meeting.minutesToStart <= 15) {
        Row(
          horizontalArrangement = Arrangement.spacedBy(4.dp),
          verticalAlignment = Alignment.CenterVertically,
          modifier = Modifier
            .background(
              color = MaterialTheme.colorScheme.warning.copy(alpha = 0.2f),
              shape = MaterialTheme.shapes.small
            )
            .padding(8.dp)
        ) {
          Icon(
            imageVector = Icons.Default.Warning,
            contentDescription = null,
            modifier = Modifier.size(14.dp),
            tint = MaterialTheme.colorScheme.warning
          )
          Text("Starting soon", fontSize = 11.sp)
        }
      }

      if (prep != null) {
        PrepDataDisplay(prep)
        Button(
          onClick = onGeneratePrep,
          modifier = Modifier.fillMaxWidth()
        ) {
          Text("Refresh")
        }
      } else {
        Button(
          onClick = onGeneratePrep,
          modifier = Modifier.fillMaxWidth()
        ) {
          Text("Generate Prep")
        }
      }
    }
  }
}

@Composable
private fun TimeSuggestionCard(
  suggestion: TimeSuggestion,
  viewModel: CalendarIntelligenceViewModel
) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(
      containerColor = MaterialTheme.colorScheme.surfaceVariant
    )
  ) {
    Column(
      modifier = Modifier.padding(12.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(formatTime(suggestion.dateTime), fontWeight = FontWeight.SemiBold)
        QualityBadge(suggestion.qualityScore)
      }

      if (!suggestion.reason.isNullOrEmpty()) {
        Text(suggestion.reason, fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)
      }

      Button(
        onClick = { viewModel.scheduleMeeting(suggestion.dateTime) },
        modifier = Modifier.fillMaxWidth()
      ) {
        Text("Schedule")
      }
    }
  }
}

@Composable
private fun PrepDataDisplay(prep: MeetingPrepData) {
  Column(
    modifier = Modifier
      .fillMaxWidth()
      .background(
        color = MaterialTheme.colorScheme.background,
        shape = MaterialTheme.shapes.small
      )
      .padding(8.dp),
    verticalArrangement = Arrangement.spacedBy(4.dp)
  ) {
    if (!prep.summary.isNullOrEmpty()) {
      Text(prep.summary, fontSize = 11.sp, maxLines = 2)
    }

    if (prep.keyPoints.isNotEmpty()) {
      Row(
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Icon(
          imageVector = Icons.Default.CheckCircle,
          contentDescription = null,
          modifier = Modifier.size(12.dp)
        )
        Text("${prep.keyPoints.size} key points", fontSize = 10.sp)
      }
    }
  }
}

@Composable
private fun QualityBadge(score: Double) {
  val (color, text) = when {
    score >= 80 -> Pair(Color(0xFF4CAF50), "Excellent")
    score >= 60 -> Pair(Color(0xFFFFAB40), "Good")
    else -> Pair(Color(0xFFFF5252), "Fair")
  }

  Surface(
    color = color,
    shape = MaterialTheme.shapes.small,
    modifier = Modifier.padding(4.dp)
  ) {
    Text(
      text = "${score.toInt()}%",
      color = Color.White,
      fontSize = 10.sp,
      fontWeight = FontWeight.Bold,
      modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
    )
  }
}

@Composable
private fun OperationHeaderRow(
  operations: Map<String, Boolean>,
  onToggle: (String) -> Unit
) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .horizontalScroll(rememberScrollState())
      .padding(8.dp),
    horizontalArrangement = Arrangement.spacedBy(8.dp)
  ) {
    operations.keys.forEach { op ->
      FilterChip(
        selected = operations[op] ?: false,
        onClick = { onToggle(op) },
        label = { Text(op.removePrefix("calendar-"), fontSize = 12.sp) },
        leadingIcon = {
          if (operations[op] == true) {
            Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
          }
        }
      )
    }
  }
}

private fun formatTime(date: Date): String {
  val sdf = java.text.SimpleDateFormat("MMM dd, hh:mm a", Locale.getDefault())
  return sdf.format(date)
}

// Models
enum class CalendarIntelligenceTab(val label: String) {
  PREP("Prep"),
  TIME_SUGGESTION("Times")
}

data class CalendarEvent(
  val id: UUID = UUID.randomUUID(),
  val title: String,
  val startTime: Date,
  val endTime: Date,
  val attendees: List<String>,
  val description: String? = null
) {
  val minutesToStart: Int
    get() = ((startTime.time - System.currentTimeMillis()) / 60000).toInt()
}

data class MeetingPrepData(
  val summary: String? = null,
  val keyPoints: List<String> = emptyList(),
  val suggestedTopics: List<String> = emptyList(),
  val preparationEstimate: Int = 0
)

data class TimeSuggestion(
  val id: UUID = UUID.randomUUID(),
  val dateTime: Date,
  val qualityScore: Double,
  val reason: String? = null,
  val attendeeAvailability: Double = 0.0
)

// ViewModel
class CalendarIntelligenceViewModel : ViewModel() {
  private val _selectedTab = MutableStateFlow(CalendarIntelligenceTab.PREP)
  val selectedTab = _selectedTab.asStateFlow()

  private val _isLoading = MutableStateFlow(false)
  val isLoading = _isLoading.asStateFlow()

  private val _error = MutableStateFlow<String?>(null)
  val error = _error.asStateFlow()

  private val _upcomingMeetings = MutableStateFlow<List<CalendarEvent>>(emptyList())
  val upcomingMeetings = _upcomingMeetings.asStateFlow()

  private val _prepData = MutableStateFlow<Map<UUID, MeetingPrepData>>(emptyMap())
  val prepData = _prepData.asStateFlow()

  private val _suggestedTimes = MutableStateFlow<List<TimeSuggestion>>(emptyList())
  val suggestedTimes = _suggestedTimes.asStateFlow()

  val calendarOperations = mutableStateOf(
    mapOf(
      "calendar-prep" to true,
      "calendar-time" to true
    )
  )

  fun selectTab(tab: CalendarIntelligenceTab) {
    _selectedTab.value = tab
  }

  fun toggleOperation(operation: String) {
    val current = calendarOperations.value.toMutableMap()
    current[operation] = !current.getOrDefault(operation, false)
    calendarOperations.value = current
  }

  fun isOperationEnabled(operation: String): Boolean {
    return calendarOperations.value.getOrDefault(operation, false)
  }

  fun generatePrepGuidance(meeting: CalendarEvent) {
    _isLoading.value = true
    _error.value = null

    viewModelScope.launch {
      try {
        val prep = MeetingPrepData(
          summary = "Meeting overview for ${meeting.title}",
          keyPoints = listOf("Point 1", "Point 2", "Point 3"),
          suggestedTopics = listOf("Topic A", "Topic B"),
          preparationEstimate = 15
        )
        val current = _prepData.value.toMutableMap()
        current[meeting.id] = prep
        _prepData.value = current
        _isLoading.value = false
      } catch (e: Exception) {
        _error.value = e.message
        _isLoading.value = false
      }
    }
  }

  fun suggestMeetingTimes(attendees: List<String>) {
    _isLoading.value = true
    _error.value = null

    viewModelScope.launch {
      try {
        val suggestions = (0..4).map { i ->
          TimeSuggestion(
            dateTime = Date(System.currentTimeMillis() + (i + 1) * 86400000),
            qualityScore = 100.0 - i * 10,
            reason = "Attendees available",
            attendeeAvailability = 0.95 - i * 0.1
          )
        }
        _suggestedTimes.value = suggestions
        _isLoading.value = false
      } catch (e: Exception) {
        _error.value = e.message
        _isLoading.value = false
      }
    }
  }

  fun scheduleMeeting(dateTime: Date) {
    viewModelScope.launch {
      try {
        _suggestedTimes.value = emptyList()
        _error.value = null
      } catch (e: Exception) {
        _error.value = "Failed to schedule: ${e.message}"
      }
    }
  }
}
