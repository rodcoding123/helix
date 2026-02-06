/**
 * OpenClaw Gateway WebSocket Client
 * Implements the OpenClaw protocol for Helix Desktop
 */

export type GatewayEventFrame = {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
};

export type GatewayResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

export type GatewayHelloOk = {
  type: 'hello-ok';
  protocol: number;
  features?: { methods?: string[]; events?: string[] };
  snapshot?: unknown;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
  };
  policy?: { tickIntervalMs?: number };
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

export interface GatewayClientOptions {
  url: string;
  token?: string;
  password?: string;
  clientName?: string;
  clientVersion?: string;
  /** Connection role: operator-only, node-only, or dual (default: 'dual') */
  role?: 'operator' | 'node' | 'dual';
  /** Node capabilities to advertise (e.g. 'system', 'clipboard', 'screen') */
  caps?: string[];
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onClose?: (info: { code: number; reason: string }) => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  /** Called when the gateway dispatches a node.invoke event targeting this client */
  onNodeInvoke?: (req: { command: string; args?: unknown }) => void;
}

// Protocol version
const PROTOCOL_VERSION = 3;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: number | null = null;
  private backoffMs = 800;
  private reconnectTimer: number | null = null;

  constructor(private opts: GatewayClientOptions) {}

  /** Get the last received sequence number (for monitoring) */
  get lastReceivedSeq() {
    return this.lastSeq;
  }

  start() {
    this.closed = false;
    this.connect();
  }

  stop() {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error('gateway client stopped'));
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get url() {
    return this.opts.url;
  }

  private connect() {
    if (this.closed) return;

    try {
      this.ws = new WebSocket(this.opts.url);
    } catch (err) {
      this.opts.onError?.(err instanceof Error ? err : new Error(String(err)));
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => this.queueConnect();

    this.ws.onmessage = (ev) => this.handleMessage(String(ev.data ?? ''));

    this.ws.onclose = (ev) => {
      const reason = String(ev.reason ?? '');
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${ev.code}): ${reason}`));
      this.opts.onClose?.({ code: ev.code, reason });
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // Error details in close handler
    };
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }

  private async sendConnect() {
    if (this.connectSent) return;
    this.connectSent = true;

    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const auth = this.opts.token || this.opts.password
      ? { token: this.opts.token, password: this.opts.password }
      : undefined;

    // Determine roles and capabilities based on configuration
    const role = this.opts.role ?? 'dual';
    const caps = this.opts.caps ?? ['system', 'clipboard'];

    // Build scopes based on role
    const scopes: string[] = [];
    if (role === 'operator' || role === 'dual') {
      scopes.push('operator.read', 'operator.write', 'operator.admin');
    }
    if (role === 'node' || role === 'dual') {
      scopes.push('node.exec', 'node.read');
    }

    const params = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: this.opts.clientName ?? 'helix-desktop',
        version: this.opts.clientVersion ?? '1.0.0',
        platform: 'desktop',
        mode: role === 'dual' ? 'operator+node' : role,
      },
      role,
      scopes,
      caps,
      auth,
      userAgent: 'Helix Desktop/1.0.0',
      locale: navigator.language,
      // Include nonce from challenge if received
      ...(this.connectNonce && { nonce: this.connectNonce }),
    };

    try {
      const hello = await this.request<GatewayHelloOk>('connect', params);
      this.backoffMs = 800;
      this.opts.onHello?.(hello);
      this.opts.onConnected?.();
    } catch (err) {
      this.opts.onError?.(err instanceof Error ? err : new Error(String(err)));
      this.ws?.close(4008, 'connect failed');
    }
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: unknown };

    if (frame.type === 'event') {
      const evt = parsed as GatewayEventFrame;

      // Handle connect challenge
      if (evt.event === 'connect.challenge') {
        const payload = evt.payload as { nonce?: unknown } | undefined;
        const nonce = payload && typeof payload.nonce === 'string' ? payload.nonce : null;
        if (nonce) {
          this.connectNonce = nonce;
          void this.sendConnect();
        }
        return;
      }

      // Handle node invocations from the gateway
      if (evt.event === 'node.invoke') {
        try {
          this.opts.onNodeInvoke?.(evt.payload as { command: string; args?: unknown });
        } catch (err) {
          console.error('[gateway] node invoke handler error:', err);
        }
        return;
      }

      // Track sequence
      const seq = typeof evt.seq === 'number' ? evt.seq : null;
      if (seq !== null) {
        this.lastSeq = seq;
      }

      try {
        this.opts.onEvent?.(evt);
      } catch (err) {
        console.error('[gateway] event handler error:', err);
      }
      return;
    }

    if (frame.type === 'res') {
      const res = parsed as GatewayResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) return;
      this.pending.delete(res.id);
      if (res.ok) pending.resolve(res.payload);
      else pending.reject(new Error(res.error?.message ?? 'request failed'));
      return;
    }
  }

  /**
   * Send a request to the gateway
   */
  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('gateway not connected'));
    }

    const id = crypto.randomUUID();
    const frame = { type: 'req', id, method, params };

    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
    });

    this.ws.send(JSON.stringify(frame));
    return p;
  }

  private queueConnect() {
    this.connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer !== null) clearTimeout(this.connectTimer);
    // Wait briefly for challenge event, then send connect anyway
    this.connectTimer = window.setTimeout(() => {
      void this.sendConnect();
    }, 750);
  }

  // ============================================
  // High-level API methods
  // ============================================

  /**
   * Send a chat message
   */
  async chat(params: {
    content: string;
    sessionKey?: string;
    idempotencyKey?: string;
  }): Promise<{ runId: string; status: string }> {
    return this.request('chat.send', {
      content: params.content,
      sessionKey: params.sessionKey ?? 'default',
      idempotencyKey: params.idempotencyKey ?? crypto.randomUUID(),
    });
  }

  /**
   * Abort a running chat
   */
  async abort(params: { sessionKey?: string; runId?: string }): Promise<void> {
    return this.request('chat.abort', params);
  }

  /**
   * Get chat history
   */
  async getChatHistory(params: { sessionKey?: string; limit?: number }): Promise<unknown[]> {
    return this.request('chat.history', params);
  }

  /**
   * Get gateway health status
   */
  async health(): Promise<unknown> {
    return this.request('health');
  }

  /**
   * Get gateway status
   */
  async status(): Promise<unknown> {
    return this.request('status');
  }

  /**
   * Get available models
   */
  async listModels(): Promise<unknown> {
    return this.request('models.list');
  }

  /**
   * Get sessions list
   */
  async listSessions(): Promise<unknown> {
    return this.request('sessions.list');
  }

  /**
   * Get channels status
   */
  async channelsStatus(): Promise<unknown> {
    return this.request('channels.status');
  }

  /**
   * Get config
   */
  async getConfig(): Promise<unknown> {
    return this.request('config.get');
  }

  /**
   * Patch config
   */
  async patchConfig(params: { patch: object; baseHash?: string }): Promise<unknown> {
    return this.request('config.patch', params);
  }

  /**
   * Get skills list
   */
  async listSkills(): Promise<unknown> {
    return this.request('skills.list');
  }

  /**
   * Get presence (connected clients)
   */
  async getPresence(): Promise<unknown> {
    return this.request('system-presence');
  }

  // ============================================
  // Node API methods (available in dual/node mode)
  // ============================================

  /**
   * List available node capabilities for this client
   */
  async nodeCapabilities(): Promise<unknown> {
    return this.request('nodes.describe', { nodeId: 'self' });
  }

  /**
   * Get node status for this client
   */
  async nodeStatus(): Promise<unknown> {
    return this.request('nodes.status');
  }
}

// Singleton instance
let gatewayClient: GatewayClient | null = null;

export function getGatewayClient(): GatewayClient | null {
  return gatewayClient;
}

export function createGatewayClient(opts: GatewayClientOptions): GatewayClient {
  if (gatewayClient) {
    gatewayClient.stop();
  }
  gatewayClient = new GatewayClient(opts);
  return gatewayClient;
}
