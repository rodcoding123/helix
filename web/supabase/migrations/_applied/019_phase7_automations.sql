-- Phase 7: Automations & Workflows
-- Creates tables for email triggers, meeting prep, and automation history

-- 1. automation_triggers table
-- Stores automation rules for email, calendar, and other triggers
CREATE TABLE IF NOT EXISTS automation_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'email_received', 'email_flag', 'calendar_event', 'task_created'
  )),
  condition JSONB NOT NULL,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_executed_at TIMESTAMP WITH TIME ZONE,
  execution_count INTEGER DEFAULT 0,

  CONSTRAINT automation_triggers_valid_condition CHECK (condition IS NOT NULL),
  CONSTRAINT automation_triggers_valid_actions CHECK (actions IS NOT NULL)
);

-- 2. automation_executions table
-- Audit log of all automation executions for tracking and debugging
CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_id UUID NOT NULL REFERENCES automation_triggers(id) ON DELETE CASCADE,
  trigger_data JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  result JSONB,
  error TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT automation_executions_valid_trigger CHECK (trigger_id IS NOT NULL)
);

-- 3. meeting_contexts table
-- Pre-calculated meeting preparation data for quick access
CREATE TABLE IF NOT EXISTS meeting_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  relevant_emails JSONB,
  action_items JSONB,
  prep_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT meeting_contexts_valid_event CHECK (event_id IS NOT NULL)
);

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_automation_triggers_user_enabled
  ON automation_triggers(user_id, enabled);

CREATE INDEX IF NOT EXISTS idx_automation_triggers_type
  ON automation_triggers(trigger_type);

CREATE INDEX IF NOT EXISTS idx_automation_triggers_updated
  ON automation_triggers(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_executions_trigger
  ON automation_executions(trigger_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_executions_status
  ON automation_executions(status);

CREATE INDEX IF NOT EXISTS idx_automation_executions_user
  ON automation_executions(user_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_contexts_user_event
  ON meeting_contexts(user_id, event_id);

CREATE INDEX IF NOT EXISTS idx_meeting_contexts_created
  ON meeting_contexts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_contexts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_triggers
DROP POLICY IF EXISTS "Users can view their own triggers" ON automation_triggers;
CREATE POLICY "Users can view their own triggers"
  ON automation_triggers FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own triggers" ON automation_triggers;
CREATE POLICY "Users can create their own triggers"
  ON automation_triggers FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own triggers" ON automation_triggers;
CREATE POLICY "Users can update their own triggers"
  ON automation_triggers FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own triggers" ON automation_triggers;
CREATE POLICY "Users can delete their own triggers"
  ON automation_triggers FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for automation_executions
DROP POLICY IF EXISTS "Users can view their own executions" ON automation_executions;
CREATE POLICY "Users can view their own executions"
  ON automation_executions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create execution records" ON automation_executions;
CREATE POLICY "Users can create execution records"
  ON automation_executions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for meeting_contexts
DROP POLICY IF EXISTS "Users can view their own meeting contexts" ON meeting_contexts;
CREATE POLICY "Users can view their own meeting contexts"
  ON meeting_contexts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create meeting contexts" ON meeting_contexts;
CREATE POLICY "Users can create meeting contexts"
  ON meeting_contexts FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own meeting contexts" ON meeting_contexts;
CREATE POLICY "Users can update their own meeting contexts"
  ON meeting_contexts FOR UPDATE
  USING (user_id = auth.uid());

-- Add updated_at trigger for automation_triggers
DROP TRIGGER IF EXISTS update_automation_triggers_updated_at ON automation_triggers;
CREATE TRIGGER update_automation_triggers_updated_at
  BEFORE UPDATE ON automation_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for meeting_contexts
DROP TRIGGER IF EXISTS update_meeting_contexts_updated_at ON meeting_contexts;
CREATE TRIGGER update_meeting_contexts_updated_at
  BEFORE UPDATE ON meeting_contexts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
