-- Phase 3: Memory Synthesis Pipeline
-- Table for storing conversation synthesis results
-- Updated by post-conversation-synthesis-hook

CREATE TABLE IF NOT EXISTS conversation_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Extracted patterns and analysis
  emotional_tags TEXT[],
  goals TEXT[],
  meaningful_topics TEXT[],
  patterns_json JSONB,
  synthesis_summary TEXT,

  -- Metadata
  synthesized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_conversation_insights_user_id
  ON conversation_insights(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_insights_conversation_id
  ON conversation_insights(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_insights_synthesized_at
  ON conversation_insights(synthesized_at DESC);

-- Index for full-text search on emotions
CREATE INDEX IF NOT EXISTS idx_conversation_insights_emotional_tags
  ON conversation_insights USING GIN(emotional_tags);

-- Index for full-text search on goals
CREATE INDEX IF NOT EXISTS idx_conversation_insights_goals
  ON conversation_insights USING GIN(goals);

-- Index for full-text search on topics
CREATE INDEX IF NOT EXISTS idx_conversation_insights_topics
  ON conversation_insights USING GIN(meaningful_topics);

-- Row-level security: Users can only view their own insights
ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversation insights"
  ON conversation_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversation insights"
  ON conversation_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversation insights"
  ON conversation_insights FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversation insights"
  ON conversation_insights FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER conversation_insights_updated_at_trigger
  BEFORE UPDATE ON conversation_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_insights_updated_at();

-- Add column to conversations table to track if synthesis was done
-- (if not already present)
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS synthesized_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS synthesis_insights TEXT;

-- Create index for conversations that need synthesis
CREATE INDEX IF NOT EXISTS idx_conversations_needs_synthesis
  ON conversations(created_at DESC)
  WHERE synthesized_at IS NULL;

-- Comment on table for documentation
COMMENT ON TABLE conversation_insights IS
  'Stores synthesis results from memory synthesis pipeline (Phase 3).
   Updated by post-conversation-synthesis-hook after each conversation.
   Contains extracted patterns: emotional tags, goals, topics, and raw analysis.';

COMMENT ON COLUMN conversation_insights.emotional_tags IS
  'Array of emotional tags detected in conversation (Layer 2: Emotional Memory)';

COMMENT ON COLUMN conversation_insights.goals IS
  'Array of goals or aspirations mentioned in conversation (Layer 4: Prospective Self)';

COMMENT ON COLUMN conversation_insights.meaningful_topics IS
  'Array of topics that were meaningful to user in conversation (Layer 1: Narrative)';

COMMENT ON COLUMN conversation_insights.patterns_json IS
  'Raw synthesis patterns as JSON from memory.synthesize RPC response';

COMMENT ON COLUMN conversation_insights.synthesis_summary IS
  'Summary of synthesis analysis from memory synthesis';
