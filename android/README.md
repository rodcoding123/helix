# Helix Chat Android App

Native Android application for Helix Chat, built with Jetpack Compose and Kotlin, integrated with Supabase backend.

## Architecture

```
HelixChat/
├── models/
│   ├── Message.kt              # Message data model with offline sync tracking
│   └── Conversation.kt         # Conversation metadata
├── services/
│   ├── SupabaseService.kt      # Supabase authentication, data operations, real-time subscriptions
│   └── OfflineSyncService.kt   # Room database offline queue, network monitoring
├── viewmodels/
│   ├── ChatViewModel.kt        # Chat state management
│   └── ConversationViewModel.kt # Conversation list state management
├── ui/
│   ├── screens/
│   │   ├── AuthScreen.kt       # Sign in / Sign up
│   │   ├── ConversationListScreen.kt # Browse all conversations
│   │   └── ChatScreen.kt       # Main chat interface
│   └── components/
│       ├── MessageBubble.kt    # Message display
│       ├── OfflineBanner.kt    # Offline status
│       └── ChatInput.kt        # Message input
└── HelixChatApp.kt             # App entry point
```

## Tech Stack

- **UI Framework:** Jetpack Compose
- **Data Persistence:** Room Database (SQLite)
- **Backend:** Supabase (PostgreSQL + Real-time)
- **Network:** Ktor HTTP Client + Supabase SDK
- **State Management:** ViewModel + StateFlow
- **Architecture:** MVVM with Reactive Bindings

## Features

### Authentication

- Sign up with email/password
- Sign in with email/password
- Session persistence (DataStore)
- Sign out

### Chat

- Real-time message synchronization via Supabase channels
- Optimistic UI updates (messages appear immediately)
- Message history with pagination
- Conversation list with search
- Create new conversations
- Delete conversations

### Offline Support

- Room database local storage for offline message queue
- Network status monitoring (ConnectivityManager)
- Automatic sync when connection restored
- Manual sync button in offline banner
- Failed message tracking and retry logic
- Exponential backoff: 800ms × 1.5^retries, max 30s

### User Experience

- Offline banner showing connection status
- Sync progress indicator
- Queue length display
- Failed message count
- Auto-scroll to latest message
- Pull-to-refresh conversation list

## Setup Instructions

### Prerequisites

- Android Studio 2023.3+
- Kotlin 1.9+
- Android 9 (API 28) minimum, target Android 14 (API 34)
- Supabase project with configured database

### 1. Project Configuration

Configure Supabase credentials in `SupabaseService.kt`:

```kotlin
companion object {
    private const val SUPABASE_URL = "https://your-project.supabase.co"
    private const val SUPABASE_ANON_KEY = "your-anon-key"
}
```

### 2. Database Setup

Ensure the following tables exist in Supabase (same as iOS/Web):

**auth.users** - Supabase authentication table

**conversations**

```sql
CREATE TABLE conversations (
  session_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0
);
```

**session_messages**

```sql
CREATE TABLE session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key TEXT NOT NULL REFERENCES conversations(session_key),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Offline sync metadata
  client_id TEXT,
  is_pending BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ,
  platform TEXT,
  device_id TEXT,

  -- Extended thinking
  thinking TEXT,
  metadata JSONB,

  CONSTRAINT unique_message_id UNIQUE (session_key, client_id)
);

CREATE INDEX idx_session_messages_user ON session_messages(user_id);
CREATE INDEX idx_session_messages_session ON session_messages(session_key);
CREATE INDEX idx_session_messages_pending ON session_messages(is_pending);
```

### 3. Real-Time Subscriptions

Enable real-time subscriptions in Supabase dashboard:

1. Go to your project
2. Replication → Publications
3. Add `conversations` and `session_messages` tables to replication

### 4. Build and Run

```bash
cd android
./gradlew build
./gradlew installDebug
```

Or open in Android Studio:

1. File → Open → helix/android
2. Wait for Gradle sync
3. Press Ctrl+R or select Run → Run 'app'

## Room Database Schema

**QueuedMessageEntity**

```kotlin
@Entity(tableName = "queued_messages")
data class QueuedMessageEntity(
    @PrimaryKey
    val messageId: String,
    val content: String,
    val sessionKey: String,
    val timestamp: Long,
    val retries: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)
```

## State Management

### SupabaseService

- Handles authentication and API calls
- Manages real-time subscriptions via RealtimeV2
- Provides methods for data operations
- Emits StateFlow for reactive updates

### OfflineSyncService

- Network status monitoring via ConnectivityManager
- Offline message queueing with Room
- Retry logic with exponential backoff
- StateFlow for reactive state updates

### ChatViewModel (extends AndroidViewModel)

- Chat state (messages, input, loading, error)
- Bindings to offline sync service state
- Operations: loadMessages, sendMessage, sync
- Lifecycle-aware (cleaned up in onCleared)

### ConversationViewModel (extends AndroidViewModel)

- Conversation list state
- Search filtering
- Operations: loadConversations, createConversation, deleteConversation

## Message Flow

### Online Message Send

1. User types and sends message
2. Optimistic update: message added to UI immediately
3. SupabaseService sends to backend
4. Backend confirms receipt
5. UI updated with server response

### Offline Message Send

1. User types and sends message
2. App detects offline status via ConnectivityManager
3. Message queued to Room database
4. Optimistic update: message shown as pending
5. Offline banner shows queue count
6. When connection restored, auto-sync triggered
7. OfflineSyncService processes queue
8. Calls Supabase sync-messages edge function
9. Messages synced, marked with `syncedAt` timestamp
10. UI updates to show synced state

## Real-Time Sync

Subscriptions to `session_messages` table:

- Channel: `messages:{sessionKey}`
- Event: INSERT (new messages from assistant)
- Action: Automatically reload and display messages

## Error Handling

All errors caught and converted to `HelixError`:

```kotlin
data class HelixError(
    val code: String,
    val message: String
) : Exception(message)
```

Error codes:

- `AUTH_FAILED` - Authentication failure
- `LOAD_FAILED` - Failed to load data
- `SEND_FAILED` - Failed to send message
- `OFFLINE` - Operation attempted while offline
- `SYNC_FAILED` - Offline sync failure
- `CREATE_FAILED` - Failed to create conversation

## Testing

Manual test scenarios:

1. **Sign Up / Sign In**
   - Create account with valid email
   - Sign in with valid credentials
   - Verify persistent session (DataStore)

2. **Chat Operations**
   - Create new conversation
   - Send message while online
   - Verify real-time update appears
   - Reply from assistant

3. **Offline Behavior**
   - Disable network (WiFi + mobile data)
   - Send message while offline
   - Verify pending indicator appears
   - Verify message queued in Room DB
   - Re-enable network
   - Verify auto-sync triggered
   - Verify message synced

4. **Conversation Management**
   - Create multiple conversations
   - Switch between conversations
   - Verify message history loads correctly
   - Delete conversation
   - Search conversations

## Dependencies

### Core

- androidx.core:core-ktx
- androidx.lifecycle:lifecycle-runtime-ktx

### Compose

- androidx.compose.ui:ui
- androidx.compose.material3:material3
- androidx.navigation:navigation-compose

### Supabase

- io.github.jan-tennert.supabase:supabase-kt
- io.github.jan-tennert.supabase:auth-kt
- io.github.jan-tennert.supabase:realtime-kt
- io.github.jan-tennert.supabase:postgrest-kt
- io.ktor:ktor-client-okhttp

### Database

- androidx.room:room-runtime
- androidx.room:room-ktx

### State Management

- androidx.lifecycle:lifecycle-viewmodel-compose

### Other

- kotlinx.coroutines:kotlinx-coroutines-android
- androidx.datastore:datastore-preferences
- com.jakewharton.timber:timber

## Performance Considerations

- **Message Loading:** Pagination with limit=50 per request
- **Real-Time Updates:** Debounced to avoid excessive UI recomposition
- **Room Writes:** Batched operations for efficiency
- **Network Retries:** Exponential backoff prevents overwhelming server
- **Coroutine Scope:** viewModelScope cancels operations on ViewModel clearing

## Security

- JWT tokens stored securely (Supabase SDK + DataStore)
- RLS policies enforce user isolation
- Device tracking via Settings.Secure.ANDROID_ID
- TLS 1.2+ for all API communications
- No secrets in source code (use BuildConfig or secrets.properties)

## Future Enhancements

1. **Push Notifications:** FCM integration for offline messages
2. **Voice Input:** Speech-to-text for faster messaging
3. **Biometric Auth:** Fingerprint / Face unlock support
4. **File Sharing:** Upload and share documents
5. **Typing Indicators:** Show when assistant is typing
6. **Message Search:** Search across conversation history
7. **Dark Mode:** Full dark mode support
8. **Widgets:** Home screen widget with recent conversations
9. **Notifications:** Rich notification support with actions
10. **Image Display:** Show images in messages

## Troubleshooting

### Build Errors

```bash
# Clean build
./gradlew clean

# Rebuild
./gradlew build

# Rebuild with verbose logging
./gradlew build --info
```

### Runtime Errors

- Check Supabase URL and key are correct
- Verify internet connection
- Check RLS policies allow operations
- Review Logcat output (Studio: View → Tool Windows → Logcat)

### Offline Queue Issues

- Clear app data: Settings → Apps → Helix Chat → Storage → Clear Data
- Check Room database: AndroidStudio → Device File Explorer → /data/data/com.helix.chat/databases/
- Enable Timber logging for debugging

## Resources

- [Supabase Kotlin SDK](https://github.com/supabase-community/supabase-kt)
- [Jetpack Compose](https://developer.android.com/develop/ui/compose)
- [Room Database](https://developer.android.com/topic/libraries/architecture/room)
- [ViewModel & StateFlow](https://developer.android.com/topic/libraries/architecture/viewmodel)
- [Helix iOS](../ios/) - iOS version reference
- [Helix Web](../web/) - Web version reference

## License

Part of the Helix Cross-Platform Project. See main LICENSE file.

## Status

- **Current Version:** 1.0.0
- **Platform:** Android 9+
- **Status:** In Development (Phase 4.4)
- **Next:** Push notifications (FCM) and full UI implementation
