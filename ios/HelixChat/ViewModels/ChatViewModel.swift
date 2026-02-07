/**
 * Chat View Model
 *
 * Manages chat state and interactions.
 * Coordinates between:
 * - SupabaseService (remote API)
 * - OfflineSyncService (offline queue)
 * - SwiftUI views
 */

import Foundation
import Combine

@MainActor
class ChatViewModel: ObservableObject {
  // MARK: - Published Properties

  @Published var messages: [Message] = []
  @Published var messageInput: String = ""
  @Published var currentConversation: Conversation?
  @Published var isLoading = false
  @Published var error: HelixError?

  // From sync service
  @Published var isOnline = true
  @Published var isSyncing = false
  @Published var queueLength = 0
  @Published var failedCount = 0

  // MARK: - Private Properties

  private let supabaseService: SupabaseService
  private let offlineSyncService: OfflineSyncService
  private var cancellables = Set<AnyCancellable>()

  // MARK: - Initialization

  init(
    supabaseService: SupabaseService,
    offlineSyncService: OfflineSyncService = OfflineSyncService(
      coreDataStack: .shared
    ),
    conversation: Conversation
  ) {
    self.supabaseService = supabaseService
    self.offlineSyncService = offlineSyncService
    self.currentConversation = conversation

    setupBindings()
  }

  // MARK: - Setup

  private func setupBindings() {
    // Bind offline sync service properties
    offlineSyncService.$isOnline
      .assign(to: &$isOnline)

    offlineSyncService.$isSyncing
      .assign(to: &$isSyncing)

    offlineSyncService.$queueLength
      .assign(to: &$queueLength)

    offlineSyncService.$failedCount
      .assign(to: &$failedCount)
  }

  // MARK: - Message Operations

  /// Load messages for current conversation
  func loadMessages() async {
    guard let sessionKey = currentConversation?.sessionKey else { return }

    isLoading = true
    defer { isLoading = false }

    do {
      messages = try await supabaseService.loadMessages(sessionKey: sessionKey)

      // Subscribe to new messages
      supabaseService.subscribeToMessages(sessionKey: sessionKey) { [weak self] updatedMessages in
        self?.messages = updatedMessages
      }
    } catch {
      self.error = error as? HelixError ?? HelixError(
        code: "LOAD_FAILED",
        message: error.localizedDescription
      )
    }
  }

  /// Send a message
  func sendMessage() async {
    let content = messageInput.trimmingCharacters(in: .whitespaces)
    guard !content.isEmpty,
          let sessionKey = currentConversation?.sessionKey
    else { return }

    messageInput = ""
    isLoading = true
    defer { isLoading = false }

    let clientId = UUID().uuidString
    let timestamp = ISO8601DateFormatter().string(from: Date())

    // Create optimistic message
    let optimisticMessage = Message(
      id: UUID().uuidString,
      sessionKey: sessionKey,
      userId: supabaseService.currentUser?.id.uuidString ?? "",
      role: .user,
      content: content,
      timestamp: timestamp,
      clientId: clientId,
      isPending: !isOnline,
      platform: "ios"
    )

    // Add to UI immediately
    messages.append(optimisticMessage)

    do {
      if isOnline {
        // Send directly to Supabase
        let sentMessage = try await supabaseService.sendMessage(
          content: content,
          sessionKey: sessionKey,
          clientId: clientId
        )

        // Update UI with actual message
        if let index = messages.firstIndex(where: { $0.id == optimisticMessage.id }) {
          messages[index] = sentMessage
        }
      } else {
        // Queue for later sync
        try offlineSyncService.queueMessage(optimisticMessage, sessionKey: sessionKey)
      }
    } catch {
      // Remove optimistic message on error
      messages.removeAll { $0.id == optimisticMessage.id }

      self.error = error as? HelixError ?? HelixError(
        code: "SEND_FAILED",
        message: error.localizedDescription
      )
    }
  }

  // MARK: - Sync Operations

  /// Manually sync offline messages
  func syncMessages() async {
    await offlineSyncService.attemptSync()
  }

  /// Retry failed messages
  func retryFailedMessages() async {
    let failedMessages = offlineSyncService.getFailedMessages()
    guard !failedMessages.isEmpty else { return }

    // Reset retries and sync again
    for item in failedMessages {
      item.retries = 0
    }

    await syncMessages()
  }

  /// Clear offline queue
  func clearQueue() {
    offlineSyncService.clearQueue()
  }

  // MARK: - Cleanup

  deinit {
    cancellables.removeAll()
  }
}

// MARK: - Stub Classes for Compilation

extension OfflineSyncService {
  func getFailedMessages() -> [QueuedMessageEntity] {
    []
  }

  func clearQueue() {}
}
