/**
 * Supabase Service
 *
 * Handles all Supabase interactions:
 * - Authentication
 * - Message loading and sending
 * - Real-time subscriptions
 * - Message syncing
 */

import Foundation
import Supabase

@MainActor
class SupabaseService: ObservableObject {
  // MARK: - Published Properties

  @Published var currentUser: User?
  @Published var isAuthenticated = false
  @Published var error: HelixError?

  // MARK: - Private Properties

  private let supabase: SupabaseClient
  private var realtimeSubscription: RealtimeChannelV2?
  private let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString

  // MARK: - Initialization

  init(supabaseUrl: String, supabaseKey: String) {
    self.supabase = SupabaseClient(
      supabaseURL: URL(string: supabaseUrl)!,
      supabaseKey: supabaseKey
    )

    Task {
      await checkAuthStatus()
    }
  }

  // MARK: - Authentication

  /// Sign up with email and password
  func signUp(email: String, password: String) async throws {
    do {
      let response = try await supabase.auth.signUp(
        email: email,
        password: password
      )
      self.currentUser = response.user
      self.isAuthenticated = true
    } catch {
      self.error = HelixError(
        code: "SIGNUP_FAILED",
        message: error.localizedDescription
      )
      throw error
    }
  }

  /// Sign in with email and password
  func signIn(email: String, password: String) async throws {
    do {
      let response = try await supabase.auth.signIn(
        email: email,
        password: password
      )
      self.currentUser = response.user
      self.isAuthenticated = true
    } catch {
      self.error = HelixError(
        code: "SIGNIN_FAILED",
        message: error.localizedDescription
      )
      throw error
    }
  }

  /// Sign out current user
  func signOut() async throws {
    do {
      try await supabase.auth.signOut()
      self.currentUser = nil
      self.isAuthenticated = false
    } catch {
      self.error = HelixError(
        code: "SIGNOUT_FAILED",
        message: error.localizedDescription
      )
      throw error
    }
  }

  /// Check current authentication status
  func checkAuthStatus() async {
    do {
      let user = try await supabase.auth.user()
      self.currentUser = user
      self.isAuthenticated = true
    } catch {
      self.currentUser = nil
      self.isAuthenticated = false
    }
  }

  // MARK: - Conversations

  /// Load all conversations for current user
  func loadConversations() async throws -> [Conversation] {
    guard let userId = currentUser?.id.uuidString else {
      throw HelixError(code: "NOT_AUTHENTICATED", message: "User not authenticated")
    }

    let response = try await supabase
      .from("conversations")
      .select()
      .eq("user_id", value: userId)
      .order("updated_at", ascending: false)
      .execute()

    let conversations = try JSONDecoder().decode(
      [Conversation].self,
      from: response.data
    )
    return conversations
  }

  /// Create a new conversation
  func createConversation(title: String) async throws -> Conversation {
    guard let userId = currentUser?.id.uuidString else {
      throw HelixError(code: "NOT_AUTHENTICATED", message: "User not authenticated")
    }

    let sessionKey = "conv-\(UUID().uuidString)"
    let now = ISO8601DateFormatter().string(from: Date())

    let newConversation = Conversation(
      sessionKey: sessionKey,
      userId: userId,
      title: title,
      createdAt: now,
      updatedAt: now
    )

    let response = try await supabase
      .from("conversations")
      .insert(newConversation)
      .select()
      .single()
      .execute()

    let conversation = try JSONDecoder().decode(
      Conversation.self,
      from: response.data
    )
    return conversation
  }

  /// Subscribe to conversation updates
  func subscribeToConversations(
    userId: String,
    onChange: @escaping ([Conversation]) -> Void
  ) {
    let channel = supabase.realtimeV2.channel("conversations:\(userId)")

    channel.on(.postgresChanges(
      event: .all,
      schema: "public",
      table: "conversations",
      filter: "user_id=eq.\(userId)"
    )) { _ in
      // Reload conversations when changed
      Task { @MainActor in
        do {
          let conversations = try await self.loadConversations()
          onChange(conversations)
        } catch {
          self.error = HelixError(
            code: "SUBSCRIPTION_ERROR",
            message: error.localizedDescription
          )
        }
      }
    }

    Task {
      try await channel.subscribe()
    }

    self.realtimeSubscription = channel
  }

  // MARK: - Messages

  /// Load messages for a conversation
  func loadMessages(sessionKey: String, limit: Int = 50) async throws -> [Message] {
    let response = try await supabase
      .from("session_messages")
      .select()
      .eq("session_key", value: sessionKey)
      .order("timestamp", ascending: true)
      .limit(limit)
      .execute()

    let messages = try JSONDecoder().decode(
      [Message].self,
      from: response.data
    )
    return messages
  }

  /// Send a message
  func sendMessage(
    content: String,
    sessionKey: String,
    clientId: String? = nil
  ) async throws -> Message {
    guard let userId = currentUser?.id.uuidString else {
      throw HelixError(code: "NOT_AUTHENTICATED", message: "User not authenticated")
    }

    let messageId = UUID().uuidString
    let now = ISO8601DateFormatter().string(from: Date())
    let idempotencyKey = clientId ?? UUID().uuidString

    let message = Message(
      id: messageId,
      sessionKey: sessionKey,
      userId: userId,
      role: .user,
      content: content,
      timestamp: now,
      createdAt: now,
      clientId: idempotencyKey,
      isPending: false,
      platform: "ios",
      deviceId: deviceId
    )

    let response = try await supabase
      .from("session_messages")
      .insert(message)
      .select()
      .single()
      .execute()

    let returnedMessage = try JSONDecoder().decode(
      Message.self,
      from: response.data
    )
    return returnedMessage
  }

  /// Subscribe to messages in a conversation
  func subscribeToMessages(
    sessionKey: String,
    onChange: @escaping ([Message]) -> Void
  ) {
    let channel = supabase.realtimeV2.channel("messages:\(sessionKey)")

    channel.on(.postgresChanges(
      event: .insert,
      schema: "public",
      table: "session_messages",
      filter: "session_key=eq.\(sessionKey)"
    )) { _ in
      // Reload messages when new one arrives
      Task { @MainActor in
        do {
          let messages = try await self.loadMessages(sessionKey: sessionKey)
          onChange(messages)
        } catch {
          self.error = HelixError(
            code: "SUBSCRIPTION_ERROR",
            message: error.localizedDescription
          )
        }
      }
    }

    Task {
      try await channel.subscribe()
    }
  }

  // MARK: - Offline Sync

  /// Sync offline messages queue
  func syncMessages(messages: [Message]) async throws -> SyncResponse {
    guard let token = try await supabase.auth.session?.accessToken else {
      throw HelixError(code: "NOT_AUTHENTICATED", message: "No access token")
    }

    let payload: [String: Any] = [
      "deviceId": deviceId,
      "platform": "ios",
      "messages": messages.map { message in
        [
          "clientId": message.clientId,
          "content": message.content,
          "sessionKey": message.sessionKey,
          "role": message.role.rawValue,
        ]
      },
    ]

    let url = supabase.supabaseURL
      .appendingPathComponent("functions")
      .appendingPathComponent("v1")
      .appendingPathComponent("sync-messages")

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONSerialization.data(withJSONObject: payload)

    let (data, response) = try await URLSession.shared.data(for: request)

    guard let httpResponse = response as? HTTPURLResponse else {
      throw HelixError(code: "INVALID_RESPONSE", message: "Invalid response")
    }

    guard (200...299).contains(httpResponse.statusCode) else {
      let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
      throw HelixError(code: "SYNC_FAILED", message: errorMessage)
    }

    let syncResponse = try JSONDecoder().decode(
      SyncResponse.self,
      from: data
    )
    return syncResponse
  }

  // MARK: - Push Notifications (Phase 4.5)

  /// Register device for push notifications (APNs).
  /// Called when APNs device token is received.
  func registerPushDevice(
    deviceToken: String,
    platform: String = "ios"
  ) async -> Bool {
    do {
      guard let userId = currentUser?.id.uuidString else {
        print("Not authenticated, cannot register push device")
        return false
      }

      let deviceData: [String: Any] = [
        "user_id": userId,
        "device_id": deviceId,
        "platform": platform,
        "device_token": deviceToken,
        "is_enabled": true,
        "metadata": [
          "os_version": UIDevice.current.systemVersion,
          "app_version": Bundle.main.appVersion,
          "device_model": UIDevice.current.model,
          "device_name": UIDevice.current.name
        ]
      ]

      // Call register_push_device edge function via RPC
      let response = try await supabase.rpc(
        functionName: "register_push_device",
        params: deviceData
      )

      print("Push device registered successfully")
      return true
    } catch {
      print("Failed to register push device: \(error)")
      self.error = HelixError(
        code: "PUSH_REG_FAILED",
        message: error.localizedDescription
      )
      return false
    }
  }

  /// Unregister device from push notifications.
  /// Called on sign out.
  func unregisterPushDevice() async -> Bool {
    do {
      guard let userId = currentUser?.id.uuidString else {
        return true // Already logged out
      }

      let deviceData: [String: Any] = [
        "user_id": userId,
        "device_id": deviceId
      ]

      // Call unregister_push_device edge function via RPC
      let response = try await supabase.rpc(
        functionName: "unregister_push_device",
        params: deviceData
      )

      print("Push device unregistered")
      return true
    } catch {
      print("Failed to unregister push device: \(error)")
      return false
    }
  }

  /// Update notification preferences for current user.
  func updateNotificationPreferences(
    enablePush: Bool = true,
    enableSound: Bool = true,
    enableBadge: Bool = true,
    quietHoursStart: String? = nil,
    quietHoursEnd: String? = nil
  ) async -> Bool {
    do {
      guard let userId = currentUser?.id.uuidString else {
        return false
      }

      let prefs: [String: Any] = [
        "user_id": userId,
        "enable_push": enablePush,
        "enable_sound": enableSound,
        "enable_badge": enableBadge,
        "quiet_hours_start": quietHoursStart as Any,
        "quiet_hours_end": quietHoursEnd as Any,
        "notify_on_types": ["message", "mention"],
        "max_notifications_per_hour": 20
      ]

      // Call update_notification_preferences edge function via RPC
      let response = try await supabase.rpc(
        functionName: "update_notification_preferences",
        params: prefs
      )

      print("Notification preferences updated")
      return true
    } catch {
      print("Failed to update notification preferences: \(error)")
      return false
    }
  }

  // MARK: - Cleanup

  deinit {
    Task {
      if let subscription = realtimeSubscription {
        try? await subscription.unsubscribe()
      }
    }
  }
}

// MARK: - Sync Response Model

struct SyncResponse: Codable {
  let synced: Int
  let failed: Int
  let errors: [SyncError]

  struct SyncError: Codable {
    let clientId: String?
    let error: String

    enum CodingKeys: String, CodingKey {
      case clientId = "client_id"
      case error
    }
  }
}

// MARK: - Helix Error Model

struct HelixError: Error {
  let code: String
  let message: String
  let details: [String: String]?
  let timestamp: String

  init(
    code: String,
    message: String,
    details: [String: String]? = nil,
    timestamp: String = ISO8601DateFormatter().string(from: Date())
  ) {
    self.code = code
    self.message = message
    self.details = details
    self.timestamp = timestamp
  }
}
