-- Fix: Signup fails because of multiple trigger issues on auth.users
-- 1. subscription_tier ENUM is out of sync - convert to TEXT for flexibility
-- 2. create_subscription_for_user() tries to insert 'core' but enum rejects it
-- 3. All trigger functions need SECURITY DEFINER to work during auth signup

-- Step 1: Convert subscription tier column from ENUM to TEXT
ALTER TABLE subscriptions ALTER COLUMN tier TYPE TEXT USING tier::TEXT;
ALTER TABLE subscriptions ALTER COLUMN tier SET DEFAULT 'core';

-- Drop the old enum type (no longer needed)
DROP TYPE IF EXISTS subscription_tier;

-- Step 2: Fix all three auth.users AFTER INSERT trigger functions

-- Trigger 1: Auto-create subscription (from migration 001/006)
CREATE OR REPLACE FUNCTION create_subscription_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, tier)
  VALUES (NEW.id, 'core')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger 2: Auto-create cost budget (from migration 043, fixed in 058)
-- Already fixed in 058, but re-apply for safety
CREATE OR REPLACE FUNCTION create_cost_budget_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cost_budgets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger 3: Auto-create user profile (from migration 056)
-- Already SECURITY DEFINER, but re-apply for safety
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
