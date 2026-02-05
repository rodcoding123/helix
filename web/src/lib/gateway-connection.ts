/**
 * Gateway connection for remote Helix interaction
 * Implements the OpenClaw frame-based WebSocket protocol (req/res/event)
 */

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

// OpenClaw protocol frame types
interface RequestFrame {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
}

interface ResponseFrame {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
}

interface EventFrame {
  type: 'event';
  event: string;
  payload?: Record<string, unknown>;
  seq?: number;
}

type GatewayFrame = RequestFrame | ResponseFrame | EventFrame;

const PROTOCOL_VERSION = 3;
const CONNECT_TIMEOUT_MS = 15000;
const REQUEST_TIMEOUT_MS = 60000;

export type GatewayErrorCode =
  | 'CONNECTION_FAILED'
  | 'AUTH_REJECTED'
  | 'PROTOCOL_MISMATCH'
  | 'TIMEOUT'
  | 'NETWORK_ERROR';

export class GatewayConnectionError extends Error {
  constructor(
    message: string,
    public code: GatewayErrorCode,
    public retryable: boolean = true,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'GatewayConnectionError';
  }
}

export class GatewayConnection {
  private ws: WebSocket | null = null;
  private config: GatewayConnectionConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private tickWatchInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = 0;
  private tickIntervalMs = 30000;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: GatewayConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const url = this.config.gatewayUrl || this.buildGatewayUrl();

    this.config.onStatusChange('connecting');

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;

      // Connection timeout
      this.connectTimer = setTimeout(() => {
        const error = new GatewayConnectionError(
          'Connection timeout - gateway may be offline',
          'TIMEOUT',
          true,
          this.reconnectDelay * 2,
        );
        this.config.onStatusChange('error');
        this.config.onError(error);
        this.connectReject?.(error);
        this.connectResolve = null;
        this.connectReject = null;
        this.ws?.close();
      }, CONNECT_TIMEOUT_MS);

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          // Don't resolve yet - wait for challenge -> connect -> hello-ok handshake
          // Server will send connect.challenge event first
        };

        this.ws.onmessage = (event) => {
          this.handleFrame(event.data);
        };

        this.ws.onerror = () => {
          const error = new GatewayConnectionError(
            'WebSocket connection error',
            'NETWORK_ERROR',
            true,
          );
          this.config.onError(error);
        };

        this.ws.onclose = () => {
          this.stopTickWatch();
          this.clearConnectTimer();
          this.rejectPendingRequests('Connection closed');
          this.config.onStatusChange('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        this.clearConnectTimer();
        this.config.onStatusChange('error');
        reject(error);
      }
    });
  }

  private handleFrame(data: string): void {
    let frame: GatewayFrame;
    try {
      frame = JSON.parse(data);
    } catch {
      console.error('[Gateway] Failed to parse frame:', data);
      return;
    }

    switch (frame.type) {
      case 'event':
        this.handleEvent(frame);
        break;
      case 'res':
        this.handleResponse(frame);
        break;
      case 'req':
        // Server-initiated requests (rare) - acknowledge
        this.sendFrame({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: { status: 'acknowledged' },
        });
        break;
      default:
        // Legacy message handling for backward compatibility
        this.handleLegacyMessage(frame as unknown as Record<string, unknown>);
    }
  }

  private handleEvent(frame: EventFrame): void {
    switch (frame.event) {
      case 'connect.challenge':
        // Server sent challenge - respond with connect request
        this.sendConnectRequest(frame.payload?.nonce as string);
        break;

      case 'tick':
        this.lastTickTime = Date.now();
        // Map tick to heartbeat for consumers
        this.config.onMessage({
          type: 'heartbeat',
          timestamp: (frame.payload?.ts as number) || Date.now(),
        });
        break;

      case 'chat.event':
        this.mapChatEvent(frame.payload || {});
        break;

      case 'agent.event':
        this.mapAgentEvent(frame.payload || {});
        break;

      case 'shutdown':
        this.config.onError(new GatewayConnectionError(
          'Server shutting down',
          'CONNECTION_FAILED',
          true,
          5000,
        ));
        break;

      default:
        // Forward unknown events as generic messages
        if (frame.payload) {
          this.config.onMessage({
            type: 'complete',
            content: JSON.stringify(frame.payload),
            timestamp: Date.now(),
          });
        }
    }
  }

  private handleResponse(frame: ResponseFrame): void {
    const pending = this.pendingRequests.get(frame.id);

    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(frame.id);

      if (frame.ok) {
        pending.resolve(frame.payload);
      } else {
        const errorMsg = frame.error?.message || 'Request failed';
        pending.reject(new GatewayConnectionError(
          errorMsg,
          this.mapErrorCode(frame.error?.code),
          frame.error?.retryable ?? false,
          frame.error?.retryAfterMs,
        ));
      }
      return;
    }

    // Handle hello-ok response (connection handshake completion)
    if (frame.ok && (frame.payload as Record<string, unknown>)?.type === 'hello-ok') {
      this.onConnected(frame.payload || {});
      return;
    }

    // Handle connection rejection
    if (!frame.ok && this.connectReject) {
      const errorMsg = frame.error?.message || 'Connection rejected';
      const code = this.mapErrorCode(frame.error?.code);
      const error = new GatewayConnectionError(errorMsg, code, false);
      this.clearConnectTimer();
      this.config.onStatusChange('error');
      this.config.onError(error);
      this.connectReject(error);
      this.connectResolve = null;
      this.connectReject = null;
    }
  }

  private sendConnectRequest(nonce?: string): void {
    const connectRequest: RequestFrame = {
      type: 'req',
      id: crypto.randomUUID(),
      method: 'connect',
      params: {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: 'webchat-ui',
          displayName: 'Helix Observatory',
          version: import.meta.env.VITE_APP_VERSION || '0.1.0',
          platform: this.detectPlatform(),
          mode: 'ui',
          instanceId: this.config.instanceKey,
        },
        role: 'operator',
        scopes: ['operator.admin'],
        auth: {
          token: this.config.authToken,
        },
        userAgent: navigator.userAgent,
      },
    };

    // Track this as a pending request so hello-ok response matches
    this.pendingRequests.set(connectRequest.id, {
      resolve: (payload) => this.onConnected(payload as Record<string, unknown>),
      reject: (error) => {
        this.clearConnectTimer();
        this.config.onStatusChange('error');
        this.config.onError(error);
        this.connectReject?.(error);
        this.connectResolve = null;
        this.connectReject = null;
      },
      timer: setTimeout(() => {
        this.pendingRequests.delete(connectRequest.id);
        const error = new GatewayConnectionError('Connect handshake timeout', 'TIMEOUT', true);
        this.config.onError(error);
        this.connectReject?.(error);
        this.connectResolve = null;
        this.connectReject = null;
      }, CONNECT_TIMEOUT_MS),
    });

    this.sendFrame(connectRequest);
  }

  private onConnected(payload: Record<string, unknown>): void {
    this.clearConnectTimer();

    // Extract policy from hello-ok
    const policy = payload.policy as Record<string, unknown> | undefined;
    if (policy?.tickIntervalMs) {
      this.tickIntervalMs = policy.tickIntervalMs as number;
    }

    this.lastTickTime = Date.now();
    this.startTickWatch();
    this.config.onStatusChange('connected');
    this.connectResolve?.();
    this.connectResolve = null;
    this.connectReject = null;
  }

  private mapChatEvent(payload: Record<string, unknown>): void {
    const eventType = payload.event as string || payload.type as string;
    const content = payload.content as string || payload.text as string;

    switch (eventType) {
      case 'thinking':
        this.config.onMessage({ type: 'thinking', content, timestamp: Date.now() });
        break;
      case 'tool_use':
      case 'tool_call':
        this.config.onMessage({
          type: 'tool_call',
          toolName: (payload.toolName || payload.name) as string,
          toolInput: (payload.toolInput || payload.input) as Record<string, unknown>,
          timestamp: Date.now(),
        });
        break;
      case 'tool_result':
        this.config.onMessage({
          type: 'tool_result',
          toolOutput: (payload.toolOutput || payload.output) as string,
          timestamp: Date.now(),
        });
        break;
      case 'complete':
      case 'done':
        this.config.onMessage({ type: 'complete', content, timestamp: Date.now() });
        break;
      case 'error':
        this.config.onMessage({
          type: 'error',
          error: content || payload.error as string,
          timestamp: Date.now(),
        });
        break;
      default:
        if (content) {
          this.config.onMessage({ type: 'complete', content, timestamp: Date.now() });
        }
    }
  }

  private mapAgentEvent(payload: Record<string, unknown>): void {
    this.mapChatEvent(payload);
  }

  private handleLegacyMessage(message: Record<string, unknown>): void {
    // Backward compatibility: handle messages that don't follow the frame protocol
    const type = message.type as string;
    if (['thinking', 'tool_call', 'tool_result', 'error', 'complete', 'heartbeat'].includes(type)) {
      this.config.onMessage(message as unknown as GatewayMessage);
    }
  }

  private startTickWatch(): void {
    const interval = Math.max(this.tickIntervalMs, 1000);
    this.tickWatchInterval = setInterval(() => {
      const gap = Date.now() - this.lastTickTime;
      if (gap > this.tickIntervalMs * 2.5) {
        console.warn(`[Gateway] Tick timeout: ${Math.round(gap / 1000)}s since last tick`);
        this.ws?.close(4000, 'tick timeout');
      }
    }, interval);
  }

  private stopTickWatch(): void {
    if (this.tickWatchInterval) {
      clearInterval(this.tickWatchInterval);
      this.tickWatchInterval = null;
    }
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private rejectPendingRequests(reason: string): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.config.onError(new GatewayConnectionError(
        'Max reconnection attempts reached',
        'CONNECTION_FAILED',
        false,
      ));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
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

  private detectPlatform(): string {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) return 'darwin';
    if (ua.includes('win')) return 'win32';
    if (ua.includes('linux')) return 'linux';
    return 'unknown';
  }

  private mapErrorCode(code?: string): GatewayErrorCode {
    switch (code) {
      case 'UNAUTHORIZED':
      case 'AUTH_FAILED':
        return 'AUTH_REJECTED';
      case 'PROTOCOL_MISMATCH':
      case 'INVALID_PROTOCOL':
        return 'PROTOCOL_MISMATCH';
      case 'TIMEOUT':
        return 'TIMEOUT';
      default:
        return 'CONNECTION_FAILED';
    }
  }

  private sendFrame(frame: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  send(message: Record<string, unknown>): void {
    // Wrap legacy send calls as request frames if they have a method
    if (message.method && typeof message.method === 'string') {
      const reqFrame: RequestFrame = {
        type: 'req',
        id: crypto.randomUUID(),
        method: message.method as string,
        params: message.params || message,
      };
      this.sendFrame(reqFrame);
    } else {
      this.sendFrame(message);
    }
  }

  sendMessage(content: string): void {
    const reqFrame: RequestFrame = {
      type: 'req',
      id: crypto.randomUUID(),
      method: 'chat.send',
      params: { message: content },
    };
    this.sendFrame(reqFrame);
  }

  interrupt(): void {
    const reqFrame: RequestFrame = {
      type: 'req',
      id: crypto.randomUUID(),
      method: 'chat.abort',
      params: {},
    };
    this.sendFrame(reqFrame);
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new GatewayConnectionError(
          `Request timeout: ${method}`,
          'TIMEOUT',
          true,
        ));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });

      this.sendFrame({
        type: 'req',
        id,
        method,
        params,
      });
    });
  }

  disconnect(): void {
    this.stopTickWatch();
    this.clearConnectTimer();
    this.rejectPendingRequests('Disconnected');
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
