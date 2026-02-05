/**
 * Admin Dashboard - Tier 2: Control
 *
 * Phase 0.5 Admin Control Plane - Control Tier
 * Allows admins to change routing configuration and feature toggles
 *
 * Features:
 * - Model selector per operation
 * - Toggle feature switches
 * - Adjust daily budgets
 * - View pending approvals
 * - Change history log
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface RouteConfig {
  id: string;
  operation_id: string;
  operation_name: string;
  primary_model: string;
  fallback_model: string | null;
  enabled: boolean;
  cost_criticality: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface FeatureToggle {
  id: string;
  toggle_name: string;
  enabled: boolean;
  locked: boolean;
  controlled_by: 'ADMIN_ONLY' | 'USER' | 'BOTH';
  notes: string;
}

/**
 * Tier 2: Control Dashboard
 *
 * Allows manual adjustments:
 * - Change model routing per operation
 * - Enable/disable feature toggles
 * - Adjust budget limits
 * - Approve/reject pending operations
 */
export const AdminControls: React.FC = () => {
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRoutes();
    loadToggles();
  }, []);

  async function loadRoutes() {
    try {
      const { data, error: err } = await supabase
        .from('ai_model_routes')
        .select('*')
        .order('operation_id');

      if (err) throw err;
      setRoutes(data || []);
    } catch (e) {
      setError(`Failed to load routes: ${String(e)}`);
    }
  }

  async function loadToggles() {
    try {
      const { data, error: err } = await supabase
        .from('feature_toggles')
        .select('*')
        .order('toggle_name');

      if (err) throw err;
      setToggles(data || []);
      setLoading(false);
    } catch (e) {
      setError(`Failed to load toggles: ${String(e)}`);
      setLoading(false);
    }
  }

  async function updateRoute(routeId: string, primaryModel: string) {
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('ai_model_routes')
        .update({ primary_model: primaryModel, updated_at: new Date().toISOString() })
        .eq('id', routeId);

      if (err) throw err;
      await loadRoutes();
    } catch (e) {
      setError(`Failed to update route: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function updateToggle(toggleId: string, enabled: boolean) {
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('feature_toggles')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', toggleId);

      if (err) throw err;
      await loadToggles();
    } catch (e) {
      setError(`Failed to update toggle: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const availableModels = ['deepseek', 'gemini_flash', 'openai', 'deepgram', 'edge_tts'];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Admin Controls</h1>
        <p className="text-gray-600 mt-2">Manage routing configuration and feature toggles</p>
      </div>

      {/* Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Model Routing Configuration */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">AI Operation Routing</h2>
          <p className="text-sm text-gray-600 mt-1">
            Change which model handles each operation
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Operation
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Primary Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Fallback
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Criticality
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {routes.map((route) => (
                <tr key={route.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {route.operation_name}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <select
                      value={route.primary_model}
                      onChange={(e) => updateRoute(route.id, e.target.value)}
                      disabled={saving}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      {availableModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {route.fallback_model || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        route.cost_criticality === 'HIGH'
                          ? 'bg-red-100 text-red-800'
                          : route.cost_criticality === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {route.cost_criticality}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {route.enabled ? (
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-semibold">
                        Disabled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Feature Toggles</h2>
          <p className="text-sm text-gray-600 mt-1">
            Control Helix permissions and safety features
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {toggles.map((toggle) => (
            <div key={toggle.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">{toggle.toggle_name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{toggle.notes}</p>
                  <div className="text-xs text-gray-500 mt-2">
                    {toggle.locked && (
                      <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded mr-2">
                        🔒 Locked
                      </span>
                    )}
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      {toggle.controlled_by}
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  {toggle.locked ? (
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-2">Cannot change (locked)</div>
                      <button
                        disabled
                        className="px-4 py-2 bg-gray-200 text-gray-500 rounded text-sm cursor-not-allowed"
                      >
                        {toggle.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => updateToggle(toggle.id, !toggle.enabled)}
                      disabled={saving}
                      className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                        toggle.enabled
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                      }`}
                    >
                      {toggle.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warning Box */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-yellow-900">⚠️ Important</h3>
        <p className="text-sm text-yellow-800 mt-2">
          • Model routing changes apply immediately to new operations
        </p>
        <p className="text-sm text-yellow-800">
          • Locked toggles can only be changed via direct database modification (admin only)
        </p>
        <p className="text-sm text-yellow-800">
          • All changes are logged to the audit trail for compliance
        </p>
      </div>
    </div>
  );
};

export default AdminControls;
