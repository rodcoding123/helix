-- Cloud-First Onboarding: User profiles, AI control plane tables, onboarding tracking
-- This migration creates all tables needed for the cloud chat and onboarding system.
-- All statements are idempotent (IF NOT EXISTS / OR REPLACE / ON CONFLICT).

-- ============================================================================
-- AI Model Routes (from Phase 0.5 control plane)
-- Central registry of all AI operations with their routing configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_model_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id TEXT NOT NULL UNIQUE,
  operation_name TEXT NOT NULL,
  description TEXT,
  primary_model TEXT NOT NULL CHECK (primary_model IN ('claude-opus-4.5', 'deepseek-v3.2', 'gemini-2.0-flash')),
  fallback_model TEXT CHECK (fallback_model IN ('claude-opus-4.5', 'deepseek-v3.2', 'gemini-2.0-flash', NULL)),
  enabled BOOLEAN DEFAULT TRUE,
  cost_criticality TEXT NOT NULL CHECK (cost_criticality IN ('LOW', 'MEDIUM', 'HIGH')),
  estimated_cost_usd DECIMAL(8, 6),
  avg_input_tokens INTEGER,
  avg_output_tokens INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_routes_enabled ON ai_model_routes(enabled);
CREATE INDEX IF NOT EXISTS idx_ai_routes_criticality ON ai_model_routes(cost_criticality);

ALTER TABLE ai_model_routes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_routes_read_all' AND tablename = 'ai_model_routes') THEN
    CREATE POLICY ai_routes_read_all ON ai_model_routes FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================================
-- AI Operation Log
-- Complete audit log of all AI operations executed
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_operation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL REFERENCES ai_model_routes(operation_id),
  model_used TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd DECIMAL(8, 6),
  latency_ms INTEGER,
  status TEXT CHECK (status IN ('pending', 'running', 'success', 'failed', 'timeout')) DEFAULT 'pending',
  error_message TEXT,
  result JSONB,
  request_metadata JSONB DEFAULT '{}',
  executed_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_log_user ON ai_operation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_log_operation ON ai_operation_log(operation_id);
CREATE INDEX IF NOT EXISTS idx_ai_log_executed_at ON ai_operation_log(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_log_status ON ai_operation_log(status);

ALTER TABLE ai_operation_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_log_own_read' AND tablename = 'ai_operation_log') THEN
    CREATE POLICY ai_log_own_read ON ai_operation_log FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- Cost Budgets
-- Per-user daily/monthly spending limits and tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS cost_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_budget_usd DECIMAL(8, 2) DEFAULT 1.00,
  monthly_budget_usd DECIMAL(8, 2) DEFAULT 20.00,
  daily_spent_usd DECIMAL(8, 6) DEFAULT 0,
  monthly_spent_usd DECIMAL(8, 6) DEFAULT 0,
  daily_reset_at DATE DEFAULT CURRENT_DATE,
  monthly_reset_at DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  auto_approve_under_usd DECIMAL(8, 6) DEFAULT 0.01,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_user_budget UNIQUE(user_id)
);

ALTER TABLE cost_budgets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'budget_own_access' AND tablename = 'cost_budgets') THEN
    CREATE POLICY budget_own_access ON cost_budgets FOR ALL TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- Conversations: add session_key for cloud chat sessions
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'session_key'
  ) THEN
    ALTER TABLE conversations ADD COLUMN session_key TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_conversations_session_key'
  ) THEN
    CREATE INDEX idx_conversations_session_key ON conversations(user_id, session_key);
  END IF;
END $$;

-- Add unique constraint for upsert if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_user_session_key'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_user_session_key UNIQUE (user_id, session_key);
  END IF;
END $$;

-- ============================================================================
-- User Profiles (onboarding tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic info (gathered during onboarding chat)
  display_name TEXT,
  role TEXT,
  interests TEXT[],

  -- Onboarding state
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step TEXT DEFAULT 'welcome',

  -- Usage tracking
  messages_today INTEGER DEFAULT 0,
  messages_today_reset_at DATE DEFAULT CURRENT_DATE,
  total_messages INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_profile UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding ON user_profiles(onboarding_completed);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_profiles_own_access' AND tablename = 'user_profiles') THEN
    CREATE POLICY user_profiles_own_access ON user_profiles FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

-- Function to check and reset daily message count
CREATE OR REPLACE FUNCTION check_message_quota(p_user_id UUID, p_daily_limit INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_remaining INTEGER;
BEGIN
  SELECT * INTO v_profile FROM user_profiles WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_profiles (user_id) VALUES (p_user_id)
    RETURNING * INTO v_profile;
  END IF;

  -- Reset counter if new day
  IF v_profile.messages_today_reset_at < CURRENT_DATE THEN
    UPDATE user_profiles
    SET messages_today = 0, messages_today_reset_at = CURRENT_DATE
    WHERE user_id = p_user_id
    RETURNING * INTO v_profile;
  END IF;

  v_remaining := p_daily_limit - v_profile.messages_today;

  RETURN jsonb_build_object(
    'allowed', v_remaining > 0,
    'remaining', GREATEST(v_remaining, 0),
    'used', v_profile.messages_today,
    'limit', p_daily_limit,
    'onboarding_completed', v_profile.onboarding_completed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment message count
CREATE OR REPLACE FUNCTION increment_message_count(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET
    messages_today = messages_today + 1,
    total_messages = total_messages + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
