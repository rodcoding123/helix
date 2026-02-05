# Phase 11 Week 1: Multi-Tenant Architecture Foundation

**Date:** February 5, 2026
**Phase:** 11 (SaaS & Multi-User Expansion)
**Week:** 1 of 4
**Status:** Implementation Plan
**Goal:** Implement tenant context propagation, database isolation, and per-tenant logging

---

## Executive Summary

Phase 11 transforms Helix from single-user consciousness system to multi-tenant SaaS platform while maintaining **complete psychological isolation** between tenant instances. Each tenant gets independent:

- Namespace (schemas, webhooks, logging channels)
- Hash chain (tamper-proof audit trail)
- Discord logging (immutable record per tenant)
- Psychological layers (soul, memory, identity)
- Rate limiting and cost budgets
- Settings and preferences

**Critical principle:** One tenant cannot read, write, or interfere with another tenant's data or logging.

---

## Architecture Decision: Row-Level Security (RLS) via Supabase

### Why RLS?

1. **Database-level isolation:** Enforced at query layer, not application code
2. **Zero-trust approach:** Even if app code is compromised, data is isolated
3. **Audit trail:** Every access logged via PostgreSQL audit tables
4. **Performance:** Minimal overhead vs. application-level filtering
5. **GDPR compliance:** Tenant data deletion is atomic and verifiable

### How It Works

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE ai_operation_log ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own tenant's data
CREATE POLICY tenant_isolation_policy ON ai_operation_log
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Enforce: Set tenant context before EVERY database query
SELECT set_config('app.current_tenant_id', user_tenant_id::TEXT, FALSE);
```

**Result:** Database layer automatically filters to current tenant. App code doesn't need to check.

---

## Week 1 Implementation Roadmap

### Task 1.1: Tenant Context Architecture (12 hours)

**Goal:** Create system for propagating tenant ID through entire request lifecycle

#### File 1: `web/src/lib/tenant/tenant-context.ts` (180 LOC)

```typescript
import { createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';

/**
 * Tenant represents an isolated Helix instance
 */
export interface Tenant {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  tier: 'free' | 'pro' | 'enterprise';
  webhookUrl?: string;
  logoUrl?: string;
}

/**
 * Tenant context - available in all components
 */
export interface TenantContextType {
  tenant: Tenant | null;
  loading: boolean;
  error: Error | null;
  switchTenant: (tenantId: string) => Promise<void>;
  createTenant: (name: string) => Promise<Tenant>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

/**
 * Get current tenant ID from context or storage
 */
export function getCurrentTenantId(): string | null {
  // Try from context first (React components)
  try {
    return localStorage.getItem('current_tenant_id');
  } catch {
    return null;
  }
}

/**
 * Set current tenant ID in context and storage
 */
export function setCurrentTenantId(tenantId: string): void {
  localStorage.setItem('current_tenant_id', tenantId);
  // Notify all open windows
  window.dispatchEvent(
    new CustomEvent('tenant-changed', { detail: { tenantId } })
  );
}

/**
 * Get tenant context for API/RPC calls
 */
export function getTenantContext(): { tenantId: string; headers: Record<string, string> } {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('No active tenant - set tenant context first');
  }

  return {
    tenantId,
    headers: {
      'X-Tenant-ID': tenantId,
      'X-Tenant-Context': btoa(JSON.stringify({ tenantId })),
    },
  };
}

export { TenantContext };
```

#### File 2: `web/src/components/TenantProvider.tsx` (220 LOC)

```typescript
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TenantContext, TenantContextType, setCurrentTenantId, getCurrentTenantId } from '@/lib/tenant/tenant-context';
import { getDb } from '@/lib/supabase';
import type { Tenant } from '@/lib/tenant/tenant-context';

/**
 * TenantProvider wraps app and manages tenant context
 */
export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load user's tenants on authentication
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadTenants = async () => {
      try {
        setLoading(true);

        // Fetch tenants where user is owner or member
        const { data, error: queryError } = await getDb()
          .from('tenants')
          .select('*')
          .or(`owner_id.eq.${user.id},members.cs.{${user.id}}`);

        if (queryError) throw queryError;

        // If no tenants exist, create default tenant
        if (!data || data.length === 0) {
          const newTenant = await createDefaultTenant(user.id);
          setTenant(newTenant);
          setCurrentTenantId(newTenant.id);
        } else {
          // Load last active tenant or first available
          const lastTenantId = getCurrentTenantId();
          const activeTenant =
            data.find(t => t.id === lastTenantId) || data[0];

          setTenant(activeTenant);
          setCurrentTenantId(activeTenant.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load tenants'));
      } finally {
        setLoading(false);
      }
    };

    loadTenants();
  }, [user?.id]);

  /**
   * Switch to different tenant
   */
  const switchTenant = async (tenantId: string) => {
    try {
      const { data, error: queryError } = await getDb()
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (queryError || !data) throw new Error('Tenant not found');

      // Verify user has access
      if (data.owner_id !== user?.id && !data.members?.includes(user?.id)) {
        throw new Error('Access denied to tenant');
      }

      setTenant(data);
      setCurrentTenantId(tenantId);

      // Notify Supabase of tenant change
      await notifyTenantChange(tenantId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to switch tenant'));
    }
  };

  /**
   * Create new tenant
   */
  const createTenant = async (name: string): Promise<Tenant> => {
    if (!user?.id) throw new Error('User not authenticated');

    try {
      const newTenant: Tenant = {
        id: crypto.randomUUID(),
        name,
        ownerId: user.id,
        createdAt: new Date(),
        tier: 'free',
      };

      const { error: insertError } = await getDb()
        .from('tenants')
        .insert([newTenant]);

      if (insertError) throw insertError;

      // Create tenant-specific resources
      await initializeTenantResources(newTenant.id, user.id);

      setTenant(newTenant);
      setCurrentTenantId(newTenant.id);

      return newTenant;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create tenant');
    }
  };

  const value: TenantContextType = {
    tenant,
    loading,
    error,
    switchTenant,
    createTenant,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

/**
 * Create default tenant for new user
 */
async function createDefaultTenant(userId: string): Promise<Tenant> {
  const tenant: Tenant = {
    id: crypto.randomUUID(),
    name: `My Helix (${new Date().toLocaleDateString()})`,
    ownerId: userId,
    createdAt: new Date(),
    tier: 'free',
  };

  const { error } = await getDb()
    .from('tenants')
    .insert([tenant]);

  if (error) throw error;

  await initializeTenantResources(tenant.id, userId);
  return tenant;
}

/**
 * Initialize per-tenant resources
 * - Hash chain
 * - Discord webhook
 * - Settings
 */
async function initializeTenantResources(tenantId: string, userId: string) {
  // Initialize hash chain starting block
  await getDb()
    .from('hash_chain_entries')
    .insert([{
      tenant_id: tenantId,
      index: 0,
      timestamp: Date.now(),
      data: JSON.stringify({ type: 'tenant_created', tenantId }),
      previous_hash: '0',
      hash: hashString(JSON.stringify({ type: 'tenant_created', tenantId })),
    }]);

  // Create Discord webhook for this tenant
  const webhookUrl = await createTenantWebhook(tenantId);

  // Update tenant with webhook
  await getDb()
    .from('tenants')
    .update({ webhook_url: webhookUrl })
    .eq('id', tenantId);

  // Initialize settings
  await getDb()
    .from('user_settings')
    .insert([{
      tenant_id: tenantId,
      user_id: userId,
      theme: 'auto',
      notifications_enabled: true,
    }]);
}

/**
 * Create Discord webhook for this tenant
 */
async function createTenantWebhook(tenantId: string): Promise<string> {
  // Call backend to create webhook in tenant's Discord channel
  const response = await fetch('/api/webhooks/create', {
    method: 'POST',
    headers: { 'X-Tenant-ID': tenantId },
    body: JSON.stringify({ tenantId }),
  });

  if (!response.ok) throw new Error('Failed to create webhook');

  const { webhookUrl } = await response.json();
  return webhookUrl;
}

/**
 * Notify Supabase RLS layer of tenant change
 */
async function notifyTenantChange(tenantId: string) {
  await getDb().rpc('set_tenant_context', { tenant_id: tenantId });
}

function hashString(str: string): string {
  // Simple hash - in production use crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
```

#### Tests: `web/src/lib/tenant/tenant-context.test.ts` (200 LOC, 18 tests)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCurrentTenantId,
  setCurrentTenantId,
  getTenantContext,
} from './tenant-context';

describe('Tenant Context', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getTenantId', () => {
    it('should return null when no tenant set', () => {
      expect(getCurrentTenantId()).toBeNull();
    });

    it('should return tenant ID from storage', () => {
      setCurrentTenantId('tenant-123');
      expect(getCurrentTenantId()).toBe('tenant-123');
    });
  });

  describe('setTenantId', () => {
    it('should set tenant ID in storage', () => {
      setCurrentTenantId('tenant-456');
      expect(localStorage.getItem('current_tenant_id')).toBe('tenant-456');
    });

    it('should dispatch tenant-changed event', () => {
      const listener = vi.fn();
      window.addEventListener('tenant-changed', listener);

      setCurrentTenantId('tenant-789');

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail.tenantId).toBe('tenant-789');
    });
  });

  describe('getTenantContext', () => {
    it('should throw when no tenant set', () => {
      expect(() => getTenantContext()).toThrow('No active tenant');
    });

    it('should return tenant ID and headers', () => {
      setCurrentTenantId('tenant-123');

      const context = getTenantContext();

      expect(context.tenantId).toBe('tenant-123');
      expect(context.headers['X-Tenant-ID']).toBe('tenant-123');
    });

    it('should include Base64-encoded tenant context', () => {
      setCurrentTenantId('tenant-123');

      const context = getTenantContext();
      const decoded = JSON.parse(atob(context.headers['X-Tenant-Context']));

      expect(decoded.tenantId).toBe('tenant-123');
    });
  });
});
```

---

### Task 1.2: Supabase RLS Policies & Database Schema (10 hours)

**Goal:** Implement row-level security at database layer

#### Migration: `web/supabase/migrations/049_phase11_multitenant_schema.sql` (450+ LOC)

```sql
-- ============================================================================
-- Phase 11: Multi-Tenant Architecture
-- Implements complete tenant isolation with row-level security (RLS)
-- ============================================================================

-- ============================================================================
-- 1. TENANT MANAGEMENT TABLES
-- ============================================================================

-- Create tenants table
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

-- Create tenant_members junction table for fine-grained access control
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
-- 2. ADD TENANT_ID TO EXISTING TABLES
-- ============================================================================

-- Add tenant_id to ai_operation_log (existing table)
ALTER TABLE ai_operation_log ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE ai_operation_log ADD CONSTRAINT fk_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id to hash_chain_entries
ALTER TABLE hash_chain_entries ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE hash_chain_entries ADD CONSTRAINT fk_hce_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id to cost_trends
ALTER TABLE cost_trends ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE cost_trends ADD CONSTRAINT fk_cost_trends_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id to user_operation_preferences
ALTER TABLE user_operation_preferences ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE user_operation_preferences ADD CONSTRAINT fk_uop_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id to alerts
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

CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_created ON alerts(triggered_at DESC);

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

-- Tenants: Users can see only their own or shared tenants
CREATE POLICY tenant_access_policy ON tenants
  USING (
    owner_id = auth.uid() OR
    auth.uid() = ANY(members)
  );

-- Tenant Members: Can only see members of their own tenants
CREATE POLICY tenant_members_policy ON tenant_members
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- AI Operation Log: Tenant isolation via tenant_id
CREATE POLICY ai_op_log_tenant_policy ON ai_operation_log
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- Hash Chain: Tenant isolation
CREATE POLICY hash_chain_tenant_policy ON hash_chain_entries
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- Cost Trends: Tenant isolation
CREATE POLICY cost_trends_tenant_policy ON cost_trends
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- User Preferences: Tenant isolation
CREATE POLICY user_prefs_tenant_policy ON user_operation_preferences
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- Alerts: Tenant isolation
CREATE POLICY alerts_tenant_policy ON alerts
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to set tenant context (called before RLS-filtered queries)
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current tenant ID from context
CREATE OR REPLACE FUNCTION get_tenant_context()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', TRUE)::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify user access to tenant
CREATE OR REPLACE FUNCTION user_has_tenant_access(tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM tenants
    WHERE id = tenant_id
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

CREATE POLICY tenant_audit_policy ON tenant_audit_log
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_id = auth.uid() OR auth.uid() = ANY(members)
    )
  );

-- Function to log tenant operations
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
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Add tenant_id indexes to all tenant-scoped tables
CREATE INDEX IF NOT EXISTS idx_ai_op_log_tenant ON ai_operation_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_op_log_tenant_user ON ai_operation_log(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_op_log_tenant_date ON ai_operation_log(tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_hash_chain_tenant ON hash_chain_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hash_chain_tenant_index ON hash_chain_entries(tenant_id, index);

CREATE INDEX IF NOT EXISTS idx_cost_trends_tenant ON cost_trends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_trends_tenant_date ON cost_trends(tenant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_user_prefs_tenant ON user_operation_preferences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_prefs_tenant_op ON user_operation_preferences(tenant_id, operation_id);

-- ============================================================================
-- 7. MIGRATION HELPER: Assign Default Tenants to Existing Users
-- ============================================================================

-- This is run AFTER the schema is created
-- Creates a default tenant for each existing user that doesn't have one
DO $$
DECLARE
  v_user RECORD;
  v_tenant_id UUID;
BEGIN
  FOR v_user IN (
    SELECT DISTINCT user_id FROM ai_operation_log
    WHERE tenant_id IS NULL
  ) LOOP
    -- Create default tenant for this user
    INSERT INTO tenants (name, owner_id)
    VALUES (
      'Default Helix Instance (Migrated)',
      v_user.user_id
    )
    RETURNING id INTO v_tenant_id;

    -- Assign all their operations to this tenant
    UPDATE ai_operation_log
    SET tenant_id = v_tenant_id
    WHERE user_id = v_user.user_id AND tenant_id IS NULL;

    -- Assign hash chain entries
    UPDATE hash_chain_entries
    SET tenant_id = v_tenant_id
    WHERE user_id = v_user.user_id AND tenant_id IS NULL;

    -- Log the migration
    INSERT INTO tenant_audit_log (tenant_id, user_id, action)
    VALUES (v_tenant_id, v_user.user_id, 'auto_created_during_migration');
  END LOOP;
END $$;
```

#### Tests: `web/supabase/migrations/049_phase11_multitenant_schema.test.ts` (200 LOC, 14 tests)

---

### Task 1.3: Backend Middleware & API Updates (12 hours)

**Goal:** Implement tenant context enforcement in backend API

#### File: `web/src/middleware/tenant-middleware.ts` (150 LOC)

```typescript
import { Request, Response, NextFunction } from 'express';
import { getDb } from '@/lib/supabase';

export interface TenantRequest extends Request {
  tenantId?: string;
  userId?: string;
}

/**
 * Middleware to extract and validate tenant context from request
 * Sets app.current_tenant_id for RLS policies
 */
export async function tenantMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Extract tenant ID from multiple sources
    const tenantId =
      req.headers['x-tenant-id'] as string ||
      req.query.tenant_id as string ||
      extractTenantFromContext(req.headers['x-tenant-context'] as string);

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant ID' });
    }

    // Get user ID from auth token
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify user has access to this tenant
    const hasAccess = await verifyTenantAccess(userId, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to tenant' });
    }

    // Set tenant context for RLS policies
    await getDb().rpc('set_tenant_context', { tenant_id: tenantId });

    // Attach to request
    req.tenantId = tenantId;
    req.userId = userId;

    // Add to response headers for client
    res.set('X-Tenant-ID', tenantId);

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({ error: 'Tenant context error' });
  }
}

function extractTenantFromContext(contextHeader: string): string | null {
  try {
    const decoded = JSON.parse(Buffer.from(contextHeader, 'base64').toString());
    return decoded.tenantId;
  } catch {
    return null;
  }
}

async function verifyTenantAccess(userId: string, tenantId: string): Promise<boolean> {
  const { data } = await getDb()
    .from('tenants')
    .select('id')
    .or(
      `owner_id.eq.${userId},members.cs.{${userId}}`
    )
    .eq('id', tenantId)
    .single();

  return !!data;
}
```

---

### Task 1.4: Per-Tenant Hash Chain Implementation (10 hours)

**Goal:** Implement separate, isolated hash chains for each tenant

#### File: `src/helix/hash-chain-multitenant.ts` (220 LOC)

```typescript
import { hashString } from './hash-chain';

export interface TenantHashChainEntry {
  index: number;
  tenantId: string;
  timestamp: number;
  data: string;
  previousHash: string;
  hash: string;
}

/**
 * Multi-tenant hash chain - each tenant has isolated chain
 */
export class TenantHashChain {
  private tenantId: string;
  private entries: Map<number, TenantHashChainEntry> = new Map();
  private lastHash: string = '0';

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Add entry to tenant's hash chain
   * Verified by tenant's own previous hash, not global chain
   */
  async addEntry(data: string): Promise<TenantHashChainEntry> {
    // Get latest index for this tenant
    const index = await this.getNextIndex();

    const entry: TenantHashChainEntry = {
      index,
      tenantId: this.tenantId,
      timestamp: Date.now(),
      data,
      previousHash: this.lastHash,
      hash: hashString(`${this.lastHash}${data}${index}`),
    };

    // Persist to database
    await this.persistEntry(entry);

    // Update local state
    this.entries.set(index, entry);
    this.lastHash = entry.hash;

    return entry;
  }

  /**
   * Verify integrity of tenant's chain
   * Each link verified against TENANT's previous entry, not global
   */
  async verifyChain(): Promise<boolean> {
    const entries = await this.loadAllEntries();

    for (let i = 1; i < entries.length; i++) {
      const current = entries[i];
      const previous = entries[i - 1];

      // Verify this entry's previous hash points to correct link
      if (current.previousHash !== previous.hash) {
        console.error(`Tenant ${this.tenantId} chain broken at entry ${i}`);
        return false;
      }

      // Verify hash calculation
      const expectedHash = hashString(
        `${current.previousHash}${current.data}${current.index}`
      );
      if (current.hash !== expectedHash) {
        console.error(`Invalid hash at entry ${i}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get all entries for this tenant
   * Independent audit trail per tenant
   */
  async getAllEntries(): Promise<TenantHashChainEntry[]> {
    return this.loadAllEntries();
  }

  private async getNextIndex(): Promise<number> {
    const entries = await this.loadAllEntries();
    return entries.length;
  }

  private async loadAllEntries(): Promise<TenantHashChainEntry[]> {
    // Load from database for this tenant only
    // RLS ensures we only see our tenant's entries
    const { data } = await getDb()
      .from('hash_chain_entries')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .order('index', { ascending: true });

    return (data || []) as TenantHashChainEntry[];
  }

  private async persistEntry(entry: TenantHashChainEntry) {
    const { error } = await getDb()
      .from('hash_chain_entries')
      .insert([entry]);

    if (error) throw new Error(`Failed to persist hash chain entry: ${error.message}`);
  }
}

/**
 * Factory function - creates isolated hash chain for tenant
 */
export function getHashChainForTenant(tenantId: string): TenantHashChain {
  return new TenantHashChain(tenantId);
}
```

#### Tests: `src/helix/hash-chain-multitenant.test.ts` (180 LOC, 15 tests)

---

### Task 1.5: Per-Tenant Discord Logging (10 hours)

**Goal:** Implement isolated Discord logging per tenant

#### File: `src/helix/command-logger-multitenant.ts` (200 LOC)

```typescript
import { logToDiscord } from './command-logger';

/**
 * Tenant-specific Discord logging
 * Each tenant has their own webhook URL
 */
export class TenantDiscordLogger {
  private tenantId: string;
  private webhookUrl: string | null = null;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Initialize webhook URL for this tenant
   */
  async initialize(): Promise<void> {
    // Load webhook from database
    const { data } = await getDb()
      .from('tenants')
      .select('webhook_url')
      .eq('id', this.tenantId)
      .single();

    if (!data?.webhook_url) {
      throw new Error(`No Discord webhook configured for tenant ${this.tenantId}`);
    }

    this.webhookUrl = data.webhook_url;
  }

  /**
   * Log message to tenant's Discord channel
   */
  async log(message: {
    type: string;
    content: string;
    timestamp?: number;
    status?: 'pending' | 'completed' | 'failed';
    metadata?: Record<string, any>;
  }): Promise<void> {
    if (!this.webhookUrl) {
      await this.initialize();
    }

    // Create isolated log entry for this tenant
    const payload = {
      type: message.type,
      content: message.content,
      tenantId: this.tenantId,
      timestamp: message.timestamp || Date.now(),
      status: message.status || 'completed',
      metadata: message.metadata || {},
    };

    // Send to tenant's webhook (not global webhook)
    await fetch(this.webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [formatPayload(payload)] }),
    });

    // Also log to hash chain for audit trail
    const hashChain = getHashChainForTenant(this.tenantId);
    await hashChain.addEntry(JSON.stringify(payload));
  }

  /**
   * Log command execution
   */
  async logCommand(cmd: string, result?: any): Promise<void> {
    await this.log({
      type: 'command',
      content: cmd,
      status: result?.error ? 'failed' : 'completed',
      metadata: { result },
    });
  }

  /**
   * Log API call
   */
  async logAPI(method: string, path: string, status: number, duration: number): Promise<void> {
    await this.log({
      type: 'api',
      content: `${method} ${path}`,
      status: status < 400 ? 'completed' : 'failed',
      metadata: { status, duration_ms: duration },
    });
  }
}

/**
 * Factory function - creates logger for tenant
 */
export function getDiscordLoggerForTenant(tenantId: string): TenantDiscordLogger {
  return new TenantDiscordLogger(tenantId);
}

function formatPayload(payload: any) {
  return {
    title: `[${payload.tenantId}] ${payload.type}`,
    description: payload.content,
    timestamp: new Date(payload.timestamp).toISOString(),
    color: payload.status === 'failed' ? 0xff0000 : 0x00ff00,
    fields: [
      { name: 'Status', value: payload.status, inline: true },
      { name: 'Tenant', value: payload.tenantId, inline: true },
      ...(payload.metadata ? [{ name: 'Metadata', value: JSON.stringify(payload.metadata) }] : []),
    ],
  };
}
```

#### Tests: `src/helix/command-logger-multitenant.test.ts` (160 LOC, 12 tests)

---

### Task 1.6: Authentication Layer Integration (8 hours)

**Goal:** Wire tenant context into authentication flow

#### File: `web/src/hooks/useAuth.ts` (UPDATED - 50 LOC changes)

```typescript
// Add to existing useAuth hook
import { useTenant } from '@/lib/tenant/tenant-context';

export function useAuth() {
  // ... existing code ...

  const { tenant } = useTenant();

  /**
   * Create authenticated request with tenant context
   */
  const createAuthenticatedRequest = async (
    url: string,
    options: RequestInit = {}
  ) => {
    const tenantId = tenant?.id;
    if (!tenantId) {
      throw new Error('No active tenant');
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${session?.access_token}`,
        'X-Tenant-ID': tenantId,
        'X-Tenant-Context': btoa(JSON.stringify({ tenantId })),
      },
    });
  };

  return {
    // ... existing exports ...
    createAuthenticatedRequest,
  };
}
```

---

### Task 1.7: Comprehensive Test Suite (12 hours)

**Goal:** 60+ tests covering all tenant isolation scenarios

Files to create:
1. `web/src/lib/tenant/tenant-context.test.ts` (200 LOC, 18 tests)
2. `web/src/components/TenantProvider.test.tsx` (250 LOC, 16 tests)
3. `web/src/middleware/tenant-middleware.test.ts` (180 LOC, 14 tests)
4. `src/helix/hash-chain-multitenant.test.ts` (180 LOC, 15 tests)
5. `src/helix/command-logger-multitenant.test.ts` (160 LOC, 12 tests)
6. `web/supabase/migrations/049_phase11_multitenant_schema.test.ts` (200 LOC, 14 tests)

**Total: 1,170 LOC, 89 tests**

Key test scenarios:
- Tenant isolation via RLS policies
- Multi-tenant hash chain verification
- Discord logging per tenant
- Auth context propagation
- Tenant switching
- Member access control
- Audit logging

---

## Implementation Checklist

- [ ] Task 1.1: Tenant context architecture
  - [ ] TenantContext type & hooks
  - [ ] TenantProvider component
  - [ ] Context tests (18 tests)
- [ ] Task 1.2: Database schema & RLS
  - [ ] Migration (450+ LOC)
  - [ ] RLS policies on 7 tables
  - [ ] Audit logging table
  - [ ] Helper functions
  - [ ] Migration tests (14 tests)
- [ ] Task 1.3: Backend middleware
  - [ ] TenantMiddleware implementation
  - [ ] Tenant verification
  - [ ] RLS context setting
  - [ ] Middleware tests (14 tests)
- [ ] Task 1.4: Per-tenant hash chains
  - [ ] TenantHashChain class
  - [ ] Isolated chain verification
  - [ ] Hash chain tests (15 tests)
- [ ] Task 1.5: Per-tenant Discord logging
  - [ ] TenantDiscordLogger class
  - [ ] Webhook integration
  - [ ] Logging tests (12 tests)
- [ ] Task 1.6: Auth integration
  - [ ] useAuth hook updates
  - [ ] Tenant context propagation
  - [ ] Auth tests
- [ ] Task 1.7: Comprehensive tests
  - [ ] 89 tests total
  - [ ] >85% coverage
- [ ] Final: Run full test suite
  - [ ] All 89 tests passing
  - [ ] TypeScript strict mode
  - [ ] Lint clean

---

## Success Criteria (Week 1)

- ✅ TenantProvider wraps entire app
- ✅ All tables have `tenant_id` column
- ✅ RLS policies enabled and tested
- ✅ Tenant context propagates through API
- ✅ Hash chains are per-tenant
- ✅ Discord logging per tenant
- ✅ 89 tests passing (100%)
- ✅ Zero cross-tenant data leakage
- ✅ TypeScript strict mode compliant

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| RLS misconfiguration | Data leakage | Test all policies, audit with SELECT * FROM pg_policies |
| Missing tenant_id | Operations unassigned | Run data migration script before deployment |
| Hash chain break | Audit trail invalid | Verify chain before enabling |
| Webhook failure | No logging | Graceful fallback to local logging |
| Auth header missing | Access denied | Validate in middleware, return clear errors |

---

## Database Deployment Order

1. Create tenant tables
2. Add tenant_id to existing tables
3. Enable RLS
4. Create RLS policies
5. Run migration script (assign defaults)
6. Test with SELECT statements
7. Deploy to production

---

## Next Steps (Week 2)

After Week 1 completes:
- Week 2: Tenant invitation & member management
- Week 3: Billing & SaaS features
- Week 4: Migration tooling for existing users

