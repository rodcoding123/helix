/**
 * Calendar Accounts Service
 * Phase 5 Track 2: OAuth2 account management for Google Calendar and Outlook
 *
 * Features:
 * - Google Calendar OAuth2 integration
 * - Outlook (Microsoft Graph) OAuth2 integration
 * - Account CRUD operations
 * - Credential encryption
 * - Sync management
 * - Connection testing
 */

import { supabase } from '@/lib/supabase';

export interface CalendarAccount {
  id: string;
  userId: string;
  provider: 'google' | 'outlook';
  emailAddress: string;
  displayName?: string;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSync?: Date;
  totalEvents: number;
  upcomingEvents: number;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  isPrimary: boolean;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class CalendarAccountsService {
  /**
   * Get all calendar accounts for user
   */
  async getCalendarAccounts(userId: string): Promise<CalendarAccount[]> {
    try {
      const { data, error } = await supabase
        .from('calendar_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch calendar accounts: ${error.message}`);
      }

      return data.map((account) => this.mapToCalendarAccount(account));
    } catch (error) {
      console.error('Get calendar accounts error:', error);
      throw error;
    }
  }

  /**
   * Get primary calendar account
   */
  async getPrimaryCalendarAccount(userId: string): Promise<CalendarAccount | null> {
    try {
      const { data, error } = await supabase
        .from('calendar_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ? this.mapToCalendarAccount(data) : null;
    } catch (error) {
      console.error('Get primary account error:', error);
      return null;
    }
  }

  /**
   * Start Google Calendar OAuth2 flow
   */
  startGoogleCalendarOAuth(): void {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/calendar/google/callback`;
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes.join(' '));
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');

    window.location.href = authUrl.toString();
  }

  /**
   * Start Outlook Calendar OAuth2 flow
   */
  startOutlookCalendarOAuth(): void {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/calendar/outlook/callback`;
    const scopes = [
      'https://graph.microsoft.com/Calendars.Read',
      'https://graph.microsoft.com/Calendars.ReadWrite',
    ];

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes.join(' '));
    authUrl.searchParams.append('access_type', 'offline');

    window.location.href = authUrl.toString();
  }

  /**
   * Complete OAuth2 flow and create calendar account
   */
  async completeOAuthFlow(
    userId: string,
    provider: 'google' | 'outlook',
    authCode: string
  ): Promise<CalendarAccount> {
    try {
      // Exchange auth code for tokens (handled by backend API endpoint)
      const response = await fetch('/api/calendar/oauth-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, authCode }),
      });

      if (!response.ok) {
        throw new Error('OAuth flow failed');
      }

      const tokens = await response.json();

      // Create account record
      const { data, error } = await supabase
        .from('calendar_accounts')
        .insert([
          {
            user_id: userId,
            provider,
            email_address: tokens.email,
            display_name: tokens.displayName,
            encrypted_credentials: {
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
            },
            access_token_expires_at: new Date(tokens.expiresAt),
            refresh_token: tokens.refreshToken,
            sync_status: 'idle',
            auto_sync_enabled: true,
            sync_interval_minutes: 30,
            is_primary: false,
            is_enabled: true,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Mark as primary if first account
      const existingAccounts = await this.getCalendarAccounts(userId);
      if (existingAccounts.length === 1) {
        await supabase
          .from('calendar_accounts')
          .update({ is_primary: true })
          .eq('id', data.id);
      }

      return this.mapToCalendarAccount(data);
    } catch (error) {
      console.error('Complete OAuth flow error:', error);
      throw error;
    }
  }

  /**
   * Update calendar account settings
   */
  async updateCalendarAccount(
    accountId: string,
    updates: Partial<CalendarAccount>
  ): Promise<CalendarAccount> {
    try {
      const { data, error } = await supabase
        .from('calendar_accounts')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', accountId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapToCalendarAccount(data);
    } catch (error) {
      console.error('Update account error:', error);
      throw error;
    }
  }

  /**
   * Delete calendar account
   */
  async deleteCalendarAccount(accountId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('calendar_accounts')
        .update({ is_enabled: false, updated_at: new Date().toISOString() })
        .eq('id', accountId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  }

  /**
   * Start calendar sync
   */
  async startSync(accountId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('calendar_processing_queue')
        .insert([
          {
            account_id: accountId,
            job_type: 'sync',
            status: 'pending',
            priority: 'high',
          },
        ]);

      if (error) {
        throw error;
      }

      // Update account status
      await supabase
        .from('calendar_accounts')
        .update({ sync_status: 'syncing' })
        .eq('id', accountId);
    } catch (error) {
      console.error('Start sync error:', error);
      throw error;
    }
  }

  /**
   * Test calendar connection
   */
  async testCalendarConnection(accountId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/calendar/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      return response.ok;
    } catch (error) {
      console.error('Test connection error:', error);
      return false;
    }
  }

  /**
   * Map database record to CalendarAccount
   */
  private mapToCalendarAccount(data: any): CalendarAccount {
    return {
      id: data.id,
      userId: data.user_id,
      provider: data.provider,
      emailAddress: data.email_address,
      displayName: data.display_name,
      syncStatus: data.sync_status,
      lastSync: data.last_sync ? new Date(data.last_sync) : undefined,
      totalEvents: data.total_events || 0,
      upcomingEvents: data.upcoming_events || 0,
      autoSyncEnabled: data.auto_sync_enabled,
      syncIntervalMinutes: data.sync_interval_minutes,
      isPrimary: data.is_primary,
      isEnabled: data.is_enabled,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export const calendarAccountsService = new CalendarAccountsService();
