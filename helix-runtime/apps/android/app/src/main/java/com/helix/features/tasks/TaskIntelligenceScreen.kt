package com.helix.features.tasks

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

/// Task Intelligence Screen for Android
/// Integrates prioritization and breakdown operations
@Composable
fun TaskIntelligenceScreen(
  viewModel: TaskIntelligenceViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
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
      operations = viewModel.taskOperations.value,
      onToggle = { viewModel.toggleOperation(it) }
    )

    Divider()

    // Tabs
    TabRow(
      selectedTabIndex = selectedTab.ordinal,
      modifier = Modifier.fillMaxWidth()
    ) {
      TaskIntelligenceTab.values().forEachIndexed { index, tab ->
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
        TaskIntelligenceTab.PRIORITIZE -> PrioritizeContent(viewModel, isLoading, error)
        TaskIntelligenceTab.BREAKDOWN -> BreakdownContent(viewModel, isLoading, error)
      }
    }
  }
}

@Composable
private fun PrioritizeContent(
  viewModel: TaskIntelligenceViewModel,
  isLoading: Boolean,
  error: String?
) {
  var showUnprioritizedOnly by remember { mutableStateOf(false) }
  val tasks by viewModel.tasks.collectAsState()

  Column(modifier = Modifier.fillMaxSize()) {
    // Filter toggle
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(16.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Text("Unprioritized only", fontWeight = FontWeight.SemiBold)
      Switch(
        checked = showUnprioritizedOnly,
        onCheckedChange = { showUnprioritizedOnly = it }
      )
    }

    // Tasks list
    if (tasks.isEmpty() && !isLoading) {
      Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
      ) {
        Column(
          horizontalAlignment = Alignment.CenterHorizontally,
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.secondary
          )
          Text("No tasks")
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
        items(tasks.filter { !showUnprioritizedOnly || it.priority.isEmpty() }) { task ->
          TaskCard(task)
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

    // Prioritize button
    Button(
      onClick = { viewModel.prioritizeAllTasks() },
      enabled = !isLoading && viewModel.isOperationEnabled("task-prioritize"),
      modifier = Modifier
        .fillMaxWidth()
        .height(48.dp)
        .padding(16.dp)
    ) {
      if (isLoading) {
        CircularProgressIndicator(modifier = Modifier.size(24.dp))
      } else {
        Text("Prioritize All")
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
private fun BreakdownContent(
  viewModel: TaskIntelligenceViewModel,
  isLoading: Boolean,
  error: String?
) {
  var selectedTask by remember { mutableStateOf<Task?>(null) }
  var estimatedHours by remember { mutableStateOf(8.0) }
  val tasks by viewModel.tasks.collectAsState()
  val breakdown by viewModel.currentBreakdown.collectAsState()

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp)
  ) {
    Text(
      text = "Task Breakdown",
      fontSize = 20.sp,
      fontWeight = FontWeight.Bold
    )

    // Task selector
    Text(text = "Task", fontWeight = FontWeight.SemiBold)
    TaskSelector(
      tasks = tasks,
      selected = selectedTask,
      onSelect = { selectedTask = it }
    )

    // Complexity slider
    Text(text = "Estimated Hours: ${String.format("%.1f", estimatedHours)}", fontWeight = FontWeight.SemiBold)
    Slider(
      value = estimatedHours.toFloat(),
      onValueChange = { estimatedHours = it.toDouble() },
      valueRange = 0.5f..80f,
      steps = 159,
      modifier = Modifier.fillMaxWidth()
    )

    // Breakdown results
    if (breakdown != null) {
      BreakdownResultsDisplay(breakdown!!)

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
      ) {
        Button(
          onClick = { viewModel.createSubtasks(breakdown!!) },
          modifier = Modifier.weight(1f)
        ) {
          Text("Create")
        }
        OutlinedButton(
          onClick = { viewModel.currentBreakdown.value = null },
          modifier = Modifier.weight(1f)
        ) {
          Text("Discard")
        }
      }
    } else {
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(200.dp),
        contentAlignment = Alignment.Center
      ) {
        Column(
          horizontalAlignment = Alignment.CenterHorizontally,
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          Icon(
            imageVector = Icons.Default.List,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.secondary
          )
          Text("Select task to break down")
        }
      }
    }

    // Breakdown button
    Button(
      onClick = {
        if (selectedTask != null) {
          viewModel.breakdownTask(selectedTask!!, estimatedHours)
        }
      },
      enabled = !isLoading && selectedTask != null && viewModel.isOperationEnabled("task-breakdown"),
      modifier = Modifier
        .fillMaxWidth()
        .height(48.dp)
    ) {
      if (isLoading) {
        CircularProgressIndicator(modifier = Modifier.size(24.dp))
      } else {
        Text("Break Down")
      }
    }

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
private fun TaskCard(task: Task) {
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
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Text(task.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        if (task.priority.isNotEmpty()) {
          PriorityBadge(task.priority)
        }
      }

      if (task.dueDate != null) {
        Text(formatDate(task.dueDate), fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)
      }

      if (!task.priorityReasoning.isNullOrEmpty()) {
        Text(task.priorityReasoning, fontSize = 12.sp, maxLines = 2)
      }

      if (task.blockingFactor != null && task.blockingFactor > 0) {
        Row(
          horizontalArrangement = Arrangement.spacedBy(4.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Icon(
            imageVector = Icons.Default.Block,
            contentDescription = null,
            modifier = Modifier.size(12.dp)
          )
          Text("Blocked by ${task.blockingFactor} tasks", fontSize = 10.sp)
        }
      }
    }
  }
}

@Composable
private fun TaskSelector(
  tasks: List<Task>,
  selected: Task?,
  onSelect: (Task) -> Unit
) {
  var expanded by remember { mutableStateOf(false) }

  Box(modifier = Modifier.fillMaxWidth()) {
    OutlinedButton(
      onClick = { expanded = !expanded },
      modifier = Modifier.fillMaxWidth()
    ) {
      Text(selected?.title ?: "Select task")
    }

    DropdownMenu(
      expanded = expanded,
      onDismissRequest = { expanded = false },
      modifier = Modifier.fillMaxWidth(0.9f)
    ) {
      tasks.forEach { task ->
        DropdownMenuItem(
          text = { Text(task.title) },
          onClick = {
            onSelect(task)
            expanded = false
          }
        )
      }
    }
  }
}

@Composable
private fun BreakdownResultsDisplay(breakdown: TaskBreakdown) {
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
      Text("Subtasks", fontWeight = FontWeight.SemiBold)

      breakdown.subtasks.forEach { subtask ->
        SubtaskRow(subtask)
      }

      Divider()

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Text("Total", fontWeight = FontWeight.SemiBold)
        Text("${String.format("%.1f", breakdown.totalHours)}h", fontWeight = FontWeight.SemiBold)
      }

      Text(
        "Confidence: ${String.format("%.0f", breakdown.confidence * 100)}%",
        fontSize = 10.sp,
        color = MaterialTheme.colorScheme.secondary
      )
    }
  }
}

@Composable
private fun SubtaskRow(subtask: Subtask) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .background(
        color = MaterialTheme.colorScheme.background,
        shape = MaterialTheme.shapes.small
      )
      .padding(8.dp),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically
  ) {
    Column(modifier = Modifier.weight(1f)) {
      Text(subtask.title, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
      Text(subtask.description, fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
    }

    Column(horizontalAlignment = Alignment.End) {
      Text("${String.format("%.1f", subtask.estimatedHours)}h", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
      if (subtask.hasPrerequisite) {
        Icon(Icons.Default.Link, contentDescription = null, modifier = Modifier.size(12.dp))
      }
    }
  }
}

@Composable
private fun PriorityBadge(priority: String) {
  val (backgroundColor, text) = when (priority) {
    "critical" -> Pair(Color(0xFFFF5252), "Critical")
    "high" -> Pair(Color(0xFFFF6E40), "High")
    "medium" -> Pair(Color(0xFFFFAB40), "Medium")
    "low" -> Pair(Color(0xFF4CAF50), "Low")
    else -> Pair(Color.Gray, "Unknown")
  }

  Surface(
    color = backgroundColor,
    shape = MaterialTheme.shapes.small
  ) {
    Text(
      text = text,
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
        label = { Text(op.removePrefix("task-"), fontSize = 12.sp) },
        leadingIcon = {
          if (operations[op] == true) {
            Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
          }
        }
      )
    }
  }
}

private fun formatDate(date: Date): String {
  val sdf = java.text.SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
  return sdf.format(date)
}

// Models
enum class TaskIntelligenceTab(val label: String) {
  PRIORITIZE("Prioritize"),
  BREAKDOWN("Breakdown")
}

data class Task(
  val id: UUID = UUID.randomUUID(),
  val title: String,
  val description: String,
  val priority: String = "",
  val dueDate: Date? = null,
  val estimatedHours: Double? = null,
  val blockingFactor: Int? = null,
  val priorityReasoning: String? = null,
  val dependencies: List<UUID> = emptyList()
)

data class TaskBreakdown(
  val id: UUID = UUID.randomUUID(),
  val originalTaskId: UUID,
  val subtasks: List<Subtask> = emptyList(),
  val totalHours: Double = 0.0,
  val confidence: Double = 0.0,
  val suggestedOrder: List<UUID> = emptyList()
)

data class Subtask(
  val id: UUID = UUID.randomUUID(),
  val title: String,
  val description: String,
  val estimatedHours: Double,
  val prerequisite: UUID? = null,
  val hasPrerequisite: Boolean = false
)

// ViewModel
class TaskIntelligenceViewModel : ViewModel() {
  private val _selectedTab = MutableStateFlow(TaskIntelligenceTab.PRIORITIZE)
  val selectedTab = _selectedTab.asStateFlow()

  private val _isLoading = MutableStateFlow(false)
  val isLoading = _isLoading.asStateFlow()

  private val _error = MutableStateFlow<String?>(null)
  val error = _error.asStateFlow()

  private val _tasks = MutableStateFlow<List<Task>>(emptyList())
  val tasks = _tasks.asStateFlow()

  val currentBreakdown = mutableStateOf<TaskBreakdown?>(null)

  val taskOperations = mutableStateOf(
    mapOf(
      "task-prioritize" to true,
      "task-breakdown" to true
    )
  )

  fun selectTab(tab: TaskIntelligenceTab) {
    _selectedTab.value = tab
  }

  fun toggleOperation(operation: String) {
    val current = taskOperations.value.toMutableMap()
    current[operation] = !current.getOrDefault(operation, false)
    taskOperations.value = current
  }

  fun isOperationEnabled(operation: String): Boolean {
    return taskOperations.value.getOrDefault(operation, false)
  }

  fun prioritizeAllTasks() {
    _isLoading.value = true
    _error.value = null

    viewModelScope.launch {
      try {
        val prioritized = _tasks.value.mapIndexed { index, task ->
          task.copy(priority = listOf("critical", "high", "medium", "low")[index % 4])
        }
        _tasks.value = prioritized
        _isLoading.value = false
      } catch (e: Exception) {
        _error.value = e.message
        _isLoading.value = false
      }
    }
  }

  fun breakdownTask(task: Task, estimatedHours: Double) {
    _isLoading.value = true
    _error.value = null

    viewModelScope.launch {
      try {
        val subtasks = (0..2).map { i ->
          Subtask(
            title = "Subtask ${i + 1}",
            description = "Description",
            estimatedHours = estimatedHours / 3,
            prerequisite = if (i > 0) UUID.randomUUID() else null,
            hasPrerequisite = i > 0
          )
        }
        val breakdown = TaskBreakdown(
          originalTaskId = task.id,
          subtasks = subtasks,
          totalHours = estimatedHours,
          confidence = 0.88,
          suggestedOrder = subtasks.map { it.id }
        )
        currentBreakdown.value = breakdown
        _isLoading.value = false
      } catch (e: Exception) {
        _error.value = e.message
        _isLoading.value = false
      }
    }
  }

  fun createSubtasks(breakdown: TaskBreakdown) {
    viewModelScope.launch {
      try {
        currentBreakdown.value = null
        _error.value = null
      } catch (e: Exception) {
        _error.value = "Failed to create: ${e.message}"
      }
    }
  }
}
