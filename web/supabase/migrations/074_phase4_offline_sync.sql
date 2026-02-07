-- Phase 4: Cross-Platform Unification - Offline Sync
-- Enhances session_messages and adds offline sync tracking
-- Date: 2026-02-06

BEGIN;

-- ============================================================================
-- Enhance session_messages for offline sync support
-- ============================================================================

-- Add idempotency key for preventing duplicate messages
ALTER TABLE session_messages ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Add sync status tracking
ALTER TABLE session_messages ADD COLUMN IF NOT EXISTS is_pending BOOLEAN DEFAULT FALSE;
ALTER TABLE session_messages ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

-- Add platform origin tracking for cross-platform sync
ALTER TABLE session_messages ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'web'
  CHECK (platform IN ('web', 'desktop', 'ios', 'android', 'cli'));

-- Add device fingerprint for multi-device scenarios
ALTER TABLE session_messages ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Create indexes for offline sync queries
CREATE INDEX IF NOT EXISTS idx_session_messages_pending ON session_messages(session_id)
  WHERE is_pending = TRUE;

CREATE INDEX IF NOT EXISTS idx_session_messages_client_id ON session_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_platform ON session_messages(platform);
CREATE INDEX IF NOT EXISTS idx_session_messages_device ON session_messages(device_id);

-- Create unique constraint for client_id to prevent duplicates
ALTER TABLE session_messages ADD CONSTRAINT
  unique_client_message UNIQUE (session_id, client_id)
  WHERE client_id IS NOT NULL;

-- ============================================================================
-- Offline Queue Status Table
-- Tracks sync state across platforms
-- ============================================================================

CREATE TABLE IF NOT EXISTS offline_queue_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'desktop', 'ios', 'android', 'cli')),

  -- Queue status
  queue_length INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  is_online BOOLEAN DEFAULT TRUE,
  is_syncing BOOLEAN DEFAULT FALSE,

  -- Last sync information
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_device_platform UNIQUE (user_id, device_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_queue_status_user ON offline_queue_status(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_status_device ON offline_queue_status(device_id);
CREATE INDEX IF NOT EXISTS idx_queue_status_platform ON offline_queue_status(platform);
CREATE INDEX IF NOT EXISTS idx_queue_status_updated ON offline_queue_status(updated_at DESC);

-- RLS for offline queue status
ALTER TABLE offline_queue_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY queue_status_user_policy ON offline_queue_status
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_offline_queue_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER offline_queue_status_updated_at
  BEFORE UPDATE ON offline_queue_status
  FOR EACH ROW
  EXECUTE FUNCTION update_offline_queue_status_timestamp();

-- ============================================================================
-- Offline Sync Log
-- Immutable log of sync events for debugging and auditing
-- ============================================================================

CREATE TABLE IF NOT EXISTS offline_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL,

  -- Event information
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sync_start',
    'sync_success',
    'sync_partial',
    'sync_failed',
    'offline_detected',
    'online_detected',
    'message_queued',
    'message_synced',
    'message_failed',
    'queue_cleared'
  )),

  message_count INTEGER,
  synced_count INTEGER,
  failed_count INTEGER,

  error_message TEXT,
  duration_ms INTEGER,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_user ON offline_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_device ON offline_sync_log(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_event ON offline_sync_log(event_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON offline_sync_log(created_at DESC);

-- RLS for sync log (users can view their own)
ALTER TABLE offline_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_log_user_policy ON offline_sync_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role can insert logs
CREATE POLICY sync_log_service_insert ON offline_sync_log
  FOR INSERT TO service_role
  WITH CHECK (TRUE);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Get pending messages for a session
CREATE OR REPLACE FUNCTION get_pending_messages(session_id_param UUID)
RETURNS TABLE (
  id UUID,
  client_id TEXT,
  role TEXT,
  content TEXT,
  timestamp TIMESTAMPTZ,
  platform TEXT,
  device_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.client_id,
    sm.role,
    sm.content,
    sm.timestamp,
    sm.platform,
    sm.device_id
  FROM session_messages sm
  WHERE sm.session_id = session_id_param
    AND sm.is_pending = TRUE
  ORDER BY sm.timestamp ASC;
END;
$$ LANGUAGE plpgsql;

-- Mark messages as synced
CREATE OR REPLACE FUNCTION mark_messages_synced(message_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE session_messages
  SET
    is_pending = FALSE,
    synced_at = NOW()
  WHERE id = ANY(message_ids)
    AND is_pending = TRUE;

  updated_count := ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Get sync statistics for user
CREATE OR REPLACE FUNCTION get_sync_statistics(user_id_param UUID)
RETURNS TABLE (
  total_pending INTEGER,
  total_failed INTEGER,
  online_devices TEXT[],
  offline_devices TEXT[],
  last_sync TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE is_pending = TRUE) as total_pending,
    COUNT(DISTINCT device_id) FILTER (WHERE is_syncing = TRUE) as total_failed,
    ARRAY_AGG(DISTINCT device_id) FILTER (WHERE is_online = TRUE) as online_devices,
    ARRAY_AGG(DISTINCT device_id) FILTER (WHERE is_online = FALSE) as offline_devices,
    MAX(last_sync_at) as last_sync
  FROM offline_queue_status oqs
  WHERE oqs.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

COMMIT;
