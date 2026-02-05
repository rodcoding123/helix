import Anthropic from '@anthropic-ai/sdk';
import { router } from '../../../../src/helix/ai-operations/router.js';
import { costTracker } from '../../../../src/helix/ai-operations/cost-tracker.js';
import { approvalGate } from '../../../../src/helix/ai-operations/approval-gate.js';
import type { GatewayRequestHandlers } from './types.js';

/**
 * Type definitions for memory synthesis handlers
 */
interface MemoryListPatternsParams {
  layer?: number;
  patternType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Memory Synthesis Gateway RPC Methods
 *
 * Phase 0.5 Migration: Uses centralized AI operations router for model selection
 * and cost tracking instead of hardcoded Claude model.
 *
 * Phase 3 feature: Uses Claude API to analyze conversation history and detect
 * psychological patterns across the 7-layer architecture (emotional, relational,
 * prospective self, narrative, transformation, purpose).
 */

// Synthesis prompts for different analysis types
const SYNTHESIS_PROMPTS = {
  emotional_patterns: `You are analyzing conversation history to detect emotional patterns and triggers.

Analyze the following conversations and identify:
1. Primary emotional triggers (what topics cause strong reactions)
2. Emotional regulation patterns (how does the user typically respond to stress)
3. Emotional intensity variations over time
4. Connection between topics and emotional states

Conversations:
{conversations}

Return a JSON object with:
{
  "patterns": [
    {
      "type": "emotional_trigger|emotional_regulation|intensity_pattern|topic_connection",
      "description": "Clear description of the pattern",
      "evidence": ["conversation IDs supporting this pattern"],
      "confidence": 0.0-1.0,
      "recommendations": ["actionable suggestions based on pattern"]
    }
  ],
  "summary": "Overall emotional profile",
  "lastUpdated": "ISO timestamp"
}`,

  prospective_self: `You are analyzing goals, aspirations, fears, and self-concepts from conversations.

Analyze the following conversations and identify:
1. Stated goals and aspirations
2. Feared outcomes and anxieties
3. Possible selves (who the user wants to become)
4. Obstacles the user perceives
5. Values and priorities

Conversations:
{conversations}

Return a JSON object with:
{
  "patterns": [
    {
      "type": "goal|aspiration|fear|possible_self|value",
      "description": "Clear description",
      "evidence": ["conversation IDs"],
      "confidence": 0.0-1.0,
      "layer": 4
    }
  ],
  "identity_coherence": "Assessment of consistency in self-concept",
  "recommendations": ["suggestions for goal clarification or alignment"]
}`,

  relational_memory: `You are analyzing relationship patterns and attachment dynamics from conversations.

Analyze the following conversations and identify:
1. Important relationships mentioned
2. Attachment patterns (secure, anxious, avoidant)
3. Trust dynamics
4. Conflict patterns
5. Support systems

Conversations:
{conversations}

Return a JSON object with:
{
  "patterns": [
    {
      "type": "relationship|attachment|trust|conflict|support",
      "description": "Clear description",
      "subjects": ["people or groups involved"],
      "evidence": ["conversation IDs"],
      "confidence": 0.0-1.0,
      "layer": 3
    }
  ],
  "summary": "Overall relational profile",
  "recommendations": ["relational growth suggestions"]
}`,

  narrative_coherence: `You are analyzing the user's life narrative and sense-making patterns.

Analyze the following conversations and identify:
1. Key life themes and narratives
2. How the user makes sense of experiences
3. Narrative consistency or conflicts
4. Growth and transformation themes
5. Identity development over time

Conversations:
{conversations}

Return a JSON object with:
{
  "patterns": [
    {
      "type": "narrative_theme|sense_making|identity_development|growth_theme",
      "description": "Clear description",
      "evidence": ["conversation IDs"],
      "confidence": 0.0-1.0,
      "layer": 1
    }
  ],
  "coherence_assessment": "Is the narrative coherent and integrated?",
  "recommendations": ["suggestions for narrative integration"]
}`,

  full_synthesis: `You are performing a comprehensive analysis of psychological layers.

Analyze conversations across ALL layers:
1. Layer 1 (Narrative Core): Life story and meaning-making
2. Layer 2 (Emotional Memory): Emotional patterns and regulation
3. Layer 3 (Relational Memory): Relationships and attachments
4. Layer 4 (Prospective Self): Goals and future identity
5. Layer 5 (Integration Rhythms): Memory reconsolidation patterns
6. Layer 6 (Transformation): Change and growth patterns
7. Layer 7 (Purpose): Meaning and ikigai

Conversations:
{conversations}

Return a comprehensive JSON object with patterns across all layers and integration recommendations.`,
};

export const memorySynthesisHandlers: GatewayRequestHandlers = {
  /**
   * Run memory synthesis job
   *
   * params: {
   *   synthesisType: 'emotional_patterns' | 'prospective_self' | 'relational_memory' | 'narrative_coherence' | 'full_synthesis'
   *   conversations: Array<{id, text, timestamp}> (conversation data to analyze)
   *   timeRange?: {start: string, end: string} (ISO timestamps for filtering)
   * }
   *
   * response: {
   *   jobId: string
   *   status: 'completed' | 'running' | 'failed'
   *   patterns: Array<{type, description, evidence, confidence, recommendations, layer}>
   *   summary: string
   *   executionTimeMs: number
   *   error?: string
   * }
   */
  'memory.synthesize': async ({ params, respond, context, client }) => {
    // AUTHENTICATION CHECK FIRST
    if (!client?.connect?.userId) {
      respond(false, undefined, {
        code: 'UNAUTHORIZED',
        message: 'User not authenticated'
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

      const { synthesisType, conversations } = params as {
        synthesisType?: string;
        conversations?: Array<{ id: string; text: string; timestamp: string }>;
      };

      if (!synthesisType || !Object.keys(SYNTHESIS_PROMPTS).includes(synthesisType)) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: `Invalid synthesisType. Must be one of: ${Object.keys(SYNTHESIS_PROMPTS).join(', ')}`,
        });
        return;
      }

      if (!conversations || !Array.isArray(conversations) || conversations.length === 0) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'conversations array is required and must not be empty',
        });
        return;
      }

      const startTime = Date.now();
      const jobId = Math.random().toString(36).substring(7);
      const userId = client?.connect?.userId;

      // Log job start
      context.logGateway.info?.('Memory synthesis job started', {
        jobId,
        synthesisType,
        conversationCount: conversations.length,
        userId,
      });

      // Prepare prompt
      const conversationsText = conversations
        .map((c) => `[${c.id}] ${c.timestamp}: ${c.text}`)
        .join('\n\n');

      const promptTemplate = SYNTHESIS_PROMPTS[synthesisType as keyof typeof SYNTHESIS_PROMPTS];
      const prompt = promptTemplate.replace('{conversations}', conversationsText);

      // Phase 0.5: Route through centralized router
      const estimatedInputTokens = Math.ceil((prompt.length + conversationsText.length) / 4);

      const routingDecision = await router.route({
        operationId: 'memory_synthesis',
        userId,
        input: [{ role: 'user' as const, content: prompt }],
        estimatedInputTokens,
      });

      context.logGateway.info?.('Memory synthesis routed', {
        jobId,
        routedModel: routingDecision.model,
        estimatedCost: routingDecision.estimatedCostUsd,
        requiresApproval: routingDecision.requiresApproval,
      });

      // Check if approval is required
      if (routingDecision.requiresApproval) {
        await approvalGate.requestApproval(
          'memory_synthesis',
          'Memory Synthesis',
          routingDecision.estimatedCostUsd,
          `Synthesis Type: ${synthesisType} | Conversations: ${conversations.length}`
        );
      }

      // Get the model client based on routing decision
      const modelToUse = getModelClientForOperation(routingDecision.model);

      if (!modelToUse) {
        throw new Error(`Model client not available: ${routingDecision.model}`);
      }

      // Execute with routed model
      const executionStartTime = Date.now();
      const message = await modelToUse.messages.create({
        model: getModelIdForRoute(routingDecision.model),
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Parse response
      const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';

      let analysis: Record<string, unknown>;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { patterns: [] };
      } catch (error) {
        context.logGateway.error?.('Failed to parse Claude response as JSON', {
          error: error instanceof Error ? error.message : String(error),
        });
        analysis = { patterns: [], rawResponse: responseText };
      }

      // Phase 0.5: Cost tracking
      const outputTokens = message.usage?.output_tokens || Math.ceil(responseText.length / 4);
      const totalLatency = Date.now() - startTime;
      const costUsd = router.estimateCost(routingDecision.model, estimatedInputTokens, outputTokens);

      // Log the operation to cost tracker
      await costTracker.logOperation(userId || 'system', {
        operation_type: 'memory_synthesis',
        operation_id: 'memory_synthesis',
        model_used: routingDecision.model,
        user_id: userId,
        input_tokens: estimatedInputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        latency_ms: totalLatency,
        quality_score: 0.90, // Base quality for synthesis
        success: true,
      });

      // Log completion
      context.logGateway.info?.('Memory synthesis job completed', {
        jobId,
        synthesisType,
        model: routingDecision.model,
        cost: costUsd,
        patternsDetected: (analysis.patterns as Array<unknown>)?.length || 0,
        executionTimeMs: totalLatency,
        userId,
      });

      respond(true, {
        status: 'completed',
        synthesisType,
        analysis,
        executionTimeMs: totalLatency,
        conversationCount: conversations.length,
        cost: costUsd,
        model: routingDecision.model,
      });

    } catch (error) {
      context.logGateway.error?.('Memory synthesis execution failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: client?.connect?.userId,
      });

      respond(false, undefined, {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * Get synthesis job status
   *
   * params: {
   *   jobId: string
   * }
   *
   * response: {
   *   jobId: string
   *   status: 'pending' | 'running' | 'completed' | 'failed'
   *   progress: 0-1
   *   error?: string
   * }
   */
  'memory.synthesis_status': async ({ params, respond, context, client }) => {
    const { jobId } = params;

    if (!client?.connect?.userId) {
      respond(false, undefined, { code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    try {
      // Query database for job status
      const { data: job, error } = await context.supabaseClient
        .from('memory_synthesis_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', client.connect.userId)
        .single();

      if (error || !job) {
        respond(false, undefined, { code: 'NOT_FOUND', message: 'Job not found' });
        return;
      }

      respond(true, {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        insights: job.insights,
        startedAt: job.created_at,
        completedAt: job.updated_at,
      });
    } catch (error) {
      context.logGateway.error?.('Failed to fetch synthesis job status', { error, jobId });
      respond(false, undefined, { code: 'INTERNAL_ERROR', message: 'Failed to fetch job status' });
    }
  },

  /**
   * Error handler for synthesis failures
   */
  'memory.synthesize_error': async ({ params, respond, context, client }) => {
    try {
      const { jobId, error } = params as { jobId?: string; error?: string };

      context.logGateway.error?.('Memory synthesis error logged', {
        jobId,
        error,
        userId: client?.connect?.userId,
      });

      respond(true, { acknowledged: true });
    } catch (err) {
      respond(false, undefined, {
        code: 'ERROR_LOG_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  },

  /**
   * List memory patterns
   *
   * params: {
   *   layer?: number (1-7, specific layer to query)
   *   patternType?: string (specific pattern type to filter)
   * }
   *
   * response: {
   *   patterns: Array<{
   *     id: string
   *     type: string
   *     layer: number
   *     description: string
   *     confidence: number
   *     firstDetected: string (ISO)
   *     observationCount: number
   *   }>
   * }
   */
  'memory.list_patterns': async ({ params, respond, context, client }) => {
    const { layer, patternType, limit = 50, offset = 0 } =
      (params as MemoryListPatternsParams) || {};

    if (!client?.connect?.userId) {
      respond(false, undefined, { code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    // Validate pagination limits
    if (limit < 1 || limit > 100) {
      respond(false, undefined, {
        code: 'INVALID_REQUEST',
        message: 'limit must be between 1 and 100'
      });
      return;
    }

    if (offset < 0) {
      respond(false, undefined, {
        code: 'INVALID_REQUEST',
        message: 'offset must be >= 0'
      });
      return;
    }

    try {
      // Build query with optional filters
      let query = context.supabaseClient
        .from('memory_patterns')
        .select('*', { count: 'exact' })
        .eq('user_id', client.connect.userId)
        .order('confidence', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (layer !== undefined) {
        query = query.eq('layer', layer);
      }

      if (patternType) {
        query = query.eq('pattern_type', patternType);
      }

      const { data: patterns, error, count } = await query;

      if (error) {
        throw error;
      }

      context.logGateway.info?.('Listed memory patterns', {
        userId: client.connect.userId,
        layer,
        patternType,
        count: patterns?.length || 0,
      });

      respond(true, {
        patterns: patterns || [],
        total: count || 0,
        limit,
        offset,
      });
    } catch (error) {
      context.logGateway.error?.('Failed to list memory patterns', { error });
      respond(false, undefined, { code: 'INTERNAL_ERROR', message: 'Failed to list patterns' });
    }
  },
};

/**
 * Get the model client for the routed model
 * Phase 0.5: This abstracts model client selection from business logic
 */
function getModelClientForOperation(_model: string): Anthropic {
  // Load API key once using encrypted cache pattern
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // For now, all models use Anthropic client
  // In future: route to different providers (DeepSeek, Gemini)
  return new Anthropic({ apiKey });
}

/**
 * Get the full model ID for API calls
 * Phase 0.5: This maps model names to actual API model IDs
 */
function getModelIdForRoute(model: string): string {
  const modelIds: Record<string, string> = {
    deepseek: 'claude-3-5-sonnet-20241022', // Placeholder - would use actual DeepSeek when available
    gemini_flash: 'claude-3-5-sonnet-20241022', // Placeholder
    openai: 'claude-3-5-sonnet-20241022', // Placeholder
  };

  return modelIds[model] || 'claude-3-5-sonnet-20241022';
}
