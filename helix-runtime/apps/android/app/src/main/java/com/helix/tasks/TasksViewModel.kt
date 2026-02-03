package com.helix.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class TasksUiState(
    val tasks: List<Task> = emptyList(),
    val selectedTask: Task? = null,
    val boards: List<KanbanBoard> = emptyList(),
    val selectedBoardId: String? = null,
    val isLoading: Boolean = false,
    val error: TaskError? = null,
    val searchQuery: String = "",
    val searchResults: List<Task> = emptyList(),
    val currentTimeEntry: TimeEntry? = null,
    val isTimeTracking: Boolean = false,
    val focusTimeSettings: FocusTime? = null,
    val analytics: TaskAnalytics? = null,
)

class TasksViewModel(private val service: TasksService) : ViewModel() {
    private val _uiState = MutableStateFlow(TasksUiState())
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    fun loadBoards() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val boards = service.getBoards()
                val defaultBoard = boards.firstOrNull { it.isDefault } ?: boards.firstOrNull()

                _uiState.update {
                    it.copy(
                        boards = boards,
                        selectedBoardId = defaultBoard?.id,
                        isLoading = false,
                        error = null,
                    )
                }

                defaultBoard?.id?.let { boardId ->
                    loadTasks(boardId)
                    loadAnalytics(boardId)
                    loadFocusTimeSettings()
                }
            } catch (e: TaskError) {
                _uiState.update { it.copy(isLoading = false, error = e) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = TaskError.UnknownError) }
            }
        }
    }

    fun loadTasks(boardId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val tasks = service.getTasks(boardId)
                _uiState.update { it.copy(tasks = tasks, isLoading = false, error = null) }
            } catch (e: TaskError) {
                _uiState.update { it.copy(isLoading = false, error = e) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = TaskError.UnknownError) }
            }
        }
    }

    fun selectTask(task: Task) {
        _uiState.update { it.copy(selectedTask = task) }
    }

    fun createTask(
        title: String,
        description: String? = null,
        priority: TaskPriority = TaskPriority.Medium,
        dueDate: String? = null,
        estimatedHours: Double? = null,
        tags: List<String> = emptyList(),
    ) {
        viewModelScope.launch {
            val boardId = _uiState.value.selectedBoardId ?: return@launch

            try {
                val newTask = service.createTask(
                    boardId = boardId,
                    title = title,
                    description = description,
                    priority = priority,
                    dueDate = dueDate,
                    estimatedHours = estimatedHours,
                    tags = tags,
                )

                _uiState.update {
                    it.copy(tasks = it.tasks + newTask, error = null)
                }
            } catch (e: TaskError) {
                _uiState.update { it.copy(error = e) }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = TaskError.UnknownError) }
            }
        }
    }

    fun updateTask(
        id: String,
        title: String? = null,
        status: TaskStatus? = null,
        priority: TaskPriority? = null,
        dueDate: String? = null,
    ) {
        viewModelScope.launch {
            try {
                val updated = service.updateTask(
                    id = id,
                    title = title,
                    status = status,
                    priority = priority,
                    dueDate = dueDate,
                )

                _uiState.update { state ->
                    state.copy(
                        tasks = state.tasks.map { if (it.id == id) updated else it },
                        selectedTask = if (state.selectedTask?.id == id) updated else state.selectedTask,
                        error = null,
                    )
                }
            } catch (e: TaskError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun deleteTask(id: String) {
        viewModelScope.launch {
            try {
                service.deleteTask(id)
                _uiState.update { state ->
                    state.copy(
                        tasks = state.tasks.filter { it.id != id },
                        selectedTask = if (state.selectedTask?.id == id) null else state.selectedTask,
                        error = null,
                    )
                }
            } catch (e: TaskError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun search(query: String) {
        _uiState.update { it.copy(searchQuery = query) }

        if (query.isEmpty()) {
            _uiState.update { it.copy(searchResults = emptyList()) }
            return
        }

        viewModelScope.launch {
            try {
                val filter = TaskSearchFilter(
                    query = query,
                    boardId = _uiState.value.selectedBoardId,
                )
                val results = service.searchTasks(filter)
                _uiState.update { it.copy(searchResults = results, error = null) }
            } catch (e: TaskError) {
                _uiState.update { it.copy(error = e, searchResults = emptyList()) }
            }
        }
    }

    fun loadAnalytics(boardId: String) {
        viewModelScope.launch {
            try {
                val analytics = service.getAnalytics(boardId)
                _uiState.update { it.copy(analytics = analytics, error = null) }
            } catch (e: TaskError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun startTimeTracking(taskId: String) {
        viewModelScope.launch {
            try {
                val entry = service.startTimeEntry(taskId)
                _uiState.update {
                    it.copy(currentTimeEntry = entry, isTimeTracking = true, error = null)
                }
            } catch (e: TaskError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun stopTimeTracking(taskId: String) {
        viewModelScope.launch {
            try {
                service.stopTimeEntry(taskId)
                _uiState.update {
                    it.copy(currentTimeEntry = null, isTimeTracking = false, error = null)
                }
            } catch (e: TaskError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun loadFocusTimeSettings() {
        viewModelScope.launch {
            try {
                val settings = service.getFocusTimeSettings()
                _uiState.update { it.copy(focusTimeSettings = settings, error = null) }
            } catch (e: TaskError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun updateFocusTimeSettings(settings: FocusTime) {
        viewModelScope.launch {
            try {
                val updated = service.updateFocusTimeSettings(settings)
                _uiState.update { it.copy(focusTimeSettings = updated, error = null) }
            } catch (e: TaskError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun tasksForStatus(status: TaskStatus): List<Task> {
        return _uiState.value.tasks.filter { it.status == status }
    }

    fun overdueTasks(): List<Task> {
        return _uiState.value.tasks.filter { it.isOverdue }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun refresh(boardId: String) {
        loadTasks(boardId)
        loadAnalytics(boardId)
    }
}
