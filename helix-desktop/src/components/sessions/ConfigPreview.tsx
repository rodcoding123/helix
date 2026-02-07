/**
 * Config Preview
 *
 * Preview of configuration changes and their impact before applying
 * Phase G.1 - Session Configuration & Token Management
 */

import { useState, useCallback } from 'react';

export interface ConfigChange {
  field: string;
  oldValue: string | number | boolean;
  newValue: string | number | boolean;
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface ConfigPreviewProps {
  changes: ConfigChange[];
  affectedSessions: number;
  estimatedCost?: number;
  onApply: () => Promise<void>;
  onCancel: () => void;
}

export function ConfigPreview({
  changes,
  affectedSessions,
  estimatedCost,
  onApply,
  onCancel,
}: ConfigPreviewProps) {
  const [applying, setApplying] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  const handleApply = useCallback(async () => {
    try {
      setApplying(true);
      await onApply();
    } finally {
      setApplying(false);
    }
  }, [onApply]);

  const criticalChanges = changes.filter(c => c.impact === 'critical');
  const highChanges = changes.filter(c => c.impact === 'high');

  return (
    <div className="config-preview">
      <style>{configPreviewStyles}</style>

      <div className="preview-modal-overlay">
        <div className="preview-modal">
          {/* Header */}
          <div className="preview-header">
            <h3>Review Configuration Changes</h3>
            <button
              className="close-btn"
              onClick={onCancel}
              disabled={applying}
              aria-label="Close preview"
            >
              ✕
            </button>
          </div>

          {/* Impact Summary */}
          <div className="impact-summary">
            <div className="impact-card">
              <div className="impact-icon">📊</div>
              <div className="impact-content">
                <div className="impact-label">Affected Sessions</div>
                <div className="impact-value">{affectedSessions}</div>
              </div>
            </div>

            {estimatedCost !== undefined && (
              <div className="impact-card">
                <div className="impact-icon">💰</div>
                <div className="impact-content">
                  <div className="impact-label">Estimated Cost</div>
                  <div className="impact-value">${estimatedCost.toFixed(4)}</div>
                </div>
              </div>
            )}

            <div className="impact-card">
              <div className="impact-icon">⚠️</div>
              <div className="impact-content">
                <div className="impact-label">Risk Level</div>
                <div className={`impact-value risk-${criticalChanges.length > 0 ? 'critical' : highChanges.length > 0 ? 'high' : 'low'}`}>
                  {criticalChanges.length > 0 ? 'Critical' : highChanges.length > 0 ? 'High' : 'Low'}
                </div>
              </div>
            </div>
          </div>

          {/* Critical Changes Warning */}
          {criticalChanges.length > 0 && (
            <div className="critical-warning">
              <strong>🚨 Critical Changes:</strong>
              <ul>
                {criticalChanges.map((change, idx) => (
                  <li key={idx}>{change.description}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Changes List */}
          <div className="changes-section">
            <div className="section-header">
              <h4>Changes ({changes.length})</h4>
              <button
                className="toggle-details-btn"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? '▼' : '▶'} {showDetails ? 'Hide' : 'Show'} Details
              </button>
            </div>

            {showDetails && (
              <div className="changes-list">
                {changes.map((change, idx) => (
                  <div key={idx} className={`change-item impact-${change.impact}`}>
                    <div className="change-header">
                      <div className="change-field">
                        <span className="field-name">{change.field}</span>
                        <span className={`impact-badge impact-${change.impact}`}>
                          {change.impact.toUpperCase()}
                        </span>
                      </div>
                      <div className="change-arrow">→</div>
                    </div>

                    <div className="change-values">
                      <div className="old-value">
                        <span className="label">Old:</span>
                        <code>{String(change.oldValue)}</code>
                      </div>
                      <div className="new-value">
                        <span className="label">New:</span>
                        <code>{String(change.newValue)}</code>
                      </div>
                    </div>

                    <div className="change-description">
                      {change.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Affected Sessions Info */}
          <div className="affected-sessions-info">
            <strong>ℹ️ Info:</strong>
            {affectedSessions === 0 ? (
              <p>These changes will only apply to new sessions created after this point.</p>
            ) : (
              <p>
                {affectedSessions} existing session{affectedSessions !== 1 ? 's' : ''} will be affected by these changes.
                {affectedSessions > 10 && ' This may have performance implications.'}
              </p>
            )}
          </div>

          {/* Confirmation Checkbox for Critical Changes */}
          {criticalChanges.length > 0 && (
            <div className="confirmation-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I understand the critical changes and want to proceed
                </span>
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              className="btn btn-cancel"
              onClick={onCancel}
              disabled={applying}
            >
              Cancel
            </button>
            <button
              className="btn btn-apply"
              onClick={handleApply}
              disabled={
                applying ||
                (criticalChanges.length > 0 && !confirmed)
              }
            >
              {applying ? 'Applying...' : 'Apply Changes'}
            </button>
          </div>

          {/* Help Text */}
          <div className="preview-footer">
            <small>
              Changes will be applied immediately. You can undo most changes in Settings.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

const configPreviewStyles = `
.config-preview {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}

.preview-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.preview-modal {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.preview-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: color 0.2s ease;
}

.close-btn:hover:not(:disabled) {
  color: var(--text-primary, #fff);
}

.close-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.impact-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(99, 102, 241, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.impact-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 6px;
}

.impact-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.impact-content {
  flex: 1;
}

.impact-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.25rem;
}

.impact-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #818cf8;
}

.impact-value.risk-critical {
  color: #ef4444;
}

.impact-value.risk-high {
  color: #f59e0b;
}

.impact-value.risk-low {
  color: #10b981;
}

.critical-warning {
  padding: 1rem;
  margin: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #fca5a5;
  font-size: 0.875rem;
}

.critical-warning strong {
  color: #fca5a5;
}

.critical-warning ul {
  margin: 0.5rem 0 0 1.25rem;
  padding: 0;
}

.critical-warning li {
  margin: 0.25rem 0;
}

.changes-section {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h4 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.toggle-details-btn {
  background: none;
  border: none;
  color: #818cf8;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: color 0.2s ease;
}

.toggle-details-btn:hover {
  color: #a5b4fc;
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.change-item {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  border-left: 3px solid #606080;
}

.change-item.impact-low {
  border-left-color: #10b981;
}

.change-item.impact-medium {
  border-left-color: #f59e0b;
}

.change-item.impact-high {
  border-left-color: #f59e0b;
}

.change-item.impact-critical {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.change-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.change-field {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.field-name {
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.impact-badge {
  font-size: 0.65rem;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-weight: 600;
  text-transform: uppercase;
}

.impact-badge.impact-low {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.impact-badge.impact-medium {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.impact-badge.impact-high {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.impact-badge.impact-critical {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.change-arrow {
  color: var(--text-tertiary, #606080);
  margin: 0 0.5rem;
}

.change-values {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.8125rem;
}

.old-value,
.new-value {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.old-value .label,
.new-value .label {
  font-weight: 600;
  color: var(--text-tertiary, #606080);
}

.old-value code,
.new-value code {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  color: #818cf8;
  font-family: monospace;
  word-break: break-all;
}

.change-description {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.5rem;
}

.affected-sessions-info,
.confirmation-section {
  padding: 1rem 1.5rem;
  font-size: 0.875rem;
}

.affected-sessions-info {
  background: rgba(96, 165, 250, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.affected-sessions-info strong {
  color: #60a5fa;
}

.affected-sessions-info p {
  margin: 0.5rem 0 0 0;
  color: var(--text-secondary, #a0a0c0);
}

.confirmation-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.checkbox-label input {
  cursor: pointer;
}

.checkbox-label span {
  color: var(--text-primary, #fff);
}

.action-buttons {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.01);
}

.btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #fff);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-cancel:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.btn-apply {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  border: none;
}

.btn-apply:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.preview-footer {
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.02);
  text-align: center;
  color: var(--text-tertiary, #606080);
  font-size: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
`;
