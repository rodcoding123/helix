/**
 * Phase 11 Week 2: Tenant Invitation Service
 * Manages team member invitations and onboarding
 */

import { getDb } from '@/lib/supabase';
import { getHashChainForTenant } from '@/helix/hash-chain-multitenant';
import { getDiscordLoggerForTenant } from '@/helix/command-logger-multitenant';

/**
 * Represents a pending or accepted invitation
 */
export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  token: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
}

/**
 * Represents a tenant member
 */
export interface TenantMember {
  userId: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Date;
}

/**
 * Tenant invitation service
 */
export class TenantInviteService {
  /**
   * Invite user to tenant by email
   * Generates token and sets 6-hour expiry
   */
  async inviteUser(
    tenantId: string,
    email: string,
    role: 'admin' | 'member' | 'viewer' = 'member'
  ): Promise<TenantInvitation> {
    try {
      // Validate email format
      if (!this.isValidEmail(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }

      // Check if user already invited (pending)
      const existingInvitation = await this.getPendingInvitationForEmail(tenantId, email);
      if (existingInvitation) {
        throw new Error(`User ${email} already has a pending invitation`);
      }

      // Check if user already member
      const isMember = await this.isUserMember(tenantId, email);
      if (isMember) {
        throw new Error(`User ${email} is already a member of this tenant`);
      }

      // Generate unique invitation token
      const token = this.generateToken();
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours

      // Create invitation record
      const { data, error } = await getDb()
        .from('tenant_invitations')
        .insert([{
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          email,
          role,
          token,
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create invitation: ${error.message}`);
      }

      // Log to hash chain
      const hashChain = getHashChainForTenant(tenantId);
      await hashChain.addEntry(JSON.stringify({
        type: 'invitation_created',
        email,
        role,
        invitedAt: new Date().toISOString(),
      }));

      // Send notification via Discord
      const logger = getDiscordLoggerForTenant(tenantId);
      await logger.log({
        type: 'member_invited',
        content: `Invited ${email} as ${role}`,
        status: 'completed',
        metadata: { email, role, expiresIn: '6 hours' },
      });

      return {
        id: data.id,
        tenantId: data.tenant_id,
        email: data.email,
        role: data.role,
        token: data.token,
        status: data.status,
        createdAt: new Date(data.created_at),
        expiresAt: new Date(data.expires_at),
      };
    } catch (error) {
      console.error('Failed to invite user:', error);
      throw error;
    }
  }

  /**
   * Accept invitation and add user to tenant
   */
  async acceptInvitation(token: string, userId: string): Promise<void> {
    try {
      // Get invitation by token
      const { data: invitation, error: invError } = await getDb()
        .from('tenant_invitations')
        .select('*')
        .eq('token', token)
        .single();

      if (invError || !invitation) {
        throw new Error('Invalid or expired invitation');
      }

      // Verify not already expired
      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error('Invitation has expired');
      }

      // Verify not already accepted
      if (invitation.status !== 'pending') {
        throw new Error(`Invitation already ${invitation.status}`);
      }

      // Get user details
      const { data, error: userError } = await getDb()
        .auth.admin.getUserById(userId);

      if (userError || !data?.user) {
        throw new Error('User not found');
      }

      // Add user to tenant members
      const { error: updateError } = await getDb()
        .from('tenant_members')
        .insert([{
          id: crypto.randomUUID(),
          tenant_id: invitation.tenant_id,
          user_id: userId,
          role: invitation.role,
          invited_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
        }]);

      if (updateError && !updateError.message?.includes('duplicate')) {
        throw updateError;
      }

      // Update invitation status
      const { error: statusError } = await getDb()
        .from('tenant_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('token', token);

      if (statusError) {
        throw statusError;
      }

      // Log to hash chain
      const hashChain = getHashChainForTenant(invitation.tenant_id);
      await hashChain.addEntry(JSON.stringify({
        type: 'invitation_accepted',
        email: invitation.email,
        userId,
        role: invitation.role,
        acceptedAt: new Date().toISOString(),
      }));

      // Send notification
      const user = (data as any).user;
      const logger = getDiscordLoggerForTenant(invitation.tenant_id);
      await logger.log({
        type: 'member_joined',
        content: `${(user as any).email} accepted invitation (${invitation.role})`,
        status: 'completed',
        metadata: { email: (user as any).email, userId, role: invitation.role },
      });
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      throw error;
    }
  }

  /**
   * Reject invitation
   */
  async rejectInvitation(token: string): Promise<void> {
    try {
      // Get invitation
      const { data: invitation, error: getError } = await getDb()
        .from('tenant_invitations')
        .select('*')
        .eq('token', token)
        .single();

      if (getError || !invitation) {
        throw new Error('Invitation not found');
      }

      // Update status
      const { error: updateError } = await getDb()
        .from('tenant_invitations')
        .update({ status: 'rejected' })
        .eq('token', token);

      if (updateError) {
        throw updateError;
      }

      // Log to hash chain
      const hashChain = getHashChainForTenant(invitation.tenant_id);
      await hashChain.addEntry(JSON.stringify({
        type: 'invitation_rejected',
        email: invitation.email,
        rejectedAt: new Date().toISOString(),
      }));

      // Send notification
      const logger = getDiscordLoggerForTenant(invitation.tenant_id);
      await logger.log({
        type: 'invitation_rejected',
        content: `${invitation.email} rejected invitation`,
        status: 'completed',
        metadata: { email: invitation.email },
      });
    } catch (error) {
      console.error('Failed to reject invitation:', error);
      throw error;
    }
  }

  /**
   * Get pending invitations for email address
   */
  async getPendingInvitations(email: string): Promise<TenantInvitation[]> {
    try {
      const { data, error } = await getDb()
        .from('tenant_invitations')
        .select('*')
        .eq('email', email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Failed to fetch invitations:', error);
        return [];
      }

      return (data || []).map(inv => ({
        id: inv.id,
        tenantId: inv.tenant_id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        status: inv.status,
        createdAt: new Date(inv.created_at),
        expiresAt: new Date(inv.expires_at),
        acceptedAt: inv.accepted_at ? new Date(inv.accepted_at) : undefined,
      }));
    } catch (error) {
      console.error('Failed to get pending invitations:', error);
      return [];
    }
  }

  /**
   * List all members of tenant
   */
  async listMembers(tenantId: string): Promise<TenantMember[]> {
    try {
      const { data, error } = await getDb()
        .from('tenant_members')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch members:', error);
        return [];
      }

      return (data || []).map(m => ({
        userId: m.user_id,
        email: m.email || 'Unknown',
        role: m.role,
        joinedAt: new Date(m.joined_at),
      }));
    } catch (error) {
      console.error('Failed to list members:', error);
      return [];
    }
  }

  /**
   * Change member role
   */
  async changeMemberRole(
    tenantId: string,
    userId: string,
    newRole: string
  ): Promise<void> {
    try {
      // Verify new role is valid
      if (!['owner', 'admin', 'member', 'viewer'].includes(newRole)) {
        throw new Error(`Invalid role: ${newRole}`);
      }

      // Update role
      const { error } = await getDb()
        .from('tenant_members')
        .update({ role: newRole })
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // Log to hash chain
      const hashChain = getHashChainForTenant(tenantId);
      await hashChain.addEntry(JSON.stringify({
        type: 'member_role_changed',
        userId,
        newRole,
        changedAt: new Date().toISOString(),
      }));

      // Send notification
      const logger = getDiscordLoggerForTenant(tenantId);
      await logger.log({
        type: 'member_role_changed',
        content: `Member role changed to ${newRole}`,
        status: 'completed',
        metadata: { userId, newRole },
      });
    } catch (error) {
      console.error('Failed to change member role:', error);
      throw error;
    }
  }

  /**
   * Remove member from tenant
   */
  async removeMember(tenantId: string, userId: string): Promise<void> {
    try {
      // Verify not removing owner
      const { data: member } = await getDb()
        .from('tenant_members')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .single();

      if (member?.role === 'owner') {
        throw new Error('Cannot remove tenant owner');
      }

      // Remove member
      const { error } = await getDb()
        .from('tenant_members')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // Log to hash chain
      const hashChain = getHashChainForTenant(tenantId);
      await hashChain.addEntry(JSON.stringify({
        type: 'member_removed',
        userId,
        removedAt: new Date().toISOString(),
      }));

      // Send notification
      const logger = getDiscordLoggerForTenant(tenantId);
      await logger.log({
        type: 'member_removed',
        content: `Member removed from tenant`,
        status: 'completed',
        metadata: { userId },
      });
    } catch (error) {
      console.error('Failed to remove member:', error);
      throw error;
    }
  }

  /**
   * Check if user has specific role or higher
   */
  async userHasRole(
    tenantId: string,
    userId: string,
    requiredRole: string
  ): Promise<boolean> {
    try {
      const { data } = await getDb()
        .from('tenant_members')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .single();

      if (!data) {
        return false;
      }

      const roleHierarchy: Record<string, number> = {
        owner: 4,
        admin: 3,
        member: 2,
        viewer: 1,
      };

      const userRoleLevel = roleHierarchy[data.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

      return userRoleLevel >= requiredRoleLevel;
    } catch (error) {
      console.error('Failed to check user role:', error);
      return false;
    }
  }

  /**
   * Get invitation details (without exposing token to frontend)
   */
  async getInvitationDetails(token: string): Promise<{
    tenantId: string;
    tenantName: string;
    role: string;
    expiresAt: Date;
  } | null> {
    try {
      const { data: invitation } = await getDb()
        .from('tenant_invitations')
        .select('tenant_id, role, expires_at')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (!invitation) {
        return null;
      }

      // Verify not expired
      if (new Date(invitation.expires_at) < new Date()) {
        return null;
      }

      // Get tenant name
      const { data: tenant } = await getDb()
        .from('tenants')
        .select('name')
        .eq('id', invitation.tenant_id)
        .single();

      return {
        tenantId: invitation.tenant_id,
        tenantName: tenant?.name || 'Unknown Tenant',
        role: invitation.role,
        expiresAt: new Date(invitation.expires_at),
      };
    } catch (error) {
      console.error('Failed to get invitation details:', error);
      return null;
    }
  }

  /**
   * Private helper: Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Private helper: Generate random token
   */
  private generateToken(): string {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 24);
  }

  /**
   * Private helper: Get pending invitation for email
   */
  private async getPendingInvitationForEmail(
    tenantId: string,
    email: string
  ): Promise<TenantInvitation | null> {
    try {
      const { data } = await getDb()
        .from('tenant_invitations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('email', email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!data) return null;

      return {
        id: data.id,
        tenantId: data.tenant_id,
        email: data.email,
        role: data.role,
        token: data.token,
        status: data.status,
        createdAt: new Date(data.created_at),
        expiresAt: new Date(data.expires_at),
      };
    } catch {
      return null;
    }
  }

  /**
   * Private helper: Check if user already member
   */
  private async isUserMember(tenantId: string, email: string): Promise<boolean> {
    try {
      // Get user by email from auth
      const { data } = await getDb()
        .auth.admin.listUsers();

      const users = (data as any)?.users;
      const user = Array.isArray(users) ? (users as any).find((u: any) => u.email === email) : null;
      if (!user) return false;

      // Check if user in tenant_members
      const { data: memberData } = await getDb()
        .from('tenant_members')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', (user as any).id)
        .single();

      return !!memberData;
    } catch {
      return false;
    }
  }
}

/**
 * Factory function
 */
export function getTenantInviteService(): TenantInviteService {
  return new TenantInviteService();
}
