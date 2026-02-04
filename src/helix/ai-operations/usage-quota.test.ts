import { describe, it, expect, beforeEach } from 'vitest';
import { UsageQuotaManager } from './usage-quota.js';

describe('UsageQuotaManager', () => {
  let quotaManager: UsageQuotaManager;

  beforeEach(() => {
    quotaManager = new UsageQuotaManager();
  });

  it('should initialize with default tier limits', () => {
    const limits = quotaManager.getTierLimit('free');
    expect(limits).toBe(100); // Free tier: 100/day
  });

  it('should track usage per user', () => {
    quotaManager.incrementUsage('user1', 'free', 10);
    const usage = quotaManager.getUsage('user1');
    expect(usage).toBe(10);
  });

  it('should enforce free tier quota limits (100/day)', () => {
    quotaManager.incrementUsage('user1', 'free', 100);
    const canExecute = quotaManager.canExecuteOperation('user1', 'free', 1);
    expect(canExecute).toBe(false);
  });

  it('should allow pro tier (10k/day)', () => {
    quotaManager.incrementUsage('user2', 'pro', 5000);
    const canExecute = quotaManager.canExecuteOperation('user2', 'pro', 5000);
    expect(canExecute).toBe(true);
  });

  it('should allow enterprise tier unlimited usage', () => {
    quotaManager.incrementUsage('user3', 'enterprise', 50000);
    const canExecute = quotaManager.canExecuteOperation('user3', 'enterprise', 50000);
    expect(canExecute).toBe(true);
  });

  it('should reset daily usage', () => {
    quotaManager.incrementUsage('user1', 'free', 50);
    quotaManager.resetDailyUsage('user1');
    const usage = quotaManager.getUsage('user1');
    expect(usage).toBe(0);
  });

  it('should calculate remaining quota', () => {
    quotaManager.incrementUsage('user1', 'free', 30);
    const remaining = quotaManager.getRemainingQuota('user1', 'free');
    expect(remaining).toBe(70); // 100 - 30
  });

  it('should clear all quotas', () => {
    quotaManager.incrementUsage('user1', 'free', 50);
    quotaManager.clear();
    const usage = quotaManager.getUsage('user1');
    expect(usage).toBe(0);
  });

  it('should update tier when user changes tier', () => {
    quotaManager.incrementUsage('user1', 'free', 50);
    quotaManager.incrementUsage('user1', 'pro', 50); // User upgraded
    const canExecute = quotaManager.canExecuteOperation('user1', 'pro', 9900);
    expect(canExecute).toBe(true); // Should use pro tier limit (10k)
  });

  it('should return 0 remaining quota when over limit', () => {
    quotaManager.incrementUsage('user1', 'free', 150);
    const remaining = quotaManager.getRemainingQuota('user1', 'free');
    expect(remaining).toBe(0); // Should be clamped to 0, not negative
  });

  it('should handle reset for non-existent user gracefully', () => {
    quotaManager.resetDailyUsage('nonexistent');
    const usage = quotaManager.getUsage('nonexistent');
    expect(usage).toBe(0); // Should not throw, returns 0
  });
});
