-- Phase 4.1: Voice Features System
-- Enables real-time voice conversations, voice memos, and voice commands

-- Voice Memos (Recording + Transcription)
CREATE TABLE voice_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Audio Storage
  audio_url TEXT NOT NULL,              -- Supabase Storage URL
  duration_ms INTEGER NOT NULL,
  file_size_bytes INTEGER,

  -- Transcription
  transcript TEXT,
  transcript_confidence FLOAT,
  language_code TEXT DEFAULT 'en',

  -- Metadata
  title TEXT,
  tags TEXT[],
  session_key TEXT,

  -- Status
  transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  transcription_error TEXT,

  recorded_at TIMESTAMP DEFAULT NOW(),
  transcription_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_memos_user_id ON voice_memos(user_id);
CREATE INDEX idx_voice_memos_recorded_at ON voice_memos(recorded_at DESC);
CREATE INDEX idx_voice_memos_transcription_status ON voice_memos(transcription_status);

ALTER TABLE voice_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_memos_user_access ON voice_memos FOR ALL USING (auth.uid() = user_id);

-- Voice Transcripts (All voice input/output for searching)
CREATE TABLE voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key TEXT,

  -- Transcript Content
  text TEXT NOT NULL,
  speaker TEXT NOT NULL,                -- 'user', 'helix', 'other'
  confidence FLOAT,

  -- Metadata
  source TEXT,                          -- 'voice_memo', 'realtime_conversation', 'voice_command'
  related_id UUID,                      -- Link to voice_memo or conversation

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_transcripts_user_id ON voice_transcripts(user_id);
CREATE INDEX idx_voice_transcripts_created_at ON voice_transcripts(created_at DESC);
CREATE INDEX idx_voice_transcripts_text_search ON voice_transcripts USING gin(to_tsvector('english', text));

ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_transcripts_user_access ON voice_transcripts FOR ALL USING (auth.uid() = user_id);

-- Voice Commands (Custom voice triggers)
CREATE TABLE voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Command Definition
  trigger_phrase TEXT NOT NULL,         -- "create task", "send email", etc.
  command_type TEXT NOT NULL CHECK (command_type IN ('tool_execution', 'navigation', 'system', 'custom')),

  -- Action Configuration
  action_config JSONB NOT NULL,         -- Tool ID, parameters, etc.
  tool_id UUID REFERENCES custom_tools(id) ON DELETE SET NULL,

  -- Status
  is_enabled BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP,

  -- Metadata
  description TEXT,
  tags TEXT[],

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_commands_user_id ON voice_commands(user_id);
CREATE INDEX idx_voice_commands_trigger_phrase ON voice_commands(trigger_phrase);
CREATE INDEX idx_voice_commands_enabled ON voice_commands(is_enabled);

ALTER TABLE voice_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_commands_user_access ON voice_commands FOR ALL USING (auth.uid() = user_id);

-- Voicemail Messages (Like inbox)
CREATE TABLE voicemail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Message Details
  audio_url TEXT NOT NULL,              -- Supabase Storage
  duration_ms INTEGER NOT NULL,
  transcript TEXT,

  -- Sender Info
  from_name TEXT,
  from_phone TEXT,                      -- For PSTN/Twilio
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,

  received_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voicemail_user_id ON voicemail_messages(user_id);
CREATE INDEX idx_voicemail_received_at ON voicemail_messages(received_at DESC);
CREATE INDEX idx_voicemail_is_read ON voicemail_messages(is_read);

ALTER TABLE voicemail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY voicemail_user_access ON voicemail_messages FOR ALL USING (auth.uid() = user_id);

-- Real-Time Voice Sessions (Track active conversations)
CREATE TABLE voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session Details
  session_key TEXT UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'error')),

  -- Audio Streams
  input_model TEXT,                     -- 'deepgram', 'whisper', 'google'
  output_model TEXT,                    -- 'elevenlabs', 'google', 'edge-tts'

  -- Metrics
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,
  duration_seconds INTEGER,

  input_audio_bytes INTEGER DEFAULT 0,
  output_audio_bytes INTEGER DEFAULT 0,

  transcription_quality_score FLOAT,

  -- Configuration
  latency_ms_avg INTEGER,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voice_sessions_user_id ON voice_sessions(user_id);
CREATE INDEX idx_voice_sessions_status ON voice_sessions(status);
CREATE INDEX idx_voice_sessions_created_at ON voice_sessions(created_at DESC);

ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_sessions_user_access ON voice_sessions FOR ALL USING (auth.uid() = user_id);

-- Voice Settings (User preferences)
CREATE TABLE voice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- STT Configuration
  stt_provider TEXT DEFAULT 'deepgram',  -- 'deepgram', 'google', 'whisper'
  stt_language TEXT DEFAULT 'en-US',
  stt_model TEXT,                        -- Provider-specific model

  -- TTS Configuration
  tts_provider TEXT DEFAULT 'elevenlabs', -- 'elevenlabs', 'google', 'edge-tts'
  tts_voice_id TEXT,
  tts_voice_name TEXT,
  tts_speed FLOAT DEFAULT 1.0,
  tts_pitch FLOAT DEFAULT 1.0,

  -- Voice Command Settings
  wake_word_enabled BOOLEAN DEFAULT FALSE,
  wake_word_phrase TEXT DEFAULT 'hey helix',
  voice_activity_detection BOOLEAN DEFAULT TRUE,

  -- Privacy & Logging
  save_transcripts BOOLEAN DEFAULT TRUE,
  save_audio BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE voice_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_settings_user_access ON voice_settings FOR ALL USING (auth.uid() = user_id);

-- Voice Queue for processing transcriptions/synthesis asynchronously
CREATE TABLE voice_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job Details
  job_type TEXT NOT NULL CHECK (job_type IN ('transcribe', 'synthesize', 'enhance')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Input
  input_id UUID,                        -- voice_memo.id or similar
  input_data JSONB,

  -- Output
  output_data JSONB,
  error_message TEXT,

  -- Metrics
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  processing_time_ms INT,

  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_voice_queue_user_id ON voice_processing_queue(user_id);
CREATE INDEX idx_voice_queue_status ON voice_processing_queue(status);
CREATE INDEX idx_voice_queue_job_type ON voice_processing_queue(job_type);

ALTER TABLE voice_processing_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_queue_user_access ON voice_processing_queue FOR ALL USING (auth.uid() = user_id);
