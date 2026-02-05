/**
 * Helix Logging Stub for Web Project
 * Provides a no-op implementation for web builds where Discord logging is not available
 */

interface LogMessage {
  channel?: string;
  type?: string;
  [key: string]: unknown;
}

/**
 * Log to Discord webhook (stub implementation for web)
 * In the web environment, this is a no-op as logging happens server-side
 */
export async function logToDiscord(_message: LogMessage): Promise<void> {
  // No-op in web environment
  // Actual logging happens through the Supabase edge functions or server-side
}
