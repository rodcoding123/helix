/**
 * LLM Router Service
 * Central routing for all 9 Phase 8 intelligence operations
 * Integrates with Phase 0.5 AIOperationRouter for cost tracking and approval gates
 */

import { supabase } from '@/lib/supabase';
import { logToDiscord, logToHashChain } from '../logging.js';
import { getCostTracker } from './cost-tracker.js';
import type {
  Operation,
  RoutingRequest,
  RoutingDecision,
  ExecutionResult,
  LLMModel,
} from './types.js';

const MODELS: Record<string, LLMModel> = {
  'claude-opus-4.5': {
    id: 'claude-opus-4.5',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    costPerMTokenInput: 3.0,
    costPerMTokenOutput: 15.0,
    maxContextWindow: 200000,
    maxOutputTokens: 4096,
  },
  'deepseek-v3.2': {
    id: 'deepseek-v3.2',
    name: 'DeepSeek v3.2',
    provider: 'deepseek',
    costPerMTokenInput: 0.6,
    costPerMTokenOutput: 2.0,
    maxContextWindow: 128000,
    maxOutputTokens: 4096,
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    costPerMTokenInput: 0.05,
    costPerMTokenOutput: 0.2,
    maxContextWindow: 1000000,
    maxOutputTokens: 8000,
  },
};

export class LLMRouter {
  private db = supabase;
  private operationsCache: Map<
    string,
    { operation: Operation; timestamp: number }
  > = new Map();
  private operationsCacheTTL = 10 * 60 * 1000; // 10 minutes
  private costTracker = getCostTracker();

  async initialize(): Promise<void> {
    await this.loadOperations();

    await logToDiscord({
      type: 'llm_router_init' as any,
      timestamp: Date.now(),
      status: 'initialized' as any,
      operationsCount: this.operationsCache.size,
    } as any);

    await logToHashChain({
      type: 'llm_router_initialized',
      data: JSON.stringify({ operationsCount: this.operationsCache.size }),
    });
  }

  /**
   * Load all registered operations from database
   */
  private async loadOperations(): Promise<void> {
    if (!this.db) {
      throw new Error('LLMRouter not initialized');
    }

    const { data, error } = await this.db
      .from('ai_model_routes')
      .select('*')
      .eq('enabled', true) as any;

    if (error) {
      throw new Error(`Failed to load operations: ${error.message}`);
    }

    this.operationsCache.clear();

    if (data) {
      for (const row of data) {
        const operation: Operation = {
          id: row.operation_id,
          name: row.operation_name,
          description: row.description,
          primaryModel: row.primary_model,
          fallbackModel: row.fallback_model,
          costCriticality: row.cost_criticality,
          estimatedCostUsd: row.estimated_cost_usd,
          avgInputTokens: row.avg_input_tokens,
          avgOutputTokens: row.avg_output_tokens,
          enabled: row.enabled,
        };

        this.operationsCache.set(row.operation_id, {
          operation,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Get operation by ID
   */
  private async getOperation(operationId: string): Promise<Operation> {
    // Check cache
    const cached = this.operationsCache.get(operationId);
    if (
      cached &&
      Date.now() - cached.timestamp < this.operationsCacheTTL
    ) {
      return cached.operation;
    }

    // Reload from database
    await this.loadOperations();

    const operation = this.operationsCache.get(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    return operation.operation;
  }

  /**
   * Main routing decision
   * Determines which model to use for an operation
   */
  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const operation = await this.getOperation(request.operationId);

    // Check if feature is enabled
    const isEnabled = await this.isFeatureEnabled(
      request.userId,
      request.operationId
    );

    if (!isEnabled) {
      return {
        operationId: request.operationId,
        selectedModel: operation.primaryModel as any,
        estimatedCostUsd: operation.estimatedCostUsd,
        requiresApproval: false,
        approvalReason: 'Feature is disabled',
        budgetStatus: 'ok' as any,
        isFeatureEnabled: false,
        timestamp: new Date().toISOString(),
      } as any;
    }

    // Select model (use primary by default)
    let selectedModel = operation.primaryModel;

    // Check budget
    const canExecute = await this.costTracker.canExecuteOperation(
      request.userId,
      operation.estimatedCostUsd
    );

    if (!canExecute.allowed) {
      // Try fallback if available
      if (operation.fallbackModel) {
        selectedModel = operation.fallbackModel;
      } else {
        throw new Error(canExecute.reason);
      }
    }

    // Check if approval required
    const approvalInfo = await this.costTracker.requiresApproval(
      request.userId,
      operation.costCriticality,
      operation.estimatedCostUsd
    );

    const budget = await this.costTracker.getUserBudget(request.userId);

    const decision: RoutingDecision = {
      operationId: request.operationId,
      selectedModel,
      model: selectedModel, // Alias for compatibility
      estimatedCostUsd: operation.estimatedCostUsd,
      requiresApproval: approvalInfo.required,
      approvalReason: approvalInfo.reason,
      budgetStatus: budget.budgetStatus,
      isFeatureEnabled: true,
      timestamp: new Date().toISOString(),
    };

    // Log decision to Discord
    await logToDiscord({
      type: 'routing_decision',
      content: `Routing ${request.operationId} to ${selectedModel}`,
      metadata: {
        userId: request.userId,
        operationId: request.operationId,
        selectedModel,
        requiresApproval: approvalInfo.required,
        estimatedCost: operation.estimatedCostUsd,
      },
      timestamp: Date.now(),
    });

    // Log to hash chain
    await logToHashChain({
      type: 'routing_decision',
      userId: request.userId,
      data: JSON.stringify({
        operationId: request.operationId,
        selectedModel,
        requiresApproval: approvalInfo.required,
        timestamp: decision.timestamp,
      }),
    });

    return decision;
  }

  /**
   * Check if a feature is enabled for a user
   */
  private async isFeatureEnabled(
    userId: string,
    operationId: string
  ): Promise<boolean> {
    if (!this.db) {
      throw new Error('LLMRouter not initialized');
    }

    // Map operation ID to feature toggle name
    const toggleName = `phase8-${operationId}`;

    // Call database function to get user's effective feature status
    const { data, error } = await (this.db.rpc as any)(
      'get_user_feature_enabled',
      {
        p_user_id: userId,
        p_toggle_name: toggleName,
      }
    );

    if (error) {
      // Default to true if error (feature enabled)
      console.error(`Failed to check feature status: ${error.message}`);
      return true;
    }

    return !!data;
  }

  /**
   * Execute operation with selected model
   * This is called after routing decision is made
   */
  async executeOperation(
    decision: RoutingDecision,
    userId: string,
    handler: (model: LLMModel, context: ExecutionContext) => Promise<{
      inputTokens: number;
      outputTokens: number;
      result?: unknown;
      content?: string;
      stopReason?: string;
    }>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const model = MODELS[decision.selectedModel];

    if (!model) {
      throw new Error(`Unknown model: ${decision.selectedModel}`);
    }

    try {
      const context: ExecutionContext = {
        userId,
        operationId: decision.operationId,
        model: decision.selectedModel,
        startTime,
      };

      // Execute with model
      const handlerResult = await handler(model, context);
      const { inputTokens, outputTokens, result, content, stopReason } = handlerResult;

      const latencyMs = Date.now() - startTime;

      // Log execution
      const logId = await this.costTracker.logExecution(
        userId,
        decision.operationId,
        decision.selectedModel,
        inputTokens,
        outputTokens
      );

      const costUsd = this.costTracker.calculateOperationCost(
        decision.selectedModel,
        inputTokens,
        outputTokens
      );

      const executionResult: ExecutionResult = {
        operationLogId: logId,
        success: true,
        model: decision.selectedModel,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd,
        latencyMs,
        result: result ?? content, // Use result if present, otherwise content
        content,
        stopReason,
      };

      // Log to Discord
      await logToDiscord({
        type: 'operation_executed' as any,
        content: `Executed ${decision.operationId}`,
        metadata: { userId, model: decision.selectedModel, costUsd, tokens: inputTokens + outputTokens, latencyMs },
        timestamp: Date.now(),
      } as any);

      // Log to hash chain
      await logToHashChain({
        type: 'operation_executed',
        userId,
        data: JSON.stringify({
          operationId: decision.operationId,
          model: decision.selectedModel,
          costUsd,
          latencyMs,
          timestamp: Date.now(),
        }),
      });

      return executionResult;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Log error to Discord
      await logToDiscord({
        type: 'operation_failed' as any,
        content: errorMessage,
        metadata: { userId, operationId: decision.operationId, model: decision.selectedModel, latencyMs },
        status: 'error',
        timestamp: Date.now(),
      } as any);

      // Log to hash chain
      await logToHashChain({
        type: 'operation_failed',
        userId,
        data: JSON.stringify({
          operationId: decision.operationId,
          error: errorMessage,
          timestamp: Date.now(),
        }),
      });

      return {
        operationLogId: '',
        success: false,
        model: decision.selectedModel,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        latencyMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Get all registered operations
   */
  async listOperations(): Promise<Operation[]> {
    if (this.operationsCache.size === 0) {
      await this.loadOperations();
    }

    return Array.from(this.operationsCache.values()).map((c) =>
      c.operation
    );
  }

  /**
   * Clear operation cache (for testing)
   */
  clearCache(): void {
    this.operationsCache.clear();
  }
}

/**
 * Execution context passed to operation handler
 */
export interface ExecutionContext {
  userId: string;
  operationId: string;
  model: string;
  startTime: number;
}

// Singleton instance
let instance: LLMRouter | null = null;

export function getLLMRouter(): LLMRouter {
  if (!instance) {
    instance = new LLMRouter();
    instance.initialize().catch(console.error);
  }
  return instance;
}
