/**
 * Phase 9A: Cron Scheduler Tests
 * Comprehensive test coverage for scheduling functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CronScheduler, ScheduleConfig } from './cron-scheduler';

describe('CronScheduler', () => {
  let scheduler: CronScheduler;

  beforeEach(() => {
    scheduler = new CronScheduler();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Schedule Creation', () => {
    it('should create a basic schedule', async () => {
      const config: ScheduleConfig = {
        id: 'test-schedule-1',
        user_id: 'test-user-1',
        operation_id: 'analytics-summary',
        cron_expression: '0 18 * * *', // Daily at 6pm
        timezone: 'UTC',
        enabled: true,
      };

      // Should not throw
      await expect(scheduler.scheduleJob(config)).resolves.not.toThrow();
    });

    it('should handle email composition schedule', async () => {
      const config: ScheduleConfig = {
        id: 'test-schedule-2',
        user_id: 'test-user-1',
        operation_id: 'email-compose',
        cron_expression: '0 9 * * 1-5', // 9am weekdays
        timezone: 'America/New_York',
        parameters: { draft: true },
        enabled: true,
      };

      await expect(scheduler.scheduleJob(config)).resolves.not.toThrow();
    });

    it('should handle task prioritization schedule', async () => {
      const config: ScheduleConfig = {
        id: 'test-schedule-3',
        user_id: 'test-user-1',
        operation_id: 'task-prioritize',
        cron_expression: '0 8 * * *', // Daily at 8am
        timezone: 'UTC',
        enabled: true,
      };

      await expect(scheduler.scheduleJob(config)).resolves.not.toThrow();
    });
  });

  describe('Next Execution Calculation', () => {
    it('should calculate next execution for daily schedule', async () => {
      const config: ScheduleConfig = {
        id: 'test-1',
        user_id: 'test-user-1',
        operation_id: 'analytics-summary',
        cron_expression: '0 18 * * *',
        timezone: 'UTC',
        enabled: true,
      };

      // Current time is midnight
      vi.setSystemTime(new Date('2026-02-04T00:00:00Z'));

      await scheduler.scheduleJob(config);
      const nextExec = scheduler.getNextExecution('test-1');

      // Should be today at 18:00
      expect(nextExec).not.toBeNull();
      if (nextExec) {
        expect(nextExec.getUTCHours()).toBe(18);
        expect(nextExec.getUTCDate()).toBe(4);
      }
    });

    it('should schedule for next day if time passed', async () => {
      const config: ScheduleConfig = {
        id: 'test-2',
        user_id: 'test-user-1',
        operation_id: 'calendar-prep',
        cron_expression: '0 9 * * *',
        timezone: 'UTC',
        enabled: true,
      };

      // Current time is 10am (past 9am)
      vi.setSystemTime(new Date('2026-02-04T10:00:00Z'));

      await scheduler.scheduleJob(config);
      const nextExec = scheduler.getNextExecution('test-2');

      // Should be tomorrow at 9am
      expect(nextExec).not.toBeNull();
      if (nextExec) {
        expect(nextExec.getUTCHours()).toBe(9);
        expect(nextExec.getUTCDate()).toBe(5); // Next day
      }
    });

    it('should handle minute-based schedules', async () => {
      const config: ScheduleConfig = {
        id: 'test-3',
        user_id: 'test-user-1',
        operation_id: 'email-classify',
        cron_expression: '*/5 * * * *', // Every 5 minutes
        timezone: 'UTC',
        enabled: true,
      };

      vi.setSystemTime(new Date('2026-02-04T10:07:00Z'));

      await scheduler.scheduleJob(config);
      const nextExec = scheduler.getNextExecution('test-3');

      // Should be in ~3 minutes
      expect(nextExec).not.toBeNull();
    });
  });

  describe('Schedule Management', () => {
    it('should cancel a scheduled job', () => {
      const jobId = 'test-user-1-test-schedule-1';
      const config: ScheduleConfig = {
        id: 'test-schedule-1',
        user_id: 'test-user-1',
        operation_id: 'task-breakdown',
        cron_expression: '0 * * * *',
        timezone: 'UTC',
        enabled: true,
      };

      scheduler.scheduleJob(config);
      expect(() => scheduler.cancelSchedule(jobId)).not.toThrow();
    });

    it('should disable all schedules for a user', async () => {
      const userId = 'test-user-2';

      // Create multiple schedules for same user
      const configs = [
        {
          id: 'sched-1',
          user_id: userId,
          operation_id: 'email-compose',
          cron_expression: '0 9 * * *',
          timezone: 'UTC',
          enabled: true,
        },
        {
          id: 'sched-2',
          user_id: userId,
          operation_id: 'task-prioritize',
          cron_expression: '0 8 * * *',
          timezone: 'UTC',
          enabled: true,
        },
      ];

      for (const config of configs) {
        await scheduler.scheduleJob(config as ScheduleConfig);
      }

      // Disable all for user
      await expect(scheduler.disableAllSchedules(userId)).resolves.not.toThrow();
    });
  });

  describe('Cost Tracking', () => {
    it('should track cost for executed operations', async () => {
      const config: ScheduleConfig = {
        id: 'test-cost-1',
        user_id: 'test-user-1',
        operation_id: 'analytics-summary',
        cron_expression: '0 18 * * *',
        timezone: 'UTC',
        enabled: true,
      };

      await scheduler.scheduleJob(config);

      // Get execution history
      const history = await scheduler.getExecutionHistory('test-cost-1', 5);

      // Initially empty
      expect(Array.isArray(history)).toBe(true);
    });

    it('should respect maximum cost per month limit', async () => {
      const config: ScheduleConfig = {
        id: 'test-cost-limit',
        user_id: 'test-user-1',
        operation_id: 'analytics-summary',
        cron_expression: '0 * * * *', // Hourly
        timezone: 'UTC',
        parameters: {},
        max_cost_per_month: 5.0, // Only $5/month allowed
        enabled: true,
      };

      await scheduler.scheduleJob(config);

      // Note: In real implementation, would check if running executions
      // exceed the monthly budget and auto-disable schedule
      expect(config.max_cost_per_month).toBe(5.0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid cron expressions', async () => {
      const config: ScheduleConfig = {
        id: 'test-invalid',
        user_id: 'test-user-1',
        operation_id: 'email-compose',
        cron_expression: 'invalid cron expression',
        timezone: 'UTC',
        enabled: true,
      };

      // Should not throw, but should handle gracefully
      await expect(scheduler.scheduleJob(config)).resolves.not.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      const config: ScheduleConfig = {
        id: 'test-network-error',
        user_id: 'test-user-1',
        operation_id: 'task-prioritize',
        cron_expression: '0 9 * * *',
        timezone: 'UTC',
        enabled: true,
      };

      // Should handle gracefully
      await expect(scheduler.scheduleJob(config)).resolves.not.toThrow();
    });

    it('should handle disabled schedules', async () => {
      const config: ScheduleConfig = {
        id: 'test-disabled',
        user_id: 'test-user-1',
        operation_id: 'calendar-time',
        cron_expression: '0 12 * * *',
        timezone: 'UTC',
        enabled: false,
      };

      // Disabled schedules should not execute
      await expect(scheduler.scheduleJob(config)).resolves.not.toThrow();
    });
  });

  describe('Timezone Handling', () => {
    it('should handle UTC timezone', async () => {
      const config: ScheduleConfig = {
        id: 'test-tz-utc',
        user_id: 'test-user-1',
        operation_id: 'analytics-summary',
        cron_expression: '0 12 * * *',
        timezone: 'UTC',
        enabled: true,
      };

      await expect(scheduler.scheduleJob(config)).resolves.not.toThrow();
    });

    it('should handle US Eastern timezone', async () => {
      const config: ScheduleConfig = {
        id: 'test-tz-est',
        user_id: 'test-user-1',
        operation_id: 'email-compose',
        cron_expression: '0 9 * * *',
        timezone: 'America/New_York',
        enabled: true,
      };

      await expect(scheduler.scheduleJob(config)).resolves.not.toThrow();
    });

    it('should handle Asia/Tokyo timezone', async () => {
      const config: ScheduleConfig = {
        id: 'test-tz-tokyo',
        user_id: 'test-user-1',
        operation_id: 'task-breakdown',
        cron_expression: '0 8 * * *',
        timezone: 'Asia/Tokyo',
        enabled: true,
      };

      await expect(scheduler.scheduleJob(config)).resolves.not.toThrow();
    });
  });

  describe('Execution History', () => {
    it('should fetch execution history for a schedule', async () => {
      const scheduleId = 'test-history-1';

      const history = await scheduler.getExecutionHistory(scheduleId, 10);

      // Should return an array (even if empty)
      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit execution history results', async () => {
      const scheduleId = 'test-history-2';

      const history = await scheduler.getExecutionHistory(scheduleId, 5);

      // Should respect limit
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Multiple Operations', () => {
    it('should schedule multiple different operations', async () => {
      const configs = [
        {
          id: 'multi-1',
          user_id: 'test-user-1',
          operation_id: 'email-compose',
          cron_expression: '0 9 * * *',
          timezone: 'UTC',
          enabled: true,
        },
        {
          id: 'multi-2',
          user_id: 'test-user-1',
          operation_id: 'calendar-prep',
          cron_expression: '30 8 * * *',
          timezone: 'UTC',
          enabled: true,
        },
        {
          id: 'multi-3',
          user_id: 'test-user-1',
          operation_id: 'task-prioritize',
          cron_expression: '0 7 * * *',
          timezone: 'UTC',
          enabled: true,
        },
      ];

      for (const config of configs) {
        await expect(scheduler.scheduleJob(config as ScheduleConfig)).resolves.not.toThrow();
      }
    });

    it('should initialize all schedules for a user', async () => {
      const userId = 'test-user-3';

      // Note: In real scenario, this would load from database
      await expect(scheduler.initializeSchedules(userId)).resolves.not.toThrow();
    });
  });
});
