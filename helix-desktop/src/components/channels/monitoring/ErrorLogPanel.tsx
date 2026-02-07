/**
 * Error Log Panel - Error tracking and diagnostics
 *
 * Displays:
 * - Recent errors with timestamps
 * - Error codes and messages
 * - Error context (channel, account, etc.)
 * - Resolution status
 */

import { useState } from 'react';
import './error-log-panel.css';

interface ChannelError {
  id: string;
  channel: string;
  code: string;
  message: string;
  timestamp: number;
  resolved: boolean;
  context?: Record<string, unknown>;
}

export interface ErrorLogPanelProps {
  channel: string;
  errors: ChannelError[];
}

export function ErrorLogPanel({ _channel, errors }: ErrorLogPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const unresolvedCount = errors.filter((e) => !e.resolved).length;
  const resolvedCount = errors.filter((e) => e.resolved).length;

  if (!errors.length) {
    return (
      <div className="elp-container">
        <div className="elp-empty">
          <p className="elp-empty-title">✅ No errors</p>
          <p className="elp-empty-subtitle">Channel is operating without errors</p>
        </div>
      </div>
    );
  }

  return (
    <div className="elp-container">
      {/* Summary */}
      <div className="elp-summary">
        <div className="elp-summary-item">
          <div className="elp-summary-label">Total Errors</div>
          <div className="elp-summary-value">{errors.length}</div>
        </div>
        <div className="elp-summary-item">
          <div className="elp-summary-label">Unresolved</div>
          <div className={`elp-summary-value ${unresolvedCount > 0 ? 'warning' : ''}`}>
            {unresolvedCount}
          </div>
        </div>
        <div className="elp-summary-item">
          <div className="elp-summary-label">Resolved</div>
          <div className="elp-summary-value success">{resolvedCount}</div>
        </div>
      </div>

      {/* Error List */}
      <div className="elp-error-list">
        {errors.map((error) => {
          const timeStr = new Date(error.timestamp).toLocaleString();
          const isExpanded = expandedId === error.id;

          return (
            <div
              key={error.id}
              className={`elp-error-item ${error.resolved ? 'resolved' : 'unresolved'}`}
            >
              {/* Header */}
              <button
                className="elp-error-header"
                onClick={() => setExpandedId(isExpanded ? null : error.id)}
              >
                <div className="elp-error-status">
                  {error.resolved ? '✅' : '❌'}
                </div>

                <div className="elp-error-info">
                  <div className="elp-error-code">{error.code}</div>
                  <div className="elp-error-message">{error.message}</div>
                </div>

                <div className="elp-error-time">{timeStr}</div>

                <div className={`elp-error-toggle ${isExpanded ? 'open' : ''}`}>▼</div>
              </button>

              {/* Details */}
              {isExpanded && error.context && (
                <div className="elp-error-details">
                  <div className="elp-details-title">Context</div>
                  <div className="elp-details-content">
                    {Object.entries(error.context).map(([key, value]) => (
                      <div key={key} className="elp-detail-row">
                        <span className="elp-detail-key">{key}:</span>
                        <span className="elp-detail-value">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="elp-error-actions">
                    <button className="elp-action-btn">Mark as Resolved</button>
                    <button className="elp-action-btn elp-action-btn-secondary">
                      Copy Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
