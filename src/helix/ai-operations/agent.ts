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
import {
  executeSimpleRequest as executeSimpleAnthropicRequest,
  executeWithDeepSeek,
  getGeminiClient,
} from './providers/index.js';

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

    // Step 4: Execute with routed provider
    const userMessage = `${config.context ? `Context: ${config.context}\n\n` : ''}${config.prompt}`;
    let responseText = '';
    let outputTokens = 0;
    let costUsd = 0;

    if (routingDecision.model.includes('deepseek')) {
      // Use DeepSeek provider
      const result = await executeWithDeepSeek([{ role: 'user', content: userMessage }], {
        maxTokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.7,
      });
      responseText = result.content;
      outputTokens = result.outputTokens;
      costUsd = result.costUsd;
    } else if (
      routingDecision.model.includes('gemini') ||
      routingDecision.model.includes('flash')
    ) {
      // Use Gemini provider (for now, just extract response via SDK)
      const client = getGeminiClient();
      const modelId = getGeminiModelId(routingDecision.model);
      const generativeModel = client.getGenerativeModel({ model: modelId });
      const response = await generativeModel.generateContent(userMessage);
      responseText = response.response.text();
      outputTokens = Math.ceil(responseText.length / 4); // Estimate output tokens
      // Cost calculation for Gemini (rough estimate)
      const inputTokensEstimate = Math.ceil(userMessage.length / 4);
      costUsd = (inputTokensEstimate / 1000) * 0.00005 + (outputTokens / 1000) * 0.00015;
    } else {
      // Use Anthropic Claude provider (default)
      const actualModelId = getClaudeModelId(routingDecision.model);
      const result = await executeSimpleAnthropicRequest(
        userMessage,
        actualModelId,
        config.systemPrompt
      );
      responseText = result.content;
      outputTokens = result.outputTokens;
      costUsd = result.costUsd;
    }

    // Step 5: Calculate total latency
    const totalLatency = Date.now() - startTime;

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

/**
 * Map routed model key to actual Claude model ID
 */
function getClaudeModelId(model: string): string {
  const modelMap: Record<string, string> = {
    claude_haiku: 'claude-3-5-haiku-20241022',
    claude_sonnet: 'claude-3-5-sonnet-20241022',
    claude_opus: 'claude-opus-4-1-20250805',
    haiku: 'claude-3-5-haiku-20241022',
    sonnet: 'claude-3-5-sonnet-20241022',
    opus: 'claude-opus-4-1-20250805',
  };

  return modelMap[model] || 'claude-3-5-haiku-20241022';
}

/**
 * Map routed model key to actual Gemini model ID
 */
function getGeminiModelId(model: string): string {
  const modelMap: Record<string, string> = {
    gemini_flash: 'gemini-2.0-flash',
    'gemini-flash': 'gemini-2.0-flash',
  };

  return modelMap[model] || 'gemini-2.0-flash';
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
export function getAgentOperationsCost(_userId: string): {
  totalCost: number;
  operationCount: number;
  lastUpdated: string;
} {
  // This would query the cost_budgets table for the user
  // Implementation depends on Supabase integration
  return {
    totalCost: 0,
    operationCount: 0,
    lastUpdated: new Date().toISOString(),
  };
}
