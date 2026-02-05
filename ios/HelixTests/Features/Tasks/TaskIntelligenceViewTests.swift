import XCTest
@testable import Helix

@MainActor
class TaskIntelligenceViewTests: XCTestCase {

  func testTaskIntelligenceViewRendering() {
    let view = TaskIntelligenceView()
    XCTAssertNotNil(view)
  }

  func testTaskModel() {
    let task = Task(
      id: UUID(),
      title: "Complete project proposal",
      description: "Write comprehensive project proposal",
      priority: "high",
      dueDate: Date().addingTimeInterval(86400),
      estimatedHours: 4.0,
      blockingFactor: 2,
      priorityReasoning: "Deadline is tomorrow",
      dependencies: []
    )

    XCTAssertEqual(task.title, "Complete project proposal")
    XCTAssertEqual(task.priority, "high")
    XCTAssertEqual(task.estimatedHours, 4.0)
  }

  func testTaskBreakdownModel() {
    let subtask1 = Subtask(
      id: UUID(),
      title: "Research",
      description: "Gather project information",
      estimatedHours: 1.0,
      prerequisite: nil,
      hasPrerequisite: false
    )

    let subtask2 = Subtask(
      id: UUID(),
      title: "Write",
      description: "Write proposal document",
      estimatedHours: 2.0,
      prerequisite: subtask1.id,
      hasPrerequisite: true
    )

    let breakdown = TaskBreakdown(
      id: UUID(),
      originalTaskId: UUID(),
      subtasks: [subtask1, subtask2],
      totalHours: 3.0,
      confidence: 0.92,
      suggestedOrder: [subtask1.id, subtask2.id]
    )

    XCTAssertEqual(breakdown.subtasks.count, 2)
    XCTAssertEqual(breakdown.totalHours, 3.0)
    XCTAssertEqual(breakdown.confidence, 0.92)
  }

  func testSubtaskModel() {
    let subtask = Subtask(
      id: UUID(),
      title: "Design UI mockups",
      description: "Create UI mockups for new feature",
      estimatedHours: 2.5,
      prerequisite: nil,
      hasPrerequisite: false
    )

    XCTAssertEqual(subtask.title, "Design UI mockups")
    XCTAssertEqual(subtask.estimatedHours, 2.5)
    XCTAssertFalse(subtask.hasPrerequisite)
  }

  func testTaskPriorityLevels() {
    let priorities = ["critical", "high", "medium", "low"]

    for priority in priorities {
      let task = Task(
        id: UUID(),
        title: "Task",
        description: "Description",
        priority: priority,
        dueDate: nil,
        estimatedHours: nil,
        blockingFactor: nil,
        priorityReasoning: nil,
        dependencies: []
      )
      XCTAssertEqual(task.priority, priority)
    }
  }

  func testTaskWithDependencies() {
    let dep1 = UUID()
    let dep2 = UUID()

    let task = Task(
      id: UUID(),
      title: "Task",
      description: "Description",
      priority: "high",
      dueDate: nil,
      estimatedHours: 3.0,
      blockingFactor: nil,
      priorityReasoning: nil,
      dependencies: [dep1, dep2]
    )

    XCTAssertEqual(task.dependencies.count, 2)
    XCTAssertTrue(task.dependencies.contains(dep1))
    XCTAssertTrue(task.dependencies.contains(dep2))
  }

  func testSubtaskHierarchy() {
    let root = Subtask(
      id: UUID(),
      title: "Root",
      description: "Root task",
      estimatedHours: 1.0,
      prerequisite: nil,
      hasPrerequisite: false
    )

    let child = Subtask(
      id: UUID(),
      title: "Child",
      description: "Child task",
      estimatedHours: 0.5,
      prerequisite: root.id,
      hasPrerequisite: true
    )

    XCTAssertEqual(child.prerequisite, root.id)
    XCTAssertTrue(child.hasPrerequisite)
  }

  func testBreakdownOrderingSequence() {
    let ids = (0..<3).map { _ in UUID() }

    let breakdown = TaskBreakdown(
      id: UUID(),
      originalTaskId: UUID(),
      subtasks: [],
      totalHours: 5.0,
      confidence: 0.85,
      suggestedOrder: ids
    )

    XCTAssertEqual(breakdown.suggestedOrder.count, 3)
    XCTAssertEqual(breakdown.suggestedOrder[0], ids[0])
  }
}

@MainActor
class TaskIntelligenceViewModelTests: XCTestCase {
  var viewModel: TaskIntelligenceViewModel!

  override func setUp() {
    super.setUp()
    viewModel = TaskIntelligenceViewModel()
  }

  override func tearDown() {
    viewModel = nil
    super.tearDown()
  }

  func testInitialState() {
    XCTAssertEqual(viewModel.selectedTab, .prioritize)
    XCTAssertFalse(viewModel.isLoading)
    XCTAssertNil(viewModel.error)
    XCTAssertTrue(viewModel.taskOperations.isEmpty)
    XCTAssertTrue(viewModel.tasks.isEmpty)
    XCTAssertNil(viewModel.currentBreakdown)
    XCTAssertNil(viewModel.selectedTask)
  }

  func testToggleOperation() {
    viewModel.taskOperations["task-prioritize"] = true
    viewModel.taskOperations["task-breakdown"] = false

    viewModel.toggleOperation("task-prioritize")
    XCTAssertFalse(viewModel.taskOperations["task-prioritize"] ?? true)

    viewModel.toggleOperation("task-breakdown")
    XCTAssertTrue(viewModel.taskOperations["task-breakdown"] ?? false)
  }

  func testIsOperationEnabled() {
    viewModel.taskOperations["task-prioritize"] = true
    viewModel.taskOperations["task-breakdown"] = false

    XCTAssertTrue(viewModel.isOperationEnabled("task-prioritize"))
    XCTAssertFalse(viewModel.isOperationEnabled("task-breakdown"))
    XCTAssertFalse(viewModel.isOperationEnabled("nonexistent"))
  }

  func testTasksStorage() {
    let tasks = (0..<5).map { i in
      Task(
        id: UUID(),
        title: "Task \(i)",
        description: "Description \(i)",
        priority: i % 2 == 0 ? "high" : "low",
        dueDate: Date().addingTimeInterval(Double(i) * 86400),
        estimatedHours: Double(i + 1),
        blockingFactor: nil,
        priorityReasoning: nil,
        dependencies: []
      )
    }

    viewModel.tasks = tasks
    XCTAssertEqual(viewModel.tasks.count, 5)
  }

  func testFilteredTasksUnprioritized() {
    let tasks = [
      Task(id: UUID(), title: "High", description: "D", priority: "high", dueDate: nil, estimatedHours: nil, blockingFactor: nil, priorityReasoning: nil, dependencies: []),
      Task(id: UUID(), title: "Low", description: "D", priority: "low", dueDate: nil, estimatedHours: nil, blockingFactor: nil, priorityReasoning: nil, dependencies: []),
      Task(id: UUID(), title: "Empty", description: "D", priority: "", dueDate: nil, estimatedHours: nil, blockingFactor: nil, priorityReasoning: nil, dependencies: []),
    ]

    viewModel.tasks = tasks

    let unprioritized = viewModel.filteredTasks(true)
    XCTAssertEqual(unprioritized.count, 2) // low and empty
  }

  func testSelectTask() {
    let task = Task(
      id: UUID(),
      title: "Selected",
      description: "Desc",
      priority: "high",
      dueDate: nil,
      estimatedHours: nil,
      blockingFactor: nil,
      priorityReasoning: nil,
      dependencies: []
    )

    viewModel.selectTask(task)
    XCTAssertEqual(viewModel.selectedTask?.id, task.id)
    XCTAssertEqual(viewModel.selectedTask?.title, "Selected")
  }

  func testCurrentBreakdownStorage() {
    let breakdown = TaskBreakdown(
      id: UUID(),
      originalTaskId: UUID(),
      subtasks: [],
      totalHours: 5.0,
      confidence: 0.9,
      suggestedOrder: []
    )

    viewModel.currentBreakdown = breakdown
    XCTAssertEqual(viewModel.currentBreakdown?.totalHours, 5.0)
  }

  func testTabSelection() {
    viewModel.selectedTab = .prioritize
    XCTAssertEqual(viewModel.selectedTab, .prioritize)

    viewModel.selectedTab = .breakdown
    XCTAssertEqual(viewModel.selectedTab, .breakdown)
  }

  func testLoadingStateTransitions() {
    XCTAssertFalse(viewModel.isLoading)

    viewModel.isLoading = true
    XCTAssertTrue(viewModel.isLoading)

    viewModel.isLoading = false
    XCTAssertFalse(viewModel.isLoading)
  }

  func testErrorStateHandling() {
    let errorMessage = "Test error occurred"
    viewModel.error = errorMessage

    XCTAssertEqual(viewModel.error, errorMessage)

    viewModel.error = nil
    XCTAssertNil(viewModel.error)
  }

  func testMultipleTaskPrioritization() {
    let tasks = (0..<10).map { i in
      Task(
        id: UUID(),
        title: "Task \(i)",
        description: "Desc",
        priority: "low",
        dueDate: Date().addingTimeInterval(Double(i) * 86400),
        estimatedHours: Double(i + 1),
        blockingFactor: nil,
        priorityReasoning: nil,
        dependencies: []
      )
    }

    viewModel.tasks = tasks
    XCTAssertEqual(viewModel.tasks.count, 10)

    let highPriority = viewModel.tasks.filter { $0.priority == "high" }
    XCTAssertEqual(highPriority.count, 0)
  }

  func testBreakdownWithSubtasks() {
    let subtasks = (0..<3).map { i in
      Subtask(
        id: UUID(),
        title: "Subtask \(i)",
        description: "Description",
        estimatedHours: Double(i + 1),
        prerequisite: i > 0 ? UUID() : nil,
        hasPrerequisite: i > 0
      )
    }

    let breakdown = TaskBreakdown(
      id: UUID(),
      originalTaskId: UUID(),
      subtasks: subtasks,
      totalHours: 6.0,
      confidence: 0.88,
      suggestedOrder: subtasks.map { $0.id }
    )

    viewModel.currentBreakdown = breakdown
    XCTAssertEqual(viewModel.currentBreakdown?.subtasks.count, 3)
    XCTAssertEqual(viewModel.currentBreakdown?.suggestedOrder.count, 3)
  }

  func testTasksWithBlockingFactors() {
    let tasks = [
      Task(id: UUID(), title: "T1", description: "D", priority: "high", dueDate: nil, estimatedHours: 1.0, blockingFactor: 0, priorityReasoning: nil, dependencies: []),
      Task(id: UUID(), title: "T2", description: "D", priority: "high", dueDate: nil, estimatedHours: 2.0, blockingFactor: 2, priorityReasoning: nil, dependencies: []),
      Task(id: UUID(), title: "T3", description: "D", priority: "high", dueDate: nil, estimatedHours: 1.5, blockingFactor: 1, priorityReasoning: nil, dependencies: []),
    ]

    viewModel.tasks = tasks

    let blocked = viewModel.tasks.filter { $0.blockingFactor ?? 0 > 0 }
    XCTAssertEqual(blocked.count, 2)
  }

  func testSubtaskTotalHours() {
    let subtasks = [
      Subtask(id: UUID(), title: "S1", description: "D", estimatedHours: 2.5, prerequisite: nil, hasPrerequisite: false),
      Subtask(id: UUID(), title: "S2", description: "D", estimatedHours: 1.5, prerequisite: nil, hasPrerequisite: false),
      Subtask(id: UUID(), title: "S3", description: "D", estimatedHours: 2.0, prerequisite: nil, hasPrerequisite: false),
    ]

    let total = subtasks.reduce(0.0) { $0 + $1.estimatedHours }
    XCTAssertEqual(total, 6.0)
  }

  func testBreakdownConfidenceScore() {
    let high = TaskBreakdown(
      id: UUID(),
      originalTaskId: UUID(),
      subtasks: [],
      totalHours: 5.0,
      confidence: 0.95,
      suggestedOrder: []
    )

    let medium = TaskBreakdown(
      id: UUID(),
      originalTaskId: UUID(),
      subtasks: [],
      totalHours: 5.0,
      confidence: 0.75,
      suggestedOrder: []
    )

    let low = TaskBreakdown(
      id: UUID(),
      originalTaskId: UUID(),
      subtasks: [],
      totalHours: 5.0,
      confidence: 0.55,
      suggestedOrder: []
    )

    XCTAssertGreater(high.confidence, medium.confidence)
    XCTAssertGreater(medium.confidence, low.confidence)
  }

  func testTaskWithDueDateSorting() {
    let today = Date()
    let tomorrow = today.addingTimeInterval(86400)
    let nextWeek = today.addingTimeInterval(7 * 86400)

    let tasks = [
      Task(id: UUID(), title: "T1", description: "D", priority: "high", dueDate: nextWeek, estimatedHours: nil, blockingFactor: nil, priorityReasoning: nil, dependencies: []),
      Task(id: UUID(), title: "T2", description: "D", priority: "high", dueDate: today, estimatedHours: nil, blockingFactor: nil, priorityReasoning: nil, dependencies: []),
      Task(id: UUID(), title: "T3", description: "D", priority: "high", dueDate: tomorrow, estimatedHours: nil, blockingFactor: nil, priorityReasoning: nil, dependencies: []),
    ]

    let sorted = tasks.sorted { ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture) }
    XCTAssertEqual(sorted[0].title, "T2")
    XCTAssertEqual(sorted[1].title, "T3")
    XCTAssertEqual(sorted[2].title, "T1")
  }

  func testOperationLoadingSequence() {
    viewModel.taskOperations = [
      "task-prioritize": true,
      "task-breakdown": true
    ]

    let enabledCount = viewModel.taskOperations.values.filter { $0 }.count
    XCTAssertEqual(enabledCount, 2)
  }

  func testSubtaskPrerequisiteChain() {
    let id1 = UUID()
    let id2 = UUID()
    let id3 = UUID()

    let s1 = Subtask(id: id1, title: "S1", description: "D", estimatedHours: 1.0, prerequisite: nil, hasPrerequisite: false)
    let s2 = Subtask(id: id2, title: "S2", description: "D", estimatedHours: 1.0, prerequisite: id1, hasPrerequisite: true)
    let s3 = Subtask(id: id3, title: "S3", description: "D", estimatedHours: 1.0, prerequisite: id2, hasPrerequisite: true)

    XCTAssertNil(s1.prerequisite)
    XCTAssertEqual(s2.prerequisite, id1)
    XCTAssertEqual(s3.prerequisite, id2)
  }

  func testEmptyOperationsState() {
    XCTAssertTrue(viewModel.taskOperations.isEmpty)
    XCTAssertFalse(viewModel.isOperationEnabled("any-operation"))
  }

  func testErrorClearingOnNewOperation() {
    viewModel.error = "Previous error"
    XCTAssertEqual(viewModel.error, "Previous error")

    viewModel.error = nil
    XCTAssertNil(viewModel.error)
  }
}
