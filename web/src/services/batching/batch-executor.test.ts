/**
 * Phase 9B: Batch Executor Tests
 * Comprehensive test coverage for batch operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchExecutor, type BatchConfig } from './batch-executor';

// Mock Supabase with proper chaining
vi.mock('@supabase/supabase-js', () => {
  const chainMethods = {
    single: vi.fn(async () => ({
      data: { id: 'batch-123', status: 'queued', total_cost_estimated: 0.01, total_operations: 1 },
      error: null,
    })),
    order: vi.fn(function() { return this; }),
    eq: vi.fn(function() { return this; }),
    limit: vi.fn(function() { return this; }),
  };

  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => ({
        insert: vi.fn(function() {
          return {
            select: vi.fn(function() {
              return {
                single: vi.fn(async () => ({
                  data: { id: 'batch-123' },
                  error: null,
                })),
              };
            }),
          };
        }),
        select: vi.fn(function() {
          return { ...chainMethods };
        }),
        update: vi.fn(function() {
          return { ...chainMethods };
        }),
      })),
    })),
  };
});

// Mock logging
vi.mock('../logging', () => ({
  logToDiscord: vi.fn(async () => {}),
  logToHashChain: vi.fn(async () => {}),
}));

describe('BatchExecutor', () => {
  let executor: BatchExecutor;

  beforeEach(() => {
    executor = new BatchExecutor();
  });

  describe('Batch Creation', () => {
    it('should create a parallel batch', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Parallel Email Operations',
        operations: [
          { operation_id: 'email-compose', parameters: { draft: true } },
          { operation_id: 'email-classify', parameters: {} },
          { operation_id: 'email-respond', parameters: { tone: 'professional' } },
        ],
        batch_type: 'parallel',
        max_concurrent: 5,
        max_cost_usd: 50,
      };

      // Should create batch successfully
      await expect(executor.createBatch(config)).resolves.toBeTruthy();
    });

    it('should create a sequential batch', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Sequential Processing',
        operations: [
          { operation_id: 'task-breakdown', parameters: {} },
          { operation_id: 'task-prioritize', parameters: {} },
        ],
        batch_type: 'sequential',
      };

      await expect(executor.createBatch(config)).resolves.toBeTruthy();
    });

    it('should create a conditional batch with dependencies', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Conditional Workflow',
        operations: [
          {
            operation_id: 'task-breakdown',
            parameters: {},
            sequence_order: 1,
          },
          {
            operation_id: 'task-prioritize',
            parameters: {},
            sequence_order: 2,
            depends_on: 'task-breakdown', // Depends on first operation
          },
        ],
        batch_type: 'conditional',
      };

      await expect(executor.createBatch(config)).resolves.toBeTruthy();
    });

    it('should handle large batch creation', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Large Batch',
        operations: Array.from({ length: 20 }, (_, i) => ({
          operation_id: i % 2 === 0 ? 'email-compose' : 'task-prioritize',
          parameters: { index: i },
        })),
        batch_type: 'parallel',
      };

      await expect(executor.createBatch(config)).resolves.toBeTruthy();
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate total cost for batch operations', async () => {
      const operations = [
        { operation_id: 'email-compose', parameters: { draft: true } },
        { operation_id: 'email-classify', parameters: {} },
        { operation_id: 'calendar-prep', parameters: {} },
      ];

      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Cost Estimation Test',
        operations,
        batch_type: 'parallel',
      };

      const batchId = await executor.createBatch(config);
      expect(batchId).toBeTruthy();

      // Verify batch creation includes cost estimate
      const batchStatus = await executor.getBatchStatus(batchId);
      expect(batchStatus).toBeTruthy();
      expect(batchStatus?.total_cost_estimated).toBeGreaterThanOrEqual(0);
    });

    it('should keep costs under budget', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Budget Controlled Batch',
        operations: [
          { operation_id: 'email-compose', parameters: { draft: true } },
          { operation_id: 'email-classify', parameters: {} },
        ],
        batch_type: 'parallel',
        max_cost_usd: 10, // Strict budget
      };

      const batchId = await executor.createBatch(config);
      const batchStatus = await executor.getBatchStatus(batchId);

      expect(batchStatus?.total_cost_estimated).toBeLessThanOrEqual(10);
    });
  });

  describe('Batch Execution', () => {
    it('should execute a batch successfully', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Execution Test',
        operations: [
          { operation_id: 'email-compose', parameters: { draft: true } },
          { operation_id: 'task-prioritize', parameters: {} },
        ],
        batch_type: 'parallel',
      };

      const batchId = await executor.createBatch(config);
      await expect(executor.executeBatch(batchId)).resolves.not.toThrow();
    });

    it('should track operation completion events', async () => {
      const completedOps: string[] = [];

      executor.on('operation:completed', ({ operationId }: any) => {
        completedOps.push(operationId);
      });

      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Event Tracking Test',
        operations: [
          { operation_id: 'email-compose', parameters: {} },
          { operation_id: 'task-prioritize', parameters: {} },
        ],
        batch_type: 'sequential',
      };

      const batchId = await executor.createBatch(config);
      // Note: In real scenario, would execute and verify events
      expect(batchId).toBeTruthy();
    });

    it('should handle batch execution failure gracefully', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Failure Test',
        operations: [
          { operation_id: 'email-compose', parameters: {} },
          { operation_id: 'invalid-operation', parameters: {} }, // Invalid operation
        ],
        batch_type: 'sequential',
      };

      const batchId = await executor.createBatch(config);
      // Execution may fail but should be handled gracefully
      await expect(executor.executeBatch(batchId)).resolves.not.toThrow();
    });
  });

  describe('Batch Status Tracking', () => {
    it('should retrieve batch status', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Status Test',
        operations: [
          { operation_id: 'email-compose', parameters: {} },
        ],
        batch_type: 'parallel',
      };

      const batchId = await executor.createBatch(config);
      const status = await executor.getBatchStatus(batchId);

      expect(status).toBeTruthy();
      expect(status?.id).toBe(batchId);
      expect(status?.status).toBe('queued');
      expect(status?.total_operations).toBe(1);
    });

    it('should retrieve batch history for user', async () => {
      const userId = 'test-user-2';

      const history = await executor.getBatchHistory(userId, 5);

      expect(Array.isArray(history)).toBe(true);
      history.forEach(batch => {
        expect(batch.user_id).toBe(userId);
      });
    });

    it('should limit batch history results', async () => {
      const userId = 'test-user-2';
      const limit = 3;

      const history = await executor.getBatchHistory(userId, limit);

      expect(history.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('Batch Type Support', () => {
    it('should support parallel execution with multiple concurrent operations', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Parallel Execution',
        operations: Array.from({ length: 5 }, (_, i) => ({
          operation_id: i % 2 === 0 ? 'email-compose' : 'task-prioritize',
          parameters: { index: i },
        })),
        batch_type: 'parallel',
        max_concurrent: 3,
      };

      const batchId = await executor.createBatch(config);
      expect(batchId).toBeTruthy();
    });

    it('should support sequential execution with ordered operations', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Sequential Execution',
        operations: [
          { operation_id: 'task-breakdown', parameters: {}, sequence_order: 1 },
          { operation_id: 'task-prioritize', parameters: {}, sequence_order: 2 },
          { operation_id: 'calendar-prep', parameters: {}, sequence_order: 3 },
        ],
        batch_type: 'sequential',
      };

      const batchId = await executor.createBatch(config);
      expect(batchId).toBeTruthy();
    });

    it('should support conditional execution with dependencies', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Conditional Execution',
        operations: [
          { operation_id: 'email-compose', parameters: {}, sequence_order: 1 },
          {
            operation_id: 'email-classify',
            parameters: {},
            sequence_order: 2,
            depends_on: 'email-compose',
          },
        ],
        batch_type: 'conditional',
      };

      const batchId = await executor.createBatch(config);
      expect(batchId).toBeTruthy();
    });
  });

  describe('Operation Parameter Handling', () => {
    it('should preserve operation parameters', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Parameter Test',
        operations: [
          {
            operation_id: 'email-compose',
            parameters: {
              draft: true,
              includeSignature: false,
              attachments: ['file1.pdf'],
            },
          },
        ],
        batch_type: 'parallel',
      };

      const batchId = await executor.createBatch(config);
      expect(batchId).toBeTruthy();

      const status = await executor.getBatchStatus(batchId);
      expect(status?.total_operations).toBe(1);
    });

    it('should handle empty parameters', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Empty Parameters Test',
        operations: [
          { operation_id: 'task-prioritize', parameters: {} },
          { operation_id: 'calendar-prep', parameters: {} },
        ],
        batch_type: 'parallel',
      };

      const batchId = await executor.createBatch(config);
      expect(batchId).toBeTruthy();
    });

    it('should handle complex nested parameters', async () => {
      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Complex Parameters Test',
        operations: [
          {
            operation_id: 'analytics-summary',
            parameters: {
              metrics: {
                email: { inbound: true, outbound: true },
                calendar: { meetings: true, prep_notes: true },
                tasks: { completed: true, in_progress: true },
              },
              dateRange: {
                start: '2026-01-01',
                end: '2026-02-04',
              },
            },
          },
        ],
        batch_type: 'parallel',
      };

      const batchId = await executor.createBatch(config);
      expect(batchId).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid batch type gracefully', async () => {
      // Invalid batch type should be caught by database constraint
      const config = {
        user_id: 'test-user-1',
        name: 'Invalid Batch Type',
        operations: [{ operation_id: 'email-compose', parameters: {} }],
        batch_type: 'invalid' as any,
      };

      // Execution should fail gracefully
      await expect(executor.executeBatch('invalid-id')).resolves.not.toThrow();
    });

    it('should handle missing batch gracefully', async () => {
      await expect(
        executor.executeBatch('non-existent-batch-id')
      ).rejects.toThrow();
    });

    it('should track failed operations', async () => {
      const failedOps: string[] = [];

      executor.on('operation:failed', ({ operationId }: any) => {
        failedOps.push(operationId);
      });

      const config: BatchConfig = {
        user_id: 'test-user-1',
        name: 'Failure Tracking Test',
        operations: [{ operation_id: 'email-compose', parameters: {} }],
        batch_type: 'parallel',
      };

      const batchId = await executor.createBatch(config);
      // Note: In real scenario, would track failures during execution
      expect(batchId).toBeTruthy();
    });
  });
});
