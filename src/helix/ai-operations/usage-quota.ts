/**
 * Usage Quota Manager - Phase 6
 *
 * Enforces per-user operation quotas based on subscription tier.
 * Tracks daily usage with automatic reset at UTC midnight.
 */

export type QuotaTier = 'free' | 'pro' | 'enterprise';

export interface QuotaConfig {
  free: number;
  pro: number;
  enterprise: number;
}

const DEFAULT_QUOTA_LIMITS: QuotaConfig = {
  free: 100,
  pro: 10000,
  enterprise: Infinity,
};

interface UserQuotaData {
  dailyUsage: number;
  lastResetDate: string;
}

export class UsageQuotaManager {
  private quotaLimits: QuotaConfig = DEFAULT_QUOTA_LIMITS;
  private userQuotas: Map<string, UserQuotaData> = new Map();

  /**
   * Get quota limit for tier
   */
  getTierLimit(tier: QuotaTier): number {
    return this.quotaLimits[tier];
  }

  /**
   * Increment usage for user
   */
  incrementUsage(userId: string, _tier: QuotaTier, amount: number): void {
    if (!this.userQuotas.has(userId)) {
      this.userQuotas.set(userId, {
        dailyUsage: 0,
        lastResetDate: new Date().toISOString().split('T')[0],
      });
    }

    const quota = this.userQuotas.get(userId)!;
    quota.dailyUsage += amount;
  }

  /**
   * Get current daily usage for user
   */
  getUsage(userId: string): number {
    const quota = this.userQuotas.get(userId);
    return quota?.dailyUsage || 0;
  }

  /**
   * Check if operation can be executed within quota
   */
  canExecuteOperation(userId: string, tier: QuotaTier, operationCount: number): boolean {
    const limit = this.getTierLimit(tier);
    if (limit === Infinity) {
      return true; // Enterprise has unlimited quota
    }

    const currentUsage = this.getUsage(userId);
    return currentUsage + operationCount <= limit;
  }

  /**
   * Get remaining quota for user
   */
  getRemainingQuota(userId: string, tier: QuotaTier): number {
    const limit = this.getTierLimit(tier);
    if (limit === Infinity) {
      return Infinity;
    }

    const currentUsage = this.getUsage(userId);
    return limit - currentUsage;
  }

  /**
   * Reset daily usage (call at UTC midnight)
   */
  resetDailyUsage(userId: string): void {
    const quota = this.userQuotas.get(userId);
    if (quota) {
      quota.dailyUsage = 0;
      quota.lastResetDate = new Date().toISOString().split('T')[0];
    }
  }

  /**
   * Clear all quotas (for testing)
   */
  clear(): void {
    this.userQuotas.clear();
  }
}
