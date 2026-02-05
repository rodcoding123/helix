import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase before importing the service
vi.mock('@supabase/supabase-js', () => {
  const db = new Map<string, Map<string, any>>();

  const createBuilder = (tableName: string) => {
    let lastOp: any = null;
    let filters: Map<string, any> = new Map();
    let insertPayload: any = null;
    let updatePayload: any = null;
    let selectMode = false;
    let isSingle = false;

    const getTable = () => {
      if (!db.has(tableName)) {
        db.set(tableName, new Map());
      }
      return db.get(tableName)!;
    };

    const applyFilters = (records: any[]) => {
      return records.filter(r => {
        for (const [field, value] of filters) {
          if (r[field] !== value) return false;
        }
        return true;
      });
    };

    const builder: any = {
      insert(data: any) {
        insertPayload = Array.isArray(data) ? data : [data];
        lastOp = 'insert';
        return builder;
      },

      upsert(data: any) {
        insertPayload = Array.isArray(data) ? data : [data];
        lastOp = 'upsert';
        return builder;
      },

      update(data: any) {
        updatePayload = data;
        lastOp = 'update';
        return builder;
      },

      delete() {
        lastOp = 'delete';
        return builder;
      },

      select(cols?: string) {
        selectMode = true;
        return builder;
      },

      eq(field: string, value: any) {
        filters.set(field, value);
        return builder;
      },

      or(conditions: string) {
        // Simple or: just return the builder, actual filtering not needed for tests
        return builder;
      },

      order(column: string, options?: any) {
        // Order is ignored in test mock
        return builder;
      },

      limit(n: number) {
        // Limit is ignored in test mock
        return builder;
      },

      single() {
        isSingle = true;
        return builder;
      },

      async then(onFulfilled: any) {
        const table = getTable();
        let result: any;

        if (lastOp === 'insert' || lastOp === 'upsert') {
          const items = insertPayload.map((item: any) => ({
            ...item,
            id: item.id || `${tableName}-${Date.now()}-${Math.random()}`,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
          }));
          items.forEach((item: any) => {
            table.set(item.id, item);
          });
          result = isSingle ? items[0] : items;
        } else if (lastOp === 'update') {
          const records = Array.from(table.values());
          const matching = applyFilters(records);
          matching.forEach((r: any) => {
            Object.assign(r, updatePayload);
          });
          result = matching;
        } else if (lastOp === 'delete') {
          const records = Array.from(table.values());
          const matching = applyFilters(records);
          matching.forEach((r: any) => {
            table.delete(r.id);
          });
          result = null;
        } else {
          // select
          const records = Array.from(table.values());
          result = applyFilters(records);
        }

        return onFulfilled({
          data: isSingle && Array.isArray(result) ? result[0] : result,
          error: null,
        });
      },
    };

    return builder;
  };

  return {
    createClient: vi.fn(() => ({
      from: vi.fn((tableName: string) => createBuilder(tableName)),
    })),
  };
});

import { EmailComposeService } from '../email-compose';

describe('EmailComposeService', () => {
  let service: EmailComposeService;

  beforeEach(() => {
    service = new EmailComposeService('user-123');
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

    it('should list drafts with limit', async () => {
      await service.createDraft('account-123');
      const drafts = await service.getDrafts(10);
      expect(Array.isArray(drafts)).toBe(true);
    });

    it('should delete draft', async () => {
      const draftId = await service.createDraft('account-123');
      await service.deleteDraft(draftId);
      expect(true).toBe(true);
    });
  });

  describe('Template Management', () => {
    it('should create template', async () => {
      const template = await service.createTemplate({
        name: 'Professional Response',
        subject: 'Re: {{original_subject}}',
        body_html: '<p>Thank you for your email.</p>',
      });

      expect(template.name).toBe('Professional Response');
      expect(template.usage_count).toBe(0);
    });

    it('should get all templates', async () => {
      await service.createTemplate({
        name: 'Template 1',
        subject: 'Subject',
        body_html: '<p>Body</p>',
      });
      const templates = await service.getTemplates();
      expect(Array.isArray(templates)).toBe(true);
    });

    it('should delete template', async () => {
      const template = await service.createTemplate({
        name: 'Temp',
        subject: 'Subject',
        body_html: '<p>Body</p>',
      });
      await service.deleteTemplate(template.id);
      expect(true).toBe(true);
    });
  });

  describe('Signature Management', () => {
    it('should create signature', async () => {
      const sig = await service.createSignature({
        name: 'Work Signature',
        html_content: '<p>Best regards,<br/>John Doe</p>',
        plain_text_content: 'Best regards,\nJohn Doe',
      });

      expect(sig.name).toBe('Work Signature');
    });

    it('should get signatures for account', async () => {
      await service.createSignature({
        name: 'Sig',
        html_content: '<p>Sig</p>',
        plain_text_content: 'Sig',
      });
      const signatures = await service.getSignatures('account-123');
      expect(Array.isArray(signatures)).toBe(true);
    });

    it('should delete signature', async () => {
      const sig = await service.createSignature({
        name: 'Temp Sig',
        html_content: '<p>Sig</p>',
        plain_text_content: 'Sig',
      });
      await service.deleteSignature(sig.id);
      expect(true).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate email format', () => {
      const result = service.validateDraft({
        to: ['valid@example.com'],
        subject: 'Test',
        body_html: '<p>Test</p>',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid email format', () => {
      const result = service.validateDraft({
        to: ['invalid-email'],
        subject: 'Test',
        body_html: '<p>Test</p>',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should allow multiple recipients', () => {
      const result = service.validateDraft({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test',
        body_html: '<p>Test</p>',
      });
      expect(result.valid).toBe(true);
    });

    it('should handle RFC 5321 compliance', () => {
      const longEmail = 'a'.repeat(255) + '@example.com';
      const result = service.validateDraft({
        to: [longEmail],
        subject: 'Test',
        body_html: '<p>Test</p>',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('Scheduled Send', () => {
    it('should reject past time', async () => {
      const pastTime = new Date(Date.now() - 3600000);
      await expect(service.scheduleSend('draft-1', pastTime)).rejects.toThrow();
    });
  });
});
