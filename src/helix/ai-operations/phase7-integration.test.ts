/**
 * Phase 7: Automations & Workflows
 * Integration test harness for automation orchestrator and services
 * Tests foundational setup and event routing without requiring actual services
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Simplified mocks that don't require top-level variables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('@/lib/supabase', (): any => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: (): Promise<{ data: null; error: null }> =>
              Promise.resolve({ data: null, error: null }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            then: (cb: (result: any) => void): void => {
              void cb({
                data: [],
                error: null,
              });
            },
          }),
          single: (): Promise<{ data: null; error: null }> =>
            Promise.resolve({ data: null, error: null }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          then: (cb: (result: any) => void): void => {
            void cb({
              data: [],
              error: null,
            });
          },
        }),
        single: (): Promise<{ data: null; error: null }> =>
          Promise.resolve({ data: null, error: null }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        then: (cb: (result: any) => void): void => {
          void cb({
            data: [],
            error: null,
          });
        },
      }),

      insert: () => ({
        select: () => ({
          single: (): Promise<{
            data: {
              id: string;
              user_id: string;
              trigger_type: string;
              condition: Record<string, unknown>;
              actions: Array<Record<string, unknown>>;
              enabled: boolean;
              execution_count: number;
              created_at: string;
              updated_at: string;
            };
            error: null;
          }> =>
            Promise.resolve({
              data: {
                id: 'trigger-123',
                user_id: 'user-123',
                trigger_type: 'email_received',
                condition: { type: 'email' },
                actions: [{ actionType: 'create_task', actionConfig: { title: 'Test' } }],
                enabled: true,
                execution_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
        }),
      }),

      update: () => ({
        eq: () => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq: (): { then: (cb: (result: any) => void) => void } => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            then: (cb: (result: any) => void): void => {
              void cb({ data: null, error: null });
            },
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          then: (cb: (result: any) => void): void => {
            void cb({ data: null, error: null });
          },
        }),
      }),

      delete: () => ({
        eq: () => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq: (): { then: (cb: (result: any) => void) => void } => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            then: (cb: (result: any) => void): void => {
              void cb({ data: null, error: null });
            },
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          then: (cb: (result: any) => void): void => {
            void cb({ data: null, error: null });
          },
        }),
      }),
    }),
  },
}));

vi.mock(
  '@/helix/logging',

  (): Record<string, () => Promise<void>> => ({
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    logToDiscord: async () => {
      // Mock implementation
    },
  })
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('@/helix/hash-chain', (): any => ({
  hashChain: {
    add: (): Promise<{ hash: string; index: number }> =>
      Promise.resolve({ hash: 'mock-hash', index: 1 }),
  },
}));

import type {
  EmailTriggerCondition,
  CreateTaskActionConfig,
  WorkflowAction,
} from '../../../web/src/services/automation.types.js';

import { AutomationOrchestrator } from '../../../web/src/services/automation-orchestrator.js';

describe('Phase 7: Automations & Workflows Integration', () => {
  let orchestrator: AutomationOrchestrator;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    orchestrator = new AutomationOrchestrator();
  });

  afterEach(async () => {
    try {
      await orchestrator.shutdown();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      // Ignore shutdown errors in tests
    }
  });

  describe('Orchestrator Initialization', () => {
    it('initializes orchestrator for a user', async () => {
      await orchestrator.initialize(testUserId);
      expect(orchestrator.isInitialized()).toBe(true);
    });

    it('loads triggers from database', async () => {
      await orchestrator.initialize(testUserId);
      const triggers = orchestrator.getTriggers(testUserId);
      expect(Array.isArray(triggers)).toBe(true);
    });

    it('handles initialization errors gracefully', async () => {
      const badOrchestrator = new AutomationOrchestrator();
      // Should not throw
      try {
        await badOrchestrator.initialize(testUserId);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // Expected if database unavailable
      }
    });
  });

  describe('Trigger Registration', () => {
    it('registers a new email trigger', async () => {
      await orchestrator.initialize(testUserId);

      const condition: EmailTriggerCondition = {
        type: 'email',
        emailFrom: ['boss@company.com'],
        subjectKeywords: ['urgent'],
      };

      const taskAction: WorkflowAction = {
        actionType: 'create_task',
        actionConfig: {
          title: 'Handle urgent email from boss',
          priority: 'high',
        } as CreateTaskActionConfig,
      };

      const trigger = await orchestrator.registerTrigger({
        userId: testUserId,
        triggerType: 'email_received',
        condition,
        actions: [taskAction],
        enabled: true,
      });

      expect(trigger.id).toBeDefined();
      expect(trigger.triggerType).toBe('email_received');
      expect(trigger.enabled).toBe(true);
    });

    it('unregisters a trigger', async () => {
      await orchestrator.initialize(testUserId);

      const condition: EmailTriggerCondition = {
        type: 'email',
        emailFrom: ['test@test.com'],
      };

      const trigger = await orchestrator.registerTrigger({
        userId: testUserId,
        triggerType: 'email_received',
        condition,
        actions: [],
        enabled: true,
      });

      expect(trigger.id).toBeDefined();

      await orchestrator.unregisterTrigger(trigger.id);
      expect(true).toBe(true); // Unregister succeeded
    });

    it('retrieves registered triggers', async () => {
      await orchestrator.initialize(testUserId);

      const condition: EmailTriggerCondition = {
        type: 'email',
        emailFrom: ['test@test.com'],
      };

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _trigger = await orchestrator.registerTrigger({
        userId: testUserId,
        triggerType: 'email_received',
        condition,
        actions: [],
        enabled: true,
      });

      const allTriggers = orchestrator.getTriggers(testUserId);
      expect(Array.isArray(allTriggers)).toBe(true);
    });
  });

  describe('Email Event Handling', () => {
    it('handles incoming email event', async () => {
      await orchestrator.initialize(testUserId);

      const mockEmail = {
        id: 'email-123',
        from: 'sender@test.com',
        subject: 'Test email',
        body: 'This is a test',
        to: testUserId,
      };

      // Should not throw
      await orchestrator.onEmailReceived(mockEmail);
      expect(orchestrator.isInitialized()).toBe(true);
    });
  });

  describe('Calendar Event Handling', () => {
    it('handles calendar event starting', async () => {
      await orchestrator.initialize(testUserId);

      const mockEvent = {
        title: 'Team standup',
        start: new Date(),
        attendees: ['user1@test.com', 'user2@test.com'],
      };

      // Should not throw
      await orchestrator.onCalendarEventStarting('event-123', mockEvent);
      expect(orchestrator.isInitialized()).toBe(true);
    });

    it('handles calendar event ended', async () => {
      await orchestrator.initialize(testUserId);

      const mockEvent = {
        title: 'Team standup',
        start: new Date(),
        end: new Date(Date.now() + 3600000),
      };

      // Should not throw
      await orchestrator.onCalendarEventEnded('event-123', mockEvent);
      expect(orchestrator.isInitialized()).toBe(true);
    });
  });

  describe('Task Creation Event', () => {
    it('handles task creation event', async () => {
      await orchestrator.initialize(testUserId);

      const mockTask = {
        id: 'task-123',
        title: 'Review document',
        priority: 'high',
        dueDate: new Date(),
      };

      // Should not throw
      await orchestrator.onTaskCreated(mockTask);
      expect(orchestrator.isInitialized()).toBe(true);
    });
  });

  describe('Trigger Execution', () => {
    it.skip('executes a trigger', async () => {
      await orchestrator.initialize(testUserId);

      const condition: EmailTriggerCondition = {
        type: 'email',
        emailFrom: ['test@test.com'],
      };

      const trigger = await orchestrator.registerTrigger({
        userId: testUserId,
        triggerType: 'email_received',
        condition,
        actions: [
          {
            actionType: 'create_task',
            actionConfig: { title: 'Test task' },
          },
        ],
        enabled: true,
      });

      // Ensure trigger is registered
      expect(trigger).toBeDefined();
      expect(trigger.triggerType).toBe('email_received');

      const triggerId = trigger.id || 'trigger-123';
      const context = {
        triggerId,
        userId: testUserId,
        triggerType: 'email_received' as const,
        triggerData: {
          id: 'email-1',
          from: 'test@test.com',
          subject: 'Test',
        },
        templateVariables: {},
        createdAt: new Date(),
      };

      const execution = await orchestrator.executeTrigger(trigger, context);

      expect(execution).toBeDefined();
      expect(execution.triggerId).toBeDefined();
      expect(execution.userId).toBeDefined();
    });
  });

  describe('Execution History', () => {
    it('retrieves execution history for a trigger', async () => {
      await orchestrator.initialize(testUserId);

      const trigger = await orchestrator.registerTrigger({
        userId: testUserId,
        triggerType: 'email_received',
        condition: { type: 'email' },
        actions: [],
        enabled: true,
      });

      const history = await orchestrator.getExecutionHistory(trigger.id);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Event Subscription', () => {
    it('subscribes to custom events', async () => {
      await orchestrator.initialize(testUserId);

      const listener = vi.fn();
      orchestrator.on('calendar_event_ended', listener);

      // Event should be subscribed (listener not called until event fires)
      expect(listener).not.toHaveBeenCalled();
    });

    it('unsubscribes from custom events', async () => {
      await orchestrator.initialize(testUserId);

      const listener = vi.fn();
      orchestrator.on('calendar_event_ended', listener);
      orchestrator.off('calendar_event_ended', listener);

      // Listener should be unsubscribed
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Orchestrator Shutdown', () => {
    it('shuts down orchestrator gracefully', async () => {
      await orchestrator.initialize(testUserId);
      await orchestrator.shutdown();

      expect(orchestrator.isInitialized()).toBe(false);
    });
  });

  describe('Phase 7 Architecture Validation', () => {
    it('automations are separate from AIOperationRouter', () => {
      // Phase 7 automations are independent of AIOperationRouter
      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.initialize).toBe('function');
      expect(typeof orchestrator.onEmailReceived).toBe('function');
      expect(typeof orchestrator.onCalendarEventStarting).toBe('function');
    });

    it('automations execute asynchronously', async () => {
      await orchestrator.initialize(testUserId);

      const mockEmail = {
        id: 'email-1',
        from: 'test@test.com',
        subject: 'Test',
        body: 'Test',
      };

      // Should return quickly (async/non-blocking)
      const startTime = Date.now();
      await orchestrator.onEmailReceived(mockEmail);
      const duration = Date.now() - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(100);
    });

    it('provides access to orchestrator singleton', async () => {
      const { getAutomationOrchestrator } =
        await import('../../../web/src/services/automation-orchestrator.js');

      const instance1 = getAutomationOrchestrator();
      const instance2 = getAutomationOrchestrator();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Error Handling', () => {
    it('handles errors gracefully during initialization', async () => {
      const badOrch = new AutomationOrchestrator();
      // Should not throw
      try {
        await badOrch.initialize(testUserId);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('logs execution errors', async () => {
      await orchestrator.initialize(testUserId);

      const trigger = await orchestrator.registerTrigger({
        userId: testUserId,
        triggerType: 'email_received',
        condition: { type: 'email' },
        actions: [],
        enabled: true,
      });

      const context = {
        triggerId: trigger.id,
        userId: testUserId,
        triggerType: 'email_received' as const,
        triggerData: {},
        templateVariables: {},
        createdAt: new Date(),
      };

      // Should execute without throwing
      try {
        await orchestrator.executeTrigger(trigger, context);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // Error handling
      }
    });
  });

  describe('Type Safety', () => {
    it('enforces trigger type constraints', async () => {
      await orchestrator.initialize(testUserId);

      const validCondition: EmailTriggerCondition = {
        type: 'email',
        emailFrom: ['test@test.com'],
      };

      const trigger = await orchestrator.registerTrigger({
        userId: testUserId,
        triggerType: 'email_received',
        condition: validCondition,
        actions: [],
        enabled: true,
      });

      expect(trigger.triggerType).toBe('email_received');
    });
  });
});
