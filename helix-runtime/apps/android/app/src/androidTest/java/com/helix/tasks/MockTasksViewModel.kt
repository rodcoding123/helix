package com.helix.tasks

import kotlinx.coroutines.flow.StateFlow

/**
 * Mock TasksService for testing
 */
class MockTasksService : TasksService {
    private var boards = listOf<TaskBoard>()
    private var tasks = listOf<Task>()
    private var error: TasksError? = null

    fun setBoards(boards: List<TaskBoard>) {
        this.boards = boards
    }

    fun setTasks(tasks: List<Task>) {
        this.tasks = tasks
    }

    fun setError(errorMessage: String) {
        this.error = TasksError.NetworkError(errorMessage)
    }

    override suspend fun fetchBoards(): List<TaskBoard> {
        if (error != null) {
            throw error!!
        }
        return boards
    }

    override suspend fun fetchTasks(boardId: String): List<Task> {
        if (error != null) {
            throw error!!
        }
        return tasks
    }

    override suspend fun createTask(
        boardId: String,
        title: String,
        description: String?,
        priority: TaskPriority,
        dueDate: String?,
    ): Task = Task(
        id = "task_new",
        userId = "user_1",
        boardId = boardId,
        title = title,
        description = description,
        priority = priority,
        dueDate = dueDate,
        status = TaskStatus.Todo,
        createdAt = "2026-02-04T10:00:00Z",
        updatedAt = "2026-02-04T10:00:00Z",
    )

    override suspend fun deleteTask(taskId: String) {}

    override suspend fun updateTask(
        taskId: String,
        title: String?,
        description: String?,
        status: TaskStatus?,
        priority: TaskPriority?,
        dueDate: String?,
    ): Task = Task(
        id = taskId,
        userId = "user_1",
        boardId = "board_1",
        title = title ?: "Task",
        description = description,
        status = status ?: TaskStatus.Todo,
        priority = priority ?: TaskPriority.Medium,
        dueDate = dueDate,
        createdAt = "2026-02-04T10:00:00Z",
        updatedAt = "2026-02-04T10:00:00Z",
    )

    override suspend fun completeTask(taskId: String): Task = Task(
        id = taskId,
        userId = "user_1",
        boardId = "board_1",
        title = "Task",
        status = TaskStatus.Done,
        createdAt = "2026-02-04T10:00:00Z",
        updatedAt = "2026-02-04T10:00:00Z",
        completedAt = "2026-02-04T10:00:00Z",
    )

    override suspend fun startTimeTracking(taskId: String): TimeEntry = TimeEntry(
        id = "entry_1",
        taskId = taskId,
        startTime = "2026-02-04T10:00:00Z",
        endTime = null,
        durationMinutes = 0,
    )

    override suspend fun stopTimeTracking(entryId: String): TimeEntry = TimeEntry(
        id = entryId,
        taskId = "task_1",
        startTime = "2026-02-04T10:00:00Z",
        endTime = "2026-02-04T11:00:00Z",
        durationMinutes = 60,
    )

    override suspend fun getAnalytics(boardId: String): TaskAnalytics = TaskAnalytics(
        completedTasks = 15,
        inProgressTasks = 8,
        totalTasks = 30,
        completionRate = 0.5,
    )
}

/**
 * Interface for TasksService dependency injection
 */
interface TasksService {
    suspend fun fetchBoards(): List<TaskBoard>
    suspend fun fetchTasks(boardId: String): List<Task>
    suspend fun createTask(
        boardId: String,
        title: String,
        description: String? = null,
        priority: TaskPriority = TaskPriority.Medium,
        dueDate: String? = null,
    ): Task

    suspend fun deleteTask(taskId: String)

    suspend fun updateTask(
        taskId: String,
        title: String? = null,
        description: String? = null,
        status: TaskStatus? = null,
        priority: TaskPriority? = null,
        dueDate: String? = null,
    ): Task

    suspend fun completeTask(taskId: String): Task

    suspend fun startTimeTracking(taskId: String): TimeEntry

    suspend fun stopTimeTracking(entryId: String): TimeEntry

    suspend fun getAnalytics(boardId: String): TaskAnalytics
}

/**
 * Mock TasksViewModel for UI testing
 */
class MockTasksViewModel(
    private val mockService: MockTasksService = MockTasksService(),
) : TasksViewModel(mockService) {

    private val testBoard = TaskBoard(
        id = "board_1",
        userId = "user_1",
        name = "My Tasks",
        description = "Personal task board",
        createdAt = "2026-01-01T00:00:00Z",
        updatedAt = "2026-01-01T00:00:00Z",
    )

    private val testTasks = listOf(
        Task(
            id = "task_1",
            userId = "user_1",
            boardId = "board_1",
            title = "Complete project report",
            description = "Finish quarterly report",
            priority = TaskPriority.High,
            status = TaskStatus.InProgress,
            dueDate = "2026-02-06",
            subtaskCount = 3,
            completedSubtaskCount = 1,
            createdAt = "2026-02-01T00:00:00Z",
            updatedAt = "2026-02-01T00:00:00Z",
        ),
        Task(
            id = "task_2",
            userId = "user_1",
            boardId = "board_1",
            title = "Review pull requests",
            description = "Review pending PRs",
            priority = TaskPriority.Medium,
            status = TaskStatus.Todo,
            dueDate = "2026-02-05",
            createdAt = "2026-02-02T00:00:00Z",
            updatedAt = "2026-02-02T00:00:00Z",
        ),
        Task(
            id = "task_3",
            userId = "user_1",
            boardId = "board_1",
            title = "Update documentation",
            description = "Update API docs",
            priority = TaskPriority.Low,
            status = TaskStatus.Done,
            dueDate = "2026-02-03",
            completedAt = "2026-02-03T15:00:00Z",
            createdAt = "2026-02-01T00:00:00Z",
            updatedAt = "2026-02-03T15:00:00Z",
        ),
    )

    init {
        mockService.setBoards(listOf(testBoard))
        mockService.setTasks(testTasks)
        loadBoards()
    }

    fun setError(errorMessage: String) {
        mockService.setError(errorMessage)
    }

    fun setTasks(tasks: List<Task>) {
        mockService.setTasks(tasks)
    }
}
