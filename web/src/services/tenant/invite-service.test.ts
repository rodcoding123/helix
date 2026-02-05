/**
 * Phase 11 Week 2: Tenant Invitation Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TenantInviteService,
  TenantInvitation,
  TenantMember,
  getTenantInviteService,
} from './invite-service';
import * as supabaseModule from '@/lib/supabase';
import * as hashChainModule from '@/helix/hash-chain-multitenant';
import * as discordLoggerModule from '@/helix/command-logger-multitenant';

// Helper to create a chainable mock query builder
function createMockQueryBuilder() {
  return {
    from: vi.fn(function () { return this; }),
    select: vi.fn(function () { return this; }),
    insert: vi.fn(function () { return this; }),
    update: vi.fn(function () { return this; }),
    delete: vi.fn(function () { return this; }),
    eq: vi.fn(function () { return this; }),
    gt: vi.fn(function () { return this; }),
    single: vi.fn(),
    order: vi.fn(function () { return this; }),
    auth: {
      admin: {
        getUserById: vi.fn(),
        listUsers: vi.fn(),
      },
    },
  };
}

let mockQuery: ReturnType<typeof createMockQueryBuilder>;

vi.mock('@/lib/supabase', () => ({
  getDb: vi.fn(() => mockQuery),
}));

// Mock hash chain
const mockHashChain = {
  addEntry: vi.fn().mockResolvedValue({}),
};

vi.mock('@/helix/hash-chain-multitenant', () => ({
  getHashChainForTenant: vi.fn(() => mockHashChain),
}));

// Mock Discord logger
const mockDiscordLogger = {
  log: vi.fn().mockResolvedValue({}),
};

vi.mock('@/helix/command-logger-multitenant', () => ({
  getDiscordLoggerForTenant: vi.fn(() => mockDiscordLogger),
}));

describe('TenantInviteService', () => {
  let service: TenantInviteService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = createMockQueryBuilder();
    service = new TenantInviteService();
  });

  describe('inviteUser', () => {
    it('should successfully invite user with default role (member)', async () => {
      const tenantId = 'tenant-123';
      const email = 'user@example.com';

      // No existing invitation
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // No existing member
      mockQuery.auth.admin.listUsers.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Insertion successful
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-123',
          tenant_id: tenantId,
          email,
          role: 'member',
          token: 'token123456789abc',
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      });

      const invitation = await service.inviteUser(tenantId, email);

      expect(invitation.email).toBe(email);
      expect(invitation.role).toBe('member');
      expect(invitation.status).toBe('pending');
      expect(mockHashChain.addEntry).toHaveBeenCalled();
      expect(mockDiscordLogger.log).toHaveBeenCalled();
    });

    it('should successfully invite user with specific role (admin)', async () => {
      const tenantId = 'tenant-123';
      const email = 'admin@example.com';
      const role = 'admin' as const;

      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
      mockQuery.auth.admin.listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-456',
          tenant_id: tenantId,
          email,
          role,
          token: 'token987654321xyz',
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      });

      const invitation = await service.inviteUser(tenantId, email, role);

      expect(invitation.role).toBe('admin');
    });

    it('should reject invalid email format', async () => {
      const tenantId = 'tenant-123';
      const invalidEmail = 'not-an-email';

      await expect(
        service.inviteUser(tenantId, invalidEmail)
      ).rejects.toThrow('Invalid email address');
    });

    it('should reject if user already has pending invitation', async () => {
      const tenantId = 'tenant-123';
      const email = 'user@example.com';

      // Existing pending invitation
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-existing',
          tenant_id: tenantId,
          email,
          role: 'member',
          token: 'token-old',
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 1000).toISOString(),
        },
        error: null,
      });

      await expect(
        service.inviteUser(tenantId, email)
      ).rejects.toThrow(`User ${email} already has a pending invitation`);
    });

    it('should reject if user is already a member', async () => {
      const tenantId = 'tenant-123';
      const email = 'member@example.com';
      const userId = 'user-456';

      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
      mockQuery.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [{ id: userId, email, email_confirmed_at: new Date().toISOString() }] },
        error: null,
      });
      mockQuery.single.mockResolvedValueOnce({ data: { id: 'mem-123' }, error: null });

      await expect(
        service.inviteUser(tenantId, email)
      ).rejects.toThrow(`User ${email} is already a member of this tenant`);
    });

    it('should generate unique token and set 6-hour expiry', async () => {
      const tenantId = 'tenant-123';
      const email = 'user@example.com';
      const beforeTime = Date.now();

      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
      mockQuery.auth.admin.listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });

      const token = 'unique-token-abc123';
      const expiresAt = new Date(beforeTime + 6 * 60 * 60 * 1000);

      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-123',
          tenant_id: tenantId,
          email,
          role: 'member',
          token,
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        error: null,
      });

      const invitation = await service.inviteUser(tenantId, email);

      expect(invitation.token).toBe(token);
      expect(invitation.expiresAt.getTime()).toBeGreaterThanOrEqual(beforeTime + 6 * 60 * 60 * 1000 - 1000);
      expect(invitation.expiresAt.getTime()).toBeLessThanOrEqual(beforeTime + 6 * 60 * 60 * 1000 + 1000);
    });

    it('should log invitation to hash chain', async () => {
      const tenantId = 'tenant-123';
      const email = 'user@example.com';

      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
      mockQuery.auth.admin.listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-123',
          tenant_id: tenantId,
          email,
          role: 'member',
          token: 'token123',
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      });

      await service.inviteUser(tenantId, email);

      expect(hashChainModule.getHashChainForTenant).toHaveBeenCalledWith(tenantId);
      expect(mockHashChain.addEntry).toHaveBeenCalledWith(
        expect.stringContaining('invitation_created')
      );
    });

    it('should send Discord notification', async () => {
      const tenantId = 'tenant-123';
      const email = 'user@example.com';

      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
      mockQuery.auth.admin.listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-123',
          tenant_id: tenantId,
          email,
          role: 'member',
          token: 'token123',
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      });

      await service.inviteUser(tenantId, email, 'admin');

      expect(discordLoggerModule.getDiscordLoggerForTenant).toHaveBeenCalledWith(tenantId);
      expect(mockDiscordLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'member_invited',
          content: expect.stringContaining(email),
        })
      );
    });

    it('should handle database insertion error', async () => {
      const tenantId = 'tenant-123';
      const email = 'user@example.com';

      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
      mockQuery.auth.admin.listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database constraint violation' },
      });

      await expect(
        service.inviteUser(tenantId, email)
      ).rejects.toThrow('Failed to create invitation');
    });
  });

  describe('acceptInvitation', () => {
    it('should successfully accept valid pending invitation', async () => {
      const token = 'valid-token-123';
      const userId = 'user-456';
      const tenantId = 'tenant-123';
      const email = 'user@example.com';

      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      // Get invitation
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-123',
          tenant_id: tenantId,
          email,
          role: 'member',
          token,
          status: 'pending',
          expires_at: futureDate.toISOString(),
        },
        error: null,
      });

      // Get user
      mockQuery.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: userId, email, email_confirmed_at: new Date().toISOString() } },
        error: null,
      });

      // Add to members (update returns success)
      mockQuery.single.mockResolvedValueOnce({ data: { id: 'mem-123' }, error: null });

      // Update invitation status
      mockQuery.single.mockResolvedValueOnce({ data: { updated: 1 }, error: null });

      await expect(service.acceptInvitation(token, userId)).resolves.not.toThrow();

      expect(hashChainModule.getHashChainForTenant).toHaveBeenCalledWith(tenantId);
      expect(mockHashChain.addEntry).toHaveBeenCalledWith(
        expect.stringContaining('invitation_accepted')
      );
      expect(mockDiscordLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'member_joined' })
      );
    });

    it('should reject expired invitation', async () => {
      const token = 'expired-token';
      const userId = 'user-456';

      const pastDate = new Date(Date.now() - 60 * 60 * 1000);

      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-123',
          tenant_id: 'tenant-123',
          email: 'user@example.com',
          role: 'member',
          token,
          status: 'pending',
          expires_at: pastDate.toISOString(),
        },
        error: null,
      });

      await expect(
        service.acceptInvitation(token, userId)
      ).rejects.toThrow('Invitation has expired');
    });

    it('should reject already accepted invitation', async () => {
      const token = 'already-accepted-token';
      const userId = 'user-456';

      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-123',
          tenant_id: 'tenant-123',
          email: 'user@example.com',
          role: 'member',
          token,
          status: 'accepted',
          expires_at: futureDate.toISOString(),
          accepted_at: new Date().toISOString(),
        },
        error: null,
      });

      await expect(
        service.acceptInvitation(token, userId)
      ).rejects.toThrow('Invitation already accepted');
    });

    it('should reject invalid/missing invitation token', async () => {
      const token = 'invalid-token';
      const userId = 'user-456';

      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(
        service.acceptInvitation(token, userId)
      ).rejects.toThrow('Invalid or expired invitation');
    });

    it('should reject if user not found', async () => {
      const token = 'valid-token';
      const userId = 'nonexistent-user';
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-123',
          tenant_id: 'tenant-123',
          email: 'user@example.com',
          role: 'member',
          token,
          status: 'pending',
          expires_at: futureDate.toISOString(),
        },
        error: null,
      });

      mockQuery.auth.admin.getUserById.mockResolvedValueOnce({
        data: null,
        error: { message: 'User not found' },
      });

      await expect(
        service.acceptInvitation(token, userId)
      ).rejects.toThrow('User not found');
    });

    it('should preserve role from invitation', async () => {
      const token = 'valid-token-123';
      const userId = 'user-456';
      const tenantId = 'tenant-123';
      const role = 'admin';

      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-123',
          tenant_id: tenantId,
          email: 'user@example.com',
          role,
          token,
          status: 'pending',
          expires_at: futureDate.toISOString(),
        },
        error: null,
      });

      mockQuery.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: userId, email: 'user@example.com' } },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({ data: { id: 'mem-123' }, error: null });
      mockQuery.single.mockResolvedValueOnce({ data: { updated: 1 }, error: null });

      await service.acceptInvitation(token, userId);

      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role })
        ])
      );
    });
  });

  describe('rejectInvitation', () => {
    it('should successfully reject pending invitation', async () => {
      const token = 'valid-token-123';
      const tenantId = 'tenant-123';

      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-123',
          tenant_id: tenantId,
          email: 'user@example.com',
          status: 'pending',
          token,
        },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({ data: { updated: 1 }, error: null });

      await expect(service.rejectInvitation(token)).resolves.not.toThrow();

      expect(hashChainModule.getHashChainForTenant).toHaveBeenCalledWith(tenantId);
      expect(mockDiscordLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'invitation_rejected' })
      );
    });

    it('should reject if invitation not found', async () => {
      const token = 'invalid-token';

      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(
        service.rejectInvitation(token)
      ).rejects.toThrow('Invitation not found');
    });
  });

  describe('getPendingInvitations', () => {
    it('should return pending non-expired invitations for email', async () => {
      const email = 'user@example.com';
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const invitations = [
        {
          id: 'inv-1',
          tenant_id: 'tenant-123',
          email,
          role: 'member',
          token: 'token-1',
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: futureDate,
        },
      ];

      // gt() is the final chained method that returns the data
      mockQuery.gt.mockResolvedValueOnce({ data: invitations, error: null });

      const result = await service.getPendingInvitations(email);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe(email);
      expect(result[0].status).toBe('pending');
    });

    it('should return empty array if no pending invitations', async () => {
      const email = 'user@example.com';

      mockQuery.single.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.getPendingInvitations(email);

      expect(result).toEqual([]);
    });

    it('should gracefully handle database errors', async () => {
      const email = 'user@example.com';

      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await service.getPendingInvitations(email);

      expect(result).toEqual([]);
    });
  });

  describe('listMembers', () => {
    it('should return all members ordered by joined_at', async () => {
      const tenantId = 'tenant-123';
      const members = [
        {
          user_id: 'user-1',
          email: 'first@example.com',
          role: 'owner',
          joined_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          user_id: 'user-2',
          email: 'second@example.com',
          role: 'member',
          joined_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      // order() is the final method that returns the data
      mockQuery.order.mockResolvedValueOnce({ data: members, error: null });

      const result = await service.listMembers(tenantId);

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('first@example.com');
      expect(result[1].email).toBe('second@example.com');
    });

    it('should return empty array for tenant with no members', async () => {
      const tenantId = 'tenant-123';

      mockQuery.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.listMembers(tenantId);

      expect(result).toEqual([]);
    });

    it('should handle missing email gracefully', async () => {
      const tenantId = 'tenant-123';
      const members = [
        {
          user_id: 'user-1',
          email: null,
          role: 'member',
          joined_at: new Date().toISOString(),
        },
      ];

      mockQuery.order.mockResolvedValueOnce({ data: members, error: null });

      const result = await service.listMembers(tenantId);

      expect(result[0].email).toBe('Unknown');
    });
  });

  describe('changeMemberRole', () => {
    it('should successfully change member role', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-456';
      const newRole = 'admin';

      mockQuery.single.mockResolvedValueOnce({ data: { updated: 1 }, error: null });

      await expect(
        service.changeMemberRole(tenantId, userId, newRole)
      ).resolves.not.toThrow();

      expect(hashChainModule.getHashChainForTenant).toHaveBeenCalledWith(tenantId);
      expect(mockDiscordLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'member_role_changed' })
      );
    });

    it('should reject invalid role', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-456';
      const invalidRole = 'superadmin';

      await expect(
        service.changeMemberRole(tenantId, userId, invalidRole)
      ).rejects.toThrow(`Invalid role: ${invalidRole}`);
    });
  });

  describe('removeMember', () => {
    it('should successfully remove non-owner member', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-456';

      mockQuery.single.mockResolvedValueOnce({
        data: { role: 'member' },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({ data: { deleted: 1 }, error: null });

      await expect(
        service.removeMember(tenantId, userId)
      ).resolves.not.toThrow();

      expect(hashChainModule.getHashChainForTenant).toHaveBeenCalledWith(tenantId);
      expect(mockDiscordLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'member_removed' })
      );
    });

    it('should prevent removing owner', async () => {
      const tenantId = 'tenant-123';
      const userId = 'owner-user';

      mockQuery.single.mockResolvedValueOnce({
        data: { role: 'owner' },
        error: null,
      });

      await expect(
        service.removeMember(tenantId, userId)
      ).rejects.toThrow('Cannot remove tenant owner');
    });
  });

  describe('userHasRole', () => {
    it('should return true if user has required role or higher', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-456';

      mockQuery.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      const result = await service.userHasRole(tenantId, userId, 'member');

      expect(result).toBe(true);
    });

    it('should return false if user has lower role', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-456';

      mockQuery.single.mockResolvedValueOnce({
        data: { role: 'member' },
        error: null,
      });

      const result = await service.userHasRole(tenantId, userId, 'admin');

      expect(result).toBe(false);
    });

    it('should return false if user not a member', async () => {
      const tenantId = 'tenant-123';
      const userId = 'nonmember';

      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.userHasRole(tenantId, userId, 'member');

      expect(result).toBe(false);
    });

    it('should use role hierarchy correctly', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-456';

      // Owner >= all roles
      mockQuery.single.mockResolvedValueOnce({ data: { role: 'owner' }, error: null });
      expect(await service.userHasRole(tenantId, userId, 'admin')).toBe(true);

      // Admin >= member, viewer
      mockQuery.single.mockResolvedValueOnce({ data: { role: 'admin' }, error: null });
      expect(await service.userHasRole(tenantId, userId, 'member')).toBe(true);

      // Member >= viewer
      mockQuery.single.mockResolvedValueOnce({ data: { role: 'member' }, error: null });
      expect(await service.userHasRole(tenantId, userId, 'viewer')).toBe(true);

      // Viewer >= nothing
      mockQuery.single.mockResolvedValueOnce({ data: { role: 'viewer' }, error: null });
      expect(await service.userHasRole(tenantId, userId, 'member')).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-456';

      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await service.userHasRole(tenantId, userId, 'member');

      expect(result).toBe(false);
    });
  });

  describe('getInvitationDetails', () => {
    it('should return invitation details without exposing token', async () => {
      const token = 'secret-token';
      const tenantId = 'tenant-123';
      const tenantName = 'My Awesome Tenant';
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      let callCount = 0;
      mockQuery.single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: {
              tenant_id: tenantId,
              role: 'member',
              expires_at: futureDate.toISOString(),
            },
            error: null,
          });
        }
        return Promise.resolve({
          data: { name: tenantName },
          error: null,
        });
      });

      const result = await service.getInvitationDetails(token);

      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe(tenantId);
      expect(result?.tenantName).toBe(tenantName);
      expect(result?.role).toBe('member');
      // Ensure token is not exposed
      expect(JSON.stringify(result)).not.toContain(token);
    });

    it('should return null for expired invitation', async () => {
      const token = 'expired-token';
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);

      mockQuery.single.mockResolvedValueOnce({
        data: {
          tenant_id: 'tenant-123',
          role: 'member',
          expires_at: pastDate.toISOString(),
        },
        error: null,
      });

      const result = await service.getInvitationDetails(token);

      expect(result).toBeNull();
    });

    it('should return null if invitation not found', async () => {
      const token = 'invalid-token';

      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.getInvitationDetails(token);

      expect(result).toBeNull();
    });

    it('should handle missing tenant name', async () => {
      const token = 'valid-token';
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      let callCount = 0;
      mockQuery.single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: {
              tenant_id: 'tenant-123',
              role: 'member',
              expires_at: futureDate.toISOString(),
            },
            error: null,
          });
        }
        return Promise.resolve({
          data: null,
          error: null,
        });
      });

      const result = await service.getInvitationDetails(token);

      expect(result?.tenantName).toBe('Unknown Tenant');
    });
  });

  describe('getTenantInviteService', () => {
    it('should return a TenantInviteService instance', () => {
      const service = getTenantInviteService();

      expect(service).toBeInstanceOf(TenantInviteService);
    });
  });

  describe('Email validation', () => {
    it('should accept valid email address', async () => {
      const tenantId = 'tenant-123';
      const email = 'user@example.com';

      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
      mockQuery.auth.admin.listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'inv-123',
          tenant_id: tenantId,
          email,
          role: 'member',
          token: 'token',
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      });

      const invitation = await service.inviteUser(tenantId, email);
      expect(invitation.email).toBe(email);
    });

    it('should reject invalid email addresses', async () => {
      const tenantId = 'tenant-123';
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        '',
      ];

      for (const email of invalidEmails) {
        await expect(
          service.inviteUser(tenantId, email)
        ).rejects.toThrow('Invalid email address');
      }
    });
  });
});
