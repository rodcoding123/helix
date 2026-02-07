# Helix Chat iOS App

Native iOS application for Helix Chat, built with SwiftUI and Core Data, integrated with Supabase backend.

## Architecture

```
HelixChat/
├── Models/
│   ├── Message.swift           # Message data model with offline sync tracking
│   └── Conversation.swift      # Conversation metadata
├── Services/
│   ├── SupabaseService.swift   # Supabase authentication, data operations, real-time subscriptions
│   └── OfflineSyncService.swift # Core Data offline queue, network monitoring
├── ViewModels/
│   └── ChatViewModel.swift      # Chat state management
├── Views/
│   ├── AuthenticationView.swift # Sign in / Sign up
│   ├── ConversationListView.swift # Browse all conversations
│   ├── ChatView.swift           # Main chat interface
│   └── SettingsView.swift       # Settings and account management
└── HelixChatApp.swift           # App entry point
```

## Tech Stack

- **UI Framework:** SwiftUI
- **Data Persistence:** Core Data
- **Backend:** Supabase (PostgreSQL + Real-time)
- **Network:** URLSession + Combine
- **Architecture:** MVVM with Reactive Bindings

## Features

### Authentication

- Sign up with email/password
- Sign in with email/password
- Session persistence
- Sign out

### Chat

- Real-time message synchronization via Supabase channels
- Optimistic UI updates (messages appear immediately)
- Message history with pagination
- Conversation list with search
- Create new conversations
- Delete conversations

### Offline Support

- Core Data local database for offline message queue
- Network status monitoring (NWPathMonitor)
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

- Xcode 15+
- iOS 16+
- Supabase project with configured database

### 1. Project Configuration

Configure Supabase credentials in `SupabaseService.swift`:

```swift
let SUPABASE_URL = "https://your-project.supabase.co"
let SUPABASE_KEY = "your-anon-key"
```

### 2. Database Setup

Ensure the following tables exist in Supabase:

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
cd ios/HelixChat
open HelixChat.xcodeproj
```

In Xcode:

1. Select target device or simulator
2. Press Cmd+R to build and run

## Core Data Schema

**QueuedMessageEntity**

- id: UUID
- messageId: String
- content: String
- sessionKey: String
- timestamp: Date
- retries: Int (0-3)
- createdAt: Date

## State Management

### SupabaseService (@MainActor)

- Handles authentication and API calls
- Manages real-time subscriptions
- Provides methods for data operations

### OfflineSyncService (@MainActor)

- Network status monitoring
- Offline message queueing
- Retry logic with exponential backoff
- Core Data persistence

### ChatViewModel (@MainActor)

- Chat state (messages, input, loading)
- Bindings to offline sync status
- Operations (sendMessage, loadMessages, sync)

## Message Flow

### Online Message Send

1. User types and sends message
2. Optimistic update: message added to UI with `isPending=false`
3. SupabaseService sends to backend
4. Backend confirms receipt
5. UI updated with server response

### Offline Message Send

1. User types and sends message
2. App detects offline status
3. Message queued to Core Data with `isPending=true`
4. Optimistic update: message shown as pending (clock icon)
5. Offline banner shows queue length
6. When connection restored, auto-sync triggered
7. OfflineSyncService calls Supabase sync-messages edge function
8. Messages synced, marked with `syncedAt` timestamp
9. UI updates to show synced state

## Real-Time Sync

Subscriptions to `session_messages` table:

- Channel: `messages:{sessionKey}`
- Event: INSERT (new messages from assistant)
- Action: Automatically reload and display messages

## Error Handling

All errors caught and converted to `HelixError`:

```swift
struct HelixError: LocalizedError {
  let code: String
  let message: String
}
```

Error codes:

- `AUTH_FAILED` - Authentication failure
- `LOAD_FAILED` - Failed to load data
- `SEND_FAILED` - Failed to send message
- `OFFLINE` - Operation attempted while offline
- `SYNC_FAILED` - Offline sync failure

## Testing

Manual test scenarios:

1. **Sign Up / Sign In**
   - Test account creation with valid email
   - Test sign in with valid credentials
   - Verify persistent session

2. **Chat Operations**
   - Create new conversation
   - Send message while online
   - Verify real-time update appears
   - Reply from assistant

3. **Offline Behavior**
   - Disable WiFi
   - Send message while offline
   - Verify pending indicator appears
   - Verify message queued
   - Re-enable WiFi
   - Verify auto-sync triggered
   - Verify message synced

4. **Conversation Management**
   - Create multiple conversations
   - Switch between conversations
   - Verify message history loads correctly
   - Delete conversation

## Performance Considerations

- **Message Loading:** Pagination with limit=50 per request
- **Real-Time Updates:** Debounced to avoid excessive UI updates
- **Core Data Writes:** Batched operations for efficiency
- **Network Retries:** Exponential backoff prevents overwhelming server

## Security

- JWT tokens stored securely (Keychain via Supabase SDK)
- RLS policies enforce user isolation
- Device tracking via `UIDevice.current.identifierForVendor`
- TLS 1.2+ for all API communications

## Future Enhancements

1. **Voice Input:** Speech-to-text for faster messaging
2. **Push Notifications:** APNs integration for offline messages
3. **Biometric Auth:** Face ID / Touch ID support
4. **File Sharing:** Upload and share documents
5. **Typing Indicators:** Show when assistant is typing
6. **Message Search:** Search across conversation history
7. **Dark Mode:** Full dark mode support
8. **Widgets:** Home screen widget with recent conversations

## Troubleshooting

### Build Errors

- Clean build folder: Cmd+Shift+K
- Delete derived data: ~/Library/Developer/Xcode/DerivedData
- Re-run: Cmd+R

### Connection Issues

- Verify Supabase URL and key are correct
- Check internet connection
- Verify RLS policies allow unauthenticated reads
- Check Supabase status page

### Sync Failures

- Check network connectivity
- Review error message in OfflineSyncService
- Verify Core Data database not corrupted
- Check server logs

## Resources

- [Supabase Swift SDK](https://github.com/supabase/supabase-swift)
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
- [Core Data Guide](https://developer.apple.com/documentation/coredata)
- [Helix Observatory](../web/) - Web version reference

## License

Part of the Helix Cross-Platform Project. See main LICENSE file.
