-- Real-Time Sync Infrastructure
-- Created: 2026-02-03
-- Purpose: Enable cross-platform, multi-device synchronization with conflict detection

-- ============================================================================
-- Sync Metadata Columns
-- ============================================================================

-- Add sync metadata to Email table
ALTER TABLE emails ADD COLUMN IF NOT EXISTS sync_meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add sync metadata to Calendar Events table
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS sync_meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add sync metadata to Tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sync_meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add sync metadata to Voice Memos (if exists)
ALTER TABLE IF EXISTS voice_memos ADD COLUMN IF NOT EXISTS sync_meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS voice_memos ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- ============================================================================
-- Sync Change Log Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_change_log (
  -- Primary key and tracking
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,

  -- Entity information
  entity_type TEXT NOT NULL CHECK (entity_type IN ('email', 'calendar_event', 'task', 'voice_memo')),
  entity_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),

  -- Change details
  changed_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  old_values JSONB,
  new_values JSONB,

  -- Vector clock for causality tracking
  vector_clock JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Hash chain for integrity
  parent_hash TEXT,
  content_hash TEXT NOT NULL,

  -- Conflict tracking
  conflict_id UUID,
  has_conflict BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_change_log_user_device ON sync_change_log(user_id, device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_entity ON sync_change_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_user_time ON sync_change_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_conflicts ON sync_change_log(has_conflict) WHERE has_conflict = true;

-- Enable Realtime for change log
ALTER PUBLICATION supabase_realtime ADD TABLE sync_change_log;

-- ============================================================================
-- Sync Conflicts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Conflicting entities
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  -- Conflict details
  local_change_id UUID REFERENCES sync_change_log(id) ON DELETE CASCADE,
  remote_change_id UUID REFERENCES sync_change_log(id) ON DELETE CASCADE,

  -- Conflict metadata
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('concurrent_modification', 'version_mismatch', 'field_conflict')),

  local_value JSONB,
  remote_value JSONB,

  -- Resolution
  resolution_strategy TEXT CHECK (resolution_strategy IN ('last_write_wins', 'three_way_merge', 'set_union', 'manual', 'automatic')),
  resolved_value JSONB,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by TEXT,

  -- Tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_user ON sync_conflicts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conflicts_entity ON sync_conflicts(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON sync_conflicts(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================================
-- Sync Presence Table (Device/Session Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'ios', 'android')),

  -- Session info
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'away', 'offline')),
  current_context TEXT,

  -- Device info
  app_version TEXT,
  os_version TEXT,

  -- Tracking
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient presence queries
CREATE INDEX IF NOT EXISTS idx_presence_user ON sync_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_presence_status ON sync_presence(status) WHERE status = 'online';

-- Enable Realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE sync_presence;

-- ============================================================================
-- Vector Clock Tracking (per device)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vector_clocks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,

  -- Vector clock state (JSON: {device_id: logical_timestamp})
  clock JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamp of last update
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  PRIMARY KEY (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_vector_clocks_user ON vector_clocks(user_id);

-- ============================================================================
-- Sync Statistics & Monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Sync metrics
  total_syncs INTEGER DEFAULT 0,
  successful_syncs INTEGER DEFAULT 0,
  failed_syncs INTEGER DEFAULT 0,

  total_changes_processed INTEGER DEFAULT 0,
  total_conflicts_detected INTEGER DEFAULT 0,
  total_conflicts_resolved INTEGER DEFAULT 0,

  -- Performance
  average_sync_time_ms FLOAT,
  p95_sync_time_ms FLOAT,

  -- Device info
  device_count INTEGER DEFAULT 0,
  last_device_sync TIMESTAMP WITH TIME ZONE,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_stats_user ON sync_statistics(user_id);

-- ============================================================================
-- Delta Generation Triggers
-- ============================================================================

-- Function to generate delta on INSERT/UPDATE
CREATE OR REPLACE FUNCTION generate_delta_change()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields JSONB := '[]'::jsonb;
  old_vals JSONB := NULL;
  new_vals JSONB := NULL;
BEGIN
  -- Calculate which fields changed (for UPDATE)
  IF TG_OP = 'UPDATE' THEN
    -- Store old and new values
    old_vals := to_jsonb(OLD);
    new_vals := to_jsonb(NEW);

    -- Find changed fields
    FOR key IN SELECT jsonb_object_keys(new_vals) LOOP
      IF COALESCE(old_vals->>key, '') IS DISTINCT FROM COALESCE(new_vals->>key, '') THEN
        changed_fields := changed_fields || jsonb_build_object(
          'field', key,
          'old_value', old_vals->key,
          'new_value', new_vals->key
        );
      END IF;
    END LOOP;
  ELSIF TG_OP = 'INSERT' THEN
    new_vals := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    old_vals := to_jsonb(OLD);
  END IF;

  -- Create change log entry
  INSERT INTO sync_change_log (
    user_id,
    device_id,
    entity_type,
    entity_id,
    operation,
    changed_fields,
    old_values,
    new_values,
    vector_clock,
    parent_hash,
    content_hash
  ) VALUES (
    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END,
    COALESCE(
      CASE WHEN TG_OP = 'DELETE' THEN OLD.sync_meta->>'last_modified_by'
           ELSE NEW.sync_meta->>'last_modified_by' END,
      'system'
    ),
    TG_TABLE_NAME::text,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_OP::text,
    changed_fields,
    old_vals,
    new_vals,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.sync_meta->'vector_clock'::jsonb
         ELSE NEW.sync_meta->'vector_clock'::jsonb END,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.content_hash
         ELSE NULL END,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.content_hash
         ELSE NEW.content_hash END
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to all syncable tables
DROP TRIGGER IF EXISTS emails_delta_sync ON emails CASCADE;
CREATE TRIGGER emails_delta_sync
  AFTER INSERT OR UPDATE OR DELETE ON emails
  FOR EACH ROW
  EXECUTE FUNCTION generate_delta_change();

DROP TRIGGER IF EXISTS calendar_events_delta_sync ON calendar_events CASCADE;
CREATE TRIGGER calendar_events_delta_sync
  AFTER INSERT OR UPDATE OR DELETE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION generate_delta_change();

DROP TRIGGER IF EXISTS tasks_delta_sync ON tasks CASCADE;
CREATE TRIGGER tasks_delta_sync
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION generate_delta_change();

-- ============================================================================
-- Enable Realtime Publication
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE emails;
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- ============================================================================
-- Utility Functions
-- ============================================================================

-- Calculate SHA256 hash of entity content
CREATE OR REPLACE FUNCTION calculate_content_hash(content JSONB)
RETURNS TEXT AS $$
  SELECT encode(digest(content::text, 'sha256'), 'hex');
$$ LANGUAGE SQL IMMUTABLE;

-- Increment vector clock for a device
CREATE OR REPLACE FUNCTION increment_vector_clock(
  p_user_id UUID,
  p_device_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_clock JSONB;
BEGIN
  -- Get current clock
  SELECT clock INTO v_clock
  FROM vector_clocks
  WHERE user_id = p_user_id AND device_id = p_device_id;

  -- Initialize if not exists
  IF v_clock IS NULL THEN
    v_clock := '{}'::jsonb;
  END IF;

  -- Increment this device's timestamp
  v_clock := jsonb_set(
    v_clock,
    ARRAY[p_device_id],
    to_jsonb(COALESCE((v_clock->>p_device_id)::integer, 0) + 1)
  );

  -- Upsert into vector_clocks table
  INSERT INTO vector_clocks (user_id, device_id, clock, updated_at)
  VALUES (p_user_id, p_device_id, v_clock, NOW())
  ON CONFLICT (user_id, device_id)
  DO UPDATE SET clock = v_clock, updated_at = NOW();

  RETURN v_clock;
END;
$$ LANGUAGE plpgsql;

-- Detect if two vector clocks are concurrent (neither dominates)
CREATE OR REPLACE FUNCTION is_concurrent_modification(
  p_local_clock JSONB,
  p_remote_clock JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  local_dominates BOOLEAN := true;
  remote_dominates BOOLEAN := true;
  device_key TEXT;
  local_ts INTEGER;
  remote_ts INTEGER;
BEGIN
  -- Check all devices
  FOR device_key IN SELECT jsonb_object_keys(p_local_clock) UNION SELECT jsonb_object_keys(p_remote_clock) LOOP
    local_ts := COALESCE((p_local_clock->>device_key)::integer, 0);
    remote_ts := COALESCE((p_remote_clock->>device_key)::integer, 0);

    IF local_ts < remote_ts THEN local_dominates := false; END IF;
    IF remote_ts < local_ts THEN remote_dominates := false; END IF;
  END LOOP;

  -- Concurrent if neither dominates
  RETURN NOT local_dominates AND NOT remote_dominates;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- RLS (Row-Level Security) Policies for Sync Tables
-- ============================================================================

-- Enable RLS
ALTER TABLE sync_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_clocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_statistics ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sync data
CREATE POLICY "Users can view own sync changes"
  ON sync_change_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync changes"
  ON sync_change_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own conflicts"
  ON sync_conflicts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own presence"
  ON sync_presence FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON sync_presence FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Cleanup & Maintenance Functions
-- ============================================================================

-- Function to archive old sync changes (older than 30 days)
CREATE OR REPLACE FUNCTION archive_old_sync_changes()
RETURNS TABLE(archived_count INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM sync_change_log
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND has_conflict = FALSE
  AND applied_at IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up resolved conflicts (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_resolved_conflicts()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM sync_conflicts
  WHERE resolved_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments & Documentation
-- ============================================================================

COMMENT ON TABLE sync_change_log IS
  'Immutable log of all entity changes for multi-device synchronization. Contains vector clocks and hash chains for conflict detection.';

COMMENT ON TABLE sync_conflicts IS
  'Tracks concurrent modifications across devices. Automatically resolved using LWW or manual intervention.';

COMMENT ON TABLE sync_presence IS
  'Real-time device presence and online status for each user. Enables multi-device awareness.';

COMMENT ON TABLE vector_clocks IS
  'Vector clock state per device for causality tracking. Detects concurrent modifications.';

COMMENT ON FUNCTION calculate_content_hash(jsonb) IS
  'SHA256 hash of entity content for detecting duplicate changes.';

COMMENT ON FUNCTION increment_vector_clock(uuid, text) IS
  'Increment vector clock for a device. Returns updated clock state.';

COMMENT ON FUNCTION is_concurrent_modification(jsonb, jsonb) IS
  'Detect if two modifications are concurrent (neither causally ordered).';

-- ============================================================================
-- Initial Analysis
-- ============================================================================

ANALYZE sync_change_log;
ANALYZE sync_conflicts;
ANALYZE sync_presence;
ANALYZE vector_clocks;
ANALYZE sync_statistics;
