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
    const requestId = await logApiPreFlight({
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
