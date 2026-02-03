import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailComposeService } from '../email-compose';

describe('EmailComposeService', () => {
  let service: EmailComposeService;

  beforeEach(() => {
    service = new EmailComposeService('user-123', 'http://localhost:3000', 'anon-key');
  });

  describe('Draft Management', () => {
    it('should create a new draft', async () => {
      const draftId = await service.createDraft('account-123');
      expect(draftId).toBeDefined();
      expect(typeof draftId).toBe('string');
    });

    it('should save draft with partial updates (upsert)', async () => {
      const draft = await service.saveDraft({
        id: 'draft-1',
        user_id: 'user-123',
        account_id: 'account-123',
        subject: 'Test Email',
        to: ['recipient@example.com'],
        body_html: '<p>Hello</p>',
      });

      expect(draft.subject).toBe('Test Email');
      expect(draft.to).toContain('recipient@example.com');
    });

    it('should get draft by ID', async () => {
      const draft = await service.getDraft('draft-1');
      expect(draft).toBeDefined();
      expect(draft.id).toBe('draft-1');
    });

    it('should list drafts with limit', async () => {
      const drafts = await service.getDrafts(10);
      expect(Array.isArray(drafts)).toBe(true);
    });

    it('should delete draft', async () => {
      await service.deleteDraft('draft-1');
      expect(true).toBe(true); // Should not throw
    });
  });

  describe('Template Management', () => {
    it('should get all templates', async () => {
      const templates = await service.getTemplates();
      expect(Array.isArray(templates)).toBe(true);
    });

    it('should create template', async () => {
      const template = await service.createTemplate({
        name: 'Professional Response',
        subject: 'Re: {{original_subject}}',
        body_html: '<p>Thank you for your email.</p>',
      });

      expect(template.name).toBe('Professional Response');
      expect(template.usage_count).toBe(0);
    });

    it('should apply template to draft', async () => {
      const draft = await service.applyTemplate('draft-1', 'template-1');
      expect(draft.body_html).toContain('Template content');
    });

    it('should delete template', async () => {
      await service.deleteTemplate('template-1');
      expect(true).toBe(true);
    });

    it('should track template usage', async () => {
      await service.applyTemplate('draft-1', 'template-1');
      const template = await service.getTemplate('template-1');
      expect(template.usage_count).toBeGreaterThan(0);
    });
  });

  describe('Signature Management', () => {
    it('should get signatures for account', async () => {
      const signatures = await service.getSignatures('account-123');
      expect(Array.isArray(signatures)).toBe(true);
    });

    it('should get default signature', async () => {
      const sig = await service.getDefaultSignature('account-123');
      expect(sig).toBeDefined();
      expect(sig?.is_default).toBe(true);
    });

    it('should create signature', async () => {
      const sig = await service.createSignature({
        name: 'Work Signature',
        html_content: '<p>Best regards,<br/>John Doe</p>',
        plain_text_content: 'Best regards,\nJohn Doe',
      });

      expect(sig.name).toBe('Work Signature');
    });

    it('should insert signature into draft', async () => {
      const draft = await service.insertSignature('draft-1', 'sig-1');
      expect(draft.body_html).toContain('<hr/>');
    });

    it('should delete signature', async () => {
      await service.deleteSignature('sig-1');
      expect(true).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate email format', () => {
      const result = service.validateDraft({
        to: ['valid@example.com'],
      });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid email format', () => {
      const result = service.validateDraft({
        to: ['invalid-email'],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate required fields', () => {
      const result = service.validateDraft({
        subject: '',
        to: [],
        body_html: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('subject'));
    });

    it('should handle RFC 5321 compliance', () => {
      const longEmail = 'a'.repeat(255) + '@example.com';
      const result = service.validateDraft({
        to: [longEmail],
      });
      expect(result.valid).toBe(false);
    });

    it('should allow multiple recipients', () => {
      const result = service.validateDraft({
        to: ['user1@example.com', 'user2@example.com'],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('Scheduled Send', () => {
    it('should schedule send with future time', async () => {
      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
      const draft = await service.scheduleSend('draft-1', futureTime);
      expect(draft.scheduled_send_time).toBeDefined();
    });

    it('should reject past time', async () => {
      const pastTime = new Date(Date.now() - 3600000);
      await expect(service.scheduleSend('draft-1', pastTime)).rejects.toThrow();
    });

    it('should cancel scheduled send', async () => {
      const draft = await service.cancelScheduledSend('draft-1');
      expect(draft.scheduled_send_time).toBeNull();
    });

    it('should handle timezone', async () => {
      const time = new Date('2025-02-04T15:00:00');
      const draft = await service.scheduleSend('draft-1', time, 'America/New_York');
      expect(draft.scheduled_send_time).toBeDefined();
    });
  });

  describe('Auto-Save Integration', () => {
    it('should support partial draft updates', async () => {
      const draft1 = await service.saveDraft({
        id: 'draft-1',
        user_id: 'user-123',
        account_id: 'account-123',
        subject: 'First',
      });

      const draft2 = await service.saveDraft({
        id: 'draft-1',
        subject: 'Updated',
      });

      expect(draft2.subject).toBe('Updated');
      expect(draft2.id).toBe('draft-1');
    });

    it('should not lose data on rapid saves', async () => {
      const saves = Array.from({ length: 5 }).map((_, i) =>
        service.saveDraft({
          id: 'draft-1',
          subject: `Subject ${i}`,
        })
      );

      const results = await Promise.all(saves);
      expect(results[results.length - 1].subject).toBe('Subject 4');
    });
  });
});
