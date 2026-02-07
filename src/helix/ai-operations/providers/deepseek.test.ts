/* eslint-disable @typescript-eslint/explicit-function-return-type,@typescript-eslint/require-await,@typescript-eslint/no-unsafe-assignment */
/**
 * DeepSeek Provider Tests
 *
 * Comprehensive test coverage for:
 * - Client initialization
 * - API request handling
 * - Response parsing
 * - Token counting
 * - Cost calculation
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeepSeekClient, executeWithDeepSeek, simpleRequest, conversation } from './deepseek.js';

// Mock fetch for all tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DeepSeekClient', () => {
  let client: DeepSeekClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    client = new DeepSeekClient();
    process.env.DEEPSEEK_API_KEY = 'test-api-key-12345';
  });

  describe('Initialization', () => {
    it('should throw if API key is not set', () => {
      delete process.env.DEEPSEEK_API_KEY;
      const newClient = new DeepSeekClient();

      expect(() => {
        newClient['initialize']();
      }).toThrow('DEEPSEEK_API_KEY environment variable not set');
    });

    it('should initialize successfully with API key', () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';
      const newClient = new DeepSeekClient();

      expect(() => {
        newClient['initialize']();
      }).not.toThrow();
    });
  });

  describe('Simple Requests', () => {
    const createMockResponse = (inputTokens = 100, outputTokens = 50) => ({
      ok: true,
      json: async () => {
        return {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'This is a test response.',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
          },
        };
      },
    });

    it('should execute a simple request', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(100, 50));
      const result = await client.complete('You are helpful.', 'Say hello');

      expect(result.content).toBe('This is a test response.');
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
      expect(result.totalTokens).toBe(150);
    });

    it('should calculate correct cost for simple request', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(100, 50));
      const result = await client.complete('System prompt.', 'User prompt.');

      // DeepSeek: $0.0027 input / $0.0108 output per 1K
      // Cost = (100/1000 * 0.0027 + 50/1000 * 0.0108) = 0.00027 + 0.00054 = 0.00081
      // Rounded to 4 decimals = 0.0008
      expect(result.costUsd).toBe(0.0008);
    });

    it('should include stop reason in result', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(100, 50));
      const result = await client.complete('test', 'test');
      expect(result.stopReason).toBe('stop');
    });

    it('should handle response with different token counts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-456',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Large response.',
              },
              finish_reason: 'length',
            },
          ],
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 500,
            total_tokens: 1500,
          },
        }),
      });

      const result = await client.complete('test', 'test');
      expect(result.inputTokens).toBe(1000);
      expect(result.outputTokens).toBe(500);
    });
  });

  describe('Conversation Handling', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-789',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Assistant response to conversation.',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 250,
            completion_tokens: 150,
            total_tokens: 400,
          },
        }),
      });
    });

    it('should handle multi-turn conversation', async () => {
      const messages = [
        { role: 'user' as const, content: 'First message' },
        { role: 'assistant' as const, content: 'Response' },
        { role: 'user' as const, content: 'Follow-up' },
      ];

      const result = await client.conversation(messages, 'System context');
      expect(result.content).toBe('Assistant response to conversation.');
    });

    it('should include system prompt in conversation', async () => {
      const messages = [{ role: 'user' as const, content: 'Test' }];

      await client.conversation(messages, 'System instructions');

      // Verify that fetch was called
      expect(mockFetch).toHaveBeenCalled();

      // Get the request body
      const call = mockFetch.mock.calls[0];
      const request = JSON.parse((call[1] as Record<string, unknown>).body as string);

      // Verify system message is included
      expect((request as Record<string, unknown>).messages).toBeDefined();
      const responseMessages = (request as Record<string, unknown>).messages as Array<
        Record<string, string>
      >;
      expect(responseMessages[0].role).toBe('system');
      expect(responseMessages[0].content).toBe('System instructions');
    });

    it('should handle conversation without system prompt', async () => {
      const messages = [{ role: 'user' as const, content: 'Test' }];

      await client.conversation(messages);

      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0];
      const request = JSON.parse((call[1] as Record<string, unknown>).body as string);

      // First message should be the user message
      expect((request as Record<string, unknown>).messages).toBeDefined();
      const responseMessages = (request as Record<string, unknown>).messages as Array<
        Record<string, string>
      >;
      expect(responseMessages[0].role).toBe('user');
    });
  });

  describe('API Request Formatting', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });
    });

    it('should format request correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          return {
            id: 'test',
            object: 'chat.completion',
            created: 1234567890,
            model: 'deepseek-chat',
            choices: [
              { index: 0, message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          };
        },
      });

      await client.complete('System', 'User');

      const call = mockFetch.mock.calls[0];
      const requestInit = call[1] as Record<string, unknown>;
      const headers = requestInit.headers as Record<string, string>;
      const body = JSON.parse(requestInit.body as string) as Record<string, unknown>;

      expect(headers.Authorization).toMatch(/^Bearer /);
      expect(headers['Content-Type']).toBe('application/json');
      expect(body.model).toBe('deepseek-chat');
      expect(body.messages).toBeDefined();
    });

    it('should use correct API endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      await client.complete('test', 'test');

      const call = mockFetch.mock.calls[0];
      const url = call[0] as string;

      expect(url).toBe('https://api.deepseek.com/v1/chat/completions');
    });

    it('should include max_tokens in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      await client.complete('test', 'test', { maxTokens: 2048 });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse((call[1] as Record<string, unknown>).body as string) as Record<
        string,
        unknown
      >;

      expect(body.max_tokens).toBe(2048);
    });

    it('should include temperature in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      await client.complete('test', 'test', { temperature: 0.5 });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse((call[1] as Record<string, unknown>).body as string) as Record<
        string,
        unknown
      >;

      expect(body.temperature).toBe(0.5);
    });

    it('should include top_p in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      await client.complete('test', 'test', { topP: 0.9 });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse((call[1] as Record<string, unknown>).body as string) as Record<
        string,
        unknown
      >;

      expect(body.top_p).toBe(0.9);
    });

    it('should use default parameters if not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      await client.complete('test', 'test');

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse((call[1] as Record<string, unknown>).body as string) as Record<
        string,
        unknown
      >;

      expect(body.max_tokens).toBe(4096);
      expect(body.temperature).toBe(0.7);
      expect(body.top_p).toBe(1.0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => {
          return JSON.stringify({ error: { message: 'Unauthorized' } });
        },
        json: async () => {
          return { error: { message: 'Unauthorized' } };
        },
      });

      await expect(client.complete('test', 'test')).rejects.toThrow('DeepSeek API error');
    });

    it('should handle network timeouts', async () => {
      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Request timeout');
            error.name = 'AbortError';
            reject(error);
          }, 10);
        });
      });

      await expect(client.complete('test', 'test', { timeout: 5 })).rejects.toThrow('timeout');
    });

    it('should handle empty response choices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          return {
            id: 'test',
            object: 'chat.completion',
            created: 1234567890,
            model: 'deepseek-chat',
            choices: [],
            usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
          };
        },
      });

      await expect(client.complete('test', 'test')).rejects.toThrow('Empty response');
    });

    it('should handle invalid request', async () => {
      await expect(client.execute({ messages: [] })).rejects.toThrow('At least one message');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
          // This return is unreachable but needed for TypeScript

          return {};
        },
      });

      await expect(client.complete('test', 'test')).rejects.toThrow();
    });
  });

  describe('Cost Calculation', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 1000000, completion_tokens: 1000000, total_tokens: 2000000 },
        }),
      });
    });

    it('should calculate cost correctly for large requests', async () => {
      const result = await client.complete('test', 'test');

      // 1M input tokens * $0.0027 = $2700
      // 1M output tokens * $0.0108 = $10800
      // Total = $13500 / 1000 (per 1k) but wait...
      // Actually: (1000000 * 0.0027 + 1000000 * 0.0108) / 1000 = (2700 + 10800) / 1000 = 13.5
      expect(result.costUsd).toBeCloseTo(13.5, 1);
    });
  });
});

describe('Module-level functions', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        object: 'chat.completion',
        created: 1234567890,
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'test response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });
  });

  it('should export executeWithDeepSeek function', async () => {
    const result = await executeWithDeepSeek([
      { role: 'system', content: 'System' },
      { role: 'user', content: 'User' },
    ]);

    expect(result.content).toBe('test response');
  });

  it('should export simpleRequest function', async () => {
    const result = await simpleRequest('System', 'User');
    expect(result.content).toBe('test response');
  });

  it('should export conversation function', async () => {
    const result = await conversation([{ role: 'user', content: 'User' }], 'System');
    expect(result.content).toBe('test response');
  });
});
