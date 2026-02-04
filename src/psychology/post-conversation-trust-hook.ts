/**
 * Post-Conversation Trust Update Hook
 *
 * Triggered after each conversation is stored
 * Orchestrates the emotional → trust pipeline
 *
 * Flow:
 * 1. Load conversation from Supabase
 * 2. Analyze emotional content (already in DB from Layer 2)
 * 3. Detect reciprocity in messages
 * 4. Build ConversationEvent
 * 5. Process through TrustFormationEngine
 * 6. Log results
 *
 * Theory: Integration of Layers 2 (Emotional) and 3 (Trust)
 */

import { createClient } from '@supabase/supabase-js';
import { trustFormationEngine, type ConversationEvent } from './trust-formation-engine.js';
import { reciprocityDetector } from './reciprocity-detector.js';

// ============================================================================
// Types
// ============================================================================

export interface ConversationRow {
  id: string;
  user_id: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
  primary_emotion?: string;
  secondary_emotions?: string[];
  valence?: number;
  arousal?: number;
  dominance?: number;
  novelty?: number;
  self_relevance?: number;
  emotional_salience?: number;
  salience_tier?: string;
  extracted_topics?: string[];
}

// ============================================================================
// Hook Handler
// ============================================================================

export class PostConversationTrustHook {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  /**
   * Process conversation and update trust
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
      // 2. Detect reciprocity in messages
      // ==========================================
      // Ensure messages have required timestamp field
      const messagesWithTimestamp = conversation.messages.map(m => ({
        ...m,
        timestamp: m.timestamp || new Date().toISOString(),
      }));

      const reciprocityAnalysis = reciprocityDetector.analyzeConversation(messagesWithTimestamp, {
        valence: conversation.valence || 0,
        arousal: conversation.arousal || 0,
        selfRelevance: conversation.self_relevance || 0,
        novelty: conversation.novelty || 0,
      });

      // ==========================================
      // 3. Build ConversationEvent for trust engine
      // ==========================================
      const event: ConversationEvent = {
        conversationId: conversation.id,
        userId: conversation.user_id,
        content: conversation.messages.map(m => m.content).join('\n'),

        emotionalAnalysis: {
          primaryEmotion: conversation.primary_emotion,
          secondaryEmotions: conversation.secondary_emotions,
          valence: conversation.valence || 0,
          arousal: conversation.arousal || 0,
          dominance: conversation.dominance || 0.5,
          novelty: conversation.novelty || 0.5,
          selfRelevance: conversation.self_relevance || 0,
        },

        extractedTopics: conversation.extracted_topics,

        reciprocityScore: reciprocityAnalysis.reciprocityScore,
      };

      // ==========================================
      // 4. Process through trust formation engine
      // ==========================================
      const result = await trustFormationEngine.processConversation(event);

      // ==========================================
      // 5. Store result and update conversation record
      // ==========================================
      await this.storeConversationTrustAnalysis(conversationId, {
        reciprocityScore: reciprocityAnalysis.reciprocityScore,
        reciprocityMatch: reciprocityAnalysis.match,
        trustUpdateId: result.entryId,
        trustDelta: result.trustDelta,
        newTrustLevel: result.trustAfter,
      });

      // ==========================================
      // 6. Log success
      // ==========================================
      console.log(
        `[TRUST_UPDATE] Conversation ${conversationId} processed for user ${conversation.user_id}`,
        {
          reciprocityScore: reciprocityAnalysis.reciprocityScore,
          trustDelta: result.trustDelta,
          attachmentStage: result.attachmentStageAfter,
        }
      );
    } catch (error) {
      console.error(`Failed to process conversation ${conversationId}:`, error);
      throw error; // Propagate to caller
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
   * Store trust analysis results back to conversations table
   */
  private async storeConversationTrustAnalysis(
    conversationId: string,
    analysis: {
      reciprocityScore: number;
      reciprocityMatch: string;
      trustUpdateId: string;
      trustDelta: number;
      newTrustLevel: number;
    }
  ): Promise<void> {
    try {
      const updateObj = {
        decay_multiplier: analysis.reciprocityScore,
        attachment_context: JSON.stringify({
          reciprocityMatch: analysis.reciprocityMatch,
          trustUpdateId: analysis.trustUpdateId,
          trustDelta: analysis.trustDelta,
          newTrustLevel: analysis.newTrustLevel,
          processedAt: new Date().toISOString(),
        }),
        updated_at: new Date().toISOString(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const { error } = await (this.supabase as any)
        .from('conversations')
        .update(updateObj)
        .eq('id', conversationId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to store trust analysis:', error);
      throw error;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const postConversationTrustHook = new PostConversationTrustHook();

// ============================================================================
// Realtime Subscription (For Live Processing)
// ============================================================================

/**
 * Subscribe to new conversations and process trust automatically
 * Called during Helix initialization
 */
export function subscribeToConversationUpdates(): void {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  // Subscribe to inserts on conversations table

  void supabase
    .channel('conversations_trust_updates')
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          const conversationId = (payload as any).new?.id as string;
          console.log(`[REALTIME] New conversation detected: ${conversationId}`);

          // Process trust asynchronously (don't wait)
          await postConversationTrustHook.processConversation(conversationId).catch(error => {
            console.error(`Failed to process conversation in realtime: ${conversationId}`, error);
          });
        } catch (error) {
          console.error('Error in realtime subscription:', error);
        }
      }
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log('[REALTIME] Trust update subscription active');
      } else if (status === 'CLOSED') {
        console.warn('[REALTIME] Trust update subscription closed');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[REALTIME] Trust update subscription error');
      }
    });
}

/**
 * Unsubscribe from realtime updates
 */
export async function unsubscribeFromConversationUpdates(): Promise<void> {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const channels = supabase.getChannels();
  if (channels.length > 0) {
    await supabase.removeChannel(channels[0]);
  }
}

// ============================================================================
// Batch Processing (For Catchup)
// ============================================================================

/**
 * Process all conversations since a certain time
 * Useful for catching up on conversations that were stored before trust system was live
 */
export async function batchProcessConversations(
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
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          await postConversationTrustHook.processConversation((conv as any).id as string);
          processed++;
        } catch (error) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          console.error(`Failed to process conversation ${(conv as any).id}:`, error);
          failed++;
        }
      }

      offset += batchSize;

      // Log progress
      console.log(`[BATCH_PROCESS] Processed: ${processed}, Failed: ${failed}, Offset: ${offset}`);

      // Give the system a break between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { processed, failed };
  } catch (error) {
    console.error('Batch processing failed:', error);
    throw error;
  }
}
