import { SupabaseClient } from '@supabase/supabase-js';
import type { Conversation, EmotionAnalysis } from '@/lib/types/memory';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export class MemoryRepository {
  private supabase: SupabaseClient | null = null;

  private getSupabaseClient(): SupabaseClient {
    if (this.supabase) return this.supabase;

    this.supabase = getSupabaseBrowserClient();
    return this.supabase;
  }

  /**
   * Store a new conversation with full emotional analysis and embedding
   * @param conversation - Conversation data excluding id and timestamps
   * @returns Stored conversation with id and timestamps
   */
  async storeConversation(
    conversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Conversation> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('conversations')
      .insert([
        {
          user_id: conversation.user_id,
          instance_key: conversation.instance_key || null,
          messages: conversation.messages,
          primary_emotion: conversation.primary_emotion,
          secondary_emotions: conversation.secondary_emotions,
          valence: conversation.valence,
          arousal: conversation.arousal,
          dominance: conversation.dominance,
          novelty: conversation.novelty,
          self_relevance: conversation.self_relevance,
          emotional_salience: conversation.emotional_salience,
          salience_tier: conversation.salience_tier,
          extracted_topics: conversation.extracted_topics,
          embedding: conversation.embedding,
          decay_multiplier: conversation.decay_multiplier,
          user_marked_important: conversation.user_marked_important,
          is_deleted: conversation.is_deleted,
          attachment_context: conversation.attachment_context || null,
          prospective_self_context: conversation.prospective_self_context || null,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store conversation: ${error.message}`);
    }

    return {
      ...data,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }

  /**
   * Retrieve recent conversations for a user with pagination
   * @param userId - User ID to filter by
   * @param limit - Number of conversations to return (default: 10)
   * @param offset - Pagination offset (default: 0)
   * @returns Array of conversations ordered by most recent first
   */
  async getRecentMemories(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Conversation[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch memories: ${error.message}`);
    }

    return data.map((row) => ({
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }));
  }

  /**
   * Perform semantic search using pgvector cosine similarity
   * @param userId - User ID to filter by
   * @param embedding - Query embedding vector (768 dimensions)
   * @param limit - Maximum number of results (default: 5)
   * @returns Array of semantically similar conversations
   */
  async semanticSearch(
    userId: string,
    embedding: number[],
    limit: number = 5
  ): Promise<Conversation[]> {
    const supabase = this.getSupabaseClient();
    // Use RPC function for efficient vector similarity search
    const { data, error } = await supabase.rpc('semantic_search', {
      query_embedding: embedding,
      user_id_param: userId,
      match_count: limit,
    });

    if (error) {
      throw new Error(`Semantic search failed: ${error.message}`);
    }

    return data.map((row: any) => ({
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }));
  }

  /**
   * Update conversation with emotional analysis results
   * @param conversationId - ID of conversation to update
   * @param emotions - Emotion analysis data
   */
  async updateWithEmotions(
    conversationId: string,
    emotions: EmotionAnalysis
  ): Promise<void> {
    const supabase = this.getSupabaseClient();
    const { error } = await supabase
      .from('conversations')
      .update({
        primary_emotion: emotions.primary_emotion,
        secondary_emotions: emotions.secondary_emotions,
        valence: emotions.dimensions.valence,
        arousal: emotions.dimensions.arousal,
        dominance: emotions.dimensions.dominance,
        novelty: emotions.dimensions.novelty,
        self_relevance: emotions.dimensions.self_relevance,
        emotional_salience: emotions.salience_score,
        salience_tier: emotions.salience_tier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (error) {
      throw new Error(`Failed to update emotions: ${error.message}`);
    }
  }
}
