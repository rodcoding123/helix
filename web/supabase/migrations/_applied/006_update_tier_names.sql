-- =====================================================
-- HELIX OBSERVATORY DATABASE SCHEMA
-- Migration 006: Update Subscription Tier Names
-- =====================================================

-- Rename tier values from old names to new names:
-- free -> core
-- ghost -> phantom
-- observatory -> overseer
-- observatory_pro -> architect

-- Create new enum type with updated names
CREATE TYPE subscription_tier_new AS ENUM (
  'core',        -- Free tier - Everything, full architecture, contributes to research
  'phantom',     -- $9/mo - Complete privacy, no telemetry
  'overseer',    -- $29/mo - See the collective, observatory access
  'architect'    -- $99/mo - Full access, anywhere, research API & exports
);

-- Update subscriptions table to use new enum
ALTER TABLE subscriptions
  ALTER COLUMN tier TYPE subscription_tier_new
  USING CASE tier::text
    WHEN 'free' THEN 'core'::subscription_tier_new
    WHEN 'ghost' THEN 'phantom'::subscription_tier_new
    WHEN 'observatory' THEN 'overseer'::subscription_tier_new
    WHEN 'observatory_pro' THEN 'architect'::subscription_tier_new
  END;

-- Update default value
ALTER TABLE subscriptions
  ALTER COLUMN tier SET DEFAULT 'core';

-- Drop old enum type
DROP TYPE subscription_tier;

-- Rename new enum to original name
ALTER TYPE subscription_tier_new RENAME TO subscription_tier;

-- Update the trigger function to use new tier name
CREATE OR REPLACE FUNCTION create_subscription_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, tier)
  VALUES (NEW.id, 'core');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SESSIONS TABLE (for Code Interface)
-- =====================================================

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_key TEXT REFERENCES instances(instance_key) NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  source TEXT DEFAULT 'local' CHECK (source IN ('local', 'observatory')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_instance ON sessions(instance_key);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_session ON session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_timestamp ON session_messages(timestamp);

-- RLS for sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_user_policy ON sessions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY session_messages_user_policy ON session_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_messages.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Enable realtime for session messages
ALTER PUBLICATION supabase_realtime ADD TABLE session_messages;
