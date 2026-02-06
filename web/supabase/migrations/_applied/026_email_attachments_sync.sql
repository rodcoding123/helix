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
