-- =====================================================
-- HELIX OBSERVATORY DATABASE SCHEMA
-- Migration 001: Initial Schema
-- =====================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- SUBSCRIPTION TIERS
-- =====================================================

CREATE TYPE subscription_tier AS ENUM (
  'free',           -- Telemetry on, basic dashboard
  'ghost',          -- $9/mo - Telemetry off, privacy
  'observatory',    -- $29/mo - View aggregate data
  'observatory_pro' -- $99/mo - API access, exports, research tools
);

-- =====================================================
-- SUBSCRIPTIONS TABLE
-- =====================================================

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  tier subscription_tier DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- API KEYS TABLE (Pro Tier)
-- =====================================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT,
  permissions JSONB DEFAULT '["read"]',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- HELIX INSTANCES TABLE
-- =====================================================

CREATE TABLE instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,

  -- Identity
  name TEXT NOT NULL,
  instance_key TEXT UNIQUE NOT NULL,

  -- Configuration snapshot (no sensitive data)
  soul_hash TEXT,
  psychology_summary JSONB,

  -- Status
  ghost_mode BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  version TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ,
  last_transformation TIMESTAMPTZ
);

-- =====================================================
-- INSTANCE SNAPSHOTS TABLE
-- =====================================================

CREATE TABLE instance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES instances NOT NULL,
  soul_hash TEXT,
  psychology_summary JSONB,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_instances_user ON instances(user_id);
CREATE INDEX idx_instances_key ON instances(instance_key);
CREATE INDEX idx_instance_snapshots_instance ON instance_snapshots(instance_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-create subscription for new users
CREATE OR REPLACE FUNCTION create_subscription_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, tier)
  VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_subscription_for_user();
