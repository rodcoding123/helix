import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
    vi.useFakeTimers();
  });

  it('should allow requests within limit', () => {
    const allowed = rateLimiter.allowRequest('user1', 1);
    expect(allowed).toBe(true);
  });

  it('should reject requests when bucket empty', () => {
    // Deplete bucket
    for (let i = 0; i < 100; i++) {
      rateLimiter.allowRequest('user1', 1);
    }
    // Next request should fail
    const allowed = rateLimiter.allowRequest('user1', 1);
    expect(allowed).toBe(false);
  });

  it('should refill tokens over time', () => {
    // Deplete bucket
    for (let i = 0; i < 100; i++) {
      rateLimiter.allowRequest('user1', 1);
    }
    // Advance time by 1 second (REFILL_RATE = 100 tokens/sec)
    vi.advanceTimersByTime(1000);
    // Should have tokens again
    const allowed = rateLimiter.allowRequest('user1', 1);
    expect(allowed).toBe(true);
  });

  it('should calculate backoff time correctly', () => {
    // Deplete bucket
    for (let i = 0; i < 100; i++) {
      rateLimiter.allowRequest('user1', 1);
    }
    // Calculate backoff for requesting 10 tokens
    const backoff = rateLimiter.getRetryAfterMs('user1', 10);
    expect(backoff).toBeGreaterThan(0);
    expect(backoff).toBeLessThanOrEqual(100); // 10 tokens / 100 tokens per sec = 100ms
  });

  it('should handle multiple users independently', () => {
    // Deplete user1's bucket
    for (let i = 0; i < 100; i++) {
      rateLimiter.allowRequest('user1', 1);
    }
    // user2 should still have tokens
    const allowed = rateLimiter.allowRequest('user2', 1);
    expect(allowed).toBe(true);
  });

  it('should clear all buckets', () => {
    rateLimiter.allowRequest('user1', 50);
    rateLimiter.allowRequest('user2', 50);
    rateLimiter.clear();
    // Both users should have full buckets again
    const user1Allowed = rateLimiter.allowRequest('user1', 100);
    const user2Allowed = rateLimiter.allowRequest('user2', 100);
    expect(user1Allowed).toBe(true);
    expect(user2Allowed).toBe(true);
  });

  it('should require multiple tokens for larger requests', () => {
    // Request 50 tokens at a time
    const first50 = rateLimiter.allowRequest('user1', 50);
    expect(first50).toBe(true);
    const second50 = rateLimiter.allowRequest('user1', 50);
    expect(second50).toBe(true);
    // Third 50 token request should fail
    const third50 = rateLimiter.allowRequest('user1', 50);
    expect(third50).toBe(false);
  });
});
