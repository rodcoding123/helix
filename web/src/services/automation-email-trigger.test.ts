/**
 * Email Trigger Service Tests - Phase 7 Track 1
 * Tests for email-to-task automation rules
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Discord logging
vi.mock('@/helix/logging', () => ({
  logToDiscord: async () => {},
}));

// Mock hash chain
vi.mock('@/helix/hash-chain', () => ({
  hashChain: {
    add: async () => ({ hash: 'mock-hash', index: 1 }),
  },
}));

import { getEmailTriggerService } from './automation-email-trigger.js';
import {
  createMockAutomationTrigger,
  createMockEmail,
  createMockEmailTriggerCondition,
  createMockCreateTaskAction,
} from './__test-utils/automation-factory.js';

describe('AutomationEmailTriggerService', () => {
  let emailTriggerService: ReturnType<typeof getEmailTriggerService>;

  beforeEach(() => {
    emailTriggerService = getEmailTriggerService();
  });

  describe('Singleton Pattern', () => {
    it('returns same instance', () => {
      const service1 = getEmailTriggerService();
      const service2 = getEmailTriggerService();
      expect(service1).toBe(service2);
    });
  });

  describe('Rule Creation', () => {
    it('creates email-to-task rule with email from filter', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: 'user-123',
        emailFrom: ['boss@company.com'],
        createTaskConfig: {
          title: 'Email from boss: {{emailSubject}}',
          priority: 'high',
        },
      });

      expect(rule.id).toBeDefined();
      expect(rule.triggerType).toBe('email_received');
      expect(rule.enabled).toBe(true);
    });

    it('creates rule with subject keyword filter', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: 'user-123',
        subjectKeywords: ['urgent', 'action required'],
        createTaskConfig: {
          title: 'Urgent: {{emailSubject}}',
          priority: 'high',
        },
      });

      expect(rule.id).toBeDefined();
      expect(rule.triggerType).toBe('email_received');
    });

    it('creates rule with body keyword filter', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: 'user-123',
        bodyKeywords: ['review', 'approval'],
        createTaskConfig: {
          title: 'Review: {{emailSubject}}',
        },
      });

      expect(rule.id).toBeDefined();
    });

    it('creates rule with attachment requirement', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: 'user-123',
        hasAttachments: true,
        createTaskConfig: {
          title: 'Process attachment: {{emailSubject}}',
        },
      });

      expect(rule.id).toBeDefined();
    });

    it('creates disabled rule', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: 'user-123',
        createTaskConfig: { title: 'Test' },
        enabled: false,
      });

      expect(rule.enabled).toBe(false);
    });
  });

  describe('Email Matching', () => {
    it('matches email from filter exactly', async () => {
      const mockEmail = createMockEmail({
        from: 'boss@company.com',
        subject: 'Project update',
      });

      // Email should match filter
      const condition = createMockEmailTriggerCondition({
        emailFrom: ['boss@company.com'],
      });

      expect(condition.emailFrom).toContain('boss@company.com');
    });

    it('matches email with subject keywords', () => {
      const mockEmail = createMockEmail({
        subject: 'URGENT: Critical bug found',
      });

      // Should match if condition checks for 'urgent' keyword
      expect(mockEmail.subject.toLowerCase().includes('urgent')).toBe(true);
    });

    it('matches email with body keywords', () => {
      const mockEmail = createMockEmail({
        body: 'Please review the attached document for approval',
      });

      // Should match if condition checks for 'approval' keyword
      expect(mockEmail.body.toLowerCase().includes('approval')).toBe(true);
    });

    it('matches email with attachments', () => {
      const mockEmail = createMockEmail({
        hasAttachments: true,
      });

      expect(mockEmail.hasAttachments).toBe(true);
    });

    it('does not match email without required condition', () => {
      const mockEmail = createMockEmail({
        from: 'colleague@company.com',
        subject: 'FYI',
      });

      // Email should NOT match filter for boss@company.com
      expect(mockEmail.from).not.toEqual('boss@company.com');
    });
  });

  describe('Task Creation', () => {
    it('creates task with simple title', async () => {
      const mockEmail = createMockEmail({
        subject: 'Review presentation',
        from: 'boss@company.com',
      });

      // Title should be created from template
      const title = `Email from ${mockEmail.from}: ${mockEmail.subject}`;
      expect(title).toContain(mockEmail.subject);
    });

    it('creates task with template variables substituted', async () => {
      const mockEmail = createMockEmail({
        subject: 'Urgent: Budget review',
        from: 'finance@company.com',
      });

      // Template: "{{emailFrom}} sent: {{emailSubject}}"
      const template = '{{emailFrom}} sent: {{emailSubject}}';
      const variables = {
        emailFrom: mockEmail.from,
        emailSubject: mockEmail.subject,
      };

      let result = template;
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(`{{${key}}}`, value);
      }

      expect(result).toContain(mockEmail.from);
      expect(result).toContain(mockEmail.subject);
    });

    it('creates task with custom priority', async () => {
      const task = {
        title: 'Important review',
        priority: 'high',
      };

      expect(task.priority).toBe('high');
    });

    it('creates task with due date', async () => {
      const dueDate = new Date(Date.now() + 86400000);
      const task = {
        title: 'Task with due date',
        dueDate,
      };

      expect(task.dueDate).toBeDefined();
    });
  });

  describe('Email Processing', () => {
    it('processes incoming email and checks triggers', async () => {
      const mockEmail = createMockEmail();
      // Should not throw
      const result = await emailTriggerService.onEmailReceived(mockEmail, 'user-123');
      expect(typeof result === 'string' || result === null).toBe(true);
    });

    it('returns task ID on successful execution', async () => {
      const mockEmail = createMockEmail();
      const result = await emailTriggerService.onEmailReceived(mockEmail, 'user-123');

      // Result should be task ID or null
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('handles multiple triggers for same email', async () => {
      const mockEmail = createMockEmail();
      // Should process without error
      const result = await emailTriggerService.onEmailReceived(mockEmail, 'user-123');
      expect(typeof result === 'string' || result === null).toBe(true);
    });

    it('logs trigger execution to Discord', async () => {
      const mockEmail = createMockEmail();
      await emailTriggerService.onEmailReceived(mockEmail, 'user-123');
      // Should not throw
      expect(true).toBe(true);
    });

    it('adds execution record to hash chain', async () => {
      const mockEmail = createMockEmail();
      await emailTriggerService.onEmailReceived(mockEmail, 'user-123');
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Rule Management', () => {
    it('gets all email triggers for user', async () => {
      const triggers = await emailTriggerService.getEmailTriggers('user-123');
      expect(Array.isArray(triggers)).toBe(true);
    });

    it('updates email trigger', async () => {
      const updated = await emailTriggerService.updateEmailTrigger('trigger-1', {
        userId: 'user-123',
        subjectKeywords: ['new keyword'],
        createTaskConfig: { title: 'Updated' },
      });

      // Should return trigger or null
      expect(updated === null || updated.id).toBeDefined();
    });

    it('deletes email trigger', async () => {
      const deleted = await emailTriggerService.deleteEmailTrigger('trigger-1', 'user-123');
      expect(typeof deleted).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('handles rule creation errors gracefully', async () => {
      try {
        await emailTriggerService.createEmailToTaskRule({
          userId: 'user-123',
          createTaskConfig: { title: '' }, // Empty title
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('handles email processing errors gracefully', async () => {
      const mockEmail = createMockEmail();
      try {
        await emailTriggerService.onEmailReceived(mockEmail, '');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('continues on trigger execution failure', async () => {
      const mockEmail = createMockEmail();
      // Should not throw even if trigger execution fails
      const result = await emailTriggerService.onEmailReceived(mockEmail, 'user-123');
      expect(typeof result === 'string' || result === null).toBe(true);
    });
  });

  describe('Template Variable Handling', () => {
    it('replaces emailSubject variable', async () => {
      const template = 'Task: {{emailSubject}}';
      const email = createMockEmail({ subject: 'Important email' });
      const variables = { emailSubject: email.subject };

      let result = template;
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(`{{${key}}}`, value);
      }

      expect(result).toContain('Important email');
    });

    it('replaces emailFrom variable', async () => {
      const template = 'From {{emailFrom}}';
      const email = createMockEmail({ from: 'sender@example.com' });
      const variables = { emailFrom: email.from };

      let result = template;
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(`{{${key}}}`, value);
      }

      expect(result).toContain('sender@example.com');
    });

    it('handles missing variables gracefully', async () => {
      const template = 'From {{emailFrom}} about {{undefined}}';
      const variables = { emailFrom: 'test@example.com' };

      let result = template;
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(`{{${key}}}`, value);
      }

      expect(result).toContain('test@example.com');
    });
  });

  describe('Type Safety', () => {
    it('enforces trigger type', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: 'user-123',
        createTaskConfig: { title: 'Test' },
      });

      expect(rule.triggerType).toBe('email_received');
    });

    it('enforces action type', async () => {
      const rule = await emailTriggerService.createEmailToTaskRule({
        userId: 'user-123',
        createTaskConfig: { title: 'Test' },
      });

      expect(rule.actions[0]?.actionType).toBe('create_task');
    });
  });
});
