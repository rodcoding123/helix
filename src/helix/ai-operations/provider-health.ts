/**
 * Provider Health Monitoring - Phase 4
 *
 * Tracks provider health metrics including success rate, latency, failure patterns,
 * and implements circuit breaker pattern for automatic failover.
 */

export type ProviderName = 'anthropic' | 'gemini' | 'deepgram' | 'elevenlabs';
export type CircuitStatus = 'closed' | 'open' | 'half-open';

export interface ProviderHealthMetrics {
  provider: ProviderName;
  isHealthy: boolean;
  successRate: number;
  totalOperations: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  circuitStatus: CircuitStatus;
  recentFailures: FailureRecord[];
  lastChecked: string;
}

export interface FailureRecord {
  timestamp: string;
  errorType: string;
  latencyMs: number;
}

interface ProviderState {
  successCount: number;
  failureCount: number;
  totalLatency: number;
  circuitStatus: CircuitStatus;
  circuitOpenedAt: number | null;
  recentFailures: FailureRecord[];
}

const CIRCUIT_BREAKER_THRESHOLD = 3; // Open circuit after 3 failures
const CIRCUIT_RECOVERY_WINDOW = 300; // 300ms for testing
const MAX_FAILURE_HISTORY = 10;

export class ProviderHealthMonitor {
  private providers: Map<ProviderName, ProviderState> = new Map();
  private readonly allProviders: ProviderName[] = ['anthropic', 'gemini', 'deepgram', 'elevenlabs'];

  constructor() {
    // Initialize all providers
    for (const provider of this.allProviders) {
      this.providers.set(provider, {
        successCount: 0,
        failureCount: 0,
        totalLatency: 0,
        circuitStatus: 'closed',
        circuitOpenedAt: null,
        recentFailures: [],
      });
    }
  }

  /**
   * Record successful operation
   */
  recordSuccess(provider: ProviderName, latencyMs: number): void {
    const state = this.getOrInitProvider(provider);
    state.successCount++;
    state.totalLatency += latencyMs;

    // Half-open circuit success → close it
    if (state.circuitStatus === 'half-open') {
      state.circuitStatus = 'closed';
      state.circuitOpenedAt = null;
    }
  }

  /**
   * Record failed operation
   */
  recordFailure(provider: ProviderName, errorType: string, latencyMs: number): void {
    const state = this.getOrInitProvider(provider);
    state.failureCount++;

    const failure: FailureRecord = {
      timestamp: new Date().toISOString(),
      errorType,
      latencyMs,
    };

    state.recentFailures.push(failure);
    if (state.recentFailures.length > MAX_FAILURE_HISTORY) {
      state.recentFailures.shift();
    }

    // Check circuit breaker threshold
    const consecutiveFailures = state.recentFailures.filter(
      f => f.timestamp > new Date(Date.now() - 5 * 60 * 1000).toISOString()
    ).length;

    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && state.circuitStatus === 'closed') {
      state.circuitStatus = 'open';
      state.circuitOpenedAt = Date.now();
    }
  }

  /**
   * Get current health metrics for a provider
   */
  getProviderHealth(provider: ProviderName): ProviderHealthMetrics {
    const state = this.getOrInitProvider(provider);

    // Check if circuit should transition to half-open
    if (state.circuitStatus === 'open' && state.circuitOpenedAt) {
      const elapsed = Date.now() - state.circuitOpenedAt;
      if (elapsed > CIRCUIT_RECOVERY_WINDOW) {
        state.circuitStatus = 'half-open';
      }
    }

    const total = state.successCount + state.failureCount;
    const successRate = total === 0 ? 1.0 : state.successCount / total;
    const avgLatency = state.successCount === 0 ? 0 : state.totalLatency / state.successCount;

    return {
      provider,
      isHealthy: state.circuitStatus !== 'open' && successRate > 0.5,
      successRate,
      totalOperations: total,
      successCount: state.successCount,
      failureCount: state.failureCount,
      avgLatencyMs: avgLatency,
      circuitStatus: state.circuitStatus,
      recentFailures: state.recentFailures,
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Get providers ranked by health (best first)
   */
  getRankedProviders(): ProviderHealthMetrics[] {
    return this.allProviders
      .map(provider => this.getProviderHealth(provider))
      .sort((a, b) => {
        // Providers with operations before those without
        const aHasOps = a.totalOperations > 0;
        const bHasOps = b.totalOperations > 0;
        if (aHasOps !== bHasOps) {
          return aHasOps ? -1 : 1;
        }

        // Among those with same operation status, healthy first
        if (a.isHealthy !== b.isHealthy) {
          return a.isHealthy ? -1 : 1;
        }

        // Then by success rate
        if (Math.abs(b.successRate - a.successRate) > 0.0001) {
          return b.successRate - a.successRate;
        }

        // Finally by provider name for stable ordering
        return a.provider.localeCompare(b.provider);
      });
  }

  /**
   * Reset metrics for a provider (for testing)
   */
  reset(provider?: ProviderName): void {
    if (provider) {
      this.providers.delete(provider);
      this.getOrInitProvider(provider);
    } else {
      this.providers.clear();
      for (const p of this.allProviders) {
        this.getOrInitProvider(p);
      }
    }
  }

  private getOrInitProvider(provider: ProviderName): ProviderState {
    if (!this.providers.has(provider)) {
      this.providers.set(provider, {
        successCount: 0,
        failureCount: 0,
        totalLatency: 0,
        circuitStatus: 'closed',
        circuitOpenedAt: null,
        recentFailures: [],
      });
    }
    return this.providers.get(provider)!;
  }
}
