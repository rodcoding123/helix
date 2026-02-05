/**
 * Phase 10 Week 6: Audit Log Export Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  exportAuditLogs,
  getAuditLogStats,
  downloadAuditLogs,
  exportLogsByOperationType,
  exportLogsWithFilter,
  scheduleAuditExport,
} from './audit-export';
import * as supabaseModule from '@/lib/supabase';

// Mock Supabase - mock the entire module
const mockQuery = {
  select: vi.fn(function () { return this; }),
  eq: vi.fn(function () { return this; }),
  gte: vi.fn(function () { return this; }),
  lte: vi.fn(function () { return this; }),
  order: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  getDb: vi.fn(() => ({
    from: vi.fn(() => mockQuery),
  })),
}));

// Helper to get mocked getDb function
function getMockedGetDb() {
  return vi.mocked(supabaseModule.getDb);
}

// Helper to set up query response
function setupQueryResponse(data: any, error: any = null) {
  mockQuery.order.mockResolvedValueOnce({ data, error });
}

// Mock document for download tests
const mockElement = {
  href: '',
  download: '',
  click: vi.fn(),
};

// Sample audit logs
const sampleLogs = [
  {
    id: 'log-1',
    user_id: 'user-1',
    operation_id: 'op-1',
    operation_type: 'email_compose',
    status: 'success',
    started_at: '2024-02-01T10:00:00Z',
    completed_at: '2024-02-01T10:05:00Z',
    duration_ms: 300000,
    cost_usd: 0.05,
    latency_ms: 1200,
    input_tokens: 500,
    output_tokens: 800,
    model_used: 'claude-3-sonnet',
  },
];

describe('Audit Log Export Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Export Functions', () => {
    it('should return ExportResult with valid structure for CSV', async () => {
      setupQueryResponse(sampleLogs, null);

      const result = await exportAuditLogs('user-1', {
        format: 'csv',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 3),
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('recordCount');
      expect(result.filename).toContain('csv');
      expect(result.recordCount).toBe(1);
    });

    it('should return ExportResult with valid structure for JSON', async () => {
      setupQueryResponse(sampleLogs, null);

      const result = await exportAuditLogs('user-1', {
        format: 'json',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 3),
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('recordCount');
      expect(result.filename).toContain('json');
      expect(result.recordCount).toBe(1);
    });

    it('should handle empty result set', async () => {
      setupQueryResponse([], null);

      const result = await exportAuditLogs('user-1', {
        format: 'csv',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 3),
      });

      expect(result.recordCount).toBe(0);
      expect(result.size).toBeGreaterThanOrEqual(0);
    });

    it('should filter fields when specified', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: sampleLogs,
        error: null,
      });

      const result = await exportAuditLogs('user-1', {
        format: 'csv',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 3),
        fields: ['operation_type', 'status'],
      });

      expect(result.recordCount).toBe(1);
      expect(result.filename).toBeTruthy();
    });

    it('should throw on database error', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      query.order.mockResolvedValue({
        data: null,
        error: { message: 'DB Error' },
      });

      await expect(
        exportAuditLogs('user-1', {
          format: 'csv',
          startDate: new Date(2024, 1, 1),
          endDate: new Date(2024, 1, 3),
        })
      ).rejects.toThrow();
    });
  });

  describe('Export by Operation Type', () => {
    it('should export logs filtered by operation type', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: sampleLogs.filter(l => l.operation_type === 'email_compose'),
        error: null,
      });

      const result = await exportLogsByOperationType(
        'user-1',
        'email_compose',
        new Date(2024, 1, 1),
        new Date(2024, 1, 3),
        'csv'
      );

      expect(result.recordCount).toBe(1);
      expect(result.filename).toContain('email_compose');
    });
  });

  describe('Export with Filters', () => {
    it('should apply multiple filters', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: sampleLogs.filter(l => l.status === 'success'),
        error: null,
      });

      const result = await exportLogsWithFilter(
        'user-1',
        {
          startDate: new Date(2024, 1, 1),
          endDate: new Date(2024, 1, 3),
          status: 'success',
          minCost: 0.01,
          maxCost: 0.10,
        },
        'json'
      );

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('recordCount');
      expect(result.recordCount).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should calculate statistics from logs', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      const statsData = [
        { status: 'success', cost_usd: 0.05, latency_ms: 1200, operation_type: 'email_compose' },
        { status: 'success', cost_usd: 0.08, latency_ms: 950, operation_type: 'code_review' },
        { status: 'failure', cost_usd: 0.02, latency_ms: 500, operation_type: 'email_compose' },
      ];

      // Setup mock chain for select().eq().gte().lte()
      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockResolvedValue({
        data: statsData,
        error: null,
      });

      const stats = await getAuditLogStats('user-1', new Date(2024, 1, 1), new Date(2024, 1, 3));

      expect(stats).toHaveProperty('totalRecords');
      expect(stats).toHaveProperty('successCount');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('totalCost');
      expect(stats).toHaveProperty('averageLatency');
      expect(stats).toHaveProperty('operationTypes');
      expect(stats.totalRecords).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
    });
  });

  describe('Download Integration', () => {
    it('should trigger browser download', async () => {
      // Mock document methods
      const originalCreateElement = document.createElement;
      const originalAppendChild = document.body.appendChild;
      const originalRemoveChild = document.body.removeChild;

      document.createElement = vi.fn(() => mockElement as any);
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();

      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: sampleLogs,
        error: null,
      });

      await downloadAuditLogs('user-1', {
        format: 'csv',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 3),
      });

      expect(mockElement.click).toHaveBeenCalled();

      // Restore
      document.createElement = originalCreateElement;
      document.body.appendChild = originalAppendChild;
      document.body.removeChild = originalRemoveChild;
    });
  });

  describe('Scheduled Exports', () => {
    it('should schedule exports at intervals', () => {
      vi.useFakeTimers();

      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: sampleLogs,
        error: null,
      });

      const timer = scheduleAuditExport('user-1', 'daily');
      expect(timer).toBeDefined();

      vi.useRealTimers();
      clearInterval(timer);
    });

    it('should support different intervals', () => {
      vi.useFakeTimers();

      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({ data: [], error: null });

      const dailyTimer = scheduleAuditExport('user-1', 'daily');
      const weeklyTimer = scheduleAuditExport('user-1', 'weekly');
      const monthlyTimer = scheduleAuditExport('user-1', 'monthly');

      expect(dailyTimer).toBeDefined();
      expect(weeklyTimer).toBeDefined();
      expect(monthlyTimer).toBeDefined();

      vi.useRealTimers();
      clearInterval(dailyTimer);
      clearInterval(weeklyTimer);
      clearInterval(monthlyTimer);
    });
  });

  describe('Blob Generation', () => {
    it('should generate CSV blob with correct MIME type', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: sampleLogs,
        error: null,
      });

      const result = await exportAuditLogs('user-1', {
        format: 'csv',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 3),
      });

      expect(result.data.type).toBe('text/csv;charset=utf-8');
    });

    it('should generate JSON blob with correct MIME type', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: sampleLogs,
        error: null,
      });

      const result = await exportAuditLogs('user-1', {
        format: 'json',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 3),
      });

      expect(result.data.type).toBe('application/json;charset=utf-8');
    });
  });

  describe('Filename Generation', () => {
    it('should generate valid CSV filenames', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await exportAuditLogs('user-1', {
        format: 'csv',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 28),
      });

      expect(result.filename).toMatch(/^audit-logs-.+\.csv$/);
    });

    it('should generate valid JSON filenames', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await exportAuditLogs('user-1', {
        format: 'json',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 28),
      });

      expect(result.filename).toMatch(/^audit-logs-.+\.json$/);
    });
  });

  describe('Large Exports', () => {
    it('should handle large result sets', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      // Create 1000 sample logs
      const largeLogs = Array.from({ length: 1000 }, (_, i) => ({
        ...sampleLogs[0],
        id: `log-${i}`,
      }));

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: largeLogs,
        error: null,
      });

      const result = await exportAuditLogs('user-1', {
        format: 'csv',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 3),
      });

      expect(result.recordCount).toBe(1000);
      expect(result.size).toBeGreaterThan(5000);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValueOnce(query as any);
      vi.mocked(query.eq).mockReturnValueOnce(query as any);
      vi.mocked(query.gte).mockReturnValueOnce(query as any);
      vi.mocked(query.lte).mockReturnValueOnce(query as any);
      vi.mocked(query.order).mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      await expect(
        exportAuditLogs('user-1', {
          format: 'csv',
          startDate: new Date(2024, 1, 1),
          endDate: new Date(2024, 1, 3),
        })
      ).rejects.toThrow();
    });

    it('should handle null data gracefully', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await exportAuditLogs('user-1', {
        format: 'json',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 3),
      });

      expect(result.recordCount).toBe(0);
    });
  });

  describe('Field Selection', () => {
    it('should support custom field selection', async () => {
      // getDb is already mocked, call it directly
      const getDb = getMockedGetDb();
      const mockDb = getDb();
      const query = mockDb.from();

      vi.mocked(query.select).mockReturnValue(query as any);
      vi.mocked(query.eq).mockReturnValue(query as any);
      vi.mocked(query.gte).mockReturnValue(query as any);
      vi.mocked(query.lte).mockReturnValue(query as any);
      vi.mocked(query.order).mockResolvedValue({
        data: sampleLogs,
        error: null,
      });

      const result = await exportAuditLogs('user-1', {
        format: 'csv',
        startDate: new Date(2024, 1, 1),
        endDate: new Date(2024, 1, 3),
        fields: ['operation_type', 'status', 'cost_usd'],
      });

      expect(result.recordCount).toBe(1);
      expect(result.filename).toBeTruthy();
    });
  });
});
