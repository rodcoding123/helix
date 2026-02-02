-- Phase 3: Custom Tools System
CREATE TABLE IF NOT EXISTS custom_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  parameters JSONB NOT NULL,
  code TEXT NOT NULL,
  signature TEXT,
  capabilities TEXT[],
  sandbox_profile TEXT DEFAULT 'standard' CHECK (sandbox_profile IN ('strict', 'standard', 'permissive')),
  version TEXT DEFAULT '1.0.0',
  tags TEXT[],
  icon TEXT,
  usage_count INT DEFAULT 0,
  last_used TIMESTAMP,
  is_enabled BOOLEAN DEFAULT TRUE,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  clone_source_id UUID REFERENCES custom_tools(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_tools_user_id ON custom_tools(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_tools_visibility ON custom_tools(visibility);
CREATE INDEX IF NOT EXISTS idx_custom_tools_enabled ON custom_tools(is_enabled);

ALTER TABLE custom_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS custom_tools_user_access ON custom_tools FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS custom_tools_public_read ON custom_tools FOR SELECT USING (visibility = 'public');

-- Tool Usage Log
CREATE TABLE IF NOT EXISTS custom_tool_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_tool_id UUID NOT NULL REFERENCES custom_tools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_params JSONB,
  output_result JSONB,
  status TEXT CHECK (status IN ('success', 'failure', 'timeout')),
  error_message TEXT,
  execution_time_ms INT,
  memory_used_mb INT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_usage_tool_id ON custom_tool_usage(custom_tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_user_id ON custom_tool_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_timestamp ON custom_tool_usage(timestamp DESC);

ALTER TABLE custom_tool_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS tool_usage_user_access ON custom_tool_usage FOR ALL USING (auth.uid() = user_id);

-- Phase 3: Composite Skills System
CREATE TABLE IF NOT EXISTS composite_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  steps JSONB NOT NULL,
  version TEXT DEFAULT '1.0.0',
  tags TEXT[],
  icon TEXT,
  execution_count INT DEFAULT 0,
  last_executed TIMESTAMP,
  is_enabled BOOLEAN DEFAULT TRUE,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_composite_skills_user_id ON composite_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_composite_skills_visibility ON composite_skills(visibility);
CREATE INDEX IF NOT EXISTS idx_composite_skills_enabled ON composite_skills(is_enabled);

ALTER TABLE composite_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS composite_skills_user_access ON composite_skills FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS composite_skills_public_read ON composite_skills FOR SELECT USING (visibility = 'public');

-- Composite Skill Executions
CREATE TABLE IF NOT EXISTS composite_skill_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composite_skill_id UUID NOT NULL REFERENCES composite_skills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_params JSONB NOT NULL,
  steps_executed JSONB,
  final_output JSONB,
  status TEXT DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  execution_time_ms INT,
  steps_completed INT,
  total_steps INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_executions_skill_id ON composite_skill_executions(composite_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_user_id ON composite_skill_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_created_at ON composite_skill_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_executions_status ON composite_skill_executions(status);

ALTER TABLE composite_skill_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS skill_executions_user_access ON composite_skill_executions FOR ALL USING (auth.uid() = user_id);

-- Phase 3: Memory Synthesis System
CREATE TABLE IF NOT EXISTS memory_synthesis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  synthesis_type TEXT NOT NULL CHECK (synthesis_type IN (
    'emotional_patterns',
    'prospective_self',
    'relational_memory',
    'narrative_coherence',
    'full_synthesis'
  )),
  time_range_start TIMESTAMP,
  time_range_end TIMESTAMP,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress FLOAT DEFAULT 0,
  error_message TEXT,
  insights JSONB,
  memories_analyzed INT,
  patterns_detected INT,
  is_recurring BOOLEAN DEFAULT FALSE,
  cron_schedule TEXT,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_synthesis_jobs_user_id ON memory_synthesis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_jobs_status ON memory_synthesis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_synthesis_jobs_updated_at ON memory_synthesis_jobs(updated_at DESC);

ALTER TABLE memory_synthesis_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS synthesis_jobs_user_access ON memory_synthesis_jobs FOR ALL USING (auth.uid() = user_id);

-- Detected Memory Patterns
CREATE TABLE IF NOT EXISTS memory_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  layer INT NOT NULL CHECK (layer >= 1 AND layer <= 7),
  description TEXT NOT NULL,
  evidence JSONB,
  confidence FLOAT,
  first_detected TIMESTAMP,
  last_observed TIMESTAMP,
  observation_count INT DEFAULT 1,
  user_confirmed BOOLEAN,
  user_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_patterns_user_id ON memory_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_patterns_layer ON memory_patterns(layer);
CREATE INDEX IF NOT EXISTS idx_memory_patterns_type ON memory_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_memory_patterns_confidence ON memory_patterns(confidence DESC);

ALTER TABLE memory_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS memory_patterns_user_access ON memory_patterns FOR ALL USING (auth.uid() = user_id);

-- Synthesis Recommendations
CREATE TABLE IF NOT EXISTS synthesis_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES memory_patterns(id) ON DELETE CASCADE,
  recommendation TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'working_on', 'completed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON synthesis_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_pattern_id ON synthesis_recommendations(pattern_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON synthesis_recommendations(status);

ALTER TABLE synthesis_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS recommendations_user_access ON synthesis_recommendations FOR ALL USING (auth.uid() = user_id);
