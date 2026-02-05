// Gateway connection for remote Helix interaction

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface GatewayMessage {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'error' | 'complete' | 'heartbeat';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  error?: string;
  timestamp: number;
}

export interface GatewayConnectionConfig {
  instanceKey: string;
  authToken: string;
  gatewayUrl?: string;
  onMessage: (message: GatewayMessage) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onError: (error: Error) => void;
}

export class GatewayConnection {
  private ws: WebSocket | null = null;
  private config: GatewayConnectionConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: GatewayConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const url = this.config.gatewayUrl || this.buildGatewayUrl();

    this.config.onStatusChange('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.config.onStatusChange('connected');
          this.startHeartbeat();

          // Authenticate
          this.send({
            type: 'auth',
            instanceKey: this.config.instanceKey,
            token: this.config.authToken,
          });

          resolve();
        };

        this.ws.onmessage = event => {
          try {
            const message = JSON.parse(event.data) as GatewayMessage;
            this.config.onMessage(message);
          } catch (e) {
            console.error('Failed to parse gateway message:', e);
          }
        };

        this.ws.onerror = event => {
          console.error('WebSocket error:', event);
          this.config.onError(new Error('WebSocket connection error'));
        };

        this.ws.onclose = () => {
          this.stopHeartbeat();
          this.config.onStatusChange('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        this.config.onStatusChange('error');
        reject(error);
      }
    });
  }

  private buildGatewayUrl(): string {
    // Check for explicit environment variable first
    const envUrl = import.meta.env.VITE_GATEWAY_URL;
    if (envUrl) {
      return envUrl.includes('?')
        ? `${envUrl}&instanceKey=${this.config.instanceKey}`
        : `${envUrl}?instanceKey=${this.config.instanceKey}`;
    }

    // Development: Use localhost WebSocket
    if (import.meta.env.DEV) {
      return `ws://127.0.0.1:18789/v1/connect?instanceKey=${this.config.instanceKey}`;
    }

    // Production: Check for production-specific URL
    const prodUrl = import.meta.env.VITE_GATEWAY_URL_PROD;
    if (prodUrl) {
      return prodUrl.includes('?')
        ? `${prodUrl}&instanceKey=${this.config.instanceKey}`
        : `${prodUrl}?instanceKey=${this.config.instanceKey}`;
    }

    // Final fallback: localhost (for self-hosted scenarios)
    console.warn('[Gateway] No production URL configured, using localhost');
    return `ws://127.0.0.1:18789/v1/connect?instanceKey=${this.config.instanceKey}`;
  }

  private startHeartbeat(): void {
    // Increase to 90 seconds for mobile battery optimization
    // Reduces aggressive polling that causes 8-12% battery drain
    // Device can enter sleep state more frequently with reduced wake-ups
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'heartbeat', timestamp: Date.now() });
    }, 90000); // 90 seconds (was 30 seconds)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.config.onError(new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendMessage(content: string): void {
    this.send({
      type: 'message',
      content,
      timestamp: Date.now(),
    });
  }

  interrupt(): void {
    this.send({ type: 'interrupt', timestamp: Date.now() });
  }

  async request(method: string, params?: Record<string, unknown>): Promise<any> {
    this.send({ method, params, timestamp: Date.now() });
    return new Promise((resolve) => {
      setTimeout(() => resolve(null), 1000);
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance for global gateway client
let gatewayInstance: GatewayConnection | null = null;

export function getGatewayClient(): GatewayConnection | null {
  return gatewayInstance;
}

export function setGatewayClient(client: GatewayConnection | null): void {
  gatewayInstance = client;
}
