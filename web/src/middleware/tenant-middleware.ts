/**
 * Phase 11: Tenant Context Middleware
 * Extracts, validates, and enforces tenant context on all requests
 */

import { getDb } from '@/lib/supabase';

/**
 * Generic request object for middleware
 */
export interface TenantRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  tenantId?: string;
  userId?: string;
  tenant?: {
    id: string;
    name: string;
    tier: string;
  };
}

/**
 * Generic response object for middleware
 */
export interface TenantResponse {
  status(code: number): { json(data: unknown): void };
  setHeader(name: string, value: string): void;
}

/**
 * Next function type
 */
export type NextFunction = () => void;

/**
 * Middleware to extract and validate tenant context
 * Sets RLS context for database queries
 *
 * Extracts tenant ID from (in order of priority):
 * 1. X-Tenant-ID header
 * 2. X-Tenant-Context Base64-encoded JSON
 * 3. tenant_id query parameter
 *
 * Validates user has access to tenant
 * Sets app.current_tenant_id for RLS policies
 */
// @ts-ignore
export async function tenantMiddleware(
  req: TenantRequest & any,
  res: TenantResponse & any,
  next: NextFunction
) {
  try {
    // Extract tenant ID from headers/query
    const tenantId = extractTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing tenant ID',
        details: 'Provide X-Tenant-ID header or X-Tenant-Context',
      });
    }

    // Get user ID from auth token (set by auth middleware)
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'User must be authenticated',
      });
    }

    // Verify user has access to this tenant
    const hasAccess = await verifyTenantAccess(userId, tenantId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: `User does not have access to tenant ${tenantId}`,
      });
    }

    // Load tenant details
    const tenant = await loadTenantDetails(tenantId);
    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
        details: `Tenant ${tenantId} does not exist`,
      });
    }

    // Set tenant context for RLS policies
    await setTenantContextForRLS(tenantId);

    // Attach to request object
    req.tenantId = tenantId;
    req.userId = userId;
    req.tenant = tenant;

    // Add to response headers for client
    res.setHeader('X-Tenant-ID', tenantId);

    // Continue to next middleware
    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: 'Failed to process tenant context',
    });
  }
}

/**
 * Extract tenant ID from request
 * Tries multiple sources for flexibility
 */
function extractTenantId(req: TenantRequest): string | null {
  // 1. X-Tenant-ID header (simplest)
  const headerTenantId = req.headers['x-tenant-id'] as string;
  if (headerTenantId) {
    return headerTenantId;
  }

  // 2. X-Tenant-Context Base64-encoded JSON
  const contextHeader = req.headers['x-tenant-context'] as string;
  if (contextHeader) {
    try {
      const decoded = JSON.parse(Buffer.from(contextHeader, 'base64').toString());
      if (decoded.tenantId) {
        return decoded.tenantId;
      }
    } catch (error) {
      console.warn('Failed to decode X-Tenant-Context header:', error);
    }
  }

  // 3. Query parameter (fallback)
  const queryTenantId = req.query.tenant_id as string;
  if (queryTenantId) {
    return queryTenantId;
  }

  return null;
}

/**
 * Verify user has access to this tenant
 * Checks tenants table for ownership or membership
 */
async function verifyTenantAccess(userId: string, tenantId: string): Promise<boolean> {
  try {
    const { data, error } = await getDb()
      .from('tenants')
      .select('id, owner_id, members')
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      console.warn(`Tenant ${tenantId} not found or access error`);
      return false;
    }

    // Check ownership
    if (data.owner_id === userId) {
      return true;
    }

    // Check membership
    if (Array.isArray(data.members) && data.members.includes(userId)) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to verify tenant access:', error);
    return false;
  }
}

/**
 * Load tenant details for context
 */
async function loadTenantDetails(
  tenantId: string
): Promise<{ id: string; name: string; tier: string } | null> {
  try {
    const { data, error } = await getDb()
      .from('tenants')
      .select('id, name, tier')
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      tier: data.tier || 'free',
    };
  } catch (error) {
    console.error('Failed to load tenant details:', error);
    return null;
  }
}

/**
 * Set tenant context in PostgreSQL for RLS policies
 * Must be called before any RLS-filtered queries
 */
async function setTenantContextForRLS(tenantId: string): Promise<void> {
  try {
    // This calls the set_tenant_context PostgreSQL function
    // Sets app.current_tenant_id config variable for RLS
    await getDb().rpc('set_tenant_context', { p_tenant_id: tenantId });
  } catch (error) {
    console.error('Failed to set tenant context for RLS:', error);
    // Don't throw - some queries might not need RLS context
  }
}

/**
 * Optional: Middleware to require tenant context
 * Use on routes that must have tenant context
 */
export function requireTenantContext(
  req: TenantRequest,
  res: TenantResponse,
  next: NextFunction
) {
  if (!req.tenantId) {
    return res.status(400).json({
      error: 'Missing tenant ID',
      details: 'This endpoint requires tenant context',
    });
  }

  next();
}

/**
 * Optional: Middleware to check tenant tier
 * Use for feature gating
 */
export function requireTenantTier(requiredTier: 'free' | 'pro' | 'enterprise') {
  return (req: TenantRequest, res: TenantResponse, next: NextFunction) => {
    const tiers = { free: 0, pro: 1, enterprise: 2 };
    const currentTier = req.tenant?.tier || 'free';

    if ((tiers[currentTier] || 0) < (tiers[requiredTier] || 0)) {
      return res.status(403).json({
        error: 'Feature not available',
        details: `This feature requires ${requiredTier} tier or higher`,
        currentTier,
      });
    }

    next();
  };
}

/**
 * Helper: Ensure tenant context in API utilities
 * For non-middleware contexts (e.g., service layers)
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    // Set RLS context
    await setTenantContextForRLS(tenantId);

    // Execute function
    return await fn();
  } catch (error) {
    console.error(`Error in tenant context for ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Helper: Get current tenant ID from request
 * Shorthand for middleware-using functions
 */
export function getTenantIdFromRequest(req: TenantRequest): string {
  if (!req.tenantId) {
    throw new Error('No tenant context in request');
  }
  return req.tenantId;
}

/**
 * Helper: Get current user ID from request
 */
export function getUserIdFromRequest(req: TenantRequest): string {
  if (!req.userId) {
    throw new Error('No user context in request');
  }
  return req.userId;
}

/**
 * Helper: Validate tenant ownership
 * For operations that require tenant owner
 */
export async function verifyTenantOwnership(
  userId: string,
  tenantId: string
): Promise<boolean> {
  try {
    const { data } = await getDb()
      .from('tenants')
      .select('owner_id')
      .eq('id', tenantId)
      .single();

    return data?.owner_id === userId;
  } catch {
    return false;
  }
}
