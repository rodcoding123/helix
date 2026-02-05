import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCloudChat } from './useCloudChat';

const mockSendMessage = vi.fn();

vi.mock('@/lib/cloud-chat-client', () => {
  class MockQuotaExceededError extends Error {
    public quota: { used: number; limit: number; remaining: number };
    public upgrade: { message: string; url: string } | null;

    constructor(data: {
      error: string;
      quota: { used: number; limit: number; remaining: number };
      upgrade: { message: string; url: string } | null;
    }) {
      super(data.error);
      this.name = 'QuotaExceededError';
      this.quota = data.quota;
      this.upgrade = data.upgrade;
    }
  }

  return {
    getCloudChatClient: vi.fn(() => ({
      sendMessage: mockSendMessage,
    })),
    QuotaExceededError: MockQuotaExceededError,
  };
});

describe('useCloudChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({
      message: 'Hello! I am Helix.',
      messageId: 'msg-1',
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      quota: { used: 1, limit: 10, remaining: 9 },
    });
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useCloudChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.quotaExceeded).toBe(false);
    expect(result.current.quota).toBeNull();
    expect(result.current.upgradeInfo).toBeNull();
  });

  it('sends a message and receives a response', async () => {
    const { result } = renderHook(() => useCloudChat());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Hello');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Hello! I am Helix.');
    expect(result.current.isLoading).toBe(false);
  });

  it('updates quota after sending a message', async () => {
    const { result } = renderHook(() => useCloudChat());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.quota).toEqual({ used: 1, limit: 10, remaining: 9 });
    expect(result.current.quotaExceeded).toBe(false);
  });

  it('resets all state when reset is called', async () => {
    const { result } = renderHook(() => useCloudChat());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.quota).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.quota).toBeNull();
    expect(result.current.quotaExceeded).toBe(false);
    expect(result.current.upgradeInfo).toBeNull();
  });

  it('ignores empty strings and does not add messages', async () => {
    const { result } = renderHook(() => useCloudChat());

    await act(async () => {
      await result.current.sendMessage('');
    });

    expect(result.current.messages).toEqual([]);
    expect(mockSendMessage).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(result.current.messages).toEqual([]);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
