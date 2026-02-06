-- Temporary diagnostic: create function to list triggers on auth.users
CREATE OR REPLACE FUNCTION public.list_auth_user_triggers()
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(json_build_object(
      'trigger_name', t.tgname,
      'function_name', p.proname,
      'function_schema', pn.nspname,
      'enabled', CASE t.tgenabled
        WHEN 'O' THEN 'ORIGIN'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS'
        ELSE t.tgenabled::text
      END,
      'timing', CASE
        WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
        WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
      END,
      'events', array_remove(ARRAY[
        CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END,
        CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
        CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END
      ], NULL)
    ))::jsonb, '[]'::jsonb)
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_namespace pn ON p.pronamespace = pn.oid
    WHERE n.nspname = 'auth' AND c.relname = 'users'
    AND NOT t.tgisinternal
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
