import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getRoutingConfigs,
  updateRouting,
  toggleRoute,
  subscribeToRoutingUpdates,
} from '../../lib/supabase-queries';
import { RoutingConfig as RoutingConfigType } from '../../types/control-plane';

export default function RoutingConfig() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<RoutingConfigType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<RoutingConfigType>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Available models
  const availableModels = [
    { id: 'deepseek-v3.2', name: 'DeepSeek v3.2', provider: 'DeepSeek' },
    { id: 'gemini-flash', name: 'Gemini Flash', provider: 'Google' },
    { id: 'claude-opus', name: 'Claude Opus', provider: 'Anthropic' },
    { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'Anthropic' },
  ];

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRoutingConfigs();
      setConfigs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load routing configs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();

    // Subscribe to real-time updates
    const channel = subscribeToRoutingUpdates((newConfig) => {
      setConfigs((prev) => {
        const existing = prev.find((c) => c.id === newConfig.id);
        if (existing) {
          return prev.map((c) => (c.id === newConfig.id ? newConfig : c));
        }
        return [...prev, newConfig];
      });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [loadConfigs]);

  const handleEdit = (config: RoutingConfigType) => {
    setEditingId(config.id);
    setEditValues({
      primary_model: config.primary_model,
      fallback_model: config.fallback_model,
    });
  };

  const handleSave = async (configId: string) => {
    if (!editValues.primary_model) {
      setError('Primary model is required');
      return;
    }

    try {
      setActionLoading(configId);
      await updateRouting(configId, editValues.primary_model, editValues.fallback_model || null);
      setEditingId(null);
      await loadConfigs();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save routing config');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (configId: string, currentState: boolean) => {
    try {
      setActionLoading(configId);
      await toggleRoute(configId, !currentState);
      await loadConfigs();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle route');
    } finally {
      setActionLoading(null);
    }
  };

  if (!user) {
    return (
      <div className="text-center text-gray-400">Please log in to view routing configs</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🛣️ Routing Configuration</h2>
        <button
          onClick={() => loadConfigs()}
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
      {loading && (
        <div className="text-center text-gray-400">Loading routing configurations...</div>
      )}

      {/* Routing Configs Table */}
      {!loading && configs.length > 0 && (
        <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-700 border-b border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Operation</th>
                <th className="px-4 py-3 text-left font-semibold">Primary Model</th>
                <th className="px-4 py-3 text-left font-semibold">Fallback</th>
                <th className="px-4 py-3 text-left font-semibold">Criticality</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr
                  key={config.id}
                  className="border-b border-gray-700 hover:bg-gray-750"
                >
                  <td className="px-4 py-3 text-gray-300">{config.operation_type}</td>
                  <td className="px-4 py-3">
                    {editingId === config.id ? (
                      <select
                        value={editValues.primary_model || ''}
                        onChange={(e) =>
                          setEditValues({ ...editValues, primary_model: e.target.value })
                        }
                        className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600"
                      >
                        <option value="">Select model</option>
                        {availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-blue-400">{config.primary_model}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === config.id ? (
                      <select
                        value={editValues.fallback_model || ''}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            fallback_model: e.target.value || null,
                          })
                        }
                        className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600"
                      >
                        <option value="">None</option>
                        {availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-400">{config.fallback_model || 'None'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        config.criticality_level === 'CRITICAL'
                          ? 'bg-red-900 text-red-200'
                          : config.criticality_level === 'HIGH'
                            ? 'bg-orange-900 text-orange-200'
                            : config.criticality_level === 'MEDIUM'
                              ? 'bg-yellow-900 text-yellow-200'
                              : 'bg-green-900 text-green-200'
                      }`}
                    >
                      {config.criticality_level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(config.id, config.is_enabled)}
                      disabled={actionLoading === config.id}
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        config.is_enabled
                          ? 'bg-green-900 text-green-200 hover:bg-green-800'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      } disabled:opacity-50`}
                    >
                      {actionLoading === config.id
                        ? '...'
                        : config.is_enabled
                          ? '✓ Enabled'
                          : '○ Disabled'}
                    </button>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    {editingId === config.id ? (
                      <>
                        <button
                          onClick={() => handleSave(config.id)}
                          disabled={actionLoading === config.id}
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
                      <button
                        onClick={() => handleEdit(config)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && configs.length === 0 && (
        <div className="text-center p-8 text-gray-400">
          No routing configurations found. Create one in the admin panel.
        </div>
      )}
    </div>
  );
}
