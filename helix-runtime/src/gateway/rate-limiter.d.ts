/**
 * Token bucket rate limiter
 * O(1) complexity per check vs O(n) for sliding window
 * Prevents CPU spikes under load, suitable for high-traffic gateways
 */
export declare class RateLimiter {
    private buckets;
    private cleanupInterval;
    constructor();
    checkLimit(userId: string, method: string): {
        allowed: boolean;
        retryAfterMs?: number;
    };
    private cleanup;
    destroy(): void;
}
//# sourceMappingURL=rate-limiter.d.ts.map