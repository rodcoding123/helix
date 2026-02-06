/**
 * User Scope Context
 * @deprecated Multi-tenant system removed. User account = instance.
 * Kept for backward compatibility. Use useAuth() for user identity.
 */

import { createContext, useContext } from 'react';

/**
 * @deprecated Use useAuth() directly. Tenant = User.
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

export interface TenantContextType {
  tenant: Tenant | null;
  loading: boolean;
  error: Error | null;
  /** @deprecated No-op. Multi-tenant switching removed. */
  switchTenant: (tenantId: string) => Promise<void>;
  /** @deprecated No-op. Multi-tenant creation removed. */
  createTenant: (name: string) => Promise<Tenant>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

/**
 * @deprecated Use useAuth() for user identity instead.
 */
export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

/**
 * @deprecated User scope is automatic. Returns user ID from auth.
 */
export function getCurrentTenantId(): string | null {
  try {
    return localStorage.getItem('current_tenant_id');
  } catch {
    return null;
  }
}

/**
 * @deprecated No-op in user=instance model.
 */
export function setCurrentTenantId(tenantId: string): void {
  try {
    localStorage.setItem('current_tenant_id', tenantId);
  } catch {
    // Ignore
  }
}

/**
 * @deprecated User scope is automatic via Supabase RLS.
 */
export function getTenantContext(): {
  tenantId: string;
  headers: Record<string, string>;
} {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('No active scope. User must be authenticated.');
  }

  return {
    tenantId,
    headers: {
      'X-Tenant-ID': tenantId,
    },
  };
}

export { TenantContext };
