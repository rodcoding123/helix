/**
 * Channels Accounts Gateway Methods Tests
 *
 * Comprehensive testing of multi-account management:
 * - Account CRUD operations
 * - Account activation/switching
 * - Credential management
 * - Account status tracking
 * - Policy overrides
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  channelsAccountsMethods,
  type ChannelAccount,
  type ChannelAccountCredential,
} from '../channels-accounts';

describe('Channels Accounts Gateway Methods', () => {
  const testChannelId = 'channel-test-001';
  const testAccountName = 'Test Account';
  const testIdentifier = '+1234567890';

  beforeEach(async () => {
    // Clear previous test data
  });

  describe('Account CRUD', () => {
    it('should create a new account', async () => {
      const result = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: testAccountName,
        accountIdentifier: testIdentifier,
      });

      expect(result.ok).toBe(true);
      expect(result.account).toBeDefined();
      expect(result.account.id).toMatch(/^account-/);
      expect(result.account.name).toBe(testAccountName);
      expect(result.account.accountIdentifier).toBe(testIdentifier);
      expect(result.account.isPrimary).toBe(true);
      expect(result.account.isActive).toBe(true);
    });

    it('should create multiple accounts', async () => {
      const first = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account 1',
        accountIdentifier: '+111',
      });

      const second = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account 2',
        accountIdentifier: '+222',
      });

      expect(first.account.id).not.toBe(second.account.id);
      expect(first.account.isPrimary).toBe(true);
      expect(second.account.isPrimary).toBe(false);
      expect(second.account.isActive).toBe(false);
    });

    it('should list accounts for channel', async () => {
      await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account 1',
        accountIdentifier: '+111',
      });

      await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account 2',
        accountIdentifier: '+222',
      });

      const result = await channelsAccountsMethods['channels.listAccounts']({
        channelId: testChannelId,
      });

      expect(result.ok).toBe(true);
      expect(result.accounts).toHaveLength(2);
      expect(result.primaryAccountId).toBeDefined();
    });

    it('should update account', async () => {
      const created = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Original Name',
        accountIdentifier: testIdentifier,
      });

      const updated = await channelsAccountsMethods['channels.updateAccount']({
        channelId: testChannelId,
        accountId: created.account.id,
        updates: {
          displayName: 'New Display Name',
        },
      });

      expect(updated.ok).toBe(true);
      expect(updated.account.displayName).toBe('New Display Name');
      expect(updated.account.name).toBe('Original Name'); // Unchanged
    });

    it('should delete account', async () => {
      const created = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'To Delete',
        accountIdentifier: testIdentifier,
      });

      const deleted = await channelsAccountsMethods['channels.deleteAccount']({
        channelId: testChannelId,
        accountId: created.account.id,
      });

      expect(deleted.ok).toBe(true);

      const listed = await channelsAccountsMethods['channels.listAccounts']({
        channelId: testChannelId,
      });

      expect(listed.accounts).toHaveLength(0);
    });

    it('should throw error when updating non-existent account', async () => {
      await expect(
        channelsAccountsMethods['channels.updateAccount']({
          channelId: testChannelId,
          accountId: 'non-existent',
          updates: { name: 'Test' },
        })
      ).rejects.toThrow('Account not found');
    });

    it('should throw error when deleting non-existent account', async () => {
      await expect(
        channelsAccountsMethods['channels.deleteAccount']({
          channelId: testChannelId,
          accountId: 'non-existent',
        })
      ).rejects.toThrow('Account not found');
    });
  });

  describe('Account Activation', () => {
    it('should switch active account', async () => {
      const acc1 = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account 1',
        accountIdentifier: '+111',
      });

      const acc2 = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account 2',
        accountIdentifier: '+222',
      });

      expect(acc1.account.isActive).toBe(true);
      expect(acc2.account.isActive).toBe(false);

      const switched = await channelsAccountsMethods['channels.setActiveAccount']({
        channelId: testChannelId,
        accountId: acc2.account.id,
      });

      expect(switched.ok).toBe(true);
      expect(switched.account.isActive).toBe(true);
      expect(switched.account.lastActive).toBeDefined();
    });

    it('should track last active timestamp', async () => {
      const created = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account',
        accountIdentifier: testIdentifier,
      });

      const before = Date.now();
      const activated = await channelsAccountsMethods['channels.setActiveAccount']({
        channelId: testChannelId,
        accountId: created.account.id,
      });
      const after = Date.now();

      expect(activated.account.lastActive).toBeGreaterThanOrEqual(before);
      expect(activated.account.lastActive).toBeLessThanOrEqual(after);
    });

    it('should throw error when activating non-existent account', async () => {
      await expect(
        channelsAccountsMethods['channels.setActiveAccount']({
          channelId: testChannelId,
          accountId: 'non-existent',
        })
      ).rejects.toThrow('Account not found');
    });
  });

  describe('Credential Management', () => {
    let testAccountId: string;

    beforeEach(async () => {
      const created = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account',
        accountIdentifier: testIdentifier,
      });
      testAccountId = created.account.id;
    });

    it('should add credential to account', async () => {
      const result = await channelsAccountsMethods['channels.accounts.addCredential']({
        accountId: testAccountId,
        type: 'token',
        label: 'Bot Token',
        value: 'secret-token-123',
      });

      expect(result.ok).toBe(true);
      expect(result.credential).toBeDefined();
      expect(result.credential.id).toMatch(/^cred-/);
      expect(result.credential.label).toBe('Bot Token');
      expect(result.credential.type).toBe('token');
      expect(result.credential.isStored).toBe(true);
      expect(result.credential.value).toBeUndefined(); // Don't expose value
    });

    it('should add multiple credentials to account', async () => {
      const token = await channelsAccountsMethods['channels.accounts.addCredential']({
        accountId: testAccountId,
        type: 'token',
        label: 'Token',
        value: 'token-123',
      });

      const webhook = await channelsAccountsMethods['channels.accounts.addCredential']({
        accountId: testAccountId,
        type: 'webhook_url',
        label: 'Webhook',
        value: 'https://example.com/webhook',
      });

      expect(token.credential.id).not.toBe(webhook.credential.id);
    });

    it('should list credentials for account', async () => {
      await channelsAccountsMethods['channels.accounts.addCredential']({
        accountId: testAccountId,
        type: 'token',
        label: 'Token 1',
        value: 'token-1',
      });

      await channelsAccountsMethods['channels.accounts.addCredential']({
        accountId: testAccountId,
        type: 'api_key',
        label: 'API Key',
        value: 'key-123',
      });

      const result = await channelsAccountsMethods['channels.accounts.listCredentials']({
        accountId: testAccountId,
      });

      expect(result.ok).toBe(true);
      expect(result.credentials).toHaveLength(2);
      expect(result.credentials[0].value).toBeUndefined(); // No values exposed
      expect(result.credentials[1].value).toBeUndefined();
    });

    it('should delete credential from account', async () => {
      const added = await channelsAccountsMethods['channels.accounts.addCredential']({
        accountId: testAccountId,
        type: 'token',
        label: 'Token',
        value: 'token-123',
      });

      const deleted = await channelsAccountsMethods['channels.accounts.deleteCredential']({
        accountId: testAccountId,
        credentialId: added.credential.id,
      });

      expect(deleted.ok).toBe(true);

      const listed = await channelsAccountsMethods['channels.accounts.listCredentials']({
        accountId: testAccountId,
      });

      expect(listed.credentials).toHaveLength(0);
    });

    it('should test credential connectivity', async () => {
      const added = await channelsAccountsMethods['channels.accounts.addCredential']({
        accountId: testAccountId,
        type: 'token',
        label: 'Token',
        value: 'token-123',
      });

      const tested = await channelsAccountsMethods['channels.accounts.testCredential']({
        accountId: testAccountId,
        credentialId: added.credential.id,
      });

      expect(tested.ok).toBe(true);
      expect(tested.tested).toBe(true);
    });

    it('should throw error when testing non-existent credential', async () => {
      await expect(
        channelsAccountsMethods['channels.accounts.testCredential']({
          accountId: testAccountId,
          credentialId: 'non-existent',
        })
      ).rejects.toThrow('Credential not found');
    });

    it('should support credential expiration', async () => {
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

      const result = await channelsAccountsMethods['channels.accounts.addCredential']({
        accountId: testAccountId,
        type: 'oauth',
        label: 'OAuth Token',
        value: 'oauth-token',
        expiresAt,
      });

      expect(result.credential.expiresAt).toBe(expiresAt);
    });
  });

  describe('Account Status', () => {
    let testAccountId: string;

    beforeEach(async () => {
      const created = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account',
        accountIdentifier: testIdentifier,
      });
      testAccountId = created.account.id;
    });

    it('should get account status', async () => {
      const result = await channelsAccountsMethods['channels.accounts.status']({
        accountId: testAccountId,
      });

      expect(result.ok).toBe(true);
      expect(result.status.accountId).toBe(testAccountId);
      expect(result.status.connectionStatus).toBe('disconnected');
      expect(result.status.online).toBe(false);
    });

    it('should update account status', async () => {
      const updated = await channelsAccountsMethods['channels.accounts.updateStatus']({
        channelId: testChannelId,
        accountId: testAccountId,
        status: 'connected',
      });

      expect(updated.ok).toBe(true);
      expect(updated.account.status).toBe('connected');
    });

    it('should update lastActive when status is connected', async () => {
      const before = Date.now();

      await channelsAccountsMethods['channels.accounts.updateStatus']({
        channelId: testChannelId,
        accountId: testAccountId,
        status: 'connected',
      });

      const after = Date.now();
      const status = await channelsAccountsMethods['channels.accounts.status']({
        accountId: testAccountId,
      });

      expect(status.status.lastActive).toBeGreaterThanOrEqual(before);
      expect(status.status.lastActive).toBeLessThanOrEqual(after);
    });

    it('should support various status values', async () => {
      const statuses: ChannelAccount['status'][] = [
        'connected',
        'connecting',
        'disconnected',
        'paused',
        'error',
      ];

      for (const status of statuses) {
        const result = await channelsAccountsMethods['channels.accounts.updateStatus']({
          channelId: testChannelId,
          accountId: testAccountId,
          status,
        });

        expect(result.account.status).toBe(status);
      }
    });
  });

  describe('Policy Overrides', () => {
    let testAccountId: string;

    beforeEach(async () => {
      const created = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account',
        accountIdentifier: testIdentifier,
      });
      testAccountId = created.account.id;
    });

    it('should set policy overrides for account', async () => {
      const overrides = {
        dmPolicy: 'allowlist',
        allowlist: ['+1111111111', '+2222222222'],
        maxDailyMessages: 1000,
      };

      const result = await channelsAccountsMethods['channels.accounts.setPolicyOverrides']({
        channelId: testChannelId,
        accountId: testAccountId,
        overrides,
      });

      expect(result.ok).toBe(true);
      expect(result.account.policyOverrides).toEqual(overrides);
    });

    it('should get policy overrides for account', async () => {
      const overrides = {
        dmPolicy: 'pairing',
      };

      await channelsAccountsMethods['channels.accounts.setPolicyOverrides']({
        channelId: testChannelId,
        accountId: testAccountId,
        overrides,
      });

      const result = await channelsAccountsMethods['channels.accounts.getPolicyOverrides']({
        accountId: testAccountId,
      });

      expect(result.ok).toBe(true);
      expect(result.overrides).toEqual(overrides);
    });

    it('should return empty overrides by default', async () => {
      const result = await channelsAccountsMethods['channels.accounts.getPolicyOverrides']({
        accountId: testAccountId,
      });

      expect(result.ok).toBe(true);
      expect(result.overrides).toEqual({});
    });

    it('should update policy overrides', async () => {
      const first = {
        dmPolicy: 'open',
      };

      await channelsAccountsMethods['channels.accounts.setPolicyOverrides']({
        channelId: testChannelId,
        accountId: testAccountId,
        overrides: first,
      });

      const second = {
        dmPolicy: 'allowlist',
        allowlist: ['+1111'],
      };

      await channelsAccountsMethods['channels.accounts.setPolicyOverrides']({
        channelId: testChannelId,
        accountId: testAccountId,
        overrides: second,
      });

      const result = await channelsAccountsMethods['channels.accounts.getPolicyOverrides']({
        accountId: testAccountId,
      });

      expect(result.overrides).toEqual(second);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty channel', async () => {
      const result = await channelsAccountsMethods['channels.listAccounts']({
        channelId: 'non-existent-channel',
      });

      expect(result.ok).toBe(true);
      expect(result.accounts).toHaveLength(0);
      expect(result.primaryAccountId).toBeUndefined();
    });

    it('should preserve account metadata', async () => {
      const metadata = {
        customField: 'value',
        nestedObject: { key: 'value' },
      };

      const created = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account',
        accountIdentifier: testIdentifier,
        metadata,
      });

      expect(created.account.metadata).toEqual(metadata);
    });

    it('should prevent primary account change on creation', async () => {
      const acc1 = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account 1',
        accountIdentifier: '+111',
      });

      const acc2 = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account 2',
        accountIdentifier: '+222',
      });

      expect(acc1.account.isPrimary).toBe(true);
      expect(acc2.account.isPrimary).toBe(false);
    });

    it('should handle deleting last account', async () => {
      const created = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Only Account',
        accountIdentifier: testIdentifier,
      });

      await channelsAccountsMethods['channels.deleteAccount']({
        channelId: testChannelId,
        accountId: created.account.id,
      });

      const result = await channelsAccountsMethods['channels.listAccounts']({
        channelId: testChannelId,
      });

      expect(result.accounts).toHaveLength(0);
    });

    it('should maintain account ID immutability', async () => {
      const created = await channelsAccountsMethods['channels.createAccount']({
        channelId: testChannelId,
        name: 'Account',
        accountIdentifier: testIdentifier,
      });

      const originalId = created.account.id;

      const updated = await channelsAccountsMethods['channels.updateAccount']({
        channelId: testChannelId,
        accountId: originalId,
        updates: { id: 'different-id' as any },
      });

      expect(updated.account.id).toBe(originalId);
    });
  });
});
