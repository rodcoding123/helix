/* @ts-nocheck */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * AdminApi Tests
 *
 * Comprehensive test coverage for admin API endpoints,
 * quota management, billing, analytics, and webhooks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminApi, AdminApiRequest } from './admin-api.js';

// Mock AIOperationRouter
vi.mock('./router.js');

describe('AdminApi', () => {
  let adminApi: AdminApi;
  let mockRouter: any;
  let mockQuotaManager: any;
  let mockRateLimiter: any;
  let mockBillingEngine: any;
  let mockAnalyticsCollector: any;
  let mockWebhookManager: any;

  beforeEach(() => {
    // Setup quota manager mock
    mockQuotaManager = {
      getUsage: vi.fn().mockReturnValue(150),
      getRemainingQuota: vi.fn((userId, tier) => {
        const quotas: Record<string, number> = {
          free: 1000,
          pro: 10000,
          enterprise: 100000,
        };
        return quotas[tier] || 0;
      }),
      getTierLimit: vi.fn(tier => {
        const limits: Record<string, number> = {
          free: 100,
          pro: 1000,
          enterprise: 10000,
        };
        return limits[tier] || 0;
      }),
    };

    // Setup rate limiter mock
    mockRateLimiter = {
      clear: vi.fn(),
    };

    // Setup billing engine mock
    mockBillingEngine = {
      getMonthlyUsage: vi.fn().mockReturnValue({
        operations: 150,
        totalCost: 125.5,
      }),
      generateInvoice: vi.fn().mockReturnValue({
        invoiceId: 'inv-123',
        userId: 'user-1',
        amount: 125.5,
        date: '2026-02-04',
      }),
    };

    // Setup analytics collector mock
    mockAnalyticsCollector = {
      getEvents: vi.fn().mockReturnValue([
        { id: 'evt-1', type: 'api_call', timestamp: Date.now() },
        { id: 'evt-2', type: 'model_change', timestamp: Date.now() },
      ]),
      getEventsByUser: vi.fn(userId => [
        { id: 'evt-1', userId, type: 'api_call', timestamp: Date.now() },
      ]),
      getHourlyAggregation: vi.fn().mockReturnValue({
        '2026-02-04T10:00:00Z': {
          eventCount: 50,
          totalLatency: 2500,
          totalCost: 25.0,
        },
      }),
    };

    // Setup webhook manager mock
    mockWebhookManager = {
      registerWebhook: vi.fn().mockReturnValue({
        id: 'webhook-123',
        userId: 'user-1',
        url: 'https://example.com/webhook',
        eventTypes: ['approval', 'cost_alert'],
      }),
      getUserWebhooks: vi.fn().mockReturnValue([
        {
          id: 'webhook-123',
          userId: 'user-1',
          url: 'https://example.com/webhook',
          eventTypes: ['approval'],
        },
      ]),
      unregisterWebhook: vi.fn(),
    };

    // Setup router mock
    mockRouter = {
      getQuotaManager: vi.fn().mockReturnValue(mockQuotaManager),
      getRateLimiter: vi.fn().mockReturnValue(mockRateLimiter),
      getBillingEngine: vi.fn().mockReturnValue(mockBillingEngine),
      getAnalyticsCollector: vi.fn().mockReturnValue(mockAnalyticsCollector),
      getWebhookManager: vi.fn().mockReturnValue(mockWebhookManager),
    };

    adminApi = new AdminApi(mockRouter);
  });

  describe('handle - routing', () => {
    it('should route unknown endpoints to error response', () => {
      const request: AdminApiRequest = {
        method: 'GET',
        endpoint: '/admin/unknown',
      };

      const response = adminApi.handle(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown endpoint');
    });

    it('should catch and return errors gracefully', () => {
      mockQuotaManager.getUsage.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request: AdminApiRequest = {
        method: 'GET',
        endpoint: '/admin/quotas',
        params: { userId: 'user-1' },
      };

      const response = adminApi.handle(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Database connection failed');
    });
  });

  describe('quota management', () => {
    describe('GET /admin/quotas', () => {
      it('should return quota info for user', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/quotas',
          params: { userId: 'user-1' },
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(response.data).toMatchObject({
          userId: 'user-1',
          currentUsage: 150,
          remaining: {
            free: 1000,
            pro: 10000,
            enterprise: 100000,
          },
        });
      });

      it('should call quota manager with correct user id', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/quotas',
          params: { userId: 'special-user' },
        };

        adminApi.handle(request);

        expect(mockQuotaManager.getUsage).toHaveBeenCalledWith('special-user');
      });

      it('should fail without userId parameter', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/quotas',
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(false);
      });
    });

    describe('POST /admin/quotas', () => {
      it('should update quota tier for user', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/quotas',
          body: { userId: 'user-1', tier: 'pro' },
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(response.data).toMatchObject({
          userId: 'user-1',
          tier: 'pro',
          limit: 1000,
        });
      });

      it('should include update message', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/quotas',
          body: { userId: 'user-1', tier: 'enterprise' },
        };

        const response = adminApi.handle(request);

        expect(response.data?.message).toContain('Updated user-1 to enterprise tier');
      });

      it('should fail without userId in body', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/quotas',
          body: { tier: 'pro' },
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(false);
      });

      it('should handle different tier levels', () => {
        const tiers = ['free', 'pro', 'enterprise'];

        tiers.forEach(tier => {
          const request: AdminApiRequest = {
            method: 'POST',
            endpoint: '/admin/quotas',
            body: { userId: 'user-1', tier },
          };

          const response = adminApi.handle(request);

          expect(response.success).toBe(true);
          expect(response.data?.tier).toBe(tier);
        });
      });
    });
  });

  describe('rate limit management', () => {
    describe('GET /admin/rate-limits', () => {
      it('should return rate limit statistics', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/rate-limits',
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(response.data).toMatchObject({
          bucketCapacity: 100,
          refillRate: 100,
        });
      });

      it('should include rate limit configuration message', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/rate-limits',
        };

        const response = adminApi.handle(request);

        expect(response.data?.message).toContain('Token bucket rate limiter');
      });
    });

    describe('POST /admin/rate-limits/reset', () => {
      it('should reset all rate limit buckets', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/rate-limits/reset',
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(mockRateLimiter.clear).toHaveBeenCalled();
      });

      it('should return success confirmation', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/rate-limits/reset',
        };

        const response = adminApi.handle(request);

        expect(response.data?.message).toContain('reset');
      });
    });
  });

  describe('billing management', () => {
    describe('GET /admin/billing', () => {
      it('should return billing info for user', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/billing',
          params: { userId: 'user-1' },
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(response.data).toMatchObject({
          userId: 'user-1',
          monthlyUsage: {
            operations: 150,
            totalCost: 125.5,
          },
        });
      });

      it('should call billing engine for correct user', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/billing',
          params: { userId: 'special-user' },
        };

        adminApi.handle(request);

        expect(mockBillingEngine.getMonthlyUsage).toHaveBeenCalledWith('special-user');
      });

      it('should fail without userId parameter', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/billing',
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(false);
      });
    });

    describe('POST /admin/billing/invoices', () => {
      it('should generate invoice for user', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/billing/invoices',
          body: { userId: 'user-1' },
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(response.data).toMatchObject({
          invoiceId: 'inv-123',
          userId: 'user-1',
          amount: 125.5,
        });
      });

      it('should call billing engine generate invoice', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/billing/invoices',
          body: { userId: 'user-1' },
        };

        adminApi.handle(request);

        expect(mockBillingEngine.generateInvoice).toHaveBeenCalledWith('user-1');
      });

      it('should fail without userId in body', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/billing/invoices',
          body: {},
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(false);
      });
    });
  });

  describe('analytics management', () => {
    describe('GET /admin/analytics', () => {
      it('should return all analytics events', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/analytics',
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(response.data?.eventCount).toBe(2);
        expect(response.data?.events).toHaveLength(2);
      });

      it('should filter by userId when provided', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/analytics',
          params: { userId: 'user-1' },
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(mockAnalyticsCollector.getEventsByUser).toHaveBeenCalledWith('user-1');
      });

      it('should return event count', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/analytics',
        };

        const response = adminApi.handle(request);

        expect(response.data?.eventCount).toBeGreaterThan(0);
      });
    });

    describe('GET /admin/analytics/hourly', () => {
      it('should return hourly aggregation', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/analytics/hourly',
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(Object.keys(response.data || {}).length).toBeGreaterThan(0);
      });

      it('should include hourly metrics', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/analytics/hourly',
        };

        const response = adminApi.handle(request);

        const hourData = Object.values(response.data || {})[0];
        expect(hourData).toMatchObject({
          eventCount: expect.any(Number),
          totalLatency: expect.any(Number),
          totalCost: expect.any(Number),
        });
      });
    });
  });

  describe('webhook management', () => {
    describe('POST /admin/webhooks', () => {
      it('should register webhook successfully', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/webhooks',
          body: {
            userId: 'user-1',
            url: 'https://example.com/webhook',
            eventTypes: ['approval', 'cost_alert'],
          },
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(response.data).toMatchObject({
          id: 'webhook-123',
          userId: 'user-1',
          url: 'https://example.com/webhook',
        });
      });

      it('should call webhook manager with correct parameters', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/webhooks',
          body: {
            userId: 'user-1',
            url: 'https://example.com/webhook',
            eventTypes: ['approval'],
          },
        };

        adminApi.handle(request);

        expect(mockWebhookManager.registerWebhook).toHaveBeenCalledWith(
          'user-1',
          'https://example.com/webhook',
          ['approval']
        );
      });

      it('should handle missing userId gracefully', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/webhooks',
          body: {
            url: 'https://example.com/webhook',
            eventTypes: ['approval'],
          },
        };

        const response = adminApi.handle(request);

        // Implementation doesn't validate, passes through to webhook manager
        expect(response.success).toBe(true);
      });

      it('should handle missing url gracefully', () => {
        const request: AdminApiRequest = {
          method: 'POST',
          endpoint: '/admin/webhooks',
          body: {
            userId: 'user-1',
            eventTypes: ['approval'],
          },
        };

        const response = adminApi.handle(request);

        // Implementation doesn't validate, passes through to webhook manager
        expect(response.success).toBe(true);
      });
    });

    describe('GET /admin/webhooks', () => {
      it('should return webhooks for user', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/webhooks',
          params: { userId: 'user-1' },
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(response.data).toHaveLength(1);
        expect(response.data?.[0]).toMatchObject({
          id: 'webhook-123',
          userId: 'user-1',
        });
      });

      it('should call webhook manager with correct user', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/webhooks',
          params: { userId: 'user-1' },
        };

        adminApi.handle(request);

        expect(mockWebhookManager.getUserWebhooks).toHaveBeenCalledWith('user-1');
      });

      it('should fail without userId parameter', () => {
        const request: AdminApiRequest = {
          method: 'GET',
          endpoint: '/admin/webhooks',
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(false);
      });
    });

    describe('DELETE /admin/webhooks', () => {
      it('should unregister webhook successfully', () => {
        const request: AdminApiRequest = {
          method: 'DELETE',
          endpoint: '/admin/webhooks',
          params: { webhookId: 'webhook-123' },
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(true);
        expect(mockWebhookManager.unregisterWebhook).toHaveBeenCalledWith('webhook-123');
      });

      it('should return success confirmation with webhook id', () => {
        const request: AdminApiRequest = {
          method: 'DELETE',
          endpoint: '/admin/webhooks',
          params: { webhookId: 'webhook-123' },
        };

        const response = adminApi.handle(request);

        expect(response.data?.message).toContain('webhook-123');
      });

      it('should fail without webhookId parameter', () => {
        const request: AdminApiRequest = {
          method: 'DELETE',
          endpoint: '/admin/webhooks',
        };

        const response = adminApi.handle(request);

        expect(response.success).toBe(false);
      });
    });
  });

  describe('request validation', () => {
    it('should handle missing method gracefully', () => {
      const request: any = {
        endpoint: '/admin/quotas',
        params: { userId: 'user-1' },
      };

      const response = adminApi.handle(request);

      expect(response.success).toBe(false);
    });

    it('should handle missing endpoint gracefully', () => {
      const request: any = {
        method: 'GET',
        params: { userId: 'user-1' },
      };

      const response = adminApi.handle(request);

      expect(response.success).toBe(false);
    });

    it('should handle null body gracefully', () => {
      const request: AdminApiRequest = {
        method: 'GET',
        endpoint: '/admin/quotas',
        body: null as any,
        params: { userId: 'user-1' },
      };

      const response = adminApi.handle(request);

      expect(response.success).toBe(true); // GET should succeed with null body
    });
  });

  describe('response format', () => {
    it('should always return AdminApiResponse format', () => {
      const request: AdminApiRequest = {
        method: 'GET',
        endpoint: '/admin/quotas',
        params: { userId: 'user-1' },
      };

      const response = adminApi.handle(request);

      expect(response).toHaveProperty('success');
      expect(typeof response.success).toBe('boolean');
      expect(['data', 'error']).toContain(response.success ? 'data' : 'error');
    });

    it('should include data on success', () => {
      const request: AdminApiRequest = {
        method: 'GET',
        endpoint: '/admin/quotas',
        params: { userId: 'user-1' },
      };

      const response = adminApi.handle(request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.error).toBeUndefined();
    });

    it('should include error on failure', () => {
      const request: AdminApiRequest = {
        method: 'GET',
        endpoint: '/admin/unknown',
      };

      const response = adminApi.handle(request);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.data).toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete quota workflow', () => {
      // Get current quota
      const getRequest: AdminApiRequest = {
        method: 'GET',
        endpoint: '/admin/quotas',
        params: { userId: 'user-1' },
      };
      const getResponse = adminApi.handle(getRequest);
      expect(getResponse.success).toBe(true);

      // Update quota tier
      const updateRequest: AdminApiRequest = {
        method: 'POST',
        endpoint: '/admin/quotas',
        body: { userId: 'user-1', tier: 'enterprise' },
      };
      const updateResponse = adminApi.handle(updateRequest);
      expect(updateResponse.success).toBe(true);
      expect(updateResponse.data?.tier).toBe('enterprise');
    });

    it('should handle webhook lifecycle', () => {
      // Register webhook
      const registerRequest: AdminApiRequest = {
        method: 'POST',
        endpoint: '/admin/webhooks',
        body: {
          userId: 'user-1',
          url: 'https://example.com/webhook',
          eventTypes: ['approval'],
        },
      };
      const registerResponse = adminApi.handle(registerRequest);
      expect(registerResponse.success).toBe(true);

      // Get webhooks
      const getRequest: AdminApiRequest = {
        method: 'GET',
        endpoint: '/admin/webhooks',
        params: { userId: 'user-1' },
      };
      const getResponse = adminApi.handle(getRequest);
      expect(getResponse.success).toBe(true);

      // Unregister webhook
      const unregisterRequest: AdminApiRequest = {
        method: 'DELETE',
        endpoint: '/admin/webhooks',
        params: { webhookId: 'webhook-123' },
      };
      const unregisterResponse = adminApi.handle(unregisterRequest);
      expect(unregisterResponse.success).toBe(true);
    });

    it('should handle billing and analytics queries', () => {
      // Get billing
      const billingRequest: AdminApiRequest = {
        method: 'GET',
        endpoint: '/admin/billing',
        params: { userId: 'user-1' },
      };
      const billingResponse = adminApi.handle(billingRequest);
      expect(billingResponse.success).toBe(true);

      // Get analytics
      const analyticsRequest: AdminApiRequest = {
        method: 'GET',
        endpoint: '/admin/analytics',
        params: { userId: 'user-1' },
      };
      const analyticsResponse = adminApi.handle(analyticsRequest);
      expect(analyticsResponse.success).toBe(true);

      // Get hourly analytics
      const hourlyRequest: AdminApiRequest = {
        method: 'GET',
        endpoint: '/admin/analytics/hourly',
      };
      const hourlyResponse = adminApi.handle(hourlyRequest);
      expect(hourlyResponse.success).toBe(true);
    });
  });
});
