/**
 * Phase 9A: PostgreSQL pg_cron Manager
 * Persistent distributed scheduling using PostgreSQL pg_cron extension
 * Handles cron job registration, deregistration, and execution tracking
 */

import { createClient } from '@supabase/supabase-js';
import parseExpression from 'cron-parser';

export interface ScheduleConfig {
  id: string;
  user_id: string;
  operation_id: string;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  next_execution_at?: string;
  schedule_type: 'cron' | 'webhook';
  webhook_secret_ref?: string;
  max_cost_per_month?: number;
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

export class PgCronManager {
  /**
   * Register a schedule with PostgreSQL pg_cron
   * Persistent across server restarts, distributed across replicas
   */
  async scheduleOperation(schedule: ScheduleConfig): Promise<void> {
    if (schedule.schedule_type !== 'cron') {
      throw new Error('PgCronManager only handles cron schedules');
    }

    try {
      // Validate cron expression
      const cronParser = (parseExpression as any)(schedule.cron_expression, {
        tz: schedule.timezone,
      });

      // Calculate next execution
      const nextRun = cronParser.next().toDate();

      // 1. Register with pg_cron extension (RPC call to database)
      const { error: cronError } = await getDb()
        .rpc('register_cron_job', {
          p_job_name: `helix_${schedule.id}`,
          p_schedule: schedule.cron_expression,
          p_operation_id: schedule.operation_id,
          p_user_id: schedule.user_id,
        });

      if (cronError) {
        console.error('Failed to register pg_cron job:', cronError);
        throw new Error(`Failed to register cron job: ${cronError.message}`);
      }

      // 2. Update next_execution_at in database
      const { error: updateError } = await getDb()
        .from('operation_schedules')
        .update({
          next_execution_at: nextRun.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedule.id);

      if (updateError) {
        // Rollback: unregister the cron job
        await this.unscheduleOperation(schedule.id);
        throw updateError;
      }
    } catch (error) {
      console.error('Failed to schedule operation:', error);
      throw error;
    }
  }

  /**
   * Unschedule operation (removes from pg_cron)
   */
  async unscheduleOperation(scheduleId: string): Promise<void> {
    try {
      const { error } = await getDb()
        .rpc('unregister_cron_job', {
          p_job_name: `helix_${scheduleId}`,
        });

      if (error) {
        console.error('Failed to unregister pg_cron job:', error);
        throw error;
      }
    } catch (error) {
      console.error('Failed to unschedule operation:', error);
      throw error;
    }
  }

  /**
   * Update cron expression for existing schedule
   */
  async updateSchedule(schedule: ScheduleConfig): Promise<void> {
    // Remove old schedule
    await this.unscheduleOperation(schedule.id);

    // Register new one
    await this.scheduleOperation(schedule);
  }

  /**
   * Get next execution time for schedule
   */
  async getNextExecution(scheduleId: string): Promise<Date | null> {
    const { data } = await getDb()
      .from('operation_schedules')
      .select('next_execution_at')
      .eq('id', scheduleId)
      .single();

    if (!data?.next_execution_at) return null;
    return new Date(data.next_execution_at);
  }

  /**
   * List active cron jobs for a user
   */
  async listActiveSchedules(userId: string): Promise<ScheduleConfig[]> {
    const { data, error } = await getDb()
      .from('operation_schedules')
      .select('*')
      .eq('user_id', userId)
      .eq('schedule_type', 'cron')
      .eq('enabled', true)
      .order('next_execution_at', { ascending: true });

    if (error) {
      console.error('Failed to list schedules:', error);
      return [];
    }

    return (data || []) as ScheduleConfig[];
  }

  /**
   * Disable schedule (keeps it in database but removes from pg_cron)
   */
  async disableSchedule(scheduleId: string): Promise<void> {
    // Remove from pg_cron
    await this.unscheduleOperation(scheduleId);

    // Mark as disabled
    await getDb()
      .from('operation_schedules')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('id', scheduleId);
  }

  /**
   * Re-enable a disabled schedule
   */
  async enableSchedule(scheduleId: string): Promise<void> {
    const { data } = await getDb()
      .from('operation_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (!data) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    const schedule = data as ScheduleConfig;

    // Mark as enabled
    await getDb()
      .from('operation_schedules')
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq('id', scheduleId);

    // Register with pg_cron
    await this.scheduleOperation(schedule);
  }

  /**
   * Check if all cron jobs are properly registered
   * Used for health checks and sync operations
   */
  async validateSchedules(userId: string): Promise<{ valid: number; invalid: number; repaired: number }> {
    const schedules = await this.listActiveSchedules(userId);
    let repaired = 0;

    for (const schedule of schedules) {
      try {
        // Verify cron job exists in pg_cron
        const { data } = await getDb()
          .rpc('check_cron_job_exists', {
            p_job_name: `helix_${schedule.id}`,
          });

        if (!data) {
          // Job is missing, re-register it
          console.warn(`Cron job ${schedule.id} missing, re-registering...`);
          await this.scheduleOperation(schedule);
          repaired++;
        }
      } catch (error) {
        console.error(`Failed to validate schedule ${schedule.id}:`, error);
      }
    }

    return {
      valid: schedules.length - repaired,
      invalid: repaired,
      repaired,
    };
  }
}

// Singleton instance
let pgCronManager: PgCronManager | null = null;

export function getPgCronManager(): PgCronManager {
  if (!pgCronManager) {
    pgCronManager = new PgCronManager();
  }
  return pgCronManager;
}
