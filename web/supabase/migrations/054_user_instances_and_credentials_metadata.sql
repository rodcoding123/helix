-- Migration: Add user_instances and instance_credentials_metadata tables
-- Purpose: Enable cross-device tracking and credential audit trails
-- Date: 2025-02-05
-- Author: Claude Code

-- ============================================================================
-- 1. USER_INSTANCES TABLE - Track which devices belong to which users
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_instances (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Instance identification
  instance_id TEXT NOT NULL UNIQUE,  -- UUID, persisted on device
  device_name TEXT,                   -- User-friendly name (e.g., "My MacBook")
  device_type TEXT NOT NULL DEFAULT 'desktop',  -- 'desktop' | 'mobile' | 'web'
  platform TEXT,                      -- 'windows' | 'macos' | 'linux' | 'ios' | 'android'

  -- Status tracking
  last_heartbeat TIMESTAMP DEFAULT NOW(),  -- Last time this device pinged
  is_online BOOLEAN DEFAULT false,         -- Calculated from last_heartbeat

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_device_type CHECK (device_type IN ('desktop', 'mobile', 'web')),
  CONSTRAINT valid_platform CHECK (
    platform IS NULL OR
    platform IN ('windows', 'macos', 'linux', 'ios', 'android', 'web')
  ),
  UNIQUE(user_id, instance_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_instances_user_id ON public.user_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_instances_instance_id ON public.user_instances(instance_id);
CREATE INDEX IF NOT EXISTS idx_user_instances_is_online ON public.user_instances(is_online);
CREATE INDEX IF NOT EXISTS idx_user_instances_last_heartbeat ON public.user_instances(last_heartbeat DESC);

-- ============================================================================
-- 2. INSTANCE_CREDENTIALS_METADATA TABLE - Audit trail for credential usage
-- ============================================================================
-- NOTE: We NEVER store actual credentials. Only hash + metadata for audit.

CREATE TABLE IF NOT EXISTS public.instance_credentials_metadata (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  instance_id TEXT NOT NULL,  -- References user_instances(instance_id)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Credential information (hashed, not raw)
  provider TEXT NOT NULL,              -- 'anthropic', 'openai-codex', 'github-copilot', etc.
  credential_hash TEXT NOT NULL,       -- SHA-256 hash of credential (for verification only)
  scope TEXT DEFAULT 'general',        -- 'general' | 'coding-only'

  -- Usage tracking
  added_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_scope CHECK (scope IN ('general', 'coding-only')),
  CONSTRAINT hash_length CHECK (LENGTH(credential_hash) = 64),  -- SHA-256 produces 64 hex chars
  UNIQUE(instance_id, provider, credential_hash)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_instance_creds_instance_id ON public.instance_credentials_metadata(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_creds_user_id ON public.instance_credentials_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_instance_creds_provider ON public.instance_credentials_metadata(provider);
CREATE INDEX IF NOT EXISTS idx_instance_creds_last_used ON public.instance_credentials_metadata(last_used DESC);

-- ============================================================================
-- 3. ROW-LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE public.user_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_credentials_metadata ENABLE ROW LEVEL SECURITY;

-- USER_INSTANCES RLS Policies

-- Policy 1: Users can see their own instances
CREATE POLICY "Users see own instances"
  ON public.user_instances
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own instances
CREATE POLICY "Users insert own instances"
  ON public.user_instances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own instances
CREATE POLICY "Users update own instances"
  ON public.user_instances
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete their own instances
CREATE POLICY "Users delete own instances"
  ON public.user_instances
  FOR DELETE
  USING (auth.uid() = user_id);

-- INSTANCE_CREDENTIALS_METADATA RLS Policies

-- Policy 1: Users can see credential metadata for their instances
CREATE POLICY "Users see own instance credentials"
  ON public.instance_credentials_metadata
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert credential metadata for their instances
CREATE POLICY "Users insert own instance credentials"
  ON public.instance_credentials_metadata
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update credential metadata for their instances
CREATE POLICY "Users update own instance credentials"
  ON public.instance_credentials_metadata
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 4. UTILITY FUNCTIONS
-- ============================================================================

-- Function: Update last_heartbeat and is_online status
CREATE OR REPLACE FUNCTION update_instance_heartbeat(
  p_instance_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.user_instances
  SET
    last_heartbeat = NOW(),
    is_online = true,
    updated_at = NOW()
  WHERE instance_id = p_instance_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate is_online based on last_heartbeat (consider offline after 5 minutes)
CREATE OR REPLACE FUNCTION get_instance_online_status(
  p_instance_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT (NOW() - last_heartbeat) < INTERVAL '5 minutes'
    FROM public.user_instances
    WHERE instance_id = p_instance_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Log credential usage (update last_used timestamp)
CREATE OR REPLACE FUNCTION log_credential_usage(
  p_instance_id TEXT,
  p_provider TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.instance_credentials_metadata
  SET last_used = NOW()
  WHERE instance_id = p_instance_id AND provider = p_provider;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Trigger: Update updated_at timestamp when instance is modified
CREATE OR REPLACE FUNCTION update_user_instances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_user_instances_update_timestamp ON public.user_instances;
CREATE TRIGGER tr_user_instances_update_timestamp
  BEFORE UPDATE ON public.user_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_user_instances_updated_at();

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.user_instances IS
  'Tracks all devices/instances for each user. Enables cross-device sync and remote command execution.';

COMMENT ON COLUMN public.user_instances.instance_id IS
  'Unique identifier for this instance. UUID generated on device, persisted across restarts.';

COMMENT ON COLUMN public.user_instances.is_online IS
  'Calculated status: true if last_heartbeat within 5 minutes, false otherwise.';

COMMENT ON TABLE public.instance_credentials_metadata IS
  'Audit trail: which provider credentials were used on which instance. NEVER stores actual credentials - only SHA-256 hash for verification.';

COMMENT ON COLUMN public.instance_credentials_metadata.credential_hash IS
  'SHA-256 hash of the credential. Used for verification and audit purposes only. Can never recover the original credential from this hash.';

COMMENT ON COLUMN public.instance_credentials_metadata.scope IS
  'Scope of credential usage: "general" = all operations, "coding-only" = coding features only.';
