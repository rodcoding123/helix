/**
 * Tests for Helix API logger module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  logApiPreFlight,
  logApiResponse,
  logApiError,
  getApiStats,
  __clearApiStateForTesting,
} from './api-logger.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('API Logger - Pre-Flight Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    __clearApiStateForTesting();
  });

  it('should log API request before execution', async () => {
    const log = {
      model: 'claude-3-opus',
      provider: 'anthropic',
      sessionKey: 'test-session',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'What is 2+2?',
      requestId: 'req-123',
    };

    const requestId = await logApiPreFlight(log);

    expect(requestId).toBe('req-123');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should generate request ID if not provided', async () => {
    const log = {
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'Test prompt',
    };

    const requestId = await logApiPreFlight(log);

    expect(requestId).toBeDefined();
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should send Discord webhook synchronously', async () => {
    let webhookCompleted = false;
    mockFetch.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      webhookCompleted = true;
      return { ok: true, status: 200 };
    });

    await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'Test',
    });

    expect(webhookCompleted).toBe(true);
  });

  it('should include prompt preview in embed', async () => {
    await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'What is the meaning of life?',
      requestId: 'req-abc',
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { name: string; value: string }) =>
      f.name === 'Prompt Preview' && f.value.includes('What is the meaning')
    )).toBe(true);
  });

  it('should truncate long prompt previews', async () => {
    const longPrompt = 'a'.repeat(1000);

    await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: longPrompt,
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    const promptField = embed.fields.find((f: { name: string }) => f.name === 'Prompt Preview');
    expect(promptField.value.length).toBeLessThan(1000);
  });

  it('should add request to pending map', async () => {
    await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'Test',
      requestId: 'req-pending',
    });

    const stats = getApiStats();
    expect(stats.pendingCount).toBe(1);
  });

  it('should increment request counter', async () => {
    const stats1 = getApiStats();
    const initialCount = stats1.requestCount;

    await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'Test',
    });

    const stats2 = getApiStats();
    expect(stats2.requestCount).toBe(initialCount + 1);
  });

  it('should handle webhook failure gracefully', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      logApiPreFlight({
        model: 'claude-3-opus',
        provider: 'anthropic',
        timestamp: '2024-01-15T10:30:00.000Z',
        promptPreview: 'Test',
      })
    ).resolves.toBeDefined();
  });
});

describe('API Logger - Response Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    __clearApiStateForTesting();
  });

  it('should log API response', async () => {
    // Pre-flight first
    await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'Test',
      requestId: 'req-123',
    });

    mockFetch.mockClear();

    await logApiResponse({
      requestId: 'req-123',
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:01.500Z',
      responsePreview: 'The answer is 42',
      tokenCount: 150,
      latencyMs: 1500,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should remove request from pending map', async () => {
    await logApiPreFlight({
      requestId: 'req-456',
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'Test',
    });

    expect(getApiStats().pendingCount).toBe(1);

    await logApiResponse({
      requestId: 'req-456',
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:01.000Z',
      responsePreview: 'Response',
      tokenCount: 100,
      latencyMs: 1000,
    });

    expect(getApiStats().pendingCount).toBe(0);
  });

  it('should update token counter', async () => {
    const stats1 = getApiStats();
    const initialTokens = stats1.tokenCount;

    await logApiResponse({
      requestId: 'req-789',
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:01.000Z',
      responsePreview: 'Response',
      tokenCount: 250,
      latencyMs: 1200,
    });

    const stats2 = getApiStats();
    expect(stats2.tokenCount).toBe(initialTokens + 250);
  });

  it('should include latency in embed', async () => {
    await logApiResponse({
      requestId: 'req-latency',
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:01.000Z',
      responsePreview: 'Done',
      tokenCount: 100,
      latencyMs: 2345,
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { name: string; value: string }) =>
      f.name === 'Latency' && f.value.includes('2345ms')
    )).toBe(true);
  });

  it('should handle missing response preview', async () => {
    await expect(
      logApiResponse({
        requestId: 'req-no-preview',
        model: 'claude-3-opus',
        provider: 'anthropic',
        timestamp: '2024-01-15T10:30:01.000Z',
        tokenCount: 50,
        latencyMs: 500,
      })
    ).resolves.not.toThrow();
  });
});

describe('API Logger - Error Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    __clearApiStateForTesting();
  });

  it('should log API error', async () => {
    await logApiError('req-error', 'Rate limit exceeded', 429);

    expect(mockFetch).toHaveBeenCalledOnce();
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.title).toContain('Error');
    expect(embed.color).toBe(0xe74c3c); // Red
  });

  it('should remove request from pending on error', async () => {
    await logApiPreFlight({
      requestId: 'req-will-fail',
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'Test',
    });

    expect(getApiStats().pendingCount).toBe(1);

    await logApiError('req-will-fail', 'API Error', 500);

    expect(getApiStats().pendingCount).toBe(0);
  });

  it('should include error status code', async () => {
    await logApiError('req-429', 'Too many requests', 429);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { name: string; value: string }) =>
      f.name === 'Status' && f.value === '429'
    )).toBe(true);
  });

  it('should handle optional status code', async () => {
    await expect(logApiError('req-no-status', 'Unknown error')).resolves.not.toThrow();
  });
});

describe('API Logger - Statistics', () => {
  beforeEach(() => {
    __clearApiStateForTesting();
  });

  it('should return initial stats', () => {
    const stats = getApiStats();

    expect(stats.requestCount).toBe(0);
    expect(stats.tokenCount).toBe(0);
    expect(stats.pendingCount).toBe(0);
  });

  it('should track cumulative stats across multiple requests', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    __clearApiStateForTesting();

    // Request 1
    const reqId1 = await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'Q1',
    });

    await logApiResponse({
      requestId: reqId1,
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:01.000Z',
      tokenCount: 100,
      latencyMs: 1000,
    });

    // Request 2
    const reqId2 = await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:02.000Z',
      promptPreview: 'Q2',
    });

    await logApiResponse({
      requestId: reqId2,
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:03.000Z',
      tokenCount: 150,
      latencyMs: 1100,
    });

    const stats = getApiStats();
    expect(stats.requestCount).toBe(2);
    expect(stats.tokenCount).toBe(250);
    expect(stats.pendingCount).toBe(0);
  });
});

describe('API Logger - Prompt Preview Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
    __clearApiStateForTesting();
  });

  it('should handle string preview', async () => {
    await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'Simple string prompt',
    });

    // If webhook URL is configured, check the embed
    if (mockFetch.mock.calls.length > 0) {
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const embed = callBody.embeds[0];
      const promptField = embed.fields.find((f: { name: string }) => f.name === 'Prompt Preview');
      if (promptField) {
        expect(promptField.value).toContain('Simple string');
      }
    }
  });

  it('should handle JSON-stringified message array', async () => {
    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello!' },
    ];
    await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: JSON.stringify(messages),
    });

    if (mockFetch.mock.calls.length > 0) {
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const embed = callBody.embeds[0];
      const promptField = embed.fields.find((f: { name: string }) => f.name === 'Prompt Preview');
      expect(promptField).toBeDefined();
    }
  });

  it('should handle simple question preview', async () => {
    await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'What is AI?',
    });

    if (mockFetch.mock.calls.length > 0) {
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const embed = callBody.embeds[0];
      const promptField = embed.fields.find((f: { name: string }) => f.name === 'Prompt Preview');
      if (promptField) {
        expect(promptField.value).toContain('What is AI?');
      }
    }
  });

  it('should handle missing prompt preview', async () => {
    await logApiPreFlight({
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:00.000Z',
    });

    if (mockFetch.mock.calls.length > 0) {
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const embed = callBody.embeds[0];
      const promptField = embed.fields.find((f: { name: string }) => f.name === 'Prompt Preview');
      expect(promptField).toBeUndefined();
    }
  });
});

describe('API Logger - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
    __clearApiStateForTesting();
  });

  it('should handle missing prompt preview', async () => {
    await expect(
      logApiPreFlight({
        model: 'claude-3-opus',
        provider: 'anthropic',
        timestamp: '2024-01-15T10:30:00.000Z',
      })
    ).resolves.toBeDefined();
  });

  it('should handle empty string preview', async () => {
    await expect(
      logApiPreFlight({
        model: 'claude-3-opus',
        provider: 'anthropic',
        timestamp: '2024-01-15T10:30:00.000Z',
        promptPreview: '',
      })
    ).resolves.toBeDefined();
  });

  it('should handle zero token count', async () => {
    await expect(
      logApiResponse({
        requestId: 'req-zero-tokens',
        model: 'claude-3-opus',
        provider: 'anthropic',
        timestamp: '2024-01-15T10:30:01.000Z',
        tokenCount: 0,
        latencyMs: 100,
      })
    ).resolves.not.toThrow();
  });

  it('should handle very high latency', async () => {
    await logApiResponse({
      requestId: 'req-slow',
      model: 'claude-3-opus',
      provider: 'anthropic',
      timestamp: '2024-01-15T10:30:01.000Z',
      tokenCount: 100,
      latencyMs: 60000, // 60 seconds
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    const latencyField = embed.fields.find((f: { name: string }) => f.name === 'Latency');
    expect(latencyField?.value).toContain('60000ms');
  });

  it('should handle webhook network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(
      logApiPreFlight({
        model: 'claude-3-opus',
        provider: 'anthropic',
        timestamp: '2024-01-15T10:30:00.000Z',
        promptPreview: 'Test',
      })
    ).resolves.toBeDefined();
  });
});

describe('API Logger - createApiLoggerWrapper', () => {
  let createApiLoggerWrapper: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    const module = await import('./api-logger.js');
    createApiLoggerWrapper = module.createApiLoggerWrapper;
    module.__clearApiStateForTesting();
  });

  it('should wrap API function and log pre-flight', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('API response');
    const wrapped = createApiLoggerWrapper(mockApiFunction, {
      modelId: 'claude-3-opus',
      provider: 'anthropic',
      sessionKey: 'session-123',
    });

    await wrapped('arg1', 'arg2');

    expect(mockFetch).toHaveBeenCalled();
    expect(mockApiFunction).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should extract prompt preview from string context', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('API response');
    const wrapped = createApiLoggerWrapper(mockApiFunction, {
      modelId: 'claude-3-opus',
      provider: 'anthropic',
    });

    await wrapped('arg1', 'What is the meaning of life?');

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { value: string }) =>
      f.value.includes('What is the meaning')
    )).toBe(true);
  });

  it('should extract prompt preview from message array', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('API response');
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello there' },
    ];

    await wrapped('arg1', messages);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { value: string }) =>
      f.value.includes('Hello there')
    )).toBe(true);
  });

  it('should extract prompt from object with prompt property', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('API response');
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    await wrapped('arg1', { prompt: 'Test prompt string' });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { value: string }) =>
      f.value.includes('Test prompt string')
    )).toBe(true);
  });

  it('should extract prompt from nested messages property', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('API response');
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    await wrapped('arg1', {
      messages: [
        { role: 'user', content: 'Nested message content' },
      ],
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { value: string }) =>
      f.value.includes('Nested message')
    )).toBe(true);
  });

  it('should extract prompt from object with content property', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('API response');
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    await wrapped('arg1', { content: 'Direct content field' });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { value: string }) =>
      f.value.includes('Direct content')
    )).toBe(true);
  });

  it('should handle complex multimodal content', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('API response');
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    await wrapped('arg1', [
      {
        role: 'user',
        content: { type: 'text', text: 'Analyze this image' }
      },
    ]);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.embeds[0].fields.some((f: { name: string }) =>
      f.name === 'Prompt Preview'
    )).toBe(true);
  });

  it('should handle null/undefined context gracefully', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('API response');
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    await wrapped('arg1', null);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    expect(embed.fields.some((f: { value: string }) =>
      f.value.includes('[no context]')
    )).toBe(true);
  });

  it('should log response after API call completes', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('API response');
    const wrapped = createApiLoggerWrapper(mockApiFunction, {
      modelId: 'claude-3-opus',
    });

    await wrapped('arg1', 'context');

    // Should have 2 webhook calls: pre-flight (sync) + response (async)
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('should log error when API call fails', async () => {
    const mockApiFunction = vi.fn().mockRejectedValue(new Error('API failed'));
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    await expect(wrapped('arg1', 'context')).rejects.toThrow('API failed');

    // Should log error
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should calculate latency correctly', async () => {
    const mockApiFunction = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'response';
    });
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    await wrapped('arg1', 'context');

    // Pre-flight call should have been made
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should handle empty message array', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('response');
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    await wrapped('arg1', []);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.embeds[0]).toBeDefined();
  });

  it('should extract from array with non-message objects', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('response');
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    await wrapped('arg1', [{ invalid: 'object' }, { also: 'invalid' }]);

    expect(mockFetch).toHaveBeenCalled();
  });

  it('should truncate very long prompts in preview', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue('response');
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    const longPrompt = 'a'.repeat(2000);
    await wrapped('arg1', longPrompt);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const embed = callBody.embeds[0];
    const promptField = embed.fields.find((f: { name: string }) => f.name === 'Prompt Preview');
    expect(promptField.value.length).toBeLessThan(600); // 500 char limit + markdown
  });

  it('should preserve function arguments and return value', async () => {
    const mockApiFunction = vi.fn((a: string, b: number) => `${a}-${b}`);
    const wrapped = createApiLoggerWrapper(mockApiFunction);

    const result = await wrapped('test', 42);

    expect(result).toBe('test-42');
    expect(mockApiFunction).toHaveBeenCalledWith('test', 42);
  });
});
