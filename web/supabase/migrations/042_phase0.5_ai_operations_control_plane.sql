-- Phase 0.5: AI Operations Control Plane
-- Foundation tables for centralized AI operation routing, cost tracking, and approval gates
-- Date: February 4, 2026

-- ============================================================================
-- AI MODEL ROUTES TABLE
-- ============================================================================
-- Central registry of all AI operations with their routing configuration
CREATE TABLE ai_model_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id TEXT NOT NULL UNIQUE,
  operation_name TEXT NOT NULL,
  description TEXT,
  primary_model TEXT NOT NULL CHECK (primary_model IN ('claude-opus-4.5', 'deepseek-v3.2', 'gemini-2.0-flash')),
  fallback_model TEXT CHECK (fallback_model IN ('claude-opus-4.5', 'deepseek-v3.2', 'gemini-2.0-flash', NULL)),
  enabled BOOLEAN DEFAULT TRUE,
  cost_criticality TEXT NOT NULL CHECK (cost_criticality IN ('LOW', 'MEDIUM', 'HIGH')),
  estimated_cost_usd DECIMAL(8, 6),
  avg_input_tokens INTEGER,
  avg_output_tokens INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_routes_enabled ON ai_model_routes(enabled);
CREATE INDEX idx_ai_routes_criticality ON ai_model_routes(cost_criticality);

-- ============================================================================
-- AI OPERATION LOG TABLE
-- ============================================================================
-- Complete audit log of all AI operations executed
CREATE TABLE ai_operation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL REFERENCES ai_model_routes(operation_id),
  model_used TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd DECIMAL(8, 6),
  latency_ms INTEGER,
  status TEXT CHECK (status IN ('pending', 'running', 'success', 'failed', 'timeout')) DEFAULT 'pending',
  error_message TEXT,
  result JSONB,
  request_metadata JSONB DEFAULT '{}',
  executed_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_ai_log_user ON ai_operation_log(user_id);
CREATE INDEX idx_ai_log_operation ON ai_operation_log(operation_id);
CREATE INDEX idx_ai_log_executed_at ON ai_operation_log(executed_at DESC);
CREATE INDEX idx_ai_log_status ON ai_operation_log(status);

-- ============================================================================
-- COST BUDGETS TABLE
-- ============================================================================
-- Per-user daily/monthly spending limits and tracking
CREATE TABLE cost_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_limit_usd DECIMAL(10, 2) DEFAULT 50.00,
  monthly_limit_usd DECIMAL(10, 2) DEFAULT 1000.00,
  warning_threshold_percentage INTEGER DEFAULT 80,
  current_spend_today DECIMAL(10, 2) DEFAULT 0,
  current_spend_month DECIMAL(10, 2) DEFAULT 0,
  operations_today INTEGER DEFAULT 0,
  operations_month INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  budget_status TEXT CHECK (budget_status IN ('ok', 'warning', 'exceeded')) DEFAULT 'ok',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_budgets_user ON cost_budgets(user_id);
CREATE INDEX idx_budgets_status ON cost_budgets(budget_status);

-- ============================================================================
-- FEATURE TOGGLES TABLE
-- ============================================================================
-- Control which intelligence operations are available
CREATE TABLE feature_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toggle_name TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  locked BOOLEAN DEFAULT FALSE,
  controlled_by TEXT CHECK (controlled_by IN ('ADMIN_ONLY', 'USER', 'BOTH')) DEFAULT 'USER',
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_toggles_enabled ON feature_toggles(enabled);
CREATE INDEX idx_toggles_controlled ON feature_toggles(controlled_by);

-- ============================================================================
-- USER FEATURE OVERRIDES TABLE
-- ============================================================================
-- Per-user overrides for feature toggles
CREATE TABLE user_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  toggle_name TEXT NOT NULL REFERENCES feature_toggles(toggle_name) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, toggle_name)
);

CREATE INDEX idx_user_overrides_user ON user_feature_overrides(user_id);
CREATE INDEX idx_user_overrides_toggle ON user_feature_overrides(toggle_name);

-- ============================================================================
-- APPROVAL GATES TABLE
-- ============================================================================
-- Tracks operations that require user approval before execution
CREATE TABLE approval_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL REFERENCES ai_model_routes(operation_id),
  operation_log_id UUID NOT NULL REFERENCES ai_operation_log(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reason TEXT,
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_approvals_user ON approval_gates(user_id);
CREATE INDEX idx_approvals_status ON approval_gates(status);
CREATE INDEX idx_approvals_created ON approval_gates(created_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- ai_model_routes: Public read (all authenticated users), admin write
ALTER TABLE ai_model_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_routes_public_read" ON ai_model_routes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ai_routes_admin_write" ON ai_model_routes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_trust_levels
      WHERE user_id = auth.uid()
      AND trust_level >= 3  -- Admin level
    )
  );

-- ai_operation_log: Users see their own logs
ALTER TABLE ai_operation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_log_user_own" ON ai_operation_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "ai_log_insert_own" ON ai_operation_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- cost_budgets: Users manage their own
ALTER TABLE cost_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cost_budgets_user_own" ON cost_budgets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cost_budgets_user_update" ON cost_budgets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- feature_toggles: Public read, admin write
ALTER TABLE feature_toggles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "toggles_public_read" ON feature_toggles
  FOR SELECT TO authenticated
  USING (true);

-- user_feature_overrides: Users manage their own
ALTER TABLE user_feature_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overrides_user_own" ON user_feature_overrides
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "overrides_user_manage" ON user_feature_overrides
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "overrides_user_update" ON user_feature_overrides
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- approval_gates: Users see their own approvals
ALTER TABLE approval_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals_user_own" ON approval_gates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Ensure each user has a cost budget record
-- This is handled by a trigger in migration 043

-- Create default feature toggles (will be managed by Phase 0.5 control plane)
-- Initial toggles for Phase 8 will be created in migration 043
