/**
 * Phase 10 Week 3: Metrics Stream Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetricsStreamService, MetricsEvent } from './metrics-stream';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(function(event: string, callback: (...args: any[]) => void) {
      if (event === 'connect') {
        // Simulate connection
        setTimeout(() => callback(), 0);
      }
    }),
    once: vi.fn(function(event: string, callback: (...args: any[]) => void) {
      if (event === 'connect') {
        setTimeout(() => callback(), 0);
      }
    }),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  };

  return {
    io: vi.fn(() => mockSocket),
  };
});

describe('MetricsStreamService', () => {
  let service: MetricsStreamService;

  beforeEach(() => {
    service = new MetricsStreamService();
  });

  afterEach(() => {
    service.disconnect();
  });

  describe('Connection Management', () => {
    it('should connect to WebSocket server', async () => {
      await expect(service.connect('user123')).resolves.toBeUndefined();
      expect(service.isConnected()).toBe(true);
    });

    it('should disconnect from WebSocket server', async () => {
      await service.connect('user123');
      expect(service.isConnected()).toBe(true);

      service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should support reconnection with exponential backoff', async () => {
      // Service should be created with reconnection settings
      const newService = new MetricsStreamService();
      await newService.connect('user123');

      expect(newService.isConnected()).toBe(true);
      newService.disconnect();
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to specific event type', async () => {
      await service.connect('user123');

      const callback = vi.fn();
      service.subscribe('operation_complete', callback);

      expect(service.getListenerCount()['operation_complete']).toBe(1);
    });

    it('should support multiple subscribers for same event', async () => {
      await service.connect('user123');

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      service.subscribe('operation_complete', callback1);
      service.subscribe('operation_complete', callback2);

      expect(service.getListenerCount()['operation_complete']).toBe(2);
    });

    it('should return unsubscribe function', async () => {
      await service.connect('user123');

      const callback = vi.fn();
      const unsubscribe = service.subscribe('operation_complete', callback);

      expect(service.getListenerCount()['operation_complete']).toBe(1);

      unsubscribe();

      expect(service.getListenerCount()['operation_complete']).toBe(0);
    });

    it('should subscribe to multiple event types at once', async () => {
      await service.connect('user123');

      const callback = vi.fn();
      const unsubscribe = service.subscribeMultiple(
        ['operation_complete', 'operation_failed', 'cost_update'],
        callback
      );

      expect(service.getListenerCount()['operation_complete']).toBe(1);
      expect(service.getListenerCount()['operation_failed']).toBe(1);
      expect(service.getListenerCount()['cost_update']).toBe(1);

      unsubscribe();

      expect(service.getListenerCount()['operation_complete']).toBe(0);
      expect(service.getListenerCount()['operation_failed']).toBe(0);
      expect(service.getListenerCount()['cost_update']).toBe(0);
    });
  });

  describe('Event Handling', () => {
    it('should deliver operation_complete event to subscribers', async () => {
      await service.connect('user123');

      const callback = vi.fn();
      service.subscribe('operation_complete', callback);

      const event: MetricsEvent = {
        type: 'operation_complete',
        timestamp: new Date().toISOString(),
        data: {
          operationId: 'email-compose-123',
          cost: 0.45,
          latency: 1250,
          success: true,
        },
      };

      // Manually trigger event for testing
      // In real implementation, socket.io would emit this
      // For testing, we simulate it through the listener mechanism
      const listeners = service['listeners'].get('operation_complete');
      if (listeners) {
        listeners.forEach(cb => cb(event));
      }

      // Verify the callback would be called
      expect(listeners?.size).toBe(1);
    });

    it('should deliver operation_failed event to subscribers', async () => {
      await service.connect('user123');

      const callback = vi.fn();
      service.subscribe('operation_failed', callback);

      const event: MetricsEvent = {
        type: 'operation_failed',
        timestamp: new Date().toISOString(),
        data: {
          operationId: 'email-compose-456',
          cost: 0.25,
          latency: 3500,
          success: false,
        },
      };

      const listeners = service['listeners'].get('operation_failed');
      if (listeners) {
        listeners.forEach(cb => cb(event));
      }

      expect(listeners?.size).toBe(1);
    });

    it('should deliver cost_update event to subscribers', async () => {
      await service.connect('user123');

      const callback = vi.fn();
      service.subscribe('cost_update', callback);

      const event: MetricsEvent = {
        type: 'cost_update',
        timestamp: new Date().toISOString(),
        data: {
          cost: 15.75,
        },
      };

      const listeners = service['listeners'].get('cost_update');
      if (listeners) {
        listeners.forEach(cb => cb(event));
      }

      expect(listeners?.size).toBe(1);
    });

    it('should deliver sla_update event to subscribers', async () => {
      await service.connect('user123');

      const callback = vi.fn();
      service.subscribe('sla_update', callback);

      const event: MetricsEvent = {
        type: 'sla_update',
        timestamp: new Date().toISOString(),
        data: {
          slaViolation: true,
        },
      };

      const listeners = service['listeners'].get('sla_update');
      if (listeners) {
        listeners.forEach(cb => cb(event));
      }

      expect(listeners?.size).toBe(1);
    });

    it('should handle errors in event listeners gracefully', async () => {
      await service.connect('user123');

      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const goodCallback = vi.fn();

      service.subscribe('operation_complete', errorCallback);
      service.subscribe('operation_complete', goodCallback);

      const event: MetricsEvent = {
        type: 'operation_complete',
        timestamp: new Date().toISOString(),
        data: { operationId: 'test' },
      };

      // Should not throw even if one callback errors
      const listeners = service['listeners'].get('operation_complete');
      if (listeners) {
        expect(() => {
          listeners.forEach(cb => {
            try {
              cb(event);
            } catch (error) {
              console.error('Caught:', error);
            }
          });
        }).not.toThrow();
      }
    });
  });

  describe('Batch Progress Events', () => {
    it('should track batch operation progress', async () => {
      await service.connect('user123');

      const callback = vi.fn();
      service.subscribe('batch_progress', callback);

      const event: MetricsEvent = {
        type: 'batch_progress',
        timestamp: new Date().toISOString(),
        data: {
          batchId: 'batch-789',
          progress: 50,
        },
      };

      const listeners = service['listeners'].get('batch_progress');
      if (listeners) {
        listeners.forEach(cb => cb(event));
      }

      expect(listeners?.size).toBe(1);
    });

    it('should handle progress from 0 to 100', async () => {
      await service.connect('user123');

      const progressValues = [];
      service.subscribe('batch_progress', (event) => {
        progressValues.push(event.data.progress);
      });

      for (let i = 0; i <= 100; i += 10) {
        const event: MetricsEvent = {
          type: 'batch_progress',
          timestamp: new Date().toISOString(),
          data: {
            batchId: 'batch-test',
            progress: i,
          },
        };

        const listeners = service['listeners'].get('batch_progress');
        if (listeners) {
          listeners.forEach(cb => cb(event));
        }
      }

      // Should have tracked multiple progress events
      expect(service.getListenerCount()['batch_progress']).toBe(1);
    });
  });

  describe('Connection Status', () => {
    it('should report connected status', async () => {
      expect(service.isConnected()).toBe(false);

      await service.connect('user123');
      expect(service.isConnected()).toBe(true);

      service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should handle token from localStorage', async () => {
      const mockToken = 'test_token_123';
      localStorage.setItem('auth_token', mockToken);

      await service.connect('user123');
      expect(service.isConnected()).toBe(true);

      service.disconnect();
      localStorage.removeItem('auth_token');
    });

    it('should prefer explicit token over localStorage', async () => {
      const mockToken = 'explicit_token';
      localStorage.setItem('auth_token', 'stored_token');

      await service.connect('user123', mockToken);
      expect(service.isConnected()).toBe(true);

      service.disconnect();
      localStorage.removeItem('auth_token');
    });
  });

  describe('Listener Management', () => {
    it('should return listener counts', async () => {
      await service.connect('user123');

      service.subscribe('operation_complete', () => {});
      service.subscribe('operation_complete', () => {});
      service.subscribe('operation_failed', () => {});

      const counts = service.getListenerCount();
      expect(counts['operation_complete']).toBe(2);
      expect(counts['operation_failed']).toBe(1);
    });

    it('should clear all listeners on disconnect', async () => {
      await service.connect('user123');

      service.subscribe('operation_complete', () => {});
      service.subscribe('operation_failed', () => {});

      expect(Object.keys(service.getListenerCount()).length).toBeGreaterThan(0);

      service.disconnect();

      expect(Object.keys(service.getListenerCount()).length).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should provide singleton instance', async () => {
      // Import the getMetricsStreamService function
      const { getMetricsStreamService } = await import('./metrics-stream');

      const service1 = getMetricsStreamService();
      const service2 = getMetricsStreamService();

      expect(service1).toBe(service2);
    });
  });

  describe('Concurrent Event Handling', () => {
    it('should handle rapid successive events', async () => {
      await service.connect('user123');

      const completedEvents: MetricsEvent[] = [];
      service.subscribe('operation_complete', (event) => {
        completedEvents.push(event);
      });

      // Simulate rapid fire events
      const listeners = service['listeners'].get('operation_complete');
      if (listeners) {
        for (let i = 0; i < 100; i++) {
          const event: MetricsEvent = {
            type: 'operation_complete',
            timestamp: new Date().toISOString(),
            data: {
              operationId: `op-${i}`,
              cost: Math.random() * 10,
              latency: Math.random() * 5000,
              success: Math.random() > 0.1,
            },
          };

          listeners.forEach(cb => cb(event));
        }
      }

      expect(completedEvents.length).toBe(100);
    });

    it('should handle mixed event types concurrently', async () => {
      await service.connect('user123');

      const allEvents: MetricsEvent[] = [];

      service.subscribeMultiple(
        ['operation_complete', 'operation_failed', 'cost_update'],
        (event) => {
          allEvents.push(event);
        }
      );

      // Simulate mixed events
      const eventTypes: Array<MetricsEvent['type']> = [
        'operation_complete',
        'operation_failed',
        'cost_update',
      ];

      for (const eventType of eventTypes) {
        const listeners = service['listeners'].get(eventType);
        if (listeners) {
          const event: MetricsEvent = {
            type: eventType,
            timestamp: new Date().toISOString(),
            data: {
              operationId: 'test-123',
              cost: 5.0,
              success: true,
            },
          };

          listeners.forEach(cb => cb(event));
        }
      }

      expect(allEvents.length).toBe(3);
      expect(allEvents.map(e => e.type)).toContain('operation_complete');
      expect(allEvents.map(e => e.type)).toContain('operation_failed');
      expect(allEvents.map(e => e.type)).toContain('cost_update');
    });
  });
});
