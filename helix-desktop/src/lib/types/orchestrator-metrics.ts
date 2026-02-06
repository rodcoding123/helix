/**
 * Orchestrator Metrics Types
 *
 * Real-time metrics for orchestration execution monitoring.
 * Defines the shape of data flowing from gateway to UI components.
 */

export interface OrchestratorMetricsSnapshot {
  threadId: string;
  currentNode: string;
  stepCount: number;
  totalCheckpoints: number;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedBudgetRemaining: number;
  avgStepDurationMs: number;
  executionStartedAt: number;
}

export interface OrchestratorCheckpointSnapshot {
  checkpointId: string;
  threadId: string;
  stepCount: number;
  currentNode: string;
  timestamp: number;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
}

export interface OrchestratorCostBurnRate {
  threadId: string;
  burnRatePerHour: number;
  burnRatePerMinute: number;
  burnRatePerSecond: number;
  recentCostCents: number;
  recentDurationMs: number;
  samplesUsed: number;
  estimatedRemainingMinutes?: number;
  lastUpdated: number;
}

/**
 * Real-time events emitted from StateGraph via gateway broadcast
 */
export type OrchestratorEventType =
  | 'state.changed'
  | 'cost.updated'
  | 'agent.active'
  | 'checkpoint.saved';

export interface OrchestratorStateChangeEvent {
  type: 'state.changed';
  threadId: string;
  from: string;
  to: string;
  stepCount: number;
  executionTimeMs: number;
  timestamp: number;
}

export interface OrchestratorCostUpdateEvent {
  type: 'cost.updated';
  threadId: string;
  costDeltaCents: number;
  totalCostCents: number;
  budgetRemainingCents: number;
  inputTokensDelta: number;
  outputTokensDelta: number;
  timestamp: number;
}

export interface OrchestratorAgentActiveEvent {
  type: 'agent.active';
  threadId: string;
  agent: string;
  task: string;
  timestamp: number;
}

export interface OrchestratorCheckpointSavedEvent {
  type: 'checkpoint.saved';
  threadId: string;
  checkpointId: string;
  stepCount: number;
  timestamp: number;
}

export type OrchestratorEvent =
  | OrchestratorStateChangeEvent
  | OrchestratorCostUpdateEvent
  | OrchestratorAgentActiveEvent
  | OrchestratorCheckpointSavedEvent;

/**
 * Aggregated metrics state for UI components
 */
export interface OrchestratorMetricsState {
  threadId?: string;
  currentMetrics?: OrchestratorMetricsSnapshot;
  burnRate?: OrchestratorCostBurnRate;
  recentStateChanges: OrchestratorStateChangeEvent[];
  recentCostUpdates: OrchestratorCostUpdateEvent[];
  recentCheckpoints: OrchestratorCheckpointSnapshot[];
  activeAgents: Map<string, { agent: string; task: string; timestamp: number }>;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
  lastUpdated: number;
}

/**
 * Hook options for customization
 */
export interface UseOrchestratorMetricsOptions {
  threadId?: string;
  autoSubscribe?: boolean;
  debounceMs?: number;
  maxStateChanges?: number;
  maxCostUpdates?: number;
  maxCheckpoints?: number;
}
