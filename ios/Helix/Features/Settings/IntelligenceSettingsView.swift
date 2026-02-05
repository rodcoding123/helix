/**
 * Intelligence Settings View - Phase 8 iOS
 * Configure AI operations, model selection, and budget limits
 * SwiftUI implementation for iOS 14+
 */

import SwiftUI

struct AIOperation: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    let primaryModel: String
    let fallbackModel: String
    let costCriticality: String
    let estimatedCostUsd: Double
    var enabled: Bool
}

struct BudgetSettings: Codable {
    var dailyLimitUsd: Double = 50.0
    var monthlyLimitUsd: Double = 1000.0
    var warningThreshold: Double = 80.0
}

struct IntelligenceSettingsView: View {
    @State private var operations: [AIOperation] = []
    @State private var budgetSettings = BudgetSettings()
    @State private var selectedTab: Tab = .operations
    @State private var isSaving = false
    @State private var lastSaved: Date? = nil
    @State private var showSaveIndicator = false

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
                OperationsTabView(operations: $operations)
            case .budget:
                BudgetTabView(settings: $budgetSettings)
            case .models:
                ModelsTabView()
            }

            Spacer()

            // Footer
            VStack(spacing: 12) {
                if let lastSaved = lastSaved {
                    Text("Last saved: \(lastSaved.formatted(date: .omitted, time: .standard))")
                        .font(.caption)
                        .foregroundColor(.gray)
                }

                HStack(spacing: 12) {
                    Button(action: reloadSettings) {
                        Text("Reset")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .foregroundColor(.primary)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke())
                    }

                    Button(action: saveSettings) {
                        HStack {
                            if isSaving {
                                ProgressView()
                                    .scaleEffect(0.8, anchor: .center)
                            }
                            Text(isSaving ? "Saving..." : "Save Settings")
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundColor(.white)
                        .background(.blue)
                        .cornerRadius(8)
                    }
                    .disabled(isSaving)
                }
            }
            .padding()
            .borderTop()
        }
        .onAppear {
            loadOperations()
            reloadSettings()
        }
    }

    private func loadOperations() {
        Task {
            do {
                let url = URL(string: "/api/llm-router/operations")!
                let (data, _) = try await URLSession.shared.data(from: url)
                let decoder = JSONDecoder()
                let ops = try decoder.decode([AIOperation].self, from: data)
                DispatchQueue.main.async {
                    self.operations = ops
                }
            } catch {
                print("Failed to load operations: \(error)")
            }
        }
    }

    private func reloadSettings() {
        Task {
            do {
                let url = URL(string: "/api/intelligence-settings")!
                let (data, _) = try await URLSession.shared.data(from: url)
                let decoder = JSONDecoder()
                let response = try decoder.decode(
                    ["budget": BudgetSettings].self,
                    from: data
                )
                DispatchQueue.main.async {
                    self.budgetSettings = response["budget"] ?? BudgetSettings()
                }
            } catch {
                print("Failed to load settings: \(error)")
            }
        }
    }

    private func saveSettings() {
        isSaving = true
        Task {
            do {
                let url = URL(string: "/api/intelligence-settings")!
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")

                let payload: [String: Any] = [
                    "operations": operations.map { op in
                        [
                            "operationId": op.id,
                            "enabled": op.enabled,
                            "primaryModel": op.primaryModel,
                            "fallbackModel": op.fallbackModel,
                            "costCriticality": op.costCriticality,
                        ]
                    },
                    "budget": [
                        "dailyLimitUsd": budgetSettings.dailyLimitUsd,
                        "monthlyLimitUsd": budgetSettings.monthlyLimitUsd,
                        "warningThreshold": budgetSettings.warningThreshold,
                    ],
                ]

                request.httpBody = try JSONSerialization.data(withJSONObject: payload)
                let (_, response) = try await URLSession.shared.data(for: request)

                if (response as? HTTPURLResponse)?.statusCode == 200 {
                    DispatchQueue.main.async {
                        self.lastSaved = Date()
                        self.isSaving = false
                        self.showSaveIndicator = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            self.showSaveIndicator = false
                        }
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.isSaving = false
                }
                print("Failed to save settings: \(error)")
            }
        }
    }
}

// MARK: - Operations Tab

struct OperationsTabView: View {
    @Binding var operations: [AIOperation]

    var emailOps: [AIOperation] { operations.filter { $0.id.contains("email") } }
    var calendarOps: [AIOperation] { operations.filter { $0.id.contains("calendar") } }
    var taskOps: [AIOperation] { operations.filter { $0.id.contains("task") } }
    var analyticsOps: [AIOperation] { operations.filter { $0.id.contains("analytics") } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                OperationSection(title: "Email Intelligence", operations: emailOps)
                OperationSection(title: "Calendar Intelligence", operations: calendarOps)
                OperationSection(title: "Task Intelligence", operations: taskOps)
                OperationSection(title: "Analytics Intelligence", operations: analyticsOps)
            }
            .padding()
        }
    }
}

struct OperationSection: View {
    let title: String
    let operations: [AIOperation]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .foregroundColor(.primary)

            ForEach(operations) { op in
                OperationRow(operation: op)
            }
        }
    }
}

struct OperationRow: View {
    let operation: AIOperation
    @State private var enabled: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Toggle("", isOn: $enabled)
                    .onChange(of: enabled) { _, newValue in
                        // Update operation
                    }

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
        .onAppear {
            enabled = operation.enabled
        }
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
    @Binding var settings: BudgetSettings

    var monthlyUsagePercent: Double { 1.54 }

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
                            TextField("Amount", value: $settings.dailyLimitUsd, format: .number)
                                .textFieldStyle(.roundedBorder)
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
                            TextField("Amount", value: $settings.monthlyLimitUsd, format: .number)
                                .textFieldStyle(.roundedBorder)
                        }
                        Text("Default: $1,000.00/month")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Warning Threshold (%)")
                            .font(.headline)
                        Slider(value: $settings.warningThreshold, in: 0...100, step: 1)
                        Text("Alert when usage exceeds \(Int(settings.warningThreshold))%")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(8)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Current Usage")
                        .font(.headline)
                    Text("This month: $15.40 / $1,000.00")
                        .font(.subheadline)
                    ProgressView(value: monthlyUsagePercent / 100)
                        .tint(.blue)
                }
                .padding()
                .background(Color(.systemBlue).opacity(0.1))
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
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                    Text("Model selection is automatic based on cost and availability")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
                .padding()
                .background(Color(.systemOrange).opacity(0.1))
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
