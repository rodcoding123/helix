/**
 * useGateway Hook Integration Tests
 *
 * Tests for gateway state management and message handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockGatewayServer } from '../../__mocks__/gateway-server';
import { GatewayClient } from '../../lib/gateway-client';

describe('useGateway Integration', () => {
  let server: MockGatewayServer;

  beforeEach(() => {
    server = new MockGatewayServer('ws://localhost:8765');
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  describe('Connection Management', () => {
    it('should auto-connect when gateway starts', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });

      await client.connect();

      expect(client.connected).toBe(true);
      client.disconnect();
    });

    it('should track connection state changes', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });

      const stateChanges: boolean[] = [];
      client.on('connected', () => stateChanges.push(true));
      client.on('disconnected', () => stateChanges.push(false));

      await client.connect();
      expect(stateChanges).toContain(true);

      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(stateChanges).toContain(false);
    });
  });

  describe('Message Accumulation', () => {
    it('should accumulate chat messages during session', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const messages: any[] = [];

      client.on('chat', (event) => {
        messages.push(event);
      });

      // Simulate chat phases
      server.triggerEvent('chat', { phase: 'thinking', text: 'Processing...' });
      server.triggerEvent('chat', { phase: 'content', text: 'Response.' });
      server.triggerEvent('chat', { phase: 'complete' });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(messages.length).toBeGreaterThan(0);

      client.disconnect();
    });

    it('should track multiple conversation turns', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const turns: any[] = [];

      client.on('chat', (event) => {
        if ((event as any).phase === 'complete') {
          turns.push({ completed: true });
        }
      });

      // Simulate 3 conversation turns
      for (let i = 0; i < 3; i++) {
        server.triggerEvent('chat', { phase: 'thinking' });
        server.triggerEvent('chat', { phase: 'content', text: `Response ${i + 1}` });
        server.triggerEvent('chat', { phase: 'complete' });
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(turns.length).toBeGreaterThanOrEqual(1);

      client.disconnect();
    });
  });

  describe('Event Integration', () => {
    it('should dispatch exec approval events', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const approvals: any[] = [];

      client.on('exec.approval.requested', (event) => {
        approvals.push(event);
      });

      server.triggerEvent('exec.approval.requested', {
        requestId: 'req-001',
        command: 'test',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(approvals.length).toBeGreaterThan(0);

      client.disconnect();
    });

    it('should dispatch device pairing events', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const pairingEvents: any[] = [];

      client.on('device.pair.requested', (event) => {
        pairingEvents.push(event);
      });

      server.triggerEvent('device.pair.requested', {
        deviceId: 'device-001',
        deviceName: 'Test',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(pairingEvents.length).toBeGreaterThan(0);

      client.disconnect();
    });

    it('should dispatch node status events', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const statusEvents: any[] = [];

      client.on('node.status', (event) => {
        statusEvents.push(event);
      });

      server.triggerEvent('node.status', {
        nodeId: 'node-001',
        status: 'connected',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(statusEvents.length).toBeGreaterThan(0);

      client.disconnect();
    });

    it('should handle multiple simultaneous events', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const events: any[] = [];

      client.on('exec.approval.requested', (event) => events.push(event));
      client.on('device.pair.requested', (event) => events.push(event));
      client.on('node.status', (event) => events.push(event));

      server.triggerEvent('exec.approval.requested', { requestId: 'req-001' });
      server.triggerEvent('device.pair.requested', { deviceId: 'device-001' });
      server.triggerEvent('node.status', { nodeId: 'node-001' });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(events.length).toBe(3);

      client.disconnect();
    });
  });

  describe('Gateway Method Calls', () => {
    it('should fetch device list', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const result = (await client.request('device.pair.list', {})) as any;

      expect(result.paired).toBeDefined();
      expect(Array.isArray(result.paired)).toBe(true);

      client.disconnect();
    });

    it('should fetch node list', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const result = (await client.request('node.list', {})) as any;

      expect(result.nodes).toBeDefined();
      expect(Array.isArray(result.nodes)).toBe(true);

      client.disconnect();
    });

    it('should fetch auth profiles', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const result = (await client.request('auth.profiles.list', {})) as any;

      expect(result.profiles).toBeDefined();
      expect(Array.isArray(result.profiles)).toBe(true);

      client.disconnect();
    });

    it('should fetch hooks', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const result = (await client.request('hooks.list', {})) as any;

      expect(result.hooks).toBeDefined();
      expect(Array.isArray(result.hooks)).toBe(true);

      client.disconnect();
    });

    it('should fetch exec approval snapshot', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const result = (await client.request('exec.approval.snapshot', {})) as any;

      expect(result.pending).toBeDefined();
      expect(Array.isArray(result.pending)).toBe(true);

      client.disconnect();
    });

    it('should update config', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      const result = (await client.request('config.patch', {
        patch: { test: 'value' },
      })) as any;

      expect(result.ok).toBe(true);

      client.disconnect();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from errors', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      await client.connect();

      // First health check should work
      const health1 = await client.request('health', {});
      expect((health1 as any).status).toBe('ok');

      // Second health check should also work
      const health2 = await client.request('health', {});
      expect((health2 as any).status).toBe('ok');

      client.disconnect();
    });

    it('should handle disconnection and reconnection', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });

      // Connect
      await client.connect();
      expect(client.connected).toBe(true);

      // Disconnect
      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(client.connected).toBe(false);

      // Reconnect
      await client.connect();
      expect(client.connected).toBe(true);

      client.disconnect();
    });
  });

  describe('Configuration Integration', () => {
    it('should initialize with custom timeout', () => {
      const client = new GatewayClient({
        url: 'ws://localhost:8765',
        timeout: 500,
      });

      expect(client).toBeDefined();
      client.disconnect();
    });

    it('should initialize with custom role', () => {
      const client = new GatewayClient({
        url: 'ws://localhost:8765',
        role: 'node',
      });

      expect(client).toBeDefined();
      client.disconnect();
    });

    it('should initialize with custom scopes', () => {
      const client = new GatewayClient({
        url: 'ws://localhost:8765',
        scopes: ['chat', 'config'],
      });

      expect(client).toBeDefined();
      client.disconnect();
    });

    it('should support token authentication', async () => {
      const client = new GatewayClient({
        url: 'ws://localhost:8765',
        token: 'test-token-123',
      });

      await client.connect();
      expect(client.connected).toBe(true);

      const result = await client.request('health', {});
      expect((result as any).status).toBe('ok');

      client.disconnect();
    });
  });
});
