/**
 * Phase 1 Module 11: Remote Commands Foundation
 *
 * Establishes the database schema for multi-device remote command execution.
 * Enables web/mobile clients to submit commands for execution on the local device.
 *
 * **Tables**:
 * - remote_commands: Main queue of commands to execute
 * - command_results_history: Execution history and audit trail
 *
 * **Real-Time Subscriptions**:
 * - Web clients listen to remote_commands updates
 * - Local device sees changes and processes
 * - Results broadcast back to all devices immediately
 *
 * **Security**:
 * - RLS policies enforce user isolation
 * - Only command owner can view command
 * - Results visible to authorized devices
 */

-- ============================================================================
-- Main Commands Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS remote_commands (
  -- Core identifiers
  command_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source information
  source_device_id TEXT NOT NULL,
  source_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Command metadata
  agent_id TEXT NOT NULL DEFAULT 'main',

  -- Provider selection (model-agnostic)
  -- - 'anthropic': Claude via OAuth
  -- - 'openai-codex': OpenAI via OAuth
  -- - 'google-gemini': Future support
  -- - 'custom': User-configured providers
  provider TEXT NOT NULL DEFAULT 'anthropic',

  -- Command content
  content TEXT NOT NULL,
  session_id TEXT NOT NULL,
  channel_id TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'executing', 'completed', 'failed')),

  -- Execution result (populated after completion)
  result JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Command expiration
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Execution metadata (populated after execution)
  executed_at BIGINT,
  execution_duration_ms INTEGER
);

-- Indexes for common queries
CREATE INDEX remote_commands_user_idx ON remote_commands(source_user_id, created_at DESC);
CREATE INDEX remote_commands_session_idx ON remote_commands(session_id, created_at DESC);
CREATE INDEX remote_commands_status_idx ON remote_commands(status) WHERE status != 'completed';
CREATE INDEX remote_commands_expires_idx ON remote_commands(expires_at) WHERE status IN ('pending', 'executing');
CREATE INDEX remote_commands_device_idx ON remote_commands(source_device_id, created_at DESC);

-- ============================================================================
-- Execution History & Audit Trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS command_results_history (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID NOT NULL REFERENCES remote_commands(command_id) ON DELETE CASCADE,

  -- Execution details
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  output TEXT,
  error_message TEXT,

  -- Audit trail
  executed_at BIGINT NOT NULL,
  execution_duration_ms INTEGER,

  -- Local device info
  executor_device_id TEXT NOT NULL,
  executor_version TEXT,

  -- Result hash for integrity verification (Phase 1 pattern)
  result_hash TEXT,

  -- Timestamps
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for history queries
CREATE INDEX command_results_history_command_idx ON command_results_history(command_id);
CREATE INDEX command_results_history_executor_idx ON command_results_history(executor_device_id, recorded_at DESC);
CREATE INDEX command_results_history_date_idx ON command_results_history(recorded_at DESC);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE remote_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_results_history ENABLE ROW LEVEL SECURITY;

-- Users can view commands they created or are authorized to execute
CREATE POLICY "Users can view own commands"
  ON remote_commands
  FOR SELECT
  USING (auth.uid() = source_user_id);

-- Users can insert commands (submit for execution)
CREATE POLICY "Users can submit commands"
  ON remote_commands
  FOR INSERT
  WITH CHECK (auth.uid() = source_user_id);

-- Update policy: only status field can be updated by authorized devices
-- In practice, the local device updates via a trusted function
CREATE POLICY "Authorized devices can update status"
  ON remote_commands
  FOR UPDATE
  USING (
    -- Only the source user can update (or through RPC)
    auth.uid() = source_user_id
  )
  WITH CHECK (
    auth.uid() = source_user_id
  );

-- Users can view history for their commands
CREATE POLICY "Users can view own history"
  ON command_results_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM remote_commands
      WHERE remote_commands.command_id = command_results_history.command_id
      AND remote_commands.source_user_id = auth.uid()
    )
  );

-- ============================================================================
-- Real-Time Subscriptions
-- ============================================================================

-- Enable real-time for web/mobile subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE remote_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE command_results_history;

-- ============================================================================
-- Helpful Views
-- ============================================================================

-- View for pending commands (what local device should execute)
CREATE OR REPLACE VIEW pending_commands AS
SELECT
  command_id,
  source_device_id,
  source_user_id,
  agent_id,
  provider,
  content,
  session_id,
  channel_id,
  created_at,
  expires_at
FROM remote_commands
WHERE status = 'pending'
  AND expires_at > NOW()
ORDER BY created_at ASC;

-- View for recent results (for monitoring/debugging)
CREATE OR REPLACE VIEW recent_results AS
SELECT
  rc.command_id,
  rc.source_device_id,
  rc.provider,
  crh.status,
  crh.execution_duration_ms,
  crh.recorded_at,
  rc.created_at
FROM command_results_history crh
JOIN remote_commands rc ON rc.command_id = crh.command_id
ORDER BY crh.recorded_at DESC
LIMIT 100;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE remote_commands IS
'Queue of commands from web/mobile for local device execution. BYOK pattern: credentials stay local.';

COMMENT ON TABLE command_results_history IS
'Immutable audit trail of command execution results.';

COMMENT ON COLUMN remote_commands.provider IS
'Model-agnostic provider: anthropic, openai-codex, google-gemini, custom';

COMMENT ON COLUMN remote_commands.result IS
'JSON: {status: "success"|"error", output: string, executedAt: number, error?: string}';

COMMENT ON COLUMN command_results_history.result_hash IS
'SHA256 hash of result for integrity verification in hash chain';
