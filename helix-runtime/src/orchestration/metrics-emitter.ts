/**
 * Orchestrator Metrics Emitter
 *
 * Non-blocking event emission from StateGraph execution.
 * Fires events to Gateway for real-time WebSocket broadcast.
 *
 * Design: Fire-and-forget (Promise.resolve().then()) to avoid
 * blocking node execution. All events are optional - if emission
 * fails, execution continues without error.
 */

import { EventEmitter } from 'events';

export interface OrchestratorEvent {
  type:
    | 'node.start'
    | 'node.complete'
    | 'node.error'
    | 'checkpoint.saved'
    | 'graph.complete'
    | 'cost.updated'
    | 'agent.active';
  threadId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export class MetricsEmitter extends EventEmitter {
  private listeners = new Set<(event: OrchestratorEvent) => void>();

  /**
   * Subscribe to metrics events.
   * Multiple clients can listen simultaneously.
   */
  subscribe(callback: (event: OrchestratorEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Emit event non-blockingly.
   * Uses Promise.resolve() to defer emission to next tick.
   */
  emitMetrics(event: OrchestratorEvent): void {
    // Non-blocking: defer to next microtask
    Promise.resolve().then(() => {
      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch (err) {
          // Silently fail listener errors to not block execution
          console.debug('[metrics-emitter] Listener error:', err);
        }
      }

      // Emit to EventEmitter for other subscribers
      this.emit('metrics', event);
    });
  }

  /**
   * Emit node.start event (when node execution begins).
   */
  emitNodeStart(threadId: string, nodeId: string, input?: Record<string, unknown>): void {
    this.emitMetrics({
      type: 'node.start',
      threadId,
      timestamp: Date.now(),
      payload: {
        nodeId,
        input,
      },
    });
  }

  /**
   * Emit node.complete event (when node execution finishes).
   */
  emitNodeComplete(
    threadId: string,
    nodeId: string,
    output?: Record<string, unknown>,
    duration?: number
  ): void {
    this.emitMetrics({
      type: 'node.complete',
      threadId,
      timestamp: Date.now(),
      payload: {
        nodeId,
        output,
        duration,
      },
    });
  }

  /**
   * Emit node.error event (when node execution fails).
   */
  emitNodeError(
    threadId: string,
    nodeId: string,
    error: Error,
    duration?: number
  ): void {
    this.emitMetrics({
      type: 'node.error',
      threadId,
      timestamp: Date.now(),
      payload: {
        nodeId,
        error: {
          message: error.message,
          stack: error.stack,
        },
        duration,
      },
    });
  }

  /**
   * Emit checkpoint.saved event (after state persistence).
   */
  emitCheckpointSaved(
    threadId: string,
    checkpointIndex: number,
    checkpointId: string
  ): void {
    this.emitMetrics({
      type: 'checkpoint.saved',
      threadId,
      timestamp: Date.now(),
      payload: {
        checkpointIndex,
        checkpointId,
      },
    });
  }

  /**
   * Emit cost.updated event (on budget deduction).
   */
  emitCostUpdated(
    threadId: string,
    costCents: number,
    budgetRemainingCents: number
  ): void {
    this.emitMetrics({
      type: 'cost.updated',
      threadId,
      timestamp: Date.now(),
      payload: {
        costCents,
        budgetRemainingCents,
      },
    });
  }

  /**
   * Emit agent.active event (when agent starts work).
   */
  emitAgentActive(threadId: string, agent: string, task: string): void {
    this.emitMetrics({
      type: 'agent.active',
      threadId,
      timestamp: Date.now(),
      payload: {
        agent,
        task,
      },
    });
  }

  /**
   * Emit graph.complete event (when StateGraph finishes).
   */
  emitGraphComplete(
    threadId: string,
    status: 'success' | 'failure' | 'timeout',
    duration: number
  ): void {
    this.emitMetrics({
      type: 'graph.complete',
      threadId,
      timestamp: Date.now(),
      payload: {
        status,
        duration,
      },
    });
  }
}

// Global singleton
export const metricsEmitter = new MetricsEmitter();
