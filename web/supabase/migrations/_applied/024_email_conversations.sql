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
