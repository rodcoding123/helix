/**
 * Phase 11 Week 3: Tenant Context for Desktop
 * Manages team/tenant selection and data for desktop app
 */

import { useCallback, useContext, createContext, ReactNode, useState, useEffect } from 'react';
import { invoke } from './tauri-compat';

export interface Tenant {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  owner_id: string;
  created_at: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  email: string;
  name?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
}

export interface TenantContextType {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  members: TenantMember[];
  loading: boolean;
  error: string | null;
  selectTenant: (tenantId: string) => void;
  refreshTenants: () => Promise<void>;
  refreshMembers: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (!context) {
    return {
      tenants: [],
      currentTenant: null,
      members: [],
      loading: false,
      error: null,
      selectTenant: () => {},
      refreshTenants: async () => {},
      refreshMembers: async () => {},
    };
  }
  return context;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tenants on mount
  useEffect(() => {
    const loadTenants = async () => {
      try {
        setLoading(true);
        setError(null);

        // Attempt to load tenants via Tauri invoke
        // Falls back to empty array if not implemented
        const result = await invoke<{ tenants: Tenant[]; currentTenant: Tenant | null } | null>(
          'get_tenants',
          {}
        ).catch(() => null);

        if (result) {
          setTenants(result.tenants);
          setCurrentTenant(result.currentTenant);

          // Load members if tenant is selected
          if (result.currentTenant) {
            await loadMembers(result.currentTenant.id);
          }
        }
      } catch (err) {
        console.error('Failed to load tenants:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tenants');
      } finally {
        setLoading(false);
      }
    };

    loadTenants();
  }, []);

  const loadMembers = async (tenantId: string) => {
    try {
      const result = await invoke<TenantMember[] | null>('get_tenant_members', {
        tenant_id: tenantId,
      }).catch(() => null);

      if (result) {
        setMembers(result);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const selectTenant = useCallback(
    async (tenantId: string) => {
      const tenant = tenants.find((t) => t.id === tenantId);
      if (!tenant) return;

      try {
        // Notify backend of tenant selection
        await invoke('set_current_tenant', { tenant_id: tenantId }).catch(() => {
          // If invoke fails, still update local state
        });

        setCurrentTenant(tenant);
        await loadMembers(tenantId);
      } catch (err) {
        console.error('Failed to select tenant:', err);
      }
    },
    [tenants]
  );

  const refreshTenants = useCallback(async () => {
    try {
      setLoading(true);
      const result = await invoke<{ tenants: Tenant[]; currentTenant: Tenant | null } | null>(
        'get_tenants',
        {}
      ).catch(() => null);

      if (result) {
        setTenants(result.tenants);
        setCurrentTenant(result.currentTenant);
      }
    } catch (err) {
      console.error('Failed to refresh tenants:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMembers = useCallback(async () => {
    if (currentTenant) {
      await loadMembers(currentTenant.id);
    }
  }, [currentTenant]);

  const value: TenantContextType = {
    tenants,
    currentTenant,
    members,
    loading,
    error,
    selectTenant,
    refreshTenants,
    refreshMembers,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
