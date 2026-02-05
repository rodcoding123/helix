/**
 * Cost Tracker Service
 * Tracks and enforces cost budgets for AI operations
 */

import { supabase } from '@/lib/supabase';
import { logToDiscord, logToHashChain } from '../logging.js';
import type { BudgetInfo, CostEstimate, Operation } from './types.js';

// Costs are in $ per million tokens
const CLAUDE_OPUS_4_5_INPUT_COST = 3.0; // $3 per MTok
const CLAUDE_OPUS_4_5_OUTPUT_COST = 15.0; // $15 per MTok
const DEEPSEEK_V3_2_INPUT_COST = 0.6; // $0.60 per MTok
const DEEPSEEK_V3_2_OUTPUT_COST = 2.0; // $2 per MTok
const GEMINI_2_0_FLASH_INPUT_COST = 0.05; // $0.05 per MTok
const GEMINI_2_0_FLASH_OUTPUT_COST = 0.2; // $0.20 per MTok

export class CostTracker {
  private db = supabase;
  private budgetCache: Map<
    string,
    { budget: BudgetInfo; timestamp: number }
  > = new Map();
  private cacheTTL = 2 * 60 * 1000; // 2 minutes

  async initialize(): Promise<void> {
    await logToDiscord({
      type: 'cost_tracker_init',
      content: 'Cost tracker initialized',
      timestamp: Date.now(),
      status: 'completed',
    });
  }

  /**
   * Calculate cost for an operation
   * Note: pricing constants are in $ per million tokens
   */
  calculateOperationCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    let inputCostPerMToken = 0;
    let outputCostPerMToken = 0;

    switch (model) {
      case 'claude-opus-4.5':
        inputCostPerMToken = CLAUDE_OPUS_4_5_INPUT_COST;
        outputCostPerMToken = CLAUDE_OPUS_4_5_OUTPUT_COST;
        break;
      case 'deepseek-v3.2':
        inputCostPerMToken = DEEPSEEK_V3_2_INPUT_COST;
        outputCostPerMToken = DEEPSEEK_V3_2_OUTPUT_COST;
        break;
      case 'gemini-2.0-flash':
        inputCostPerMToken = GEMINI_2_0_FLASH_INPUT_COST;
        outputCostPerMToken = GEMINI_2_0_FLASH_OUTPUT_COST;
        break;
      default:
        throw new Error(`Unknown model: ${model}`);
    }

    // Convert to actual cost: (tokens / 1,000,000) * ($ per million tokens)
    const inputCost = (inputTokens / 1000000) * inputCostPerMToken;
    const outputCost = (outputTokens / 1000000) * outputCostPerMToken;

    return parseFloat((inputCost + outputCost).toFixed(6));
  }

  /**
   * Estimate cost for an operation
   */
  async estimateOperationCost(
    operation: Operation
  ): Promise<CostEstimate> {
    const cost = this.calculateOperationCost(
      operation.primaryModel,
      operation.avgInputTokens,
      operation.avgOutputTokens
    );

    // Estimate latency: ~100ms base + ~10ms per 100 tokens
    const estimatedLatencyMs =
      100 +
      Math.ceil((operation.avgInputTokens + operation.avgOutputTokens) / 10);

    return {
      operation: operation.id,
      model: operation.primaryModel,
      inputTokens: operation.avgInputTokens,
      outputTokens: operation.avgOutputTokens,
      costUsd: cost,
      estimatedLatencyMs,
    };
  }

  /**
   * Get user's budget information
   */
  async getUserBudget(userId: string): Promise<BudgetInfo> {
    // Check cache first
    const cached = this.budgetCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.budget;
    }

    if (!this.db) {
      throw new Error('CostTracker not initialized');
    }

    const { data, error } = await this.db
      .from('cost_budgets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no budget exists, create one with defaults
      if (error.code === 'PGRST116') {
        return this.createDefaultBudget(userId);
      }
      throw new Error(`Failed to fetch budget: ${error.message}`);
    }

    const budget: BudgetInfo = {
      userId: (data as any)?.user_id,
      dailyLimitUsd: parseFloat((data as any)?.daily_limit_usd),
      monthlyLimitUsd: parseFloat((data as any)?.monthly_limit_usd),
      currentSpendToday: parseFloat((data as any)?.current_spend_today),
      currentSpendMonth: parseFloat((data as any)?.current_spend_month),
      operationsToday: (data as any)?.operations_today,
      operationsMonth: (data as any)?.operations_month,
      warningThresholdPercentage: (data as any)?.warning_threshold_percentage,
      budgetStatus: (data as any)?.budget_status,
    };

    // Cache it
    this.budgetCache.set(userId, {
      budget,
      timestamp: Date.now(),
    });

    return budget;
  }

  /**
   * Check if user can execute operation (budget check)
   */
  async canExecuteOperation(
    userId: string,
    estimatedCostUsd: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const budget = await this.getUserBudget(userId);

    // Check daily limit
    if (budget.currentSpendToday + estimatedCostUsd > budget.dailyLimitUsd) {
      return {
        allowed: false,
        reason: `Daily budget exceeded. Current: $${budget.currentSpendToday.toFixed(2)}, Limit: $${budget.dailyLimitUsd.toFixed(2)}`,
      };
    }

    // Check monthly limit
    if (
      budget.currentSpendMonth + estimatedCostUsd >
      budget.monthlyLimitUsd
    ) {
      return {
        allowed: false,
        reason: `Monthly budget exceeded. Current: $${budget.currentSpendMonth.toFixed(2)}, Limit: $${budget.monthlyLimitUsd.toFixed(2)}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if operation requires approval
   */
  async requiresApproval(
    userId: string,
    criticality: 'LOW' | 'MEDIUM' | 'HIGH',
    estimatedCostUsd: number
  ): Promise<{ required: boolean; reason?: string }> {
    const budget = await this.getUserBudget(userId);

    // MEDIUM and HIGH criticality always require approval
    if (criticality !== 'LOW') {
      return {
        required: true,
        reason: `Operation criticality: ${criticality}`,
      };
    }

    // Check if approaching warning threshold
    const spendPercentage =
      ((budget.currentSpendToday + estimatedCostUsd) /
        budget.dailyLimitUsd) *
      100;

    if (spendPercentage >= budget.warningThresholdPercentage) {
      return {
        required: true,
        reason: `Approaching daily budget limit (${spendPercentage.toFixed(0)}%)`,
      };
    }

    return { required: false };
  }

  /**
   * Log operation execution and update budget
   */
  async logExecution(
    userId: string,
    operationId: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<string> {
    if (!this.db) {
      throw new Error('CostTracker not initialized');
    }

    const costUsd = this.calculateOperationCost(
      model,
      inputTokens,
      outputTokens
    );

    // Call database function to log operation
    const { data, error } = await (this.db as any).rpc(
      'log_ai_operation',
      {
        p_user_id: userId,
        p_operation_id: operationId,
        p_model_used: model,
        p_input_tokens: inputTokens,
        p_output_tokens: outputTokens,
        p_cost_usd: costUsd,
      }
    ) as any;

    if (error) {
      throw new Error(`Failed to log operation: ${error.message}`);
    }

    // Invalidate cache
    this.budgetCache.delete(userId);

    // Log to Discord
    await logToDiscord({
      type: 'operation_logged',
      content: `Operation ${operationId} logged: ${model} - $${costUsd.toFixed(4)}`,
      metadata: {
        userId,
        operationId,
        model,
        costUsd,
        tokens: inputTokens + outputTokens,
      },
      timestamp: Date.now(),
    });

    return data || '';
  }

  /**
   * Create default budget for new user
   */
  private createDefaultBudget(userId: string): BudgetInfo {
    const budget: BudgetInfo = {
      userId,
      dailyLimitUsd: 50.0,
      monthlyLimitUsd: 1000.0,
      currentSpendToday: 0,
      currentSpendMonth: 0,
      operationsToday: 0,
      operationsMonth: 0,
      warningThresholdPercentage: 80,
      budgetStatus: 'ok',
    };

    this.budgetCache.set(userId, {
      budget,
      timestamp: Date.now(),
    });

    return budget;
  }

  /**
   * Reset cache for testing
   */
  clearCache(): void {
    this.budgetCache.clear();
  }

  /**
   * Get pricing information for a model
   */
  getModelPricing(model: string): {
    inputCostPerMToken: number;
    outputCostPerMToken: number;
  } {
    switch (model) {
      case 'claude-opus-4.5':
        return {
          inputCostPerMToken: CLAUDE_OPUS_4_5_INPUT_COST,
          outputCostPerMToken: CLAUDE_OPUS_4_5_OUTPUT_COST,
        };
      case 'deepseek-v3.2':
        return {
          inputCostPerMToken: DEEPSEEK_V3_2_INPUT_COST,
          outputCostPerMToken: DEEPSEEK_V3_2_OUTPUT_COST,
        };
      case 'gemini-2.0-flash':
        return {
          inputCostPerMToken: GEMINI_2_0_FLASH_INPUT_COST,
          outputCostPerMToken: GEMINI_2_0_FLASH_OUTPUT_COST,
        };
      default:
        throw new Error(`Unknown model: ${model}`);
    }
  }
}

// Singleton instance
let instance: CostTracker | null = null;

export function getCostTracker(): CostTracker {
  if (!instance) {
    instance = new CostTracker();
    instance.initialize().catch(console.error);
  }
  return instance;
}
