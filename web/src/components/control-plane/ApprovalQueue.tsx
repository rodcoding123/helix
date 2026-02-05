import { useEffect, useState } from 'react';
import {
  getPendingApprovals,
  approveOperation,
  rejectOperation,
  subscribeToApprovalUpdates,
} from '../../lib/supabase-queries';
import { PendingApproval } from '../../types/control-plane';
import { useAuth } from '../../hooks/useAuth';

export default function ApprovalQueue() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    loadApprovals();
    const subscription = subscribeToApprovalUpdates((newApproval) => {
      setApprovals((prev) => [newApproval, ...prev]);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadApprovals() {
    try {
      setLoading(true);
      const data = await getPendingApprovals();
      setApprovals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    if (!user?.id) return;
    try {
      setActioning(id);
      await approveOperation(id, user.id);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(id: string) {
    if (!user?.id) return;
    const reason = rejectionReasons[id] || 'No reason provided';
    try {
      setActioning(id);
      await rejectOperation(id, reason, user.id);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      setRejectionReasons((prev) => ({ ...prev, [id]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActioning(null);
    }
  }

  if (loading) return <div className="text-center py-8">Loading approvals...</div>;

  const pendingCount = approvals.length;
  const totalCostNeeded = approvals.reduce((sum, a) => sum + a.estimated_cost, 0);

  return (
    <div className="space-y-6">
      <div className="bg-gray-600 rounded p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-400 text-sm">Pending Approvals</div>
            <div className="text-3xl font-bold text-yellow-400">{pendingCount}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Total Cost Blocked</div>
            <div className="text-3xl font-bold text-red-400">${totalCostNeeded.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-900 text-red-100 rounded p-4">{error}</div>}

      {pendingCount === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-2xl mb-2">✓ All Clear</div>
          <div>No pending approvals. All operations approved!</div>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="bg-gray-700 rounded p-4 border-l-4 border-yellow-500"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="font-semibold text-lg">{approval.operation_type}</div>
                  <div className="text-sm text-gray-400 mt-1">ID: {approval.operation_id}</div>
                  <div className="text-sm text-gray-400">Reason: {approval.reason}</div>
                  <div className="text-sm text-yellow-400 font-semibold mt-2">
                    Cost: ${approval.estimated_cost.toFixed(2)}
                  </div>
                </div>
                <div className="text-right text-sm text-gray-400">
                  {new Date(approval.created_at).toLocaleString()}
                </div>
              </div>

              {actioning !== approval.id && (
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Rejection reason (optional)"
                    value={rejectionReasons[approval.id] || ''}
                    onChange={(e) =>
                      setRejectionReasons((prev) => ({
                        ...prev,
                        [approval.id]: e.target.value,
                      }))
                    }
                    className="w-full bg-gray-600 text-white rounded px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(approval.id)}
                  disabled={actioning !== null}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded py-2 font-semibold transition"
                >
                  {actioning === approval.id ? '...' : '✓ Approve'}
                </button>
                <button
                  onClick={() => handleReject(approval.id)}
                  disabled={actioning !== null}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded py-2 font-semibold transition"
                >
                  {actioning === approval.id ? '...' : '✗ Reject'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
