-- Phase 9: Advanced Scheduling with PostgreSQL pg_cron
-- Week 21-22 Implementation
-- Status: Production-Ready with all fixes applied

-- Enable pg_cron extension (PostgreSQL native, persistent scheduling)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- OPERATION SCHEDULES TABLE
-- Stores what to execute and when
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

  -- Schedule type: cron (recurring), webhook (external trigger), or manual
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('cron', 'webhook', 'manual')),

  -- For cron schedules: "0 18 * * *" = 6pm daily
  cron_expression TEXT,

  -- For webhook schedules: external URL that triggers this schedule
  webhook_url TEXT,

  -- Secret reference for webhook verification (NOT the secret itself!)
  -- Points to 1Password item, loaded at runtime via load1PasswordSecret()
  webhook_secret_ref TEXT,

  enabled BOOLEAN DEFAULT TRUE,
  timezone TEXT DEFAULT 'UTC',

  -- Custom parameters passed to operation
  parameters JSONB,

  -- Cost limit per month (prevents runaway spending)
  max_cost_per_month DECIMAL(10, 2),

  -- Execution tracking
  last_execution_at TIMESTAMP,
  next_execution_at TIMESTAMP,
  execution_count INTEGER DEFAULT 0,

  -- Running execution lock: prevents duplicate concurrent runs
  -- If not NULL and last execution <1 hour ago, schedule is considered "running"
  running_execution_id UUID,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_schedules_user_enabled ON operation_schedules(user_id, enabled);
CREATE INDEX idx_schedules_next_execution ON operation_schedules(next_execution_at) WHERE enabled = TRUE;
CREATE INDEX idx_schedules_type ON operation_schedules(schedule_type);

-- RLS: Users can only see their own schedules
ALTER TABLE operation_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedule_select_own ON operation_schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY schedule_insert_own ON operation_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY schedule_update_own ON operation_schedules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY schedule_delete_own ON operation_schedules
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- SCHEDULE EXECUTIONS TABLE
-- Audit log of every execution (success, failure, etc)
-- ============================================================================

CREATE TABLE schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES operation_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Execution status lifecycle
  execution_status TEXT NOT NULL CHECK (execution_status IN ('pending', 'running', 'success', 'failed', 'skipped')),

  -- Operation result
  result JSONB,

  -- Error message if failed
  error_message TEXT,

  -- Cost estimates: low/mid/high confidence range
  cost_estimated_low DECIMAL(10, 6),
  cost_estimated_mid DECIMAL(10, 6),
  cost_estimated_high DECIMAL(10, 6),

  -- Actual cost after execution
  cost_actual DECIMAL(10, 6),

  -- Execution latency in milliseconds
  latency_ms INTEGER,

  -- How this execution was triggered
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('cron', 'webhook', 'manual')),

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_executions_schedule ON schedule_executions(schedule_id);
CREATE INDEX idx_executions_user_status ON schedule_executions(user_id, execution_status);
CREATE INDEX idx_executions_created ON schedule_executions(created_at DESC);

-- RLS: Users can only see their own execution history
ALTER TABLE schedule_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY execution_select_own ON schedule_executions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY execution_insert_own ON schedule_executions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- WEBHOOK EVENTS TABLE
-- Log all webhook triggers for debugging and verification
-- ============================================================================

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES operation_schedules(id) ON DELETE CASCADE,

  -- Type of event (webhook_received, webhook_error, etc)
  event_type TEXT NOT NULL,

  -- Full webhook payload
  payload JSONB,

  -- Signature verification result
  signature_verified BOOLEAN DEFAULT FALSE,

  -- Error message if signature verification failed
  signature_error TEXT,

  -- Whether this webhook was processed
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhooks_schedule ON webhook_events(schedule_id);
CREATE INDEX idx_webhooks_created ON webhook_events(created_at DESC);

-- RLS: Users can only see webhook events for their schedules
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_select_own ON webhook_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM operation_schedules
      WHERE operation_schedules.id = webhook_events.schedule_id
      AND operation_schedules.user_id = auth.uid()
    )
  );

-- ============================================================================
-- WEBHOOK SECRET AUDIT TRAIL
-- Track 1Password secret rotations for compliance
-- ============================================================================

CREATE TABLE webhook_secret_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES operation_schedules(id) ON DELETE CASCADE,

  -- Reference to 1Password secret (e.g., "webhook-schedule-abc123")
  secret_ref TEXT NOT NULL,

  -- Action: created, rotated, revoked
  action TEXT NOT NULL CHECK (action IN ('created', 'rotated', 'revoked')),

  -- Hash of old secret (never store secret itself!)
  old_hash TEXT,

  -- Hash of new secret
  new_hash TEXT,

  -- Who performed this action
  performed_by TEXT,

  -- Reason for the action
  reason TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_secret_audits_schedule ON webhook_secret_audits(schedule_id);
CREATE INDEX idx_secret_audits_created ON webhook_secret_audits(created_at DESC);

-- ============================================================================
-- OPERATION BATCHES TABLE
-- Store batch job definitions and execution status
-- ============================================================================

CREATE TABLE operation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  -- Batch execution type: parallel, sequential, or conditional (with dependencies)
  batch_type TEXT NOT NULL CHECK (batch_type IN ('parallel', 'sequential', 'conditional')),

  -- Priority for execution ordering (1-10, higher = more important)
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

  -- Batch lifecycle status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'queued', 'running', 'completed', 'failed', 'cancelled')
  ),

  -- Progress tracking
  total_operations INTEGER,
  completed_operations INTEGER DEFAULT 0,
  failed_operations INTEGER DEFAULT 0,
  skipped_operations INTEGER DEFAULT 0,

  -- Cost estimates: low/mid/high confidence range
  total_cost_estimated_low DECIMAL(10, 6),
  total_cost_estimated_mid DECIMAL(10, 6),
  total_cost_estimated_high DECIMAL(10, 6),

  -- Actual total cost after execution
  total_cost_actual DECIMAL(10, 6),

  -- Cancellation tracking
  cancelled_at TIMESTAMP,
  cancel_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_batches_user ON operation_batches(user_id);
CREATE INDEX idx_batches_status ON operation_batches(status);
CREATE INDEX idx_batches_created ON operation_batches(created_at DESC);

-- RLS: Users can only see their own batches
ALTER TABLE operation_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY batch_select_own ON operation_batches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY batch_insert_own ON operation_batches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY batch_update_own ON operation_batches
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- BATCH OPERATIONS TABLE
-- Individual operations within a batch
-- ============================================================================

CREATE TABLE batch_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES operation_batches(id) ON DELETE CASCADE,

  operation_id TEXT NOT NULL,
  parameters JSONB,

  -- Execution order within batch
  sequence_order INTEGER,

  -- For conditional batches: depends_on = parent operation ID
  depends_on UUID REFERENCES batch_operations(id),

  -- Status of this operation
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'skipped')
  ),

  -- Result from operation
  result JSONB,

  -- Error message if failed
  error_message TEXT,

  -- Cost estimates: low/mid/high confidence range
  cost_estimated_low DECIMAL(10, 6),
  cost_estimated_mid DECIMAL(10, 6),
  cost_estimated_high DECIMAL(10, 6),

  -- Actual cost after execution
  cost_actual DECIMAL(10, 6),

  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP
);

CREATE INDEX idx_batch_ops_batch ON batch_operations(batch_id);
CREATE INDEX idx_batch_ops_status ON batch_operations(status);
CREATE INDEX idx_batch_ops_depends ON batch_operations(depends_on);

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Check if a schedule is already running (prevents duplicate execution)
CREATE OR REPLACE FUNCTION schedule_is_running(p_schedule_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM schedule_executions
    WHERE schedule_id = p_schedule_id
    AND execution_status = 'running'
    -- Don't count hanging jobs older than 1 hour
    AND created_at > NOW() - INTERVAL '1 hour'
  );
END;
$$ LANGUAGE plpgsql;

-- Create execution with running lock
CREATE OR REPLACE FUNCTION create_execution_with_lock(
  p_schedule_id UUID,
  p_user_id UUID,
  p_triggered_by TEXT
)
RETURNS UUID AS $$
DECLARE
  v_execution_id UUID;
BEGIN
  -- Check if already running
  IF schedule_is_running(p_schedule_id) THEN
    RAISE EXCEPTION 'Schedule already running';
  END IF;

  -- Create execution record
  INSERT INTO schedule_executions (
    schedule_id, user_id, execution_status, triggered_by
  ) VALUES (
    p_schedule_id, p_user_id, 'pending', p_triggered_by
  ) RETURNING id INTO v_execution_id;

  -- Lock schedule with running execution ID
  UPDATE operation_schedules
  SET running_execution_id = v_execution_id
  WHERE id = p_schedule_id;

  RETURN v_execution_id;
END;
$$ LANGUAGE plpgsql;

-- Complete execution and unlock schedule
CREATE OR REPLACE FUNCTION complete_execution(
  p_execution_id UUID,
  p_status TEXT,
  p_result JSONB,
  p_cost_actual DECIMAL,
  p_latency_ms INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_schedule_id UUID;
BEGIN
  -- Update execution
  UPDATE schedule_executions
  SET execution_status = p_status,
      result = p_result,
      cost_actual = p_cost_actual,
      latency_ms = p_latency_ms,
      completed_at = NOW()
  WHERE id = p_execution_id
  RETURNING schedule_id INTO v_schedule_id;

  -- Unlock schedule and update tracking
  UPDATE operation_schedules
  SET running_execution_id = NULL,
      last_execution_at = NOW(),
      execution_count = execution_count + 1
  WHERE id = v_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- Batch progress tracking
CREATE OR REPLACE FUNCTION increment_batch_completed(p_batch_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE operation_batches
  SET completed_operations = completed_operations + 1
  WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_batch_failed(p_batch_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE operation_batches
  SET failed_operations = failed_operations + 1
  WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

-- Get monthly cost for schedule
CREATE OR REPLACE FUNCTION get_schedule_month_cost(
  p_user_id UUID,
  p_operation_id TEXT
)
RETURNS DECIMAL AS $$
DECLARE
  v_cost DECIMAL;
BEGIN
  SELECT COALESCE(SUM(cost_actual), 0)
  INTO v_cost
  FROM schedule_executions se
  JOIN operation_schedules os ON se.schedule_id = os.id
  WHERE se.user_id = p_user_id
  AND os.operation_id = p_operation_id
  AND se.created_at > NOW() - INTERVAL '30 days';

  RETURN v_cost;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update operation_schedules.updated_at on modification
CREATE OR REPLACE FUNCTION update_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_schedules_updated_at
BEFORE UPDATE ON operation_schedules
FOR EACH ROW
EXECUTE FUNCTION update_schedules_updated_at();

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Create example schedule for Phase 9 testing
-- Uncomment to enable:
/*
INSERT INTO operation_schedules (
  user_id, operation_id, schedule_type, cron_expression, timezone, enabled
)
SELECT
  id,
  'analytics-summary',
  'cron',
  '0 18 * * *', -- 6pm daily
  'UTC',
  false
FROM auth.users
LIMIT 1;
*/

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================

-- Record this migration
INSERT INTO _migrations (id, name, batch, execution_time)
VALUES (
  gen_random_uuid(),
  '045_phase9_scheduling',
  (SELECT COALESCE(MAX(batch), 0) + 1 FROM _migrations),
  EXTRACT(EPOCH FROM (NOW() - '2026-02-04'::timestamp))
) ON CONFLICT DO NOTHING;
