/**
 * GatewayClient Unit Tests
 *
 * Core tests for WebSocket connection and method invocation.
 * Tests focus on integration with the gateway protocol v3.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GatewayClient } from '../gateway-client';
import { MockGatewayServer } from '../../__mocks__/gateway-server';

describe('GatewayClient', () => {
  let server: MockGatewayServer;

  beforeEach(() => {
    server = new MockGatewayServer('ws://localhost:8765');
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  describe('Initialization', () => {
    it('should create client instance', () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      expect(client).toBeDefined();
      expect(client.connected).toBe(false);
    });

    it('should accept custom options', () => {
      const client = new GatewayClient({
        url: 'ws://localhost:8765',
        token: 'test-token',
        role: 'operator',
      });
      expect(client).toBeDefined();
    });
  });

  describe('Connection', () => {
    it('should connect to gateway', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      client.start();

      // Wait for connection to establish
      await new Promise((resolve) => {
        const maxAttempts = 20;
        let attempts = 0;
        const checkConnection = () => {
          if (client.connected || attempts >= maxAttempts) {
            resolve(null);
          } else {
            attempts++;
            setTimeout(checkConnection, 50);
          }
        };
        checkConnection();
      });

      expect(client.connected).toBe(true);
      client.disconnect();
    });

    it('should emit connected event on successful connection', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      let emitted = false;
      client.on('connected', () => {
        emitted = true;
      });

      client.start();

      // Wait for connected event
      await new Promise((resolve) => {
        const maxAttempts = 20;
        let attempts = 0;
        const check = () => {
          if (emitted || attempts >= maxAttempts) {
            resolve(null);
          } else {
            attempts++;
            setTimeout(check, 50);
          }
        };
        check();
      });

      expect(emitted).toBe(true);
      client.disconnect();
    });

    it('should disconnect cleanly', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      client.start();

      // Wait for connection
      await new Promise((resolve) => {
        const maxAttempts = 20;
        let attempts = 0;
        const check = () => {
          if (client.connected || attempts >= maxAttempts) {
            resolve(null);
          } else {
            attempts++;
            setTimeout(check, 50);
          }
        };
        check();
      });

      expect(client.connected).toBe(true);

      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(client.connected).toBe(false);
    });
  });

  describe('Gateway Methods', () => {
    const waitForConnection = async (client: GatewayClient) => {
      return new Promise((resolve) => {
        const maxAttempts = 20;
        let attempts = 0;
        const check = () => {
          if (client.connected || attempts >= maxAttempts) {
            resolve(null);
          } else {
            attempts++;
            setTimeout(check, 50);
          }
        };
        check();
      });
    };

    it('should call health check method', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      client.start();
      await waitForConnection(client);

      const result = await client.request('health', {});
      expect((result as any).status).toBe('ok');
      expect((result as any).version).toBeDefined();

      client.disconnect();
    });

    it('should call config.get method', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      client.start();
      await waitForConnection(client);

      const result = await client.request('config.get', {});
      expect((result as any).config).toBeDefined();

      client.disconnect();
    });

    it('should call device.pair.list method', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      client.start();
      await waitForConnection(client);

      const result = await client.request('device.pair.list', {});
      expect((result as any).paired).toBeDefined();
      expect(Array.isArray((result as any).paired)).toBe(true);

      client.disconnect();
    });

    it('should call node.list method', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      client.start();
      await waitForConnection(client);

      const result = await client.request('node.list', {});
      expect((result as any).nodes).toBeDefined();
      expect(Array.isArray((result as any).nodes)).toBe(true);

      client.disconnect();
    });

    it('should call hooks.list method', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      client.start();
      await waitForConnection(client);

      const result = await client.request('hooks.list', {});
      expect((result as any).hooks).toBeDefined();

      client.disconnect();
    });
  });

  describe('Events', () => {
    const waitForConnection = async (client: GatewayClient) => {
      return new Promise((resolve) => {
        const maxAttempts = 20;
        let attempts = 0;
        const check = () => {
          if (client.connected || attempts >= maxAttempts) {
            resolve(null);
          } else {
            attempts++;
            setTimeout(check, 50);
          }
        };
        check();
      });
    };

    it('should register and trigger event listener', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      client.start();
      await waitForConnection(client);

      let eventReceived = false;
      client.on('test-event', () => {
        eventReceived = true;
      });

      server.triggerEvent('test-event', { data: 'test' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(eventReceived).toBe(true);

      client.disconnect();
    });

    it('should remove event listener', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      client.start();
      await waitForConnection(client);

      let eventReceived = false;
      const handler = () => {
        eventReceived = true;
      };

      client.on('test-event', handler);
      client.off('test-event', handler);

      server.triggerEvent('test-event', { data: 'test' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(eventReceived).toBe(false);

      client.disconnect();
    });

    it('should handle exec approval events', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      client.start();
      await waitForConnection(client);

      let approvalReceived = false;
      client.on('exec.approval.requested', () => {
        approvalReceived = true;
      });

      server.triggerEvent('exec.approval.requested', {
        requestId: 'req-001',
        command: 'test',
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(approvalReceived).toBe(true);

      client.disconnect();
    });
  });

  describe('Integration', () => {
    const waitForConnection = async (client: GatewayClient) => {
      return new Promise((resolve) => {
        const maxAttempts = 20;
        let attempts = 0;
        const check = () => {
          if (client.connected || attempts >= maxAttempts) {
            resolve(null);
          } else {
            attempts++;
            setTimeout(check, 50);
          }
        };
        check();
      });
    };

    it('should handle complete workflow: connect, request, disconnect', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });

      // Step 1: Connect
      client.start();
      await waitForConnection(client);
      expect(client.connected).toBe(true);

      // Step 2: Make a request
      const health = await client.request('health', {});
      expect((health as any).status).toBe('ok');

      // Step 3: Disconnect
      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(client.connected).toBe(false);
    });

    it('should support custom token authentication', async () => {
      const client = new GatewayClient({
        url: 'ws://localhost:8765',
        token: 'custom-token-123',
      });

      client.start();
      await waitForConnection(client);
      expect(client.connected).toBe(true);

      const result = await client.request('health', {});
      expect((result as any).status).toBe('ok');

      client.disconnect();
    });

    it('should support multiple gateway methods in sequence', async () => {
      const client = new GatewayClient({ url: 'ws://localhost:8765' });
      client.start();
      await waitForConnection(client);

      const results = await Promise.all([
        client.request('health', {}),
        client.request('config.get', {}),
        client.request('device.pair.list', {}),
        client.request('node.list', {}),
      ]);

      expect(results).toHaveLength(4);
      expect(results.every((r) => r !== undefined)).toBe(true);

      client.disconnect();
    });
  });
});
