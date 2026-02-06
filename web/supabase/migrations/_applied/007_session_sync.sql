-- =====================================================
-- HELIX OBSERVATORY DATABASE SCHEMA
-- Migration 007: Session Sync Enhancements
-- =====================================================
-- Adds columns and tables for full session synchronization
-- between local Helix instances and Observatory
-- =====================================================

-- =====================================================
-- ENHANCE SESSIONS TABLE
-- =====================================================

-- Add missing columns for sync support
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS working_directory TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'transferred')),
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'local' CHECK (origin IN ('local', 'observatory', 'mobile')),
  ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS context JSONB,
  ADD COLUMN IF NOT EXISTS local_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS remote_version INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- Rename 'started_at' to 'start_time' for consistency with sync module
-- (Keep started_at as alias for backwards compatibility)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;

UPDATE sessions SET start_time = started_at WHERE start_time IS NULL;

-- Rename 'ended_at' to 'end_time' for consistency
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

UPDATE sessions SET end_time = ended_at WHERE end_time IS NULL;

-- Add index for sync queries
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_origin ON sessions(origin);

-- =====================================================
-- ENHANCE SESSION_MESSAGES TABLE
-- =====================================================

-- Add missing columns for sync support
ALTER TABLE session_messages
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'local' CHECK (origin IN ('local', 'observatory', 'mobile')),
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index for origin-based queries
CREATE INDEX IF NOT EXISTS idx_session_messages_origin ON session_messages(origin);

-- =====================================================
-- SESSION TRANSFERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS session_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions NOT NULL,
  from_origin TEXT NOT NULL CHECK (from_origin IN ('local', 'observatory', 'mobile')),
  to_origin TEXT NOT NULL CHECK (to_origin IN ('local', 'observatory', 'mobile')),
  user_id UUID REFERENCES auth.users NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  transfer_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_transfers_session ON session_transfers(session_id);
CREATE INDEX IF NOT EXISTS idx_session_transfers_user ON session_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_session_transfers_timestamp ON session_transfers(timestamp DESC);

-- RLS for session_transfers
ALTER TABLE session_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_transfers_user_policy ON session_transfers
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- SYNC STATE TRACKING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS session_sync_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions NOT NULL UNIQUE,
  last_sync_time TIMESTAMPTZ DEFAULT NOW(),
  local_version INTEGER DEFAULT 1,
  remote_version INTEGER DEFAULT 0,
  pending_changes INTEGER DEFAULT 0,
  conflict_count INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  last_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_sync_state_session ON session_sync_state(session_id);
CREATE INDEX IF NOT EXISTS idx_session_sync_state_status ON session_sync_state(sync_status);

-- RLS for sync state
ALTER TABLE session_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_sync_state_policy ON session_sync_state
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_sync_state.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- =====================================================
-- SYNC CONFLICTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS session_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions NOT NULL,
  message_id UUID REFERENCES session_messages,
  local_data JSONB NOT NULL,
  remote_data JSONB NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolution TEXT CHECK (resolution IN ('local-wins', 'remote-wins', 'merge', 'manual')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users
);

CREATE INDEX IF NOT EXISTS idx_session_conflicts_session ON session_conflicts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_conflicts_unresolved ON session_conflicts(session_id) WHERE resolved_at IS NULL;

-- RLS for conflicts
ALTER TABLE session_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_conflicts_policy ON session_conflicts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_conflicts.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- =====================================================
-- FUNCTIONS FOR SESSION SYNC
-- =====================================================

-- Function to update session last_activity timestamp
CREATE OR REPLACE FUNCTION update_session_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sessions
  SET last_activity = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update last_activity when messages are added
DROP TRIGGER IF EXISTS on_message_update_session_activity ON session_messages;
CREATE TRIGGER on_message_update_session_activity
  AFTER INSERT ON session_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_last_activity();

-- Function to record session transfer
CREATE OR REPLACE FUNCTION record_session_transfer(
  p_session_id UUID,
  p_from_origin TEXT,
  p_to_origin TEXT,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  transfer_id UUID;
BEGIN
  -- Insert transfer record
  INSERT INTO session_transfers (session_id, from_origin, to_origin, user_id)
  VALUES (p_session_id, p_from_origin, p_to_origin, p_user_id)
  RETURNING id INTO transfer_id;

  -- Update session origin
  UPDATE sessions
  SET origin = p_to_origin,
      status = 'transferred',
      last_activity = NOW()
  WHERE id = p_session_id;

  RETURN transfer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get sessions needing sync
CREATE OR REPLACE FUNCTION get_sessions_needing_sync(p_user_id UUID)
RETURNS TABLE (
  session_id UUID,
  local_version INTEGER,
  remote_version INTEGER,
  pending_changes INTEGER,
  last_sync_time TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    COALESCE(ss.local_version, 1),
    COALESCE(ss.remote_version, 0),
    COALESCE(ss.pending_changes, 0),
    ss.last_sync_time
  FROM sessions s
  LEFT JOIN session_sync_state ss ON s.id = ss.session_id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND (ss.sync_status IS NULL OR ss.sync_status = 'pending');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ENABLE REALTIME FOR NEW TABLES
-- =====================================================

-- Enable realtime for session transfers (useful for cross-device notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE session_transfers;

-- Enable realtime for sync state changes
ALTER PUBLICATION supabase_realtime ADD TABLE session_sync_state;

-- Enable realtime for conflicts (for UI notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE session_conflicts;
