-- Phase 4.1: Voice Memos Infrastructure
-- Enables voice memo recording, storage, and transcription

CREATE TABLE voice_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Audio file storage
  audio_url TEXT NOT NULL, -- Supabase Storage URL
  duration_ms INTEGER NOT NULL,

  -- Transcription
  transcript TEXT NOT NULL,
  transcript_confidence FLOAT,
  model TEXT, -- 'openai', 'google', 'deepgram', etc.

  -- Metadata
  title TEXT,
  tags TEXT[],
  session_key TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_memos_user_id ON voice_memos(user_id);
CREATE INDEX idx_voice_memos_created_at ON voice_memos(created_at DESC);
CREATE INDEX idx_voice_memos_transcript_search ON voice_memos USING gin(to_tsvector('english', transcript));

ALTER TABLE voice_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_memos_user_access ON voice_memos FOR ALL USING (auth.uid() = user_id);

-- Full-text search index for transcripts
CREATE INDEX idx_voice_transcripts_tsvector ON voice_memos USING gin(to_tsvector('english', transcript));

-- Voice transcript search history (for optimization)
CREATE TABLE voice_transcript_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Search metadata
  query TEXT NOT NULL,
  results_count INTEGER,
  result_ids UUID[],

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_searches_user_id ON voice_transcript_searches(user_id);
CREATE INDEX idx_voice_searches_created_at ON voice_transcript_searches(created_at DESC);

ALTER TABLE voice_transcript_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_searches_user_access ON voice_transcript_searches FOR ALL USING (auth.uid() = user_id);

-- Voice command shortcuts (for voice-triggered tool execution)
CREATE TABLE voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Command trigger
  trigger_phrase TEXT NOT NULL,
  trigger_confidence FLOAT DEFAULT 0.8, -- Min confidence to trigger (0-1)

  -- Action details
  action_type TEXT CHECK (action_type IN ('tool', 'skill', 'navigation')),
  target_id UUID, -- tool_id or skill_id
  action_params JSONB, -- Additional parameters

  -- Metadata
  enabled BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_commands_user_id ON voice_commands(user_id);
CREATE INDEX idx_voice_commands_trigger ON voice_commands USING gin(to_tsvector('english', trigger_phrase));
CREATE INDEX idx_voice_commands_enabled ON voice_commands(enabled);

ALTER TABLE voice_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_commands_user_access ON voice_commands FOR ALL USING (auth.uid() = user_id);

-- Voicemail messages (for incoming voice calls)
CREATE TABLE voicemail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Audio file
  audio_url TEXT NOT NULL,
  duration_ms INTEGER,

  -- Transcription
  transcript TEXT,

  -- Metadata
  from_number TEXT, -- Caller phone number
  from_name TEXT, -- Caller display name if available
  is_read BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,

  received_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voicemail_user_id ON voicemail_messages(user_id);
CREATE INDEX idx_voicemail_is_read ON voicemail_messages(is_read);
CREATE INDEX idx_voicemail_received_at ON voicemail_messages(received_at DESC);

ALTER TABLE voicemail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY voicemail_user_access ON voicemail_messages FOR ALL USING (auth.uid() = user_id);
