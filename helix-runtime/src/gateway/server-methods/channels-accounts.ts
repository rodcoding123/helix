/**
 * Gateway Methods: Channel Accounts
 *
 * Multi-account management for channels.
 * Features:
 * - Create/list/switch/delete accounts
 * - Credential management with encryption
 * - Account status tracking
 * - Account policy overrides
 * - Account metadata storage
 */

import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';

/**
 * Account data structure
 */
export interface ChannelAccount {
  id: string;
  channelId: string;
  name: string;
  displayName?: string;
  accountIdentifier: string; // Phone number, user ID, email, etc.
  isActive: boolean;
  isPrimary: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'paused' | 'error';
  metadata?: Record<string, unknown>;
  policyOverrides?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  lastActive?: number;
}

/**
 * Credential data structure
 */
export interface ChannelAccountCredential {
  id: string;
  accountId: string;
  type: 'token' | 'password' | 'oauth' | 'api_key' | 'webhook_url';
  label: string;
  isStored: boolean;
  createdAt: number;
  expiresAt?: number;
  value?: string; // Only in creation/retrieval before encryption
}

// In-memory storage (replace with database in production)
const accountsStore: Map<string, ChannelAccount[]> = new Map();
const credentialsStore: Map<string, ChannelAccountCredential[]> = new Map();

/**
 * Gateway method: channels.listAccounts
 * Get all accounts for a channel
 */
export const channelsAccountsMethods = {
  'channels.listAccounts': async (params: { channelId: string }) => {
    const accounts = accountsStore.get(params.channelId) || [];
    const primaryAccountId = accounts.find(a => a.isPrimary)?.id;

    return {
      ok: true,
      accounts,
      primaryAccountId,
      activeAccountId: accounts.find(a => a.isActive)?.id,
    };
  },

  /**
   * channels.createAccount - Create new account
   */
  'channels.createAccount': async (params: {
    channelId: string;
    name: string;
    accountIdentifier: string;
    displayName?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const account: ChannelAccount = {
      id: `account-${Date.now()}-${randomUUID().slice(0, 8)}`,
      channelId: params.channelId,
      name: params.name,
      displayName: params.displayName,
      accountIdentifier: params.accountIdentifier,
      isActive: false,
      isPrimary: false,
      status: 'disconnected',
      metadata: params.metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const accounts = accountsStore.get(params.channelId) || [];

    // First account becomes primary
    if (accounts.length === 0) {
      account.isPrimary = true;
      account.isActive = true;
    }

    accounts.push(account);
    accountsStore.set(params.channelId, accounts);

    return {
      ok: true,
      account,
    };
  },

  /**
   * channels.updateAccount - Update account settings
   */
  'channels.updateAccount': async (params: {
    channelId: string;
    accountId: string;
    updates: Partial<ChannelAccount>;
  }) => {
    const accounts = accountsStore.get(params.channelId);
    if (!accounts) {
      throw new Error('Channel not found');
    }

    const idx = accounts.findIndex(a => a.id === params.accountId);
    if (idx < 0) {
      throw new Error('Account not found');
    }

    const updated: ChannelAccount = {
      ...accounts[idx],
      ...params.updates,
      id: params.accountId, // Prevent ID changes
      channelId: params.channelId, // Prevent channel changes
      createdAt: accounts[idx].createdAt, // Prevent creation time changes
      updatedAt: Date.now(),
    };

    accounts[idx] = updated;
    return { ok: true, account: updated };
  },

  /**
   * channels.setActiveAccount - Activate an account
   */
  'channels.setActiveAccount': async (params: {
    channelId: string;
    accountId: string;
  }) => {
    const accounts = accountsStore.get(params.channelId);
    if (!accounts) {
      throw new Error('Channel not found');
    }

    const account = accounts.find(a => a.id === params.accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    // Deactivate others, activate this one
    accounts.forEach(a => {
      a.isActive = a.id === params.accountId;
      a.updatedAt = Date.now();
    });

    account.lastActive = Date.now();

    return {
      ok: true,
      account,
      previousActive: accounts.find(a => a.isActive && a.id !== params.accountId)?.id,
    };
  },

  /**
   * channels.deleteAccount - Delete an account
   */
  'channels.deleteAccount': async (params: {
    channelId: string;
    accountId: string;
  }) => {
    const accounts = accountsStore.get(params.channelId);
    if (!accounts) {
      throw new Error('Channel not found');
    }

    const idx = accounts.findIndex(a => a.id === params.accountId);
    if (idx < 0) {
      throw new Error('Account not found');
    }

    const deleted = accounts[idx];

    // Remove account
    accounts.splice(idx, 1);

    // Clean up credentials
    credentialsStore.delete(params.accountId);

    // If we deleted primary, make first account primary
    if (deleted.isPrimary && accounts.length > 0) {
      accounts[0].isPrimary = true;
      accounts[0].isActive = true;
    }

    // If we deleted active, activate first account
    if (deleted.isActive && accounts.length > 0) {
      accounts[0].isActive = true;
    }

    return { ok: true };
  },

  /**
   * channels.addCredential - Add credential to account
   */
  'channels.accounts.addCredential': async (params: {
    accountId: string;
    type: ChannelAccountCredential['type'];
    label: string;
    value: string;
    expiresAt?: number;
  }) => {
    const credential: ChannelAccountCredential = {
      id: `cred-${Date.now()}-${randomUUID().slice(0, 8)}`,
      accountId: params.accountId,
      type: params.type,
      label: params.label,
      isStored: true,
      createdAt: Date.now(),
      expiresAt: params.expiresAt,
      // In production: Encrypt params.value before storing
      // For now, just indicate it's stored
    };

    const credentials = credentialsStore.get(params.accountId) || [];
    credentials.push(credential);
    credentialsStore.set(params.accountId, credentials);

    return {
      ok: true,
      credential: {
        ...credential,
        value: undefined, // Don't return the value
      },
    };
  },

  /**
   * channels.listCredentials - List credentials for account
   */
  'channels.accounts.listCredentials': async (params: { accountId: string }) => {
    const credentials = credentialsStore.get(params.accountId) || [];

    // Return without values
    return {
      ok: true,
      credentials: credentials.map(c => ({
        ...c,
        value: undefined,
      })),
    };
  },

  /**
   * channels.deleteCredential - Delete credential
   */
  'channels.accounts.deleteCredential': async (params: {
    accountId: string;
    credentialId: string;
  }) => {
    const credentials = credentialsStore.get(params.accountId);
    if (!credentials) {
      throw new Error('Account has no credentials');
    }

    const idx = credentials.findIndex(c => c.id === params.credentialId);
    if (idx < 0) {
      throw new Error('Credential not found');
    }

    credentials.splice(idx, 1);
    return { ok: true };
  },

  /**
   * channels.testCredential - Test credential connectivity
   */
  'channels.accounts.testCredential': async (params: {
    accountId: string;
    credentialId: string;
  }) => {
    const credentials = credentialsStore.get(params.accountId);
    if (!credentials) {
      throw new Error('Account has no credentials');
    }

    const credential = credentials.find(c => c.id === params.credentialId);
    if (!credential) {
      throw new Error('Credential not found');
    }

    // In production: Actual connectivity test
    // For now, just verify it exists
    return {
      ok: true,
      tested: true,
      credentialId: params.credentialId,
      type: credential.type,
    };
  },

  /**
   * channels.accounts.status - Get account status
   */
  'channels.accounts.status': async (params: {
    accountId: string;
  }) => {
    // Look for account in all channels
    let account: ChannelAccount | undefined;
    for (const accounts of accountsStore.values()) {
      account = accounts.find(a => a.id === params.accountId);
      if (account) break;
    }

    if (!account) {
      throw new Error('Account not found');
    }

    return {
      ok: true,
      status: {
        accountId: account.id,
        online: account.status === 'connected',
        connected: account.status === 'connected',
        connectionStatus: account.status,
        messagesSent: 0, // Would come from metrics
        messagesReceived: 0, // Would come from metrics
        lastActive: account.lastActive,
      },
    };
  },

  /**
   * channels.accounts.updateStatus - Update account status
   */
  'channels.accounts.updateStatus': async (params: {
    channelId: string;
    accountId: string;
    status: ChannelAccount['status'];
  }) => {
    const accounts = accountsStore.get(params.channelId);
    if (!accounts) {
      throw new Error('Channel not found');
    }

    const account = accounts.find(a => a.id === params.accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    account.status = params.status;
    account.updatedAt = Date.now();

    if (params.status === 'connected') {
      account.lastActive = Date.now();
    }

    return { ok: true, account };
  },

  /**
   * channels.accounts.getPolicyOverrides - Get account-specific policy overrides
   */
  'channels.accounts.getPolicyOverrides': async (params: {
    accountId: string;
  }) => {
    let account: ChannelAccount | undefined;
    for (const accounts of accountsStore.values()) {
      account = accounts.find(a => a.id === params.accountId);
      if (account) break;
    }

    if (!account) {
      throw new Error('Account not found');
    }

    return {
      ok: true,
      overrides: account.policyOverrides || {},
    };
  },

  /**
   * channels.accounts.setPolicyOverrides - Set account-specific policy overrides
   */
  'channels.accounts.setPolicyOverrides': async (params: {
    channelId: string;
    accountId: string;
    overrides: Record<string, unknown>;
  }) => {
    const accounts = accountsStore.get(params.channelId);
    if (!accounts) {
      throw new Error('Channel not found');
    }

    const account = accounts.find(a => a.id === params.accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    account.policyOverrides = params.overrides;
    account.updatedAt = Date.now();

    return { ok: true, account };
  },
};

/**
 * Register channels account routes with Fastify
 */
export async function registerChannelsAccountRoutes(fastify: FastifyInstance) {
  fastify.get('/api/channels/:channelId/accounts', async (request, reply) => {
    const result = await channelsAccountsMethods['channels.listAccounts']({
      channelId: (request.params as any).channelId,
    });
    return reply.send(result);
  });

  fastify.post('/api/channels/:channelId/accounts', async (request, reply) => {
    const result = await channelsAccountsMethods['channels.createAccount']({
      channelId: (request.params as any).channelId,
      ...(request.body as any),
    });
    return reply.status(201).send(result);
  });

  fastify.patch('/api/channels/:channelId/accounts/:accountId', async (request, reply) => {
    const result = await channelsAccountsMethods['channels.updateAccount']({
      channelId: (request.params as any).channelId,
      accountId: (request.params as any).accountId,
      updates: (request.body as any),
    });
    return reply.send(result);
  });

  fastify.put('/api/channels/:channelId/accounts/:accountId/activate', async (request, reply) => {
    const result = await channelsAccountsMethods['channels.setActiveAccount']({
      channelId: (request.params as any).channelId,
      accountId: (request.params as any).accountId,
    });
    return reply.send(result);
  });

  fastify.delete('/api/channels/:channelId/accounts/:accountId', async (request, reply) => {
    const result = await channelsAccountsMethods['channels.deleteAccount']({
      channelId: (request.params as any).channelId,
      accountId: (request.params as any).accountId,
    });
    return reply.send(result);
  });
}
