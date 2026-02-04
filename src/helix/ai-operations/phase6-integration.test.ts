import { describe, it, expect, beforeEach } from 'vitest';
import { AIOperationRouter } from './router';

describe('Phase 6 Integration', () => {
  let router: AIOperationRouter;

  beforeEach(() => {
    router = new AIOperationRouter();
  });

  it('should have all phase 6 managers available', () => {
    expect(router.getQuotaManager()).toBeDefined();
    expect(router.getRateLimiter()).toBeDefined();
    expect(router.getBillingEngine()).toBeDefined();
    expect(router.getAnalyticsCollector()).toBeDefined();
    expect(router.getWebhookManager()).toBeDefined();
  });

  it('should track operations through quota manager', () => {
    const quotaManager = router.getQuotaManager();
    quotaManager.incrementUsage('user1', 'free', 50);
    expect(quotaManager.getUsage('user1')).toBe(50);
  });

  it('should apply rate limiting to users', () => {
    const rateLimiter = router.getRateLimiter();
    const allowed1 = rateLimiter.allowRequest('user1', 50);
    expect(allowed1).toBe(true);
  });

  it('should bill users for operations', () => {
    const billingEngine = router.getBillingEngine();
    billingEngine.recordOperation('user1', 'gpt-4', 10.0);
    const usage = billingEngine.getMonthlyUsage('user1');
    expect(usage.totalCost).toBe(10.0);
  });

  it('should collect analytics events', () => {
    const analyticsCollector = router.getAnalyticsCollector();
    analyticsCollector.captureEvent('operation_start', {
      operationId: 'op1',
      userId: 'user1',
      operationType: 'gpt-4',
    });
    expect(analyticsCollector.getEvents()).toHaveLength(1);
  });

  it('should manage webhooks for real-time integration', () => {
    const webhookManager = router.getWebhookManager();
    const webhook = webhookManager.registerWebhook('user1', 'https://example.com/webhook', [
      'operation_complete',
    ]);
    expect(webhook.userId).toBe('user1');
  });

  it('should integrate all managers for complete operation flow', () => {
    const quotaManager = router.getQuotaManager();
    const rateLimiter = router.getRateLimiter();
    const billingEngine = router.getBillingEngine();
    const analyticsCollector = router.getAnalyticsCollector();
    const webhookManager = router.getWebhookManager();

    // Register webhook
    webhookManager.registerWebhook('user1', 'https://example.com/webhook', ['operation_complete']);

    // Check quota
    const canExecute = quotaManager.canExecuteOperation('user1', 'free', 10);
    expect(canExecute).toBe(true);

    // Check rate limit
    const allowed = rateLimiter.allowRequest('user1', 10);
    expect(allowed).toBe(true);

    // Track usage and cost
    quotaManager.incrementUsage('user1', 'free', 10);
    billingEngine.recordOperation('user1', 'gpt-4', 5.0);

    // Capture analytics
    analyticsCollector.captureEvent('operation_complete', {
      operationId: 'op1',
      userId: 'user1',
      operationType: 'gpt-4',
      latencyMs: 150,
      costUsd: 5.0,
      success: true,
    });

    // Queue webhook event
    analyticsCollector.captureEvent('operation_complete', {
      operationId: 'op1',
      userId: 'user1',
      operationType: 'gpt-4',
      latencyMs: 150,
      costUsd: 5.0,
      success: true,
    });

    // Verify all data was captured
    expect(quotaManager.getUsage('user1')).toBe(10);
    expect(billingEngine.getMonthlyUsage('user1').totalCost).toBe(5.0);
    expect(analyticsCollector.getEvents()).toHaveLength(2);
  });
});
