import { describe, it, expect } from 'vitest';
import { UsageQuotaManager } from './usage-quota.js';
import { RateLimiter } from './rate-limiter.js';
import { BillingEngine } from './billing-engine.js';
import { AnalyticsCollector } from './analytics-collector.js';
import { WebhookManager } from './webhook-manager.js';

describe('Phase 6: Multi-Tenant SaaS Integration', () => {
  describe('Quota + Billing Integration', () => {
    it('enforces quotas and tracks billing together', () => {
      const quota = new UsageQuotaManager();
      const billing = new BillingEngine();

      // User has 100 ops/day quota
      const canExecute = quota.canExecuteOperation('user_123', 'free', 50);
      expect(canExecute).toBe(true);

      // Execute and record cost
      quota.incrementUsage('user_123', 'free', 50);
      billing.recordOperation('user_123', 'email_analysis', 0.05);

      const usage = quota.getUsage('user_123');
      const monthlyUsage = billing.getMonthlyUsage('user_123');

      expect(usage).toBe(50);
      expect(monthlyUsage.totalCost).toBe(0.05);
    });
  });

  describe('Rate Limiting + Analytics', () => {
    it('tracks rate limited requests in analytics', () => {
      const limiter = new RateLimiter();
      const analytics = new AnalyticsCollector();

      // Allow 3 requests
      limiter.allowRequest('user_456', 100);
      limiter.allowRequest('user_456', 100);
      limiter.allowRequest('user_456', 100);

      // Capture events
      for (let i = 0; i < 3; i++) {
        analytics.captureEvent('operation_complete', {
          operationId: `op_${i}`,
          userId: 'user_456',
          operationType: 'email_analysis',
          latencyMs: 100,
          costUsd: 0.005,
          success: true,
        });
      }

      const hourly = analytics.getHourlyAggregation();
      expect(hourly.totalEvents).toBe(3);
      expect(hourly.successRate).toBe(1.0);
    });
  });

  describe('Webhook + Billing', () => {
    it('sends billing events via webhook', () => {
      const webhooks = new WebhookManager();
      const billing = new BillingEngine();

      // Register webhook for completion events
      const webhookId = webhooks.registerWebhook('user_789', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      // Process operation
      billing.recordOperation('user_789', 'email_analysis', 0.01);

      // Send webhook event
      webhooks.queueEvent('operation_complete', {
        userId: 'user_789',
        operationId: 'op_123',
        operationType: 'email_analysis',
        costUsd: 0.01,
      });

      const pending = webhooks.getPendingDeliveries(webhookId);
      expect(pending).toHaveLength(1);

      const invoice = billing.generateInvoice('user_789');
      expect(invoice.totalAmount).toBeCloseTo(0.011); // 0.01 + 10% tax
    });
  });

  describe('End-to-End Multi-Tenant Workflow', () => {
    it('executes complete Phase 6 workflow', () => {
      const quota = new UsageQuotaManager();
      const limiter = new RateLimiter();
      const billing = new BillingEngine();
      const analytics = new AnalyticsCollector();
      const webhooks = new WebhookManager();

      // 1. Register webhook
      const webhookId = webhooks.registerWebhook('user_multi', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      // 2. Check quota
      expect(quota.canExecuteOperation('user_multi', 'pro', 100)).toBe(true);

      // 3. Check rate limit
      expect(limiter.allowRequest('user_multi', 100)).toBe(true);

      // 4. Execute operation (simulated)
      quota.incrementUsage('user_multi', 'pro', 100);
      billing.recordOperation('user_multi', 'email_analysis', 0.025);

      // 5. Capture analytics
      analytics.captureEvent('operation_complete', {
        operationId: 'op_multi',
        userId: 'user_multi',
        operationType: 'email_analysis',
        latencyMs: 234,
        costUsd: 0.025,
        success: true,
      });

      // 6. Queue webhook
      webhooks.queueEvent('operation_complete', {
        userId: 'user_multi',
        operationId: 'op_multi',
        operationType: 'email_analysis',
        costUsd: 0.025,
      });

      // Verify state
      expect(quota.getUsage('user_multi')).toBe(100);
      expect(billing.getMonthlyUsage('user_multi').totalCost).toBeCloseTo(0.025);
      expect(analytics.getHourlyAggregation().totalCostUsd).toBeCloseTo(0.025);
      expect(webhooks.getPendingDeliveries(webhookId)).toHaveLength(1);
    });
  });
});
