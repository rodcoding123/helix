/**
 * Orchestrator Monitoring Dashboard
 *
 * Complete real-time monitoring of orchestrator job execution.
 * Combines cost tracking, activity timeline, and state visualization.
 *
 * Shows:
 * - Real-time cost burn rate
 * - Agent activity timeline
 * - Budget remaining
 * - State transitions
 * - Checkpoint history
 */

import React, { useState } from 'react';
import { CostBurnRate } from './CostBurnRate';
import { AgentActivityTimeline } from './AgentActivityTimeline';
import { useOrchestratorMetrics } from '../../hooks/useOrchestratorMetrics';
import './OrchestratorMonitoringPanel.css';

interface OrchestratorMonitoringPanelProps {
  threadId?: string;
}

export function OrchestratorMonitoringPanel({
  threadId = 'default',
}: OrchestratorMonitoringPanelProps) {
  const { metrics, costBurnRate, isLoading, error, isConnected } =
    useOrchestratorMetrics(threadId);

  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="orchestrator-monitoring-panel">
      <div className="omp-header">
        <div className="omp-title">
          <h2>🎯 Orchestrator Monitoring</h2>
          <span className={`omp-status omp-status--${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>
        <button
          className="omp-details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {error && (
        <div className="omp-error">
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      {isLoading && !metrics ? (
        <div className="omp-loading">
          <div className="omp-spinner" />
          Loading orchestrator metrics...
        </div>
      ) : (
        <>
          {/* Cost Burn Rate Section */}
          {metrics && <CostBurnRate threadId={threadId} />}

          {/* Agent Activity Timeline */}
          {metrics && <AgentActivityTimeline threadId={threadId} />}

          {/* Detailed Metrics */}
          {showDetails && metrics && (
            <div className="omp-details">
              <div className="omp-details-section">
                <h3>Token Usage</h3>
                <div className="omp-details-grid">
                  <div className="omp-detail-item">
                    <span className="omp-detail-label">Input Tokens</span>
                    <span className="omp-detail-value">{metrics.inputTokens.toLocaleString()}</span>
                  </div>
                  <div className="omp-detail-item">
                    <span className="omp-detail-label">Output Tokens</span>
                    <span className="omp-detail-value">{metrics.outputTokens.toLocaleString()}</span>
                  </div>
                  <div className="omp-detail-item">
                    <span className="omp-detail-label">Total Tokens</span>
                    <span className="omp-detail-value">
                      {(metrics.inputTokens + metrics.outputTokens).toLocaleString()}
                    </span>
                  </div>
                  <div className="omp-detail-item">
                    <span className="omp-detail-label">Checkpoints</span>
                    <span className="omp-detail-value">{metrics.checkpointCount}</span>
                  </div>
                </div>
              </div>

              {costBurnRate && (
                <div className="omp-details-section">
                  <h3>Burn Rate Trend</h3>
                  <div className="omp-trend">
                    <div className="omp-trend__item">
                      <span>Trend: </span>
                      <strong>
                        {costBurnRate.costTrendPercentage > 0 ? '+' : ''}
                        {costBurnRate.costTrendPercentage.toFixed(1)}%
                      </strong>
                    </div>
                    <div className="omp-trend__item">
                      <span>Minutes Remaining: </span>
                      <strong>{costBurnRate.estimatedMinutesRemaining}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="omp-details-section">
                <h3>Status</h3>
                <div className="omp-status-display">
                  <div className="omp-status-item">
                    <span className="omp-status-label">Execution State</span>
                    <span className={`omp-status-badge omp-status-badge--${metrics.status}`}>
                      {metrics.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="omp-status-item">
                    <span className="omp-status-label">Current Node</span>
                    <code className="omp-status-code">{metrics.currentNode}</code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
