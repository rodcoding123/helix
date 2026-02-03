-- Phase 4.1: Voice Memo Recording System
-- Handles voice memo storage, transcription, and search

CREATE TABLE voice_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Audio metadata
  audio_url TEXT NOT NULL, -- Supabase Storage path
  audio_duration_ms INTEGER NOT NULL,
  audio_size_bytes INTEGER,
  audio_format TEXT DEFAULT 'webm', -- webm, mp3, wav

  -- Transcription
  transcript TEXT,
  transcript_confidence FLOAT,
  transcription_model TEXT DEFAULT 'deepgram', -- deepgram, openai, google

  -- Metadata
  title TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  session_key TEXT, -- Group memos from same session
  recorded_at TIMESTAMP DEFAULT NOW(),

  -- Status tracking
  is_processing BOOLEAN DEFAULT false,
  transcription_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  transcription_error TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_voice_memos_user_id ON voice_memos(user_id);
CREATE INDEX idx_voice_memos_recorded_at ON voice_memos(recorded_at DESC);
CREATE INDEX idx_voice_memos_session_key ON voice_memos(session_key);
CREATE INDEX idx_voice_memos_transcription_status ON voice_memos(transcription_status);
CREATE INDEX idx_voice_memos_tags ON voice_memos USING gin(tags);

-- Full-text search index on transcripts
CREATE INDEX idx_voice_memos_transcript_search ON voice_memos
  USING gin(to_tsvector('english', COALESCE(transcript, '')));

-- Voice transcripts table (normalized for search)
CREATE TABLE voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_memo_id UUID NOT NULL REFERENCES voice_memos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Segment information
  segment_index INTEGER,
  segment_start_ms INTEGER,
  segment_end_ms INTEGER,

  text TEXT NOT NULL,
  confidence FLOAT,
  speaker_name TEXT, -- Optional: speaker identification

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_transcripts_memo_id ON voice_transcripts(voice_memo_id);
CREATE INDEX idx_voice_transcripts_user_id ON voice_transcripts(user_id);
CREATE INDEX idx_voice_transcripts_text_search ON voice_transcripts
  USING gin(to_tsvector('english', text));

-- Voice commands table (shortcuts to tools/skills)
CREATE TABLE voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  trigger_phrase TEXT NOT NULL, -- "hey helix", "create task", etc

  -- Action configuration
  action_type TEXT NOT NULL, -- 'tool', 'skill', 'navigation', 'system'
  tool_id UUID REFERENCES custom_tools(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES composite_skills(id) ON DELETE CASCADE,
  navigation_target TEXT, -- page/route name

  -- Parameters
  action_params JSONB DEFAULT '{}',

  -- Status
  enabled BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_commands_user_id ON voice_commands(user_id);
CREATE INDEX idx_voice_commands_trigger ON voice_commands(trigger_phrase);
CREATE INDEX idx_voice_commands_enabled ON voice_commands(enabled);

-- Voicemail inbox (received messages)
CREATE TABLE voicemail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Message metadata
  audio_url TEXT NOT NULL,
  audio_duration_ms INTEGER,

  -- Message info
  from_number TEXT,
  from_name TEXT,
  transcript TEXT,

  -- Status
  is_read BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,

  received_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voicemail_user_id ON voicemail_messages(user_id);
CREATE INDEX idx_voicemail_received_at ON voicemail_messages(received_at DESC);
CREATE INDEX idx_voicemail_is_read ON voicemail_messages(is_read);
CREATE INDEX idx_voicemail_is_archived ON voicemail_messages(is_archived);

-- Enable RLS for all tables
ALTER TABLE voice_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE voicemail_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own voice data
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

CREATE POLICY "Users can view their own transcripts"
  ON voice_transcripts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own voice commands"
  ON voice_commands FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own voice commands"
  ON voice_commands FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice commands"
  ON voice_commands FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice commands"
  ON voice_commands FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own voicemail"
  ON voicemail_messages FOR SELECT
  USING (auth.uid() = user_id);

-- Audit log table
CREATE TABLE voice_memo_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_memo_id UUID REFERENCES voice_memos(id) ON DELETE CASCADE,

  action TEXT, -- 'recorded', 'transcribed', 'searched', 'shared'
  details JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_memo_audit_user_id ON voice_memo_audit(user_id);
CREATE INDEX idx_voice_memo_audit_memo_id ON voice_memo_audit(voice_memo_id);
