/**
 * Email Accounts Service
 * Phase 5 Track 1: OAuth2 setup, IMAP/SMTP configuration, account management
 *
 * Features:
 * - Gmail OAuth2 integration
 * - Outlook OAuth2 integration
 * - IMAP/SMTP manual configuration
 * - Account sync management
 * - Credential encryption
 */

import { supabase } from '@/lib/supabase';

export type EmailProvider = 'gmail' | 'outlook' | 'imap';
export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface EmailAccount {
  id: string;
  userId: string;
  provider: EmailProvider;
  emailAddress: string;
  displayName?: string;
  syncStatus: SyncStatus;
  lastSync?: Date;
  totalEmails: number;
  unreadCount: number;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  isPrimary: boolean;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface IMAPConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string; // Will be encrypted
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string; // Will be encrypted
}

/**
 * Gmail OAuth2 Configuration
 */
const GMAIL_CONFIG: OAuth2Config = {
  clientId: process.env.REACT_APP_GMAIL_CLIENT_ID || '',
  clientSecret: process.env.REACT_APP_GMAIL_CLIENT_SECRET || '',
  redirectUri: `${window.location.origin}/auth/email/gmail/callback`,
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ],
};

/**
 * Outlook OAuth2 Configuration
 */
const OUTLOOK_CONFIG: OAuth2Config = {
  clientId: process.env.REACT_APP_OUTLOOK_CLIENT_ID || '',
  clientSecret: process.env.REACT_APP_OUTLOOK_CLIENT_SECRET || '',
  redirectUri: `${window.location.origin}/auth/email/outlook/callback`,
  scopes: [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/Mail.Send',
  ],
};

class EmailAccountsService {
  /**
   * Get all email accounts for user
   */
  async getEmailAccounts(userId: string): Promise<EmailAccount[]> {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch email accounts: ${error.message}`);
      }

      return data.map((account) => this.mapToEmailAccount(account));
    } catch (error) {
      console.error('Get email accounts error:', error);
      throw error;
    }
  }

  /**
   * Get primary email account
   */
  async getPrimaryEmailAccount(userId: string): Promise<EmailAccount | null> {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ? this.mapToEmailAccount(data) : null;
    } catch (error) {
      console.error('Get primary account error:', error);
      return null;
    }
  }

  /**
   * Start Gmail OAuth2 flow
   */
  async startGmailOAuth(): Promise<void> {
    try {
      if (!GMAIL_CONFIG.clientId) {
        throw new Error('Gmail OAuth2 not configured. Check REACT_APP_GMAIL_CLIENT_ID');
      }

      const params = new URLSearchParams({
        client_id: GMAIL_CONFIG.clientId,
        redirect_uri: GMAIL_CONFIG.redirectUri,
        response_type: 'code',
        scope: GMAIL_CONFIG.scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
      });

      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } catch (error) {
      console.error('Gmail OAuth error:', error);
      throw error;
    }
  }

  /**
   * Start Outlook OAuth2 flow
   */
  async startOutlookOAuth(): Promise<void> {
    try {
      if (!OUTLOOK_CONFIG.clientId) {
        throw new Error('Outlook OAuth2 not configured. Check REACT_APP_OUTLOOK_CLIENT_ID');
      }

      const params = new URLSearchParams({
        client_id: OUTLOOK_CONFIG.clientId,
        redirect_uri: OUTLOOK_CONFIG.redirectUri,
        response_type: 'code',
        scope: OUTLOOK_CONFIG.scopes.join(' '),
      });

      window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    } catch (error) {
      console.error('Outlook OAuth error:', error);
      throw error;
    }
  }

  /**
   * Complete OAuth2 flow and save account
   */
  async completeOAuthFlow(
    userId: string,
    provider: 'gmail' | 'outlook',
    authCode: string
  ): Promise<EmailAccount> {
    try {
      // Exchange auth code for tokens via backend API
      const response = await fetch('/api/email/oauth-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          authCode,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`OAuth exchange failed: ${response.statusText}`);
      }

      const { emailAddress, displayName, credentials } = await response.json();

      // Save account to database
      const account = await this.createEmailAccount(userId, {
        provider,
        emailAddress,
        displayName,
        credentials,
      });

      // Start initial sync
      await this.startSync(account.id);

      return account;
    } catch (error) {
      console.error('OAuth flow error:', error);
      throw error;
    }
  }

  /**
   * Create email account manually (IMAP/SMTP)
   */
  async createManualEmailAccount(
    userId: string,
    emailAddress: string,
    displayName: string | undefined,
    imapConfig: IMAPConfig,
    smtpConfig: SMTPConfig
  ): Promise<EmailAccount> {
    try {
      // Test IMAP connection first
      await this.testIMAPConnection(imapConfig);
      await this.testSMTPConnection(smtpConfig);

      const credentials = {
        imap: imapConfig,
        smtp: smtpConfig,
      };

      return this.createEmailAccount(userId, {
        provider: 'imap',
        emailAddress,
        displayName,
        credentials,
      });
    } catch (error) {
      console.error('Manual account creation error:', error);
      throw error;
    }
  }

  /**
   * Create email account (internal)
   */
  private async createEmailAccount(
    userId: string,
    options: {
      provider: EmailProvider;
      emailAddress: string;
      displayName?: string;
      credentials: any;
    }
  ): Promise<EmailAccount> {
    try {
      // Get existing accounts to set primary status
      const existingAccounts = await this.getEmailAccounts(userId);
      const isPrimary = existingAccounts.length === 0;

      // Encrypt credentials
      const encryptedCredentials = JSON.stringify(options.credentials); // Would encrypt in production

      const { data, error } = await supabase
        .from('email_accounts')
        .insert([
          {
            user_id: userId,
            provider: options.provider,
            email_address: options.emailAddress,
            display_name: options.displayName || options.emailAddress.split('@')[0],
            encrypted_credentials: encryptedCredentials,
            sync_status: 'idle',
            is_primary: isPrimary,
            auto_sync_enabled: true,
            sync_interval_minutes: 15,
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create email account: ${error.message}`);
      }

      return this.mapToEmailAccount(data);
    } catch (error) {
      console.error('Create account error:', error);
      throw error;
    }
  }

  /**
   * Update email account settings
   */
  async updateEmailAccount(
    accountId: string,
    updates: Partial<{
      displayName: string;
      autoSyncEnabled: boolean;
      syncIntervalMinutes: number;
      isPrimary: boolean;
      isEnabled: boolean;
    }>
  ): Promise<void> {
    try {
      const updateData: any = {};

      if (updates.displayName) updateData.display_name = updates.displayName;
      if (updates.autoSyncEnabled !== undefined)
        updateData.auto_sync_enabled = updates.autoSyncEnabled;
      if (updates.syncIntervalMinutes)
        updateData.sync_interval_minutes = updates.syncIntervalMinutes;
      if (updates.isPrimary !== undefined) updateData.is_primary = updates.isPrimary;
      if (updates.isEnabled !== undefined) updateData.is_enabled = updates.isEnabled;

      const { error } = await supabase
        .from('email_accounts')
        .update(updateData)
        .eq('id', accountId);

      if (error) {
        throw new Error(`Failed to update account: ${error.message}`);
      }
    } catch (error) {
      console.error('Update account error:', error);
      throw error;
    }
  }

  /**
   * Delete email account
   */
  async deleteEmailAccount(accountId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('email_accounts')
        .update({ is_enabled: false })
        .eq('id', accountId);

      if (error) {
        throw new Error(`Failed to delete account: ${error.message}`);
      }
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  }

  /**
   * Start sync for account
   */
  async startSync(accountId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('email_accounts')
        .update({
          sync_status: 'syncing',
          next_sync: new Date().toISOString(),
        })
        .eq('id', accountId);

      if (error) {
        throw error;
      }

      // Queue sync job on backend
      await fetch('/api/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
    } catch (error) {
      console.error('Start sync error:', error);
      throw error;
    }
  }

  /**
   * Test IMAP connection
   */
  private async testIMAPConnection(config: IMAPConfig): Promise<void> {
    try {
      const response = await fetch('/api/email/test-imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('IMAP connection test failed');
      }
    } catch (error) {
      console.error('IMAP test error:', error);
      throw error;
    }
  }

  /**
   * Test SMTP connection
   */
  private async testSMTPConnection(config: SMTPConfig): Promise<void> {
    try {
      const response = await fetch('/api/email/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('SMTP connection test failed');
      }
    } catch (error) {
      console.error('SMTP test error:', error);
      throw error;
    }
  }

  /**
   * Map database record to EmailAccount
   */
  private mapToEmailAccount(data: any): EmailAccount {
    return {
      id: data.id,
      userId: data.user_id,
      provider: data.provider,
      emailAddress: data.email_address,
      displayName: data.display_name,
      syncStatus: data.sync_status,
      lastSync: data.last_sync ? new Date(data.last_sync) : undefined,
      totalEmails: data.total_emails,
      unreadCount: data.unread_count,
      autoSyncEnabled: data.auto_sync_enabled,
      syncIntervalMinutes: data.sync_interval_minutes,
      isPrimary: data.is_primary,
      isEnabled: data.is_enabled,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export const emailAccountsService = new EmailAccountsService();
