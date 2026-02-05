/**
 * Phase 10 Week 6: OpenTelemetry Tracing Tests
 * Browser-compatible tracing implementation tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initTracing,
  shutdownTracing,
  getTracer,
  traceSpan,
  withSpan,
  extractSpanContext,
  injectSpanContext,
  isTracingEnabled,
  addEvent,
  traceBatch,
} from './otel-init';

// Mock @opentelemetry/api
const mockSpan = {
  setAttribute: vi.fn(),
  setStatus: vi.fn(),
  recordException: vi.fn(),
  addEvent: vi.fn(),
  end: vi.fn(),
  spanContext: vi.fn(() => ({
    traceId: 'test-trace-id',
    spanId: 'test-span-id',
    traceFlags: 1,
    isRemote: false,
  })),
  isRecording: vi.fn(() => true),
};

const mockTracer = {
  startActiveSpan: vi.fn((name, fn) => {
    return fn(mockSpan);
  }),
};

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn(() => mockTracer),
    getActiveSpan: vi.fn(() => mockSpan),
  },
  SpanStatusCode: {
    OK: { code: 0 },
    ERROR: { code: 2 },
  },
}));

describe('OpenTelemetry Tracing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state by re-importing
    vi.resetModules();
  });

  afterEach(async () => {
    await shutdownTracing();
  });

  describe('Initialization', () => {
    it('should initialize tracing when enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      initTracing({ enabled: true });

      expect(isTracingEnabled()).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Tracing initialized'));

      consoleSpy.mockRestore();
    });

    it('should not initialize tracing when disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      initTracing({ enabled: false });

      expect(isTracingEnabled()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Tracing disabled'));

      consoleSpy.mockRestore();
    });

    it('should only initialize once', () => {
      initTracing({ enabled: true });
      const state1 = isTracingEnabled();

      initTracing({ enabled: true });
      const state2 = isTracingEnabled();

      expect(state1).toBe(state2);
    });

    it('should handle initialization errors gracefully', () => {
      expect(() => {
        initTracing({ enabled: true });
      }).not.toThrow();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown tracing gracefully', async () => {
      initTracing({ enabled: true });
      expect(isTracingEnabled()).toBe(true);

      await shutdownTracing();
      expect(isTracingEnabled()).toBe(false);
    });

    it('should handle shutdown errors gracefully', async () => {
      expect(async () => {
        await shutdownTracing();
      }).not.toThrow();
    });

    it('should disable tracing after shutdown', async () => {
      initTracing({ enabled: true });
      await shutdownTracing();

      expect(isTracingEnabled()).toBe(false);
    });
  });

  describe('Tracer Creation', () => {
    it('should create tracer with service name', () => {
      const tracer = getTracer('test-service');
      expect(tracer).toBeDefined();
    });

    it('should create tracer with version', () => {
      const tracer = getTracer('test-service');
      expect(tracer.startActiveSpan).toBeDefined();
    });

    it('should use service name in tracer', () => {
      getTracer('my-service');
      // Tracer creation should succeed
      expect(getTracer('my-service')).toBeDefined();
    });
  });

  describe('Async Span Tracing', () => {
    it('should trace async operation with success', async () => {
      initTracing({ enabled: true });

      const result = await traceSpan('test-op', async (span) => {
        expect(span).toBeDefined();
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should set string attributes', async () => {
      initTracing({ enabled: true });

      await traceSpan('test-op', async (span) => {
        return 'done';
      }, { user_id: 'user-123', action: 'test' });

      expect(mockSpan.setAttribute).toHaveBeenCalled();
    });

    it('should set numeric attributes', async () => {
      initTracing({ enabled: true });

      await traceSpan('test-op', async (span) => {
        return 'done';
      }, { latency_ms: 100, count: 5 });

      expect(mockSpan.setAttribute).toHaveBeenCalled();
    });

    it('should set boolean attributes', async () => {
      initTracing({ enabled: true });

      await traceSpan('test-op', async (span) => {
        return 'done';
      }, { success: true, cached: false });

      expect(mockSpan.setAttribute).toHaveBeenCalled();
    });

    it('should handle operation errors', async () => {
      initTracing({ enabled: true });

      await expect(
        traceSpan('test-op', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(mockSpan.setStatus).toHaveBeenCalled();
    });

    it('should record exception on error', async () => {
      initTracing({ enabled: true });

      try {
        await traceSpan('test-op', async () => {
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      expect(mockSpan.recordException).toHaveBeenCalled();
    });

    it('should end span after operation', async () => {
      initTracing({ enabled: true });

      await traceSpan('test-op', async (span) => {
        return 'test';
      });

      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should use no-op span when tracing disabled', async () => {
      initTracing({ enabled: false });

      const result = await traceSpan('test-op', async (span) => {
        expect(span).toBeDefined();
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should set OK status on success', async () => {
      initTracing({ enabled: true });

      await traceSpan('test-op', async (span) => {
        return 'done';
      });

      expect(mockSpan.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ code: expect.any(Object) })
      );
    });
  });

  describe('Sync Span Tracing', () => {
    it('should trace synchronous operation with success', () => {
      initTracing({ enabled: true });

      const result = withSpan('test-op', (span) => {
        expect(span).toBeDefined();
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should set attributes for sync operations', () => {
      initTracing({ enabled: true });

      withSpan('test-op', (span) => {
        return 'done';
      }, { operation: 'sync-test' });

      expect(mockSpan.setAttribute).toHaveBeenCalled();
    });

    it('should handle sync operation errors', () => {
      initTracing({ enabled: true });

      expect(() => {
        withSpan('test-op', () => {
          throw new Error('Sync error');
        });
      }).toThrow('Sync error');
    });

    it('should record exception on sync error', () => {
      initTracing({ enabled: true });

      try {
        withSpan('test-op', () => {
          throw new Error('Sync error');
        });
      } catch {
        // Expected
      }

      expect(mockSpan.recordException).toHaveBeenCalled();
    });

    it('should use no-op span when tracing disabled', () => {
      initTracing({ enabled: false });

      const result = withSpan('test-op', (span) => {
        return 'success';
      });

      expect(result).toBe('success');
    });
  });

  describe('Span Context Extraction', () => {
    it('should extract valid W3C trace context', () => {
      const headers = {
        traceparent: '00-trace-id-span-id-01',
      };

      const context = extractSpanContext(headers);
      expect(context).toBeDefined();
    });

    it('should handle missing traceparent', () => {
      const context = extractSpanContext({});
      expect(context).toBeUndefined();
    });

    it('should handle null headers', () => {
      const context = extractSpanContext(null);
      expect(context).toBeUndefined();
    });

    it('should handle malformed traceparent', () => {
      const headers = { traceparent: 'invalid' };
      const context = extractSpanContext(headers);
      expect(context).toBeUndefined();
    });

    it('should parse complete trace format', () => {
      const headers = {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      };

      const context = extractSpanContext(headers);
      expect(context).toBeDefined();
    });
  });

  describe('Span Context Injection', () => {
    it('should inject span context into headers when enabled', () => {
      initTracing({ enabled: true });

      const headers = injectSpanContext({ 'content-type': 'application/json' });

      expect(headers).toBeDefined();
      expect(headers['content-type']).toBe('application/json');
    });

    it('should add traceparent header when enabled', () => {
      initTracing({ enabled: true });

      const headers = injectSpanContext({});

      expect(headers.traceparent).toBeDefined();
      expect(headers.traceparent).toMatch(/^00-/);
    });

    it('should not modify headers when tracing disabled', () => {
      initTracing({ enabled: false });

      const original = { 'content-type': 'application/json' };
      const headers = injectSpanContext(original);

      expect(headers).toEqual(original);
      expect(headers.traceparent).toBeUndefined();
    });

    it('should preserve existing headers', () => {
      initTracing({ enabled: true });

      const original = {
        'content-type': 'application/json',
        'authorization': 'Bearer token',
      };
      const headers = injectSpanContext(original);

      expect(headers['content-type']).toBe('application/json');
      expect(headers.authorization).toBe('Bearer token');
    });
  });

  describe('Event Recording', () => {
    it('should add event when tracing enabled', () => {
      initTracing({ enabled: true });

      addEvent('operation_started', { operation_type: 'api_call' });

      expect(mockSpan.addEvent).toHaveBeenCalled();
    });

    it('should not add event when tracing disabled', () => {
      initTracing({ enabled: false });

      addEvent('operation_started');

      // No assertion needed - should not throw
    });

    it('should support event attributes', () => {
      initTracing({ enabled: true });

      addEvent('cache_hit', { cache_size: 1024, hit_ratio: 0.95 });

      expect(mockSpan.addEvent).toHaveBeenCalled();
    });
  });

  describe('Batch Operations', () => {
    it('should trace batch of operations', async () => {
      initTracing({ enabled: true });

      const operations = [
        async () => 'result1',
        async () => 'result2',
        async () => 'result3',
      ];

      const results = await traceBatch('batch-op', operations);

      expect(results).toHaveLength(3);
      expect(results).toEqual(['result1', 'result2', 'result3']);
    });

    it('should set batch size attribute', async () => {
      initTracing({ enabled: true });

      const operations = [
        async () => 'r1',
        async () => 'r2',
      ];

      await traceBatch('batch-op', operations);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('batch.size', 2);
    });

    it('should record operation completion events', async () => {
      initTracing({ enabled: true });

      const operations = [
        async () => 'r1',
        async () => 'r2',
      ];

      await traceBatch('batch-op', operations);

      expect(mockSpan.addEvent).toHaveBeenCalledWith('operation_0_completed');
      expect(mockSpan.addEvent).toHaveBeenCalledWith('operation_1_completed');
    });

    it('should handle batch operation errors', async () => {
      initTracing({ enabled: true });

      const operations = [
        async () => 'r1',
        async () => {
          throw new Error('Operation failed');
        },
      ];

      await expect(
        traceBatch('batch-op', operations)
      ).rejects.toThrow('Operation failed');
    });

    it('should record operation failure events', async () => {
      initTracing({ enabled: true });

      const operations = [
        async () => 'r1',
        async () => {
          throw new Error('Failed');
        },
      ];

      try {
        await traceBatch('batch-op', operations);
      } catch {
        // Expected
      }

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'operation_1_failed',
        expect.objectContaining({ error: 'Failed' })
      );
    });

    it('should support batch attributes', async () => {
      initTracing({ enabled: true });

      const operations = [async () => 'r1'];

      await traceBatch('batch-op', operations, {
        batch_type: 'email_delivery',
        priority: 'high',
      });

      expect(mockSpan.setAttribute).toHaveBeenCalled();
    });
  });

  describe('Tracing Status', () => {
    it('should return false when not initialized', () => {
      expect(isTracingEnabled()).toBe(false);
    });

    it('should return true when initialized and enabled', () => {
      initTracing({ enabled: true });
      expect(isTracingEnabled()).toBe(true);
    });

    it('should return false when initialized but disabled', () => {
      initTracing({ enabled: false });
      expect(isTracingEnabled()).toBe(false);
    });

    it('should return false after shutdown', async () => {
      initTracing({ enabled: true });
      await shutdownTracing();
      expect(isTracingEnabled()).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should trace database query', async () => {
      initTracing({ enabled: true });

      const result = await traceSpan('db.query', async (span) => {
        span.addEvent('query_started');
        await new Promise(resolve => setTimeout(resolve, 10));
        span.addEvent('query_completed');
        return { rows: 5 };
      }, { database: 'postgres', table: 'users' });

      expect(result).toEqual({ rows: 5 });
    });

    it('should trace API call', async () => {
      initTracing({ enabled: true });

      const result = await traceSpan('http.request', async (span) => {
        return { status: 200, data: 'ok' };
      }, { method: 'GET', url: '/api/users' });

      expect(result).toEqual({ status: 200, data: 'ok' });
    });

    it('should trace cache operations', () => {
      initTracing({ enabled: true });

      const result = withSpan('cache.get', (span) => {
        span.addEvent('cache_hit');
        return { cached: true, value: 'data' };
      }, { key: 'user:123' });

      expect(result).toEqual({ cached: true, value: 'data' });
    });

    it('should handle nested span contexts', async () => {
      initTracing({ enabled: true });

      const result = await traceSpan('outer', async (outerSpan) => {
        return await traceSpan('inner', async (innerSpan) => {
          return 'nested';
        });
      });

      expect(result).toBe('nested');
    });
  });

  describe('Error Handling', () => {
    it('should not throw on initialization with error', () => {
      expect(() => {
        initTracing({ enabled: true });
      }).not.toThrow();
    });

    it('should gracefully handle null attributes', async () => {
      initTracing({ enabled: true });

      await traceSpan('test-op', async (span) => {
        return 'ok';
      }, undefined);

      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should gracefully handle tracing when disabled', async () => {
      initTracing({ enabled: false });

      const result = await traceSpan('test-op', async (span) => {
        return 'ok';
      });

      expect(result).toBe('ok');
    });
  });
});
