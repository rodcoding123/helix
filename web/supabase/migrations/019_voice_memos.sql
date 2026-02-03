-- Migration: Voice Memos & Transcripts
-- Purpose: Database schema for voice recording, transcription, and search
-- Date: 2026-02-02

-- Voice memos table
CREATE TABLE IF NOT EXISTS voice_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  audio_url TEXT NOT NULL, -- URL in Supabase Storage
  duration_ms INTEGER NOT NULL,

  transcript TEXT,
  transcript_confidence FLOAT,
  transcript_indexed BOOLEAN DEFAULT false,

  title TEXT,
  tags TEXT[] DEFAULT '{}',
  session_key TEXT, -- Link to conversation session if any

  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_voice_memos_user_id ON voice_memos(user_id);
CREATE INDEX idx_voice_memos_created_at ON voice_memos(created_at DESC);
CREATE INDEX idx_voice_memos_tags ON voice_memos USING GIN(tags);

-- Full-text search index on transcripts
CREATE INDEX idx_voice_memos_transcript_fts
  ON voice_memos
  USING GIN(to_tsvector('english', transcript));

-- Voice transcripts table (for additional context/corrections)
CREATE TABLE IF NOT EXISTS voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memo_id UUID REFERENCES voice_memos(id) ON DELETE CASCADE,

  text TEXT NOT NULL,
  speaker VARCHAR(50), -- 'user', 'helix', or other
  confidence FLOAT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_voice_transcripts_user_id ON voice_transcripts(user_id);
CREATE INDEX idx_voice_transcripts_memo_id ON voice_transcripts(memo_id);
CREATE INDEX idx_voice_transcripts_speaker ON voice_transcripts(speaker);
CREATE INDEX idx_voice_transcripts_fts
  ON voice_transcripts
  USING GIN(to_tsvector('english', text));

-- Voice commands table
CREATE TABLE IF NOT EXISTS voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  trigger_phrase TEXT NOT NULL,
  tool_id UUID, -- Reference to custom tool if any
  action_type VARCHAR(50) NOT NULL, -- 'tool', 'navigation', 'system'
  action_params JSONB,

  enabled BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_voice_commands_user_id ON voice_commands(user_id);
CREATE INDEX idx_voice_commands_enabled ON voice_commands(enabled);
CREATE INDEX idx_voice_commands_trigger
  ON voice_commands
  USING GIN(to_tsvector('english', trigger_phrase));

-- Voicemail table
CREATE TABLE IF NOT EXISTS voicemail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  audio_url TEXT NOT NULL,
  duration_ms INTEGER,
  transcript TEXT,

  from_number TEXT,
  from_name TEXT,

  is_read BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,

  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_voicemail_user_id ON voicemail_messages(user_id);
CREATE INDEX idx_voicemail_is_read ON voicemail_messages(is_read);
CREATE INDEX idx_voicemail_received_at ON voicemail_messages(received_at DESC);

-- Voice settings per user
CREATE TABLE IF NOT EXISTS voice_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  stt_provider VARCHAR(50) DEFAULT 'deepgram', -- deepgram, google, openai
  tts_provider VARCHAR(50) DEFAULT 'elevenlabs', -- elevenlabs, google, openai

  preferred_language VARCHAR(5) DEFAULT 'en',
  voice_gender VARCHAR(20) DEFAULT 'neutral', -- male, female, neutral
  voice_speed FLOAT DEFAULT 1.0, -- 0.5-2.0

  enable_voice_memos BOOLEAN DEFAULT true,
  enable_voice_commands BOOLEAN DEFAULT true,
  enable_voicemail BOOLEAN DEFAULT false,
  enable_background_listening BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE voice_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE voicemail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - voice_memos
CREATE POLICY "Users can view their own voice memos"
  ON voice_memos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice memos"
  ON voice_memos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice memos"
  ON voice_memos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice memos"
  ON voice_memos FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies - voice_transcripts
CREATE POLICY "Users can view their own transcripts"
  ON voice_transcripts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transcripts"
  ON voice_transcripts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies - voice_commands
CREATE POLICY "Users can view their own commands"
  ON voice_commands FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own commands"
  ON voice_commands FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own commands"
  ON voice_commands FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own commands"
  ON voice_commands FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies - voicemail
CREATE POLICY "Users can view their own voicemail"
  ON voicemail_messages FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies - voice_settings
CREATE POLICY "Users can view their own settings"
  ON voice_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON voice_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_voice_memos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_memos_updated_at_trigger
BEFORE UPDATE ON voice_memos
FOR EACH ROW
EXECUTE FUNCTION update_voice_memos_updated_at();

CREATE OR REPLACE FUNCTION update_voice_commands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_commands_updated_at_trigger
BEFORE UPDATE ON voice_commands
FOR EACH ROW
EXECUTE FUNCTION update_voice_commands_updated_at();

-- Seed default voice settings for existing users
INSERT INTO voice_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
