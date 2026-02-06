-- Individual email messages
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES email_conversations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  in_reply_to TEXT,
  "references" TEXT[],
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
