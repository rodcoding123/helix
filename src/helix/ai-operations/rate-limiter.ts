/**
 * RateLimiter
 *
 * Token-bucket rate limiting system for enforcing per-user request limits.
 * Each user gets a bucket that refills at a constant rate (REFILL_RATE tokens/second)
 * with a maximum capacity (BUCKET_CAPACITY).
 *
 * Phase 6: Multi-Tenant Support & Advanced API Management
 * Created: 2026-02-04
 */

interface TokenBucket {
  tokens: number;
  lastRefillTime: number;
}

const REFILL_RATE = 100; // tokens per second
const BUCKET_CAPACITY = 100; // maximum tokens in bucket

/**
 * Token-bucket rate limiter for enforcing per-user request limits
 *
 * Implementation:
 * - Each user has a bucket that starts full (100 tokens)
 * - When a request is made, tokens are consumed from the bucket
 * - Bucket refills at 100 tokens/second
 * - Requests are allowed only if enough tokens are available
 * - Token costs are flexible (default 1 token per request)
 */
export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();

  /**
   * Allow a request if enough tokens are available
   * @param userId User identifier
   * @param tokensRequired Number of tokens required for this request
   * @returns true if request allowed, false if rate limited
   */
  allowRequest(userId: string, tokensRequired: number): boolean {
    const bucket = this.getOrCreateBucket(userId);
    this.refillBucket(bucket);

    if (bucket.tokens >= tokensRequired) {
      bucket.tokens -= tokensRequired;
      return true;
    }
    return false;
  }

  /**
   * Calculate milliseconds to wait before retrying
   * @param userId User identifier
   * @param tokensRequired Number of tokens required
   * @returns milliseconds to wait
   */
  getRetryAfterMs(userId: string, tokensRequired: number): number {
    const bucket = this.getOrCreateBucket(userId);
    this.refillBucket(bucket);

    const tokensNeeded = tokensRequired - bucket.tokens;
    if (tokensNeeded <= 0) return 0;

    // Calculate time needed to accumulate required tokens
    const secondsNeeded = tokensNeeded / REFILL_RATE;
    return Math.ceil(secondsNeeded * 1000);
  }

  /**
   * Clear all rate limit buckets
   */
  clear(): void {
    this.buckets.clear();
  }

  private getOrCreateBucket(userId: string): TokenBucket {
    if (!this.buckets.has(userId)) {
      this.buckets.set(userId, {
        tokens: BUCKET_CAPACITY,
        lastRefillTime: Date.now(),
      });
    }
    return this.buckets.get(userId)!;
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const timeSinceRefill = (now - bucket.lastRefillTime) / 1000; // convert to seconds
    const tokensToAdd = timeSinceRefill * REFILL_RATE;

    bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;
  }
}
