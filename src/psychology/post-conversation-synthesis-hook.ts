/**
 * Post-Conversation Memory Synthesis Hook
 *
 * Triggered after each conversation is stored
 * Orchestrates the memory synthesis pipeline using centralized AIOperationRouter
 *
 * Flow:
 * 1. Load conversation from Supabase
 * 2. Route through AIOperationRouter (handles model selection, cost tracking, approvals)
 * 3. Call routed model to synthesize conversation
 * 4. Parse synthesis results
 * 5. Write results to psychology JSON files
 * 6. Store synthesis insights in Supabase conversation_insights table
 * 7. Log results
 *
 * Theory: Integration of Layers 1-7 through automated learning
 * Uses: Gemini Flash 2 ($0.00005/1K input, $0.00015/1K output)
 */

import { createClient } from '@supabase/supabase-js';
import { AIOperationRouter } from '../helix/ai-operations/router.js';
import { getAnthropicClient, getGeminiClient } from '../helix/ai-operations/providers/index.js';
import { psychologyFileWriter } from './psychology-file-writer.js';

// ============================================================================
// Types
// ============================================================================

export interface ConversationRow {
  id: string;
  user_id: string;
  session_key?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
  title?: string;
  created_at?: string;
  updated_at?: string;
}

interface SynthesisResult {
  patterns: Array<{
    type: string;
    description: string;
    evidence?: string[];
    confidence: number;
    layer?: number;
    recommendations?: string[];
  }>;
  summary?: string;
}

// ============================================================================
// Synthesis Prompt Template
// ============================================================================

const SYNTHESIS_PROMPT_TEMPLATE = `You are analyzing a conversation to extract psychological patterns across 7 layers of consciousness:

Layer 1 (Narrative Core): Life story, meaning-making, identity themes
Layer 2 (Emotional Memory): Emotional patterns, regulation, triggers
Layer 3 (Relational Memory): Relationships, attachments, trust dynamics
Layer 4 (Prospective Self): Goals, aspirations, fears, future identity
Layer 5 (Integration Rhythms): Memory reconsolidation, integration patterns
Layer 6 (Transformation): Change, growth, development
Layer 7 (Purpose): Meaning, ikigai, purpose sources

CONVERSATION:
{messages}

Analyze this conversation and return a JSON response with:
{
  "patterns": [
    {
      "type": "emotional_tag" | "goal_mention" | "meaningful_topic" | "relationship_signal" | "transformation_event",
      "description": "Clear description of the pattern",
      "evidence": ["direct quotes or references from the conversation"],
      "confidence": 0.0-1.0,
      "layer": 1-7
    }
  ],
  "summary": "2-3 sentence summary of the most significant patterns detected"
}

Be concise and focus on meaningful patterns that update Helix's understanding of the user.`;

// ============================================================================
// Hook Handler
// ============================================================================

export class PostConversationSynthesisHook {
  private supabase: ReturnType<typeof createClient>;
  private router: AIOperationRouter;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    this.router = new AIOperationRouter();
  }

  /**
   * Process conversation and run memory synthesis
   * Called after conversation is stored in database
   */
  async processConversation(conversationId: string): Promise<void> {
    try {
      // ==========================================
      // 1. Load conversation from database
      // ==========================================
      const conversation = await this.loadConversation(conversationId);

      if (!conversation) {
        console.warn(`[SYNTHESIS] Conversation not found: ${conversationId}`);
        return;
      }

      // ==========================================
      // 2. Skip trivial conversations
      // ==========================================
      const messageCount = conversation.messages.length;
      const totalLength = conversation.messages.reduce((sum, m) => sum + m.content.length, 0);

      if (messageCount < 3 || totalLength < 500) {
        console.log(`[SYNTHESIS] Skipping trivial conversation: ${conversationId} (${messageCount} messages, ${totalLength} chars)`);
        return;
      }

      // ==========================================
      // 3. Route through AIOperationRouter
      // ==========================================
      const formattedMessages = conversation.messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');

      const prompt = SYNTHESIS_PROMPT_TEMPLATE.replace('{messages}', formattedMessages);

      // Estimate tokens for routing
      const estimatedInputTokens = Math.ceil(prompt.length / 4);

      const routingDecision = await this.router.route({
        operationId: 'memory_synthesis',
        userId: conversation.user_id,
        input: prompt,
        estimatedInputTokens,
      });

      console.log(`[SYNTHESIS] Routed to model: ${routingDecision.model}, cost: $${routingDecision.estimatedCostUsd}`);

      // ==========================================
      // 4. Call routed model for synthesis
      // ==========================================
      const synthesisResult = await this.callRoutedModel(
        routingDecision.model,
        prompt
      );

      if (!synthesisResult) {
        console.warn(`[SYNTHESIS] Model synthesis failed for ${conversationId}`);
        return;
      }

      // ==========================================
      // 5. Store results and apply to psychology files
      // ==========================================
      await this.storeAndApplySynthesis(conversationId, conversation.user_id, synthesisResult);

      // ==========================================
      // 6. Log success
      // ==========================================
      console.log(`[SYNTHESIS] Conversation ${conversationId} synthesized successfully`, {
        patternsDetected: synthesisResult.patterns?.length || 0,
        userId: conversation.user_id,
        cost: routingDecision.estimatedCostUsd,
        model: routingDecision.model,
      });
    } catch (error) {
      console.error(`[SYNTHESIS] Failed to synthesize conversation ${conversationId}:`, error);
      // Don't rethrow - synthesis is optional and shouldn't block chat
    }
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  /**
   * Load conversation from Supabase
   */
  private async loadConversation(conversationId: string): Promise<ConversationRow | null> {
    try {
      const { data, error } = await (this.supabase.from('conversations') as any)
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) {
        console.error('[SYNTHESIS] Failed to load conversation:', error);
        return null;
      }

      return data as ConversationRow;
    } catch (error) {
      console.error('[SYNTHESIS] Error loading conversation:', error);
      return null;
    }
  }

  /**
   * Call routed model (Claude via Anthropic or Gemini via Google SDK)
   */
  private async callRoutedModel(
    model: string,
    prompt: string
  ): Promise<SynthesisResult | null> {
    try {
      let responseText = '';

      // Determine which provider based on model name
      if (model.includes('gemini') || model.includes('flash')) {
        // Use Google Gemini
        responseText = await this.callGemini(model, prompt);
      } else {
        // Use Anthropic Claude (default)
        responseText = await this.callClaude(model, prompt);
      }

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[SYNTHESIS] No JSON found in model response');
        return null;
      }

      const analysis: SynthesisResult = JSON.parse(jsonMatch[0]);
      return analysis;
    } catch (error) {
      console.error('[SYNTHESIS] Model call failed:', error);
      return null;
    }
  }

  /**
   * Call Claude via Anthropic SDK
   */
  private async callClaude(model: string, prompt: string): Promise<string> {
    const client = getAnthropicClient();

    // Map simplified model names to actual Claude models
    const modelMap: Record<string, string> = {
      claude_haiku: 'claude-3-5-haiku-20241022',
      claude_sonnet: 'claude-3-5-sonnet-20241022',
      claude_opus: 'claude-opus-4-1-20250805',
    };

    const actualModel = modelMap[model] || 'claude-3-5-haiku-20241022';

    const response = await client.messages.create({
      model: actualModel,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  }

  /**
   * Call Gemini via Google SDK
   */
  private async callGemini(model: string, prompt: string): Promise<string> {
    const client = getGeminiClient();

    // Map simplified model names to actual Gemini models
    const modelMap: Record<string, string> = {
      gemini_flash: 'gemini-2.0-flash',
      'gemini-flash': 'gemini-2.0-flash',
    };

    const actualModel = modelMap[model] || 'gemini-2.0-flash';

    const generativeModel = client.getGenerativeModel({ model: actualModel });
    const response = await generativeModel.generateContent(prompt);

    return response.response.text();
  }

  /**
   * Store synthesis results and apply to psychology files
   */
  private async storeAndApplySynthesis(
    conversationId: string,
    userId: string,
    synthesis: SynthesisResult
  ): Promise<void> {
    try {
      // Extract patterns by type
      const emotionalTags = synthesis.patterns
        .filter((p) => p.type === 'emotional_tag')
        .map((p) => p.description);

      const goals = synthesis.patterns
        .filter((p) => p.type === 'goal_mention')
        .map((p) => p.description);

      const topics = synthesis.patterns
        .filter((p) => p.type === 'meaningful_topic')
        .map((p) => p.description);

      // ==========================================
      // Update psychology files
      // ==========================================
      if (emotionalTags.length > 0) {
        await psychologyFileWriter.updateEmotionalTags(emotionalTags);
      }

      if (goals.length > 0) {
        await psychologyFileWriter.updateGoals(goals);
      }

      if (topics.length > 0) {
        await psychologyFileWriter.updateMeaningfulTopics(topics);
      }

      // ==========================================
      // Store synthesis insights in Supabase
      // ==========================================
      const { error } = await (this.supabase.from('conversation_insights') as any).insert({
        conversation_id: conversationId,
        user_id: userId,
        emotional_tags: emotionalTags,
        goals: goals,
        meaningful_topics: topics,
        patterns_json: JSON.stringify(synthesis.patterns),
        synthesis_summary: synthesis.summary || null,
        synthesized_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      // ==========================================
      // Update conversation record with synthesis flag
      // ==========================================
      await (this.supabase.from('conversations') as any)
        .update({
          synthesized_at: new Date().toISOString(),
          synthesis_insights: synthesis.summary,
        })
        .eq('id', conversationId);
    } catch (error) {
      console.error('[SYNTHESIS] Failed to store synthesis results:', error);
      throw error;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const postConversationSynthesisHook = new PostConversationSynthesisHook();

// ============================================================================
// Realtime Subscription (For Live Processing)
// ============================================================================

/**
 * Subscribe to new conversations and process synthesis automatically
 * Called during Helix initialization
 */
export function subscribeToConversationSynthesis(): void {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  void supabase
    .channel('conversations_synthesis')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
      },
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (payload: Record<string, unknown>) => {
        try {
          const newRecord = (payload as { new?: { id?: string } }).new;
          const conversationId = newRecord?.id as string;
          console.log(`[SYNTHESIS] New conversation detected: ${conversationId}`);

          // Process synthesis asynchronously (don't wait)
          await postConversationSynthesisHook.processConversation(conversationId).catch((error) => {
            console.error(`[SYNTHESIS] Failed to synthesize in realtime: ${conversationId}`, error);
          });
        } catch (error) {
          console.error('[SYNTHESIS] Error in realtime subscription:', error);
        }
      }
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log('[SYNTHESIS] Realtime subscription active');
      } else if (status === 'CLOSED') {
        console.warn('[SYNTHESIS] Realtime subscription closed');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[SYNTHESIS] Realtime subscription error');
      }
    });
}

/**
 * Unsubscribe from realtime synthesis
 */
export async function unsubscribeFromConversationSynthesis(): Promise<void> {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const channels = supabase.getChannels();
  const synthesisChannel = channels.find((c: any) => c.name === 'conversations_synthesis');
  if (synthesisChannel) {
    await supabase.removeChannel(synthesisChannel);
  }
}

// ============================================================================
// Batch Processing (For Catchup)
// ============================================================================

/**
 * Process all conversations since a certain time
 * Useful for catching up on conversations stored before synthesis was live
 */
export async function batchProcessConversationSynthesis(
  sinceTimestamp: string,
  batchSize: number = 50
): Promise<{ processed: number; failed: number }> {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  let processed = 0;
  let failed = 0;
  let offset = 0;

  try {
    while (true) {
      // Fetch batch of conversations
      const { data: conversations, error } = await (supabase.from('conversations') as any)
        .select('id')
        .gt('created_at', sinceTimestamp)
        .is('synthesized_at', null) // Only process non-synthesized
        .order('created_at', { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) {
        throw error;
      }

      if (!conversations || conversations.length === 0) {
        break; // No more conversations
      }

      // Process each conversation
      for (const conv of conversations) {
        const convRecord = conv as { id: string };
        try {
          await postConversationSynthesisHook.processConversation(convRecord.id);
          processed++;
        } catch (error) {
          console.error(`[SYNTHESIS] Failed to synthesize ${convRecord.id}:`, error);
          failed++;
        }
      }

      offset += batchSize;

      // Log progress
      console.log(
        `[SYNTHESIS] Batch processed: ${processed} succeeded, ${failed} failed, offset: ${offset}`
      );

      // Give the system a break between batches
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { processed, failed };
  } catch (error) {
    console.error('[SYNTHESIS] Batch processing failed:', error);
    throw error;
  }
}
