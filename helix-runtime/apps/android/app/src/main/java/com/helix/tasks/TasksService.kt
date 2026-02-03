package com.helix.tasks

import com.helix.gateway.GatewaySession
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlin.coroutines.suspendCancellableCoroutine

class TasksService(private val gateway: GatewaySession) {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    // MARK: - Task Operations

    suspend fun getTasks(
        boardId: String,
        limit: Int = 50,
        offset: Int = 0,
    ): List<Task> = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "tasks.list",
                params = mapOf(
                    "board_id" to boardId,
                    "limit" to limit,
                    "offset" to offset,
                ),
            ) { response ->
                try {
                    val tasks = (response as? JsonElement)?.jsonArray?.map {
                        json.decodeFromJsonElement(Task.serializer(), it)
                    } ?: emptyList()
                    continuation.resume(tasks)
                } catch (e: Exception) {
                    continuation.resumeWithException(TaskError.DecodingError(e.message ?: "Unknown"))
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun getTask(id: String): Task = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "tasks.get",
                params = mapOf("id" to id),
            ) { response ->
                try {
                    val task = json.decodeFromJsonElement(Task.serializer(), response as JsonElement)
                    continuation.resume(task)
                } catch (e: Exception) {
                    continuation.resumeWithException(TaskError.DecodingError(e.message ?: "Unknown"))
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun createTask(
        boardId: String,
        title: String,
        description: String? = null,
        priority: TaskPriority = TaskPriority.Medium,
        dueDate: String? = null,
        estimatedHours: Double? = null,
        tags: List<String> = emptyList(),
    ): Task = suspendCancellableCoroutine { continuation ->
        try {
            val params = mutableMapOf<String, Any>(
                "board_id" to boardId,
                "title" to title,
                "priority" to priority.toString(),
                "tags" to tags,
            )

            description?.let { params["description"] = it }
            dueDate?.let { params["due_date"] = it }
            estimatedHours?.let { params["estimated_hours"] = it }

            gateway.request(
                method = "tasks.create",
                params = params,
            ) { response ->
                try {
                    val task = json.decodeFromJsonElement(Task.serializer(), response as JsonElement)
                    continuation.resume(task)
                } catch (e: Exception) {
                    continuation.resumeWithException(TaskError.DecodingError(e.message ?: "Unknown"))
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun updateTask(
        id: String,
        title: String? = null,
        status: TaskStatus? = null,
        priority: TaskPriority? = null,
        dueDate: String? = null,
    ): Task = suspendCancellableCoroutine { continuation ->
        try {
            val params = mutableMapOf<String, Any>("id" to id)

            title?.let { params["title"] = it }
            status?.let { params["status"] = it.toString() }
            priority?.let { params["priority"] = it.toString() }
            dueDate?.let { params["due_date"] = it }

            gateway.request(
                method = "tasks.update",
                params = params,
            ) { response ->
                try {
                    val task = json.decodeFromJsonElement(Task.serializer(), response as JsonElement)
                    continuation.resume(task)
                } catch (e: Exception) {
                    continuation.resumeWithException(TaskError.DecodingError(e.message ?: "Unknown"))
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun deleteTask(id: String): Unit = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "tasks.delete",
                params = mapOf("id" to id),
            ) { _ ->
                continuation.resume(Unit)
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    // MARK: - Subtask Operations

    suspend fun getSubtasks(taskId: String): List<Subtask> =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "tasks.subtasks.list",
                    params = mapOf("task_id" to taskId),
                ) { response ->
                    try {
                        val subtasks = (response as? JsonElement)?.jsonArray?.map {
                            json.decodeFromJsonElement(Subtask.serializer(), it)
                        } ?: emptyList()
                        continuation.resume(subtasks)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            TaskError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun createSubtask(taskId: String, title: String): Subtask =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "tasks.subtasks.create",
                    params = mapOf("task_id" to taskId, "title" to title),
                ) { response ->
                    try {
                        val subtask = json.decodeFromJsonElement(
                            Subtask.serializer(),
                            response as JsonElement
                        )
                        continuation.resume(subtask)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            TaskError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun toggleSubtask(id: String, isCompleted: Boolean): Subtask =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "tasks.subtasks.toggle",
                    params = mapOf("id" to id, "is_completed" to isCompleted),
                ) { response ->
                    try {
                        val subtask = json.decodeFromJsonElement(
                            Subtask.serializer(),
                            response as JsonElement
                        )
                        continuation.resume(subtask)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            TaskError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    // MARK: - Board Operations

    suspend fun getBoards(): List<KanbanBoard> = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "tasks.boards.list",
                params = emptyMap(),
            ) { response ->
                try {
                    val boards = (response as? JsonElement)?.jsonArray?.map {
                        json.decodeFromJsonElement(KanbanBoard.serializer(), it)
                    } ?: emptyList()
                    continuation.resume(boards)
                } catch (e: Exception) {
                    continuation.resumeWithException(TaskError.DecodingError(e.message ?: "Unknown"))
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    // MARK: - Search

    suspend fun searchTasks(filter: TaskSearchFilter, limit: Int = 50): List<Task> =
        suspendCancellableCoroutine { continuation ->
            try {
                val params = mutableMapOf<String, Any>(
                    "limit" to limit,
                )

                if (filter.query.isNotEmpty()) params["query"] = filter.query
                if (filter.status.isNotEmpty()) params["status"] =
                    filter.status.map { it.toString() }
                if (filter.priority.isNotEmpty()) params["priority"] =
                    filter.priority.map { it.toString() }
                filter.assigneeId?.let { params["assignee_id"] = it }
                filter.boardId?.let { params["board_id"] = it }
                if (filter.tags.isNotEmpty()) params["tags"] = filter.tags
                filter.hasSubtasks?.let { params["has_subtasks"] = it }
                filter.isOverdue?.let { params["is_overdue"] = it }

                gateway.request(
                    method = "tasks.search",
                    params = params,
                ) { response ->
                    try {
                        val tasks = (response as? JsonElement)?.jsonArray?.map {
                            json.decodeFromJsonElement(Task.serializer(), it)
                        } ?: emptyList()
                        continuation.resume(tasks)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            TaskError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    // MARK: - Analytics

    suspend fun getAnalytics(boardId: String): TaskAnalytics =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "tasks.analytics",
                    params = mapOf("board_id" to boardId),
                ) { response ->
                    try {
                        val analytics = json.decodeFromJsonElement(
                            TaskAnalytics.serializer(),
                            response as JsonElement
                        )
                        continuation.resume(analytics)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            TaskError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    // MARK: - Time Tracking

    suspend fun startTimeEntry(taskId: String): TimeEntry =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "tasks.timetracking.start",
                    params = mapOf("task_id" to taskId),
                ) { response ->
                    try {
                        val entry = json.decodeFromJsonElement(
                            TimeEntry.serializer(),
                            response as JsonElement
                        )
                        continuation.resume(entry)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            TaskError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    suspend fun stopTimeEntry(taskId: String): TimeEntry =
        suspendCancellableCoroutine { continuation ->
            try {
                gateway.request(
                    method = "tasks.timetracking.stop",
                    params = mapOf("task_id" to taskId),
                ) { response ->
                    try {
                        val entry = json.decodeFromJsonElement(
                            TimeEntry.serializer(),
                            response as JsonElement
                        )
                        continuation.resume(entry)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            TaskError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }

    // MARK: - Focus Time

    suspend fun getFocusTimeSettings(): FocusTime = suspendCancellableCoroutine { continuation ->
        try {
            gateway.request(
                method = "tasks.focustime.get",
                params = emptyMap(),
            ) { response ->
                try {
                    val settings = json.decodeFromJsonElement(
                        FocusTime.serializer(),
                        response as JsonElement
                    )
                    continuation.resume(settings)
                } catch (e: Exception) {
                    continuation.resumeWithException(
                        TaskError.DecodingError(e.message ?: "Unknown")
                    )
                }
            }
        } catch (e: Exception) {
            continuation.resumeWithException(e)
        }
    }

    suspend fun updateFocusTimeSettings(settings: FocusTime): FocusTime =
        suspendCancellableCoroutine { continuation ->
            try {
                val params = mapOf(
                    "daily_goal_minutes" to settings.dailyGoalMinutes,
                    "start_hour" to settings.startHour,
                    "end_hour" to settings.endHour,
                    "enable_notifications" to settings.enableNotifications,
                    "blocked_apps_url_patterns" to settings.blockedAppsUrlPatterns,
                )

                gateway.request(
                    method = "tasks.focustime.update",
                    params = params,
                ) { response ->
                    try {
                        val updated = json.decodeFromJsonElement(
                            FocusTime.serializer(),
                            response as JsonElement
                        )
                        continuation.resume(updated)
                    } catch (e: Exception) {
                        continuation.resumeWithException(
                            TaskError.DecodingError(e.message ?: "Unknown")
                        )
                    }
                }
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }
}
