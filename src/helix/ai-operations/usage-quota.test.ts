import { describe, it, expect, beforeEach } from 'vitest';
import { UsageQuotaManager } from './usage-quota.js';

describe('UsageQuotaManager', () => {
  let quotaManager: UsageQuotaManager;

  beforeEach(() => {
    quotaManager = new UsageQuotaManager();
  });

  describe('Quota Initialization', () => {
    it('initializes with correct tier limits', () => {
      const freeQuota = quotaManager.getTierLimit('free');
      const proQuota = quotaManager.getTierLimit('pro');
      const enterpriseQuota = quotaManager.getTierLimit('enterprise');

      expect(freeQuota).toBe(100);
      expect(proQuota).toBe(10000);
      expect(enterpriseQuota).toBe(Infinity);
    });
  });

  describe('Usage Tracking', () => {
    it('tracks daily usage for user', () => {
      quotaManager.incrementUsage('user_123', 'free', 50);
      const usage = quotaManager.getUsage('user_123');
      expect(usage).toBe(50);
    });

    it('accumulates usage across multiple calls', () => {
      quotaManager.incrementUsage('user_123', 'free', 30);
      quotaManager.incrementUsage('user_123', 'free', 20);
      const usage = quotaManager.getUsage('user_123');
      expect(usage).toBe(50);
    });
  });

  describe('Quota Enforcement', () => {
    it('allows operations within quota', () => {
      quotaManager.incrementUsage('user_123', 'free', 50);
      const canExecute = quotaManager.canExecuteOperation('user_123', 'free', 25);
      expect(canExecute).toBe(true);
    });

    it('rejects operations exceeding quota', () => {
      quotaManager.incrementUsage('user_123', 'free', 90);
      const canExecute = quotaManager.canExecuteOperation('user_123', 'free', 25);
      expect(canExecute).toBe(false);
    });

    it('allows pro tier higher quotas', () => {
      quotaManager.incrementUsage('user_456', 'pro', 9500);
      const canExecute = quotaManager.canExecuteOperation('user_456', 'pro', 400);
      expect(canExecute).toBe(true);
    });

    it('rejects pro tier exceeding 10k limit', () => {
      quotaManager.incrementUsage('user_456', 'pro', 9500);
      const canExecute = quotaManager.canExecuteOperation('user_456', 'pro', 600);
      expect(canExecute).toBe(false);
    });
  });

  describe('Enterprise Unlimited', () => {
    it('allows unlimited operations for enterprise', () => {
      quotaManager.incrementUsage('user_789', 'enterprise', 1000000);
      const canExecute = quotaManager.canExecuteOperation('user_789', 'enterprise', 500000);
      expect(canExecute).toBe(true);
    });
  });

  describe('Quota Reset', () => {
    it('resets daily usage', () => {
      quotaManager.incrementUsage('user_123', 'free', 50);
      quotaManager.resetDailyUsage('user_123');
      const usage = quotaManager.getUsage('user_123');
      expect(usage).toBe(0);
    });
  });

  describe('Remaining Quota Info', () => {
    it('returns remaining quota', () => {
      quotaManager.incrementUsage('user_123', 'free', 30);
      const remaining = quotaManager.getRemainingQuota('user_123', 'free');
      expect(remaining).toBe(70); // 100 - 30
    });

    it('returns negative remaining when exceeded', () => {
      quotaManager.incrementUsage('user_123', 'free', 120);
      const remaining = quotaManager.getRemainingQuota('user_123', 'free');
      expect(remaining).toBe(-20); // 100 - 120
    });
  });
});
