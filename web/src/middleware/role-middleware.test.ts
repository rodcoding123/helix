/**
 * Phase 11 Week 2: Task 2.3 - Role Middleware Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { TenantRequest } from '@/lib/tenant/tenant-context';
import {
  ROLE_HIERARCHY,
  requireRole,
  requireManagePermission,
  requireInvitePermission,
  requireRemovePermission,
  requireChangeRolePermission,
  getRoleDescription,
  isValidRoleChange,
  requireAnyRole,
  checkPermission,
  getPermissionLevel,
} from './role-middleware';

describe('Role Middleware', () => {
  let mockReq: Partial<TenantRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      userId: 'user-123',
    } as any;

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    mockNext = vi.fn();
  });

  describe('Role Hierarchy', () => {
    it('should have correct role hierarchy levels', () => {
      expect(ROLE_HIERARCHY.viewer).toBe(1);
      expect(ROLE_HIERARCHY.member).toBe(2);
      expect(ROLE_HIERARCHY.admin).toBe(3);
      expect(ROLE_HIERARCHY.owner).toBe(4);
    });

    it('should indicate owner has all permissions', () => {
      expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
      expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.member);
      expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.viewer);
    });

    it('should indicate correct role ordering', () => {
      expect(ROLE_HIERARCHY.viewer).toBeLessThan(ROLE_HIERARCHY.member);
      expect(ROLE_HIERARCHY.member).toBeLessThan(ROLE_HIERARCHY.admin);
      expect(ROLE_HIERARCHY.admin).toBeLessThan(ROLE_HIERARCHY.owner);
    });
  });

  describe('requireRole Middleware', () => {
    it('should allow user with required role', async () => {
      (mockReq as any).userRole = 'admin';
      (mockReq as any).tenantId = 'tenant-123';

      const middleware = requireRole('member');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow user with higher role', async () => {
      (mockReq as any).userRole = 'owner';
      (mockReq as any).tenantId = 'tenant-123';

      const middleware = requireRole('member');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny user with insufficient role', async () => {
      (mockReq as any).userRole = 'viewer';
      (mockReq as any).tenantId = 'tenant-123';

      const middleware = requireRole('admin');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny user without tenant context', async () => {
      (mockReq as any).userRole = 'admin';
      (mockReq as any).tenantId = undefined;

      const middleware = requireRole('member');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should deny unauthenticated user', async () => {
      (mockReq as any).userId = undefined;
      (mockReq as any).userRole = 'member';
      (mockReq as any).tenantId = 'tenant-123';

      const middleware = requireRole('member');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return permission error details', async () => {
      (mockReq as any).userRole = 'viewer';
      (mockReq as any).tenantId = 'tenant-123';

      const middleware = requireRole('admin');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Insufficient permissions',
          required: 'admin',
          current: 'viewer',
        })
      );
    });
  });

  describe('Specific Permission Middleware', () => {
    it('should allow admin to manage members', () => {
      (mockReq as any).userRole = 'admin';
      (mockReq as any).tenantId = 'tenant-123';

      requireManagePermission(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny viewer from managing members', () => {
      (mockReq as any).userRole = 'viewer';
      (mockReq as any).tenantId = 'tenant-123';

      requireManagePermission(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should allow owner to invite members', () => {
      (mockReq as any).userRole = 'owner';
      (mockReq as any).tenantId = 'tenant-123';

      requireInvitePermission(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny member from inviting', () => {
      (mockReq as any).userRole = 'member';
      (mockReq as any).tenantId = 'tenant-123';

      requireInvitePermission(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should allow only owner to remove members', () => {
      (mockReq as any).userRole = 'owner';
      (mockReq as any).tenantId = 'tenant-123';

      requireRemovePermission(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny admin from removing members', () => {
      (mockReq as any).userRole = 'admin';
      (mockReq as any).tenantId = 'tenant-123';

      requireRemovePermission(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should allow only owner to change roles', () => {
      (mockReq as any).userRole = 'owner';
      (mockReq as any).tenantId = 'tenant-123';

      requireChangeRolePermission(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny admin from changing roles', () => {
      (mockReq as any).userRole = 'admin';
      (mockReq as any).tenantId = 'tenant-123';

      requireChangeRolePermission(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Role Descriptions', () => {
    it('should provide owner description', () => {
      const desc = getRoleDescription('owner');
      expect(desc).toContain('ownership');
    });

    it('should provide admin description', () => {
      const desc = getRoleDescription('admin');
      expect(desc).toContain('manage');
    });

    it('should provide member description', () => {
      const desc = getRoleDescription('member');
      expect(desc).toContain('operations');
    });

    it('should provide viewer description', () => {
      const desc = getRoleDescription('viewer');
      expect(desc).toContain('view');
    });

    it('should handle unknown role', () => {
      const desc = getRoleDescription('invalid');
      expect(desc).toBe('Unknown role');
    });
  });

  describe('Role Change Validation', () => {
    it('should prevent changing owner role', () => {
      expect(isValidRoleChange('owner', 'admin')).toBe(false);
    });

    it('should prevent promoting to owner', () => {
      expect(isValidRoleChange('member', 'owner')).toBe(false);
    });

    it('should allow member to admin promotion', () => {
      expect(isValidRoleChange('member', 'admin')).toBe(true);
    });

    it('should allow admin to member demotion', () => {
      expect(isValidRoleChange('admin', 'member')).toBe(true);
    });

    it('should allow member to viewer change', () => {
      expect(isValidRoleChange('member', 'viewer')).toBe(true);
    });

    it('should reject invalid role names', () => {
      expect(isValidRoleChange('member', 'superadmin')).toBe(false);
    });
  });

  describe('requireAnyRole Middleware', () => {
    it('should allow user with one of required roles', () => {
      (mockReq as any).userRole = 'admin';
      (mockReq as any).tenantId = 'tenant-123';

      const middleware = requireAnyRole('member', 'admin');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny user without any required roles', () => {
      (mockReq as any).userRole = 'viewer';
      (mockReq as any).tenantId = 'tenant-123';

      const middleware = requireAnyRole('admin', 'member');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should allow owner with any role list', () => {
      (mockReq as any).userRole = 'owner';
      (mockReq as any).tenantId = 'tenant-123';

      const middleware = requireAnyRole('member', 'viewer');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Helper Functions', () => {
    it('checkPermission should verify role', () => {
      expect(checkPermission('admin', 'member')).toBe(true);
      expect(checkPermission('member', 'admin')).toBe(false);
      expect(checkPermission('owner', 'viewer')).toBe(true);
      expect(checkPermission(undefined, 'member')).toBe(false);
    });

    it('getPermissionLevel should return correct level', () => {
      expect(getPermissionLevel('viewer')).toBe(1);
      expect(getPermissionLevel('member')).toBe(2);
      expect(getPermissionLevel('admin')).toBe(3);
      expect(getPermissionLevel('owner')).toBe(4);
      expect(getPermissionLevel('invalid')).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing userRole gracefully', () => {
      (mockReq as any).userRole = undefined;
      (mockReq as any).tenantId = 'tenant-123';

      const middleware = requireRole('member');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle case-sensitive roles', () => {
      (mockReq as any).userRole = 'ADMIN';
      (mockReq as any).tenantId = 'tenant-123';

      const middleware = requireRole('member');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      // Should not match (case-sensitive)
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle whitespace in role', () => {
      (mockReq as any).userRole = ' admin ';
      (mockReq as any).tenantId = 'tenant-123';

      const middleware = requireRole('member');
      middleware(mockReq as TenantRequest, mockRes as Response, mockNext);

      // Should not match (no trimming)
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
