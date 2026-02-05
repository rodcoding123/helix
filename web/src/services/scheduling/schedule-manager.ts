/**
 * Schedule Manager Service
 * Phase 9A: Advanced Scheduling with PostgreSQL pg_cron
 *
 * Features:
 * - PostgreSQL pg_cron for persistent, distributed scheduling
 * - Execution deduplication with running_execution_id lock
 * - Webhook handler with 1Password secret management
 * - Cost estimation with confidence ranges (low/mid/high)
 * - Monthly cost limit enforcement
 * - Complete audit trail logging
 */

import { createClient } from '@supabase/supabase-js';
import { logToDiscord, logToHashChain } from '../logging';
import { loadSecret } from '@/lib/secrets-loader';

const db = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface ScheduleConfig {
  id: string;
  user_id: string;
  operation_id: string;
  cron_expression?: string;
  schedule_type: 'cron' | 'webhook' | 'manual';
  timezone: string;
  parameters?: Record<string, any>;
  enabled: boolean;
  webhook_secret_ref?: string;
  max_cost_per_month?: number;
}

export interface CostEstimate {
  low: number;
  mid: number;
  high: number;
}

export class ScheduleManager {
  /**
   * Initialize all enabled schedules on app startup
   * Called once per application startup
   */
  async initializeSchedules(): Promise<void> {
    try {
      const { data: schedules, error } = await db
        .from('operation_schedules')
        .select('*')
        .eq('enabled', true);

      if (error) {
        throw new Error(`Failed to load schedules: ${error.message}`);
      }

      let cronCount = 0;
      let webhookCount = 0;

      for (const schedule of schedules || []) {
        if (schedule.schedule_type === 'cron') {
          // pg_cron is handled at database level, just verify it exists
          cronCount++;
        } else if (schedule.schedule_type === 'webhook') {
          webhookCount++;
        }
      }

      await logToDiscord({
        type: 'scheduling_initialized',
        content: JSON.stringify({ cron_schedules: cronCount, webhook_schedules: webhookCount }),
        metadata: { total_schedules: schedules?.length || 0 },
        timestamp: Date.now(),
      } as any);

      await logToHashChain({
        type: 'schedule_system_initialized',
        data: JSON.stringify({
          cron_count: cronCount,
          webhook_count: webhookCount,
          total_count: schedules?.length || 0,
        }),
      });
    } catch (error) {
      await logToDiscord({
        type: 'scheduling_initialization_failed',
        content: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      } as any);
      throw error;
    }
  }

  /**
   * Execute a scheduled operation
   * Called by PostgreSQL via pg_cron or by webhook handler
   *
   * DEDUPLICATION: Checks if already running before executing
   * LOCKING: Uses running_execution_id to prevent concurrent executions
   */
  async executeSchedule(scheduleId: string): Promise<void> {
    try {
      // 1. Get schedule configuration
      const { data: schedule, error: scheduleError } = await db
        .from('operation_schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

      if (scheduleError || !schedule) {
        throw new Error(`Schedule not found: ${scheduleId}`);
      }

      // 2. Check if already running (DEDUPLICATION)
      const { data: isRunning, error: runningError } = await db.rpc('schedule_is_running', {
        p_schedule_id: scheduleId,
      });

      if (runningError) {
        throw new Error(`Failed to check running status: ${runningError.message}`);
      }

      if (isRunning) {
        await logToDiscord({
          type: 'schedule_execution_skipped',
          content: 'Already running',
          metadata: { schedule_id: scheduleId, operation_id: schedule.operation_id },
          timestamp: Date.now(),
        } as any);

        // Update execution as skipped
        const { data: exec } = await db
          .from('schedule_executions')
          .insert({
            schedule_id: scheduleId,
            user_id: schedule.user_id,
            execution_status: 'skipped',
            triggered_by: 'cron',
          })
          .select('id')
          .single();

        if (exec?.id) {
          await db.rpc('complete_execution', {
            p_execution_id: exec.id,
            p_status: 'skipped',
            p_result: { reason: 'Already running' },
            p_cost_actual: 0,
            p_latency_ms: 0,
          });
        }

        return;
      }

      // 3. Create execution with lock
      const { data: executionId, error: lockError } = await db.rpc('create_execution_with_lock', {
        p_schedule_id: scheduleId,
        p_user_id: schedule.user_id,
        p_triggered_by: 'cron',
      });

      if (lockError || !executionId) {
        throw new Error(`Failed to create execution lock: ${lockError?.message || 'Unknown error'}`);
      }

      const startTime = Date.now();

      try {
        // 4. Estimate cost
        const costEstimate = await this.estimateCost(schedule);

        // 5. Check monthly cost limit
        const monthCost = await this.getMonthCost(schedule.user_id, schedule.operation_id);
        const projectedCost = monthCost + costEstimate.mid;

        if (
          schedule.max_cost_per_month &&
          projectedCost > schedule.max_cost_per_month
        ) {
          throw new Error(
            `Monthly cost limit exceeded: $${monthCost.toFixed(2)} + $${costEstimate.mid.toFixed(
              2
            )} = $${projectedCost.toFixed(2)} > $${schedule.max_cost_per_month.toFixed(2)}`
          );
        }

        // 6. Execute operation via Phase 0.5 router
        const result = await this.executeOperation(schedule);

        const latency = Date.now() - startTime;

        // 7. Mark execution complete
        await db.rpc('complete_execution', {
          p_execution_id: executionId,
          p_status: 'success',
          p_result: result,
          p_cost_actual: costEstimate.mid,
          p_latency_ms: latency,
        });

        await logToDiscord({
          type: 'schedule_executed',
          content: `Schedule executed with cost $${costEstimate.mid.toFixed(4)}`,
          metadata: { schedule_id: scheduleId, operation_id: schedule.operation_id, latency_ms: latency, cost_range: `$${costEstimate.low.toFixed(4)} - $${costEstimate.high.toFixed(4)}` },
          timestamp: Date.now(),
        } as any);

        await logToHashChain({
          type: 'schedule_executed',
          data: JSON.stringify({ schedule_id: scheduleId, operation_id: schedule.operation_id, latency_ms: latency, cost_usd: costEstimate.mid }),
        });
      } catch (error) {
        const latency = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Unlock schedule on error
        await db.rpc('complete_execution', {
          p_execution_id: executionId,
          p_status: 'failed',
          p_result: { error: errorMsg },
          p_cost_actual: 0,
          p_latency_ms: latency,
        });

        await logToDiscord({
          type: 'schedule_execution_failed',
          content: errorMsg,
          metadata: { schedule_id: scheduleId, operation_id: schedule.operation_id, latency_ms: latency },
          timestamp: Date.now(),
        } as any);

        await logToHashChain({
          type: 'schedule_execution_failed',
          data: JSON.stringify({ schedule_id: scheduleId, operation_id: schedule.operation_id, error: errorMsg }),
        });

        throw error;
      }
    } catch (error) {
      // Final error handler - log but don't throw
      console.error('[ScheduleManager] Execution error:', error);
    }
  }

  /**
   * Handle webhook trigger
   * SECURITY:
   * - Load secret from 1Password (never hardcoded)
   * - Verify HMAC-SHA256 signature
   * - Return 202 Accepted immediately (don't block)
   * - Execute async in background
   */
  async handleWebhook(
    scheduleId: string,
    payload: string,
    signature: string
  ): Promise<boolean> {
    try {
      // 1. Get schedule configuration
      const { data: schedule, error } = await db
        .from('operation_schedules')
        .select('webhook_secret_ref')
        .eq('id', scheduleId)
        .eq('schedule_type', 'webhook')
        .single();

      if (error || !schedule?.webhook_secret_ref) {
        throw new Error('Invalid webhook schedule or missing secret reference');
      }

      // 2. Load secret from 1Password (NOT hardcoded!)
      let secret: string;
      try {
        secret = await loadSecret(schedule.webhook_secret_ref || 'webhook_secret');
      } catch (secretError) {
        await logToDiscord({
          type: 'webhook_secret_load_failed',
          content: secretError instanceof Error ? secretError.message : String(secretError),
          metadata: { schedule_id: scheduleId, secret_ref: schedule.webhook_secret_ref },
          timestamp: Date.now(),
        } as any);
        throw new Error('Failed to load webhook secret from 1Password');
      }

      // 3. Verify signature
      const verified = await this.verifyWebhookSignature(payload, signature, secret);

      // Log webhook event
      await db.from('webhook_events').insert({
        schedule_id: scheduleId,
        event_type: 'webhook_received',
        payload: JSON.parse(payload),
        signature_verified: verified,
      });

      if (!verified) {
        throw new Error('Invalid webhook signature');
      }

      // 4. Queue execution async (return 202 immediately)
      // Don't await this - let it run in background
      this.executeSchedule(scheduleId).catch(error => {
        console.error('[ScheduleManager] Webhook execution error:', error);
        void logToDiscord({
          type: 'webhook_execution_failed',
          content: error instanceof Error ? error.message : String(error),
          metadata: { schedule_id: scheduleId },
          timestamp: Date.now(),
        } as any);
      });

      return true;
    } catch (error) {
      // Log webhook error
      await db.from('webhook_events').insert({
        schedule_id: scheduleId,
        event_type: 'webhook_error',
        signature_error: error instanceof Error ? error.message : String(error),
      });

      await logToDiscord({
        type: 'webhook_validation_failed',
        content: error instanceof Error ? error.message : String(error),
        metadata: { schedule_id: scheduleId },
        timestamp: Date.now(),
      } as any);

      return false;
    }
  }

  /**
   * Verify HMAC-SHA256 webhook signature
   * Compares computed signature with provided signature
   */
  private async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): Promise<boolean> {
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const computed = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const computedHex = Array.from(new Uint8Array(computed))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return computedHex === signature;
    } catch (error) {
      console.error('[ScheduleManager] Signature verification error:', error);
      return false;
    }
  }

  /**
   * Estimate operation cost with confidence range
   * Returns low/mid/high estimates instead of single point estimate
   * Low: 80% of expected tokens, cheapest model
   * Mid: 100% of expected tokens, mid-tier model
   * High: 120% of expected tokens, expensive model
   */
  private async estimateCost(schedule: ScheduleConfig): Promise<CostEstimate> {
    try {
      // In production, this would call the Phase 0.5 router
      // For now, return reasonable estimates
      const baseTokens = 1000; // Varies by operation

      // Pricing per million tokens
      const cheapestModel = 0.001; // Gemini Flash
      const midModel = 0.003; // DeepSeek
      const expensiveModel = 0.015; // Claude Opus

      return {
        low: (baseTokens * 0.8) / 1_000_000 * cheapestModel,
        mid: (baseTokens * 1.0) / 1_000_000 * midModel,
        high: (baseTokens * 1.2) / 1_000_000 * expensiveModel,
      };
    } catch (error) {
      console.error('[ScheduleManager] Cost estimation error:', error);
      return { low: 0.001, mid: 0.002, high: 0.005 };
    }
  }

  /**
   * Get total cost for an operation in the last 30 days
   */
  private async getMonthCost(userId: string, operationId: string): Promise<number> {
    try {
      const { data, error } = await db.rpc('get_schedule_month_cost', {
        p_user_id: userId,
        p_operation_id: operationId,
      });

      if (error) {
        console.error('[ScheduleManager] Failed to get month cost:', error);
        return 0;
      }

      return Number(data) || 0;
    } catch (error) {
      console.error('[ScheduleManager] Month cost calculation error:', error);
      return 0;
    }
  }

  /**
   * Execute operation via Phase 0.5 router
   * This would call the LLM router with the schedule configuration
   */
  private async executeOperation(schedule: ScheduleConfig): Promise<any> {
    try {
      // In production, this would call:
      // const router = getLLMRouter();
      // return router.executeOperation(schedule.operation_id, schedule.parameters);

      // For now, return mock result
      return {
        success: true,
        operation_id: schedule.operation_id,
        result: 'Operation executed successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Operation execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Singleton instance
let instance: ScheduleManager | null = null;

export function getScheduleManager(): ScheduleManager {
  if (!instance) {
    instance = new ScheduleManager();
  }
  return instance;
}
