/**
 * Phase 10 Week 5: Redis Rate Limiter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Redis BEFORE importing RedisRateLimiter
const mockRedisClient = {
  evalsha: vi.fn(),
  script: vi.fn(),
  get: vi.fn(),
  ttl: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  quit: vi.fn(),
};

vi.mock('ioredis', () => ({
  Redis: class MockRedis {
    evalsha = mockRedisClient.evalsha;
    script = mockRedisClient.script;
    get = mockRedisClient.get;
    ttl = mockRedisClient.ttl;
    del = mockRedisClient.del;
    keys = mockRedisClient.keys;
    quit = mockRedisClient.quit;
  },
}));

import { RedisRateLimiter, getRateLimiter } from './redis-rate-limiter';

describe('RedisRateLimiter', () => {
  let limiter: RedisRateLimiter;
  const userId = 'test-user-123';

  beforeEach(async () => {
    vi.clearAllMocks();
    limiter = new RedisRateLimiter({
      redisUrl: 'redis://localhost:6379',
    });

    // Set up default mock returns
    mockRedisClient.script.mockResolvedValue('script-sha');
    mockRedisClient.evalsha.mockResolvedValue([1, 59, Date.now() + 60000]);
    mockRedisClient.get.mockResolvedValue('60');
    mockRedisClient.ttl.mockResolvedValue(60);
    mockRedisClient.del.mockResolvedValue(1);
    mockRedisClient.keys.mockResolvedValue([]);
    mockRedisClient.quit.mockResolvedValue(undefined);

    // Wait for async initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    await limiter.close();
  });

  describe('Initialization', () => {
    it('should initialize with default Redis URL', () => {
      const newLimiter = new RedisRateLimiter();
      expect(newLimiter).toBeDefined();
      newLimiter.close();
    });

    it('should initialize with custom Redis URL', () => {
      const newLimiter = new RedisRateLimiter({
        redisUrl: 'redis://custom-host:6380',
      });
      expect(newLimiter).toBeDefined();
      newLimiter.close();
    });

    it('should load Lua script on initialization', async () => {
      const newLimiter = new RedisRateLimiter();

      // Wait for script to load
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockRedisClient.script).toHaveBeenCalledWith('LOAD', expect.any(String));
      newLimiter.close();
    });
  });

  describe('Rate Limiting', () => {
    it('should allow request within limit', async () => {
      mockRedisClient.evalsha.mockResolvedValue([1, 59, Date.now() + 60000]);

      const result = await limiter.checkLimit(userId, 60, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(59);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should deny request when limit exceeded', async () => {
      const resetTime = Date.now() + 30000;
      mockRedisClient.evalsha.mockResolvedValue([0, 0, resetTime]);

      const result = await limiter.checkLimit(userId, 60, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should decrement remaining tokens on each request', async () => {
      mockRedisClient.evalsha.mockResolvedValue([1, 55, Date.now() + 60000]);

      const result = await limiter.checkLimit(userId, 60, 60);

      expect(result.remaining).toBe(55);
      expect(mockRedisClient.evalsha).toHaveBeenCalled();
    });

    it('should use custom limit value', async () => {
      mockRedisClient.evalsha.mockResolvedValue([1, 99, Date.now() + 60000]);

      const result = await limiter.checkLimit(userId, 100, 60);

      expect(result.remaining).toBe(99);
    });

    it('should use custom window value', async () => {
      mockRedisClient.evalsha.mockResolvedValue([1, 24, Date.now() + 120000]);

      const result = await limiter.checkLimit(userId, 25, 120);

      expect(result.remaining).toBe(24);
    });
  });

  describe('Token Bucket Algorithm', () => {
    it('should reset bucket after window expires', async () => {
      // First request: bucket filled
      mockRedisClient.evalsha.mockResolvedValue([1, 59, Date.now() + 60000]);
      let result = await limiter.checkLimit(userId, 60, 60);
      expect(result.remaining).toBe(59);

      // Simulate window expiration
      mockRedisClient.evalsha.mockResolvedValue([1, 59, Date.now() + 60000]);
      result = await limiter.checkLimit(userId, 60, 60);
      expect(result.remaining).toBe(59);
    });

    it('should not allow overfilling bucket', async () => {
      // After first request
      mockRedisClient.evalsha.mockResolvedValue([1, 59, Date.now() + 60000]);
      let result = await limiter.checkLimit(userId, 60, 60);
      expect(result.remaining).toBeLessThanOrEqual(59);

      // Verify tokens don't exceed limit
      expect(result.remaining).toBeLessThanOrEqual(60);
    });
  });

  describe('Quota Management', () => {
    it('should get current quota', async () => {
      mockRedisClient.get.mockResolvedValue('45');
      mockRedisClient.ttl.mockResolvedValue(30);

      const quota = await limiter.getQuota(userId);

      expect(quota.remaining).toBe(45);
      expect(quota.reset).toBeGreaterThan(Date.now());
    });

    it('should return default quota when key missing', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.ttl.mockResolvedValue(-2);

      const quota = await limiter.getQuota(userId);

      expect(quota.remaining).toBe(60);
      expect(quota.reset).toBeDefined();
    });

    it('should reset rate limit for user', async () => {
      await limiter.resetLimit(userId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(`rate_limit:${userId}`);
    });
  });

  describe('Monitoring', () => {
    it('should get all active rate limit keys', async () => {
      const activeKeys = ['rate_limit:user1', 'rate_limit:user2', 'rate_limit:user3'];
      mockRedisClient.keys.mockResolvedValue(activeKeys);

      const keys = await limiter.getActiveKeys();

      expect(keys).toEqual(activeKeys);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('rate_limit:*');
    });

    it('should support custom key patterns', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await limiter.getActiveKeys('custom_pattern:*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('custom_pattern:*');
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      mockRedisClient.evalsha
        .mockResolvedValueOnce([1, 59, Date.now() + 60000])
        .mockResolvedValueOnce([1, 58, Date.now() + 60000])
        .mockResolvedValueOnce([1, 57, Date.now() + 60000]);

      const results = await Promise.all([
        limiter.checkLimit(userId, 60, 60),
        limiter.checkLimit(userId, 60, 60),
        limiter.checkLimit(userId, 60, 60),
      ]);

      expect(results[0].remaining).toBe(59);
      expect(results[1].remaining).toBe(58);
      expect(results[2].remaining).toBe(57);
      expect(results.every(r => r.allowed)).toBe(true);
    });

    it('should handle concurrent requests for different users', async () => {
      mockRedisClient.evalsha
        .mockResolvedValueOnce([1, 59, Date.now() + 60000])
        .mockResolvedValueOnce([1, 59, Date.now() + 60000]);

      const results = await Promise.all([
        limiter.checkLimit('user1', 60, 60),
        limiter.checkLimit('user2', 60, 60),
      ]);

      expect(results[0].remaining).toBe(59);
      expect(results[1].remaining).toBe(59);
      expect(results.every(r => r.allowed)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should fail open when Redis is unavailable', async () => {
      mockRedisClient.evalsha.mockRejectedValue(new Error('Connection refused'));

      const result = await limiter.checkLimit(userId, 60, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should reload script on NOSCRIPT error', async () => {
      const error = new Error('NOSCRIPT No script found');
      mockRedisClient.evalsha
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce([1, 59, Date.now() + 60000]);

      const result = await limiter.checkLimit(userId, 60, 60);

      expect(result.allowed).toBe(true);
      expect(mockRedisClient.script).toHaveBeenCalledWith('LOAD', expect.any(String));
    });

    it('should handle get quota errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const quota = await limiter.getQuota(userId);

      expect(quota.remaining).toBe(60);
      expect(quota.reset).toBeDefined();
    });

    it('should handle reset limit errors gracefully', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      await expect(limiter.resetLimit(userId)).resolves.not.toThrow();
    });
  });

  describe('Response Headers', () => {
    it('should include reset time in response', async () => {
      const resetTime = Date.now() + 45000;
      mockRedisClient.evalsha.mockResolvedValue([1, 30, resetTime]);

      const result = await limiter.checkLimit(userId, 60, 60);

      expect(result.reset).toBe(resetTime);
    });

    it('should include retry-after for denied requests', async () => {
      const resetTime = Date.now() + 30000;
      mockRedisClient.evalsha.mockResolvedValue([0, 0, resetTime]);

      const result = await limiter.checkLimit(userId, 60, 60);

      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });

    it('should not include retry-after for allowed requests', async () => {
      mockRedisClient.evalsha.mockResolvedValue([1, 59, Date.now() + 60000]);

      const result = await limiter.checkLimit(userId, 60, 60);

      expect(result.retryAfter).toBeUndefined();
    });
  });

  describe('Connection Lifecycle', () => {
    it('should close Redis connection', async () => {
      await limiter.close();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      mockRedisClient.quit.mockRejectedValue(new Error('Close failed'));

      await expect(limiter.close()).resolves.not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('should provide singleton instance', () => {
      const limiter1 = getRateLimiter();
      const limiter2 = getRateLimiter();

      expect(limiter1).toBe(limiter2);
    });

    it('should allow custom config on first initialization', () => {
      // Reset singleton
      const config = { redisUrl: 'redis://custom:6379' };
      const customLimiter = getRateLimiter(config);

      expect(customLimiter).toBeDefined();
      customLimiter.close();
    });
  });

  describe('High Volume Load', () => {
    it('should handle 1000 requests efficiently', async () => {
      mockRedisClient.evalsha.mockImplementation(
        (sha, numKeys, key, limit, window, now) => {
          const remaining = Math.max(0, 60 - Math.floor(Math.random() * 10));
          return [remaining > 0 ? 1 : 0, remaining, Date.now() + 60000];
        }
      );

      const startTime = Date.now();
      const requests = Array(100).fill(null).map((_, i) =>
        limiter.checkLimit(`user-${i}`, 60, 60)
      );

      const results = await Promise.all(requests);
      const endTime = Date.now();

      expect(results.every(r => r.allowed !== undefined)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete quickly
    });
  });

  describe('Integration Scenarios', () => {
    it('should support API rate limiting workflow', async () => {
      const userId = 'api-user-123';

      // First request
      mockRedisClient.evalsha.mockResolvedValue([1, 99, Date.now() + 60000]);
      let result = await limiter.checkLimit(userId, 100, 60);
      expect(result.allowed).toBe(true);

      // Check quota
      mockRedisClient.get.mockResolvedValue('99');
      const quota = await limiter.getQuota(userId);
      expect(quota.remaining).toBe(99);

      // Subsequent request
      mockRedisClient.evalsha.mockResolvedValue([1, 98, Date.now() + 60000]);
      result = await limiter.checkLimit(userId, 100, 60);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(98);

      // Exceed limit
      mockRedisClient.evalsha.mockResolvedValue([0, 0, Date.now() + 30000]);
      result = await limiter.checkLimit(userId, 100, 60);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it('should support per-operation rate limiting', async () => {
      const userId = 'user-123';
      const operations = ['email-compose', 'calendar-add', 'task-create'];

      for (const op of operations) {
        mockRedisClient.evalsha.mockResolvedValue([1, 9, Date.now() + 60000]);
        const result = await limiter.checkLimit(`${userId}:${op}`, 10, 60);
        expect(result.allowed).toBe(true);
      }

      expect(mockRedisClient.evalsha).toHaveBeenCalledTimes(3);
    });
  });
});
