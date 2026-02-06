-- Test script to verify calendar schema was created correctly
-- Run: psql -U postgres -h localhost -d helix_db -f test_calendar_schema.sql

-- 1. Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('calendar_events', 'calendar_attendees', 'calendar_sync_log')
ORDER BY table_name;

-- 2. Verify calendar_events columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'calendar_events'
ORDER BY ordinal_position;

-- 3. Verify calendar_attendees columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'calendar_attendees'
ORDER BY ordinal_position;

-- 4. Verify calendar_sync_log columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'calendar_sync_log'
ORDER BY ordinal_position;

-- 5. Verify indexes exist
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_calendar%'
ORDER BY indexname;

-- 6. Verify unique constraint on calendar_events
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'calendar_events'
AND constraint_type = 'UNIQUE';

-- 7. Verify foreign key relationships
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public'
AND table_name IN ('calendar_events', 'calendar_attendees', 'calendar_sync_log')
ORDER BY table_name;

-- Expected results:
-- Tables: calendar_events, calendar_attendees, calendar_sync_log (3 tables)
-- calendar_events columns: id, user_id, account_id, title, description, start_time, end_time, is_all_day, location, attendees, recurrence_rule, event_id, created_at, updated_at (14 columns)
-- calendar_attendees columns: id, event_id, email, name, status, response_date, created_at, updated_at (8 columns)
-- calendar_sync_log columns: id, account_id, started_at, completed_at, status, error_message, events_synced, created_at (8 columns)
-- Indexes: 17 indexes total
