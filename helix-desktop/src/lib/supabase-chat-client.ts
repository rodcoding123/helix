/**
 * Supabase Chat Client for Desktop
 *
 * Unifies desktop with web by using the same HTTP gateway API
 * while maintaining Supabase authentication and session sync.
 *
 * Phase 4A: Desktop Unification
 */

export interface DesktopChatResponse {
  success: boolean;
  response: string;
  messageId?: string;
  metadata?: {
    thanos_verification?: boolean;
    verified?: boolean;
    creatorVerified?: boolean;
  };
}

export interface DesktopMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/**
 * Desktop Supabase Chat Client
 *
 * Communicates with the HTTP gateway using standard HTTP
 * while integrating with Supabase for authentication,
 * session storage, and real-time sync.
 */
export class DesktopSupabaseChatClient {
  private baseUrl: string;
  private token: string | null = null;
  private sessionKey: string = 'default';

  constructor(baseUrl: string = 'http://localhost:18789') {
    this.baseUrl = baseUrl;
  }

  /**
   * Set authentication token from Supabase
   */
  setAuthToken(token: string): void {
    this.token = token;
  }

  /**
   * Set current session key
   */
  setSessionKey(sessionKey: string): void {
    this.sessionKey = sessionKey;
  }

  /**
   * Send message to gateway via HTTP
   * This calls the same endpoint as the web version: POST /api/chat/message
   */
  async sendMessage(message: string): Promise<DesktopChatResponse> {
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    if (message.length > 4000) {
      throw new Error('Message too long (max 4000 characters)');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: message.trim(),
          sessionKey: this.sessionKey,
          userId: this.token ? this.extractUserIdFromToken(this.token) : 'anonymous',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: `Request failed: ${response.status}`,
        }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as DesktopChatResponse;
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to send message: ${String(error)}`);
    }
  }

  /**
   * Extract user ID from JWT token (for Supabase tokens)
   * Supabase JWT has format: header.payload.signature
   * Payload contains: { sub, email, ... }
   */
  private extractUserIdFromToken(token: string): string {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return 'anonymous';

      const decoded = JSON.parse(atob(parts[1])) as Record<string, unknown>;
      return (decoded.sub as string) || 'anonymous';
    } catch {
      return 'anonymous';
    }
  }

  /**
   * Health check - verify connection to gateway
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get gateway status
   */
  async getStatus(): Promise<{
    running: boolean;
    url: string;
    version?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/status`);
      if (response.ok) {
        const data = await response.json();
        return {
          running: true,
          url: this.baseUrl,
          ...data,
        };
      }
    } catch {
      // Status check failed
    }

    return {
      running: false,
      url: this.baseUrl,
    };
  }
}

// Singleton instance
let client: DesktopSupabaseChatClient | null = null;

export function getDesktopChatClient(baseUrl?: string): DesktopSupabaseChatClient {
  if (!client) {
    client = new DesktopSupabaseChatClient(baseUrl);
  }
  return client;
}

export function createDesktopChatClient(baseUrl?: string): DesktopSupabaseChatClient {
  return new DesktopSupabaseChatClient(baseUrl);
}
