import Foundation

// MARK: - Task Models

struct Task: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let userId: String
    let boardId: String

    var title: String
    var description: String
    var status: TaskStatus
    var priority: TaskPriority
    var dueDate: Date?
    var completedAt: Date?

    var assigneeId: String?
    var assigneeName: String?
    var assigneeEmail: String?

    var estimatedHours: Double?
    var actualHours: Double?
    var subtaskCount: Int
    var completedSubtaskCount: Int

    var tags: [String]
    var dependsOnTaskIds: [String]
    var blocksTaskIds: [String]

    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?

    var isDeleted: Bool

    enum CodingKeys: String, CodingKey {
        case id, userId, boardId, title, description, status, priority
        case dueDate = "due_date"
        case completedAt = "completed_at"
        case assigneeId = "assignee_id"
        case assigneeName = "assignee_name"
        case assigneeEmail = "assignee_email"
        case estimatedHours = "estimated_hours"
        case actualHours = "actual_hours"
        case subtaskCount = "subtask_count"
        case completedSubtaskCount = "completed_subtask_count"
        case tags
        case dependsOnTaskIds = "depends_on_task_ids"
        case blocksTaskIds = "blocks_task_ids"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case deletedAt = "deleted_at"
        case isDeleted = "is_deleted"
    }

    var isCompleted: Bool {
        status == .done
    }

    var progressPercentage: Double {
        guard subtaskCount > 0 else { return isCompleted ? 1.0 : 0.0 }
        return Double(completedSubtaskCount) / Double(subtaskCount)
    }

    var isOverdue: Bool {
        guard let dueDate = dueDate, !isCompleted else { return false }
        return dueDate < Date()
    }
}

enum TaskStatus: String, Codable {
    case todo
    case inProgress = "in_progress"
    case inReview = "in_review"
    case done

    var displayName: String {
        switch self {
        case .todo:
            return "To Do"
        case .inProgress:
            return "In Progress"
        case .inReview:
            return "In Review"
        case .done:
            return "Done"
        }
    }
}

enum TaskPriority: String, Codable {
    case low
    case medium
    case high
    case critical

    var displayName: String {
        rawValue.capitalized
    }
}

struct Subtask: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let taskId: String

    var title: String
    var isCompleted: Bool
    var completedAt: Date?

    var createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, taskId, title
        case isCompleted = "is_completed"
        case completedAt = "completed_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Kanban Board Models

struct KanbanBoard: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let userId: String

    var name: String
    var description: String?
    var isDefault: Bool
    var columnOrder: [String] // column IDs in order

    var createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, userId, name, description
        case isDefault = "is_default"
        case columnOrder = "column_order"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct KanbanColumn: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let boardId: String

    var name: String
    var status: TaskStatus
    var position: Int
    var wipLimit: Int? // Work in progress limit

    var createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, boardId, name, status, position
        case wipLimit = "wip_limit"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Focus Time Models

struct FocusSession: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let userId: String
    let taskId: String

    var startTime: Date
    var endTime: Date?
    var isCompleted: Bool

    var durationMinutes: Int {
        let end = endTime ?? Date()
        return Int(end.timeIntervalSince(startTime) / 60)
    }
}

struct FocusTime: Codable, Equatable, Hashable {
    var dailyGoalMinutes: Int
    var startHour: Int // 0-23
    var endHour: Int // 0-23
    var enableNotifications: Bool
    var blockedAppsUrlPatterns: [String]

    enum CodingKeys: String, CodingKey {
        case dailyGoalMinutes = "daily_goal_minutes"
        case startHour = "start_hour"
        case endHour = "end_hour"
        case enableNotifications = "enable_notifications"
        case blockedAppsUrlPatterns = "blocked_apps_url_patterns"
    }
}

// MARK: - Time Tracking Models

struct TimeEntry: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let taskId: String
    let userId: String

    var description: String?
    var durationMinutes: Int
    var startedAt: Date
    var endedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, taskId, userId, description
        case durationMinutes = "duration_minutes"
        case startedAt = "started_at"
        case endedAt = "ended_at"
    }
}

struct TimeTrackingStats: Codable, Equatable, Hashable {
    var totalMinutesTracked: Int
    var totalMinutesEstimated: Int
    var tasksTracked: Int
    var averageAccuracy: Double // actual vs estimated
    var dailyTotals: [String: Int] // ISO8601 date -> minutes

    enum CodingKeys: String, CodingKey {
        case totalMinutesTracked = "total_minutes_tracked"
        case totalMinutesEstimated = "total_minutes_estimated"
        case tasksTracked = "tasks_tracked"
        case averageAccuracy = "average_accuracy"
        case dailyTotals = "daily_totals"
    }
}

// MARK: - Analytics Models

struct TaskAnalytics: Codable, Equatable, Hashable {
    var totalTasks: Int
    var completedTasks: Int
    var inProgressTasks: Int
    var overdueTasks: Int

    var averageCompletionDays: Double
    var completionRate: Double
    var velocityThisWeek: Int // tasks completed this week
    var velocityLastWeek: Int

    var priorityDistribution: [String: Int]
    var statusDistribution: [String: Int]

    enum CodingKeys: String, CodingKey {
        case totalTasks = "total_tasks"
        case completedTasks = "completed_tasks"
        case inProgressTasks = "in_progress_tasks"
        case overdueTasks = "overdue_tasks"
        case averageCompletionDays = "average_completion_days"
        case completionRate = "completion_rate"
        case velocityThisWeek = "velocity_this_week"
        case velocityLastWeek = "velocity_last_week"
        case priorityDistribution = "priority_distribution"
        case statusDistribution = "status_distribution"
    }
}

// MARK: - Search & Filter Models

struct TaskSearchFilter: Codable, Equatable, Hashable {
    var query: String
    var status: [TaskStatus]
    var priority: [TaskPriority]
    var assigneeId: String?
    var boardId: String?
    var tags: [String]
    var dueDateRange: DateRange?
    var hasSubtasks: Bool?
    var isOverdue: Bool?

    enum CodingKeys: String, CodingKey {
        case query, status, priority
        case assigneeId = "assignee_id"
        case boardId = "board_id"
        case tags
        case dueDateRange = "due_date_range"
        case hasSubtasks = "has_subtasks"
        case isOverdue = "is_overdue"
    }
}

struct DateRange: Codable, Equatable, Hashable {
    var startDate: Date
    var endDate: Date

    enum CodingKeys: String, CodingKey {
        case startDate = "start_date"
        case endDate = "end_date"
    }
}

// MARK: - Error Handling

enum TaskError: LocalizedError {
    case serviceUnavailable
    case invalidTaskData
    case taskNotFound
    case unauthorizedAccess
    case networkError(String)
    case decodingError(String)
    case unknownError

    var errorDescription: String? {
        switch self {
        case .serviceUnavailable:
            return "Task service is unavailable. Please try again later."
        case .invalidTaskData:
            return "Invalid task data provided."
        case .taskNotFound:
            return "Task not found."
        case .unauthorizedAccess:
            return "You don't have permission to access this task."
        case .networkError(let message):
            return "Network error: \(message)"
        case .decodingError(let message):
            return "Failed to decode task data: \(message)"
        case .unknownError:
            return "An unknown error occurred."
        }
    }
}
