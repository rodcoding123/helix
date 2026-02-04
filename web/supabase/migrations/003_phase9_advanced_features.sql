-- Phase 9: Advanced Features & Automation
-- Date: February 4, 2026
-- Tables for scheduling, batch operations, customization, and analytics

-- ============================================================================
-- PHASE 9A: SCHEDULING TABLES
-- ============================================================================

CREATE TABLE operation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL CHECK (operation_id IN (
    'email-compose', 'email-classify', 'email-respond',
    'calendar-prep', 'calendar-time',
    'task-prioritize', 'task-breakdown',
    'analytics-summary', 'analytics-anomaly'
  )),

  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('cron', 'webhook', 'manual')),
  cron_expression TEXT,
  webhook_url TEXT,

  enabled BOOLEAN DEFAULT TRUE,
  frequency TEXT,
  timezone TEXT DEFAULT 'UTC',

  parameters JSONB DEFAULT '{}',
  max_cost_per_month DECIMAL(10, 2),

  last_execution_at TIMESTAMP,
  next_execution_at TIMESTAMP,
  execution_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_schedules_user_enabled ON operation_schedules(user_id, enabled);
CREATE INDEX idx_schedules_next_execution ON operation_schedules(next_execution_at) WHERE enabled = TRUE;

-- Execution history for schedules
CREATE TABLE schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES operation_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  execution_status TEXT CHECK (execution_status IN ('pending', 'running', 'success', 'failed')),
  result JSONB,
  error_message TEXT,

  cost_usd DECIMAL(10, 6),
  latency_ms INTEGER,

  triggered_by TEXT CHECK (triggered_by IN ('cron', 'webhook', 'manual')),

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_executions_schedule ON schedule_executions(schedule_id);
CREATE INDEX idx_executions_user_status ON schedule_executions(user_id, execution_status);

-- Webhook event logs
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES operation_schedules(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  payload JSONB,
  signature TEXT,

  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhooks_schedule ON webhook_events(schedule_id);

-- ============================================================================
-- PHASE 9B: BATCH OPERATIONS TABLES
-- ============================================================================

CREATE TABLE operation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  batch_type TEXT CHECK (batch_type IN ('parallel', 'sequential', 'conditional')),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'running', 'completed', 'failed')),

  total_operations INTEGER,
  completed_operations INTEGER DEFAULT 0,
  failed_operations INTEGER DEFAULT 0,

  total_cost_estimated DECIMAL(10, 6),
  total_cost_actual DECIMAL(10, 6),

  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE batch_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES operation_batches(id) ON DELETE CASCADE,

  operation_id TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',

  sequence_order INTEGER,
  depends_on UUID REFERENCES batch_operations(id),

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
  result JSONB,
  cost_usd DECIMAL(10, 6),

  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP
);

CREATE INDEX idx_batches_user ON operation_batches(user_id);
CREATE INDEX idx_batches_status ON operation_batches(status);
CREATE INDEX idx_batch_ops ON batch_operations(batch_id);

-- ============================================================================
-- PHASE 9C: CUSTOMIZATION & PREFERENCES TABLES
-- ============================================================================

CREATE TABLE user_operation_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,

  preferred_model TEXT CHECK (preferred_model IN ('deepseek', 'gemini', 'openai')),
  enabled BOOLEAN DEFAULT TRUE,

  default_parameters JSONB DEFAULT '{}',
  cost_budget_monthly DECIMAL(10, 2),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, operation_id)
);

CREATE TABLE ui_theme_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  color_scheme TEXT CHECK (color_scheme IN ('light', 'dark', 'auto')) DEFAULT 'auto',
  accent_color TEXT DEFAULT '#3B82F6',
  compact_mode BOOLEAN DEFAULT FALSE,

  email_list_view TEXT DEFAULT 'grid' CHECK (email_list_view IN ('grid', 'list')),
  calendar_view TEXT DEFAULT 'month' CHECK (calendar_view IN ('month', 'week', 'day', 'agenda')),
  tasks_sort_by TEXT DEFAULT 'priority' CHECK (tasks_sort_by IN ('priority', 'due-date', 'created')),

  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- PHASE 9D: ANALYTICS & REPORTING TABLES
-- ============================================================================

CREATE TABLE operation_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,

  date_bucket DATE,
  hour_bucket INTEGER,

  call_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,

  total_cost_usd DECIMAL(10, 6),
  avg_cost_usd DECIMAL(10, 6),
  min_latency_ms INTEGER,
  max_latency_ms INTEGER,
  avg_latency_ms DECIMAL(10, 2),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_user_date ON operation_analytics(user_id, date_bucket DESC);
CREATE INDEX idx_analytics_operation ON operation_analytics(operation_id, date_bucket DESC);

CREATE TABLE optimization_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('cost-saving', 'performance', 'usage-pattern')),
  operation_id TEXT,
  priority INTEGER CHECK (priority >= 1 AND priority <= 5),

  title TEXT NOT NULL,
  description TEXT,
  estimated_savings DECIMAL(10, 6),

  applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX idx_recommendations_user ON optimization_recommendations(user_id, applied);

-- ============================================================================
-- RPC FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Increment schedule execution count
CREATE OR REPLACE FUNCTION increment_schedule_execution_count(schedule_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE operation_schedules
  SET execution_count = execution_count + 1
  WHERE id = schedule_id;
END;
$$ LANGUAGE plpgsql;

-- Increment batch completed count
CREATE OR REPLACE FUNCTION increment_batch_completed(batch_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE operation_batches
  SET completed_operations = completed_operations + 1
  WHERE id = batch_id;
END;
$$ LANGUAGE plpgsql;

-- Increment batch failed count
CREATE OR REPLACE FUNCTION increment_batch_failed(batch_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE operation_batches
  SET failed_operations = failed_operations + 1
  WHERE id = batch_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ENABLE REALTIME ON RELEVANT TABLES
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE operation_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_executions;
ALTER PUBLICATION supabase_realtime ADD TABLE operation_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE batch_operations;
ALTER PUBLICATION supabase_realtime ADD TABLE user_operation_preferences;
ALTER PUBLICATION supabase_realtime ADD TABLE ui_theme_preferences;
ALTER PUBLICATION supabase_realtime ADD TABLE operation_analytics;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all Phase 9 tables
ALTER TABLE operation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_operation_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_theme_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_recommendations ENABLE ROW LEVEL SECURITY;

-- Allow users to read/write their own schedules
CREATE POLICY "Users can manage own schedules" ON operation_schedules
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own executions" ON schedule_executions
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to manage own batches
CREATE POLICY "Users can manage own batches" ON operation_batches
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own batch operations" ON batch_operations
  FOR SELECT USING (
    batch_id IN (
      SELECT id FROM operation_batches WHERE user_id = auth.uid()
    )
  );

-- Allow users to manage own preferences
CREATE POLICY "Users can manage own preferences" ON user_operation_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own theme" ON ui_theme_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Allow users to view own analytics
CREATE POLICY "Users can view own analytics" ON operation_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own recommendations" ON optimization_recommendations
  FOR SELECT USING (auth.uid() = user_id);
