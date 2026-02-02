/**
 * System Health Dashboard - View system metrics and status
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './SystemHealth.css';

interface SystemMetrics {
  cpu: number;
  memory: number;
  uptime: number;
  apiCalls: number;
  tokensUsed: number;
  activeConnections: number;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latency?: number;
  lastCheck: string;
  message?: string;
}

interface HealthHistory {
  timestamp: string;
  cpu: number;
  memory: number;
  apiCalls: number;
}

export function SystemHealth() {
  const { getClient } = useGateway();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [history, setHistory] = useState<HealthHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('system.health') as {
          metrics: SystemMetrics;
          services: ServiceStatus[];
          history: HealthHistory[];
        };
        setMetrics(result.metrics);
        setServices(result.services);
        setHistory(result.history);
      } catch (err) {
        console.error('Failed to load system health:', err);
      }
    } else {
      // Mock data
      setMetrics({
        cpu: 23,
        memory: 45,
        uptime: 86400 * 3 + 3600 * 7 + 60 * 23, // 3 days, 7 hours, 23 minutes
        apiCalls: 1234,
        tokensUsed: 456789,
        activeConnections: 3,
      });

      setServices([
        { name: 'Claude API', status: 'healthy', latency: 145, lastCheck: new Date().toISOString() },
        { name: 'Discord Webhooks', status: 'healthy', latency: 89, lastCheck: new Date().toISOString() },
        { name: 'Memory MCP', status: 'healthy', latency: 12, lastCheck: new Date().toISOString() },
        { name: 'Playwright MCP', status: 'healthy', latency: 23, lastCheck: new Date().toISOString() },
        { name: 'Hash Chain', status: 'healthy', lastCheck: new Date().toISOString(), message: 'Verified' },
        { name: 'File System', status: 'healthy', latency: 5, lastCheck: new Date().toISOString() },
      ]);

      // Generate history
      const now = Date.now();
      const mockHistory: HealthHistory[] = [];
      for (let i = 23; i >= 0; i--) {
        mockHistory.push({
          timestamp: new Date(now - i * 3600000).toISOString(),
          cpu: 15 + Math.random() * 30,
          memory: 40 + Math.random() * 20,
          apiCalls: Math.floor(40 + Math.random() * 60),
        });
      }
      setHistory(mockHistory);
    }
    setLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '< 1m';
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return String(num);
  };

  const getStatusColor = (status: ServiceStatus['status']): string => {
    switch (status) {
      case 'healthy': return 'status-healthy';
      case 'degraded': return 'status-degraded';
      case 'down': return 'status-down';
      default: return 'status-unknown';
    }
  };

  const getOverallHealth = (): { status: string; color: string } => {
    const unhealthy = services.filter(s => s.status !== 'healthy').length;
    if (unhealthy === 0) return { status: 'All Systems Operational', color: 'overall-healthy' };
    if (unhealthy === 1) return { status: 'Minor Issues Detected', color: 'overall-degraded' };
    return { status: 'System Issues', color: 'overall-down' };
  };

  if (loading) {
    return <div className="health-loading">Loading system health...</div>;
  }

  const overall = getOverallHealth();

  return (
    <div className="system-health">
      <header className="health-header">
        <div className="header-left">
          <h2>System Health</h2>
          <span className={`overall-status ${overall.color}`}>
            <span className="status-dot" />
            {overall.status}
          </span>
        </div>
        <button
          className={`btn-refresh ${refreshing ? 'refreshing' : ''}`}
          onClick={refresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </header>

      {/* Metrics Cards */}
      {metrics && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon cpu">⚡</div>
            <div className="metric-content">
              <span className="metric-value">{metrics.cpu}%</span>
              <span className="metric-label">CPU Usage</span>
            </div>
            <div className="metric-bar">
              <div
                className="metric-fill cpu"
                style={{ width: `${metrics.cpu}%` }}
              />
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon memory">🧠</div>
            <div className="metric-content">
              <span className="metric-value">{metrics.memory}%</span>
              <span className="metric-label">Memory Usage</span>
            </div>
            <div className="metric-bar">
              <div
                className="metric-fill memory"
                style={{ width: `${metrics.memory}%` }}
              />
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon uptime">⏱️</div>
            <div className="metric-content">
              <span className="metric-value">{formatUptime(metrics.uptime)}</span>
              <span className="metric-label">Uptime</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon api">🔌</div>
            <div className="metric-content">
              <span className="metric-value">{formatNumber(metrics.apiCalls)}</span>
              <span className="metric-label">API Calls (24h)</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon tokens">📊</div>
            <div className="metric-content">
              <span className="metric-value">{formatNumber(metrics.tokensUsed)}</span>
              <span className="metric-label">Tokens Used (24h)</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon connections">🔗</div>
            <div className="metric-content">
              <span className="metric-value">{metrics.activeConnections}</span>
              <span className="metric-label">Active Connections</span>
            </div>
          </div>
        </div>
      )}

      {/* Services Status */}
      <section className="services-section">
        <h3>Services</h3>
        <div className="services-list">
          {services.map(service => (
            <div key={service.name} className="service-row">
              <div className="service-info">
                <span className={`service-status ${getStatusColor(service.status)}`}>
                  <span className="status-indicator" />
                </span>
                <span className="service-name">{service.name}</span>
              </div>
              <div className="service-details">
                {service.latency !== undefined && (
                  <span className="service-latency">{service.latency}ms</span>
                )}
                {service.message && (
                  <span className="service-message">{service.message}</span>
                )}
                <span className="service-last-check">
                  {new Date(service.lastCheck).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Activity Chart */}
      <section className="history-section">
        <h3>24h Activity</h3>
        <div className="history-chart">
          <div className="chart-labels">
            <span>100%</span>
            <span>50%</span>
            <span>0%</span>
          </div>
          <div className="chart-bars">
            {history.map((point, index) => (
              <div key={index} className="chart-bar-group">
                <div
                  className="chart-bar cpu-bar"
                  style={{ height: `${point.cpu}%` }}
                  title={`CPU: ${point.cpu.toFixed(1)}%`}
                />
                <div
                  className="chart-bar memory-bar"
                  style={{ height: `${point.memory}%` }}
                  title={`Memory: ${point.memory.toFixed(1)}%`}
                />
              </div>
            ))}
          </div>
          <div className="chart-time-labels">
            <span>24h ago</span>
            <span>12h ago</span>
            <span>Now</span>
          </div>
        </div>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-color cpu" /> CPU
          </span>
          <span className="legend-item">
            <span className="legend-color memory" /> Memory
          </span>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="actions-section">
        <h3>Quick Actions</h3>
        <div className="actions-grid">
          <button className="action-btn">
            <span className="action-icon">🔄</span>
            <span className="action-label">Restart Services</span>
          </button>
          <button className="action-btn">
            <span className="action-icon">🗑️</span>
            <span className="action-label">Clear Cache</span>
          </button>
          <button className="action-btn">
            <span className="action-icon">📋</span>
            <span className="action-label">Export Logs</span>
          </button>
          <button className="action-btn">
            <span className="action-icon">🔗</span>
            <span className="action-label">Verify Hash Chain</span>
          </button>
        </div>
      </section>
    </div>
  );
}
