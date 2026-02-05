/**
 * Performance Optimization Service for Phase 8
 * Implements caching, streaming, and batch scheduling for intelligence operations
 */

import { logToDiscord, logToHashChain } from './logging.js';

// MARK: - Cache Manager
export class CacheManager<T> {
  private cache = new Map<string, { value: T; timestamp: number }>();
  private ttlMs: number;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

// MARK: - Operation Cache Instances
export const emailOperationCache = new CacheManager<any>(10 * 60 * 1000); // 10 min
export const calendarOperationCache = new CacheManager<any>(5 * 60 * 1000); // 5 min
export const taskOperationCache = new CacheManager<any>(5 * 60 * 1000); // 5 min
export const analyticsOperationCache = new CacheManager<any>(15 * 60 * 1000); // 15 min

// MARK: - Stream Handler for Large Results
export class StreamHandler {
  private abortController = new AbortController();

  async streamResults<T>(
    handler: () => AsyncGenerator<T>,
    onChunk: (chunk: T) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      for await (const chunk of handler()) {
        if (this.abortController.signal.aborted) {
          break;
        }
        onChunk(chunk);
      }
      onComplete();
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  abort(): void {
    this.abortController.abort();
  }

  reset(): void {
    this.abortController = new AbortController();
  }
}

// MARK: - Batch Scheduler
export class BatchScheduler<T> {
  private queue: T[] = [];
  private processing = false;
  private batchSize: number;
  private batchDelayMs: number;

  constructor(batchSize: number = 10, batchDelayMs: number = 100) {
    this.batchSize = batchSize;
    this.batchDelayMs = batchDelayMs;
  }

  async schedule(items: T[], processor: (batch: T[]) => Promise<void>): Promise<void> {
    this.queue.push(...items);

    if (!this.processing) {
      await this.processBatch(processor);
    }
  }

  private async processBatch(processor: (batch: T[]) => Promise<void>): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);

      try {
        await processor(batch);
        await this.delay(this.batchDelayMs);
      } catch (error) {
        await logToDiscord({
          type: 'batch_processing_error',
          content: `Batch processing failed: ${error instanceof Error ? error.message : String(error)}`,
          status: 'error',
        });
      }
    }

    this.processing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

// MARK: - Request Deduplication
export class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async deduplicate<T>(
    key: string,
    request: () => Promise<T>
  ): Promise<T> {
    // Return existing pending request if available
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new request promise
    const promise = request().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  clear(): void {
    this.pendingRequests.clear();
  }

  size(): number {
    return this.pendingRequests.size;
  }
}

// MARK: - Retry Strategy with Exponential Backoff
export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxAttempts) {
        const delayMs = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelayMs
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));

        await logToDiscord({
          type: 'operation_retry',
          content: `Attempt ${attempt} failed, retrying after ${delayMs}ms`,
          metadata: { attempt, error: lastError.message },
          status: 'pending',
        });
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

// MARK: - Circuit Breaker Pattern
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringWindowMs: number;
}

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  monitoringWindowMs: 30000, // 30 seconds
};

export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailureTime || 0) > this.config.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      void logToDiscord({
        type: 'circuit_breaker_open',
        content: `Circuit breaker opened after ${this.failureCount} failures`,
        status: 'error',
      });
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}

// MARK: - Performance Metrics Tracker
export class PerformanceTracker {
  private metrics = new Map<string, number[]>();

  recordLatency(operation: string, latencyMs: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(latencyMs);
  }

  getAverageLatency(operation: string): number {
    const values = this.metrics.get(operation);
    if (!values || values.length === 0) return 0;

    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  getP95Latency(operation: string): number {
    const values = this.metrics.get(operation);
    if (!values || values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(values.length * 0.95) - 1;
    return sorted[index] || 0;
  }

  getP99Latency(operation: string): number {
    const values = this.metrics.get(operation);
    if (!values || values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(values.length * 0.99) - 1;
    return sorted[index] || 0;
  }

  getMetricsSummary(): Record<string, { avg: number; p95: number; p99: number; count: number }> {
    const summary: Record<string, any> = {};

    for (const [operation, values] of this.metrics.entries()) {
      summary[operation] = {
        avg: this.getAverageLatency(operation),
        p95: this.getP95Latency(operation),
        p99: this.getP99Latency(operation),
        count: values.length,
      };
    }

    return summary;
  }

  clear(): void {
    this.metrics.clear();
  }

  async reportMetrics(): Promise<void> {
    const summary = this.getMetricsSummary();

    await logToHashChain({
      type: 'performance_metrics',
      data: JSON.stringify(summary),
      metadata: {
        timestamp: new Date().toISOString(),
        operationCount: this.metrics.size,
      },
    });
  }
}

// MARK: - Global Performance Instances
export const performanceTracker = new PerformanceTracker();
export const deduplicator = new RequestDeduplicator();
export const emailCircuitBreaker = new CircuitBreaker({ failureThreshold: 5 });
export const calendarCircuitBreaker = new CircuitBreaker({ failureThreshold: 5 });
export const taskCircuitBreaker = new CircuitBreaker({ failureThreshold: 5 });
export const analyticsCircuitBreaker = new CircuitBreaker({ failureThreshold: 5 });

// MARK: - Optimization Utilities
export function withCaching<T>(
  cache: CacheManager<T>,
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }

  return fetcher().then((value) => {
    cache.set(key, value);
    return value;
  });
}

export async function withCircuitBreaker<T>(
  breaker: CircuitBreaker,
  operation: () => Promise<T>
): Promise<T> {
  return breaker.execute(operation);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  return retryWithBackoff(operation, options);
}

export async function withPerformanceTracking<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = Date.now();

  try {
    return await operation();
  } finally {
    const duration = Date.now() - start;
    performanceTracker.recordLatency(operationName, duration);
  }
}

// Combined optimization wrapper
export async function withFullOptimization<T>(
  operationName: string,
  cache: CacheManager<T>,
  cacheKey: string,
  breaker: CircuitBreaker,
  operation: () => Promise<T>,
  retryOptions?: Partial<RetryOptions>
): Promise<T> {
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  return withPerformanceTracking(operationName, async () => {
    return withCircuitBreaker(breaker, () => {
      return withRetry(operation, retryOptions);
    });
  }).then((result) => {
    cache.set(cacheKey, result);
    return result;
  });
}
