/**
 * Phase 2.3: Continuous Monitoring Dashboard
 *
 * Gateway methods for real-time orchestrator metrics streaming.
 * Provides job status, cost tracking, agent activity, and checkpoint monitoring.
 *
 * Integration Points:
 * - StateGraph: Event emission on node transitions
 * - WebSocket: Real-time event broadcast to subscribed clients
 * - AIOperationRouter: Cost tracking and budget enforcement
 * - Supabase: Optional history persistence
 */

import type { GatewayRequestHandler, GatewayRequestContext } from './types';

export interface OrchestratorMetricsSnapshot {
  threadId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentNode: string;
  timestamp: number;
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
}

export interface CostBurnRate {
  threadId: string;
  burnRatePerHour: number;
  burnRatePerMinute: number;
  estimatedMinutesRemaining: number;
  costTrendPercentage: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  costCents: number;
  budgetRemainingCents: number;
  percentBudgetUsed: number;
}

/**
 * orchestrator.metrics.subscribe
 *
 * Subscribe to real-time metrics for a specific thread.
 * Returns current snapshot and registers client for streaming events.
 */
export const orchestratorMetricsSubscribe: GatewayRequestHandler<
  { threadId: string },
  OrchestratorMetricsSnapshot
> = async (params, ctx: GatewayRequestContext) => {
  const { threadId } = params;

  if (!ctx.auth?.userId) {
    throw new Error('Authentication required');
  }

  // Get current snapshot from state store
  // TODO: Implement state store lookup
  const snapshot: OrchestratorMetricsSnapshot = {
    threadId,
    status: 'idle',
    currentNode: 'START',
    timestamp: Date.now(),
    costCents: 0,
    budgetRemainingCents: 50_000, // $500 default budget
    inputTokens: 0,
    outputTokens: 0,
    checkpointCount: 0,
    agentActivityLog: [],
    stateTransitions: [],
  };

  return snapshot;
};

/**
 * orchestrator.metrics.history
 *
 * Query historical metrics for a thread over a time period.
 * Returns paginated snapshots with cost and token data.
 */
export const orchestratorMetricsHistory: GatewayRequestHandler<
  {
    threadId: string;
    minutes?: number;
    limit?: number;
    offset?: number;
  },
  {
    metrics: MetricsSnapshot[];
    total: number;
    threadId: string;
    period: { start: number; end: number };
  }
> = async (params, ctx: GatewayRequestContext) => {
  const { threadId, minutes = 60, limit = 50, offset = 0 } = params;

  if (!ctx.auth?.userId) {
    throw new Error('Authentication required');
  }

  const now = Date.now();
  const startTime = now - minutes * 60 * 1000;

  // TODO: Query from checkpoint history
  const metrics: MetricsSnapshot[] = [];

  return {
    metrics,
    total: metrics.length,
    threadId,
    period: { start: startTime, end: now },
  };
};

/**
 * orchestrator.cost.burn_rate
 *
 * Calculate real-time cost burn rate in USD/hour and USD/minute.
 * Uses weighted moving average of last 5 checkpoints.
 *
 * Returns estimate of remaining budget and time until exhaustion.
 */
export const orchestratorCostBurnRate: GatewayRequestHandler<
  { threadId: string },
  CostBurnRate
> = async (params, ctx: GatewayRequestContext) => {
  const { threadId } = params;

  if (!ctx.auth?.userId) {
    throw new Error('Authentication required');
  }

  // TODO: Query recent checkpoints, calculate burn rate
  const burnRatePerHour = 0;
  const burnRatePerMinute = 0;
  const budgetRemainingCents = 50_000;

  const estimatedMinutesRemaining =
    burnRatePerMinute > 0 ? Math.floor(budgetRemainingCents / burnRatePerMinute) : -1;

  return {
    threadId,
    burnRatePerHour,
    burnRatePerMinute,
    estimatedMinutesRemaining,
    costTrendPercentage: 0,
  };
};

/**
 * orchestrator.checkpoint.list
 *
 * Get recent checkpoints for a thread with state snapshots.
 * Useful for visualizing execution timeline.
 */
export const orchestratorCheckpointList: GatewayRequestHandler<
  {
    threadId: string;
    limit?: number;
  },
  {
    checkpoints: Array<{
      id: string;
      timestamp: number;
      nodeId: string;
      checkpointIndex: number;
      costCents: number;
      inputTokens: number;
      outputTokens: number;
    }>;
  }
> = async (params, ctx: GatewayRequestContext) => {
  const { threadId, limit = 20 } = params;

  if (!ctx.auth?.userId) {
    throw new Error('Authentication required');
  }

  // TODO: Query checkpoint list from state store
  const checkpoints = [];

  return { checkpoints };
};

export const orchestratorMetricsMethods = {
  'orchestrator.metrics.subscribe': orchestratorMetricsSubscribe,
  'orchestrator.metrics.history': orchestratorMetricsHistory,
  'orchestrator.cost.burn_rate': orchestratorCostBurnRate,
  'orchestrator.checkpoint.list': orchestratorCheckpointList,
};
