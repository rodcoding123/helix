-- Supabase Migration: Phase I - Advanced Configuration
-- PHASE I: Model failover chains, auth profiles, hook system, gateway config
-- Date: 2026-02-07
--
-- Creates tables for:
-- 1. Model failover chains - Provider ordering and fallback logic
-- 2. Auth profiles - Different auth strategies per user/session
-- 3. Hooks - Event-based automation and custom workflows
-- 4. Gateway configuration - Runtime configuration management

BEGIN;

-- ==============================================================================
-- TABLE 1: Model Failover Chains
-- ==============================================================================
-- Define provider ordering and fallback logic for LLM operations
-- Enables automatic failover when primary provider fails

CREATE TABLE IF NOT EXISTS model_failover_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Chain metadata
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,

  -- Provider sequence (ordered by priority)
  providers JSONB NOT NULL, -- [{provider: 'anthropic', model: 'claude-3-5-sonnet', fallback_enabled: true, cost_max: 0.50}, ...]

  -- Failover configuration
  fallback_strategy TEXT NOT NULL DEFAULT 'sequential' CHECK (fallback_strategy IN (
    'sequential',      -- Try providers in order until success
    'cost_optimized',  -- Use cheapest provider first
    'latency_optimized', -- Use fastest provider first
    'quality_prioritized' -- Use best quality model first
  )),

  -- Health thresholds for triggering failover
  success_rate_threshold DECIMAL(3, 2) DEFAULT 0.95, -- 95% success required
  error_count_threshold INTEGER DEFAULT 5, -- Failover after 5 consecutive errors
  cost_spike_multiplier DECIMAL(3, 2) DEFAULT 2.0, -- Failover if cost > 2x baseline

  -- Tracking
  active_provider TEXT,
  last_failover_at TIMESTAMPTZ,
  failover_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failover_chains_user_id ON model_failover_chains(user_id);
CREATE INDEX IF NOT EXISTS idx_failover_chains_is_default ON model_failover_chains(is_default);
CREATE INDEX IF NOT EXISTS idx_failover_chains_active_provider ON model_failover_chains(active_provider);

-- RLS: Users can manage own failover chains
ALTER TABLE model_failover_chains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_failover_chains"
  ON model_failover_chains FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_failover_chains"
  ON model_failover_chains FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_failover_chains"
  ON model_failover_chains FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_failover_chains"
  ON model_failover_chains FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 2: Auth Profiles
-- ==============================================================================
-- Different authentication strategies per user/session
-- Enables multi-auth scenarios (different creds for different operations)

CREATE TABLE IF NOT EXISTS auth_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile metadata
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,

  -- Auth strategy
  auth_type TEXT NOT NULL CHECK (auth_type IN (
    'api_key',           -- Direct API key auth
    'oauth2',            -- OAuth 2.0 flow
    'service_account',   -- Service account credentials
    'bearer_token',      -- Bearer token auth
    'custom'             -- Custom auth handler
  )),

  -- Credentials (encrypted)
  credentials JSONB NOT NULL, -- {api_key, oauth_token, service_account_json, etc.}
  credentials_encrypted BOOLEAN DEFAULT TRUE,

  -- Scope and limitations
  allowed_operations TEXT[] DEFAULT '{}', -- Restrict to certain operations
  rate_limit_rpm INTEGER, -- Requests per minute
  daily_quota INTEGER, -- Daily operation count
  cost_limit_usd DECIMAL(10, 2), -- Daily cost limit

  -- Provider-specific config
  provider_config JSONB DEFAULT '{}', -- {region, endpoints, timeout_ms, ...}

  -- Audit
  created_by_user_id UUID REFERENCES auth.users(id),
  last_used_at TIMESTAMPTZ,
  last_rotated_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_profiles_user_id ON auth_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_profiles_is_default ON auth_profiles(is_default);
CREATE INDEX IF NOT EXISTS idx_auth_profiles_auth_type ON auth_profiles(auth_type);

-- RLS: Users can manage own auth profiles
ALTER TABLE auth_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_auth_profiles"
  ON auth_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_auth_profiles"
  ON auth_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_auth_profiles"
  ON auth_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_auth_profiles"
  ON auth_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 3: Hooks
-- ==============================================================================
-- Event-based automation and custom workflows
-- Subscribe to system events and trigger custom handlers

CREATE TABLE IF NOT EXISTS hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Hook metadata
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,

  -- Event subscription
  event_pattern TEXT NOT NULL, -- Glob pattern: 'chat.*', 'synthesis.completed', etc.
  event_filters JSONB DEFAULT '{}', -- {minCost: 1.00, platform: 'ios', ...}

  -- Handler configuration
  handler_type TEXT NOT NULL CHECK (handler_type IN (
    'webhook',         -- HTTP POST to external URL
    'discord',         -- Discord webhook notification
    'email',           -- Email notification
    'slack',           -- Slack notification
    'custom_function'  -- Custom serverless function
  )),

  handler_config JSONB NOT NULL, -- {url, headers, auth, ...} or {channel_id, ...}

  -- Execution policy
  max_retries INTEGER DEFAULT 3,
  retry_backoff_ms INTEGER DEFAULT 1000,
  timeout_ms INTEGER DEFAULT 30000,

  -- Filtering and transformation
  should_transform BOOLEAN DEFAULT FALSE,
  transform_template TEXT, -- Jinja2 template for payload transformation

  -- Audit and tracking
  created_by_user_id UUID REFERENCES auth.users(id),
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hooks_user_id ON hooks(user_id);
CREATE INDEX IF NOT EXISTS idx_hooks_event_pattern ON hooks(event_pattern);
CREATE INDEX IF NOT EXISTS idx_hooks_is_enabled ON hooks(is_enabled);
CREATE INDEX IF NOT EXISTS idx_hooks_handler_type ON hooks(handler_type);

-- RLS: Users can manage own hooks
ALTER TABLE hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_hooks"
  ON hooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_hooks"
  ON hooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_hooks"
  ON hooks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_hooks"
  ON hooks FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 4: Hook Execution Log
-- ==============================================================================
-- Track hook execution history for debugging and audit

CREATE TABLE IF NOT EXISTS hook_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_id UUID NOT NULL REFERENCES hooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event information
  event_type TEXT NOT NULL,
  event_data JSONB,

  -- Execution details
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'success', 'failed')),
  attempt_count INTEGER DEFAULT 1,

  -- Response
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,

  -- Performance
  duration_ms INTEGER,

  -- Timestamps
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hook_log_hook_id ON hook_execution_log(hook_id);
CREATE INDEX IF NOT EXISTS idx_hook_log_user_id ON hook_execution_log(user_id);
CREATE INDEX IF NOT EXISTS idx_hook_log_status ON hook_execution_log(status);
CREATE INDEX IF NOT EXISTS idx_hook_log_executed_at ON hook_execution_log(executed_at DESC);

-- RLS: Users can view own logs
ALTER TABLE hook_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_hook_logs"
  ON hook_execution_log FOR SELECT
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 5: Gateway Configuration
-- ==============================================================================
-- Runtime configuration management for gateway behavior

CREATE TABLE IF NOT EXISTS gateway_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Configuration scope
  scope TEXT NOT NULL DEFAULT 'user' CHECK (scope IN ('user', 'device', 'session')),
  scope_id TEXT, -- device_id or session_key if scope != 'user'

  -- WebSocket configuration
  ws_config JSONB DEFAULT '{}', -- {heartbeat_interval_ms: 30000, reconnect_backoff: 1000, ...}

  -- Message batching
  batch_messages BOOLEAN DEFAULT TRUE,
  batch_timeout_ms INTEGER DEFAULT 100,
  batch_size_max INTEGER DEFAULT 100,

  -- Compression
  enable_compression BOOLEAN DEFAULT TRUE,
  compression_threshold_bytes INTEGER DEFAULT 1024,

  -- Rate limiting
  max_requests_per_second DECIMAL(5, 2) DEFAULT 10.0,
  burst_allowance INTEGER DEFAULT 50,

  -- Caching
  enable_response_caching BOOLEAN DEFAULT TRUE,
  cache_ttl_seconds INTEGER DEFAULT 300,

  -- Logging and debugging
  enable_request_logging BOOLEAN DEFAULT TRUE,
  enable_response_logging BOOLEAN DEFAULT FALSE, -- Sensitive data
  log_level TEXT DEFAULT 'info' CHECK (log_level IN ('debug', 'info', 'warn', 'error')),

  -- Feature flags
  feature_flags JSONB DEFAULT '{}', -- {streaming: true, voice: false, ...}

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gateway_config_user_id ON gateway_configuration(user_id);
CREATE INDEX IF NOT EXISTS idx_gateway_config_scope ON gateway_configuration(scope, scope_id);

-- RLS: Users can manage own configuration
ALTER TABLE gateway_configuration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_gateway_config"
  ON gateway_configuration FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_gateway_config"
  ON gateway_configuration FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_gateway_config"
  ON gateway_configuration FOR UPDATE
  USING (auth.uid() = user_id);

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
CREATE TRIGGER model_failover_chains_updated_at_trigger
  BEFORE UPDATE ON model_failover_chains
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER auth_profiles_updated_at_trigger
  BEFORE UPDATE ON auth_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER hooks_updated_at_trigger
  BEFORE UPDATE ON hooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER gateway_configuration_updated_at_trigger
  BEFORE UPDATE ON gateway_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- HELPER FUNCTION: Get Active Failover Chain
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_active_failover_chain(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  providers JSONB,
  fallback_strategy TEXT,
  active_provider TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    model_failover_chains.id,
    model_failover_chains.name,
    model_failover_chains.providers,
    model_failover_chains.fallback_strategy,
    model_failover_chains.active_provider
  FROM model_failover_chains
  WHERE model_failover_chains.user_id = user_id_param
    AND model_failover_chains.is_enabled = TRUE
    AND model_failover_chains.is_default = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- HELPER FUNCTION: Get Matching Hooks
-- ==============================================================================
-- Returns hooks that match a given event pattern

CREATE OR REPLACE FUNCTION get_matching_hooks(user_id_param UUID, event_type_param TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  handler_type TEXT,
  handler_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hooks.id,
    hooks.name,
    hooks.handler_type,
    hooks.handler_config
  FROM hooks
  WHERE hooks.user_id = user_id_param
    AND hooks.is_enabled = TRUE
    AND event_type_param LIKE REPLACE(hooks.event_pattern, '*', '%');
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- CLEANUP: Old Hook Logs
-- ==============================================================================
-- Auto-cleanup old hook execution logs (runs monthly)

CREATE OR REPLACE FUNCTION cleanup_old_hook_logs()
RETURNS TABLE (
  deleted_count INTEGER
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM hook_execution_log
  WHERE executed_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
