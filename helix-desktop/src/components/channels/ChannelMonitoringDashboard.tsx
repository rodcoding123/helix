/**
 * Channel Monitoring Dashboard - Phase E.3
 *
 * Provides comprehensive real-time monitoring of all messaging channels:
 * - Message volume and latency metrics
 * - Connection health status and alerts
 * - Error log with context and resolution status
 * - Uptime tracking and reconnection history
 * - Channel-specific testing and configuration tools
 *
 * Gateway methods:
 *   - channels.metrics.get           -> Get channel metrics
 *   - channels.metrics.errors        -> Get error log
 *   - channels.metrics.connection_history -> Get connection events
 *   - channels.health.get            -> Get health status
 *   - channels.simulator.*           -> Test messages
 *   - channels.webhook.test          -> Test webhooks
 *   - channels.config.export/import  -> Backup/restore
 *
 * CSS prefix: cmd-
 */

import { useState, useEffect, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';
import {
  MetricsCharts,
  HealthStatusPanel,
  ErrorLogPanel,
  WebhookTesterPanel,
  ChannelSimulatorPanel,
  ConfigExportImportPanel,
} from './monitoring';
import './ChannelMonitoringDashboard.css';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

type MonitoringTab = 'metrics' | 'health' | 'errors' | 'simulator' | 'webhook' | 'config';

interface ChannelMetrics {
  channel: string;
  timestamp: number;
  messagesReceived: number;
  messagesSent: number;
  messagesFailed: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

interface ChannelHealth {
  channel: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  uptime: number;
  lastChecked: number;
  issues: Array<{
    id: string;
    severity: 'warning' | 'error' | 'critical';
    message: string;
  }>;
}

interface ChannelError {
  id: string;
  channel: string;
  code: string;
  message: string;
  timestamp: number;
  resolved: boolean;
  context?: Record<string, unknown>;
}

export interface ChannelMonitoringDashboardProps {
  selectedChannel?: string;
  onChannelSelect?: (channel: string) => void;
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function ChannelMonitoringDashboard({
  selectedChannel = 'whatsapp',
  onChannelSelect,
}: ChannelMonitoringDashboardProps) {
  const { getClient, connected } = useGateway();

  // ── state ──
  const [activeTab, setActiveTab] = useState<MonitoringTab>('metrics');
  const [metrics, setMetrics] = useState<ChannelMetrics | null>(null);
  const [health, setHealth] = useState<ChannelHealth | null>(null);
  const [errors, setErrors] = useState<ChannelError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<ChannelMetrics[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ── fetch metrics ──
  const fetchMetrics = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      return;
    }

    try {
      setError(null);

      // Fetch current metrics
      const metricsResult = (await client.request('channels.metrics.get', {
        channel: selectedChannel,
        hoursBack: 24,
      })) as { ok: boolean; metrics?: ChannelMetrics | ChannelMetrics[] };

      if (metricsResult.ok) {
        const metricsData = Array.isArray(metricsResult.metrics)
          ? metricsResult.metrics[metricsResult.metrics.length - 1]
          : metricsResult.metrics;

        setMetrics(metricsData || null);

        // Keep history for charts (last 24 samples)
        if (metricsData) {
          setMetricsHistory((prev) => {
            const updated = [...prev, metricsData];
            return updated.slice(-24);
          });
        }
      }

      // Fetch health status
      const healthResult = (await client.request('channels.health.get', {
        channel: selectedChannel,
      })) as { ok: boolean; health?: ChannelHealth };

      if (healthResult.ok) {
        setHealth(healthResult.health || null);
      }

      // Fetch error log
      const errorsResult = (await client.request('channels.metrics.errors', {
        channel: selectedChannel,
        hoursBack: 24,
      })) as { ok: boolean; errors?: ChannelError[] };

      if (errorsResult.ok) {
        setErrors(errorsResult.errors || []);
      }
    } catch (err) {
      console.error('[monitoring] Failed to fetch channel metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [selectedChannel, getClient]);

  // ── auto-refresh ──
  useEffect(() => {
    if (!connected || !autoRefresh) {
      return;
    }

    fetchMetrics();
    const intervalId = setInterval(fetchMetrics, 30000); // 30s refresh
    return () => clearInterval(intervalId);
  }, [connected, autoRefresh, fetchMetrics]);

  // ── initial load ──
  useEffect(() => {
    if (connected) {
      fetchMetrics();
    }
  }, [selectedChannel, connected, fetchMetrics]);

  /* ═══════════════════════════════════════════
     Render
     ═══════════════════════════════════════════ */

  return (
    <div className="cmd-dashboard">
      {/* Header */}
      <div className="cmd-header">
        <div className="cmd-header-left">
          <h2>Channel Monitoring</h2>
          <div className="cmd-subtitle">Real-time metrics and health tracking</div>
        </div>

        <div className="cmd-header-controls">
          <select
            className="cmd-channel-select"
            value={selectedChannel}
            onChange={(e) => {
              const newChannel = e.target.value;
              onChannelSelect?.(newChannel);
            }}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
            <option value="discord">Discord</option>
            <option value="signal">Signal</option>
            <option value="slack">Slack</option>
            <option value="teams">Teams</option>
          </select>

          <label className="cmd-auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>

          <button
            className="cmd-refresh-btn"
            onClick={() => fetchMetrics()}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="cmd-error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Quick stats */}
      {metrics && (
        <div className="cmd-quick-stats">
          <div className="cmd-stat">
            <div className="cmd-stat-label">Messages Received</div>
            <div className="cmd-stat-value">{metrics.messagesReceived.toLocaleString()}</div>
          </div>
          <div className="cmd-stat">
            <div className="cmd-stat-label">Messages Sent</div>
            <div className="cmd-stat-value">{metrics.messagesSent.toLocaleString()}</div>
          </div>
          <div className="cmd-stat">
            <div className="cmd-stat-label">Avg Latency</div>
            <div className="cmd-stat-value">{metrics.avgLatencyMs}ms</div>
          </div>
          <div className="cmd-stat">
            <div className="cmd-stat-label">P95 Latency</div>
            <div className="cmd-stat-value">{metrics.p95LatencyMs}ms</div>
          </div>
          <div className="cmd-stat">
            <div className="cmd-stat-label">Failed Messages</div>
            <div
              className={`cmd-stat-value ${
                metrics.messagesFailed > 0 ? 'cmd-stat-warning' : ''
              }`}
            >
              {metrics.messagesFailed}
            </div>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="cmd-tabs">
        <button
          className={`cmd-tab ${activeTab === 'metrics' ? 'cmd-tab-active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          📊 Metrics
        </button>
        <button
          className={`cmd-tab ${activeTab === 'health' ? 'cmd-tab-active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          💚 Health
          {health?.status === 'unhealthy' || health?.status === 'offline' ? (
            <span className="cmd-tab-badge cmd-tab-badge-error">!</span>
          ) : null}
        </button>
        <button
          className={`cmd-tab ${activeTab === 'errors' ? 'cmd-tab-active' : ''}`}
          onClick={() => setActiveTab('errors')}
        >
          ⚠️ Errors
          {errors.filter((e) => !e.resolved).length > 0 ? (
            <span className="cmd-tab-badge">{errors.filter((e) => !e.resolved).length}</span>
          ) : null}
        </button>
        <button
          className={`cmd-tab ${activeTab === 'simulator' ? 'cmd-tab-active' : ''}`}
          onClick={() => setActiveTab('simulator')}
        >
          🧪 Simulator
        </button>
        <button
          className={`cmd-tab ${activeTab === 'webhook' ? 'cmd-tab-active' : ''}`}
          onClick={() => setActiveTab('webhook')}
        >
          🪝 Webhook
        </button>
        <button
          className={`cmd-tab ${activeTab === 'config' ? 'cmd-tab-active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          ⚙️ Config
        </button>
      </div>

      {/* Tab content */}
      <div className="cmd-tab-content">
        {activeTab === 'metrics' && (
          <MetricsCharts channel={selectedChannel} history={metricsHistory} />
        )}

        {activeTab === 'health' && health && (
          <HealthStatusPanel channel={selectedChannel} health={health} />
        )}

        {activeTab === 'errors' && <ErrorLogPanel channel={selectedChannel} errors={errors} />}

        {activeTab === 'simulator' && (
          <ChannelSimulatorPanel channel={selectedChannel} onTestComplete={fetchMetrics} />
        )}

        {activeTab === 'webhook' && <WebhookTesterPanel channel={selectedChannel} />}

        {activeTab === 'config' && (
          <ConfigExportImportPanel channel={selectedChannel} onImportComplete={fetchMetrics} />
        )}
      </div>
    </div>
  );
}
