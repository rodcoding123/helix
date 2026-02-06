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
