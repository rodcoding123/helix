-- Supabase Migration: Phase G - Session & Memory Intelligence
-- PHASE G: Session Configuration, Synthesis Monitoring, Templates, Identity Links
-- Date: 2026-02-07
--
-- Creates tables for:
-- 1. Memory synthesis jobs - Track synthesis pipeline execution and results
-- 2. Session templates - Preset session configurations
-- 3. Identity links - Cross-channel user identity mapping
-- 4. Synthesis metrics - Aggregate job statistics and patterns

BEGIN;

-- ==============================================================================
-- TABLE 1: Memory Synthesis Jobs
-- ==============================================================================
-- Tracks synthesis pipeline execution with metadata, insights, and costs
-- Used for monitoring synthesis progress and pattern detection
--
-- Synthesis Types:
--   - emotional_patterns: Extract emotional themes from conversations
--   - prospective_self: Identify goals, fears, and possible selves
--   - relational_memory: Map attachment patterns and trust dynamics
--   - narrative_coherence: Check story consistency and conflicts
--   - full_synthesis: Complete 7-layer reconsolidation

CREATE TABLE IF NOT EXISTS memory_synthesis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Synthesis metadata
  synthesis_type TEXT NOT NULL CHECK (synthesis_type IN (
    'emotional_patterns',
    'prospective_self',
    'relational_memory',
    'narrative_coherence',
    'full_synthesis'
  )),
  conversation_id TEXT,
  session_key TEXT,

  -- Job status and progress
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'failed'
  )),
  progress DECIMAL(3, 2) DEFAULT 0.0, -- 0.0 to 1.0

  -- Synthesis results
  insights JSONB DEFAULT '{}', -- Detected patterns and themes
  patterns_detected TEXT[] DEFAULT '{}', -- List of pattern names
  confidence_scores JSONB DEFAULT '{}', -- {pattern: confidence, ...}

  -- Model and execution
  model_used TEXT, -- 'claude-3-5-sonnet-20241022', etc.
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  execution_time_ms INTEGER,

  -- Error handling
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_synthesis_jobs_user_id ON memory_synthesis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_jobs_status ON memory_synthesis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_synthesis_jobs_type ON memory_synthesis_jobs(synthesis_type);
CREATE INDEX IF NOT EXISTS idx_synthesis_jobs_created_at ON memory_synthesis_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_synthesis_jobs_user_status ON memory_synthesis_jobs(user_id, status);

-- GIN index for pattern search
CREATE INDEX IF NOT EXISTS idx_synthesis_jobs_patterns_gin ON memory_synthesis_jobs USING GIN (patterns_detected);

-- RLS: Users can view own synthesis jobs
ALTER TABLE memory_synthesis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_synthesis_jobs"
  ON memory_synthesis_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_synthesis_jobs"
  ON memory_synthesis_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_synthesis_jobs"
  ON memory_synthesis_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 2: Session Templates
-- ==============================================================================
-- Preset session configurations for common use cases
-- System templates are read-only; users can create custom templates
--
-- Template Scope:
--   - Session scope: per-sender, per-channel, per-channel-peer
--   - Reset mode: daily (hour), idle (minutes), manual
--   - Token budget: default (8K), custom (256K max)
--   - Compaction: enabled/disabled with optional thresholds

CREATE TABLE IF NOT EXISTS session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for system templates

  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,

  -- Session configuration
  config JSONB NOT NULL, -- {scope, resetMode, resetHour, idleTimeout, budget, compaction, ...}

  -- Usage metrics
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON session_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_is_system ON session_templates(is_system);
CREATE INDEX IF NOT EXISTS idx_templates_name ON session_templates(name);

-- RLS: System templates visible to all, user templates only to owner
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_system_templates"
  ON session_templates FOR SELECT
  USING (is_system = TRUE);

CREATE POLICY "users_view_own_templates"
  ON session_templates FOR SELECT
  USING (auth.uid() = user_id OR is_system = TRUE);

CREATE POLICY "users_insert_own_templates"
  ON session_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "users_update_own_templates"
  ON session_templates FOR UPDATE
  USING (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "users_delete_own_templates"
  ON session_templates FOR DELETE
  USING (auth.uid() = user_id AND is_system = FALSE);

-- ==============================================================================
-- TABLE 3: Identity Links
-- ==============================================================================
-- Cross-channel user identity mapping
-- Maintains confidence scores and link provenance
--
-- Link Types:
--   - email: Verified email address
--   - phone: Phone number (country-specific)
--   - username: Social media or service username
--   - manual: User-created link
--   - inferred: System-detected link (requires review)

CREATE TABLE IF NOT EXISTS identity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity pair
  identity_a TEXT NOT NULL,
  identity_b TEXT NOT NULL,

  -- Link metadata
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  link_type TEXT NOT NULL CHECK (link_type IN (
    'email',
    'phone',
    'username',
    'manual',
    'inferred'
  )),

  -- Provenance
  created_by TEXT, -- User name or system identifier
  verified_at TIMESTAMPTZ, -- When manually verified
  verification_method TEXT, -- 'email_check', 'phone_verify', 'manual', 'ai_analysis'

  -- Bidirectional flag
  is_bidirectional BOOLEAN DEFAULT TRUE, -- If link is symmetrical

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_links_user_id ON identity_links(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_links_confidence ON identity_links(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_identity_links_type ON identity_links(link_type);
CREATE INDEX IF NOT EXISTS idx_identity_links_identity_a ON identity_links(identity_a);
CREATE INDEX IF NOT EXISTS idx_identity_links_identity_b ON identity_links(identity_b);

-- RLS: Users can view and manage own identity links
ALTER TABLE identity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_identity_links"
  ON identity_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_identity_links"
  ON identity_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_identity_links"
  ON identity_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_identity_links"
  ON identity_links FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 4: Synthesis Metrics
-- ==============================================================================
-- Aggregate statistics for synthesis jobs
-- Used for analytics and performance monitoring

CREATE TABLE IF NOT EXISTS synthesis_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Time period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Job statistics
  total_jobs INTEGER DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  failed_jobs INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER,

  -- Token usage
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  total_cost_usd DECIMAL(10, 6) DEFAULT 0.0,
  avg_cost_per_job DECIMAL(10, 6),

  -- Synthesis types breakdown
  job_types JSONB DEFAULT '{}', -- {type: count, ...}

  -- Pattern frequency
  most_common_patterns JSONB DEFAULT '{}', -- [{pattern, count, avg_confidence}, ...]

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_user_id ON synthesis_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_period ON synthesis_metrics(period_start, period_end);

-- RLS: Users can view own metrics
ALTER TABLE synthesis_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_metrics"
  ON synthesis_metrics FOR SELECT
  USING (auth.uid() = user_id);

-- ==============================================================================
-- HELPER FUNCTIONS
-- ==============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER memory_synthesis_jobs_updated_at_trigger
  BEFORE UPDATE ON memory_synthesis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER session_templates_updated_at_trigger
  BEFORE UPDATE ON session_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER identity_links_updated_at_trigger
  BEFORE UPDATE ON identity_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER synthesis_metrics_updated_at_trigger
  BEFORE UPDATE ON synthesis_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- HELPER FUNCTION: Get Synthesis Job History
-- ==============================================================================
-- Returns synthesis jobs for a user with optional filtering

CREATE OR REPLACE FUNCTION get_synthesis_job_history(
  user_id_param UUID,
  job_type TEXT DEFAULT NULL,
  limit_param INT DEFAULT 50,
  offset_param INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  synthesis_type TEXT,
  status TEXT,
  model_used TEXT,
  cost_usd DECIMAL,
  execution_time_ms INTEGER,
  patterns_detected TEXT[],
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    memory_synthesis_jobs.id,
    memory_synthesis_jobs.synthesis_type,
    memory_synthesis_jobs.status,
    memory_synthesis_jobs.model_used,
    memory_synthesis_jobs.cost_usd,
    memory_synthesis_jobs.execution_time_ms,
    memory_synthesis_jobs.patterns_detected,
    memory_synthesis_jobs.created_at
  FROM memory_synthesis_jobs
  WHERE memory_synthesis_jobs.user_id = user_id_param
    AND (job_type IS NULL OR memory_synthesis_jobs.synthesis_type = job_type)
  ORDER BY memory_synthesis_jobs.created_at DESC
  LIMIT limit_param
  OFFSET offset_param;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- HELPER FUNCTION: Calculate Synthesis Cost Burn Rate
-- ==============================================================================
-- Calculate cost per hour and per minute for budgeting

CREATE OR REPLACE FUNCTION get_synthesis_burn_rate(
  user_id_param UUID,
  lookback_hours INT DEFAULT 24
)
RETURNS TABLE (
  total_cost_usd DECIMAL,
  cost_per_hour DECIMAL,
  cost_per_minute DECIMAL,
  job_count INTEGER,
  avg_job_cost DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(cost_usd), 0::DECIMAL) as total_cost_usd,
    COALESCE(SUM(cost_usd) / NULLIF(lookback_hours, 0), 0::DECIMAL) as cost_per_hour,
    COALESCE(SUM(cost_usd) / NULLIF(lookback_hours * 60, 0), 0::DECIMAL) as cost_per_minute,
    COUNT(*)::INTEGER as job_count,
    COALESCE(AVG(cost_usd), 0::DECIMAL) as avg_job_cost
  FROM memory_synthesis_jobs
  WHERE user_id = user_id_param
    AND created_at > NOW() - (lookback_hours::TEXT || ' hours')::INTERVAL
    AND status = 'completed';
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- HELPER FUNCTION: Get Identity Link Graph
-- ==============================================================================
-- Returns all identity links for a user in graph format

CREATE OR REPLACE FUNCTION get_identity_link_graph(user_id_param UUID)
RETURNS TABLE (
  identity_a TEXT,
  identity_b TEXT,
  confidence DECIMAL,
  link_type TEXT,
  verified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    identity_links.identity_a,
    identity_links.identity_b,
    identity_links.confidence,
    identity_links.link_type,
    (identity_links.verified_at IS NOT NULL)::BOOLEAN
  FROM identity_links
  WHERE identity_links.user_id = user_id_param
  ORDER BY identity_links.confidence DESC;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- SEED DATA: System Templates
-- ==============================================================================
-- Pre-populated template library for common use cases

INSERT INTO session_templates (name, description, is_system, config) VALUES
  (
    'Quick Chat',
    'Fast responses with 8K context window, 30 minute idle timeout',
    TRUE,
    '{
      "scope": "per-sender",
      "resetMode": "idle",
      "idleTimeout": 30,
      "budget": 8000,
      "compaction": {"enabled": true, "threshold": 7000}
    }'::JSONB
  ),
  (
    'Customer Support',
    'Extended context (200K) with 4h idle timeout for long conversations',
    TRUE,
    '{
      "scope": "per-channel-peer",
      "resetMode": "daily",
      "resetHour": 2,
      "budget": 200000,
      "compaction": {"enabled": true, "threshold": 180000}
    }'::JSONB
  ),
  (
    'Deep Analysis',
    'Maximum context (256K) with manual reset for research sessions',
    TRUE,
    '{
      "scope": "per-channel",
      "resetMode": "manual",
      "budget": 256000,
      "compaction": {"enabled": false}
    }'::JSONB
  ),
  (
    'Development',
    'Balanced 64K context with daily 2AM reset',
    TRUE,
    '{
      "scope": "per-channel-peer",
      "resetMode": "daily",
      "resetHour": 2,
      "budget": 64000,
      "compaction": {"enabled": true, "threshold": 56000}
    }'::JSONB
  )
ON CONFLICT DO NOTHING;

COMMIT;
