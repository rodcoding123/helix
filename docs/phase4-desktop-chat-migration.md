# Phase 4.4: Desktop Chat UI Migration to Supabase

This document provides the migration path for desktop chat components from the gateway WebSocket client to the new Supabase backend.

## Overview

**Current Architecture (Gateway-based):**
```
DesktopChat Component
    ↓ (uses gateway-client.ts)
    ↓ WebSocket connection to local gateway
    ↓ gateway handles all operations
OpenClaw Gateway
    ↓ Proxies to Helix backend
Cloud API
```

**New Architecture (Supabase-based):**
```
DesktopChat Component
    ↓ (uses useSupabaseChat hook)
    ↓ Supabase client (REST API)
    ↓ Handles offline queueing locally
Supabase Backend
    ↓ Stores conversations and messages
    ↓ Real-time subscriptions via PostgreSQL
PostgreSQL Database
```

**Key Benefits:**
- ✅ Cross-platform consistency (web, desktop, mobile all use same backend)
- ✅ Offline-first architecture with automatic sync
- ✅ Real-time updates via Supabase channels
- ✅ Reduced gateway dependency for chat (gateway still used for system operations)
- ✅ Native localStorage persistence for message queue

## Migration Steps

### Step 1: Update Imports in Chat Component

**Before:**
```typescript
import { getGatewayClient, GatewayClient } from '../lib/gateway-client';

export function DesktopChat() {
  const [gateway, setGateway] = useState<GatewayClient | null>(null);

  useEffect(() => {
    const client = getGatewayClient();
    if (client) {
      setGateway(client);
    }
  }, []);

  const sendMessage = async (content: string) => {
    const result = await gateway?.chat({ content });
    // ...
  };
}
```

**After:**
```typescript
import { useSupabaseChat } from '../hooks/useSupabaseChat';

export function DesktopChat() {
  const { sendMessage, messages, currentSessionKey } = useSupabaseChat();
  // Hook handles all initialization
}
```

### Step 2: Replace Chat Send Logic

**Before:**
```typescript
const sendMessage = async (content: string) => {
  try {
    const result = await gateway!.chat({
      content,
      sessionKey: currentSession,
      idempotencyKey: crypto.randomUUID(),
    });
    console.log('Message sent:', result.runId);
  } catch (err) {
    console.error('Failed to send:', err);
  }
};
```

**After:**
```typescript
// Hook handles all the complexity internally
const { sendMessage } = useSupabaseChat();

// Usage:
const handleSendMessage = async (content: string) => {
  await sendMessage(content);
  // No try/catch needed - hook manages error state
};
```

### Step 3: Replace Conversation Management

**Before:**
```typescript
const [chatHistory, setChatHistory] = useState<Message[]>([]);

const loadHistory = async () => {
  const history = await gateway!.getChatHistory({
    sessionKey: currentSession,
    limit: 100,
  });
  setChatHistory(history);
};

useEffect(() => {
  loadHistory();
}, [currentSession]);
```

**After:**
```typescript
const { messages, conversation, selectConversation } = useSupabaseChat();

// Usage:
const handleSelectSession = async (sessionKey: string) => {
  await selectConversation(sessionKey);
  // Messages automatically loaded and subscribed to real-time updates
};
```

### Step 4: Replace Session List

**Before:**
```typescript
const [sessions, setSessions] = useState<any[]>([]);

const loadSessions = async () => {
  const result = await gateway!.listSessions();
  setSessions(result);
};

useEffect(() => {
  loadSessions();
}, []);
```

**After:**
```typescript
const { conversations } = useSupabaseChat();
// Automatically includes real-time subscription updates
```

### Step 5: Add Offline Status Indicator

**New Capability:**
```typescript
const { syncStatus } = useSupabaseChat();

return (
  <div>
    {!syncStatus.isOnline && (
      <div className="offline-banner">
        ⚠️ Offline: {syncStatus.queueLength} messages queued
      </div>
    )}

    {syncStatus.isSyncing && (
      <div className="sync-indicator">
        🔄 Syncing {syncStatus.queueLength} messages...
      </div>
    )}
  </div>
);
```

## Component Migration Examples

### Example 1: ChatMessages Component

```typescript
// OLD
import { GatewayClient } from '../lib/gateway-client';

interface ChatMessagesProps {
  sessionKey: string;
  gateway: GatewayClient;
}

export function ChatMessages({ sessionKey, gateway }: ChatMessagesProps) {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    gateway.getChatHistory({ sessionKey })
      .then(setMessages)
      .catch(console.error);
  }, [sessionKey, gateway]);

  return (
    <div className="messages">
      {messages.map(msg => (
        <div key={msg.id} className="message">{msg.content}</div>
      ))}
    </div>
  );
}

// NEW
import { useSupabaseChat } from '../hooks/useSupabaseChat';

interface ChatMessagesProps {
  sessionKey: string;
}

export function ChatMessages({ sessionKey }: ChatMessagesProps) {
  const { messages, isLoadingMessages } = useSupabaseChat();

  useEffect(() => {
    // This would be in a parent component
    // selectConversation(sessionKey);
  }, [sessionKey]);

  if (isLoadingMessages) return <div>Loading...</div>;

  return (
    <div className="messages">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`message ${msg.role}`}
        >
          {msg.content}
        </div>
      ))}
    </div>
  );
}
```

### Example 2: ChatInput Component

```typescript
// OLD
interface ChatInputProps {
  sessionKey: string;
  gateway: GatewayClient;
  onSent?: () => void;
}

export function ChatInput({ sessionKey, gateway, onSent }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    setIsSending(true);
    try {
      await gateway.chat({
        content: input,
        sessionKey,
        idempotencyKey: crypto.randomUUID(),
      });
      setInput('');
      onSent?.();
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <input
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
      disabled={isSending}
    />
  );
}

// NEW
interface ChatInputProps {
  onSent?: () => void;
}

export function ChatInput({ onSent }: ChatInputProps) {
  const [input, setInput] = useState('');
  const { sendMessage, messageError } = useSupabaseChat();

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input);
    setInput('');
    onSent?.();
  };

  return (
    <div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        placeholder="Type a message..."
      />
      {messageError && <div className="error">{messageError}</div>}
    </div>
  );
}
```

### Example 3: SessionSidebar Component

```typescript
// OLD
interface SessionSidebarProps {
  gateway: GatewayClient;
  onSelectSession: (sessionKey: string) => void;
}

export function SessionSidebar({ gateway, onSelectSession }: SessionSidebarProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    gateway.listSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [gateway]);

  return (
    <aside className="sidebar">
      {isLoading ? (
        <div>Loading sessions...</div>
      ) : (
        sessions.map(session => (
          <div
            key={session.id}
            onClick={() => onSelectSession(session.sessionKey)}
          >
            {session.title || 'Untitled'}
          </div>
        ))
      )}
    </aside>
  );
}

// NEW
interface SessionSidebarProps {
  onSelectSession: (sessionKey: string) => void;
}

export function SessionSidebar({ onSelectSession }: SessionSidebarProps) {
  const { conversations, isLoadingConversations, createConversation } = useSupabaseChat();

  const handleNewSession = async () => {
    await createConversation('New Conversation');
  };

  return (
    <aside className="sidebar">
      <button onClick={handleNewSession}>New Chat</button>

      {isLoadingConversations ? (
        <div>Loading conversations...</div>
      ) : (
        conversations.map(conv => (
          <div
            key={conv.session_key}
            onClick={() => onSelectSession(conv.session_key)}
          >
            {conv.title || 'Untitled'}
          </div>
        ))
      )}
    </aside>
  );
}
```

## Offline Support

The new architecture automatically handles offline scenarios:

```typescript
// User sends message while offline
await sendMessage("Hello"); // Message queued locally

// Messages are persisted in localStorage
// When online, automatically synced to Supabase
// Real-time subscription updates UI when sync completes
```

**Status Monitoring:**
```typescript
const { syncStatus } = useSupabaseChat();

console.log(syncStatus);
// {
//   isOnline: false,
//   queueLength: 3,
//   isSyncing: false,
//   failedCount: 0
// }
```

## Gateway Still Used For

The OpenClaw gateway is still used for non-chat operations:

- System operations (health, status, skills)
- Browser automation
- Exec approvals
- Device management
- Node operations
- Channels management

**Combined Architecture:**
```
Desktop App
  ├── useSupabaseChat (REST API)
  │   └── Supabase (conversations, messages)
  │
  └── getGatewayClient (WebSocket)
      └── OpenClaw Gateway (system ops)
```

## Testing Migration

### Unit Tests for New Hook

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSupabaseChat } from './useSupabaseChat';

describe('useSupabaseChat', () => {
  it('should load conversations on init', async () => {
    const { result } = renderHook(() => useSupabaseChat());

    await waitFor(() => {
      expect(result.current.isLoadingConversations).toBe(false);
    });

    expect(result.current.conversations.length).toBeGreaterThan(0);
  });

  it('should send message', async () => {
    const { result } = renderHook(() => useSupabaseChat());

    act(() => {
      result.current.sendMessage('Hello');
    });

    await waitFor(() => {
      expect(result.current.messages.some(m => m.content === 'Hello')).toBe(true);
    });
  });

  it('should queue messages when offline', async () => {
    // Mock offline
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useSupabaseChat());

    act(() => {
      result.current.sendMessage('Offline message');
    });

    expect(result.current.syncStatus.queueLength).toBe(1);
  });
});
```

## Rollback Plan

If issues arise, rollback is straightforward:

1. Keep gateway-client.ts functional (already done)
2. Restore gateway imports in components
3. Remove useSupabaseChat usage
4. Redeploy

Gateway client is not removed, only supplemented.

## Migration Checklist

- [ ] Update imports in ChatMessages.tsx
- [ ] Update imports in ChatInput.tsx
- [ ] Update imports in SessionSidebar.tsx
- [ ] Update imports in main DesktopChat.tsx
- [ ] Remove gateway-specific prop threading
- [ ] Add offline status indicator
- [ ] Update type definitions
- [ ] Run unit tests
- [ ] Test on desktop app
- [ ] Test offline functionality
- [ ] Test message sync
- [ ] Test real-time updates
- [ ] Monitor for regressions

## Performance Considerations

**Message Loading:**
- OLD: Single request to gateway, then polling
- NEW: Initial REST query, then real-time subscription (faster, less polling)

**Conversation List:**
- OLD: Single request to gateway periodically
- NEW: Real-time subscription, instant updates

**Offline:**
- OLD: Messages lost when offline
- NEW: Messages queued locally with automatic sync

**Storage:**
- Queue persisted to localStorage (5-10KB per 100 messages)
- Automatic cleanup on successful sync

## Next Steps

After desktop chat migration:
1. Phase 4.5: iOS Swift app
2. Phase 4.6: Android Kotlin app
3. Phase 4.7: Quality checks
4. Full cross-platform testing

All platforms will share the same Supabase backend while having native UIs appropriate to their platform.
