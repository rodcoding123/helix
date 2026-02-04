import { describe, it, expect, beforeEach } from 'vitest';
import { RetryManager } from './retry-manager.js';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager();
  });

  describe('Error Classification', () => {
    it('classifies timeout as transient', () => {
      const errorType = retryManager.classifyError(new Error('timeout'));
      expect(errorType).toBe('transient');
    });

    it('classifies rate_limit as transient', () => {
      const errorType = retryManager.classifyError(new Error('rate_limit'));
      expect(errorType).toBe('transient');
    });

    it('classifies auth error as terminal', () => {
      const errorType = retryManager.classifyError(new Error('unauthorized'));
      expect(errorType).toBe('terminal');
    });

    it('classifies not_found as terminal', () => {
      const errorType = retryManager.classifyError(new Error('not_found'));
      expect(errorType).toBe('terminal');
    });
  });

  describe('Backoff Calculation', () => {
    it('calculates exponential backoff', () => {
      const delay1 = retryManager.calculateBackoffMs(0); // 2^0 = 1
      const delay2 = retryManager.calculateBackoffMs(1); // 2^1 = 2
      const delay3 = retryManager.calculateBackoffMs(2); // 2^2 = 4

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('respects max delay', () => {
      const delay = retryManager.calculateBackoffMs(10); // Would be huge
      expect(delay).toBeLessThanOrEqual(10000); // Max 10 seconds
    });

    it('adds jitter variation', () => {
      const delays = [];
      for (let i = 0; i < 5; i++) {
        delays.push(retryManager.calculateBackoffMs(1));
      }

      // All within jitter range but not identical
      const allSame = delays.every(d => d === delays[0]);
      expect(allSame).toBe(false);
    });
  });

  describe('Retry Decision', () => {
    it('allows retries for transient errors', () => {
      const canRetry = retryManager.canRetry('transient', 0);
      expect(canRetry).toBe(true);
    });

    it('prevents retries for terminal errors', () => {
      const canRetry = retryManager.canRetry('terminal', 0);
      expect(canRetry).toBe(false);
    });

    it('respects max retry limit for transient', () => {
      // After 5 retries (attempts 0-4)
      let canRetry = retryManager.canRetry('transient', 4);
      expect(canRetry).toBe(true);

      canRetry = retryManager.canRetry('transient', 5);
      expect(canRetry).toBe(false);
    });
  });

  describe('Retry Tracking', () => {
    it('tracks retry history', () => {
      retryManager.recordAttempt('op1', 'transient', 100);
      retryManager.recordAttempt('op1', 'transient', 200);

      const history = retryManager.getRetryHistory('op1');
      expect(history?.attempts).toBe(2);
      expect(history?.totalDelayMs).toBe(300);
    });

    it('resets history per operation', () => {
      retryManager.recordAttempt('op1', 'transient', 100);
      retryManager.recordAttempt('op2', 'transient', 200);

      const history1 = retryManager.getRetryHistory('op1');
      const history2 = retryManager.getRetryHistory('op2');

      expect(history1?.attempts).toBe(1);
      expect(history2?.attempts).toBe(1);
    });
  });

  describe('Clear', () => {
    it('clears all retry history', () => {
      retryManager.recordAttempt('op1', 'transient', 100);
      retryManager.clear();

      const history = retryManager.getRetryHistory('op1');
      expect(history).toBeNull();
    });
  });
});
