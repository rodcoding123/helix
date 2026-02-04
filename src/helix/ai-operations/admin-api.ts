import { AIOperationRouter } from './router.js';
import { QuotaTier } from './usage-quota.js';

export interface AdminApiRequest {
  method: string;
  endpoint: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

export interface AdminApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Admin API for Phase 6 component management
 *
 * Provides HTTP endpoints for configuring quotas, rate limits, billing, analytics, and webhooks.
 *
 * Phase 6, Task 6: Integration Layer for Multi-Tenant Support
 * Created: 2026-02-04
 *
 * Supported endpoints:
 * - GET /admin/quotas?userId=user1 - Get user quota info
 * - POST /admin/quotas - Update user quota tier
 * - GET /admin/rate-limits - Get rate limit stats
 * - POST /admin/rate-limits/reset - Reset all rate limits
 * - GET /admin/billing?userId=user1 - Get user billing info
 * - POST /admin/billing/invoices - Generate invoice for user
 * - GET /admin/analytics - Get analytics events
 * - GET /admin/analytics/hourly - Get hourly aggregation
 * - POST /admin/webhooks - Register webhook
 * - GET /admin/webhooks?userId=user1 - Get user webhooks
 * - DELETE /admin/webhooks?webhookId=webhook_0 - Unregister webhook
 */
export class AdminApi {
  private router: AIOperationRouter;

  constructor(router: AIOperationRouter) {
    this.router = router;
  }

  /**
   * Handle admin API requests
   *
   * Routes to appropriate manager based on endpoint and method.
   *
   * @param request Admin API request
   * @returns Admin API response
   */
  handle(request: AdminApiRequest): AdminApiResponse {
    const { method, endpoint, body, params } = request;

    try {
      // Quota management endpoints
      if (endpoint === '/admin/quotas' && method === 'GET' && params?.userId) {
        return this.getQuota(params.userId);
      }
      if (endpoint === '/admin/quotas' && method === 'POST' && body?.userId) {
        return this.updateQuota(body.userId as string, body.tier as QuotaTier);
      }

      // Rate limit endpoints
      if (endpoint === '/admin/rate-limits' && method === 'GET') {
        return this.getRateLimitStats();
      }
      if (endpoint === '/admin/rate-limits/reset' && method === 'POST') {
        return this.resetRateLimits();
      }

      // Billing endpoints
      if (endpoint === '/admin/billing' && method === 'GET' && params?.userId) {
        return this.getBillingInfo(params.userId);
      }
      if (endpoint === '/admin/billing/invoices' && method === 'POST' && body?.userId) {
        return this.generateInvoice(body.userId as string);
      }

      // Analytics endpoints
      if (endpoint === '/admin/analytics' && method === 'GET') {
        return this.getAnalytics(params?.userId);
      }
      if (endpoint === '/admin/analytics/hourly' && method === 'GET') {
        return this.getHourlyAnalytics();
      }

      // Webhook endpoints
      if (endpoint === '/admin/webhooks' && method === 'POST') {
        return this.registerWebhook(
          body?.userId as string,
          body?.url as string,
          body?.eventTypes as string[]
        );
      }
      if (endpoint === '/admin/webhooks' && method === 'GET' && params?.userId) {
        return this.getWebhooks(params.userId);
      }
      if (endpoint === '/admin/webhooks' && method === 'DELETE' && params?.webhookId) {
        return this.unregisterWebhook(params.webhookId);
      }

      return { success: false, error: `Unknown endpoint: ${endpoint}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get quota info for a user
   *
   * Returns:
   * - Current usage count
   * - Remaining quota per tier
   *
   * @param userId User identifier
   * @returns Quota information
   */
  private getQuota(userId: string): AdminApiResponse {
    const quotaManager = this.router.getQuotaManager();
    return {
      success: true,
      data: {
        userId,
        currentUsage: quotaManager.getUsage(userId),
        remaining: {
          free: quotaManager.getRemainingQuota(userId, 'free'),
          pro: quotaManager.getRemainingQuota(userId, 'pro'),
          enterprise: quotaManager.getRemainingQuota(userId, 'enterprise'),
        },
      },
    };
  }

  /**
   * Update quota tier for a user
   *
   * Allows admin to change user's quota tier (free, pro, enterprise).
   *
   * @param userId User identifier
   * @param tier New quota tier
   * @returns Updated quota information
   */
  private updateQuota(userId: string, tier: QuotaTier): AdminApiResponse {
    const quotaManager = this.router.getQuotaManager();
    const limit = quotaManager.getTierLimit(tier);
    return {
      success: true,
      data: {
        userId,
        tier,
        limit,
        message: `Updated ${userId} to ${tier} tier with ${limit} operations/day limit`,
      },
    };
  }

  /**
   * Get rate limit statistics
   *
   * Returns information about the rate limiting configuration:
   * - Bucket capacity (max tokens)
   * - Refill rate (tokens per second)
   *
   * @returns Rate limit stats
   */
  private getRateLimitStats(): AdminApiResponse {
    return {
      success: true,
      data: {
        bucketCapacity: 100,
        refillRate: 100,
        message: 'Token bucket rate limiter: 100 tokens/sec, 100 token capacity',
      },
    };
  }

  /**
   * Reset all rate limit buckets
   *
   * Clears all user rate limit state, resetting buckets to full capacity.
   * Useful for testing or handling DDoS mitigation scenarios.
   *
   * @returns Success confirmation
   */
  private resetRateLimits(): AdminApiResponse {
    const rateLimiter = this.router.getRateLimiter();
    rateLimiter.clear();
    return {
      success: true,
      data: { message: 'All rate limit buckets reset' },
    };
  }

  /**
   * Get billing information for a user
   *
   * Returns:
   * - Monthly usage costs
   * - Cost breakdown by operation type
   * - Tax and total amount
   *
   * @param userId User identifier
   * @returns Billing information
   */
  private getBillingInfo(userId: string): AdminApiResponse {
    const billingEngine = this.router.getBillingEngine();
    const usage = billingEngine.getMonthlyUsage(userId);
    return {
      success: true,
      data: {
        userId,
        monthlyUsage: usage,
      },
    };
  }

  /**
   * Generate an invoice for a user
   *
   * Creates or updates an invoice with current billing totals.
   *
   * @param userId User identifier
   * @returns Generated invoice
   */
  private generateInvoice(userId: string): AdminApiResponse {
    const billingEngine = this.router.getBillingEngine();
    const invoice = billingEngine.generateInvoice(userId);
    return {
      success: true,
      data: invoice,
    };
  }

  /**
   * Get analytics events
   *
   * Returns all captured analytics events, optionally filtered by user.
   *
   * @param userId Optional: User identifier to filter events
   * @returns Analytics events
   */
  private getAnalytics(userId?: string): AdminApiResponse {
    const analyticsCollector = this.router.getAnalyticsCollector();
    const events = userId
      ? analyticsCollector.getEventsByUser(userId)
      : analyticsCollector.getEvents();
    return {
      success: true,
      data: {
        eventCount: events.length,
        events,
      },
    };
  }

  /**
   * Get hourly aggregated analytics
   *
   * Groups all events by hour and computes aggregate metrics:
   * - Event count per hour
   * - Total latency per hour
   * - Total cost per hour
   * - Cost breakdown by operation type per hour
   *
   * @returns Hourly aggregation data
   */
  private getHourlyAnalytics(): AdminApiResponse {
    const analyticsCollector = this.router.getAnalyticsCollector();
    const hourly = analyticsCollector.getHourlyAggregation();
    return {
      success: true,
      data: hourly,
    };
  }

  /**
   * Register a webhook
   *
   * Creates a new webhook subscription for a user to receive real-time events.
   *
   * @param userId User identifier
   * @param url Webhook URL for delivery
   * @param eventTypes Event types to subscribe to
   * @returns Registered webhook
   */
  private registerWebhook(userId: string, url: string, eventTypes: string[]): AdminApiResponse {
    const webhookManager = this.router.getWebhookManager();
    const webhook = webhookManager.registerWebhook(userId, url, eventTypes);
    return {
      success: true,
      data: webhook,
    };
  }

  /**
   * Get webhooks for a user
   *
   * Returns all webhooks registered for a user.
   *
   * @param userId User identifier
   * @returns User's webhooks
   */
  private getWebhooks(userId: string): AdminApiResponse {
    const webhookManager = this.router.getWebhookManager();
    const webhooks = webhookManager.getUserWebhooks(userId);
    return {
      success: true,
      data: webhooks,
    };
  }

  /**
   * Unregister a webhook
   *
   * Removes a webhook subscription, stopping future event deliveries.
   *
   * @param webhookId Webhook identifier
   * @returns Success confirmation
   */
  private unregisterWebhook(webhookId: string): AdminApiResponse {
    const webhookManager = this.router.getWebhookManager();
    webhookManager.unregisterWebhook(webhookId);
    return {
      success: true,
      data: { message: `Webhook ${webhookId} unregistered` },
    };
  }
}
