/**
 * OpenClaw Gateway WebSocket Client
 * Implements the OpenClaw protocol for Helix Desktop
 */

// ============================================
// Type definitions for common gateway responses
// ============================================

export interface ExecApprovalSnapshot {
  approvals: Array<{
    id: string;
    command: string;
    actor?: string;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
    reason?: string;
  }>;
}

export interface ExecApprovalConfig {
  mode: 'strict' | 'permissive' | 'sandbox';
  requireApproval: boolean;
  auditLog?: boolean;
}

export interface BrowserSnapshot {
  open: boolean;
  lastUrl?: string;
  lastViewport?: { width: number; height: number };
  lastError?: string;
}

export interface SkillInfo {
  name: string;
  version?: string;
  description?: string;
  builtin?: boolean;
  enabled: boolean;
}

export interface ChannelStatus {
  [key: string]: { enabled: boolean; connected?: boolean };
}

export interface SessionInfo {
  id: string;
  created: number;
  lastActive: number;
  metadata?: unknown;
}

export interface NodeInfo {
  id: string;
  name?: string;
  status: 'online' | 'offline' | 'error';
  version?: string;
  capabilities?: string[];
}

export interface DeviceInfo {
  id: string;
  name: string;
  status: 'approved' | 'pending' | 'rejected';
  pairedAt?: number;
}

export interface ConfigResponse {
  config: Record<string, unknown>;
  environment?: Record<string, unknown>;
  hash?: string;
}

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

/**
 * Method alias map: translates desktop-friendly method names to actual gateway
 * protocol method names. This allows components to use semantic method names
 * while the client sends the correct protocol method.
 *
 * Format: { desktopMethod: actualGatewayMethod }
 */
const METHOD_ALIASES: Record<string, string> = {
  // Device management (desktop uses "devices.*", gateway uses "device.pair.*" / "device.token.*")
  'devices.list': 'device.pair.list',
  'devices.approve': 'device.pair.approve',
  'devices.deny': 'device.pair.reject',
  'devices.reject': 'device.pair.reject',
  'devices.revoke': 'device.token.revoke',
  'devices.rotate': 'device.token.rotate',

  // Node management (desktop uses "nodes.*", gateway uses "node.*")
  'nodes.discover': 'node.list',
  'nodes.list': 'node.list',
  'nodes.status': 'node.list',
  'nodes.describe': 'node.describe',
  'nodes.invoke': 'node.invoke',
  'nodes.rename': 'node.rename',

  // Exec approvals (desktop uses "exec.approval.snapshot", gateway uses "exec.approvals.get")
  'exec.approval.snapshot': 'exec.approvals.get',
  'exec.approval.configure': 'exec.approvals.set',

  // System (desktop uses "system.health", gateway uses "health")
  'system.health': 'health',
  'system.status': 'status',

  // Skills (desktop uses "skills.list", gateway has "skills.status")
  'skills.list': 'skills.status',

  // Models (desktop calls "models.scan" which doesn't exist - fall back to models.list)
  'models.scan': 'models.list',

  // Node pairing (normalize both naming conventions)
  'node.pair.request': 'node.pair.request',
  'node.pair.list': 'node.pair.list',
  'node.pair.approve': 'node.pair.approve',
  'node.pair.reject': 'node.pair.reject',
  'node.pair.verify': 'node.pair.verify',

  // Channels (desktop calls "channels.login" - not in gateway, route through config.patch)
  // These stay as-is since the gateway may add them later, and config.patch is used for writes

  // Memory search (desktop calls "memory_search" - route to memory.list_patterns as closest match)
  'memory_search': 'memory.list_patterns',
  'memory.search': 'memory.list_patterns',
};

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
  private eventListeners = new Map<string, Set<(evt: unknown) => void>>();

  constructor(private opts: GatewayClientOptions) {}

  /** Register event listener (for test compatibility) */
  on(event: string, handler: (evt: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  /** Unregister event listener (for test compatibility) */
  off(event: string, handler: (evt: unknown) => void): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  /** Emit event to all listeners */
  private emitEvent(event: string, data: unknown): void {
    this.eventListeners.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (err) {
        console.error(`[gateway-client] Event handler error for ${event}:`, err);
      }
    });
  }

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

  get role() {
    return this.opts.role ?? 'dual';
  }

  /** Alias for stop() - for test compatibility */
  disconnect(): void {
    this.stop();
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

      // Emit event to listeners (for test compatibility)
      this.emitEvent(evt.event, evt.payload ?? evt);

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
   * Send a request to the gateway.
   * Method names are transparently translated via METHOD_ALIASES so that
   * components can use semantic names (e.g. "devices.list") while the wire
   * protocol receives the actual method (e.g. "device.pair.list").
   */
  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('gateway not connected'));
    }

    // Resolve method alias (transparent to callers)
    const resolvedMethod = METHOD_ALIASES[method] ?? method;

    const id = crypto.randomUUID();
    const frame = { type: 'req', id, method: resolvedMethod, params };

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
    return this.request('node.describe', { nodeId: 'self' });
  }

  /**
   * Get node status for this client
   */
  async nodeStatus(): Promise<unknown> {
    return this.request('node.list');
  }

  // ============================================
  // Exec Approval API methods (typed)
  // ============================================

  /**
   * Get snapshot of pending exec approvals
   */
  async getExecApprovals(): Promise<ExecApprovalSnapshot> {
    return this.request('exec.approval.snapshot');
  }

  /**
   * Resolve (approve/reject) an exec approval
   */
  async resolveExecApproval(params: {
    approvalId: string;
    decision: 'approve' | 'reject';
    reason?: string;
  }): Promise<{ success: boolean }> {
    return this.request('exec.approval.resolve', params);
  }

  /**
   * Configure exec approval policy
   */
  async configureExecPolicy(params: ExecApprovalConfig): Promise<{ success: boolean }> {
    return this.request('exec.approval.configure', params);
  }

  // ============================================
  // Browser Automation API methods (typed)
  // ============================================

  /**
   * Start browser session
   */
  async browserStart(params?: { headless?: boolean }): Promise<{ sessionId: string }> {
    return this.request('browser.start', params);
  }

  /**
   * Stop browser session
   */
  async browserStop(params?: { sessionId?: string }): Promise<void> {
    return this.request('browser.stop', params);
  }

  /**
   * Get browser snapshot
   */
  async browserSnapshot(params?: { sessionId?: string }): Promise<BrowserSnapshot> {
    return this.request('browser.snapshot', params);
  }

  /**
   * Navigate to URL in browser
   */
  async browserNavigate(params: { url: string; sessionId?: string }): Promise<{ success: boolean }> {
    return this.request('browser.navigate', params);
  }

  // ============================================
  // Skills API methods (typed)
  // ============================================

  /**
   * Install a skill from ClawHub
   */
  async installSkill(params: { name: string; version?: string }): Promise<{ success: boolean }> {
    return this.request('skills.install', params);
  }

  /**
   * Uninstall a skill
   */
  async uninstallSkill(params: { name: string }): Promise<{ success: boolean }> {
    return this.request('skills.uninstall', params);
  }

  /**
   * Get list of installed skills
   */
  async getSkills(): Promise<SkillInfo[]> {
    return this.request('skills.list');
  }

  /**
   * Update skill configuration
   */
  async configureSkill(params: { name: string; config: unknown }): Promise<{ success: boolean }> {
    return this.request('skills.configure', params);
  }

  // ============================================
  // Channels API methods (typed)
  // ============================================

  /**
   * Login to a channel (e.g., Discord, Slack)
   */
  async channelLogin(params: { channel: string; credentials: unknown }): Promise<{ success: boolean }> {
    return this.request('channels.login', params);
  }

  /**
   * Logout from a channel
   */
  async channelLogout(params: { channel: string }): Promise<{ success: boolean }> {
    return this.request('channels.logout', params);
  }

  /**
   * Get channel status
   */
  async getChannelStatus(): Promise<ChannelStatus> {
    return this.request('channels.status');
  }

  // ============================================
  // Sessions API methods (typed)
  // ============================================

  /**
   * List active sessions
   */
  async getSessions(): Promise<SessionInfo[]> {
    return this.request('sessions.list');
  }

  /**
   * Compact a session (optimize memory)
   */
  async compactSession(params: { sessionId: string }): Promise<{ success: boolean }> {
    return this.request('sessions.compact', params);
  }

  /**
   * Create a new session
   */
  async createSession(params?: { metadata?: unknown }): Promise<{ sessionId: string }> {
    return this.request('sessions.create', params);
  }

  // ============================================
  // Nodes API methods (typed)
  // ============================================

  /**
   * List available nodes
   */
  async getNodes(): Promise<NodeInfo[]> {
    return this.request('nodes.list');
  }

  /**
   * Invoke a command on a node
   */
  async invokeNode(params: { nodeId: string; command: string; args?: unknown }): Promise<unknown> {
    return this.request('nodes.invoke', params);
  }

  /**
   * Get node information
   */
  async getNodeInfo(params: { nodeId: string }): Promise<NodeInfo> {
    return this.request('nodes.describe', params);
  }

  // ============================================
  // Device API methods (typed)
  // ============================================

  /**
   * List paired devices
   */
  async listDevices(): Promise<DeviceInfo[]> {
    return this.request('devices.list');
  }

  /**
   * Approve a device pairing request
   */
  async approveDevice(params: { deviceId: string }): Promise<{ success: boolean }> {
    return this.request('devices.approve', params);
  }

  /**
   * Reject a device pairing request
   */
  async rejectDevice(params: { deviceId: string }): Promise<{ success: boolean }> {
    return this.request('devices.reject', params);
  }

  /**
   * Revoke a device token
   */
  async revokeDevice(params: { deviceId: string }): Promise<{ success: boolean }> {
    return this.request('devices.revoke', params);
  }

  // ============================================
  // Config API methods (typed)
  // ============================================

  /**
   * Get full gateway config
   */
  async getFullConfig(): Promise<ConfigResponse> {
    return this.request('config.get');
  }

  /**
   * Patch gateway config (optimistic concurrency via baseHash)
   */
  async patchFullConfig(params: {
    patch: Record<string, unknown>;
    baseHash?: string;
  }): Promise<ConfigResponse> {
    return this.request('config.patch', params);
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
