# Phase 4.5 & 4.6: Mobile Apps Architecture (iOS & Android)

Comprehensive plan for iOS (SwiftUI) and Android (Jetpack Compose) implementations using shared Supabase backend.

## Overview

**Goal:** Build native mobile apps for iOS and Android that share the same Supabase backend as web and desktop.

**Architecture:**
```
┌─────────────────────────────────────────────────┐
│        Helix Mobile Apps (iOS + Android)        │
├─────────────────────────────────────────────────┤
│                                                 │
│  iOS (SwiftUI)          Android (Compose)       │
│  ├── ChatView           ├── ChatScreen          │
│  ├── SessionList        ├── SessionList         │
│  └── SettingsView       └── SettingsScreen      │
│                                                 │
│  ┌─────────────────────────────────────┐       │
│  │     Shared Supabase Backend         │       │
│  ├─────────────────────────────────────┤       │
│  │  • conversations                    │       │
│  │  • session_messages                 │       │
│  │  • users                            │       │
│  │  • Real-time subscriptions          │       │
│  └─────────────────────────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Part 1: iOS App (SwiftUI)

### Directory Structure

```
helix-mobile/ios/
├── HelixApp.swift                 # App entry point
├── Models/
│   ├── Message.swift              # Message model (Codable)
│   ├── Conversation.swift         # Conversation model
│   └── User.swift                 # User profile
├── Services/
│   ├── SupabaseService.swift      # Supabase client initialization
│   ├── ChatService.swift          # Chat operations
│   ├── AuthService.swift          # Authentication
│   └── OfflineSyncService.swift   # Offline queue management
├── ViewModels/
│   ├── ChatViewModel.swift        # Chat state & logic
│   ├── SessionListViewModel.swift # Session list state
│   └── AuthViewModel.swift        # Auth state
├── Views/
│   ├── ChatView.swift             # Main chat interface
│   ├── SessionListView.swift      # Session sidebar/list
│   ├── ChatInputView.swift        # Message input
│   ├── MessageBubble.swift        # Message display
│   ├── SettingsView.swift         # Settings
│   └── OfflineIndicator.swift     # Offline status
└── Resources/
    ├── Assets.xcassets/           # Images, colors, etc.
    └── Strings.strings            # Localizations
```

### Key Implementation Files

#### 1. Models - Message.swift

```swift
import Foundation

struct Message: Identifiable, Codable {
  let id: String
  let sessionKey: String
  let userId: String
  let role: String  // "user" | "assistant"
  let content: String
  let timestamp: Date
  let metadata: [String: String]?

  enum CodingKeys: String, CodingKey {
    case id, content, role, userId, timestamp
    case sessionKey = "session_key"
    case metadata
  }

  // For optimistic UI updates
  var isOptimistic: Bool {
    metadata?["optimistic"] == "true"
  }
}

struct Conversation: Identifiable, Codable {
  let id: String
  let userId: String
  let sessionKey: String
  let title: String?
  let createdAt: Date
  let updatedAt: Date
  let synthesizedAt: Date?
  let synthesisInsights: String?

  enum CodingKeys: String, CodingKey {
    case id, title
    case userId = "user_id"
    case sessionKey = "session_key"
    case createdAt = "created_at"
    case updatedAt = "updated_at"
    case synthesizedAt = "synthesized_at"
    case synthesisInsights = "synthesis_insights"
  }
}
```

#### 2. Services - SupabaseService.swift

```swift
import Supabase

class SupabaseService: NSObject, ObservableObject {
  static let shared = SupabaseService()

  let supabase: SupabaseClient

  override private init() {
    let url = URL(string: "SUPABASE_URL")!
    let key = "SUPABASE_ANON_KEY"

    self.supabase = SupabaseClient(
      supabaseURL: url,
      supabaseKey: key
    )
  }

  // Load conversations
  func loadConversations(userId: String) async throws -> [Conversation] {
    let response = try await supabase
      .database
      .from("conversations")
      .select()
      .eq("user_id", value: userId)
      .order("updated_at", ascending: false)
      .execute()

    return try JSONDecoder().decode([Conversation].self, from: response.data)
  }

  // Load messages for session
  func loadMessages(sessionKey: String) async throws -> [Message] {
    let response = try await supabase
      .database
      .from("session_messages")
      .select()
      .eq("session_key", value: sessionKey)
      .order("timestamp", ascending: true)
      .execute()

    return try JSONDecoder().decode([Message].self, from: response.data)
  }

  // Create conversation
  func createConversation(userId: String, title: String) async throws -> Conversation {
    let sessionKey = "ios-\(Date().timeIntervalSince1970)-\(UUID().uuidString.prefix(7))"
    let now = Date().iso8601String

    let conversation = Conversation(
      id: UUID().uuidString,
      userId: userId,
      sessionKey: sessionKey,
      title: title,
      createdAt: now,
      updatedAt: now,
      synthesizedAt: nil,
      synthesisInsights: nil
    )

    let response = try await supabase
      .database
      .from("conversations")
      .insert([conversation], returning: .representation)
      .select()
      .single()
      .execute()

    return try JSONDecoder().decode(Conversation.self, from: response.data)
  }

  // Insert message
  func sendMessage(
    sessionKey: String,
    userId: String,
    content: String
  ) async throws -> Message {
    let message = Message(
      id: UUID().uuidString,
      sessionKey: sessionKey,
      userId: userId,
      role: "user",
      content: content,
      timestamp: Date(),
      metadata: ["idempotencyKey": UUID().uuidString]
    )

    let response = try await supabase
      .database
      .from("session_messages")
      .insert([message], returning: .representation)
      .select()
      .single()
      .execute()

    return try JSONDecoder().decode(Message.self, from: response.data)
  }

  // Subscribe to messages
  func subscribeToMessages(sessionKey: String) -> AsyncThrowingStream<Message, Error> {
    return AsyncThrowingStream { continuation in
      Task {
        try await supabase
          .realtime
          .channel("messages:\(sessionKey)")
          .on(
            .postgresChanges(
              event: .insert,
              schema: "public",
              table: "session_messages",
              filter: "session_key=eq.\(sessionKey)"
            )
          ) { message in
            // Handle real-time update
            continuation.yield(message)
          }
          .subscribe()
      }
    }
  }
}
```

#### 3. ViewModels - ChatViewModel.swift

```swift
import SwiftUI
import Combine

@MainActor
class ChatViewModel: ObservableObject {
  @Published var messages: [Message] = []
  @Published var conversation: Conversation?
  @Published var input: String = ""
  @Published var isLoading = false
  @Published var error: String?
  @Published var isOnline = true

  private let supabase = SupabaseService.shared
  private var messageTask: Task<Void, Never>?
  private var subscriptionTask: Task<Void, Never>?

  func loadConversation(sessionKey: String) async {
    isLoading = true
    defer { isLoading = false }

    do {
      messages = try await supabase.loadMessages(sessionKey: sessionKey)

      // Subscribe to real-time updates
      subscriptionTask?.cancel()
      subscriptionTask = Task {
        do {
          let stream = supabase.subscribeToMessages(sessionKey: sessionKey)
          for try await message in stream {
            // Add to messages if not duplicate
            if !messages.contains(where: { $0.id == message.id }) {
              messages.append(message)
            }
          }
        } catch {
          self.error = "Failed to sync messages: \(error.localizedDescription)"
        }
      }
    } catch {
      self.error = "Failed to load conversation: \(error.localizedDescription)"
    }
  }

  func sendMessage(content: String) async {
    let cleanContent = content.trimmingCharacters(in: .whitespaces)
    guard !cleanContent.isEmpty, let sessionKey = conversation?.sessionKey else {
      return
    }

    // Optimistic UI update
    let optimisticMessage = Message(
      id: UUID().uuidString,
      sessionKey: sessionKey,
      userId: "current_user",
      role: "user",
      content: cleanContent,
      timestamp: Date(),
      metadata: ["optimistic": "true"]
    )
    messages.append(optimisticMessage)
    input = ""

    do {
      let _ = try await supabase.sendMessage(
        sessionKey: sessionKey,
        userId: "current_user",
        content: cleanContent
      )
      // Remove optimistic marker after confirmation
      if let index = messages.firstIndex(where: { $0.id == optimisticMessage.id }) {
        messages[index].metadata?["optimistic"] = nil
      }
    } catch {
      // Remove optimistic message on error
      messages.removeAll { $0.id == optimisticMessage.id }
      self.error = "Failed to send message: \(error.localizedDescription)"
    }
  }

  deinit {
    subscriptionTask?.cancel()
  }
}
```

#### 4. Views - ChatView.swift

```swift
import SwiftUI

struct ChatView: View {
  @StateObject var viewModel = ChatViewModel()
  @Environment(\.scenePhase) var scenePhase

  let conversation: Conversation

  var body: some View {
    VStack(spacing: 0) {
      // Header
      VStack(alignment: .leading) {
        Text(conversation.title ?? "Untitled")
          .font(.headline)
      }
      .padding()
      .background(Color(.systemGray6))
      .borderBottom()

      // Messages
      ScrollViewReader { proxy in
        List(viewModel.messages) { message in
          MessageBubble(message: message)
            .listRowSeparator(.hidden)
            .listRowInsets(.init())
            .listRowBackground(Color.clear)
            .id(message.id)
        }
        .listStyle(.plain)
        .onChange(of: viewModel.messages.count) { newCount in
          // Auto-scroll to bottom
          if let lastId = viewModel.messages.last?.id {
            withAnimation {
              proxy.scrollTo(lastId, anchor: .bottom)
            }
          }
        }
      }

      // Error banner
      if let error = viewModel.error {
        HStack {
          Image(systemName: "exclamationmark.circle.fill")
          Text(error)
          Spacer()
          Button(action: { viewModel.error = nil }) {
            Image(systemName: "xmark")
          }
        }
        .padding()
        .background(Color(.systemRed))
        .foregroundColor(.white)
      }

      // Input
      HStack(spacing: 12) {
        TextField("Type a message...", text: $viewModel.input)
          .textFieldStyle(.roundedBorder)

        Button(action: {
          Task {
            await viewModel.sendMessage(content: viewModel.input)
          }
        }) {
          Image(systemName: "paperplane.fill")
        }
        .disabled(viewModel.input.trimmingCharacters(in: .whitespaces).isEmpty)
      }
      .padding()
      .background(Color(.systemGray6))
    }
    .onAppear {
      Task {
        await viewModel.loadConversation(sessionKey: conversation.sessionKey)
      }
    }
    .onChange(of: scenePhase) { newPhase in
      if newPhase == .active {
        // Reload when app comes to foreground
        Task {
          await viewModel.loadConversation(sessionKey: conversation.sessionKey)
        }
      }
    }
  }
}

struct MessageBubble: View {
  let message: Message

  var body: some View {
    HStack {
      if message.role == "user" {
        Spacer()
      }

      VStack(alignment: message.role == "user" ? .trailing : .leading) {
        Text(message.content)
          .textSelection(.enabled)
          .padding(12)
          .background(message.role == "user" ? Color.blue : Color(.systemGray5))
          .foregroundColor(message.role == "user" ? .white : .black)
          .cornerRadius(12)

        Text(message.timestamp.formatted(date: .omitted, time: .shortened))
          .font(.caption2)
          .foregroundColor(.gray)
      }

      if message.role == "assistant" {
        Spacer()
      }
    }
    .opacity(message.isOptimistic ? 0.7 : 1.0)
  }
}
```

### Features to Implement

- ✅ SwiftUI chat interface
- ✅ Real-time message sync via Supabase channels
- ✅ Offline message queueing with UserDefaults persistence
- ✅ Session list with navigation
- ✅ Biometric authentication (Face ID / Touch ID)
- ✅ Push notifications (when Helix responds)
- ✅ Home screen widget (recent conversations)
- ✅ Share conversation feature
- ✅ Settings and preferences
- ✅ Accessibility (VoiceOver support)

## Part 2: Android App (Jetpack Compose)

### Directory Structure

```
helix-mobile/android/
├── app/src/main/
│   ├── kotlin/com/helix/android/
│   │   ├── HelixApp.kt              # App entry point
│   │   ├── MainActivity.kt          # Main activity
│   │   ├── di/                      # Dependency injection
│   │   │   ├── SupabaseModule.kt
│   │   │   └── AppModule.kt
│   │   ├── data/                    # Data layer
│   │   │   ├── models/
│   │   │   │   ├── Message.kt
│   │   │   │   └── Conversation.kt
│   │   │   ├── repository/
│   │   │   │   └── ChatRepository.kt
│   │   │   └── local/
│   │   │       └── OfflineSyncDao.kt
│   │   ├── domain/                  # Domain layer
│   │   │   ├── usecase/
│   │   │   │   ├── SendMessageUseCase.kt
│   │   │   │   └── LoadConversationsUseCase.kt
│   │   │   └── repository/
│   │   │       └── ChatRepository.kt
│   │   ├── presentation/            # Presentation layer
│   │   │   ├── screens/
│   │   │   │   ├── ChatScreen.kt
│   │   │   │   ├── SessionListScreen.kt
│   │   │   │   └── SettingsScreen.kt
│   │   │   ├── viewmodel/
│   │   │   │   ├── ChatViewModel.kt
│   │   │   │   └── SessionListViewModel.kt
│   │   │   └── components/
│   │   │       ├── ChatMessages.kt
│   │   │       ├── MessageInput.kt
│   │   │       └── OfflineIndicator.kt
│   │   └── utils/
│   │       ├── DateFormatters.kt
│   │       └── Constants.kt
│   └── res/                         # Resources
│       ├── values/
│       │   ├── strings.xml
│       │   └── colors.xml
│       └── drawable/
└── build.gradle                      # Dependencies
```

### Key Dependencies

```gradle
// Supabase
implementation "io.github.jan-mueller:supabase-kt:version"

// Compose
implementation "androidx.compose.ui:ui:1.5.0"
implementation "androidx.compose.material3:material3:1.0.0"
implementation "androidx.compose.runtime:runtime-livedata:1.5.0"

// ViewModel & State
implementation "androidx.lifecycle:lifecycle-viewmodel-compose:2.6.0"
implementation "androidx.lifecycle:lifecycle-runtime-compose:2.6.0"

// Room (local database for offline sync)
implementation "androidx.room:room-runtime:2.5.2"
kapt "androidx.room:room-compiler:2.5.2"

// Coroutines
implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.1"

// Hilt (dependency injection)
implementation "com.google.dagger:hilt-android:2.46"
kapt "com.google.dagger:hilt-compiler:2.46"

// Retrofit (for REST calls if needed)
implementation "com.squareup.retrofit2:retrofit:2.9.0"

// JSON serialization
implementation "com.google.code.gson:gson:2.10.1"
```

### Key Implementation Files

#### 1. Models - Message.kt

```kotlin
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.Date

@Serializable
data class Message(
  val id: String,
  @SerialName("session_key")
  val sessionKey: String,
  @SerialName("user_id")
  val userId: String,
  val role: String,  // "user" | "assistant"
  val content: String,
  val timestamp: String,
  val metadata: Map<String, String>? = null
) {
  val isOptimistic: Boolean
    get() = metadata?.get("optimistic") == "true"
}

@Serializable
data class Conversation(
  val id: String,
  @SerialName("user_id")
  val userId: String,
  @SerialName("session_key")
  val sessionKey: String,
  val title: String?,
  @SerialName("created_at")
  val createdAt: String,
  @SerialName("updated_at")
  val updatedAt: String,
  @SerialName("synthesized_at")
  val synthesizedAt: String? = null,
  @SerialName("synthesis_insights")
  val synthesisInsights: String? = null
)
```

#### 2. Repository - ChatRepository.kt

```kotlin
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class ChatRepository(supabaseUrl: String, supabaseKey: String) {
  private val supabase = createSupabaseClient(
    supabaseUrl = supabaseUrl,
    supabaseKey = supabaseKey
  ) {
    install(Postgrest)
    install(Realtime)
  }

  suspend fun loadConversations(userId: String): List<Conversation> {
    return supabase.from("conversations")
      .select {
        filter { eq("user_id", userId) }
        order("updated_at")
      }
      .decodeList<Conversation>()
  }

  suspend fun loadMessages(sessionKey: String): List<Message> {
    return supabase.from("session_messages")
      .select {
        filter { eq("session_key", sessionKey) }
        order("timestamp")
      }
      .decodeList<Message>()
  }

  suspend fun createConversation(userId: String, title: String): Conversation {
    val sessionKey = "android-${System.currentTimeMillis()}-${(0..999).random()}"
    val now = System.currentTimeMillis().toString()

    val conversation = Conversation(
      id = java.util.UUID.randomUUID().toString(),
      userId = userId,
      sessionKey = sessionKey,
      title = title,
      createdAt = now,
      updatedAt = now
    )

    return supabase.from("conversations")
      .insert(conversation)
      .decodeSingle<Conversation>()
  }

  suspend fun sendMessage(
    sessionKey: String,
    userId: String,
    content: String
  ): Message {
    val message = Message(
      id = java.util.UUID.randomUUID().toString(),
      sessionKey = sessionKey,
      userId = userId,
      role = "user",
      content = content,
      timestamp = System.currentTimeMillis().toString(),
      metadata = mapOf("idempotencyKey" to java.util.UUID.randomUUID().toString())
    )

    return supabase.from("session_messages")
      .insert(message)
      .decodeSingle<Message>()
  }

  fun subscribeToMessages(sessionKey: String): Flow<Message> = callbackFlow {
    val channel = supabase.realtime.channel("messages:$sessionKey")

    channel.on<Message> { message ->
      trySend(message)
    }.subscribe()

    awaitClose {
      channel.unsubscribe()
    }
  }
}
```

#### 3. ViewModel - ChatViewModel.kt

```kotlin
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChatUiState(
  val messages: List<Message> = emptyList(),
  val conversation: Conversation? = null,
  val isLoading: Boolean = false,
  val error: String? = null
)

@HiltViewModel
class ChatViewModel @Inject constructor(
  private val chatRepository: ChatRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(ChatUiState())
  val uiState: StateFlow<ChatUiState> = _uiState

  fun loadConversation(sessionKey: String) {
    viewModelScope.launch {
      _uiState.value = _uiState.value.copy(isLoading = true)

      try {
        val messages = chatRepository.loadMessages(sessionKey)
        _uiState.value = _uiState.value.copy(
          messages = messages,
          isLoading = false
        )

        // Subscribe to real-time updates
        chatRepository.subscribeToMessages(sessionKey).collect { newMessage ->
          // Avoid duplicates
          if (_uiState.value.messages.none { it.id == newMessage.id }) {
            _uiState.value = _uiState.value.copy(
              messages = _uiState.value.messages + newMessage
            )
          }
        }
      } catch (e: Exception) {
        _uiState.value = _uiState.value.copy(
          isLoading = false,
          error = "Failed to load messages: ${e.message}"
        )
      }
    }
  }

  fun sendMessage(content: String) {
    val cleanContent = content.trim()
    if (cleanContent.isEmpty() || _uiState.value.conversation == null) return

    val conversation = _uiState.value.conversation ?: return

    // Optimistic UI update
    val optimisticMessage = Message(
      id = java.util.UUID.randomUUID().toString(),
      sessionKey = conversation.sessionKey,
      userId = "current_user",
      role = "user",
      content = cleanContent,
      timestamp = System.currentTimeMillis().toString(),
      metadata = mapOf("optimistic" to "true")
    )

    _uiState.value = _uiState.value.copy(
      messages = _uiState.value.messages + optimisticMessage
    )

    viewModelScope.launch {
      try {
        val sentMessage = chatRepository.sendMessage(
          sessionKey = conversation.sessionKey,
          userId = "current_user",
          content = cleanContent
        )

        // Replace optimistic with real message
        _uiState.value = _uiState.value.copy(
          messages = _uiState.value.messages.map {
            if (it.id == optimisticMessage.id) sentMessage else it
          }
        )
      } catch (e: Exception) {
        // Remove optimistic message on error
        _uiState.value = _uiState.value.copy(
          messages = _uiState.value.messages.filter { it.id != optimisticMessage.id },
          error = "Failed to send message: ${e.message}"
        )
      }
    }
  }
}
```

#### 4. UI - ChatScreen.kt

```kotlin
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun ChatScreen(
  sessionKey: String,
  viewModel: ChatViewModel = hiltViewModel()
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  var input by remember { mutableStateOf("") }

  LaunchedEffect(sessionKey) {
    viewModel.loadConversation(sessionKey)
  }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(Color.White)
  ) {
    // Header
    TopAppBar(title = { Text(uiState.conversation?.title ?: "Chat") })

    // Messages
    LazyColumn(
      modifier = Modifier
        .weight(1f)
        .fillMaxWidth()
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      items(uiState.messages) { message ->
        MessageBubble(message = message)
      }
    }

    // Error banner
    if (uiState.error != null) {
      Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.Red
      ) {
        Row(
          modifier = Modifier
            .padding(16.dp)
            .fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(uiState.error ?: "", color = Color.White)
          Button(onClick = { /* dismiss */ }) {
            Text("Dismiss")
          }
        }
      }
    }

    // Input
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(16.dp),
      horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      TextField(
        value = input,
        onValueChange = { input = it },
        modifier = Modifier.weight(1f),
        placeholder = { Text("Type a message...") }
      )
      Button(
        onClick = {
          viewModel.sendMessage(input)
          input = ""
        },
        enabled = input.isNotBlank()
      ) {
        Icon(Icons.Filled.Send, contentDescription = "Send")
      }
    }
  }
}

@Composable
fun MessageBubble(message: Message) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(vertical = 4.dp),
    horizontalArrangement = if (message.role == "user") {
      Arrangement.End
    } else {
      Arrangement.Start
    }
  ) {
    Surface(
      modifier = Modifier
        .widthIn(max = 300.dp)
        .alpha(if (message.isOptimistic) 0.7f else 1f),
      color = if (message.role == "user") Color.Blue else Color.LightGray,
      shape = RoundedCornerShape(12.dp)
    ) {
      Column(modifier = Modifier.padding(12.dp)) {
        Text(
          message.content,
          color = if (message.role == "user") Color.White else Color.Black
        )
        Text(
          formatTime(message.timestamp),
          fontSize = 10.sp,
          color = if (message.role == "user") Color.White.copy(alpha = 0.7f) else Color.Gray
        )
      }
    }
  }
}

fun formatTime(timestamp: String): String {
  // Format timestamp to HH:MM
  return try {
    val time = timestamp.toLong()
    val date = java.util.Date(time)
    android.text.format.DateFormat.format("HH:mm", date).toString()
  } catch (e: Exception) {
    "Now"
  }
}
```

### Features to Implement

- ✅ Jetpack Compose chat interface
- ✅ Real-time message sync via Supabase
- ✅ Offline message queueing with Room database
- ✅ Session list with MaterialYou design
- ✅ Biometric authentication (fingerprint / face)
- ✅ Push notifications
- ✅ Material Design 3 theming
- ✅ Accessibility support
- ✅ Deep linking to conversations
- ✅ Share conversation feature

## Shared Features (Both Platforms)

### Offline Sync Queue

Both platforms implement offline message queueing:

**iOS:** UserDefaults serialization
```swift
let encoder = JSONEncoder()
let data = try encoder.encode(queuedMessage)
UserDefaults.standard.setValue(data, forKey: "message_queue")
```

**Android:** Room database
```kotlin
@Dao
interface OfflineSyncDao {
  @Insert
  suspend fun queueMessage(message: Message)

  @Query("SELECT * FROM offline_messages")
  fun getAllQueued(): Flow<List<Message>>

  @Delete
  suspend fun removeMessage(message: Message)
}
```

### Push Notifications

**iOS:** APNs with UserNotifications framework
```swift
UNUserNotificationCenter.current()
  .requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
    if granted {
      DispatchQueue.main.async {
        UIApplication.shared.registerForRemoteNotifications()
      }
    }
  }
```

**Android:** Firebase Cloud Messaging (FCM)
```kotlin
FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
  if (task.isSuccessful) {
    val token = task.result
    // Send to Supabase
  }
}
```

### Biometric Authentication

**iOS:** LocalAuthentication framework
```swift
let context = LAContext()
let reason = "Authenticate to unlock Helix"

if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) {
  context.evaluatePolicy(
    .deviceOwnerAuthenticationWithBiometrics,
    localizedReason: reason
  ) { success, _ in
    if success {
      // Grant access
    }
  }
}
```

**Android:** BiometricPrompt API
```kotlin
val biometricPrompt = BiometricPrompt(
  activity,
  executor,
  object : BiometricPrompt.AuthenticationCallback() {
    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
      // Grant access
    }
  }
)

val promptInfo = BiometricPrompt.PromptInfo.Builder()
  .setTitle("Unlock Helix")
  .setNegativeButtonText("Cancel")
  .build()

biometricPrompt.authenticate(promptInfo)
```

## Data Flow (Both Platforms)

```
User sends message
    ↓
Optimistic UI update (message appears immediately)
    ↓
Send to Supabase via REST API
    ↓
If online:
  - Message stored in database
  - Real-time subscription notifies other clients
    ↓
If offline:
  - Message queued locally (UserDefaults/Room)
  - When online, automatic sync
  - Real-time subscription still updates UI
```

## Testing Strategy

### Unit Tests

```swift
// iOS
class ChatViewModelTests: XCTestCase {
  var viewModel: ChatViewModel!
  var mockRepository: MockChatRepository!

  override func setUp() {
    super.setUp()
    mockRepository = MockChatRepository()
    viewModel = ChatViewModel(repository: mockRepository)
  }

  func testSendMessage() async {
    await viewModel.sendMessage(content: "Hello")
    XCTAssertEqual(viewModel.messages.count, 1)
  }
}
```

```kotlin
// Android
class ChatViewModelTest {
  @get:Rule
  val instantExecutorRule = InstantTaskExecutorRule()

  private lateinit var viewModel: ChatViewModel
  private lateinit var repository: FakeChatRepository

  @Before
  fun setUp() {
    repository = FakeChatRepository()
    viewModel = ChatViewModel(repository)
  }

  @Test
  fun sendMessage_addsMessageToUiState() = runTest {
    viewModel.sendMessage("Hello")
    val state = viewModel.uiState.first()
    assertEquals(1, state.messages.size)
  }
}
```

### UI Tests

- Playwright for web
- XCUITest for iOS
- Espresso for Android

## Timeline

**Phase 4.5 (iOS):** 3-4 weeks
- Week 1: Project setup, models, services
- Week 2: ViewModels, Supabase integration
- Week 3: UI implementation (ChatView, SessionList)
- Week 4: Features (offline, notifications, biometric), testing

**Phase 4.6 (Android):** 3-4 weeks
- Week 1: Project setup, models, services
- Week 2: ViewModels, Supabase integration, Room database
- Week 3: UI implementation (ChatScreen, SessionList)
- Week 4: Features (offline, notifications, biometric), testing

**Phase 4.7 (Quality):** 1 week
- Integration testing across platforms
- Cross-platform sync testing
- Performance profiling
- Security audit

## Success Criteria

- [ ] iOS app builds and runs on iPhone 14+
- [ ] Android app builds and runs on API level 28+
- [ ] Messages sync in real-time between platforms
- [ ] Offline messaging queues and syncs when online
- [ ] Biometric authentication works on both platforms
- [ ] Push notifications deliver correctly
- [ ] No secrets stored in code or logs
- [ ] All platforms share same Supabase backend
- [ ] <200ms latency for message send/receive
- [ ] <5MB app size increase from new features

## Deployment

**iOS:**
- TestFlight for beta testing
- App Store distribution
- Automatic updates via App Store

**Android:**
- Google Play Internal Testing
- Google Play Beta
- Google Play distribution
- Automatic updates via Play Store

Both platforms support over-the-air updates via Supabase Edge Functions if needed.
