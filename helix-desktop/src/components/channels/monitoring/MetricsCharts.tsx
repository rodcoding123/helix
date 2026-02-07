/**
 * Metrics Charts - Real-time message volume and latency visualization
 *
 * Displays:
 * - Message volume over time (received/sent/failed)
 * - Latency trends (avg, p95, p99)
 * - Success rate and error rate
 */

import { useMemo } from 'react';
import './metrics-charts.css';

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

export interface MetricsChartsProps {
  channel: string;
  history: ChannelMetrics[];
}

export function MetricsCharts({ channel: _unused_channel, history }: MetricsChartsProps) {
  // Calculate statistics
  const stats = useMemo(() => {
    if (!history.length) {
      return {
        totalReceived: 0,
        totalSent: 0,
        totalFailed: 0,
        avgLatency: 0,
        successRate: 0,
        errorRate: 0,
      };
    }

    const totalReceived = history.reduce((sum, m) => sum + m.messagesReceived, 0);
    const totalSent = history.reduce((sum, m) => sum + m.messagesSent, 0);
    const totalFailed = history.reduce((sum, m) => sum + m.messagesFailed, 0);
    const avgLatency = Math.round(
      history.reduce((sum, m) => sum + m.avgLatencyMs, 0) / history.length
    );

    const successRate =
      totalSent + totalFailed > 0
        ? Math.round(((totalSent / (totalSent + totalFailed)) * 100) * 10) / 10
        : 100;

    const errorRate = 100 - successRate;

    return {
      totalReceived,
      totalSent,
      totalFailed,
      avgLatency,
      successRate,
      errorRate,
    };
  }, [history]);

  // Normalize values for visualization (0-100 scale for bars)
  const maxReceived = useMemo(
    () => Math.max(...history.map((m) => m.messagesReceived), 1),
    [history]
  );
  const maxLatency = useMemo(
    () => Math.max(...history.map((m) => m.p99LatencyMs), 1),
    [history]
  );

  if (!history.length) {
    return (
      <div className="metrics-charts">
        <div className="metrics-empty">
          <p>No metrics data available</p>
          <p className="metrics-empty-hint">Data will appear as messages are processed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-charts">
      {/* Statistics Row */}
      <div className="metrics-stats-row">
        <div className="metrics-stat-item">
          <div className="metrics-stat-label">Total Received</div>
          <div className="metrics-stat-value">{stats.totalReceived.toLocaleString()}</div>
        </div>
        <div className="metrics-stat-item">
          <div className="metrics-stat-label">Total Sent</div>
          <div className="metrics-stat-value">{stats.totalSent.toLocaleString()}</div>
        </div>
        <div className="metrics-stat-item">
          <div className="metrics-stat-label">Success Rate</div>
          <div className={`metrics-stat-value ${stats.successRate < 95 ? 'warning' : 'success'}`}>
            {stats.successRate}%
          </div>
        </div>
        <div className="metrics-stat-item">
          <div className="metrics-stat-label">Avg Latency</div>
          <div className={`metrics-stat-value ${stats.avgLatency > 2000 ? 'warning' : ''}`}>
            {stats.avgLatency}ms
          </div>
        </div>
      </div>

      {/* Message Volume Chart */}
      <div className="metrics-chart-section">
        <h3>Message Volume (24h)</h3>
        <div className="metrics-chart-container">
          <div className="metrics-y-axis">
            <div className="metrics-y-label">
              {Math.round(maxReceived * 0.75).toLocaleString()}
            </div>
            <div className="metrics-y-label">
              {Math.round(maxReceived * 0.5).toLocaleString()}
            </div>
            <div className="metrics-y-label">
              {Math.round(maxReceived * 0.25).toLocaleString()}
            </div>
            <div className="metrics-y-label">0</div>
          </div>

          <div className="metrics-bars">
            {history.map((metric, idx) => {
              const timeStr = new Date(metric.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const receivedHeight = (metric.messagesReceived / maxReceived) * 100;
              const sentHeight = (metric.messagesSent / maxReceived) * 100;

              return (
                <div key={`metric-${idx}`} className="metrics-bar-group" title={timeStr}>
                  <div className="metrics-bar-stack">
                    <div
                      className="metrics-bar metrics-bar-received"
                      style={{ height: `${receivedHeight}%` }}
                      title={`Received: ${metric.messagesReceived}`}
                    />
                    <div
                      className="metrics-bar metrics-bar-sent"
                      style={{ height: `${sentHeight}%` }}
                      title={`Sent: ${metric.messagesSent}`}
                    />
                  </div>
                  <div
                    className="metrics-bar metrics-bar-failed"
                    title={`Failed: ${metric.messagesFailed}`}
                  >
                    {metric.messagesFailed > 0 && (
                      <span className="metrics-failed-badge">{metric.messagesFailed}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="metrics-legend">
          <div className="metrics-legend-item">
            <span className="metrics-legend-color metrics-bar-received" />
            <span>Received</span>
          </div>
          <div className="metrics-legend-item">
            <span className="metrics-legend-color metrics-bar-sent" />
            <span>Sent</span>
          </div>
          <div className="metrics-legend-item">
            <span className="metrics-legend-color metrics-bar-failed" />
            <span>Failed</span>
          </div>
        </div>
      </div>

      {/* Latency Chart */}
      <div className="metrics-chart-section">
        <h3>Latency Trends (ms)</h3>
        <div className="metrics-chart-container">
          <div className="metrics-y-axis">
            <div className="metrics-y-label">{Math.round(maxLatency)}</div>
            <div className="metrics-y-label">{Math.round(maxLatency * 0.66)}</div>
            <div className="metrics-y-label">{Math.round(maxLatency * 0.33)}</div>
            <div className="metrics-y-label">0</div>
          </div>

          <div className="metrics-line-chart">
            <svg viewBox={`0 0 ${history.length * 40} 200`} preserveAspectRatio="none">
              {/* P99 line */}
              <polyline
                className="metrics-line metrics-line-p99"
                points={history
                  .map((m, i) => {
                    const x = i * 40 + 20;
                    const y = 180 - (m.p99LatencyMs / maxLatency) * 180;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              {/* P95 line */}
              <polyline
                className="metrics-line metrics-line-p95"
                points={history
                  .map((m, i) => {
                    const x = i * 40 + 20;
                    const y = 180 - (m.p95LatencyMs / maxLatency) * 180;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              {/* Avg line */}
              <polyline
                className="metrics-line metrics-line-avg"
                points={history
                  .map((m, i) => {
                    const x = i * 40 + 20;
                    const y = 180 - (m.avgLatencyMs / maxLatency) * 180;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            </svg>
          </div>
        </div>

        <div className="metrics-legend">
          <div className="metrics-legend-item">
            <span className="metrics-legend-line metrics-line-avg" />
            <span>Average</span>
          </div>
          <div className="metrics-legend-item">
            <span className="metrics-legend-line metrics-line-p95" />
            <span>P95</span>
          </div>
          <div className="metrics-legend-item">
            <span className="metrics-legend-line metrics-line-p99" />
            <span>P99</span>
          </div>
        </div>
      </div>
    </div>
  );
}
