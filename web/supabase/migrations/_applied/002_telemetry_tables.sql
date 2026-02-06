-- =====================================================
-- HELIX OBSERVATORY DATABASE SCHEMA
-- Migration 002: Telemetry Tables
-- =====================================================

-- =====================================================
-- EVENT TYPES
-- =====================================================

CREATE TYPE telemetry_event_type AS ENUM (
  'heartbeat',
  'session_start',
  'session_end',
  'transformation',
  'anomaly',
  'error',
  'boot',
  'shutdown'
);

-- =====================================================
-- RAW TELEMETRY TABLE
-- =====================================================

CREATE TABLE telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_key TEXT NOT NULL,
  event_type telemetry_event_type NOT NULL,

  -- Event data (anonymized, no content)
  event_data JSONB,

  -- Metadata
  client_timestamp TIMESTAMPTZ,
  server_timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Indexing
  event_date DATE GENERATED ALWAYS AS (DATE(server_timestamp)) STORED
);

-- Indexes for performance
CREATE INDEX idx_telemetry_date ON telemetry(event_date);
CREATE INDEX idx_telemetry_instance ON telemetry(instance_key, server_timestamp DESC);
CREATE INDEX idx_telemetry_type ON telemetry(event_type, server_timestamp DESC);

-- =====================================================
-- HEARTBEAT TRACKING TABLE
-- =====================================================

CREATE TABLE heartbeats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_key TEXT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  latency_ms INTEGER,
  metadata JSONB
);

CREATE INDEX idx_heartbeats_instance ON heartbeats(instance_key, received_at DESC);

-- =====================================================
-- TRANSFORMATIONS TABLE
-- =====================================================

CREATE TABLE transformations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_key TEXT NOT NULL,

  -- What changed
  transformation_type TEXT,
  from_state JSONB,
  to_state JSONB,

  -- Context
  trigger_category TEXT,
  session_count_before INTEGER,

  -- Analysis
  significance_score FLOAT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transformations_instance ON transformations(instance_key, created_at DESC);

-- =====================================================
-- TRIGGER: Update instance last_seen on heartbeat
-- =====================================================

CREATE OR REPLACE FUNCTION update_instance_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE instances
  SET last_seen = NOW()
  WHERE instance_key = NEW.instance_key;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_heartbeat_update_instance
  AFTER INSERT ON heartbeats
  FOR EACH ROW
  EXECUTE FUNCTION update_instance_last_seen();
