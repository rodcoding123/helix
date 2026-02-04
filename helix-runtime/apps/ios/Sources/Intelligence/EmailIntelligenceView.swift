/**
 * Phase 8: Email Intelligence - iOS
 * SwiftUI views for email composition, classification, and response suggestions
 */

import SwiftUI

@Observable
class EmailIntelligenceViewModel {
  var composeSuggestions: [String] = []
  var isLoadingCompose = false

  var emailToClassify: EmailData?
  var classificationResult: EmailClassification?
  var isLoadingClassify = false

  var responseSuggestions: [ResponseSuggestion] = []
  var isLoadingRespond = false

  private let emailService: EmailIntelligenceService

  init(emailService: EmailIntelligenceService = EmailIntelligenceService()) {
    self.emailService = emailService
  }

  func suggestComposition(subject: String, context: String = "") async {
    isLoadingCompose = true
    defer { isLoadingCompose = false }

    do {
      let suggestions = try await emailService.suggestComposition(
        userId: getUserId(),
        accountId: "default",
        subject: subject,
        recipientContext: context
      )
      self.composeSuggestions = suggestions
    } catch {
      composeSuggestions = ["Unable to generate suggestions. Please try again."]
    }
  }

  func classifyEmail(subject: String, body: String, from: String) async {
    isLoadingClassify = true
    defer { isLoadingClassify = false }

    do {
      let classification = try await emailService.classifyEmail(
        userId: getUserId(),
        emailId: UUID().uuidString,
        subject: subject,
        body: body,
        from: from
      )
      self.classificationResult = classification
    } catch {
      print("Classification error: \(error)")
    }
  }

  func suggestResponses(subject: String, body: String, from: String) async {
    isLoadingRespond = true
    defer { isLoadingRespond = false }

    do {
      let suggestions = try await emailService.suggestResponses(
        userId: getUserId(),
        emailId: UUID().uuidString,
        subject: subject,
        body: body,
        from: from
      )
      self.responseSuggestions = suggestions
    } catch {
      print("Response suggestion error: \(error)")
    }
  }
}

struct EmailIntelligenceView: View {
  @State private var viewModel = EmailIntelligenceViewModel()
  @State private var selectedTab = 0

  var body: some View {
    NavigationStack {
      TabView(selection: $selectedTab) {
        // Email Composition Tab
        EmailComposeView(viewModel: viewModel)
          .tabItem {
            Label("Compose", systemImage: "pencil")
          }
          .tag(0)

        // Email Classification Tab
        EmailClassifyView(viewModel: viewModel)
          .tabItem {
            Label("Classify", systemImage: "tag")
          }
          .tag(1)

        // Response Suggestions Tab
        EmailRespondView(viewModel: viewModel)
          .tabItem {
            Label("Respond", systemImage: "arrowshape.turn.up.left")
          }
          .tag(2)
      }
      .navigationTitle("Email Intelligence")
      .navigationBarTitleDisplayMode(.inline)
    }
  }
}

// MARK: - Email Compose View

struct EmailComposeView: View {
  let viewModel: EmailIntelligenceViewModel
  @State private var subject = ""
  @State private var recipientContext = ""

  var body: some View {
    VStack(spacing: 16) {
      VStack(spacing: 12) {
        Text("Email Composition Assistant")
          .font(.headline)

        Text("Get AI-powered suggestions for composing professional emails")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .padding(12)
      .background(Color(.systemGray6))
      .cornerRadius(10)

      VStack(alignment: .leading, spacing: 12) {
        // Subject Input
        VStack(alignment: .leading, spacing: 4) {
          Text("Email Subject")
            .font(.caption)
            .fontWeight(.semibold)

          TextField("What's the subject?", text: $subject)
            .padding(10)
            .background(Color(.systemBackground))
            .cornerRadius(8)
            .border(Color(.separator), width: 0.5)
        }

        // Context Input
        VStack(alignment: .leading, spacing: 4) {
          Text("Recipient Context (Optional)")
            .font(.caption)
            .fontWeight(.semibold)

          TextField("Who are you writing to?", text: $recipientContext)
            .padding(10)
            .background(Color(.systemBackground))
            .cornerRadius(8)
            .border(Color(.separator), width: 0.5)
        }

        // Generate Button
        Button(action: {
          Task {
            await viewModel.suggestComposition(subject: subject, context: recipientContext)
          }
        }) {
          if viewModel.isLoadingCompose {
            ProgressView()
              .frame(maxWidth: .infinity)
              .padding(12)
          } else {
            Text("Get Suggestions")
              .frame(maxWidth: .infinity)
              .padding(12)
              .background(Color.blue)
              .foregroundStyle(.white)
              .cornerRadius(8)
          }
        }
        .disabled(subject.isEmpty || viewModel.isLoadingCompose)
      }

      // Suggestions
      if !viewModel.composeSuggestions.isEmpty {
        VStack(alignment: .leading, spacing: 8) {
          Text("Suggestions")
            .font(.headline)

          ForEach(Array(viewModel.composeSuggestions.enumerated()), id: \.offset) { index, suggestion in
            VStack(alignment: .leading, spacing: 4) {
              Text("Option \(index + 1)")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

              Text(suggestion)
                .font(.caption)
                .lineLimit(3)
            }
            .padding(10)
            .background(Color(.systemGray6))
            .cornerRadius(8)
          }
        }
      }

      Spacer()
    }
    .padding(16)
  }
}

// MARK: - Email Classification View

struct EmailClassifyView: View {
  let viewModel: EmailIntelligenceViewModel
  @State private var subject = ""
  @State private var body = ""
  @State private var fromAddress = ""

  var body: some View {
    VStack(spacing: 16) {
      VStack(spacing: 12) {
        Text("Email Classification")
          .font(.headline)

        Text("Automatically categorize and extract metadata from emails")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .padding(12)
      .background(Color(.systemGray6))
      .cornerRadius(10)

      VStack(alignment: .leading, spacing: 12) {
        TextField("From Address", text: $fromAddress)
          .textContentType(.emailAddress)
          .padding(10)
          .background(Color(.systemBackground))
          .cornerRadius(8)
          .border(Color(.separator), width: 0.5)

        TextField("Subject", text: $subject)
          .padding(10)
          .background(Color(.systemBackground))
          .cornerRadius(8)
          .border(Color(.separator), width: 0.5)

        TextEditor(text: $body)
          .frame(height: 100)
          .padding(10)
          .background(Color(.systemBackground))
          .cornerRadius(8)
          .border(Color(.separator), width: 0.5)

        Button(action: {
          Task {
            await viewModel.classifyEmail(subject: subject, body: body, from: fromAddress)
          }
        }) {
          if viewModel.isLoadingClassify {
            ProgressView()
              .frame(maxWidth: .infinity)
              .padding(12)
          } else {
            Text("Classify Email")
              .frame(maxWidth: .infinity)
              .padding(12)
              .background(Color.blue)
              .foregroundStyle(.white)
              .cornerRadius(8)
          }
        }
        .disabled(subject.isEmpty || viewModel.isLoadingClassify)
      }

      // Classification Result
      if let result = viewModel.classificationResult {
        VStack(alignment: .leading, spacing: 8) {
          Text("Classification Result")
            .font(.headline)

          HStack {
            Label(result.category.rawValue, systemImage: "tag.fill")
              .font(.caption)
              .padding(8)
              .background(Color.blue.opacity(0.1))
              .cornerRadius(6)

            Label(result.priority.rawValue, systemImage: "exclamationmark.circle")
              .font(.caption)
              .padding(8)
              .background(priorityColor(result.priority).opacity(0.1))
              .cornerRadius(6)
          }

          if let label = result.suggestedLabel {
            Text("Label: \(label)")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
      }

      Spacer()
    }
    .padding(16)
  }

  private func priorityColor(_ priority: EmailPriority) -> Color {
    switch priority {
    case .high: return .red
    case .medium: return .orange
    case .low: return .green
    }
  }
}

// MARK: - Email Response View

struct EmailRespondView: View {
  let viewModel: EmailIntelligenceViewModel
  @State private var subject = ""
  @State private var body = ""
  @State private var fromAddress = ""

  var body: some View {
    VStack(spacing: 16) {
      VStack(spacing: 12) {
        Text("Response Suggestions")
          .font(.headline)

        Text("Get AI suggestions for professional email responses")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .padding(12)
      .background(Color(.systemGray6))
      .cornerRadius(10)

      VStack(alignment: .leading, spacing: 12) {
        TextField("From Address", text: $fromAddress)
          .textContentType(.emailAddress)
          .padding(10)
          .background(Color(.systemBackground))
          .cornerRadius(8)
          .border(Color(.separator), width: 0.5)

        TextField("Subject", text: $subject)
          .padding(10)
          .background(Color(.systemBackground))
          .cornerRadius(8)
          .border(Color(.separator), width: 0.5)

        TextEditor(text: $body)
          .frame(height: 100)
          .padding(10)
          .background(Color(.systemBackground))
          .cornerRadius(8)
          .border(Color(.separator), width: 0.5)

        Button(action: {
          Task {
            await viewModel.suggestResponses(subject: subject, body: body, from: fromAddress)
          }
        }) {
          if viewModel.isLoadingRespond {
            ProgressView()
              .frame(maxWidth: .infinity)
              .padding(12)
          } else {
            Text("Get Response Ideas")
              .frame(maxWidth: .infinity)
              .padding(12)
              .background(Color.blue)
              .foregroundStyle(.white)
              .cornerRadius(8)
          }
        }
        .disabled(subject.isEmpty || viewModel.isLoadingRespond)
      }

      // Response Suggestions
      if !viewModel.responseSuggestions.isEmpty {
        VStack(alignment: .leading, spacing: 8) {
          Text("Suggested Responses")
            .font(.headline)

          ForEach(Array(viewModel.responseSuggestions.enumerated()), id: \.offset) { index, suggestion in
            VStack(alignment: .leading, spacing: 4) {
              HStack {
                Text(suggestion.tone)
                  .font(.caption)
                  .fontWeight(.semibold)
                  .foregroundStyle(.secondary)

                Label(suggestion.length.rawValue, systemImage: "text.alignleft")
                  .font(.caption2)
                  .foregroundStyle(.secondary)
              }

              Text(suggestion.response)
                .font(.caption)
                .lineLimit(4)
            }
            .padding(10)
            .background(Color(.systemGray6))
            .cornerRadius(8)
          }
        }
      }

      Spacer()
    }
    .padding(16)
  }
}

// MARK: - Models

struct EmailData {
  let id: String
  let subject: String
  let body: String
  let from: String
}

enum EmailCategory: String {
  case personal = "Personal"
  case work = "Work"
  case promotional = "Promotional"
  case notification = "Notification"
  case other = "Other"
}

enum EmailPriority: String {
  case high = "High"
  case medium = "Medium"
  case low = "Low"
}

struct EmailClassification {
  let category: EmailCategory
  let priority: EmailPriority
  let urgency: String
  let suggestedLabel: String?
}

struct ResponseSuggestion {
  let response: String
  let tone: String
  let length: ResponseLength
}

enum ResponseLength: String {
  case short = "Short"
  case medium = "Medium"
  case long = "Long"
}

// MARK: - Service Mock

class EmailIntelligenceService {
  func suggestComposition(userId: String, accountId: String, subject: String, recipientContext: String) async throws -> [String] {
    // In production, this calls the router client
    return [
      "Hi [Name], I wanted to follow up on the \(subject) topic we discussed last week...",
      "Dear [Name], Following up regarding \(subject). I'd like to share some thoughts...",
      "Hello [Name], I hope this email finds you well. Regarding \(subject)...",
    ]
  }

  func classifyEmail(userId: String, emailId: String, subject: String, body: String, from: String) async throws -> EmailClassification {
    // In production, this calls the router client
    return EmailClassification(
      category: .work,
      priority: .medium,
      urgency: "soon",
      suggestedLabel: "Follow-up"
    )
  }

  func suggestResponses(userId: String, emailId: String, subject: String, body: String, from: String) async throws -> [ResponseSuggestion] {
    // In production, this calls the router client
    return [
      ResponseSuggestion(
        response: "Thank you for reaching out. I've reviewed your message and will get back to you shortly with my thoughts.",
        tone: "Professional",
        length: .medium
      ),
      ResponseSuggestion(
        response: "Thanks for the email. I'll look into this and follow up early next week.",
        tone: "Casual",
        length: .short
      ),
      ResponseSuggestion(
        response: "I appreciate you taking the time to write. After careful consideration of your points, here's my perspective...",
        tone: "Formal",
        length: .long
      ),
    ]
  }
}

func getUserId() -> String {
  return "user-ios-\(UIDevice.current.identifierForVendor?.uuidString ?? "unknown")"
}

#Preview {
  EmailIntelligenceView()
}
