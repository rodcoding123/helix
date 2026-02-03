import Foundation
import SwiftUI
import Observation

@Observable final class TasksStore {
    var tasks: [Task] = []
    var boards: [KanbanBoard] = []
    var selectedBoard: KanbanBoard?
    var selectedTask: Task?

    var isLoading = false
    var error: TaskError?

    var searchQuery = ""
    var searchResults: [Task] = []

    var analytics: TaskAnalytics?

    var currentTimeEntry: TimeEntry?
    var isTimeTracking = false
    var focusTimeSettings: FocusTime?

    private let service: TasksService
    private var refreshTask: Task?

    init(service: TasksService) {
        self.service = service
    }

    // MARK: - Board Management

    func loadBoards() async {
        isLoading = true
        defer { isLoading = false }

        do {
            boards = try await service.getBoards()
            if selectedBoard == nil, let defaultBoard = boards.first(where: { $0.isDefault }) {
                selectedBoard = defaultBoard
                await loadTasks()
            } else if let board = boards.first {
                selectedBoard = board
                await loadTasks()
            }
        } catch let error as TaskError {
            self.error = error
        } catch {
            self.error = .unknownError
        }
    }

    // MARK: - Task Loading

    func loadTasks() async {
        guard let boardId = selectedBoard?.id else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            tasks = try await service.getTasks(boardId: boardId)
        } catch let error as TaskError {
            self.error = error
        } catch {
            self.error = .unknownError
        }
    }

    func selectTask(_ task: Task) {
        selectedTask = task
    }

    // MARK: - Task Operations

    func createTask(
        title: String,
        description: String? = nil,
        priority: TaskPriority = .medium,
        dueDate: Date? = nil,
        estimatedHours: Double? = nil,
        tags: [String] = []
    ) async {
        guard let boardId = selectedBoard?.id else { return }

        do {
            let newTask = try await service.createTask(
                boardId: boardId,
                title: title,
                description: description,
                priority: priority,
                dueDate: dueDate,
                estimatedHours: estimatedHours,
                tags: tags
            )

            tasks.append(newTask)
            error = nil
        } catch let error as TaskError {
            self.error = error
        } catch {
            self.error = .unknownError
        }
    }

    func updateTask(
        id: String,
        title: String? = nil,
        status: TaskStatus? = nil,
        priority: TaskPriority? = nil,
        dueDate: Date? = nil
    ) async {
        do {
            let updated = try await service.updateTask(
                id: id,
                title: title,
                status: status,
                priority: priority,
                dueDate: dueDate
            )

            if let index = tasks.firstIndex(where: { $0.id == id }) {
                tasks[index] = updated
            }

            if selectedTask?.id == id {
                selectedTask = updated
            }

            error = nil
        } catch let error as TaskError {
            self.error = error
        } catch {
            self.error = .unknownError
        }
    }

    func deleteTask(id: String) async {
        do {
            try await service.deleteTask(id: id)
            tasks.removeAll { $0.id == id }

            if selectedTask?.id == id {
                selectedTask = nil
            }

            error = nil
        } catch let error as TaskError {
            self.error = error
        } catch {
            self.error = .unknownError
        }
    }

    // MARK: - Task Filtering & Sorting

    func tasksForStatus(_ status: TaskStatus) -> [Task] {
        tasks.filter { $0.status == status }
    }

    func tasksByPriority() -> [TaskPriority: [Task]] {
        Dictionary(grouping: tasks, by: { $0.priority })
    }

    func overdueTasks() -> [Task] {
        tasks.filter { $0.isOverdue }
    }

    func dueSoonTasks(days: Int = 7) -> [Task] {
        let calendar = Calendar.current
        let futureDate = calendar.date(byAdding: .day, value: days, to: Date())!

        return tasks.filter { task in
            guard let dueDate = task.dueDate, !task.isCompleted else { return false }
            return dueDate <= futureDate
        }
    }

    // MARK: - Search

    func search(query: String) async {
        searchQuery = query

        guard !query.isEmpty else {
            searchResults = []
            return
        }

        do {
            let filter = TaskSearchFilter(
                query: query,
                status: [],
                priority: [],
                assigneeId: nil,
                boardId: selectedBoard?.id,
                tags: [],
                dueDateRange: nil,
                hasSubtasks: nil,
                isOverdue: nil
            )

            searchResults = try await service.searchTasks(filter: filter)
            error = nil
        } catch let error as TaskError {
            self.error = error
            searchResults = []
        } catch {
            self.error = .unknownError
            searchResults = []
        }
    }

    // MARK: - Analytics

    func loadAnalytics() async {
        guard let boardId = selectedBoard?.id else { return }

        do {
            analytics = try await service.getAnalytics(boardId: boardId)
            error = nil
        } catch let error as TaskError {
            self.error = error
        } catch {
            self.error = .unknownError
        }
    }

    // MARK: - Time Tracking

    func startTimeTracking(taskId: String) async {
        do {
            currentTimeEntry = try await service.startTimeEntry(taskId: taskId)
            isTimeTracking = true
            error = nil
        } catch let error as TaskError {
            self.error = error
        } catch {
            self.error = .unknownError
        }
    }

    func stopTimeTracking(taskId: String) async {
        do {
            _ = try await service.stopTimeEntry(taskId: taskId)
            currentTimeEntry = nil
            isTimeTracking = false
            error = nil
        } catch let error as TaskError {
            self.error = error
        } catch {
            self.error = .unknownError
        }
    }

    func loadTimeTrackingStats() async {
        do {
            _ = try await service.getTimeTrackingStats()
            error = nil
        } catch let error as TaskError {
            self.error = error
        } catch {
            self.error = .unknownError
        }
    }

    // MARK: - Focus Time

    func loadFocusTimeSettings() async {
        do {
            focusTimeSettings = try await service.getFocusTimeSettings()
            error = nil
        } catch let error as TaskError {
            self.error = error
        } catch {
            self.error = .unknownError
        }
    }

    func updateFocusTimeSettings(_ settings: FocusTime) async {
        do {
            focusTimeSettings = try await service.updateFocusTimeSettings(settings)
            error = nil
        } catch let error as TaskError {
            self.error = error
        } catch {
            self.error = .unknownError
        }
    }

    // MARK: - Refresh

    func refresh() async {
        await loadBoards()
        await loadAnalytics()
    }
}
