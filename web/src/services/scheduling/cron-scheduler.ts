/**
 * Phase 9A: Cron Scheduler Service
 * Manages scheduled execution of AI operations using cron expressions
 * Integrates with Phase 0.5 AI Operations Control Plane for execution
 */

import { createClient } from '@supabase/supabase-js';
import { aiRouter } from '../intelligence/router-client';

export interface ScheduleConfig {
  id: string;
  user_id: string;
  operation_id: string;
  cron_expression: string;
  timezone: string;
  parameters?: Record<string, unknown>;
  enabled: boolean;
  max_cost_per_month?: number;
}

export interface ScheduleExecution {
  schedule_id: string;
  user_id: string;
  execution_status: 'pending' | 'running' | 'success' | 'failed';
  triggered_by: 'cron' | 'webhook' | 'manual';
  result?: Record<string, unknown>;
  error_message?: string;
  cost_usd?: number;
  latency_ms?: number;
}

/**
 * CronScheduler manages scheduled operations
 * Handles cron parsing, next execution calculation, and operation execution
 */
export class CronScheduler {
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private db = createClient(
    import.meta.env.VITE_SUPABASE_URL || '',
    import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  );

  /**
   * Initialize schedules for a user from database
   */
  async initializeSchedules(userId: string): Promise<void> {
    try {
      const { data: schedules, error } = await this.db
        .from('operation_schedules')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true);

      if (error) {
        console.error('Failed to load schedules:', error);
        return;
      }

      for (const schedule of schedules || []) {
        await this.scheduleJob(schedule as ScheduleConfig);
      }
    } catch (error) {
      console.error('Schedule initialization error:', error);
    }
  }

  /**
   * Schedule a single job
   * Calculates next execution time and sets up timeout
   */
  async scheduleJob(config: ScheduleConfig): Promise<void> {
    try {
      // Parse cron and calculate next run time
      const nextRun = this.calculateNextExecution(config.cron_expression, config.timezone);

      if (!nextRun) {
        console.error(`Invalid cron expression: ${config.cron_expression}`);
        return;
      }

      const jobId = `${config.user_id}-${config.id}`;
      const now = new Date();
      const delayMs = nextRun.getTime() - now.getTime();

      // Schedule the job
      const timeout = setTimeout(async () => {
        await this.executeScheduledOperation(config);
        // Reschedule for next occurrence
        if (config.enabled) {
          await this.scheduleJob(config);
        }
      }, Math.max(delayMs, 0));

      this.scheduledJobs.set(jobId, timeout);

      // Update database with next execution time
      await this.db
        .from('operation_schedules')
        .update({ next_execution_at: nextRun.toISOString() })
        .eq('id', config.id);
    } catch (error) {
      console.error(`Failed to schedule job ${config.id}:`, error);
      await this.logScheduleError(config.id, config.user_id, error);
    }
  }

  /**
   * Calculate next execution time from cron expression
   * Simple implementation supporting basic cron patterns
   */
  private calculateNextExecution(cronExpression: string, timezone: string): Date | null {
    try {
      // Parse cron: "minute hour day month dayOfWeek"
      const parts = cronExpression.trim().split(/\s+/);
      if (parts.length !== 5) {
        return null;
      }

      const [minute, hour, day, month, dayOfWeek] = parts;
      const now = new Date();
      let next = new Date(now);

      // Handle simple patterns
      if (hour !== '*' && minute !== '*') {
        const h = parseInt(hour);
        const m = parseInt(minute);
        next.setHours(h, m, 0, 0);
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
      } else if (hour !== '*') {
        const h = parseInt(hour);
        next.setHours(h, 0, 0, 0);
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
      } else if (minute !== '*') {
        const m = parseInt(minute);
        next.setMinutes(m, 0, 0);
        if (next <= now) {
          next.setHours(next.getHours() + 1);
        }
      } else {
        // Every minute
        next.setSeconds(0, 0);
        next.setMinutes(next.getMinutes() + 1);
      }

      // TODO: Handle timezone conversion if needed
      return next;
    } catch {
      return null;
    }
  }

  /**
   * Execute a scheduled operation
   * Creates execution record, calls router, and logs result
   */
  private async executeScheduledOperation(config: ScheduleConfig): Promise<void> {
    const startTime = Date.now();
    let executionId: string | null = null;

    try {
      // Create pending execution record
      const { data: execution, error: createError } = await this.db
        .from('schedule_executions')
        .insert({
          schedule_id: config.id,
          user_id: config.user_id,
          execution_status: 'pending',
          triggered_by: 'cron',
        })
        .select('id')
        .single();

      if (createError || !execution) {
        throw new Error(`Failed to create execution: ${createError?.message}`);
      }

      executionId = execution.id;

      // Update status to running
      await this.db
        .from('schedule_executions')
        .update({ execution_status: 'running' })
        .eq('id', executionId);

      // Execute operation via Phase 0.5 router
      const result = await aiRouter.execute(config.operation_id, config.parameters || {});

      const endTime = Date.now();
      const latencyMs = endTime - startTime;

      // Get actual cost from router
      const costs = await this.db
        .from('ai_operation_log')
        .select('cost_usd')
        .eq('operation_id', config.operation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Update execution with success
      await this.db
        .from('schedule_executions')
        .update({
          execution_status: 'success',
          result,
          cost_usd: costs.data?.cost_usd,
          latency_ms: latencyMs,
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      // Increment execution count
      await this.db.rpc('increment_schedule_execution_count', {
        schedule_id: config.id,
      });

      // Update last execution time
      await this.db
        .from('operation_schedules')
        .update({ last_execution_at: new Date().toISOString() })
        .eq('id', config.id);
    } catch (error) {
      const endTime = Date.now();
      const latencyMs = endTime - startTime;

      if (executionId) {
        // Update execution with failure
        await this.db
          .from('schedule_executions')
          .update({
            execution_status: 'failed',
            error_message: error instanceof Error ? error.message : String(error),
            latency_ms: latencyMs,
            completed_at: new Date().toISOString(),
          })
          .eq('id', executionId);
      } else {
        // Log error if execution wasn't created
        await this.logScheduleError(config.id, config.user_id, error);
      }
    }
  }

  /**
   * Log a schedule error to the database
   */
  private async logScheduleError(
    scheduleId: string,
    userId: string,
    error: unknown
  ): Promise<void> {
    try {
      await this.db.from('schedule_executions').insert({
        schedule_id: scheduleId,
        user_id: userId,
        execution_status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        triggered_by: 'cron',
      });
    } catch (logError) {
      console.error('Failed to log schedule error:', logError);
    }
  }

  /**
   * Cancel a scheduled job
   */
  cancelSchedule(jobId: string): void {
    const timeout = this.scheduledJobs.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledJobs.delete(jobId);
    }
  }

  /**
   * Disable all schedules for a user
   */
  async disableAllSchedules(userId: string): Promise<void> {
    // Update database
    await this.db
      .from('operation_schedules')
      .update({ enabled: false })
      .eq('user_id', userId);

    // Cancel all timeouts for this user
    const jobIds = Array.from(this.scheduledJobs.keys()).filter(id => id.startsWith(userId));
    jobIds.forEach(jobId => this.cancelSchedule(jobId));
  }

  /**
   * Get next execution time for a schedule
   */
  getNextExecution(scheduleId: string): Date | null {
    // This would need to fetch from database
    // Placeholder for now
    return null;
  }

  /**
   * Get schedule execution history
   */
  async getExecutionHistory(
    scheduleId: string,
    limit: number = 10
  ): Promise<ScheduleExecution[]> {
    const { data, error } = await this.db
      .from('schedule_executions')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch execution history:', error);
      return [];
    }

    return (data || []) as ScheduleExecution[];
  }
}

/**
 * Singleton instance of cron scheduler
 */
let schedulerInstance: CronScheduler | null = null;

/**
 * Get or create the cron scheduler instance
 */
export function getCronScheduler(): CronScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new CronScheduler();
  }
  return schedulerInstance;
}
