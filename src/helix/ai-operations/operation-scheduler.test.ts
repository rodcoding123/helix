import { describe, it, expect, beforeEach } from 'vitest';
import { OperationScheduler, ScheduleTrigger } from './operation-scheduler.js';

describe('OperationScheduler', () => {
  let scheduler: OperationScheduler;

  beforeEach(() => {
    scheduler = new OperationScheduler();
  });

  describe('Cron Schedule Triggers', () => {
    it('parses cron expressions', () => {
      const trigger = scheduler.parseCronTrigger('0 8 * * 0'); // Sunday 8am
      expect(trigger).toEqual({
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      });
    });

    it('determines if cron trigger should fire', () => {
      const trigger: ScheduleTrigger = {
        type: 'cron',
        pattern: '0 8 * * 0', // Every Sunday at 8 AM
        timezone: 'UTC',
      };

      // Create a date on Sunday 8:00 AM UTC
      const sundayMorning = new Date('2026-02-01T08:00:00Z'); // First is Sunday
      const shouldFire = scheduler.shouldFireTrigger(trigger, sundayMorning);
      expect(shouldFire).toBe(true);
    });

    it('rejects non-matching cron times', () => {
      const trigger: ScheduleTrigger = {
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      };

      const mondayMorning = new Date('2026-02-02T08:00:00Z');
      const shouldFire = scheduler.shouldFireTrigger(trigger, mondayMorning);
      expect(shouldFire).toBe(false);
    });
  });

  describe('Event Triggers', () => {
    it('creates event-based trigger', () => {
      const trigger = scheduler.createEventTrigger('email.received', { label: 'inbox' });
      expect(trigger.type).toBe('event');
      expect(trigger.eventName).toBe('email.received');
    });

    it('matches event triggers', () => {
      const trigger = scheduler.createEventTrigger('email.received', { label: 'inbox' });
      const matches = scheduler.matchesEventTrigger(trigger, 'email.received', { label: 'inbox' });
      expect(matches).toBe(true);
    });

    it('rejects mismatched event properties', () => {
      const trigger = scheduler.createEventTrigger('email.received', { label: 'inbox' });
      const matches = scheduler.matchesEventTrigger(trigger, 'email.received', {
        label: 'archive',
      });
      expect(matches).toBe(false);
    });
  });

  describe('Condition Triggers', () => {
    it('creates condition trigger', () => {
      const trigger = scheduler.createConditionTrigger('batch_size >= 50');
      expect(trigger.type).toBe('condition');
      expect(trigger.condition).toBe('batch_size >= 50');
    });

    it('evaluates numeric conditions', () => {
      const trigger = scheduler.createConditionTrigger('batch_size >= 50');
      const context = { batch_size: 75 };
      const matches = scheduler.matchesConditionTrigger(trigger, context);
      expect(matches).toBe(true);
    });

    it('rejects unmet conditions', () => {
      const trigger = scheduler.createConditionTrigger('batch_size >= 50');
      const context = { batch_size: 25 };
      const matches = scheduler.matchesConditionTrigger(trigger, context);
      expect(matches).toBe(false);
    });
  });

  describe('SLA Window Enforcement', () => {
    it('validates operation within SLA window', () => {
      const sla = {
        startTime: '08:00',
        endTime: '09:00',
        timezone: 'UTC',
      };

      const within = scheduler.isWithinSLAWindow(sla, new Date('2026-02-04T08:30:00Z'));
      expect(within).toBe(true);
    });

    it('rejects operation outside SLA window', () => {
      const sla = {
        startTime: '08:00',
        endTime: '09:00',
        timezone: 'UTC',
      };

      const within = scheduler.isWithinSLAWindow(sla, new Date('2026-02-04T10:00:00Z'));
      expect(within).toBe(false);
    });

    it('respects quiet hours', () => {
      const quietHours = ['22:00-06:00']; // 10 PM - 6 AM

      const during = scheduler.isInQuietHours(quietHours, new Date('2026-02-04T23:00:00Z'));
      expect(during).toBe(true);

      const outside = scheduler.isInQuietHours(quietHours, new Date('2026-02-04T12:00:00Z'));
      expect(outside).toBe(false);
    });
  });

  describe('Schedule Registration', () => {
    it('registers a scheduled operation', () => {
      scheduler.registerSchedule('weekly_summary', {
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      });

      const registered = scheduler.getSchedule('weekly_summary');
      expect(registered).toBeDefined();
      expect(registered?.trigger.type).toBe('cron');
    });

    it('lists all scheduled operations', () => {
      scheduler.registerSchedule('summary1', {
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      });
      scheduler.registerSchedule('summary2', {
        type: 'cron',
        pattern: '0 18 * * 0',
        timezone: 'UTC',
      });

      const all = scheduler.listSchedules();
      expect(all).toHaveLength(2);
    });

    it('unregisters a scheduled operation', () => {
      scheduler.registerSchedule('to_delete', {
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      });

      scheduler.unregisterSchedule('to_delete');
      const deleted = scheduler.getSchedule('to_delete');
      expect(deleted).toBeUndefined();
    });
  });

  describe('Cost Budget Enforcement', () => {
    it('validates cost budget for operation', () => {
      const budget = {
        dailyLimitUsd: 10,
        currentSpendUsd: 5,
      };

      const canExecute = scheduler.canExecuteWithinBudget(budget, 3);
      expect(canExecute).toBe(true);
    });

    it('rejects operation exceeding budget', () => {
      const budget = {
        dailyLimitUsd: 10,
        currentSpendUsd: 8,
      };

      const canExecute = scheduler.canExecuteWithinBudget(budget, 5); // 8+5 > 10
      expect(canExecute).toBe(false);
    });
  });
});
