/**
 * Analytics System Types
 * Defines all metrics and analytics data structures
 */

export type TimeRange = '7d' | '30d' | 'all-time';

export interface AgentMetrics {
  total_agents: number;
  active_agents: number;
  total_conversations: number;
  avg_conversations_per_agent: number;
  agents_by_autonomy: Record<string, number>;
  top_agents: AgentMetricDetail[];
}

export interface AgentMetricDetail {
  id: string;
  name: string;
  conversation_count: number;
  autonomy_level: number;
  last_used: string | null;
}

export interface ConversationMetrics {
  total_conversations: number;
  conversation_trend: Record<string, number>;
  primary_emotion_distribution: Record<string, number>;
  topic_distribution: TopicMetric[];
  avg_conversation_length: number;
}

export interface TopicMetric {
  topic: string;
  count: number;
}

export interface AutonomyMetrics {
  total_actions: number;
  pending_actions: number;
  approved_actions: number;
  rejected_actions: number;
  executed_actions: number;
  failed_actions: number;
  risk_distribution: Record<string, number>;
  action_trend: Record<string, ActionTrendData>;
}

export interface ActionTrendData {
  pending: number;
  approved: number;
  rejected: number;
  executed: number;
}

export interface AnalyticsData {
  agent_metrics: AgentMetrics;
  conversation_metrics: ConversationMetrics;
  autonomy_metrics: AutonomyMetrics;
  generated_at: string;
  time_range_days: number;
}

/**
 * Cache entry for analytics data
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
}
