/**
 * useOrchestratorMetrics Hook
 *
 * Real-time metrics subscription for orchestrator jobs.
 * Auto-subscribes on mount, handles WebSocket reconnection,
 * and provides both live updates and historical data.
 *
 * Usage:
 *   const { metrics, costBurnRate, stateTransitions } = useOrchestratorMetrics(threadId);
 *   // metrics updates in real-time
 *   // costBurnRate shows $/hour and $/minute
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getGatewayClient } from '../lib/gateway-client';

export interface OrchestratorMetricsState {
  threadId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentNode: string;
  costCents: number;
  budgetRemainingCents: number;
  inputTokens: number;
  outputTokens: number;
  checkpointCount: number;
  agentActivityLog: Array<{
    agent: string;
    task: string;
    startedAt: number;
    duration?: number;
  }>;
  stateTransitions: Array<{
    from: string;
    to: string;
    timestamp: number;
  }>;
  percentBudgetUsed: number;
}

export interface CostBurnRate {
  threadId: string;
  burnRatePerHour: number;
  burnRatePerMinute: number;
  estimatedMinutesRemaining: number;
  costTrendPercentage: number;
}

export interface UseOrchestratorMetricsReturn {
  metrics: OrchestratorMetricsState | null;
  costBurnRate: CostBurnRate | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  stateTransitions: OrchestratorMetricsState['stateTransitions'];
}

export function useOrchestratorMetrics(
  threadId: string | null
): UseOrchestratorMetricsReturn {
  const [metrics, setMetrics] = useState<OrchestratorMetricsState | null>(null);
  const [costBurnRate, setCostBurnRate] = useState<CostBurnRate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<(() => void) | null>(null);
  const updateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch initial metrics snapshot
  const fetchMetrics = useCallback(async () => {
    if (!threadId) return;

    const client = getGatewayClient();
    if (!client?.connected) return;

    try {
      setIsLoading(true);
      setError(null);

      // Get initial snapshot
      const snapshot = await client.request('orchestrator.metrics.subscribe', {
        threadId,
      });

      const metricsSnapshot = snapshot as OrchestratorMetricsState;

      setMetrics({
        ...metricsSnapshot,
        percentBudgetUsed: metricsSnapshot.budgetRemainingCents
          ? Math.round(
              ((metricsSnapshot.costCents / metricsSnapshot.budgetRemainingCents) * 100)
            )
          : 0,
      });

      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  // Fetch burn rate
  const fetchBurnRate = useCallback(async () => {
    if (!threadId) return;

    const client = getGatewayClient();
    if (!client?.connected) return;

    try {
      const rate = (await client.request('orchestrator.cost.burn_rate', {
        threadId,
      })) as CostBurnRate;
      setCostBurnRate(rate);
    } catch (err) {
      console.debug('[metrics] Failed to fetch burn rate:', err);
    }
  }, [threadId]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!threadId) return;

    const client = getGatewayClient();
    if (!client?.connected) return;

    // Initial fetch
    fetchMetrics();
    fetchBurnRate();

    // Subscribe to cost.updated events (real-time)
    const handleCostUpdated = (event: { payload: any }) => {
      const { costCents, budgetRemainingCents } = event.payload;
      setMetrics((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          costCents,
          budgetRemainingCents,
          percentBudgetUsed:
            budgetRemainingCents > 0
              ? Math.round((costCents / budgetRemainingCents) * 100)
              : 0,
        };
      });
    };

    // Subscribe to state transitions
    const handleStateChanged = (event: { payload: any }) => {
      const { from, to, timestamp } = event.payload;
      setMetrics((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentNode: to,
          stateTransitions: [
            ...prev.stateTransitions,
            { from, to, timestamp },
          ].slice(-20), // Keep last 20
        };
      });
    };

    // Subscribe to agent activity
    const handleAgentActive = (event: { payload: any }) => {
      const { agent, task } = event.payload;
      setMetrics((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          agentActivityLog: [
            ...prev.agentActivityLog,
            {
              agent,
              task,
              startedAt: Date.now(),
            },
          ].slice(-10), // Keep last 10
        };
      });
    };

    // Subscribe to checkpoint saves
    const handleCheckpointSaved = () => {
      setMetrics((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          checkpointCount: prev.checkpointCount + 1,
        };
      });
    };

    client.on('orchestrator.cost.updated', handleCostUpdated);
    client.on('orchestrator.state.changed', handleStateChanged);
    client.on('orchestrator.agent.active', handleAgentActive);
    client.on('orchestrator.checkpoint.saved', handleCheckpointSaved);

    // Periodically update burn rate (every 30s)
    updateTimerRef.current = setInterval(fetchBurnRate, 30_000);

    const cleanup = () => {
      client.off('orchestrator.cost.updated', handleCostUpdated);
      client.off('orchestrator.state.changed', handleStateChanged);
      client.off('orchestrator.agent.active', handleAgentActive);
      client.off('orchestrator.checkpoint.saved', handleCheckpointSaved);

      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
      }
    };

    return cleanup;
  }, [threadId, fetchMetrics, fetchBurnRate]);

  return {
    metrics,
    costBurnRate,
    isConnected,
    isLoading,
    error,
    stateTransitions: metrics?.stateTransitions ?? [],
  };
}
