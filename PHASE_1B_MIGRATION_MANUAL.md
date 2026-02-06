# Phase 1B Migration - Manual Execution Guide

**Status**: Migration file created and renamed to proper sequence
**File**: `web/supabase/migrations/072_phase1b_memory_synthesis.sql`
**Approach**: Manual execution via Supabase SQL Editor (due to migration ordering conflicts)

---

## Why Manual Execution?

The Supabase CLI encountered migration ordering issues because there are older migrations (003, 018, 019, etc.) that exist locally but haven't been pushed to the remote yet. Rather than resolve the entire migration history, we'll execute the Phase 1B tables directly.

**Migration uses `CREATE TABLE IF NOT EXISTS`** - fully idempotent and safe to run multiple times.

---

## Option 1: Supabase Dashboard (Recommended)

### Steps:

1. **Open Supabase Dashboard**:
   - Go to https://app.supabase.com
   - Select your Helix project
   - Navigate to `SQL Editor`

2. **Create New Query**:
   - Click `+ New Query`
   - Paste the SQL from below (or from `web/supabase/migrations/072_phase1b_memory_synthesis.sql`)

3. **Execute SQL**:
   - Click `Run` (⌘+Enter)
   - Tables will be created if they don't exist

---

## Option 2: Direct psql Connection (Advanced)

If you have direct database access:

```bash
# Get connection string from Supabase dashboard (Settings → Database → Connection string)
export DATABASE_URL="postgresql://postgres:PASSWORD@host.supabase.co:5432/postgres"

# Execute migration
psql "$DATABASE_URL" < web/supabase/migrations/072_phase1b_memory_synthesis.sql
```

---

## SQL to Execute

Copy and paste this into Supabase SQL Editor:

```sql
-- ==============================================================================
-- TABLE 1: User Profiles
-- ==============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  communication_style TEXT,
  preferred_response_length TEXT,
  trust_level DECIMAL(3, 2) DEFAULT 0.5,
  relationship_type TEXT DEFAULT 'user',
  first_interaction TIMESTAMPTZ,
  conversation_count INTEGER DEFAULT 0,
  is_creator BOOLEAN DEFAULT FALSE,
  creator_verified_at TIMESTAMPTZ,
  is_admin BOOLEAN DEFAULT FALSE,
  feature_toggles JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_creator ON user_profiles(is_creator);
CREATE INDEX IF NOT EXISTS idx_user_profiles_trust_level ON user_profiles(trust_level DESC);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_view_own_profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id OR (SELECT is_admin FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "users_update_own_profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 2: Conversation Memories
-- ==============================================================================
CREATE TABLE IF NOT EXISTS conversation_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key TEXT,
  synthesis_result JSONB NOT NULL,
  salience_score DECIMAL(3, 2) NOT NULL DEFAULT 0.5,
  message_count INTEGER DEFAULT 0,
  average_emotion_intensity DECIMAL(3, 2) DEFAULT 0.5,
  has_emotional_content BOOLEAN DEFAULT FALSE,
  has_goals BOOLEAN DEFAULT FALSE,
  has_relationship_shifts BOOLEAN DEFAULT FALSE,
  has_transformation BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON conversation_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_salience ON conversation_memories(salience_score DESC) WHERE salience_score > 0.5;
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON conversation_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_conversation_id ON conversation_memories(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memories_emotional ON conversation_memories(user_id, has_emotional_content) WHERE has_emotional_content = TRUE;
CREATE INDEX IF NOT EXISTS idx_memories_goals ON conversation_memories(user_id, has_goals) WHERE has_goals = TRUE;
CREATE INDEX IF NOT EXISTS idx_memories_synthesis_gin ON conversation_memories USING GIN (synthesis_result);

ALTER TABLE conversation_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_view_own_memories"
  ON conversation_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "users_insert_own_memories"
  ON conversation_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "users_update_own_memories"
  ON conversation_memories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "users_delete_own_memories"
  ON conversation_memories FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 3: Memory Insights
-- ==============================================================================
CREATE TABLE IF NOT EXISTS memory_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emotional_trends JSONB NOT NULL DEFAULT '{}',
  goal_themes JSONB NOT NULL DEFAULT '{}',
  relationship_patterns JSONB NOT NULL DEFAULT '{}',
  transformation_indicators JSONB NOT NULL DEFAULT '{}',
  total_memories INTEGER DEFAULT 0,
  avg_salience DECIMAL(3, 2) DEFAULT 0.5,
  high_salience_memories INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_user_id ON memory_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_updated_at ON memory_insights(updated_at DESC);

ALTER TABLE memory_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_view_own_insights"
  ON memory_insights FOR SELECT
  USING (auth.uid() = user_id);

-- ==============================================================================
-- TABLE 4: Memory Decay History
-- ==============================================================================
CREATE TABLE IF NOT EXISTS memory_decay_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES conversation_memories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_salience DECIMAL(3, 2) NOT NULL,
  new_salience DECIMAL(3, 2) NOT NULL,
  decay_rate DECIMAL(3, 2) DEFAULT 0.95,
  reason TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decay_user_id ON memory_decay_history(user_id);
CREATE INDEX IF NOT EXISTS idx_decay_memory_id ON memory_decay_history(memory_id);
CREATE INDEX IF NOT EXISTS idx_decay_occurred_at ON memory_decay_history(occurred_at DESC);

ALTER TABLE memory_decay_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_view_own_decay_history"
  ON memory_decay_history FOR SELECT
  USING (auth.uid() = user_id);

-- ==============================================================================
-- Helper Functions
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS conversation_memories_updated_at_trigger
  BEFORE UPDATE ON conversation_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS memory_insights_updated_at_trigger
  BEFORE UPDATE ON memory_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS user_profiles_updated_at_trigger
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- Helper Function: Get User Memory Statistics
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_user_memory_stats(user_id_param UUID)
RETURNS TABLE (
  total_memories BIGINT,
  high_salience_count BIGINT,
  avg_salience NUMERIC,
  last_memory_created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_memories,
    COUNT(*) FILTER (WHERE salience_score > 0.7) as high_salience_count,
    AVG(salience_score) as avg_salience,
    MAX(created_at) as last_memory_created_at
  FROM conversation_memories
  WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- Helper Function: Apply Memory Decay
-- ==============================================================================
CREATE OR REPLACE FUNCTION apply_memory_decay(user_id_param UUID, decay_rate DECIMAL DEFAULT 0.95)
RETURNS TABLE (
  affected_count INTEGER
) AS $$
DECLARE
  affected_count INTEGER := 0;
BEGIN
  UPDATE conversation_memories
  SET salience_score = GREATEST(0.1, salience_score * decay_rate),
      updated_at = NOW()
  WHERE user_id = user_id_param
    AND created_at < NOW() - INTERVAL '30 days'
    AND salience_score > 0.1;

  affected_count := ROW_COUNT;

  INSERT INTO memory_decay_history (memory_id, user_id, previous_salience, new_salience, decay_rate, reason)
  SELECT
    id,
    user_id,
    salience_score,
    GREATEST(0.1, salience_score * decay_rate),
    decay_rate,
    'scheduled_decay'
  FROM conversation_memories
  WHERE user_id = user_id_param
    AND created_at < NOW() - INTERVAL '30 days'
    AND updated_at = NOW();

  RETURN QUERY SELECT affected_count;
END;
$$ LANGUAGE plpgsql;
```

---

## Verification

After executing the SQL:

1. **Check Tables Created**:

   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('user_profiles', 'conversation_memories', 'memory_insights', 'memory_decay_history');
   ```

   Should return:

   ```
   user_profiles
   conversation_memories
   memory_insights
   memory_decay_history
   ```

2. **Check Indexes**:

   ```sql
   SELECT indexname FROM pg_indexes
   WHERE schemaname = 'public'
   AND tablename IN ('user_profiles', 'conversation_memories', 'memory_insights', 'memory_decay_history');
   ```

3. **Check Functions**:
   ```sql
   SELECT routine_name FROM information_schema.routines
   WHERE routine_schema = 'public'
   AND routine_name IN ('update_updated_at_column', 'get_user_memory_stats', 'apply_memory_decay');
   ```

---

## Success Indicators

✅ **Tables Created**: All 4 tables exist
✅ **Indexes Created**: 15+ indexes for performance
✅ **RLS Enabled**: Row-level security policies active
✅ **Triggers Created**: Auto-update timestamps working
✅ **Functions Created**: Memory decay, stats, and helper functions ready

---

## Next Steps After Migration

1. **Test THANOS_MODE**: Send trigger phrase and verify key in web chat
2. **Monitor Synthesis**: Check Discord #helix-hash-chain for synthesis logs
3. **Verify Storage**: Query `conversation_memories` table to see synthesis results
4. **Check Scheduler**: Verify daily jobs run at 2 AM (decay, reconsolidation, wellness)

---

## Rollback

If needed to rollback:

```sql
DROP TABLE IF EXISTS memory_decay_history;
DROP TABLE IF EXISTS memory_insights;
DROP TABLE IF EXISTS conversation_memories;
DROP TABLE IF EXISTS user_profiles;
DROP FUNCTION IF EXISTS apply_memory_decay(UUID, DECIMAL);
DROP FUNCTION IF EXISTS get_user_memory_stats(UUID);
DROP FUNCTION IF EXISTS update_updated_at_column();
```

---

## Status

- [x] Migration file created and renamed to proper sequence (072_phase1b_memory_synthesis.sql)
- [ ] SQL executed in Supabase (manual via dashboard)
- [ ] Tables verified in Supabase
- [ ] Chat.ts integration tested with THANOS_MODE
- [ ] Synthesis pipeline tested end-to-end

**Next Action**: Execute Option 1 (Supabase Dashboard) or Option 2 (psql) from above.
