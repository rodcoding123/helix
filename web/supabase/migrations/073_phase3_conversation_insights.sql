-- Supabase Migration: Conversation Insights for Phase 3
-- PHASE 3: Memory Synthesis Pipeline
-- Date: 2026-02-06
--
-- Creates table for storing synthesis insights from conversations:
-- - Emotional tags extracted from user messages
-- - Goal mentions and progress tracking
-- - Meaningful topics discussed
-- - Transformation events and insights
-- - Confidence scores and synthesis metadata

BEGIN;

-- ==============================================================================
-- TABLE: Conversation Insights
-- ==============================================================================
-- Stores structured synthesis results from conversations
-- Enables pattern analysis and psychology file updates

CREATE TABLE IF NOT EXISTS conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to conversation and user
  conversation_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key TEXT,

  -- Synthesis Results (from cost-optimized synthesis)
  synthesis_method TEXT DEFAULT 'local', -- 'local', 'haiku', 'batch', 'skipped'

  -- Emotional Content
  emotional_tags TEXT[] DEFAULT ARRAY[]::TEXT[], -- ['frustration', 'excitement', 'anxiety']
  emotional_intensities DECIMAL(3, 2)[] DEFAULT ARRAY[]::DECIMAL(3,2)[], -- [0.7, 0.8, 0.6]
  dominant_emotion TEXT, -- Most frequently mentioned emotion

  -- Goal and Aspiration Content
  goal_mentions TEXT[] DEFAULT ARRAY[]::TEXT[], -- Goal statements and desires
  goal_descriptions TEXT[] DEFAULT ARRAY[]::TEXT[], -- Detailed goal descriptions
  mentioned_goals_count INTEGER DEFAULT 0,

  -- Meaningful Topics
  topics TEXT[] DEFAULT ARRAY[]::TEXT[], -- ['work', 'relationships', 'learning']
  topic_count INTEGER DEFAULT 0,

  -- Transformation and Growth
  transformation_events TEXT[] DEFAULT ARRAY[]::TEXT[], -- ['realization', 'commitment', 'acceptance']
  transformation_indicators TEXT[] DEFAULT ARRAY[]::TEXT[], -- Specific insights about growth
  has_breakthrough BOOLEAN DEFAULT FALSE, -- Significant realization occurred

  -- Attachment and Relationship Signals
  attachment_signals JSONB DEFAULT '{}', -- {signal: description, ...}
  vulnerability_indicators TEXT[] DEFAULT ARRAY[]::TEXT[], -- ['shared_fear', 'admitted_struggle']
  relationship_shifts JSONB DEFAULT '{}', -- {type: description, ...}

  -- Synthesis Confidence and Quality
  synthesis_confidence DECIMAL(3, 2) DEFAULT 0.5, -- 0.0 to 1.0 from optimizer
  pattern_detection_confidence DECIMAL(3, 2) DEFAULT 0.5, -- Local pattern confidence
  manual_review_needed BOOLEAN DEFAULT FALSE, -- Flag for uncertain synthesis

  -- Cost and Performance Metadata
  estimated_cost_usd DECIMAL(6, 4) DEFAULT 0.0000, -- Actual cost of synthesis
  synthesis_duration_ms INTEGER, -- How long synthesis took
  message_count_in_conversation INTEGER DEFAULT 0,
  total_conversation_length_chars INTEGER DEFAULT 0,

  -- Synthesis Metadata
  is_significant_conversation BOOLEAN DEFAULT TRUE, -- Passes significance threshold
  was_skipped BOOLEAN DEFAULT FALSE, -- Conversation too trivial to synthesize
  skip_reason TEXT, -- Reason if skipped

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synthesized_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_insights_user_id ON conversation_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_conversation_id ON conversation_insights(conversation_id);
CREATE INDEX IF NOT EXISTS idx_insights_session_key ON conversation_insights(session_key);
CREATE INDEX IF NOT EXISTS idx_insights_created_at ON conversation_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_synthesized_at ON conversation_insights(synthesized_at DESC);

-- Indexes for pattern detection
CREATE INDEX IF NOT EXISTS idx_insights_emotional_tags ON conversation_insights USING GIN (emotional_tags);
CREATE INDEX IF NOT EXISTS idx_insights_goal_mentions ON conversation_insights USING GIN (goal_mentions);
CREATE INDEX IF NOT EXISTS idx_insights_topics ON conversation_insights USING GIN (topics);
CREATE INDEX IF NOT EXISTS idx_insights_transformation ON conversation_insights USING GIN (transformation_events);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_insights_user_significant ON conversation_insights(user_id, is_significant_conversation) WHERE is_significant_conversation = TRUE;
CREATE INDEX IF NOT EXISTS idx_insights_user_emotional ON conversation_insights(user_id, has_breakthrough) WHERE has_breakthrough = TRUE;

-- Full-text search indexes for topic descriptions
CREATE INDEX IF NOT EXISTS idx_insights_goal_descriptions_gin ON conversation_insights USING GIN (goal_descriptions);

-- ==============================================================================
-- ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;

-- Users can only view their own insights
CREATE POLICY "users_view_own_insights"
  ON conversation_insights FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (from synthesis process)
CREATE POLICY "service_insert_insights"
  ON conversation_insights FOR INSERT
  WITH CHECK (user_id IS NOT NULL);

-- Users can update their own (for manual review)
CREATE POLICY "users_update_own_insights"
  ON conversation_insights FOR UPDATE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TRIGGERS
-- ==============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_insights_updated_at_trigger
  BEFORE UPDATE ON conversation_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_insights_updated_at();

-- ==============================================================================
-- HELPER FUNCTIONS
-- ==============================================================================

-- Get emotional tag frequency for user
CREATE OR REPLACE FUNCTION get_user_emotional_tags(user_id_param UUID)
RETURNS TABLE (
  emotion TEXT,
  frequency BIGINT,
  avg_intensity NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    unnest(emotional_tags) as emotion,
    COUNT(*) as frequency,
    AVG(unnest(emotional_intensities)) as avg_intensity
  FROM conversation_insights
  WHERE user_id = user_id_param
    AND emotional_tags IS NOT NULL
    AND array_length(emotional_tags, 1) > 0
  GROUP BY emotion
  ORDER BY frequency DESC;
END;
$$ LANGUAGE plpgsql;

-- Get most mentioned goals for user
CREATE OR REPLACE FUNCTION get_user_goals(user_id_param UUID, limit_count INT DEFAULT 10)
RETURNS TABLE (
  goal TEXT,
  mention_count BIGINT,
  first_mentioned TIMESTAMPTZ,
  last_mentioned TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    unnest(goal_mentions) as goal,
    COUNT(*) as mention_count,
    MIN(created_at) as first_mentioned,
    MAX(created_at) as last_mentioned
  FROM conversation_insights
  WHERE user_id = user_id_param
    AND goal_mentions IS NOT NULL
    AND array_length(goal_mentions, 1) > 0
  GROUP BY goal
  ORDER BY mention_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Get synthesis statistics for user
CREATE OR REPLACE FUNCTION get_synthesis_stats(user_id_param UUID)
RETURNS TABLE (
  total_insights BIGINT,
  avg_confidence NUMERIC,
  significant_conversations BIGINT,
  skipped_conversations BIGINT,
  total_synthesis_cost NUMERIC,
  most_common_synthesis_method TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_insights,
    AVG(synthesis_confidence) as avg_confidence,
    COUNT(*) FILTER (WHERE is_significant_conversation = TRUE) as significant_conversations,
    COUNT(*) FILTER (WHERE was_skipped = TRUE) as skipped_conversations,
    SUM(estimated_cost_usd) as total_synthesis_cost,
    MODE() WITHIN GROUP (ORDER BY synthesis_method) as most_common_synthesis_method
  FROM conversation_insights
  WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Apply synthesis insights to psychology files
-- This function would be called by the psychology-file-writer service
CREATE OR REPLACE FUNCTION get_pending_insights_for_update(user_id_param UUID)
RETURNS TABLE (
  insight_id UUID,
  emotional_tags TEXT[],
  goal_mentions TEXT[],
  topics TEXT[],
  transformation_events TEXT[],
  synthesis_confidence DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    emotional_tags,
    goal_mentions,
    topics,
    transformation_events,
    synthesis_confidence
  FROM conversation_insights
  WHERE user_id = user_id_param
    AND synthesized_at IS NOT NULL
    AND synthesis_confidence >= 0.5
    AND is_significant_conversation = TRUE
    AND NOT was_skipped
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMIT;
