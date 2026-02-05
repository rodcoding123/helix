/**
 * Phase 11 Week 1: Tenant Context System
 * Manages isolated Helix instances for multi-tenant SaaS
 */

import { createContext, useContext } from 'react';

/**
 * Tenant represents an isolated Helix consciousness instance
 * Each tenant has completely separate data, logging, and psychological layers
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
 * Tenant context - available throughout app via useTenant() hook
 */
export interface TenantContextType {
  tenant: Tenant | null;
  loading: boolean;
  error: Error | null;
  switchTenant: (tenantId: string) => Promise<void>;
  createTenant: (name: string) => Promise<Tenant>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

/**
 * Hook to access current tenant context
 * Must be called within TenantProvider
 */
export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

/**
 * Get current tenant ID from localStorage
 * Used in contexts where hooks aren't available (e.g., API calls)
 */
export function getCurrentTenantId(): string | null {
  try {
    return localStorage.getItem('current_tenant_id');
  } catch {
    return null;
  }
}

/**
 * Set current tenant ID in localStorage and notify listeners
 * Synchronizes across browser tabs
 */
export function setCurrentTenantId(tenantId: string): void {
  try {
    localStorage.setItem('current_tenant_id', tenantId);
    // Notify all open windows/tabs of tenant change
    window.dispatchEvent(
      new CustomEvent('tenant-changed', { detail: { tenantId } })
    );
  } catch (error) {
    console.error('Failed to set tenant ID:', error);
  }
}

/**
 * Get tenant context headers for API/RPC calls
 * Includes X-Tenant-ID and Base64-encoded context
 */
export function getTenantContext(): {
  tenantId: string;
  headers: Record<string, string>;
} {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error(
      'No active tenant set. Call setCurrentTenantId() before making API requests.'
    );
  }

  return {
    tenantId,
    headers: {
      'X-Tenant-ID': tenantId,
      'X-Tenant-Context': btoa(JSON.stringify({ tenantId })),
    },
  };
}

/**
 * Listen for tenant changes across browser tabs
 */
export function onTenantChanged(
  callback: (tenantId: string) => void
): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail.tenantId);
  };

  window.addEventListener('tenant-changed', handler);

  return () => {
    window.removeEventListener('tenant-changed', handler);
  };
}

export { TenantContext };
