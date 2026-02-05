import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  getDailyCostMetrics,
  getCostByUser,
  getRecentOperations,
  subscribeToOperationUpdates,
} from '../../lib/supabase-queries';
import { DailyCostMetrics, CostByUser, OperationMetric } from '../../types/control-plane';
import { useAuth } from '../../hooks/useAuth';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function CostDashboard() {
  const { user } = useAuth();
  const [dailyMetrics, setDailyMetrics] = useState<DailyCostMetrics[]>([]);
  const [userCost, setUserCost] = useState<CostByUser | null>(null);
  const [recentOps, setRecentOps] = useState<OperationMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [metrics, userSpending, ops] = await Promise.all([
        getDailyCostMetrics(),
        user?.id ? getCostByUser(user.id) : Promise.resolve(null),
        getRecentOperations(),
      ]);
      setDailyMetrics(metrics);
      setUserCost(userSpending);
      setRecentOps(ops);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
    const channel = subscribeToOperationUpdates((newOp) => {
      setRecentOps((prev) => [newOp, ...prev.slice(0, 49)]);
    });
    return () => {
      channel.unsubscribe();
    };
  }, [loadData]);

  if (loading) return <div className="text-center py-8">Loading cost data...</div>;
  if (error) return <div className="text-red-400 py-8">Error: {error}</div>;

  const totalCost = dailyMetrics.reduce((sum, m) => sum + m.total_cost, 0);
  const avgDaily = dailyMetrics.length > 0 ? totalCost / dailyMetrics.length : 0;
  const costData = dailyMetrics.map((m) => ({
    date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cost: m.total_cost,
    operations: m.operation_count,
  }));

  // Get top operations and models from latest day
  const latestDay = dailyMetrics[0];
  const topOpsData = latestDay?.top_operations || [];
  const topModelsData = latestDay?.top_models || [];

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-700 rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Today's Cost</div>
          <div className="text-3xl font-bold text-blue-400">
            ${(userCost?.today || 0).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Limit: ${userCost?.daily_limit?.toFixed(2) || '50.00'}
          </div>
        </div>

        <div className="bg-gray-700 rounded p-4">
          <div className="text-gray-400 text-sm mb-1">7-Day Average</div>
          <div className="text-3xl font-bold text-green-400">
            ${avgDaily.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Total: ${totalCost.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-700 rounded p-4">
          <div className="text-gray-400 text-sm mb-1">This Month</div>
          <div className="text-3xl font-bold text-purple-400">
            ${(userCost?.this_month || 0).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Monthly tracking
          </div>
        </div>
      </div>

      {/* Budget Progress */}
      {userCost && (
        <div className="bg-gray-700 rounded p-4">
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span>Daily Budget</span>
              <span>${userCost.today.toFixed(2)} / ${userCost.daily_limit.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition ${
                  userCost.today > userCost.daily_limit
                    ? 'bg-red-500'
                    : userCost.today > userCost.warning_threshold
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((userCost.today / userCost.daily_limit) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Cost Trend Chart */}
      <div className="bg-gray-700 rounded p-4">
        <h3 className="text-lg font-semibold mb-4">7-Day Cost Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={costData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
            <XAxis dataKey="date" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
              formatter={(value) => `$${Number(value).toFixed(2)}`}
            />
            <Legend />
            <Line type="monotone" dataKey="cost" stroke="#3B82F6" name="Daily Cost" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Operations and Models */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Operations */}
        <div className="bg-gray-700 rounded p-4">
          <h3 className="text-lg font-semibold mb-4">Top Operations (Today)</h3>
          {topOpsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topOpsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                <XAxis dataKey="operation_type" stroke="#9CA3AF" angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                  formatter={(value) => `$${Number(value).toFixed(2)}`}
                />
                <Bar dataKey="cost" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-gray-400 py-8 text-center">No operations today</div>
          )}
        </div>

        {/* Top Models */}
        <div className="bg-gray-700 rounded p-4">
          <h3 className="text-lg font-semibold mb-4">Top Models (Today)</h3>
          {topModelsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={topModelsData}
                  dataKey="cost"
                  nameKey="model"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label
                >
                  {topModelsData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-gray-400 py-8 text-center">No models used today</div>
          )}
        </div>
      </div>

      {/* Recent Operations */}
      <div className="bg-gray-700 rounded p-4">
        <h3 className="text-lg font-semibold mb-4">Recent Operations</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left py-2 px-4">Operation</th>
                <th className="text-left py-2 px-4">Model</th>
                <th className="text-right py-2 px-4">Cost</th>
                <th className="text-center py-2 px-4">Status</th>
                <th className="text-right py-2 px-4">Quality</th>
                <th className="text-left py-2 px-4">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentOps.map((op, idx) => (
                <tr key={op.id || idx} className="border-b border-gray-600 hover:bg-gray-600 transition">
                  <td className="py-2 px-4">{op.operation_type}</td>
                  <td className="py-2 px-4">{op.model_used}</td>
                  <td className="text-right py-2 px-4">${op.cost_usd.toFixed(4)}</td>
                  <td className="text-center py-2 px-4">
                    {op.success ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-red-400">✗</span>
                    )}
                  </td>
                  <td className="text-right py-2 px-4">
                    <span
                      className={
                        op.quality_score >= 0.9
                          ? 'text-green-400'
                          : op.quality_score >= 0.7
                            ? 'text-yellow-400'
                            : 'text-red-400'
                      }
                    >
                      {op.quality_score.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-gray-400">
                    {new Date(op.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
