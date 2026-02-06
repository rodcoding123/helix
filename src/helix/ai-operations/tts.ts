/**
 * Text-to-Speech Operations - Phase 0.5
 *
 * Centralized text-to-speech with routing, cost tracking, and approval gates.
 * Handles speech synthesis through TTS API with centralized routing.
 *
 * Note: ESLint exceptions used for staging. Supabase types will be properly generated in production.
 */

import { router } from './router.js';
import { costTracker } from './cost-tracker.js';
import { approvalGate } from './approval-gate.js';

/**
 * Text-to-speech configuration
 */
export interface TextToSpeechConfig {
  operationId: string;
  userId?: string;
  text: string;
  voice?: string;
  language?: string;
  speed?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Text-to-speech result
 */
export interface TextToSpeechResult {
  success: boolean;
  audioUrl: string;
  audioBuffer?: Buffer;
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
    durationSeconds?: number;
  };
}

/**
 * Synthesize text to speech with centralized routing and cost tracking
 *
 * Pattern: Estimate Tokens → Route → Approve → Execute → Track Cost
 */
export async function synthesizeToSpeech(config: TextToSpeechConfig): Promise<TextToSpeechResult> {
  const startTime = Date.now();

  try {
    // Step 1: Estimate tokens for routing decision
    // TTS token estimation: text_length/4 + estimated_output_duration_seconds (500ms default per 100 chars) / 60 * 100
    const textLength = config.text.length;
    const estimatedDurationSeconds = Math.ceil((textLength / 100) * 0.5); // 0.5 seconds per 100 chars
    const estimatedInputTokens = Math.ceil(textLength / 4);
    const estimatedOutputTokens = Math.ceil((estimatedDurationSeconds * 100) / 60); // 100 tokens per minute of audio

    // Step 2: Route through centralized router
    const routingDecision = await router.route({
      operationId: config.operationId,
      userId: config.userId,
      input: [{ role: 'user' as const, content: 'Synthesize text to speech' }],
      estimatedInputTokens: estimatedInputTokens + estimatedOutputTokens,
    });

    // Step 3: Check if approval is required (HIGH criticality operations)
    let approvalStatus: 'pending' | 'approved' | 'rejected' = 'approved';

    if (routingDecision.requiresApproval) {
      const approval = await approvalGate.requestApproval(
        config.operationId,
        `Text-to-Speech: ${config.operationId}`,
        routingDecision.estimatedCostUsd,
        `Text: ${config.text.substring(0, 50)}... | Voice: ${config.voice || 'default'}`
      );

      approvalStatus = approval.status;

      if (approval.status === 'rejected') {
        return {
          success: false,
          audioUrl: '',
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
            durationSeconds: 0,
          },
        };
      }
    }

    // Step 4: Get model client for routed model
    const modelClient = getModelClientForOperation(routingDecision.model);
    const modelId = getModelIdForRoute(routingDecision.model);

    // Step 5: Execute with routed model (TTS API call)
    const message = await modelClient.messages.create({
      model: modelId,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Convert this text to speech: "${config.text}"`,
        },
      ],
    });

    // Step 6: Extract response
    const audioUrl = message.content[0]?.type === 'text' ? message.content[0].text : '';

    // Step 7: Calculate actual cost
    const outputTokens = message.usage?.output_tokens || estimatedOutputTokens;
    const totalLatency = Date.now() - startTime;
    const costUsd = router['estimateCost'](
      routingDecision.model,
      estimatedInputTokens,
      outputTokens
    );

    // Step 8: Log operation to cost tracker
    await costTracker.logOperation(config.userId || 'system', {
      operation_type: 'text_to_speech',
      operation_id: config.operationId,
      model_used: routingDecision.model,
      user_id: config.userId,
      input_tokens: estimatedInputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      latency_ms: totalLatency,
      quality_score: 0.85, // TTS quality baseline
      success: true,
    });

    return {
      success: true,
      audioUrl,
      model: routingDecision.model,
      inputTokens: estimatedInputTokens,
      outputTokens,
      costUsd,
      latencyMs: totalLatency,
      metadata: {
        routed: true,
        requiresApproval: routingDecision.requiresApproval,
        approvalStatus,
        quality_score: 0.85,
        durationSeconds: estimatedDurationSeconds,
      },
    };
  } catch (error) {
    const totalLatency = Date.now() - startTime;

    // Log failure
    console.error('Text-to-speech synthesis failed:', {
      operationId: config.operationId,
      userId: config.userId,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: totalLatency,
    });

    // Attempt to log the failure to cost tracker
    try {
      await costTracker.logOperation(config.userId || 'system', {
        operation_type: 'text_to_speech',
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
    } catch (_trackingError) {
      console.error('Failed to log text-to-speech synthesis failure:', _trackingError);
    }

    throw error;
  }
}

/**
 * Get model client for operation
 * Phase 0.5: Uses Anthropic SDK with TTS adapter placeholder
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
  // In production Phase 3, this would use actual TTS client (ElevenLabs, Google Cloud TTS, etc.)
  // For now, return a mock client compatible with Anthropic SDK interface
  return {
    messages: {
      create: async (_params: Record<string, unknown>): Promise<ModelClientResponse> => {
        // Placeholder implementation - in production this would call actual TTS API
        await Promise.resolve(); // Placeholder await
        return {
          content: [{ type: 'text' as const, text: 'https://example.com/audio.mp3' }],
          usage: { output_tokens: 100 },
        };
      },
    },
  };
}

/**
 * Get model ID for API calls
 * Phase 0.5: Uses Claude as placeholder for TTS
 * Phase 3: Will use actual TTS model IDs (ElevenLabs, Google Cloud, etc.)
 */
function getModelIdForRoute(model: string): string {
  const modelIds: Record<string, string> = {
    elevenlabs: 'eleven_monolingual_v1', // Placeholder - Phase 3: actual ElevenLabs model
    google_tts: 'google-cloud-text-to-speech-v1', // Placeholder - Phase 3: actual Google TTS model
    azure_tts: 'azure-speech-synthesis-v1', // Placeholder - Phase 3: actual Azure TTS model
    haiku: 'claude-3-5-haiku-20241022',
    sonnet: 'claude-3-5-sonnet-20241022',
    opus: 'claude-opus-4-1-20250805',
  };

  return modelIds[model] || 'claude-3-5-sonnet-20241022';
}

/**
 * Batch synthesize multiple texts to speech
 */
export async function synthesizeBatchToSpeech(
  configs: TextToSpeechConfig[]
): Promise<TextToSpeechResult[]> {
  const results: TextToSpeechResult[] = [];

  for (const config of configs) {
    try {
      const result = await synthesizeToSpeech(config);
      results.push(result);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      results.push({
        success: false,
        audioUrl: '',
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
 * Get total cost for TTS operations
 */
export async function getTextToSpeechOperationsCost(_userId: string): Promise<{
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
    console.error('Failed to get text-to-speech operations cost:', error);
    throw error;
  }
}
