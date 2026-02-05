/**
 * Phase 9D: Analytics Service
 * Collects, analyzes, and reports on operation execution metrics
 */

import { createClient } from '@supabase/supabase-js';

export interface OperationMetrics {
  operation_id: string;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  total_cost_usd: number;
  avg_cost_per_execution: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  models_used: {
    anthropic: number;
    deepseek: number;
    gemini: number;
    openai: number;
  };
}

export interface CostTrend {
  date: string;
  total_operations: number;
  total_cost_usd: number;
  avg_cost_per_operation: number;
  anthropic_cost: number;
  deepseek_cost: number;
  gemini_cost: number;
  openai_cost: number;
  success_rate: number;
  avg_latency_ms: number;
}

export interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  recommendation_type: 'cost' | 'performance' | 'usage' | 'model_selection';
  operation_id?: string;
  estimated_savings_percent: number;
  estimated_savings_usd: number;
  estimated_latency_improvement_percent: number;
  priority: number;
  status: 'active' | 'dismissed' | 'implemented';
  suggested_action: Record<string, any>;
  estimated_implementation_effort: 'trivial' | 'easy' | 'moderate' | 'difficult';
}

let db: any;

function getDb() {
  if (!db) {
    db = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
    );
  }
  return db;
}

export class AnalyticsService {
  /**
   * Record operation execution for analytics
   * Uses RPC to handle aggregations atomically (single database call)
   */
  async recordExecution(userId: string, operationId: string, metrics: {
    success: boolean;
    latency_ms: number;
    cost_usd: number;
    model_used: 'anthropic' | 'deepseek' | 'gemini' | 'openai';
  }): Promise<void> {
    // Call database function to handle atomic aggregation
    const today = new Date().toISOString().split('T')[0];

    const { error } = await getDb()
      .rpc('record_operation_execution', {
        p_user_id: userId,
        p_operation_id: operationId,
        p_date: today,
        p_success: metrics.success,
        p_latency_ms: metrics.latency_ms,
        p_cost_usd: metrics.cost_usd,
        p_model_used: metrics.model_used,
      });

    if (error) {
      console.error('Failed to record execution:', error);
      // Fallback to manual insert if RPC fails
      const modelColumn = `${metrics.model_used}_cost`;
      await getDb()
        .from('cost_trends')
        .insert({
          user_id: userId,
          date: today,
          total_operations: 1,
          total_cost_usd: metrics.cost_usd,
          [modelColumn]: metrics.cost_usd,
          success_rate: metrics.success ? 100 : 0,
          avg_latency_ms: metrics.latency_ms,
        })
        .onConflict();
    }
  }

  /**
   * Get metrics for an operation over a period
   */
  async getOperationMetrics(
    userId: string,
    operationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OperationMetrics | null> {
    const { data } = await getDb()
      .from('operation_execution_analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('operation_id', operationId)
      .gte('period_start', startDate.toISOString())
      .lte('period_end', endDate.toISOString())
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;

    return {
      operation_id: operationId,
      total_executions: data.total_executions,
      successful_executions: data.successful_executions,
      failed_executions: data.failed_executions,
      success_rate: data.success_rate,
      total_cost_usd: data.total_cost_usd,
      avg_cost_per_execution: data.avg_cost_per_execution,
      avg_latency_ms: data.avg_latency_ms,
      min_latency_ms: data.min_latency_ms,
      max_latency_ms: data.max_latency_ms,
      models_used: {
        anthropic: data.anthropic_count || 0,
        deepseek: data.deepseek_count || 0,
        gemini: data.gemini_count || 0,
        openai: data.openai_count || 0,
      },
    };
  }

  /**
   * Get all operation metrics for a user
   */
  async getAllOperationMetrics(userId: string, startDate: Date, endDate: Date): Promise<OperationMetrics[]> {
    const { data } = await getDb()
      .from('operation_execution_analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('period_start', startDate.toISOString())
      .lte('period_end', endDate.toISOString())
      .order('total_cost_usd', { ascending: false });

    if (!data) return [];

    return data.map((d: any) => ({
      operation_id: d.operation_id,
      total_executions: d.total_executions,
      successful_executions: d.successful_executions,
      failed_executions: d.failed_executions,
      success_rate: d.success_rate,
      total_cost_usd: d.total_cost_usd,
      avg_cost_per_execution: d.avg_cost_per_execution,
      avg_latency_ms: d.avg_latency_ms,
      min_latency_ms: d.min_latency_ms,
      max_latency_ms: d.max_latency_ms,
      models_used: {
        anthropic: d.anthropic_count || 0,
        deepseek: d.deepseek_count || 0,
        gemini: d.gemini_count || 0,
        openai: d.openai_count || 0,
      },
    }));
  }

  /**
   * Get cost trends over time
   */
  async getCostTrends(userId: string, days: number = 30): Promise<CostTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data } = await getDb()
      .from('cost_trends')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    return (data || []).map((d: any) => ({
      date: d.date,
      total_operations: d.total_operations,
      total_cost_usd: d.total_cost_usd,
      avg_cost_per_operation: d.avg_cost_per_operation,
      anthropic_cost: d.anthropic_cost || 0,
      deepseek_cost: d.deepseek_cost || 0,
      gemini_cost: d.gemini_cost || 0,
      openai_cost: d.openai_cost || 0,
      success_rate: d.success_rate,
      avg_latency_ms: d.avg_latency_ms,
    }));
  }

  /**
   * Get total metrics for a period
   */
  async getPeriodSummary(userId: string, startDate: Date, endDate: Date) {
    const trends = await this.getCostTrends(userId, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    const filtered = trends.filter(t => {
      const d = new Date(t.date);
      return d >= startDate && d <= endDate;
    });

    if (filtered.length === 0) {
      return {
        total_cost: 0,
        total_operations: 0,
        avg_cost_per_operation: 0,
        overall_success_rate: 0,
        avg_latency_ms: 0,
        best_performing_model: null,
        cheapest_model: null,
      };
    }

    const totalCost = filtered.reduce((sum, t) => sum + t.total_cost_usd, 0);
    const totalOps = filtered.reduce((sum, t) => sum + t.total_operations, 0);
    const successRates = filtered.map(t => t.success_rate);
    const latencies = filtered.map(t => t.avg_latency_ms).filter(l => l > 0);

    return {
      total_cost: totalCost,
      total_operations: totalOps,
      avg_cost_per_operation: totalOps > 0 ? totalCost / totalOps : 0,
      overall_success_rate: successRates.length > 0
        ? successRates.reduce((a, b) => a + b) / successRates.length
        : 0,
      avg_latency_ms: latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b) / latencies.length)
        : 0,
    };
  }

  /**
   * Get active recommendations
   */
  async getRecommendations(userId: string, limit: number = 10): Promise<OptimizationRecommendation[]> {
    const { data } = await getDb()
      .from('optimization_recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .order('estimated_savings_usd', { ascending: false })
      .limit(limit);

    return (data || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      recommendation_type: d.recommendation_type,
      operation_id: d.operation_id,
      estimated_savings_percent: d.estimated_savings_percent,
      estimated_savings_usd: d.estimated_savings_usd,
      estimated_latency_improvement_percent: d.estimated_latency_improvement_percent,
      priority: d.priority,
      status: d.status,
      suggested_action: d.suggested_action,
      estimated_implementation_effort: d.estimated_implementation_effort,
    }));
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(userId: string, recommendationId: string): Promise<void> {
    await getDb()
      .from('optimization_recommendations')
      .update({
        status: 'dismissed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', recommendationId)
      .eq('user_id', userId);
  }

  /**
   * Mark recommendation as implemented
   */
  async implementRecommendation(userId: string, recommendationId: string): Promise<void> {
    await getDb()
      .from('optimization_recommendations')
      .update({
        status: 'implemented',
        implemented_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', recommendationId)
      .eq('user_id', userId);
  }

  /**
   * Create recommendations based on usage patterns
   */
  async generateRecommendations(userId: string): Promise<OptimizationRecommendation[]> {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    const metrics = await this.getAllOperationMetrics(userId, startDate, endDate);
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze each operation
    for (const metric of metrics) {
      // Recommendation 1: Low success rate
      if (metric.success_rate < 95) {
        recommendations.push({
          id: '',
          title: `Investigate failures in ${metric.operation_id}`,
          description: `Success rate is ${metric.success_rate.toFixed(1)}%, below target of 95%`,
          recommendation_type: 'performance',
          operation_id: metric.operation_id,
          estimated_savings_percent: 0,
          estimated_savings_usd: 0,
          estimated_latency_improvement_percent: 0,
          priority: 8,
          status: 'active',
          suggested_action: {
            action: 'review_logs',
            link: `/operations/${metric.operation_id}`,
          },
          estimated_implementation_effort: 'easy',
        });
      }

      // Recommendation 2: High latency
      if (metric.avg_latency_ms > 1000) {
        recommendations.push({
          id: '',
          title: `Optimize latency for ${metric.operation_id}`,
          description: `Average latency is ${metric.avg_latency_ms}ms, should target <500ms`,
          recommendation_type: 'performance',
          operation_id: metric.operation_id,
          estimated_savings_percent: 0,
          estimated_savings_usd: 0,
          estimated_latency_improvement_percent: 40,
          priority: 7,
          status: 'active',
          suggested_action: {
            action: 'enable_caching',
            cache_ttl: 3600,
          },
          estimated_implementation_effort: 'moderate',
        });
      }

      // Recommendation 3: Expensive model usage
      const mostUsedModel = Object.entries(metric.models_used).sort(([, a], [, b]) => b - a)[0];
      if (mostUsedModel && metric.total_cost_usd > 10) {
        recommendations.push({
          id: '',
          title: `Try cheaper model for ${metric.operation_id}`,
          description: `Currently using ${mostUsedModel[0]}, could save with DeepSeek`,
          recommendation_type: 'cost',
          operation_id: metric.operation_id,
          estimated_savings_percent: 35,
          estimated_savings_usd: metric.total_cost_usd * 0.35,
          estimated_latency_improvement_percent: 0,
          priority: 6,
          status: 'active',
          suggested_action: {
            action: 'switch_model',
            from: mostUsedModel[0],
            to: 'deepseek',
          },
          estimated_implementation_effort: 'trivial',
        });
      }
    }

    return recommendations;
  }
}

// Singleton instance
let analyticsService: AnalyticsService | null = null;

export function getAnalyticsService(): AnalyticsService {
  if (!analyticsService) {
    analyticsService = new AnalyticsService();
  }
  return analyticsService;
}
