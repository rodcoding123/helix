-- Week 5 Track 5: Voice Recording UI - Database Schema
-- Date: February 3, 2026
-- Task 5.1: Voice recording, transcription, and synthesis integration

-- Create voice_memos table
CREATE TABLE IF NOT EXISTS voice_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  audio_url TEXT NOT NULL, -- Supabase Storage path
  duration_ms INTEGER NOT NULL,
  transcript TEXT NOT NULL,
  transcript_confidence FLOAT,

  title TEXT,
  tags TEXT[],
  session_key TEXT,

  synthesis_triggered BOOLEAN DEFAULT false,
  synthesis_status TEXT, -- 'pending', 'processing', 'complete', 'failed'

  recorded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create voice_transcripts table for searchable transcripts
CREATE TABLE IF NOT EXISTS voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memo_id UUID REFERENCES voice_memos(id) ON DELETE CASCADE,

  text TEXT NOT NULL,
  speaker TEXT, -- 'user', 'helix', 'other'
  confidence FLOAT,
  segment_index INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Create voice_commands table for voice command shortcuts
CREATE TABLE IF NOT EXISTS voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  trigger_phrase TEXT NOT NULL,
  tool_id UUID REFERENCES custom_tools(id),
  action_type TEXT, -- 'tool', 'navigation', 'system'
  action_params JSONB,

  enabled BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create voicemail_messages table for voicemail inbox
CREATE TABLE IF NOT EXISTS voicemail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  audio_url TEXT NOT NULL,
  duration_ms INTEGER,
  transcript TEXT,

  from_number TEXT,
  from_name TEXT,

  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,

  received_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance optimization

-- Voice memos lookups
CREATE INDEX IF NOT EXISTS idx_voice_memos_user_id ON voice_memos(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_memos_user_created ON voice_memos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_memos_tags ON voice_memos USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_voice_memos_synthesis ON voice_memos(synthesis_status) WHERE synthesis_status IS NOT NULL;

-- Voice transcripts full-text search
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_user_id ON voice_transcripts(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_memo_id ON voice_transcripts(memo_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_text_search ON voice_transcripts USING GIN(to_tsvector('english', text));
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_speaker ON voice_transcripts(speaker);

-- Voice commands lookups
CREATE INDEX IF NOT EXISTS idx_voice_commands_user_id ON voice_commands(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_commands_trigger ON voice_commands(user_id, trigger_phrase);
CREATE INDEX IF NOT EXISTS idx_voice_commands_tool_id ON voice_commands(tool_id);
CREATE INDEX IF NOT EXISTS idx_voice_commands_enabled ON voice_commands(enabled) WHERE enabled = true;

-- Voicemail lookups
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_user_id ON voicemail_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_user_created ON voicemail_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_read ON voicemail_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_transcript_search ON voicemail_messages USING GIN(to_tsvector('english', transcript));

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_voice_memos_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_memos_timestamp_trigger
BEFORE UPDATE ON voice_memos
FOR EACH ROW
EXECUTE FUNCTION update_voice_memos_timestamp();

CREATE OR REPLACE FUNCTION update_voice_commands_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_commands_timestamp_trigger
BEFORE UPDATE ON voice_commands
FOR EACH ROW
EXECUTE FUNCTION update_voice_commands_timestamp();

-- Verify schema creation
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('voice_memos', 'voice_transcripts', 'voice_commands', 'voicemail_messages')
  ) THEN
    RAISE NOTICE 'Voice recording schema created successfully';
  ELSE
    RAISE EXCEPTION 'Voice recording schema creation failed';
  END IF;
END $$;
