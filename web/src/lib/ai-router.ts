/**
 * AI Router - Alias for LLM Router
 * This module re-exports the LLM router for backward compatibility
 */

export { LLMRouter as AIOperationRouter } from '../services/llm-router/router.js';
export type {
  LLMModel,
  Operation,
  RoutingRequest,
  RoutingDecision,
  ExecutionResult,
  CostEstimate,
  BudgetInfo,
  OperationMetrics,
  EmailComposeRequest,
  EmailClassifyRequest,
  EmailClassifyResult,
  EmailRespondRequest,
  CalendarPrepRequest,
  CalendarTimeRequest,
  TaskPrioritizeRequest,
  TaskBreakdownRequest,
  TaskBreakdownResult,
  AnalyticsSummaryRequest,
  AnalyticsAnomalyRequest,
  AnomalyResult,
} from '../services/llm-router/types.js';
