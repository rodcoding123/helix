/**
 * Phase 9 Operation Analytics Dashboard
 * Real-time metrics and insights for operation execution
 * Shows cost, performance, success rates, and optimization recommendations
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, Zap, Clock, DollarSign, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getAnalyticsService, OperationMetrics, CostTrend, OptimizationRecommendation } from '@/services/analytics/analytics.service';

const OPERATION_NAMES: Record<string, string> = {
  'email-compose': 'Email Composition',
  'email-classify': 'Email Classification',
  'email-respond': 'Response Suggestions',
  'calendar-prep': 'Meeting Preparation',
  'calendar-time': 'Optimal Meeting Times',
  'task-prioritize': 'Task Prioritization',
  'task-breakdown': 'Task Breakdown',
  'analytics-summary': 'Weekly Summary',
  'analytics-anomaly': 'Pattern Anomalies',
};

const MODEL_COLORS: Record<string, string> = {
  anthropic: '#8B5CF6',
  deepseek: '#3B82F6',
  gemini: '#F59E0B',
  openai: '#10B981',
};

export function OperationAnalytics(): React.ReactElement {
  const { user } = useAuth();
  const analyticsService = getAnalyticsService();

  const [selectedPeriod, setSelectedPeriod] = useState<30 | 7>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<any>(null);
  const [allMetrics, setAllMetrics] = useState<OperationMetrics[]>([]);
  const [costTrends, setCostTrends] = useState<CostTrend[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);

  // Load data on mount or period change
  useEffect(() => {
    if (!user?.id) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - selectedPeriod);

        const [periodSummary, metrics, trends, recs] = await Promise.all([
          analyticsService.getPeriodSummary(user.id, startDate, endDate),
          analyticsService.getAllOperationMetrics(user.id, startDate, endDate),
          analyticsService.getCostTrends(user.id, selectedPeriod),
          analyticsService.getRecommendations(user.id, 10),
        ]);

        setSummary(periodSummary);
        setAllMetrics(metrics);
        setCostTrends(trends);
        setRecommendations(recs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id, selectedPeriod]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen">
        <p className="text-gray-500">Loading analytics...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Operation Analytics</h1>
          <p className="text-gray-600 mt-2">Real-time metrics and performance insights</p>
        </div>
        <div className="flex gap-2">
          {[7, 30].map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period as 7 | 30)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedPeriod === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Last {period} days
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Total Cost"
          value={`$${summary.total_cost.toFixed(2)}`}
          color="bg-blue-50"
          iconColor="text-blue-600"
        />
        <MetricCard
          icon={Zap}
          label="Total Operations"
          value={summary.total_operations.toString()}
          color="bg-purple-50"
          iconColor="text-purple-600"
        />
        <MetricCard
          icon={CheckCircle}
          label="Success Rate"
          value={`${summary.overall_success_rate.toFixed(1)}%`}
          color="bg-green-50"
          iconColor="text-green-600"
        />
        <MetricCard
          icon={Clock}
          label="Avg Latency"
          value={`${summary.avg_latency_ms}ms`}
          color="bg-orange-50"
          iconColor="text-orange-600"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown Pie Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Cost by Operation</h2>
          <CostBreakdownChart operations={allMetrics} />
        </div>

        {/* Model Performance Bar Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Model Performance</h2>
          <ModelPerformanceChart operations={allMetrics} />
        </div>
      </div>

      {/* Cost Trends Line Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">30-Day Cost Trend</h2>
        <CostTrendsChart trends={costTrends} />
      </div>

      {/* Operations Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Operation Metrics</h2>
        <OperationsTable operations={allMetrics} />
      </div>

      {/* Recommendations Panel */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Optimization Recommendations
          </h2>
          <RecommendationsPanel recommendations={recommendations} analyticsService={analyticsService} userId={user?.id || ''} />
        </div>
      )}
    </div>
  );
}

/**
 * Metric Card Component
 */
function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  iconColor,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
  iconColor: string;
}): React.ReactElement {
  return (
    <div className={`${color} rounded-lg p-6 border border-gray-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <Icon className={`w-10 h-10 ${iconColor} opacity-60`} />
      </div>
    </div>
  );
}

/**
 * Cost Breakdown Pie Chart
 */
function CostBreakdownChart({ operations }: { operations: OperationMetrics[] }): React.ReactElement {
  const sorted = [...operations].sort((a, b) => b.total_cost_usd - a.total_cost_usd).slice(0, 8);
  const totalCost = sorted.reduce((sum, op) => sum + op.total_cost_usd, 0);

  const colors = [
    '#8B5CF6', '#3B82F6', '#F59E0B', '#10B981',
    '#EF4444', '#EC4899', '#6366F1', '#14B8A6',
  ];

  return (
    <div className="space-y-3">
      {sorted.map((op, idx) => {
        const percentage = ((op.total_cost_usd / totalCost) * 100).toFixed(1);
        return (
          <div key={op.operation_id}>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{OPERATION_NAMES[op.operation_id] || op.operation_id}</span>
              <span className="text-sm text-gray-600">${op.total_cost_usd.toFixed(2)} ({percentage}%)</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: colors[idx % colors.length],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Model Performance Bar Chart
 */
function ModelPerformanceChart({ operations }: { operations: OperationMetrics[] }): React.ReactElement {
  const modelStats = {
    anthropic: { cost: 0, count: 0, latency: [] as number[], success: [] as number[] },
    deepseek: { cost: 0, count: 0, latency: [] as number[], success: [] as number[] },
    gemini: { cost: 0, count: 0, latency: [] as number[], success: [] as number[] },
    openai: { cost: 0, count: 0, latency: [] as number[], success: [] as number[] },
  };

  for (const op of operations) {
    const totalUsed = Object.values(op.models_used).reduce((a, b) => a + b, 0);
    if (totalUsed === 0) continue;

    for (const [model, count] of Object.entries(op.models_used)) {
      const modelKey = model as keyof typeof modelStats;
      const modelCostShare = (op.total_cost_usd * count) / totalUsed;
      modelStats[modelKey].cost += modelCostShare;
      modelStats[modelKey].count += count;
      modelStats[modelKey].latency.push(op.avg_latency_ms);
      modelStats[modelKey].success.push(op.success_rate);
    }
  }

  const models = Object.entries(modelStats)
    .map(([name, stats]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      cost: stats.cost,
      avgLatency: stats.latency.length > 0 ? stats.latency.reduce((a, b) => a + b) / stats.latency.length : 0,
      avgSuccess: stats.success.length > 0 ? stats.success.reduce((a, b) => a + b) / stats.success.length : 0,
    }))
    .filter(m => m.cost > 0);

  const maxCost = Math.max(...models.map(m => m.cost));

  return (
    <div className="space-y-4">
      {models.map((model) => (
        <div key={model.name}>
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">{model.name}</span>
            <span className="text-sm text-gray-600">${model.cost.toFixed(2)}</span>
          </div>
          <div className="h-6 bg-gray-200 rounded-lg overflow-hidden flex">
            <div
              className="h-full"
              style={{
                width: `${(model.cost / maxCost) * 100}%`,
                backgroundColor: MODEL_COLORS[model.name.toLowerCase()],
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Latency: {model.avgLatency.toFixed(0)}ms</span>
            <span>Success: {model.avgSuccess.toFixed(1)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Cost Trends Line Chart
 */
function CostTrendsChart({ trends }: { trends: CostTrend[] }): React.ReactElement {
  if (trends.length === 0) {
    return <p className="text-gray-500 text-center py-8">No data available</p>;
  }

  const maxCost = Math.max(...trends.map(t => t.total_cost_usd));
  const height = 200;
  const width = Math.max(400, trends.length * 15);

  // Calculate SVG path for line chart
  const points = trends.map((trend, idx) => {
    const x = (idx / (trends.length - 1 || 1)) * (width - 40) + 20;
    const y = height - (trend.total_cost_usd / (maxCost || 1)) * (height - 40) + 20;
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(' L ')}`;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height + 40} className="mx-auto">
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map(i => (
          <line
            key={`h-${i}`}
            x1="20"
            y1={20 + (i * (height - 40)) / 4}
            x2={width - 20}
            y2={20 + (i * (height - 40)) / 4}
            stroke="#E5E7EB"
            strokeDasharray="4"
          />
        ))}

        {/* Line path */}
        <path d={pathData} stroke="#3B82F6" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />

        {/* Data points */}
        {trends.map((trend, idx) => {
          const x = (idx / (trends.length - 1 || 1)) * (width - 40) + 20;
          const y = height - (trend.total_cost_usd / (maxCost || 1)) * (height - 40) + 20;
          return (
            <g key={idx}>
              <circle cx={x} cy={y} r="3" fill="#3B82F6" />
              <title>{`${trend.date}: $${trend.total_cost_usd.toFixed(2)}`}</title>
            </g>
          );
        })}

        {/* Axes */}
        <line x1="20" y1={height + 20} x2={width - 20} y2={height + 20} stroke="#666" strokeWidth="1" />
        <line x1="20" y1="20" x2="20" y2={height + 20} stroke="#666" strokeWidth="1" />
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between px-6 text-xs text-gray-600 mt-2">
        {trends.length > 0 && (
          <>
            <span>{trends[0].date}</span>
            <span>{trends[Math.floor(trends.length / 2)]?.date}</span>
            <span>{trends[trends.length - 1].date}</span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Operations Table
 */
function OperationsTable({ operations }: { operations: OperationMetrics[] }): React.ReactElement {
  const [sortBy, setSortBy] = useState<'cost' | 'success' | 'latency'>('cost');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sorted = [...operations].sort((a, b) => {
    let aVal, bVal;
    switch (sortBy) {
      case 'cost':
        aVal = a.total_cost_usd;
        bVal = b.total_cost_usd;
        break;
      case 'success':
        aVal = a.success_rate;
        bVal = b.success_rate;
        break;
      case 'latency':
        aVal = a.avg_latency_ms;
        bVal = b.avg_latency_ms;
        break;
    }
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const handleSort = (column: 'cost' | 'success' | 'latency') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Operation</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('cost')}>
              Total Cost {sortBy === 'cost' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th className="text-right py-3 px-4 font-semibold text-gray-900">Executions</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('success')}>
              Success Rate {sortBy === 'success' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th className="text-right py-3 px-4 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('latency')}>
              Avg Latency {sortBy === 'latency' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((op) => (
            <tr key={op.operation_id} className="border-b border-gray-100 hover:bg-gray-50 transition">
              <td className="py-3 px-4 text-gray-900">{OPERATION_NAMES[op.operation_id] || op.operation_id}</td>
              <td className="py-3 px-4 text-right text-gray-900 font-medium">${op.total_cost_usd.toFixed(2)}</td>
              <td className="py-3 px-4 text-right text-gray-900">{op.total_executions}</td>
              <td className="py-3 px-4 text-right">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  op.success_rate >= 95
                    ? 'bg-green-100 text-green-800'
                    : op.success_rate >= 90
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {op.success_rate.toFixed(1)}%
                </span>
              </td>
              <td className="py-3 px-4 text-right text-gray-900">{op.avg_latency_ms.toFixed(0)}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Recommendations Panel
 */
function RecommendationsPanel({
  recommendations,
  analyticsService,
  userId,
}: {
  recommendations: OptimizationRecommendation[];
  analyticsService: any;
  userId: string;
}): React.ReactElement {
  const [recs, setRecs] = useState(recommendations);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const handleDismiss = async (recId: string) => {
    try {
      setDismissing(recId);
      await analyticsService.dismissRecommendation(userId, recId);
      setRecs(recs.filter(r => r.id !== recId));
    } catch (err) {
      console.error('Failed to dismiss recommendation:', err);
    } finally {
      setDismissing(null);
    }
  };

  return (
    <div className="space-y-3">
      {recs.map((rec) => (
        <div
          key={rec.id}
          className={`p-4 rounded-lg border-2 ${
            rec.recommendation_type === 'cost'
              ? 'border-blue-200 bg-blue-50'
              : rec.recommendation_type === 'performance'
              ? 'border-orange-200 bg-orange-50'
              : 'border-purple-200 bg-purple-50'
          }`}
        >
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{rec.title}</h3>
              <p className="text-sm text-gray-700 mt-1">{rec.description}</p>
              <div className="flex gap-4 mt-2">
                {rec.estimated_savings_usd > 0 && (
                  <span className="text-xs bg-white px-2 py-1 rounded">
                    💰 Save ${rec.estimated_savings_usd.toFixed(2)} ({rec.estimated_savings_percent.toFixed(0)}%)
                  </span>
                )}
                {rec.estimated_latency_improvement_percent > 0 && (
                  <span className="text-xs bg-white px-2 py-1 rounded">
                    ⚡ {rec.estimated_latency_improvement_percent.toFixed(0)}% faster
                  </span>
                )}
                <span className="text-xs bg-white px-2 py-1 rounded">
                  ⏱️ {rec.estimated_implementation_effort}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(rec.id)}
              disabled={dismissing === rec.id}
              className="px-3 py-1 text-sm bg-white text-gray-600 rounded hover:bg-gray-100 transition disabled:opacity-50"
            >
              {dismissing === rec.id ? 'Dismissing...' : 'Dismiss'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default OperationAnalytics;
