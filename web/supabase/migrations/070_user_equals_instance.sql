-- =====================================================
-- HELIX OBSERVATORY DATABASE SCHEMA
-- Migration 070: User = Instance Identity Migration
-- =====================================================
--
-- This migration is part of the "user = instance" initiative.
-- It adds user_id columns directly to telemetry tables that
-- previously only referenced users indirectly through instance_key.
-- This enables direct RLS policies without subqueries and prepares
-- for the eventual deprecation of instance_key as the primary
-- identity column on these tables.
--
-- Non-destructive: no columns or tables are dropped.
-- =====================================================

-- =====================================================
-- 1. ADD user_id COLUMNS
-- =====================================================

-- Telemetry table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE telemetry
      ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Heartbeats table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'heartbeats'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE heartbeats
      ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Transformations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transformations'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE transformations
      ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- =====================================================
-- 2. CREATE INDEXES ON user_id
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_telemetry_user_id
  ON telemetry(user_id, server_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_heartbeats_user_id
  ON heartbeats(user_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_transformations_user_id
  ON transformations(user_id, created_at DESC);

-- =====================================================
-- 3. ENABLE RLS (idempotent - already enabled in 004)
-- =====================================================

ALTER TABLE telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS POLICIES: users can only access their own data
-- =====================================================
-- These new policies use the direct user_id column instead
-- of the old subquery-based instance_key lookup. The old
-- policies from migration 004 are dropped and replaced.
-- =====================================================

-- ----- TELEMETRY -----

-- Drop legacy policies that used instance_key subqueries
DROP POLICY IF EXISTS "Instances can insert telemetry" ON telemetry;
DROP POLICY IF EXISTS "Users can view own instance telemetry" ON telemetry;

-- SELECT: user can read their own telemetry rows
CREATE POLICY "Users can select own telemetry"
  ON telemetry FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: user can insert telemetry for themselves
CREATE POLICY "Users can insert own telemetry"
  ON telemetry FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: user can update their own telemetry rows
CREATE POLICY "Users can update own telemetry"
  ON telemetry FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: user can delete their own telemetry rows
CREATE POLICY "Users can delete own telemetry"
  ON telemetry FOR DELETE
  USING (auth.uid() = user_id);

-- ----- HEARTBEATS -----

DROP POLICY IF EXISTS "Instances can insert heartbeats" ON heartbeats;
DROP POLICY IF EXISTS "Users can view own instance heartbeats" ON heartbeats;

CREATE POLICY "Users can select own heartbeats"
  ON heartbeats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own heartbeats"
  ON heartbeats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own heartbeats"
  ON heartbeats FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own heartbeats"
  ON heartbeats FOR DELETE
  USING (auth.uid() = user_id);

-- ----- TRANSFORMATIONS -----

DROP POLICY IF EXISTS "Instances can insert transformations" ON transformations;
DROP POLICY IF EXISTS "Users can view own instance transformations" ON transformations;

CREATE POLICY "Users can select own transformations"
  ON transformations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transformations"
  ON transformations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transformations"
  ON transformations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transformations"
  ON transformations FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 5. SOFT-DEPRECATE instance_key (make nullable)
-- =====================================================
-- instance_key was NOT NULL on all three tables. We relax
-- this constraint so new rows can omit it once callers
-- migrate to user_id. Existing rows are unaffected.
-- =====================================================

ALTER TABLE telemetry      ALTER COLUMN instance_key DROP NOT NULL;
ALTER TABLE heartbeats     ALTER COLUMN instance_key DROP NOT NULL;
ALTER TABLE transformations ALTER COLUMN instance_key DROP NOT NULL;

-- =====================================================
-- 6. TABLE COMMENTS
-- =====================================================

COMMENT ON COLUMN telemetry.user_id IS
  'Direct user reference (user=instance migration 070). Replaces indirect instance_key lookup.';

COMMENT ON COLUMN heartbeats.user_id IS
  'Direct user reference (user=instance migration 070). Replaces indirect instance_key lookup.';

COMMENT ON COLUMN transformations.user_id IS
  'Direct user reference (user=instance migration 070). Replaces indirect instance_key lookup.';

COMMENT ON COLUMN telemetry.instance_key IS
  'Soft-deprecated in migration 070. Use user_id for new queries.';

COMMENT ON COLUMN heartbeats.instance_key IS
  'Soft-deprecated in migration 070. Use user_id for new queries.';

COMMENT ON COLUMN transformations.instance_key IS
  'Soft-deprecated in migration 070. Use user_id for new queries.';
