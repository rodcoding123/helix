-- Migration: Layer 5 - Integration Rhythms
-- Purpose: Database schema for memory consolidation, pattern synthesis, and integration jobs
-- Date: 2026-02-02

-- Synthesis jobs table
CREATE TABLE IF NOT EXISTS synthesis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  job_type VARCHAR(50) NOT NULL DEFAULT 'consolidation',
  -- Types: consolidation, pattern_synthesis, fadeout, full_integration

  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Status: pending, running, completed, failed

  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  patterns_detected JSONB DEFAULT '[]',
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_synthesis_jobs_user_id ON synthesis_jobs(user_id);
CREATE INDEX idx_synthesis_jobs_status ON synthesis_jobs(status);
CREATE INDEX idx_synthesis_jobs_created_at ON synthesis_jobs(created_at DESC);

-- Memory patterns table
CREATE TABLE IF NOT EXISTS memory_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  pattern_id VARCHAR(255) NOT NULL,
  pattern_type VARCHAR(100) NOT NULL,
  -- Types: emotional_trigger, relational_pattern, prospective_fear,
  -- prospective_possibility, transformation_trajectory, purpose_alignment

  description TEXT NOT NULL,
  confidence FLOAT DEFAULT 0.5, -- 0-1
  salience FLOAT DEFAULT 0.5, -- 0-1, how important

  evidence TEXT[] DEFAULT '{}', -- Memory IDs supporting this pattern
  recommendations TEXT[] DEFAULT '{}', -- Suggestions based on pattern

  first_detected TIMESTAMP WITH TIME ZONE,
  last_confirmed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_pattern_per_user UNIQUE(user_id, pattern_id)
);

CREATE INDEX idx_memory_patterns_user_id ON memory_patterns(user_id);
CREATE INDEX idx_memory_patterns_type ON memory_patterns(pattern_type);
CREATE INDEX idx_memory_patterns_confidence ON memory_patterns(confidence DESC);
CREATE INDEX idx_memory_patterns_salience ON memory_patterns(salience DESC);

-- Integration rhythms table (user-specific settings)
CREATE TABLE IF NOT EXISTS integration_rhythms (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  last_consolidation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synthesis TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_fadeout TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  consolidation_interval_ms INTEGER DEFAULT 21600000, -- 6 hours
  synthesis_interval_ms INTEGER DEFAULT 86400000, -- 24 hours
  fadeout_threshold_days INTEGER DEFAULT 90,

  patterns_count INTEGER DEFAULT 0,
  patterns_updated_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_integration_rhythms_updated_at ON integration_rhythms(updated_at DESC);

-- Scheduled synthesis jobs table (for cron-like scheduling)
CREATE TABLE IF NOT EXISTS scheduled_synthesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  synthesis_type VARCHAR(50) NOT NULL,
  -- Types: daily_consolidation, weekly_analysis, monthly_review

  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  last_run TIMESTAMP WITH TIME ZONE,

  is_active BOOLEAN DEFAULT true,
  run_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scheduled_synthesis_user_id ON scheduled_synthesis(user_id);
CREATE INDEX idx_scheduled_synthesis_scheduled_for ON scheduled_synthesis(scheduled_for);
CREATE INDEX idx_scheduled_synthesis_is_active ON scheduled_synthesis(is_active);

-- Enable RLS
ALTER TABLE synthesis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_rhythms ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_synthesis ENABLE ROW LEVEL SECURITY;

-- RLS Policies - synthesis_jobs
CREATE POLICY "Users can view their own synthesis jobs"
  ON synthesis_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own synthesis jobs"
  ON synthesis_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own synthesis jobs"
  ON synthesis_jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies - memory_patterns
CREATE POLICY "Users can view their own patterns"
  ON memory_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patterns"
  ON memory_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patterns"
  ON memory_patterns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patterns"
  ON memory_patterns FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies - integration_rhythms
CREATE POLICY "Users can view their own rhythm"
  ON integration_rhythms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rhythm"
  ON integration_rhythms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rhythm"
  ON integration_rhythms FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies - scheduled_synthesis
CREATE POLICY "Users can view their own scheduled jobs"
  ON scheduled_synthesis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own scheduled jobs"
  ON scheduled_synthesis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their scheduled jobs"
  ON scheduled_synthesis FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_synthesis_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER synthesis_jobs_updated_at_trigger
BEFORE UPDATE ON synthesis_jobs
FOR EACH ROW
EXECUTE FUNCTION update_synthesis_jobs_updated_at();

CREATE OR REPLACE FUNCTION update_memory_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_patterns_updated_at_trigger
BEFORE UPDATE ON memory_patterns
FOR EACH ROW
EXECUTE FUNCTION update_memory_patterns_updated_at();

CREATE OR REPLACE FUNCTION update_integration_rhythms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integration_rhythms_updated_at_trigger
BEFORE UPDATE ON integration_rhythms
FOR EACH ROW
EXECUTE FUNCTION update_integration_rhythms_updated_at();

-- Seed integration rhythm for existing users (optional)
INSERT INTO integration_rhythms (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
