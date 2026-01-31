-- =====================================================
-- HELIX OBSERVATORY DATABASE SCHEMA
-- Migration 004: Row Level Security Policies
-- =====================================================

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
