-- =====================================================
-- HELIX OBSERVATORY DATABASE SCHEMA
-- Migration 005: Database Functions
-- =====================================================

-- =====================================================
-- INCREMENT COUNTER FUNCTION
-- =====================================================

-- Function to atomically increment a global counter
CREATE OR REPLACE FUNCTION increment_counter(counter_name TEXT, increment_value INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  INSERT INTO global_counters (name, value, updated_at)
  VALUES (counter_name, increment_value, NOW())
  ON CONFLICT (name)
  DO UPDATE SET
    value = global_counters.value + increment_value,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GET LIVE STATS FUNCTION
-- =====================================================

-- Function to get real-time observatory stats
CREATE OR REPLACE FUNCTION get_live_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'activeInstances', (
      SELECT COUNT(*) FROM instances
      WHERE status = 'online'
      AND last_seen > NOW() - INTERVAL '5 minutes'
    ),
    'totalTransformations', (
      SELECT COALESCE(value, 0) FROM global_counters
      WHERE name = 'total_transformations'
    ),
    'eventsToday', (
      SELECT COUNT(*) FROM telemetry
      WHERE timestamp::date = CURRENT_DATE
    ),
    'heartbeatsPerMinute', (
      SELECT COUNT(*) FROM heartbeats
      WHERE timestamp > NOW() - INTERVAL '1 minute'
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
  INSERT INTO hourly_stats (hour, active_instances, events_count, transformations_count)
  SELECT
    date_trunc('hour', NOW()),
    (SELECT COUNT(*) FROM instances WHERE status = 'online'),
    (SELECT COUNT(*) FROM telemetry WHERE timestamp > NOW() - INTERVAL '1 hour'),
    (SELECT COUNT(*) FROM transformations WHERE created_at > NOW() - INTERVAL '1 hour')
  ON CONFLICT (hour)
  DO UPDATE SET
    active_instances = EXCLUDED.active_instances,
    events_count = EXCLUDED.events_count,
    transformations_count = EXCLUDED.transformations_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATE DAILY STATS FUNCTION
-- =====================================================

-- Function to update daily stats (called by cron job)
CREATE OR REPLACE FUNCTION update_daily_stats()
RETURNS VOID AS $$
BEGIN
  INSERT INTO daily_stats (date, unique_instances, total_events, total_transformations, peak_active)
  SELECT
    CURRENT_DATE,
    (SELECT COUNT(DISTINCT instance_key) FROM telemetry WHERE timestamp::date = CURRENT_DATE),
    (SELECT COUNT(*) FROM telemetry WHERE timestamp::date = CURRENT_DATE),
    (SELECT COUNT(*) FROM transformations WHERE created_at::date = CURRENT_DATE),
    (SELECT MAX(active_instances) FROM hourly_stats WHERE hour::date = CURRENT_DATE)
  ON CONFLICT (date)
  DO UPDATE SET
    unique_instances = EXCLUDED.unique_instances,
    total_events = EXCLUDED.total_events,
    total_transformations = EXCLUDED.total_transformations,
    peak_active = EXCLUDED.peak_active;
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
  -- Ghost: 7 days
  -- Observatory: 30 days
  -- Observatory Pro: 365 days

  DELETE FROM telemetry t
  WHERE t.timestamp < NOW() - INTERVAL '365 days';

  -- For specific tiers, delete based on user's subscription
  DELETE FROM telemetry t
  WHERE t.instance_key IN (
    SELECT i.instance_key FROM instances i
    JOIN subscriptions s ON i.user_id = s.user_id
    WHERE s.tier = 'ghost' AND t.timestamp < NOW() - INTERVAL '7 days'
  );

  DELETE FROM telemetry t
  WHERE t.instance_key IN (
    SELECT i.instance_key FROM instances i
    JOIN subscriptions s ON i.user_id = s.user_id
    WHERE s.tier = 'observatory' AND t.timestamp < NOW() - INTERVAL '30 days'
  );

  -- Clean up old heartbeats (keep only 24 hours)
  DELETE FROM heartbeats WHERE timestamp < NOW() - INTERVAL '24 hours';
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
  WHERE i.status = 'online'
    AND i.last_seen < NOW() - INTERVAL '5 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM anomalies a
      WHERE a.instance_key = i.instance_key
        AND a.anomaly_type = 'missed_heartbeat'
        AND a.acknowledged_at IS NULL
    );

  -- Update instance status to offline
  UPDATE instances SET status = 'offline'
  WHERE status = 'online' AND last_seen < NOW() - INTERVAL '5 minutes';

  -- Detect hash chain breaks
  INSERT INTO anomalies (instance_key, anomaly_type, severity, description)
  SELECT DISTINCT
    t1.instance_key,
    'hash_chain_break',
    'critical',
    'Hash chain integrity violation detected'
  FROM telemetry t1
  JOIN telemetry t2 ON t1.instance_key = t2.instance_key
    AND t1.timestamp > t2.timestamp
    AND t1.previous_hash IS NOT NULL
    AND t1.previous_hash != t2.hash
  WHERE NOT EXISTS (
    SELECT 1 FROM anomalies a
    WHERE a.instance_key = t1.instance_key
      AND a.anomaly_type = 'hash_chain_break'
      AND a.created_at > NOW() - INTERVAL '1 hour'
  );
END;
$$ LANGUAGE plpgsql;
