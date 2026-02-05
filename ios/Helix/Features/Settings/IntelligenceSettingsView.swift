/**
 * Intelligence Settings View - Phase 8 iOS
 * Configure AI operations, model selection, and budget limits
 * SwiftUI implementation for iOS 14+ with real API integration
 */

import SwiftUI

// MARK: - UI Models

struct AIOperation: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    let primaryModel: String
    let fallbackModel: String?
    let costCriticality: String
    let estimatedCostUsd: Double
    var enabled: Bool
}

struct BudgetSettings: Codable {
    var dailyLimitUsd: Double = 50.0
    var monthlyLimitUsd: Double = 1000.0
    var warningThreshold: Int = 80
}

struct UsageStats: Codable {
    var dailyUsd: Double = 0.0
    var monthlyUsd: Double = 0.0
    var dailyOperations: Int = 0
    var monthlyOperations: Int = 0
    var budgetStatus: String = "normal"
}

// MARK: - View Model

@MainActor
class IntelligenceSettingsViewModel: ObservableObject {
    @Published var operations: [AIOperation] = []
    @Published var budgetSettings = BudgetSettings()
    @Published var usageStats = UsageStats()
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var lastSaved: Date? = nil
    @Published var errorMessage: String? = nil
    @Published var showError = false

    private let service = IntelligenceSettingsService.shared

    func loadSettings() async {
        isLoading = true
        errorMessage = nil

        let result = await service.fetchSettings()

        switch result {
        case .success(let data):
            operations = data.operations.map { op in
                AIOperation(
                    id: op.operation_id,
                    name: op.operation_name,
                    description: op.description ?? "",
                    primaryModel: op.primary_model,
                    fallbackModel: op.fallback_model,
                    costCriticality: op.cost_criticality,
                    estimatedCostUsd: op.estimated_cost_usd,
                    enabled: op.enabled
                )
            }

            budgetSettings = BudgetSettings(
                dailyLimitUsd: data.budget.daily_limit_usd,
                monthlyLimitUsd: data.budget.monthly_limit_usd,
                warningThreshold: data.budget.warning_threshold
            )

            usageStats = UsageStats(
                dailyUsd: data.usage.daily_usd,
                monthlyUsd: data.usage.monthly_usd,
                dailyOperations: data.usage.daily_operations,
                monthlyOperations: data.usage.monthly_operations,
                budgetStatus: data.usage.budget_status
            )

        case .error(let message, _):
            errorMessage = message
            showError = true
            loadDemoData()
        }

        isLoading = false
    }

    private func loadDemoData() {
        operations = [
            AIOperation(
                id: "email-compose",
                name: "Email Compose",
                description: "AI-powered email composition with context awareness",
                primaryModel: "deepseek-v3.2",
                fallbackModel: "gemini-2.0-flash",
                costCriticality: "LOW",
                estimatedCostUsd: 0.0015,
                enabled: true
            ),
            AIOperation(
                id: "email-classify",
                name: "Email Classification",
                description: "Automatic email categorization and priority detection",
                primaryModel: "deepseek-v3.2",
                fallbackModel: "gemini-2.0-flash",
                costCriticality: "LOW",
                estimatedCostUsd: 0.0006,
                enabled: true
            ),
            AIOperation(
                id: "calendar-suggest",
                name: "Calendar Suggestions",
                description: "Smart meeting time suggestions based on availability",
                primaryModel: "deepseek-v3.2",
                fallbackModel: "gemini-2.0-flash",
                costCriticality: "MEDIUM",
                estimatedCostUsd: 0.0012,
                enabled: true
            ),
            AIOperation(
                id: "task-prioritize",
                name: "Task Prioritization",
                description: "Intelligent task ordering based on deadlines and importance",
                primaryModel: "deepseek-v3.2",
                fallbackModel: "gemini-2.0-flash",
                costCriticality: "LOW",
                estimatedCostUsd: 0.0008,
                enabled: true
            )
        ]
        budgetSettings = BudgetSettings()
        usageStats = UsageStats(
            dailyUsd: 2.50,
            monthlyUsd: 45.00,
            dailyOperations: 150,
            monthlyOperations: 3200
        )
    }

    func saveSettings() async {
        isSaving = true
        errorMessage = nil

        let operationsToSave = operations.map { op in
            OperationSettingSaveRequest(
                operation_id: op.id,
                enabled: op.enabled
            )
        }

        let budgetToSave = BudgetSettingSaveRequest(
            daily_limit_usd: budgetSettings.dailyLimitUsd,
            monthly_limit_usd: budgetSettings.monthlyLimitUsd,
            warning_threshold: budgetSettings.warningThreshold
        )

        let result = await service.saveSettings(
            operations: operationsToSave,
            budget: budgetToSave
        )

        switch result {
        case .success:
            lastSaved = Date()
        case .error(let message, _):
            errorMessage = "Failed to save: \(message)"
            showError = true
        }

        isSaving = false
    }

    func toggleOperation(_ operationId: String) {
        if let index = operations.firstIndex(where: { $0.id == operationId }) {
            operations[index].enabled.toggle()
        }
    }
}

// MARK: - Main View

struct IntelligenceSettingsView: View {
    @StateObject private var viewModel = IntelligenceSettingsViewModel()
    @State private var selectedTab: Tab = .operations

    enum Tab {
        case operations
        case budget
        case models
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 8) {
                Text("Intelligence Settings")
                    .font(.title2)
                    .fontWeight(.bold)
                Text("Configure AI operations, models, and budget limits")
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .borderBottom()

            // Loading indicator
            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
            }

            // Tab selector
            Picker("Settings Tab", selection: $selectedTab) {
                Text("Operations").tag(Tab.operations)
                Text("Budget").tag(Tab.budget)
                Text("Models").tag(Tab.models)
            }
            .pickerStyle(.segmented)
            .padding()

            // Content
            switch selectedTab {
            case .operations:
                OperationsTabView(viewModel: viewModel)
            case .budget:
                BudgetTabView(viewModel: viewModel)
            case .models:
                ModelsTabView()
            }

            Spacer()

            // Footer
            VStack(spacing: 12) {
                if let lastSaved = viewModel.lastSaved {
                    Text("Last saved: \(lastSaved.formatted(date: .omitted, time: .standard))")
                        .font(.caption)
                        .foregroundColor(.gray)
                }

                HStack(spacing: 12) {
                    Button(action: {
                        Task { await viewModel.loadSettings() }
                    }) {
                        Text("Reset")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .foregroundColor(.primary)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke())
                    }
                    .disabled(viewModel.isLoading)

                    Button(action: {
                        Task { await viewModel.saveSettings() }
                    }) {
                        HStack {
                            if viewModel.isSaving {
                                ProgressView()
                                    .scaleEffect(0.8, anchor: .center)
                            }
                            Text(viewModel.isSaving ? "Saving..." : "Save Settings")
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundColor(.white)
                        .background(viewModel.isSaving || viewModel.isLoading ? Color.blue.opacity(0.5) : Color.blue)
                        .cornerRadius(8)
                    }
                    .disabled(viewModel.isSaving || viewModel.isLoading)
                }
            }
            .padding()
            .borderTop()
        }
        .task {
            await viewModel.loadSettings()
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK") {
                viewModel.showError = false
            }
        } message: {
            Text(viewModel.errorMessage ?? "An error occurred")
        }
    }
}

// MARK: - Operations Tab

struct OperationsTabView: View {
    @ObservedObject var viewModel: IntelligenceSettingsViewModel

    var emailOps: [AIOperation] { viewModel.operations.filter { $0.id.contains("email") } }
    var calendarOps: [AIOperation] { viewModel.operations.filter { $0.id.contains("calendar") } }
    var taskOps: [AIOperation] { viewModel.operations.filter { $0.id.contains("task") } }
    var analyticsOps: [AIOperation] { viewModel.operations.filter { $0.id.contains("analytics") } }

    var otherOps: [AIOperation] {
        let categorizedIds = Set(emailOps.map(\.id) + calendarOps.map(\.id) + taskOps.map(\.id) + analyticsOps.map(\.id))
        return viewModel.operations.filter { !categorizedIds.contains($0.id) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if !emailOps.isEmpty {
                    OperationSection(title: "Email Intelligence", operations: emailOps, viewModel: viewModel)
                }
                if !calendarOps.isEmpty {
                    OperationSection(title: "Calendar Intelligence", operations: calendarOps, viewModel: viewModel)
                }
                if !taskOps.isEmpty {
                    OperationSection(title: "Task Intelligence", operations: taskOps, viewModel: viewModel)
                }
                if !analyticsOps.isEmpty {
                    OperationSection(title: "Analytics Intelligence", operations: analyticsOps, viewModel: viewModel)
                }
                if !otherOps.isEmpty {
                    OperationSection(title: "Other Operations", operations: otherOps, viewModel: viewModel)
                }
            }
            .padding()
        }
    }
}

struct OperationSection: View {
    let title: String
    let operations: [AIOperation]
    @ObservedObject var viewModel: IntelligenceSettingsViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .foregroundColor(.primary)

            ForEach(operations) { op in
                OperationRow(operation: op, viewModel: viewModel)
            }
        }
    }
}

struct OperationRow: View {
    let operation: AIOperation
    @ObservedObject var viewModel: IntelligenceSettingsViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Toggle("", isOn: Binding(
                    get: { operation.enabled },
                    set: { _ in viewModel.toggleOperation(operation.id) }
                ))
                .labelsHidden()

                VStack(alignment: .leading, spacing: 4) {
                    Text(operation.name)
                        .font(.headline)
                        .foregroundColor(.primary)
                    Text(operation.description)
                        .font(.caption)
                        .foregroundColor(.gray)
                        .lineLimit(2)
                }
                Spacer()
            }

            HStack(spacing: 16) {
                Label("$\(String(format: "%.4f", operation.estimatedCostUsd))",
                      systemImage: "dollarsign.circle.fill")
                    .font(.caption)
                    .foregroundColor(.gray)

                Label(operation.costCriticality,
                      systemImage: criticityIcon(operation.costCriticality))
                    .font(.caption)
                    .foregroundColor(criticityColor(operation.costCriticality))
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }

    private func criticityIcon(_ criticality: String) -> String {
        switch criticality {
        case "HIGH": return "exclamationmark.circle.fill"
        case "MEDIUM": return "info.circle.fill"
        case "LOW": return "checkmark.circle.fill"
        default: return "circle.fill"
        }
    }

    private func criticityColor(_ criticality: String) -> Color {
        switch criticality {
        case "HIGH": return .red
        case "MEDIUM": return .orange
        case "LOW": return .green
        default: return .gray
        }
    }
}

// MARK: - Budget Tab

struct BudgetTabView: View {
    @ObservedObject var viewModel: IntelligenceSettingsViewModel

    var monthlyProgress: Double {
        guard viewModel.budgetSettings.monthlyLimitUsd > 0 else { return 0 }
        return min(viewModel.usageStats.monthlyUsd / viewModel.budgetSettings.monthlyLimitUsd, 1.0)
    }

    var progressColor: Color {
        let threshold = Double(viewModel.budgetSettings.warningThreshold) / 100.0
        if monthlyProgress > 0.9 { return .red }
        if monthlyProgress > threshold { return .orange }
        return .blue
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Daily Budget Limit")
                            .font(.headline)
                        HStack {
                            Text("$")
                                .foregroundColor(.gray)
                            TextField("Amount", value: $viewModel.budgetSettings.dailyLimitUsd, format: .number)
                                .textFieldStyle(.roundedBorder)
                                .keyboardType(.decimalPad)
                        }
                        Text("Default: $50.00/day")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Monthly Budget Limit")
                            .font(.headline)
                        HStack {
                            Text("$")
                                .foregroundColor(.gray)
                            TextField("Amount", value: $viewModel.budgetSettings.monthlyLimitUsd, format: .number)
                                .textFieldStyle(.roundedBorder)
                                .keyboardType(.decimalPad)
                        }
                        Text("Default: $1,000.00/month")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Warning Threshold: \(viewModel.budgetSettings.warningThreshold)%")
                            .font(.headline)
                        Slider(
                            value: Binding(
                                get: { Double(viewModel.budgetSettings.warningThreshold) },
                                set: { viewModel.budgetSettings.warningThreshold = Int($0) }
                            ),
                            in: 0...100,
                            step: 1
                        )
                        Text("Alert when usage exceeds this threshold")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(8)

                // Current usage
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Current Usage")
                            .font(.headline)
                        Spacer()
                        if viewModel.usageStats.budgetStatus != "normal" {
                            Text(viewModel.usageStats.budgetStatus.uppercased())
                                .font(.caption)
                                .fontWeight(.bold)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(viewModel.usageStats.budgetStatus == "exceeded" ? Color.red : Color.orange)
                                .foregroundColor(.white)
                                .cornerRadius(4)
                        }
                    }

                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Today")
                                .font(.caption)
                                .foregroundColor(.gray)
                            Text("$\(String(format: "%.2f", viewModel.usageStats.dailyUsd))")
                                .font(.title3)
                                .fontWeight(.semibold)
                            Text("\(viewModel.usageStats.dailyOperations) ops")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 4) {
                            Text("This Month")
                                .font(.caption)
                                .foregroundColor(.gray)
                            Text("$\(String(format: "%.2f", viewModel.usageStats.monthlyUsd))")
                                .font(.title3)
                                .fontWeight(.semibold)
                            Text("\(viewModel.usageStats.monthlyOperations) ops")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                    }

                    ProgressView(value: monthlyProgress)
                        .tint(progressColor)

                    Text("$\(String(format: "%.2f", viewModel.usageStats.monthlyUsd)) / $\(String(format: "%.2f", viewModel.budgetSettings.monthlyLimitUsd))")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                .padding()
                .background(
                    viewModel.usageStats.budgetStatus == "exceeded"
                        ? Color.red.opacity(0.1)
                        : viewModel.usageStats.budgetStatus == "warning"
                            ? Color.orange.opacity(0.1)
                            : Color.blue.opacity(0.1)
                )
                .cornerRadius(8)

                Spacer()
            }
            .padding()
        }
    }
}

// MARK: - Models Tab

struct ModelsTabView: View {
    @State private var emailPrimary = "Claude Opus 4.5"
    @State private var emailFallback = "DeepSeek v3.2"
    @State private var calendarPrimary = "DeepSeek v3.2"
    @State private var calendarFallback = "Gemini 2.0 Flash"
    @State private var taskPrimary = "DeepSeek v3.2"
    @State private var taskFallback = "Gemini 2.0 Flash"
    @State private var analyticsPrimary = "Gemini 2.0 Flash"
    @State private var analyticsFallback = "DeepSeek v3.2"

    let models = ["Claude Opus 4.5", "DeepSeek v3.2", "Gemini 2.0 Flash"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Model Configuration")
                    .font(.headline)
                Text("Select primary and fallback models for each operation category")
                    .font(.caption)
                    .foregroundColor(.gray)

                VStack(spacing: 16) {
                    ModelConfigSection(title: "Email", primary: $emailPrimary, fallback: $emailFallback, models: models)
                    ModelConfigSection(title: "Calendar", primary: $calendarPrimary, fallback: $calendarFallback, models: models)
                    ModelConfigSection(title: "Task", primary: $taskPrimary, fallback: $taskFallback, models: models)
                    ModelConfigSection(title: "Analytics", primary: $analyticsPrimary, fallback: $analyticsFallback, models: models)
                }

                HStack {
                    Image(systemName: "info.circle.fill")
                        .foregroundColor(.blue)
                    Text("Model selection is automatic based on cost and availability")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color.blue.opacity(0.1))
                .cornerRadius(8)

                Spacer()
            }
            .padding()
        }
    }
}

struct ModelConfigSection: View {
    let title: String
    @Binding var primary: String
    @Binding var fallback: String
    let models: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                Text("Primary")
                    .font(.caption)
                    .foregroundColor(.gray)
                Picker("Primary", selection: $primary) {
                    ForEach(models, id: \.self) { model in
                        Text(model).tag(model)
                    }
                }
                .pickerStyle(.segmented)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Fallback")
                    .font(.caption)
                    .foregroundColor(.gray)
                Picker("Fallback", selection: $fallback) {
                    ForEach(models, id: \.self) { model in
                        Text(model).tag(model)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

// MARK: - Helpers

extension View {
    func borderBottom() -> some View {
        self.overlay(alignment: .bottom) {
            Divider()
        }
    }

    func borderTop() -> some View {
        self.overlay(alignment: .top) {
            Divider()
        }
    }
}

#Preview {
    IntelligenceSettingsView()
}
