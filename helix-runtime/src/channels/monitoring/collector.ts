/**
 * Channel Metrics Collector
 *
 * Collects real-time metrics for channels: message volume, latency,
 * errors, connection events. In-memory storage with 24-hour retention.
 */

import type {
  ChannelMetrics,
  ChannelError,
  ConnectionEvent,
  ChannelHealth,
  HealthIssue,
  ChannelMonitoringConfig,
} from './types.js';

export class ChannelMetricsCollector {
  private config: ChannelMonitoringConfig;
  private latencyBuckets: Map<string, number[]> = new Map(); // channel -> [latencies]
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: ChannelMonitoringConfig) {
    this.config = config;
    this.startCleanupTimer();
  }

  /**
   * Record incoming message
   */
  recordMessageReceived(
    channel: string,
    accountId?: string,
    latencyMs: number = 0,
    mediaSize: number = 0
  ): void {
    const bucket = this.getOrCreateCurrentBucket(channel, accountId);
    bucket.messagesReceived += 1;

    if (latencyMs > 0) {
      this.recordLatency(channel, latencyMs);
    }

    if (mediaSize > 0) {
      bucket.mediaReceived += 1;
    }
  }

  /**
   * Record outgoing message
   */
  recordMessageSent(
    channel: string,
    accountId?: string,
    latencyMs: number = 0,
    mediaSize: number = 0
  ): void {
    const bucket = this.getOrCreateCurrentBucket(channel, accountId);
    bucket.messagesSent += 1;

    if (latencyMs > 0) {
      this.recordLatency(channel, latencyMs);
    }

    if (mediaSize > 0) {
      bucket.mediaSent += 1;
    }
  }

  /**
   * Record failed message
   */
  recordMessageFailed(channel: string, accountId?: string): void {
    const bucket = this.getOrCreateCurrentBucket(channel, accountId);
    bucket.messagesFailed += 1;
  }

  /**
   * Record latency sample
   */
  private recordLatency(channel: string, latencyMs: number): void {
    if (!this.latencyBuckets.has(channel)) {
      this.latencyBuckets.set(channel, []);
    }

    this.latencyBuckets.get(channel)!.push(latencyMs);

    // Keep only recent samples (last 1000)
    const bucket = this.latencyBuckets.get(channel)!;
    if (bucket.length > 1000) {
      this.latencyBuckets.set(channel, bucket.slice(-1000));
    }
  }

  /**
   * Record error
   */
  recordError(
    channel: string,
    code: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const error: ChannelError = {
      timestamp: Date.now(),
      code,
      message,
      context,
      resolved: false,
    };

    if (!this.config.errors.has(channel)) {
      this.config.errors.set(channel, []);
    }

    this.config.errors.get(channel)!.push(error);

    // Keep only recent errors (last 1000)
    const errors = this.config.errors.get(channel)!;
    if (errors.length > 1000) {
      this.config.errors.set(channel, errors.slice(-1000));
    }
  }

  /**
   * Record connection event
   */
  recordConnectionEvent(
    channel: string,
    event: 'connected' | 'disconnected' | 'reconnecting' | 'error' | 'authenticated',
    reason?: string,
    durationMs?: number
  ): void {
    const connEvent: ConnectionEvent = {
      timestamp: Date.now(),
      event,
      reason,
      durationMs,
    };

    if (!this.config.connectionHistory.has(channel)) {
      this.config.connectionHistory.set(channel, []);
    }

    this.config.connectionHistory.get(channel)!.push(connEvent);

    // Keep only recent events
    const history = this.config.connectionHistory.get(channel)!;
    if (history.length > 1000) {
      this.config.connectionHistory.set(channel, history.slice(-1000));
    }
  }

  /**
   * Get or create current metrics bucket
   */
  private getOrCreateCurrentBucket(channel: string, accountId?: string): ChannelMetrics {
    const key = accountId ? `${channel}:${accountId}` : channel;
    const metrics = this.config.metrics.get(key) || [];

    const now = Date.now();
    const hourBucket = Math.floor(now / 3600000) * 3600000;

    // Find or create current hour bucket
    let bucket = metrics.find(m => m.timestamp === hourBucket);

    if (!bucket) {
      bucket = {
        channel,
        accountId,
        timestamp: hourBucket,
        messagesReceived: 0,
        messagesSent: 0,
        messagesFailed: 0,
        mediaReceived: 0,
        mediaSent: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        connectionStatus: 'connected',
        uptime: 100,
        errors: [],
      };

      metrics.push(bucket);
      this.config.metrics.set(key, metrics);
    }

    return bucket;
  }

  /**
   * Calculate percentile latency
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Update latency metrics for current bucket
   */
  private updateLatencyMetrics(channel: string): void {
    const latencies = this.latencyBuckets.get(channel) || [];
    if (latencies.length === 0) return;

    const key = channel;
    const metrics = this.config.metrics.get(key);
    if (!metrics || metrics.length === 0) return;

    const bucket = metrics[metrics.length - 1];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    bucket.avgLatencyMs = Math.round(avgLatency);
    bucket.p95LatencyMs = Math.round(this.calculatePercentile(latencies, 95));
    bucket.p99LatencyMs = Math.round(this.calculatePercentile(latencies, 99));
  }

  /**
   * Get current health for channel
   */
  getHealth(channel: string): ChannelHealth {
    const existing = this.config.health.get(channel);
    if (existing) {
      return existing;
    }

    const health: ChannelHealth = {
      channel,
      status: 'healthy',
      lastSeen: Date.now(),
      errorRate: 0,
      latencyP95: 0,
      uptime24h: 100,
      reconnecionCount24h: 0,
      issues: [],
    };

    this.updateHealth(channel);
    return this.config.health.get(channel) || health;
  }

  /**
   * Update health status for channel
   */
  updateHealth(channel: string): void {
    const metrics = this.config.metrics.get(channel) || [];
    const errors = this.config.errors.get(channel) || [];
    const history = this.config.connectionHistory.get(channel) || [];

    if (metrics.length === 0) {
      this.config.health.set(channel, {
        channel,
        status: 'offline',
        lastSeen: Date.now(),
        errorRate: 0,
        latencyP95: 0,
        uptime24h: 0,
        reconnecionCount24h: 0,
        issues: [
          {
            severity: 'error',
            code: 'NO_METRICS',
            message: 'No metrics data available',
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            count: 1,
          },
        ],
      });
      return;
    }

    // Calculate metrics from last 24 hours
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentMetrics = metrics.filter(m => m.timestamp >= oneDayAgo);
    const recentErrors = errors.filter(e => e.timestamp >= oneDayAgo && !e.resolved);
    const recentConnEvents = history.filter(e => e.timestamp >= oneDayAgo);

    const totalMessages = recentMetrics.reduce(
      (sum, m) => sum + m.messagesReceived + m.messagesSent,
      0
    );
    const failedMessages = recentMetrics.reduce((sum, m) => sum + m.messagesFailed, 0);
    const errorRate = totalMessages > 0 ? failedMessages / totalMessages : 0;

    // Get latest latency
    const latencies = recentMetrics.map(m => m.p95LatencyMs).filter(l => l > 0);
    const latencyP95 = latencies.length > 0 ? Math.max(...latencies) : 0;

    // Calculate uptime
    let totalConnectedTime = 0;
    for (const event of recentConnEvents) {
      if (event.event === 'disconnected' || event.event === 'reconnecting') {
        totalConnectedTime += event.durationMs || 0;
      }
    }
    const uptime24h = Math.max(0, 100 - (totalConnectedTime / (24 * 60 * 60 * 1000)) * 100);

    // Count reconnections
    const reconnecionCount = recentConnEvents.filter(e => e.event === 'reconnecting').length;

    // Determine status
    let status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
    const issues: HealthIssue[] = [];

    if (recentMetrics.length === 0 || uptime24h < 50) {
      status = 'offline';
      issues.push({
        severity: 'error',
        code: 'OFFLINE',
        message: 'Channel is offline or unreachable',
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        count: 1,
      });
    } else if (
      errorRate > this.config.globalSettings.alertThresholds.errorRatePercent / 100 ||
      latencyP95 > this.config.globalSettings.alertThresholds.latencyP95Ms ||
      uptime24h < this.config.globalSettings.alertThresholds.uptimePercent
    ) {
      status = 'unhealthy';

      if (errorRate > this.config.globalSettings.alertThresholds.errorRatePercent / 100) {
        issues.push({
          severity: 'error',
          code: 'HIGH_ERROR_RATE',
          message: `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold`,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          count: failedMessages,
        });
      }

      if (latencyP95 > this.config.globalSettings.alertThresholds.latencyP95Ms) {
        issues.push({
          severity: 'warning',
          code: 'HIGH_LATENCY',
          message: `P95 latency ${latencyP95}ms exceeds threshold`,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          count: 1,
        });
      }

      if (uptime24h < this.config.globalSettings.alertThresholds.uptimePercent) {
        issues.push({
          severity: 'error',
          code: 'LOW_UPTIME',
          message: `Uptime ${uptime24h.toFixed(1)}% below threshold`,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          count: 1,
        });
      }
    } else if (errorRate > 0.01 || latencyP95 > 2000 || uptime24h < 99) {
      status = 'degraded';

      if (errorRate > 0.01) {
        issues.push({
          severity: 'warning',
          code: 'MODERATE_ERROR_RATE',
          message: `Error rate ${(errorRate * 100).toFixed(1)}% is elevated`,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          count: failedMessages,
        });
      }
    } else {
      status = 'healthy';
    }

    // Add recent errors to issues
    for (const error of recentErrors.slice(0, 5)) {
      issues.push({
        severity: 'warning',
        code: error.code,
        message: error.message,
        firstSeen: error.timestamp,
        lastSeen: error.timestamp,
        count: 1,
      });
    }

    this.config.health.set(channel, {
      channel,
      status,
      lastSeen: recentMetrics[recentMetrics.length - 1]?.timestamp || Date.now(),
      errorRate,
      latencyP95,
      uptime24h,
      reconnecionCount24h: reconnecionCount,
      issues,
    });
  }

  /**
   * Get metrics for time range
   */
  getMetrics(channel: string, hoursBack: number = 24): ChannelMetrics[] {
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    const metrics = this.config.metrics.get(channel) || [];
    return metrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get errors for time range
   */
  getErrors(channel: string, hoursBack: number = 24): ChannelError[] {
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    const errors = this.config.errors.get(channel) || [];
    return errors.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Get connection history for time range
   */
  getConnectionHistory(channel: string, hoursBack: number = 24): ConnectionEvent[] {
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    const history = this.config.connectionHistory.get(channel) || [];
    return history.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Cleanup old data periodically
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const metricsAge = this.config.globalSettings.metricsRetentionHours * 60 * 60 * 1000;
      const errorAge = this.config.globalSettings.errorRetentionHours * 60 * 60 * 1000;
      const eventAge =
        this.config.globalSettings.connectionEventRetentionHours * 60 * 60 * 1000;

      // Clean metrics
      for (const [key, metrics] of this.config.metrics) {
        this.config.metrics.set(
          key,
          metrics.filter(m => now - m.timestamp < metricsAge)
        );
      }

      // Clean errors
      for (const [key, errors] of this.config.errors) {
        this.config.errors.set(key, errors.filter(e => now - e.timestamp < errorAge));
      }

      // Clean connection history
      for (const [key, history] of this.config.connectionHistory) {
        this.config.connectionHistory.set(
          key,
          history.filter(e => now - e.timestamp < eventAge)
        );
      }

      // Clear old latency buckets
      for (const [key] of this.latencyBuckets) {
        const metrics = this.config.metrics.get(key);
        if (!metrics || metrics.length === 0) {
          this.latencyBuckets.delete(key);
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get config
   */
  getConfig(): ChannelMonitoringConfig {
    return this.config;
  }

  /**
   * Update config
   */
  updateConfig(config: ChannelMonitoringConfig): void {
    this.config = config;
  }
}
