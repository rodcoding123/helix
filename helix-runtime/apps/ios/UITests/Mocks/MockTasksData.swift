import Foundation

/**
 * Mock task data for UI testing
 * Provides sample tasks for testing tasks tab functionality
 */
struct MockTasksData {
    // MARK: - Mock Task Model

    struct Task {
        let id: String
        let title: String
        let description: String
        let status: Status
        let priority: Priority
        let dueDate: Date?
        let completedDate: Date?
        let assignee: String
        let subtasks: [Subtask]
        let tags: [String]
        let estimatedHours: Double?
        let actualHours: Double?
        let attachments: [String]
        let completionPercentage: Int
    }

    enum Status: String {
        case todo = "To Do"
        case inProgress = "In Progress"
        case inReview = "In Review"
        case done = "Done"
        case blocked = "Blocked"
    }

    enum Priority: String {
        case low = "Low"
        case medium = "Medium"
        case high = "High"
        case critical = "Critical"
    }

    struct Subtask {
        let id: String
        let title: String
        let completed: Bool
    }

    // MARK: - Sample Data

    static let sampleTasks: [Task] = [
        Task(
            id: "task_001",
            title: "Complete Phase 7 Documentation",
            description: "Finish writing and updating all Phase 7 implementation documentation",
            status: .inProgress,
            priority: .high,
            dueDate: Date().addingTimeInterval(86400), // Tomorrow
            completedDate: nil,
            assignee: "Alex",
            subtasks: [
                Subtask(id: "sub_001", title: "Write UITests documentation", completed: true),
                Subtask(id: "sub_002", title: "Update README files", completed: false),
                Subtask(id: "sub_003", title: "Create test examples", completed: true),
            ],
            tags: ["documentation", "phase-7", "urgent"],
            estimatedHours: 8,
            actualHours: 5.5,
            attachments: ["phase7-spec.pdf"],
            completionPercentage: 67
        ),
        Task(
            id: "task_002",
            title: "Implement Security Audit Tests",
            description: "Create comprehensive security audit test suite for Phase 7",
            status: .todo,
            priority: .critical,
            dueDate: Date().addingTimeInterval(172800), // In 2 days
            completedDate: nil,
            assignee: "Jordan",
            subtasks: [
                Subtask(id: "sub_004", title: "Set up test infrastructure", completed: false),
                Subtask(id: "sub_005", title: "Write security tests", completed: false),
            ],
            tags: ["security", "testing", "critical"],
            estimatedHours: 16,
            actualHours: 0,
            attachments: [],
            completionPercentage: 0
        ),
        Task(
            id: "task_003",
            title: "Code Review - PR #1234",
            description: "Review and approve EmailTabUITests implementation",
            status: .inReview,
            priority: .medium,
            dueDate: Date().addingTimeInterval(259200), // In 3 days
            completedDate: nil,
            assignee: "Sarah",
            subtasks: [
                Subtask(id: "sub_006", title: "Review code quality", completed: true),
                Subtask(id: "sub_007", title: "Run tests locally", completed: true),
                Subtask(id: "sub_008", title: "Leave feedback", completed: false),
            ],
            tags: ["code-review", "quality-assurance"],
            estimatedHours: 2,
            actualHours: 1.5,
            attachments: ["review-notes.txt"],
            completionPercentage: 67
        ),
        Task(
            id: "task_004",
            title: "Update Dependencies",
            description: "Update Swift, Xcode, and all package dependencies to latest versions",
            status: .todo,
            priority: .low,
            dueDate: Date().addingTimeInterval(604800), // In 1 week
            completedDate: nil,
            assignee: "Morgan",
            subtasks: [
                Subtask(id: "sub_009", title: "Check for updates", completed: false),
                Subtask(id: "sub_010", title: "Test compatibility", completed: false),
                Subtask(id: "sub_011", title: "Merge changes", completed: false),
            ],
            tags: ["maintenance", "dependencies"],
            estimatedHours: 4,
            actualHours: 0,
            attachments: [],
            completionPercentage: 0
        ),
        Task(
            id: "task_005",
            title: "Fix: Calendar Event Sync Issues",
            description: "Investigate and fix issues with calendar events not syncing properly across devices",
            status: .blocked,
            priority: .high,
            dueDate: Date().addingTimeInterval(432000), // In 5 days
            completedDate: nil,
            assignee: "Casey",
            subtasks: [
                Subtask(id: "sub_012", title: "Reproduce issue", completed: true),
                Subtask(id: "sub_013", title: "Debug sync mechanism", completed: false),
                Subtask(id: "sub_014", title: "Implement fix", completed: false),
            ],
            tags: ["bug", "calendar", "sync"],
            estimatedHours: 6,
            actualHours: 2,
            attachments: ["issue-report.md", "logs.txt"],
            completionPercentage: 33
        ),
        Task(
            id: "task_006",
            title: "Design System Documentation",
            description: "Document all design system components and patterns",
            status: .done,
            priority: .medium,
            dueDate: Date().addingTimeInterval(-86400), // Yesterday (overdue but done)
            completedDate: Date().addingTimeInterval(-3600), // Completed 1 hour ago
            assignee: "Taylor",
            subtasks: [
                Subtask(id: "sub_015", title: "Document buttons", completed: true),
                Subtask(id: "sub_016", title: "Document forms", completed: true),
                Subtask(id: "sub_017", title: "Document layouts", completed: true),
            ],
            tags: ["design", "documentation", "completed"],
            estimatedHours: 12,
            actualHours: 11,
            attachments: ["design-system.pdf"],
            completionPercentage: 100
        ),
        Task(
            id: "task_007",
            title: "Schedule Meeting with Stakeholders",
            description: "Schedule quarterly planning meeting with all stakeholders",
            status: .todo,
            priority: .medium,
            dueDate: Date().addingTimeInterval(518400), // In 6 days
            completedDate: nil,
            assignee: "Alex",
            subtasks: [
                Subtask(id: "sub_018", title: "Check availability", completed: false),
                Subtask(id: "sub_019", title: "Send invitations", completed: false),
                Subtask(id: "sub_020", title: "Prepare agenda", completed: false),
            ],
            tags: ["meetings", "planning"],
            estimatedHours: 1,
            actualHours: 0,
            attachments: [],
            completionPercentage: 0
        ),
        Task(
            id: "task_008",
            title: "Performance Optimization Sprint",
            description: "Optimize app performance for Phase 8 release",
            status: .inProgress,
            priority: .high,
            dueDate: Date().addingTimeInterval(691200), // In 8 days
            completedDate: nil,
            assignee: "Jordan",
            subtasks: [
                Subtask(id: "sub_021", title: "Profile app performance", completed: true),
                Subtask(id: "sub_022", title: "Identify bottlenecks", completed: true),
                Subtask(id: "sub_023", title: "Implement optimizations", completed: false),
            ],
            tags: ["performance", "optimization", "phase-8"],
            estimatedHours: 20,
            actualHours: 8,
            attachments: ["performance-report.pdf"],
            completionPercentage: 40
        ),
    ]

    // MARK: - Sample Task for Creation

    static let newTask = Task(
        id: "task_new",
        title: "New Task",
        description: "Task description",
        status: .todo,
        priority: .medium,
        dueDate: Date().addingTimeInterval(86400),
        completedDate: nil,
        assignee: "Unassigned",
        subtasks: [],
        tags: [],
        estimatedHours: nil,
        actualHours: nil,
        attachments: [],
        completionPercentage: 0
    )

    // MARK: - Helper Methods

    /**
     * Returns task by ID
     * - Parameters:
     *   - id: Task identifier
     * - Returns: Task if found, nil otherwise
     */
    static func taskByID(_ id: String) -> Task? {
        return sampleTasks.first { $0.id == id }
    }

    /**
     * Returns tasks filtered by status
     * - Parameters:
     *   - status: Task status to filter by
     * - Returns: Array of tasks with specified status
     */
    static func tasksByStatus(_ status: Status) -> [Task] {
        return sampleTasks.filter { $0.status == status }
    }

    /**
     * Returns tasks filtered by priority
     * - Parameters:
     *   - priority: Task priority to filter by
     * - Returns: Array of tasks with specified priority
     */
    static func tasksByPriority(_ priority: Priority) -> [Task] {
        return sampleTasks.filter { $0.priority == priority }
    }

    /**
     * Returns completed tasks only
     * - Returns: Array of completed tasks
     */
    static func completedTasks() -> [Task] {
        return sampleTasks.filter { $0.status == .done }
    }

    /**
     * Returns active tasks (not done)
     * - Returns: Array of active tasks
     */
    static func activeTasks() -> [Task] {
        return sampleTasks.filter { $0.status != .done }
    }

    /**
     * Returns overdue tasks
     * - Returns: Array of overdue tasks
     */
    static func overdueTasks() -> [Task] {
        let now = Date()
        return sampleTasks.filter {
            if let dueDate = $0.dueDate {
                return dueDate < now && $0.status != .done
            }
            return false
        }
    }

    /**
     * Returns tasks due today
     * - Returns: Array of tasks due today
     */
    static func tasksDueToday() -> [Task] {
        let calendar = Calendar.current
        let today = calendar.dateComponents([.year, .month, .day], from: Date())

        return sampleTasks.filter {
            if let dueDate = $0.dueDate {
                let dueComponents = calendar.dateComponents([.year, .month, .day], from: dueDate)
                return dueComponents == today && $0.status != .done
            }
            return false
        }
    }

    /**
     * Returns tasks assigned to specific person
     * - Parameters:
     *   - assignee: Assignee name
     * - Returns: Array of tasks assigned to person
     */
    static func tasksAssignedTo(_ assignee: String) -> [Task] {
        return sampleTasks.filter {
            $0.assignee.lowercased() == assignee.lowercased()
        }
    }

    /**
     * Returns tasks with specific tag
     * - Parameters:
     *   - tag: Tag to filter by
     * - Returns: Array of tasks with tag
     */
    static func tasksWithTag(_ tag: String) -> [Task] {
        return sampleTasks.filter { $0.tags.contains(where: { $0.lowercased() == tag.lowercased() }) }
    }

    /**
     * Returns tasks matching search query
     * - Parameters:
     *   - query: Search text
     * - Returns: Array of matching tasks
     */
    static func searchTasks(query: String) -> [Task] {
        let lowercaseQuery = query.lowercased()
        return sampleTasks.filter {
            $0.title.lowercased().contains(lowercaseQuery) ||
            $0.description.lowercased().contains(lowercaseQuery) ||
            $0.tags.contains { $0.lowercased().contains(lowercaseQuery) }
        }
    }

    /**
     * Returns tasks sorted by due date
     * - Returns: Sorted array of tasks
     */
    static func tasksSortedByDueDate() -> [Task] {
        return sampleTasks.sorted { task1, task2 in
            guard let date1 = task1.dueDate, let date2 = task2.dueDate else {
                return task1.dueDate != nil
            }
            return date1 < date2
        }
    }

    /**
     * Returns tasks sorted by priority
     * - Returns: Sorted array of tasks (critical to low)
     */
    static func tasksSortedByPriority() -> [Task] {
        let priorityOrder: [Priority] = [.critical, .high, .medium, .low]
        return sampleTasks.sorted {
            let index1 = priorityOrder.firstIndex(of: $0.priority) ?? 0
            let index2 = priorityOrder.firstIndex(of: $1.priority) ?? 0
            return index1 < index2
        }
    }

    /**
     * Returns tasks sorted by completion percentage
     * - Returns: Sorted array of tasks (highest to lowest)
     */
    static func tasksSortedByCompletion() -> [Task] {
        return sampleTasks.sorted { $0.completionPercentage > $1.completionPercentage }
    }

    /**
     * Calculates total tasks
     * - Returns: Total count of tasks
     */
    static func totalTaskCount() -> Int {
        return sampleTasks.count
    }

    /**
     * Calculates completed tasks percentage
     * - Returns: Percentage of completed tasks
     */
    static func completionPercentage() -> Int {
        let completed = sampleTasks.filter { $0.status == .done }.count
        return (completed * 100) / sampleTasks.count
    }

    /**
     * Calculates total estimated hours
     * - Returns: Sum of all estimated hours
     */
    static func totalEstimatedHours() -> Double {
        return sampleTasks.reduce(0) { $0 + ($1.estimatedHours ?? 0) }
    }

    /**
     * Calculates total actual hours
     * - Returns: Sum of all actual hours
     */
    static func totalActualHours() -> Double {
        return sampleTasks.reduce(0) { $0 + ($1.actualHours ?? 0) }
    }
}

// MARK: - Extension for Testing

extension MockTasksData.Task: Identifiable {}
extension MockTasksData.Subtask: Identifiable {}
