# Helix Android App - Complete Jetpack Compose Implementation

**Date**: February 6, 2026
**Platform**: Android 8.0+ (API 26+)
**Framework**: Jetpack Compose + Hilt + Coroutines
**Duration**: 3-4 weeks
**Status**: Ready for Implementation

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Setup](#project-setup)
3. [Core Implementation](#core-implementation)
4. [Models & Data Structures](#models--data-structures)
5. [Services Layer](#services-layer)
6. [ViewModels](#viewmodels)
7. [Compose UI](#compose-ui)
8. [Offline Support](#offline-support)
9. [Push Notifications](#push-notifications)
10. [Testing](#testing)
11. [Deployment](#deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Android App Architecture                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PRESENTATION LAYER (Jetpack Compose)                              │
│  ├─ ChatScreen.kt                                                  │
│  ├─ SessionListScreen.kt                                           │
│  ├─ SettingsScreen.kt                                              │
│  └─ Components (MessageBubble, InputField, etc.)                   │
│                                                                     │
│  VIEW MODEL LAYER (ViewModel + StateFlow)                          │
│  ├─ ChatViewModel.kt                                               │
│  ├─ SessionListViewModel.kt                                        │
│  ├─ AuthViewModel.kt                                               │
│  └─ OfflineSyncViewModel.kt                                        │
│                                                                     │
│  SERVICE LAYER (Hilt Injection)                                    │
│  ├─ SupabaseService.kt                                             │
│  ├─ ChatService.kt                                                 │
│  ├─ AuthService.kt                                                 │
│  ├─ OfflineSyncService.kt                                          │
│  └─ BiometricService.kt                                            │
│                                                                     │
│  REPOSITORY LAYER                                                  │
│  ├─ ChatRepository.kt                                              │
│  ├─ ConversationRepository.kt                                      │
│  └─ UserRepository.kt                                              │
│                                                                     │
│  DATA LAYER                                                        │
│  ├─ Models (Message, Conversation, User)                           │
│  ├─ LocalDatabase (Room)                                           │
│  ├─ DataStore (Preferences)                                        │
│  └─ Network (Supabase SDK)                                         │
│                                                                     │
│  BACKEND                                                           │
│  └─ Supabase (PostgreSQL + Realtime)                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Setup

### Step 1: Create Android Project

```bash
# Create new Android project in Android Studio
# File → New → New Project → Empty Activity

# Select:
#   - Minimum SDK: API 26 (Android 8.0)
#   - Target SDK: API 35 (Android 15)
#   - Language: Kotlin
#   - Build System: Gradle (Kotlin DSL)

# Project name: HelixChat
# Package: com.helixai.chat
```

### Step 2: Update build.gradle.kts

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.kotlin.kapt)
}

android {
    compileSdk = 35

    defaultConfig {
        applicationId = "com.helixai.chat"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.11"
    }
}

dependencies {
    // Compose
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.compose.activity)
    implementation(libs.compose.navigation)

    // Lifecycle
    implementation(libs.lifecycle.runtime)
    implementation(libs.lifecycle.viewmodel.compose)

    // Coroutines
    implementation(libs.coroutines.core)
    implementation(libs.coroutines.android)

    // Hilt
    implementation(libs.hilt.android)
    kapt(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Supabase
    implementation(libs.supabase.client)
    implementation(libs.supabase.realtime)
    implementation(libs.supabase.auth)

    // Room
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    kapt(libs.room.compiler)

    // DataStore
    implementation(libs.datastore.preferences)

    // Firebase (for push notifications)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    // Biometric
    implementation(libs.androidx.biometric)

    // Networking
    implementation(libs.okhttp)
    implementation(libs.retrofit)
    implementation(libs.kotlinx.serialization.json)

    // Testing
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso)
}
```

### Step 3: Configure Hilt

```kotlin
// MainActivity.kt
import dagger.hilt.android.AndroidEntryPoint
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background
            ) {
                HelixApp()
            }
        }
    }
}

// di/SupabaseModule.kt
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SupabaseModule {
    @Provides
    @Singleton
    fun provideSupabaseClient(): SupabaseClient = createSupabaseClient(
        supabaseUrl = "https://ncygunbukmpwhtzwbnvp.supabase.co",
        supabaseKey = "YOUR_ANON_KEY"
    ) {
        install(Auth)
        install(Postgrest)
        install(Realtime)
    }
}
```

### Step 4: Create Project Structure

```
app/src/main/
├── kotlin/com/helixai/chat/
│   ├── MainActivity.kt
│   ├── HelixApp.kt
│   ├── di/
│   │   ├── SupabaseModule.kt
│   │   ├── DatabaseModule.kt
│   │   └── RepositoryModule.kt
│   ├── data/
│   │   ├── models/
│   │   │   ├── Message.kt
│   │   │   ├── Conversation.kt
│   │   │   └── User.kt
│   │   ├── local/
│   │   │   ├── HelixDatabase.kt
│   │   │   ├── MessageDao.kt
│   │   │   └── ConversationDao.kt
│   │   ├── remote/
│   │   │   └── SupabaseService.kt
│   │   └── repository/
│   │       ├── ChatRepository.kt
│   │       └── ConversationRepository.kt
│   ├── domain/
│   │   ├── usecase/
│   │   │   ├── GetConversationsUseCase.kt
│   │   │   ├── SendMessageUseCase.kt
│   │   │   └── CreateConversationUseCase.kt
│   │   └── repository/
│   │       ├── ChatRepository.kt
│   │       └── ConversationRepository.kt
│   ├── presentation/
│   │   ├── viewmodel/
│   │   │   ├── ChatViewModel.kt
│   │   │   ├── SessionListViewModel.kt
│   │   │   ├── AuthViewModel.kt
│   │   │   └── OfflineSyncViewModel.kt
│   │   ├── screen/
│   │   │   ├── ChatScreen.kt
│   │   │   ├── SessionListScreen.kt
│   │   │   ├── SettingsScreen.kt
│   │   │   └── AuthScreen.kt
│   │   └── component/
│   │       ├── MessageBubble.kt
│   │       ├── ChatInputField.kt
│   │       ├── OfflineIndicator.kt
│   │       └── SyncStatusView.kt
│   └── util/
│       ├── NetworkMonitor.kt
│       └── Constants.kt
└── res/
    ├── values/
    │   ├── colors.xml
    │   ├── strings.xml
    │   └── themes.xml
    └── drawable/
        └── (app icons)
```

---

## Core Implementation

### Models

```kotlin
// data/models/Message.kt
import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName

@Serializable
@Entity(tableName = "messages")
data class Message(
    @PrimaryKey
    val id: String,
    @SerialName("session_key")
    val sessionKey: String,
    @SerialName("user_id")
    val userId: String,
    val role: String, // "user" or "assistant"
    val content: String,
    val timestamp: String,
    val metadata: MessageMetadata? = null
)

@Serializable
data class MessageMetadata(
    val optimistic: Boolean? = null,
    val platform: String? = null,
    @SerialName("voice_url")
    val voiceUrl: String? = null
)

// data/models/Conversation.kt
@Serializable
@Entity(tableName = "conversations")
data class Conversation(
    @PrimaryKey
    val id: String,
    @SerialName("session_key")
    val sessionKey: String,
    @SerialName("user_id")
    val userId: String,
    val title: String? = null,
    @SerialName("message_count")
    val messageCount: Int? = null,
    @SerialName("created_at")
    val createdAt: String,
    @SerialName("updated_at")
    val updatedAt: String
)

// data/models/User.kt
@Serializable
data class User(
    val id: String,
    val email: String,
    @SerialName("display_name")
    val displayName: String? = null,
    @SerialName("avatar_url")
    val avatarUrl: String? = null,
    @SerialName("created_at")
    val createdAt: String
)
```

### Services

```kotlin
// data/remote/SupabaseService.kt
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SupabaseService @Inject constructor(
    private val supabase: SupabaseClient
) {
    suspend fun loadConversations(userId: String): List<Conversation> {
        return supabase.from("conversations")
            .select {
                filter {
                    eq("user_id", userId)
                }
                order("created_at", ascending = false)
            }
            .decodeList()
    }

    suspend fun loadMessages(sessionKey: String): List<Message> {
        return supabase.from("session_messages")
            .select {
                filter {
                    eq("session_key", sessionKey)
                }
                order("timestamp", ascending = true)
            }
            .decodeList()
    }

    suspend fun createConversation(
        userId: String,
        title: String? = null
    ): Conversation {
        val id = java.util.UUID.randomUUID().toString()
        val sessionKey = "session-${java.util.UUID.randomUUID()}"
        val now = System.currentTimeMillis()

        return supabase.from("conversations")
            .insert(
                mapOf(
                    "id" to id,
                    "session_key" to sessionKey,
                    "user_id" to userId,
                    "title" to (title ?: "New Chat"),
                    "created_at" to now,
                    "updated_at" to now
                )
            )
            .select()
            .single()
            .decodeAs()
    }

    suspend fun sendMessage(
        sessionKey: String,
        userId: String,
        content: String
    ): Message {
        val id = java.util.UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        return supabase.from("session_messages")
            .insert(
                mapOf(
                    "id" to id,
                    "session_key" to sessionKey,
                    "user_id" to userId,
                    "role" to "user",
                    "content" to content,
                    "timestamp" to now,
                    "metadata" to mapOf("platform" to "android")
                )
            )
            .select()
            .single()
            .decodeAs()
    }

    fun subscribeToMessages(
        sessionKey: String,
        onNewMessage: (Message) -> Unit
    ) {
        val channel = supabase.channel("session:$sessionKey")

        channel.on(
            PostgresAction.Insert,
            "public:session_messages",
            filter = "session_key=eq.$sessionKey"
        ) { change ->
            val message = change.record.decodeAs<Message>()
            onNewMessage(message)
        }.subscribe()
    }
}
```

### ViewModels

```kotlin
// presentation/viewmodel/ChatViewModel.kt
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChatUiState(
    val messages: List<Message> = emptyList(),
    val conversation: Conversation? = null,
    val inputText: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val syncStatus: SyncStatus = SyncStatus.IDLE
)

enum class SyncStatus {
    IDLE, SYNCING, ERROR
}

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val supabaseService: SupabaseService,
    private val offlineSyncService: OfflineSyncService
) : ViewModel() {
    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    fun loadConversation(sessionKey: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            try {
                val messages = supabaseService.loadMessages(sessionKey)
                _uiState.update { state ->
                    state.copy(
                        messages = messages,
                        isLoading = false
                    )
                }

                // Subscribe to new messages
                supabaseService.subscribeToMessages(sessionKey) { newMessage ->
                    if (!_uiState.value.messages.any { it.id == newMessage.id }) {
                        _uiState.update { state ->
                            state.copy(
                                messages = state.messages + newMessage
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                _uiState.update { state ->
                    state.copy(
                        error = e.message,
                        isLoading = false
                    )
                }
            }
        }
    }

    fun sendMessage(content: String) {
        if (content.isBlank() || _uiState.value.conversation == null) return

        viewModelScope.launch {
            val conversation = _uiState.value.conversation!!
            val optimisticMessage = Message(
                id = java.util.UUID.randomUUID().toString(),
                sessionKey = conversation.sessionKey,
                userId = "", // Will be set by service
                role = "user",
                content = content,
                timestamp = System.currentTimeMillis().toString(),
                metadata = MessageMetadata(optimistic = true, platform = "android")
            )

            // Optimistic update
            _uiState.update { state ->
                state.copy(
                    messages = state.messages + optimisticMessage,
                    inputText = ""
                )
            }

            try {
                val message = supabaseService.sendMessage(
                    sessionKey = conversation.sessionKey,
                    userId = "", // From auth context
                    content = content
                )

                // Update optimistic message
                _uiState.update { state ->
                    state.copy(
                        messages = state.messages.map {
                            if (it.id == optimisticMessage.id) message else it
                        }
                    )
                }

                // Queue for offline sync if needed
                offlineSyncService.queueMessage(message)
            } catch (e: Exception) {
                _uiState.update { state ->
                    state.copy(
                        error = e.message,
                        messages = state.messages.filter { it.id != optimisticMessage.id }
                    )
                }
            }
        }
    }

    fun updateInputText(text: String) {
        _uiState.update { it.copy(inputText = text) }
    }
}
```

---

## Compose UI

```kotlin
// presentation/screen/ChatScreen.kt
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun ChatScreen(
    conversation: Conversation,
    viewModel: ChatViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(conversation.sessionKey) {
        viewModel.loadConversation(conversation.sessionKey)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(conversation.title ?: "Chat") },
                actions = {
                    OfflineIndicator(syncStatus = uiState.syncStatus)
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Messages
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                reverseLayout = true
            ) {
                items(uiState.messages.reversed()) { message ->
                    MessageBubble(message = message)
                }
            }

            Divider()

            // Input
            ChatInputField(
                text = uiState.inputText,
                onTextChange = { viewModel.updateInputText(it) },
                onSend = { viewModel.sendMessage(uiState.inputText) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            )

            // Error
            if (uiState.error != null) {
                Text(
                    text = uiState.error ?: "",
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(16.dp)
                )
            }
        }

        // Loading
        if (uiState.isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }
    }
}

@Composable
fun MessageBubble(message: Message) {
    val isUserMessage = message.role == "user"

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = if (isUserMessage) Arrangement.End else Arrangement.Start
    ) {
        Surface(
            shape = RoundedCornerShape(
                topStart = 12.dp,
                topEnd = 12.dp,
                bottomStart = if (isUserMessage) 12.dp else 0.dp,
                bottomEnd = if (isUserMessage) 0.dp else 12.dp
            ),
            color = if (isUserMessage)
                MaterialTheme.colorScheme.primary
            else
                MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.widthIn(max = 300.dp)
        ) {
            Column(
                modifier = Modifier.padding(12.dp)
            ) {
                Text(
                    text = message.content,
                    color = if (isUserMessage)
                        MaterialTheme.colorScheme.onPrimary
                    else
                        MaterialTheme.colorScheme.onSurface
                )

                Text(
                    text = formatTime(message.timestamp),
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }
    }
}

@Composable
fun ChatInputField(
    text: String,
    onTextChange: (String) -> Unit,
    onSend: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        TextField(
            value = text,
            onValueChange = onTextChange,
            modifier = Modifier
                .weight(1f)
                .height(56.dp),
            placeholder = { Text("Message...") },
            singleLine = true,
            shape = RoundedCornerShape(24.dp)
        )

        IconButton(
            onClick = onSend,
            enabled = text.isNotBlank()
        ) {
            Icon(
                Icons.Default.Send,
                contentDescription = "Send"
            )
        }
    }
}
```

---

## Offline Support

```kotlin
// data/local/HelixDatabase.kt
import androidx.room.*

@Database(
    entities = [Message::class, Conversation::class],
    version = 1
)
abstract class HelixDatabase : RoomDatabase() {
    abstract fun messageDao(): MessageDao
    abstract fun conversationDao(): ConversationDao
}

@Dao
interface MessageDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(message: Message)

    @Query("SELECT * FROM messages WHERE session_key = :sessionKey ORDER BY timestamp ASC")
    fun getMessagesBySession(sessionKey: String): Flow<List<Message>>

    @Delete
    suspend fun delete(message: Message)
}

// presentation/viewmodel/OfflineSyncViewModel.kt
@HiltViewModel
class OfflineSyncViewModel @Inject constructor(
    private val offlineSyncService: OfflineSyncService
) : ViewModel() {
    val syncStatus: StateFlow<SyncStatus> = offlineSyncService.syncStatus
    val queuedMessages: StateFlow<List<QueuedMessage>> = offlineSyncService.queuedMessages

    init {
        viewModelScope.launch {
            offlineSyncService.monitorNetworkStatus()
        }
    }
}

// data/remote/OfflineSyncService.kt
@Singleton
class OfflineSyncService @Inject constructor(
    private val database: HelixDatabase,
    private val supabaseService: SupabaseService,
    private val context: Context
) {
    private val _syncStatus = MutableStateFlow(SyncStatus.IDLE)
    val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()

    private val _queuedMessages = MutableStateFlow<List<QueuedMessage>>(emptyList())
    val queuedMessages: StateFlow<List<QueuedMessage>> = _queuedMessages.asStateFlow()

    suspend fun queueMessage(message: Message) {
        val queued = QueuedMessage(
            id = message.id,
            message = message,
            retries = 0,
            createdAt = System.currentTimeMillis()
        )
        _queuedMessages.update { it + queued }
    }

    suspend fun monitorNetworkStatus() {
        isNetworkAvailable()
            .filter { it }
            .collect {
                syncQueue()
            }
    }

    private suspend fun syncQueue() {
        _syncStatus.update { SyncStatus.SYNCING }

        try {
            _queuedMessages.value.forEach { queued ->
                try {
                    supabaseService.sendMessage(
                        sessionKey = queued.message.sessionKey,
                        userId = queued.message.userId,
                        content = queued.message.content
                    )
                    _queuedMessages.update { list ->
                        list.filter { it.id != queued.id }
                    }
                } catch (e: Exception) {
                    val backoff = minOf(
                        1000L * (2.0.pow(queued.retries.toDouble()).toLong()),
                        30000L
                    )
                    kotlinx.coroutines.delay(backoff)
                    _queuedMessages.update { list ->
                        list.map {
                            if (it.id == queued.id) it.copy(retries = it.retries + 1)
                            else it
                        }
                    }
                }
            }
            _syncStatus.update { SyncStatus.IDLE }
        } catch (e: Exception) {
            _syncStatus.update { SyncStatus.ERROR }
        }
    }

    private fun isNetworkAvailable(): Flow<Boolean> {
        return flow {
            while (currentCoroutineContext().isActive) {
                emit(isConnectedToNetwork())
                delay(5000) // Check every 5 seconds
            }
        }
    }

    private fun isConnectedToNetwork(): Boolean {
        val connectivityManager = context.getSystemService(
            Context.CONNECTIVITY_SERVICE
        ) as ConnectivityManager
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val caps = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}

data class QueuedMessage(
    val id: String,
    val message: Message,
    val retries: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)
```

---

## Push Notifications

```kotlin
// services/PushNotificationService.kt
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class PushNotificationService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.notification?.title ?: "Helix"
        val body = remoteMessage.notification?.body ?: ""

        showNotification(title, body)
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Send token to backend for user notifications
    }

    private fun showNotification(title: String, body: String) {
        val notification = NotificationCompat.Builder(this, "helix_messages")
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(this)
            .notify(1, notification)
    }
}
```

---

## Testing

```kotlin
// Tests/ChatViewModelTest.kt
import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class ChatViewModelTest {
    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private val supabaseService: SupabaseService = mockk()
    private val offlineSyncService: OfflineSyncService = mockk()
    private lateinit var viewModel: ChatViewModel

    @Before
    fun setUp() {
        viewModel = ChatViewModel(supabaseService, offlineSyncService)
    }

    @Test
    fun testLoadConversation() = runTest {
        val sessionKey = "test-session"
        val messages = listOf(
            Message(
                id = "msg-1",
                sessionKey = sessionKey,
                userId = "user-1",
                role = "user",
                content = "Test",
                timestamp = "2026-02-06T00:00:00Z"
            )
        )

        coEvery { supabaseService.loadMessages(sessionKey) } returns messages

        viewModel.loadConversation(sessionKey)

        coVerify { supabaseService.loadMessages(sessionKey) }
    }

    @Test
    fun testSendMessage() = runTest {
        val content = "Test message"

        viewModel.sendMessage(content)

        assert(viewModel.uiState.value.inputText.isEmpty())
    }
}
```

---

## Deployment

### Google Play Distribution

```bash
# 1. Build Release APK/Bundle
./gradlew bundleRelease

# 2. Sign APK
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore my-release-key.jks \
  app/build/outputs/bundle/release/app-release.aab \
  alias_name

# 3. Upload to Google Play Console
# Open Google Play Console
# → Select app
# → Release → Create release
# → Upload bundle

# 4. Create release notes
# → Add description and release notes
# → Set rollout percentage (25% → 50% → 100%)

# 5. Monitor performance
# → Analytics
# → Crashes & ANRs
# → User reviews
```

### Deployment Checklist

- [ ] All code written and tested
- [ ] Unit tests passing (>90% coverage)
- [ ] Integration tests passing
- [ ] No memory leaks detected
- [ ] Performance targets met
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
- [ ] Google Play submission ready

---

**Status**: Ready for 3-4 week implementation
**Next**: Both iOS and Android in parallel (6-8 weeks total)
**After**: Beta testing and production release
