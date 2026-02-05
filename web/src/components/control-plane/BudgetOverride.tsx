import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getUserBudgets,
  updateUserBudget,
  toggleUserBudget,
  subscribeToUserBudgetUpdates,
} from '@/lib/supabase-queries';
import { UserBudget } from '@/types/control-plane';

export default function BudgetOverride() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<UserBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    daily_limit: number;
    monthly_limit: number;
    warning_threshold_percent: number;
  }>({
    daily_limit: 0,
    monthly_limit: 0,
    warning_threshold_percent: 0,
  });

  const loadBudgets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUserBudgets();
      setBudgets(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user budgets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBudgets();

    // Subscribe to real-time updates
    const channel = subscribeToUserBudgetUpdates((updatedBudget) => {
      setBudgets((prev) =>
        prev.map((b) => (b.id === updatedBudget.id ? updatedBudget : b))
      );
    });

    return () => {
      channel.unsubscribe();
    };
  }, [loadBudgets]);

  const handleEdit = (budget: UserBudget) => {
    setEditingId(budget.id);
    setEditValues({
      daily_limit: budget.daily_limit,
      monthly_limit: budget.monthly_limit,
      warning_threshold_percent: budget.warning_threshold_percent,
    });
  };

  const handleSave = async (budgetId: string) => {
    if (editValues.daily_limit < 0 || editValues.monthly_limit < 0) {
      setError('Budget limits must be positive numbers');
      return;
    }

    if (
      editValues.warning_threshold_percent < 0 ||
      editValues.warning_threshold_percent > 100
    ) {
      setError('Warning threshold must be between 0 and 100');
      return;
    }

    try {
      setActionLoading(budgetId);
      await updateUserBudget(
        budgetId,
        editValues.daily_limit,
        editValues.monthly_limit,
        editValues.warning_threshold_percent
      );
      setEditingId(null);
      await loadBudgets();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update budget');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (budgetId: string, currentState: boolean) => {
    try {
      setActionLoading(budgetId);
      await toggleUserBudget(budgetId, !currentState);
      await loadBudgets();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle budget');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (budget: UserBudget): string => {
    if (!budget.is_active) {
      return 'bg-gray-700 text-gray-300';
    }

    const spendPercent = (budget.current_monthly_spend / budget.monthly_limit) * 100;

    if (spendPercent >= 100) {
      return 'bg-red-900 text-red-100';
    } else if (spendPercent >= budget.warning_threshold_percent) {
      return 'bg-yellow-900 text-yellow-100';
    }

    return 'bg-green-900 text-green-100';
  };

  const getStatusLabel = (budget: UserBudget): string => {
    if (!budget.is_active) {
      return 'Inactive';
    }

    const spendPercent = (budget.current_monthly_spend / budget.monthly_limit) * 100;

    if (spendPercent >= 100) {
      return 'Over Budget';
    } else if (spendPercent >= budget.warning_threshold_percent) {
      return 'Warning';
    }

    return 'OK';
  };

  if (!user) {
    return <div className="text-center text-gray-400">Please log in to view user budgets</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">💰 Budget Management</h2>
        <button
          onClick={() => loadBudgets()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-900 border border-red-700 rounded text-red-100">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && <div className="text-center text-gray-400">Loading user budgets...</div>}

      {/* Budgets Table */}
      {!loading && budgets.length > 0 && (
        <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-700 border-b border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">User Email</th>
                <th className="px-4 py-3 text-left font-semibold">Daily Limit</th>
                <th className="px-4 py-3 text-left font-semibold">Monthly Limit</th>
                <th className="px-4 py-3 text-left font-semibold">Monthly Spend</th>
                <th className="px-4 py-3 text-left font-semibold">Progress</th>
                <th className="px-4 py-3 text-left font-semibold">Warning %</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => {
                const spendPercent = (budget.current_monthly_spend / budget.monthly_limit) * 100;
                return (
                  <tr key={budget.id} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="px-4 py-3 text-gray-300">{budget.user_email}</td>
                    <td className="px-4 py-3">
                      {editingId === budget.id ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editValues.daily_limit}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              daily_limit: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="px-2 py-1 w-24 bg-gray-700 text-white rounded border border-gray-600"
                        />
                      ) : (
                        <span className="text-green-400">${budget.daily_limit.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === budget.id ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editValues.monthly_limit}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              monthly_limit: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="px-2 py-1 w-24 bg-gray-700 text-white rounded border border-gray-600"
                        />
                      ) : (
                        <span className="text-blue-400">${budget.monthly_limit.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      ${budget.current_monthly_spend.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-32 h-6 bg-gray-700 rounded overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            spendPercent >= 100
                              ? 'bg-red-600'
                              : spendPercent >= budget.warning_threshold_percent
                                ? 'bg-yellow-600'
                                : 'bg-green-600'
                          }`}
                          style={{
                            width: `${Math.min(spendPercent, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{spendPercent.toFixed(0)}%</span>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === budget.id ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editValues.warning_threshold_percent}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              warning_threshold_percent: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="px-2 py-1 w-20 bg-gray-700 text-white rounded border border-gray-600"
                        />
                      ) : (
                        <span className="text-gray-300">{budget.warning_threshold_percent}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded text-xs font-semibold ${getStatusColor(budget)}`}
                      >
                        {getStatusLabel(budget)}
                      </span>
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      {editingId === budget.id ? (
                        <>
                          <button
                            onClick={() => handleSave(budget.id)}
                            disabled={actionLoading === budget.id}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(budget)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggle(budget.id, budget.is_active)}
                            disabled={actionLoading === budget.id}
                            className={`px-3 py-1 rounded text-sm font-semibold ${
                              budget.is_active
                                ? 'bg-green-900 text-green-200 hover:bg-green-800'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            } disabled:opacity-50`}
                          >
                            {actionLoading === budget.id
                              ? '...'
                              : budget.is_active
                                ? '✓ Active'
                                : '○ Inactive'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && budgets.length === 0 && (
        <div className="text-center p-8 text-gray-400">
          No user budgets configured. Create budgets in the admin panel.
        </div>
      )}
    </div>
  );
}
