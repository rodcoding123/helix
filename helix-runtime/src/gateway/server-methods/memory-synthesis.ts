import Anthropic from '@anthropic-ai/sdk';
import type { GatewayRequestHandlers } from './types.js';

/**
 * Memory Synthesis Gateway RPC Methods
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

      // Log job start
      context.logGateway.info?.('Memory synthesis job started', {
        jobId: Math.random().toString(36).substring(7),
        synthesisType,
        conversationCount: conversations.length,
        userId: client?.connect?.userId,
      });

      // Prepare prompt
      const conversationsText = conversations
        .map((c) => `[${c.id}] ${c.timestamp}: ${c.text}`)
        .join('\n\n');

      const promptTemplate = SYNTHESIS_PROMPTS[synthesisType as keyof typeof SYNTHESIS_PROMPTS];
      const prompt = promptTemplate.replace('{conversations}', conversationsText);

      // Call Claude API
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
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

      const executionTimeMs = Date.now() - startTime;

      // Log completion
      context.logGateway.info?.('Memory synthesis job completed', {
        synthesisType,
        patternsDetected: (analysis.patterns as Array<unknown>)?.length || 0,
        executionTimeMs,
        userId: client?.connect?.userId,
      });

      respond(true, {
        status: 'completed',
        synthesisType,
        analysis,
        executionTimeMs,
        conversationCount: conversations.length,
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
  'memory.synthesis_status': async ({ params, respond }) => {
    try {
      if (!params || typeof params !== 'object') {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'Invalid parameters',
        });
        return;
      }

      const { jobId } = params as { jobId?: string };

      if (!jobId) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'jobId is required',
        });
        return;
      }

      // TODO: Implement database lookup for job status
      respond(true, {
        jobId,
        status: 'pending',
        progress: 0,
      });

    } catch (error) {
      respond(false, undefined, {
        code: 'LOOKUP_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
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
  'memory.list_patterns': async ({ respond, context, client }) => {
    try {
      // TODO: Implement database query
      context.logGateway.info?.('Listing memory patterns', {
        userId: client?.connect?.userId,
      });

      respond(true, {
        patterns: [],
        total: 0,
      });

    } catch (error) {
      respond(false, undefined, {
        code: 'LIST_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};
