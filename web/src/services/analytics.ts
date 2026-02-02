import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type {
  TimeRange,
  AgentMetrics,
  ConversationMetrics,
  AutonomyMetrics,
  AnalyticsData,
  CacheEntry,
} from '@/lib/types/analytics';

/**
 * AnalyticsService: Manages analytics queries and caching
 * Provides metrics for dashboards and reports
 */
export class AnalyticsService {
  private supabase: SupabaseClient | null = null;
  private cache: Map<string, CacheEntry<any>> = new Map();

  private getSupabaseClient(): SupabaseClient {
    if (this.supabase) return this.supabase;
    this.supabase = getSupabaseBrowserClient();
    return this.supabase;
  }

  /**
   * Get cache TTL in milliseconds based on time range
   */
  private getCacheTTL(timeRange: TimeRange): number {
    switch (timeRange) {
      case '7d':
        return 60 * 60 * 1000; // 1 hour
      case '30d':
        return 6 * 60 * 60 * 1000; // 6 hours
      case 'all-time':
        return 24 * 60 * 60 * 1000; // 24 hours
      default:
        return 60 * 60 * 1000;
    }
  }

  /**
   * Convert time range to days
   */
  private getTimeRangeDays(timeRange: TimeRange): number {
    switch (timeRange) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case 'all-time':
        return 365;
      default:
        return 7;
    }
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid<T>(key: string): boolean {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return false;

    const now = Date.now();
    return now - entry.timestamp < entry.ttl;
  }

  /**
   * Get cached data
   */
  private getCachedData<T>(key: string): T | null {
    if (!this.isCacheValid<T>(key)) {
      this.cache.delete(key);
      return null;
    }

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    return entry?.data || null;
  }

  /**
   * Set cached data
   */
  private setCachedData<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Get agent metrics
   */
  async getAgentMetrics(userId: string, timeRange: TimeRange = '7d'): Promise<AgentMetrics> {
    const cacheKey = `agent-metrics-${userId}-${timeRange}`;
    const cached = this.getCachedData<AgentMetrics>(cacheKey);
    if (cached) return cached;

    try {
      const supabase = this.getSupabaseClient();
      const days = this.getTimeRangeDays(timeRange);

      const { data, error } = await supabase.rpc('get_agent_analytics', {
        user_id_param: userId,
        time_range_days: days,
      });

      if (error) {
        throw new Error(`Failed to fetch agent metrics: ${error.message}`);
      }

      const metrics = data[0] as AgentMetrics;
      this.setCachedData(cacheKey, metrics, this.getCacheTTL(timeRange));
      return metrics;
    } catch (error) {
      console.error('Failed to get agent metrics:', error);
      throw error;
    }
  }

  /**
   * Get conversation metrics
   */
  async getConversationMetrics(
    userId: string,
    timeRange: TimeRange = '7d'
  ): Promise<ConversationMetrics> {
    const cacheKey = `conversation-metrics-${userId}-${timeRange}`;
    const cached = this.getCachedData<ConversationMetrics>(cacheKey);
    if (cached) return cached;

    try {
      const supabase = this.getSupabaseClient();
      const days = this.getTimeRangeDays(timeRange);

      const { data, error } = await supabase.rpc('get_conversation_analytics', {
        user_id_param: userId,
        time_range_days: days,
      });

      if (error) {
        throw new Error(`Failed to fetch conversation metrics: ${error.message}`);
      }

      const metrics = data[0] as ConversationMetrics;
      this.setCachedData(cacheKey, metrics, this.getCacheTTL(timeRange));
      return metrics;
    } catch (error) {
      console.error('Failed to get conversation metrics:', error);
      throw error;
    }
  }

  /**
   * Get autonomy metrics
   */
  async getAutonomyMetrics(userId: string, timeRange: TimeRange = '7d'): Promise<AutonomyMetrics> {
    const cacheKey = `autonomy-metrics-${userId}-${timeRange}`;
    const cached = this.getCachedData<AutonomyMetrics>(cacheKey);
    if (cached) return cached;

    try {
      const supabase = this.getSupabaseClient();
      const days = this.getTimeRangeDays(timeRange);

      const { data, error } = await supabase.rpc('get_autonomy_analytics', {
        user_id_param: userId,
        time_range_days: days,
      });

      if (error) {
        throw new Error(`Failed to fetch autonomy metrics: ${error.message}`);
      }

      const metrics = data[0] as AutonomyMetrics;
      this.setCachedData(cacheKey, metrics, this.getCacheTTL(timeRange));
      return metrics;
    } catch (error) {
      console.error('Failed to get autonomy metrics:', error);
      throw error;
    }
  }

  /**
   * Get all analytics data
   */
  async getAnalytics(userId: string, timeRange: TimeRange = '7d'): Promise<AnalyticsData> {
    try {
      const [agentMetrics, conversationMetrics, autonomyMetrics] = await Promise.all([
        this.getAgentMetrics(userId, timeRange),
        this.getConversationMetrics(userId, timeRange),
        this.getAutonomyMetrics(userId, timeRange),
      ]);

      return {
        agent_metrics: agentMetrics,
        conversation_metrics: conversationMetrics,
        autonomy_metrics: autonomyMetrics,
        generated_at: new Date().toISOString(),
        time_range_days: this.getTimeRangeDays(timeRange),
      };
    } catch (error) {
      console.error('Failed to get analytics:', error);
      throw error;
    }
  }

  /**
   * Clear cache for a user (called when data changes)
   */
  clearUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }
}
