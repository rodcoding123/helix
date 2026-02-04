import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    vi.useFakeTimers();
  });

  describe('Token Bucket', () => {
    it('allows requests within capacity', () => {
      const allowed1 = limiter.allowRequest('user_123', 100);
      const allowed2 = limiter.allowRequest('user_123', 100);
      expect(allowed1).toBe(true);
      expect(allowed2).toBe(true);
    });

    it('rejects requests exceeding capacity', () => {
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      const allowed4 = limiter.allowRequest('user_123', 100);
      expect(allowed4).toBe(false);
    });

    it('refills tokens over time', () => {
      limiter.allowRequest('user_456', 100);
      limiter.allowRequest('user_456', 100);
      limiter.allowRequest('user_456', 100);
      expect(limiter.allowRequest('user_456', 100)).toBe(false);

      // Advance time by 1 second (100 tokens refilled)
      vi.advanceTimersByTime(1000);

      expect(limiter.allowRequest('user_456', 100)).toBe(true);
    });
  });

  describe('Per-User Limits', () => {
    it('enforces separate limits per user', () => {
      limiter.allowRequest('user_1', 100);
      limiter.allowRequest('user_1', 100);
      limiter.allowRequest('user_1', 100);

      // user_2 should still have tokens
      const allowed = limiter.allowRequest('user_2', 100);
      expect(allowed).toBe(true);
    });
  });

  describe('Retry-After Header', () => {
    it('returns retry-after duration when rate limited', () => {
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);

      const retryAfter = limiter.getRetryAfterMs('user_123', 100);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(10); // Should be small
    });
  });

  describe('Sliding Window', () => {
    it('tracks requests in 1-minute window', () => {
      for (let i = 0; i < 60; i++) {
        limiter.allowRequest('user_789', 1);
      }

      expect(limiter.allowRequest('user_789', 1)).toBe(false);

      // Advance 1 minute
      vi.advanceTimersByTime(60000);

      expect(limiter.allowRequest('user_789', 1)).toBe(true);
    });
  });

  describe('Reset', () => {
    it('clears all rate limit state', () => {
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      limiter.clear();

      expect(limiter.allowRequest('user_123', 100)).toBe(true);
    });
  });
});
