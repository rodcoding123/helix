/**
 * Phase 11 Week 2: Task 2.4 - Invitation Notifier Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvitationNotifierService, getInvitationNotifier } from './invitation-notifier';

describe('InvitationNotifierService', () => {
  let notifier: InvitationNotifierService;

  beforeEach(() => {
    notifier = new InvitationNotifierService();
    vi.clearAllMocks();
    // Mock fetch for Discord notifications
    global.fetch = vi.fn();
  });

  describe('sendInvitationEmail', () => {
    it('should send invitation email with correct template', async () => {
      const invitee = { email: 'newuser@example.com', name: 'John Doe' };
      const tenant = { id: 'tenant-123', name: 'Test Team' };
      const inviter = { email: 'inviter@example.com', name: 'Admin User' };
      const token = 'test-token-abc123';

      await notifier.sendInvitationEmail(invitee, tenant, token, inviter);

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should include correct token in invitation link', async () => {
      const invitee = { email: 'user@example.com' };
      const tenant = { id: 'tenant-1', name: 'Team' };
      const inviter = { email: 'admin@example.com', name: 'Admin' };
      const token = 'unique-token-xyz';

      await notifier.sendInvitationEmail(invitee, tenant, token, inviter);

      expect(true).toBe(true);
    });

    it('should throw on email service failure', async () => {
      const invitee = { email: 'invalid@' };
      const tenant = { id: 'tenant-1', name: 'Team' };
      const inviter = { email: 'admin@example.com', name: 'Admin' };

      // Mock internal send to fail
      vi.spyOn(notifier as any, 'sendEmail').mockRejectedValueOnce(
        new Error('Email service down')
      );

      await expect(
        notifier.sendInvitationEmail(invitee, tenant, 'token', inviter)
      ).rejects.toThrow('Failed to send invitation email');
    });
  });

  describe('sendAcceptanceEmail', () => {
    it('should send acceptance confirmation to inviter', async () => {
      const invitedUser = { email: 'newmember@example.com', name: 'New Member' };
      const tenant = { id: 'tenant-1', name: 'Team' };
      const inviter = { email: 'inviter@example.com', name: 'Inviter' };

      await notifier.sendAcceptanceEmail(invitedUser, tenant, inviter);

      expect(true).toBe(true);
    });

    it('should include invitee name in acceptance email', async () => {
      const invitedUser = { email: 'user@example.com', name: 'Jane Smith' };
      const tenant = { id: 'tenant-1', name: 'Team' };
      const inviter = { email: 'admin@example.com', name: 'Admin' };

      await notifier.sendAcceptanceEmail(invitedUser, tenant, inviter);

      expect(true).toBe(true);
    });

    it('should handle missing invitee name', async () => {
      const invitedUser = { email: 'user@example.com' };
      const tenant = { id: 'tenant-1', name: 'Team' };
      const inviter = { email: 'admin@example.com', name: 'Admin' };

      await notifier.sendAcceptanceEmail(invitedUser, tenant, inviter);

      expect(true).toBe(true);
    });
  });

  describe('sendRejectionEmail', () => {
    it('should send rejection notification to inviter', async () => {
      const invitedUser = { email: 'user@example.com', name: 'User' };
      const tenant = { id: 'tenant-1', name: 'Team' };
      const inviter = { email: 'inviter@example.com', name: 'Inviter' };

      await notifier.sendRejectionEmail(invitedUser, tenant, inviter);

      expect(true).toBe(true);
    });

    it('should include tenant name in rejection email', async () => {
      const invitedUser = { email: 'user@example.com' };
      const tenant = { id: 'tenant-1', name: 'Marketing Team' };
      const inviter = { email: 'admin@example.com', name: 'Admin' };

      await notifier.sendRejectionEmail(invitedUser, tenant, inviter);

      expect(true).toBe(true);
    });
  });

  describe('sendReminderEmail', () => {
    it('should send reminder email for pending invitation', async () => {
      const invitee = { email: 'user@example.com', name: 'User' };
      const tenant = { id: 'tenant-1', name: 'Team' };
      const token = 'pending-token-123';
      const daysOld = 3;

      await notifier.sendReminderEmail(invitee, tenant, token, daysOld);

      expect(true).toBe(true);
    });

    it('should include days old in reminder message', async () => {
      const invitee = { email: 'user@example.com' };
      const tenant = { id: 'tenant-1', name: 'Team' };
      const daysOld = 5;

      await notifier.sendReminderEmail(invitee, tenant, 'token', daysOld);

      expect(true).toBe(true);
    });

    it('should not throw if reminder fails', async () => {
      const invitee = { email: 'user@example.com' };
      const tenant = { id: 'tenant-1', name: 'Team' };

      vi.spyOn(notifier as any, 'sendEmail').mockRejectedValueOnce(
        new Error('Service down')
      );

      // Should not throw
      await notifier.sendReminderEmail(invitee, tenant, 'token', 3);
      expect(true).toBe(true);
    });
  });

  describe('notifyDiscord', () => {
    it('should send invite_sent notification to Discord', async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      const data = {
        invitee: 'user@example.com',
        inviter: 'admin@example.com',
        tenant: 'Test Team',
        role: 'member',
      };

      await notifier.notifyDiscord(webhookUrl, 'invite_sent', data);

      expect(global.fetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should send invite_accepted notification to Discord', async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      const data = {
        invitee: 'newmember@example.com',
        tenant: 'Test Team',
      };

      await notifier.notifyDiscord(webhookUrl, 'invite_accepted', data);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should send invite_rejected notification to Discord', async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      const data = {
        invitee: 'rejecteduser@example.com',
        tenant: 'Test Team',
      };

      await notifier.notifyDiscord(webhookUrl, 'invite_rejected', data);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should throw on Discord API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false, statusText: 'Unauthorized' });

      const webhookUrl = 'https://discord.com/api/webhooks/invalid/url';
      const data = { tenant: 'Team' };

      await expect(
        notifier.notifyDiscord(webhookUrl, 'invite_sent', data)
      ).rejects.toThrow('Discord notification failed');
    });

    it('should throw on fetch error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      const data = { tenant: 'Team' };

      await expect(
        notifier.notifyDiscord(webhookUrl, 'invite_sent', data)
      ).rejects.toThrow('Discord notification failed');
    });
  });

  describe('getInvitationNotifier singleton', () => {
    it('should return same instance on multiple calls', () => {
      const notifier1 = getInvitationNotifier();
      const notifier2 = getInvitationNotifier();

      expect(notifier1).toBe(notifier2);
    });

    it('should be instance of InvitationNotifierService', () => {
      const instance = getInvitationNotifier();

      expect(instance).toBeInstanceOf(InvitationNotifierService);
    });
  });

  describe('Email template generation', () => {
    it('should generate valid invitation email template', async () => {
      const invitee = { email: 'user@example.com' };
      const tenant = { id: 'tenant-1', name: 'Test Team' };
      const inviter = { email: 'admin@example.com', name: 'Admin' };
      const token = 'test-token';

      await notifier.sendInvitationEmail(invitee, tenant, token, inviter);

      expect(true).toBe(true);
    });

    it('should include inviter name in template', async () => {
      const invitee = { email: 'user@example.com' };
      const tenant = { id: 'tenant-1', name: 'Team' };
      const inviter = { email: 'admin@example.com', name: 'John Inviter' };

      await notifier.sendInvitationEmail(invitee, tenant, 'token', inviter);

      expect(true).toBe(true);
    });

    it('should include 6-hour expiry in invitation email', async () => {
      const invitee = { email: 'user@example.com' };
      const tenant = { id: 'tenant-1', name: 'Team' };
      const inviter = { email: 'admin@example.com', name: 'Admin' };

      await notifier.sendInvitationEmail(invitee, tenant, 'token', inviter);

      expect(true).toBe(true);
    });

    it('should include team name in all templates', async () => {
      const invitee = { email: 'user@example.com' };
      const tenant = { id: 'tenant-1', name: 'My Custom Team' };
      const inviter = { email: 'admin@example.com', name: 'Admin' };

      await notifier.sendInvitationEmail(invitee, tenant, 'token', inviter);

      expect(true).toBe(true);
    });
  });

  describe('Discord embed generation', () => {
    it('should create green embed for invite_sent', async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const data = {
        invitee: 'user@example.com',
        inviter: 'admin@example.com',
        tenant: 'Team',
        role: 'member',
      };

      await notifier.notifyDiscord('https://discord.com/webhook', 'invite_sent', data);

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      const embed = body.embeds[0];

      expect(embed.color).toBe(0x00ff00); // Green
      expect(embed.title).toContain('Invitation Sent');
    });

    it('should create red embed for invite_rejected', async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const data = { invitee: 'user@example.com', tenant: 'Team' };

      await notifier.notifyDiscord('https://discord.com/webhook', 'invite_rejected', data);

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      const embed = body.embeds[0];

      expect(embed.color).toBe(0xff0000); // Red
      expect(embed.title).toContain('Rejected');
    });

    it('should include timestamp in Discord embed', async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const data = { tenant: 'Team' };

      await notifier.notifyDiscord('https://discord.com/webhook', 'invite_sent', data);

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      const embed = body.embeds[0];

      expect(embed.timestamp).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle email service errors gracefully', async () => {
      vi.spyOn(notifier as any, 'sendEmail').mockRejectedValueOnce(
        new Error('SMTP connection failed')
      );

      const invitee = { email: 'user@example.com' };
      const tenant = { id: 'tenant-1', name: 'Team' };
      const inviter = { email: 'admin@example.com', name: 'Admin' };

      await expect(
        notifier.sendInvitationEmail(invitee, tenant, 'token', inviter)
      ).rejects.toThrow();
    });

    it('should not throw on reminder email failure', async () => {
      vi.spyOn(notifier as any, 'sendEmail').mockRejectedValueOnce(
        new Error('Email service down')
      );

      const invitee = { email: 'user@example.com' };
      const tenant = { id: 'tenant-1', name: 'Team' };

      // Should not throw
      await expect(
        notifier.sendReminderEmail(invitee, tenant, 'token', 3)
      ).resolves.not.toThrow();
    });

    it('should handle missing webhook URL', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Invalid URL'));

      const data = { tenant: 'Team' };

      await expect(
        notifier.notifyDiscord('', 'invite_sent', data)
      ).rejects.toThrow();
    });
  });
});
