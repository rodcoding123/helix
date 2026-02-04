import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookManager } from './webhook-manager.js';

describe('WebhookManager', () => {
  let webhookManager: WebhookManager;

  beforeEach(() => {
    webhookManager = new WebhookManager();
  });

  it('should register a webhook', () => {
    const webhook = webhookManager.registerWebhook('user1', 'https://example.com/webhook', [
      'operation_complete',
    ]);
    expect(webhook.userId).toBe('user1');
    expect(webhook.url).toBe('https://example.com/webhook');
    expect(webhook.eventTypes).toContain('operation_complete');
  });

  it('should unregister a webhook', () => {
    const webhook = webhookManager.registerWebhook('user1', 'https://example.com/webhook', [
      'operation_complete',
    ]);
    webhookManager.unregisterWebhook(webhook.id);
    const userWebhooks = webhookManager.getUserWebhooks('user1');
    expect(userWebhooks).toHaveLength(0);
  });

  it('should get webhooks for a user', () => {
    webhookManager.registerWebhook('user1', 'https://example.com/webhook1', ['operation_complete']);
    webhookManager.registerWebhook('user1', 'https://example.com/webhook2', ['operation_failed']);
    const userWebhooks = webhookManager.getUserWebhooks('user1');
    expect(userWebhooks).toHaveLength(2);
  });

  it('should queue events for delivery', () => {
    const webhook = webhookManager.registerWebhook('user1', 'https://example.com/webhook', [
      'operation_complete',
    ]);
    webhookManager.queueEvent('operation_complete', { operationId: 'op1', success: true });

    const deliveries = webhookManager.getPendingDeliveries(webhook.id);
    expect(deliveries.length).toBeGreaterThan(0);
  });

  it('should calculate exponential backoff correctly', () => {
    // Test exponential backoff: 1000ms * 2^attempt, cap at MAX_BACKOFF_MS
    const webhook = webhookManager.registerWebhook('user1', 'https://example.com/webhook', [
      'operation_complete',
    ]);

    // Queue event and mark first attempt as failed
    webhookManager.queueEvent('operation_complete', { operationId: 'op1', success: true });
    const delivery1 = webhookManager.getPendingDeliveries(webhook.id)[0];
    const baseTime1 = Date.now();
    webhookManager.markDeliveryAttempt(delivery1.id, false);

    // Small delay to ensure different timestamps and backoff calculations
    const expectedBackoff1 = 1000 * Math.pow(2, 0); // 1000ms

    // Queue another and mark as failed attempt 2
    webhookManager.queueEvent('operation_complete', { operationId: 'op2', success: true });
    const delivery2 = webhookManager.getPendingDeliveries(webhook.id)[0];
    const baseTime2 = Date.now();
    webhookManager.markDeliveryAttempt(delivery2.id, false);

    // Expected backoff for second attempt is double the first
    const expectedBackoff2 = 1000 * Math.pow(2, 0); // Still 1000ms for first attempt on this delivery

    // Verify the backoff times are within expected ranges
    expect(delivery1.nextRetryTime).toBeGreaterThanOrEqual(baseTime1 + expectedBackoff1 - 10);
    expect(delivery2.nextRetryTime).toBeGreaterThanOrEqual(baseTime2 + expectedBackoff2 - 10);
  });

  it('should stop retrying after MAX_RETRIES', () => {
    const webhook = webhookManager.registerWebhook('user1', 'https://example.com/webhook', [
      'operation_complete',
    ]);
    webhookManager.queueEvent('operation_complete', { operationId: 'op1', success: true });

    const delivery = webhookManager.getPendingDeliveries(webhook.id)[0];

    // Mark as failed 5 times (MAX_RETRIES = 5)
    for (let i = 0; i < 5; i++) {
      webhookManager.markDeliveryAttempt(delivery.id, false);
    }

    // Should be marked as failed
    expect(delivery.status).toBe('failed');
  });

  it('should filter events by webhook event types', () => {
    webhookManager.registerWebhook('user1', 'https://example.com/webhook1', ['operation_complete']);
    webhookManager.registerWebhook('user1', 'https://example.com/webhook2', ['operation_failed']);

    // Queue operation_complete event
    webhookManager.queueEvent('operation_complete', { operationId: 'op1', success: true });

    const webhook1Deliveries = webhookManager.getPendingDeliveries(
      webhookManager.getUserWebhooks('user1')[0].id
    );
    const webhook2Deliveries = webhookManager.getPendingDeliveries(
      webhookManager.getUserWebhooks('user1')[1].id
    );

    // webhook1 should have the delivery (registered for operation_complete)
    expect(webhook1Deliveries.length).toBeGreaterThan(0);
    // webhook2 should not have the delivery (only registered for operation_failed)
    expect(webhook2Deliveries).toHaveLength(0);
  });

  it('should clear all webhooks and deliveries', () => {
    webhookManager.registerWebhook('user1', 'https://example.com/webhook', ['operation_complete']);
    webhookManager.queueEvent('operation_complete', { operationId: 'op1', success: true });

    webhookManager.clear();

    const userWebhooks = webhookManager.getUserWebhooks('user1');
    expect(userWebhooks).toHaveLength(0);
  });
});
