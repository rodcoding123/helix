-- Fix: cost_budgets trigger uses wrong column names
-- Migration 043 created trigger_create_cost_budget referencing daily_limit_usd/monthly_limit_usd
-- but migration 056 created cost_budgets with daily_budget_usd/monthly_budget_usd.
-- Fix the function to just insert user_id and rely on table defaults.

CREATE OR REPLACE FUNCTION create_cost_budget_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cost_budgets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
