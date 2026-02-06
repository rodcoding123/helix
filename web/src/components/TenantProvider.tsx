/**
 * User Scope Provider
 * @deprecated Multi-tenant system removed. User account = instance.
 * This provider now simply sets the user's ID as the scope.
 */

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  TenantContext,
  TenantContextType,
  setCurrentTenantId,
  type Tenant,
} from '@/lib/tenant/tenant-context';

interface TenantProviderProps {
  children: ReactNode;
}

/**
 * Simplified provider: user's scope = their own user_id.
 * No tenant switching, no tenant creation, no invitations.
 */
export function TenantProvider({ children }: TenantProviderProps) {
  const { user } = useAuth();

  // Auto-scope to authenticated user
  const tenant: Tenant | null = user
    ? {
        id: user.id,
        name: user.email?.split('@')[0] || 'User',
        ownerId: user.id,
        createdAt: new Date(user.created_at || Date.now()),
        tier: 'free',
      }
    : null;

  // Sync to localStorage for backward compat
  if (tenant) {
    setCurrentTenantId(tenant.id);
  }

  const value: TenantContextType = {
    tenant,
    loading: false,
    error: null,
    switchTenant: async () => {
      console.warn('[TenantProvider] switchTenant is deprecated. User account = instance.');
    },
    createTenant: async (name: string) => {
      console.warn('[TenantProvider] createTenant is deprecated. User account = instance.');
      return tenant!;
    },
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}
