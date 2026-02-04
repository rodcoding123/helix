import { describe, it, expect, beforeEach } from 'vitest';
import { RequestPriorityQueue, QueueItem } from './priority-queue.js';

describe('RequestPriorityQueue', () => {
  let queue: RequestPriorityQueue;

  beforeEach(() => {
    queue = new RequestPriorityQueue();
  });

  describe('Enqueue and Dequeue', () => {
    it('enqueues items', () => {
      const item: QueueItem = {
        operationId: 'op1',
        userId: 'user1',
        slaTier: 'standard',
        criticality: 'low',
      };

      queue.enqueue(item);
      expect(queue.size()).toBe(1);
    });

    it('dequeues highest priority item first', () => {
      const premium = {
        operationId: 'op1',
        userId: 'user1',
        slaTier: 'premium' as const,
        criticality: 'low' as const,
      };
      const standard = {
        operationId: 'op2',
        userId: 'user2',
        slaTier: 'standard' as const,
        criticality: 'high' as const,
      };

      queue.enqueue(standard);
      queue.enqueue(premium);

      const first = queue.dequeue();
      expect(first?.operationId).toBe('op1'); // Premium tier first
    });

    it('returns null when empty', () => {
      const item = queue.dequeue();
      expect(item).toBeNull();
    });
  });

  describe('Priority Calculation', () => {
    it('calculates premium tier higher than standard', () => {
      const premiumPriority = queue.calculatePriority({
        operationId: 'op1',
        userId: 'u1',
        slaTier: 'premium',
        criticality: 'low',
      });
      const standardPriority = queue.calculatePriority({
        operationId: 'op2',
        userId: 'u2',
        slaTier: 'standard',
        criticality: 'low',
      });

      expect(premiumPriority).toBeGreaterThan(standardPriority);
    });

    it('calculates high criticality higher than low', () => {
      const highPriority = queue.calculatePriority({
        operationId: 'op1',
        userId: 'u1',
        slaTier: 'standard',
        criticality: 'high',
      });
      const lowPriority = queue.calculatePriority({
        operationId: 'op2',
        userId: 'u2',
        slaTier: 'standard',
        criticality: 'low',
      });

      expect(highPriority).toBeGreaterThan(lowPriority);
    });

    it('applies age bonus to prevent starvation', () => {
      const item = {
        operationId: 'op1',
        userId: 'u1',
        slaTier: 'standard' as const,
        criticality: 'low' as const,
      };

      const priorityNow = queue.calculatePriority(item);

      // Simulate 10 minutes wait
      const priorityLater = queue.calculatePriority({ ...item, ageMinutes: 10 });

      expect(priorityLater).toBeGreaterThan(priorityNow);
    });
  });

  describe('Peek and Size', () => {
    it('peeks at next item without removing', () => {
      const item = {
        operationId: 'op1',
        userId: 'u1',
        slaTier: 'standard' as const,
        criticality: 'low' as const,
      };
      queue.enqueue(item);

      const peeked = queue.peek();
      expect(peeked?.operationId).toBe('op1');
      expect(queue.size()).toBe(1);
    });

    it('reports queue size', () => {
      queue.enqueue({ operationId: 'op1', userId: 'u1', slaTier: 'standard', criticality: 'low' });
      queue.enqueue({ operationId: 'op2', userId: 'u2', slaTier: 'standard', criticality: 'low' });

      expect(queue.size()).toBe(2);
    });
  });

  describe('Clear', () => {
    it('clears all items', () => {
      queue.enqueue({ operationId: 'op1', userId: 'u1', slaTier: 'standard', criticality: 'low' });
      queue.enqueue({ operationId: 'op2', userId: 'u2', slaTier: 'standard', criticality: 'low' });

      queue.clear();
      expect(queue.size()).toBe(0);
      expect(queue.dequeue()).toBeNull();
    });
  });
});
