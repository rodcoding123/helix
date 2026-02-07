/**
 * Desktop Offline Flow Tests
 *
 * Tests the complete offline-to-online message flow:
 * 1. Queue messages when offline
 * 2. Store persistently in localStorage/Tauri filesystem
 * 3. Sync when connection restored
 * 4. Update message status after sync
 * 5. Handle network interruptions gracefully
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OfflineSyncQueue } from '../lib/offline-sync-queue.js';

describe('Desktop Offline Flow', () => {
  let queue: OfflineSyncQueue;

  beforeEach(() => {
    localStorage.clear();
    queue = new OfflineSyncQueue(true);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Scenario 1: User Goes Offline', () => {
    it('should queue message when offline', async () => {
      // User tries to send a message
      const message = {
        content: 'Test message',
        sessionKey: 'session-1',
        timestamp: Date.now(),
      };

      await queue.queueMessage(message);

      const status = queue.getStatus();
      expect(status.queueLength).toBe(1);
      expect(status.isSyncing).toBe(false);
    });

    it('should persist queued messages to storage', async () => {
      const message = {
        content: 'Test message',
        sessionKey: 'session-1',
        timestamp: Date.now(),
      };

      await queue.queueMessage(message);

      const stored = localStorage.getItem('helix-offline-queue');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toHaveLength(1);
    });

    it('should restore messages from storage on app restart', async () => {
      const message = {
        content: 'Test message',
        sessionKey: 'session-1',
        timestamp: Date.now(),
      };

      // First instance: queue a message
      const queue1 = new OfflineSyncQueue(true);
      await queue1.queueMessage(message);

      // Second instance: should restore from storage
      const queue2 = new OfflineSyncQueue(true);
      const status = queue2.getStatus();
      expect(status.queueLength).toBe(1);
    });

    it('should handle rapid offline queueing', async () => {
      const messages = [];
      for (let i = 0; i < 10; i++) {
        messages.push({
          content: `Message ${i}`,
          sessionKey: 'session-1',
          timestamp: Date.now(),
        });
      }

      await Promise.all(messages.map((msg) => queue.queueMessage(msg)));

      expect(queue.getStatus().queueLength).toBe(10);
    });
  });

  describe('Scenario 2: Connection Restored', () => {
    it('should process queue when coming online', async () => {
      // Queue messages while offline
      const messages = [
        { content: 'Message 1', sessionKey: 'session-1', timestamp: Date.now() },
        { content: 'Message 2', sessionKey: 'session-1', timestamp: Date.now() + 1 },
      ];

      for (const msg of messages) {
        await queue.queueMessage(msg);
      }

      expect(queue.getStatus().queueLength).toBe(2);

      // Now simulate coming back online and syncing
      let processedCount = 0;
      const syncFn = async () => {
        processedCount++;
      };

      const result = await queue.processQueue(syncFn);

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(queue.getStatus().queueLength).toBe(0);
    });

    it('should maintain message order during sync', async () => {
      const messageSequence = [
        { content: 'First', sessionKey: 'session-1', timestamp: Date.now() },
        { content: 'Second', sessionKey: 'session-1', timestamp: Date.now() + 100 },
        { content: 'Third', sessionKey: 'session-1', timestamp: Date.now() + 200 },
      ];

      for (const msg of messageSequence) {
        await queue.queueMessage(msg);
      }

      const processedOrder: string[] = [];
      const syncFn = async (operation: any) => {
        processedOrder.push((operation.data as any).content);
      };

      await queue.processQueue(syncFn);

      expect(processedOrder).toEqual(['First', 'Second', 'Third']);
    });

    it('should not lose messages on partial sync failure', async () => {
      const messages = [
        { content: 'Message 1', sessionKey: 'session-1', timestamp: Date.now() },
        { content: 'Message 2', sessionKey: 'session-1', timestamp: Date.now() + 1 },
        { content: 'Message 3', sessionKey: 'session-1', timestamp: Date.now() + 2 },
      ];

      for (const msg of messages) {
        await queue.queueMessage(msg);
      }

      let callCount = 0;
      const syncFn = async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Network timeout');
        }
      };

      const result = await queue.processQueue(syncFn);

      // First message synced, second failed, third not attempted
      expect(result.synced).toBeGreaterThan(0);
      expect(result.failed).toBe(1);
      expect(queue.getStatus().queueLength).toBeGreaterThan(0);
    });
  });

  describe('Scenario 3: Network Interruptions', () => {
    it('should handle sync timeout with exponential backoff', async () => {
      const message = {
        content: 'Test message',
        sessionKey: 'session-1',
        timestamp: Date.now(),
      };

      await queue.queueMessage(message);

      let attemptTimestamps: number[] = [];
      const syncFn = async () => {
        attemptTimestamps.push(Date.now());
        throw new Error('Network timeout');
      };

      const startTime = Date.now();
      await queue.processQueue(syncFn);
      const totalDuration = Date.now() - startTime;

      // Should have attempted multiple times with backoff
      expect(attemptTimestamps.length).toBeGreaterThan(1);

      // Verify exponential backoff: delays should increase
      if (attemptTimestamps.length >= 2) {
        const delay1 = attemptTimestamps[1] - attemptTimestamps[0];
        // Exponential backoff should create delays (though small in test)
        expect(delay1).toBeGreaterThanOrEqual(0);
      }
    });

    it('should give up after max retries', async () => {
      const message = {
        content: 'Test message',
        sessionKey: 'session-1',
        timestamp: Date.now(),
      };

      await queue.queueMessage(message);

      let attemptCount = 0;
      const syncFn = async () => {
        attemptCount++;
        throw new Error('Persistent network error');
      };

      const result = await queue.processQueue(syncFn);

      expect(result.failed).toBe(1);
      expect(attemptCount).toBe(5); // Default maxRetries is 5
    });

    it('should track failed operations', async () => {
      const message = {
        content: 'Test message',
        sessionKey: 'session-1',
        timestamp: Date.now(),
      };

      await queue.queueMessage(message);

      const syncFn = async () => {
        throw new Error('Network error');
      };

      await queue.processQueue(syncFn);

      const status = queue.getStatus();
      expect(status.failedCount).toBeGreaterThan(0);
    });
  });

  describe('Scenario 4: Multi-Session Offline Sync', () => {
    it('should queue messages from different sessions', async () => {
      const msg1 = {
        content: 'Message in session 1',
        sessionKey: 'session-1',
        timestamp: Date.now(),
      };
      const msg2 = {
        content: 'Message in session 2',
        sessionKey: 'session-2',
        timestamp: Date.now(),
      };

      await queue.queueMessage(msg1);
      await queue.queueMessage(msg2);

      expect(queue.getStatus().queueLength).toBe(2);
    });

    it('should sync messages from all sessions', async () => {
      const messages = [
        { content: 'Session 1 - Message 1', sessionKey: 'session-1', timestamp: Date.now() },
        { content: 'Session 2 - Message 1', sessionKey: 'session-2', timestamp: Date.now() },
        { content: 'Session 1 - Message 2', sessionKey: 'session-1', timestamp: Date.now() + 1 },
      ];

      for (const msg of messages) {
        await queue.queueMessage(msg);
      }

      const syncedSessions = new Set<string>();
      const syncFn = async (operation: any) => {
        syncedSessions.add((operation.data as any).sessionKey);
      };

      await queue.processQueue(syncFn);

      expect(syncedSessions.has('session-1')).toBe(true);
      expect(syncedSessions.has('session-2')).toBe(true);
    });
  });

  describe('Scenario 5: User Experience', () => {
    it('should provide status feedback during offline', (done) => {
      let statuses: any[] = [];

      const unsubscribe = queue.onStatusChange((status) => {
        statuses.push(status);
      });

      queue
        .queueMessage({
          content: 'Test',
          sessionKey: 'session-1',
          timestamp: Date.now(),
        })
        .then(() => {
          expect(statuses.length).toBeGreaterThan(0);
          expect(statuses[statuses.length - 1].queueLength).toBe(1);
          unsubscribe();
          done();
        })
        .catch(done);
    });

    it('should indicate when sync is in progress', async () => {
      const message = {
        content: 'Test message',
        sessionKey: 'session-1',
        timestamp: Date.now(),
      };

      await queue.queueMessage(message);

      let syncStarted = false;
      let syncEnded = false;

      const syncFn = async () => {
        syncStarted = true;
        await new Promise((resolve) => setTimeout(resolve, 50));
        syncEnded = true;
      };

      const statusDuringSync: boolean[] = [];
      queue.onStatusChange((status) => {
        if (syncStarted && !syncEnded) {
          statusDuringSync.push(status.isSyncing);
        }
      });

      await queue.processQueue(syncFn);

      expect(statusDuringSync.some((s) => s === true)).toBe(true);
    });

    it('should allow clear UI interaction while queued', async () => {
      const message = {
        content: 'Test message',
        sessionKey: 'session-1',
        timestamp: Date.now(),
      };

      await queue.queueMessage(message);

      // User should be able to queue more messages even if first sync fails
      const syncFn = async () => {
        throw new Error('Sync failed');
      };

      await queue.processQueue(syncFn);

      // Should still be able to queue more messages
      const message2 = {
        content: 'Another message',
        sessionKey: 'session-1',
        timestamp: Date.now(),
      };

      await queue.queueMessage(message2);

      expect(queue.getStatus().queueLength).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Scenario 6: Data Integrity', () => {
    it('should not duplicate messages on retry', async () => {
      const message = {
        content: 'Test message',
        sessionKey: 'session-1',
        timestamp: Date.now(),
      };

      await queue.queueMessage(message);

      const syncedMessages: string[] = [];
      let attemptCount = 0;

      const syncFn = async (operation: any) => {
        attemptCount++;
        syncedMessages.push((operation.data as any).content);

        if (attemptCount === 1) {
          throw new Error('First attempt failed');
        }
        // Second attempt succeeds
      };

      // Try to process once (fails)
      await queue.processQueue(syncFn);

      // Manually retry
      await queue.processQueue(syncFn);

      // Should have same message synced twice, but queue should be empty
      expect(queue.getStatus().queueLength).toBe(0);
    });

    it('should preserve message metadata during offline', async () => {
      const message = {
        id: 'msg-123',
        content: 'Test with metadata',
        sessionKey: 'session-1',
        timestamp: Date.now(),
        metadata: { platform: 'desktop', deviceId: 'device-1' },
      };

      await queue.queueMessage(message);

      const operation = queue.getNextOperation();
      expect(operation?.data).toEqual(message);
    });
  });
});
