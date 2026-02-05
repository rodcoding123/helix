/**
 * Gateway Protocol Types
 * Type definitions for gateway metrics and performance monitoring
 */

/**
 * Interface for gateway metrics collection
 */
export interface GatewayMetricsCollector {
  recordMetric(metric: Record<string, unknown> | any): void | Promise<void>;
  getMetrics(): Record<string, unknown>[] | any[];
}

/**
 * Gateway WebSocket client
 */
export interface GatewayWsClient {
  connect(params: Record<string, unknown>): Promise<void>;
  disconnect(): void;
  userId?: string;
  deviceId?: string;
  send(data: unknown): void;
}
