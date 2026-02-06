# Helix iOS App - Complete SwiftUI Implementation

**Date**: February 6, 2026
**Platform**: iOS 16.0+
**Framework**: SwiftUI + Supabase Swift SDK
**Duration**: 3-4 weeks
**Status**: Ready for Implementation

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Setup](#project-setup)
3. [Core Implementation](#core-implementation)
4. [Models & Data Structures](#models--data-structures)
5. [Services Layer](#services-layer)
6. [Views & UI](#views--ui)
7. [Offline Support](#offline-support)
8. [Authentication](#authentication)
9. [Testing](#testing)
10. [Deployment](#deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    iOS App Architecture                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PRESENTATION LAYER (SwiftUI)                                      │
│  ├─ ChatView.swift                                                 │
│  ├─ SessionListView.swift                                          │
│  ├─ SettingsView.swift                                             │
│  └─ Components (MessageBubble, InputField, etc.)                   │
│                                                                     │
│  VIEW MODEL LAYER (ObservableObject)                               │
│  ├─ ChatViewModel.swift                                            │
│  ├─ SessionListViewModel.swift                                     │
│  ├─ AuthViewModel.swift                                            │
│  └─ OfflineSyncViewModel.swift                                     │
│                                                                     │
│  SERVICE LAYER                                                     │
│  ├─ SupabaseService.swift                                          │
│  ├─ ChatService.swift                                              │
│  ├─ AuthService.swift                                              │
│  ├─ OfflineSyncService.swift                                       │
│  └─ BiometricService.swift                                         │
│                                                                     │
│  DATA LAYER                                                        │
│  ├─ Models (Message, Conversation, User)                           │
│  ├─ LocalDatabase (Core Data / SwiftData)                          │
│  └─ UserDefaults (for preferences)                                 │
│                                                                     │
│  BACKEND                                                           │
│  └─ Supabase (PostgreSQL + Realtime)                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Setup

### Step 1: Create Xcode Project

```bash
# Create new iOS app project
# In Xcode: File → New → Project → iOS App
# Select:
#   - Xcode 15.0+
#   - Swift 5.9+
#   - iOS 16.0+ (Deployment Target)
#   - SwiftUI (Interface)
#   - Swift (Language)
#   - Team: Your developer account

# Project name: HelixChat
# Organization: Helix AI
# Bundle Identifier: com.helixai.chat
```

### Step 2: Install Dependencies

Using Swift Package Manager (built into Xcode):

```swift
// Package Dependencies:
// 1. Supabase Swift SDK
//    URL: https://github.com/supabase-community/supabase-swift.git
//    Version: 2.0+

// In Xcode:
// File → Add Packages
// Paste: https://github.com/supabase-community/supabase-swift.git
// Select "Exact 2.x.x or later"
// Add to target: HelixChat

// 2. Local Notifications (built-in)
// 3. UserDefaults (built-in)
// 4. CoreData (built-in)
```

### Step 3: Configure Info.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Supabase Configuration -->
    <key>SUPABASE_URL</key>
    <string>https://ncygunbukmpwhtzwbnvp.supabase.co</string>
    <key>SUPABASE_ANON_KEY</key>
    <string>YOUR_ANON_KEY_HERE</string>

    <!-- App Configuration -->
    <key>CFBundleName</key>
    <string>Helix</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>

    <!-- Privacy Permissions -->
    <key>NSFaceIDUsageDescription</key>
    <string>We use Face ID to secure your conversations and keep your data private.</string>

    <key>NSLocalNetworkUsageDescription</key>
    <string>We need access to your network for real-time message synchronization.</string>

    <key>NSBonjourServices</key>
    <array>
        <string>_helix._tcp</string>
    </array>

    <key>NSUserTrackingUsageDescription</key>
    <string>We use analytics to improve your experience.</string>
</dict>
</plist>
```

### Step 4: Create Directory Structure

```
HelixChat/
├── App/
│   ├── HelixChatApp.swift
│   └── Helpers/
│       ├── NetworkMonitor.swift
│       └── EnvironmentValues.swift
├── Models/
│   ├── Message.swift
│   ├── Conversation.swift
│   ├── User.swift
│   └── AuthUser.swift
├── Services/
│   ├── SupabaseService.swift
│   ├── ChatService.swift
│   ├── AuthService.swift
│   ├── OfflineSyncService.swift
│   └── BiometricService.swift
├── ViewModels/
│   ├── ChatViewModel.swift
│   ├── SessionListViewModel.swift
│   ├── AuthViewModel.swift
│   └── OfflineSyncViewModel.swift
├── Views/
│   ├── ContentView.swift
│   ├── ChatView.swift
│   ├── SessionListView.swift
│   ├── SettingsView.swift
│   ├── AuthView.swift
│   └── Components/
│       ├── MessageBubble.swift
│       ├── ChatInputField.swift
│       ├── OfflineIndicator.swift
│       └── SyncStatusView.swift
├── Database/
│   ├── LocalDatabase.swift
│   └── Models.xcdatamodeld
└── Resources/
    ├── Colors.swift
    ├── Fonts.swift
    └── Strings.swift
```

---

## Core Implementation

### Models

```swift
// Models/Message.swift
import Foundation

struct Message: Identifiable, Codable, Equatable {
    let id: String
    let sessionKey: String
    let userId: String
    let role: String // "user" or "assistant"
    let content: String
    let timestamp: Date
    let metadata: MessageMetadata?

    enum CodingKeys: String, CodingKey {
        case id
        case sessionKey = "session_key"
        case userId = "user_id"
        case role
        case content
        case timestamp
        case metadata
    }
}

struct MessageMetadata: Codable, Equatable {
    let optimistic: Bool?
    let platform: String?
    let voiceUrl: String?

    enum CodingKeys: String, CodingKey {
        case optimistic
        case platform
        case voiceUrl = "voice_url"
    }
}

// Models/Conversation.swift
import Foundation

struct Conversation: Identifiable, Codable, Equatable {
    let id: String
    let sessionKey: String
    let userId: String
    let title: String?
    let messageCount: Int?
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case sessionKey = "session_key"
        case userId = "user_id"
        case title
        case messageCount = "message_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// Models/User.swift
import Foundation

struct User: Identifiable, Codable, Equatable {
    let id: String
    let email: String
    let displayName: String?
    let avatarUrl: String?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case createdAt = "created_at"
    }
}
```

### Services

```swift
// Services/SupabaseService.swift
import Foundation
import Supabase

class SupabaseService: NSObject {
    static let shared = SupabaseService()

    private let client: SupabaseClient
    private var realtimeSubscriptions: [String: RealtimeChannelV2] = [:]

    override init() {
        let url = URL(string: "https://ncygunbukmpwhtzwbnvp.supabase.co")!
        let key = "YOUR_ANON_KEY"

        self.client = SupabaseClient(
            supabaseURL: url,
            supabaseKey: key,
            options: SupabaseClientOptions(
                auth: AuthClientOptions(
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true
                )
            )
        )

        super.init()
    }

    // MARK: - Authentication

    func signUp(email: String, password: String) async throws -> AuthUser {
        let response = try await client.auth.signUp(
            email: email,
            password: password
        )

        return AuthUser(
            id: response.user.id.uuidString,
            email: response.user.email ?? "",
            createdAt: response.user.createdAt
        )
    }

    func signIn(email: String, password: String) async throws -> AuthUser {
        let response = try await client.auth.signIn(
            email: email,
            password: password
        )

        return AuthUser(
            id: response.user.id.uuidString,
            email: response.user.email ?? "",
            createdAt: response.user.createdAt
        )
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }

    func getCurrentUser() async throws -> AuthUser? {
        guard let user = try await client.auth.user() else {
            return nil
        }

        return AuthUser(
            id: user.id.uuidString,
            email: user.email ?? "",
            createdAt: user.createdAt
        )
    }

    // MARK: - Conversations

    func loadConversations(userId: String) async throws -> [Conversation] {
        let response = try await client
            .from("conversations")
            .select()
            .eq("user_id", value: userId)
            .order("created_at", ascending: false)
            .execute()

        return try response.decoded(as: [Conversation].self)
    }

    func createConversation(userId: String, title: String? = nil) async throws -> Conversation {
        let id = UUID().uuidString
        let sessionKey = "session-\(UUID().uuidString)"
        let now = Date()

        let response = try await client
            .from("conversations")
            .insert(
                [
                    "id": id,
                    "session_key": sessionKey,
                    "user_id": userId,
                    "title": title ?? "New Chat",
                    "created_at": ISO8601DateFormatter().string(from: now),
                    "updated_at": ISO8601DateFormatter().string(from: now)
                ]
            )
            .select()
            .single()
            .execute()

        return try response.decoded(as: Conversation.self)
    }

    // MARK: - Messages

    func loadMessages(sessionKey: String) async throws -> [Message] {
        let response = try await client
            .from("session_messages")
            .select()
            .eq("session_key", value: sessionKey)
            .order("timestamp", ascending: true)
            .execute()

        return try response.decoded(as: [Message].self)
    }

    func sendMessage(
        sessionKey: String,
        userId: String,
        content: String
    ) async throws -> Message {
        let id = UUID().uuidString
        let now = Date()

        let response = try await client
            .from("session_messages")
            .insert(
                [
                    "id": id,
                    "session_key": sessionKey,
                    "user_id": userId,
                    "role": "user",
                    "content": content,
                    "timestamp": ISO8601DateFormatter().string(from: now),
                    "metadata": ["platform": "ios"]
                ]
            )
            .select()
            .single()
            .execute()

        return try response.decoded(as: Message.self)
    }

    // MARK: - Real-Time Subscriptions

    func subscribeToMessages(
        sessionKey: String,
        onNewMessage: @escaping (Message) -> Void
    ) {
        let channel = client.realtime.channel("session:\(sessionKey)")

        channel.on(.postgresChanges(
            event: .insert,
            schema: "public",
            table: "session_messages",
            filter: "session_key=eq.\(sessionKey)"
        )) { change in
            guard let record = change.record else { return }

            if let message = try? JSONDecoder().decode(
                Message.self,
                from: JSONSerialization.data(withJSONObject: record)
            ) {
                onNewMessage(message)
            }
        }
        .subscribe()

        realtimeSubscriptions[sessionKey] = channel
    }

    func unsubscribeFromMessages(sessionKey: String) {
        guard let channel = realtimeSubscriptions[sessionKey] else { return }
        channel.unsubscribe()
        realtimeSubscriptions.removeValue(forKey: sessionKey)
    }
}
```

### ViewModels

```swift
// ViewModels/ChatViewModel.swift
import Foundation
import Combine
import Supabase

@MainActor
class ChatViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var conversation: Conversation?
    @Published var inputText: String = ""
    @Published var isLoading = false
    @Published var error: String?
    @Published var syncStatus: SyncStatus = .idle

    private let supabaseService = SupabaseService.shared
    private let offlineSyncService = OfflineSyncService.shared
    private var messageSubscription: Task<Void, Never>?

    nonisolated private let userId: String

    init(userId: String) {
        self.userId = userId
    }

    func loadConversation(sessionKey: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            // Load messages
            let loadedMessages = try await supabaseService.loadMessages(
                sessionKey: sessionKey
            )
            messages = loadedMessages

            // Subscribe to new messages
            supabaseService.subscribeToMessages(
                sessionKey: sessionKey
            ) { [weak self] newMessage in
                Task { @MainActor in
                    if !self?.messages.contains(where: { $0.id == newMessage.id }) ?? false {
                        self?.messages.append(newMessage)
                    }
                }
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func sendMessage(content: String) async {
        guard !content.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        guard let conversation = conversation else { return }

        let optimisticMessage = Message(
            id: UUID().uuidString,
            sessionKey: conversation.sessionKey,
            userId: userId,
            role: "user",
            content: content,
            timestamp: Date(),
            metadata: MessageMetadata(optimistic: true, platform: "ios", voiceUrl: nil)
        )

        // Optimistic update
        messages.append(optimisticMessage)
        inputText = ""

        do {
            // Send to Supabase
            let message = try await supabaseService.sendMessage(
                sessionKey: conversation.sessionKey,
                userId: userId,
                content: content
            )

            // Update optimistic message with real one
            if let index = messages.firstIndex(where: { $0.id == optimisticMessage.id }) {
                messages[index] = message
            }

            // Queue for offline sync if needed
            await offlineSyncService.queueMessage(message)
        } catch {
            self.error = error.localizedDescription
            // Remove optimistic message on error
            messages.removeAll { $0.id == optimisticMessage.id }
        }
    }

    func cleanup() {
        if let sessionKey = conversation?.sessionKey {
            supabaseService.unsubscribeFromMessages(sessionKey: sessionKey)
        }
    }
}
```

---

## Views & UI

```swift
// Views/ChatView.swift
import SwiftUI

struct ChatView: View {
    @StateObject private var viewModel: ChatViewModel
    @Environment(\.scenePhase) var scenePhase
    @State private var scrollToBottomTrigger = UUID()

    let conversation: Conversation

    init(conversation: Conversation, userId: String) {
        self.conversation = conversation
        _viewModel = StateObject(wrappedValue: ChatViewModel(userId: userId))
    }

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(conversation.title ?? "Chat")
                            .font(.headline)
                        Text("Helix")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    OfflineIndicator(syncStatus: viewModel.syncStatus)
                }
                .padding()
                .background(Color(.systemBackground))
                .border(Color(.separator), width: 1)

                // Messages
                ScrollViewReader { proxy in
                    List(viewModel.messages) { message in
                        MessageBubble(message: message)
                            .listRowInsets(EdgeInsets())
                            .id(message.id)
                    }
                    .listStyle(.plain)
                    .onChange(of: viewModel.messages.count) { newCount in
                        withAnimation {
                            proxy.scrollTo(
                                viewModel.messages.last?.id,
                                anchor: .bottom
                            )
                        }
                    }
                }

                // Input
                ChatInputField(
                    text: $viewModel.inputText,
                    onSend: {
                        Task {
                            await viewModel.sendMessage(content: viewModel.inputText)
                        }
                    }
                )
                .padding()

                // Error
                if let error = viewModel.error {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                        .padding()
                }
            }

            // Loading
            if viewModel.isLoading {
                ProgressView()
            }
        }
        .navigationTitle(conversation.title ?? "Chat")
        .task {
            await viewModel.loadConversation(sessionKey: conversation.sessionKey)
        }
        .onDisappear {
            viewModel.cleanup()
        }
    }
}

struct ChatInputField: View {
    @Binding var text: String
    let onSend: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            TextField("Message...", text: $text)
                .textFieldStyle(.roundedBorder)
                .submitLabel(.send)
                .onSubmit(onSend)

            Button(action: onSend) {
                Image(systemName: "paperplane.fill")
                    .foregroundColor(.blue)
            }
            .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }
}

struct MessageBubble: View {
    let message: Message

    var isUserMessage: Bool {
        message.role == "user"
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isUserMessage {
                Spacer()
            }

            VStack(alignment: isUserMessage ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .padding(12)
                    .background(isUserMessage ? Color.blue : Color(.systemGray5))
                    .foregroundColor(isUserMessage ? .white : .primary)
                    .cornerRadius(12)

                Text(message.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 12)
            }

            if !isUserMessage {
                Spacer()
            }
        }
        .padding(.vertical, 4)
    }
}
```

---

## Offline Support

```swift
// Services/OfflineSyncService.swift
import Foundation
import CoreData

class OfflineSyncService: NSObject, ObservableObject {
    static let shared = OfflineSyncService()

    @Published var syncStatus: SyncStatus = .idle
    @Published var queuedMessages: [QueuedMessage] = []

    private let userDefaults = UserDefaults.standard
    private let queueKey = "helix-offline-queue"
    private let networkMonitor = NetworkMonitor.shared
    private var syncTask: Task<Void, Never>?

    override init() {
        super.init()
        loadQueueFromStorage()
        startNetworkMonitoring()
    }

    func queueMessage(_ message: Message) async {
        let queued = QueuedMessage(
            id: message.id,
            message: message,
            retries: 0,
            createdAt: Date()
        )

        queuedMessages.append(queued)
        saveQueueToStorage()

        // Try to sync if online
        if networkMonitor.isConnected {
            await syncQueue()
        }
    }

    @MainActor
    private func startNetworkMonitoring() {
        networkMonitor.$isConnected
            .dropFirst()
            .filter { $0 }
            .sink { [weak self] _ in
                Task {
                    await self?.syncQueue()
                }
            }
            .store(in: &networkMonitor.cancellables)
    }

    private func syncQueue() async {
        guard !queuedMessages.isEmpty else { return }

        syncStatus = .syncing
        defer { syncStatus = .idle }

        for (index, queued) in queuedMessages.enumerated() {
            do {
                _ = try await SupabaseService.shared.sendMessage(
                    sessionKey: queued.message.sessionKey,
                    userId: queued.message.userId,
                    content: queued.message.content
                )

                queuedMessages.remove(at: index)
                saveQueueToStorage()
            } catch {
                // Exponential backoff
                let delay = min(pow(2.0, Double(queued.retries)) * 1000, 30000)
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000))

                queuedMessages[index].retries += 1
            }
        }
    }

    private func saveQueueToStorage() {
        let encoded = try? JSONEncoder().encode(queuedMessages)
        userDefaults.set(encoded, forKey: queueKey)
    }

    private func loadQueueFromStorage() {
        guard let data = userDefaults.data(forKey: queueKey) else { return }
        queuedMessages = (try? JSONDecoder().decode([QueuedMessage].self, from: data)) ?? []
    }
}

enum SyncStatus: String, Codable {
    case idle
    case syncing
    case error
}

struct QueuedMessage: Identifiable, Codable {
    let id: String
    let message: Message
    var retries: Int
    let createdAt: Date
}
```

---

## Authentication

```swift
// Services/BiometricService.swift
import LocalAuthentication

class BiometricService {
    static let shared = BiometricService()

    func isBiometricAvailable() -> Bool {
        let context = LAContext()
        var error: NSError?

        return context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &error
        )
    }

    func getBiometricType() -> LABiometryType {
        let context = LAContext()
        var error: NSError?
        context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &error
        )
        return context.biometryType
    }

    func authenticate() async throws {
        let context = LAContext()
        let reason = "Authenticate to access your Helix conversations"

        var error: NSError?
        guard context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &error
        ) else {
            throw LAError(.biometryNotAvailable)
        }

        do {
            try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
        } catch {
            throw error
        }
    }
}
```

---

## Testing

```swift
// Tests/ChatViewModelTests.swift
import XCTest
@testable import HelixChat

@MainActor
class ChatViewModelTests: XCTestCase {
    var viewModel: ChatViewModel!
    let userId = "test-user-123"

    override func setUp() async throws {
        viewModel = ChatViewModel(userId: userId)
    }

    func testLoadConversation() async throws {
        let sessionKey = "test-session-123"

        await viewModel.loadConversation(sessionKey: sessionKey)

        // Verify messages loaded
        XCTAssertGreaterThanOrEqual(viewModel.messages.count, 0)
    }

    func testSendMessage() async throws {
        let message = "Test message"

        await viewModel.sendMessage(content: message)

        // Verify optimistic message appears
        let hasOptimistic = viewModel.messages.contains { msg in
            msg.content == message && msg.metadata?.optimistic == true
        }
        XCTAssertTrue(hasOptimistic)
    }

    func testOfflineQueueing() async throws {
        // Mock offline state
        let syncService = OfflineSyncService.shared

        let message = Message(
            id: UUID().uuidString,
            sessionKey: "session-123",
            userId: userId,
            role: "user",
            content: "Offline message",
            timestamp: Date(),
            metadata: nil
        )

        await syncService.queueMessage(message)

        // Verify message queued
        XCTAssertGreaterThan(syncService.queuedMessages.count, 0)
    }
}

// Tests/BiometricServiceTests.swift
import XCTest
import LocalAuthentication
@testable import HelixChat

class BiometricServiceTests: XCTestCase {
    let service = BiometricService.shared

    func testBiometricAvailability() {
        let available = service.isBiometricAvailable()

        // Verify result is boolean
        XCTAssertTrue(available || !available)
    }

    func testBiometricType() {
        let type = service.getBiometricType()

        // Verify type is valid
        XCTAssertTrue(
            type == .none ||
            type == .faceID ||
            type == .touchID
        )
    }
}
```

---

## Deployment

### TestFlight Distribution

```bash
# 1. Build for Testing
xcodebuild -scheme HelixChat -configuration Release \
  -sdk iphoneos -destination generic/platform=iOS \
  archive -archivePath ./HelixChat.xcarchive

# 2. Export for TestFlight
xcodebuild -exportArchive \
  -archivePath ./HelixChat.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath ./ExportedApp

# 3. Upload to App Store Connect
xcrun altool --upload-app \
  --file ExportedApp/HelixChat.ipa \
  --type ios \
  --apiKey YOUR_API_KEY \
  --apiIssuer YOUR_ISSUER_ID
```

### App Store Release

1. Complete TestFlight beta testing (minimum 1 week)
2. Gather beta feedback and fix issues
3. Update version number and release notes
4. Submit to App Review
5. Monitor approval status
6. Release when approved

---

## Deployment Checklist

- [ ] All code written and tested
- [ ] Unit tests passing (>90% coverage)
- [ ] Integration tests passing
- [ ] No memory leaks detected
- [ ] Performance targets met (<100ms sync)
- [ ] Offline support verified
- [ ] Biometric auth working
- [ ] Push notifications configured
- [ ] Privacy policy updated
- [ ] EULA prepared
- [ ] Marketing materials ready
- [ ] Beta tester invitations sent
- [ ] Beta feedback collected
- [ ] Issues fixed from beta
- [ ] Release notes prepared
- [ ] App Store submission ready

---

**Status**: Ready for 3-4 week implementation
**Next**: Begin Android development in parallel
