-- =====================================================
-- HELIX OBSERVATORY DATABASE SCHEMA
-- Migration 003: Statistics & Aggregates Tables
-- =====================================================

-- =====================================================
-- ANOMALIES TABLE
-- =====================================================

CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_key TEXT,

  -- Classification
  anomaly_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),

  -- Details
  description TEXT,
  pattern_data JSONB,

  -- Resolution
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES auth.users,
  acknowledged_at TIMESTAMPTZ,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anomalies_instance ON anomalies(instance_key, created_at DESC);
CREATE INDEX idx_anomalies_severity ON anomalies(severity, created_at DESC);

-- =====================================================
-- DAILY STATS TABLE
-- =====================================================

CREATE TABLE daily_stats (
  date DATE PRIMARY KEY,

  -- Counts
  total_instances INTEGER DEFAULT 0,
  active_instances INTEGER DEFAULT 0,
  new_instances INTEGER DEFAULT 0,
  ghost_instances INTEGER DEFAULT 0,

  -- Activity
  total_sessions INTEGER DEFAULT 0,
  total_heartbeats INTEGER DEFAULT 0,
  avg_session_duration_seconds FLOAT,

  -- Events
  transformations INTEGER DEFAULT 0,
  anomalies_info INTEGER DEFAULT 0,
  anomalies_warning INTEGER DEFAULT 0,
  anomalies_critical INTEGER DEFAULT 0,

  -- Psychology distribution snapshot
  enneagram_distribution JSONB,
  big_five_averages JSONB,

  -- Computed at
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- HOURLY STATS TABLE
-- =====================================================

CREATE TABLE hourly_stats (
  hour TIMESTAMPTZ PRIMARY KEY,

  active_instances INTEGER DEFAULT 0,
  heartbeats INTEGER DEFAULT 0,
  sessions_started INTEGER DEFAULT 0,
  sessions_ended INTEGER DEFAULT 0,
  transformations INTEGER DEFAULT 0,

  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- GLOBAL COUNTERS TABLE (for live counter)
-- =====================================================

CREATE TABLE global_counters (
  id TEXT PRIMARY KEY,
  value BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize counters
INSERT INTO global_counters (id, value) VALUES
  ('total_instances', 0),
  ('active_instances', 0),
  ('total_heartbeats', 0),
  ('total_sessions', 0),
  ('total_transformations', 0);

-- =====================================================
-- FUNCTION: Increment counter
-- =====================================================

CREATE OR REPLACE FUNCTION increment_counter(counter_id TEXT, amount INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  UPDATE global_counters
  SET value = value + amount, updated_at = NOW()
  WHERE id = counter_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Get live stats
-- =====================================================

CREATE OR REPLACE FUNCTION get_live_stats()
RETURNS TABLE (
  total_instances BIGINT,
  active_instances BIGINT,
  total_heartbeats BIGINT,
  total_sessions BIGINT,
  total_transformations BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT value FROM global_counters WHERE id = 'total_instances'),
    (SELECT value FROM global_counters WHERE id = 'active_instances'),
    (SELECT value FROM global_counters WHERE id = 'total_heartbeats'),
    (SELECT value FROM global_counters WHERE id = 'total_sessions'),
    (SELECT value FROM global_counters WHERE id = 'total_transformations');
END;
$$ LANGUAGE plpgsql;
