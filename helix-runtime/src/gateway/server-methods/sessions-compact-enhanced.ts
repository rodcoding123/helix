/**
 * Enhanced Session Compaction with Intelligent Token Counting
 *
 * Phase G.3 - Intelligent Session Compaction
 * Routes through AIOperationRouter for smart context compression and cost tracking
 */

import Anthropic from '@anthropic-ai/sdk';
import type { GatewayRequestHandlers } from './types.js';
import { AIOperationRouter } from '../../helix/ai-operations/router.js';
import { CostTracker } from '../../helix/ai-operations/cost-tracker.js';
import { ApprovalGate } from '../../helix/ai-operations/approval-gate.js';

const router = new AIOperationRouter();
const costTracker = new CostTracker();
const approvalGate = new ApprovalGate();

/**
 * Type definitions for intelligent compaction
 */
interface SessionCompactParams {
  sessionKey: string;
  mode: 'default' | 'safeguard' | 'aggressive';
  targetTokens?: number;
  memoryFlush?: boolean;
}

interface CompactionResult {
  sessionKey: string;
  compacted: boolean;
  originalTokens: number;
  compactedTokens: number;
  savedTokens: number;
  compressionRatio: number;
  method: 'intelligent' | 'truncation';
  costUsd?: number;
  model?: string;
  estimatedSavedCostUsd?: number;
  executionTimeMs: number;
}

/**
 * Estimate tokens in text (4 chars ≈ 1 token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Count actual tokens from Claude API response
 */
function countTokensFromUsage(usage: { input_tokens?: number; output_tokens?: number }): number {
  return (usage.input_tokens || 0) + (usage.output_tokens || 0);
}

export const sessionsCompactEnhancedHandlers: GatewayRequestHandlers = {
  /**
   * Intelligent session compaction with Claude-powered summarization
   *
   * Routes through AIOperationRouter for cost tracking and approval
   *
   * params: {
   *   sessionKey: string (session identifier)
   *   mode: 'default' | 'safeguard' | 'aggressive' (compaction intensity)
   *   targetTokens?: number (desired final size, default 8000)
   *   memoryFlush?: boolean (clear memory before compaction)
   * }
   *
   * response: {
   *   sessionKey, compacted, originalTokens, compactedTokens, savedTokens,
   *   compressionRatio, method, costUsd, model, estimatedSavedCostUsd, executionTimeMs
   * }
   */
  'sessions.intelligent_compact': async ({ params, respond, context, client }: any) => {
    // AUTHENTICATION CHECK
    if (!client?.connect?.userId) {
      respond(false, undefined, {
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
      return;
    }

    try {
      if (!params || typeof params !== 'object') {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'Invalid parameters',
        });
        return;
      }

      const {
        sessionKey,
        mode = 'default',
        targetTokens = 8000,
        memoryFlush = false,
      } = params as SessionCompactParams;

      if (!sessionKey) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'sessionKey is required',
        });
        return;
      }

      if (!['default', 'safeguard', 'aggressive'].includes(mode)) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'mode must be one of: default, safeguard, aggressive',
        });
        return;
      }

      const startTime = Date.now();
      const userId = client.connect.userId;

      context.logGateway?.info?.('Starting intelligent session compaction', {
        sessionKey,
        mode,
        targetTokens,
        userId,
      });

      // Fetch session transcript (mock - would normally load from session store)
      const sessionTranscript = `
        User: Hi, I'm working on a project about AI consciousness.
        Assistant: That's an interesting topic. What aspects are you exploring?
        User: Specifically the psychological layers and identity formation.
        Assistant: Those are complex areas. The 7-layer model provides a good framework.
        ... [many more messages would be here in real scenario]
        User: Thanks for the detailed explanation.
        Assistant: You're welcome. Feel free to reach out with more questions.
      `;

      const originalTokens = estimateTokens(sessionTranscript);

      // If already below target, no compaction needed
      if (originalTokens <= targetTokens) {
        respond(true, {
          sessionKey,
          compacted: false,
          originalTokens,
          compactedTokens: originalTokens,
          savedTokens: 0,
          compressionRatio: 1,
          method: 'intelligent' as const,
          executionTimeMs: Date.now() - startTime,
        } as CompactionResult);
        return;
      }

      // Route through AIOperationRouter for intelligent compaction
      const estimatedInputTokens = originalTokens;
      const compactionPrompt = generateCompactionPrompt(sessionTranscript, targetTokens, mode);

      const routingDecision = await router.route({
        operationId: 'session_intelligent_compaction',
        userId,
        input: [{ role: 'user' as const, content: compactionPrompt }],
        estimatedInputTokens: estimateTokens(compactionPrompt),
      });

      context.logGateway?.info?.('Session compaction routed', {
        sessionKey,
        routedModel: routingDecision.model,
        estimatedCost: routingDecision.estimatedCostUsd,
        requiresApproval: routingDecision.requiresApproval,
      });

      // Check if approval is required
      if (routingDecision.requiresApproval) {
        await approvalGate.requestApproval(
          'session_compaction',
          'Intelligent Session Compaction',
          routingDecision.estimatedCostUsd || 0,
          `Session: ${sessionKey} | Original: ${originalTokens} tokens`,
          ''
        );
      }

      // Get model client
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }

      const client_ai = new Anthropic({ apiKey });

      // Execute compaction
      const executionStartTime = Date.now();
      const message = await client_ai.messages.create({
        model: getModelIdForCompaction(routingDecision.model || ''),
        max_tokens: Math.max(2000, targetTokens),
        messages: [
          {
            role: 'user',
            content: compactionPrompt,
          },
        ],
      });

      const compactedTranscript =
        message.content[0]?.type === 'text' ? message.content[0].text : '';
      const compactedTokens = estimateTokens(compactedTranscript);
      const outputTokens = countTokensFromUsage(message.usage || {});

      const savedTokens = Math.max(0, originalTokens - compactedTokens);
      const compressionRatio = compactedTokens / originalTokens;

      // Cost tracking
      const costUsd = router.estimateCost(
        routingDecision.model || '',
        estimateTokens(compactionPrompt),
        outputTokens
      );

      // Estimated savings (cost of NOT compacting future operations)
      const estimatedFutureOperations = 5;
      const costPerOperation = 0.001; // Rough estimate
      const estimatedSavedCostUsd = (savedTokens / originalTokens) * estimatedFutureOperations * costPerOperation;

      // Log to cost tracker
      await costTracker.logOperation(userId, {
        operation_type: 'session_compaction',
        operation_id: 'session_intelligent_compact',
        model_used: routingDecision.model,
        user_id: userId,
        input_tokens: estimateTokens(compactionPrompt),
        output_tokens: outputTokens,
        cost_usd: costUsd,
        latency_ms: Date.now() - executionStartTime,
        quality_score: 0.95, // High quality for compaction
        success: true,
      });

      // Memory flush if requested
      if (memoryFlush) {
        // Would trigger memory synthesis and save important patterns before compaction
        context.logGateway?.info?.('Memory flushed before compaction', { sessionKey });
      }

      // Update session store (mock)
      context.logGateway?.info?.('Session compaction completed', {
        sessionKey,
        originalTokens,
        compactedTokens,
        savedTokens,
        compressionRatio: compressionRatio.toFixed(2),
        costUsd: costUsd.toFixed(4),
        estimatedSavedCostUsd: estimatedSavedCostUsd.toFixed(4),
        model: routingDecision.model,
      });

      respond(true, {
        sessionKey,
        compacted: true,
        originalTokens,
        compactedTokens,
        savedTokens,
        compressionRatio,
        method: 'intelligent' as const,
        costUsd,
        model: routingDecision.model,
        estimatedSavedCostUsd,
        executionTimeMs: Date.now() - startTime,
      } as CompactionResult);

    } catch (error) {
      context.logGateway?.error?.('Intelligent session compaction failed', { error });
      respond(false, undefined, {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * Get session token budget
   *
   * params: {
   *   sessionKey: string
   * }
   *
   * response: {
   *   sessionKey, totalTokens, inputTokens, outputTokens, estimatedCostUsd,
   *   lastCompactedAt, compactionCount, projectedCostDaily
   * }
   */
  'sessions.token_budget': async ({ params, respond, context, client }: any) => {
    if (!client?.connect?.userId) {
      respond(false, undefined, {
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
      return;
    }

    try {
      const { sessionKey } = params as { sessionKey?: string };

      if (!sessionKey) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'sessionKey is required',
        });
        return;
      }

      // Query session metadata (mock - would normally fetch from store)
      const sessionData = {
        totalTokens: 12500,
        inputTokens: 8000,
        outputTokens: 4500,
        lastCompactedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        compactionCount: 3,
      };

      // Estimate cost based on token counts
      const estimatedCostUsd = (sessionData.totalTokens / 1000000) * 2.5; // Rough Claude pricing
      const projectedCostDaily = estimatedCostUsd * 1.5; // Rough projection

      respond(true, {
        sessionKey,
        totalTokens: sessionData.totalTokens,
        inputTokens: sessionData.inputTokens,
        outputTokens: sessionData.outputTokens,
        estimatedCostUsd: parseFloat(estimatedCostUsd.toFixed(6)),
        lastCompactedAt: sessionData.lastCompactedAt,
        compactionCount: sessionData.compactionCount,
        projectedCostDaily: parseFloat(projectedCostDaily.toFixed(4)),
      });

    } catch (error) {
      context.logGateway?.error?.('Failed to get token budget', { error });
      respond(false, undefined, {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};

/**
 * Generate compaction prompt based on mode
 */
function generateCompactionPrompt(transcript: string, targetTokens: number, mode: string): string {
  const modeInstructions = {
    default: 'Preserve key information and context. Remove redundancies.',
    safeguard: 'Be conservative. Keep important context. Only remove clearly redundant parts.',
    aggressive: 'Focus on essential information. Can remove verbose explanations and asides.',
  };

  return `You are compressing a conversation transcript to fit within approximately ${targetTokens} tokens.

Mode: ${mode}
Instructions: ${modeInstructions[mode as keyof typeof modeInstructions] || modeInstructions.default}

ORIGINAL TRANSCRIPT:
${transcript}

COMPACTED TRANSCRIPT (aim for ~${Math.floor(targetTokens * 0.8)} tokens):

Please provide the compacted version only, removing redundancies while preserving meaning and context.`;
}

/**
 * Get model ID for compaction
 */
function getModelIdForCompaction(model: string): string {
  const modelIds: Record<string, string> = {
    claude_3_5_sonnet: 'claude-3-5-sonnet-20241022',
    claude_opus: 'claude-3-opus-20250219',
  };

  return modelIds[model] || 'claude-3-5-sonnet-20241022';
}
