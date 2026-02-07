/**
 * Mock WebSocket Server for Gateway Testing
 *
 * Simulates OpenClaw gateway responses for unit and integration testing.
 * Implements OpenClaw Protocol v3 message format.
 */

import { Server as MockWebSocketServer } from 'mock-socket';

export interface GatewayMessage {
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  type?: string;
  result?: unknown;
  error?: unknown;
}

export interface ConnectChallenge {
  type: 'challenge';
  challenge: string;
}

export interface HelloMessage {
  type: 'hello-ok';
  role: string;
  scopes: string[];
  version: string;
}

export class MockGatewayServer {
  private server: MockWebSocketServer;
  private clients: Set<any> = new Set();
  private messageHandlers: Map<string, (msg: GatewayMessage) => any> = new Map();

  constructor(url: string = 'ws://localhost:8765') {
    this.server = new MockWebSocketServer(url);

    this.server.on('connection', (socket) => {
      this.clients.add(socket);

      socket.on('message', (data: string | ArrayBuffer | Blob) => {
        try {
          const str = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
          const msg = JSON.parse(str);
          this.handleMessage(socket, msg);
        } catch (err) {
          console.error('[mock-gateway] Failed to parse message:', err);
        }
      });

      socket.on('close', () => {
        this.clients.delete(socket);
      });
    });

    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers(): void {
    // Health check
    this.messageHandlers.set('health', () => ({
      status: 'ok',
      uptime: 12345,
      version: '1.0.0',
    }));

    // Config methods
    this.messageHandlers.set('config.get', () => ({
      config: {
        agents: [],
        channels: {},
        tools: {},
        environment: {},
      },
    }));

    this.messageHandlers.set('config.patch', (msg) => ({
      ok: true,
      applied: msg.params?.patch || {},
    }));

    // Device methods
    this.messageHandlers.set('device.pair.list', () => ({
      pending: [],
      paired: [
        {
          id: 'device-001',
          name: 'iPhone',
          platform: 'ios',
          status: 'connected',
          role: 'node',
        },
      ],
    }));

    this.messageHandlers.set('device.pair.approve', () => ({
      ok: true,
      device: {
        id: 'device-001',
        name: 'iPhone',
        status: 'paired',
      },
    }));

    // Node methods
    this.messageHandlers.set('node.list', () => ({
      nodes: [
        {
          nodeId: 'node-001',
          displayName: 'iPhone',
          platform: 'ios',
          status: 'connected',
          lastSeen: Date.now(),
          capabilities: ['camera', 'microphone', 'screen'],
        },
      ],
    }));

    this.messageHandlers.set('node.describe', (msg) => ({
      nodeId: msg.params?.nodeId || 'node-001',
      displayName: 'iPhone',
      platform: 'ios',
      capabilities: ['camera', 'microphone', 'screen'],
      version: '1.0.0',
    }));

    // Auth profile methods
    this.messageHandlers.set('auth.profiles.list', () => ({
      profiles: [],
    }));

    // Hooks methods
    this.messageHandlers.set('hooks.list', () => ({
      hooks: [],
    }));

    // Exec approval methods
    this.messageHandlers.set('exec.approval.snapshot', () => ({
      pending: [],
      recent: [],
    }));
  }

  private handleMessage(socket: any, msg: GatewayMessage): void {
    // Handle connection
    if (msg.method === 'connect') {
      // Send challenge
      const challenge: ConnectChallenge = {
        type: 'challenge',
        challenge: 'mock-challenge-' + Date.now(),
      };
      socket.send(JSON.stringify(challenge));

      // After client responds with hello, send hello-ok
      const tempHandler = (data: string) => {
        try {
          const helloMsg = JSON.parse(data);
          if (helloMsg.type === 'hello') {
            const helloOk: HelloMessage = {
              type: 'hello-ok',
              role: 'gateway',
              scopes: ['chat', 'config', 'agents', 'admin'],
              version: '3.0.0',
            };
            socket.send(JSON.stringify(helloOk));
            socket.removeListener('message', tempHandler);
            // Re-add main handler
            socket.on('message', (msgData: string) => {
              this.handleMessage(socket, JSON.parse(msgData));
            });
          }
        } catch (err) {
          console.error('[mock-gateway] Failed to handle hello:', err);
        }
      };
      socket.once('message', tempHandler);
      return;
    }

    // Handle method calls
    if (msg.method) {
      const handler = this.messageHandlers.get(msg.method);
      if (handler) {
        const result = handler(msg);
        const response = {
          id: msg.id,
          result,
        };
        socket.send(JSON.stringify(response));
      } else {
        console.warn('[mock-gateway] Unknown method:', msg.method);
      }
      return;
    }
  }

  public registerHandler(
    method: string,
    handler: (msg: GatewayMessage) => any
  ): void {
    this.messageHandlers.set(method, handler);
  }

  public broadcast(event: any): void {
    const msg = JSON.stringify(event);
    this.clients.forEach((client) => {
      try {
        client.send(msg);
      } catch (err) {
        console.error('[mock-gateway] Failed to broadcast:', err);
      }
    });
  }

  public triggerEvent(eventName: string, data: any): void {
    this.broadcast({
      type: 'event',
      event: eventName,
      data,
      timestamp: Date.now(),
    });
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public close(): void {
    this.clients.forEach((client) => {
      try {
        client.close();
      } catch (err) {
        // Ignore close errors
      }
    });
    this.clients.clear();
    this.server.close();
  }
}
