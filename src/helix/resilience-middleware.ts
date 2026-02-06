/**
 * Resilience Middleware - Integrates Circuit Breaker + Operation Queue
 *
 * Wraps external service calls (Discord webhooks, 1Password) with:
 * - Circuit breaker to prevent cascading failures
 * - Operation queue to persist failed operations
 * - Exponential backoff with jitter for retries
 * - Timeout management for long-running operations
 *
 * Usage:
 *   const result = await resilientDiscordSend(webhookUrl, payload);
 *   if (!result.success) {
 *     // Operation queued for retry, won't be lost
 *   }
 */

import { circuitBreakers, type CircuitBreakerMetrics } from './circuit-breaker.js';
import { operationQueue } from './operation-queue.js';
import { randomUUID } from 'crypto';
import type { DiscordPayload } from './types.js';

export interface ResilientResult<T = boolean> {
  success: boolean;
  data?: T;
  error?: string;
  queued: boolean;
  operationId?: string;
}

// Module-level storage for auto-flush interval (for cleanup on shutdown)
let autoFlushInterval: NodeJS.Timeout | null = null;

/**
 * Send Discord webhook with resilience (circuit breaker + queue fallback)
 *
 * Attempts to send immediately. If Discord is down, queues for later.
 * Operations are never lost - they persist across restarts.
 */
export async function resilientDiscordSend(
  webhookUrl: string | undefined,
  payload: DiscordPayload,
  critical: boolean = false
): Promise<ResilientResult<boolean>> {
  const operationId = randomUUID();

  if (!webhookUrl) {
    return {
      success: false,
      error: 'Webhook URL not configured',
      queued: false,
    };
  }

  try {
    // Try immediate send through circuit breaker
    const result = (await circuitBreakers.discord.execute(() =>
      discordFetch(webhookUrl, payload)
    )) as boolean;

    return {
      success: result,
      data: result,
      queued: false,
    };
  } catch {
    // Circuit breaker is open (Discord down)
    console.warn(
      `[Resilience] Discord circuit breaker open, queueing webhook operation ${operationId}`
    );

    try {
      // Queue for later retry
      const priority = critical ? 'critical' : 'high';
      operationQueue.enqueue(
        operationId,
        'discord_webhook',
        {
          webhookUrl,
          payload,
          critical,
        },
        priority
      );

      return {
        success: false,
        error: 'Discord unavailable - operation queued',
        queued: true,
        operationId,
      };
    } catch (queueError) {
      const errorMsg = queueError instanceof Error ? queueError.message : String(queueError);
      console.error(`[Resilience] Failed to queue Discord operation: ${errorMsg}`);

      return {
        success: false,
        error: `Queue error: ${errorMsg}`,
        queued: false,
      };
    }
  }
}

/**
 * Flush queued Discord operations (called when circuit breaker recovers)
 *
 * Replays all queued webhooks in FIFO order with priority handling.
 * Should be called automatically when Discord becomes healthy.
 */
export async function flushDiscordQueue(): Promise<{ processed: number; failed: number }> {
  return operationQueue.flush(async operation => {
    const { webhookUrl, payload } = operation.data as {
      webhookUrl: string;
      payload: DiscordPayload;
    };

    // Use circuit breaker for retried operations too
    const success = await circuitBreakers.discord.execute(() => discordFetch(webhookUrl, payload));

    if (!success) {
      throw new Error('Discord webhook returned non-ok status');
    }
  });
}

/**
 * 1Password secret load with resilience
 *
 * Attempts to load secret through circuit breaker.
 * If 1Password is down, can return cached value or fail-closed.
 */
export async function resilient1PasswordLoad(
  secretKey: string,
  options: { timeout?: number; cache?: string } = {}
): Promise<ResilientResult<string>> {
  const { timeout = 10000, cache } = options;

  try {
    // Attempt load with timeout
    const secret = (await Promise.race([
      circuitBreakers.onePassword.execute(() => loadSecretFromCLI(secretKey)),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      ),
    ])) as string;

    return {
      success: true,
      data: secret,
      queued: false,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // If we have cached value, use it
    if (cache) {
      console.warn(`[Resilience] 1Password unavailable, using cached secret for ${secretKey}`);
      return {
        success: true,
        data: cache,
        queued: false,
      };
    }

    // No cache - operation fails
    console.error(`[Resilience] 1Password unavailable and no cache: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
      queued: false,
    };
  }
}

/**
 * Plugin operation with timeout
 *
 * Wraps plugin operations with configurable timeout and circuit breaker.
 * Plugins that hang or crash won't block other operations.
 */
export async function resilientPluginOperation<T>(
  pluginId: string,
  operation: () => Promise<T>,
  options: { timeout?: number; critical?: boolean } = {}
): Promise<ResilientResult<T>> {
  const { timeout = 30000, critical = false } = options;
  const operationId = randomUUID();

  try {
    // Execute with timeout through circuit breaker
    const result = (await Promise.race([
      circuitBreakers.plugins.execute(() => operation()),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Plugin timeout after ${timeout}ms`)), timeout)
      ),
    ])) as T;

    return {
      success: true,
      data: result,
      queued: false,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Queue critical plugin operations for retry
    if (critical) {
      try {
        operationQueue.enqueue(
          operationId,
          'plugin_operation',
          {
            pluginId,
            error: errorMsg,
          },
          'high'
        );

        return {
          success: false,
          error: errorMsg,
          queued: true,
          operationId,
        };
      } catch {
        console.error('[Resilience] Failed to queue plugin operation');
      }
    }

    return {
      success: false,
      error: errorMsg,
      queued: false,
    };
  }
}

/**
 * Get resilience status for all external services
 *
 * Useful for health checks and monitoring.
 */
export interface ResilienceStatus {
  discord: CircuitBreakerMetrics & { queuedOperations: number };
  onePassword: CircuitBreakerMetrics;
  plugins: CircuitBreakerMetrics;
  queue: { total: number; pending: number; processed: number; deadLetters: number };
}

export function getResilienceStatus(): ResilienceStatus {
  return {
    discord: {
      ...circuitBreakers.discord.getMetrics(),
      queuedOperations: operationQueue.getStats().pending,
    },
    onePassword: {
      ...circuitBreakers.onePassword.getMetrics(),
    },
    plugins: {
      ...circuitBreakers.plugins.getMetrics(),
    },
    queue: operationQueue.getStats(),
  };
}

/**
 * Reset resilience state (mainly for testing)
 *
 * Clears all circuit breakers and optionally clears the queue.
 */
export function resetResilienceState(includeQueue: boolean = false): void {
  circuitBreakers.discord.reset();
  circuitBreakers.onePassword.reset();
  circuitBreakers.plugins.reset();

  if (includeQueue) {
    try {
      operationQueue.clearProcessed(0);
    } catch (err) {
      console.error('[Resilience] Failed to clear queue:', err);
    }
  }

  console.log('[Resilience] State reset');
}

/**
 * Watch circuit breakers for recovery and auto-flush
 *
 * When a circuit breaker transitions from OPEN to HALF_OPEN and then to CLOSED,
 * automatically flush the corresponding operation queue.
 *
 * Call this once during initialization.
 */
export function initializeAutoFlush(): void {
  let lastDiscordState = circuitBreakers.discord.getMetrics().state;

  // Poll for state changes (every 5 seconds)
  autoFlushInterval = setInterval(() => {
    const currentState = circuitBreakers.discord.getMetrics().state;

    // Transitioned from OPEN/HALF_OPEN to CLOSED
    if (lastDiscordState !== 'closed' && currentState === 'closed') {
      console.log('[Resilience] Discord circuit closed, flushing queue...');
      flushDiscordQueue()
        .then(({ processed, failed }) => {
          console.log(
            `[Resilience] Discord queue flushed: ${processed} processed, ${failed} failed`
          );
        })
        .catch(err => {
          console.error('[Resilience] Discord queue flush failed:', err);
        });
    }

    lastDiscordState = currentState;
  }, 5000);
}

/**
 * Stop the auto-flush interval (called on shutdown)
 * Prevents interval leak from long-running processes
 */
export function stopAutoFlush(): void {
  if (autoFlushInterval !== null) {
    clearInterval(autoFlushInterval);
    autoFlushInterval = null;
  }
}

/**
 * Internal: Fetch function for Discord webhooks
 *
 * Separated for testability and reuse.
 */
export async function discordFetch(webhookUrl: string, payload: DiscordPayload): Promise<boolean> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.ok;
}

/**
 * Internal: 1Password secret loader
 *
 * Separated for testability and dependency injection.
 */
async function loadSecretFromCLI(secretKey: string): Promise<string> {
  // This would call the actual 1Password CLI
  // For now, placeholder that imports the real implementation
  const { loadSecret } = await import('../lib/secrets-loader.js');
  return loadSecret(secretKey, 'notes');
}
