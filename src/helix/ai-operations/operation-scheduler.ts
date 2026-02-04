/**
 * Operation Scheduler - Phase 4
 *
 * Manages scheduled operations with cron, event, and condition-based triggers.
 * Enforces SLA windows, quiet hours, and cost budgets.
 */

export type TriggerType = 'cron' | 'event' | 'condition';

export interface ScheduleTrigger {
  type: TriggerType;
  pattern?: string; // for cron
  timezone?: string;
  eventName?: string;
  eventFilters?: Record<string, unknown>;
  condition?: string;
}

export interface SLAWindow {
  startTime: string; // HH:MM format
  endTime: string;
  timezone: string;
}

export interface ScheduledOperation {
  id: string;
  trigger: ScheduleTrigger;
  slaWindow?: SLAWindow;
  quietHours?: string[];
  costBudgetDaily?: number;
  lastExecuted?: string;
  nextExecuted?: string;
}

interface CostBudget {
  dailyLimitUsd: number;
  currentSpendUsd: number;
}

export class OperationScheduler {
  private schedules: Map<string, ScheduledOperation> = new Map();

  /**
   * Parse cron expression (simplified, supports basic patterns)
   * Format: minute hour day month dayOfWeek
   * Example: 0 8 * * 0 = Sunday 8 AM
   */
  parseCronTrigger(pattern: string, timezone: string = 'UTC'): ScheduleTrigger {
    return {
      type: 'cron',
      pattern,
      timezone,
    };
  }

  /**
   * Check if cron trigger should fire at given time
   */
  shouldFireTrigger(trigger: ScheduleTrigger, now: Date = new Date()): boolean {
    if (trigger.type !== 'cron' || !trigger.pattern) {
      return false;
    }

    const parts = trigger.pattern.split(' ');
    if (parts.length !== 5) {
      return false;
    }

    const [minute, hour, day, month, dayOfWeek] = parts;

    // Check minute
    if (minute !== '*' && parseInt(minute) !== now.getUTCMinutes()) {
      return false;
    }

    // Check hour
    if (hour !== '*' && parseInt(hour) !== now.getUTCHours()) {
      return false;
    }

    // Check day of week (0=Sunday)
    if (dayOfWeek !== '*' && parseInt(dayOfWeek) !== now.getUTCDay()) {
      return false;
    }

    // Check day of month
    if (day !== '*' && parseInt(day) !== now.getUTCDate()) {
      return false;
    }

    // Check month (1-12)
    if (month !== '*' && parseInt(month) !== now.getUTCMonth() + 1) {
      return false;
    }

    return true;
  }

  /**
   * Create event-based trigger
   */
  createEventTrigger(eventName: string, filters?: Record<string, unknown>): ScheduleTrigger {
    return {
      type: 'event',
      eventName,
      eventFilters: filters,
    };
  }

  /**
   * Check if event matches trigger
   */
  matchesEventTrigger(
    trigger: ScheduleTrigger,
    eventName: string,
    eventData: Record<string, unknown>
  ): boolean {
    if (trigger.type !== 'event' || trigger.eventName !== eventName) {
      return false;
    }

    if (!trigger.eventFilters) {
      return true;
    }

    // Check all filters match
    for (const [key, expectedValue] of Object.entries(trigger.eventFilters)) {
      if (eventData[key] !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create condition-based trigger
   */
  createConditionTrigger(condition: string): ScheduleTrigger {
    return {
      type: 'condition',
      condition,
    };
  }

  /**
   * Check if condition is met
   */
  matchesConditionTrigger(trigger: ScheduleTrigger, context: Record<string, unknown>): boolean {
    if (trigger.type !== 'condition' || !trigger.condition) {
      return false;
    }

    // Simple condition evaluator for numeric comparisons
    // Supports: >=, <=, >, <, ==, !=
    const regex = /(\w+)\s*(>=|<=|>|<|==|!=)\s*(\d+)/;
    const match = trigger.condition.match(regex);

    if (!match) {
      return false;
    }

    const [, variable, operator, value] = match;
    const contextValue = context[variable];

    if (typeof contextValue !== 'number') {
      return false;
    }

    const numValue = parseInt(value);
    switch (operator) {
      case '>=':
        return contextValue >= numValue;
      case '<=':
        return contextValue <= numValue;
      case '>':
        return contextValue > numValue;
      case '<':
        return contextValue < numValue;
      case '==':
        return contextValue === numValue;
      case '!=':
        return contextValue !== numValue;
      default:
        return false;
    }
  }

  /**
   * Check if current time is within SLA window
   */
  isWithinSLAWindow(sla: SLAWindow, now: Date = new Date()): boolean {
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const time = `${hours}:${minutes}`;
    return time >= sla.startTime && time <= sla.endTime;
  }

  /**
   * Check if current time is in quiet hours
   */
  isInQuietHours(quietHours: string[], now: Date = new Date()): boolean {
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const time = `${hours}:${minutes}`;

    for (const range of quietHours) {
      const [start, end] = range.split('-');
      if (start > end) {
        // Quiet hours span midnight (e.g., 22:00-06:00)
        if (time >= start || time <= end) {
          return true;
        }
      } else {
        // Normal range (e.g., 06:00-09:00)
        if (time >= start && time <= end) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Register a scheduled operation
   */
  registerSchedule(id: string, trigger: ScheduleTrigger, slaWindow?: SLAWindow): void {
    this.schedules.set(id, {
      id,
      trigger,
      slaWindow,
    });
  }

  /**
   * Get a scheduled operation
   */
  getSchedule(id: string): ScheduledOperation | undefined {
    return this.schedules.get(id);
  }

  /**
   * List all scheduled operations
   */
  listSchedules(): ScheduledOperation[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Unregister a scheduled operation
   */
  unregisterSchedule(id: string): void {
    this.schedules.delete(id);
  }

  /**
   * Check if operation can execute within cost budget
   */
  canExecuteWithinBudget(budget: CostBudget, estimatedCostUsd: number): boolean {
    return budget.currentSpendUsd + estimatedCostUsd <= budget.dailyLimitUsd;
  }
}
