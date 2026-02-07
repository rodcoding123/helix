/**
 * Chat View
 *
 * Main chat interface for iOS.
 * Features:
 * - Message display with bubbles
 * - Message input
 * - Offline indicator
 * - Message timestamps
 * - Real-time message updates
 */

import SwiftUI

struct ChatView: View {
  @StateObject var chatViewModel: ChatViewModel
  @FocusState private var isInputFocused

  var body: some View {
    ZStack {
      VStack(spacing: 0) {
        // Header
        ChatHeaderView(
          conversation: chatViewModel.currentConversation,
          isOnline: chatViewModel.isOnline,
          isSyncing: chatViewModel.isSyncing,
          queueLength: chatViewModel.queueLength
        )

        // Messages
        messagesList

        // Offline Banner
        if !chatViewModel.isOnline {
          OfflineBannerView(
            queueLength: chatViewModel.queueLength,
            onSyncTap: {
              Task {
                await chatViewModel.syncMessages()
              }
            }
          )
        }

        // Input Area
        ChatInputView(
          text: $chatViewModel.messageInput,
          isLoading: chatViewModel.isLoading,
          isOnline: chatViewModel.isOnline,
          onSend: {
            Task {
              await chatViewModel.sendMessage()
            }
          }
        )
        .focused($isInputFocused)
      }
      .background(Color(.systemBackground))
    }
    .navigationTitle(chatViewModel.currentConversation?.title ?? "Chat")
    .navigationBarTitleDisplayMode(.inline)
    .task {
      await chatViewModel.loadMessages()
    }
  }

  private var messagesList: some View {
    ScrollViewReader { proxy in
      List(chatViewModel.messages) { message in
        MessageBubbleView(message: message)
          .id(message.id)
          .listRowSeparator(.hidden)
          .listRowInsets(EdgeInsets())
          .listRowBackground(Color(.systemBackground))
      }
      .listStyle(.plain)
      .onChange(of: chatViewModel.messages.count) { _ in
        // Scroll to latest message
        if let lastMessage = chatViewModel.messages.last {
          withAnimation {
            proxy.scrollTo(lastMessage.id, anchor: .bottom)
          }
        }
      }
      .onAppear {
        if let lastMessage = chatViewModel.messages.last {
          proxy.scrollTo(lastMessage.id, anchor: .bottom)
        }
      }
    }
  }
}

// MARK: - Chat Header View

struct ChatHeaderView: View {
  let conversation: Conversation?
  let isOnline: Bool
  let isSyncing: Bool
  let queueLength: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        VStack(alignment: .leading, spacing: 2) {
          Text(conversation?.title ?? "Chat")
            .font(.headline)

          HStack(spacing: 4) {
            Circle()
              .fill(isOnline ? Color.green : Color.orange)
              .frame(width: 8, height: 8)

            Text(isOnline ? "Online" : "Offline")
              .font(.caption)
              .foregroundColor(.secondary)

            if isSyncing {
              ProgressView()
                .scaleEffect(0.8, anchor: .center)
            }

            if queueLength > 0 {
              Text("(\(queueLength) pending)")
                .font(.caption)
                .foregroundColor(.orange)
            }
          }
        }

        Spacer()
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
    }
    .background(Color(.secondarySystemBackground))
    .border(width: 1, edges: [.bottom], color: Color(.separator))
  }
}

// MARK: - Message Bubble View

struct MessageBubbleView: View {
  let message: Message

  var isUser: Bool {
    message.isUser
  }

  var body: some View {
    HStack(alignment: .bottom, spacing: 8) {
      if isUser {
        Spacer()
      }

      VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
        Text(message.content)
          .padding(12)
          .background(isUser ? Color.blue : Color(.secondarySystemBackground))
          .foregroundColor(isUser ? .white : .primary)
          .cornerRadius(12)

        HStack(spacing: 4) {
          if message.needsSync {
            Image(systemName: "clock.badge.xmark")
              .font(.caption2)
              .foregroundColor(.orange)
          }

          Text(message.formattedTime)
            .font(.caption2)
            .foregroundColor(.secondary)
        }
        .padding(.horizontal, 12)
      }

      if !isUser {
        Spacer()
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 8)
  }
}

// MARK: - Offline Banner View

struct OfflineBannerView: View {
  let queueLength: Int
  let onSyncTap: () -> Void

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "wifi.slash")
        .foregroundColor(.orange)

      VStack(alignment: .leading, spacing: 2) {
        Text("Offline Mode")
          .font(.caption)
          .fontWeight(.semibold)

        if queueLength > 0 {
          Text("\(queueLength) message\(queueLength != 1 ? "s" : "") queued")
            .font(.caption2)
            .foregroundColor(.secondary)
        } else {
          Text("Messages will sync when online")
            .font(.caption2)
            .foregroundColor(.secondary)
        }
      }

      Spacer()

      if queueLength > 0 {
        Button(action: onSyncTap) {
          Text("Sync")
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundColor(.blue)
        }
      }
    }
    .padding(12)
    .background(Color(.systemOrange).opacity(0.1))
    .border(width: 1, edges: [.top, .bottom], color: Color(.systemOrange))
  }
}

// MARK: - Chat Input View

struct ChatInputView: View {
  @Binding var text: String
  let isLoading: Bool
  let isOnline: Bool
  let onSend: () -> Void

  var body: some View {
    HStack(spacing: 8) {
      TextField(
        isOnline ? "Message..." : "Offline - messages will queue...",
        text: $text
      )
      .textFieldStyle(.roundedBorder)
      .disabled(isLoading)

      if isLoading {
        ProgressView()
          .frame(width: 24, height: 24)
      } else {
        Button(action: onSend) {
          Image(systemName: "paperplane.fill")
            .foregroundColor(.blue)
        }
        .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
      }
    }
    .padding(12)
    .background(Color(.secondarySystemBackground))
    .border(width: 1, edges: [.top], color: Color(.separator))
  }
}

// MARK: - Helper Extension

extension View {
  func border(width: CGFloat, edges: [Edge], color: Color) -> some View {
    overlay(
      VStack(spacing: 0) {
        if edges.contains(.top) {
          color.frame(height: width)
        }

        Spacer()

        if edges.contains(.bottom) {
          color.frame(height: width)
        }
      },
      alignment: .center
    )
  }
}

#Preview {
  NavigationStack {
    ChatView(
      chatViewModel: ChatViewModel(
        supabaseService: SupabaseService(
          supabaseUrl: "",
          supabaseKey: ""
        ),
        conversation: .mock
      )
    )
  }
}
