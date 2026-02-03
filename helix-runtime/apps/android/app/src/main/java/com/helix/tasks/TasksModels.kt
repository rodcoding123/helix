package com.helix.tasks

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// MARK: - Task Models

@Serializable
data class Task(
    val id: String,
    @SerialName("user_id")
    val userId: String,
    @SerialName("board_id")
    val boardId: String,
    val title: String,
    val description: String? = null,
    val status: TaskStatus = TaskStatus.Todo,
    val priority: TaskPriority = TaskPriority.Medium,
    @SerialName("due_date")
    val dueDate: String? = null,
    @SerialName("completed_at")
    val completedAt: String? = null,
    @SerialName("assignee_id")
    val assigneeId: String? = null,
    @SerialName("assignee_name")
    val assigneeName: String? = null,
    @SerialName("assignee_email")
    val assigneeEmail: String? = null,
    @SerialName("estimated_hours")
    val estimatedHours: Double? = null,
    @SerialName("actual_hours")
    val actualHours: Double? = null,
    @SerialName("subtask_count")
    val subtaskCount: Int = 0,
    @SerialName("completed_subtask_count")
    val completedSubtaskCount: Int = 0,
    val tags: List<String> = emptyList(),
    @SerialName("depends_on_task_ids")
    val dependsOnTaskIds: List<String> = emptyList(),
    @SerialName("blocks_task_ids")
    val blocksTaskIds: List<String> = emptyList(),
    @SerialName("created_at")
    val createdAt: String,
    @SerialName("updated_at")
    val updatedAt: String,
    @SerialName("deleted_at")
    val deletedAt: String? = null,
    @SerialName("is_deleted")
    val isDeleted: Boolean = false,
) {
    val isCompleted: Boolean
        get() = status == TaskStatus.Done

    val progressPercentage: Double
        get() = if (subtaskCount > 0) completedSubtaskCount.toDouble() / subtaskCount else if (isCompleted) 1.0 else 0.0

    val isOverdue: Boolean
        get() = dueDate != null && !isCompleted && dueDate < System.currentTimeMillis().toString()
}

@Serializable
enum class TaskStatus {
    @SerialName("todo")
    Todo,

    @SerialName("in_progress")
    InProgress,

    @SerialName("in_review")
    InReview,

    @SerialName("done")
    Done,
}

@Serializable
enum class TaskPriority {
    @SerialName("low")
    Low,

    @SerialName("medium")
    Medium,

    @SerialName("high")
    High,

    @SerialName("critical")
    Critical,
}

@Serializable
data class Subtask(
    val id: String,
    @SerialName("task_id")
    val taskId: String,
    val title: String,
    @SerialName("is_completed")
    val isCompleted: Boolean = false,
    @SerialName("completed_at")
    val completedAt: String? = null,
    @SerialName("created_at")
    val createdAt: String,
    @SerialName("updated_at")
    val updatedAt: String,
)

// MARK: - Kanban Board Models

@Serializable
data class KanbanBoard(
    val id: String,
    @SerialName("user_id")
    val userId: String,
    val name: String,
    val description: String? = null,
    @SerialName("is_default")
    val isDefault: Boolean = false,
    @SerialName("column_order")
    val columnOrder: List<String> = emptyList(),
    @SerialName("created_at")
    val createdAt: String,
    @SerialName("updated_at")
    val updatedAt: String,
)

// MARK: - Focus Time Models

@Serializable
data class FocusTime(
    @SerialName("daily_goal_minutes")
    val dailyGoalMinutes: Int = 60,
    @SerialName("start_hour")
    val startHour: Int = 9,
    @SerialName("end_hour")
    val endHour: Int = 17,
    @SerialName("enable_notifications")
    val enableNotifications: Boolean = true,
    @SerialName("blocked_apps_url_patterns")
    val blockedAppsUrlPatterns: List<String> = emptyList(),
)

// MARK: - Time Tracking Models

@Serializable
data class TimeEntry(
    val id: String,
    @SerialName("task_id")
    val taskId: String,
    @SerialName("user_id")
    val userId: String,
    val description: String? = null,
    @SerialName("duration_minutes")
    val durationMinutes: Int,
    @SerialName("started_at")
    val startedAt: String,
    @SerialName("ended_at")
    val endedAt: String,
)

// MARK: - Analytics Models

@Serializable
data class TaskAnalytics(
    @SerialName("total_tasks")
    val totalTasks: Int,
    @SerialName("completed_tasks")
    val completedTasks: Int,
    @SerialName("in_progress_tasks")
    val inProgressTasks: Int,
    @SerialName("overdue_tasks")
    val overdueTasks: Int,
    @SerialName("average_completion_days")
    val averageCompletionDays: Double,
    @SerialName("completion_rate")
    val completionRate: Double,
    @SerialName("velocity_this_week")
    val velocityThisWeek: Int,
    @SerialName("velocity_last_week")
    val velocityLastWeek: Int,
    @SerialName("priority_distribution")
    val priorityDistribution: Map<String, Int> = emptyMap(),
    @SerialName("status_distribution")
    val statusDistribution: Map<String, Int> = emptyMap(),
)

// MARK: - Search Filter Models

@Serializable
data class TaskSearchFilter(
    val query: String = "",
    val status: List<TaskStatus> = emptyList(),
    val priority: List<TaskPriority> = emptyList(),
    @SerialName("assignee_id")
    val assigneeId: String? = null,
    @SerialName("board_id")
    val boardId: String? = null,
    val tags: List<String> = emptyList(),
    @SerialName("has_subtasks")
    val hasSubtasks: Boolean? = null,
    @SerialName("is_overdue")
    val isOverdue: Boolean? = null,
)

// MARK: - Error Handling

sealed class TaskError : Exception() {
    object ServiceUnavailable : TaskError()
    object InvalidTaskData : TaskError()
    object TaskNotFound : TaskError()
    object UnauthorizedAccess : TaskError()
    data class NetworkError(val message: String) : TaskError()
    data class DecodingError(val message: String) : TaskError()
    object UnknownError : TaskError()

    val localizedMessage: String
        get() = when (this) {
            ServiceUnavailable -> "Task service is unavailable. Please try again later."
            InvalidTaskData -> "Invalid task data provided."
            TaskNotFound -> "Task not found."
            UnauthorizedAccess -> "You don't have permission to access this task."
            is NetworkError -> "Network error: ${this.message}"
            is DecodingError -> "Failed to decode task data: ${this.message}"
            UnknownError -> "An unknown error occurred."
        }
}
