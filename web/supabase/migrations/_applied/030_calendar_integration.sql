-- Week 4 Track 4: Calendar Foundation - Database Schema
-- Date: February 3, 2026
-- Task 4.1: Calendar Database Schema with event sync and recurring rules

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES email_accounts(id), -- Sync source (Google Calendar, iCal, etc.)

  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  location TEXT,

  attendees JSONB, -- [{ email, name, status: 'accepted'|'pending'|'declined' }]
  recurrence_rule TEXT, -- RFC 5545 RRULE format
  event_id TEXT, -- Provider's event ID (for sync)

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(account_id, event_id)
);

-- Create calendar_attendees table for detailed attendee tracking
CREATE TABLE IF NOT EXISTS calendar_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT, -- 'accepted', 'pending', 'declined'
  response_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create calendar_sync_log table for tracking sync operations
CREATE TABLE IF NOT EXISTS calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES email_accounts(id),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  status TEXT, -- 'pending', 'running', 'completed', 'failed'
  error_message TEXT,
  events_synced INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance optimization

-- User and account lookups
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_account_id ON calendar_events(account_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_account ON calendar_events(user_id, account_id);

-- Time range queries (month/week/day views)
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_time ON calendar_events(end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range ON calendar_events(user_id, start_time, end_time);

-- Full-text search on event title and description
CREATE INDEX IF NOT EXISTS idx_calendar_events_title_search ON calendar_events USING GIN (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_calendar_events_description_search ON calendar_events USING GIN (to_tsvector('english', description));

-- Attendee lookups
CREATE INDEX IF NOT EXISTS idx_calendar_attendees_event_id ON calendar_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_attendees_email ON calendar_attendees(email);
CREATE INDEX IF NOT EXISTS idx_calendar_attendees_status ON calendar_attendees(status);

-- Sync state and recurring event tracking
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence ON calendar_events(recurrence_rule) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_provider_id ON calendar_events(event_id) WHERE event_id IS NOT NULL;

-- Sync log queries
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_account ON calendar_sync_log(account_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_status ON calendar_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_created ON calendar_sync_log(created_at DESC);

-- Update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_events_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_events_timestamp_trigger
BEFORE UPDATE ON calendar_events
FOR EACH ROW
EXECUTE FUNCTION update_calendar_events_timestamp();

-- Similar trigger for attendees
CREATE OR REPLACE FUNCTION update_calendar_attendees_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_attendees_timestamp_trigger
BEFORE UPDATE ON calendar_attendees
FOR EACH ROW
EXECUTE FUNCTION update_calendar_attendees_timestamp();

-- Verify schema creation
-- This will help verify the migration ran successfully
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('calendar_events', 'calendar_attendees', 'calendar_sync_log')
  ) THEN
    RAISE NOTICE 'Calendar schema created successfully';
  ELSE
    RAISE EXCEPTION 'Calendar schema creation failed';
  END IF;
END $$;
