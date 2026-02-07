/**
 * Supabase Client for Helix Runtime
 *
 * Server-side Supabase client for the OpenClaw gateway.
 * Uses service role key for full database access (enforced by RLS policies).
 *
 * Environment variables:
 * - SUPABASE_URL: Supabase project URL (https://xxxxx.supabase.co)
 * - SUPABASE_SERVICE_ROLE: Service role key (for server-side operations)
 *
 * Note: Uses service role for RLS enforcement. All access is still controlled
 * by PostgreSQL RLS policies at the database layer for security.
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client
 * Uses service role key for server-side operations
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !supabaseServiceRole) {
    console.warn(
      'Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE environment variables.'
    );
    return null;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('Supabase client initialized for helix-runtime');
    return supabaseClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

/**
 * Initialize Supabase client at startup
 */
export async function initializeSupabase(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    console.error('Failed to initialize Supabase client');
    return false;
  }

  // Test connection with a simple query
  try {
    const { error } = await client
      .from('conversations')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }

    console.log('Supabase connection test successful');
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error);
    return false;
  }
}

/**
 * Shutdown Supabase client
 */
export function shutdownSupabase(): void {
  supabaseClient = null;
}
