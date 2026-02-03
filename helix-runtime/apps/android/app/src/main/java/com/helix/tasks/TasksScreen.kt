package com.helix.tasks

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(
    viewModel: TasksViewModel,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedTabIndex by remember { mutableStateOf(0) }
    var showCreateDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.loadBoards()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tasks") },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showCreateDialog = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Create task")
            }
        },
        modifier = modifier,
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            if (uiState.isLoading && uiState.tasks.isEmpty()) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                )
            } else {
                Column {
                    // Tab selector
                    TabRow(selectedTabIndex = selectedTabIndex) {
                        Tab(
                            selected = selectedTabIndex == 0,
                            onClick = { selectedTabIndex = 0 },
                            text = { Text("Kanban") },
                        )
                        Tab(
                            selected = selectedTabIndex == 1,
                            onClick = { selectedTabIndex = 1 },
                            text = { Text("List") },
                        )
                        Tab(
                            selected = selectedTabIndex == 2,
                            onClick = { selectedTabIndex = 2 },
                            text = { Text("Time") },
                        )
                    }

                    // Content
                    when (selectedTabIndex) {
                        0 -> KanbanBoardView(viewModel = viewModel)
                        1 -> TaskListView(viewModel = viewModel)
                        2 -> TimeTrackerView(viewModel = viewModel)
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

    if (showCreateDialog) {
        CreateTaskDialog(
            onDismiss = { showCreateDialog = false },
            onCreate = { title, description ->
                viewModel.createTask(title = title, description = description)
                showCreateDialog = false
            },
        )
    }
}

@Composable
fun KanbanBoardView(viewModel: TasksViewModel) {
    val uiState by viewModel.uiState.collectAsState()

    Row(
        modifier = Modifier
            .fillMaxSize()
            .horizontalScroll(rememberScrollState()),
    ) {
        listOf(
            TaskStatus.Todo to "To Do",
            TaskStatus.InProgress to "In Progress",
            TaskStatus.InReview to "In Review",
            TaskStatus.Done to "Done",
        ).forEach { (status, title) ->
            KanbanColumn(
                title = title,
                tasks = viewModel.tasksForStatus(status),
                onTaskClick = { viewModel.selectTask(it) },
                onDeleteClick = { viewModel.deleteTask(it.id) },
            )
        }
    }
}

@Composable
fun KanbanColumn(
    title: String,
    tasks: List<Task>,
    onTaskClick: (Task) -> Unit,
    onDeleteClick: (Task) -> Unit,
) {
    Column(
        modifier = Modifier
            .width(280.dp)
            .fillMaxSize()
            .padding(8.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(8.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Text(tasks.size.toString(), style = MaterialTheme.typography.labelSmall)
        }

        LazyColumn {
            items(tasks) { task ->
                TaskCard(
                    task = task,
                    onClick = { onTaskClick(task) },
                    onDelete = { onDeleteClick(task) },
                )
            }
        }
    }
}

@Composable
fun TaskCard(
    task: Task,
    onClick: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clickable(onClick = onClick),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
        ) {
            Text(task.title, style = MaterialTheme.typography.bodySmall)

            if (task.dueDate != null) {
                Text(
                    task.dueDate,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (task.isOverdue) Color.Red else Color.Gray,
                )
            }

            if (task.subtaskCount > 0) {
                LinearProgressIndicator(
                    progress = task.progressPercentage.toFloat(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                )
                Text(
                    "${task.completedSubtaskCount}/${task.subtaskCount}",
                    style = MaterialTheme.typography.labelSmall,
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                PriorityBadge(priority = task.priority)
                IconButton(onClick = onDelete, modifier = Modifier.width(24.dp)) {
                    Icon(
                        Icons.Filled.Delete,
                        contentDescription = "Delete",
                        modifier = Modifier.width(16.dp),
                    )
                }
            }
        }
    }
}

@Composable
fun PriorityBadge(priority: TaskPriority) {
    val color = when (priority) {
        TaskPriority.Low -> Color.Green
        TaskPriority.Medium -> Color.Blue
        TaskPriority.High -> Color.Yellow
        TaskPriority.Critical -> Color.Red
    }

    Text(
        text = priority.toString(),
        style = MaterialTheme.typography.labelSmall,
        color = color,
        modifier = Modifier
            .background(color.copy(alpha = 0.2f))
            .padding(horizontal = 4.dp, vertical = 2.dp),
    )
}

@Composable
fun TaskListView(viewModel: TasksViewModel) {
    val uiState by viewModel.uiState.collectAsState()

    LazyColumn {
        items(uiState.tasks) { task ->
            TaskCard(
                task = task,
                onClick = { viewModel.selectTask(task) },
                onDelete = { viewModel.deleteTask(task.id) },
            )
        }
    }
}

@Composable
fun TimeTrackerView(viewModel: TasksViewModel) {
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        if (uiState.isTimeTracking && uiState.currentTimeEntry != null) {
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                ) {
                    Text("Time Tracking Active", style = MaterialTheme.typography.titleSmall)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "${uiState.currentTimeEntry!!.durationMinutes} minutes",
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    Button(
                        onClick = {
                            viewModel.stopTimeTracking(uiState.currentTimeEntry!!.taskId)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Stop Tracking")
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text("Recent Tasks", style = MaterialTheme.typography.titleSmall)
        LazyColumn {
            items(uiState.tasks.take(5)) { task ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(task.title, style = MaterialTheme.typography.bodySmall)
                        if (task.actualHours != null) {
                            Text(
                                "Tracked: ${task.actualHours}h",
                                style = MaterialTheme.typography.labelSmall,
                            )
                        }
                    }

                    IconButton(
                        onClick = { viewModel.startTimeTracking(task.id) },
                    ) {
                        Icon(Icons.Filled.PlayArrow, contentDescription = "Start")
                    }
                }
            }
        }
    }
}

@Composable
fun AnalyticsFooter(analytics: TaskAnalytics) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.secondaryContainer)
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(analytics.completedTasks.toString(), style = MaterialTheme.typography.titleSmall)
            Text("Completed", style = MaterialTheme.typography.labelSmall)
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(analytics.inProgressTasks.toString(), style = MaterialTheme.typography.titleSmall)
            Text("In Progress", style = MaterialTheme.typography.labelSmall)
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "${(analytics.completionRate * 100).toInt()}%",
                style = MaterialTheme.typography.titleSmall,
            )
            Text("Rate", style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
fun CreateTaskDialog(
    onDismiss: () -> Unit,
    onCreate: (String, String?) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Task") },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                TextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                )
                Spacer(modifier = Modifier.height(8.dp))
                TextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp),
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onCreate(title, description.takeIf { it.isNotEmpty() }) },
                enabled = title.isNotEmpty(),
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            Button(onClick = onDismiss) {
                Text("Cancel")
            }
        },
    )
}
