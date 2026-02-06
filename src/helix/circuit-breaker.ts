/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures when external services (Discord, 1Password) become unavailable.
 * Follows standard circuit breaker states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service detected as unhealthy, requests fail fast
 * - HALF_OPEN: Testing if service recovered, allowing limited requests
 */

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Failures before opening (default: 3)
  resetTimeoutMs?: number; // Time before attempting recovery (default: 60s)
  successThreshold?: number; // Successes to close circuit (default: 2)
}

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastStateChange: number;
}

/**
 * Generic circuit breaker for any async operation
 */
export class CircuitBreaker<T = unknown> {
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private lastStateChange = Date.now();

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly successThreshold: number;
  private readonly name: string;

  constructor(name: string, config: CircuitBreakerConfig = {}) {
    this.name = name;
    this.failureThreshold = config.failureThreshold ?? 3;
    this.resetTimeoutMs = config.resetTimeoutMs ?? 60000;
    this.successThreshold = config.successThreshold ?? 2;
  }

  /**
   * Execute an async operation through the circuit breaker
   * @throws Error if circuit is open or operation fails
   */
  async execute(fn: () => Promise<T>): Promise<T> {
    // If circuit is open, check if we should try recovery
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.transitionToHalfOpen();
      } else {
        throw new Error(
          `[${this.name}] Circuit breaker is OPEN (will retry in ${
            this.resetTimeoutMs - (Date.now() - this.lastFailureTime)
          }ms)`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      lastFailureTime: this.lastFailureTime || undefined,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.lastStateChange = Date.now();
    console.log(`[${this.name}] Circuit breaker reset`);
  }

  /**
   * Check if circuit is currently healthy
   */
  isHealthy(): boolean {
    return this.state === 'closed';
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state === 'closed') {
      // Maintain healthy state
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Failed during recovery attempt, reopen
      this.transitionToOpen();
    } else if (this.state === 'closed' && this.failureCount >= this.failureThreshold) {
      this.transitionToOpen();
    }
  }

  private transitionToOpen(): void {
    if (this.state !== 'open') {
      this.state = 'open';
      this.lastStateChange = Date.now();
      this.successCount = 0;
      console.warn(`[${this.name}] Circuit breaker OPEN - service unavailable`);
    }
  }

  private transitionToHalfOpen(): void {
    if (this.state !== 'half-open') {
      this.state = 'half-open';
      this.lastStateChange = Date.now();
      this.successCount = 0;
      this.failureCount = 0;
      console.log(`[${this.name}] Circuit breaker HALF-OPEN - testing recovery`);
    }
  }

  private transitionToClosed(): void {
    if (this.state !== 'closed') {
      this.state = 'closed';
      this.lastStateChange = Date.now();
      this.failureCount = 0;
      this.successCount = 0;
      console.log(`[${this.name}] Circuit breaker CLOSED - service recovered`);
    }
  }
}

/**
 * Global circuit breaker instances for common services
 */
export const circuitBreakers = {
  discord: new CircuitBreaker('Discord Webhooks', {
    failureThreshold: 3,
    resetTimeoutMs: 60000, // 1 minute
    successThreshold: 2,
  }),

  onePassword: new CircuitBreaker('1Password CLI', {
    failureThreshold: 2,
    resetTimeoutMs: 30000, // 30 seconds - 1Password usually recovers fast
    successThreshold: 1,
  }),

  plugins: new CircuitBreaker('Plugin Loading', {
    failureThreshold: 1, // Fail-fast for bad plugins
    resetTimeoutMs: 120000, // 2 minutes
    successThreshold: 1,
  }),
};
