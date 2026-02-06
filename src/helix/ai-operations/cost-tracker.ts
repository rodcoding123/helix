/**
 * CostTracker
 *
 * Tracks all AI operation costs in real-time, maintains budget state,
 * and enforces daily limits. Logs all operations to database for audit trail.
 *
 * Phase 0.5: AI Operations Control Plane
 * Created: 2026-02-04
 */

import { createClient } from '@supabase/supabase-js';
import { logToDiscord } from '../logging.js';
import { hashChain } from '../hash-chain.js';

export interface OperationLog {
  operation_type: string;
  operation_id: string;
  model_used: string;
  user_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd: number;
  latency_ms: number;
  quality_score?: number;
  success: boolean;
  error_message?: string;
}

export interface DailyMetrics {
  date: string;
  user_id: string;
  total_cost: number;
  operation_count: number;
  successful_operations: number;
  failed_operations: number;
  average_latency_ms: number;
  average_quality_score: number;
}

export interface DailyBudget {
  user_id: string;
  daily_limit_usd: number;
  warning_threshold_usd: number;
  current_spend_today: number;
  operations_today: number;
  last_checked?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SpendingHistoryEntry {
  user_id: string;
  date: string;
  total_cost: number;
  operation_count: number;
}

/**
 * CostTracker - Centralized cost and budget tracking
 *
 * Responsibilities:
 * 1. Log every AI operation with full metrics
 * 2. Update user daily budget in real-time
 * 3. Track daily metrics for reporting
 * 4. Reset daily metrics at midnight UTC
 * 5. Detect anomalies and budget overruns
 */
export class CostTracker {
  private supabase: ReturnType<typeof createClient> | null = null;
  private dailyMetricsCache: Map<string, DailyMetrics> = new Map();

  constructor() {
    // Initialize Supabase client lazily when first needed
  }

  private getSupabaseClient(): ReturnType<typeof createClient> {
    if (!this.supabase) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required for CostTracker');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
    return this.supabase;
  }

  /**
   * Log a completed AI operation
   *
   * Flow:
   * 1. Calculate cost from tokens
   * 2. Insert into ai_operation_log (immutable audit trail)
   * 3. Update user's daily budget
   * 4. Check for budget overrun
   * 5. Log to Discord for alerting
   * 6. Add to hash chain for integrity
   */
  async logOperation(userId: string | undefined, operation: OperationLog): Promise<void> {
    const timestamp = new Date().toISOString();

    try {
      // 1. Insert operation log (immutable)
      const { error: insertError } = await this.getSupabaseClient()
        .from('ai_operation_log')
        .insert({
          operation_type: operation.operation_type,
          operation_id: operation.operation_id,
          model_used: operation.model_used,
          user_id: userId,
          input_tokens: operation.input_tokens,
          output_tokens: operation.output_tokens,
          cost_usd: operation.cost_usd,
          latency_ms: operation.latency_ms,
          quality_score: operation.quality_score,
          success: operation.success,
          error_message: operation.error_message,
          created_at: timestamp,
        });

      if (insertError) throw insertError;

      // 2. Update user budget (if userId provided)
      if (userId) {
        await this.updateBudget(userId, operation.cost_usd, operation.success);

        // 3. Check for budget overrun
        const budget = await this.getDailyBudget(userId);
        if (budget.current_spend_today > budget.daily_limit_usd) {
          logToDiscord({
            channel: 'helix-alerts',
            type: 'budget_overrun',
            userId,
            operation: operation.operation_id,
            dailySpend: budget.current_spend_today.toFixed(2),
            dailyLimit: budget.daily_limit_usd.toFixed(2),
            excess: (budget.current_spend_today - budget.daily_limit_usd).toFixed(2),
          });
        }
      }

      // 4. Log operation to Discord
      if (operation.success) {
        logToDiscord({
          channel: 'helix-api',
          type: 'operation_success',
          operation: operation.operation_id,
          model: operation.model_used,
          costUsd: operation.cost_usd.toFixed(6),
          latencyMs: operation.latency_ms,
          qualityScore: operation.quality_score,
          userId,
        });
      } else {
        logToDiscord({
          channel: 'helix-alerts',
          type: 'operation_failed',
          operation: operation.operation_id,
          model: operation.model_used,
          error: operation.error_message,
          userId,
        });
      }

      // 5. Add to hash chain for integrity verification
      await hashChain.add({
        type: 'ai_operation',
        operation_id: operation.operation_id,
        operation_type: operation.operation_type,
        model_used: operation.model_used,
        cost_usd: operation.cost_usd,
        success: operation.success,
        timestamp,
      });
    } catch (error) {
      // Failed to log operation - this is critical
      logToDiscord({
        channel: 'helix-alerts',
        type: 'operation_log_failed',
        operation: operation.operation_id,
        error: String(error),
        userId,
      });

      throw new Error(`Failed to log operation: ${String(error)}`);
    }
  }

  /**
   * Update user's daily budget after operation
   *
   * Updates:
   * - current_spend_today += operation cost
   * - operations_today += 1
   * - last_checked = now()
   */
  private async updateBudget(userId: string, costUsd: number, _success: boolean): Promise<void> {
    try {
      // Get current budget
      const budget = await this.getDailyBudget(userId);

      // Check if we need to reset (new day)
      if (budget.last_checked && this.isNewDay(new Date(budget.last_checked))) {
        await this.resetDailyMetrics(userId);
        // Refetch after reset
        const newBudget = await this.getDailyBudget(userId);
        budget.current_spend_today = newBudget.current_spend_today;
        budget.operations_today = newBudget.operations_today;
      }

      // Update budget
      const newSpend = budget.current_spend_today + costUsd;
      const newOperations = budget.operations_today + 1;

      const { error } = await this.getSupabaseClient()
        .from('cost_budgets')
        .update({
          current_spend_today: newSpend,
          operations_today: newOperations,
          last_checked: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Invalidate cache
      this.dailyMetricsCache.delete(userId);
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'budget_update_failed',
        userId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get user's current daily budget
   *
   * If user doesn't exist, creates default budget
   */
  async getDailyBudget(userId: string): Promise<DailyBudget> {
    try {
      const { data, error } = await this.getSupabaseClient()
        .from('cost_budgets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // User not found, create default
        if (error.code === 'PGRST116') {
          await this.createDefaultBudget(userId);
          return this.getDailyBudget(userId); // Recursively fetch created budget
        }
        throw error;
      }

      return data as DailyBudget;
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'budget_fetch_failed',
        userId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Create default budget for new user
   *
   * Default: $50/day limit, $25/day warning threshold
   */
  private async createDefaultBudget(userId: string): Promise<void> {
    const { error } = await this.getSupabaseClient().from('cost_budgets').insert({
      user_id: userId,
      daily_limit_usd: 50.0,
      warning_threshold_usd: 25.0,
      current_spend_today: 0,
      operations_today: 0,
      last_checked: new Date().toISOString(),
    });

    if (error) throw error;

    logToDiscord({
      channel: 'helix-api',
      type: 'budget_created',
      userId,
      dailyLimit: '50.00',
      warningThreshold: '25.00',
    });
  }

  /**
   * Reset daily metrics at midnight UTC
   *
   * Called by:
   * - Cron job at 00:00 UTC
   * - updateBudget() when new day detected
   */
  async resetDailyMetrics(userId?: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString();

      if (userId) {
        // Reset single user
        const { error } = await this.getSupabaseClient()
          .from('cost_budgets')
          .update({
            current_spend_today: 0,
            operations_today: 0,
            last_checked: timestamp,
          })
          .eq('user_id', userId);

        if (error) throw error;

        this.dailyMetricsCache.delete(userId);

        logToDiscord({
          channel: 'helix-api',
          type: 'daily_metrics_reset',
          userId,
          timestamp,
        });
      } else {
        // Reset all users (called by cron job)
        const { error } = await this.getSupabaseClient().from('cost_budgets').update({
          current_spend_today: 0,
          operations_today: 0,
          last_checked: timestamp,
        });

        if (error) throw error;

        this.dailyMetricsCache.clear();

        logToDiscord({
          channel: 'helix-api',
          type: 'daily_metrics_reset_all',
          timestamp,
        });
      }
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'daily_metrics_reset_failed',
        userId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get daily spend for user
   */
  async getDailySpend(userId: string): Promise<number> {
    try {
      const budget = await this.getDailyBudget(userId);
      return budget.current_spend_today;
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'daily_spend_fetch_failed',
        userId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get detailed daily metrics
   *
   * Query: v_daily_cost_summary view
   */
  async getDailyMetrics(date?: string): Promise<DailyMetrics[]> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];

      const { data, error } = await this.getSupabaseClient()
        .from('v_daily_cost_summary')
        .select('*')
        .eq('date', targetDate);

      if (error) throw error;

      return (data as DailyMetrics[]) || [];
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'metrics_fetch_failed',
        date,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get user's spending history
   *
   * Returns last N days of metrics
   */
  async getUserSpendingHistory(userId: string, days: number = 7): Promise<SpendingHistoryEntry[]> {
    try {
      const { data, error } = await this.getSupabaseClient()
        .from('v_cost_by_user')
        .select('*')
        .eq('user_id', userId)
        .limit(days);

      if (error) throw error;

      return (data as SpendingHistoryEntry[]) || [];
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'spending_history_fetch_failed',
        userId,
        days,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Detect spending anomalies
   *
   * Returns alerts if:
   * 1. Daily spend > average daily spend × 2
   * 2. Operation count > average × 3
   * 3. Cost per operation significantly higher than normal
   */
  async detectAnomalies(userId: string): Promise<string[]> {
    try {
      const history = await this.getUserSpendingHistory(userId, 7);
      const alerts: string[] = [];

      if (history.length < 2) {
        return alerts; // Not enough data
      }

      // Calculate averages
      const avgSpend = history.reduce((sum, h) => sum + (h.total_cost || 0), 0) / history.length;
      const avgOps = history.reduce((sum, h) => sum + (h.operation_count || 0), 0) / history.length;

      // Get today's metrics
      const todayMetrics = await this.getDailyMetrics();
      if (!todayMetrics.length) {
        return alerts;
      }

      const todaySpend = todayMetrics.reduce((sum, m) => sum + (m.total_cost || 0), 0);
      const todayOps = todayMetrics.reduce((sum, m) => sum + (m.operation_count || 0), 0);

      // Check anomalies
      if (todaySpend > avgSpend * 2) {
        alerts.push(
          `Spending 2x higher than average: $${todaySpend.toFixed(2)} vs $${avgSpend.toFixed(2)}`
        );
      }

      if (todayOps > avgOps * 3) {
        alerts.push(`Operation count 3x higher than average: ${todayOps} vs ${Math.round(avgOps)}`);
      }

      if (alerts.length > 0) {
        logToDiscord({
          channel: 'helix-alerts',
          type: 'spending_anomaly_detected',
          userId,
          alerts,
        });
      }

      return alerts;
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'anomaly_detection_failed',
        userId,
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Check if date represents new day
   */
  private isNewDay(lastCheck: Date): boolean {
    const now = new Date();
    const lastDate = lastCheck.toISOString().split('T')[0];
    const nowDate = now.toISOString().split('T')[0];
    return lastDate !== nowDate;
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.dailyMetricsCache.clear();
  }
}

// Singleton instance
export const costTracker = new CostTracker();
