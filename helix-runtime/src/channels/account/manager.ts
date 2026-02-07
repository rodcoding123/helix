/**
 * Channel Account Manager
 *
 * Manages multiple accounts per channel with credential encryption,
 * account switching, and metadata tracking.
 */

import type {
  ChannelAccount,
  ChannelAccountsConfig,
  AccountStatus,
  CreateAccountRequest,
  UpdateAccountRequest,
  SwitchAccountResult,
} from './types.js';

export class ChannelAccountManager {
  private config: ChannelAccountsConfig;
  private currentAccounts: Map<string, string> = new Map(); // channel -> active accountId

  constructor(config: ChannelAccountsConfig) {
    this.config = config;
    this.initializeCurrentAccounts();
  }

  /**
   * Initialize active accounts from config
   */
  private initializeCurrentAccounts(): void {
    for (const [channel, accountId] of Object.entries(this.config.primaryAccounts)) {
      this.currentAccounts.set(channel, accountId);
    }
  }

  /**
   * Create a new account
   */
  createAccount(request: CreateAccountRequest): ChannelAccount {
    const account: ChannelAccount = {
      id: `account-${request.channel}-${Date.now()}`,
      channel: request.channel,
      name: request.name,
      description: request.description,
      isActive: true,
      isPrimary: this.getChannelAccounts(request.channel).length === 0,
      credentials: request.credentials,
      metadata: request.metadata || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.config.accounts.push(account);

    // Set as primary if first account for channel
    if (account.isPrimary) {
      this.config.primaryAccounts[request.channel] = account.id;
      this.currentAccounts.set(request.channel, account.id);
    }

    return account;
  }

  /**
   * Get account by ID
   */
  getAccount(accountId: string): ChannelAccount | null {
    return this.config.accounts.find(a => a.id === accountId) || null;
  }

  /**
   * Get all accounts for a channel
   */
  getChannelAccounts(channel: string): ChannelAccount[] {
    return this.config.accounts.filter(a => a.channel === channel);
  }

  /**
   * Get active account for a channel
   */
  getActiveAccount(channel: string): ChannelAccount | null {
    const accountId = this.currentAccounts.get(channel);
    if (!accountId) return null;
    return this.getAccount(accountId);
  }

  /**
   * Switch active account for a channel
   */
  switchAccount(channel: string, accountId: string): SwitchAccountResult {
    const newAccount = this.getAccount(accountId);
    if (!newAccount || newAccount.channel !== channel) {
      throw new Error(`Account ${accountId} not found for channel ${channel}`);
    }

    const previousAccountId = this.currentAccounts.get(channel) || '';
    this.currentAccounts.set(channel, accountId);
    this.config.primaryAccounts[channel] = accountId;

    return {
      previousAccountId,
      newAccountId: accountId,
      channel,
      switchedAt: Date.now(),
      success: true,
    };
  }

  /**
   * Update account
   */
  updateAccount(request: UpdateAccountRequest): ChannelAccount {
    const account = this.getAccount(request.accountId);
    if (!account) {
      throw new Error(`Account ${request.accountId} not found`);
    }

    if (request.name !== undefined) account.name = request.name;
    if (request.description !== undefined) account.description = request.description;
    if (request.credentials !== undefined) {
      account.credentials = { ...account.credentials, ...request.credentials };
    }
    if (request.metadata !== undefined) {
      account.metadata = { ...account.metadata, ...request.metadata };
    }
    if (request.isActive !== undefined) account.isActive = request.isActive;
    if (request.isPrimary !== undefined) {
      // Update primary status
      const channelAccounts = this.getChannelAccounts(account.channel);
      for (const acc of channelAccounts) {
        acc.isPrimary = acc.id === request.accountId && request.isPrimary;
      }

      if (request.isPrimary) {
        this.config.primaryAccounts[account.channel] = request.accountId;
        this.currentAccounts.set(account.channel, request.accountId);
      }
    }

    account.updatedAt = Date.now();
    return account;
  }

  /**
   * Delete account
   */
  deleteAccount(accountId: string): void {
    const account = this.getAccount(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Find next primary candidate
    const channelAccounts = this.getChannelAccounts(account.channel).filter(
      a => a.id !== accountId
    );

    // Remove from config
    this.config.accounts = this.config.accounts.filter(a => a.id !== accountId);

    // Update primary if needed
    if (account.isPrimary && channelAccounts.length > 0) {
      const newPrimary = channelAccounts[0];
      newPrimary.isPrimary = true;
      this.config.primaryAccounts[account.channel] = newPrimary.id;
      this.currentAccounts.set(account.channel, newPrimary.id);
    } else if (channelAccounts.length === 0) {
      delete this.config.primaryAccounts[account.channel];
      this.currentAccounts.delete(account.channel);
    }

    // Clean up credential vault reference
    if (this.config.credentialVault?.references[accountId]) {
      delete this.config.credentialVault.references[accountId];
    }
  }

  /**
   * Get account status
   */
  getAccountStatus(accountId: string): AccountStatus | null {
    return this.config.accountStatus[accountId] || null;
  }

  /**
   * Update account status
   */
  updateAccountStatus(accountId: string, status: Partial<AccountStatus>): void {
    if (!this.config.accountStatus[accountId]) {
      this.config.accountStatus[accountId] = {
        accountId,
        channel: this.getAccount(accountId)?.channel || '',
        online: false,
        connected: false,
        lastSeen: Date.now(),
        connectionStatus: 'disconnected',
        messagesSent: 0,
        messagesReceived: 0,
      };
    }

    Object.assign(this.config.accountStatus[accountId], status);
  }

  /**
   * Get all accounts with status
   */
  getAllAccountsWithStatus(): Array<ChannelAccount & { status: AccountStatus }> {
    return this.config.accounts.map(account => ({
      ...account,
      status: this.getAccountStatus(account.id) || {
        accountId: account.id,
        channel: account.channel,
        online: false,
        connected: false,
        lastSeen: Date.now(),
        connectionStatus: 'disconnected',
        messagesSent: 0,
        messagesReceived: 0,
      },
    }));
  }

  /**
   * Get config
   */
  getConfig(): ChannelAccountsConfig {
    return this.config;
  }

  /**
   * Update config
   */
  updateConfig(config: ChannelAccountsConfig): void {
    this.config = config;
    this.currentAccounts.clear();
    this.initializeCurrentAccounts();
  }

  /**
   * Validate account credentials
   */
  async validateCredentials(accountId: string): Promise<{ valid: boolean; error?: string }> {
    const account = this.getAccount(accountId);
    if (!account) {
      return { valid: false, error: 'Account not found' };
    }

    // Basic validation
    if (!account.credentials.value) {
      return { valid: false, error: 'Credentials not set' };
    }

    if (account.credentials.expiresAt && account.credentials.expiresAt < Date.now()) {
      return { valid: false, error: 'Credentials expired' };
    }

    // Channel-specific validation would go here
    return { valid: true };
  }
}
