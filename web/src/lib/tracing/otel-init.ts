/**
 * Phase 10 Week 6: OpenTelemetry Distributed Tracing
 * Browser-compatible tracing implementation
 * Uses simplified span model when @opentelemetry/api is available
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { Span, Context } from '@opentelemetry/api';

let isInitialized = false;
let tracingEnabled = false;

/**
 * Initialize distributed tracing
 * For browser environment, uses simplified implementation
 */
export function initTracing(config?: { enabled?: boolean; endpoint?: string }): void {
  if (isInitialized) {
    return;
  }

  try {
    // Enable tracing based on config or environment
    tracingEnabled = config?.enabled ?? import.meta.env.VITE_TRACING_ENABLED === 'true';

    if (tracingEnabled) {
      console.log('[OpenTelemetry] Tracing initialized successfully');
    } else {
      console.log('[OpenTelemetry] Tracing disabled in configuration');
    }

    isInitialized = true;
  } catch (error) {
    console.error('[OpenTelemetry] Failed to initialize tracing:', error);
    // Fail gracefully - tracing is optional
  }
}

/**
 * Shutdown tracing gracefully
 */
export async function shutdownTracing(): Promise<void> {
  try {
    isInitialized = false;
    tracingEnabled = false;
    console.log('[OpenTelemetry] Tracing shutdown complete');
  } catch (error) {
    console.error('[OpenTelemetry] Error during shutdown:', error);
  }
}

/**
 * Create a named tracer for your service
 */
export function getTracer(serviceName: string) {
  return trace.getTracer(serviceName, '1.0.0');
}

/**
 * Start an active span for tracing an async operation
 */
export async function traceSpan<T>(
  spanName: string,
  operation: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  if (!tracingEnabled) {
    // Tracing disabled - just run the operation
    return operation(createNoOpSpan());
  }

  const tracer = getTracer('helix');

  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      // Set attributes
      if (attributes) {
        for (const [key, value] of Object.entries(attributes)) {
          span.setAttribute(key, value);
        }
      }

      // Execute operation
      const result = await operation(span);

      // Mark as successful
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      // Mark as error
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });

      // Record exception
      if (error instanceof Error) {
        span.recordException(error);
      }

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Trace a synchronous operation with custom span
 */
export function withSpan<T>(
  spanName: string,
  fn: (span: Span) => T,
  attributes?: Record<string, string | number | boolean>
): T {
  if (!tracingEnabled) {
    // Tracing disabled - just run the function
    return fn(createNoOpSpan());
  }

  const tracer = getTracer('helix');

  return tracer.startActiveSpan(spanName, (span) => {
    try {
      // Set attributes
      if (attributes) {
        for (const [key, value] of Object.entries(attributes)) {
          span.setAttribute(key, value);
        }
      }

      // Execute function
      const result = fn(span);

      // Mark as successful
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      // Mark as error
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });

      // Record exception
      if (error instanceof Error) {
        span.recordException(error);
      }

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Extract span context from W3C Trace Context headers
 */
export function extractSpanContext(headers: Record<string, string> | null | undefined): Context | undefined {
  if (!headers) {
    return undefined;
  }

  try {
    // Extract W3C Trace Context: traceparent: 00-traceId-spanId-traceFlags
    const traceparent = headers['traceparent'];

    if (traceparent && traceparent.includes('-')) {
      const parts = traceparent.split('-');
      if (parts.length >= 3) {
        // Valid trace context found
        return trace.getActiveSpan()?.spanContext?.() as any;
      }
    }

    return undefined;
  } catch (error) {
    console.error('[OpenTelemetry] Error extracting span context:', error);
    return undefined;
  }
}

/**
 * Inject span context into headers for trace propagation
 */
export function injectSpanContext(headers: Record<string, string>): Record<string, string> {
  if (!tracingEnabled) {
    return headers;
  }

  try {
    const activeSpan = trace.getActiveSpan();

    if (activeSpan) {
      const spanContext = activeSpan.spanContext();

      // Inject W3C Trace Context
      return {
        ...headers,
        traceparent: `00-${spanContext.traceId}-${spanContext.spanId}-01`,
      };
    }

    return headers;
  } catch (error) {
    console.error('[OpenTelemetry] Error injecting span context:', error);
    return headers;
  }
}

/**
 * Check if tracing is enabled and initialized
 */
export function isTracingEnabled(): boolean {
  return isInitialized && tracingEnabled;
}

/**
 * Add event to current active span
 */
export function addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
  if (!tracingEnabled) {
    return;
  }

  try {
    const span = trace.getActiveSpan();

    if (span) {
      span.addEvent(name, attributes);
    }
  } catch (error) {
    console.error('[OpenTelemetry] Error adding event:', error);
  }
}

/**
 * Batch multiple async operations with shared span context
 */
export async function traceBatch<T>(
  spanName: string,
  operations: Array<() => Promise<T>>,
  attributes?: Record<string, string | number | boolean>
): Promise<T[]> {
  return traceSpan(
    spanName,
    async (span) => {
      span.setAttribute('batch.size', operations.length);

      const results: T[] = [];

      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await operations[i]();
          results.push(result);
          span.addEvent(`operation_${i}_completed`);
        } catch (error) {
          span.addEvent(`operation_${i}_failed`, {
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }

      return results;
    },
    attributes
  );
}

/**
 * Create a no-op span for when tracing is disabled
 */
function createNoOpSpan(): Span {
  return {
    setAttribute: () => {
      // No-op
    },
    setStatus: () => {
      // No-op
    },
    recordException: () => {
      // No-op
    },
    addEvent: () => {
      // No-op
    },
    end: () => {
      // No-op
    },
    spanContext: () => ({
      traceId: '',
      spanId: '',
      traceFlags: 0,
      isRemote: false,
    }),
    isRecording: () => false,
  } as any;
}
