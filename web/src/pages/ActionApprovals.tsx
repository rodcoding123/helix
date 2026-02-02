import { FC, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AutonomyManagerService } from '@/services/autonomy-manager';
import { ActionApprovalCard } from '@/components/autonomy/ActionApprovalCard';
import type { AutonomyAction } from '@/lib/types/agents';

/**
 * ActionApprovals Page: View and approve pending actions
 * Shows queue of actions awaiting user approval
 */
export const ActionApprovalsPage: FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [pendingActions, setPendingActions] = useState<AutonomyAction[]>([]);
  const [actionHistory, setActionHistory] = useState<AutonomyAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState<'pending' | 'history'>('pending');

  const autonomyManager = new AutonomyManagerService();

  // Load actions on mount
  useEffect(() => {
    if (user?.id) {
      loadActions();
    }
  }, [user?.id]);

  const loadActions = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const pending = await autonomyManager.getPendingActions(user.id);
      const history = await autonomyManager.getActionHistory(user.id, 20);
      setPendingActions(pending);
      setActionHistory(history);
    } catch (error) {
      console.error('Failed to load actions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (actionId: string) => {
    if (!user?.id) return;
    try {
      await autonomyManager.approveAction(actionId, user.id);
      // Reload actions
      await loadActions();
    } catch (error) {
      console.error('Failed to approve action:', error);
    }
  };

  const handleReject = async (actionId: string) => {
    if (!user?.id) return;
    try {
      await autonomyManager.rejectAction(actionId, user.id);
      // Reload actions
      await loadActions();
    } catch (error) {
      console.error('Failed to reject action:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-600">Please sign in to view action approvals.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">Action Approvals</h1>
        <p className="text-gray-600">
          Review and approve Helix's proposed actions
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            tab === 'pending'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Pending ({pendingActions.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            tab === 'history'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          History ({actionHistory.length})
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading actions...</p>
        </div>
      ) : tab === 'pending' ? (
        <div className="space-y-3">
          {pendingActions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No pending actions. All clear!</p>
            </div>
          ) : (
            pendingActions.map((action) => (
              <ActionApprovalCard
                key={action.id}
                action={action}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {actionHistory.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No action history yet.</p>
            </div>
          ) : (
            actionHistory.map((action) => (
              <div
                key={action.id}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {action.action_type
                        .split('_')
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ')}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {action.action_description}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      action.status === 'executed'
                        ? 'bg-green-100 text-green-900'
                        : action.status === 'rejected'
                          ? 'bg-red-100 text-red-900'
                          : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {action.status.charAt(0).toUpperCase() +
                      action.status.slice(1)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {action.executed_at
                    ? `Executed ${new Date(action.executed_at).toLocaleDateString()}`
                    : `Created ${new Date(action.created_at).toLocaleDateString()}`}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ActionApprovalsPage;
