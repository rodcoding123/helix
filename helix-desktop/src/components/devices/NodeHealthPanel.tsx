/**
 * Node Health Panel
 *
 * Phase H.3: Displays real-time health metrics for a paired device:
 * - Connection quality (excellent/good/fair/poor)
 * - Latency in milliseconds
 * - Last seen timestamp
 * - Uptime duration
 * - Missed heartbeats counter
 * - Failure rate percentage
 *
 * Updates every 5 seconds via gateway polling
 */

import { useState, useEffect, useCallback } from 'react';
import { getGatewayClient } from '../../lib/gateway-client';
import './device-management.css';

export interface NodeHealthMetrics {
  nodeId: string;
  lastHeartbeat: number;
  lastSeen: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  latencyMs: number;
  missedHeartbeats: number;
  uptime: number;
  totalHeartbeats: number;
  failureRate: number;
}

export interface NodeHealthPanelProps {
  nodeId: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

const connectionQualityColors: Record<string, { bg: string; text: string; border: string }> = {
  excellent: {
    bg: 'rgba(16, 185, 129, 0.1)',
    text: '#10b981',
    border: '#10b981',
  },
  good: {
    bg: 'rgba(34, 197, 94, 0.1)',
    text: '#22c55e',
    border: '#22c55e',
  },
  fair: {
    bg: 'rgba(245, 158, 11, 0.1)',
    text: '#f59e0b',
    border: '#f59e0b',
  },
  poor: {
    bg: 'rgba(239, 68, 68, 0.1)',
    text: '#ef4444',
    border: '#ef4444',
  },
};

export function NodeHealthPanel({ nodeId }: NodeHealthPanelProps) {
  const [metrics, setMetrics] = useState<NodeHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      // Request health metrics for this node
      const result = await client.request('node.health.status', { nodeId });

      if (result && typeof result === 'object' && 'metrics' in result) {
        setMetrics((result as any).metrics);
        setError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch health metrics';
      setError(message);
      console.error('[node-health-panel] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  // Initial load
  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Poll every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading && !metrics) {
    return (
      <div className="nhp-container">
        <div className="nhp-loading">
          <div className="nhp-spinner" />
          <p>Loading health metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="nhp-container">
        <div className="nhp-error">
          <p>{error || 'No health data available'}</p>
        </div>
      </div>
    );
  }

  const qualityColor = connectionQualityColors[metrics.connectionQuality];
  const uptime = formatDuration(metrics.uptime);
  const lastSeen = formatRelativeTime(metrics.lastSeen);
  const failurePercent = Math.round(metrics.failureRate * 100);

  return (
    <div className="nhp-container">
      {/* Connection Quality Card */}
      <div className="nhp-metric-card">
        <div className="nhp-metric-label">Connection Quality</div>
        <div
          className="nhp-quality-badge"
          style={{
            background: qualityColor.bg,
            borderColor: qualityColor.border,
            color: qualityColor.text,
          }}
        >
          <span className="nhp-quality-indicator" style={{ background: qualityColor.text }} />
          <span className="nhp-quality-text">
            {metrics.connectionQuality.charAt(0).toUpperCase() + metrics.connectionQuality.slice(1)}
          </span>
        </div>
      </div>

      {/* Latency Card */}
      <div className="nhp-metric-card">
        <div className="nhp-metric-label">Latency</div>
        <div className="nhp-metric-value">
          <span className="nhp-value">{metrics.latencyMs}ms</span>
          <span className="nhp-hint">
            {metrics.latencyMs <= 100
              ? 'Excellent'
              : metrics.latencyMs <= 300
                ? 'Good'
                : metrics.latencyMs <= 1000
                  ? 'Fair'
                  : 'Poor'}
          </span>
        </div>
      </div>

      {/* Last Seen Card */}
      <div className="nhp-metric-card">
        <div className="nhp-metric-label">Last Seen</div>
        <div className="nhp-metric-value">
          <span className="nhp-value">{lastSeen}</span>
        </div>
      </div>

      {/* Uptime Card */}
      <div className="nhp-metric-card">
        <div className="nhp-metric-label">Connected For</div>
        <div className="nhp-metric-value">
          <span className="nhp-value">{uptime}</span>
        </div>
      </div>

      {/* Heartbeats Card */}
      <div className="nhp-metric-card">
        <div className="nhp-metric-label">Heartbeats</div>
        <div className="nhp-metric-value">
          <span className="nhp-value">{metrics.totalHeartbeats}</span>
          <span className="nhp-hint">
            {metrics.missedHeartbeats > 0 && `${metrics.missedHeartbeats} missed`}
          </span>
        </div>
      </div>

      {/* Failure Rate Card */}
      <div className="nhp-metric-card">
        <div className="nhp-metric-label">Failure Rate</div>
        <div className="nhp-metric-value">
          <span className="nhp-value">{failurePercent}%</span>
          {failurePercent > 0 && (
            <div className="nhp-failure-bar">
              <div
                className="nhp-failure-fill"
                style={{ width: `${Math.min(failurePercent, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      {metrics.missedHeartbeats > 0 && (
        <div className="nhp-info-box">
          <p>
            <strong>⚠️ Connection Issues:</strong> {metrics.missedHeartbeats} missed{' '}
            {metrics.missedHeartbeats === 1 ? 'heartbeat' : 'heartbeats'}. Device will disconnect
            after 3 consecutive misses.
          </p>
        </div>
      )}

      {metrics.connectionQuality === 'excellent' && (
        <div className="nhp-success-box">
          <p>
            <strong>✓ Healthy Connection:</strong> Node is responding normally with excellent
            signal strength.
          </p>
        </div>
      )}
    </div>
  );
}
