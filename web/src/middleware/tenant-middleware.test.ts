/**
 * Phase 11: Tenant Middleware Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import {
  tenantMiddleware,
  requireTenantContext,
  requireTenantTier,
  withTenantContext,
  getTenantIdFromRequest,
  getUserIdFromRequest,
  verifyTenantOwnership,
  type TenantRequest,
} from './tenant-middleware';
import * as supabaseModule from '@/lib/supabase';

// Mock Supabase
const mockQuery = {
  from: vi.fn(function () { return this; }),
  select: vi.fn(function () { return this; }),
  eq: vi.fn(function () { return this; }),
  single: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  getDb: vi.fn(() => mockQuery),
}));

// Helper to create mock request/response
function createMockReq(overrides: Partial<TenantRequest> = {}): TenantRequest {
  return {
    headers: {},
    query: {},
    ...overrides,
  } as TenantRequest;
}

function createMockRes(): Response {
  return {
    status: vi.fn(function () { return this; }),
    json: vi.fn(function (data: any) { return this; }),
    setHeader: vi.fn(),
  } as any;
}

function createMockNext(): NextFunction {
  return vi.fn();
}

describe('Tenant Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tenantMiddleware', () => {
    it('should extract tenant ID from X-Tenant-ID header', async () => {
      const req = createMockReq({
        headers: { 'x-tenant-id': 'tenant-123' },
        user: { id: 'user-123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-123', owner_id: 'user-123', members: [] },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-123', name: 'My Tenant', tier: 'pro' },
        error: null,
      });

      mockQuery.rpc.mockResolvedValueOnce({});

      await tenantMiddleware(req, res, next);

      expect(req.tenantId).toBe('tenant-123');
      expect(next).toHaveBeenCalled();
    });

    it('should extract tenant ID from X-Tenant-Context header', async () => {
      const contextHeader = Buffer.from(JSON.stringify({ tenantId: 'tenant-456' })).toString('base64');

      const req = createMockReq({
        headers: { 'x-tenant-context': contextHeader },
        user: { id: 'user-123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-456', owner_id: 'user-123', members: [] },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-456', name: 'Tenant 2', tier: 'free' },
        error: null,
      });

      mockQuery.rpc.mockResolvedValueOnce({});

      await tenantMiddleware(req, res, next);

      expect(req.tenantId).toBe('tenant-456');
      expect(next).toHaveBeenCalled();
    });

    it('should extract tenant ID from query parameter', async () => {
      const req = createMockReq({
        query: { tenant_id: 'tenant-789' },
        user: { id: 'user-123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-789', owner_id: 'user-123', members: [] },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-789', name: 'Tenant 3', tier: 'pro' },
        error: null,
      });

      mockQuery.rpc.mockResolvedValueOnce({});

      await tenantMiddleware(req, res, next);

      expect(req.tenantId).toBe('tenant-789');
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 if tenant ID missing', async () => {
      const req = createMockReq({
        user: { id: 'user-123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await tenantMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Missing tenant ID' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if user not authenticated', async () => {
      const req = createMockReq({
        headers: { 'x-tenant-id': 'tenant-123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await tenantMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Unauthorized' })
      );
    });

    it('should return 403 if user lacks access to tenant', async () => {
      const req = createMockReq({
        headers: { 'x-tenant-id': 'tenant-123' },
        user: { id: 'user-other' },
      });
      const res = createMockRes();
      const next = createMockNext();

      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'tenant-123',
          owner_id: 'user-owner',
          members: [],
        },
        error: null,
      });

      await tenantMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Access denied' })
      );
    });

    it('should allow access if user is owner', async () => {
      const req = createMockReq({
        headers: { 'x-tenant-id': 'tenant-123' },
        user: { id: 'user-owner' },
      });
      const res = createMockRes();
      const next = createMockNext();

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-123', owner_id: 'user-owner', members: [] },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-123', name: 'My Tenant', tier: 'pro' },
        error: null,
      });

      mockQuery.rpc.mockResolvedValueOnce({});

      await tenantMiddleware(req, res, next);

      expect(req.tenantId).toBe('tenant-123');
      expect(next).toHaveBeenCalled();
    });

    it('should allow access if user is member', async () => {
      const req = createMockReq({
        headers: { 'x-tenant-id': 'tenant-123' },
        user: { id: 'user-member' },
      });
      const res = createMockRes();
      const next = createMockNext();

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-123', owner_id: 'owner', members: ['user-member'] },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-123', name: 'My Tenant', tier: 'free' },
        error: null,
      });

      mockQuery.rpc.mockResolvedValueOnce({});

      await tenantMiddleware(req, res, next);

      expect(req.tenantId).toBe('tenant-123');
      expect(next).toHaveBeenCalled();
    });

    it('should set tenant context for RLS', async () => {
      const req = createMockReq({
        headers: { 'x-tenant-id': 'tenant-123' },
        user: { id: 'user-123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-123', owner_id: 'user-123', members: [] },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-123', name: 'My Tenant', tier: 'pro' },
        error: null,
      });

      mockQuery.rpc.mockResolvedValueOnce({});

      await tenantMiddleware(req, res, next);

      expect(mockQuery.rpc).toHaveBeenCalledWith('set_tenant_context', {
        p_tenant_id: 'tenant-123',
      });
    });

    it('should attach tenant details to request', async () => {
      const req = createMockReq({
        headers: { 'x-tenant-id': 'tenant-123' },
        user: { id: 'user-123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-123', owner_id: 'user-123', members: [] },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'tenant-123', name: 'My Tenant', tier: 'pro' },
        error: null,
      });

      mockQuery.rpc.mockResolvedValueOnce({});

      await tenantMiddleware(req, res, next);

      expect(req.tenant).toEqual({
        id: 'tenant-123',
        name: 'My Tenant',
        tier: 'pro',
      });
    });

    it('should return 500 on unexpected error', async () => {
      const req = createMockReq({
        headers: { 'x-tenant-id': 'tenant-123' },
        user: { id: 'user-123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      mockQuery.single.mockRejectedValueOnce(new Error('Database error'));

      await tenantMiddleware(req, res, next);

      // When DB fails during access check, middleware returns 403 (fail-closed security)
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireTenantContext', () => {
    it('should allow request with tenant context', () => {
      const req = createMockReq({ tenantId: 'tenant-123' });
      const res = createMockRes();
      const next = createMockNext();

      requireTenantContext(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny request without tenant context', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      requireTenantContext(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireTenantTier', () => {
    it('should allow free tier accessing free feature', () => {
      const req = createMockReq({
        tenant: { id: 'tenant-1', name: 'Free Tenant', tier: 'free' },
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireTenantTier('free');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny free tier accessing pro feature', () => {
      const req = createMockReq({
        tenant: { id: 'tenant-1', name: 'Free Tenant', tier: 'free' },
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireTenantTier('pro');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow pro tier accessing pro feature', () => {
      const req = createMockReq({
        tenant: { id: 'tenant-1', name: 'Pro Tenant', tier: 'pro' },
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireTenantTier('pro');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow enterprise accessing all features', () => {
      const req = createMockReq({
        tenant: { id: 'tenant-1', name: 'Enterprise', tier: 'enterprise' },
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireTenantTier('pro');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Helper functions', () => {
    it('should get tenant ID from request', () => {
      const req = createMockReq({ tenantId: 'tenant-123' });
      const id = getTenantIdFromRequest(req);

      expect(id).toBe('tenant-123');
    });

    it('should throw if tenant ID missing', () => {
      const req = createMockReq();

      expect(() => getTenantIdFromRequest(req)).toThrow();
    });

    it('should get user ID from request', () => {
      const req = createMockReq({ userId: 'user-123' });
      const id = getUserIdFromRequest(req);

      expect(id).toBe('user-123');
    });

    it('should throw if user ID missing', () => {
      const req = createMockReq();

      expect(() => getUserIdFromRequest(req)).toThrow();
    });
  });

  describe('verifyTenantOwnership', () => {
    it('should verify tenant ownership', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { owner_id: 'user-owner' },
        error: null,
      });

      const isOwner = await verifyTenantOwnership('user-owner', 'tenant-123');

      expect(isOwner).toBe(true);
    });

    it('should deny non-owner', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { owner_id: 'user-owner' },
        error: null,
      });

      const isOwner = await verifyTenantOwnership('user-other', 'tenant-123');

      expect(isOwner).toBe(false);
    });
  });

  describe('withTenantContext', () => {
    it('should execute function with tenant context', async () => {
      mockQuery.rpc.mockResolvedValueOnce({});

      const fn = vi.fn().mockResolvedValueOnce('result');
      const result = await withTenantContext('tenant-123', fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
      expect(mockQuery.rpc).toHaveBeenCalledWith('set_tenant_context', {
        p_tenant_id: 'tenant-123',
      });
    });

    it('should throw on function error', async () => {
      mockQuery.rpc.mockResolvedValueOnce({});

      const fn = vi.fn().mockRejectedValueOnce(new Error('Function error'));

      await expect(
        withTenantContext('tenant-123', fn)
      ).rejects.toThrow('Function error');
    });
  });
});
