/**
 * WebhookManager
 *
 * Real-time event delivery system with exponential backoff retry logic for webhook
 * callbacks to third-party integrations.
 *
 * Phase 6: Multi-Tenant Support & Advanced API Management
 * Task 5: Webhook Manager implementation
 * Created: 2026-02-04
 */

export type DeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  eventTypes: string[];
  createdAt: number;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  attempts: number;
  nextRetryTime: number;
  createdAt: number;
}

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000; // 1 second
const MAX_BACKOFF_MS = 32000; // 32 seconds

/**
 * WebhookManager - Real-time event delivery for third-party integrations
 *
 * Features:
 * 1. Webhook registration per user
 * 2. Event-based delivery filtering
 * 3. Exponential backoff retry logic
 * 4. Delivery status tracking
 * 5. Multi-event support per webhook
 */
export class WebhookManager {
  private webhooks: Map<string, Webhook> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private userWebhooks: Map<string, string[]> = new Map(); // userId -> webhookIds
  private webhookIdCounter = 0;
  private deliveryIdCounter = 0;

  /**
   * Register a webhook for a user
   * @param userId User identifier
   * @param url Webhook URL
   * @param eventTypes Event types to subscribe to
   * @returns Registered webhook
   */
  registerWebhook(userId: string, url: string, eventTypes: string[]): Webhook {
    const webhookId = `webhook_${this.webhookIdCounter++}`;

    const webhook: Webhook = {
      id: webhookId,
      userId,
      url,
      eventTypes,
      createdAt: Date.now(),
    };

    this.webhooks.set(webhookId, webhook);

    if (!this.userWebhooks.has(userId)) {
      this.userWebhooks.set(userId, []);
    }
    this.userWebhooks.get(userId)!.push(webhookId);

    return webhook;
  }

  /**
   * Unregister a webhook
   * @param webhookId Webhook identifier
   */
  unregisterWebhook(webhookId: string): void {
    const webhook = this.webhooks.get(webhookId);
    if (webhook) {
      const userWebhooks = this.userWebhooks.get(webhook.userId);
      if (userWebhooks) {
        const index = userWebhooks.indexOf(webhookId);
        if (index !== -1) {
          userWebhooks.splice(index, 1);
        }
      }
      this.webhooks.delete(webhookId);
    }
  }

  /**
   * Get webhooks for a user
   * @param userId User identifier
   * @returns User's webhooks
   */
  getUserWebhooks(userId: string): Webhook[] {
    const webhookIds = this.userWebhooks.get(userId) || [];
    return webhookIds
      .map(id => this.webhooks.get(id))
      .filter((webhook): webhook is Webhook => webhook !== undefined);
  }

  /**
   * Queue an event for webhook delivery
   * @param eventType Event type
   * @param payload Event payload
   */
  queueEvent(eventType: string, payload: Record<string, unknown>): void {
    // Find all webhooks subscribed to this event type
    for (const webhook of this.webhooks.values()) {
      if (webhook.eventTypes.includes(eventType)) {
        const deliveryId = `delivery_${this.deliveryIdCounter++}`;

        const delivery: WebhookDelivery = {
          id: deliveryId,
          webhookId: webhook.id,
          eventType,
          payload,
          status: 'pending',
          attempts: 0,
          nextRetryTime: Date.now(),
          createdAt: Date.now(),
        };

        this.deliveries.set(deliveryId, delivery);
      }
    }
  }

  /**
   * Get pending deliveries for a webhook
   * @param webhookId Webhook identifier
   * @returns Pending deliveries
   */
  getPendingDeliveries(webhookId: string): WebhookDelivery[] {
    return Array.from(this.deliveries.values()).filter(
      delivery => delivery.webhookId === webhookId && delivery.status === 'pending'
    );
  }

  /**
   * Mark a delivery attempt (success or failure)
   * @param deliveryId Delivery identifier
   * @param success Whether the attempt succeeded
   */
  markDeliveryAttempt(deliveryId: string, success: boolean): void {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) return;

    delivery.attempts += 1;

    if (success) {
      delivery.status = 'delivered';
    } else {
      if (delivery.attempts >= MAX_RETRIES) {
        delivery.status = 'failed';
      } else {
        // Calculate exponential backoff: 1000ms * 2^(attempts-1), capped at MAX_BACKOFF_MS
        const backoffMs = Math.min(
          INITIAL_BACKOFF_MS * Math.pow(2, delivery.attempts - 1),
          MAX_BACKOFF_MS
        );
        delivery.nextRetryTime = Date.now() + backoffMs;
      }
    }
  }

  /**
   * Clear all webhooks and deliveries
   */
  clear(): void {
    this.webhooks.clear();
    this.deliveries.clear();
    this.userWebhooks.clear();
    this.webhookIdCounter = 0;
    this.deliveryIdCounter = 0;
  }
}
