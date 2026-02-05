/**
 * Phase 11 Week 2: Invite Members Component
 * Form to invite new team members
 */

import { useState } from 'react';
import { getTenantInviteService } from '@/services/tenant/invite-service';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface InviteMembersProps {
  tenantId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function InviteMembers({ tenantId, onSuccess, onError }: InviteMembersProps) {
  const inviteService = getTenantInviteService();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      await inviteService.inviteUser(tenantId, email, role);

      setSuccess(true);
      setInvitedEmail(email);
      setEmail('');
      setRole('member');

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(false);
        setInvitedEmail(null);
      }, 5000);

      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(errorMessage);
      onError?.(errorMessage);
      console.error('Failed to invite user:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Invite Team Member</h2>
        <p className="text-gray-600 text-sm mt-1">Send an invitation link to add someone to your team</p>
      </div>

      {/* Success Message */}
      {success && invitedEmail && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Invitation sent successfully!</p>
            <p className="text-sm text-green-700">{invitedEmail} will receive an invitation link</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Failed to send invitation</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="user@example.com"
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Role
          </label>
          <select
            value={role}
            onChange={e => setRole(e.target.value as 'admin' | 'member' | 'viewer')}
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
          >
            <option value="viewer">Viewer (Read-only)</option>
            <option value="member">Member (Can use operations)</option>
            <option value="admin">Admin (Can invite & manage)</option>
          </select>
          <p className="text-xs text-gray-600 mt-2">
            {role === 'viewer' && 'Can view team operations and analytics'}
            {role === 'member' && 'Can use all operations and see analytics'}
            {role === 'admin' && 'Can invite members, manage roles, and use all operations'}
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Sending...' : 'Send Invitation'}
        </button>
      </form>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Invitations expire in 6 hours. The invited user will receive a link to join your team.
        </p>
      </div>
    </div>
  );
}
