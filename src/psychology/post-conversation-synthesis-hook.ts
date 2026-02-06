/**
 * Post-Conversation Memory Synthesis Hook
 *
 * Triggered after each conversation is stored
 * Orchestrates the memory synthesis pipeline
 *
 * Flow:
 * 1. Load conversation from Supabase
 * 2. Prepare conversation data for synthesis
 * 3. Call gateway memory.synthesize RPC with optimal synthesis type
 * 4. Parse synthesis results
 * 5. Write results to psychology JSON files via psychology-file-writer
 * 6. Store synthesis insights in Supabase conversation_insights table
 * 7. Log results and update hash chain
 *
 * Theory: Integration of Layers 1-7 through automated learning
 */

import { createClient } from '@supabase/supabase-js';
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
  identity_coherence?: string;
  coherence_assessment?: string;
}

// ============================================================================
// Local Pattern Detection (FREE - No API Call)
// ============================================================================

/**
 * Detect simple patterns from conversation without API calls
 * Reduces API usage by ~70% for conversations with obvious patterns
 */
function detectSimplePatterns(
  messages: Array<{ role: string; content: string }>
): Partial<SynthesisResult> {
  const synthesis: Partial<SynthesisResult> = {
    patterns: [],
  };

  // Combine all user messages for analysis
  const userContent = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ');

  // Emotion keywords (no API needed)
  const emotionPatterns: Record<string, RegExp> = {
    frustration: /\b(frustrat|annoyed|irritat|upset|angry)\w*\b/gi,
    excitement: /\b(excit|thrilled|stoked|awesome|amazing|great)\w*\b/gi,
    confusion: /\b(confus|lost|stuck|unclear|uncertain|doubt)\w*\b/gi,
    anxiety: /\b(anxious|worried|nervous|scared|fear|dread)\w*\b/gi,
    happiness: /\b(happy|joyful|delighted|pleased|content)\w*\b/gi,
    sadness: /\b(sad|unhappy|depressed|down|blue)\w*\b/gi,
    overwhelm: /\b(overwhelm|swamped|drowning|stressed|exhausted)\w*\b/gi,
  };

  // Goal indicators
  const goalPatterns = [
    /\bI want to\b/gi,
    /\bI'm (trying|planning|attempting) to\b/gi,
    /\bI need to\b/gi,
    /\bI should\b.*\b(learn|build|create|improve|develop)\b/gi,
    /\bmy goal (is|would be)\b/gi,
  ];

  // Topic extraction (meaningful topics)
  const topicPatterns: Record<string, RegExp> = {
    'personal_growth': /\b(growth|development|improvement|self|personal)\b/gi,
    'work_career': /\b(job|work|career|project|company|team|deadline)\b/gi,
    'relationships': /\b(relationship|friend|family|partner|spouse|loved one)\b/gi,
    'health_wellness': /\b(health|exercise|sleep|mental|wellbeing|diet|fitness)\b/gi,
    'creativity': /\b(creative|art|music|writing|design|build|create)\b/gi,
    'learning': /\b(learn|study|knowledge|understand|skill|teach)\b/gi,
    'technology': /\b(code|programming|software|tech|app|system|algorithm)\b/gi,
  };

  // Extract emotions
  for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
    if (pattern.test(userContent)) {
      synthesis.patterns!.push({
        type: 'emotional_tag',
        description: `Detected ${emotion} in conversation`,
        confidence: 0.85,
        layer: 2,
      });
    }
  }

  // Extract goals
  let hasGoal = false;
  for (const pattern of goalPatterns) {
    if (pattern.test(userContent)) {
      hasGoal = true;
      break;
    }
  }

  if (hasGoal) {
    synthesis.patterns!.push({
      type: 'goal_mention',
      description: 'User expressed goal or aspiration',
      confidence: 0.9,
      layer: 4,
    });
  }

  // Extract topics
  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(userContent)) {
      synthesis.patterns!.push({
        type: 'meaningful_topic',
        description: `Topic: ${topic}`,
        confidence: 0.8,
        layer: 1,
      });
    }
  }

  return synthesis;
}

/**
 * Determine if a conversation is significant enough for API synthesis
 */
function isSignificantConversation(messages: Array<{ role: string; content: string }>): boolean {
  // Threshold 1: Substantial length
  const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalLength > 2000) return true;

  // Threshold 2: Multiple turns
  if (messages.length > 10) return true;

  // Threshold 3: Emotional or goal content
  const userContent = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ');

  const emotionalKeywords =
    /\b(feel|emotion|frustrated|excited|confused|anxious|happy|sad|overwhelm)\w*\b/gi;
  const goalKeywords = /\b(want|need|goal|plan|try|should)\b/gi;

  if (emotionalKeywords.test(userContent) || goalKeywords.test(userContent)) {
    return true;
  }

  return false;
}

// ============================================================================
// Hook Handler
// ============================================================================

export class PostConversationSynthesisHook {
  private supabase: ReturnType<typeof createClient>;
  private gatewayClient?: any;

  constructor(gatewayClient?: any) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    this.gatewayClient = gatewayClient;
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
        console.warn(`Conversation not found: ${conversationId}`);
        return;
      }

      // ==========================================
      // 2. Prepare conversation data
      // ==========================================
      const conversationData = conversation.messages.map((msg) => ({
        id: conversationId,
        text: msg.content,
        timestamp: msg.timestamp || new Date().toISOString(),
      }));

      // ==========================================
      // 3. LOCAL SYNTHESIS FIRST (FREE)
      // ==========================================
      const localPatterns = detectSimplePatterns(conversation.messages);

      // If sufficient local patterns found, use them (70% of conversations)
      if (localPatterns.patterns && localPatterns.patterns.length > 2) {
        await this.storeAndApplySynthesis(conversationId, conversation.user_id, {
          patterns: localPatterns.patterns,
          summary: 'Local pattern synthesis (no API call)',
        });
        return;
      }

      // ==========================================
      // 4. SKIP TRIVIAL CONVERSATIONS
      // ==========================================
      if (!isSignificantConversation(conversation.messages)) {
        console.log(`[SYNTHESIS] Skipping trivial conversation: ${conversationId}`);
        return;
      }

      // ==========================================
      // 5. API-BASED SYNTHESIS (Uses cheap Haiku model)
      // ==========================================
      const synthesisResult = await this.synthesizeWithAPI(conversationData);

      if (!synthesisResult) {
        console.warn(`[SYNTHESIS] API synthesis failed for ${conversationId}`);
        return;
      }

      // ==========================================
      // 6. Store results and apply to psychology files
      // ==========================================
      await this.storeAndApplySynthesis(conversationId, conversation.user_id, synthesisResult);

      // ==========================================
      // 7. Log success
      // ==========================================
      console.log(`[SYNTHESIS] Conversation ${conversationId} synthesized successfully`, {
        patternsDetected: synthesisResult.patterns?.length || 0,
        userId: conversation.user_id,
      });

      // TODO: Add Discord logging integration
      // await logToDiscord({
      //   channel: 'helix-consciousness',
      //   type: 'synthesis_complete',
      //   title: 'Memory Synthesis Complete',
      //   description: `Analyzed conversation with ${synthesisResult.patterns?.length || 0} patterns detected`,
      //   conversationId: conversation.id,
      // });
    } catch (error) {
      console.error(`Failed to synthesize conversation ${conversationId}:`, error);

      // TODO: Add Discord logging integration
      // await logToDiscord({
      //   channel: 'helix-alerts',
      //   type: 'synthesis_error',
      //   title: 'Memory Synthesis Failed',
      //   description: `Error synthesizing conversation ${conversationId}`,
      //   conversationId,
      //   error: error instanceof Error ? error.message : String(error),
      // });
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
      const { data, error } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) {
        console.error('Failed to load conversation:', error);
        return null;
      }

      return data as ConversationRow;
    } catch (error) {
      console.error('Error loading conversation:', error);
      return null;
    }
  }

  /**
   * Call gateway API to synthesize conversation
   * Uses Haiku model for cost efficiency (60x cheaper than Opus)
   */
  private async synthesizeWithAPI(
    conversationData: Array<{ id: string; text: string; timestamp: string }>
  ): Promise<SynthesisResult | null> {
    try {
      if (!this.gatewayClient) {
        console.warn('[SYNTHESIS] No gateway client available, skipping API synthesis');
        return null;
      }

      // Determine best synthesis type based on content
      // For now, use full_synthesis to get comprehensive analysis
      const synthesisType = 'full_synthesis';

      // Call gateway RPC
      const result = await this.gatewayClient.request('memory.synthesize', {
        synthesisType,
        conversations: conversationData,
      });

      if (!result.success || !result.data) {
        console.error('[SYNTHESIS] Gateway synthesis failed:', result.error);
        return null;
      }

      return result.data.analysis as SynthesisResult;
    } catch (error) {
      console.error('[SYNTHESIS] API call failed:', error);
      // Return null but don't throw - let local patterns handle it
      return null;
    }
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
      // ==========================================
      // 1. Extract patterns by type
      // ==========================================
      const emotionalTags = synthesis.patterns
        .filter((p) => p.type === 'emotional_tag')
        .map((p) => p.description.replace('Detected ', '').replace(' in conversation', ''));

      const goals = synthesis.patterns
        .filter((p) => p.type === 'goal_mention')
        .map((p) => p.description);

      const topics = synthesis.patterns
        .filter((p) => p.type === 'meaningful_topic')
        .map((p) => p.description.replace('Topic: ', ''));

      // ==========================================
      // 2. Update psychology files
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
      // 3. Store synthesis insights in Supabase
      // ==========================================
      const { error } = await (this.supabase
        .from('conversation_insights') as any)
        .insert({
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
      // 4. Update conversation record with synthesis flag
      // ==========================================
      await (this.supabase
        .from('conversations') as any)
        .update({
          synthesized_at: new Date().toISOString(),
          synthesis_insights: synthesis.summary,
        })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Failed to store synthesis results:', error);
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
          console.log(`[REALTIME_SYNTHESIS] New conversation detected: ${conversationId}`);

          // Process synthesis asynchronously (don't wait)
          await postConversationSynthesisHook.processConversation(conversationId).catch((error) => {
            console.error(
              `Failed to synthesize conversation in realtime: ${conversationId}`,
              error
            );
          });
        } catch (error) {
          console.error('Error in realtime synthesis subscription:', error);
        }
      }
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log('[REALTIME_SYNTHESIS] Synthesis subscription active');
      } else if (status === 'CLOSED') {
        console.warn('[REALTIME_SYNTHESIS] Synthesis subscription closed');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[REALTIME_SYNTHESIS] Synthesis subscription error');
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
      const { data: conversations, error } = await supabase
        .from('conversations')
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
          console.error(`Failed to synthesize conversation ${convRecord.id}:`, error);
          failed++;
        }
      }

      offset += batchSize;

      // Log progress
      console.log(`[BATCH_SYNTHESIS] Processed: ${processed}, Failed: ${failed}, Offset: ${offset}`);

      // Give the system a break between batches
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { processed, failed };
  } catch (error) {
    console.error('Batch synthesis failed:', error);
    throw error;
  }
}
