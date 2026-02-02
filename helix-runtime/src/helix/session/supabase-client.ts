/**
 * HELIX SUPABASE CLIENT
 * Centralized Supabase client initialization with environment variable support
 *
 * Environment Variables:
 *   SUPABASE_URL       - Your Supabase project URL
 *   SUPABASE_ANON_KEY  - Your Supabase anon/public key
 *   HELIX_USER_ID      - The authenticated user's ID (for RLS)
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("helix:session:supabase");

// Re-export types from Supabase
export interface SupabaseClient {
  from: (table: string) => SupabaseQueryBuilder;
  channel: (name: string) => SupabaseChannel;
  removeChannel: (channel: SupabaseChannel) => Promise<void>;
  auth: SupabaseAuth;
}

export interface SupabaseAuth {
  getSession: () => Promise<{ data: { session: unknown }; error: Error | null }>;
  getUser: () => Promise<{ data: { user: unknown }; error: Error | null }>;
}

export interface SupabaseQueryBuilder {
  select: (columns?: string) => SupabaseQueryBuilder;
  insert: (data: unknown) => SupabaseQueryBuilder;
  update: (data: unknown) => SupabaseQueryBuilder;
  upsert: (data: unknown) => SupabaseQueryBuilder;
  delete: () => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  gt: (column: string, value: unknown) => SupabaseQueryBuilder;
  gte: (column: string, value: unknown) => SupabaseQueryBuilder;
  lt: (column: string, value: unknown) => SupabaseQueryBuilder;
  lte: (column: string, value: unknown) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder;
  limit: (count: number) => SupabaseQueryBuilder;
  single: () => Promise<{ data: unknown; error: Error | null }>;
  then: (
    resolve: (result: { data: unknown[] | null; error: Error | null }) => void
  ) => Promise<void>;
}

export interface SupabaseChannel {
  on: (
    event: string,
    filter: { event: string; schema: string; table: string },
    callback: (payload: unknown) => void
  ) => SupabaseChannel;
  subscribe: (callback?: (status: string) => void) => SupabaseChannel;
  unsubscribe: () => Promise<void>;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  userId?: string;
}

// Singleton client instance
let clientInstance: SupabaseClient | null = null;
let clientConfig: SupabaseConfig | null = null;

/**
 * Get Supabase configuration from environment variables
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const userId = process.env.HELIX_USER_ID;

  if (!url || !anonKey) {
    log.debug("Supabase credentials not found in environment");
    return null;
  }

  return { url, anonKey, userId };
}

/**
 * Initialize and return the Supabase client
 * Uses lazy loading to avoid bundling @supabase/supabase-js if not needed
 */
export async function getSupabaseClient(
  config?: Partial<SupabaseConfig>
): Promise<SupabaseClient | null> {
  // Return existing instance if config matches
  if (clientInstance && !config) {
    return clientInstance;
  }

  // Get config from params or environment
  const envConfig = getSupabaseConfig();
  const finalConfig = {
    url: config?.url || envConfig?.url,
    anonKey: config?.anonKey || envConfig?.anonKey,
    userId: config?.userId || envConfig?.userId,
  };

  if (!finalConfig.url || !finalConfig.anonKey) {
    log.warn("Cannot initialize Supabase: missing URL or anon key");
    return null;
  }

  // Check if config changed
  if (
    clientInstance &&
    clientConfig &&
    clientConfig.url === finalConfig.url &&
    clientConfig.anonKey === finalConfig.anonKey
  ) {
    return clientInstance;
  }

  try {
    // Dynamic import to avoid bundling if not used
    const { createClient } = await import("@supabase/supabase-js");

    clientInstance = createClient(finalConfig.url, finalConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    }) as unknown as SupabaseClient;

    clientConfig = finalConfig as SupabaseConfig;

    log.info("Supabase client initialized", {
      url: finalConfig.url.replace(/https?:\/\/([^.]+).*/, "$1..."),
    });

    return clientInstance;
  } catch (err) {
    log.error("Failed to initialize Supabase client:", { error: String(err) });
    return null;
  }
}

/**
 * Check if Supabase is configured and available
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

/**
 * Check if client is connected
 */
export function isSupabaseConnected(): boolean {
  return clientInstance !== null;
}

/**
 * Close the Supabase connection
 */
export async function closeSupabaseClient(): Promise<void> {
  if (clientInstance) {
    // Supabase doesn't have an explicit close method
    // but we can clear the instance
    clientInstance = null;
    clientConfig = null;
    log.info("Supabase client closed");
  }
}

/**
 * Helper to check if an operation is allowed based on user authentication
 */
export async function checkAuth(client: SupabaseClient): Promise<{
  authenticated: boolean;
  userId?: string;
}> {
  try {
    const { data, error } = await client.auth.getUser();

    if (error || !data.user) {
      return { authenticated: false };
    }

    const user = data.user as { id: string };
    return { authenticated: true, userId: user.id };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Database table names (constants to avoid typos)
 */
export const TABLES = {
  SESSIONS: "sessions",
  SESSION_MESSAGES: "session_messages",
  SESSION_TRANSFERS: "session_transfers",
  SESSION_SYNC_STATE: "session_sync_state",
  SESSION_CONFLICTS: "session_conflicts",
  INSTANCES: "instances",
  TELEMETRY: "telemetry",
  HEARTBEATS: "heartbeats",
} as const;

/**
 * Realtime channel names
 */
export const CHANNELS = {
  SESSION_CHANGES: "session-changes",
  SYNC_STATUS: "sync-status",
} as const;
