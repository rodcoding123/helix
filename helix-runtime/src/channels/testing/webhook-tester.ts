/**
 * Webhook Tester
 *
 * Test webhook endpoints without deployment or live integration.
 * Supports GET, POST, PUT, DELETE with custom headers and body.
 */

import type { WebhookTestPayload, WebhookTestResult } from '../monitoring/types.js';

export class WebhookTester {
  private readonly DEFAULT_TIMEOUT = 5000; // 5 seconds
  private readonly MAX_RESPONSE_SIZE = 10000; // 10KB

  /**
   * Test webhook endpoint
   */
  async testWebhook(payload: WebhookTestPayload): Promise<WebhookTestResult> {
    const startTime = performance.now();

    try {
      // Validate URL
      const url = new URL(payload.url);

      // Build request options
      const fetchOptions: RequestInit = {
        method: payload.method,
        timeout: payload.timeout || this.DEFAULT_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Helix-Webhook-Tester/1.0',
          ...(payload.headers || {}),
        },
      };

      // Add body for methods that support it
      if (payload.method !== 'GET' && payload.method !== 'DELETE') {
        if (payload.body) {
          fetchOptions.body = JSON.stringify(payload.body);
        }
      }

      // Make request
      const response = await Promise.race([
        fetch(url.toString(), fetchOptions),
        this.timeout(payload.timeout || this.DEFAULT_TIMEOUT),
      ]);

      if (!response || !(response instanceof Response)) {
        throw new Error('Request timed out');
      }

      // Read response
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > this.MAX_RESPONSE_SIZE) {
        throw new Error(`Response too large: ${contentLength} bytes`);
      }

      const responseText = await response.text();
      const responseTime = performance.now() - startTime;

      // Extract headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        url: payload.url,
        statusCode: response.status,
        responseTime: Math.round(responseTime),
        success: response.ok,
        responseBody: responseText.slice(0, this.MAX_RESPONSE_SIZE),
        headers: responseHeaders,
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;

      return {
        url: payload.url,
        statusCode: 0,
        responseTime: Math.round(responseTime),
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test multiple webhooks in batch
   */
  async testWebhookBatch(
    payloads: WebhookTestPayload[]
  ): Promise<WebhookTestResult[]> {
    const results = await Promise.all(
      payloads.map(payload => this.testWebhook(payload))
    );
    return results;
  }

  /**
   * Validate webhook URL format
   */
  validateUrl(urlString: string): { valid: boolean; error?: string } {
    try {
      const url = new URL(urlString);

      if (!['http:', 'https:'].includes(url.protocol)) {
        return { valid: false, error: 'Only HTTP/HTTPS URLs supported' };
      }

      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return { valid: false, error: 'Localhost URLs not supported' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Generate common webhook payloads
   */
  generatePayload(
    channel: string,
    type: 'message' | 'status' | 'event'
  ): Record<string, unknown> {
    const templates: Record<string, Record<string, Record<string, unknown>>> = {
      whatsapp: {
        message: {
          messaging_product: 'whatsapp',
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'ENTRY_ID',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '1234567890',
                      phone_number_id: 'PHONE_ID',
                    },
                    messages: [
                      {
                        from: '1234567890',
                        id: 'wamid.123',
                        timestamp: Math.floor(Date.now() / 1000),
                        type: 'text',
                        text: { body: 'Test message' },
                      },
                    ],
                  },
                  field: 'messages',
                },
              ],
            },
          ],
        },
        status: {
          messaging_product: 'whatsapp',
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'ENTRY_ID',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '1234567890',
                      phone_number_id: 'PHONE_ID',
                    },
                    statuses: [
                      {
                        id: 'wamid.123',
                        status: 'delivered',
                        timestamp: Math.floor(Date.now() / 1000),
                        recipient_id: '1234567890',
                      },
                    ],
                  },
                  field: 'message_status',
                },
              ],
            },
          ],
        },
      },
      telegram: {
        message: {
          update_id: 123456789,
          message: {
            message_id: 123,
            date: Math.floor(Date.now() / 1000),
            chat: { id: 123456789, type: 'private' },
            from: { id: 123456789, is_bot: false, first_name: 'Test' },
            text: 'Test message',
          },
        },
        status: {
          update_id: 123456790,
          edited_message: {
            message_id: 123,
            date: Math.floor(Date.now() / 1000),
            chat: { id: 123456789, type: 'private' },
            from: { id: 123456789, is_bot: false, first_name: 'Test' },
            edit_date: Math.floor(Date.now() / 1000),
          },
        },
      },
      discord: {
        message: {
          type: 1,
          data: {
            token: 'test_token',
            id: '123456',
            type: 3,
            guild_id: '123456789',
            channel_id: '123456789',
            member: {
              user: { id: '123456789', username: 'testuser', discriminator: '0001' },
              roles: [],
            },
            data: { name: 'test', options: [] },
          },
          id: '123456',
          timestamp: new Date().toISOString(),
        },
        status: {
          type: 0,
          data: { content: 'Pong!' },
        },
      },
      slack: {
        message: {
          token: 'verification_token',
          team_id: 'T123456',
          api_app_id: 'A123456',
          event: {
            type: 'message',
            channel: 'C123456',
            user: 'U123456',
            text: 'Test message',
            ts: Date.now().toString(),
          },
          type: 'event_callback',
          event_id: 'Ev123456',
          event_time: Math.floor(Date.now() / 1000),
        },
        status: {
          type: 'url_verification',
          challenge: 'test_challenge_123',
        },
      },
    };

    return (
      templates[channel]?.[type] || {
        type: 'test',
        timestamp: Math.floor(Date.now() / 1000),
        message: 'Test payload',
      }
    );
  }

  /**
   * Create test payload object
   */
  createTestPayload(
    url: string,
    channel: string,
    type: 'message' | 'status' | 'event' = 'message',
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
    headers?: Record<string, string>
  ): WebhookTestPayload {
    return {
      url,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Helix-Channel': channel,
        ...(headers || {}),
      },
      body: this.generatePayload(channel, type) as Record<string, unknown>,
      timeout: 5000,
    };
  }

  /**
   * Timeout helper
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Request timeout after ${ms}ms`)),
        ms
      );
    });
  }
}
