/**
 * Video Understanding Operations - Phase 0.5
 *
 * Centralized video understanding with routing, cost tracking, and approval gates.
 * Handles video frame analysis through Gemini Video API with centralized routing.
 *
 * Note: ESLint exceptions used for staging. Supabase types will be properly generated in production.
 */

import { router } from './router.js';
import { costTracker } from './cost-tracker.js';
import { approvalGate } from './approval-gate.js';

/**
 * Video understanding configuration
 */
export interface VideoUnderstandingConfig {
  operationId: string;
  userId?: string;
  videoBuffer: Buffer;
  mimeType?: string;
  prompt?: string;
  frameCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Video understanding result
 */
export interface VideoUnderstandingResult {
  success: boolean;
  description: string;
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
    frameCount?: number;
  };
}

/**
 * Analyze video with centralized routing and cost tracking
 *
 * Pattern: Estimate Tokens → Route → Approve → Execute → Track Cost
 */
export async function analyzeVideo(
  config: VideoUnderstandingConfig
): Promise<VideoUnderstandingResult> {
  const startTime = Date.now();

  try {
    // Step 1: Estimate tokens for routing decision
    // Video token estimation: frames × 1000 + base_prompt (500) × 1.2 buffer
    const frameCount = config.frameCount || 30; // Conservative default
    const basePromptTokens = 500;
    const estimatedInputTokens = Math.ceil((frameCount * 1000 + basePromptTokens) * 1.2);

    // Step 2: Route through centralized router
    const routingDecision = await router.route({
      operationId: config.operationId,
      userId: config.userId,
      input: [{ role: 'user' as const, content: config.prompt || 'Describe the video.' }],
      estimatedInputTokens,
    });

    // Step 3: Check if approval is required (HIGH criticality operations)
    let approvalStatus: 'pending' | 'approved' | 'rejected' = 'approved';

    if (routingDecision.requiresApproval) {
      const approval = await approvalGate.requestApproval(
        config.operationId,
        `Video Analysis: ${config.operationId}`,
        routingDecision.estimatedCostUsd,
        `Frame Count: ${frameCount} | Mime: ${config.mimeType || 'video/mp4'}`
      );

      approvalStatus = approval.status;

      if (approval.status === 'rejected') {
        return {
          success: false,
          description: `Operation rejected by approval gate. Cost estimate: $${routingDecision.estimatedCostUsd.toFixed(4)}`,
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
            frameCount,
          },
        };
      }
    }

    // Step 4: Get model client for routed model
    const modelClient = getModelClientForOperation(routingDecision.model);
    const modelId = getModelIdForRoute(routingDecision.model);

    // Step 5: Execute with routed model (Gemini Video API call)
    const message = await modelClient.messages.create({
      model: modelId,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: config.prompt || 'Describe this video in detail.',
            },
            {
              type: 'video',
              source: {
                type: 'base64',
                media_type: config.mimeType || 'video/mp4',
                data: config.videoBuffer.toString('base64'),
              },
            },
          ],
        },
      ],
    });

    // Step 6: Extract response
    const descriptionText = message.content[0]?.type === 'text' ? message.content[0].text : '';

    // Step 7: Calculate actual cost
    const outputTokens = message.usage?.output_tokens || Math.ceil(descriptionText.length / 4);
    const totalLatency = Date.now() - startTime;
    const costUsd = router['estimateCost'](
      routingDecision.model,
      estimatedInputTokens,
      outputTokens
    );

    // Step 8: Log operation to cost tracker
    await costTracker.logOperation(config.userId || 'system', {
      operation_type: 'video_understanding',
      operation_id: config.operationId,
      model_used: routingDecision.model,
      user_id: config.userId,
      input_tokens: estimatedInputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      latency_ms: totalLatency,
      quality_score: 0.9, // Video understanding quality baseline
      success: true,
    });

    return {
      success: true,
      description: descriptionText,
      model: routingDecision.model,
      inputTokens: estimatedInputTokens,
      outputTokens,
      costUsd,
      latencyMs: totalLatency,
      metadata: {
        routed: true,
        requiresApproval: routingDecision.requiresApproval,
        approvalStatus,
        quality_score: 0.9,
        frameCount,
      },
    };
  } catch (error) {
    const totalLatency = Date.now() - startTime;

    // Log failure
    console.error('Video analysis failed:', {
      operationId: config.operationId,
      userId: config.userId,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: totalLatency,
    });

    // Attempt to log the failure to cost tracker
    try {
      await costTracker.logOperation(config.userId || 'system', {
        operation_type: 'video_understanding',
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
      console.error('Failed to log video analysis failure:', trackingError);
    }

    throw error;
  }
}

/**
 * Get model client for operation
 * Phase 0.5: Uses Anthropic SDK with Gemini adapter placeholder
 */
interface ModelClientResponse {
  content: Array<{ type: string; text: string }>;
  usage: { output_tokens: number };
}

interface ModelClient {
  messages: {
    create: (params: Record<string, unknown>) => Promise<ModelClientResponse>;
  };
}

function getModelClientForOperation(_model: string): ModelClient {
  // In production Phase 3, this would use actual Gemini client
  // For now, return a mock client compatible with Anthropic SDK interface
  return {
    messages: {
      create: async (_params: Record<string, unknown>): Promise<ModelClientResponse> => {
        // Placeholder implementation - in production this would call actual Gemini Video API
        await Promise.resolve(); // Placeholder await
        return {
          content: [{ type: 'text' as const, text: 'Video analysis description.' }],
          usage: { output_tokens: 100 },
        };
      },
    },
  };
}

/**
 * Get model ID for API calls
 * Phase 0.5: Uses Claude as placeholder for Gemini
 * Phase 3: Will use actual Gemini model IDs
 */
function getModelIdForRoute(model: string): string {
  const modelIds: Record<string, string> = {
    gemini_flash: 'gemini-2.0-flash-exp', // Placeholder - Phase 3: actual Gemini Video model
    deepseek: 'claude-3-5-sonnet-20241022', // Fallback
    haiku: 'claude-3-5-haiku-20241022',
    sonnet: 'claude-3-5-sonnet-20241022',
    opus: 'claude-opus-4-1-20250805',
  };

  return modelIds[model] || 'claude-3-5-sonnet-20241022';
}

/**
 * Batch analyze multiple videos
 */
export async function analyzeBatchVideos(
  configs: VideoUnderstandingConfig[]
): Promise<VideoUnderstandingResult[]> {
  const results: VideoUnderstandingResult[] = [];

  for (const config of configs) {
    try {
      const result = await analyzeVideo(config);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
 * Get total cost for video operations
 */
export async function getVideoOperationsCost(_userId: string): Promise<{
  totalCost: number;
  operationCount: number;
  lastUpdated: string;
}> {
  try {
    // This would query the cost_budgets table for the user
    // Implementation depends on Supabase integration
    await Promise.resolve(); // Placeholder await
    return {
      totalCost: 0,
      operationCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to get video operations cost:', error);
    throw error;
  }
}
