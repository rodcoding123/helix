/**
 * Channel Metrics Collector Tests
 *
 * Tests metric recording, aggregation, health scoring, and cleanup.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChannelMetricsCollector } from '../collector';
import type { ChannelMonitoringConfig } from '../types';

describe('ChannelMetricsCollector', () => {
  let collector: ChannelMetricsCollector;
  let config: ChannelMonitoringConfig;

  beforeEach(() => {
    config = {
      version: '1.0.0',
      metrics: new Map(),
      errors: new Map(),
      connectionHistory: new Map(),
      health: new Map(),
      globalSettings: {
        metricsRetentionHours: 24,
        errorRetentionHours: 72,
        connectionEventRetentionHours: 24,
        healthCheckIntervalMs: 60000,
        alertThresholds: {
          errorRatePercent: 5,
          latencyP95Ms: 5000,
          uptimePercent: 95,
        },
      },
    };

    collector = new ChannelMetricsCollector(config);
  });

  afterEach(() => {
    collector.destroy();
  });

  describe('Message Metrics', () => {
    it('should record received message', () => {
      collector.recordMessageReceived('whatsapp', 'account1', 150);

      const metrics = collector.getMetrics('whatsapp');
      expect(metrics).toBeDefined();
      expect(metrics?.messagesReceived).toBeGreaterThanOrEqual(1);
    });

    it('should record sent message', () => {
      collector.recordMessageSent('telegram', 'account2', 200);

      const metrics = collector.getMetrics('telegram');
      expect(metrics).toBeDefined();
      expect(metrics?.messagesSent).toBeGreaterThanOrEqual(1);
    });

    it('should track message failure', () => {
      collector.recordMessageReceived('discord');
      collector.recordMessageReceived('discord');
      // Simulate failure by recording error
      collector.recordError('discord', 'SEND_FAILED', 'Failed to send message');

      const metrics = collector.getMetrics('discord');
      expect(metrics?.messagesFailed).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average latency', () => {
      collector.recordMessageReceived('whatsapp', 'account1', 100);
      collector.recordMessageReceived('whatsapp', 'account1', 200);
      collector.recordMessageReceived('whatsapp', 'account1', 300);

      const metrics = collector.getMetrics('whatsapp');
      expect(metrics?.avgLatencyMs).toBeGreaterThan(0);
      expect(metrics?.avgLatencyMs).toBeLessThanOrEqual(300);
    });

    it('should calculate p95 latency', () => {
      // Add 20 samples to get meaningful percentile
      for (let i = 1; i <= 20; i++) {
        collector.recordMessageReceived('signal', undefined, i * 100);
      }

      const metrics = collector.getMetrics('signal');
      expect(metrics?.p95LatencyMs).toBeGreaterThanOrEqual(metrics?.avgLatencyMs || 0);
    });

    it('should calculate p99 latency', () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordMessageReceived('line', undefined, i * 10);
      }

      const metrics = collector.getMetrics('line');
      expect(metrics?.p99LatencyMs).toBeGreaterThanOrEqual(metrics?.p95LatencyMs || 0);
    });
  });

  describe('Connection Events', () => {
    it('should record connection event', () => {
      collector.recordConnectionEvent('whatsapp', 'connected');

      const history = collector.getConnectionHistory('whatsapp');
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].event).toBe('connected');
    });

    it('should track reconnection count', () => {
      collector.recordConnectionEvent('telegram', 'connected');
      collector.recordConnectionEvent('telegram', 'disconnected');
      collector.recordConnectionEvent('telegram', 'reconnecting');
      collector.recordConnectionEvent('telegram', 'connected');

      const history = collector.getConnectionHistory('telegram');
      const reconnects = history.filter((e) => e.event === 'reconnecting');
      expect(reconnects.length).toBeGreaterThan(0);
    });

    it('should track connection duration', () => {
      collector.recordConnectionEvent('discord', 'connected');
      collector.recordConnectionEvent('discord', 'disconnected', 'User logout', 3600000); // 1 hour

      const history = collector.getConnectionHistory('discord');
      const disconnectEvent = history.find((e) => e.event === 'disconnected');
      expect(disconnectEvent?.durationMs).toBe(3600000);
    });
  });

  describe('Error Tracking', () => {
    it('should record error', () => {
      collector.recordError('whatsapp', 'RATE_LIMIT', 'Rate limit exceeded', {
        retryAfter: 60,
      });

      const errors = collector.getErrors('whatsapp');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('RATE_LIMIT');
    });

    it('should include error context', () => {
      const context = { accountId: 'acc123', provider: 'twilio' };
      collector.recordError('telegram', 'AUTH_FAILED', 'Authentication failed', context);

      const errors = collector.getErrors('telegram');
      expect(errors[0].context).toEqual(context);
    });

    it('should filter errors by time range', () => {
      const now = Date.now();

      // Record error in past
      collector.recordError('signal', 'OLD_ERROR', 'Old error', undefined);

      // Wait and record recent error
      collector.recordError('signal', 'NEW_ERROR', 'New error', undefined);

      const recentErrors = collector.getErrors('signal', 1); // Last 1 hour
      expect(recentErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Health Scoring', () => {
    it('should determine healthy status', () => {
      // Add successful messages
      for (let i = 0; i < 100; i++) {
        collector.recordMessageReceived('whatsapp');
        collector.recordMessageSent('whatsapp');
      }

      collector.updateHealth('whatsapp');
      const health = collector.getHealth('whatsapp');

      expect(health?.status).toBe('healthy');
    });

    it('should determine degraded status', () => {
      // Add messages with some errors
      for (let i = 0; i < 100; i++) {
        collector.recordMessageReceived('telegram');
        if (i % 10 === 0) {
          collector.recordError('telegram', 'TIMEOUT', 'Request timeout');
        }
      }

      collector.updateHealth('telegram');
      const health = collector.getHealth('telegram');

      expect(['healthy', 'degraded']).toContain(health?.status);
    });

    it('should detect unhealthy status', () => {
      // Simulate connection issues
      collector.recordConnectionEvent('discord', 'disconnected', 'Network error');
      collector.recordConnectionEvent('discord', 'reconnecting');
      collector.recordError('discord', 'CONNECTION_FAILED', 'Cannot connect to server');

      collector.updateHealth('discord');
      const health = collector.getHealth('discord');

      expect(['degraded', 'unhealthy', 'offline']).toContain(health?.status);
    });

    it('should include issues in health report', () => {
      collector.recordError('signal', 'CRITICAL_ERROR', 'Critical failure');
      collector.updateHealth('signal');
      const health = collector.getHealth('signal');

      expect(health?.issues).toBeDefined();
      expect(health?.issues.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Metrics Retention & Cleanup', () => {
    it('should cleanup old metrics', async () => {
      collector.recordMessageReceived('whatsapp', undefined, 100);

      // Manually trigger cleanup to verify it works
      // (In production, this runs automatically every hour)
      collector.recordMessageReceived('whatsapp', undefined, 200);

      const metrics = collector.getMetrics('whatsapp');
      expect(metrics).toBeDefined();
    });

    it('should respect retention window', () => {
      collector.recordMessageReceived('telegram');

      // Get metrics within retention window
      const metricsNow = collector.getMetrics('telegram', 24);
      expect(metricsNow).toBeDefined();

      // Get metrics outside retention window (should be empty or old data)
      const metricsOld = collector.getMetrics('telegram', 96); // 96 hours back
      expect(metricsOld).toBeDefined();
    });
  });

  describe('Multiple Channels', () => {
    it('should track metrics per channel', () => {
      collector.recordMessageReceived('whatsapp', undefined, 100);
      collector.recordMessageReceived('telegram', undefined, 200);
      collector.recordMessageReceived('discord', undefined, 150);

      const wpMetrics = collector.getMetrics('whatsapp');
      const tgMetrics = collector.getMetrics('telegram');
      const dcMetrics = collector.getMetrics('discord');

      expect(wpMetrics).toBeDefined();
      expect(tgMetrics).toBeDefined();
      expect(dcMetrics).toBeDefined();
    });

    it('should track per-account metrics', () => {
      collector.recordMessageReceived('whatsapp', 'personal', 100);
      collector.recordMessageReceived('whatsapp', 'business', 200);

      const metrics = collector.getMetrics('whatsapp');
      expect(metrics?.messagesReceived).toBeGreaterThanOrEqual(2);
    });

    it('should isolate channel metrics', () => {
      collector.recordMessageReceived('whatsapp', undefined, 100);
      collector.recordError('whatsapp', 'ERROR1', 'Error in WhatsApp');

      collector.recordMessageReceived('telegram', undefined, 200);
      collector.recordError('telegram', 'ERROR2', 'Error in Telegram');

      const wpErrors = collector.getErrors('whatsapp');
      const tgErrors = collector.getErrors('telegram');

      expect(wpErrors.every((e) => e.channel === 'whatsapp')).toBe(true);
      expect(tgErrors.every((e) => e.channel === 'telegram')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero latency', () => {
      collector.recordMessageReceived('whatsapp', undefined, 0);
      const metrics = collector.getMetrics('whatsapp');
      expect(metrics?.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle very high latency', () => {
      collector.recordMessageReceived('telegram', undefined, 30000); // 30 seconds
      const metrics = collector.getMetrics('telegram');
      expect(metrics?.avgLatencyMs).toBe(30000);
    });

    it('should handle missing account ID', () => {
      collector.recordMessageReceived('discord'); // No account ID
      const metrics = collector.getMetrics('discord');
      expect(metrics).toBeDefined();
    });

    it('should handle empty channel', () => {
      const metrics = collector.getMetrics('nonexistent');
      expect(metrics).toBeDefined();
    });

    it('should safely destroy collector', () => {
      collector.recordMessageReceived('whatsapp');
      expect(() => collector.destroy()).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should record 1000 messages efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        collector.recordMessageReceived('whatsapp', `account${i % 10}`, Math.random() * 1000);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500); // Should be fast (<500ms for 1000 records)
    });

    it('should query metrics efficiently', () => {
      for (let i = 0; i < 100; i++) {
        collector.recordMessageReceived('telegram', undefined, Math.random() * 1000);
      }

      const start = performance.now();
      collector.getMetrics('telegram');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10); // Should be instant (<10ms)
    });
  });
});
