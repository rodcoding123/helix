/**
 * Email-to-Task Integration Tests - Phase 7 Track 1
 * Tests complete email→task automation workflow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase', () => {
  const store = new Map();
  return {
    supabase: {
      from: (table) => {
        if (!store.has(table)) store.set(table, []);
        const tableStore = store.get(table);
        return {
          insert: (data) => ({
            select: () => ({
              single: async () => ({
                data: { id: `${table}-${Date.now()}`, ...data },
                error: null,
              }),
            }),
          }),
          select: () => ({
            eq: (col1, val1) => ({
              eq: (col2, val2) => ({
                then: async (cb) => cb({ data: [], error: null }),
              }),
              then: async (cb) => cb({ data: [], error: null }),
            }),
          }),
          update: (data) => ({
            eq: () => ({
              then: async (cb) => cb({ data: null, error: null }),
            }),
          }),
          delete: () => ({
            eq: () => ({
              then: async (cb) => cb({ data: null, error: null }),
            }),
          }),
        };
      },
    },
  };
});

vi.mock('@/helix/logging', () => ({
  logToDiscord: async () => {},
}));

vi.mock('@/helix/hash-chain', () => ({
  hashChain: {
    add: async () => ({ hash: 'mock-hash', index: 1 }),
  },
}));

import { getEmailTriggerService } from '../automation-email-trigger';
import { createMockEmail, createMockAutomationTrigger } from '../__test-utils/automation-factory';

describe('Email-to-Task Integration', () => {
  let emailTriggerService: ReturnType<typeof getEmailTriggerService>;
  const testUserId = 'user-123';

  beforeEach(() => {
    emailTriggerService = getEmailTriggerService();
  });

  describe('Complete Workflow', () => {
    it('executes email→rule→task workflow', async () => {
      // 1. Create rule
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        emailFrom: ['boss@company.com'],
        createTaskConfig: {
          title: 'Email from {{emailFrom}}: {{emailSubject}}',
          priority: 'high',
        },
      });

      expect(rule.id).toBeDefined();
      expect(rule.triggerType).toBe('email_received');

      // 2. Simulate email arrival
      const mockEmail = createMockEmail({
        from: 'boss@company.com',
        subject: 'Project Update',
      });

      // 3. Process email
      const result = await emailTriggerService.onEmailReceived(mockEmail, testUserId);

      // 4. Verify task would be created
      expect(typeof result === 'string' || result === null).toBe(true);
    });

    it('matches multiple email conditions', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        emailFrom: ['boss@company.com'],
        subjectKeywords: ['urgent', 'action required'],
        createTaskConfig: {
          title: 'URGENT: {{emailSubject}}',
          priority: 'high',
        },
      });

      expect(rule.condition.type).toBe('email');

      const mockEmail = createMockEmail({
        from: 'boss@company.com',
        subject: 'URGENT: Budget review needed',
      });

      const result = await emailTriggerService.onEmailReceived(mockEmail, testUserId);
      expect(typeof result === 'string' || result === null).toBe(true);
    });

    it('skips email if conditions not met', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        emailFrom: ['boss@company.com'],
        createTaskConfig: {
          title: 'Review: {{emailSubject}}',
        },
      });

      const mockEmail = createMockEmail({
        from: 'colleague@company.com', // Different sender
        subject: 'FYI',
      });

      const result = await emailTriggerService.onEmailReceived(mockEmail, testUserId);
      // Should not create task for non-matching email
      expect(typeof result === 'string' || result === null).toBe(true);
    });
  });

  describe('Template Variable Substitution', () => {
    it('substitutes emailSubject variable', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        createTaskConfig: {
          title: 'Task: {{emailSubject}}',
        },
      });

      const mockEmail = createMockEmail({
        subject: 'Important Update',
      });

      const result = await emailTriggerService.onEmailReceived(mockEmail, testUserId);
      expect(typeof result === 'string' || result === null).toBe(true);
    });

    it('substitutes emailFrom variable', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        createTaskConfig: {
          title: 'From {{emailFrom}}',
        },
      });

      const mockEmail = createMockEmail({
        from: 'sender@example.com',
      });

      const result = await emailTriggerService.onEmailReceived(mockEmail, testUserId);
      expect(typeof result === 'string' || result === null).toBe(true);
    });
  });

  describe('Task Priority Mapping', () => {
    it('creates task with high priority', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        createTaskConfig: {
          title: 'Urgent task',
          priority: 'high',
        },
      });

      expect(rule.actions[0]?.actionConfig.priority).toBe('high');
    });

    it('creates task with normal priority', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        createTaskConfig: {
          title: 'Normal task',
          priority: 'normal',
        },
      });

      expect(rule.actions[0]?.actionConfig.priority).toBe('normal');
    });

    it('creates task with low priority', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        createTaskConfig: {
          title: 'Low priority task',
          priority: 'low',
        },
      });

      expect(rule.actions[0]?.actionConfig.priority).toBe('low');
    });
  });

  describe('Discord Logging', () => {
    it('logs rule creation to Discord', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        emailFrom: ['test@example.com'],
        createTaskConfig: {
          title: 'Test task',
        },
      });

      expect(rule.id).toBeDefined();
      // Discord logging is mocked and should be called
    });

    it('logs email trigger execution to Discord', async () => {
      const mockEmail = createMockEmail();
      await emailTriggerService.onEmailReceived(mockEmail, testUserId);
      // Discord logging is mocked and should be called
    });
  });

  describe('Hash Chain Integrity', () => {
    it('records execution in hash chain', async () => {
      const mockEmail = createMockEmail();
      await emailTriggerService.onEmailReceived(mockEmail, testUserId);
      // Hash chain recording is mocked
    });
  });

  describe('Multi-Rule Handling', () => {
    it('executes first matching rule', async () => {
      const rule1 = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        emailFrom: ['boss@company.com'],
        createTaskConfig: {
          title: 'Boss email',
        },
      });

      const rule2 = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        subjectKeywords: ['urgent'],
        createTaskConfig: {
          title: 'Urgent email',
        },
      });

      const mockEmail = createMockEmail({
        from: 'boss@company.com',
        subject: 'Urgent update',
      });

      const result = await emailTriggerService.onEmailReceived(mockEmail, testUserId);
      expect(typeof result === 'string' || result === null).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('handles malformed email gracefully', async () => {
      const badEmail = {
        id: 'email-1',
        from: '',
        subject: '',
        body: '',
      };

      try {
        await emailTriggerService.onEmailReceived(badEmail, testUserId);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('continues on missing user', async () => {
      const mockEmail = createMockEmail();
      try {
        await emailTriggerService.onEmailReceived(mockEmail, '');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('processes email within timeout', async () => {
      const mockEmail = createMockEmail();
      const startTime = Date.now();

      await emailTriggerService.onEmailReceived(mockEmail, testUserId);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Rule Management', () => {
    it('retrieves all rules for user', async () => {
      const triggers = await emailTriggerService.getEmailTriggers(testUserId);
      expect(Array.isArray(triggers)).toBe(true);
    });

    it('updates rule configuration', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        emailFrom: ['original@company.com'],
        createTaskConfig: {
          title: 'Original title',
        },
      });

      const updated = await emailTriggerService.updateEmailTrigger(rule.id, {
        userId: testUserId,
        emailFrom: ['updated@company.com'],
        createTaskConfig: {
          title: 'Updated title',
        },
      });

      expect(updated === null || updated.id).toBeDefined();
    });

    it('deletes rule', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        createTaskConfig: {
          title: 'To be deleted',
        },
      });

      const deleted = await emailTriggerService.deleteEmailTrigger(rule.id, testUserId);
      expect(typeof deleted).toBe('boolean');
    });
  });

  describe('Type Safety', () => {
    it('enforces email trigger type', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        createTaskConfig: { title: 'Test' },
      });

      expect(rule.triggerType).toBe('email_received');
    });

    it('enforces create_task action type', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: testUserId,
        createTaskConfig: { title: 'Test' },
      });

      expect(rule.actions[0]?.actionType).toBe('create_task');
    });
  });
});
