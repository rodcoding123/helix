-- Fix: create_proactive_settings_for_user uses NEW.id (subscription UUID) instead of NEW.user_id
-- This causes FK violation because subscription UUID ≠ auth.users UUID
-- Also add SECURITY DEFINER for proper permissions during signup cascade

CREATE OR REPLACE FUNCTION create_proactive_settings_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO proactive_settings (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up diagnostic functions (no longer needed)
DROP FUNCTION IF EXISTS public.list_auth_user_triggers();
DROP FUNCTION IF EXISTS public.list_subscription_triggers();
DROP FUNCTION IF EXISTS public.get_function_source(TEXT);
