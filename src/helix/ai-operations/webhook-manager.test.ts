import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookManager } from './webhook-manager.js';

describe('WebhookManager', () => {
  let manager: WebhookManager;

  beforeEach(() => {
    manager = new WebhookManager();
    vi.useFakeTimers();
  });

  describe('Webhook Registration', () => {
    it('registers webhook endpoint', () => {
      const webhookId = manager.registerWebhook('user_123', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      expect(webhookId).toBeDefined();
      const webhooks = manager.getUserWebhooks('user_123');
      expect(webhooks).toHaveLength(1);
      expect(webhooks[0].url).toBe('https://myapp.com/webhooks');
    });

    it('filters events by type', () => {
      manager.registerWebhook('user_456', 'https://myapp.com/webhooks', ['operation_complete']);
      const webhooks = manager.getUserWebhooks('user_456');
      expect(webhooks[0].eventTypes).toContain('operation_complete');
      expect(webhooks[0].eventTypes).not.toContain('operation_failed');
    });
  });

  describe('Event Delivery', () => {
    it('queues event for webhook delivery', () => {
      const webhookId = manager.registerWebhook('user_789', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      manager.queueEvent('operation_complete', {
        operationId: 'op_123',
        userId: 'user_789',
        operationType: 'email_analysis',
        result: { sentiment: 'positive' },
      });

      const queue = manager.getPendingDeliveries(webhookId);
      expect(queue).toHaveLength(1);
    });

    it('filters events based on subscription', () => {
      const webhookId = manager.registerWebhook('user_999', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      manager.queueEvent('operation_failed', {
        operationId: 'op_123',
        userId: 'user_999',
        errorMessage: 'Timeout',
      });

      const queue = manager.getPendingDeliveries(webhookId);
      expect(queue).toHaveLength(0); // operation_failed not subscribed
    });
  });

  describe('Retry Logic', () => {
    it('retries failed deliveries with exponential backoff', () => {
      const webhookId = manager.registerWebhook('user_123', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      manager.queueEvent('operation_complete', {
        operationId: 'op_123',
        userId: 'user_123',
        operationType: 'email_analysis',
      });

      const delivery = manager.getPendingDeliveries(webhookId)[0];
      manager.markDeliveryAttempt(delivery.id, false); // Failed

      expect(delivery.retryCount).toBe(1);
      expect(delivery.nextRetryTime).toBeDefined();
    });

    it('stops retrying after max attempts', () => {
      const webhookId = manager.registerWebhook('user_456', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      manager.queueEvent('operation_complete', {
        operationId: 'op_456',
        userId: 'user_456',
        operationType: 'video_analysis',
      });

      const delivery = manager.getPendingDeliveries(webhookId)[0];

      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        manager.markDeliveryAttempt(delivery.id, false);
      }

      const updatedDelivery = manager.getDelivery(delivery.id);
      expect(updatedDelivery?.status).toBe('failed');
    });
  });

  describe('Webhook Deregistration', () => {
    it('unregisters webhook', () => {
      const webhookId = manager.registerWebhook('user_789', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      manager.unregisterWebhook(webhookId);

      const webhooks = manager.getUserWebhooks('user_789');
      expect(webhooks).toHaveLength(0);
    });
  });

  describe('Clear', () => {
    it('clears all webhooks and deliveries', () => {
      manager.registerWebhook('user_123', 'https://myapp.com/webhooks', ['operation_complete']);
      manager.clear();

      const webhooks = manager.getUserWebhooks('user_123');
      expect(webhooks).toHaveLength(0);
    });
  });
});
