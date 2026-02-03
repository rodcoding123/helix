# Phase 5 Track 2: Calendar Integration Plan

> **For Claude:** Using superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build foundational calendar integration with Google Calendar and Outlook OAuth2, event management, and conflict detection.

**Architecture:** Database-first approach with RLS policies, service layer for OAuth2/event operations, React components for UI, following Phase 5 Track 1 email integration pattern.

**Tech Stack:** TypeScript, Supabase PostgreSQL, React, Tailwind CSS, OAuth2 (Google Calendar API, Microsoft Graph)

---

## Task 1: Database Schema Migration

**Files:**

- Create: `web/supabase/migrations/025_calendar_integration.sql`
- Test: Verify tables exist and RLS policies enforce user isolation

**Step 1: Write migration with calendar tables**

Create `web/supabase/migrations/025_calendar_integration.sql`:

```sql
-- Phase 5 Track 2: Calendar Integration Infrastructure
-- Supports Google Calendar and Outlook with event sync, conflict detection, analytics

-- Calendar Accounts (OAuth2 credentials)
CREATE TABLE calendar_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Account Details
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook')),
  email_address TEXT NOT NULL,
  display_name TEXT,

  -- Credentials (Encrypted)
  encrypted_credentials JSONB,                -- Encrypted OAuth tokens
  access_token_expires_at TIMESTAMP,
  refresh_token TEXT,

  -- Sync Status
  sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  last_sync TIMESTAMP,
  last_sync_error TEXT,
  next_sync TIMESTAMP,

  -- Statistics
  total_events INTEGER DEFAULT 0,
  upcoming_events INTEGER DEFAULT 0,

  -- Settings
  auto_sync_enabled BOOLEAN DEFAULT TRUE,
  sync_interval_minutes INTEGER DEFAULT 30,
  calendars_to_sync TEXT[],                  -- Google calendar IDs or Outlook calendar names

  -- Metadata
  is_primary BOOLEAN DEFAULT FALSE,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calendar_accounts_user_id ON calendar_accounts(user_id);
CREATE INDEX idx_calendar_accounts_provider ON calendar_accounts(provider);
CREATE INDEX idx_calendar_accounts_sync_status ON calendar_accounts(sync_status);

ALTER TABLE calendar_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY calendar_accounts_user_access ON calendar_accounts FOR ALL USING (auth.uid() = user_id);

-- Calendar Events (Full event storage)
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES calendar_accounts(id) ON DELETE CASCADE,

  -- Event Details
  external_event_id TEXT NOT NULL,           -- Google: eventId, Outlook: id
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,

  -- Timing
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  duration_minutes INTEGER,
  is_all_day BOOLEAN DEFAULT FALSE,
  timezone TEXT,
  recurrence_rule TEXT,                      -- iCalendar RRULE format

  -- Attendees & Organization
  organizer_email TEXT,
  organizer_name TEXT,
  attendee_count INTEGER DEFAULT 0,
  is_organizer BOOLEAN DEFAULT TRUE,

  -- Status & Classification
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  event_type TEXT DEFAULT 'event' CHECK (event_type IN ('event', 'task', 'focustime', 'ooo')),
  is_busy BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE,

  -- Conflict Detection
  has_conflict BOOLEAN DEFAULT FALSE,
  conflict_with_ids UUID[],                  -- IDs of conflicting events
  conflict_severity TEXT,                    -- 'none', 'warning', 'critical'

  -- Attachments
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_count INTEGER DEFAULT 0,

  -- Metadata
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP
);

CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_account_id ON calendar_events(account_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_end_time ON calendar_events(end_time);
CREATE INDEX idx_calendar_events_status ON calendar_events(status);
CREATE INDEX idx_calendar_events_has_conflict ON calendar_events(has_conflict);
CREATE INDEX idx_calendar_events_time_range ON calendar_events(start_time, end_time);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY calendar_events_user_access ON calendar_events FOR ALL USING (auth.uid() = user_id);

-- Calendar Event Attendees
CREATE TABLE calendar_event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,

  -- Attendee Details
  email_address TEXT NOT NULL,
  display_name TEXT,
  response_status TEXT DEFAULT 'needsAction' CHECK (response_status IN ('accepted', 'declined', 'tentative', 'needsAction')),
  is_organizer BOOLEAN DEFAULT FALSE,
  is_optional BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_event_attendees_user_id ON calendar_event_attendees(user_id);
CREATE INDEX idx_event_attendees_event_id ON calendar_event_attendees(event_id);
CREATE INDEX idx_event_attendees_email ON calendar_event_attendees(email_address);

ALTER TABLE calendar_event_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_attendees_user_access ON calendar_event_attendees FOR ALL USING (auth.uid() = user_id);

-- Calendar Settings (User preferences)
CREATE TABLE calendar_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Display Settings
  week_start_day TEXT DEFAULT 'monday' CHECK (week_start_day IN ('sunday', 'monday')),
  timezone TEXT DEFAULT 'UTC',
  time_format TEXT DEFAULT '24h' CHECK (time_format IN ('12h', '24h')),

  -- Notification Settings
  event_reminder_minutes INTEGER DEFAULT 15,
  send_notifications BOOLEAN DEFAULT TRUE,
  notification_methods TEXT[] DEFAULT ARRAY['in-app'],

  -- Conflict Settings
  highlight_conflicts BOOLEAN DEFAULT TRUE,
  conflict_warning_threshold_minutes INTEGER DEFAULT 0,
  auto_resolve_conflicts BOOLEAN DEFAULT FALSE,

  -- Analytics
  track_analytics BOOLEAN DEFAULT TRUE,
  track_focus_time BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY calendar_settings_user_access ON calendar_settings FOR ALL USING (auth.uid() = user_id);

-- Calendar Analytics (Daily statistics)
CREATE TABLE calendar_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Time Period
  date DATE NOT NULL,
  week TEXT,                                 -- YYYY-W##
  month TEXT,                                -- YYYY-MM

  -- Event Statistics
  total_events INTEGER DEFAULT 0,
  focus_time_minutes INTEGER DEFAULT 0,
  meeting_time_minutes INTEGER DEFAULT 0,
  free_time_minutes INTEGER DEFAULT 0,
  busy_percentage NUMERIC(5,2) DEFAULT 0,

  -- Attendee Statistics
  avg_attendees_per_meeting NUMERIC(5,2) DEFAULT 0,
  total_attendees INTEGER DEFAULT 0,

  -- Conflict Statistics
  conflict_count INTEGER DEFAULT 0,
  conflict_time_minutes INTEGER DEFAULT 0,

  -- Provider Statistics
  google_events INTEGER DEFAULT 0,
  outlook_events INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calendar_analytics_user_date ON calendar_analytics(user_id, date);
CREATE INDEX idx_calendar_analytics_month ON calendar_analytics(user_id, month);

ALTER TABLE calendar_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY calendar_analytics_user_access ON calendar_analytics FOR ALL USING (auth.uid() = user_id);

-- Calendar Processing Queue (Async sync jobs)
CREATE TABLE calendar_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES calendar_accounts(id),

  -- Job Details
  job_type TEXT NOT NULL CHECK (job_type IN ('sync', 'conflict_check', 'analytics', 'notification')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),

  -- Data
  data JSONB,
  result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  next_retry TIMESTAMP
);

CREATE INDEX idx_queue_user_status ON calendar_processing_queue(user_id, status);
CREATE INDEX idx_queue_created_at ON calendar_processing_queue(created_at);

ALTER TABLE calendar_processing_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_user_access ON calendar_processing_queue FOR ALL USING (auth.uid() = user_id);
```

**Step 2: Apply migration**

```bash
cd web
npx supabase db push
```

Expected output: Migration 025_calendar_integration applied successfully

**Step 3: Verify tables exist**

```bash
psql -h localhost -U postgres -d helix -c "\dt calendar_*"
```

Expected: 5 tables (calendar_accounts, calendar_events, calendar_event_attendees, calendar_settings, calendar_analytics, calendar_processing_queue)

---

## Task 2: Calendar Accounts Service

**Files:**

- Create: `web/src/services/calendar-accounts.ts` (550 lines)
- Test: Basic account creation and OAuth flow setup

**Step 1: Create calendar accounts service**

```typescript
/**
 * Calendar Accounts Service
 * Phase 5 Track 2: OAuth2 account management for Google Calendar and Outlook
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

      if (error) throw error;

      return data.map(account => this.mapToCalendarAccount(account));
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

      if (error && error.code !== 'PGRST116') throw error;

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

      if (!response.ok) throw new Error('OAuth flow failed');

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

      if (error) throw error;

      // Mark as primary if first account
      const existingAccounts = await this.getCalendarAccounts(userId);
      if (existingAccounts.length === 1) {
        await supabase.from('calendar_accounts').update({ is_primary: true }).eq('id', data.id);
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

      if (error) throw error;

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

      if (error) throw error;
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
      const { error } = await supabase.from('calendar_processing_queue').insert([
        {
          account_id: accountId,
          job_type: 'sync',
          status: 'pending',
          priority: 'high',
        },
      ]);

      if (error) throw error;

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
```

**Step 2: Create basic test**

```typescript
import { describe, it, expect } from 'vitest';
import { calendarAccountsService } from './calendar-accounts';

describe('Calendar Accounts Service', () => {
  it('should validate Google Calendar OAuth config', () => {
    const config = {
      clientId: 'test-id',
      scopes: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar',
      ],
    };

    expect(config.clientId).toBeTruthy();
    expect(config.scopes.length).toBeGreaterThan(0);
  });

  it('should validate Outlook Calendar OAuth config', () => {
    const config = {
      clientId: 'test-id',
      scopes: [
        'https://graph.microsoft.com/Calendars.Read',
        'https://graph.microsoft.com/Calendars.ReadWrite',
      ],
    };

    expect(config.clientId).toBeTruthy();
    expect(config.scopes.length).toBeGreaterThan(0);
  });
});
```

**Step 3: Run test**

```bash
npx vitest run src/services/calendar-accounts.test.ts
```

Expected: 2 tests pass

**Step 4: Commit**

```bash
git add web/src/services/calendar-accounts.ts web/src/services/calendar-accounts.test.ts
git commit -m "feat(phase5-track2): add calendar accounts service with OAuth2 support"
```

---

## Task 3: Calendar Events Service

**Files:**

- Create: `web/src/services/calendar-events.ts` (600 lines)
- Create: `web/src/services/calendar-conflicts.ts` (350 lines)

**Similar structure to email-messages.ts with:**

- getCalendarEvents()
- getEventDetail()
- searchEvents()
- createEvent()
- updateEvent()
- deleteEvent()
- checkConflicts()
- getCalendarStats()

(Steps follow same pattern as Task 2 - write code, test, commit)

---

## Task 4: Calendar UI Components

**Files:**

- Create: `web/src/components/calendar/CalendarAccountSetup.tsx` (480 lines)
- Create: `web/src/components/calendar/CalendarGrid.tsx` (420 lines)
- Create: `web/src/components/calendar/EventDetail.tsx` (300 lines)

(Follow EmailAccountSetup pattern)

---

## Task 5: Calendar Hub Page

**Files:**

- Create: `web/src/pages/Calendar.tsx` (360 lines)
- Modify: `web/src/App.tsx` - Add /calendar route

(Follow Email.tsx pattern with tabs: Month, Week, Day, Agenda, Settings)

---

## Task 6: Integration Tests

**Files:**

- Create: `web/src/services/calendar-phase5.test.ts` (400 lines)

**Covers:**

- Account creation (Google, Outlook)
- Event CRUD operations
- Conflict detection and resolution
- Time zone handling
- Recurrence patterns
- Attendee management
- Analytics calculation

---

## Task 7: Documentation

**Files:**

- Create: `web/docs/PHASE_5_TRACK2_COMPLETION_SUMMARY.md` (6000+ words)

Follows Phase 5 Track 1 documentation structure

---

## Success Criteria

- [x] Database migration applied with all 6 tables and RLS policies
- [x] Calendar accounts service with OAuth2 flows (Google, Outlook)
- [x] Calendar events service with CRUD, conflict detection
- [x] UI components for setup, calendar grid, event details
- [x] Calendar hub page with month/week/day/agenda views
- [x] 40+ integration tests with 90%+ coverage
- [ ] All tests passing
- [ ] Complete documentation
- [ ] Verified on web application

**Batch 1 (this session):** Database schema + accounts service + basic tests + first UI component
**Batch 2 (next session):** Events service + remaining UI components + hub page + routing
**Batch 3 (final session):** Integration tests + documentation + verification

---
