/**
 * Orchestrator Gateway Method Schemas
 *
 * TypeBox schemas for orchestrator monitoring and metrics.
 * Includes real-time subscription, history querying, and cost tracking.
 */

import { Type } from '@sinclair/typebox';

// ============================================================================
// Primitives
// ============================================================================

export const ThreadIdString = Type.String({ minLength: 1, maxLength: 256 });
export const CheckpointIdString = Type.String({ minLength: 1, maxLength: 256 });
export const NodeIdString = Type.String({ minLength: 1, maxLength: 256 });

// ============================================================================
// orchestrator.metrics.subscribe
// ============================================================================

export const OrchestratorMetricsSubscribeParamsSchema = Type.Object(
  {
    threadId: Type.Optional(ThreadIdString),
  },
  { additionalProperties: false }
);

export const OrchestratorMetricsSnapshot = Type.Object(
  {
    threadId: Type.String(),
    currentNode: Type.String(),
    stepCount: Type.Integer({ minimum: 0 }),
    totalCheckpoints: Type.Integer({ minimum: 0 }),
    totalCostCents: Type.Integer({ minimum: 0 }),
    totalInputTokens: Type.Integer({ minimum: 0 }),
    totalOutputTokens: Type.Integer({ minimum: 0 }),
    estimatedBudgetRemaining: Type.Integer({ minimum: 0 }),
    avgStepDurationMs: Type.Number({ minimum: 0 }),
    executionStartedAt: Type.Integer(),
  },
  { additionalProperties: false }
);

export const OrchestratorMetricsSubscribeResultSchema = Type.Object(
  {
    subscribed: Type.Literal(true),
    currentMetrics: OrchestratorMetricsSnapshot,
  },
  { additionalProperties: false }
);

// ============================================================================
// orchestrator.metrics.history
// ============================================================================

export const OrchestratorMetricsHistoryParamsSchema = Type.Object(
  {
    threadId: ThreadIdString,
    minutes: Type.Optional(Type.Integer({ minimum: 1, maximum: 1440 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false }
);

export const OrchestratorCheckpointSnapshot = Type.Object(
  {
    checkpointId: CheckpointIdString,
    threadId: Type.String(),
    stepCount: Type.Integer({ minimum: 0 }),
    currentNode: Type.String(),
    timestamp: Type.Integer(),
    costCents: Type.Integer({ minimum: 0 }),
    inputTokens: Type.Integer({ minimum: 0 }),
    outputTokens: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false }
);

export const OrchestratorMetricsHistoryResultSchema = Type.Object(
  {
    threadId: Type.String(),
    metrics: Type.Array(OrchestratorCheckpointSnapshot),
    total: Type.Integer({ minimum: 0 }),
    limit: Type.Integer({ minimum: 1 }),
    offset: Type.Integer({ minimum: 0 }),
    oldestCheckpointAgeMinutes: Type.Optional(Type.Number({ minimum: 0 })),
  },
  { additionalProperties: false }
);

// ============================================================================
// orchestrator.cost.burn_rate
// ============================================================================

export const OrchestratorCostBurnRateParamsSchema = Type.Object(
  {
    threadId: ThreadIdString,
  },
  { additionalProperties: false }
);

export const OrchestratorCostBurnRateResultSchema = Type.Object(
  {
    threadId: Type.String(),
    burnRatePerHour: Type.Number({ minimum: 0 }),
    burnRatePerMinute: Type.Number({ minimum: 0 }),
    burnRatePerSecond: Type.Number({ minimum: 0 }),
    recentCostCents: Type.Integer({ minimum: 0 }),
    recentDurationMs: Type.Integer({ minimum: 1 }),
    samplesUsed: Type.Integer({ minimum: 1, maximum: 5 }),
    estimatedRemainingMinutes: Type.Optional(Type.Number({ minimum: 0 })),
    lastUpdated: Type.Integer(),
  },
  { additionalProperties: false }
);

// ============================================================================
// Broadcast Events (for WebSocket streaming)
// ============================================================================

export const OrchestratorStateChangeEventSchema = Type.Object(
  {
    type: Type.Literal('orchestrator.state.changed'),
    threadId: Type.String(),
    from: Type.String(),
    to: Type.String(),
    stepCount: Type.Integer({ minimum: 0 }),
    executionTimeMs: Type.Integer({ minimum: 0 }),
    timestamp: Type.Integer(),
  },
  { additionalProperties: false }
);

export const OrchestratorCostUpdateEventSchema = Type.Object(
  {
    type: Type.Literal('orchestrator.cost.updated'),
    threadId: Type.String(),
    costDeltaCents: Type.Integer({ minimum: 0 }),
    totalCostCents: Type.Integer({ minimum: 0 }),
    budgetRemainingCents: Type.Integer({ minimum: 0 }),
    inputTokensDelta: Type.Integer({ minimum: 0 }),
    outputTokensDelta: Type.Integer({ minimum: 0 }),
    timestamp: Type.Integer(),
  },
  { additionalProperties: false }
);

export const OrchestratorCheckpointSavedEventSchema = Type.Object(
  {
    type: Type.Literal('orchestrator.checkpoint.saved'),
    threadId: Type.String(),
    checkpointId: Type.String(),
    stepCount: Type.Integer({ minimum: 0 }),
    timestamp: Type.Integer(),
  },
  { additionalProperties: false }
);

export const OrchestratorEventUnion = Type.Union([
  OrchestratorStateChangeEventSchema,
  OrchestratorCostUpdateEventSchema,
  OrchestratorCheckpointSavedEventSchema,
]);
