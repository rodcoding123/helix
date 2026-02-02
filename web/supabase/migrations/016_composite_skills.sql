-- Phase 3: Composite Skills System
-- Enables users to chain multiple tools into reusable workflows

CREATE TABLE composite_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Skill Definition
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  steps JSONB NOT NULL,  -- Array of step definitions with tool config

  -- Metadata
  version TEXT DEFAULT '1.0.0',
  tags TEXT[],
  icon TEXT,
  execution_count INT DEFAULT 0,
  last_executed TIMESTAMP,
  is_enabled BOOLEAN DEFAULT TRUE,

  -- Sharing
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public')),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_composite_skills_user_id ON composite_skills(user_id);
CREATE INDEX idx_composite_skills_visibility ON composite_skills(visibility);
CREATE INDEX idx_composite_skills_enabled ON composite_skills(is_enabled);

ALTER TABLE composite_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY composite_skills_user_access ON composite_skills FOR ALL USING (auth.uid() = user_id);
CREATE POLICY composite_skills_public_read ON composite_skills FOR SELECT USING (visibility = 'public');

-- Composite Skill Executions
CREATE TABLE composite_skill_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composite_skill_id UUID NOT NULL REFERENCES composite_skills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Execution Details
  input_params JSONB NOT NULL,
  steps_executed JSONB,          -- Array of step results with outputs
  final_output JSONB,
  status TEXT DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  error_message TEXT,

  -- Metrics
  execution_time_ms INT,
  steps_completed INT,
  total_steps INT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_skill_executions_skill_id ON composite_skill_executions(composite_skill_id);
CREATE INDEX idx_skill_executions_user_id ON composite_skill_executions(user_id);
CREATE INDEX idx_skill_executions_created_at ON composite_skill_executions(created_at DESC);
CREATE INDEX idx_skill_executions_status ON composite_skill_executions(status);

ALTER TABLE composite_skill_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY skill_executions_user_access ON composite_skill_executions FOR ALL USING (auth.uid() = user_id);
