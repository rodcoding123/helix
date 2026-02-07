/**
 * Webhook Tester Tests
 *
 * Tests URL validation, webhook testing, timeout handling, and payload generation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookTester } from '../webhook-tester';
import type { WebhookTestPayload } from '../types';

describe('WebhookTester', () => {
  let tester: WebhookTester;

  beforeEach(() => {
    tester = new WebhookTester();
  });

  describe('URL Validation', () => {
    it('should validate valid HTTPS URL', () => {
      const validation = tester.validateUrl('https://example.com/webhook');

      expect(validation.valid).toBe(true);
    });

    it('should validate valid HTTP URL', () => {
      const validation = tester.validateUrl('http://example.com/webhook');

      expect(validation.valid).toBe(true);
    });

    it('should reject localhost URLs', () => {
      const validation = tester.validateUrl('http://localhost:3000/webhook');

      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    it('should reject 127.0.0.1 URLs', () => {
      const validation = tester.validateUrl('http://127.0.0.1:8000/webhook');

      expect(validation.valid).toBe(false);
    });

    it('should reject invalid URLs', () => {
      const validation = tester.validateUrl('not-a-url');

      expect(validation.valid).toBe(false);
    });

    it('should reject empty URLs', () => {
      const validation = tester.validateUrl('');

      expect(validation.valid).toBe(false);
    });

    it('should reject FTP URLs', () => {
      const validation = tester.validateUrl('ftp://example.com/webhook');

      expect(validation.valid).toBe(false);
    });

    it('should allow URLs with complex paths', () => {
      const validation = tester.validateUrl('https://api.example.com/v1/webhook/events/message');

      expect(validation.valid).toBe(true);
    });

    it('should allow URLs with query parameters', () => {
      const validation = tester.validateUrl('https://example.com/webhook?token=abc123&channel=whatsapp');

      expect(validation.valid).toBe(true);
    });
  });

  describe('Webhook Testing', () => {
    it('should test webhook endpoint', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://webhook.site/unique-id', // Webhook.site provides free webhook testing
        method: 'POST',
        payload: { test: true },
        channel: 'whatsapp',
      };

      // Note: This test may fail if webhook.site is unavailable
      // In CI/CD, you'd mock HTTP calls instead
      const result = await tester.testWebhook(payload);

      expect(result).toBeDefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return response time', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        payload: { test: true },
        channel: 'telegram',
      };

      const result = await tester.testWebhook(payload);

      expect(result.responseTime).toBeGreaterThan(0);
      expect(typeof result.responseTime).toBe('number');
    });

    it('should handle timeout', async () => {
      // Use a URL that intentionally delays response
      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/delay/10', // 10 second delay
        method: 'GET',
        payload: {},
        channel: 'discord',
      };

      const result = await tester.testWebhook(payload);

      // Should timeout (5s default)
      expect(result.success).toBe(false);
    });

    it('should handle unreachable endpoint', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://definitely-invalid-domain-that-does-not-exist.com/webhook',
        method: 'POST',
        payload: {},
        channel: 'slack',
      };

      const result = await tester.testWebhook(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include response size', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/json',
        method: 'GET',
        payload: {},
        channel: 'whatsapp',
      };

      const result = await tester.testWebhook(payload);

      expect(result.responseSize).toBeGreaterThanOrEqual(0);
    });

    it('should limit response size', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/bytes/50000', // 50KB response
        method: 'GET',
        payload: {},
        channel: 'telegram',
      };

      const result = await tester.testWebhook(payload);

      // Should fail or truncate due to 10KB limit
      expect(result.responseSize).toBeLessThanOrEqual(10240);
    });

    it('should preserve status code', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/status/404',
        method: 'GET',
        payload: {},
        channel: 'discord',
      };

      const result = await tester.testWebhook(payload);

      expect(result.statusCode).toBe(404);
      expect(result.success).toBe(false);
    });
  });

  describe('HTTP Methods', () => {
    it('should support GET method', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/get',
        method: 'GET',
        payload: {},
        channel: 'whatsapp',
      };

      const result = await tester.testWebhook(payload);
      expect(result).toBeDefined();
    });

    it('should support POST method', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        payload: { test: 'data' },
        channel: 'telegram',
      };

      const result = await tester.testWebhook(payload);
      expect(result).toBeDefined();
    });

    it('should support PUT method', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/put',
        method: 'PUT',
        payload: { update: 'value' },
        channel: 'discord',
      };

      const result = await tester.testWebhook(payload);
      expect(result).toBeDefined();
    });

    it('should support DELETE method', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/delete',
        method: 'DELETE',
        payload: {},
        channel: 'slack',
      };

      const result = await tester.testWebhook(payload);
      expect(result).toBeDefined();
    });
  });

  describe('Payload Generation', () => {
    it('should create WhatsApp test payload', () => {
      const payload = tester.createTestPayload(
        'https://example.com/webhook',
        'whatsapp',
        'message',
        'POST'
      );

      expect(payload).toBeDefined();
      expect(payload.url).toBe('https://example.com/webhook');
      expect(payload.method).toBe('POST');
      expect(payload.channel).toBe('whatsapp');
    });

    it('should create Telegram test payload', () => {
      const payload = tester.createTestPayload(
        'https://example.com/telegram',
        'telegram',
        'message',
        'POST'
      );

      expect(payload).toBeDefined();
      expect(payload.channel).toBe('telegram');
    });

    it('should create Discord test payload', () => {
      const payload = tester.createTestPayload(
        'https://example.com/discord',
        'discord',
        'event',
        'POST'
      );

      expect(payload).toBeDefined();
      expect(payload.channel).toBe('discord');
    });

    it('should create status update payload', () => {
      const payload = tester.createTestPayload(
        'https://example.com/status',
        'slack',
        'status',
        'POST'
      );

      expect(payload).toBeDefined();
      expect(payload.payload).toBeDefined();
    });

    it('should include required headers', () => {
      const payload = tester.createTestPayload(
        'https://example.com/webhook',
        'whatsapp',
        'message',
        'POST'
      );

      expect(payload.headers).toBeDefined();
      expect(payload.headers['Content-Type']).toBeDefined();
    });
  });

  describe('Batch Testing', () => {
    it('should test multiple webhooks', async () => {
      const urls = [
        'https://httpbin.org/post',
        'https://httpbin.org/put',
        'https://httpbin.org/get',
      ];

      const results = await tester.testWebhookBatch(
        urls.map((url) => ({
          url,
          method: 'POST' as const,
          payload: { test: true },
          channel: 'whatsapp',
        }))
      );

      expect(results).toHaveLength(urls.length);
      expect(results.every((r) => r)).toBe(true);
    });

    it('should handle partial failures in batch', async () => {
      const payloads: WebhookTestPayload[] = [
        {
          url: 'https://httpbin.org/post',
          method: 'POST',
          payload: {},
          channel: 'telegram',
        },
        {
          url: 'https://invalid-url-that-does-not-exist.com',
          method: 'POST',
          payload: {},
          channel: 'discord',
        },
        {
          url: 'https://httpbin.org/get',
          method: 'GET',
          payload: {},
          channel: 'slack',
        },
      ];

      const results = await tester.testWebhookBatch(payloads);

      expect(results.length).toBeGreaterThan(0);
      // Some may succeed, some may fail
      expect(results.some((r) => r.success === false)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://this-domain-definitely-does-not-exist-anywhere.invalid/webhook',
        method: 'POST',
        payload: {},
        channel: 'whatsapp',
      };

      const result = await tester.testWebhook(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle malformed JSON responses', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/status/500', // Server error
        method: 'GET',
        payload: {},
        channel: 'telegram',
      };

      const result = await tester.testWebhook(payload);

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(500);
    });

    it('should handle SSL/TLS errors', async () => {
      // This would need a test server with bad SSL
      const payload: WebhookTestPayload = {
        url: 'https://self-signed.badssl.com/',
        method: 'GET',
        payload: {},
        channel: 'discord',
      };

      const result = await tester.testWebhook(payload);

      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty payload', async () => {
      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        payload: {},
        channel: 'slack',
      };

      const result = await tester.testWebhook(payload);
      expect(result).toBeDefined();
    });

    it('should handle large payload', async () => {
      const largePayload = { data: 'x'.repeat(10000) };

      const payload: WebhookTestPayload = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        payload: largePayload,
        channel: 'whatsapp',
      };

      const result = await tester.testWebhook(payload);
      expect(result).toBeDefined();
    });

    it('should handle special characters in URL', () => {
      const validation = tester.validateUrl('https://example.com/webhook?token=abc%20123&id=456');

      expect(validation.valid).toBe(true);
    });

    it('should handle punycode domains', () => {
      // Example internationalized domain
      const validation = tester.validateUrl('https://xn--n3h.com/webhook');

      expect(validation.valid).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should validate URLs quickly', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        tester.validateUrl(`https://example${i}.com/webhook`);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500); // 1000 validations in <500ms
    });

    it('should create payloads efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        tester.createTestPayload(
          'https://example.com/webhook',
          'whatsapp',
          'message',
          'POST'
        );
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // 100 payloads in <100ms
    });
  });
});
