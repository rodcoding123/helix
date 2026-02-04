/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-argument */
/**
 * Audio Transcription Operations - Phase 0.5
 *
 * Centralized audio transcription with routing, cost tracking, and approval gates.
 * Handles audio stream analysis through Deepgram API with centralized routing.
 *
 * Note: ESLint exceptions used for staging. Supabase types will be properly generated in production.
 */

import { router } from './router.js';
import { costTracker } from './cost-tracker.js';
import { approvalGate } from './approval-gate.js';

/**
 * Audio transcription configuration
 */
export interface AudioTranscriptionConfig {
  operationId: string;
  userId?: string;
  audioBuffer: Buffer;
  mimeType?: string;
  durationMinutes?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Audio transcription result
 */
export interface AudioTranscriptionResult {
  success: boolean;
  transcript: string;
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
    durationMinutes?: number;
  };
}

/**
 * Transcribe audio with centralized routing and cost tracking
 *
 * Pattern: Estimate Tokens → Route → Approve → Execute → Track Cost
 */
export async function transcribeAudio(
  config: AudioTranscriptionConfig
): Promise<AudioTranscriptionResult> {
  const startTime = Date.now();

  try {
    // Step 1: Estimate tokens for routing decision
    // Audio token estimation: duration_minutes × 100 + output_length/4
    const durationMinutes = config.durationMinutes || 5; // Conservative default
    const estimatedOutputTokens = 500; // Typical transcription output
    const estimatedInputTokens = Math.ceil(durationMinutes * 100 + estimatedOutputTokens);

    // Step 2: Route through centralized router
    const routingDecision = await router.route({
      operationId: config.operationId,
      userId: config.userId,
      input: [{ role: 'user' as const, content: 'Transcribe audio' }],
      estimatedInputTokens,
    });

    // Step 3: Check if approval is required (HIGH criticality operations)
    let approvalStatus: 'pending' | 'approved' | 'rejected' = 'approved';

    if (routingDecision.requiresApproval) {
      const approval = await approvalGate.requestApproval(
        config.operationId,
        `Audio Transcription: ${config.operationId}`,
        routingDecision.estimatedCostUsd,
        `Duration: ${durationMinutes} min | Mime: ${config.mimeType || 'audio/wav'}`
      );

      approvalStatus = approval.status;

      if (approval.status === 'rejected') {
        return {
          success: false,
          transcript: `Operation rejected by approval gate. Cost estimate: $${routingDecision.estimatedCostUsd.toFixed(4)}`,
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
            durationMinutes,
          },
        };
      }
    }

    // Step 4: Get model client for routed model
    const modelClient = getModelClientForOperation(routingDecision.model);
    const modelId = getModelIdForRoute(routingDecision.model);

    // Step 5: Execute with routed model (Deepgram API call)
    const message = await modelClient.messages.create({
      model: modelId,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe this audio to text.',
            },
            {
              type: 'audio',
              source: {
                type: 'base64',
                media_type: config.mimeType || 'audio/wav',
                data: config.audioBuffer.toString('base64'),
              },
            },
          ],
        },
      ],
    });

    // Step 6: Extract response
    const transcriptText = message.content[0]?.type === 'text' ? message.content[0].text : '';

    // Step 7: Calculate actual cost
    const outputTokens = message.usage?.output_tokens || Math.ceil(transcriptText.length / 4);
    const totalLatency = Date.now() - startTime;
    const costUsd = router['estimateCost'](
      routingDecision.model,
      estimatedInputTokens,
      outputTokens
    );

    // Step 8: Log operation to cost tracker
    await costTracker.logOperation(config.userId || 'system', {
      operation_type: 'audio_transcription',
      operation_id: config.operationId,
      model_used: routingDecision.model,
      user_id: config.userId,
      input_tokens: estimatedInputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      latency_ms: totalLatency,
      quality_score: 0.88, // Audio transcription quality baseline
      success: true,
    });

    return {
      success: true,
      transcript: transcriptText,
      model: routingDecision.model,
      inputTokens: estimatedInputTokens,
      outputTokens,
      costUsd,
      latencyMs: totalLatency,
      metadata: {
        routed: true,
        requiresApproval: routingDecision.requiresApproval,
        approvalStatus,
        quality_score: 0.88,
        durationMinutes,
      },
    };
  } catch (error) {
    const totalLatency = Date.now() - startTime;

    // Log failure
    console.error('Audio transcription failed:', {
      operationId: config.operationId,
      userId: config.userId,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: totalLatency,
    });

    // Attempt to log the failure to cost tracker
    try {
      await costTracker.logOperation(config.userId || 'system', {
        operation_type: 'audio_transcription',
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
      console.error('Failed to log audio transcription failure:', trackingError);
    }

    throw error;
  }
}

/**
 * Get model client for operation
 * Phase 0.5: Uses Anthropic SDK with Deepgram adapter placeholder
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getModelClientForOperation(_model: string): any {
  // In production Phase 3, this would use actual Deepgram client
  // For now, return a mock client compatible with Anthropic SDK interface
  return {
    messages: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: async (_params: any): Promise<any> => {
        // Placeholder implementation - in production this would call actual Deepgram API
        await Promise.resolve(); // Placeholder await
        return {
          content: [{ type: 'text' as const, text: 'Audio transcription.' }],
          usage: { output_tokens: 100 },
        };
      },
    },
  };
}

/**
 * Get model ID for API calls
 * Phase 0.5: Uses Claude as placeholder for Deepgram
 * Phase 3: Will use actual Deepgram model IDs
 */
function getModelIdForRoute(model: string): string {
  const modelIds: Record<string, string> = {
    deepgram: 'nova-2-general', // Placeholder - Phase 3: actual Deepgram model
    haiku: 'claude-3-5-haiku-20241022',
    sonnet: 'claude-3-5-sonnet-20241022',
    opus: 'claude-opus-4-1-20250805',
  };

  return modelIds[model] || 'claude-3-5-sonnet-20241022';
}

/**
 * Batch transcribe multiple audio files
 */
export async function transcribeBatchAudio(
  configs: AudioTranscriptionConfig[]
): Promise<AudioTranscriptionResult[]> {
  const results: AudioTranscriptionResult[] = [];

  for (const config of configs) {
    try {
      const result = await transcribeAudio(config);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        transcript: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
 * Get total cost for audio operations
 */
export async function getAudioOperationsCost(_userId: string): Promise<{
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
    console.error('Failed to get audio operations cost:', error);
    throw error;
  }
}
