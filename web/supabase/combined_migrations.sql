-- =====================================================
-- HELIX OBSERVATORY - COMBINED DATABASE MIGRATIONS
-- =====================================================
-- Generated: 2026-01-31
-- Supabase Project: https://ncygunbukmpwhtzwbnvp.supabase.co
--
-- This script combines all migrations (001-005) in order.
-- Run this in the Supabase SQL Editor to set up the complete schema.
-- =====================================================


-- #####################################################
-- MIGRATION 001: INITIAL SCHEMA
-- #####################################################
-- Core tables: subscriptions, api_keys, instances, snapshots
-- #####################################################

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- SUBSCRIPTION TIERS
-- =====================================================

CREATE TYPE subscription_tier AS ENUM (
  'Free',           -- Telemetry on, basic dashboard
  'Phantom',          -- $9/mo - Telemetry off, privacy
  'Overseer',    -- $29/mo - View aggregate data
  'Architect' -- $99/mo - API access, exports, research tools
);

-- =====================================================
-- SUBSCRIPTIONS TABLE
-- =====================================================

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  tier subscription_tier DEFAULT 'Free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- API KEYS TABLE (Pro Tier)
-- =====================================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT,
  permissions JSONB DEFAULT '["read"]',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- HELIX INSTANCES TABLE
-- =====================================================

CREATE TABLE instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,

  -- Identity
  name TEXT NOT NULL,
  instance_key TEXT UNIQUE NOT NULL,

  -- Configuration snapshot (no sensitive data)
  soul_hash TEXT,
  psychology_summary JSONB,

  -- Status
  ghost_mode BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  version TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ,
  last_transformation TIMESTAMPTZ
);

-- =====================================================
-- INSTANCE SNAPSHOTS TABLE
-- =====================================================

CREATE TABLE instance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES instances NOT NULL,
  soul_hash TEXT,
  psychology_summary JSONB,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES (Migration 001)
-- =====================================================

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_instances_user ON instances(user_id);
CREATE INDEX idx_instances_key ON instances(instance_key);
CREATE INDEX idx_instance_snapshots_instance ON instance_snapshots(instance_id);

-- =====================================================
-- TRIGGERS (Migration 001)
-- =====================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-create subscription for new users
CREATE OR REPLACE FUNCTION create_subscription_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, tier)
  VALUES (NEW.id, 'Free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_subscription_for_user();


-- #####################################################
-- MIGRATION 002: TELEMETRY TABLES
-- #####################################################
-- Tables: telemetry, heartbeats, transformations
-- #####################################################

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

  -- Indexing (using UTC timezone for immutability)
  event_date DATE GENERATED ALWAYS AS ((server_timestamp AT TIME ZONE 'UTC')::DATE) STORED
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


-- #####################################################
-- MIGRATION 003: STATISTICS & AGGREGATES TABLES
-- #####################################################
-- Tables: anomalies, daily_stats, hourly_stats, global_counters
-- #####################################################

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
-- FUNCTION: Increment counter (Migration 003 version)
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
-- FUNCTION: Get live stats (Migration 003 version)
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


-- #####################################################
-- MIGRATION 004: ROW LEVEL SECURITY POLICIES
-- #####################################################
-- RLS policies for all tables
-- #####################################################

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE instance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformations ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SUBSCRIPTIONS POLICIES
-- =====================================================

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- API KEYS POLICIES
-- =====================================================

CREATE POLICY "Users can view own api_keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api_keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own api_keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- INSTANCES POLICIES
-- =====================================================

CREATE POLICY "Users can view own instances"
  ON instances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own instances"
  ON instances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instances"
  ON instances FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own instances"
  ON instances FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- INSTANCE SNAPSHOTS POLICIES
-- =====================================================

CREATE POLICY "Users can view own instance snapshots"
  ON instance_snapshots FOR SELECT
  USING (
    instance_id IN (
      SELECT id FROM instances WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- TELEMETRY POLICIES
-- =====================================================

-- Anyone can insert telemetry (instances send data)
CREATE POLICY "Instances can insert telemetry"
  ON telemetry FOR INSERT
  WITH CHECK (true);

-- Users can only read telemetry for their own instances
CREATE POLICY "Users can view own instance telemetry"
  ON telemetry FOR SELECT
  USING (
    instance_key IN (
      SELECT instance_key FROM instances WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- HEARTBEATS POLICIES
-- =====================================================

-- Anyone can insert heartbeats
CREATE POLICY "Instances can insert heartbeats"
  ON heartbeats FOR INSERT
  WITH CHECK (true);

-- Users can view their own instance heartbeats
CREATE POLICY "Users can view own instance heartbeats"
  ON heartbeats FOR SELECT
  USING (
    instance_key IN (
      SELECT instance_key FROM instances WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- TRANSFORMATIONS POLICIES
-- =====================================================

-- Anyone can insert transformations
CREATE POLICY "Instances can insert transformations"
  ON transformations FOR INSERT
  WITH CHECK (true);

-- Users can view their own instance transformations
CREATE POLICY "Users can view own instance transformations"
  ON transformations FOR SELECT
  USING (
    instance_key IN (
      SELECT instance_key FROM instances WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- ANOMALIES POLICIES
-- =====================================================

-- Users can view anomalies for their instances or global anomalies
CREATE POLICY "Users can view own or global anomalies"
  ON anomalies FOR SELECT
  USING (
    instance_key IS NULL  -- Global anomalies
    OR instance_key IN (
      SELECT instance_key FROM instances WHERE user_id = auth.uid()
    )
  );

-- Users can acknowledge their own anomalies
CREATE POLICY "Users can update own anomalies"
  ON anomalies FOR UPDATE
  USING (
    instance_key IN (
      SELECT instance_key FROM instances WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- PUBLIC READ FOR STATS (Observatory feature)
-- =====================================================

-- Daily stats are public read (aggregate data only)
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily stats"
  ON daily_stats FOR SELECT
  USING (true);

-- Hourly stats are public read
ALTER TABLE hourly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hourly stats"
  ON hourly_stats FOR SELECT
  USING (true);

-- Global counters are public read
ALTER TABLE global_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view global counters"
  ON global_counters FOR SELECT
  USING (true);


-- #####################################################
-- MIGRATION 005: DATABASE FUNCTIONS
-- #####################################################
-- Advanced functions for stats, cleanup, and anomaly detection
-- #####################################################

-- =====================================================
-- INCREMENT COUNTER FUNCTION (Migration 005 version)
-- =====================================================

-- Function to atomically increment a global counter
-- Note: This replaces the Migration 003 version with upsert support
DROP FUNCTION IF EXISTS increment_counter(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION increment_counter(counter_name TEXT, increment_value INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  INSERT INTO global_counters (id, value, updated_at)
  VALUES (counter_name, increment_value, NOW())
  ON CONFLICT (id)
  DO UPDATE SET
    value = global_counters.value + increment_value,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GET LIVE STATS FUNCTION (Migration 005 version)
-- =====================================================

-- Function to get real-time observatory stats
-- Note: This replaces the Migration 003 version with more detailed stats
DROP FUNCTION IF EXISTS get_live_stats();
CREATE OR REPLACE FUNCTION get_live_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'activeInstances', (
      SELECT COUNT(*) FROM instances
      WHERE is_active = TRUE
      AND last_seen > NOW() - INTERVAL '5 minutes'
    ),
    'totalTransformations', (
      SELECT COALESCE(value, 0) FROM global_counters
      WHERE id = 'total_transformations'
    ),
    'eventsToday', (
      SELECT COUNT(*) FROM telemetry
      WHERE server_timestamp::date = CURRENT_DATE
    ),
    'heartbeatsPerMinute', (
      SELECT COUNT(*) FROM heartbeats
      WHERE received_at > NOW() - INTERVAL '1 minute'
    ),
    'totalInstances', (
      SELECT COUNT(*) FROM instances
    ),
    'totalUsers', (
      SELECT COUNT(*) FROM subscriptions
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATE HOURLY STATS FUNCTION
-- =====================================================

-- Function to update hourly stats (called by cron job)
CREATE OR REPLACE FUNCTION update_hourly_stats()
RETURNS VOID AS $$
BEGIN
  INSERT INTO hourly_stats (hour, active_instances, heartbeats, sessions_started, transformations)
  SELECT
    date_trunc('hour', NOW()),
    (SELECT COUNT(*) FROM instances WHERE is_active = TRUE),
    (SELECT COUNT(*) FROM heartbeats WHERE received_at > NOW() - INTERVAL '1 hour'),
    (SELECT COUNT(*) FROM telemetry WHERE event_type = 'session_start' AND server_timestamp > NOW() - INTERVAL '1 hour'),
    (SELECT COUNT(*) FROM transformations WHERE created_at > NOW() - INTERVAL '1 hour')
  ON CONFLICT (hour)
  DO UPDATE SET
    active_instances = EXCLUDED.active_instances,
    heartbeats = EXCLUDED.heartbeats,
    sessions_started = EXCLUDED.sessions_started,
    transformations = EXCLUDED.transformations;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATE DAILY STATS FUNCTION
-- =====================================================

-- Function to update daily stats (called by cron job)
CREATE OR REPLACE FUNCTION update_daily_stats()
RETURNS VOID AS $$
BEGIN
  INSERT INTO daily_stats (date, total_instances, active_instances, transformations, total_heartbeats)
  SELECT
    CURRENT_DATE,
    (SELECT COUNT(*) FROM instances),
    (SELECT COUNT(DISTINCT instance_key) FROM telemetry WHERE server_timestamp::date = CURRENT_DATE),
    (SELECT COUNT(*) FROM transformations WHERE created_at::date = CURRENT_DATE),
    (SELECT COUNT(*) FROM heartbeats WHERE received_at::date = CURRENT_DATE)
  ON CONFLICT (date)
  DO UPDATE SET
    total_instances = EXCLUDED.total_instances,
    active_instances = EXCLUDED.active_instances,
    transformations = EXCLUDED.transformations,
    total_heartbeats = EXCLUDED.total_heartbeats,
    computed_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CLEANUP OLD TELEMETRY FUNCTION
-- =====================================================

-- Function to clean up old telemetry based on subscription tier
CREATE OR REPLACE FUNCTION cleanup_old_telemetry()
RETURNS VOID AS $$
BEGIN
  -- Delete telemetry older than retention period
  -- Free: No telemetry stored
  -- Phantom: 7 days
  -- Overseer: 30 days
  -- Architect: 365 days

  DELETE FROM telemetry t
  WHERE t.server_timestamp < NOW() - INTERVAL '365 days';

  -- For specific tiers, delete based on user's subscription
  DELETE FROM telemetry t
  WHERE t.instance_key IN (
    SELECT i.instance_key FROM instances i
    JOIN subscriptions s ON i.user_id = s.user_id
    WHERE s.tier = 'Phantom' AND t.server_timestamp < NOW() - INTERVAL '7 days'
  );

  DELETE FROM telemetry t
  WHERE t.instance_key IN (
    SELECT i.instance_key FROM instances i
    JOIN subscriptions s ON i.user_id = s.user_id
    WHERE s.tier = 'Overseer' AND t.server_timestamp < NOW() - INTERVAL '30 days'
  );

  -- Clean up old heartbeats (keep only 24 hours)
  DELETE FROM heartbeats WHERE received_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DETECT ANOMALIES FUNCTION
-- =====================================================

-- Function to detect anomalies in telemetry
CREATE OR REPLACE FUNCTION detect_anomalies()
RETURNS VOID AS $$
BEGIN
  -- Detect instances that stopped sending heartbeats
  INSERT INTO anomalies (instance_key, anomaly_type, severity, description)
  SELECT
    i.instance_key,
    'missed_heartbeat',
    'warning',
    'Instance has not sent a heartbeat in over 5 minutes'
  FROM instances i
  WHERE i.is_active = TRUE
    AND i.last_seen < NOW() - INTERVAL '5 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM anomalies a
      WHERE a.instance_key = i.instance_key
        AND a.anomaly_type = 'missed_heartbeat'
        AND a.acknowledged_at IS NULL
    );

  -- Update instance status to inactive
  UPDATE instances SET is_active = FALSE
  WHERE is_active = TRUE AND last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- END OF COMBINED MIGRATIONS
-- =====================================================
-- Total tables created: 10
--   - subscriptions
--   - api_keys
--   - instances
--   - instance_snapshots
--   - telemetry
--   - heartbeats
--   - transformations
--   - anomalies
--   - daily_stats
--   - hourly_stats
--   - global_counters
--
-- Total functions created: 9
--   - update_updated_at()
--   - create_subscription_for_user()
--   - update_instance_last_seen()
--   - increment_counter()
--   - get_live_stats()
--   - update_hourly_stats()
--   - update_daily_stats()
--   - cleanup_old_telemetry()
--   - detect_anomalies()
--
-- Total triggers created: 3
--   - subscriptions_updated_at
--   - on_user_created
--   - on_heartbeat_update_instance
--
-- RLS enabled on all tables with appropriate policies
-- =====================================================
