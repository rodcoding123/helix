/**
 * Phase 11 Week 2: Invitation Accept Component
 * Handles accepting an invitation via token
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getTenantInviteService } from '@/services/tenant/invite-service';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function InvitationAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inviteService = getTenantInviteService();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState<{
    tenantId: string;
    tenantName: string;
    role: string;
    expiresAt: Date;
  } | null>(null);
  const [accepting, setAccepting] = useState(false);

  const token = searchParams.get('token');
  const userId = searchParams.get('userId'); // Would come from auth context in real app

  // Load invitation details
  useEffect(() => {
    loadInvitationDetails();
  }, [token]);

  const loadInvitationDetails = async () => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const details = await inviteService.getInvitationDetails(token);

      if (!details) {
        setError('Invitation not found or has expired');
      } else {
        setInvitationDetails(details);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation');
      console.error('Failed to load invitation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token || !userId) {
      setError('Missing required information');
      return;
    }

    try {
      setAccepting(true);
      await inviteService.acceptInvitation(token, userId);
      setSuccess(true);

      // Redirect to tenant after 2 seconds
      setTimeout(() => {
        navigate(`/tenants/${invitationDetails?.tenantId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      console.error('Failed to accept invitation:', err);
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!token) return;

    try {
      setAccepting(true);
      await inviteService.rejectInvitation(token);
      setSuccess(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject invitation');
      console.error('Failed to reject invitation:', err);
    } finally {
      setAccepting(false);
    }
  };

  const isExpired = invitationDetails ? new Date(invitationDetails.expiresAt) < new Date() : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-center">
          <h1 className="text-2xl font-bold text-white">Team Invitation</h1>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Loading State */}
          {loading && (
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
              <p className="text-gray-600">Loading invitation...</p>
            </div>
          )}

          {/* Success State */}
          {success && (
            <div className="text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
              <div>
                <p className="font-semibold text-gray-900">Success!</p>
                <p className="text-sm text-gray-600 mt-1">
                  You've been added to the team. Redirecting...
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/')}
                className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Go Home
              </button>
            </div>
          )}

          {/* Invitation Details */}
          {invitationDetails && !error && !success && (
            <div className="space-y-6">
              {/* Expiration Warning */}
              {isExpired && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Invitation Expired</p>
                    <p className="text-sm text-red-700">This invitation has expired. Please request a new one.</p>
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-600">TEAM</p>
                  <p className="text-lg font-semibold text-gray-900">{invitationDetails.tenantName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600">YOUR ROLE</p>
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {invitationDetails.role === 'viewer' && 'Viewer (Read-only)'}
                    {invitationDetails.role === 'member' && 'Member (Can use operations)'}
                    {invitationDetails.role === 'admin' && 'Admin (Can manage team)'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAccept}
                  disabled={accepting || isExpired}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {accepting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Accept
                </button>
                <button
                  onClick={handleReject}
                  disabled={accepting}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Decline
                </button>
              </div>

              {/* Info */}
              <p className="text-xs text-gray-600 text-center">
                By accepting, you'll be added to {invitationDetails.tenantName} and can start collaborating.
              </p>
            </div>
          )}

          {/* No Token */}
          {!token && !loading && !error && (
            <div className="text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto" />
              <p className="text-gray-600">No invitation token provided</p>
              <button
                onClick={() => navigate('/')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go Home
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
