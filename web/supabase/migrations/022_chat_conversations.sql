-- Web MVP Chat Conversations
-- Stores message history for web-based chat sessions

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session tracking
  session_key TEXT NOT NULL,      -- e.g., 'web-mvp-session', 'voice-session-123'

  -- Message storage
  messages JSONB DEFAULT '[]',    -- Array of {id, role, content, timestamp, tokenCount}

  -- Metadata
  title TEXT,                      -- User-defined session title
  description TEXT,                -- Session summary/description

  -- Status
  is_archived BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_session_key ON conversations(user_id, session_key);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_conversations_is_archived ON conversations(is_archived);

-- Row-level security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_user_access ON conversations
  FOR ALL
  USING (auth.uid() = user_id);

-- Unique constraint on user + session_key combination
ALTER TABLE conversations
  ADD CONSTRAINT unique_user_session
  UNIQUE(user_id, session_key);
