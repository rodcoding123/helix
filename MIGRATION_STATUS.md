# Helix Supabase Migration Status Report

**Generated:** 2026-02-06
**Supabase Project:** `ncygunbukmpwhtzwbnvp.supabase.co`
**Status:** ⚠️ **NEEDS VERIFICATION** (See Action Items)

---

## Executive Summary

Your Helix system has **73 total migrations** organized into:
- **65 Applied Migrations** (001-067) - Foundation and features
- **5 Pending Migrations** (070-072, 20260205-20260206) - Phase 1, Phase 1B, RLS hardening
- **3 Skipped Migrations** - Test and duplicate migrations (intentional)

### Critical Issue

**The pending migrations must be applied to Supabase for full compatibility.** Web, desktop, and mobile applications may not function correctly without these migrations, particularly:

- **Migration 070**: User=Instance identity (required for telemetry)
- **Migration 071**: Phase 1 user context (required for trust/language features)
- **Migration 072**: Phase 1B memory synthesis (required for conversation memory)
- **Migrations 20260205-20260206**: RLS security hardening (required for data safety)

---

## Migration Structure

### Applied Migrations (65)

These are foundation migrations that establish the core database schema. All should already be in your Supabase production database.

| Phase | Range | Key Migrations | Purpose |
|-------|-------|---|---------|
| **Foundation** | 001-010 | `001_initial_schema.sql` | Core tables, extensions, subscription tiers |
| | | `002_telemetry_tables.sql` | Telemetry, heartbeats, transformations |
| | | `004_rls_policies.sql` | Row-level security policies |
| **Operations** | 011-035 | `017_memory_synthesis.sql` | Memory synthesis tables |
| | | `026_conversation_synthesis_insights.sql` | Conversation insights |
| **Intelligence** | 036-050 | `043_phase8_intelligence_operations.sql` | Agent tables |
| | | `049_phase11_multitenant_schema.sql` | Multitenant support |
| **Hardening** | 051-067 | `067_recreate_all_triggers.sql` | Trigger management |

### Pending Migrations (5) - **MUST APPLY**

These are newly developed migrations that extend the schema for Phase 1 features.

#### 1. `070_user_equals_instance.sql`
**Status:** Pending
**Priority:** HIGH
**Purpose:** Identity migration for user=instance paradigm

- Adds `user_id` columns to telemetry, heartbeats, transformations
- Creates indexes on `user_id` for RLS query performance
- Updates RLS policies to use direct `user_id` instead of instance_key lookups
- Makes `instance_key` nullable (soft deprecation)
- **Impact:** Without this, telemetry data won't be properly associated with users

**Expected Changes:**
```sql
ALTER TABLE telemetry ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE heartbeats ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE transformations ADD COLUMN user_id UUID REFERENCES auth.users(id);
CREATE INDEX idx_telemetry_user_id ON telemetry(user_id, server_timestamp DESC);
-- RLS policy updates
```

#### 2. `071_phase1_helix_user_context.sql`
**Status:** Pending
**Priority:** HIGH
**Purpose:** Phase 1 user context and interaction tracking

- Extends `user_profiles` with: `email`, `trust_level`, `preferred_language`, `custom_preferences`
- Creates `user_interactions` table for positive/negative/neutral interaction tracking
- Creates `conversation_insights` table for memory synthesis results
- **Impact:** Without this, trust levels and language preferences won't be stored

**New Tables:**
- `user_interactions` - Session-based interaction tracking with types (positive, negative, neutral)
- `conversation_insights` - Emotional tags, attachment signals, goal mentions from synthesis

#### 3. `072_phase1b_memory_synthesis.sql`
**Status:** Pending
**Priority:** MEDIUM
**Purpose:** Memory synthesis pipeline tables

- Creates `conversation_memories` - Raw synthesis results with salience scoring
- Creates `memory_insights` - Aggregated patterns and connections
- Creates `memory_decay_history` - Track salience changes over time
- Extends `user_profiles` with additional fields (communication style, relationship type, etc.)
- **Impact:** Memory synthesis feature won't work without these tables

**New Tables:**
- `conversation_memories` - Salience-scored conversation synthesis results
- `memory_insights` - Pattern extraction and memory connections
- `memory_decay_history` - Temporal memory salience tracking

#### 4. `20260205_enable_rls.sql`
**Status:** Pending
**Priority:** HIGH
**Purpose:** Enable RLS on all user-facing tables

```sql
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
```

**Impact:** Data safety - without this, clients could access other users' data

#### 5. `20260206_rls_policies.sql`
**Status:** Pending
**Priority:** HIGH
**Purpose:** Create detailed RLS policies for all tables

- Adds fine-grained policies for SELECT, INSERT, UPDATE, DELETE on critical tables
- Service role bypass for admin operations
- Prevents accidental subscription deletion from client
- **Impact:** Data isolation between users

---

### Skipped Migrations (3)

These are intentionally skipped and should NOT be applied:

| File | Reason |
|------|--------|
| `019b_voice_memos.sql` | Duplicate of voice memo implementation |
| `test_calendar_schema.sql` | Test migration, not for production |
| `test_email_schema.sql` | Test migration, not for production |

---

## Current Database State

### What Exists (65 applied migrations)

✅ Core infrastructure
- `auth.users` (Supabase auth)
- `public.instances`, `public.subscriptions`, `public.user_api_keys`
- `public.telemetry`, `public.heartbeats`, `public.transformations`
- `public.conversations`, `public.conversation_messages`
- `public.user_preferences`, `public.workspace_members`, `public.workspaces`

✅ Advanced features
- Agent tables, custom tools, composite skills
- Voice memos, email integration, calendar integration
- Memory synthesis tables (from older migrations)
- Performance indexes and triggers

### What's Missing (pending migrations)

❌ User identity columns
- `telemetry.user_id`, `heartbeats.user_id`, `transformations.user_id`
- RLS policies using `user_id` lookups

❌ Phase 1 features
- `user_profiles` extended fields (`trust_level`, `preferred_language`, etc.)
- `user_interactions` table
- `conversation_insights` table (if not already present)

❌ Phase 1B features
- `conversation_memories` table
- `memory_insights` table
- `memory_decay_history` table

❌ Security hardening
- RLS enabled on `instances`, `subscriptions`, `user_preferences`
- Detailed RLS policies for all tables

---

## Action Items

### 1. **Verify Current Database State (Required)**

Run the verification script to check actual Supabase state:

```bash
# Set your service role key
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_from_supabase_dashboard"

# Run verification
node verify-migrations.mjs
```

This will:
- ✅ Confirm database connectivity
- ✅ Check if all expected core tables exist
- ✅ Verify Phase 1 tables are present
- ✅ Check Phase 1B tables (warning if missing)
- ✅ Validate column structure on critical tables

### 2. **Apply Pending Migrations (Critical)**

Once verified, apply pending migrations:

```bash
# Option A: Using Supabase CLI (recommended)
cd web
npx supabase db push

# Option B: Manual migration (if CLI not available)
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
node run-migration.mjs
```

**Migration Order** (must apply in sequence):
1. `070_user_equals_instance.sql` - User identity columns
2. `071_phase1_helix_user_context.sql` - Phase 1 user context
3. `072_phase1b_memory_synthesis.sql` - Memory synthesis tables
4. `20260205_enable_rls.sql` - Enable RLS
5. `20260206_rls_policies.sql` - Create RLS policies

### 3. **Verify Migration Success**

After applying migrations:

```bash
# Run verification again
node verify-migrations.mjs

# Expected output:
# ✅ Passed: X
# ❌ Failed: 0
# ⚠️  Warnings: 0
```

### 4. **Test Application Functionality**

After migrations are applied, test:

- **Web**: `http://localhost:5173` - Dashboard should load
- **API**: Create user, check telemetry is recorded with user_id
- **Memory**: Check that user_profiles shows trust_level field
- **RLS**: Verify users can only see their own data

---

## Migration Dependencies

The pending migrations have these dependencies:

```
Migration 070 (user_id columns)
    ↓
Migration 071 (Phase 1 user context)
    ↓
Migration 072 (Phase 1B memory synthesis)
    ↓
Migration 20260205 (Enable RLS)
    ↓
Migration 20260206 (RLS policies)
```

**Do not apply out of order.** Each migration builds on the previous.

---

## File Locations

```
Helix/
├── web/supabase/migrations/
│   ├── 070_user_equals_instance.sql          (PENDING)
│   ├── 071_phase1_helix_user_context.sql     (PENDING)
│   ├── 072_phase1b_memory_synthesis.sql      (PENDING)
│   ├── 20260205_enable_rls.sql               (PENDING)
│   ├── 20260206_rls_policies.sql             (PENDING)
│   ├── _applied/                             (65 migrations)
│   └── _skipped/                             (3 migrations)
├── verify-migrations.mjs                      (NEW - verification tool)
├── run-migration.mjs                          (Manual migration runner)
└── web/supabase/config.toml                   (Supabase configuration)
```

---

## Configuration

### Supabase Project Details

- **URL:** `https://ncygunbukmpwhtzwbnvp.supabase.co`
- **Database:** PostgreSQL 17
- **Auth:** JWT-based with refresh token rotation enabled
- **RLS:** Currently enabled on some tables, will be complete after pending migrations

### Environment Variables

Web application expects:
```
VITE_SUPABASE_URL=https://ncygunbukmpwhtzwbnvp.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key>
```

For migrations, you need:
```
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
```

Get keys from Supabase Dashboard → Settings → API

---

## Rollback Plan

If something goes wrong during migration:

1. **Database Snapshots**: Supabase creates automatic backups hourly
2. **To Restore**: Contact Supabase support or restore from automated backup
3. **No Manual Rollback Needed**: Migrations are idempotent (IF NOT EXISTS clauses)

---

## Compatibility Matrix

### Web, Desktop, and Mobile

| Component | Phase 1A (070) | Phase 1B (071-072) | RLS (20260205-06) |
|-----------|---|---|---|
| Web Auth | ✅ | ✅ | ✅ |
| Desktop/Mobile | ✅ | ⚠️ Warning | ✅ |
| Telemetry | ✅ | ✅ | ✅ |
| Memory Synthesis | ❌ | ✅ | ✅ |
| Trust/Language | ❌ | ✅ | ✅ |
| Data Safety (RLS) | ⚠️ Partial | ✅ | ✅ |

**Status Meanings:**
- ✅ Fully supported
- ⚠️ Partially supported (may not function optimally)
- ❌ Not supported (will fail)

---

## Quick Verification Checklist

- [ ] Verified Supabase connectivity with `verify-migrations.mjs`
- [ ] All expected core tables exist
- [ ] Phase 1 tables exist (user_profiles, user_interactions, conversation_insights)
- [ ] Phase 1B tables exist (conversation_memories, memory_insights)
- [ ] All critical columns present
- [ ] RLS policies verified
- [ ] Applied pending migrations in order
- [ ] Re-verified after migrations applied
- [ ] Tested web application functionality
- [ ] Tested desktop/mobile sync

---

## Support

If you encounter issues:

1. **Check Supabase Status**: https://status.supabase.com
2. **Review Migration Logs**: Check `verify-migrations.mjs` output
3. **Manual Inspection**:
   ```sql
   -- Check what tables exist
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' ORDER BY table_name;

   -- Check specific table columns
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'telemetry';
   ```
4. **Contact Support**: Include `verify-migrations.mjs` output

---

## Summary

Your migration infrastructure is organized and pending migrations are ready to apply. The next critical step is:

1. **Run verification tool** to check current state
2. **Apply pending migrations** in sequence
3. **Re-verify** to confirm success
4. **Test applications** to ensure functionality

Once migration 20260206 is applied, your Supabase database will be **100% production-ready** with full Phase 1B features, security hardening, and RLS protection.

**Estimated Time to Apply Migrations:** 5-10 minutes

**Estimated Time to Verify:** 2-3 minutes

**No downtime required** - migrations are non-destructive.
