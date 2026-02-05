/**
 * Phase 11 Week 2: Tenant Settings Component
 * Main settings page for managing team members and invitations
 */

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant/tenant-context';
import { getTenantInviteService, TenantMember } from '@/services/tenant/invite-service';
import InviteMembers from './InviteMembers';
import TeamMemberCard from './TeamMemberCard';
import { AlertCircle, Users, Loader2 } from 'lucide-react';

export default function TenantSettings() {
  const { tenant } = useTenant();
  const inviteService = getTenantInviteService();

  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'invite'>('members');

  // Load members
  useEffect(() => {
    loadMembers();
  }, [tenant?.id]);

  const loadMembers = async () => {
    if (!tenant?.id) return;

    try {
      setLoading(true);
      setError(null);
      const membersList = await inviteService.listMembers(tenant.id);
      setMembers(membersList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSuccess = async () => {
    setActiveTab('members');
    // Reload members to show any pending invitations
    await loadMembers();
  };

  const handleRemoveMember = async (userId: string) => {
    if (!tenant?.id) return;

    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      await inviteService.removeMember(tenant.id, userId);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
      console.error('Failed to remove member:', err);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!tenant?.id) return;

    try {
      await inviteService.changeMemberRole(tenant.id, userId, newRole);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
      console.error('Failed to change role:', err);
    }
  };

  if (!tenant) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Select a tenant to manage settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{tenant.name} Settings</h1>
        <p className="mt-2 text-gray-600">Manage team members and invitations</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'members'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team Members
          </div>
        </button>
        <button
          onClick={() => setActiveTab('invite')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'invite'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>Invite</span>
          </div>
        </button>
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No members yet</p>
              <button
                onClick={() => setActiveTab('invite')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Invite Members
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {members.map(member => (
                <TeamMemberCard
                  key={member.userId}
                  member={member}
                  onRemove={handleRemoveMember}
                  onChangeRole={handleChangeRole}
                  isCurrentUser={false} // In a real app, compare with current user
                  canManage={true} // In a real app, check user's role
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite Tab */}
      {activeTab === 'invite' && (
        <div className="max-w-2xl">
          <InviteMembers
            tenantId={tenant.id}
            onSuccess={handleInviteSuccess}
            onError={err => setError(err)}
          />
        </div>
      )}
    </div>
  );
}
