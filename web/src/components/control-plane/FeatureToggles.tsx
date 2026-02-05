import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getFeatureToggles,
  updateFeatureToggle,
  subscribeToFeatureToggleUpdates,
} from '../../lib/supabase-queries';
import { FeatureToggle, ToggleCategory } from '../../types/control-plane';

type CategoryGroup = Record<ToggleCategory, FeatureToggle[]>;

export default function FeatureToggles() {
  const { user } = useAuth();
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const categories: ToggleCategory[] = ['Safety', 'Performance', 'Intelligence', 'Cost Control'];

  const loadToggles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFeatureToggles();
      setToggles(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature toggles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToggles();

    // Subscribe to real-time updates
    const channel = subscribeToFeatureToggleUpdates((updatedToggle) => {
      setToggles((prev) =>
        prev.map((t) => (t.id === updatedToggle.id ? updatedToggle : t))
      );
    });

    return () => {
      channel.unsubscribe();
    };
  }, [loadToggles]);

  const handleToggle = async (toggleId: string, currentState: boolean, locked: boolean) => {
    if (locked) {
      setError('This toggle is locked and cannot be changed');
      return;
    }

    try {
      setActionLoading(toggleId);
      await updateFeatureToggle(toggleId, !currentState);
      await loadToggles();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feature toggle');
    } finally {
      setActionLoading(null);
    }
  };

  const groupedToggles = categories.reduce((acc, category) => {
    acc[category] = toggles.filter((t) => t.category === category);
    return acc;
  }, {} as CategoryGroup);

  const getCategoryIcon = (category: ToggleCategory): string => {
    switch (category) {
      case 'Safety':
        return '🔒';
      case 'Performance':
        return '⚡';
      case 'Intelligence':
        return '🧠';
      case 'Cost Control':
        return '💰';
    }
  };

  const getCategoryColor = (category: ToggleCategory): string => {
    switch (category) {
      case 'Safety':
        return 'bg-red-900 text-red-100 border-red-700';
      case 'Performance':
        return 'bg-yellow-900 text-yellow-100 border-yellow-700';
      case 'Intelligence':
        return 'bg-blue-900 text-blue-100 border-blue-700';
      case 'Cost Control':
        return 'bg-green-900 text-green-100 border-green-700';
    }
  };

  if (!user) {
    return <div className="text-center text-gray-400">Please log in to view feature toggles</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">⚙️ Feature Toggles</h2>
        <button
          onClick={() => loadToggles()}
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
      {loading && <div className="text-center text-gray-400">Loading feature toggles...</div>}

      {/* Categories */}
      {!loading && (
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category} className="space-y-3">
              {/* Category Header */}
              <div className={`p-4 rounded-lg border ${getCategoryColor(category)}`}>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  {getCategoryIcon(category)} {category}
                </h3>
                <p className="text-sm opacity-75 mt-1">
                  {groupedToggles[category].length} features
                </p>
              </div>

              {/* Category Toggles */}
              {groupedToggles[category].length > 0 ? (
                <div className="space-y-3 pl-4">
                  {groupedToggles[category].map((toggle) => (
                    <div
                      key={toggle.id}
                      className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white">{toggle.feature_name}</h4>
                          {toggle.locked && (
                            <span
                              className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-semibold"
                              title={toggle.lock_reason || 'Locked'}
                            >
                              🔒 Locked
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{toggle.description}</p>
                        {toggle.locked && toggle.lock_reason && (
                          <p className="text-xs text-gray-500 mt-2">Reason: {toggle.lock_reason}</p>
                        )}
                      </div>

                      {/* Toggle Button */}
                      <button
                        onClick={() => handleToggle(toggle.id, toggle.enabled, toggle.locked)}
                        disabled={actionLoading === toggle.id || toggle.locked}
                        className={`ml-4 px-4 py-2 rounded font-semibold transition-colors ${
                          toggle.enabled
                            ? 'bg-green-900 text-green-200 hover:bg-green-800'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        } ${toggle.locked ? 'opacity-50 cursor-not-allowed' : ''} disabled:opacity-50`}
                      >
                        {actionLoading === toggle.id ? '...' : toggle.enabled ? '✓ On' : '○ Off'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-4 pl-4">
                  No features in this category
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && toggles.length === 0 && (
        <div className="text-center p-8 text-gray-400">
          No feature toggles found. Configure features in the admin panel.
        </div>
      )}
    </div>
  );
}
