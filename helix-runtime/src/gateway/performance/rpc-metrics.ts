/**
 * RPC Performance Metrics Monitoring
 *
 * Tracks and analyzes performance metrics for all Gateway RPC methods.
 * Monitors latency, payload size, device types, and sends alerts for slow operations.
 */

import type { GatewayMetricsCollector } from "../types.js";

/**
 * RPC method performance metric
 */
export interface RPCMetric {
  /** RPC method name (e.g., "email.list") */
  method: string;

  /** Request latency in milliseconds */
  latencyMs: number;

  /** Request payload size in bytes */
  payloadSizeBytes: number;

  /** Response payload size in bytes */
  responseSizeBytes?: number;

  /** When the metric was recorded */
  timestamp: number;

  /** Device type that made the request */
  deviceType: "ios" | "android" | "web" | "unknown";

  /** Session/client ID for tracking */
  clientId?: string;

  /** Whether the request succeeded */
  success: boolean;

  /** Error code if failed */
  errorCode?: string;
}

/**
 * Performance statistics for a method
 */
export interface MethodStatistics {
  method: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  averagePayloadBytes: number;
  lastUpdated: number;
}

/**
 * RPC Performance Monitor
 * Collects and analyzes performance metrics with alerting
 */
export class RPCPerformanceMonitor implements GatewayMetricsCollector {
  private metrics: RPCMetric[] = [];
  private statisticsCache: Map<string, MethodStatistics> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private alertThresholdMs = 500; // Alert if request takes > 500ms
  private slowQueryThresholdMs = 1000;
  private maxMetricsInMemory = 10000;

  constructor(
    private onAlert?: (alert: PerformanceAlert) => Promise<void>,
    private logger?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void },
  ) {}

  /**
   * Record a metric for an RPC method
   */
  async recordMetric(metric: RPCMetric): Promise<void> {
    // Store metric
    this.metrics.push(metric);

    // Maintain max size by removing oldest metrics
    if (this.metrics.length > this.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(this.metrics.length - this.maxMetricsInMemory);
    }

    // Invalidate cached statistics for this method
    this.statisticsCache.delete(metric.method);

    // Check for alerts
    if (metric.latencyMs > this.alertThresholdMs) {
      await this.sendAlert({
        type: "slow_rpc",
        severity: metric.latencyMs > this.slowQueryThresholdMs ? "critical" : "warning",
        method: metric.method,
        latencyMs: metric.latencyMs,
        threshold: this.alertThresholdMs,
        deviceType: metric.deviceType,
        timestamp: metric.timestamp,
      });
    }

    if (!metric.success && metric.errorCode) {
      await this.sendAlert({
        type: "rpc_error",
        severity: "warning",
        method: metric.method,
        errorCode: metric.errorCode,
        deviceType: metric.deviceType,
        timestamp: metric.timestamp,
      });
    }

    this.logger?.info(`RPC ${metric.method}: ${metric.latencyMs}ms (${metric.deviceType})`);
  }

  /**
   * Get percentile latency for a method
   */
  getPercentileLatency(method: string, percentile: number): number {
    const methodMetrics = this.metrics
      .filter((m) => m.method === method && m.success)
      .map((m) => m.latencyMs)
      .sort((a, b) => a - b);

    if (methodMetrics.length === 0) return 0;

    const index = Math.floor((percentile / 100) * methodMetrics.length);
    return methodMetrics[Math.min(index, methodMetrics.length - 1)];
  }

  /**
   * Get P95 latency for a method
   */
  getP95Latency(method: string): number {
    return this.getPercentileLatency(method, 95);
  }

  /**
   * Get P99 latency for a method
   */
  getP99Latency(method: string): number {
    return this.getPercentileLatency(method, 99);
  }

  /**
   * Get statistics for a method
   */
  getMethodStatistics(method: string): MethodStatistics | null {
    // Return cached if available
    if (this.statisticsCache.has(method)) {
      return this.statisticsCache.get(method)!;
    }

    const methodMetrics = this.metrics.filter((m) => m.method === method);
    if (methodMetrics.length === 0) return null;

    const successfulMetrics = methodMetrics.filter((m) => m.success);
    const latencies = successfulMetrics.map((m) => m.latencyMs).sort((a, b) => a - b);

    const stats: MethodStatistics = {
      method,
      totalRequests: methodMetrics.length,
      successfulRequests: successfulMetrics.length,
      failedRequests: methodMetrics.filter((m) => !m.success).length,
      averageLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p50LatencyMs: this.getPercentileLatency(method, 50),
      p95LatencyMs: this.getP95Latency(method),
      p99LatencyMs: this.getP99Latency(method),
      maxLatencyMs: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
      minLatencyMs: latencies.length > 0 ? latencies[0] : 0,
      averagePayloadBytes: methodMetrics.reduce((sum, m) => sum + m.payloadSizeBytes, 0) / methodMetrics.length,
      lastUpdated: Date.now(),
    };

    this.statisticsCache.set(method, stats);
    return stats;
  }

  /**
   * Get all method statistics
   */
  getAllMethodStatistics(): MethodStatistics[] {
    const methods = new Set(this.metrics.map((m) => m.method));
    const allStats: MethodStatistics[] = [];

    for (const method of methods) {
      const stats = this.getMethodStatistics(method as string);
      if (stats) {
        allStats.push(stats);
      }
    }

    return allStats;
  }

  /**
   * Get slowest methods (sorted by P95 latency)
   */
  getSlowestMethods(limit: number = 10): MethodStatistics[] {
    return this.getAllMethodStatistics()
      .sort((a, b) => b.p95LatencyMs - a.p95LatencyMs)
      .slice(0, limit);
  }

  /**
   * Get error rate by method
   */
  getErrorRates(): Map<string, number> {
    const methods = new Set(this.metrics.map((m) => m.method));
    const errorRates = new Map<string, number>();

    for (const method of methods) {
      const stats = this.getMethodStatistics(method as string);
      if (stats && stats.totalRequests > 0) {
        const errorRate = (stats.failedRequests / stats.totalRequests) * 100;
        if (errorRate > 0) {
          errorRates.set(method as string, errorRate);
        }
      }
    }

    return errorRates;
  }

  /**
   * Get device type distribution
   */
  getDeviceTypeDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {
      ios: 0,
      android: 0,
      web: 0,
      unknown: 0,
    };

    for (const metric of this.metrics) {
      distribution[metric.deviceType]++;
    }

    return distribution;
  }

  /**
   * Clear old metrics beyond retention period
   */
  clearOldMetrics(retentionHours: number = 24): void {
    const cutoffTime = Date.now() - retentionHours * 60 * 60 * 1000;
    const beforeCount = this.metrics.length;

    this.metrics = this.metrics.filter((m) => m.timestamp > cutoffTime);
    this.statisticsCache.clear();

    const removedCount = beforeCount - this.metrics.length;
    if (removedCount > 0) {
      this.logger?.info(`Cleared ${removedCount} old metrics`);
    }
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(format: "json" | "csv" = "json"): string {
    if (format === "csv") {
      const headers = ["method", "latencyMs", "payloadSizeBytes", "deviceType", "success", "timestamp"];
      const rows = this.metrics.map((m) => [m.method, m.latencyMs, m.payloadSizeBytes, m.deviceType, m.success, m.timestamp].join(","));

      return [headers.join(","), ...rows].join("\n");
    }

    // JSON format
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Send performance alert
   */
  private async sendAlert(alert: PerformanceAlert): Promise<void> {
    // Rate limit alerts per method (max 1 per minute)
    const lastAlert = this.lastAlertTime.get(alert.method) || 0;
    if (Date.now() - lastAlert < 60000) {
      return;
    }

    this.lastAlertTime.set(alert.method, Date.now());

    if (this.onAlert) {
      try {
        await this.onAlert(alert);
      } catch (error) {
        this.logger?.error(`Failed to send performance alert: ${error}`);
      }
    }

    this.logger?.warn(`PERFORMANCE ALERT: ${alert.type} - ${alert.method} (${alert.severity})`);
  }
}

/**
 * Performance alert sent when thresholds are exceeded
 */
export interface PerformanceAlert {
  type: "slow_rpc" | "rpc_error" | "high_memory" | "high_cpu";
  severity: "warning" | "critical";
  method: string;
  latencyMs?: number;
  threshold?: number;
  deviceType?: string;
  errorCode?: string;
  timestamp: number;
}

/**
 * Global instance
 */
let globalMonitor: RPCPerformanceMonitor | null = null;

/**
 * Get or create global monitor
 */
export function getGlobalRPCMonitor(): RPCPerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new RPCPerformanceMonitor();
  }
  return globalMonitor;
}
