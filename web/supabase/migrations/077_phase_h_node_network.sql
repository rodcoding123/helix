-- Supabase Migration: Phase H - Node & Device Network
-- PHASE H: Multi-device pairing, node discovery, health monitoring, per-node policies
-- Date: 2026-02-07
--
-- Creates tables for:
-- 1. Devices - Paired device registry
-- 2. Pairing requests - Pending device pairing workflows
-- 3. Discovered nodes - mDNS discovered Helix nodes
-- 4. Device health - Real-time device health metrics
-- 5. Exec policies - Per-node command allowlists
-- 6. Node capabilities - Device feature registry

BEGIN;

-- ==============================================================================
-- TABLE 1: Devices
-- ==============================================================================
-- Registry of all paired devices for a user
-- Tracks device metadata, platform, and pairing status

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Device metadata
  device_id TEXT NOT NULL UNIQUE, -- Hardware ID from device
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('desktop', 'ios', 'android', 'web')),

  -- Device info
  os_version TEXT,
  app_version TEXT,
  ip_address TEXT,
  port INTEGER DEFAULT 8765,

  -- Pairing status
  is_primary BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pairing' CHECK (status IN ('pairing', 'paired', 'trusted', 'offline', 'error')),
  pairing_verified_at TIMESTAMPTZ,

  -- Capabilities and sync
  capabilities TEXT[] DEFAULT '{}', -- e.g. ['audio_output', 'camera', 'voice_input']
  supports_offline_sync BOOLEAN DEFAULT TRUE,
  sync_enabled BOOLEAN DEFAULT TRUE,

  -- Last activity
  last_seen TIMESTAMPTZ,
  last_command_at TIMESTAMPTZ,

  -- Trust and security
  trust_level DECIMAL(3, 2) DEFAULT 0.5, -- 0.0 to 1.0
  device_token TEXT, -- Unique device authentication token
  public_key TEXT, -- Device's public key for encryption

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paired_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_platform ON devices(platform);
CREATE INDEX IF NOT EXISTS idx_devices_primary ON devices(user_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

-- RLS: Users can view and manage own devices
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_devices"
  ON devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_devices"
  ON devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_devices"
  ON devices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_devices"
  ON devices FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 2: Pairing Requests
-- ==============================================================================
-- Workflow for requesting device pairing
-- Expires after 24 hours if not approved

CREATE TABLE IF NOT EXISTS pairing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Request metadata
  device_name TEXT NOT NULL,
  device_platform TEXT NOT NULL,
  device_id TEXT,

  -- Request info
  requesting_ip TEXT,
  port INTEGER DEFAULT 8765,
  request_code TEXT UNIQUE, -- User enters this on device to confirm

  -- Status and workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Awaiting user approval
    'approved',     -- User approved
    'rejected',     -- User rejected
    'expired',      -- 24h timeout
    'completed'     -- Device paired
  )),

  -- Approval tracking
  approved_at TIMESTAMPTZ,
  approved_by_user_id UUID REFERENCES auth.users(id),
  rejection_reason TEXT,

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pairing_requests_user_id ON pairing_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pairing_requests_status ON pairing_requests(status);
CREATE INDEX IF NOT EXISTS idx_pairing_requests_expires_at ON pairing_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_pairing_requests_device_id ON pairing_requests(device_id);

-- RLS: Users can view own pairing requests
ALTER TABLE pairing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_pairing_requests"
  ON pairing_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_pairing_requests"
  ON pairing_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_pairing_requests"
  ON pairing_requests FOR UPDATE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 3: Discovered Nodes
-- ==============================================================================
-- mDNS discovered Helix instances on local network
-- Enables local-first node discovery without central service

CREATE TABLE IF NOT EXISTS discovered_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Discovery metadata
  node_name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  platform TEXT,
  version TEXT,

  -- Node identification
  node_id TEXT,
  mdns_hostname TEXT,

  -- Credentials (for automation)
  cli_path TEXT,

  -- Discovery tracking
  first_discovered TIMESTAMPTZ DEFAULT NOW(),
  last_discovered TIMESTAMPTZ DEFAULT NOW(),
  discovery_count INTEGER DEFAULT 1,

  -- Pairing status (if paired)
  is_paired BOOLEAN DEFAULT FALSE,
  paired_device_id UUID REFERENCES devices(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovered_nodes_user_id ON discovered_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_discovered_nodes_is_paired ON discovered_nodes(is_paired);
CREATE INDEX IF NOT EXISTS idx_discovered_nodes_host_port ON discovered_nodes(host, port);

-- RLS: Users can view own discovered nodes
ALTER TABLE discovered_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_discovered_nodes"
  ON discovered_nodes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_discovered_nodes"
  ON discovered_nodes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_discovered_nodes"
  ON discovered_nodes FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 4: Device Health
-- ==============================================================================
-- Real-time health metrics for paired devices
-- Updated frequently for monitoring and alerting

CREATE TABLE IF NOT EXISTS device_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  -- Connection health
  is_online BOOLEAN DEFAULT FALSE,
  last_heartbeat TIMESTAMPTZ,
  heartbeat_interval_ms INTEGER DEFAULT 30000, -- Expected interval

  -- Metrics
  latency_ms INTEGER, -- Round-trip time
  battery_percent INTEGER,
  memory_percent INTEGER,
  cpu_percent INTEGER,
  disk_free_gb DECIMAL(10, 2),

  -- Sync status
  sync_lag_ms INTEGER DEFAULT 0,
  messages_pending INTEGER DEFAULT 0,
  last_sync_at TIMESTAMPTZ,

  -- Error tracking
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,

  -- Health score (0-100)
  health_score INTEGER DEFAULT 100,
  health_status TEXT DEFAULT 'healthy' CHECK (health_status IN (
    'healthy',
    'degraded',
    'offline',
    'error'
  )),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_health_user_id ON device_health(user_id);
CREATE INDEX IF NOT EXISTS idx_device_health_device_id ON device_health(device_id);
CREATE INDEX IF NOT EXISTS idx_device_health_last_heartbeat ON device_health(last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_device_health_health_status ON device_health(health_status);

-- RLS: Users can view own device health
ALTER TABLE device_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_device_health"
  ON device_health FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_device_health"
  ON device_health FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_device_health"
  ON device_health FOR UPDATE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 5: Device Exec Policies
-- ==============================================================================
-- Per-node command allowlists and execution restrictions
-- Controls which operations devices can execute remotely

CREATE TABLE IF NOT EXISTS device_exec_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  -- Policy metadata
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,

  -- Command allowlisting
  allowed_commands TEXT[] NOT NULL DEFAULT '{}', -- Glob patterns: 'chat.*', 'synthesize.*'
  blocked_commands TEXT[] DEFAULT '{}', -- Explicit blocklist
  require_approval BOOLEAN DEFAULT TRUE, -- Require human approval for commands

  -- Resource limits
  max_tokens_per_call INTEGER DEFAULT 50000,
  max_cost_per_hour DECIMAL(10, 2) DEFAULT 100.00,
  max_concurrent_calls INTEGER DEFAULT 5,

  -- Execution restrictions
  require_vpn BOOLEAN DEFAULT FALSE,
  allowed_hours_utc TEXT, -- e.g. "09:00-17:00" (all hours if NULL)
  disallow_on_battery BOOLEAN DEFAULT FALSE,

  -- Audit
  created_by_user_id UUID REFERENCES auth.users(id),
  last_modified_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exec_policies_user_id ON device_exec_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_exec_policies_device_id ON device_exec_policies(device_id);
CREATE INDEX IF NOT EXISTS idx_exec_policies_enabled ON device_exec_policies(is_enabled);

-- RLS: Users can manage own policies
ALTER TABLE device_exec_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_exec_policies"
  ON device_exec_policies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_exec_policies"
  ON device_exec_policies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_exec_policies"
  ON device_exec_policies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_exec_policies"
  ON device_exec_policies FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 6: Node Capabilities
-- ==============================================================================
-- Feature registry for discovered/paired devices
-- Used for capability-based command routing

CREATE TABLE IF NOT EXISTS node_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  -- Capability metadata
  capability_name TEXT NOT NULL,
  category TEXT, -- 'io', 'compute', 'storage', 'network', etc.

  -- Version and status
  version TEXT,
  is_available BOOLEAN DEFAULT TRUE,

  -- Configuration
  configuration JSONB DEFAULT '{}', -- Capability-specific config

  -- Performance metrics
  last_test_passed_at TIMESTAMPTZ,
  test_failure_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_capabilities_device_id ON node_capabilities(device_id);
CREATE INDEX IF NOT EXISTS idx_node_capabilities_name ON node_capabilities(capability_name);
CREATE INDEX IF NOT EXISTS idx_node_capabilities_available ON node_capabilities(is_available);

-- ==============================================================================
-- HELPER FUNCTIONS
-- ==============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER devices_updated_at_trigger
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER pairing_requests_updated_at_trigger
  BEFORE UPDATE ON pairing_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER discovered_nodes_updated_at_trigger
  BEFORE UPDATE ON discovered_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER device_health_updated_at_trigger
  BEFORE UPDATE ON device_health
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER device_exec_policies_updated_at_trigger
  BEFORE UPDATE ON device_exec_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER node_capabilities_updated_at_trigger
  BEFORE UPDATE ON node_capabilities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- HELPER FUNCTION: Get Device Status Summary
-- ==============================================================================
-- Returns health summary for all user's devices

CREATE OR REPLACE FUNCTION get_device_status_summary(user_id_param UUID)
RETURNS TABLE (
  total_devices INTEGER,
  online_devices INTEGER,
  offline_devices INTEGER,
  avg_health_score INTEGER,
  sync_lag_ms BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(d.id)::INTEGER as total_devices,
    COUNT(CASE WHEN dh.is_online THEN 1 END)::INTEGER as online_devices,
    COUNT(CASE WHEN NOT dh.is_online THEN 1 END)::INTEGER as offline_devices,
    ROUND(AVG(dh.health_score))::INTEGER as avg_health_score,
    MAX(dh.sync_lag_ms)::BIGINT as sync_lag_ms
  FROM devices d
  LEFT JOIN device_health dh ON d.id = dh.device_id
  WHERE d.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- HELPER FUNCTION: Resolve Exec Policy for Device
-- ==============================================================================
-- Returns effective exec policy for a device at request time

CREATE OR REPLACE FUNCTION resolve_exec_policy(device_id_param UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  policy_id UUID,
  reason TEXT
) AS $$
DECLARE
  v_device devices%rowtype;
  v_policy device_exec_policies%rowtype;
  v_health device_health%rowtype;
BEGIN
  -- Get device
  SELECT * INTO v_device FROM devices WHERE id = device_id_param;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Device not found';
    RETURN;
  END IF;

  -- Get active policy
  SELECT * INTO v_policy FROM device_exec_policies
  WHERE device_id = device_id_param AND is_enabled = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT true, NULL::UUID, 'No policy configured; all commands allowed';
    RETURN;
  END IF;

  -- Get current health
  SELECT * INTO v_health FROM device_health
  WHERE device_id = device_id_param
  ORDER BY updated_at DESC LIMIT 1;

  -- Check various conditions
  IF v_policy.require_vpn AND NOT v_device.ip_address LIKE '10.%' THEN
    RETURN QUERY SELECT false, v_policy.id, 'VPN required but not connected';
    RETURN;
  END IF;

  IF v_policy.disallow_on_battery AND v_health.battery_percent < 20 THEN
    RETURN QUERY SELECT false, v_policy.id, 'Battery too low';
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true, v_policy.id, 'Policy allows execution';
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- CLEANUP: Expired Pairing Requests
-- ==============================================================================
-- Auto-clean up expired pairing requests (runs daily)

CREATE OR REPLACE FUNCTION cleanup_expired_pairing_requests()
RETURNS TABLE (
  deleted_count INTEGER
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM pairing_requests
  WHERE expires_at < NOW() AND status = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
