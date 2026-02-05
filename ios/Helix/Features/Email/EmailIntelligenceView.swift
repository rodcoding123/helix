import SwiftUI

/// Email Intelligence Features for iOS
/// Integrates compose, classify, and respond operations into email workflow
struct EmailIntelligenceView: View {
  @StateObject private var viewModel = EmailIntelligenceViewModel()
  @State private var showComposer = false
  @State private var showClassifySettings = false
  @State private var selectedEmail: EmailMessage?

  var body: some View {
    NavigationStack {
      VStack(spacing: 0) {
        // Header with operation toggles
        OperationHeaderView(
          operations: viewModel.emailOperations,
          onToggle: viewModel.toggleOperation
        )

        TabView(selection: $viewModel.selectedTab) {
          // Compose Tab
          ComposeTabView(
            viewModel: viewModel,
            isPresented: $showComposer
          )
          .tag(EmailIntelligenceTab.compose)

          // Classify Tab
          ClassifyTabView(
            viewModel: viewModel,
            isPresented: $showClassifySettings
          )
          .tag(EmailIntelligenceTab.classify)

          // Respond Tab
          RespondTabView(viewModel: viewModel)
            .tag(EmailIntelligenceTab.respond)
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
      }
      .navigationTitle("Email Intelligence")
      .navigationBarTitleDisplayMode(.inline)
      .onAppear {
        viewModel.loadOperations()
      }
    }
  }
}

// MARK: - Compose Tab View
struct ComposeTabView: View {
  @ObservedObject var viewModel: EmailIntelligenceViewModel
  @Binding var isPresented: Bool
  @State private var tone = EmailTone.professional
  @State private var context = ""
  @State private var maxLength = 500

  var body: some View {
    VStack(spacing: 16) {
      Text("Generate Email")
        .font(.headline)
        .padding(.horizontal)

      Form {
        Section("Tone") {
          Picker("Tone", selection: $tone) {
            ForEach(EmailTone.allCases, id: \.self) { tone in
              Text(tone.rawValue.capitalized).tag(tone)
            }
          }
        }

        Section("Context") {
          TextEditor(text: $context)
            .frame(height: 100)
            .border(Color.gray.opacity(0.3))
        }

        Section("Settings") {
          Stepper("Max Length: \(maxLength)", value: $maxLength, in: 100...2000, step: 100)
        }
      }

      // Composed Email Preview
      if let composed = viewModel.composedEmail {
        VStack(alignment: .leading, spacing: 12) {
          Text("Preview")
            .font(.headline)
          Divider()

          VStack(alignment: .leading, spacing: 8) {
            Text("Subject: \(composed.subject)")
              .font(.subheadline)
              .fontWeight(.semibold)
            Text("Confidence: \(String(format: "%.0f", composed.confidence * 100))%")
              .font(.caption)
              .foregroundColor(.secondary)
          }

          TextEditor(text: .constant(composed.body))
            .disabled(true)
            .frame(height: 150)
            .border(Color.gray.opacity(0.3))

          HStack(spacing: 12) {
            Button(action: { viewModel.copyToClipboard(composed.body) }) {
              Label("Copy", systemImage: "doc.on.doc")
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)

            Button(action: { viewModel.sendEmail(composed) }) {
              Label("Send", systemImage: "paperplane.fill")
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
          }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
        .padding(.horizontal)
      }

      // Generate Button
      Button(action: {
        viewModel.generateEmail(
          tone: tone,
          context: context,
          maxLength: maxLength
        )
      }) {
        if viewModel.isLoading {
          ProgressView()
            .frame(maxWidth: .infinity)
        } else {
          Label("Generate Email", systemImage: "sparkles")
            .frame(maxWidth: .infinity)
        }
      }
      .buttonStyle(.borderedProminent)
      .disabled(!viewModel.isOperationEnabled("email-compose") || context.isEmpty)
      .padding(.horizontal)

      // Error display
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

// MARK: - Classify Tab View
struct ClassifyTabView: View {
  @ObservedObject var viewModel: EmailIntelligenceViewModel
  @Binding var isPresented: Bool
  @State private var emailText = ""
  @State private var selectedEmails: Set<UUID> = []

  var body: some View {
    VStack(spacing: 16) {
      Text("Classify Emails")
        .font(.headline)
        .padding(.horizontal)

      // Classification Results
      if !viewModel.classifiedEmails.isEmpty {
        List(viewModel.classifiedEmails, id: \.id) { classified in
          VStack(alignment: .leading, spacing: 8) {
            Text(classified.subject)
              .font(.subheadline)
              .fontWeight(.semibold)

            HStack(spacing: 12) {
              Badge(
                text: classified.priority.rawValue.uppercased(),
                color: classified.priority.color
              )
              Badge(
                text: classified.category,
                color: .blue
              )
            }

            Text(classified.description)
              .font(.caption)
              .foregroundColor(.secondary)

            if classified.needsResponse {
              HStack(spacing: 8) {
                Image(systemName: "exclamationmark.circle.fill")
                  .foregroundColor(.orange)
                Text("Response needed by \(formatted(classified.responseDeadline))")
                  .font(.caption)
              }
            }
          }
          .padding(.vertical, 8)
        }
      } else if !viewModel.isLoading {
        VStack(spacing: 12) {
          Image(systemName: "envelope.open")
            .font(.system(size: 48))
            .foregroundColor(.gray)
          Text("No emails classified yet")
            .font(.subheadline)
            .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
      }

      // Loading State
      if viewModel.isLoading {
        ProgressView("Classifying emails...")
          .padding()
      }

      Spacer()

      // Action Button
      Button(action: { viewModel.classifyInbox() }) {
        if viewModel.isLoading {
          ProgressView()
            .frame(maxWidth: .infinity)
        } else {
          Label("Classify Inbox", systemImage: "inbox.fill")
            .frame(maxWidth: .infinity)
        }
      }
      .buttonStyle(.borderedProminent)
      .disabled(!viewModel.isOperationEnabled("email-classify"))
      .padding(.horizontal)

      // Error display
      if let error = viewModel.error {
        Text(error)
          .font(.caption)
          .foregroundColor(.red)
          .padding(.horizontal)
      }
    }
    .padding(.vertical)
  }

  private func formatted(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateStyle = .short
    formatter.timeStyle = .short
    return formatter.string(from: date)
  }
}

// MARK: - Respond Tab View
struct RespondTabView: View {
  @ObservedObject var viewModel: EmailIntelligenceViewModel
  @State private var selectedResponseType = EmailResponseType.acknowledge
  @State private var selectedEmail: EmailMessage?

  var body: some View {
    VStack(spacing: 16) {
      Text("Generate Response")
        .font(.headline)
        .padding(.horizontal)

      Form {
        Section("Response Type") {
          Picker("Type", selection: $selectedResponseType) {
            ForEach(EmailResponseType.allCases, id: \.self) { type in
              Text(type.rawValue.capitalized).tag(type)
            }
          }
        }

        Section("Draft Response") {
          if let response = viewModel.generatedResponse {
            VStack(alignment: .leading, spacing: 8) {
              Text("Confidence: \(String(format: "%.0f", response.confidence * 100))%")
                .font(.caption)
                .foregroundColor(.secondary)

              TextEditor(text: .constant(response.body))
                .disabled(true)
                .frame(height: 150)
                .border(Color.gray.opacity(0.3))

              HStack(spacing: 12) {
                Button(action: { viewModel.copyToClipboard(response.body) }) {
                  Label("Copy", systemImage: "doc.on.doc")
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button(action: { viewModel.sendResponse(response) }) {
                  Label("Send", systemImage: "paperplane.fill")
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
              }
            }
          } else {
            Text("Select email and type to generate response")
              .font(.caption)
              .foregroundColor(.secondary)
          }
        }
      }

      // Generate Button
      Button(action: {
        viewModel.generateResponse(type: selectedResponseType)
      }) {
        if viewModel.isLoading {
          ProgressView()
            .frame(maxWidth: .infinity)
        } else {
          Label("Generate Response", systemImage: "sparkles")
            .frame(maxWidth: .infinity)
        }
      }
      .buttonStyle(.borderedProminent)
      .disabled(!viewModel.isOperationEnabled("email-respond") || selectedEmail == nil)
      .padding(.horizontal)

      // Error display
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

// MARK: - Header View
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

              Text(op.replacingOccurrences(of: "email-", with: ""))
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

// MARK: - Badge Component
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

// MARK: - View Model
@MainActor
class EmailIntelligenceViewModel: ObservableObject {
  @Published var selectedTab: EmailIntelligenceTab = .compose
  @Published var isLoading = false
  @Published var error: String?
  @Published var emailOperations: [String: Bool] = [:]
  @Published var composedEmail: ComposedEmail?
  @Published var classifiedEmails: [ClassifiedEmail] = []
  @Published var generatedResponse: EmailResponse?

  private let emailService = EmailIntelligenceService()

  func loadOperations() {
    Task {
      do {
        let operations = try await emailService.getOperations()
        self.emailOperations = Dictionary(
          uniqueKeysWithValues: operations.map { ($0, true) }
        )
      } catch {
        self.error = "Failed to load operations: \(error.localizedDescription)"
      }
    }
  }

  func toggleOperation(_ operation: String) {
    emailOperations[operation]?.toggle()
  }

  func isOperationEnabled(_ operation: String) -> Bool {
    return emailOperations[operation] ?? false
  }

  func generateEmail(tone: EmailTone, context: String, maxLength: Int) {
    isLoading = true
    error = nil

    Task {
      do {
        let result = try await emailService.composeEmail(
          tone: tone.rawValue,
          context: context,
          maxLength: maxLength
        )
        self.composedEmail = result
        self.isLoading = false
      } catch {
        self.error = error.localizedDescription
        self.isLoading = false
      }
    }
  }

  func classifyInbox() {
    isLoading = true
    error = nil

    Task {
      do {
        let classified = try await emailService.classifyInbox()
        self.classifiedEmails = classified
        self.isLoading = false
      } catch {
        self.error = error.localizedDescription
        self.isLoading = false
      }
    }
  }

  func generateResponse(type: EmailResponseType) {
    isLoading = true
    error = nil

    Task {
      do {
        let response = try await emailService.generateResponse(type: type.rawValue)
        self.generatedResponse = response
        self.isLoading = false
      } catch {
        self.error = error.localizedDescription
        self.isLoading = false
      }
    }
  }

  func copyToClipboard(_ text: String) {
    UIPasteboard.general.string = text
  }

  func sendEmail(_ email: ComposedEmail) {
    Task {
      do {
        try await emailService.sendEmail(email)
        self.composedEmail = nil
        self.error = nil
      } catch {
        self.error = "Failed to send email: \(error.localizedDescription)"
      }
    }
  }

  func sendResponse(_ response: EmailResponse) {
    Task {
      do {
        try await emailService.sendResponse(response)
        self.generatedResponse = nil
        self.error = nil
      } catch {
        self.error = "Failed to send response: \(error.localizedDescription)"
      }
    }
  }
}

// MARK: - Models
enum EmailIntelligenceTab: Hashable {
  case compose
  case classify
  case respond
}

enum EmailTone: String, CaseIterable {
  case professional
  case casual
  case formal
}

enum EmailResponseType: String, CaseIterable {
  case acknowledge
  case approve
  case decline
  case request_info
}

struct ComposedEmail: Codable, Identifiable {
  let id: UUID
  let subject: String
  let body: String
  let confidence: Double
  let suggestions: [String]
  let estimatedTokens: Int
}

struct ClassifiedEmail: Codable, Identifiable {
  let id: UUID
  let subject: String
  let priority: EmailPriority
  let category: String
  let description: String
  let needsResponse: Bool
  let responseDeadline: Date
  let suggestedAction: String
}

enum EmailPriority: String, Codable, CaseIterable {
  case high
  case medium
  case low

  var color: Color {
    switch self {
    case .high: return .red
    case .medium: return .orange
    case .low: return .green
    }
  }
}

struct EmailResponse: Codable, Identifiable {
  let id: UUID
  let body: String
  let type: String
  let tone: String
  let confidence: Double
  let estimatedTokens: Int
}

struct EmailMessage: Identifiable {
  let id: UUID
  let subject: String
  let from: String
  let body: String
  let date: Date
}

#Preview {
  EmailIntelligenceView()
}
