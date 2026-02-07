/**
 * Conversation List View
 *
 * Displays all user conversations and allows selection/creation of new conversations.
 * Syncs in real-time with Supabase backend.
 */

import SwiftUI

@MainActor
class ConversationListViewModel: ObservableObject {
  @Published var conversations: [Conversation] = []
  @Published var isLoading = false
  @Published var error: HelixError?
  @Published var searchText = ""

  private let supabaseService: SupabaseService
  private var subscriptionTask: Task<Void, Never>?

  init(supabaseService: SupabaseService) {
    self.supabaseService = supabaseService
  }

  var filteredConversations: [Conversation] {
    if searchText.isEmpty {
      return conversations
    }
    return conversations.filter { conversation in
      conversation.title.localizedCaseInsensitiveContains(searchText) ||
      conversation.description?.localizedCaseInsensitiveContains(searchText) ?? false
    }
  }

  func loadConversations() {
    isLoading = true
    defer { isLoading = false }

    subscriptionTask = Task {
      do {
        // Load initial conversations
        let loadedConversations = try await supabaseService.loadConversations()
        await MainActor.run {
          self.conversations = loadedConversations
        }

        // Subscribe to real-time updates
        try await supabaseService.subscribeToConversations { [weak self] updatedConversations in
          Task { @MainActor in
            self?.conversations = updatedConversations
          }
        }
      } catch {
        await MainActor.run {
          self.error = error as? HelixError ?? HelixError(
            code: "LOAD_FAILED",
            message: error.localizedDescription
          )
        }
      }
    }
  }

  func createNewConversation() async -> Conversation? {
    do {
      let conversation = try await supabaseService.createConversation(
        title: "New Conversation"
      )
      return conversation
    } catch {
      self.error = error as? HelixError ?? HelixError(
        code: "CREATE_FAILED",
        message: error.localizedDescription
      )
      return nil
    }
  }

  func deleteConversation(_ conversation: Conversation) {
    conversations.removeAll { $0.sessionKey == conversation.sessionKey }
  }

  deinit {
    subscriptionTask?.cancel()
  }
}

struct ConversationListView: View {
  @StateObject private var viewModel: ConversationListViewModel
  @State private var selectedConversation: Conversation?
  @State private var isCreatingNew = false
  @Environment(\.dismiss) var dismiss

  init(supabaseService: SupabaseService) {
    _viewModel = StateObject(wrappedValue: ConversationListViewModel(supabaseService: supabaseService))
  }

  var body: some View {
    NavigationStack {
      ZStack {
        if viewModel.isLoading && viewModel.conversations.isEmpty {
          ProgressView()
            .scaleEffect(1.5)
        } else if viewModel.conversations.isEmpty {
          VStack(spacing: 16) {
            Image(systemName: "bubble.left")
              .font(.system(size: 48))
              .foregroundColor(.gray)

            Text("No Conversations")
              .font(.headline)

            Text("Start a new conversation with Helix")
              .font(.subheadline)
              .foregroundColor(.secondary)

            Button(action: { isCreatingNew = true }) {
              Label("New Conversation", systemImage: "plus")
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(8)
            }
            .padding()

            Spacer()
          }
          .padding()
        } else {
          List {
            ForEach(viewModel.filteredConversations) { conversation in
              NavigationLink(
                destination: ChatView(
                  supabaseService: viewModel.supabaseService,
                  conversation: conversation
                )
              ) {
                ConversationRowView(conversation: conversation)
              }
            }
            .onDelete { indices in
              for index in indices {
                let conversation = viewModel.filteredConversations[index]
                viewModel.deleteConversation(conversation)
              }
            }
          }
          .listStyle(.plain)
          .searchable(
            text: $viewModel.searchText,
            prompt: "Search conversations"
          )
        }
      }
      .navigationTitle("Conversations")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .navigationBarTrailing) {
          Button(action: { isCreatingNew = true }) {
            Image(systemName: "plus")
              .font(.headline)
          }
        }
      }
      .onAppear {
        viewModel.loadConversations()
      }
      .alert("Error", isPresented: .constant(viewModel.error != nil)) {
        Button("OK") {
          viewModel.error = nil
        }
      } message: {
        if let error = viewModel.error {
          Text(error.message)
        }
      }
    }
    .sheet(isPresented: $isCreatingNew) {
      CreateConversationSheet(
        supabaseService: viewModel.supabaseService,
        isPresented: $isCreatingNew
      ) { newConversation in
        viewModel.conversations.insert(newConversation, at: 0)
        selectedConversation = newConversation
      }
    }
  }
}

struct ConversationRowView: View {
  let conversation: Conversation

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(conversation.title)
        .font(.headline)
        .lineLimit(1)

      if let description = conversation.description {
        Text(description)
          .font(.subheadline)
          .foregroundColor(.secondary)
          .lineLimit(2)
      }

      HStack(spacing: 8) {
        Label(
          String(conversation.messageCount),
          systemImage: "bubble.left"
        )
        .font(.caption)
        .foregroundColor(.secondary)

        Spacer()

        Text(conversation.formattedLastMessageAt ?? conversation.formattedCreatedAt)
          .font(.caption)
          .foregroundColor(.secondary)
      }
    }
    .padding(.vertical, 4)
  }
}

struct CreateConversationSheet: View {
  let supabaseService: SupabaseService
  @Binding var isPresented: Bool
  let onCreated: (Conversation) -> Void

  @State private var title = ""
  @State private var isLoading = false
  @State private var error: HelixError?
  @Environment(\.dismiss) var dismiss

  var body: some View {
    NavigationStack {
      VStack(spacing: 16) {
        Text("New Conversation")
          .font(.headline)
          .frame(maxWidth: .infinity, alignment: .leading)

        VStack(alignment: .leading, spacing: 4) {
          Text("Title")
            .font(.subheadline)
            .foregroundColor(.secondary)

          TextField("Conversation title", text: $title)
            .textFieldStyle(.roundedBorder)
            .padding(.vertical, 4)
        }

        Spacer()

        HStack(spacing: 12) {
          Button("Cancel") {
            isPresented = false
          }
          .frame(maxWidth: .infinity)
          .padding()
          .background(Color.gray.opacity(0.2))
          .foregroundColor(.primary)
          .cornerRadius(8)

          Button(action: createConversation) {
            if isLoading {
              ProgressView()
                .tint(.white)
            } else {
              Text("Create")
            }
          }
          .frame(maxWidth: .infinity)
          .padding()
          .background(Color.blue)
          .foregroundColor(.white)
          .cornerRadius(8)
          .disabled(title.isEmpty || isLoading)
        }
      }
      .padding()
      .alert("Error", isPresented: .constant(error != nil)) {
        Button("OK") {
          error = nil
        }
      } message: {
        if let error = error {
          Text(error.message)
        }
      }
    }
  }

  private func createConversation() {
    isLoading = true
    defer { isLoading = false }

    Task {
      do {
        let conversation = try await supabaseService.createConversation(title: title)
        await MainActor.run {
          onCreated(conversation)
          isPresented = false
        }
      } catch {
        await MainActor.run {
          self.error = error as? HelixError ?? HelixError(
            code: "CREATE_FAILED",
            message: error.localizedDescription
          )
        }
      }
    }
  }
}

#Preview {
  ConversationListView(supabaseService: SupabaseService())
}
