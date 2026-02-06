-- Phase 4.2: Voice Sentiment Analysis
-- Stores emotion detection and sentiment analysis for voice memos

CREATE TABLE voice_sentiment_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memo_id UUID NOT NULL REFERENCES voice_memos(id) ON DELETE CASCADE,

  -- Emotion Detection
  primary_emotion TEXT NOT NULL CHECK (primary_emotion IN ('happy', 'sad', 'angry', 'neutral', 'confused', 'anxious', 'excited')),
  secondary_emotions TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Tone Classification
  tone TEXT NOT NULL CHECK (tone IN ('positive', 'negative', 'neutral', 'mixed')),

  -- Sentiment Scoring
  sentiment_score FLOAT NOT NULL CHECK (sentiment_score >= 0 AND sentiment_score <= 1),
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  -- Dimensional Emotions (Valence-Arousal-Dominance Model)
  valence FLOAT NOT NULL CHECK (valence >= -1 AND valence <= 1),       -- Positivity (-1 to 1)
  arousal FLOAT NOT NULL CHECK (arousal >= 0 AND arousal <= 1),        -- Intensity (0 to 1)
  dominance FLOAT NOT NULL CHECK (dominance >= -1 AND dominance <= 1), -- Control/Agency (-1 to 1)

  -- Salience & Importance
  emotional_salience FLOAT NOT NULL CHECK (emotional_salience >= 0 AND emotional_salience <= 1),

  -- Extracted Features
  key_phrases TEXT[] DEFAULT ARRAY[]::TEXT[],
  insights TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_voice_sentiment_user_id ON voice_sentiment_analysis(user_id);
CREATE INDEX idx_voice_sentiment_memo_id ON voice_sentiment_analysis(memo_id);
CREATE INDEX idx_voice_sentiment_emotion ON voice_sentiment_analysis(primary_emotion);
CREATE INDEX idx_voice_sentiment_created_at ON voice_sentiment_analysis(created_at DESC);
CREATE INDEX idx_voice_sentiment_score ON voice_sentiment_analysis(sentiment_score);
CREATE INDEX idx_voice_sentiment_user_date ON voice_sentiment_analysis(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE voice_sentiment_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_sentiment_user_access ON voice_sentiment_analysis
  FOR ALL USING (auth.uid() = user_id);

-- Add sentiment fields to voice_memos table for denormalization
ALTER TABLE voice_memos ADD COLUMN IF NOT EXISTS primary_emotion TEXT;
ALTER TABLE voice_memos ADD COLUMN IF NOT EXISTS sentiment_score FLOAT;

-- Index for memo sentiment queries
CREATE INDEX IF NOT EXISTS idx_voice_memos_sentiment ON voice_memos(primary_emotion, created_at DESC);
