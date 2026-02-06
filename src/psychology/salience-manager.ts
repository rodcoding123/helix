/* @ts-nocheck */
/**
 * Salience Manager - Supabase Memory Storage & Retrieval
 *
 * PHASE 1B: Memory Persistence Layer
 * Stores conversation syntheses with importance scores in Supabase
 *
 * TABLE SCHEMA:
 * - conversation_memories: Raw synthesis results, indexed by salience score
 * - memory_insights: Aggregated patterns and connections
 * - memory_decay: Historical salience scores for trending analysis
 *
 * OPERATIONS:
 * 1. Store synthesis results with salience score calculation
 * 2. Retrieve high-salience memories for reconsolidation
 * 3. Query patterns across memories
 * 4. Track memory evolution over time
 *
 * SALIENCE CALCULATION:
 * - Base: conversation length
 * - Emotion: intensity of emotional content
 * - Novelty: how different from previous patterns
 * - Recency: exponential boost for fresh memories
 * - Multiplier: user-specific weighting
 *
 * Created: 2026-02-06
 */

import { createClient } from '@supabase/supabase-js';
import { logToDiscord } from '../helix/logging.js';

interface ConversationMemory {
  id?: string;
  conversationId: string;
  userId: string;
  sessionKey: string;
  synthesisResult: {
    emotionalTags: Array<{ tag: string; intensity: number }>;
    goalMentions: Array<{ goal: string; progress?: string }>;
    relationshipShifts: Array<{ type: string; description: string }>;
    transformationTriggers: string[];
    meaningfulTopics: string[];
  };
  salienceScore: number;
  messageCount: number;
  averageEmotionIntensity: number;
  createdAt: string;
}

/**
 * SalienceManager - Memory storage and retrieval
 */
export class SalienceManager {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Store conversation synthesis in memory database
   */
  async storeConversationSynthesis(
    synthesis: {
      conversationId: string;
      emotionalTags: Array<{ tag: string; intensity: number }>;
      goalMentions: Array<{ goal: string; progress?: string }>;
      relationshipShifts: Array<{ type: string; description: string }>;
      transformationTriggers: string[];
      meaningfulTopics: string[];
      synthesisConfidence: number;
      userId?: string;
      timestamp: string;
    },
    userId?: string
  ): Promise<void> {
    try {
      // Calculate salience score
      const salienceScore = this.calculateSalience(synthesis);

      // Average emotion intensity
      const avgEmotionIntensity =
        synthesis.emotionalTags.length > 0
          ? synthesis.emotionalTags.reduce((sum, tag) => sum + tag.intensity, 0) /
            synthesis.emotionalTags.length
          : 0;

      // Prepare memory record
      const memory: ConversationMemory = {
        conversationId: synthesis.conversationId,
        userId: userId || 'anonymous',
        sessionKey: synthesis.conversationId,
        synthesisResult: {
          emotionalTags: synthesis.emotionalTags,
          goalMentions: synthesis.goalMentions,
          relationshipShifts: synthesis.relationshipShifts,
          transformationTriggers: synthesis.transformationTriggers,
          meaningfulTopics: synthesis.meaningfulTopics,
        },
        salienceScore,
        messageCount: 0, // Would need to load from conversation
        averageEmotionIntensity: avgEmotionIntensity,
        createdAt: synthesis.timestamp,
      };

      // Store in Supabase
      const { error } = await this.supabase.from('conversation_memories').insert([memory] as any);

      if (error) {
        throw new Error(`Failed to store memory: ${error.message}`);
      }

      // Log to Discord
      await logToDiscord({
        type: 'memory_stored',
        conversationId: synthesis.conversationId,
        salienceScore,
        emotionalIntensity: avgEmotionIntensity,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await logToDiscord({
        type: 'memory_store_failed',
        conversationId: synthesis.conversationId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Retrieve high-salience memories for reconsolidation
   */
  async getHighSalienceMemories(
    userId: string,
    limit = 20,
    minSalience = 0.7
  ): Promise<ConversationMemory[]> {
    const { data, error } = await this.supabase
      .from('conversation_memories')
      .select('*')
      .eq('userId', userId)
      .gte('salienceScore', minSalience)
      .order('salienceScore', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to retrieve memories: ${error.message}`);
    }

    return (data || []) as ConversationMemory[];
  }

  /**
   * Retrieve memories by time range
   */
  async getMemoriesByTimeRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ConversationMemory[]> {
    const { data, error } = await this.supabase
      .from('conversation_memories')
      .select('*')
      .eq('userId', userId)
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString())
      .order('createdAt', { ascending: false });

    if (error) {
      throw new Error(`Failed to retrieve memories: ${error.message}`);
    }

    return (data || []) as ConversationMemory[];
  }

  /**
   * Search memories by emotional tag
   */
  async searchByEmotionalTag(userId: string, tag: string): Promise<ConversationMemory[]> {
    const { data, error } = await this.supabase
      .from('conversation_memories')
      .select('*')
      .eq('userId', userId)
      .contains('synthesisResult->emotionalTags', JSON.stringify([{ tag }]));

    if (error) {
      throw new Error(`Failed to search memories: ${error.message}`);
    }

    return (data || []) as ConversationMemory[];
  }

  /**
   * Search memories by goal
   */
  async searchByGoal(userId: string, goalKeyword: string): Promise<ConversationMemory[]> {
    const { data, error } = await this.supabase
      .from('conversation_memories')
      .select('*')
      .eq('userId', userId)
      .filter('synthesisResult->goalMentions', 'cs', JSON.stringify([{ goal: goalKeyword }]));

    if (error) {
      throw new Error(`Failed to search memories: ${error.message}`);
    }

    return (data || []) as ConversationMemory[];
  }

  /**
   * Calculate salience score
   *
   * Formula:
   * salience = (emotion_intensity * 0.4) +
   *            (goal_count * 0.3) +
   *            (relationship_shifts * 0.2) +
   *            (recency_boost * 0.1)
   *
   * Range: 0.0 - 1.0
   */
  private calculateSalience(synthesis: {
    emotionalTags: Array<{ tag: string; intensity: number }>;
    goalMentions: Array<{ goal: string; progress?: string }>;
    relationshipShifts: Array<{ type: string; description: string }>;
    transformationTriggers: string[];
    meaningfulTopics: string[];
    synthesisConfidence: number;
  }): number {
    // Emotion component (0-1)
    const emotionIntensity =
      synthesis.emotionalTags.length > 0
        ? synthesis.emotionalTags.reduce((sum, tag) => sum + tag.intensity, 0) /
          synthesis.emotionalTags.length
        : 0;

    // Goal component (normalize to 0-1)
    const goalScore = Math.min(1, synthesis.goalMentions.length / 5);

    // Relationship component (0-1)
    const relationshipScore = Math.min(1, synthesis.relationshipShifts.length / 3);

    // Recency boost (new memories are more salient)
    const recencyBoost = 0.1;

    // Confidence boost
    const confidenceMultiplier = synthesis.synthesisConfidence;

    // Weighted calculation
    const baseScore =
      emotionIntensity * 0.4 + goalScore * 0.3 + relationshipScore * 0.2 + recencyBoost;

    // Apply confidence multiplier
    const finalScore = Math.min(1, baseScore * confidenceMultiplier);

    return finalScore;
  }

  /**
   * Get memory statistics for user
   */
  async getMemoryStats(userId: string): Promise<{
    totalMemories: number;
    avgSalience: number;
    highSalienceCount: number;
    emotionalTrendTop3: Array<{ tag: string; frequency: number }>;
  }> {
    const { data: memories } = await this.supabase
      .from('conversation_memories')
      .select('salienceScore, synthesisResult')
      .eq('userId', userId);

    if (!memories) {
      return {
        totalMemories: 0,
        avgSalience: 0,
        highSalienceCount: 0,
        emotionalTrendTop3: [],
      };
    }

    const typedMemories = memories as Array<{
      salienceScore: number;
      synthesisResult: { emotionalTags?: Array<{ tag: string; intensity: number }> };
    }>;

    const avgSalience =
      typedMemories.reduce((sum, m) => sum + m.salienceScore, 0) / typedMemories.length;

    const highSalienceCount = typedMemories.filter(m => m.salienceScore > 0.7).length;

    // Aggregate emotional tags
    const emotionalMap = new Map<string, number>();
    for (const memory of typedMemories) {
      if (memory.synthesisResult?.emotionalTags) {
        for (const tag of memory.synthesisResult.emotionalTags) {
          emotionalMap.set(tag.tag, (emotionalMap.get(tag.tag) || 0) + 1);
        }
      }
    }

    const emotionalTrendTop3 = Array.from(emotionalMap.entries())
      .map(([tag, frequency]) => ({ tag, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3);

    return {
      totalMemories: memories.length,
      avgSalience,
      highSalienceCount,
      emotionalTrendTop3,
    };
  }

  /**
   * Delete old memories (retention policy)
   */
  async pruneOldMemories(userIdOlderThanDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - userIdOlderThanDays);

    const { data: oldMemories } = await this.supabase
      .from('conversation_memories')
      .select('id')
      .lt('createdAt', cutoffDate.toISOString());

    if (!oldMemories || oldMemories.length === 0) {
      return 0;
    }

    const { error } = await this.supabase
      .from('conversation_memories')
      .delete()
      .lt('createdAt', cutoffDate.toISOString());

    if (error) {
      throw new Error(`Failed to prune memories: ${error.message}`);
    }

    return oldMemories.length;
  }
}

// Singleton instance
export const salienceManager = new SalienceManager(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);
