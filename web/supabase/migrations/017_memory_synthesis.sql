-- Phase 3: Memory Synthesis System
-- Enables automated psychological layer analysis and pattern detection

CREATE TABLE memory_synthesis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job Configuration
  synthesis_type TEXT NOT NULL CHECK (synthesis_type IN (
    'emotional_patterns',
    'prospective_self',
    'relational_memory',
    'narrative_coherence',
    'full_synthesis'
  )),
  time_range_start TIMESTAMP,
  time_range_end TIMESTAMP,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress FLOAT DEFAULT 0,       -- 0-1
  error_message TEXT,

  -- Results
  insights JSONB,                 -- Synthesis output
  memories_analyzed INT,
  patterns_detected INT,

  -- Scheduling
  is_recurring BOOLEAN DEFAULT FALSE,
  cron_schedule TEXT,             -- e.g., "0 2 * * *" for daily at 2 AM
  last_run TIMESTAMP,
  next_run TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_synthesis_jobs_user_id ON memory_synthesis_jobs(user_id);
CREATE INDEX idx_synthesis_jobs_status ON memory_synthesis_jobs(status);
CREATE INDEX idx_synthesis_jobs_updated_at ON memory_synthesis_jobs(updated_at DESC);

ALTER TABLE memory_synthesis_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthesis_jobs_user_access ON memory_synthesis_jobs FOR ALL USING (auth.uid() = user_id);

-- Detected Memory Patterns
CREATE TABLE memory_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Pattern Classification
  pattern_type TEXT NOT NULL,     -- 'emotional_trigger', 'goal_theme', 'relationship_dynamic', etc.
  layer INT NOT NULL CHECK (layer >= 1 AND layer <= 7),  -- Which psychological layer

  -- Pattern Details
  description TEXT NOT NULL,
  evidence JSONB,                 -- Array of conversation IDs that support this pattern
  confidence FLOAT,               -- 0-1 confidence score
  first_detected TIMESTAMP,
  last_observed TIMESTAMP,
  observation_count INT DEFAULT 1,

  -- User Interaction
  user_confirmed BOOLEAN,
  user_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_memory_patterns_user_id ON memory_patterns(user_id);
CREATE INDEX idx_memory_patterns_layer ON memory_patterns(layer);
CREATE INDEX idx_memory_patterns_type ON memory_patterns(pattern_type);
CREATE INDEX idx_memory_patterns_confidence ON memory_patterns(confidence DESC);

ALTER TABLE memory_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY memory_patterns_user_access ON memory_patterns FOR ALL USING (auth.uid() = user_id);

-- Synthesis Recommendations
CREATE TABLE synthesis_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES memory_patterns(id) ON DELETE CASCADE,

  -- Recommendation Details
  recommendation TEXT NOT NULL,
  category TEXT NOT NULL,         -- 'psychological', 'behavioral', 'relational', 'growth'
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'working_on', 'completed')),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recommendations_user_id ON synthesis_recommendations(user_id);
CREATE INDEX idx_recommendations_pattern_id ON synthesis_recommendations(pattern_id);
CREATE INDEX idx_recommendations_status ON synthesis_recommendations(status);

ALTER TABLE synthesis_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY recommendations_user_access ON synthesis_recommendations FOR ALL USING (auth.uid() = user_id);
