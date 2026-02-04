/**
 * Phase 8: Intelligence Dashboard - iOS
 * SwiftUI view for accessing all AI intelligence features
 * Integrates with Phase 0.5 AI Operations Control Plane
 */

import SwiftUI

@Observable
class IntelligenceViewModel {
  var budgetStatus: BudgetStatus?
  var selectedFeature: IntelligenceFeature?
  var isLoading = false
  var errorMessage: String?

  private let routerClient: AIRouterClient

  init(routerClient: AIRouterClient = getRouterClient()) {
    self.routerClient = routerClient
    loadBudgetStatus()
  }

  func loadBudgetStatus() {
    isLoading = true
    Task {
      do {
        let budget = try await routerClient.getBudgetStatus(userId: getUserId())
        self.budgetStatus = budget
      } catch {
        self.errorMessage = "Failed to load budget: \(error.localizedDescription)"
      }
      self.isLoading = false
    }
  }

  func selectFeature(_ feature: IntelligenceFeature) {
    selectedFeature = feature
  }

  func closeFeature() {
    selectedFeature = nil
  }
}

struct IntelligenceView: View {
  @State private var viewModel = IntelligenceViewModel()
  @Environment(\.horizontalSizeClass) var sizeClass

  let intelligenceFeatures: [IntelligenceFeature] = [
    IntelligenceFeature(
      id: "email-compose",
      name: "Email Composition",
      description: "AI-powered email drafting",
      icon: "envelope.open",
      enabled: true,
      estimatedCost: 0.0015,
      category: "email"
    ),
    IntelligenceFeature(
      id: "email-classify",
      name: "Email Classification",
      description: "Auto-categorize emails",
      icon: "tag",
      enabled: true,
      estimatedCost: 0.0006,
      category: "email"
    ),
    IntelligenceFeature(
      id: "email-respond",
      name: "Response Suggestions",
      description: "Smart reply suggestions",
      icon: "arrowshape.turn.up.left",
      enabled: true,
      estimatedCost: 0.0012,
      category: "email"
    ),
    IntelligenceFeature(
      id: "calendar-prep",
      name: "Meeting Preparation",
      description: "Auto-generate meeting prep",
      icon: "calendar",
      enabled: true,
      estimatedCost: 0.0025,
      category: "calendar"
    ),
    IntelligenceFeature(
      id: "calendar-time",
      name: "Optimal Meeting Times",
      description: "Find best meeting slots",
      icon: "clock",
      enabled: true,
      estimatedCost: 0.008,
      category: "calendar"
    ),
    IntelligenceFeature(
      id: "task-prioritize",
      name: "Task Prioritization",
      description: "AI-powered task ordering",
      icon: "checkmark.circle",
      enabled: true,
      estimatedCost: 0.0018,
      category: "task"
    ),
    IntelligenceFeature(
      id: "task-breakdown",
      name: "Task Breakdown",
      description: "Generate subtasks",
      icon: "list.bullet.rectangle",
      enabled: true,
      estimatedCost: 0.0012,
      category: "task"
    ),
    IntelligenceFeature(
      id: "analytics-summary",
      name: "Weekly Summary",
      description: "AI productivity reports",
      icon: "chart.bar",
      enabled: true,
      estimatedCost: 0.03,
      category: "analytics"
    ),
    IntelligenceFeature(
      id: "analytics-anomaly",
      name: "Pattern Anomalies",
      description: "Detect unusual patterns",
      icon: "exclamationmark.triangle",
      enabled: true,
      estimatedCost: 0.0009,
      category: "analytics"
    ),
  ]

  var body: some View {
    NavigationStack {
      VStack(spacing: 0) {
        // Header
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            VStack(alignment: .leading, spacing: 4) {
              Text("Intelligence Dashboard")
                .font(.title2)
                .fontWeight(.bold)
              Text("Phase 8: LLM-First Intelligence")
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "sparkles")
              .font(.title)
              .foregroundStyle(.yellow)
          }
          .padding(.horizontal, 16)
          .padding(.vertical, 12)
        }
        .background(Color(.systemBackground))
        .border(Color(.separator), width: 0.5)

        // Budget Status Card
        if let budget = viewModel.budgetStatus {
          BudgetStatusCard(budget: budget)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }

        // Features List
        ScrollView {
          VStack(spacing: 12) {
            // Email Features Section
            FeatureSection(
              title: "Email Intelligence",
              features: intelligenceFeatures.filter { $0.category == "email" },
              viewModel: viewModel
            )

            // Calendar Features Section
            FeatureSection(
              title: "Calendar Intelligence",
              features: intelligenceFeatures.filter { $0.category == "calendar" },
              viewModel: viewModel
            )

            // Task Features Section
            FeatureSection(
              title: "Task Intelligence",
              features: intelligenceFeatures.filter { $0.category == "task" },
              viewModel: viewModel
            )

            // Analytics Features Section
            FeatureSection(
              title: "Analytics Intelligence",
              features: intelligenceFeatures.filter { $0.category == "analytics" },
              viewModel: viewModel
            )

            // Info Footer
            VStack(alignment: .leading, spacing: 8) {
              HStack(spacing: 12) {
                Image(systemName: "info.circle.fill")
                  .foregroundStyle(.blue)
                  .font(.title3)

                VStack(alignment: .leading, spacing: 4) {
                  Text("Phase 0.5 Integration")
                    .font(.caption)
                    .fontWeight(.semibold)
                  Text("All operations are integrated with the unified AI Operations Control Plane")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
              }
              .padding(12)
              .background(Color(.systemBlue).opacity(0.1))
              .cornerRadius(8)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
          }
          .padding(.vertical, 12)
        }
      }
      .navigationTitle("")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .principal) {
          Text("Intelligence")
            .font(.headline)
        }
      }
    }
    .sheet(item: $viewModel.selectedFeature) { feature in
      FeatureDetailSheet(feature: feature, isPresented: $viewModel.selectedFeature)
    }
    .onAppear {
      if viewModel.budgetStatus == nil {
        viewModel.loadBudgetStatus()
      }
    }
  }
}

// MARK: - Budget Status Card

struct BudgetStatusCard: View {
  let budget: BudgetStatus

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("Daily AI Budget")
          .font(.headline)
        Spacer()
        Text("Phase 0.5")
          .font(.caption)
          .foregroundStyle(.secondary)
      }

      // Budget Metrics Grid
      HStack(spacing: 12) {
        BudgetMetricBox(
          label: "Limit",
          value: String(format: "$%.2f", budget.dailyLimit),
          color: .blue
        )

        BudgetMetricBox(
          label: "Spent",
          value: String(format: "$%.2f", budget.currentSpend),
          color: .green
        )

        BudgetMetricBox(
          label: "Remaining",
          value: String(format: "$%.2f", budget.remaining),
          color: .purple
        )

        BudgetMetricBox(
          label: "Usage",
          value: String(format: "%.0f%%", budget.percentUsed),
          color: .orange
        )
      }

      // Budget Progress Bar
      VStack(alignment: .leading, spacing: 4) {
        ProgressView(value: min(budget.percentUsed / 100, 1.0))
          .tint(budget.percentUsed > 80 ? Color.red : Color.green)

        Text("\(budget.operationsToday) operations today")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .padding(12)
    .background(Color(.systemGray6))
    .cornerRadius(12)
  }
}

struct BudgetMetricBox: View {
  let label: String
  let value: String
  let color: Color

  var body: some View {
    VStack(alignment: .center, spacing: 4) {
      Text(label)
        .font(.caption2)
        .foregroundStyle(.secondary)

      Text(value)
        .font(.system(.caption, design: .monospaced))
        .fontWeight(.semibold)
        .foregroundStyle(color)
    }
    .frame(maxWidth: .infinity)
    .padding(8)
    .background(Color(.systemBackground))
    .cornerRadius(8)
  }
}

// MARK: - Feature Section

struct FeatureSection: View {
  let title: String
  let features: [IntelligenceFeature]
  let viewModel: IntelligenceViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(title)
        .font(.subheadline)
        .fontWeight(.semibold)
        .foregroundStyle(.secondary)
        .padding(.horizontal, 16)

      VStack(spacing: 8) {
        ForEach(features) { feature in
          FeatureCard(
            feature: feature,
            onTap: { viewModel.selectFeature(feature) }
          )
        }
      }
      .padding(.horizontal, 16)
    }
  }
}

// MARK: - Feature Card

struct FeatureCard: View {
  let feature: IntelligenceFeature
  let onTap: () -> Void

  var body: some View {
    Button(action: onTap) {
      VStack(alignment: .leading, spacing: 8) {
        HStack(spacing: 12) {
          Image(systemName: feature.icon)
            .font(.title3)
            .foregroundStyle(.white)
            .frame(width: 40, height: 40)
            .background(Color.blue)
            .cornerRadius(8)

          VStack(alignment: .leading, spacing: 2) {
            Text(feature.name)
              .font(.headline)
              .foregroundStyle(.primary)

            Text(feature.description)
              .font(.caption)
              .foregroundStyle(.secondary)
              .lineLimit(1)
          }

          Spacer()

          VStack(alignment: .trailing, spacing: 4) {
            if feature.enabled {
              Label("Enabled", systemImage: "checkmark.circle.fill")
                .font(.caption2)
                .foregroundStyle(.green)
            }

            Text(String(format: "$%.4f", feature.estimatedCost))
              .font(.caption)
              .foregroundStyle(.secondary)
              .monospaced()
          }
        }
        .contentShape(Rectangle())
      }
      .padding(12)
      .background(Color(.systemGray6))
      .cornerRadius(10)
    }
  }
}

// MARK: - Feature Detail Sheet

struct FeatureDetailSheet: View {
  let feature: IntelligenceFeature
  @Binding var isPresented: IntelligenceFeature?

  var body: some View {
    NavigationStack {
      VStack(spacing: 16) {
        // Header
        VStack(alignment: .leading, spacing: 12) {
          HStack(spacing: 12) {
            Image(systemName: feature.icon)
              .font(.title)
              .foregroundStyle(.blue)
              .frame(width: 50, height: 50)
              .background(Color.blue.opacity(0.1))
              .cornerRadius(8)

            VStack(alignment: .leading, spacing: 4) {
              Text(feature.name)
                .font(.headline)
              Text(feature.description)
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer()
          }

          HStack(spacing: 8) {
            Label("Enabled", systemImage: "checkmark.circle.fill")
              .font(.caption)
              .foregroundStyle(.green)

            Spacer()

            Text(String(format: "$%.4f/call", feature.estimatedCost))
              .font(.caption)
              .monospaced()
              .foregroundStyle(.secondary)
          }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(10)

        // Info Box
        VStack(alignment: .leading, spacing: 8) {
          Label("Phase 0.5 Integration", systemImage: "checkmark.seal.fill")
            .font(.caption)
            .foregroundStyle(.blue)

          Text("This operation is part of the unified AI Operations Control Plane. Cost tracking, approval gates, and budget management are automatically handled.")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(Color(.systemBlue).opacity(0.05))
        .cornerRadius(8)

        // Action Button
        Button(action: {}) {
          Text("Use Feature")
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(12)
            .background(Color.blue)
            .foregroundStyle(.white)
            .cornerRadius(8)
        }

        Spacer()
      }
      .padding(16)
      .navigationTitle(feature.name)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button("Done") {
            isPresented = nil
          }
        }
      }
    }
  }
}

// MARK: - Models

struct IntelligenceFeature: Identifiable {
  let id: String
  let name: String
  let description: String
  let icon: String
  let enabled: Bool
  let estimatedCost: Double
  let category: String
}

struct BudgetStatus {
  let dailyLimit: Double
  let currentSpend: Double
  let remaining: Double
  let percentUsed: Double
  let operationsToday: Int
}

// MARK: - Preview

#Preview {
  IntelligenceView()
}
