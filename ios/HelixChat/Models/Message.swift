/**
 * Message Model
 *
 * Represents a single message in a conversation.
 * Conforms to:
 * - Codable: For JSON serialization with Supabase
 * - Identifiable: For SwiftUI list rendering
 * - Hashable: For set operations and caching
 */

import Foundation

struct Message: Codable, Identifiable, Hashable {
  let id: String              // UUID
  let sessionKey: String      // Conversation identifier
  let userId: String          // UUID of sender
  let role: MessageRole       // user, assistant, system
  let content: String
  let timestamp: String       // ISO 8601
  let createdAt: String       // ISO 8601

  // Offline sync tracking
  let clientId: String?           // Idempotency key
  var isPending: Bool = false     // Not yet synced
  let syncedAt: String?           // When synced
  let platform: String?           // Origin platform
  let deviceId: String?           // Device fingerprint

  // Metadata
  let metadata: MessageMetadata?

  // Tool execution
  let toolCalls: [ToolCall]?
  let toolResults: [ToolResult]?

  // Extended thinking
  let thinking: String?

  enum CodingKeys: String, CodingKey {
    case id
    case sessionKey = "session_key"
    case userId = "user_id"
    case role
    case content
    case timestamp
    case createdAt = "created_at"
    case clientId = "client_id"
    case isPending = "is_pending"
    case syncedAt = "synced_at"
    case platform
    case deviceId = "device_id"
    case metadata
    case toolCalls = "tool_calls"
    case toolResults = "tool_results"
    case thinking
  }

  enum MessageRole: String, Codable, Equatable {
    case user
    case assistant
    case system
  }

  struct MessageMetadata: Codable, Equatable {
    let idempotencyKey: String?
    let optimistic: Bool?
    let priority: String?  // low, normal, high
    let tags: [String]?
    let custom: [String: AnyCodable]?

    enum CodingKeys: String, CodingKey {
      case idempotencyKey = "idempotency_key"
      case optimistic
      case priority
      case tags
      case custom
    }
  }

  // MARK: - Computed Properties

  /// Whether this message is from the assistant
  var isAssistant: Bool {
    role == .assistant
  }

  /// Whether this message is from the user
  var isUser: Bool {
    role == .user
  }

  /// Whether this message hasn't been synced yet
  var needsSync: Bool {
    isPending
  }

  /// Formatted timestamp for display
  var formattedTime: String {
    let dateFormatter = ISO8601DateFormatter()
    if let date = dateFormatter.date(from: timestamp) {
      let displayFormatter = DateFormatter()
      displayFormatter.timeStyle = .short
      return displayFormatter.string(from: date)
    }
    return timestamp
  }

  /// Formatted date for display
  var formattedDate: String {
    let dateFormatter = ISO8601DateFormatter()
    if let date = dateFormatter.date(from: timestamp) {
      let displayFormatter = DateFormatter()
      displayFormatter.dateStyle = .medium
      return displayFormatter.string(from: date)
    }
    return timestamp
  }

  // MARK: - Initialization

  init(
    id: String = UUID().uuidString,
    sessionKey: String,
    userId: String,
    role: MessageRole,
    content: String,
    timestamp: String = ISO8601DateFormatter().string(from: Date()),
    createdAt: String = ISO8601DateFormatter().string(from: Date()),
    clientId: String? = nil,
    isPending: Bool = false,
    syncedAt: String? = nil,
    platform: String? = "ios",
    deviceId: String? = nil,
    metadata: MessageMetadata? = nil,
    toolCalls: [ToolCall]? = nil,
    toolResults: [ToolResult]? = nil,
    thinking: String? = nil
  ) {
    self.id = id
    self.sessionKey = sessionKey
    self.userId = userId
    self.role = role
    self.content = content
    self.timestamp = timestamp
    self.createdAt = createdAt
    self.clientId = clientId
    self.isPending = isPending
    self.syncedAt = syncedAt
    self.platform = platform
    self.deviceId = deviceId
    self.metadata = metadata
    self.toolCalls = toolCalls
    self.toolResults = toolResults
    self.thinking = thinking
  }

  // MARK: - Hashable Conformance

  func hash(into hasher: inout Hasher) {
    hasher.combine(id)
  }

  static func == (lhs: Message, rhs: Message) -> Bool {
    lhs.id == rhs.id && lhs.isPending == rhs.isPending
  }
}

// MARK: - Tool Execution

struct ToolCall: Codable, Identifiable, Hashable {
  let id: String
  let name: String
  let input: [String: AnyCodable]
  let status: ToolStatus

  enum ToolStatus: String, Codable {
    case pending
    case running
    case completed
    case failed
  }

  func hash(into hasher: inout Hasher) {
    hasher.combine(id)
  }

  static func == (lhs: ToolCall, rhs: ToolCall) -> Bool {
    lhs.id == rhs.id
  }
}

struct ToolResult: Codable, Hashable {
  let toolCallId: String
  let output: AnyCodable?
  let error: String?

  enum CodingKeys: String, CodingKey {
    case toolCallId = "tool_call_id"
    case output
    case error
  }

  func hash(into hasher: inout Hasher) {
    hasher.combine(toolCallId)
  }

  static func == (lhs: ToolResult, rhs: ToolResult) -> Bool {
    lhs.toolCallId == rhs.toolCallId
  }
}

// MARK: - AnyCodable Helper

/// Wrapper for encoding/decoding arbitrary JSON values
enum AnyCodable: Codable, Hashable {
  case null
  case bool(Bool)
  case int(Int)
  case double(Double)
  case string(String)
  case array([AnyCodable])
  case object([String: AnyCodable])

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()

    if container.decodeNil() {
      self = .null
    } else if let bool = try? container.decode(Bool.self) {
      self = .bool(bool)
    } else if let int = try? container.decode(Int.self) {
      self = .int(int)
    } else if let double = try? container.decode(Double.self) {
      self = .double(double)
    } else if let string = try? container.decode(String.self) {
      self = .string(string)
    } else if let array = try? container.decode([AnyCodable].self) {
      self = .array(array)
    } else if let object = try? container.decode([String: AnyCodable].self) {
      self = .object(object)
    } else {
      throw DecodingError.dataCorruptedError(
        in: container,
        debugDescription: "Cannot decode AnyCodable"
      )
    }
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()

    switch self {
    case .null:
      try container.encodeNil()
    case .bool(let value):
      try container.encode(value)
    case .int(let value):
      try container.encode(value)
    case .double(let value):
      try container.encode(value)
    case .string(let value):
      try container.encode(value)
    case .array(let value):
      try container.encode(value)
    case .object(let value):
      try container.encode(value)
    }
  }

  func hash(into hasher: inout Hasher) {
    switch self {
    case .null:
      hasher.combine(0)
    case .bool(let value):
      hasher.combine(1)
      hasher.combine(value)
    case .int(let value):
      hasher.combine(2)
      hasher.combine(value)
    case .double(let value):
      hasher.combine(3)
      hasher.combine(value.bitPattern)
    case .string(let value):
      hasher.combine(4)
      hasher.combine(value)
    case .array(let value):
      hasher.combine(5)
      hasher.combine(value)
    case .object(let value):
      hasher.combine(6)
      hasher.combine(value)
    }
  }

  static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
    switch (lhs, rhs) {
    case (.null, .null):
      return true
    case let (.bool(a), .bool(b)):
      return a == b
    case let (.int(a), .int(b)):
      return a == b
    case let (.double(a), .double(b)):
      return a == b
    case let (.string(a), .string(b)):
      return a == b
    case let (.array(a), .array(b)):
      return a == b
    case let (.object(a), .object(b)):
      return a == b
    default:
      return false
    }
  }
}
