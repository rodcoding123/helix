/**
 * Health Status Panel - Real-time channel health and alerts
 *
 * Displays:
 * - Overall health status (healthy/degraded/unhealthy/offline)
 * - Uptime percentage
 * - Active issues with severity levels
 * - Recommended actions
 */

import './health-status-panel.css';

interface HealthIssue {
  id: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
}

interface ChannelHealth {
  channel: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  uptime: number;
  lastChecked: number;
  issues: HealthIssue[];
}

export interface HealthStatusPanelProps {
  channel: string;
  health: ChannelHealth;
}

export function HealthStatusPanel({ channel, health }: HealthStatusPanelProps) {
  const statusEmoji: Record<string, string> = {
    healthy: '✅',
    degraded: '⚠️',
    unhealthy: '❌',
    offline: '🔴',
  };

  const statusColor: Record<string, string> = {
    healthy: 'success',
    degraded: 'warning',
    unhealthy: 'error',
    offline: 'critical',
  };

  const lastCheckedMinutesAgo = Math.floor((Date.now() - health.lastChecked) / 60000);
  const lastCheckedStr =
    lastCheckedMinutesAgo === 0 ? 'Just now' : `${lastCheckedMinutesAgo}m ago`;

  const criticalIssues = health.issues.filter((i) => i.severity === 'critical');
  const errorIssues = health.issues.filter((i) => i.severity === 'error');
  const warningIssues = health.issues.filter((i) => i.severity === 'warning');

  return (
    <div className="hsp-container">
      {/* Status Banner */}
      <div className={`hsp-banner hsp-banner-${statusColor[health.status]}`}>
        <div className="hsp-banner-header">
          <div className="hsp-status-badge">
            <span className="hsp-status-emoji">{statusEmoji[health.status]}</span>
            <div>
              <div className="hsp-status-title">
                {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
              </div>
              <div className="hsp-status-subtitle">{channel}</div>
            </div>
          </div>

          <div className="hsp-metrics">
            <div className="hsp-metric">
              <div className="hsp-metric-label">Uptime</div>
              <div className={`hsp-metric-value ${health.uptime < 95 ? 'warning' : ''}`}>
                {health.uptime.toFixed(2)}%
              </div>
            </div>

            <div className="hsp-metric">
              <div className="hsp-metric-label">Last Check</div>
              <div className="hsp-metric-value">{lastCheckedStr}</div>
            </div>
          </div>
        </div>

        {/* Uptime Progress Bar */}
        <div className="hsp-uptime-bar-wrapper">
          <div className="hsp-uptime-bar">
            <div
              className="hsp-uptime-fill"
              style={{ width: `${health.uptime}%` }}
            />
          </div>
          <div className="hsp-uptime-label">{health.uptime.toFixed(1)}% uptime (24h)</div>
        </div>
      </div>

      {/* Issues */}
      {health.issues.length === 0 ? (
        <div className="hsp-no-issues">
          <p className="hsp-no-issues-title">All systems operating normally</p>
          <p className="hsp-no-issues-subtitle">Channel is connected and processing messages</p>
        </div>
      ) : (
        <div className="hsp-issues">
          <h3 className="hsp-issues-title">
            {health.issues.length > 1 ? `${health.issues.length} Issues` : '1 Issue'}
          </h3>

          {/* Critical Issues */}
          {criticalIssues.length > 0 && (
            <div className="hsp-issue-group">
              <div className="hsp-issue-group-title">🚨 Critical</div>
              {criticalIssues.map((issue) => (
                <div key={issue.id} className="hsp-issue hsp-issue-critical">
                  <div className="hsp-issue-indicator" />
                  <div className="hsp-issue-content">
                    <div className="hsp-issue-message">{issue.message}</div>
                    <div className="hsp-issue-action">
                      <button className="hsp-issue-button hsp-issue-button-resolve">
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error Issues */}
          {errorIssues.length > 0 && (
            <div className="hsp-issue-group">
              <div className="hsp-issue-group-title">⛔ Error</div>
              {errorIssues.map((issue) => (
                <div key={issue.id} className="hsp-issue hsp-issue-error">
                  <div className="hsp-issue-indicator" />
                  <div className="hsp-issue-content">
                    <div className="hsp-issue-message">{issue.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Warning Issues */}
          {warningIssues.length > 0 && (
            <div className="hsp-issue-group">
              <div className="hsp-issue-group-title">⚠️ Warning</div>
              {warningIssues.map((issue) => (
                <div key={issue.id} className="hsp-issue hsp-issue-warning">
                  <div className="hsp-issue-indicator" />
                  <div className="hsp-issue-content">
                    <div className="hsp-issue-message">{issue.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {health.status !== 'healthy' && (
        <div className="hsp-recommendations">
          <h3 className="hsp-recommendations-title">Recommended Actions</h3>
          <ul className="hsp-recommendations-list">
            {health.status === 'offline' && (
              <>
                <li>
                  <strong>Reconnect channel:</strong> Use the channel settings to re-authenticate
                </li>
                <li>
                  <strong>Check network:</strong> Verify internet connectivity and firewall rules
                </li>
                <li>
                  <strong>Review credentials:</strong> Ensure API keys and tokens are current
                </li>
              </>
            )}
            {health.status === 'unhealthy' && (
              <>
                <li>
                  <strong>Review recent errors:</strong> Check the Errors tab for details
                </li>
                <li>
                  <strong>Check rate limits:</strong> Verify you haven't exceeded API quotas
                </li>
                <li>
                  <strong>Restart channel:</strong> Disconnect and reconnect in settings
                </li>
              </>
            )}
            {health.status === 'degraded' && (
              <>
                <li>
                  <strong>Monitor metrics:</strong> Watch latency and error rates in Metrics tab
                </li>
                <li>
                  <strong>Reduce message volume:</strong> Consider rate limiting high-frequency channels
                </li>
                <li>
                  <strong>Check service status:</strong> Verify the channel provider isn't experiencing issues
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
