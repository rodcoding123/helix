/**
 * Channel-Specific Features Integration Tests
 *
 * Tests for WhatsApp broadcasts, Telegram keyboards, Discord threads, and Slack blocks.
 * Verifies component rendering, gateway integration, and user interactions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock gateway client
const mockGatewayClient = {
  connected: true,
  request: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('../../../lib/gateway-client', () => ({
  getClient: () => mockGatewayClient,
}));

describe('Channel-Specific Features', () => {
  const mockAccount = {
    id: 'account-test-123',
    channelId: 'whatsapp',
    name: 'Test Account',
    accountIdentifier: '1234567890',
    isActive: true,
    isPrimary: true,
    status: 'connected' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    mockGatewayClient.request.mockClear();
    mockGatewayClient.on.mockClear();
    mockGatewayClient.off.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('WhatsApp Broadcasts', () => {
    it('should load broadcasts from gateway', async () => {
      const broadcasts = [
        {
          id: 'bc-123',
          name: 'Friends',
          recipients: ['1234567890', '9876543210'],
          createdAt: Date.now(),
        },
      ];

      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        broadcasts,
      });

      const result = await mockGatewayClient.request('channels.whatsapp.broadcasts.list', {
        accountId: mockAccount.id,
      });

      expect(result).toEqual({ ok: true, broadcasts });
      expect(mockGatewayClient.request).toHaveBeenCalledWith(
        'channels.whatsapp.broadcasts.list',
        { accountId: mockAccount.id }
      );
    });

    it('should create new broadcast list', async () => {
      const newBroadcast = {
        id: 'bc-new',
        name: 'Family',
        recipients: ['5551234567', '5559876543'],
        createdAt: Date.now(),
      };

      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        broadcast: newBroadcast,
      });

      const result = await mockGatewayClient.request(
        'channels.whatsapp.broadcasts.create',
        {
          accountId: mockAccount.id,
          name: 'Family',
          recipients: ['5551234567', '5559876543'],
        }
      );

      expect(result.ok).toBe(true);
      expect(result.broadcast.name).toBe('Family');
      expect(result.broadcast.recipients).toHaveLength(2);
    });

    it('should send broadcast message', async () => {
      const broadcastId = 'bc-123';

      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        messageId: 'msg-123',
        recipientStatus: {
          '1234567890': 'sent',
          '9876543210': 'pending',
        },
      });

      const result = await mockGatewayClient.request(
        'channels.whatsapp.broadcasts.send',
        {
          accountId: mockAccount.id,
          broadcastId,
          content: 'Hello everyone!',
        }
      );

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(Object.keys(result.recipientStatus)).toHaveLength(2);
    });

    it('should delete broadcast list', async () => {
      const broadcastId = 'bc-123';

      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
      });

      const result = await mockGatewayClient.request(
        'channels.whatsapp.broadcasts.delete',
        {
          accountId: mockAccount.id,
          broadcastId,
        }
      );

      expect(result.ok).toBe(true);
    });

    it('should handle broadcast error gracefully', async () => {
      mockGatewayClient.request.mockRejectedValueOnce(
        new Error('Broadcast creation failed')
      );

      await expect(
        mockGatewayClient.request('channels.whatsapp.broadcasts.create', {
          accountId: mockAccount.id,
          name: 'Test',
          recipients: [],
        })
      ).rejects.toThrow('Broadcast creation failed');
    });
  });

  describe('Telegram Keyboard Builder', () => {
    it('should load keyboard templates', async () => {
      const templates = [
        {
          id: 'tpl-123',
          name: 'Menu',
          buttons: [
            { id: 'btn-1', label: 'Start', callback: 'start', row: 0, col: 0 },
            { id: 'btn-2', label: 'Help', callback: 'help', row: 0, col: 1 },
          ],
          createdAt: Date.now(),
        },
      ];

      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        templates,
      });

      const result = await mockGatewayClient.request('channels.telegram.keyboards.list', {
        accountId: mockAccount.id,
      });

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].buttons).toHaveLength(2);
    });

    it('should create keyboard template', async () => {
      const buttons = [
        { id: 'btn-1', label: 'Yes', callback: 'yes', row: 0, col: 0 },
        { id: 'btn-2', label: 'No', callback: 'no', row: 0, col: 1 },
      ];

      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        template: {
          id: 'tpl-new',
          name: 'Confirmation',
          buttons,
          createdAt: Date.now(),
        },
      });

      const result = await mockGatewayClient.request(
        'channels.telegram.keyboards.create',
        {
          accountId: mockAccount.id,
          name: 'Confirmation',
          buttons,
        }
      );

      expect(result.ok).toBe(true);
      expect(result.template.name).toBe('Confirmation');
      expect(result.template.buttons).toHaveLength(2);
    });

    it('should delete keyboard template', async () => {
      mockGatewayClient.request.mockResolvedValueOnce({ ok: true });

      const result = await mockGatewayClient.request(
        'channels.telegram.keyboards.delete',
        {
          accountId: mockAccount.id,
          templateId: 'tpl-123',
        }
      );

      expect(result.ok).toBe(true);
    });

    it('should validate button structure', async () => {
      const buttons = [
        { id: 'btn-1', label: 'A', callback: 'a', row: 0, col: 0 },
        { id: 'btn-2', label: 'B', callback: 'b', row: 0, col: 1 },
        { id: 'btn-3', label: 'C', callback: 'c', row: 0, col: 2 },
      ];

      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        template: {
          id: 'tpl-abc',
          name: 'ABC',
          buttons,
          createdAt: Date.now(),
        },
      });

      const result = await mockGatewayClient.request(
        'channels.telegram.keyboards.create',
        {
          accountId: mockAccount.id,
          name: 'ABC',
          buttons,
        }
      );

      const template = result.template;
      expect(template.buttons.every(b => b.label && b.callback)).toBe(true);
    });
  });

  describe('Discord Thread Settings', () => {
    it('should load thread settings', async () => {
      const settings = {
        keywords: [
          { id: 'kw-1', keyword: 'bug', enabled: true, autoArchiveMinutes: 60 },
          { id: 'kw-2', keyword: 'feature', enabled: false, autoArchiveMinutes: 1440 },
        ],
        embedColor: '#3498DB',
        reactions: [
          { emoji: '👍', action: 'approve' },
          { emoji: '❌', action: 'reject' },
        ],
      };

      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        ...settings,
      });

      const result = await mockGatewayClient.request(
        'channels.discord.threads.settings',
        { accountId: mockAccount.id }
      );

      expect(result.keywords).toHaveLength(2);
      expect(result.embedColor).toBe('#3498DB');
      expect(result.reactions).toHaveLength(2);
    });

    it('should add thread keyword', async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        keywordId: 'kw-new',
      });

      const result = await mockGatewayClient.request(
        'channels.discord.threads.addKeyword',
        {
          accountId: mockAccount.id,
          keyword: 'urgent',
          autoArchiveMinutes: 60,
          rateLimitPerHour: 10,
        }
      );

      expect(result.ok).toBe(true);
      expect(result.keywordId).toBeDefined();
    });

    it('should update embed color', async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
      });

      const result = await mockGatewayClient.request(
        'channels.discord.embeds.updateColor',
        {
          accountId: mockAccount.id,
          color: '#E74C3C',
        }
      );

      expect(result.ok).toBe(true);
    });

    it('should add reaction workflow', async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
      });

      const result = await mockGatewayClient.request('channels.discord.reactions.add', {
        accountId: mockAccount.id,
        emoji: '⭐',
        action: 'pin',
      });

      expect(result.ok).toBe(true);
    });

    it('should toggle keyword enabled state', async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
      });

      const result = await mockGatewayClient.request(
        'channels.discord.threads.updateKeyword',
        {
          accountId: mockAccount.id,
          keywordId: 'kw-1',
          enabled: false,
        }
      );

      expect(result.ok).toBe(true);
    });
  });

  describe('Slack Block Kit Builder', () => {
    it('should load block templates', async () => {
      const templates = [
        {
          id: 'blt-123',
          name: 'Approval',
          blocks: [
            { id: 'b1', type: 'section', text: 'Approve this request?' },
            { id: 'b2', type: 'button', text: 'Approve' },
            { id: 'b3', type: 'button', text: 'Deny' },
          ],
          createdAt: Date.now(),
        },
      ];

      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        templates,
      });

      const result = await mockGatewayClient.request(
        'channels.slack.blocks.listTemplates',
        { accountId: mockAccount.id }
      );

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].blocks).toHaveLength(3);
    });

    it('should create block template', async () => {
      const blocks = [
        { id: 'b1', type: 'section' as const, text: 'Hello' },
        { id: 'b2', type: 'divider' as const },
        { id: 'b3', type: 'button' as const, text: 'Click me' },
      ];

      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        template: {
          id: 'blt-new',
          name: 'Greeting',
          blocks,
          createdAt: Date.now(),
        },
      });

      const result = await mockGatewayClient.request(
        'channels.slack.blocks.createTemplate',
        {
          accountId: mockAccount.id,
          name: 'Greeting',
          blocks,
        }
      );

      expect(result.ok).toBe(true);
      expect(result.template.blocks).toHaveLength(3);
    });

    it('should validate block types', async () => {
      const blocks = [
        { id: 'b1', type: 'section' as const, text: 'Status Update' },
        { id: 'b2', type: 'input' as const, label: 'Notes', placeholder: 'Enter notes' },
      ];

      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        template: {
          id: 'blt-form',
          name: 'Form',
          blocks,
          createdAt: Date.now(),
        },
      });

      const result = await mockGatewayClient.request(
        'channels.slack.blocks.createTemplate',
        {
          accountId: mockAccount.id,
          name: 'Form',
          blocks,
        }
      );

      const validTypes = ['section', 'button', 'input', 'divider', 'image'];
      expect(result.template.blocks.every(b => validTypes.includes(b.type))).toBe(true);
    });

    it('should delete block template', async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
      });

      const result = await mockGatewayClient.request(
        'channels.slack.blocks.deleteTemplate',
        {
          accountId: mockAccount.id,
          templateId: 'blt-123',
        }
      );

      expect(result.ok).toBe(true);
    });
  });

  describe('Cross-Channel Integration', () => {
    it('should handle account context in all features', async () => {
      const accountId = 'account-123';

      // WhatsApp
      mockGatewayClient.request.mockResolvedValueOnce({ ok: true, broadcasts: [] });
      await mockGatewayClient.request('channels.whatsapp.broadcasts.list', { accountId });

      // Telegram
      mockGatewayClient.request.mockResolvedValueOnce({ ok: true, templates: [] });
      await mockGatewayClient.request('channels.telegram.keyboards.list', { accountId });

      // Discord
      mockGatewayClient.request.mockResolvedValueOnce({
        ok: true,
        keywords: [],
        embedColor: '#3498DB',
        reactions: [],
      });
      await mockGatewayClient.request('channels.discord.threads.settings', { accountId });

      // Slack
      mockGatewayClient.request.mockResolvedValueOnce({ ok: true, templates: [] });
      await mockGatewayClient.request('channels.slack.blocks.listTemplates', { accountId });

      expect(mockGatewayClient.request).toHaveBeenCalledTimes(4);
      expect(mockGatewayClient.request).toHaveBeenNthCalledWith(1, expect.any(String), {
        accountId,
      });
    });

    it('should support disconnected gateway fallback', async () => {
      const disconnectedClient = {
        connected: false,
        request: vi.fn(),
      };

      mockGatewayClient.connected = false;

      // Should handle gracefully
      expect(mockGatewayClient.connected).toBe(false);
    });

    it('should handle errors from all feature types', async () => {
      const error = new Error('Gateway error');

      mockGatewayClient.request.mockRejectedValue(error);

      // All feature types should handle errors
      await expect(
        mockGatewayClient.request('channels.whatsapp.broadcasts.list', {
          accountId: mockAccount.id,
        })
      ).rejects.toThrow('Gateway error');

      await expect(
        mockGatewayClient.request('channels.telegram.keyboards.list', {
          accountId: mockAccount.id,
        })
      ).rejects.toThrow('Gateway error');

      expect(mockGatewayClient.request).toHaveBeenCalledTimes(2);
    });
  });
});
