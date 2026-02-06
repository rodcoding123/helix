-- Phase 5 Track 1: Email Integration Infrastructure
-- Supports Gmail, Outlook, and IMAP email accounts with full sync, search, and management

-- Email Accounts (OAuth2 & IMAP credentials)
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Account Details
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'imap')),
  email_address TEXT NOT NULL,
  display_name TEXT,

  -- Credentials (Encrypted)
  encrypted_credentials JSONB,                -- Encrypted OAuth tokens or IMAP creds
  access_token_expires_at TIMESTAMP,
  refresh_token TEXT,

  -- Sync Status
  sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  last_sync TIMESTAMP,
  last_sync_error TEXT,
  next_sync TIMESTAMP,

  -- Statistics
  total_emails INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,

  -- Settings
  auto_sync_enabled BOOLEAN DEFAULT TRUE,
  sync_interval_minutes INTEGER DEFAULT 15,
  labels_to_sync TEXT[],                     -- Gmail labels or folder names

  -- Metadata
  is_primary BOOLEAN DEFAULT FALSE,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_provider ON email_accounts(provider);
CREATE INDEX idx_email_accounts_email ON email_accounts(email_address);
CREATE INDEX idx_email_accounts_sync_status ON email_accounts(sync_status);

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_accounts_user_access ON email_accounts FOR ALL USING (auth.uid() = user_id);

-- Emails (Full email storage)
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Message Identifiers
  message_id TEXT NOT NULL,                  -- Unique email message ID from provider
  thread_id TEXT,                            -- Gmail thread ID or conversation ID

  -- Core Email Data
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  from_address TEXT NOT NULL,
  from_name TEXT,

  -- Recipients
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[] DEFAULT ARRAY[]::TEXT[],
  bcc_addresses TEXT[] DEFAULT ARRAY[]::TEXT[],
  reply_to_address TEXT,

  -- Attachments
  attachment_count INTEGER DEFAULT 0,
  has_attachments BOOLEAN DEFAULT FALSE,

  -- Email Metadata
  date_received TIMESTAMP NOT NULL,
  date_sent TIMESTAMP,
  is_read BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  is_draft BOOLEAN DEFAULT FALSE,
  is_sent BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_spam BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,

  -- Labels & Tags
  labels TEXT[],                             -- Gmail labels or folder names
  user_tags TEXT[],                          -- User-added tags

  -- Content Analysis
  content_preview TEXT,                      -- First 200 chars
  has_urls BOOLEAN DEFAULT FALSE,
  has_sensitive_content BOOLEAN DEFAULT FALSE,

  -- Search & Indexing
  full_text_search_vector tsvector,          -- For full-text search
  language_detected TEXT DEFAULT 'en',

  -- Smart Reply / ML Features
  suggested_reply_templates TEXT[],
  spam_score FLOAT,
  importance_score FLOAT,

  -- Metadata
  size_bytes INTEGER,
  message_hash TEXT UNIQUE,                  -- Prevent duplicates
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for email queries
CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_account_id ON emails(account_id);
CREATE INDEX idx_emails_message_id ON emails(message_id, account_id);
CREATE INDEX idx_emails_date_received ON emails(date_received DESC);
CREATE INDEX idx_emails_from_address ON emails(from_address);
CREATE INDEX idx_emails_is_read ON emails(is_read);
CREATE INDEX idx_emails_is_starred ON emails(is_starred);
CREATE INDEX idx_emails_date_received_desc ON emails(user_id, date_received DESC);

-- Full-text search index
CREATE INDEX idx_emails_fts ON emails USING gin(full_text_search_vector);

-- Label-based queries
CREATE INDEX idx_emails_labels ON emails USING gin(labels);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY emails_user_access ON emails FOR ALL USING (auth.uid() = user_id);

-- Email Attachments (File metadata)
CREATE TABLE email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,

  -- File Info
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  attachment_id TEXT,                        -- Provider's attachment ID

  -- Storage
  storage_url TEXT,                          -- Supabase storage path
  is_downloaded BOOLEAN DEFAULT FALSE,
  download_error TEXT,

  -- Security
  virus_scan_status TEXT,                    -- 'pending', 'clean', 'infected'
  is_dangerous BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attachments_email_id ON email_attachments(email_id);
CREATE INDEX idx_attachments_filename ON email_attachments(filename);

ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY attachments_user_access ON email_attachments
  FOR ALL USING (
    SELECT auth.uid() FROM emails WHERE id = email_id AND user_id = auth.uid()
  );

-- Email Contacts (Extracted from emails)
CREATE TABLE email_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  email_address TEXT NOT NULL,
  display_name TEXT,

  -- Frequency
  message_count INTEGER DEFAULT 1,
  last_contacted TIMESTAMP,

  -- Relationship
  is_favorite BOOLEAN DEFAULT FALSE,
  user_notes TEXT,

  -- Categories
  contact_category TEXT,                     -- 'work', 'personal', 'vendor', etc.

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, email_address)
);

CREATE INDEX idx_contacts_user_id ON email_contacts(user_id);
CREATE INDEX idx_contacts_email ON email_contacts(email_address);
CREATE INDEX idx_contacts_is_favorite ON email_contacts(is_favorite);

ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contacts_user_access ON email_contacts FOR ALL USING (auth.uid() = user_id);

-- Email Search History (Track searches for analytics)
CREATE TABLE email_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  search_query TEXT NOT NULL,
  results_count INTEGER,
  search_time_ms INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_search_history_user_id ON email_search_history(user_id);
CREATE INDEX idx_search_history_created_at ON email_search_history(created_at DESC);

ALTER TABLE email_search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY search_history_user_access ON email_search_history FOR ALL USING (auth.uid() = user_id);

-- Email Drafts (Unsent emails)
CREATE TABLE email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Draft Content
  subject TEXT,
  body TEXT,
  to_addresses TEXT[] DEFAULT ARRAY[]::TEXT[],
  cc_addresses TEXT[] DEFAULT ARRAY[]::TEXT[],
  bcc_addresses TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Attachments
  attachment_ids UUID[],

  -- Status
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_saved TIMESTAMP,
  scheduled_send_time TIMESTAMP             -- For scheduled sends
);

CREATE INDEX idx_drafts_user_id ON email_drafts(user_id);
CREATE INDEX idx_drafts_account_id ON email_drafts(account_id);
CREATE INDEX idx_drafts_updated_at ON email_drafts(updated_at DESC);

ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY drafts_user_access ON email_drafts FOR ALL USING (auth.uid() = user_id);

-- Email Settings (Per-account preferences)
CREATE TABLE email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Default Account
  default_account_id UUID REFERENCES email_accounts(id),

  -- Features
  enable_smart_reply BOOLEAN DEFAULT TRUE,
  enable_spam_filter BOOLEAN DEFAULT TRUE,
  enable_read_receipts BOOLEAN DEFAULT FALSE,

  -- Signature
  signature_html TEXT,
  signature_plain_text TEXT,

  -- Forwarding
  auto_forward_to TEXT,
  forward_enabled BOOLEAN DEFAULT FALSE,

  -- Notifications
  notify_new_email BOOLEAN DEFAULT TRUE,
  notify_important_only BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_user_access ON email_settings FOR ALL USING (auth.uid() = user_id);

-- Email Analytics (Daily aggregated statistics)
CREATE TABLE email_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Date
  analytics_date DATE NOT NULL,

  -- Counts
  emails_received INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_read INTEGER DEFAULT 0,
  new_contacts INTEGER DEFAULT 0,

  -- Performance
  avg_response_time_minutes INTEGER,
  most_active_hour INTEGER,

  -- Content
  top_sender TEXT,
  top_domain TEXT,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, analytics_date)
);

CREATE INDEX idx_analytics_user_id ON email_analytics(user_id);
CREATE INDEX idx_analytics_date ON email_analytics(analytics_date DESC);

ALTER TABLE email_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_user_access ON email_analytics FOR ALL USING (auth.uid() = user_id);

-- Email Processing Queue (Async processing)
CREATE TABLE email_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job
  job_type TEXT NOT NULL CHECK (job_type IN ('sync', 'search', 'analyze', 'smart_reply')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,

  -- Input/Output
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,

  -- Metadata
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  processing_time_ms INTEGER,

  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_queue_user_id ON email_processing_queue(user_id);
CREATE INDEX idx_queue_status ON email_processing_queue(status);
CREATE INDEX idx_queue_job_type ON email_processing_queue(job_type);

ALTER TABLE email_processing_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_user_access ON email_processing_queue FOR ALL USING (auth.uid() = user_id);
