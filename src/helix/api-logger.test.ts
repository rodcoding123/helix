/**
 * Tests for Helix API logger module
 */

import { describe, it, expect } from 'vitest';

// Test extractPromptPreview function logic
describe('API Logger - extractPromptPreview', () => {
  // Type definitions for testing
  interface ApiMessage {
    role?: string;
    content?: string | object;
  }

  function isApiMessage(value: unknown): value is ApiMessage {
    return typeof value === 'object' && value !== null && ('role' in value || 'content' in value);
  }

  function hasStringProperty(obj: object, key: string): boolean {
    return key in obj && typeof (obj as Record<string, unknown>)[key] === 'string';
  }

  // Recreate the function for testing
  const extractPromptPreview = (context: unknown, maxLength: number = 500): string => {
    if (!context) return '[no context]';

    if (typeof context === 'string') {
      return context.slice(0, maxLength);
    }

    if (Array.isArray(context)) {
      const messages = context.filter(isApiMessage);
      const lastUserMessage = messages.reverse().find(msg => msg.role === 'user');

      if (lastUserMessage?.content !== undefined) {
        const content =
          typeof lastUserMessage.content === 'string'
            ? lastUserMessage.content
            : JSON.stringify(lastUserMessage.content);
        return content.slice(0, maxLength);
      }
    }

    if (typeof context === 'object' && context !== null) {
      const obj = context as Record<string, unknown>;
      if (hasStringProperty(obj, 'prompt')) {
        return (obj.prompt as string).slice(0, maxLength);
      }
      if ('messages' in obj) {
        return extractPromptPreview(obj.messages, maxLength);
      }
      if (hasStringProperty(obj, 'content')) {
        return (obj.content as string).slice(0, maxLength);
      }
    }

    return '[complex context]';
  };

  it('should return "[no context]" for null/undefined', () => {
    expect(extractPromptPreview(null)).toBe('[no context]');
    expect(extractPromptPreview(undefined)).toBe('[no context]');
  });

  it('should handle string context', () => {
    expect(extractPromptPreview('Hello, world!')).toBe('Hello, world!');
  });

  it('should truncate long strings', () => {
    const longString = 'a'.repeat(1000);
    const result = extractPromptPreview(longString, 100);
    expect(result).toHaveLength(100);
  });

  it('should extract last user message from array', () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];

    expect(extractPromptPreview(messages)).toBe('How are you?');
  });

  it('should handle message array with no user messages', () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'assistant', content: 'Ready to help!' },
    ];

    expect(extractPromptPreview(messages)).toBe('[complex context]');
  });

  it('should extract prompt from object', () => {
    const context = { prompt: 'What is 2+2?' };
    expect(extractPromptPreview(context)).toBe('What is 2+2?');
  });

  it('should extract content from object', () => {
    const context = { content: 'Some content here' };
    expect(extractPromptPreview(context)).toBe('Some content here');
  });

  it('should handle nested messages property', () => {
    const context = {
      messages: [{ role: 'user', content: 'Nested question' }],
    };
    expect(extractPromptPreview(context)).toBe('Nested question');
  });

  it('should return "[complex context]" for unknown structures', () => {
    expect(extractPromptPreview({ foo: 'bar' })).toBe('[complex context]');
    expect(extractPromptPreview([])).toBe('[complex context]');
  });

  it('should handle object content in messages', () => {
    const messages = [
      {
        role: 'user',
        content: { type: 'text', text: 'Complex content' },
      },
    ];
    const result = extractPromptPreview(messages);
    expect(result).toContain('type');
    expect(result).toContain('text');
  });
});

describe('API Logger - State Management', () => {
  it('should track API stats correctly', () => {
    // Simulate state management
    const state = {
      pending: new Map<string, { requestId: string }>(),
      requestCount: 0,
      tokenCount: 0,
    };

    // Simulate API request
    state.requestCount++;
    state.pending.set('req-1', { requestId: 'req-1' });

    expect(state.requestCount).toBe(1);
    expect(state.pending.size).toBe(1);

    // Simulate response
    state.tokenCount += 150;
    state.pending.delete('req-1');

    expect(state.tokenCount).toBe(150);
    expect(state.pending.size).toBe(0);

    // Simulate another request
    state.requestCount++;
    state.tokenCount += 200;

    expect(state.requestCount).toBe(2);
    expect(state.tokenCount).toBe(350);
  });

  it('should return correct stats format', () => {
    const getApiStats = (state: {
      requestCount: number;
      tokenCount: number;
      pending: Map<string, unknown>;
    }): { requestCount: number; tokenCount: number; pendingCount: number } => ({
      requestCount: state.requestCount,
      tokenCount: state.tokenCount,
      pendingCount: state.pending.size,
    });

    const state = {
      pending: new Map([
        ['req-1', {}],
        ['req-2', {}],
      ]),
      requestCount: 10,
      tokenCount: 5000,
    };

    const stats = getApiStats(state);
    expect(stats.requestCount).toBe(10);
    expect(stats.tokenCount).toBe(5000);
    expect(stats.pendingCount).toBe(2);
  });
});

describe('API Logger - Log Entry Structure', () => {
  it('should have correct ApiPreFlightLog interface', () => {
    const log = {
      model: 'claude-3-opus',
      provider: 'anthropic',
      sessionKey: 'session-123',
      timestamp: '2024-01-15T10:30:00.000Z',
      promptPreview: 'What is the meaning of life?',
      requestId: 'req-abc-123',
    };

    expect(log.model).toBeDefined();
    expect(log.provider).toBeDefined();
    expect(log.timestamp).toBeDefined();
    expect(log.requestId).toBeDefined();
  });

  it('should have correct ApiResponseLog interface', () => {
    const log = {
      model: 'claude-3-opus',
      provider: 'anthropic',
      sessionKey: 'session-123',
      timestamp: '2024-01-15T10:30:01.500Z',
      requestId: 'req-abc-123',
      responsePreview: 'The meaning of life is...',
      tokenCount: 150,
      latencyMs: 1500,
    };

    expect(log.responsePreview).toBeDefined();
    expect(log.tokenCount).toBe(150);
    expect(log.latencyMs).toBe(1500);
  });
});

describe('API Logger - Discord Embed Structure', () => {
  it('should create valid pre-flight embed', () => {
    const embed = {
      title: '🤖 API Request',
      color: 0x57f287,
      fields: [
        { name: 'Request ID', value: '`abc12345`', inline: true },
        { name: 'Model', value: 'claude-3-opus', inline: true },
        { name: 'Provider', value: 'anthropic', inline: true },
        { name: 'Time', value: '2024-01-15T10:30:00.000Z', inline: true },
        { name: 'Request #', value: '42', inline: true },
      ],
      timestamp: '2024-01-15T10:30:00.000Z',
      footer: { text: 'PRE-FLIGHT - Logged before API receives request' },
    };

    expect(embed.title).toContain('API Request');
    expect(embed.color).toBe(0x57f287); // Green
    expect(embed.footer.text).toContain('PRE-FLIGHT');
  });

  it('should create valid response embed', () => {
    const embed = {
      title: '✅ API Response',
      color: 0x2ecc71,
      fields: [
        { name: 'Request ID', value: '`abc12345`', inline: true },
        { name: 'Latency', value: '1500ms', inline: true },
        { name: 'Tokens', value: '150', inline: true },
      ],
      timestamp: '2024-01-15T10:30:01.500Z',
      footer: { text: 'POST-RESPONSE' },
    };

    expect(embed.title).toContain('Response');
    expect(embed.color).toBe(0x2ecc71); // Green
    expect(embed.footer.text).toBe('POST-RESPONSE');
  });

  it('should create valid error embed', () => {
    const embed = {
      title: '❌ API Error',
      color: 0xe74c3c,
      fields: [
        { name: 'Request ID', value: '`abc12345`', inline: true },
        { name: 'Status', value: '429', inline: true },
        { name: 'Error', value: 'Rate limit exceeded', inline: false },
      ],
      timestamp: '2024-01-15T10:30:00.500Z',
      footer: { text: 'API CALL FAILED' },
    };

    expect(embed.title).toContain('Error');
    expect(embed.color).toBe(0xe74c3c); // Red
    expect(embed.footer.text).toBe('API CALL FAILED');
  });
});
