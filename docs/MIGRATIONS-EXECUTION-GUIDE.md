# Supabase Migrations Execution Guide

## Overview

This document explains how to execute all pending Supabase migrations for Phases 3 & 4.

## Phase 3 Migration (Critical for Memory Synthesis)

**Migration File:** `web/supabase/migrations/026_conversation_synthesis_insights.sql`

**Tables Created:**

- `conversation_insights` - Stores synthesis results from memory synthesis pipeline
  - Extracted emotional tags, goals, meaningful topics
  - Raw pattern analysis (patterns_json)
  - Synthesis summary for context
  - RLS policies for user data privacy

**RLS Policies:**

- Users can only view their own conversation insights
- Users can only insert/update/delete their own insights
- Automatic timestamp updates via trigger

## Option 1: Supabase Dashboard (Recommended for Quick Testing)

1. Navigate to [Supabase Dashboard](https://app.supabase.com)
2. Select your Helix project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy the contents of `web/supabase/migrations/026_conversation_synthesis_insights.sql`
6. Paste and execute

**Verification:**

```sql
-- Check if table created
SELECT table_name FROM information_schema.tables
WHERE table_name = 'conversation_insights';

-- Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'conversation_insights';

-- Check RLS
SELECT * FROM pg_policies
WHERE tablename = 'conversation_insights';
```

## Option 2: Supabase CLI (Recommended for Production)

### Install Supabase CLI

```bash
npm install -g supabase
# or
brew install supabase/tap/supabase
```

### Link to Project

```bash
cd web
supabase projects list
supabase projects link
# Select your Helix project
```

### Push Migrations

```bash
# Apply all pending migrations to remote database
supabase db push

# Verify
supabase db pull  # Download current schema
```

## Option 3: Manual SQL Execution

### Using psql (PostgreSQL CLI)

```bash
# Connect to Supabase PostgreSQL
psql -h db.supabase.co -U postgres -d postgres

# Then run migration:
\i web/supabase/migrations/026_conversation_synthesis_insights.sql
```

### Using curl (HTTP REST API)

```bash
curl -X POST 'https://<PROJECT_ID>.supabase.co/rest/v1/rpc/exec_sql' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "sql": "CREATE TABLE conversation_insights (...)"
  }'
```

## What the Migration Does

### 1. Creates `conversation_insights` Table

```sql
CREATE TABLE conversation_insights (
  id UUID PRIMARY KEY,
  conversation_id UUID (UNIQUE, FK to conversations)
  user_id UUID (FK to auth.users),
  emotional_tags TEXT[],
  goals TEXT[],
  meaningful_topics TEXT[],
  patterns_json JSONB,
  synthesis_summary TEXT,
  synthesized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### 2. Creates Indexes for Performance

- `idx_conversation_insights_user_id` - Fast lookup by user
- `idx_conversation_insights_conversation_id` - Fast lookup by conversation
- `idx_conversation_insights_synthesized_at` - Fast temporal queries
- `idx_conversation_insights_emotional_tags` - Full-text search on emotions
- `idx_conversation_insights_goals` - Full-text search on goals
- `idx_conversation_insights_topics` - Full-text search on topics
- `idx_conversations_needs_synthesis` - Find conversations pending synthesis

### 3. Enables Row-Level Security (RLS)

- **SELECT**: Users can only view their own insights
- **INSERT**: Users can only insert their own insights
- **UPDATE**: Users can only update their own insights
- **DELETE**: Users can only delete their own insights

### 4. Creates Auto-Update Trigger

- `update_conversation_insights_updated_at()` - Automatically updates `updated_at` timestamp

### 5. Updates `conversations` Table

Adds columns (if not present):

- `synthesized_at` - When synthesis was last run
- `synthesis_insights` - Summary from synthesis

## Verification Queries

After running migrations, verify everything is set up correctly:

### Check Table Exists

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'conversation_insights'
);
```

### Check Columns

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'conversation_insights'
ORDER BY ordinal_position;
```

### Check Indexes

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'conversation_insights'
ORDER BY indexname;
```

### Check RLS Policies

```sql
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'conversation_insights';
```

### Test Insert (as authenticated user)

```sql
INSERT INTO conversation_insights (
  id,
  conversation_id,
  user_id,
  emotional_tags,
  goals,
  meaningful_topics
) VALUES (
  uuid_generate_v4(),
  '12345678-1234-5678-1234-567812345678',
  auth.uid(),
  ARRAY['happy', 'excited'],
  ARRAY['learn rust'],
  ARRAY['programming']
);
```

## Rollback (if needed)

If something goes wrong, you can rollback:

```sql
-- Drop the table (this will cascade)
DROP TABLE IF EXISTS conversation_insights CASCADE;

-- Remove columns from conversations if they were empty
ALTER TABLE conversations
DROP COLUMN IF EXISTS synthesized_at,
DROP COLUMN IF EXISTS synthesis_insights;
```

## Phase 3 & 4 Feature Dependencies

### Phase 3: Memory Synthesis Pipeline

The `026_conversation_synthesis_insights.sql` migration enables:

- ✅ Post-conversation synthesis triggered automatically
- ✅ Extraction of emotional patterns
- ✅ Goal tracking across conversations
- ✅ Meaningful topic identification
- ✅ Synthesis results persistence

**Related Code:**

- `src/psychology/post-conversation-synthesis-hook.ts` - Triggers synthesis
- `src/psychology/psychology-file-writer.ts` - Updates JSON files
- `src/psychology/synthesis-scheduler.ts` - Runs recurring synthesis

### Phase 4: Cross-Platform Unification

The synthesis data is shared across:

- Web (React) - Supabase REST API
- Desktop (Tauri) - `supabase-desktop-client.ts`
- iOS (SwiftUI) - Planned, will use same Supabase backend
- Android (Compose) - Planned, will use same Supabase backend

## Monitoring

After migration and during operation:

### Check Synthesis Job Growth

```sql
SELECT
  DATE_TRUNC('day', synthesized_at) as day,
  COUNT(*) as synthesis_count
FROM conversation_insights
GROUP BY DATE_TRUNC('day', synthesized_at)
ORDER BY day DESC;
```

### Monitor Synthesis Completeness

```sql
SELECT
  COUNT(*) as total_conversations,
  COUNT(CASE WHEN synthesized_at IS NOT NULL THEN 1 END) as synthesized,
  ROUND(
    COUNT(CASE WHEN synthesized_at IS NOT NULL THEN 1 END) * 100.0 /
    COUNT(*),
    2
  ) as synthesis_percentage
FROM conversations;
```

### Check Index Usage

```sql
SELECT
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE relname = 'conversation_insights';
```

## Troubleshooting

### Migration Fails: "conversation_id already exists"

**Cause:** Migration was already applied

**Solution:**

```sql
SELECT EXISTS (
  SELECT FROM information_schema.columns
  WHERE table_name = 'conversation_insights'
);
-- If TRUE, migration already applied, skip
```

### Permission Denied Error

**Cause:** User doesn't have sufficient privileges

**Solution:** Use admin key or have database owner run migration

### Foreign Key Constraint Error

**Cause:** `conversations` table doesn't exist

**Solution:** Run migrations in order:

1. `020_conversations_tables.sql`
2. `026_conversation_synthesis_insights.sql`

## Deployment Checklist

- [ ] Run `026_conversation_synthesis_insights.sql` migration
- [ ] Verify `conversation_insights` table exists
- [ ] Verify RLS policies are enabled
- [ ] Test INSERT as authenticated user
- [ ] Verify synthesis hook can write to table
- [ ] Monitor synthesis job growth
- [ ] Verify performance with indexes

## Performance Expectations

After migration:

| Operation                 | Latency | Status |
| ------------------------- | ------- | ------ |
| Insert synthesis result   | <10ms   | ✅     |
| Query by user_id          | <5ms    | ✅     |
| Query by conversation_id  | <5ms    | ✅     |
| Full-text search on goals | <50ms   | ✅     |
| Monthly analytics query   | <100ms  | ✅     |

All queries should use indexes and complete within SLA.

## Next Steps

1. Execute migration in appropriate environment (dev → staging → production)
2. Verify table creation
3. Monitor synthesis jobs being stored
4. Proceed with Phase 4 deployment (desktop, then mobile)

## Document Version

- **Version:** 1.0
- **Last Updated:** February 6, 2026
- **Status:** READY FOR DEPLOYMENT
