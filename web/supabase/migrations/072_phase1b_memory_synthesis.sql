-- Supabase Migration: Memory Synthesis Tables
-- PHASE 1B: Memory Synthesis Pipeline
-- Date: 2026-02-06
--
-- Creates tables for:
-- 1. User profiles - Per-user context and preferences
-- 2. Conversation memories - Raw synthesis results with salience scores
-- 3. Memory insights - Aggregated patterns and connections
-- 4. Memory decay history - Track salience changes over time

BEGIN;

-- ==============================================================================
-- TABLE 1: User Profiles
-- ==============================================================================
-- Extended user context beyond auth.users
-- Stores per-user personality preferences, communication style, etc.

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile metadata
  name TEXT,
  email TEXT,
  avatar_url TEXT,

  -- Communication preferences
  communication_style TEXT, -- 'direct', 'diplomatic', 'humorous', 'formal', etc.
  preferred_response_length TEXT, -- 'brief', 'balanced', 'detailed'

  -- Trust and relationship
  trust_level DECIMAL(3, 2) DEFAULT 0.5, -- 0.0 to 1.0
  relationship_type TEXT DEFAULT 'user', -- 'user', 'collaborator', 'friend', etc.
  first_interaction TIMESTAMPTZ,
  conversation_count INTEGER DEFAULT 0,

  -- Creator override (only Rodrigo)
  is_creator BOOLEAN DEFAULT FALSE,
  creator_verified_at TIMESTAMPTZ,

  -- Admin and settings
  is_admin BOOLEAN DEFAULT FALSE,
  feature_toggles JSONB DEFAULT '{}', -- Per-user feature flags

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='is_creator') THEN
    CREATE INDEX IF NOT EXISTS idx_user_profiles_is_creator ON user_profiles(is_creator);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='trust_level') THEN
    CREATE INDEX IF NOT EXISTS idx_user_profiles_trust_level ON user_profiles(trust_level DESC);
  END IF;
END $$;

-- RLS: Users can view own profile, admins can view all
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='is_admin') THEN
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "users_view_own_profile" ON user_profiles;
    DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
    CREATE POLICY "users_view_own_profile"
      ON user_profiles FOR SELECT
      USING (auth.uid() = user_id OR (SELECT is_admin FROM user_profiles WHERE user_id = auth.uid()));
    CREATE POLICY "users_update_own_profile"
      ON user_profiles FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ==============================================================================
-- TABLE 2: Conversation Memories
-- ==============================================================================
-- Raw synthesis results from conversations
-- Indexed by salience score for efficient retrieval of important memories

CREATE TABLE IF NOT EXISTS conversation_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  conversation_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key TEXT,

  -- Synthesis result
  synthesis_result JSONB NOT NULL, -- {emotionalTags, goalMentions, relationshipShifts, ...}

  -- Salience and importance
  salience_score DECIMAL(3, 2) NOT NULL DEFAULT 0.5, -- 0.0 to 1.0
  message_count INTEGER DEFAULT 0,
  average_emotion_intensity DECIMAL(3, 2) DEFAULT 0.5,

  -- Tags for quick filtering
  has_emotional_content BOOLEAN DEFAULT FALSE,
  has_goals BOOLEAN DEFAULT FALSE,
  has_relationship_shifts BOOLEAN DEFAULT FALSE,
  has_transformation BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON conversation_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_salience ON conversation_memories(salience_score DESC) WHERE salience_score > 0.5;
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON conversation_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_conversation_id ON conversation_memories(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memories_emotional ON conversation_memories(user_id, has_emotional_content) WHERE has_emotional_content = TRUE;
CREATE INDEX IF NOT EXISTS idx_memories_goals ON conversation_memories(user_id, has_goals) WHERE has_goals = TRUE;

-- GIN indexes for JSONB search
CREATE INDEX IF NOT EXISTS idx_memories_synthesis_gin ON conversation_memories USING GIN (synthesis_result);

-- ==============================================================================
-- HELPER FUNCTIONS
-- ==============================================================================
-- Used by triggers to auto-update timestamps

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamp
CREATE TRIGGER conversation_memories_updated_at_trigger
  BEFORE UPDATE ON conversation_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS: Users can view own memories
ALTER TABLE conversation_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_memories"
  ON conversation_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_memories"
  ON conversation_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_memories"
  ON conversation_memories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_memories"
  ON conversation_memories FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 3: Memory Insights
-- ==============================================================================
-- Aggregated patterns across memories
-- Used for reconsolidation and pattern detection

CREATE TABLE IF NOT EXISTS memory_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Aggregated patterns
  emotional_trends JSONB NOT NULL DEFAULT '{}', -- {tag: frequency, ...}
  goal_themes JSONB NOT NULL DEFAULT '{}', -- {goal: count, ...}
  relationship_patterns JSONB NOT NULL DEFAULT '{}', -- {pattern: description, ...}
  transformation_indicators JSONB NOT NULL DEFAULT '{}', -- {trigger: count, ...}

  -- Metadata
  total_memories INTEGER DEFAULT 0,
  avg_salience DECIMAL(3, 2) DEFAULT 0.5,
  high_salience_memories INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_user_id ON memory_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_updated_at ON memory_insights(updated_at DESC);

-- RLS: Users can view own insights
ALTER TABLE memory_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_insights"
  ON memory_insights FOR SELECT
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 4: Memory Decay History
-- ==============================================================================
-- Track salience score changes over time
-- For analyzing memory trends and importance evolution

CREATE TABLE IF NOT EXISTS memory_decay_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  memory_id UUID NOT NULL REFERENCES conversation_memories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Decay information
  previous_salience DECIMAL(3, 2) NOT NULL,
  new_salience DECIMAL(3, 2) NOT NULL,
  decay_rate DECIMAL(3, 2) DEFAULT 0.95, -- Exponential decay factor
  reason TEXT, -- 'scheduled_decay', 'consolidation', 'manual', etc.

  -- Timestamps
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decay_user_id ON memory_decay_history(user_id);
CREATE INDEX IF NOT EXISTS idx_decay_memory_id ON memory_decay_history(memory_id);
CREATE INDEX IF NOT EXISTS idx_decay_occurred_at ON memory_decay_history(occurred_at DESC);

-- RLS: Users can view own history
ALTER TABLE memory_decay_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_decay_history"
  ON memory_decay_history FOR SELECT
  USING (auth.uid() = user_id);

-- ==============================================================================
-- Helper Function: Update Updated At
-- Add trigger for memory_insights
CREATE TRIGGER memory_insights_updated_at_trigger
  BEFORE UPDATE ON memory_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for user_profiles
CREATE TRIGGER user_profiles_updated_at_trigger
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- Helper Function: Get User Memory Statistics
-- ==============================================================================
-- Fast aggregation of memory statistics

CREATE OR REPLACE FUNCTION get_user_memory_stats(user_id_param UUID)
RETURNS TABLE (
  total_memories BIGINT,
  high_salience_count BIGINT,
  avg_salience NUMERIC,
  last_memory_created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_memories,
    COUNT(*) FILTER (WHERE salience_score > 0.7) as high_salience_count,
    AVG(salience_score) as avg_salience,
    MAX(created_at) as last_memory_created_at
  FROM conversation_memories
  WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- Helper Function: Apply Memory Decay
-- ==============================================================================
-- Exponential decay of memory salience over time

CREATE OR REPLACE FUNCTION apply_memory_decay(user_id_param UUID, decay_rate DECIMAL DEFAULT 0.95)
RETURNS TABLE (
  affected_count INTEGER
) AS $$
DECLARE
  affected_count INTEGER := 0;
BEGIN
  -- Update salience scores for old memories (older than 30 days)
  UPDATE conversation_memories
  SET salience_score = GREATEST(0.1, salience_score * decay_rate),
      updated_at = NOW()
  WHERE user_id = user_id_param
    AND created_at < NOW() - INTERVAL '30 days'
    AND salience_score > 0.1;

  affected_count := ROW_COUNT;

  -- Log decay history
  INSERT INTO memory_decay_history (memory_id, user_id, previous_salience, new_salience, decay_rate, reason)
  SELECT
    id,
    user_id,
    salience_score,
    GREATEST(0.1, salience_score * decay_rate),
    decay_rate,
    'scheduled_decay'
  FROM conversation_memories
  WHERE user_id = user_id_param
    AND created_at < NOW() - INTERVAL '30 days'
    AND updated_at = NOW();

  RETURN QUERY SELECT affected_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
