import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-compatible Supabase client initialization
 * Uses environment variables instead of loadSecret (which is Node.js only)
 */
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase credentials. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
    );
  }

  supabaseClient = createClient(url, anonKey);
  return supabaseClient;
}
