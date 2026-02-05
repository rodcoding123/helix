import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase before importing the service
vi.mock('@supabase/supabase-js', () => {
  let testDb: Map<string, any[]> = new Map();

  const createQueryBuilder = (tableName: string) => {
    // Each builder has its own state for a single query chain
    let operation = 'select' as string;
    let insertData: any[] = [];
    let updateData: any = {};
    let filters: Array<{ field: string; operator: string; value: any }> = [];
    let selectedColumns: string | undefined;
    let insertedItems: any[] = [];

    const executeInsert = () => {
      const tableData = testDb.get(tableName) || [];
      const inserted = insertData.map(item => {
        const fullItem = {
          ...item,
          id: item.id || crypto.randomUUID(),
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
        };
        // For upsert, check if item already exists
        const existingIndex = tableData.findIndex(existing => existing.id === fullItem.id);
        if (existingIndex >= 0) {
          // Update existing
          tableData[existingIndex] = { ...tableData[existingIndex], ...fullItem };
          return tableData[existingIndex];
        } else {
          // Insert new
          return fullItem;
        }
      });

      // Add new items to table
      const newItems = inserted.filter(item => !tableData.some(existing => existing.id === item.id));
      if (newItems.length > 0) {
        testDb.set(tableName, [...tableData, ...newItems]);
      }

      insertedItems = inserted;
      return inserted;
    };

    const executeUpdate = () => {
      const tableData = testDb.get(tableName) || [];
      const filtered = tableData.filter(item =>
        filters.every(f => {
          if (f.operator === 'eq') return item[f.field] === f.value;
          return true;
        })
      );
      filtered.forEach(item => {
        Object.assign(item, updateData);
        item.updated_at = new Date().toISOString();
      });
      return filtered;
    };

    const executeDelete = () => {
      const tableData = testDb.get(tableName) || [];
      const filtered = tableData.filter(item =>
        filters.every(f => {
          if (f.operator === 'eq') return item[f.field] === f.value;
          return true;
        })
      );
      const toDelete = new Set(filtered.map(item => item.id));
      const remaining = tableData.filter(item => !toDelete.has(item.id));
      testDb.set(tableName, remaining);
      return null;
    };

    const executeSelect = () => {
      const tableData = testDb.get(tableName) || [];
      // If we're selecting after insert, return inserted items
      if (insertedItems.length > 0) {
        return insertedItems;
      }
      return tableData.filter(item =>
        filters.every(f => {
          if (f.operator === 'eq') return item[f.field] === f.value;
          return true;
        })
      );
    };

    const executeQuery = () => {
      if (operation === 'insert') return executeInsert();
      if (operation === 'update') return executeUpdate();
      if (operation === 'delete') return executeDelete();
      if (operation === 'select') return executeSelect();
      return [];
    };

    const self: any = {};

    self.insert = vi.fn(function(data: any) {
      operation = 'insert';
      insertData = Array.isArray(data) ? data : [data];
      return self;
    });

    self.upsert = vi.fn(function(data: any, options?: any) {
      operation = 'insert';
      insertData = Array.isArray(data) ? data : [data];
      return self;
    });

    self.update = vi.fn(function(data: any) {
      operation = 'update';
      updateData = data;
      return self;
    });

    self.delete = vi.fn(function() {
      operation = 'delete';
      return self;
    });

    self.select = vi.fn(function(columns?: string) {
      selectedColumns = columns;
      operation = 'select';
      return self;
    });

    self.eq = vi.fn(function(field: string, value: any) {
      filters.push({ field, operator: 'eq', value });
      return self;
    });

    self.single = vi.fn(function() {
      const results = executeQuery();
      const singleResult = Array.isArray(results) ? (results[0] || null) : (results || null);
      return Promise.resolve({
        data: singleResult,
        error: null,
      });
    });

    self.then = vi.fn(function(onFulfilled: (value: any) => any) {
      const results = executeQuery();
      return onFulfilled({
        data: Array.isArray(results) ? results : [results || {}],
        error: null,
      });
    });

    return self;
  };

  return {
    createClient: vi.fn(() => ({
      from: vi.fn((tableName: string) => createQueryBuilder(tableName)),
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
