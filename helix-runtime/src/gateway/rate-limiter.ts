interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
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

export class RateLimiter {
  private requestCounts = new Map<string, number[]>();

  checkLimit(userId: string, method: string): { allowed: boolean; retryAfterMs?: number } {
    const rule = RATE_LIMITS[method] || RATE_LIMITS.default;
    const userKey = `${userId}:${method}`;
    const now = Date.now();

    // Get timestamps within window
    const timestamps = this.requestCounts.get(userKey) || [];
    const validTimestamps = timestamps.filter(ts => now - ts < rule.windowMs);

    if (validTimestamps.length >= rule.maxRequests) {
      const oldestRequest = Math.min(...validTimestamps);
      const retryAfterMs = rule.windowMs - (now - oldestRequest);
      return { allowed: false, retryAfterMs };
    }

    // Record this request
    validTimestamps.push(now);
    this.requestCounts.set(userKey, validTimestamps);

    // Cleanup old entries
    if (this.requestCounts.size > 10000) {
      this.cleanup();
    }

    return { allowed: true };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requestCounts.entries()) {
      const valid = timestamps.filter(ts => now - ts < 60_000);
      if (valid.length === 0) {
        this.requestCounts.delete(key);
      } else {
        this.requestCounts.set(key, valid);
      }
    }
  }
}
