/**
 * Rate Limiter - Phase 6
 *
 * Implements token-bucket rate limiting with sliding window tracking.
 * Prevents API abuse and ensures fair resource allocation.
 */

interface TokenBucketState {
  tokens: number;
  lastRefillTime: number;
  requestTimestamps: number[];
}

const REFILL_RATE = 10000; // tokens per second (10 per millisecond)
const BUCKET_CAPACITY = 300; // max tokens
const SLIDING_WINDOW_MS = 60000; // 1 minute
const SLIDING_WINDOW_LIMIT = 60; // max 60 requests per minute

export class RateLimiter {
  private buckets: Map<string, TokenBucketState> = new Map();

  /**
   * Allow request if tokens available
   */
  allowRequest(userId: string, tokensRequired: number): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = {
        tokens: BUCKET_CAPACITY,
        lastRefillTime: now,
        requestTimestamps: [],
      };
      this.buckets.set(userId, bucket);
    }

    // Clean up old timestamps outside the sliding window
    bucket.requestTimestamps = bucket.requestTimestamps.filter(ts => now - ts < SLIDING_WINDOW_MS);

    // Check sliding window limit (60 requests per minute)
    if (bucket.requestTimestamps.length >= SLIDING_WINDOW_LIMIT) {
      return false;
    }

    // Refill tokens based on elapsed time
    const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
    const tokensToAdd = elapsedSeconds * REFILL_RATE;
    bucket.tokens = Math.min(bucket.tokens + tokensToAdd, BUCKET_CAPACITY);
    bucket.lastRefillTime = now;

    // Check if request can proceed with token bucket
    if (bucket.tokens >= tokensRequired) {
      bucket.tokens -= tokensRequired;
      bucket.requestTimestamps.push(now);
      return true;
    }

    return false;
  }

  /**
   * Get retry-after duration in milliseconds
   */
  getRetryAfterMs(userId: string, tokensRequired: number): number {
    const bucket = this.buckets.get(userId);
    if (!bucket) {
      return 0;
    }

    const now = Date.now();

    // Clean up old timestamps
    bucket.requestTimestamps = bucket.requestTimestamps.filter(ts => now - ts < SLIDING_WINDOW_MS);

    // If at sliding window limit, return time until oldest request expires
    if (bucket.requestTimestamps.length >= SLIDING_WINDOW_LIMIT) {
      const oldestTimestamp = bucket.requestTimestamps[0];
      const retryTime = oldestTimestamp + SLIDING_WINDOW_MS;
      return Math.max(0, retryTime - now);
    }

    // Otherwise check token bucket
    const tokensNeeded = tokensRequired - bucket.tokens;
    if (tokensNeeded <= 0) {
      return 0;
    }

    // Calculate how long to wait for required tokens
    return Math.ceil((tokensNeeded / REFILL_RATE) * 1000);
  }

  /**
   * Clear all rate limit state
   */
  clear(): void {
    this.buckets.clear();
  }
}
