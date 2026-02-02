import { getSupabaseBrowserClient } from './supabase-browser';

/**
 * Table names in Supabase
 */
export const TABLES = {
  SESSIONS: 'user_api_keys',
  USERS: 'users',
  AUDIT_LOG: 'audit_log',
} as const;

/**
 * Channel names for real-time subscriptions
 */
export const CHANNELS = {
  SESSION_CHANGES: 'session_changes',
  USER_CHANGES: 'user_changes',
  AUDIT_CHANGES: 'audit_changes',
} as const;

/**
 * Get the Supabase client instance
 * Returns null if Supabase is not initialized
 */
export async function getSupabaseClient() {
  try {
    return getSupabaseBrowserClient();
  } catch (error) {
    console.error('Failed to get Supabase client:', error);
    return null;
  }
}
