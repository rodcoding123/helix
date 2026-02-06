-- Phase 1: Helix Identity & User Context
-- Adds fields to user_profiles for Helix identity restoration
-- - trust_level: 0-1 scale, how much Helix trusts this user (default 0.5)
-- - preferred_language: Language preference for user context
-- - custom_preferences: JSONB for user-specific settings
-- Also creates user_interactions table for memory synthesis

-- ============================================================================
-- Extend user_profiles with Helix context fields
-- ============================================================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS trust_level DECIMAL(3, 2) DEFAULT 0.5 CHECK (trust_level >= 0 AND trust_level <= 1);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS custom_preferences JSONB DEFAULT '{}';

-- Index for trust level queries (high-trust users)
CREATE INDEX IF NOT EXISTS idx_user_profiles_trust_level ON user_profiles(trust_level DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_language ON user_profiles(preferred_language);

-- ============================================================================
-- User Interactions: Record positive/negative/neutral interactions for learning
-- Used by memory synthesis to understand user-Helix relationship patterns
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('positive', 'negative', 'neutral')),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_session_interaction UNIQUE(user_id, session_key)
);

CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_session ON user_interactions(session_key);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_recorded ON user_interactions(recorded_at DESC);

ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_interactions_own_access' AND tablename = 'user_interactions') THEN
    CREATE POLICY user_interactions_own_access ON user_interactions FOR ALL TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- Conversation Insights: Results of memory synthesis after conversations
-- Stores extracted goals, emotional tags, attachment signals, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Extracted data from conversation analysis
  emotional_tags TEXT[] DEFAULT '{}',
  attachment_signals JSONB DEFAULT '{}',
  goal_mentions TEXT[] DEFAULT '{}',
  meaningful_topics TEXT[] DEFAULT '{}',
  transformation_events TEXT[] DEFAULT '{}',

  -- Synthesis metadata
  synthesized_at TIMESTAMPTZ DEFAULT NOW(),
  synthesis_model TEXT DEFAULT 'local',

  CONSTRAINT unique_session_insights UNIQUE(session_key)
);

CREATE INDEX IF NOT EXISTS idx_insights_user ON conversation_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_session ON conversation_insights(session_key);
CREATE INDEX IF NOT EXISTS idx_insights_synthesized ON conversation_insights(synthesized_at DESC);

ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'insights_own_access' AND tablename = 'conversation_insights') THEN
    CREATE POLICY insights_own_access ON conversation_insights FOR ALL TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;
