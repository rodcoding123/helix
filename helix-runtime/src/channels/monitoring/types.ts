/**
 * Channel Monitoring Types
 *
 * Metrics collection, health tracking, and diagnostics for channels.
 * Real-time monitoring with 24-hour retention and hourly rollup.
 */

export interface ChannelMetrics {
  channel: string;
  accountId?: string;
  timestamp: number; // Hourly bucket timestamp
  messagesReceived: number;
  messagesSent: number;
  messagesFailed: number;
  mediaReceived: number;
  mediaSent: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  uptime: number; // Percentage 0-100
  errors: ChannelError[];
}

export interface ChannelError {
  timestamp: number;
  code: string;
  message: string;
  context?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: number;
}

export interface ConnectionEvent {
  timestamp: number;
  event: 'connected' | 'disconnected' | 'reconnecting' | 'error' | 'authenticated';
  reason?: string;
  durationMs?: number; // For reconnection events
}

export interface ChannelHealth {
  channel: string;
  accountId?: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastSeen: number;
  errorRate: number; // 0-1, messages failed / total
  latencyP95: number;
  uptime24h: number; // 0-100
  reconnecionCount24h: number;
  issues: HealthIssue[];
}

export interface HealthIssue {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  firstSeen: number;
  lastSeen: number;
  count: number;
}

export interface MetricsDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface ChannelMonitoringConfig {
  version: string;
  metrics: Map<string, ChannelMetrics[]>; // channel -> hourly metrics
  errors: Map<string, ChannelError[]>; // channel -> errors (24h)
  connectionHistory: Map<string, ConnectionEvent[]>; // channel -> events
  health: Map<string, ChannelHealth>; // channel -> current health
  globalSettings: {
    metricsRetentionHours: number; // Default: 24
    errorRetentionHours: number; // Default: 72
    connectionEventRetentionHours: number; // Default: 24
    healthCheckIntervalMs: number; // Default: 60000
    alertThresholds: {
      errorRatePercent: number; // 5%
      latencyP95Ms: number; // 5000ms
      uptimePercent: number; // 95%
    };
  };
}

/**
 * Simulator request for testing
 */
export interface SimulatorMessage {
  senderId: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  type: 'text' | 'media';
}

/**
 * Webhook test request
 */
export interface WebhookTestPayload {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  timeout?: number; // ms
}

/**
 * Webhook test result
 */
export interface WebhookTestResult {
  url: string;
  statusCode: number;
  responseTime: number;
  success: boolean;
  error?: string;
  responseBody?: string;
  headers?: Record<string, string>;
}

/**
 * Config export format
 */
export interface ChannelConfigExport {
  version: string;
  exportedAt: number;
  channel: string;
  policies?: unknown;
  filters?: unknown;
  accounts?: unknown;
  features?: unknown;
  metadata?: Record<string, unknown>;
}
