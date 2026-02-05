/**
 * Gateway Protocol Types
 * Type definitions for gateway metrics and performance monitoring
 */

/**
 * Interface for gateway metrics collection
 */
export interface GatewayMetricsCollector {
  recordMetric(metric: Record<string, unknown>): void;
  getMetrics(): Record<string, unknown>[];
}
