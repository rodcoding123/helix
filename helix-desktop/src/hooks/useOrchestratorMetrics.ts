/**
 * useOrchestratorMetrics Hook
 *
 * Real-time orchestration metrics with debounced cost updates and live state transitions.
 * Subscribes to gateway WebSocket events and maintains aggregated metrics state.
 *
 * Usage:
 * ```typescript
 * const metrics = useOrchestratorMetrics({ threadId: 'my-thread' });
 *
 * // Components can now access:
 * metrics.currentMetrics.currentNode       // Active node in StateGraph
 * metrics.burnRate.burnRatePerHour        // $/hour burn rate
 * metrics.recentStateChanges              // Timeline of state transitions
 * metrics.connectionStatus                // 'connected' | 'connecting' | 'disconnected'
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getGatewayClient } from '../lib/gateway-client';
import type {
  OrchestratorMetricsState,
  OrchestratorMetricsSnapshot,
  OrchestratorCostBurnRate,
  OrchestratorEvent,
  OrchestratorStateChangeEvent,
  OrchestratorCostUpdateEvent,
  OrchestratorCheckpointSnapshot,
  UseOrchestratorMetricsOptions,
} from '../lib/types/orchestrator-metrics';

const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_MAX_STATE_CHANGES = 50;
const DEFAULT_MAX_COST_UPDATES = 20;
const DEFAULT_MAX_CHECKPOINTS = 30;

export function useOrchestratorMetrics(
  options: UseOrchestratorMetricsOptions = {}
): OrchestratorMetricsState {
  const {
    threadId: optionalThreadId,
    autoSubscribe = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    maxStateChanges = DEFAULT_MAX_STATE_CHANGES,
    maxCostUpdates = DEFAULT_MAX_COST_UPDATES,
    maxCheckpoints = DEFAULT_MAX_CHECKPOINTS,
  } = options;

  // State management
  const [state, setState] = useState<OrchestratorMetricsState>({
    recentStateChanges: [],
    recentCostUpdates: [],
    recentCheckpoints: [],
    activeAgents: new Map(),
    connectionStatus: autoSubscribe ? 'connecting' : 'disconnected',
    lastUpdated: Date.now(),
  });

  // Refs for debouncing and subscription management
  const threadIdRef = useRef(optionalThreadId);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<string | null>(null);
  const pendingCostUpdateRef = useRef<OrchestratorCostUpdateEvent | null>(null);

  /**
   * Initialize subscription to orchestrator metrics
   */
  const subscribe = useCallback(async () => {
    const client = getGatewayClient();
    if (!client?.connected) {
      setState(prev => ({
        ...prev,
        connectionStatus: 'error',
        error: 'Gateway not connected',
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, connectionStatus: 'connecting' }));

      // Subscribe to metrics via gateway method
      const result = await client.request('orchestrator.metrics.subscribe', {
        threadId: threadIdRef.current,
      } as any);

      if (result && typeof result === 'object' && 'subscribed' in result) {
        const subscribeResult = result as any;
        const snapshot = subscribeResult.currentMetrics;

        setState(prev => ({
          ...prev,
          threadId: snapshot.threadId,
          currentMetrics: snapshot,
          connectionStatus: 'connected',
          error: undefined,
          lastUpdated: Date.now(),
        }));

        // Request initial burn rate
        fetchBurnRate(snapshot.threadId);

        // Request checkpoint history
        fetchCheckpointHistory(snapshot.threadId);

        // Listen for real-time events
        subscriptionRef.current = setupEventListeners();
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        connectionStatus: 'error',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  /**
   * Fetch burn rate from gateway
   */
  const fetchBurnRate = useCallback(async (tid: string) => {
    const client = getGatewayClient();
    if (!client?.connected || !tid) return;

    try {
      const result = await client.request('orchestrator.cost.burn_rate', {
        threadId: tid,
      } as any);

      if (result && typeof result === 'object') {
        const burnRate = result as OrchestratorCostBurnRate;
        setState(prev => ({
          ...prev,
          burnRate,
          lastUpdated: Date.now(),
        }));
      }
    } catch (err) {
      console.debug('[metrics] Failed to fetch burn rate:', err);
    }
  }, []);

  /**
   * Fetch checkpoint history from gateway
   */
  const fetchCheckpointHistory = useCallback(async (tid: string) => {
    const client = getGatewayClient();
    if (!client?.connected || !tid) return;

    try {
      const result = await client.request('orchestrator.metrics.history', {
        threadId: tid,
        minutes: 60,
        limit: maxCheckpoints,
        offset: 0,
      } as any);

      if (result && typeof result === 'object' && 'metrics' in result) {
        const historyResult = result as any;
        setState(prev => ({
          ...prev,
          recentCheckpoints: historyResult.metrics || [],
          lastUpdated: Date.now(),
        }));
      }
    } catch (err) {
      console.debug('[metrics] Failed to fetch checkpoint history:', err);
    }
  }, [maxCheckpoints]);

  /**
   * Process incoming WebSocket event
   */
  const handleEvent = useCallback((event: OrchestratorEvent) => {
    setState(prev => {
      let updatedState = { ...prev };

      switch (event.type) {
        case 'state.changed': {
          // Real-time state change - no debounce
          const stateChangeEvent = event as OrchestratorStateChangeEvent;
          updatedState.recentStateChanges = [
            stateChangeEvent,
            ...prev.recentStateChanges,
          ].slice(0, maxStateChanges);

          // Update current metrics
          if (updatedState.currentMetrics && stateChangeEvent.threadId === prev.threadId) {
            updatedState.currentMetrics = {
              ...updatedState.currentMetrics,
              currentNode: stateChangeEvent.to,
              stepCount: stateChangeEvent.stepCount,
            };
          }

          // Fetch updated burn rate
          setTimeout(() => {
            if (prev.threadId) fetchBurnRate(prev.threadId);
          }, 100);
          break;
        }

        case 'cost.updated': {
          // Debounced cost update
          const costEvent = event as OrchestratorCostUpdateEvent;
          pendingCostUpdateRef.current = costEvent;

          // Clear existing debounce timer
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          // Set new debounce timer
          debounceTimerRef.current = setTimeout(() => {
            if (pendingCostUpdateRef.current) {
              setState(prevState => ({
                ...prevState,
                recentCostUpdates: [
                  pendingCostUpdateRef.current!,
                  ...prevState.recentCostUpdates,
                ].slice(0, maxCostUpdates),
                lastUpdated: Date.now(),
              }));
              pendingCostUpdateRef.current = null;
            }
          }, debounceMs);

          break;
        }

        case 'checkpoint.saved': {
          // Add checkpoint to recent list via periodic polling
          // This event just signals that a checkpoint was saved
          break;
        }

        case 'agent.active': {
          // Track active agents
          const agentEvent = event as any;
          const newActiveAgents = new Map(prev.activeAgents);
          newActiveAgents.set(agentEvent.agent, {
            agent: agentEvent.agent,
            task: agentEvent.task,
            timestamp: agentEvent.timestamp,
          });

          // Auto-expire agents after 30 seconds of inactivity
          const now = Date.now();
          for (const [agent, data] of newActiveAgents.entries()) {
            if (now - data.timestamp > 30000) {
              newActiveAgents.delete(agent);
            }
          }

          updatedState.activeAgents = newActiveAgents;
          break;
        }
      }

      return {
        ...updatedState,
        lastUpdated: Date.now(),
      };
    });
  }, [maxStateChanges, maxCostUpdates, debounceMs, fetchBurnRate]);

  /**
   * Setup WebSocket event listeners
   */
  const setupEventListeners = useCallback((): string => {
    const client = getGatewayClient();
    if (!client) return '';

    // Set up listeners for each event type
    const handlers = {
      'orchestrator.state.changed': handleEvent,
      'orchestrator.cost.updated': handleEvent,
      'orchestrator.agent.active': handleEvent,
      'orchestrator.checkpoint.saved': handleEvent,
    };

    for (const [event, handler] of Object.entries(handlers)) {
      client.on(event, handler as any);
    }

    // Return unsubscribe function ID for cleanup
    return 'orchestrator-metrics-listeners';
  }, [handleEvent]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Remove event listeners
      const client = getGatewayClient();
      if (client && subscriptionRef.current) {
        client.off('orchestrator.state.changed', handleEvent as any);
        client.off('orchestrator.cost.updated', handleEvent as any);
        client.off('orchestrator.agent.active', handleEvent as any);
        client.off('orchestrator.checkpoint.saved', handleEvent as any);
      }
    };
  }, [handleEvent]);

  /**
   * Auto-subscribe on mount and when threadId changes
   */
  useEffect(() => {
    threadIdRef.current = optionalThreadId;

    if (!autoSubscribe) return;

    const client = getGatewayClient();
    if (!client?.connected) {
      setState(prev => ({
        ...prev,
        connectionStatus: 'error',
        error: 'Gateway not connected',
      }));
      return;
    }

    subscribe();

    // Periodically refresh burn rate and checkpoint history
    const refreshInterval = setInterval(() => {
      if (state.threadId) {
        fetchBurnRate(state.threadId);
        fetchCheckpointHistory(state.threadId);
      }
    }, 5000); // Every 5 seconds

    return () => clearInterval(refreshInterval);
  }, [autoSubscribe, subscribe, fetchBurnRate, fetchCheckpointHistory, state.threadId]);

  return state;
}

/**
 * Hook to manually control orchestrator subscription
 */
export function useOrchestratorMetricsController(
  state: OrchestratorMetricsState
) {
  const client = getGatewayClient();

  return useMemo(
    () => ({
      /**
       * Manually fetch latest burn rate
       */
      refreshBurnRate: async () => {
        if (!state.threadId || !client?.connected) return;
        try {
          const result = await client.request('orchestrator.cost.burn_rate', {
            threadId: state.threadId,
          } as any);
          return result as OrchestratorCostBurnRate;
        } catch (err) {
          console.debug('[metrics-controller] Failed to refresh burn rate:', err);
        }
      },

      /**
       * Manually fetch checkpoint history with custom params
       */
      fetchCheckpointHistory: async (minutes: number, limit: number) => {
        if (!state.threadId || !client?.connected) return;
        try {
          const result = await client.request('orchestrator.metrics.history', {
            threadId: state.threadId,
            minutes,
            limit,
            offset: 0,
          } as any);
          return (result as any)?.metrics as OrchestratorCheckpointSnapshot[];
        } catch (err) {
          console.debug('[metrics-controller] Failed to fetch history:', err);
        }
      },

      /**
       * Re-subscribe to a different thread
       */
      switchThread: async (newThreadId: string) => {
        if (!client?.connected) return;
        try {
          const result = await client.request('orchestrator.metrics.subscribe', {
            threadId: newThreadId,
          } as any);
          return (result as any)?.currentMetrics as OrchestratorMetricsSnapshot;
        } catch (err) {
          console.debug('[metrics-controller] Failed to switch thread:', err);
        }
      },
    }),
    [state.threadId, client]
  );
}
