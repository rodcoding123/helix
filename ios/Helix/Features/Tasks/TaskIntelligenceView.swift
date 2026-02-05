import SwiftUI

/// Task Intelligence Features for iOS
/// Integrates prioritization and breakdown operations into task workflow
struct TaskIntelligenceView: View {
  @StateObject private var viewModel = TaskIntelligenceViewModel()

  var body: some View {
    NavigationStack {
      VStack(spacing: 0) {
        // Header with operation toggles
        OperationHeaderView(
          operations: viewModel.taskOperations,
          onToggle: viewModel.toggleOperation
        )

        TabView(selection: $viewModel.selectedTab) {
          // Prioritization Tab
          PrioritizationTabView(viewModel: viewModel)
            .tag(TaskIntelligenceTab.prioritize)

          // Breakdown Tab
          BreakdownTabView(viewModel: viewModel)
            .tag(TaskIntelligenceTab.breakdown)
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
      }
      .navigationTitle("Task Intelligence")
      .navigationBarTitleDisplayMode(.inline)
      .onAppear {
        viewModel.loadOperations()
      }
    }
  }
}

// MARK: - Prioritization Tab
struct PrioritizationTabView: View {
  @ObservedObject var viewModel: TaskIntelligenceViewModel
  @State private var showOnlyUnprioritized = false

  var body: some View {
    VStack(spacing: 16) {
      Text("Task Prioritization")
        .font(.headline)
        .padding(.horizontal)

      // Filter Toggle
      Toggle("Show unprioritized only", isOn: $showOnlyUnprioritized)
        .padding(.horizontal)

      if viewModel.tasks.isEmpty {
        VStack(spacing: 12) {
          Image(systemName: "checkmark.circle")
            .font(.system(size: 48))
            .foregroundColor(.gray)
          Text("No tasks available")
            .font(.subheadline)
            .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
      } else {
        List(viewModel.filteredTasks(showOnlyUnprioritized), id: \.id) { task in
          TaskPrioritizationRow(task: task, onTap: {
            viewModel.selectTask(task)
          })
        }
      }

      // Prioritize Button
      Button(action: {
        viewModel.prioritizeAllTasks()
      }) {
        if viewModel.isLoading {
          ProgressView()
            .frame(maxWidth: .infinity)
        } else {
          Label("Prioritize All", systemImage: "sparkles")
            .frame(maxWidth: .infinity)
        }
      }
      .buttonStyle(.borderedProminent)
      .disabled(!viewModel.isOperationEnabled("task-prioritize"))
      .padding(.horizontal)

      if let error = viewModel.error {
        Text(error)
          .font(.caption)
          .foregroundColor(.red)
          .padding(.horizontal)
      }

      Spacer()
    }
    .padding(.vertical)
  }
}

// MARK: - Breakdown Tab
struct BreakdownTabView: View {
  @ObservedObject var viewModel: TaskIntelligenceViewModel
  @State private var selectedComplexTask: Task?
  @State private var estimatedHours = 8.0

  var body: some View {
    VStack(spacing: 16) {
      Text("Task Breakdown")
        .font(.headline)
        .padding(.horizontal)

      Form {
        Section("Task") {
          Picker("Select task to break down", selection: $selectedComplexTask) {
            Text("None").tag(Task?.none)
            ForEach(viewModel.tasks, id: \.id) { task in
              Text(task.title).tag(task as Task?)
            }
          }
        }

        Section("Complexity") {
          Stepper("Estimated hours: \(String(format: "%.1f", estimatedHours))", value: $estimatedHours, in: 0.5...80, step: 0.5)
        }
      }

      // Breakdown Results
      if let breakdown = viewModel.currentBreakdown {
        VStack(alignment: .leading, spacing: 12) {
          Text("Subtasks")
            .font(.headline)

          ForEach(breakdown.subtasks, id: \.id) { subtask in
            BreakdownSubtaskRow(subtask: subtask)
          }

          VStack(alignment: .leading, spacing: 8) {
            HStack {
              Text("Total Estimated Time")
                .font(.subheadline)
              Spacer()
              Text("\(String(format: "%.1f", breakdown.totalHours)) hours")
                .fontWeight(.semibold)
            }

            Text("Confidence: \(String(format: "%.0f", breakdown.confidence * 100))%")
              .font(.caption)
              .foregroundColor(.secondary)
          }
          .padding(12)
          .background(Color(.systemBackground))
          .cornerRadius(8)

          // Action Buttons
          HStack(spacing: 12) {
            Button(action: { viewModel.createSubtasks(breakdown) }) {
              Label("Create", systemImage: "plus.circle")
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)

            Button(action: { viewModel.currentBreakdown = nil }) {
              Label("Discard", systemImage: "xmark")
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
          }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
        .padding(.horizontal)
      } else if !viewModel.isLoading {
        VStack(spacing: 12) {
          Image(systemName: "list.bullet.indent")
            .font(.system(size: 48))
            .foregroundColor(.gray)
          Text("Select a task to break down")
            .font(.subheadline)
            .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
      }

      // Breakdown Button
      Button(action: {
        if let task = selectedComplexTask {
          viewModel.breakdownTask(task, estimatedHours: estimatedHours)
        }
      }) {
        if viewModel.isLoading {
          ProgressView()
            .frame(maxWidth: .infinity)
        } else {
          Label("Break Down", systemImage: "sparkles")
            .frame(maxWidth: .infinity)
        }
      }
      .buttonStyle(.borderedProminent)
      .disabled(
        !viewModel.isOperationEnabled("task-breakdown") ||
        selectedComplexTask == nil
      )
      .padding(.horizontal)

      if let error = viewModel.error {
        Text(error)
          .font(.caption)
          .foregroundColor(.red)
          .padding(.horizontal)
      }

      Spacer()
    }
    .padding(.vertical)
  }
}

// MARK: - Supporting Views
struct TaskPrioritizationRow: View {
  let task: Task
  let onTap: () -> Void

  var priorityColor: Color {
    switch task.priority {
    case "critical": return .red
    case "high": return .orange
    case "medium": return .yellow
    case "low": return .green
    default: return .gray
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text(task.title)
            .font(.subheadline)
            .fontWeight(.semibold)

          if let dueDate = task.dueDate {
            Text(formatted(dueDate))
              .font(.caption)
              .foregroundColor(.secondary)
          }
        }

        Spacer()

        VStack(alignment: .trailing, spacing: 4) {
          Badge(text: task.priority.uppercased(), color: priorityColor)

          if let blockedBy = task.blockingFactor {
            if blockedBy > 0 {
              Text("Blocked: \(blockedBy)")
                .font(.caption2)
                .foregroundColor(.secondary)
            }
          }
        }
      }

      if let reasoning = task.priorityReasoning {
        Text(reasoning)
          .font(.caption)
          .foregroundColor(.secondary)
          .lineLimit(2)
      }
    }
    .padding(.vertical, 8)
    .onTapGesture(perform: onTap)
  }

  private func formatted(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateStyle = .short
    return formatter.string(from: date)
  }
}

struct BreakdownSubtaskRow: View {
  let subtask: Subtask

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text(subtask.title)
            .font(.subheadline)
            .fontWeight(.semibold)

          Text(subtask.description)
            .font(.caption)
            .foregroundColor(.secondary)
            .lineLimit(2)
        }

        Spacer()

        VStack(alignment: .trailing, spacing: 4) {
          Text("\(String(format: "%.1f", subtask.estimatedHours))h")
            .font(.caption)
            .fontWeight(.semibold)

          if subtask.hasPrerequisite {
            Image(systemName: "link")
              .font(.caption)
              .foregroundColor(.secondary)
          }
        }
      }
    }
    .padding(10)
    .background(Color(.systemGray6))
    .cornerRadius(6)
  }
}

struct Badge: View {
  let text: String
  let color: Color

  var body: some View {
    Text(text)
      .font(.caption2)
      .fontWeight(.semibold)
      .foregroundColor(.white)
      .padding(.horizontal, 8)
      .padding(.vertical, 4)
      .background(color)
      .cornerRadius(4)
  }
}

struct OperationHeaderView: View {
  let operations: [String: Bool]
  let onToggle: (String) -> Void

  var body: some View {
    VStack(spacing: 0) {
      Divider()

      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 8) {
          ForEach(Array(operations.keys), id: \.self) { op in
            HStack(spacing: 4) {
              Circle()
                .fill(operations[op] ?? false ? Color.green : Color.gray)
                .frame(width: 6)

              Text(op.replacingOccurrences(of: "task-", with: ""))
                .font(.caption)
                .fontWeight(.semibold)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(.systemBackground))
            .cornerRadius(16)
            .onTapGesture {
              onToggle(op)
            }
          }
        }
        .padding(.horizontal)
      }

      Divider()
    }
    .padding(.vertical, 8)
  }
}

// MARK: - View Model
@MainActor
class TaskIntelligenceViewModel: ObservableObject {
  @Published var selectedTab: TaskIntelligenceTab = .prioritize
  @Published var isLoading = false
  @Published var error: String?
  @Published var taskOperations: [String: Bool] = [:]
  @Published var tasks: [Task] = []
  @Published var currentBreakdown: TaskBreakdown?
  @Published var selectedTask: Task?

  private let taskService = TaskIntelligenceService()

  func loadOperations() {
    Task {
      do {
        let operations = try await taskService.getOperations()
        self.taskOperations = Dictionary(
          uniqueKeysWithValues: operations.map { ($0, true) }
        )
        await loadTasks()
      } catch {
        self.error = "Failed to load operations: \(error.localizedDescription)"
      }
    }
  }

  func toggleOperation(_ operation: String) {
    taskOperations[operation]?.toggle()
  }

  func isOperationEnabled(_ operation: String) -> Bool {
    return taskOperations[operation] ?? false
  }

  private func loadTasks() async {
    do {
      let tasks = try await taskService.getTasks()
      self.tasks = tasks
    } catch {
      self.error = "Failed to load tasks: \(error.localizedDescription)"
    }
  }

  func filteredTasks(_ showOnlyUnprioritized: Bool) -> [Task] {
    if showOnlyUnprioritized {
      return tasks.filter { $0.priority == "low" || $0.priority.isEmpty }
    }
    return tasks
  }

  func selectTask(_ task: Task) {
    self.selectedTask = task
  }

  func prioritizeAllTasks() {
    isLoading = true
    error = nil

    Task {
      do {
        let prioritized = try await taskService.prioritizeTasks(tasks: tasks)
        self.tasks = prioritized
        self.isLoading = false
      } catch {
        self.error = error.localizedDescription
        self.isLoading = false
      }
    }
  }

  func breakdownTask(_ task: Task, estimatedHours: Double) {
    isLoading = true
    error = nil

    Task {
      do {
        let breakdown = try await taskService.breakdownTask(
          taskId: task.id.uuidString,
          estimatedHours: estimatedHours
        )
        self.currentBreakdown = breakdown
        self.isLoading = false
      } catch {
        self.error = error.localizedDescription
        self.isLoading = false
      }
    }
  }

  func createSubtasks(_ breakdown: TaskBreakdown) {
    Task {
      do {
        try await taskService.createSubtasks(breakdown)
        self.currentBreakdown = nil
        await loadTasks()
      } catch {
        self.error = "Failed to create subtasks: \(error.localizedDescription)"
      }
    }
  }
}

// MARK: - Models
enum TaskIntelligenceTab: Hashable {
  case prioritize
  case breakdown
}

struct Task: Identifiable, Codable {
  let id: UUID
  let title: String
  let description: String
  let priority: String // critical, high, medium, low
  let dueDate: Date?
  let estimatedHours: Double?
  let blockingFactor: Int?
  let priorityReasoning: String?
  let dependencies: [UUID]
}

struct TaskBreakdown: Identifiable, Codable {
  let id: UUID
  let originalTaskId: UUID
  let subtasks: [Subtask]
  let totalHours: Double
  let confidence: Double // 0.0-1.0
  let suggestedOrder: [UUID] // order of prerequisite completion
}

struct Subtask: Identifiable, Codable {
  let id: UUID
  let title: String
  let description: String
  let estimatedHours: Double
  let prerequisite: UUID?
  let hasPrerequisite: Bool
}

#Preview {
  TaskIntelligenceView()
}
