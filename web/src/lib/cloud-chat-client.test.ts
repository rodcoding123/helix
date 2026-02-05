import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudChatClient, QuotaExceededError, getCloudChatClient } from './cloud-chat-client';

// Mock the supabase module to control auth.getSession per test
const mockGetSession = vi.fn();
const mockFrom = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => mockGetSession(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

describe('CloudChatClient', () => {
  let client: CloudChatClient;

  beforeEach(() => {
    client = new CloudChatClient();
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  describe('getEndpointUrl', () => {
    it('should contain /functions/v1/cloud-chat', () => {
      const url = client.getEndpointUrl();
      expect(url).toContain('/functions/v1/cloud-chat');
    });
  });

  describe('sendMessage', () => {
    it('should throw "Message cannot be empty" for empty string', async () => {
      await expect(client.sendMessage('')).rejects.toThrow('Message cannot be empty');
    });

    it('should throw "Message cannot be empty" for whitespace-only string', async () => {
      await expect(client.sendMessage('   ')).rejects.toThrow('Message cannot be empty');
    });

    it('should throw "Message too long" for messages exceeding 4000 characters', async () => {
      const longMessage = 'a'.repeat(4001);
      await expect(client.sendMessage(longMessage)).rejects.toThrow(
        'Message too long (max 4000 characters)'
      );
    });

    it('should throw "Not authenticated" when no session exists', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(client.sendMessage('hello')).rejects.toThrow('Not authenticated');
    });
  });

  describe('QuotaExceededError', () => {
    it('should store quota information', () => {
      const quota = { used: 50, limit: 50, remaining: 0 };
      const error = new QuotaExceededError({
        error: 'Quota exceeded',
        quota,
        upgrade: null,
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('QuotaExceededError');
      expect(error.message).toBe('Quota exceeded');
      expect(error.quota).toEqual(quota);
      expect(error.upgrade).toBeNull();
    });

    it('should store upgrade info when provided', () => {
      const quota = { used: 50, limit: 50, remaining: 0 };
      const upgrade = {
        message: 'Upgrade to Pro for unlimited messages',
        url: 'https://helix.app/upgrade',
      };
      const error = new QuotaExceededError({
        error: 'Daily limit reached',
        quota,
        upgrade,
      });

      expect(error.quota).toEqual(quota);
      expect(error.upgrade).toEqual(upgrade);
      expect(error.upgrade?.message).toBe('Upgrade to Pro for unlimited messages');
      expect(error.upgrade?.url).toBe('https://helix.app/upgrade');
    });
  });

  describe('getCloudChatClient', () => {
    it('should return a CloudChatClient instance', () => {
      const instance = getCloudChatClient();
      expect(instance).toBeInstanceOf(CloudChatClient);
    });

    it('should return the same instance on subsequent calls (singleton)', () => {
      const first = getCloudChatClient();
      const second = getCloudChatClient();
      expect(first).toBe(second);
    });
  });
});
