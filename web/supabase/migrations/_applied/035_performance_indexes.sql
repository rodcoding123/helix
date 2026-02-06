-- Performance Optimization: Strategic Indexes
-- Created: 2026-02-03
-- Purpose: Optimize query performance for Email, Calendar, and Tasks

-- ============================================================================
-- Email Performance Indexes
-- ============================================================================

-- Index for common email list queries (user + received date)
CREATE INDEX IF NOT EXISTS idx_emails_user_received
  ON emails(user_id, received_at DESC)
  WHERE is_deleted = false;

-- Index for unread email queries
CREATE INDEX IF NOT EXISTS idx_emails_user_unread
  ON emails(user_id, is_read, received_at DESC)
  WHERE is_deleted = false AND is_read = false;

-- Index for starred emails (frequently accessed)
CREATE INDEX IF NOT EXISTS idx_emails_user_starred
  ON emails(user_id, is_starred, received_at DESC)
  WHERE is_deleted = false AND is_starred = true;

-- Index for email search by subject
CREATE INDEX IF NOT EXISTS idx_emails_subject
  ON emails USING gin(to_tsvector('english', subject));

-- Index for email search by body content
CREATE INDEX IF NOT EXISTS idx_emails_body
  ON emails USING gin(to_tsvector('english', body));

-- Index for sender queries
CREATE INDEX IF NOT EXISTS idx_emails_sender
  ON emails(user_id, sender_email, received_at DESC)
  WHERE is_deleted = false;

-- Index for label-based queries
CREATE INDEX IF NOT EXISTS idx_emails_labels
  ON emails USING gin(labels);

-- Index for thread queries
CREATE INDEX IF NOT EXISTS idx_emails_thread
  ON emails(user_id, thread_id, received_at DESC)
  WHERE is_deleted = false;

-- ============================================================================
-- Calendar Performance Indexes
-- ============================================================================

-- Index for calendar event queries by time range
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time
  ON calendar_events(user_id, start_time, end_time)
  WHERE is_deleted = false;

-- Index for upcoming events
CREATE INDEX IF NOT EXISTS idx_calendar_events_upcoming
  ON calendar_events(user_id, start_time)
  WHERE start_time > CURRENT_TIMESTAMP
    AND is_deleted = false;

-- Index for event attendee queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_attendees
  ON calendar_events USING gin(attendees);

-- Index for calendar conflict detection
CREATE INDEX IF NOT EXISTS idx_calendar_conflicts
  ON calendar_events(user_id, calendar_id, start_time, end_time)
  WHERE is_deleted = false;

-- Index for recurring event queries
CREATE INDEX IF NOT EXISTS idx_calendar_recurrence
  ON calendar_events(user_id, recurrence_rule)
  WHERE is_deleted = false AND recurrence_rule IS NOT NULL;

-- ============================================================================
-- Tasks Performance Indexes
-- ============================================================================

-- Index for board task queries
CREATE INDEX IF NOT EXISTS idx_tasks_board_status
  ON tasks(board_id, status)
  WHERE is_deleted = false;

-- Index for user task queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_created
  ON tasks(user_id, created_at DESC)
  WHERE is_deleted = false;

-- Index for overdue task detection
CREATE INDEX IF NOT EXISTS idx_tasks_overdue
  ON tasks(user_id, due_date)
  WHERE due_date < CURRENT_TIMESTAMP
    AND status != 'done'
    AND is_deleted = false;

-- Index for priority-based filtering
CREATE INDEX IF NOT EXISTS idx_tasks_priority
  ON tasks(user_id, priority, created_at DESC)
  WHERE is_deleted = false;

-- Index for tag-based queries
CREATE INDEX IF NOT EXISTS idx_tasks_tags
  ON tasks USING gin(tags);

-- Index for assignee queries
CREATE INDEX IF NOT EXISTS idx_tasks_assignee
  ON tasks(assignee_id, status)
  WHERE is_deleted = false;

-- Index for subtask queries
CREATE INDEX IF NOT EXISTS idx_subtasks_task
  ON subtasks(task_id, is_completed);

-- Index for task dependencies
CREATE INDEX IF NOT EXISTS idx_tasks_dependencies
  ON tasks USING gin(depends_on_task_ids);

-- ============================================================================
-- General Performance Indexes
-- ============================================================================

-- Index for soft delete queries (is_deleted is common filter)
CREATE INDEX IF NOT EXISTS idx_emails_deleted
  ON emails(is_deleted, user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_deleted
  ON calendar_events(is_deleted, user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_deleted
  ON tasks(is_deleted, user_id);

-- Index for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_emails_created
  ON emails(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_created
  ON calendar_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_created
  ON tasks(user_id, created_at DESC);

-- ============================================================================
-- Sync Performance Indexes
-- ============================================================================

-- Index for sync metadata queries
CREATE INDEX IF NOT EXISTS idx_emails_sync_meta
  ON emails USING gin(sync_meta);

-- Index for change log queries
CREATE INDEX IF NOT EXISTS idx_sync_change_log_user
  ON sync_change_log(user_id, device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_change_log_entity
  ON sync_change_log(entity_type, entity_id, created_at DESC);

-- ============================================================================
-- Analysis and Maintenance
-- ============================================================================

-- Analyze tables to update statistics
ANALYZE emails;
ANALYZE calendar_events;
ANALYZE tasks;
ANALYZE subtasks;
ANALYZE sync_change_log;

-- Create maintenance function for index analysis
CREATE OR REPLACE FUNCTION analyze_index_usage()
RETURNS TABLE(
  schema_name text,
  table_name text,
  index_name text,
  index_size text,
  scan_count bigint,
  tup_read bigint,
  tup_fetch bigint
) AS $$
  SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)),
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
  ORDER BY pg_relation_size(indexrelid) DESC;
$$ LANGUAGE SQL;

-- Performance recommendations comment
COMMENT ON FUNCTION analyze_index_usage() IS
  'Shows index usage statistics. Review regularly and drop unused indexes.';

-- ============================================================================
-- Query Plan Analysis Helpers
-- ============================================================================

-- EXPLAIN ANALYZE queries for common patterns:
/*

1. Email list for user:
EXPLAIN ANALYZE
SELECT * FROM emails
WHERE user_id = 'user-123' AND is_deleted = false
ORDER BY received_at DESC
LIMIT 50;

Expected: Index Scan using idx_emails_user_received

2. Unread email count:
EXPLAIN ANALYZE
SELECT COUNT(*) FROM emails
WHERE user_id = 'user-123' AND is_read = false AND is_deleted = false;

Expected: Index Scan using idx_emails_user_unread

3. Calendar events for time range:
EXPLAIN ANALYZE
SELECT * FROM calendar_events
WHERE user_id = 'user-123'
  AND start_time >= '2024-02-01' AND end_time <= '2024-02-28'
  AND is_deleted = false;

Expected: Index Scan using idx_calendar_events_user_time

4. Overdue tasks:
EXPLAIN ANALYZE
SELECT * FROM tasks
WHERE user_id = 'user-123'
  AND due_date < CURRENT_TIMESTAMP
  AND status != 'done'
  AND is_deleted = false;

Expected: Index Scan using idx_tasks_overdue

5. Search emails by content:
EXPLAIN ANALYZE
SELECT * FROM emails
WHERE to_tsvector('english', subject) @@ plainto_tsquery('english', 'important')
  AND user_id = 'user-123'
  AND is_deleted = false;

Expected: Index Scan using idx_emails_subject
*/

-- ============================================================================
-- Performance Monitoring
-- ============================================================================

-- Track slow queries (requires log_min_duration_statement setting)
-- Configure in postgresql.conf or via ALTER SYSTEM:
-- ALTER SYSTEM SET log_min_duration_statement = 100; -- Log queries > 100ms

-- Create statistics tracking table
CREATE TABLE IF NOT EXISTS query_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  execution_time_ms float NOT NULL,
  rows_affected integer,
  status text DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_perf_created
  ON query_performance_log(created_at DESC);

-- ============================================================================
-- Index Maintenance Recommendations
-- ============================================================================

-- Run monthly to identify unused indexes:
/*
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Drop unused indexes (be careful!):
DROP INDEX IF EXISTS index_name;
*/

-- Monitor index bloat:
/*
SELECT
  schemaname,
  tablename,
  indexname,
  round(100 * (pg_relation_size(indexrelid) - pg_relation_size(indexrelid,'main')) /
  pg_relation_size(indexrelid), 2) as bloat_percent
FROM pg_stat_user_indexes
WHERE pg_relation_size(indexrelid) > 1000000
ORDER BY bloat_percent DESC;
*/
