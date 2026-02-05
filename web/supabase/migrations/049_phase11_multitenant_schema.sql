-- ============================================================================
-- Phase 11: Multi-Tenant Architecture with Row-Level Security
-- Implements complete tenant isolation at database layer
-- ============================================================================

-- ============================================================================
-- 1. TENANT MANAGEMENT TABLES
-- ============================================================================

-- Tenants table: Represents isolated Helix consciousness instances
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT CHECK (tier IN ('free', 'pro', 'enterprise')) DEFAULT 'free',
  webhook_url TEXT,
  logo_url TEXT,
  members UUID[] DEFAULT ARRAY[]::UUID[],
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenants_owner ON tenants(owner_id);
CREATE INDEX idx_tenants_created ON tenants(created_at DESC);

-- Tenant members table: Fine-grained access control
CREATE TABLE IF NOT EXISTS tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member', 'viewer')) DEFAULT 'member',
  invited_at TIMESTAMP DEFAULT NOW(),
  joined_at TIMESTAMP,
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_role ON tenant_members(role);

-- ============================================================================
-- 2. ADD TENANT_ID TO EXISTING TABLES (Tenant Scoping)
-- ============================================================================

-- Migrate ai_operation_log table
ALTER TABLE ai_operation_log
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ai_op_log_tenant ON ai_operation_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_op_log_tenant_user ON ai_operation_log(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_op_log_tenant_date ON ai_operation_log(tenant_id, started_at DESC);

-- Migrate hash_chain_entries table
ALTER TABLE hash_chain_entries
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_hash_chain_tenant ON hash_chain_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hash_chain_tenant_index ON hash_chain_entries(tenant_id, index);

-- Migrate cost_trends table
ALTER TABLE cost_trends
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cost_trends_tenant ON cost_trends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_trends_tenant_date ON cost_trends(tenant_id, date DESC);

-- Migrate user_operation_preferences table
ALTER TABLE user_operation_preferences
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_user_prefs_tenant ON user_operation_preferences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_prefs_tenant_op ON user_operation_preferences(tenant_id, operation_id);

-- Create alerts table (new for Phase 10/11)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id UUID,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  triggered_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  acknowledged_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(triggered_at DESC);

-- Create user_settings table for per-tenant preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'auto',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_tenant ON user_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- ============================================================================
-- 3. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_operation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE hash_chain_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_operation_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for tenants table
-- ============================================================================

DROP POLICY IF EXISTS tenant_access_policy ON tenants;
CREATE POLICY tenant_access_policy ON tenants
  FOR SELECT
  USING (
    owner_id = auth.uid() OR
    auth.uid() = ANY(members)
  );

DROP POLICY IF EXISTS tenant_insert_policy ON tenants;
CREATE POLICY tenant_insert_policy ON tenants
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS tenant_update_policy ON tenants;
CREATE POLICY tenant_update_policy ON tenants
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================================
-- RLS Policies for tenant_members table
-- ============================================================================

DROP POLICY IF EXISTS tenant_members_view_policy ON tenant_members;
CREATE POLICY tenant_members_view_policy ON tenant_members
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

DROP POLICY IF EXISTS tenant_members_insert_policy ON tenant_members;
CREATE POLICY tenant_members_insert_policy ON tenant_members
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS Policies for ai_operation_log table
-- ============================================================================

DROP POLICY IF EXISTS ai_op_log_tenant_policy ON ai_operation_log;
CREATE POLICY ai_op_log_tenant_policy ON ai_operation_log
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

DROP POLICY IF EXISTS ai_op_log_insert_policy ON ai_operation_log;
CREATE POLICY ai_op_log_insert_policy ON ai_operation_log
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- ============================================================================
-- RLS Policies for hash_chain_entries table
-- ============================================================================

DROP POLICY IF EXISTS hash_chain_tenant_policy ON hash_chain_entries;
CREATE POLICY hash_chain_tenant_policy ON hash_chain_entries
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

DROP POLICY IF EXISTS hash_chain_insert_policy ON hash_chain_entries;
CREATE POLICY hash_chain_insert_policy ON hash_chain_entries
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- ============================================================================
-- RLS Policies for cost_trends table
-- ============================================================================

DROP POLICY IF EXISTS cost_trends_tenant_policy ON cost_trends;
CREATE POLICY cost_trends_tenant_policy ON cost_trends
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

DROP POLICY IF EXISTS cost_trends_insert_policy ON cost_trends;
CREATE POLICY cost_trends_insert_policy ON cost_trends
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- ============================================================================
-- RLS Policies for user_operation_preferences table
-- ============================================================================

DROP POLICY IF EXISTS user_prefs_tenant_policy ON user_operation_preferences;
CREATE POLICY user_prefs_tenant_policy ON user_operation_preferences
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

DROP POLICY IF EXISTS user_prefs_insert_policy ON user_operation_preferences;
CREATE POLICY user_prefs_insert_policy ON user_operation_preferences
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- ============================================================================
-- RLS Policies for alerts table
-- ============================================================================

DROP POLICY IF EXISTS alerts_tenant_policy ON alerts;
CREATE POLICY alerts_tenant_policy ON alerts
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

DROP POLICY IF EXISTS alerts_insert_policy ON alerts;
CREATE POLICY alerts_insert_policy ON alerts
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- ============================================================================
-- RLS Policies for user_settings table
-- ============================================================================

DROP POLICY IF EXISTS user_settings_policy ON user_settings;
CREATE POLICY user_settings_policy ON user_settings
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS user_settings_insert_policy ON user_settings;
CREATE POLICY user_settings_insert_policy ON user_settings
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to set tenant context (called before RLS-filtered queries)
DROP FUNCTION IF EXISTS set_tenant_context(UUID);
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current tenant ID from context
DROP FUNCTION IF EXISTS get_tenant_context();
CREATE OR REPLACE FUNCTION get_tenant_context()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', TRUE)::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify user has access to tenant
DROP FUNCTION IF EXISTS user_has_tenant_access(UUID);
CREATE OR REPLACE FUNCTION user_has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM tenants
    WHERE id = p_tenant_id
    AND (owner_id = auth.uid() OR auth.uid() = ANY(members))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. AUDIT LOGGING
-- ============================================================================

-- Create audit log table for tenant operations
CREATE TABLE IF NOT EXISTS tenant_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  changes JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenant_audit_tenant ON tenant_audit_log(tenant_id);
CREATE INDEX idx_tenant_audit_user ON tenant_audit_log(user_id);
CREATE INDEX idx_tenant_audit_timestamp ON tenant_audit_log(timestamp DESC);

-- Enable RLS on audit log
ALTER TABLE tenant_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_audit_policy ON tenant_audit_log;
CREATE POLICY tenant_audit_policy ON tenant_audit_log
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- Function to log tenant operations
DROP FUNCTION IF EXISTS log_tenant_operation(UUID, TEXT, TEXT, UUID, JSONB);
CREATE OR REPLACE FUNCTION log_tenant_operation(
  p_tenant_id UUID,
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_changes JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO tenant_audit_log (
    tenant_id, user_id, action, resource_type, resource_id, changes
  )
  VALUES (p_tenant_id, auth.uid(), p_action, p_resource_type, p_resource_id, p_changes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. DATA MIGRATION: Assign default tenants to existing users
-- ============================================================================

-- Create default tenants for users with operations but no tenant
DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_cursor CURSOR FOR
    SELECT DISTINCT user_id FROM ai_operation_log
    WHERE tenant_id IS NULL;
BEGIN
  FOR v_user_id IN (
    SELECT DISTINCT user_id FROM ai_operation_log
    WHERE tenant_id IS NULL
    UNION
    SELECT DISTINCT user_id FROM hash_chain_entries
    WHERE tenant_id IS NULL
  ) LOOP
    -- Create default tenant for this user
    INSERT INTO tenants (name, owner_id, tier)
    VALUES (
      'Default Helix Instance (Migrated)',
      v_user_id,
      'free'
    )
    RETURNING id INTO v_tenant_id;

    -- Assign all their operations to this tenant
    UPDATE ai_operation_log
    SET tenant_id = v_tenant_id
    WHERE user_id = v_user_id AND tenant_id IS NULL;

    -- Assign hash chain entries
    UPDATE hash_chain_entries
    SET tenant_id = v_tenant_id
    WHERE user_id = v_user_id AND tenant_id IS NULL;

    -- Assign cost trends
    UPDATE cost_trends
    SET tenant_id = v_tenant_id
    WHERE user_id = v_user_id AND tenant_id IS NULL;

    -- Assign user preferences
    UPDATE user_operation_preferences
    SET tenant_id = v_tenant_id
    WHERE user_id = v_user_id AND tenant_id IS NULL;

    -- Log the migration
    INSERT INTO tenant_audit_log (tenant_id, user_id, action)
    VALUES (v_tenant_id, v_user_id, 'auto_created_during_migration');
  END LOOP;
END $$;

-- ============================================================================
-- 7. VERIFICATION: Ensure all tables have tenant_id
-- ============================================================================

-- Add NOT NULL constraint to tenant_id columns after migration
-- (commented out until migration is complete)
-- ALTER TABLE ai_operation_log ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE hash_chain_entries ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE cost_trends ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE alerts ALTER COLUMN tenant_id SET NOT NULL;
