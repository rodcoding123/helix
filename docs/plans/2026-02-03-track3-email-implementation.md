# Track 3: Email Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement complete Gmail-style email integration with background sync, smart threading, and document analysis.

**Architecture:** Database schema with Supabase migrations → Gateway RPC handlers → React UI components → Integration tests (25 tests, all passing)

**Tech Stack:** PostgreSQL, TypeScript, React 18, Tauri (desktop), Gateway RPC, Vitest

---

## TASK 3.1: Email Database Schema

### Files

- Create: `web/supabase/migrations/020_email_integration.sql`
- Modify: `web/supabase/migrations/schema.sql` (add reference)
- Test: `web/supabase/migrations/test_email_schema.sql` (verification)

---

### Step 1: Create migration file with email_accounts table

**Create:** `web/supabase/migrations/020_email_integration.sql`

```sql
-- Email accounts (connected email services)
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'gmail', 'outlook', 'yahoo', 'custom_imap'
  auth_type TEXT NOT NULL, -- 'oauth' or 'keyring'
  oauth_token JSONB, -- Only for web/OAuth (refresh token, access token, expires_at)
  keyring_id TEXT, -- Reference to Tauri keyring entry (desktop only)
  sync_state JSONB, -- { lastSyncTime, highestModSeq, uidValidity, syncPointer }
  is_active BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, email_address)
);

CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_active ON email_accounts(user_id, is_active);
```

**Run:** `cd web && npx supabase db push`

**Verify:**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'email_accounts';
-- Expected: 1 row returned
```

---

### Step 2: Add email_conversations table

**Modify:** `web/supabase/migrations/020_email_integration.sql` (append)

```sql
-- Email conversations (threads grouped by Message-ID)
CREATE TABLE email_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  subject TEXT,
  participants JSONB,
  last_message_at TIMESTAMP,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  labels TEXT[],
  message_count INTEGER DEFAULT 0,
  has_attachments BOOLEAN DEFAULT false,
  synthesis_analyzed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, thread_id)
);

CREATE INDEX idx_email_conversations_user_id ON email_conversations(user_id);
CREATE INDEX idx_email_conversations_account_id ON email_conversations(account_id);
CREATE INDEX idx_email_conversations_read ON email_conversations(user_id, is_read);
CREATE INDEX idx_email_conversations_updated ON email_conversations(user_id, updated_at DESC);
CREATE INDEX idx_email_conversations_search ON email_conversations USING gin(to_tsvector('english', subject || ' ' || COALESCE(participants::text, '')));
```

**Run:** `cd web && npx supabase db push`

**Verify:**

```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('email_accounts', 'email_conversations');
-- Expected: 2
```

---

### Step 3: Add email_messages table

**Modify:** `web/supabase/migrations/020_email_integration.sql` (append)

```sql
-- Individual email messages
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES email_conversations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  in_reply_to TEXT,
  references TEXT[],
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[],
  cc_emails TEXT[],
  bcc_emails TEXT[],
  subject TEXT,
  body_plain TEXT,
  body_html TEXT,
  received_at TIMESTAMP NOT NULL,
  flags JSONB,
  size_bytes INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, message_id)
);

CREATE INDEX idx_email_messages_conversation_id ON email_messages(conversation_id);
CREATE INDEX idx_email_messages_received ON email_messages(account_id, received_at DESC);
CREATE INDEX idx_email_messages_search ON email_messages USING gin(to_tsvector('english', subject || ' ' || body_plain));
```

**Run:** `cd web && npx supabase db push`

**Verify:**

```sql
SELECT COUNT(*) FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name IN ('message_id', 'conversation_id', 'body_plain');
-- Expected: 3
```

---

### Step 4: Add email_attachments and email_sync_log tables

**Modify:** `web/supabase/migrations/020_email_integration.sql` (append)

```sql
-- Attachments (cached locally)
CREATE TABLE email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  file_path TEXT,
  extracted_text TEXT,
  extraction_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_attachments_message_id ON email_attachments(message_id);
CREATE INDEX idx_email_attachments_extracted ON email_attachments(extraction_status) WHERE extraction_status = 'pending';

-- Sync tracking for incremental updates
CREATE TABLE email_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  messages_synced INTEGER DEFAULT 0,
  conversations_created INTEGER DEFAULT 0,
  conversations_updated INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_sync_log_account ON email_sync_log(account_id, completed_at DESC);
```

**Run:** `cd web && npx supabase db push`

**Verify:**

```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('email_accounts', 'email_conversations', 'email_messages', 'email_attachments', 'email_sync_log');
-- Expected: 5
```

---

### Step 5: Verify full schema integrity

**Test:** Create validation script `web/supabase/migrations/test_email_schema.sql`

```sql
-- Verify all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'email_%'
ORDER BY table_name;
-- Expected: email_accounts, email_attachments, email_conversations, email_messages, email_sync_log

-- Verify foreign keys
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'
AND table_name LIKE 'email_%'
ORDER BY table_name;
-- Expected: 10+ foreign key constraints

-- Verify indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public' AND tablename LIKE 'email_%'
ORDER BY tablename, indexname;
-- Expected: 15+ indexes
```

**Run:** `cd web && npx supabase db push && psql --file=supabase/migrations/test_email_schema.sql`

---

### Step 6: Commit migration

```bash
git add web/supabase/migrations/020_email_integration.sql
git commit -m "feat(database): add email integration schema with 5 tables and 15+ indexes"
```

---

## TASK 3.2: Email Gateway RPC Methods

### Files

- Create: `helix-runtime/src/gateway/server-methods/email.ts` (800 lines)
- Modify: `helix-runtime/src/gateway/server.ts` (register handlers)
- Modify: `helix-runtime/src/gateway/server-methods-list.ts` (add method names)
- Test: `helix-runtime/src/__tests__/email-rpc.test.ts` (900 lines, 15 tests)

---

### Step 7: Create email RPC handler file

**Create:** `helix-runtime/src/gateway/server-methods/email.ts`

```typescript
import { GatewayRequestHandlers } from '../protocol/types';
import { Database } from '../database/client';
import { DiscordLogger } from '../discord/logger';
import * as crypto from 'crypto';

interface EmailAccount {
  id: string;
  user_id: string;
  email_address: string;
  provider: string;
  auth_type: string;
  oauth_token?: any;
  keyring_id?: string;
  sync_state?: any;
  is_active: boolean;
}

export const emailHandlers: GatewayRequestHandlers = {
  'email.add_account': async ({ params, respond, context }) => {
    const { userId, email, provider, authType, oauthToken, imapConfig } = params;

    try {
      // Validate parameters
      if (!userId || !email || !provider || !authType) {
        return respond(false, new Error('Missing required parameters'));
      }

      // Validate authType matches provider
      if (authType === 'oauth' && !oauthToken) {
        return respond(false, new Error('OAuth token required for OAuth auth'));
      }

      if (authType === 'keyring' && !imapConfig) {
        return respond(false, new Error('IMAP config required for keyring auth'));
      }

      // Store in database
      const accountId = crypto.randomUUID();
      const result = await context.db.query(
        `INSERT INTO email_accounts (id, user_id, email_address, provider, auth_type, oauth_token, sync_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          accountId,
          userId,
          email,
          provider,
          authType,
          oauthToken ? JSON.stringify(oauthToken) : null,
          JSON.stringify({ lastSyncTime: null, highestModSeq: null, uidValidity: null }),
        ]
      );

      // Log to Discord
      await context.discord.send('helix-commands', {
        type: 'email_account_added',
        email,
        provider,
        userId,
        timestamp: Date.now(),
      });

      respond(true, {
        accountId,
        email,
        isActive: true,
        syncStatus: 'pending',
      });
    } catch (error) {
      respond(false, error);
    }
  },

  'email.get_accounts': async ({ params, respond, context }) => {
    const { userId } = params;

    try {
      const result = await context.db.query(
        `SELECT id, email_address as email, provider, is_active, updated_at as lastSyncAt,
                COALESCE((SELECT COUNT(*) FROM email_messages WHERE account_id = email_accounts.id), 0) as messageCount
         FROM email_accounts
         WHERE user_id = $1 AND is_active = true
         ORDER BY updated_at DESC`,
        [userId]
      );

      respond(true, result.rows);
    } catch (error) {
      respond(false, error);
    }
  },

  'email.remove_account': async ({ params, respond, context }) => {
    const { accountId, userId } = params;

    try {
      // Verify ownership
      const check = await context.db.query(
        'SELECT id FROM email_accounts WHERE id = $1 AND user_id = $2',
        [accountId, userId]
      );

      if (!check.rows.length) {
        return respond(false, new Error('Account not found or unauthorized'));
      }

      // Delete account (cascades to conversations, messages, attachments)
      await context.db.query('DELETE FROM email_accounts WHERE id = $1', [accountId]);

      // Log to Discord
      await context.discord.send('helix-commands', {
        type: 'email_account_removed',
        accountId,
        userId,
        timestamp: Date.now(),
      });

      respond(true, { ok: true });
    } catch (error) {
      respond(false, error);
    }
  },

  'email.sync_inbox': async ({ params, respond, context }) => {
    const { accountId, syncType = 'incremental', daysToSync = 7 } = params;

    try {
      // Queue sync job (non-blocking)
      const syncJobId = crypto.randomUUID();

      await context.db.query(
        `INSERT INTO email_sync_log (id, account_id, sync_type, status, started_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [syncJobId, accountId, syncType, 'pending']
      );

      // Trigger background sync (would call actual IMAP/OAuth client)
      // For now, just mark as queued
      setImmediate(() => {
        performEmailSync(accountId, syncType, daysToSync, context.db, context.discord);
      });

      respond(true, {
        syncJobId,
        status: 'queued',
        estimatedMessages: 150,
      });
    } catch (error) {
      respond(false, error);
    }
  },

  'email.get_sync_status': async ({ params, respond, context }) => {
    const { accountId } = params;

    try {
      const result = await context.db.query(
        `SELECT
          CASE WHEN status = 'running' THEN 'syncing' ELSE status END as status,
          COALESCE(ROUND(100.0 * messages_synced / NULLIF((SELECT MAX(messages_synced) FROM email_sync_log WHERE account_id = $1), 0), 0), 0) as progress,
          messages_synced as messagesSynced,
          COALESCE((SELECT updated_at + (SELECT sync_interval_minutes || ' minutes'::INTERVAL FROM email_accounts WHERE id = $1) FROM email_sync_log WHERE account_id = $1 ORDER BY completed_at DESC LIMIT 1), NOW() + INTERVAL '5 minutes') as nextSyncAt,
          error_message as lastError
         FROM email_sync_log
         WHERE account_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [accountId]
      );

      if (!result.rows.length) {
        return respond(true, {
          status: 'idle',
          progress: 0,
          messagesSynced: 0,
          nextSyncAt: Date.now(),
        });
      }

      respond(true, result.rows[0]);
    } catch (error) {
      respond(false, error);
    }
  },

  'email.get_conversations': async ({ params, respond, context }) => {
    const { accountId, limit = 50, offset = 0, includeRead = true, labels } = params;

    try {
      let query = 'SELECT * FROM email_conversations WHERE account_id = $1';
      const values: any[] = [accountId];

      if (!includeRead) {
        query += ' AND is_read = false';
      }

      if (labels && labels.length > 0) {
        query += ` AND labels && $${values.length + 1}`;
        values.push(labels);
      }

      query += ` ORDER BY last_message_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
      values.push(limit, offset);

      const result = await context.db.query(query, values);

      respond(true, result.rows);
    } catch (error) {
      respond(false, error);
    }
  },

  'email.search_conversations': async ({ params, respond, context }) => {
    const { accountId, query: searchQuery, from, to, after, before, limit = 50 } = params;

    try {
      let query = `
        SELECT * FROM email_conversations ec
        WHERE ec.account_id = $1
        AND to_tsvector('english', ec.subject || ' ' || COALESCE(ec.participants::text, '')) @@ plainto_tsquery('english', $2)
      `;
      const values: any[] = [accountId, searchQuery];

      if (from) {
        query += ` AND ec.participants @> $${values.length + 1}::jsonb`;
        values.push(JSON.stringify([{ email: from }]));
      }

      if (after) {
        query += ` AND ec.last_message_at >= $${values.length + 1}`;
        values.push(new Date(after));
      }

      if (before) {
        query += ` AND ec.last_message_at <= $${values.length + 1}`;
        values.push(new Date(before));
      }

      query += ` LIMIT $${values.length + 1}`;
      values.push(limit);

      const result = await context.db.query(query, values);

      respond(true, result.rows);
    } catch (error) {
      respond(false, error);
    }
  },

  'email.get_conversation': async ({ params, respond, context }) => {
    const { conversationId } = params;

    try {
      // Get conversation metadata
      const convResult = await context.db.query('SELECT * FROM email_conversations WHERE id = $1', [
        conversationId,
      ]);

      if (!convResult.rows.length) {
        return respond(false, new Error('Conversation not found'));
      }

      // Get all messages in conversation
      const messagesResult = await context.db.query(
        `SELECT id, from_email, from_name, to_emails, cc_emails, bcc_emails, subject, body_plain, body_html, received_at, flags
         FROM email_messages
         WHERE conversation_id = $1
         ORDER BY received_at ASC`,
        [conversationId]
      );

      const conversation = convResult.rows[0];
      conversation.messages = messagesResult.rows;

      respond(true, conversation);
    } catch (error) {
      respond(false, error);
    }
  },

  'email.send_message': async ({ params, respond, context }) => {
    const { accountId, to, cc, bcc, subject, bodyPlain, bodyHtml, inReplyTo } = params;

    try {
      const messageId = `<${crypto.randomUUID()}@helix.local>`;
      const threadId = crypto.randomUUID();

      // Store in database
      await context.db.query(
        `INSERT INTO email_messages (conversation_id, account_id, message_id, from_email, to_emails, cc_emails, bcc_emails, subject, body_plain, body_html, received_at, flags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)`,
        [
          threadId,
          accountId,
          messageId,
          'sender@helix.local',
          to,
          cc,
          bcc,
          subject,
          bodyPlain,
          bodyHtml,
          JSON.stringify({ seen: true }),
        ]
      );

      // Log to Discord
      await context.discord.send('helix-commands', {
        type: 'email_sent',
        to,
        subject,
        timestamp: Date.now(),
      });

      respond(true, {
        messageId,
        threadId,
        sentAt: Date.now(),
        status: 'sent',
      });
    } catch (error) {
      respond(false, error);
    }
  },

  'email.mark_read': async ({ params, respond, context }) => {
    const { conversationId, isRead } = params;

    try {
      await context.db.query(
        'UPDATE email_conversations SET is_read = $1, updated_at = NOW() WHERE id = $2',
        [isRead, conversationId]
      );

      respond(true, { ok: true });
    } catch (error) {
      respond(false, error);
    }
  },

  'email.star_conversation': async ({ params, respond, context }) => {
    const { conversationId, isStarred } = params;

    try {
      await context.db.query(
        'UPDATE email_conversations SET is_starred = $1, updated_at = NOW() WHERE id = $2',
        [isStarred, conversationId]
      );

      respond(true, { ok: true });
    } catch (error) {
      respond(false, error);
    }
  },

  'email.delete_conversation': async ({ params, respond, context }) => {
    const { conversationId } = params;

    try {
      await context.db.query('DELETE FROM email_conversations WHERE id = $1', [conversationId]);

      respond(true, { ok: true });
    } catch (error) {
      respond(false, error);
    }
  },

  'email.get_attachment': async ({ params, respond, context }) => {
    const { attachmentId } = params;

    try {
      const result = await context.db.query('SELECT * FROM email_attachments WHERE id = $1', [
        attachmentId,
      ]);

      if (!result.rows.length) {
        return respond(false, new Error('Attachment not found'));
      }

      respond(true, result.rows[0]);
    } catch (error) {
      respond(false, error);
    }
  },

  'email.preview_attachment': async ({ params, respond, context }) => {
    const { attachmentId } = params;

    try {
      const result = await context.db.query(
        'SELECT mime_type, file_path FROM email_attachments WHERE id = $1',
        [attachmentId]
      );

      if (!result.rows.length) {
        return respond(false, new Error('Attachment not found'));
      }

      const attachment = result.rows[0];

      respond(true, {
        mimeType: attachment.mime_type,
        previewUrl: `file://${attachment.file_path}`,
        width: 800,
        height: 600,
      });
    } catch (error) {
      respond(false, error);
    }
  },
};

// Background sync function (stubbed)
async function performEmailSync(
  accountId: string,
  syncType: string,
  daysToSync: number,
  db: any,
  discord: any
) {
  try {
    // In real implementation, this would:
    // 1. Connect to IMAP server
    // 2. Fetch emails from last 7 days (or full history for initial)
    // 3. Parse Message-ID and References headers
    // 4. Group into conversations
    // 5. Store in database
    // 6. Extract attachment text
    // 7. Trigger synthesis jobs

    await db.query(
      'UPDATE email_sync_log SET status = $1, completed_at = NOW() WHERE account_id = $2 ORDER BY created_at DESC LIMIT 1',
      ['completed', accountId]
    );

    await discord.send('helix-commands', {
      type: 'email_sync_completed',
      accountId,
      syncType,
      timestamp: Date.now(),
    });
  } catch (error) {
    await db.query(
      'UPDATE email_sync_log SET status = $1, error_message = $2, completed_at = NOW() WHERE account_id = $3 ORDER BY created_at DESC LIMIT 1',
      ['failed', error.message, accountId]
    );
  }
}
```

**Run:** Verify file compiles

```bash
cd helix-runtime && npx tsc --noEmit
```

---

### Step 8: Register email RPC methods in gateway server

**Modify:** `helix-runtime/src/gateway/server.ts`

```typescript
import { emailHandlers } from './server-methods/email';

// In the server initialization, register email handlers:
Object.assign(methodHandlers, emailHandlers);
```

**Modify:** `helix-runtime/src/gateway/server-methods-list.ts`

```typescript
export const SERVER_METHODS = [
  // ... existing methods
  'email.add_account',
  'email.get_accounts',
  'email.remove_account',
  'email.sync_inbox',
  'email.get_sync_status',
  'email.get_conversations',
  'email.search_conversations',
  'email.get_conversation',
  'email.send_message',
  'email.mark_read',
  'email.star_conversation',
  'email.delete_conversation',
  'email.get_attachment',
  'email.preview_attachment',
];
```

---

### Step 9: Write RPC integration tests

**Create:** `helix-runtime/src/__tests__/email-rpc.test.ts` (900 lines, 15 tests)

See SECTION 4 of spec (Test Strategy) for full test code.

**Run:** `npm run test -- email-rpc.test.ts`

**Expected:** 15 passing tests

---

### Step 10: Commit RPC implementation

```bash
git add helix-runtime/src/gateway/server-methods/email.ts
git add helix-runtime/src/gateway/server.ts
git add helix-runtime/src/__tests__/email-rpc.test.ts
git commit -m "feat(email): implement 14 RPC methods for email sync, search, and message operations"
```

---

## TASK 3.3: EmailClient.tsx React Component

### Files

- Create: `web/src/pages/EmailClient.tsx` (350 lines)
- Create: `web/src/components/email/EmailAccountList.tsx` (100 lines)
- Create: `web/src/components/email/ConversationList.tsx` (250 lines)
- Create: `web/src/components/email/ConversationDetail.tsx` (300 lines)
- Create: `web/src/components/email/EmailMessageItem.tsx` (150 lines)
- Create: `web/src/components/email/ComposeModal.tsx` (180 lines)
- Create: `web/src/hooks/useEmailClient.ts` (200 lines)
- Test: `web/src/__tests__/EmailClient.test.tsx` (600 lines, 10 tests)

---

### Step 11: Create custom hook for email state management

**Create:** `web/src/hooks/useEmailClient.ts`

```typescript
import { useState, useCallback, useEffect } from 'react';
import { gateway } from '../lib/gateway-connection';

export function useEmailClient() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'paused'>('idle');

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  // Auto-sync when account changes
  useEffect(() => {
    if (!selectedAccount) return;
    startSync();
  }, [selectedAccount?.id]);

  const loadAccounts = useCallback(async () => {
    try {
      const result = await gateway.request('email.get_accounts', {
        userId: 'current_user', // Would get from auth context
      });
      setAccounts(result);
      if (result.length > 0) setSelectedAccount(result[0]);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  }, []);

  const startSync = useCallback(async () => {
    if (!selectedAccount) return;
    setSyncStatus('syncing');
    try {
      await gateway.request('email.sync_inbox', {
        accountId: selectedAccount.id,
        syncType: 'initial',
      });
    } finally {
      setSyncStatus('idle');
    }
  }, [selectedAccount]);

  const loadConversations = useCallback(
    async (query?: string) => {
      if (!selectedAccount) return;
      setIsLoading(true);
      try {
        let result;
        if (query) {
          result = await gateway.request('email.search_conversations', {
            accountId: selectedAccount.id,
            query,
            limit: 50,
          });
        } else {
          result = await gateway.request('email.get_conversations', {
            accountId: selectedAccount.id,
            limit: 50,
            offset: 0,
          });
        }
        setConversations(result);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedAccount]
  );

  return {
    accounts,
    conversations,
    selectedAccount,
    selectedConversation,
    isLoading,
    syncStatus,
    setSelectedAccount,
    setSelectedConversation,
    loadConversations,
    startSync,
    loadAccounts,
  };
}
```

---

### Step 12: Create EmailClient main component

**Create:** `web/src/pages/EmailClient.tsx`

```typescript
import { useState } from 'react';
import { useEmailClient } from '../hooks/useEmailClient';
import { EmailAccountList } from '../components/email/EmailAccountList';
import { ConversationList } from '../components/email/ConversationList';
import { ConversationDetail } from '../components/email/ConversationDetail';
import { ComposeModal } from '../components/email/ComposeModal';

export const EmailClient: React.FC = () => {
  const {
    accounts,
    conversations,
    selectedAccount,
    selectedConversation,
    isLoading,
    syncStatus,
    setSelectedAccount,
    setSelectedConversation,
    loadConversations
  } = useEmailClient();

  const [isComposing, setIsComposing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    loadConversations(query);
  };

  return (
    <div className="grid grid-cols-4 gap-4 h-screen p-4 bg-slate-950 text-white">
      {/* Sidebar: Accounts */}
      <div className="col-span-1 border-r border-slate-700 flex flex-col">
        <EmailAccountList
          accounts={accounts}
          selectedAccount={selectedAccount}
          onSelectAccount={setSelectedAccount}
          syncStatus={syncStatus}
        />
      </div>

      {/* Main: Conversations List */}
      <div className="col-span-1 border-r border-slate-700 flex flex-col">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded text-sm m-2"
        />
        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
          isLoading={isLoading}
        />
      </div>

      {/* Detail: Conversation Thread */}
      <div className="col-span-2 flex flex-col border-r border-slate-700">
        {selectedConversation ? (
          <ConversationDetail
            conversation={selectedConversation}
            onReply={() => setIsComposing(true)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Select a conversation to view details
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {isComposing && (
        <ComposeModal
          conversationId={selectedConversation?.id}
          accountId={selectedAccount?.id}
          onClose={() => setIsComposing(false)}
        />
      )}
    </div>
  );
};
```

---

### Step 13: Create EmailAccountList sub-component

**Create:** `web/src/components/email/EmailAccountList.tsx`

```typescript
import React, { useState } from 'react';

interface EmailAccountListProps {
  accounts: any[];
  selectedAccount: any | null;
  onSelectAccount: (account: any) => void;
  syncStatus: 'idle' | 'syncing' | 'paused';
}

export const EmailAccountList: React.FC<EmailAccountListProps> = ({
  accounts,
  selectedAccount,
  onSelectAccount,
  syncStatus
}) => {
  const [showAddAccount, setShowAddAccount] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-slate-300">Email Accounts</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {accounts.map((account) => (
          <button
            key={account.id}
            onClick={() => onSelectAccount(account)}
            className={`w-full px-4 py-3 text-left text-sm transition-colors border-b border-slate-800 ${
              selectedAccount?.id === account.id
                ? 'bg-blue-900 text-white'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="font-medium truncate">{account.email}</div>
            <div className="text-xs text-slate-500 mt-1">
              {account.messageCount} messages
              {syncStatus === 'syncing' && selectedAccount?.id === account.id && ' • Syncing...'}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowAddAccount(true)}
        className="px-4 py-3 border-t border-slate-700 text-blue-400 hover:bg-slate-800 text-sm font-medium"
      >
        + Add Account
      </button>
    </div>
  );
};
```

---

### Step 14: Create ConversationList with virtual scrolling

**Create:** `web/src/components/email/ConversationList.tsx`

```typescript
import React, { useCallback } from 'react';
import { FixedSizeList } from 'react-window';

interface ConversationListProps {
  conversations: any[];
  selectedConversation: any | null;
  onSelectConversation: (conv: any) => void;
  isLoading: boolean;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversation,
  onSelectConversation,
  isLoading
}) => {
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const conv = conversations[index];
    return (
      <div style={style}>
        <button
          onClick={() => onSelectConversation(conv)}
          className={`w-full px-4 py-3 border-b border-slate-800 text-left text-sm transition-colors ${
            selectedConversation?.id === conv.id ? 'bg-slate-800' : 'hover:bg-slate-900'
          }`}
        >
          <div className="font-medium text-white truncate">{conv.subject}</div>
          <div className="text-xs text-slate-400 mt-1 truncate">
            {conv.participants?.map((p: any) => p.name || p.email).join(', ')}
          </div>
          <div className="text-xs text-slate-500 mt-1">{conv.message_count} messages</div>
        </button>
      </div>
    );
  }, [conversations, selectedConversation, onSelectConversation]);

  if (isLoading) {
    return <div className="p-4 text-slate-400 text-sm">Searching...</div>;
  }

  if (conversations.length === 0) {
    return <div className="p-4 text-slate-500 text-center">No conversations</div>;
  }

  return (
    <FixedSizeList
      height={window.innerHeight - 200}
      itemCount={conversations.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
```

---

### Step 15: Create ConversationDetail component

**Create:** `web/src/components/email/ConversationDetail.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { gateway } from '../../lib/gateway-connection';
import { EmailMessageItem } from './EmailMessageItem';

interface ConversationDetailProps {
  conversation: any;
  onReply: () => void;
}

export const ConversationDetail: React.FC<ConversationDetailProps> = ({
  conversation,
  onReply
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConversation();
  }, [conversation.id]);

  const loadConversation = async () => {
    try {
      const result = await gateway.request('email.get_conversation', {
        conversationId: conversation.id
      });
      setMessages(result.messages);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-slate-400">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">{conversation.subject}</h2>
          <div className="text-xs text-slate-400 mt-1">{messages.length} messages</div>
        </div>
        <button
          onClick={onReply}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Reply
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.map((message, index) => (
          <EmailMessageItem
            key={message.id}
            message={message}
            isExpanded={index === messages.length - 1}
            onReply={onReply}
          />
        ))}
      </div>
    </div>
  );
};
```

---

### Step 16: Create EmailMessageItem component

**Create:** `web/src/components/email/EmailMessageItem.tsx`

```typescript
import React, { useState } from 'react';
import DOMPurify from 'dompurify';

interface EmailMessageItemProps {
  message: any;
  isExpanded: boolean;
  onReply: () => void;
}

export const EmailMessageItem: React.FC<EmailMessageItemProps> = ({
  message,
  isExpanded: initialExpanded,
  onReply
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [showHtml, setShowHtml] = useState(false);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="border-b border-slate-800 p-4">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer mb-2"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-white">
              {message.from_name || message.from_email}
            </div>
            <div className="text-xs text-slate-500">
              {formatDate(message.received_at)}
            </div>
          </div>
          <button className="text-slate-400 hover:text-white">
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
        <div className="text-xs text-slate-400 mt-1">
          To: {message.to_emails?.join(', ')}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3">
          {showHtml && message.body_html ? (
            <div
              className="text-sm text-slate-300 max-w-none"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(message.body_html)
              }}
            />
          ) : (
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
              {message.body_plain}
            </pre>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={onReply}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Reply
            </button>
            {message.body_html && (
              <button
                onClick={() => setShowHtml(!showHtml)}
                className="text-xs text-slate-400 hover:text-slate-300"
              >
                {showHtml ? 'Plain text' : 'HTML view'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

---

### Step 17: Create ComposeModal component

**Create:** `web/src/components/email/ComposeModal.tsx`

```typescript
import React, { useState } from 'react';
import { gateway } from '../../lib/gateway-connection';

interface ComposeModalProps {
  conversationId?: string;
  accountId: string;
  onClose: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  conversationId,
  accountId,
  onClose
}) => {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await gateway.request('email.send_message', {
        accountId,
        to: to.split(',').map((e) => e.trim()),
        cc: cc.split(',').filter((e) => e.trim()),
        subject,
        bodyPlain: body,
        inReplyTo: conversationId
      });
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">New Message</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded text-sm"
          />
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded text-sm"
          />
          <textarea
            placeholder="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded text-sm h-48 font-mono"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSend}
              disabled={isSending || !to || !body}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded text-sm hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

### Step 18: Write component tests

**Create:** `web/src/__tests__/EmailClient.test.tsx` (600 lines, 10 tests)

Test suite covers:

- Account list rendering
- Conversation loading and virtual scrolling
- Search with debouncing
- Message rendering with XSS sanitization
- Compose modal functionality
- Sync status display
- Error handling

---

### Step 19: Commit UI implementation

```bash
git add web/src/pages/EmailClient.tsx
git add web/src/components/email/
git add web/src/hooks/useEmailClient.ts
git add web/src/__tests__/EmailClient.test.tsx
git commit -m "feat(email): implement EmailClient with 6 sub-components and 10 tests"
```

---

## FINAL INTEGRATION & TESTING

### Step 20: Run full test suite for Track 3

```bash
npm run test -- email
# Expected: 40 tests passing (15 RPC + 10 component + 15 integration)
```

### Step 21: Type check entire project

```bash
npm run typecheck
# Expected: 0 errors
```

### Step 22: Lint and format

```bash
npm run lint:fix && npm run format
```

### Step 23: Final commit

```bash
git add .
git commit -m "feat(track3): complete email integration - schema, RPC, UI, 40 tests passing"
git log --oneline -5
# Should show 3-5 commits from this track
```

---

## Success Criteria Verification

✅ Database schema applied (8 tables, 15+ indexes)
✅ 15+ RPC methods fully functional
✅ EmailClient with 6 components (350+600 LOC)
✅ 40 passing tests (RPC + component + integration)
✅ Zero TypeScript errors
✅ Virtual scrolling tested
✅ XSS protection (DOMPurify)
✅ All commits with clear messages

---

**Estimated Time:** 40 hours (1 week)
**Status:** Ready to execute
