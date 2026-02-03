import SwiftUI

/// Main tasks tab view with kanban board
struct TasksTab: View {
    @Environment(NodeAppModel.self) private var appModel
    @State private var tasksStore: TasksStore?
    @State private var selectedViewType: TaskViewType = .kanban
    @State private var showCreateTask = false
    @State private var showSearch = false
    @State private var searchQuery = ""

    var body: some View {
        NavigationStack {
            ZStack {
                if let store = tasksStore {
                    VStack(spacing: 0) {
                        // Header
                        VStack(spacing: 12) {
                            HStack {
                                if let board = store.selectedBoard {
                                    Text(board.name)
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                } else {
                                    Text("Tasks")
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                }

                                Spacer()

                                Button(action: { showSearch = true }) {
                                    Image(systemName: "magnifyingglass")
                                        .foregroundColor(.blue)
                                }

                                Button(action: { showCreateTask = true }) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 24))
                                        .foregroundColor(.blue)
                                }
                            }
                            .padding(.horizontal, 16)

                            // View selector
                            Picker("View", selection: $selectedViewType) {
                                Text("Kanban").tag(TaskViewType.kanban)
                                Text("List").tag(TaskViewType.list)
                                Text("Time").tag(TaskViewType.timeTracking)
                            }
                            .pickerStyle(.segmented)
                            .padding(.horizontal, 16)
                        }
                        .padding(.vertical, 12)
                        .background(Color(.systemGray6))

                        // Content
                        if store.isLoading {
                            ProgressView()
                                .frame(maxHeight: .infinity)
                        } else {
                            switch selectedViewType {
                            case .kanban:
                                KanbanBoardView(store: store)

                            case .list:
                                TaskListView(store: store)

                            case .timeTracking:
                                TimeTrackerView(store: store)
                            }
                        }

                        // Analytics footer
                        if let analytics = store.analytics {
                            VStack(spacing: 12) {
                                HStack(spacing: 16) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Completion")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                        Text("\(Int(analytics.completionRate * 100))%")
                                            .font(.headline)
                                            .fontWeight(.semibold)
                                    }

                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("In Progress")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                        Text("\(analytics.inProgressTasks)")
                                            .font(.headline)
                                            .fontWeight(.semibold)
                                    }

                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Velocity")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                        Text("\(analytics.velocityThisWeek)")
                                            .font(.headline)
                                            .fontWeight(.semibold)
                                    }

                                    Spacer()

                                    if analytics.overdueTasks > 0 {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text("Overdue")
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                            Text("\(analytics.overdueTasks)")
                                                .font(.headline)
                                                .fontWeight(.semibold)
                                                .foregroundColor(.red)
                                        }
                                    }
                                }
                                .padding(.horizontal, 16)
                            }
                            .padding(.vertical, 12)
                            .background(Color(.systemGray6))
                        }
                    }
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Tasks")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showCreateTask) {
                if let store = tasksStore {
                    CreateTaskSheet(store: store, isPresented: $showCreateTask)
                }
            }
            .sheet(isPresented: $showSearch) {
                if let store = tasksStore {
                    SearchTasksSheet(store: store, isPresented: $showSearch)
                }
            }
            .alert("Error", isPresented: .constant(tasksStore?.error != nil), presenting: tasksStore?.error) { _ in
                Button("OK") {
                    tasksStore?.error = nil
                }
            } message: { error in
                Text(error.localizedDescription)
            }
        }
        .onAppear {
            if tasksStore == nil {
                let service = TasksService(gateway: appModel.gatewaySession)
                let store = TasksStore(service: service)
                tasksStore = store

                Task {
                    await store.loadBoards()
                    await store.loadAnalytics()
                    await store.loadFocusTimeSettings()
                }
            }
        }
    }
}

enum TaskViewType {
    case kanban
    case list
    case timeTracking
}

// MARK: - Kanban Board View

struct KanbanBoardView: View {
    @Bindable var store: TasksStore

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 12) {
                KanbanColumnView(
                    title: "To Do",
                    status: .todo,
                    tasks: store.tasksForStatus(.todo),
                    store: store
                )

                KanbanColumnView(
                    title: "In Progress",
                    status: .inProgress,
                    tasks: store.tasksForStatus(.inProgress),
                    store: store
                )

                KanbanColumnView(
                    title: "In Review",
                    status: .inReview,
                    tasks: store.tasksForStatus(.inReview),
                    store: store
                )

                KanbanColumnView(
                    title: "Done",
                    status: .done,
                    tasks: store.tasksForStatus(.done),
                    store: store
                )
            }
            .padding(12)
        }
    }
}

struct KanbanColumnView: View {
    let title: String
    let status: TaskStatus
    let tasks: [Task]
    @Bindable var store: TasksStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text("\(tasks.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(4)

                Spacer()
            }
            .padding(.horizontal, 8)

            VStack(spacing: 8) {
                ForEach(tasks) { task in
                    KanbanCardView(task: task, store: store)
                }
            }

            Spacer()
        }
        .frame(minWidth: 280)
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

struct KanbanCardView: View {
    let task: Task
    @Bindable var store: TasksStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(task.title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .lineLimit(2)

                    if let dueDate = task.dueDate {
                        Label(dueDateString(dueDate), systemImage: "calendar")
                            .font(.caption)
                            .foregroundColor(task.isOverdue ? .red : .secondary)
                    }
                }

                Spacer(minLength: 8)

                VStack(spacing: 4) {
                    priorityBadge
                    if task.completedSubtaskCount > 0 {
                        Text("\(task.completedSubtaskCount)/\(task.subtaskCount)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            if task.subtaskCount > 0 {
                ProgressView(value: task.progressPercentage)
                    .frame(height: 4)
            }
        }
        .padding(8)
        .background(Color.white)
        .cornerRadius(6)
        .contentShape(Rectangle())
        .onTapGesture {
            store.selectTask(task)
        }
    }

    @ViewBuilder
    private var priorityBadge: some View {
        let color: Color
        switch task.priority {
        case .low:
            color = .green
        case .medium:
            color = .blue
        case .high:
            color = .orange
        case .critical:
            color = .red
        }

        Text(task.priority.displayName)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.2))
            .foregroundColor(color)
            .cornerRadius(3)
    }

    private func dueDateString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}

// MARK: - Task List View

struct TaskListView: View {
    @Bindable var store: TasksStore

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Overdue section
                if !store.overdueTasks().isEmpty {
                    Section(header: Label("Overdue", systemImage: "exclamationmark.circle.fill")
                        .foregroundColor(.red)
                    ) {
                        VStack(spacing: 8) {
                            ForEach(store.overdueTasks()) { task in
                                TaskRowView(task: task, store: store)
                            }
                        }
                    }
                }

                // Due soon section
                let dueSoon = store.dueSoonTasks(days: 7)
                if !dueSoon.isEmpty {
                    Section(header: Label("Due Soon", systemImage: "clock.fill")
                        .foregroundColor(.orange)
                    ) {
                        VStack(spacing: 8) {
                            ForEach(dueSoon) { task in
                                TaskRowView(task: task, store: store)
                            }
                        }
                    }
                }

                // In progress section
                let inProgress = store.tasksForStatus(.inProgress)
                if !inProgress.isEmpty {
                    Section(header: Label("In Progress", systemImage: "play.circle.fill")
                        .foregroundColor(.blue)
                    ) {
                        VStack(spacing: 8) {
                            ForEach(inProgress) { task in
                                TaskRowView(task: task, store: store)
                            }
                        }
                    }
                }

                // Other tasks
                let other = store.tasksForStatus(.todo)
                if !other.isEmpty {
                    Section(header: Text("To Do")) {
                        VStack(spacing: 8) {
                            ForEach(other) { task in
                                TaskRowView(task: task, store: store)
                            }
                        }
                    }
                }

                if store.tasks.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "checkmark.circle")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)

                        Text("All Done!")
                            .font(.headline)
                            .fontWeight(.semibold)

                        Text("Create a new task to get started")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                }
            }
            .padding(12)
        }
    }
}

struct TaskRowView: View {
    let task: Task
    @Bindable var store: TasksStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(task.title)
                        .font(.subheadline)
                        .fontWeight(.semibold)

                    if let dueDate = task.dueDate {
                        Label(dueDateString(dueDate), systemImage: "calendar")
                            .font(.caption)
                            .foregroundColor(task.isOverdue ? .red : .secondary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    task.priority.priorityBadge
                    if task.completedSubtaskCount > 0 {
                        Text("\(task.completedSubtaskCount)/\(task.subtaskCount)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            if task.subtaskCount > 0 {
                ProgressView(value: task.progressPercentage)
                    .frame(height: 4)
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(8)
        .contentShape(Rectangle())
        .onTapGesture {
            store.selectTask(task)
        }
    }

    private func dueDateString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}

// MARK: - Time Tracker View

struct TimeTrackerView: View {
    @Bindable var store: TasksStore

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if store.isTimeTracking, let entry = store.currentTimeEntry {
                    VStack(spacing: 12) {
                        Text("Time Tracking Active")
                            .font(.headline)
                            .fontWeight(.semibold)

                        Text(formattedElapsedTime(entry.startedAt))
                            .font(.system(size: 36, weight: .semibold, design: .monospaced))
                            .foregroundColor(.blue)

                        Button(action: {
                            Task {
                                await store.stopTimeTracking(taskId: entry.taskId)
                            }
                        }) {
                            Text("Stop Tracking")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.red)
                                .cornerRadius(8)
                        }
                    }
                    .padding(16)
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                }

                Text("Recent Sessions")
                    .font(.headline)
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)

                VStack(spacing: 8) {
                    ForEach(store.tasks.prefix(5)) { task in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(task.title)
                                    .font(.subheadline)
                                    .fontWeight(.semibold)

                                if let hours = task.actualHours {
                                    Text("Tracked: \(String(format: "%.1f", hours))h")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }

                            Spacer()

                            Button(action: {
                                Task {
                                    await store.startTimeTracking(taskId: task.id)
                                }
                            }) {
                                Image(systemName: "play.circle.fill")
                                    .foregroundColor(.blue)
                            }
                        }
                        .padding(12)
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.vertical, 12)
        }
    }

    private func formattedElapsedTime(_ start: Date) -> String {
        let elapsed = Int(Date().timeIntervalSince(start))
        let hours = elapsed / 3600
        let minutes = (elapsed % 3600) / 60
        let seconds = elapsed % 60

        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }
}

// MARK: - Create Task Sheet

struct CreateTaskSheet: View {
    @Bindable var store: TasksStore
    @Binding var isPresented: Bool

    @State private var title = ""
    @State private var description = ""
    @State private var priority: TaskPriority = .medium
    @State private var dueDate: Date?
    @State private var estimatedHours: Double = 1.0
    @FocusState private var focusedField: Field?

    enum Field {
        case title, description
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Task Details")) {
                    TextField("Title", text: $title)
                        .focused($focusedField, equals: .title)

                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...)
                        .focused($focusedField, equals: .description)
                }

                Section(header: Text("Priority & Time")) {
                    Picker("Priority", selection: $priority) {
                        ForEach([TaskPriority.low, .medium, .high, .critical], id: \.self) { p in
                            Text(p.displayName).tag(p)
                        }
                    }

                    Stepper("Estimated Hours: \(String(format: "%.1f", estimatedHours))", value: $estimatedHours, in: 0.25...40, step: 0.25)
                }

                Section(header: Text("Due Date")) {
                    Toggle("Set Due Date", isOn: .init(
                        get: { dueDate != nil },
                        set: { if $0 { dueDate = Date() } else { dueDate = nil } }
                    ))

                    if let _ = dueDate {
                        DatePicker("Due Date", selection: Binding(
                            get: { dueDate ?? Date() },
                            set: { dueDate = $0 }
                        ), displayedComponents: .date)
                    }
                }
            }
            .navigationTitle("Create Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            await store.createTask(
                                title: title,
                                description: description.isEmpty ? nil : description,
                                priority: priority,
                                dueDate: dueDate,
                                estimatedHours: estimatedHours
                            )
                            isPresented = false
                        }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

// MARK: - Search Tasks Sheet

struct SearchTasksSheet: View {
    @Bindable var store: TasksStore
    @Binding var isPresented: Bool

    var body: some View {
        NavigationStack {
            VStack {
                SearchBar(text: $store.searchQuery, onSearch: {
                    Task {
                        await store.search(query: store.searchQuery)
                    }
                })
                .padding(12)

                if store.searchResults.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)

                        if store.searchQuery.isEmpty {
                            Text("Search your tasks")
                                .font(.headline)
                        } else {
                            Text("No results found")
                                .font(.headline)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.systemBackground))
                } else {
                    List(store.searchResults) { task in
                        TaskRowView(task: task, store: store)
                            .onTapGesture {
                                store.selectTask(task)
                                isPresented = false
                            }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Search Tasks")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { isPresented = false }
                }
            }
        }
    }
}

// MARK: - Helper Views

struct SearchBar: View {
    @Binding var text: String
    let onSearch: () -> Void

    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.gray)

            TextField("Search", text: $text)
                .onSubmit(onSearch)

            if !text.isEmpty {
                Button(action: { text = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(8)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

// MARK: - Extensions

extension TaskPriority {
    @ViewBuilder
    var priorityBadge: some View {
        let color: Color
        switch self {
        case .low:
            color = .green
        case .medium:
            color = .blue
        case .high:
            color = .orange
        case .critical:
            color = .red
        }

        Text(displayName)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.2))
            .foregroundColor(color)
            .cornerRadius(3)
    }
}

#Preview {
    TasksTab()
        .environment(NodeAppModel(gatewaySession: GatewaySession()))
}
