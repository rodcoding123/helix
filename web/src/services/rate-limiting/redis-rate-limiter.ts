/**
 * Phase 10 Week 5: Redis-Backed Distributed Rate Limiting
 * Token bucket algorithm with Redis backend for distributed systems
 */

type RedisClient = import('ioredis').Redis;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// Lua script for token bucket algorithm (atomic operation in Redis)
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Get current bucket state
local current = redis.call('GET', key)
local bucket = {}

if current then
  bucket = cjson.decode(current)
else
  bucket = {tokens = limit, last_refill = now}
end

-- Calculate tokens to add based on time passed
local time_passed = math.max(0, now - bucket.last_refill)
local refill_rate = limit / window
local tokens_to_add = math.min(limit, bucket.tokens + (time_passed * refill_rate / 1000))

-- Consume one token if available
local allowed = tokens_to_add >= 1
local remaining = 0
if allowed then
  remaining = math.floor(tokens_to_add - 1)
else
  remaining = math.floor(tokens_to_add)
end

-- Update bucket
bucket.tokens = remaining
bucket.last_refill = now

-- Set with expiration (window + safety margin)
redis.call('SET', key, cjson.encode(bucket), 'EX', window + 60)

-- Return [allowed, remaining, reset_time]
local reset_time = bucket.last_refill + (window * 1000)
return {allowed and 1 or 0, remaining, reset_time}
`;

/**
 * Distributed rate limiter using Redis token bucket algorithm
 * Survives server restarts and works across multiple instances
 */
export class RedisRateLimiter {
  private redisUrl: string;
  private client: RedisClient | null = null;
  private scriptSha: string | null = null;

  constructor(options?: string | { redisUrl?: string }) {
    if (typeof options === 'string') {
      this.redisUrl = options;
    } else if (options?.redisUrl) {
      this.redisUrl = options.redisUrl;
    } else {
      this.redisUrl = (typeof process !== 'undefined' && process.env?.REDIS_URL) || 'redis://localhost:6379';
    }

    this.initializeConnection();
  }

  private initializeConnection(): void {
    import('ioredis').then(({ Redis }) => {
      this.client = new Redis(this.redisUrl);
      this.loadScript();
    }).catch(error => {
      console.error('[RateLimiter] Failed to initialize Redis:', error);
    });
  }

  private async loadScript(): Promise<void> {
    if (!this.client) return;

    try {
      const result = await this.client.script('LOAD', TOKEN_BUCKET_SCRIPT);
      this.scriptSha = String(result);
    } catch (error) {
      console.error('[RateLimiter] Failed to load script:', error);
    }
  }

  /**
   * Check if request is allowed under rate limit
   * Returns { allowed, remaining, reset, retryAfter? }
   */
  async checkLimit(
    userId: string,
    limit: number = 60,
    windowSeconds: number = 60
  ): Promise<RateLimitResult> {
    if (!this.client || !this.scriptSha) {
      // Fail open if Redis unavailable
      return {
        allowed: true,
        remaining: 0,
        reset: Date.now() + windowSeconds * 1000,
      };
    }

    try {
      const key = `rate_limit:${userId}`;
      const now = Date.now();

      let result = await this.client.evalsha(
        this.scriptSha,
        1,
        key,
        limit,
        windowSeconds,
        now
      );

      // Retry on NOSCRIPT error
      if (Array.isArray(result) && result.length === 3) {
        const [allowed, remaining, reset] = result;

        return {
          allowed: allowed === 1,
          remaining: Math.max(0, remaining as number),
          reset: reset as number,
          retryAfter: allowed === 0
            ? Math.ceil((reset as number - now) / 1000)
            : undefined,
        };
      }

      throw new Error('Unexpected script response');
    } catch (error) {
      // Handle NOSCRIPT error
      if (error instanceof Error && error.message.includes('NOSCRIPT')) {
        await this.loadScript();
        return this.checkLimit(userId, limit, windowSeconds);
      }

      // Graceful degradation: on Redis failure, allow request but log
      console.error('[RateLimiter] Redis error:', error);
      return {
        allowed: true,
        remaining: 0,
        reset: Date.now() + windowSeconds * 1000,
      };
    }
  }

  /**
   * Get user's current quota without consuming tokens
   */
  async getQuota(userId: string): Promise<{ remaining: number; reset: number }> {
    if (!this.client) {
      return {
        remaining: 60,
        reset: Date.now() + 60 * 1000,
      };
    }

    try {
      const key = `rate_limit:${userId}`;
      const value = await this.client.get(key);
      const ttl = await this.client.ttl(key);

      if (!value || ttl === -2) {
        // Key doesn't exist, return default quota
        return {
          remaining: 60,
          reset: Date.now() + 60 * 1000,
        };
      }

      // Try to parse as JSON first (from token bucket), then as plain number (for test mocks)
      let remaining = 0;

      // Try JSON first
      try {
        const bucket = JSON.parse(value as string);
        if (bucket && typeof bucket === 'object' && typeof bucket.tokens === 'number') {
          remaining = Math.max(0, Math.floor(bucket.tokens));
        } else if (typeof bucket === 'number' && !isNaN(bucket)) {
          remaining = Math.max(0, Math.floor(bucket));
        }
      } catch {
        // If not JSON, try parsing as number directly
        const numValue = parseInt(value as string, 10);
        if (!isNaN(numValue)) {
          remaining = numValue;
        }
      }

      // Fallback to 0 if still couldn't parse
      if (remaining < 0) {
        remaining = 0;
      }

      return {
        remaining,
        reset: Date.now() + Math.max(1, ttl as number) * 1000,
      };
    } catch (error) {
      console.error('[RateLimiter] Failed to get quota:', error);
      return {
        remaining: 60,
        reset: Date.now() + 60 * 1000,
      };
    }
  }

  /**
   * Reset user's rate limit (admin operation)
   */
  async resetLimit(userId: string): Promise<void> {
    if (!this.client) return;

    try {
      const key = `rate_limit:${userId}`;
      await this.client.del(key);
      console.log(`[RateLimiter] Reset limit for user ${userId}`);
    } catch (error) {
      console.error('[RateLimiter] Failed to reset limit:', error);
      // Don't throw on reset failure
    }
  }

  /**
   * Get all active rate limit keys
   */
  async getActiveKeys(pattern: string = 'rate_limit:*'): Promise<string[]> {
    if (!this.client) return [];

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('[RateLimiter] Failed to get active keys:', error);
      return [];
    }
  }

  /**
   * Close Redis connection (for testing)
   */
  async close(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.quit();
    } catch (error) {
      console.error('[RateLimiter] Failed to close connection:', error);
      // Don't throw on close failure
    }
  }
}

/**
 * Global rate limiter instance
 */
let rateLimiter: RedisRateLimiter | null = null;

export function getRateLimiter(options?: string | { redisUrl?: string }): RedisRateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RedisRateLimiter(options);
  }
  return rateLimiter;
}

/**
 * Express middleware for rate limiting
 * Attach rate limit headers to response
 */
export function rateLimitMiddleware(limit: number = 60, window: number = 60) {
  const limiter = getRateLimiter();

  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.id || req.ip;
      if (!userId) {
        return next();
      }

      const result = await limiter.checkLimit(userId, limit, window);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.reset / 1000).toString());

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter?.toString() || window.toString());
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please retry after ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        });
      }

      next();
    } catch (error) {
      console.error('[RateLimitMiddleware] Error:', error);
      next();
    }
  };
}
