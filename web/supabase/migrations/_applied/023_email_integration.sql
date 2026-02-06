-- ============================================================================
-- Email Integration Schema
-- Migration: 023-026 (applied incrementally)
-- Tables: email_accounts, email_conversations, email_messages,
--         email_attachments, email_sync_log
-- Indexes: 15+ custom indexes for optimized queries
-- ============================================================================

-- Email accounts (connected email services)
CREATE TABLE IF NOT EXISTS email_accounts (
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

CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_active ON email_accounts(user_id, is_active);
