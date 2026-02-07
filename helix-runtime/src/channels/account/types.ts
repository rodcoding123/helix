/**
 * Channel Account Management Types
 *
 * Support for multiple accounts per channel (e.g., WhatsApp personal + business).
 * Credential storage, account switching, and metadata tracking.
 */

export interface ChannelAccount {
  id: string; // account-{channel}-{index}
  channel: string; // whatsapp, telegram, discord, etc.
  name: string; // 'Personal', 'Business', 'Bot 1', etc.
  description?: string;
  isActive: boolean;
  isPrimary: boolean; // Fallback account for this channel
  credentials: ChannelCredentials;
  metadata: AccountMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface ChannelCredentials {
  type: 'token' | 'oauth' | 'password' | 'webhook' | 'api_key' | 'phone';
  // Encrypted in storage
  value?: string;
  expiresAt?: number;
  scopes?: string[];
  refreshToken?: string;
}

export interface AccountMetadata {
  displayName?: string; // WhatsApp: business name
  phoneNumber?: string; // WhatsApp: phone, Telegram: phone
  botUsername?: string; // Telegram: @botname, Discord: bot tag
  serverIds?: string[]; // Discord: guild IDs
  workspaceId?: string; // Slack: workspace ID
  // Channel-specific fields
  [key: string]: unknown;
}

export interface AccountStatus {
  accountId: string;
  channel: string;
  online: boolean;
  connected: boolean;
  lastSeen: number;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  connectionError?: string;
  messagesSent: number;
  messagesReceived: number;
}

export interface ChannelAccountsConfig {
  version: string;
  accounts: ChannelAccount[];
  primaryAccounts: Record<string, string>; // channel -> accountId
  accountStatus: Record<string, AccountStatus>;
  credentialVault?: {
    // 1Password or secure storage reference
    provider: '1password' | 'vault' | 'keyring';
    references: Record<string, string>; // accountId -> vault reference
  };
}

/**
 * Account creation request
 */
export interface CreateAccountRequest {
  channel: string;
  name: string;
  description?: string;
  credentials: ChannelCredentials;
  metadata?: AccountMetadata;
}

/**
 * Account update request
 */
export interface UpdateAccountRequest {
  accountId: string;
  name?: string;
  description?: string;
  credentials?: Partial<ChannelCredentials>;
  metadata?: Partial<AccountMetadata>;
  isActive?: boolean;
  isPrimary?: boolean;
}

/**
 * Account switching result
 */
export interface SwitchAccountResult {
  previousAccountId: string;
  newAccountId: string;
  channel: string;
  switchedAt: number;
  success: boolean;
}
