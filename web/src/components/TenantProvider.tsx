/**
 * Phase 11 Week 1: TenantProvider Component
 * Wraps entire app to provide tenant context
 */

import { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  TenantContext,
  TenantContextType,
  setCurrentTenantId,
  getCurrentTenantId,
  type Tenant,
} from '@/lib/tenant/tenant-context';
import { getDb } from '@/lib/supabase';

interface TenantProviderProps {
  children: ReactNode;
}

/**
 * TenantProvider manages tenant context for entire app
 * - Loads user's tenants on authentication
 * - Manages tenant switching
 * - Creates new tenants
 * - Persists tenant preference
 */
export function TenantProvider({ children }: TenantProviderProps) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load user's tenants when authenticated
  useEffect(() => {
    if (!user?.id) {
      setTenant(null);
      setLoading(false);
      return;
    }

    const loadTenants = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all tenants where user is owner or member
        const { data, error: queryError } = await getDb()
          .from('tenants')
          .select('*')
          .or(`owner_id.eq.${user.id},members.cs.{${user.id}}`);

        if (queryError) throw queryError;

        // If no tenants, create default tenant
        if (!data || data.length === 0) {
          const newTenant = await createDefaultTenant(user.id);
          setTenant(newTenant);
          setCurrentTenantId(newTenant.id);
        } else {
          // Use last active tenant or first available
          const lastTenantId = getCurrentTenantId();
          const activeTenant = lastTenantId
            ? data.find(t => t.id === lastTenantId)
            : null;

          const tenantToUse = activeTenant || data[0];
          const formattedTenant = formatTenant(tenantToUse);

          setTenant(formattedTenant);
          setCurrentTenantId(formattedTenant.id);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load tenants');
        setError(error);
        console.error('Failed to load tenants:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTenants();
  }, [user?.id]);

  /**
   * Switch to different tenant
   */
  const switchTenant = async (tenantId: string): Promise<void> => {
    try {
      setError(null);

      const { data, error: queryError } = await getDb()
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (queryError) throw queryError;
      if (!data) throw new Error('Tenant not found');

      // Verify user has access to this tenant
      const hasAccess =
        data.owner_id === user?.id || (data.members || []).includes(user?.id);

      if (!hasAccess) {
        throw new Error('You do not have access to this tenant');
      }

      const formattedTenant = formatTenant(data);
      setTenant(formattedTenant);
      setCurrentTenantId(tenantId);

      // Notify backend of tenant change for RLS context
      await notifyTenantChange(tenantId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to switch tenant');
      setError(error);
      throw error;
    }
  };

  /**
   * Create new tenant
   */
  const createTenant = async (name: string): Promise<Tenant> => {
    if (!user?.id) throw new Error('User not authenticated');

    try {
      setError(null);

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

      // Initialize tenant resources (hash chain, webhook, settings)
      await initializeTenantResources(newTenant.id, user.id);

      setTenant(newTenant);
      setCurrentTenantId(newTenant.id);

      return newTenant;
    } catch (err) {
      const error = err instanceof Error
        ? err
        : new Error('Failed to create tenant');
      setError(error);
      throw error;
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
 * Format database tenant row to Tenant interface
 */
function formatTenant(data: any): Tenant {
  return {
    id: data.id,
    name: data.name,
    ownerId: data.owner_id,
    createdAt: new Date(data.created_at),
    tier: data.tier || 'free',
    webhookUrl: data.webhook_url,
    logoUrl: data.logo_url,
  };
}

/**
 * Create default tenant for new user
 */
async function createDefaultTenant(userId: string): Promise<Tenant> {
  const newTenant: Tenant = {
    id: crypto.randomUUID(),
    name: `My Helix Instance`,
    ownerId: userId,
    createdAt: new Date(),
    tier: 'free',
  };

  const { error: insertError } = await getDb()
    .from('tenants')
    .insert([newTenant]);

  if (insertError) throw insertError;

  await initializeTenantResources(newTenant.id, userId);
  return newTenant;
}

/**
 * Initialize per-tenant resources:
 * - Hash chain starting entry
 * - Discord webhook
 * - User settings
 */
async function initializeTenantResources(
  tenantId: string,
  userId: string
): Promise<void> {
  try {
    // Create initial hash chain entry
    const initialHash = hashString(JSON.stringify({ type: 'tenant_created', tenantId }));

    const { error: hashError } = await getDb()
      .from('hash_chain_entries')
      .insert([{
        tenant_id: tenantId,
        index: 0,
        timestamp: Date.now(),
        data: JSON.stringify({ type: 'tenant_created', tenantId }),
        previous_hash: '0',
        hash: initialHash,
      }]);

    if (hashError) console.error('Failed to create hash chain entry:', hashError);

    // Create Discord webhook for tenant (would call backend API in real implementation)
    // For now, use placeholder
    const webhookUrl = `https://discord.com/api/webhooks/${tenantId}`;

    const { error: updateError } = await getDb()
      .from('tenants')
      .update({ webhook_url: webhookUrl })
      .eq('id', tenantId);

    if (updateError) console.error('Failed to update webhook:', updateError);

    // Initialize user settings for this tenant
    const { error: settingsError } = await getDb()
      .from('user_settings')
      .insert([{
        tenant_id: tenantId,
        user_id: userId,
        theme: 'auto',
        notifications_enabled: true,
      }]);

    if (settingsError && !settingsError.message?.includes('duplicate')) {
      console.error('Failed to create settings:', settingsError);
    }
  } catch (error) {
    console.error('Failed to initialize tenant resources:', error);
    // Don't throw - tenant is usable even without these resources
  }
}

/**
 * Notify backend of tenant context change
 */
async function notifyTenantChange(tenantId: string): Promise<void> {
  try {
    // This would call a backend function to set RLS context
    // For now, just verify tenant is accessible
    const { error } = await getDb()
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .single();

    if (error) throw error;
  } catch (error) {
    console.error('Failed to notify tenant change:', error);
    // Don't throw - app can continue even if backend notification fails
  }
}

/**
 * Simple hash function for initial hash chain entry
 * In production, use crypto.subtle.digest
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}
