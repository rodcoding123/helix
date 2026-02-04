/**
 * Webhook Manager - Phase 6
 *
 * Manages webhook subscriptions and real-time event delivery with retry logic.
 */

export type EventType = 'operation_start' | 'operation_complete' | 'operation_failed';
export type DeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  eventTypes: EventType[];
  createdAt: string;
}

export interface WebhookEvent {
  eventType: EventType;
  userId: string;
  data: Record<string, unknown>;
}

export interface Delivery {
  id: string;
  webhookId: string;
  eventType: EventType;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  retryCount: number;
  nextRetryTime?: string;
  timestamp: string;
}

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000; // 1 second
const MAX_BACKOFF_MS = 32000; // 32 seconds

export class WebhookManager {
  private webhooks: Map<string, Webhook> = new Map();
  private deliveries: Map<string, Delivery> = new Map();
  private userWebhooks: Map<string, string[]> = new Map();
  private webhookCounter = 0;
  private deliveryCounter = 0;

  /**
   * Register webhook endpoint
   */
  registerWebhook(userId: string, url: string, eventTypes: EventType[]): string {
    const webhookId = `webhook_${++this.webhookCounter}`;
    const webhook: Webhook = {
      id: webhookId,
      userId,
      url,
      eventTypes,
      createdAt: new Date().toISOString(),
    };

    this.webhooks.set(webhookId, webhook);

    if (!this.userWebhooks.has(userId)) {
      this.userWebhooks.set(userId, []);
    }
    this.userWebhooks.get(userId)!.push(webhookId);

    return webhookId;
  }

  /**
   * Unregister webhook
   */
  unregisterWebhook(webhookId: string): void {
    const webhook = this.webhooks.get(webhookId);
    if (webhook) {
      const userHooks = this.userWebhooks.get(webhook.userId) || [];
      const index = userHooks.indexOf(webhookId);
      if (index > -1) {
        userHooks.splice(index, 1);
      }
      this.webhooks.delete(webhookId);
    }
  }

  /**
   * Get webhooks for user
   */
  getUserWebhooks(userId: string): Webhook[] {
    const webhookIds = this.userWebhooks.get(userId) || [];
    return webhookIds.map(id => this.webhooks.get(id)!).filter(Boolean);
  }

  /**
   * Queue event for delivery
   */
  queueEvent(eventType: EventType, data: Record<string, unknown>): void {
    const userId = data.userId as string;
    const userHooks = this.getUserWebhooks(userId);

    for (const webhook of userHooks) {
      if (webhook.eventTypes.includes(eventType)) {
        const deliveryId = `delivery_${++this.deliveryCounter}`;
        const delivery: Delivery = {
          id: deliveryId,
          webhookId: webhook.id,
          eventType,
          payload: data,
          status: 'pending',
          retryCount: 0,
          timestamp: new Date().toISOString(),
        };
        this.deliveries.set(deliveryId, delivery);
      }
    }
  }

  /**
   * Get pending deliveries for webhook
   */
  getPendingDeliveries(webhookId: string): Delivery[] {
    const pending: Delivery[] = [];
    for (const delivery of this.deliveries.values()) {
      if (delivery.webhookId === webhookId && delivery.status === 'pending') {
        pending.push(delivery);
      }
    }
    return pending;
  }

  /**
   * Mark delivery attempt (success or failure)
   */
  markDeliveryAttempt(deliveryId: string, success: boolean): void {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) return;

    if (success) {
      delivery.status = 'delivered';
    } else {
      delivery.retryCount++;

      if (delivery.retryCount >= MAX_RETRIES) {
        delivery.status = 'failed';
      } else {
        // Calculate exponential backoff
        const backoffMs = Math.min(
          INITIAL_BACKOFF_MS * Math.pow(2, delivery.retryCount - 1),
          MAX_BACKOFF_MS
        );
        delivery.nextRetryTime = new Date(Date.now() + backoffMs).toISOString();
      }
    }
  }

  /**
   * Get delivery by ID
   */
  getDelivery(deliveryId: string): Delivery | null {
    return this.deliveries.get(deliveryId) || null;
  }

  /**
   * Clear all webhooks and deliveries
   */
  clear(): void {
    this.webhooks.clear();
    this.deliveries.clear();
    this.userWebhooks.clear();
    this.webhookCounter = 0;
    this.deliveryCounter = 0;
  }
}
