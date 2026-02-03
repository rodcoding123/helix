import Foundation

class TasksService {
    private let gateway: GatewaySession

    init(gateway: GatewaySession) {
        self.gateway = gateway
    }

    // MARK: - Task Operations

    func getTasks(
        boardId: String,
        status: [TaskStatus]? = nil,
        limit: Int = 50,
        offset: Int = 0
    ) async throws -> [Task] {
        var params: [String: Any] = [
            "board_id": boardId,
            "limit": limit,
            "offset": offset,
        ]

        if let status = status {
            params["status"] = status.map { $0.rawValue }
        }

        let response = try await gateway.request("tasks.list", params: params)
        guard let data = response as? [[String: Any]] else {
            throw TaskError.decodingError("Expected array of tasks")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode([Task].self, from: jsonData)
    }

    func getTask(id: String) async throws -> Task {
        let response = try await gateway.request("tasks.get", params: ["id": id])
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected task object")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(Task.self, from: jsonData)
    }

    func createTask(
        boardId: String,
        title: String,
        description: String? = nil,
        priority: TaskPriority = .medium,
        dueDate: Date? = nil,
        estimatedHours: Double? = nil,
        tags: [String] = []
    ) async throws -> Task {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        var params: [String: Any] = [
            "board_id": boardId,
            "title": title,
            "priority": priority.rawValue,
            "tags": tags,
        ]

        if let description = description {
            params["description"] = description
        }
        if let dueDate = dueDate {
            params["due_date"] = ISO8601DateFormatter().string(from: dueDate)
        }
        if let estimatedHours = estimatedHours {
            params["estimated_hours"] = estimatedHours
        }

        let response = try await gateway.request("tasks.create", params: params)
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected task object")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(Task.self, from: jsonData)
    }

    func updateTask(
        id: String,
        title: String? = nil,
        description: String? = nil,
        status: TaskStatus? = nil,
        priority: TaskPriority? = nil,
        dueDate: Date? = nil,
        estimatedHours: Double? = nil,
        tags: [String]? = nil
    ) async throws -> Task {
        var params: [String: Any] = ["id": id]

        if let title = title { params["title"] = title }
        if let description = description { params["description"] = description }
        if let status = status { params["status"] = status.rawValue }
        if let priority = priority { params["priority"] = priority.rawValue }
        if let dueDate = dueDate {
            params["due_date"] = ISO8601DateFormatter().string(from: dueDate)
        }
        if let estimatedHours = estimatedHours { params["estimated_hours"] = estimatedHours }
        if let tags = tags { params["tags"] = tags }

        let response = try await gateway.request("tasks.update", params: params)
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected task object")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(Task.self, from: jsonData)
    }

    func deleteTask(id: String) async throws {
        _ = try await gateway.request("tasks.delete", params: ["id": id])
    }

    // MARK: - Subtask Operations

    func getSubtasks(taskId: String) async throws -> [Subtask] {
        let response = try await gateway.request("tasks.subtasks.list", params: ["task_id": taskId])
        guard let data = response as? [[String: Any]] else {
            throw TaskError.decodingError("Expected array of subtasks")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode([Subtask].self, from: jsonData)
    }

    func createSubtask(taskId: String, title: String) async throws -> Subtask {
        let response = try await gateway.request(
            "tasks.subtasks.create",
            params: ["task_id": taskId, "title": title]
        )
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected subtask object")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(Subtask.self, from: jsonData)
    }

    func toggleSubtask(id: String, isCompleted: Bool) async throws -> Subtask {
        let response = try await gateway.request(
            "tasks.subtasks.toggle",
            params: ["id": id, "is_completed": isCompleted]
        )
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected subtask object")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(Subtask.self, from: jsonData)
    }

    // MARK: - Board Operations

    func getBoards() async throws -> [KanbanBoard] {
        let response = try await gateway.request("tasks.boards.list", params: [:])
        guard let data = response as? [[String: Any]] else {
            throw TaskError.decodingError("Expected array of boards")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode([KanbanBoard].self, from: jsonData)
    }

    func getBoard(id: String) async throws -> KanbanBoard {
        let response = try await gateway.request("tasks.boards.get", params: ["id": id])
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected board object")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(KanbanBoard.self, from: jsonData)
    }

    // MARK: - Search

    func searchTasks(filter: TaskSearchFilter, limit: Int = 50) async throws -> [Task] {
        var params: [String: Any] = ["limit": limit]

        if !filter.query.isEmpty { params["query"] = filter.query }
        if !filter.status.isEmpty { params["status"] = filter.status.map { $0.rawValue } }
        if !filter.priority.isEmpty { params["priority"] = filter.priority.map { $0.rawValue } }
        if let assigneeId = filter.assigneeId { params["assignee_id"] = assigneeId }
        if let boardId = filter.boardId { params["board_id"] = boardId }
        if !filter.tags.isEmpty { params["tags"] = filter.tags }
        if let hasSubtasks = filter.hasSubtasks { params["has_subtasks"] = hasSubtasks }
        if let isOverdue = filter.isOverdue { params["is_overdue"] = isOverdue }

        let response = try await gateway.request("tasks.search", params: params)
        guard let data = response as? [[String: Any]] else {
            throw TaskError.decodingError("Expected array of tasks")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode([Task].self, from: jsonData)
    }

    // MARK: - Analytics

    func getAnalytics(boardId: String) async throws -> TaskAnalytics {
        let response = try await gateway.request("tasks.analytics", params: ["board_id": boardId])
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected analytics object")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(TaskAnalytics.self, from: jsonData)
    }

    // MARK: - Time Tracking

    func startTimeEntry(taskId: String) async throws -> TimeEntry {
        let response = try await gateway.request(
            "tasks.timetracking.start",
            params: ["task_id": taskId]
        )
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected time entry object")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(TimeEntry.self, from: jsonData)
    }

    func stopTimeEntry(taskId: String) async throws -> TimeEntry {
        let response = try await gateway.request(
            "tasks.timetracking.stop",
            params: ["task_id": taskId]
        )
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected time entry object")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(TimeEntry.self, from: jsonData)
    }

    func getTimeTrackingStats() async throws -> TimeTrackingStats {
        let response = try await gateway.request("tasks.timetracking.stats", params: [:])
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected stats object")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(TimeTrackingStats.self, from: jsonData)
    }

    // MARK: - Focus Time

    func getFocusTimeSettings() async throws -> FocusTime {
        let response = try await gateway.request("tasks.focustime.get", params: [:])
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected focus time object")
        }

        let decoder = JSONDecoder()
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(FocusTime.self, from: jsonData)
    }

    func updateFocusTimeSettings(_ settings: FocusTime) async throws -> FocusTime {
        let encoder = JSONEncoder()
        let jsonData = try encoder.encode(settings)
        guard let params = try JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
            throw TaskError.invalidTaskData
        }

        let response = try await gateway.request("tasks.focustime.update", params: params)
        guard let data = response as? [String: Any] else {
            throw TaskError.decodingError("Expected focus time object")
        }

        let decoder = JSONDecoder()
        let jsonData2 = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(FocusTime.self, from: jsonData2)
    }
}
