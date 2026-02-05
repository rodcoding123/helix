/**
 * Gateway RPC Client for Web Frontend
 * Provides HTTP-based access to OpenClaw gateway RPC methods
 * Used by Phase 3 (Custom Tools, Composite Skills, Memory Synthesis)
 */

export interface RPCRequestOptions {
  timeout?: number;
  retries?: number;
}

export interface RPCResponse<T = any> {
  result?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

class GatewayRPCClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl?: string, authToken?: string) {
    this.baseUrl = baseUrl || this.getDefaultGatewayUrl();
    this.authToken = authToken || null;
  }

  private getDefaultGatewayUrl(): string {
    // Check for Vite environment variable first
    if (import.meta.env?.VITE_GATEWAY_RPC_URL) {
      return import.meta.env.VITE_GATEWAY_RPC_URL;
    }

    // Check for window global (legacy support)
    if (typeof window !== 'undefined' && (window as any).__GATEWAY_URL__) {
      return (window as any).__GATEWAY_URL__;
    }

    // Development mode: Use localhost HTTP
    if (import.meta.env?.DEV) {
      return 'http://127.0.0.1:18789/rpc';
    }

    // Try to infer from current location
    if (typeof window !== 'undefined') {
      const { hostname, protocol } = window.location;

      // Local development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:18789/rpc';
      }

      // Production: Gateway likely on same origin or specific subdomain
      // Use HTTPS in production
      if (protocol === 'https:') {
        // Check for production-specific URL
        if (import.meta.env?.VITE_GATEWAY_RPC_URL_PROD) {
          return import.meta.env.VITE_GATEWAY_RPC_URL_PROD;
        }
        // Default to localhost for self-hosted (user must configure)
        console.warn('[GatewayRPC] No production URL configured, using localhost');
      }
    }

    // Final fallback
    return 'http://127.0.0.1:18789/rpc';
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Call an RPC method with the given parameters
   */
  async call<T = any>(
    method: string,
    params?: Record<string, any>,
    options?: RPCRequestOptions
  ): Promise<T> {
    const timeout = options?.timeout || 30000;
    const retries = options?.retries || 0;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
          }

          const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              jsonrpc: '2.0',
              method,
              params: params || {},
              id: this.generateId(),
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data: RPCResponse<T> = await response.json();

          if (data.error) {
            throw new Error(
              `RPC Error: ${data.error.code} - ${data.error.message}`
            );
          }

          if (data.result === undefined) {
            throw new Error('RPC response missing result field');
          }

          return data.result;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If it's the last retry, throw the error
        if (attempt === retries) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        const delayMs = Math.pow(2, attempt) * 100;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError || new Error('Unknown RPC error');
  }

  /**
   * Execute a custom tool
   */
  async executeCustomTool(
    toolId: string,
    userId: string,
    params: Record<string, any>
  ): Promise<any> {
    return this.call('tools.execute_custom', {
      toolId,
      userId,
      params,
    });
  }

  /**
   * Execute a composite skill
   */
  async executeCompositeSkill(
    skillId: string,
    userId: string,
    input: Record<string, any>
  ): Promise<any> {
    return this.call('skills.execute_composite', {
      skillId,
      userId,
      input,
    });
  }

  /**
   * Run memory synthesis
   */
  async startMemorySynthesis(
    userId: string,
    synthesisType: string,
    options?: Record<string, any>
  ): Promise<{ jobId: string; status: string }> {
    return this.call('memory.synthesize', {
      userId,
      synthesis_type: synthesisType,
      ...options,
    });
  }

  /**
   * Get memory synthesis job status
   */
  async getMemorySynthesisStatus(
    jobId: string
  ): Promise<{ status: string; progress: number; insights?: any }> {
    return this.call('memory.synthesis_status', { jobId });
  }

  /**
   * List detected memory patterns
   */
  async listMemoryPatterns(userId: string): Promise<any[]> {
    const result = await this.call('memory.list_patterns', { userId });
    return result.patterns || [];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

// Singleton instance
let clientInstance: GatewayRPCClient | null = null;

/**
 * Get or create the gateway RPC client
 */
export function getGatewayRPCClient(
  baseUrl?: string,
  authToken?: string
): GatewayRPCClient {
  if (!clientInstance) {
    clientInstance = new GatewayRPCClient(baseUrl, authToken);
  }
  return clientInstance;
}

/**
 * Reset the client (useful for testing)
 */
export function resetGatewayRPCClient(): void {
  clientInstance = null;
}

export default GatewayRPCClient;
