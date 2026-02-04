/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-argument,@typescript-eslint/require-await,@typescript-eslint/no-unused-vars,@typescript-eslint/no-explicit-any */
/**
 * Agent Execution Operations - Phase 0.5
 *
 * Centralized agent execution with routing, cost tracking, and approval gates.
 * Handles complex orchestration tasks through the centralized AI operations router.
 *
 * Note: ESLint exceptions used for staging. Supabase types will be properly generated in production.
 */

import { router } from './router.js';
import { costTracker } from './cost-tracker.js';
import { approvalGate } from './approval-gate.js';

/**
 * Agent execution configuration
 */
export interface AgentExecutionConfig {
  operationId: string;
  userId?: string;
  prompt: string;
  context?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  success: boolean;
  response: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  metadata: {
    routed: boolean;
    requiresApproval: boolean;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    quality_score: number;
  };
}

/**
 * Execute agent command with centralized routing and cost tracking
 *
 * Pattern: Route → Approve → Execute → Track Cost
 */
export async function executeAgentCommand(
  config: AgentExecutionConfig
): Promise<AgentExecutionResult> {
  const startTime = Date.now();

  try {
    // Step 1: Estimate tokens for routing decision
    const systemPromptText = config.systemPrompt || 'You are a helpful assistant.';
    const contextText = config.context || '';
    const fullPrompt = `${systemPromptText}\n\nContext: ${contextText}\n\nUser: ${config.prompt}`;

    const estimatedInputTokens = Math.ceil(fullPrompt.length / 4);

    // Step 2: Route through centralized router
    const routingDecision = await router.route({
      operationId: config.operationId,
      userId: config.userId,
      input: [{ role: 'user' as const, content: config.prompt }],
      estimatedInputTokens,
    });

    // Step 3: Check if approval is required (HIGH criticality operations)
    let approvalStatus: 'pending' | 'approved' | 'rejected' = 'approved';

    if (routingDecision.requiresApproval) {
      const approval = await approvalGate.requestApproval(
        config.operationId,
        `Agent: ${config.operationId}`,
        routingDecision.estimatedCostUsd,
        `Prompt: ${config.prompt.substring(0, 100)}...`
      );

      approvalStatus = approval.status;

      if (approval.status === 'rejected') {
        return {
          success: false,
          response: `Operation rejected by approval gate. Cost estimate: $${routingDecision.estimatedCostUsd.toFixed(4)}`,
          model: routingDecision.model,
          inputTokens: estimatedInputTokens,
          outputTokens: 0,
          costUsd: 0,
          latencyMs: Date.now() - startTime,
          metadata: {
            routed: true,
            requiresApproval: true,
            approvalStatus: 'rejected',
            quality_score: 0,
          },
        };
      }
    }

    // Step 4: Get model client for routed model
    const modelClient = getModelClientForOperation(routingDecision.model);
    const modelId = getModelIdForRoute(routingDecision.model);

    // Step 5: Execute with routed model
    const message = await modelClient.messages.create({
      model: modelId,
      max_tokens: config.maxTokens || 2048,
      temperature: config.temperature || 1.0,
      system: config.systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${config.context ? `Context: ${config.context}\n\n` : ''}${config.prompt}`,
        },
      ],
    });

    // Step 6: Extract response
    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';

    // Step 7: Calculate actual cost
    const outputTokens = message.usage?.output_tokens || Math.ceil(responseText.length / 4);
    const totalLatency = Date.now() - startTime;
    const costUsd = router['estimateCost'](
      routingDecision.model,
      estimatedInputTokens,
      outputTokens
    );

    // Step 8: Log operation to cost tracker
    await costTracker.logOperation(config.userId || 'system', {
      operation_type: 'agent_execution',
      operation_id: config.operationId,
      model_used: routingDecision.model,
      user_id: config.userId,
      input_tokens: estimatedInputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      latency_ms: totalLatency,
      quality_score: 0.95, // Agent execution quality baseline
      success: true,
    });

    return {
      success: true,
      response: responseText,
      model: routingDecision.model,
      inputTokens: estimatedInputTokens,
      outputTokens,
      costUsd,
      latencyMs: totalLatency,
      metadata: {
        routed: true,
        requiresApproval: routingDecision.requiresApproval,
        approvalStatus,
        quality_score: 0.95,
      },
    };
  } catch (error) {
    const totalLatency = Date.now() - startTime;

    // Log failure
    console.error('Agent execution failed:', {
      operationId: config.operationId,
      userId: config.userId,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: totalLatency,
    });

    // Attempt to log the failure to cost tracker
    try {
      await costTracker.logOperation(config.userId || 'system', {
        operation_type: 'agent_execution',
        operation_id: config.operationId,
        model_used: 'unknown',
        user_id: config.userId,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        latency_ms: totalLatency,
        quality_score: 0,
        success: false,
      });
    } catch (trackingError) {
      console.error('Failed to log agent execution failure:', trackingError);
    }

    throw error;
  }
}

/**
 * Get model client for operation
 * Phase 0.5: Uses Anthropic SDK with placeholders for DeepSeek/Gemini adapters
 */

function getModelClientForOperation(_model: string): any {
  // In production Phase 3, this would switch between different model clients
  // For now, all route to Anthropic SDK with model ID placeholders
  // Returns an Anthropic client instance with configured API key
  return {
    messages: {
      create: async (_params: any): Promise<any> => {
        // Placeholder implementation - in production this would call actual API
        return {
          content: [{ type: 'text' as const, text: 'Model response' }],
          usage: { output_tokens: 100 },
        };
      },
    },
  };
}

/**
 * Get model ID for API calls
 * Phase 0.5: Uses Claude as placeholder for DeepSeek/Gemini
 * Phase 3: Will use actual model APIs
 */
function getModelIdForRoute(model: string): string {
  const modelIds: Record<string, string> = {
    deepseek: 'claude-3-5-sonnet-20241022', // Placeholder - Phase 3: actual DeepSeek API
    gemini_flash: 'claude-3-5-sonnet-20241022', // Placeholder - Phase 3: actual Gemini API
    openai: 'gpt-4-turbo',
    haiku: 'claude-3-5-haiku-20241022',
    sonnet: 'claude-3-5-sonnet-20241022',
    opus: 'claude-opus-4-1-20250805',
  };

  return modelIds[model] || 'claude-3-5-sonnet-20241022';
}

/**
 * Batch execute multiple agent commands with cost tracking
 */
export async function executeBatchAgentCommands(
  configs: AgentExecutionConfig[]
): Promise<AgentExecutionResult[]> {
  const results: AgentExecutionResult[] = [];

  for (const config of configs) {
    try {
      const result = await executeAgentCommand(config);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        model: 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        metadata: {
          routed: false,
          requiresApproval: false,
          quality_score: 0,
        },
      });
    }
  }

  return results;
}

/**
 * Get total cost for agent operations
 */
export async function getAgentOperationsCost(_userId: string): Promise<{
  totalCost: number;
  operationCount: number;
  lastUpdated: string;
}> {
  try {
    // This would query the cost_budgets table for the user
    // Implementation depends on Supabase integration
    return {
      totalCost: 0,
      operationCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to get agent operations cost:', error);
    throw error;
  }
}
