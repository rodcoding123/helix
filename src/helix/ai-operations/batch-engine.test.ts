import { describe, it, expect, beforeEach } from 'vitest';
import { BatchOperationEngine } from './batch-engine.js';

describe('BatchOperationEngine', () => {
  let engine: BatchOperationEngine;

  beforeEach(() => {
    engine = new BatchOperationEngine();
  });

  describe('Batch Creation', () => {
    it('creates a new batch', () => {
      const batch = engine.createBatch('email_analysis', 10);
      expect(batch.id).toBeDefined();
      expect(batch.operationType).toBe('email_analysis');
      expect(batch.maxBatchSize).toBe(10);
      expect(batch.items).toHaveLength(0);
    });

    it('adds items to batch', () => {
      const batch = engine.createBatch('email_analysis', 10);
      const itemId1 = engine.addToBatch(batch.id, { emailId: 'email1' });
      engine.addToBatch(batch.id, { emailId: 'email2' });

      const updated = engine.getBatch(batch.id);
      expect(updated!.items).toHaveLength(2);
      expect(updated!.items[0].id).toBe(itemId1);
    });

    it('prevents adding to full batch', () => {
      const batch = engine.createBatch('email_analysis', 2);
      engine.addToBatch(batch.id, { emailId: 'email1' });
      engine.addToBatch(batch.id, { emailId: 'email2' });

      const result = engine.addToBatch(batch.id, { emailId: 'email3' });
      expect(result).toBeNull(); // Batch full
    });

    it('creates new batch when current is full', () => {
      const batch1 = engine.createBatch('email_analysis', 2);
      engine.addToBatch(batch1.id, { emailId: 'email1' });
      engine.addToBatch(batch1.id, { emailId: 'email2' });

      const batch2 = engine.getOrCreateBatch('email_analysis', 2);
      expect(batch2.id).not.toBe(batch1.id);
    });
  });

  describe('Batch Execution', () => {
    it('executes batch items sequentially', async () => {
      const batch = engine.createBatch('email_analysis', 5);
      const executionOrder: string[] = [];

      const executor = async (item: unknown): Promise<void> => {
        const data = item as Record<string, unknown>;
        executionOrder.push(data.emailId as string);
        await Promise.resolve();
      };

      engine.addToBatch(batch.id, { emailId: 'email1' });
      engine.addToBatch(batch.id, { emailId: 'email2' });
      engine.addToBatch(batch.id, { emailId: 'email3' });

      await engine.executeBatch(batch.id, executor, { maxConcurrency: 1 });

      expect(executionOrder).toHaveLength(3);
      expect(executionOrder).toEqual(['email1', 'email2', 'email3']);
    });

    it('executes items with concurrency limit', async () => {
      const batch = engine.createBatch('email_analysis', 10);
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const executor = async (): Promise<void> => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCount--;
      };

      for (let i = 0; i < 10; i++) {
        engine.addToBatch(batch.id, { index: i });
      }

      await engine.executeBatch(batch.id, executor, { maxConcurrency: 3 });

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('isolates failures in batch', async () => {
      const batch = engine.createBatch('email_analysis', 5);
      const results: string[] = [];

      const executor = (item: unknown): Promise<void> => {
        return Promise.resolve().then(() => {
          const data = item as Record<string, unknown>;
          const id = data.emailId as string;
          if (id === 'email2') {
            throw new Error('Failed to process email2');
          }
          results.push(id);
        });
      };

      engine.addToBatch(batch.id, { emailId: 'email1' });
      engine.addToBatch(batch.id, { emailId: 'email2' });
      engine.addToBatch(batch.id, { emailId: 'email3' });

      const batchResult = await engine.executeBatch(batch.id, executor, { maxConcurrency: 1 });

      expect(results).toContain('email1');
      expect(results).toContain('email3');
      expect(batchResult.successful).toBe(2);
      expect(batchResult.failed).toBe(1);
    });
  });

  describe('Cost Calculation', () => {
    it('calculates batch cost vs individual cost', () => {
      const batch = engine.createBatch('email_analysis', 5);
      for (let i = 0; i < 5; i++) {
        engine.addToBatch(batch.id, { emailId: `email${i}` });
      }

      const batchCost = engine.calculateBatchCost(batch.id, 100, 50);
      const individualCost = 5 * 0.001; // Assuming $0.001 per email

      // Batch should be cheaper (roughly)
      expect(batchCost).toBeLessThan(individualCost * 1.5); // Allow some variance
    });
  });

  describe('Batch Status', () => {
    it('tracks batch status', () => {
      const batch = engine.createBatch('email_analysis', 5);
      engine.addToBatch(batch.id, { emailId: 'email1' });

      let status = engine.getBatchStatus(batch.id);
      expect(status?.status).toBe('pending');

      // Mark as executing
      engine.markBatchExecuting(batch.id);
      status = engine.getBatchStatus(batch.id);
      expect(status?.status).toBe('executing');
    });

    it('reports batch statistics', () => {
      const batch = engine.createBatch('email_analysis', 5);
      engine.addToBatch(batch.id, { emailId: 'email1' });
      engine.addToBatch(batch.id, { emailId: 'email2' });

      const stats = engine.getBatchStats();
      expect(stats.totalBatches).toBeGreaterThan(0);
      expect(stats.totalItems).toBeGreaterThanOrEqual(2);
    });
  });
});
