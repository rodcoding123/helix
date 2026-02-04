/**
 * ModelSpawner
 *
 * Routes decisions from Phase 0 (consciousness/goals) through Phase 0.5 (control plane)
 * to spawn model executions. Manages operation routing, cost tracking, and execution.
 *
 * Phase 0: Orchestration Foundation, Task 3
 * Created: 2026-02-04
 */

import { hashChain } from '../hash-chain.js';
import { costTracker } from '../ai-operations/cost-tracker.js';
import { router as aiOperationRouter } from '../ai-operations/router.js';
import { ConsciousnessState } from './consciousness-loader.js';
import { Goal, Operation } from './goal-evaluator.js';

export interface ExecutionContext {
  user_id: string;
  consciousness_state?: ConsciousnessState;
  goal?: Goal;
  operation: Operation;
  budget_remaining: number;
}

export interface SpawnedModel {
  model_id: string;
  operation_type: string;
  operation_id: string;
  model_selection: 'deepseek' | 'gemini' | 'claude' | 'edge-tts';
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  result?: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
  tokens_used?: number;
  cost_usd?: number;
}

export interface SpawnResult {
  spawned_models: SpawnedModel[];
  total_cost_usd: number;
  success_count: number;
  failed_count: number;
  timestamp: string;
}

/**
 * ModelSpawner - Routes operations through control plane and spawns model executions
 *
 * Responsibilities:
 * 1. Route operations through AIOperationRouter to select best model
 * 2. Build ExecutionContext with consciousness state, goal, operation, budget
 * 3. Log operations to CostTracker (pre-execution) for budget tracking
 * 4. Log to hash chain (type: model_spawned) for audit trail
 * 5. Spawn background model executions (fire-and-forget)
 * 6. Track active models and their execution status
 * 7. Handle errors gracefully with logging
 */
export class ModelSpawner {
  private activeModels: Map<string, SpawnedModel> = new Map();
  private executionContexts: Map<string, ExecutionContext> = new Map();
  private consciousnessState: ConsciousnessState | null = null;

  async spawn(userId: string, operation: Operation, budgetRemaining: number): Promise<SpawnResult> {
    // Fire-and-forget pattern: measure total time just to ensure we return quickly
    // The actual execution happens in background

    // Check budget before spawning
    if (budgetRemaining < operation.estimated_cost) {
      return {
        spawned_models: [],
        total_cost_usd: 0,
        success_count: 0,
        failed_count: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // Create SpawnedModel entry
    const modelId = `model_${operation.operation_id}_${Date.now()}`;
    const spawnedModel: SpawnedModel = {
      model_id: modelId,
      operation_type: operation.operation_type,
      operation_id: operation.operation_id,
      model_selection: await this.selectModel(operation),
      status: 'pending',
      started_at: new Date().toISOString(),
    };

    // Add to active models
    this.activeModels.set(modelId, spawnedModel);

    // Create execution context
    const context: ExecutionContext = {
      user_id: userId,
      consciousness_state: this.consciousnessState || undefined,
      operation,
      budget_remaining: budgetRemaining - operation.estimated_cost,
    };
    this.executionContexts.set(modelId, context);

    // Log to hash chain (type: model_spawned) - fire-and-forget
    await hashChain
      .add({
        type: 'model_spawned',
        model_id: modelId,
        operation_type: operation.operation_type,
        operation_id: operation.operation_id,
        selected_model: spawnedModel.model_selection,
        budget_required: operation.estimated_cost,
        consciousness_layer_count: this.consciousnessState ? 7 : 0,
        timestamp: new Date().toISOString(),
      })
      .catch(err => console.warn('Failed to log model spawn to hash chain:', err));

    // Log to CostTracker (pre-execution) - fire-and-forget
    await costTracker
      .logOperation(userId, {
        operation_id: operation.operation_id,
        operation_type: operation.operation_type,
        model_used: spawnedModel.model_selection,
        cost_usd: operation.estimated_cost,
        latency_ms: 0,
        success: true,
        input_tokens: 0,
        output_tokens: 0,
      })
      .catch(err => console.warn('Failed to log to cost tracker:', err));

    // Background execution (fire-and-forget) - don't await
    this.executeModel(spawnedModel.model_id, spawnedModel, context).catch(err => {
      console.warn('Model execution failed:', err);
      spawnedModel.status = 'failed';
      spawnedModel.error = String(err);
    });

    // Return immediately (fire-and-forget pattern)
    return {
      spawned_models: [spawnedModel],
      total_cost_usd: operation.estimated_cost,
      success_count: 1,
      failed_count: 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Select model through AIOperationRouter
   *
   * Routes operation through Phase 0.5 control plane to determine
   * the best model based on complexity, cost, and provider health
   */
  private async selectModel(
    operation: Operation
  ): Promise<'deepseek' | 'gemini' | 'claude' | 'edge-tts'> {
    try {
      // Route through AIOperationRouter to select best model
      const decision = await aiOperationRouter.route({
        operationId: operation.operation_id,
        userId: undefined,
        estimatedInputTokens: 1000,
      });

      // Map model names to our enum
      const modelMap: Record<string, 'deepseek' | 'gemini' | 'claude' | 'edge-tts'> = {
        deepseek: 'deepseek',
        'deepseek-v3': 'deepseek',
        gemini_flash: 'gemini',
        'gemini-2.0-flash': 'gemini',
        claude_opus: 'claude',
        'claude-opus-4.5': 'claude',
        'edge-tts': 'edge-tts',
      };

      // Find matching model or default to gemini
      for (const [key, value] of Object.entries(modelMap)) {
        if (decision.model.includes(key)) {
          return value;
        }
      }

      return 'gemini';
    } catch (err) {
      console.warn('Model selection failed, defaulting to gemini:', err);
      return 'gemini';
    }
  }

  /**
   * Execute model in background (fire-and-forget)
   *
   * Updates status from pending → running → completed/failed
   * Stores result or error in SpawnedModel
   *
   * @param modelId - Model ID for potential future logging (reserved for audit trail)
   */
  private async executeModel(
    _modelId: string,
    spawnedModel: SpawnedModel,
    context: ExecutionContext
  ): Promise<void> {
    const executionStart = Date.now();

    try {
      spawnedModel.status = 'running';

      // Execute based on operation type
      switch (context.operation.operation_type) {
        case 'email':
          spawnedModel.result = await this.executeEmailOperation(context);
          break;
        case 'calendar':
          spawnedModel.result = await this.executeCalendarOperation(context);
          break;
        case 'task':
          spawnedModel.result = await this.executeTaskOperation(context);
          break;
        case 'analysis':
          spawnedModel.result = await this.executeAnalysisOperation(context);
          break;
        default:
          throw new Error(`Unknown operation type: ${context.operation.operation_type}`);
      }

      spawnedModel.status = 'completed';
      spawnedModel.duration_ms = Date.now() - executionStart;
      spawnedModel.completed_at = new Date().toISOString();
      spawnedModel.cost_usd = context.operation.estimated_cost;
    } catch (err) {
      spawnedModel.status = 'failed';
      spawnedModel.error = String(err);
      spawnedModel.duration_ms = Date.now() - executionStart;
      spawnedModel.completed_at = new Date().toISOString();
    }
  }

  /**
   * Execute email operation
   *
   * Placeholder: In real implementation, would call email service (Gmail, Outlook, etc.)
   */
  private async executeEmailOperation(
    _context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    // Simulated email processing
    await new Promise(resolve => setTimeout(resolve, 50));
    return { emails_processed: 0 };
  }

  /**
   * Execute calendar operation
   *
   * Placeholder: In real implementation, would call calendar service (Google Calendar, etc.)
   */
  private async executeCalendarOperation(
    _context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    // Simulated calendar processing
    await new Promise(resolve => setTimeout(resolve, 50));
    return { events_scheduled: 0 };
  }

  /**
   * Execute task operation
   *
   * Placeholder: In real implementation, would call task service (Todoist, etc.)
   */
  private async executeTaskOperation(_context: ExecutionContext): Promise<Record<string, unknown>> {
    // Simulated task processing
    await new Promise(resolve => setTimeout(resolve, 50));
    return { tasks_created: 0 };
  }

  /**
   * Execute analysis operation
   *
   * Placeholder: In real implementation, would run analysis or model inference
   */
  private async executeAnalysisOperation(
    _context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    // Simulated analysis
    await new Promise(resolve => setTimeout(resolve, 50));
    return { analysis_complete: true };
  }

  /**
   * Get all active spawned models
   */
  getActiveModels(): SpawnedModel[] {
    return Array.from(this.activeModels.values());
  }

  /**
   * Get count of active models
   */
  getActiveModelCount(): number {
    return this.activeModels.size;
  }

  /**
   * Get all execution contexts
   */
  getExecutionContexts(): Map<string, ExecutionContext> {
    return this.executionContexts;
  }

  /**
   * Set consciousness state for ExecutionContext building
   */
  setConsciousnessState(state: ConsciousnessState): void {
    this.consciousnessState = state;
  }

  /**
   * Get consciousness state
   */
  getConsciousnessState(): ConsciousnessState | null {
    return this.consciousnessState;
  }

  /**
   * Clear completed/failed models from active tracking
   *
   * Called periodically to clean up old entries
   */
  clearCompletedModels(): number {
    let clearedCount = 0;
    for (const [modelId, model] of this.activeModels.entries()) {
      if (model.status === 'completed' || model.status === 'failed') {
        this.activeModels.delete(modelId);
        this.executionContexts.delete(modelId);
        clearedCount++;
      }
    }
    return clearedCount;
  }
}

// Export singleton instance
export const modelSpawner = new ModelSpawner();
