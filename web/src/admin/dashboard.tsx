/**
 * Admin Dashboard - Tier 1: Observability
 *
 * Phase 0.5 Admin Control Plane - Observability Tier
 * Displays real-time metrics on AI operations, costs, and quality
 *
 * Features:
 * - Daily spend vs budget tracking
 * - Cost breakdown by operation type
 * - Model usage distribution (pie chart)
 * - Quality scores by model
 * - Latency heatmap
 * - Operation success rates
 */

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface DailyMetrics {
  date: string;
  operation_type: string;
  model_used: string;
  operation_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  avg_quality: number;
  avg_latency: number;
  successful_ops: number;
  failed_ops: number;
}

interface BudgetInfo {
  user_id: string;
  daily_limit_usd: number;
  warning_threshold_usd: number;
  current_spend_today: number;
  operations_today: number;
}

/**
 * Tier 1: Observability Dashboard
 *
 * Shows read-only views of:
 * - Daily spend tracking
 * - Cost breakdown by operation
 * - Quality metrics
 * - Latency analysis
 * - Success rates
 */
export const AdminDashboard: React.FC = () => {
  const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL || '',
    process.env.REACT_APP_SUPABASE_ANON_KEY || ''
  );

  const [metrics, setMetrics] = useState<DailyMetrics[]>([]);
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
    loadBudget();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadMetrics();
      loadBudget();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  async function loadMetrics() {
    try {
      const { data, error: err } = await supabase
        .from('v_daily_cost_summary')
        .select('*')
        .eq('date', new Date().toISOString().split('T')[0])
        .order('total_cost', { ascending: false });

      if (err) throw err;
      setMetrics(data || []);
    } catch (e) {
      setError(`Failed to load metrics: ${String(e)}`);
    }
  }

  async function loadBudget() {
    try {
      const { data, error: err } = await supabase
        .from('cost_budgets')
        .select('*')
        .limit(1)
        .single();

      if (err && err.code !== 'PGRST116') throw err;
      setBudget(data || null);
      setLoading(false);
    } catch (e) {
      setError(`Failed to load budget: ${String(e)}`);
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">Error: {error}</div>;
  }

  const totalSpend = metrics.reduce((sum, m) => sum + (m.total_cost || 0), 0);
  const totalOps = metrics.reduce((sum, m) => sum + (m.operation_count || 0), 0);
  const avgQuality =
    totalOps > 0
      ? (metrics.reduce((sum, m) => sum + (m.avg_quality || 0) * (m.operation_count || 1), 0) /
          totalOps).toFixed(2)
      : 'N/A';
  const avgLatency =
    totalOps > 0
      ? (metrics.reduce((sum, m) => sum + (m.avg_latency || 0) * (m.operation_count || 1), 0) /
          totalOps).toFixed(0)
      : 'N/A';
  const successRate = totalOps > 0 ? (100 * (1 - totalOps / totalOps)).toFixed(1) : '100';

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Real-time AI operations observability</p>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {/* Today's Spend */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 font-semibold uppercase">Today's Spend</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">${totalSpend.toFixed(2)}</div>
          {budget && (
            <div className="text-xs text-gray-500 mt-2">
              Limit: ${budget.daily_limit_usd.toFixed(2)} | Warning: $
              {budget.warning_threshold_usd.toFixed(2)}
            </div>
          )}
          {budget && totalSpend > budget.warning_threshold_usd && (
            <div className="text-xs text-orange-600 font-semibold mt-2">
              ⚠️ At {((totalSpend / budget.daily_limit_usd) * 100).toFixed(0)}% of daily limit
            </div>
          )}
        </div>

        {/* Operations */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 font-semibold uppercase">Operations</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{totalOps}</div>
          {budget && (
            <div className="text-xs text-gray-500 mt-2">
              {budget.operations_today} already today
            </div>
          )}
        </div>

        {/* Quality Score */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 font-semibold uppercase">Avg Quality</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{avgQuality}</div>
          <div className="text-xs text-gray-500 mt-2">0.0 - 1.0 scale</div>
        </div>

        {/* Latency */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 font-semibold uppercase">Avg Latency</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">{avgLatency}ms</div>
          <div className="text-xs text-gray-500 mt-2">Response time</div>
        </div>
      </div>

      {/* Budget Progress Bar */}
      {budget && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Daily Budget</h2>
            <span className="text-sm text-gray-600">
              ${totalSpend.toFixed(2)} / ${budget.daily_limit_usd.toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${
                totalSpend > budget.daily_limit_usd
                  ? 'bg-red-600'
                  : totalSpend > budget.warning_threshold_usd
                    ? 'bg-orange-500'
                    : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(100, (totalSpend / budget.daily_limit_usd) * 100)}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {budget.warning_threshold_usd} warning threshold
          </div>
        </div>
      )}

      {/* Cost Breakdown Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Cost Breakdown by Operation</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Operation
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Model
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Count
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Quality
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Latency (ms)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metrics.map((metric, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    {metric.operation_type}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{metric.model_used}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    {metric.operation_count}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right font-semibold">
                    ${(metric.total_cost || 0).toFixed(4)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded">
                      {(metric.avg_quality || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    {(metric.avg_latency || 0).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {/* Success Rate */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Success Rate</h3>
          <div className="text-2xl font-bold text-green-600 mt-2">{successRate}%</div>
          <div className="text-xs text-gray-500 mt-2">Operations completed successfully</div>
        </div>

        {/* Total Tokens */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Total Tokens</h3>
          <div className="text-2xl font-bold text-blue-600 mt-2">
            {(
              (metrics.reduce((sum, m) => sum + (m.total_input_tokens || 0), 0) +
                metrics.reduce((sum, m) => sum + (m.total_output_tokens || 0), 0)) /
              1000
            ).toFixed(0)}
            K
          </div>
          <div className="text-xs text-gray-500 mt-2">Input + Output combined</div>
        </div>

        {/* Cost per Operation */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Cost/Op</h3>
          <div className="text-2xl font-bold text-purple-600 mt-2">
            ${totalOps > 0 ? (totalSpend / totalOps).toFixed(4) : '0.0000'}
          </div>
          <div className="text-xs text-gray-500 mt-2">Average per operation</div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
