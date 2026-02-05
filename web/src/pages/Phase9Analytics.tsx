/**
 * Phase 9D Analytics Dashboard
 * Advanced analytics, trends, and optimization recommendations
 */

import React, { useState, useEffect } from 'react';
import { getAnalyticsService } from '@/services/analytics/analytics.service';
import { useAuth } from '@/hooks/useAuth';
import { PHASE_8_OPERATIONS } from '@/services/intelligence/constants';

export function Phase9Analytics(): React.ReactElement {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        const service = getAnalyticsService();
        const endDate = new Date();
        const startDate = new Date();

        if (period === 'week') startDate.setDate(startDate.getDate() - 7);
        else if (period === 'month') startDate.setDate(startDate.getDate() - 30);
        else if (period === 'quarter') startDate.setDate(startDate.getDate() - 90);

        const [summary, allMetrics, trends, recommendations] = await Promise.all([
          service.getPeriodSummary(user.id, startDate, endDate),
          service.getAllOperationMetrics(user.id, startDate, endDate),
          service.getCostTrends(user.id, 30),
          service.getRecommendations(user.id, 10),
        ]);

        setData({
          summary,
          allMetrics,
          trends,
          recommendations,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [user?.id, period]);

  if (!user?.id) {
    return <div className="p-8 text-center text-gray-500">Please sign in to view analytics</div>;
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading analytics...</div>;
  }

  if (error) {
    return <div className="p-8 bg-red-50 text-red-800 rounded-lg">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Operations Analytics</h1>
          <p className="text-gray-600 mt-2">Performance metrics, cost analysis, and optimization insights</p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          {['week', 'month', 'quarter'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p as any)}
              className={`px-4 py-2 rounded font-medium transition ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Cost"
          value={`$${data?.summary?.total_cost?.toFixed(2) || '0.00'}`}
          trend={`${data?.summary?.total_operations || 0} operations`}
          color="blue"
        />
        <MetricCard
          title="Operations"
          value={data?.summary?.total_operations || '0'}
          trend={`Avg: $${(data?.summary?.avg_cost_per_operation || 0).toFixed(4)}/op`}
          color="purple"
        />
        <MetricCard
          title="Success Rate"
          value={`${(data?.summary?.overall_success_rate || 0).toFixed(1)}%`}
          trend="Excellent reliability"
          color="green"
        />
        <MetricCard
          title="Avg Latency"
          value={`${data?.summary?.avg_latency_ms || 0}ms`}
          trend="Response time"
          color="orange"
        />
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <OperationCostBreakdown metrics={data?.allMetrics || []} />
        <ModelCostComparison metrics={data?.allMetrics || []} />
      </div>

      {/* Trends */}
      <CostTrendsChart trends={data?.trends || []} />

      {/* Operation Performance */}
      <OperationPerformanceTable metrics={data?.allMetrics || []} />

      {/* Recommendations */}
      <RecommendationsPanel recommendations={data?.recommendations || []} />
    </div>
  );
}

/**
 * Metric Card Component
 */
function MetricCard({ title, value, trend, color }: any): React.ReactElement {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    orange: 'bg-orange-50 border-orange-200 text-orange-600',
  };

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <p className="text-sm font-medium opacity-75">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <p className="text-xs mt-2 opacity-75">{trend}</p>
    </div>
  );
}

/**
 * Cost Breakdown by Operation
 */
function OperationCostBreakdown({ metrics }: any): React.ReactElement {
  const sorted = [...metrics].sort((a, b) => b.total_cost_usd - a.total_cost_usd);
  const total = sorted.reduce((sum, m) => sum + m.total_cost_usd, 0);

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 lg:col-span-2">
      <h2 className="text-lg font-semibold mb-4">Cost Breakdown by Operation</h2>

      <div className="space-y-3">
        {sorted.map(m => {
          const percentage = total > 0 ? (m.total_cost_usd / total) * 100 : 0;
          const opName = PHASE_8_OPERATIONS.find(o => o.id === m.operation_id)?.name || m.operation_id;

          return (
            <div key={m.operation_id}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">{opName}</span>
                <span className="text-sm text-gray-600">${m.total_cost_usd.toFixed(2)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% of total</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          Total: <span className="font-semibold text-gray-900">${total.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Model Cost Comparison
 */
function ModelCostComparison({ metrics }: any): React.ReactElement {
  const models = {
    anthropic: 0,
    deepseek: 0,
    gemini: 0,
    openai: 0,
  };

  metrics.forEach((m: any) => {
    Object.keys(models).forEach(model => {
      const count = m.models_used[model] || 0;
      // Estimate cost based on typical rates
      const costPerUse = {
        anthropic: 0.002,
        deepseek: 0.0008,
        gemini: 0.0015,
        openai: 0.003,
      };
      (models as any)[model] += count * (costPerUse as any)[model];
    });
  });

  const total = Object.values(models).reduce((a, b) => a + b, 0);
  const modelNames = {
    anthropic: 'Claude',
    deepseek: 'DeepSeek',
    gemini: 'Gemini',
    openai: 'GPT',
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">Model Comparison</h2>

      <div className="space-y-4">
        {Object.entries(models).map(([model, cost]) => {
          const percentage = total > 0 ? ((cost as number) / total) * 100 : 0;

          return (
            <div key={model}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">{(modelNames as any)[model]}</span>
                <span className="text-sm text-gray-600">${(cost as number).toFixed(2)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-2">
                <div
                  className={`h-2 rounded`}
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: {
                      anthropic: '#9d4edd',
                      deepseek: '#3a86ff',
                      gemini: '#fb5607',
                      openai: '#06a77d',
                    }[model as string],
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Cost Trends Chart
 */
function CostTrendsChart({ trends }: any): React.ReactElement {
  const maxCost = Math.max(...trends.map((t: any) => t.total_cost_usd), 1);

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">Cost Trends (Last 30 Days)</h2>

      <div className="flex items-end gap-1 h-48">
        {trends.slice(-30).map((trend: any, idx: number) => {
          const percentage = (trend.total_cost_usd / maxCost) * 100;

          return (
            <div
              key={idx}
              className="flex-1 bg-blue-600 rounded-t hover:bg-blue-700 transition cursor-pointer group relative"
              style={{ height: `${Math.max(percentage, 2)}%` }}
            >
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                {trend.date}: ${trend.total_cost_usd.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-between text-xs text-gray-600">
        <span>{trends[0]?.date || 'N/A'}</span>
        <span>{trends[trends.length - 1]?.date || 'N/A'}</span>
      </div>
    </div>
  );
}

/**
 * Operation Performance Table
 */
function OperationPerformanceTable({ metrics }: any): React.ReactElement {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Operation Performance</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Operation</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-900">Executions</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-900">Success Rate</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-900">Total Cost</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-900">Avg Latency</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m: any) => {
              const opName = PHASE_8_OPERATIONS.find(o => o.id === m.operation_id)?.name || m.operation_id;
              const successClass = m.success_rate >= 95 ? 'text-green-600' : m.success_rate >= 90 ? 'text-yellow-600' : 'text-red-600';

              return (
                <tr key={m.operation_id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{opName}</td>
                  <td className="px-6 py-4 text-right text-gray-600">{m.total_executions}</td>
                  <td className={`px-6 py-4 text-right font-medium ${successClass}`}>
                    {m.success_rate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">${m.total_cost_usd.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-gray-600">{m.avg_latency_ms}ms</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Recommendations Panel
 */
function RecommendationsPanel({ recommendations }: any): React.ReactElement {
  if (recommendations.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-800 font-medium">✓ All systems optimized</p>
        <p className="text-sm text-green-700 mt-1">No optimization recommendations at this time</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-amber-50">
        <h2 className="text-lg font-semibold">Optimization Recommendations</h2>
        <p className="text-sm text-gray-600 mt-1">{recommendations.length} suggestions to improve performance and reduce costs</p>
      </div>

      <div className="divide-y divide-gray-200">
        {recommendations.map((rec: any) => (
          <div key={rec.id} className="p-6 hover:bg-gray-50 transition">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">{rec.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                rec.recommendation_type === 'cost' ? 'bg-green-100 text-green-800' :
                rec.recommendation_type === 'performance' ? 'bg-blue-100 text-blue-800' :
                rec.recommendation_type === 'usage' ? 'bg-purple-100 text-purple-800' :
                'bg-orange-100 text-orange-800'
              }`}>
                {rec.recommendation_type}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
              {rec.estimated_savings_percent > 0 && (
                <div>
                  <p className="text-xs text-gray-600">Potential Savings</p>
                  <p className="font-semibold text-green-600 mt-1">
                    {rec.estimated_savings_percent.toFixed(0)}% (${rec.estimated_savings_usd.toFixed(2)})
                  </p>
                </div>
              )}
              {rec.estimated_latency_improvement_percent > 0 && (
                <div>
                  <p className="text-xs text-gray-600">Latency Improvement</p>
                  <p className="font-semibold text-blue-600 mt-1">
                    {rec.estimated_latency_improvement_percent.toFixed(0)}%
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-600">Effort</p>
                <p className="font-semibold mt-1">
                  {rec.estimated_implementation_effort === 'trivial' && '🟢'}
                  {rec.estimated_implementation_effort === 'easy' && '🟡'}
                  {rec.estimated_implementation_effort === 'moderate' && '🟠'}
                  {rec.estimated_implementation_effort === 'difficult' && '🔴'}
                  {' ' + rec.estimated_implementation_effort.charAt(0).toUpperCase() + rec.estimated_implementation_effort.slice(1)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Phase9Analytics;
