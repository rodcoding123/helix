-- Phase 8: LLM-First Intelligence Layer - Operation Registration
-- Created: 2026-02-04
-- Purpose: Register 9 intelligence operations in the unified AI router (Phase 0.5)
-- Note: All operations route through AIOperationRouter, not separate infrastructure

-- ============================================================================
-- PHASE 8 INTELLIGENCE OPERATIONS REGISTRATION
-- ============================================================================
-- 9 new operations added to ai_model_routes table:
-- Email Intelligence (3 ops), Calendar Intelligence (2 ops),
-- Task Intelligence (2 ops), Analytics Intelligence (2 ops)

-- Email Intelligence: Composition assistance
INSERT INTO ai_model_routes (operation_id, operation_name, primary_model, fallback_model, enabled, cost_criticality)
VALUES (
  'email-compose',
  'Email Composition Assistance',
  'deepseek',
  'gemini_flash',
  true,
  'LOW'  -- ~0.0015 USD per call
);

-- Email Intelligence: Classification + metadata extraction
INSERT INTO ai_model_routes (operation_id, operation_name, primary_model, fallback_model, enabled, cost_criticality)
VALUES (
  'email-classify',
  'Email Classification & Metadata',
  'deepseek',
  'gemini_flash',
  true,
  'LOW'  -- ~0.0006 USD per call
);

-- Email Intelligence: Response suggestions
INSERT INTO ai_model_routes (operation_id, operation_name, primary_model, fallback_model, enabled, cost_criticality)
VALUES (
  'email-respond',
  'Email Response Suggestions',
  'deepseek',
  'gemini_flash',
  true,
  'LOW'  -- ~0.0012 USD per call
);

-- Calendar Intelligence: Meeting preparation (30 min before event)
INSERT INTO ai_model_routes (operation_id, operation_name, primary_model, fallback_model, enabled, cost_criticality)
VALUES (
  'calendar-prep',
  'Meeting Preparation Generator',
  'deepseek',
  'gemini_flash',
  true,
  'LOW'  -- ~0.0025 USD per call
);

-- Calendar Intelligence: Optimal meeting time suggestions
INSERT INTO ai_model_routes (operation_id, operation_name, primary_model, fallback_model, enabled, cost_criticality)
VALUES (
  'calendar-time',
  'Optimal Meeting Time Suggestions',
  'gemini_flash',
  'deepseek',
  true,
  'LOW'  -- ~0.0080 USD per call
);

-- Task Intelligence: AI-powered task prioritization
INSERT INTO ai_model_routes (operation_id, operation_name, primary_model, fallback_model, enabled, cost_criticality)
VALUES (
  'task-prioritize',
  'Task Prioritization & Reordering',
  'deepseek',
  'gemini_flash',
  true,
  'LOW'  -- ~0.0018 USD per call
);

-- Task Intelligence: Subtask breakdown & expansion
INSERT INTO ai_model_routes (operation_id, operation_name, primary_model, fallback_model, enabled, cost_criticality)
VALUES (
  'task-breakdown',
  'Task Breakdown & Subtask Generation',
  'deepseek',
  'gemini_flash',
  true,
  'LOW'  -- ~0.0012 USD per call
);

-- Analytics Intelligence: Weekly Sunday 6pm summaries
INSERT INTO ai_model_routes (operation_id, operation_name, primary_model, fallback_model, enabled, cost_criticality)
VALUES (
  'analytics-summary',
  'Weekly Analytics Summary',
  'gemini_flash',
  'deepseek',
  true,
  'MEDIUM'  -- ~0.0300 USD per call (larger analysis)
);

-- Analytics Intelligence: Anomaly detection in patterns
INSERT INTO ai_model_routes (operation_id, operation_name, primary_model, fallback_model, enabled, cost_criticality)
VALUES (
  'analytics-anomaly',
  'Analytics Pattern Anomaly Detection',
  'deepseek',
  'gemini_flash',
  true,
  'LOW'  -- ~0.0009 USD per call
);

-- ============================================================================
-- VERIFICATION VIEW: Phase 8 Operations Status
-- ============================================================================
-- Query this to verify Phase 8 operations are correctly registered:
-- SELECT * FROM ai_model_routes WHERE operation_id LIKE '%-compose' OR operation_id LIKE '%-prep' OR operation_id LIKE '%-time' OR operation_id LIKE '%-prioritize' OR operation_id LIKE '%-breakdown' OR operation_id LIKE '%-summary' OR operation_id LIKE '%-anomaly' OR operation_id LIKE 'email-%' OR operation_id LIKE 'calendar-%' OR operation_id LIKE 'task-%' OR operation_id LIKE 'analytics-%';

-- ============================================================================
-- PHASE 8 COST ESTIMATES (for reference, calculated from model costs)
-- ============================================================================
-- Email Compose:      0.0015 USD/call × 10/day = 0.015 USD/day
-- Email Classify:     0.0006 USD/call × 20/day = 0.012 USD/day
-- Email Respond:      0.0012 USD/call × 5/day  = 0.006 USD/day
-- Calendar Prep:      0.0025 USD/call × 5/day  = 0.0125 USD/day
-- Calendar Time:      0.0080 USD/call × 3/day  = 0.024 USD/day
-- Task Prioritize:    0.0018 USD/call × 2/day  = 0.0036 USD/day
-- Task Breakdown:     0.0012 USD/call × 2/day  = 0.0024 USD/day
-- Analytics Summary:  0.0300 USD/call × 1/wk   = 0.004 USD/day
-- Analytics Anomaly:  0.0009 USD/call × 1/wk   = 0.0013 USD/day
-- TOTAL DAILY:        ~0.08 USD/day = ~2.40 USD/month
-- TOTAL WITH PLATFORM: ~3.00 USD/month per user

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- 1. Verify Phase 8 operations are enabled in ai_model_routes
-- 2. Deploy Phase 8 intelligence service modules
-- 3. Build web/iOS/Android UI for each operation
-- 4. Create feature toggles for Phase 8 features
-- 5. Test routing through AIOperationRouter with Phase 8 operations
-- 6. Monitor costs via ai_operation_log and v_daily_cost_summary view
