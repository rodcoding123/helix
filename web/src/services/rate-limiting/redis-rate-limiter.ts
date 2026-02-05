/**
 * Phase 10 Week 5: Redis-Backed Distributed Rate Limiting
 * Implements token bucket algorithm with Redis persistence
 */

import { Redis } from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface RateLimitConfig {
  redisUrl?: string;
  defaultLimit?: number;
  defaultWindow?: number;
}

/**
 * Lua script for atomic token bucket rate limiting
 * Returns [allowed (1/0), remaining tokens, reset timestamp in ms]
 */
const RATE_LIMIT_SCRIPT = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])

  local current = redis.call('GET', key)
  if current == false then
    -- First request in window, set tokens
    redis.call('SET', key, limit - 1, 'EX', window)
    return {1, limit - 1, now + (window * 1000)}
  end

  current = tonumber(current)
  if current > 0 then
    -- Tokens available, decrement
    redis.call('DECR', key)
    local ttl = redis.call('TTL', key)
    local reset = now + (ttl * 1000)
    return {1, current - 1, reset}
  end

  -- No tokens available
  local ttl = redis.call('TTL', key)
  local reset = now + (ttl * 1000)
  return {0, 0, reset}
`;

export class RedisRateLimiter {
  private redis: Redis;
  private scriptSha: string = '';

  constructor(config: RateLimitConfig = {}) {
    const redisUrl = config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

    this.redis = new Redis(redisUrl);
    this.initializeScript();
  }

  /**
   * Initialize Lua script for rate limiting
   */
  private async initializeScript(): Promise<void> {
    try {
      this.scriptSha = await this.redis.script('LOAD', RATE_LIMIT_SCRIPT);
    } catch (error) {
      console.error('[RedisRateLimiter] Failed to load Lua script:', error);
    }
  }

  /**
   * Check if request is allowed (token bucket algorithm)
   * @param userId Unique identifier for the user
   * @param limit Maximum requests allowed in window (default: 60)
   * @param window Time window in seconds (default: 60)
   * @returns Result with allowed status, remaining tokens, and reset time
   */
  async checkLimit(
    userId: string,
    limit: number = 60,
    window: number = 60
  ): Promise<RateLimitResult> {
    try {
      const key = `rate_limit:${userId}`;
      const now = Date.now();

      // Use evalsha for better performance (cached script)
      let result;
      try {
        result = await this.redis.evalsha(this.scriptSha, 1, key, limit, window, now);
      } catch (error: any) {
        // Script not found in cache, reload and retry
        if (error.message?.includes('NOSCRIPT')) {
          this.scriptSha = await this.redis.script('LOAD', RATE_LIMIT_SCRIPT);
          result = await this.redis.evalsha(this.scriptSha, 1, key, limit, window, now);
        } else {
          throw error;
        }
      }

      const [allowed, remaining, reset] = result as [number, number, number];

      return {
        allowed: allowed === 1,
        remaining: Math.max(0, remaining),
        reset,
        retryAfter: allowed === 0 ? Math.ceil((reset - now) / 1000) : undefined,
      };
    } catch (error) {
      console.error('[RedisRateLimiter] Error checking limit:', error);
      // Fail open: allow request if Redis is unavailable
      return {
        allowed: true,
        remaining: 0,
        reset: Date.now() + 60000,
      };
    }
  }

  /**
   * Get current quota for a user without consuming
   */
  async getQuota(userId: string): Promise<{ remaining: number; reset: number }> {
    try {
      const key = `rate_limit:${userId}`;
      const current = await this.redis.get(key);
      const ttl = await this.redis.ttl(key);

      const remaining = current ? parseInt(current) : 60;
      const reset = ttl > 0 ? Date.now() + ttl * 1000 : Date.now();

      return {
        remaining: Math.max(0, remaining),
        reset,
      };
    } catch (error) {
      console.error('[RedisRateLimiter] Error getting quota:', error);
      return {
        remaining: 60,
        reset: Date.now() + 60000,
      };
    }
  }

  /**
   * Reset rate limit for a user
   */
  async resetLimit(userId: string): Promise<void> {
    try {
      const key = `rate_limit:${userId}`;
      await this.redis.del(key);
    } catch (error) {
      console.error('[RedisRateLimiter] Error resetting limit:', error);
    }
  }

  /**
   * Get all active rate limit keys (for monitoring)
   */
  async getActiveKeys(pattern: string = 'rate_limit:*'): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      console.error('[RedisRateLimiter] Error getting active keys:', error);
      return [];
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('[RedisRateLimiter] Error closing Redis connection:', error);
    }
  }
}

// Singleton instance
let rateLimiter: RedisRateLimiter | null = null;

/**
 * Get or create singleton rate limiter instance
 */
export function getRateLimiter(config?: RateLimitConfig): RedisRateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RedisRateLimiter(config);
  }
  return rateLimiter;
}
