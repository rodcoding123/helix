-- Recreate subscription trigger with SET search_path (critical for SECURITY DEFINER)
DROP FUNCTION IF EXISTS create_subscription_for_user() CASCADE;

CREATE FUNCTION create_subscription_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, tier)
  VALUES (NEW.id, 'core')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_subscription_for_user();

-- Recreate proactive_settings trigger with SET search_path
DROP FUNCTION IF EXISTS create_proactive_settings_for_user() CASCADE;

CREATE FUNCTION create_proactive_settings_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.proactive_settings (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_subscription_create_proactive_settings
  AFTER INSERT ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION create_proactive_settings_for_user();

-- Recreate cost budget trigger with SET search_path (even though trigger doesn't exist yet)
DROP FUNCTION IF EXISTS create_cost_budget_for_new_user() CASCADE;

CREATE FUNCTION create_cost_budget_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cost_budgets (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Also create trigger on subscriptions for cost budgets (instead of auth.users)
-- This ensures the subscription exists before cost budget references it
CREATE TRIGGER on_subscription_create_cost_budget
  AFTER INSERT ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION create_cost_budget_for_new_user();
