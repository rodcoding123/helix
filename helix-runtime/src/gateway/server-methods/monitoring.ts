/**
 * Gateway Methods: Channel Monitoring
 *
 * Metrics collection, health tracking, testing tools, and config management.
 */

import { ChannelMetricsCollector } from '../../channels/monitoring/index.js';
import { ChannelSimulator } from '../../channels/testing/index.js';
import { WebhookTester } from '../../channels/testing/index.js';
import { ChannelConfigManager } from '../../channels/config/index.js';
import type { ChannelMonitoringConfig, WebhookTestPayload, SimulatorMessage } from '../../channels/monitoring/types.js';

let metricsCollector: ChannelMetricsCollector | null = null;
let simulator: ChannelSimulator | null = null;
let webhookTester: WebhookTester | null = null;
let configManager: ChannelConfigManager | null = null;

function getMetricsCollector(): ChannelMetricsCollector {
  if (!metricsCollector) {
    const config: ChannelMonitoringConfig = {
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
    metricsCollector = new ChannelMetricsCollector(config);
  }
  return metricsCollector;
}

function getSimulator(): ChannelSimulator {
  if (!simulator) {
    simulator = new ChannelSimulator();
  }
  return simulator;
}

function getWebhookTester(): WebhookTester {
  if (!webhookTester) {
    webhookTester = new WebhookTester();
  }
  return webhookTester;
}

function getConfigManager(): ChannelConfigManager {
  if (!configManager) {
    configManager = new ChannelConfigManager();
  }
  return configManager;
}

/**
 * Gateway method handlers
 */
export const monitoringMethods = {
  /**
   * Metrics collection methods
   */
  'channels.metrics.record.message_received': async (params: {
    channel: string;
    accountId?: string;
    latencyMs?: number;
    mediaSize?: number;
  }) => {
    const collector = getMetricsCollector();
    collector.recordMessageReceived(
      params.channel,
      params.accountId,
      params.latencyMs,
      params.mediaSize
    );
    return { ok: true };
  },

  'channels.metrics.record.message_sent': async (params: {
    channel: string;
    accountId?: string;
    latencyMs?: number;
    mediaSize?: number;
  }) => {
    const collector = getMetricsCollector();
    collector.recordMessageSent(
      params.channel,
      params.accountId,
      params.latencyMs,
      params.mediaSize
    );
    return { ok: true };
  },

  'channels.metrics.record.error': async (params: {
    channel: string;
    code: string;
    message: string;
    context?: Record<string, unknown>;
  }) => {
    const collector = getMetricsCollector();
    collector.recordError(params.channel, params.code, params.message, params.context);
    return { ok: true };
  },

  'channels.metrics.record.connection_event': async (params: {
    channel: string;
    event: 'connected' | 'disconnected' | 'reconnecting' | 'error' | 'authenticated';
    reason?: string;
    durationMs?: number;
  }) => {
    const collector = getMetricsCollector();
    collector.recordConnectionEvent(params.channel, params.event, params.reason, params.durationMs);
    return { ok: true };
  },

  /**
   * Metrics query methods
   */
  'channels.metrics.get': async (params: { channel: string; hoursBack?: number }) => {
    const collector = getMetricsCollector();
    const metrics = collector.getMetrics(params.channel, params.hoursBack);
    return { ok: true, metrics };
  },

  'channels.metrics.errors': async (params: { channel: string; hoursBack?: number }) => {
    const collector = getMetricsCollector();
    const errors = collector.getErrors(params.channel, params.hoursBack);
    return { ok: true, errors };
  },

  'channels.metrics.connection_history': async (params: { channel: string; hoursBack?: number }) => {
    const collector = getMetricsCollector();
    const history = collector.getConnectionHistory(params.channel, params.hoursBack);
    return { ok: true, history };
  },

  'channels.health.get': async (params: { channel: string }) => {
    const collector = getMetricsCollector();
    const health = collector.getHealth(params.channel);
    collector.updateHealth(params.channel);
    return { ok: true, health: collector.getHealth(params.channel) };
  },

  /**
   * Channel simulator methods
   */
  'channels.simulator.start_session': async (params: { channel: string }) => {
    const sim = getSimulator();
    const session = sim.startSession(params.channel);
    return { ok: true, session };
  },

  'channels.simulator.end_session': async (params: { sessionId: string }) => {
    const sim = getSimulator();
    const session = sim.endSession(params.sessionId);
    return { ok: true, session };
  },

  'channels.simulator.send_message': async (params: {
    sessionId: string;
    message: SimulatorMessage;
  }) => {
    const sim = getSimulator();
    const result = await sim.sendSimulatedMessage(params.sessionId, params.message);
    return { ok: true, result };
  },

  'channels.simulator.get_session': async (params: { sessionId: string }) => {
    const sim = getSimulator();
    const session = sim.getSession(params.sessionId);
    const summary = session ? sim.getSessionSummary(params.sessionId) : null;
    return { ok: true, session, summary };
  },

  'channels.simulator.get_test_payload': async (params: { channel: string }) => {
    const sim = getSimulator();
    const payload = sim.getTestPayloadTemplate(params.channel);
    return { ok: true, payload };
  },

  /**
   * Webhook tester methods
   */
  'channels.webhook.test': async (params: WebhookTestPayload) => {
    const tester = getWebhookTester();
    const result = await tester.testWebhook(params);
    return { ok: true, result };
  },

  'channels.webhook.validate_url': async (params: { url: string }) => {
    const tester = getWebhookTester();
    const validation = tester.validateUrl(params.url);
    return { ok: validation.valid, validation };
  },

  'channels.webhook.create_test_payload': async (params: {
    url: string;
    channel: string;
    type?: 'message' | 'status' | 'event';
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  }) => {
    const tester = getWebhookTester();
    const payload = tester.createTestPayload(
      params.url,
      params.channel,
      params.type || 'message',
      params.method || 'POST'
    );
    return { ok: true, payload };
  },

  /**
   * Config export/import methods
   */
  'channels.config.export': async (params: {
    channel: string;
    data: {
      policies?: unknown;
      filters?: unknown;
      accounts?: unknown;
      features?: unknown;
      metadata?: Record<string, unknown>;
    };
  }) => {
    const manager = getConfigManager();
    const config = manager.exportConfig(params.channel, params.data);
    return { ok: true, config };
  },

  'channels.config.export_json': async (params: {
    channel: string;
    data: {
      policies?: unknown;
      filters?: unknown;
      accounts?: unknown;
      features?: unknown;
      metadata?: Record<string, unknown>;
    };
  }) => {
    const manager = getConfigManager();
    const config = manager.exportConfig(params.channel, params.data);
    const json = manager.exportToJson(config);
    return { ok: true, json };
  },

  'channels.config.export_base64': async (params: {
    channel: string;
    data: {
      policies?: unknown;
      filters?: unknown;
      accounts?: unknown;
      features?: unknown;
      metadata?: Record<string, unknown>;
    };
  }) => {
    const manager = getConfigManager();
    const config = manager.exportConfig(params.channel, params.data);
    const base64 = manager.exportToBase64(config);
    return { ok: true, base64 };
  },

  'channels.config.import_json': async (params: { json: string }) => {
    const manager = getConfigManager();
    const config = manager.importFromJson(params.json);
    return { ok: true, config };
  },

  'channels.config.import_base64': async (params: { base64: string }) => {
    const manager = getConfigManager();
    const config = manager.importFromBase64(params.base64);
    return { ok: true, config };
  },

  'channels.config.validate': async (params: {
    config: unknown;
    currentChannel: string;
  }) => {
    const manager = getConfigManager();
    const validation = manager.validateCompatibility(params.config as any, params.currentChannel);
    return { ok: validation.compatible, validation };
  },

  'channels.config.compare': async (params: {
    config1: unknown;
    config2: unknown;
  }) => {
    const manager = getConfigManager();
    const comparison = manager.compareConfigs(params.config1 as any, params.config2 as any);
    return { ok: comparison.identical, comparison };
  },
};

/**
 * Initialize monitoring system
 */
export function initializeMonitoring(): void {
  // Initialize all subsystems
  getMetricsCollector();
  getSimulator();
  getWebhookTester();
  getConfigManager();
}

/**
 * Shutdown monitoring system
 */
export function shutdownMonitoring(): void {
  metricsCollector?.destroy();
  metricsCollector = null;
}
