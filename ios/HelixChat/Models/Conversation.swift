/**
 * Conversation Model
 *
 * Represents a single conversation/session with Helix.
 * Conforms to:
 * - Codable: For JSON serialization with Supabase
 * - Identifiable: For SwiftUI list rendering
 */

import Foundation

struct Conversation: Codable, Identifiable, Hashable {
  let sessionKey: String      // Unique identifier
  let userId: String          // UUID
  let title: String           // Auto-generated or user-provided
  let description: String?    // Optional description
  let createdAt: String       // ISO 8601
  let updatedAt: String       // ISO 8601
  let lastMessageAt: String?  // ISO 8601
  let messageCount: Int       // Number of messages
  let metadata: ConversationMetadata?

  var id: String {
    sessionKey
  }

  enum CodingKeys: String, CodingKey {
    case sessionKey = "session_key"
    case userId = "user_id"
    case title
    case description
    case createdAt = "created_at"
    case updatedAt = "updated_at"
    case lastMessageAt = "last_message_at"
    case messageCount = "message_count"
    case metadata
  }

  struct ConversationMetadata: Codable, Equatable {
    let model: String?
    let agent: AgentInfo?
    let tags: [String]?
    let archived: Bool?
    let starred: Bool?
    let custom: [String: AnyCodable]?
  }

  struct AgentInfo: Codable, Equatable {
    let id: String
    let name: String
  }

  // MARK: - Computed Properties

  /// Whether conversation is archived
  var isArchived: Bool {
    metadata?.archived ?? false
  }

  /// Whether conversation is starred
  var isStarred: Bool {
    metadata?.starred ?? false
  }

  /// Formatted creation date for display
  var formattedCreatedAt: String {
    let dateFormatter = ISO8601DateFormatter()
    if let date = dateFormatter.date(from: createdAt) {
      let displayFormatter = DateFormatter()
      displayFormatter.dateStyle = .medium
      displayFormatter.timeStyle = .short
      return displayFormatter.string(from: date)
    }
    return createdAt
  }

  /// Formatted last message date
  var formattedLastMessageAt: String? {
    guard let lastMessageAt = lastMessageAt else { return nil }
    let dateFormatter = ISO8601DateFormatter()
    if let date = dateFormatter.date(from: lastMessageAt) {
      let now = Date()
      let calendar = Calendar.current

      if calendar.isDateInToday(date) {
        let timeFormatter = DateFormatter()
        timeFormatter.timeStyle = .short
        return timeFormatter.string(from: date)
      } else if calendar.isDateInYesterday(date) {
        return "Yesterday"
      } else {
        let dayFormatter = DateFormatter()
        dayFormatter.dateStyle = .short
        return dayFormatter.string(from: date)
      }
    }
    return lastMessageAt
  }

  /// Whether conversation was updated recently (within 24 hours)
  var isRecent: Bool {
    let dateFormatter = ISO8601DateFormatter()
    if let date = dateFormatter.date(from: updatedAt) {
      let dayAgo = Date(timeIntervalSinceNow: -86400)
      return date > dayAgo
    }
    return false
  }

  // MARK: - Initialization

  init(
    sessionKey: String,
    userId: String,
    title: String,
    description: String? = nil,
    createdAt: String = ISO8601DateFormatter().string(from: Date()),
    updatedAt: String = ISO8601DateFormatter().string(from: Date()),
    lastMessageAt: String? = nil,
    messageCount: Int = 0,
    metadata: ConversationMetadata? = nil
  ) {
    self.sessionKey = sessionKey
    self.userId = userId
    self.title = title
    self.description = description
    self.createdAt = createdAt
    self.updatedAt = updatedAt
    self.lastMessageAt = lastMessageAt
    self.messageCount = messageCount
    self.metadata = metadata
  }

  // MARK: - Hashable Conformance

  func hash(into hasher: inout Hasher) {
    hasher.combine(sessionKey)
  }

  static func == (lhs: Conversation, rhs: Conversation) -> Bool {
    lhs.sessionKey == rhs.sessionKey
  }
}

// MARK: - Test/Mock Data

extension Conversation {
  static let mock = Conversation(
    sessionKey: "conv-123",
    userId: "user-456",
    title: "Chat with Helix",
    description: "Testing conversation",
    messageCount: 5,
    metadata: .init(
      model: "claude-opus-4.6",
      agent: .init(id: "helix", name: "Helix"),
      tags: ["test"],
      archived: false,
      starred: true
    )
  )

  static let mockArchived = Conversation(
    sessionKey: "conv-456",
    userId: "user-456",
    title: "Old Conversation",
    messageCount: 10,
    metadata: .init(
      archived: true,
      starred: false
    )
  )
}
