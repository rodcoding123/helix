-- Phase 0.5: AI Operations Control Plane - Database Schema
-- Created: 2026-02-04
-- Purpose: Centralized configuration, cost tracking, and approval management for all AI operations

-- ============================================================================
-- TABLE 1: ai_model_routes
-- Purpose: Centralized routing configuration for all AI operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_model_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Operation identification
  operation_id VARCHAR UNIQUE NOT NULL,        -- "chat_message", "memory_synthesis", etc.
  operation_name VARCHAR NOT NULL,             -- Human-readable name

  -- Model routing
  primary_model VARCHAR NOT NULL,              -- "deepseek", "gemini_flash", "deepgram", "edge_tts"
  fallback_model VARCHAR,                      -- Fallback if primary fails

  -- Configuration
  enabled BOOLEAN DEFAULT true,
  cost_criticality VARCHAR DEFAULT 'MEDIUM',   -- 'LOW', 'MEDIUM', 'HIGH'

  -- Audit
  created_by VARCHAR DEFAULT 'system',
  updated_by VARCHAR DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT cost_criticality_check
    CHECK (cost_criticality IN ('LOW', 'MEDIUM', 'HIGH'))
);

-- Indexes for ai_model_routes
CREATE INDEX idx_ai_routes_operation_id ON ai_model_routes(operation_id);
CREATE INDEX idx_ai_routes_enabled ON ai_model_routes(enabled);

-- ============================================================================
-- TABLE 2: ai_operation_log
-- Purpose: Immutable log of every AI operation for cost tracking and auditing
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_operation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Operation details
  operation_type VARCHAR NOT NULL,             -- "chat_message", "memory_synthesis", etc.
  operation_id VARCHAR,                        -- Foreign key to ai_model_routes
  model_used VARCHAR NOT NULL,                 -- Which model actually executed

  -- User attribution
  user_id UUID,                                -- Who triggered it (nullable for system ops)

  -- Token accounting
  input_tokens INTEGER,
  output_tokens INTEGER,

  -- Cost tracking
  cost_usd DECIMAL(10, 6),

  -- Performance metrics
  latency_ms INTEGER,                          -- Response time in milliseconds

  -- Quality metrics
  quality_score DECIMAL(3, 2),                 -- 0.0-1.0 quality assessment

  -- Execution status
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for queries
  CONSTRAINT quality_score_range
    CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1))
);

-- Indexes for ai_operation_log (critical for querying costs)
CREATE INDEX idx_ai_log_user_id_created ON ai_operation_log(user_id, created_at DESC);
CREATE INDEX idx_ai_log_operation_type_created ON ai_operation_log(operation_type, created_at DESC);
CREATE INDEX idx_ai_log_model_used ON ai_operation_log(model_used);
CREATE INDEX idx_ai_log_success ON ai_operation_log(success);
CREATE INDEX idx_ai_log_created_at ON ai_operation_log(created_at DESC);

-- ============================================================================
-- TABLE 3: cost_budgets
-- Purpose: Daily budget tracking and enforcement per user
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User attribution
  user_id UUID UNIQUE NOT NULL,

  -- Budget configuration
  daily_limit_usd DECIMAL(10, 2) DEFAULT 50.00,
  warning_threshold_usd DECIMAL(10, 2) DEFAULT 25.00,  -- Alert at 50% of daily limit

  -- Daily tracking (reset at midnight UTC)
  current_spend_today DECIMAL(10, 2) DEFAULT 0.00,
  operations_today INTEGER DEFAULT 0,

  -- Timestamps
  last_checked TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for cost_budgets
CREATE INDEX idx_cost_budgets_user_id ON cost_budgets(user_id);
CREATE INDEX idx_cost_budgets_last_checked ON cost_budgets(last_checked);

-- ============================================================================
-- TABLE 4: feature_toggles
-- Purpose: Hardcoded safety toggles that control Helix's permissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Toggle identification
  toggle_name VARCHAR UNIQUE NOT NULL,

  -- State
  enabled BOOLEAN DEFAULT false,
  locked BOOLEAN DEFAULT true,                 -- If true, cannot be changed programmatically

  -- Control
  controlled_by VARCHAR DEFAULT 'ADMIN_ONLY',  -- 'ADMIN_ONLY', 'USER', 'BOTH'

  -- Documentation
  notes TEXT,

  -- Audit
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT controlled_by_check
    CHECK (controlled_by IN ('ADMIN_ONLY', 'USER', 'BOTH'))
);

-- Indexes for feature_toggles
CREATE INDEX idx_feature_toggles_name ON feature_toggles(toggle_name);
CREATE INDEX idx_feature_toggles_locked ON feature_toggles(locked);

-- ============================================================================
-- TABLE 5: helix_recommendations
-- Purpose: Store Helix's self-optimization recommendations
-- ============================================================================

CREATE TABLE IF NOT EXISTS helix_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recommendation details
  operation_id VARCHAR,                        -- Which operation to improve
  recommendation_type VARCHAR NOT NULL,        -- 'model_switch', 'schedule_batch', 'enable_cache'

  -- Current vs proposed
  current_config JSONB,
  proposed_config JSONB,

  -- Impact assessment
  estimated_savings_usd DECIMAL(10, 2),
  estimated_quality_impact DECIMAL(4, 2),     -- ±percentage point change
  confidence DECIMAL(3, 2),                    -- 0.0-1.0 confidence level

  -- Reasoning
  reasoning TEXT,

  -- Approval status
  approval_status VARCHAR DEFAULT 'PENDING',  -- 'PENDING', 'APPROVED', 'REJECTED'

  -- Attribution
  created_by VARCHAR DEFAULT 'helix',          -- Always 'helix' for now
  approved_by UUID,
  approved_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT approval_status_check
    CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT confidence_range
    CHECK (confidence >= 0 AND confidence <= 1)
);

-- Indexes for helix_recommendations
CREATE INDEX idx_helix_recs_operation_id ON helix_recommendations(operation_id);
CREATE INDEX idx_helix_recs_approval_status ON helix_recommendations(approval_status);
CREATE INDEX idx_helix_recs_created_at ON helix_recommendations(created_at DESC);

-- ============================================================================
-- INITIAL DATA INSERTION
-- ============================================================================

-- Insert AI model routing configuration (8 operations)
INSERT INTO ai_model_routes (operation_id, operation_name, primary_model, fallback_model, enabled, cost_criticality, created_by, updated_by)
VALUES
  ('chat_message', 'Chat Messages', 'deepseek', 'gemini_flash', true, 'HIGH', 'system', 'system'),
  ('agent_execution', 'Agent Execution', 'deepseek', 'gemini_flash', true, 'HIGH', 'system', 'system'),
  ('memory_synthesis', 'Memory Synthesis', 'gemini_flash', 'deepseek', true, 'MEDIUM', 'system', 'system'),
  ('sentiment_analysis', 'Sentiment Analysis', 'gemini_flash', 'deepseek', true, 'LOW', 'system', 'system'),
  ('video_understanding', 'Video Understanding', 'gemini_flash', NULL, true, 'MEDIUM', 'system', 'system'),
  ('audio_transcription', 'Audio Transcription', 'deepgram', 'openai', true, 'MEDIUM', 'system', 'system'),
  ('text_to_speech', 'Text to Speech', 'edge_tts', 'elevenlabs', true, 'LOW', 'system', 'system'),
  ('email_analysis', 'Email Analysis', 'gemini_flash', 'deepseek', false, 'LOW', 'system', 'system')
ON CONFLICT (operation_id) DO NOTHING;

-- Insert safety toggles (4 critical toggles)
INSERT INTO feature_toggles (toggle_name, enabled, locked, controlled_by, notes)
VALUES
  ('helix_can_change_models', false, true, 'ADMIN_ONLY', 'Helix cannot change models without explicit approval'),
  ('helix_can_approve_costs', false, true, 'ADMIN_ONLY', 'Helix cannot approve cost-impacting decisions'),
  ('helix_can_recommend_optimizations', false, false, 'BOTH', 'Helix can suggest optimizations (non-binding)'),
  ('helix_autonomy_enabled', false, false, 'USER', 'Users can enable full Helix autonomy (BYOK only)')
ON CONFLICT (toggle_name) DO NOTHING;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Daily cost summary
CREATE OR REPLACE VIEW v_daily_cost_summary AS
SELECT
  DATE(created_at) as date,
  operation_type,
  model_used,
  COUNT(*) as operation_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cost_usd) as total_cost,
  AVG(quality_score) as avg_quality,
  AVG(latency_ms) as avg_latency,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_ops,
  SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed_ops
FROM ai_operation_log
GROUP BY DATE(created_at), operation_type, model_used
ORDER BY date DESC, total_cost DESC;

-- View: Cost by user
CREATE OR REPLACE VIEW v_cost_by_user AS
SELECT
  DATE(created_at) as date,
  user_id,
  COUNT(*) as operations,
  SUM(cost_usd) as total_cost,
  AVG(quality_score) as avg_quality
FROM ai_operation_log
WHERE user_id IS NOT NULL
GROUP BY DATE(created_at), user_id
ORDER BY date DESC, total_cost DESC;

-- View: Model performance comparison
CREATE OR REPLACE VIEW v_model_performance AS
SELECT
  model_used,
  operation_type,
  COUNT(*) as total_operations,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success = true THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate,
  AVG(quality_score) as avg_quality,
  AVG(latency_ms) as avg_latency,
  AVG(cost_usd) as avg_cost_per_op,
  SUM(cost_usd) as total_cost
FROM ai_operation_log
GROUP BY model_used, operation_type
ORDER BY model_used, total_cost DESC;

-- ============================================================================
-- POLICIES & SECURITY (Row Level Security)
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE IF EXISTS cost_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS helix_recommendations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own budget
CREATE POLICY "Users see own budget" ON cost_budgets
  FOR SELECT USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- Policy: Only admins can modify budgets
CREATE POLICY "Only admins modify budgets" ON cost_budgets
  FOR UPDATE USING (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE ai_model_routes IS 'Configuration for routing AI operations to appropriate models';
COMMENT ON TABLE ai_operation_log IS 'Immutable audit log of all AI operations for cost tracking';
COMMENT ON TABLE cost_budgets IS 'Daily budget limits and spend tracking per user';
COMMENT ON TABLE feature_toggles IS 'Safety toggles controlling Helix permissions (hardcoded, not user-modifiable)';
COMMENT ON TABLE helix_recommendations IS 'Helix self-optimization recommendations awaiting approval';

COMMENT ON COLUMN ai_model_routes.operation_id IS 'Unique identifier for the AI operation (e.g., "chat_message")';
COMMENT ON COLUMN ai_model_routes.primary_model IS 'Primary model to route this operation to';
COMMENT ON COLUMN ai_operation_log.cost_usd IS 'Cost in USD calculated from token counts and model rates';
COMMENT ON COLUMN ai_operation_log.quality_score IS 'Quality assessment (0.0-1.0) if applicable';
COMMENT ON COLUMN cost_budgets.daily_limit_usd IS 'Hard limit - operations stopped at this threshold';
COMMENT ON COLUMN cost_budgets.warning_threshold_usd IS 'Soft limit - alerts sent when crossed (typically 50% of daily_limit)';
COMMENT ON COLUMN feature_toggles.locked IS 'If true, cannot be changed programmatically (hardcoded safety)';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

-- Schema version for migrations tracking
SELECT set_config('database.schema_version', '0.5.0', false);

-- Status: Ready for Phase 0.5 implementation
-- Next: Create TypeScript classes to interact with these tables
