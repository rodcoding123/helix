# Track 3: Phase 2 Email Integration - Complete Specification

**Date:** February 3, 2026
**Status:** Ready for Implementation
**Scope:** Tasks 3.1-3.3 (Database Schema, RPC Methods, UI Component)
**Estimated Effort:** 1 week (40 hours)
**Test Target:** 25 passing tests

---

## Executive Summary

Track 3 implements Gmail-style threaded email with automatic background sync, smart caching, and document analysis for psychological synthesis. Built on Streaming Sync (7 days initial + full history background) with System Keyring (desktop) + OAuth (web) credentials.

**Architectural Decisions:**

- ✅ Credentials: System Keyring (desktop) + OAuth (web)
- ✅ Sync: Streaming (7 days initial, full history background, continuous updates)
- ✅ Threading: Gmail-style hybrid (RFC 2822 Message-ID/References + fallback to subject matching)
- ✅ Attachments: Smart caching with document analysis (PDF text extraction for synthesis)

---

## TASK 3.1: Email Database Schema

### Files to Create

- `web/supabase/migrations/020_email_integration.sql` (NEW)

### SQL Schema

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
  sync_interval_minutes INTEGER DEFAULT 5, -- Polling interval for background sync
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, email_address)
);

CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_active ON email_accounts(user_id, is_active);

-- Email conversations (threads grouped by Message-ID)
CREATE TABLE email_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL, -- Gmail-style thread ID
  subject TEXT,
  participants JSONB, -- [{ email, name, role: 'from'|'to'|'cc'|'bcc' }]
  last_message_at TIMESTAMP,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  labels TEXT[],
  message_count INTEGER DEFAULT 0,
  has_attachments BOOLEAN DEFAULT false,
  synthesis_analyzed BOOLEAN DEFAULT false, -- For Layer 5 synthesis
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, thread_id)
);

CREATE INDEX idx_email_conversations_user_id ON email_conversations(user_id);
CREATE INDEX idx_email_conversations_account_id ON email_conversations(account_id);
CREATE INDEX idx_email_conversations_read ON email_conversations(user_id, is_read);
CREATE INDEX idx_email_conversations_updated ON email_conversations(user_id, updated_at DESC);
CREATE INDEX idx_email_conversations_search ON email_conversations USING gin(to_tsvector('english', subject || ' ' || COALESCE(participants::text, '')));

-- Individual email messages
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES email_conversations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL, -- RFC 2822 Message-ID header
  in_reply_to TEXT, -- Parent message ID
  references TEXT[], -- All ancestor message IDs (threading chain)
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[],
  cc_emails TEXT[],
  bcc_emails TEXT[],
  subject TEXT,
  body_plain TEXT,
  body_html TEXT,
  received_at TIMESTAMP NOT NULL,
  flags JSONB, -- { seen, flagged, draft, deleted, spam, important }
  size_bytes INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, message_id)
);

CREATE INDEX idx_email_messages_conversation_id ON email_messages(conversation_id);
CREATE INDEX idx_email_messages_received ON email_messages(account_id, received_at DESC);
CREATE INDEX idx_email_messages_search ON email_messages USING gin(to_tsvector('english', subject || ' ' || body_plain));

-- Attachments (cached locally)
CREATE TABLE email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  file_path TEXT, -- Local cache path: ~/.helix/email/attachments/{id}
  extracted_text TEXT, -- For PDF/doc analysis (Layer 5 synthesis)
  extraction_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_attachments_message_id ON email_attachments(message_id);
CREATE INDEX idx_email_attachments_extracted ON email_attachments(extraction_status) WHERE extraction_status = 'pending';

-- Sync tracking for incremental updates
CREATE TABLE email_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'initial', 'incremental', 'background'
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  messages_synced INTEGER DEFAULT 0,
  conversations_created INTEGER DEFAULT 0,
  conversations_updated INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_sync_log_account ON email_sync_log(account_id, completed_at DESC);

-- Search index for full-text search
CREATE TABLE email_search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES email_conversations(id) ON DELETE CASCADE,
  search_vector tsvector,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_search_vector ON email_search_index USING gin(search_vector);
```

### Key Design Decisions

1. **Thread ID Strategy:** Gmail-style `thread_id` enables conversation grouping without storing complex Message-ID chains
2. **IMAP Sync State:** `sync_state` JSONB tracks UID/modSeq for resume-from-failure (avoids re-downloading)
3. **Synthesis Integration:** `synthesis_analyzed` flag prevents duplicate analysis runs; `extracted_text` enables document analysis
4. **Participant JSONB:** Tracks CC/BCC for accurate thread context and pattern analysis
5. **Full-Text Search:** GIN indexes on subject + body + participants for fast searching
6. **Attachment Extraction:** Separate table for PDFs/docs with extraction status tracking

---

## TASK 3.2: Email Gateway RPC Methods

### Files to Create

- `helix-runtime/src/gateway/server-methods/email.ts` (NEW - 800 lines)

### RPC Method Signatures

**Account Management:**

- `email.add_account(userId, email, provider, authType, oauthToken?, imapConfig?)` → `{ accountId, email, isActive, syncStatus }`
- `email.get_accounts(userId)` → `Array<{ id, email, provider, isActive, lastSyncAt, messageCount }>`
- `email.remove_account(accountId, userId)` → `{ ok: boolean }`
- `email.verify_account(accountId)` → `{ ok: boolean, isValid: boolean }`

**Sync Operations:**

- `email.sync_inbox(accountId, syncType, daysToSync?)` → `{ syncJobId, status, estimatedMessages }`
- `email.get_sync_status(accountId)` → `{ status, progress, messagesSynced, nextSyncAt, lastError? }`
- `email.pause_sync(accountId)` → `{ ok: boolean }`

**Conversation & Message Retrieval:**

- `email.get_conversations(accountId, limit, offset, includeRead?, labels?)` → `Array<Conversation>`
- `email.get_conversation(conversationId)` → `{ id, threadId, subject, messages }`
- `email.search_conversations(accountId, query, from?, to?, after?, before?, limit)` → `Array<Conversation>`

**Message Operations:**

- `email.send_message(accountId, to, cc?, bcc?, subject, bodyPlain, bodyHtml?, inReplyTo?, attachmentIds?)` → `{ messageId, threadId, sentAt, status }`
- `email.mark_read(conversationId, isRead)` → `{ ok: boolean }`
- `email.star_conversation(conversationId, isStarred)` → `{ ok: boolean }`
- `email.delete_conversation(conversationId)` → `{ ok: boolean }`

**Attachment Operations:**

- `email.get_attachment(attachmentId)` → `{ id, filename, mimeType, sizeBytes, localPath, extractedText? }`
- `email.preview_attachment(attachmentId)` → `{ mimeType, previewUrl, width?, height? }`

**Synthesis Integration:**

- `email.trigger_synthesis(accountId, synthesisType, conversationIds?)` → `{ jobId, status, estimatedCompletionAt }`
- `email.get_analysis(jobId)` → `{ status, patterns, recommendations }`

### Implementation Pattern (Excerpt)

```typescript
export const emailHandlers: GatewayRequestHandlers = {
  'email.add_account': async ({ params, respond, context }) => {
    const { userId, email, provider, authType, oauthToken, imapConfig } = params;

    // 1. Validate credentials based on authType
    if (authType === 'oauth' && !oauthToken) {
      return respond(false, new Error('OAuth token required'));
    }

    if (authType === 'keyring' && !imapConfig) {
      return respond(false, new Error('IMAP config required for keyring auth'));
    }

    // 2. Test connection (IMAP CAPABILITY, OAuth refresh)
    try {
      if (provider === 'gmail') {
        // Validate OAuth token with Google API
        await validateGoogleToken(oauthToken);
      } else if (provider === 'custom_imap') {
        // Test IMAP connection
        const imap = new Imap(imapConfig);
        await imap.connect();
        await imap.disconnect();
      }
    } catch (error) {
      return respond(false, new Error(`Connection test failed: ${error.message}`));
    }

    // 3. Store account in database
    const accountId = crypto.randomUUID();
    await context.db.query(
      `INSERT INTO email_accounts (id, user_id, email_address, provider, auth_type, oauth_token, keyring_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        accountId,
        userId,
        email,
        provider,
        authType,
        oauthToken ? JSON.stringify(oauthToken) : null,
        null,
      ]
    );

    // 4. Queue initial sync job
    const syncJobId = await queueSyncJob(accountId, 'initial', 7);

    // 5. Log to Discord
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
  },

  'email.sync_inbox': async ({ params, respond, context }) => {
    const { accountId, syncType, daysToSync = 7 } = params;

    // 1. Get account details
    const account = await context.db.query('SELECT * FROM email_accounts WHERE id = $1', [
      accountId,
    ]);

    if (!account.rows.length) {
      return respond(false, new Error('Account not found'));
    }

    // 2. Start sync (non-blocking)
    const syncJobId = await queueSyncJob(accountId, syncType, daysToSync);

    // 3. Return immediately (sync happens in background)
    respond(true, {
      syncJobId,
      status: 'queued',
      estimatedMessages: 150, // Placeholder
    });
  },

  'email.get_conversations': async ({ params, respond, context }) => {
    const { accountId, limit = 50, offset = 0, includeRead = true, labels } = params;

    let query = 'SELECT * FROM email_conversations WHERE account_id = $1';
    const values: any[] = [accountId];

    if (!includeRead) {
      query += ' AND is_read = false';
    }

    if (labels && labels.length > 0) {
      query += ` AND labels && $${values.length + 1}`;
      values.push(labels);
    }

    query +=
      ' ORDER BY last_message_at DESC LIMIT $' +
      (values.length + 1) +
      ' OFFSET $' +
      (values.length + 2);
    values.push(limit, offset);

    const result = await context.db.query(query, values);

    respond(true, result.rows);
  },

  'email.search_conversations': async ({ params, respond, context }) => {
    const { accountId, query: searchQuery, from, to, after, before, limit = 50 } = params;

    // Use PostgreSQL full-text search
    let query = `
      SELECT ec.* FROM email_conversations ec
      WHERE ec.account_id = $1
      AND to_tsvector('english', ec.subject || ' ' || COALESCE(ec.participants::text, '')) @@ plainto_tsquery('english', $2)
    `;
    const values: any[] = [accountId, searchQuery];

    if (from) {
      query += ` AND ec.participants @> $${values.length + 1}::jsonb`;
      values.push(JSON.stringify([{ email: from }]));
    }

    if (after || before) {
      if (after) {
        query += ` AND ec.last_message_at >= $${values.length + 1}`;
        values.push(new Date(after));
      }
      if (before) {
        query += ` AND ec.last_message_at <= $${values.length + 1}`;
        values.push(new Date(before));
      }
    }

    query += ` LIMIT $${values.length + 1}`;
    values.push(limit);

    const result = await context.db.query(query, values);
    respond(true, result.rows);
  },

  'email.send_message': async ({ params, respond, context }) => {
    const { accountId, to, cc, bcc, subject, bodyPlain, bodyHtml, inReplyTo, attachmentIds } =
      params;

    // 1. Get account for sending credentials
    const account = await context.db.query('SELECT * FROM email_accounts WHERE id = $1', [
      accountId,
    ]);

    if (!account.rows.length) {
      return respond(false, new Error('Account not found'));
    }

    // 2. Send via SMTP (using existing mailer integration)
    const messageId = await sendEmailViaSMTP({
      account: account.rows[0],
      to,
      cc,
      bcc,
      subject,
      bodyPlain,
      bodyHtml,
      inReplyTo,
    });

    // 3. Store in database
    const threadId = inReplyTo ? await getThreadIdFromMessageId(inReplyTo) : crypto.randomUUID();
    await context.db.query(
      `INSERT INTO email_messages (id, conversation_id, account_id, message_id, from_email, to_emails, subject, body_plain, body_html, received_at, flags)
       VALUES (...)`,
      [
        /* values */
      ]
    );

    // 4. Log to Discord
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
  },
};
```

---

## TASK 3.3: EmailClient.tsx React Component

### Files to Create

- `web/src/pages/EmailClient.tsx` (NEW - 350 lines)
- `web/src/components/email/EmailAccountList.tsx` (NEW - 100 lines)
- `web/src/components/email/ConversationList.tsx` (NEW - 250 lines)
- `web/src/components/email/ConversationDetail.tsx` (NEW - 300 lines)
- `web/src/components/email/EmailMessageItem.tsx` (NEW - 150 lines)
- `web/src/components/email/ComposeModal.tsx` (NEW - 180 lines)
- `web/src/hooks/useEmailClient.ts` (NEW - 200 lines)

### Component Architecture

**Main Layout (4-column grid):**

1. **Sidebar:** Account list + sync status
2. **Conversations:** Virtual-scrolled list (1000+ conversations, no lag)
3. **Detail:** Full conversation thread
4. **Compose Modal:** Reply/new message (overlay)

**Key Features:**

- ✅ Virtual scrolling for performance (FixedSizeList)
- ✅ Debounced search (300ms delay)
- ✅ Lazy-load attachments
- ✅ HTML sanitization (DOMPurify)
- ✅ Dark theme responsive design
- ✅ Auto-sync in background

### Security & Performance

- **XSS Prevention:** DOMPurify sanitizes all HTML email bodies
- **Credential Protection:** No passwords/tokens in state (Tauri keyring only)
- **Virtual Scrolling:** 1000+ emails handled smoothly
- **Debounced Search:** Prevents API overload
- **Lazy Attachment Loading:** Only fetch on preview click
- **OAuth Token Refresh:** Silently refreshed in background

---

## Testing Strategy

### Test File: `web/src/__tests__/email-integration.test.ts`

**Coverage:** 25 tests across 7 categories

| Category           | Tests | Coverage                                       |
| ------------------ | ----- | ---------------------------------------------- |
| Account Management | 4     | Add, list, remove, verify accounts             |
| Sync Operations    | 5     | Initial/incremental sync, progress, throttling |
| Email Threading    | 4     | Message-ID grouping, References, fallback      |
| Search & Filtering | 4     | Full-text search, sender/date filters          |
| Message Operations | 4     | Send, mark read, star, delete                  |
| Attachments        | 2     | Cache/retrieve, preview generation             |
| Security           | 2     | XSS prevention, credential protection          |

**Key Test Patterns:**

- Mock gateway responses (no real IMAP/SMTP)
- Verify database state changes
- Test pagination and limits
- Test concurrent operations (throttling)
- Verify error handling

---

## Implementation Files Summary

| File                        | Lines | Purpose                            |
| --------------------------- | ----- | ---------------------------------- |
| `020_email_integration.sql` | 180   | Database schema (8 tables)         |
| `email.ts` (RPC)            | 800   | Gateway handlers (15+ methods)     |
| `EmailClient.tsx`           | 350   | Main container component           |
| `EmailAccountList.tsx`      | 100   | Account sidebar UI                 |
| `ConversationList.tsx`      | 250   | Virtual-scrolled conversation list |
| `ConversationDetail.tsx`    | 300   | Thread detail + message rendering  |
| `EmailMessageItem.tsx`      | 150   | Individual message component       |
| `ComposeModal.tsx`          | 180   | Compose/reply UI                   |
| `useEmailClient.ts`         | 200   | Custom hook (state management)     |
| `email-integration.test.ts` | 800   | 25 integration tests               |

**Total: 3,210 lines of production code + 800 lines of tests**

---

## Success Criteria

- ✅ Database schema applied (8 tables, proper indexing)
- ✅ 15+ RPC methods fully implemented
- ✅ EmailClient.tsx with 6 sub-components
- ✅ 25 passing integration tests (100%)
- ✅ Zero TypeScript errors
- ✅ DOMPurify XSS protection verified
- ✅ Virtual scrolling tested with 1000+ items
- ✅ Background sync working without UI freeze

---

## Architectural Patterns Used

1. **Tauri IPC Pattern:** Gateway RPC methods (established from Track 1-2)
2. **Virtual Scrolling:** react-window FixedSizeList for performance
3. **Debounced Search:** lodash debounce with 300ms delay
4. **Lazy Loading:** Attachments fetched on-demand
5. **Dark Theme:** Tailwind CSS with slate-950 background
6. **Credential Security:** System keyring (Tauri) + OAuth (web)
7. **Synthesis Integration:** Thread `synthesis_analyzed` flag + attachment `extracted_text`

---

## Next Steps After Completion

1. **Track 4:** Calendar Foundation (similar pattern)
2. **Track 5:** Voice Recording UI (recording + transcription)
3. **Track 6.2-6.3:** Mobile PWA (responsive design)
4. **Track 7:** Integration Tests (cross-platform E2E)

---

**Status:** Specification complete and ready for implementation
**Date:** February 3, 2026
**Estimated Timeline:** 1 week (40 hours)
