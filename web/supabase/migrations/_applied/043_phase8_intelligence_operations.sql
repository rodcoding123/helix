-- Phase 8: Intelligence Operations Registration
-- Registers all 9 Phase 8 intelligence operations in the control plane
-- Date: February 4, 2026

-- ============================================================================
-- PHASE 8 INTELLIGENCE OPERATIONS REGISTRATION
-- ============================================================================

-- EMAIL INTELLIGENCE OPERATIONS

INSERT INTO ai_model_routes (operation_id, operation_name, description, primary_model, fallback_model, cost_criticality, estimated_cost_usd, avg_input_tokens, avg_output_tokens) VALUES
('email-compose', 'Email Composition Assistant', 'AI-assisted email drafting maintaining user voice and style', 'deepseek-v3.2', 'gemini-2.0-flash', 'LOW', 0.0015, 800, 200),
('email-classify', 'Email Classifier', 'Automatic email categorization and metadata extraction', 'deepseek-v3.2', 'gemini-2.0-flash', 'LOW', 0.0006, 400, 100),
('email-respond', 'Smart Reply Generator', 'Context-aware reply suggestions with calendar/task awareness', 'deepseek-v3.2', 'gemini-2.0-flash', 'LOW', 0.0012, 600, 150);

-- CALENDAR INTELLIGENCE OPERATIONS

INSERT INTO ai_model_routes (operation_id, operation_name, description, primary_model, fallback_model, cost_criticality, estimated_cost_usd, avg_input_tokens, avg_output_tokens) VALUES
('calendar-prep', 'Meeting Preparation Generator', 'Synthesizes emails, tasks, and documents for upcoming meetings (triggered 30 min before)', 'deepseek-v3.2', 'gemini-2.0-flash', 'LOW', 0.0025, 1200, 300),
('calendar-time', 'Smart Meeting Time Suggester', 'Optimal meeting time recommendations considering deep work blocks and clustering preferences', 'gemini-2.0-flash', 'deepseek-v3.2', 'LOW', 0.0080, 1800, 400);

-- TASK INTELLIGENCE OPERATIONS

INSERT INTO ai_model_routes (operation_id, operation_name, description, primary_model, fallback_model, cost_criticality, estimated_cost_usd, avg_input_tokens, avg_output_tokens) VALUES
('task-prioritize', 'AI Task Prioritizer', 'Business impact-based task reordering with delegation/parking suggestions', 'deepseek-v3.2', 'gemini-2.0-flash', 'LOW', 0.0018, 900, 250),
('task-breakdown', 'Subtask Generator', 'Suggests 5-7 atomic subtasks with success criteria for large projects', 'deepseek-v3.2', 'gemini-2.0-flash', 'LOW', 0.0012, 700, 180);

-- ANALYTICS INTELLIGENCE OPERATIONS

INSERT INTO ai_model_routes (operation_id, operation_name, description, primary_model, fallback_model, cost_criticality, estimated_cost_usd, avg_input_tokens, avg_output_tokens) VALUES
('analytics-summary', 'Weekly Summary Generator', 'Executive summary with achievements, focus areas, and blockers (Sunday 6pm)', 'gemini-2.0-flash', 'deepseek-v3.2', 'MEDIUM', 0.0300, 2500, 800),
('analytics-anomaly', 'Behavior Anomaly Detector', 'Pattern deviation detection comparing current week vs 3-month baseline', 'deepseek-v3.2', 'gemini-2.0-flash', 'LOW', 0.0009, 500, 120);

-- ============================================================================
-- FEATURE TOGGLES FOR PHASE 8
-- ============================================================================

INSERT INTO feature_toggles (toggle_name, description, enabled, controlled_by) VALUES
('phase8-email-intelligence', 'Enable email composition, classification, and reply suggestions', TRUE, 'BOTH'),
('phase8-calendar-intelligence', 'Enable meeting preparation and smart time suggestions', TRUE, 'BOTH'),
('phase8-task-intelligence', 'Enable task prioritization and subtask generation', TRUE, 'BOTH'),
('phase8-analytics-intelligence', 'Enable weekly summaries and behavior analysis', TRUE, 'BOTH'),
('phase8-email-compose', 'Email composition assistant', TRUE, 'USER'),
('phase8-email-classify', 'Email classification and metadata extraction', TRUE, 'USER'),
('phase8-email-respond', 'Smart reply generator', TRUE, 'USER'),
('phase8-calendar-prep', 'Meeting preparation generator', TRUE, 'USER'),
('phase8-calendar-time', 'Smart meeting time suggestions', TRUE, 'USER'),
('phase8-task-prioritize', 'AI task prioritization', TRUE, 'USER'),
('phase8-task-breakdown', 'Subtask generation', TRUE, 'USER'),
('phase8-analytics-summary', 'Weekly summary generation', TRUE, 'USER'),
('phase8-analytics-anomaly', 'Behavior anomaly detection', TRUE, 'USER');

-- ============================================================================
-- TRIGGER FOR AUTO-CREATING COST BUDGETS
-- ============================================================================

CREATE OR REPLACE FUNCTION create_cost_budget_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cost_budgets (user_id, daily_limit_usd, monthly_limit_usd)
  VALUES (NEW.id, 50.00, 1000.00)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_cost_budget ON auth.users;
CREATE TRIGGER trigger_create_cost_budget
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_cost_budget_for_new_user();

-- ============================================================================
-- FUNCTION: Update daily cost tracking
-- ============================================================================

CREATE OR REPLACE FUNCTION update_daily_cost_tracking()
RETURNS void AS $$
BEGIN
  -- Reset daily counters at midnight UTC
  UPDATE cost_budgets
  SET
    current_spend_today = 0,
    operations_today = 0,
    last_reset_date = CURRENT_DATE,
    budget_status = 'ok'
  WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Log AI operation and update cost tracking
-- ============================================================================

CREATE OR REPLACE FUNCTION log_ai_operation(
  p_user_id UUID,
  p_operation_id TEXT,
  p_model_used TEXT,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_cost_usd DECIMAL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Ensure cost budget exists
  INSERT INTO cost_budgets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create operation log entry
  INSERT INTO ai_operation_log (
    user_id, operation_id, model_used, input_tokens, output_tokens,
    total_tokens, cost_usd, status
  )
  VALUES (
    p_user_id, p_operation_id, p_model_used, p_input_tokens, p_output_tokens,
    p_input_tokens + p_output_tokens, p_cost_usd, 'pending'
  )
  RETURNING id INTO v_log_id;

  -- Update cost budget tracking
  UPDATE cost_budgets
  SET
    current_spend_today = current_spend_today + p_cost_usd,
    current_spend_month = current_spend_month + p_cost_usd,
    operations_today = operations_today + 1,
    operations_month = operations_month + 1,
    budget_status = CASE
      WHEN (current_spend_today + p_cost_usd) > daily_limit_usd THEN 'exceeded'
      WHEN (current_spend_today + p_cost_usd) > (daily_limit_usd * warning_threshold_percentage / 100) THEN 'warning'
      ELSE 'ok'
    END,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Check operation approval requirement
-- ============================================================================

CREATE OR REPLACE FUNCTION check_operation_approval_required(
  p_user_id UUID,
  p_operation_id TEXT,
  p_estimated_cost DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_criticality TEXT;
  v_current_budget RECORD;
BEGIN
  -- Get operation criticality
  SELECT cost_criticality INTO v_criticality
  FROM ai_model_routes
  WHERE operation_id = p_operation_id;

  -- Get user's current budget status
  SELECT daily_limit_usd, current_spend_today, budget_status
  INTO v_current_budget
  FROM cost_budgets
  WHERE user_id = p_user_id;

  -- Approval required if:
  -- 1. Operation is MEDIUM or HIGH criticality
  -- 2. Would exceed daily budget
  -- 3. Would reach warning threshold
  RETURN (
    v_criticality IN ('MEDIUM', 'HIGH')
    OR (v_current_budget.current_spend_today + p_estimated_cost) > v_current_budget.daily_limit_usd
    OR v_current_budget.budget_status = 'warning'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get user effective feature status (considering overrides)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_feature_enabled(
  p_user_id UUID,
  p_toggle_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_override_exists BOOLEAN;
  v_override_enabled BOOLEAN;
  v_global_enabled BOOLEAN;
BEGIN
  -- Check if user has an override
  SELECT EXISTS(
    SELECT 1 FROM user_feature_overrides
    WHERE user_id = p_user_id AND toggle_name = p_toggle_name
  ) INTO v_override_exists;

  IF v_override_exists THEN
    SELECT enabled INTO v_override_enabled
    FROM user_feature_overrides
    WHERE user_id = p_user_id AND toggle_name = p_toggle_name;
    RETURN v_override_enabled;
  END IF;

  -- Return global toggle status
  SELECT enabled INTO v_global_enabled
  FROM feature_toggles
  WHERE toggle_name = p_toggle_name;

  RETURN COALESCE(v_global_enabled, FALSE);
END;
$$ LANGUAGE plpgsql;
