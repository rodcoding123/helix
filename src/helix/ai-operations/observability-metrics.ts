/**
 * Observability Metrics - Phase 5
 *
 * Tracks SLA compliance, operation success rates, provider performance,
 * and budget variance for comprehensive system health monitoring.
 */

export interface OperationStats {
  operationType: string;
  totalOperations: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export interface ProviderStats {
  provider: string;
  totalOperations: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  avgCostPerOp: number;
}

export interface MetricSnapshot {
  timestamp: string;
  totalOperations: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  successRate: number;
}

interface OperationData {
  latencies: number[];
  successes: number;
  failures: number;
}

interface ProviderData {
  latencies: number[];
  successes: number;
  failures: number;
  totalCostUsd: number;
}

const SLA_TARGETS = {
  premium: 0.9999, // 99.99%
  standard: 0.99, // 99%
};

export class ObservabilityMetrics {
  private operationMetrics: Map<string, OperationData> = new Map();
  private providerMetrics: Map<string, ProviderData> = new Map();
  private snapshots: MetricSnapshot[] = [];

  /**
   * Record successful operation
   */
  recordOperationSuccess(operationType: string, latencyMs: number): void {
    if (!this.operationMetrics.has(operationType)) {
      this.operationMetrics.set(operationType, {
        latencies: [],
        successes: 0,
        failures: 0,
      });
    }

    const data = this.operationMetrics.get(operationType)!;
    data.latencies.push(latencyMs);
    data.successes++;
  }

  /**
   * Record failed operation
   */
  recordOperationFailure(operationType: string, _errorType: string): void {
    if (!this.operationMetrics.has(operationType)) {
      this.operationMetrics.set(operationType, {
        latencies: [],
        successes: 0,
        failures: 0,
      });
    }

    const data = this.operationMetrics.get(operationType)!;
    data.failures++;
  }

  /**
   * Get operation statistics
   */
  getOperationStats(operationType: string): OperationStats | null {
    const data = this.operationMetrics.get(operationType);
    if (!data) {
      return null;
    }

    const totalOperations = data.successes + data.failures;
    const successRate = totalOperations === 0 ? 0 : data.successes / totalOperations;
    const avgLatency =
      data.latencies.length === 0
        ? 0
        : data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length;

    // Calculate p95 (95th percentile)
    const sorted = [...data.latencies].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    const p95Latency = sorted[Math.max(0, p95Index)] || 0;

    return {
      operationType,
      totalOperations,
      successCount: data.successes,
      failureCount: data.failures,
      successRate,
      avgLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
    };
  }

  /**
   * Record provider success
   */
  recordProviderSuccess(provider: string, latencyMs: number): void {
    if (!this.providerMetrics.has(provider)) {
      this.providerMetrics.set(provider, {
        latencies: [],
        successes: 0,
        failures: 0,
        totalCostUsd: 0,
      });
    }

    const data = this.providerMetrics.get(provider)!;
    data.latencies.push(latencyMs);
    data.successes++;
  }

  /**
   * Record provider failure
   */
  recordProviderFailure(provider: string, _errorType: string): void {
    if (!this.providerMetrics.has(provider)) {
      this.providerMetrics.set(provider, {
        latencies: [],
        successes: 0,
        failures: 0,
        totalCostUsd: 0,
      });
    }

    const data = this.providerMetrics.get(provider)!;
    data.failures++;
  }

  /**
   * Record provider cost
   */
  recordProviderCost(provider: string, costUsd: number): void {
    if (!this.providerMetrics.has(provider)) {
      this.providerMetrics.set(provider, {
        latencies: [],
        successes: 0,
        failures: 0,
        totalCostUsd: 0,
      });
    }

    const data = this.providerMetrics.get(provider)!;
    data.totalCostUsd += costUsd;
  }

  /**
   * Get provider statistics
   */
  getProviderStats(provider: string): ProviderStats | null {
    // Check operation metrics first (highest priority)
    const opData = this.operationMetrics.get(provider);

    // Check provider metrics second
    const providerData = this.providerMetrics.get(provider);

    // If neither exists, return null
    if (!opData && !providerData) {
      return null;
    }

    // Use operation data if available, otherwise use provider data
    let successes = 0;
    let failures = 0;
    let latencies: number[] = [];
    let totalCostUsd = 0;

    if (opData) {
      successes = opData.successes;
      failures = opData.failures;
      latencies = opData.latencies;
    }

    if (providerData) {
      // Only override if we don't have operation data
      if (!opData) {
        successes = providerData.successes;
        failures = providerData.failures;
        latencies = providerData.latencies;
      }
      totalCostUsd = providerData.totalCostUsd;
    }

    const totalOperations = successes + failures;
    const successRate = totalOperations === 0 ? 0 : successes / totalOperations;
    const avgLatency =
      latencies.length === 0 ? 0 : latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const avgCostPerOp = totalOperations === 0 ? 0 : totalCostUsd / totalOperations;

    return {
      provider,
      totalOperations,
      successCount: successes,
      failureCount: failures,
      successRate,
      avgLatencyMs: avgLatency,
      avgCostPerOp,
    };
  }

  /**
   * Calculate SLA compliance for tier
   */
  getSLACompliance(_slaTier: 'premium' | 'standard'): number {
    // Aggregate all operations and calculate overall success rate
    let totalSuccesses = 0;
    let totalOperations = 0;

    for (const data of this.operationMetrics.values()) {
      totalSuccesses += data.successes;
      totalOperations += data.successes + data.failures;
    }

    return totalOperations === 0 ? 1.0 : totalSuccesses / totalOperations;
  }

  /**
   * Get SLA target for tier
   */
  getSLATarget(slaTier: 'premium' | 'standard'): number {
    return SLA_TARGETS[slaTier];
  }

  /**
   * Calculate budget variance (actual vs predicted)
   */
  calculateBudgetVariance(predictedUsd: number, actualUsd: number): number {
    if (predictedUsd === 0) {
      return 0;
    }

    return (actualUsd - predictedUsd) / predictedUsd;
  }

  /**
   * Create metric snapshot
   */
  createSnapshot(): MetricSnapshot {
    let totalSuccesses = 0;
    let totalFailures = 0;
    const allLatencies: number[] = [];

    for (const data of this.operationMetrics.values()) {
      totalSuccesses += data.successes;
      totalFailures += data.failures;
      allLatencies.push(...data.latencies);
    }

    const totalOperations = totalSuccesses + totalFailures;
    const avgLatency =
      allLatencies.length === 0 ? 0 : allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;

    const snapshot: MetricSnapshot = {
      timestamp: new Date().toISOString(),
      totalOperations,
      successCount: totalSuccesses,
      failureCount: totalFailures,
      avgLatencyMs: avgLatency,
      successRate: totalOperations === 0 ? 1.0 : totalSuccesses / totalOperations,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.operationMetrics.clear();
    this.providerMetrics.clear();
    this.snapshots = [];
  }
}
