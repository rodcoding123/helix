-- Diagnostic: get function source for create_proactive_settings_for_user
CREATE OR REPLACE FUNCTION public.get_function_source(fname TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'name', p.proname,
      'schema', n.nspname,
      'source', p.prosrc,
      'security_definer', p.prosecdef,
      'language', l.lanname,
      'owner', pg_get_userbyid(p.proowner)
    )::jsonb
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_language l ON p.prolang = l.oid
    WHERE p.proname = fname
    AND n.nspname = 'public'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
