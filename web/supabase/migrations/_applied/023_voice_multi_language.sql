-- Phase 4.2: Multi-Language Support for Voice
-- Stores user language preferences for STT, TTS, UI, and sentiment analysis

CREATE TABLE voice_language_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Speech-to-Text Preferences
  stt_language TEXT DEFAULT 'en-US' CHECK (stt_language IN (
    'en-US', 'en-GB', 'es-ES', 'es-MX', 'fr-FR', 'fr-CA',
    'de-DE', 'de-AT', 'zh-CN', 'zh-TW', 'ja-JP'
  )),
  stt_provider TEXT DEFAULT 'deepgram' CHECK (stt_provider IN ('deepgram', 'google', 'openai')),
  auto_detect_language BOOLEAN DEFAULT FALSE,
  detected_languages TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Text-to-Speech Preferences
  tts_language TEXT DEFAULT 'en-US' CHECK (tts_language IN (
    'en-US', 'en-GB', 'es-ES', 'es-MX', 'fr-FR', 'fr-CA',
    'de-DE', 'de-AT', 'zh-CN', 'zh-TW', 'ja-JP'
  )),
  tts_provider TEXT DEFAULT 'elevenlabs' CHECK (tts_provider IN ('elevenlabs', 'google', 'microsoft')),
  tts_voice_gender TEXT DEFAULT 'neutral' CHECK (tts_voice_gender IN ('male', 'female', 'neutral')),
  tts_voice_id TEXT,                          -- Provider-specific voice ID

  -- UI Language
  ui_language TEXT DEFAULT 'en' CHECK (ui_language IN ('en', 'es', 'fr', 'de', 'zh', 'ja')),

  -- Sentiment Analysis Language
  sentiment_language TEXT DEFAULT 'en-US' CHECK (sentiment_language IN (
    'en-US', 'en-GB', 'es-ES', 'es-MX', 'fr-FR', 'fr-CA',
    'de-DE', 'de-AT', 'zh-CN', 'zh-TW', 'ja-JP'
  )),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_voice_lang_prefs_user_id ON voice_language_preferences(user_id);

-- RLS
ALTER TABLE voice_language_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_lang_prefs_user_access ON voice_language_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Add language tracking to voice_memos table
ALTER TABLE voice_memos ADD COLUMN IF NOT EXISTS input_language TEXT DEFAULT 'en-US';
ALTER TABLE voice_memos ADD COLUMN IF NOT EXISTS language_detected_at TIMESTAMP;
ALTER TABLE voice_memos ADD COLUMN IF NOT EXISTS language_confidence FLOAT;

-- Create index for language-based queries
CREATE INDEX IF NOT EXISTS idx_voice_memos_language ON voice_memos(input_language);

-- Add language tracking to voice_sessions table
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS input_language TEXT DEFAULT 'en-US';
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS output_language TEXT DEFAULT 'en-US';

-- Create language usage analytics table
CREATE TABLE language_usage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Language Statistics
  language TEXT NOT NULL,
  total_memos INTEGER DEFAULT 0,
  total_duration_ms BIGINT DEFAULT 0,
  average_confidence FLOAT,

  -- Period
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  period_type TEXT CHECK (period_type IN ('daily', 'weekly', 'monthly')),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX idx_language_analytics_user_id ON language_usage_analytics(user_id);
CREATE INDEX idx_language_analytics_period ON language_usage_analytics(period_start, period_end);
CREATE INDEX idx_language_analytics_language ON language_usage_analytics(language);

-- RLS
ALTER TABLE language_usage_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY language_analytics_user_access ON language_usage_analytics
  FOR ALL USING (auth.uid() = user_id);

-- Create view for language preferences with defaults
CREATE OR REPLACE VIEW voice_language_preferences_with_defaults AS
SELECT
  user_id,
  COALESCE(stt_language, 'en-US') as stt_language,
  COALESCE(stt_provider, 'deepgram') as stt_provider,
  COALESCE(auto_detect_language, FALSE) as auto_detect_language,
  COALESCE(tts_language, 'en-US') as tts_language,
  COALESCE(tts_provider, 'elevenlabs') as tts_provider,
  COALESCE(tts_voice_gender, 'neutral') as tts_voice_gender,
  COALESCE(ui_language, 'en') as ui_language,
  COALESCE(sentiment_language, 'en-US') as sentiment_language,
  created_at,
  updated_at
FROM voice_language_preferences;
