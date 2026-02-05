-- Diagnostic: list triggers on subscriptions AND proactive_settings FK details
CREATE OR REPLACE FUNCTION public.list_subscription_triggers()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT json_build_object(
    'subscription_triggers', (
      SELECT COALESCE(json_agg(json_build_object(
        'trigger_name', t.tgname,
        'function_name', p.proname,
        'timing', CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END,
        'events', array_remove(ARRAY[
          CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END,
          CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
          CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END
        ], NULL)
      )), '[]'::json)
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE n.nspname = 'public' AND c.relname = 'subscriptions'
      AND NOT t.tgisinternal
    ),
    'proactive_settings_fks', (
      SELECT COALESCE(json_agg(json_build_object(
        'constraint_name', con.conname,
        'column', att.attname,
        'references_table', ref_class.relname,
        'references_schema', ref_ns.nspname
      )), '[]'::json)
      FROM pg_constraint con
      JOIN pg_class cl ON con.conrelid = cl.oid
      JOIN pg_namespace ns ON cl.relnamespace = ns.oid
      JOIN pg_attribute att ON att.attrelid = cl.oid AND att.attnum = ANY(con.conkey)
      JOIN pg_class ref_class ON con.confrelid = ref_class.oid
      JOIN pg_namespace ref_ns ON ref_class.relnamespace = ref_ns.oid
      WHERE ns.nspname = 'public' AND cl.relname = 'proactive_settings'
      AND con.contype = 'f'
    ),
    'proactive_settings_triggers', (
      SELECT COALESCE(json_agg(json_build_object(
        'trigger_name', t.tgname,
        'function_name', p.proname,
        'timing', CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END,
        'events', array_remove(ARRAY[
          CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END,
          CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
          CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END
        ], NULL)
      )), '[]'::json)
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE n.nspname = 'public' AND c.relname = 'proactive_settings'
      AND NOT t.tgisinternal
    )
  )::jsonb INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
