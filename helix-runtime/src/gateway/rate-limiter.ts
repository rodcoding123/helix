interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
}

/**
 * Token bucket for a single user/method combination
 * O(1) complexity vs O(n) for sliding window
 * Tokens refill at: maxRequests / windowMs per millisecond
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const RATE_LIMITS: Record<string, RateLimitRule> = {
  // Expensive AI operations
  'memory.synthesize': { maxRequests: 10, windowMs: 60_000 }, // 10/min
  'skills.execute_composite': { maxRequests: 30, windowMs: 60_000 },
  'agent': { maxRequests: 100, windowMs: 60_000 },

  // Medium-cost operations
  'email.send_message': { maxRequests: 50, windowMs: 60_000 },
  'calendar.add_event': { maxRequests: 100, windowMs: 60_000 },

  // Read operations (generous)
  'email.get_conversations': { maxRequests: 300, windowMs: 60_000 },
  'calendar.get_events': { maxRequests: 300, windowMs: 60_000 },

  // Default
  'default': { maxRequests: 200, windowMs: 60_000 },
};

/**
 * Token bucket rate limiter
 * O(1) complexity per check vs O(n) for sliding window
 * Prevents CPU spikes under load, suitable for high-traffic gateways
 */
export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup old buckets every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  checkLimit(userId: string, method: string): { allowed: boolean; retryAfterMs?: number } {
    const rule = RATE_LIMITS[method] || RATE_LIMITS.default;
    const userKey = `${userId}:${method}`;
    const now = Date.now();

    // Get or create bucket
    let bucket = this.buckets.get(userKey);
    if (!bucket) {
      bucket = { tokens: rule.maxRequests, lastRefill: now };
      this.buckets.set(userKey, bucket);
    }

    // Calculate refill amount based on time elapsed
    // tokens_per_ms = maxRequests / windowMs
    const elapsedMs = now - bucket.lastRefill;
    const refillRate = rule.maxRequests / rule.windowMs;
    const tokensToAdd = elapsedMs * refillRate;
    bucket.tokens = Math.min(rule.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if request allowed
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }

    // Calculate retry after
    // Need 1 token, currently have bucket.tokens
    // tokens_per_ms = maxRequests / windowMs
    const tokenNeeded = 1 - bucket.tokens;
    const msNeeded = tokenNeeded / refillRate;
    return { allowed: false, retryAfterMs: Math.ceil(msNeeded) };
  }

  private cleanup(): void {
    // Remove buckets that haven't been used for a full window
    const now = Date.now();
    const maxWindow = Math.max(...Object.values(RATE_LIMITS).map(r => r.windowMs));

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxWindow) {
        this.buckets.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
