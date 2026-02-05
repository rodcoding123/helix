import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it('allows requests within limit', () => {
    for (let i = 0; i < 10; i++) {
      const result = limiter.checkLimit('user1', 'memory.synthesize');
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks requests exceeding limit', () => {
    // Make 10 requests (limit for memory.synthesize)
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit('user1', 'memory.synthesize');
    }

    // 11th request should be blocked
    const result = limiter.checkLimit('user1', 'memory.synthesize');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('isolates limits per user', () => {
    // User 1 makes 10 requests
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit('user1', 'memory.synthesize');
    }

    // User 2 should not be affected
    const result = limiter.checkLimit('user2', 'memory.synthesize');
    expect(result.allowed).toBe(true);
  });

  it('isolates limits per method', () => {
    // User makes 10 memory.synthesize requests
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit('user1', 'memory.synthesize');
    }

    // User should still be able to make skills.execute_composite requests
    const result = limiter.checkLimit('user1', 'skills.execute_composite');
    expect(result.allowed).toBe(true);
  });

  it('uses default rate limit for unknown methods', () => {
    // Make 200 requests (default limit)
    for (let i = 0; i < 200; i++) {
      limiter.checkLimit('user1', 'unknown.method');
    }

    // 201st request should be blocked
    const result = limiter.checkLimit('user1', 'unknown.method');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('returns retryAfterMs within window range', () => {
    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit('user1', 'memory.synthesize');
    }

    // 11th request should be blocked
    const result = limiter.checkLimit('user1', 'memory.synthesize');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('respects different rate limits for different methods', () => {
    // memory.synthesize has limit of 10
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit('user1', 'memory.synthesize');
    }
    expect(limiter.checkLimit('user1', 'memory.synthesize').allowed).toBe(false);

    // skills.execute_composite has limit of 30
    for (let i = 0; i < 30; i++) {
      limiter.checkLimit('user2', 'skills.execute_composite');
    }
    expect(limiter.checkLimit('user2', 'skills.execute_composite').allowed).toBe(false);
  });
});
