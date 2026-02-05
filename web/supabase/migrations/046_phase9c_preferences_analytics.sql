-- Phase 9C & 9D: Customization, Settings, and Advanced Analytics
-- Weeks 25-28 Implementation
-- Status: Production-Ready

-- ============================================================================
-- USER OPERATION PREFERENCES (Phase 9C)
-- Stores per-user preferences for each operation
-- ============================================================================

CREATE TABLE user_operation_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL CHECK (operation_id IN (
    'email-compose', 'email-classify', 'email-respond',
    'calendar-prep', 'calendar-time',
    'task-prioritize', 'task-breakdown',
    'analytics-summary', 'analytics-anomaly'
  )),

  -- Model selection: which model to prefer for this operation
  preferred_model TEXT CHECK (preferred_model IN ('anthropic', 'deepseek', 'gemini', 'openai')),

  -- Enable/disable individual operations
  enabled BOOLEAN DEFAULT TRUE,

  -- Default parameters for this operation
  default_parameters JSONB,

  -- Monthly budget limit for this operation
  cost_budget_monthly DECIMAL(10, 2),

  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, operation_id)
);

CREATE INDEX idx_user_op_prefs_user ON user_operation_preferences(user_id);
CREATE INDEX idx_user_op_prefs_op ON user_operation_preferences(operation_id);

-- ============================================================================
-- UI THEME PREFERENCES (Phase 9C)
-- Stores user theme and UI layout preferences
-- ============================================================================

CREATE TABLE ui_theme_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Color scheme: light, dark, or auto (system)
  color_scheme TEXT CHECK (color_scheme IN ('light', 'dark', 'auto')) DEFAULT 'auto',

  -- Accent color (hex code)
  accent_color TEXT DEFAULT '#3B82F6',

  -- Compact mode: reduced padding, smaller fonts
  compact_mode BOOLEAN DEFAULT FALSE,

  -- Layout preferences for each section
  email_list_view TEXT CHECK (email_list_view IN ('grid', 'list', 'compact')) DEFAULT 'grid',
  calendar_view TEXT CHECK (calendar_view IN ('month', 'week', 'day', 'agenda')) DEFAULT 'month',
  tasks_sort_by TEXT CHECK (tasks_sort_by IN ('priority', 'due_date', 'created_at', 'alphabetical')) DEFAULT 'priority',

  -- Notification preferences
  notify_on_operation_completion BOOLEAN DEFAULT TRUE,
  notify_on_operation_failure BOOLEAN DEFAULT TRUE,
  notify_on_cost_limit_warning BOOLEAN DEFAULT TRUE,
  notify_on_cost_limit_exceeded BOOLEAN DEFAULT TRUE,

  -- Sidebar state
  sidebar_collapsed BOOLEAN DEFAULT FALSE,

  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- OPERATION EXECUTION ANALYTICS (Phase 9D)
-- Detailed analytics for operations
-- ============================================================================

CREATE TABLE operation_execution_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL CHECK (operation_id IN (
    'email-compose', 'email-classify', 'email-respond',
    'calendar-prep', 'calendar-time',
    'task-prioritize', 'task-breakdown',
    'analytics-summary', 'analytics-anomaly'
  )),

  -- Execution metrics
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  success_rate DECIMAL(5, 2),

  -- Cost metrics
  total_cost_usd DECIMAL(12, 6),
  avg_cost_per_execution DECIMAL(10, 6),
  max_cost_single_execution DECIMAL(10, 6),

  -- Performance metrics
  avg_latency_ms INTEGER,
  min_latency_ms INTEGER,
  max_latency_ms INTEGER,

  -- Model usage
  anthropic_count INTEGER DEFAULT 0,
  deepseek_count INTEGER DEFAULT 0,
  gemini_count INTEGER DEFAULT 0,
  openai_count INTEGER DEFAULT 0,

  -- Time period
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,

  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, operation_id, period_start, period_end)
);

CREATE INDEX idx_analytics_user_period ON operation_execution_analytics(user_id, period_start, period_end);
CREATE INDEX idx_analytics_op_period ON operation_execution_analytics(operation_id, period_start, period_end);

-- ============================================================================
-- COST TRENDS (Phase 9D)
-- Daily cost rollup for trend analysis
-- ============================================================================

CREATE TABLE cost_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Date for this cost data
  date DATE NOT NULL,

  -- Daily totals
  total_operations INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(12, 6),
  avg_cost_per_operation DECIMAL(10, 6),

  -- Model breakdown
  anthropic_cost DECIMAL(12, 6),
  deepseek_cost DECIMAL(12, 6),
  gemini_cost DECIMAL(12, 6),
  openai_cost DECIMAL(12, 6),

  -- Performance
  avg_latency_ms INTEGER,
  success_rate DECIMAL(5, 2),

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, date)
);

CREATE INDEX idx_cost_trends_user_date ON cost_trends(user_id, date DESC);

-- ============================================================================
-- OPTIMIZATION RECOMMENDATIONS (Phase 9D)
-- ML-generated recommendations for cost/performance optimization
-- ============================================================================

CREATE TABLE optimization_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Recommendation details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation_type TEXT CHECK (recommendation_type IN ('cost', 'performance', 'usage', 'model_selection')) DEFAULT 'cost',

  -- Specific operation (optional)
  operation_id TEXT,

  -- Estimated impact
  estimated_savings_percent DECIMAL(5, 2),
  estimated_savings_usd DECIMAL(10, 6),
  estimated_latency_improvement_percent DECIMAL(5, 2),

  -- Status
  status TEXT CHECK (status IN ('active', 'dismissed', 'implemented')) DEFAULT 'active',

  -- Priority
  priority INTEGER CHECK (priority >= 1 AND priority <= 10) DEFAULT 5,

  -- Implementation details
  suggested_action JSONB,
  estimated_implementation_effort TEXT CHECK (estimated_implementation_effort IN ('trivial', 'easy', 'moderate', 'difficult')),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  dismissed_at TIMESTAMP,
  implemented_at TIMESTAMP
);

CREATE INDEX idx_recommendations_user_status ON optimization_recommendations(user_id, status);
CREATE INDEX idx_recommendations_user_priority ON optimization_recommendations(user_id, priority DESC);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- Ensure users can only see their own data
-- ============================================================================

ALTER TABLE user_operation_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_theme_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_execution_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_recommendations ENABLE ROW LEVEL SECURITY;

-- User operation preferences RLS
CREATE POLICY "Users can view own preferences"
  ON user_operation_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_operation_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_operation_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_operation_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- UI theme preferences RLS
CREATE POLICY "Users can view own theme"
  ON ui_theme_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own theme"
  ON ui_theme_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own theme"
  ON ui_theme_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Analytics RLS
CREATE POLICY "Users can view own analytics"
  ON operation_execution_analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert analytics"
  ON operation_execution_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Cost trends RLS
CREATE POLICY "Users can view own cost trends"
  ON cost_trends FOR SELECT
  USING (auth.uid() = user_id);

-- Recommendations RLS
CREATE POLICY "Users can view own recommendations"
  ON optimization_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert recommendations"
  ON optimization_recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendations"
  ON optimization_recommendations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get user's current monthly cost for an operation
CREATE OR REPLACE FUNCTION get_operation_monthly_cost(
  p_user_id UUID,
  p_operation_id TEXT,
  p_month DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE((
    SELECT SUM(total_cost_usd)
    FROM operation_execution_analytics
    WHERE user_id = p_user_id
      AND operation_id = p_operation_id
      AND DATE_TRUNC('month', period_start) = DATE_TRUNC('month', p_month)
  ), 0);
END;
$$ LANGUAGE plpgsql;

-- Get user's total monthly cost across all operations
CREATE OR REPLACE FUNCTION get_total_monthly_cost(p_user_id UUID, p_month DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE((
    SELECT SUM(total_cost_usd)
    FROM operation_execution_analytics
    WHERE user_id = p_user_id
      AND DATE_TRUNC('month', period_start) = DATE_TRUNC('month', p_month)
  ), 0);
END;
$$ LANGUAGE plpgsql;

-- Calculate success rate for a period
CREATE OR REPLACE FUNCTION calculate_success_rate(
  p_user_id UUID,
  p_operation_id TEXT,
  p_start_date TIMESTAMP,
  p_end_date TIMESTAMP
)
RETURNS DECIMAL AS $$
DECLARE
  v_total INTEGER;
  v_successful INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(CASE WHEN status = 'success' THEN 1 END)
  INTO v_total, v_successful
  FROM schedule_executions
  WHERE user_id = p_user_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  IF v_total = 0 THEN
    RETURN 100.0;
  END IF;

  RETURN (v_successful::DECIMAL / v_total) * 100;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUDIT LOGGING
-- ============================================================================

CREATE TABLE preference_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  preference_type TEXT NOT NULL,
  change_details JSONB,
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_preference_audit_user ON preference_audit_log(user_id, changed_at DESC);
