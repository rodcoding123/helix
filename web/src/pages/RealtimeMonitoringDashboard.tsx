/**
 * Phase 10 Week 3: Real-Time Monitoring Dashboard
 * Live dashboard showing operation metrics with WebSocket streaming
 */

import { useState, useEffect } from 'react';
import { getMetricsStreamService, MetricsEvent, DashboardMetrics } from '@/services/monitoring/metrics-stream';
import { getAnalyticsService } from '@/services/analytics/analytics.service';
import { useAuth } from '@/hooks/useAuth';

interface RecentEvent {
  id: string;
  event: MetricsEvent;
  displayText: string;
}

interface OperationStat {
  operationId: string;
  executions: number;
  successes: number;
  failures: number;
  totalCost: number;
  avgLatency: number;
}

export function RealtimeMonitoringDashboard() {
  const { user } = useAuth();
  const metricsStream = getMetricsStreamService();
  const analyticsService = getAnalyticsService();

  // Dashboard metrics
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    operationCount: 0,
    errorRate: 0,
    avgLatency: 0,
    totalCost: 0,
  });

  // Recent events
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);

  // Operation statistics
  const [operationStats, setOperationStats] = useState<Map<string, OperationStat>>(new Map());

  // Time windows
  const [timeWindow, setTimeWindow] = useState<'1h' | '24h' | '7d'>('1h');

  // Loading and error states
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize metrics stream connection
   */
  useEffect(() => {
    if (!user?.id) return;

    const initializeStream = async () => {
      try {
        setConnecting(true);
        setError(null);

        // Connect to metrics stream
        await metricsStream.connect(user.id);

        // Subscribe to operation_complete events
        const unsubComplete = metricsStream.subscribe('operation_complete', (event) => {
          handleOperationComplete(event);
        });

        // Subscribe to operation_failed events
        const unsubFailed = metricsStream.subscribe('operation_failed', (event) => {
          handleOperationFailed(event);
        });

        // Subscribe to cost_update events
        const unsubCost = metricsStream.subscribe('cost_update', (event) => {
          handleCostUpdate(event);
        });

        // Subscribe to batch_progress events
        const unsubProgress = metricsStream.subscribe('batch_progress', (event) => {
          handleBatchProgress(event);
        });

        setConnecting(false);

        // Cleanup on unmount
        return () => {
          unsubComplete();
          unsubFailed();
          unsubCost();
          unsubProgress();
          metricsStream.disconnect();
        };
      } catch (err) {
        console.error('[RealtimeMonitoringDashboard] Failed to initialize metrics stream:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect to metrics stream');
        setConnecting(false);
      }
    };

    const cleanup = initializeStream();
    return () => {
      if (cleanup) cleanup.then(fn => fn?.());
    };
  }, [user?.id, metricsStream]);

  /**
   * Handle operation_complete event
   */
  const handleOperationComplete = (event: MetricsEvent) => {
    const { operationId, cost = 0, latency = 0 } = event.data;

    if (!operationId) return;

    // Update metrics
    setMetrics((prev) => {
      const newCount = prev.operationCount + 1;
      const newTotalCost = prev.totalCost + cost;
      const newAvgLatency =
        (prev.avgLatency * prev.operationCount + latency) / newCount;

      return {
        ...prev,
        operationCount: newCount,
        totalCost: newTotalCost,
        avgLatency: newAvgLatency,
      };
    });

    // Update operation stats
    updateOperationStat(operationId, {
      executions: 1,
      successes: 1,
      failures: 0,
      totalCost: cost,
      avgLatency: latency,
    });

    // Add to recent events
    addRecentEvent({
      type: 'operation_complete',
      timestamp: event.timestamp,
      data: event.data,
    });
  };

  /**
   * Handle operation_failed event
   */
  const handleOperationFailed = (event: MetricsEvent) => {
    const { operationId, cost = 0, latency = 0 } = event.data;

    if (!operationId) return;

    // Update metrics
    setMetrics((prev) => {
      const newCount = prev.operationCount + 1;
      const newTotalCost = prev.totalCost + cost;
      const newAvgLatency =
        (prev.avgLatency * prev.operationCount + latency) / newCount;
      const newErrorRate =
        ((prev.operationCount * prev.errorRate + 1) / newCount) * 100;

      return {
        ...prev,
        operationCount: newCount,
        totalCost: newTotalCost,
        avgLatency: newAvgLatency,
        errorRate: newErrorRate,
      };
    });

    // Update operation stats
    updateOperationStat(operationId, {
      executions: 1,
      successes: 0,
      failures: 1,
      totalCost: cost,
      avgLatency: latency,
    });

    // Add to recent events
    addRecentEvent({
      type: 'operation_failed',
      timestamp: event.timestamp,
      data: event.data,
    });
  };

  /**
   * Handle cost_update event
   */
  const handleCostUpdate = (event: MetricsEvent) => {
    const { cost = 0 } = event.data;

    setMetrics((prev) => ({
      ...prev,
      totalCost: prev.totalCost + cost,
    }));

    addRecentEvent({
      type: 'cost_update',
      timestamp: event.timestamp,
      data: event.data,
    });
  };

  /**
   * Handle batch_progress event
   */
  const handleBatchProgress = (event: MetricsEvent) => {
    const { batchId, progress = 0 } = event.data;

    if (!batchId) return;

    addRecentEvent({
      type: 'batch_progress',
      timestamp: event.timestamp,
      data: event.data,
    });
  };

  /**
   * Update operation statistics
   */
  const updateOperationStat = (operationId: string, updates: Partial<OperationStat>) => {
    setOperationStats((prev) => {
      const existing = prev.get(operationId) || {
        operationId,
        executions: 0,
        successes: 0,
        failures: 0,
        totalCost: 0,
        avgLatency: 0,
      };

      const updated = {
        ...existing,
        executions: existing.executions + (updates.executions || 0),
        successes: existing.successes + (updates.successes || 0),
        failures: existing.failures + (updates.failures || 0),
        totalCost: existing.totalCost + (updates.totalCost || 0),
        avgLatency: (existing.avgLatency * existing.executions + (updates.avgLatency || 0)) /
          (existing.executions + (updates.executions || 0)),
      };

      const newMap = new Map(prev);
      newMap.set(operationId, updated);
      return newMap;
    });
  };

  /**
   * Add event to recent events list
   */
  const addRecentEvent = (event: MetricsEvent) => {
    const displayText = getEventDisplayText(event);
    const id = `${event.type}-${Date.now()}-${Math.random()}`;

    setRecentEvents((prev) => [
      { id, event, displayText },
      ...prev.slice(0, 49), // Keep last 50 events
    ]);
  };

  /**
   * Get human-readable event display text
   */
  const getEventDisplayText = (event: MetricsEvent): string => {
    switch (event.type) {
      case 'operation_complete':
        return `✓ ${event.data.operationId} completed in ${event.data.latency}ms ($${event.data.cost?.toFixed(2)})`;
      case 'operation_failed':
        return `✗ ${event.data.operationId} failed after ${event.data.latency}ms`;
      case 'cost_update':
        return `💰 Cost update: +$${event.data.cost?.toFixed(2)}`;
      case 'batch_progress':
        return `📦 Batch ${event.data.batchId} progress: ${event.data.progress}%`;
      case 'sla_update':
        return event.data.slaViolation ? `⚠️ SLA violation detected` : `✓ SLA compliant`;
      default:
        return 'Unknown event';
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-gray-600">Please log in to view monitoring dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Real-Time Monitoring</h1>
          <p className="text-gray-600 mt-1">
            Live operation metrics and performance tracking
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeWindow('1h')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeWindow === '1h'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            1H
          </button>
          <button
            onClick={() => setTimeWindow('24h')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeWindow === '24h'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            24H
          </button>
          <button
            onClick={() => setTimeWindow('7d')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeWindow === '7d'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            7D
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            metricsStream.isConnected() ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-sm font-medium">
          {metricsStream.isConnected()
            ? 'Connected to metrics stream'
            : 'Disconnected from metrics stream'}
        </span>
        {connecting && <span className="text-xs text-gray-500">(connecting...)</span>}
        {error && <span className="text-xs text-red-500">Error: {error}</span>}
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Operations (last hour)"
          value={metrics.operationCount.toString()}
          icon="⚙️"
          trend={metrics.operationCount > 0 ? '+' : ''}
        />
        <MetricCard
          title="Error Rate"
          value={`${metrics.errorRate.toFixed(2)}%`}
          icon="❌"
          trend={metrics.errorRate > 5 ? '↑' : '↓'}
        />
        <MetricCard
          title="Avg Latency"
          value={`${metrics.avgLatency.toFixed(0)}ms`}
          icon="⏱️"
          trend={metrics.avgLatency > 1000 ? '↑' : '↓'}
        />
        <MetricCard
          title="Total Cost (today)"
          value={`$${metrics.totalCost.toFixed(2)}`}
          icon="💰"
          trend={metrics.totalCost > 50 ? '↑' : '↓'}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Live Event Stream */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Live Event Stream</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Waiting for events...</p>
                  <p className="text-sm mt-2">Operations will appear here in real-time</p>
                </div>
              ) : (
                recentEvents.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-mono text-sm">{item.displayText}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(item.event.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Operation Statistics */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Operations</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {operationStats.size === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No operations yet</p>
              </div>
            ) : (
              Array.from(operationStats.values()).map((stat) => (
                <div key={stat.operationId} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-semibold text-sm">{stat.operationId}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-gray-600">Executions:</span>
                      <span className="font-bold ml-1">{stat.executions}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Success:</span>
                      <span className="font-bold ml-1 text-green-600">{stat.successes}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Failures:</span>
                      <span className="font-bold ml-1 text-red-600">{stat.failures}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Cost:</span>
                      <span className="font-bold ml-1">${stat.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-blue-500 h-1 rounded-full"
                      style={{
                        width: `${(stat.successes / stat.executions) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Metric Card Component
 */
interface MetricCardProps {
  title: string;
  value: string;
  icon: string;
  trend?: string;
}

function MetricCard({ title, value, icon, trend }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {trend && (
            <p className="text-xs text-gray-500 mt-1">
              {trend === '↑' ? '↑ Increasing' : '↓ Decreasing'}
            </p>
          )}
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}

export default RealtimeMonitoringDashboard;
