/**
 * UsageQuotaManager
 *
 * Tier-based quota system that tracks and enforces operation limits per user/tier.
 *
 * Tier Limits:
 * - Free: 100 operations/day
 * - Pro: 10,000 operations/day
 * - Enterprise: Unlimited
 *
 * Phase 6, Task 1: Multi-Tenant Support & Advanced API Management
 * Created: 2026-02-04
 */

export type QuotaTier = 'free' | 'pro' | 'enterprise';

interface QuotaEntry {
  userId: string;
  tier: QuotaTier;
  usage: number;
  lastReset: number;
}

const DEFAULT_QUOTA_LIMITS: Record<QuotaTier, number> = {
  free: 100,
  pro: 10000,
  enterprise: Infinity,
};

/**
 * UsageQuotaManager - Tracks and enforces tier-based operation limits
 *
 * Responsibilities:
 * 1. Track usage per user
 * 2. Enforce tier-based limits (free=100, pro=10k, enterprise=unlimited)
 * 3. Calculate remaining quota
 * 4. Reset daily usage
 * 5. Provide quota management operations
 */
export class UsageQuotaManager {
  private quotas: Map<string, QuotaEntry> = new Map();

  /**
   * Get the daily limit for a tier
   */
  getTierLimit(tier: QuotaTier): number {
    return DEFAULT_QUOTA_LIMITS[tier];
  }

  /**
   * Increment usage for a user
   *
   * Creates new quota entry if not exists, updates existing entry otherwise.
   * Updates tier if user changes tiers (e.g., free → pro).
   */
  incrementUsage(userId: string, tier: QuotaTier, amount: number): void {
    const existing = this.quotas.get(userId);

    if (existing) {
      existing.usage += amount;
      existing.tier = tier; // Update tier when user changes tiers
    } else {
      this.quotas.set(userId, {
        userId,
        tier,
        usage: amount,
        lastReset: Date.now(),
      });
    }
  }

  /**
   * Get current usage for a user
   *
   * Returns 0 if user not found.
   */
  getUsage(userId: string): number {
    const entry = this.quotas.get(userId);
    return entry ? entry.usage : 0;
  }

  /**
   * Check if an operation can be executed within quota limits
   *
   * Returns true if: current usage + amount <= tier limit
   * Returns false if limit would be exceeded
   */
  canExecuteOperation(userId: string, tier: QuotaTier, amount: number): boolean {
    const usage = this.getUsage(userId);
    const limit = DEFAULT_QUOTA_LIMITS[tier];
    return usage + amount <= limit;
  }

  /**
   * Get remaining quota for a user on a tier
   *
   * Calculated as: tier limit - current usage
   * Returns 0 if already at/over limit
   */
  getRemainingQuota(userId: string, tier: QuotaTier): number {
    const usage = this.getUsage(userId);
    const limit = DEFAULT_QUOTA_LIMITS[tier];
    return Math.max(0, limit - usage);
  }

  /**
   * Reset daily usage for a user
   *
   * Sets usage to 0 and updates lastReset timestamp.
   * No-op if user not found.
   */
  resetDailyUsage(userId: string): void {
    const entry = this.quotas.get(userId);
    if (entry) {
      entry.usage = 0;
      entry.lastReset = Date.now();
    }
  }

  /**
   * Clear all quotas
   *
   * Removes all tracked quotas. Useful for testing or manual reset.
   */
  clear(): void {
    this.quotas.clear();
  }
}
