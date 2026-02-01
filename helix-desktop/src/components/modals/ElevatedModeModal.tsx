/**
 * Elevated Mode Modal - Request approval for elevated permissions
 */

import { useState, useEffect } from 'react';
import './ElevatedModeModal.css';

interface ElevatedModeRequest {
  id: string;
  type: 'tool' | 'command' | 'file' | 'network' | 'system';
  action: string;
  description: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  details?: {
    command?: string;
    path?: string;
    url?: string;
    tool?: string;
    args?: Record<string, unknown>;
  };
  requestedAt: string;
  expiresIn?: number; // seconds
}

interface ElevatedModeModalProps {
  request: ElevatedModeRequest;
  onApprove: (id: string, options?: { remember?: boolean; duration?: number }) => void;
  onDeny: (id: string) => void;
  onClose: () => void;
}

const RISK_INFO = {
  low: {
    color: 'risk-low',
    label: 'Low Risk',
    description: 'This action has minimal impact and is generally safe.',
    icon: '🟢',
  },
  medium: {
    color: 'risk-medium',
    label: 'Medium Risk',
    description: 'This action may modify data or system state.',
    icon: '🟡',
  },
  high: {
    color: 'risk-high',
    label: 'High Risk',
    description: 'This action can significantly modify your system or data.',
    icon: '🟠',
  },
  critical: {
    color: 'risk-critical',
    label: 'Critical Risk',
    description: 'This action is potentially destructive. Review carefully.',
    icon: '🔴',
  },
};

const TYPE_INFO = {
  tool: { icon: '🔧', label: 'Tool Execution' },
  command: { icon: '⚡', label: 'Shell Command' },
  file: { icon: '📁', label: 'File Operation' },
  network: { icon: '🌐', label: 'Network Request' },
  system: { icon: '⚙️', label: 'System Operation' },
};

const DURATION_OPTIONS = [
  { value: 0, label: 'This request only' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 86400, label: 'This session' },
];

export function ElevatedModeModal({
  request,
  onApprove,
  onDeny,
  onClose,
}: ElevatedModeModalProps) {
  const [remember, setRemember] = useState(false);
  const [duration, setDuration] = useState(0);
  const [countdown, setCountdown] = useState(request.expiresIn || 60);

  const riskInfo = RISK_INFO[request.risk];
  const typeInfo = TYPE_INFO[request.type];

  useEffect(() => {
    if (countdown <= 0) {
      onDeny(request.id);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, request.id, onDeny]);

  const handleApprove = () => {
    onApprove(request.id, remember ? { remember: true, duration } : undefined);
  };

  const handleDeny = () => {
    onDeny(request.id);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="elevated-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="header-icon">
            <span className="shield-icon">🛡️</span>
          </div>
          <div className="header-content">
            <h2>Permission Required</h2>
            <p className="header-subtitle">Helix is requesting elevated permissions</p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </header>

        <div className="modal-body">
          {/* Action Info */}
          <div className="action-card">
            <div className="action-header">
              <span className="action-type-icon">{typeInfo.icon}</span>
              <div className="action-info">
                <span className="action-type">{typeInfo.label}</span>
                <span className="action-name">{request.action}</span>
              </div>
              <span className={`risk-badge ${riskInfo.color}`}>
                {riskInfo.icon} {riskInfo.label}
              </span>
            </div>
            <p className="action-description">{request.description}</p>
          </div>

          {/* Details */}
          {request.details && (
            <div className="details-section">
              <h3>Details</h3>
              <div className="details-content">
                {request.details.command && (
                  <div className="detail-row">
                    <span className="detail-label">Command:</span>
                    <code className="detail-value">{request.details.command}</code>
                  </div>
                )}
                {request.details.path && (
                  <div className="detail-row">
                    <span className="detail-label">Path:</span>
                    <code className="detail-value">{request.details.path}</code>
                  </div>
                )}
                {request.details.url && (
                  <div className="detail-row">
                    <span className="detail-label">URL:</span>
                    <code className="detail-value">{request.details.url}</code>
                  </div>
                )}
                {request.details.tool && (
                  <div className="detail-row">
                    <span className="detail-label">Tool:</span>
                    <code className="detail-value">{request.details.tool}</code>
                  </div>
                )}
                {request.details.args && (
                  <div className="detail-row">
                    <span className="detail-label">Arguments:</span>
                    <pre className="detail-args">
                      {JSON.stringify(request.details.args, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Risk Warning */}
          <div className={`risk-warning ${riskInfo.color}`}>
            <span className="warning-icon">{riskInfo.icon}</span>
            <p>{riskInfo.description}</p>
          </div>

          {/* Remember Option */}
          <div className="remember-section">
            <label className="remember-toggle">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember this decision</span>
            </label>

            {remember && (
              <div className="duration-options">
                <span className="duration-label">For:</span>
                {DURATION_OPTIONS.map(opt => (
                  <label key={opt.value} className={`duration-option ${duration === opt.value ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="duration"
                      value={opt.value}
                      checked={duration === opt.value}
                      onChange={() => setDuration(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="modal-footer">
          <div className="countdown">
            Auto-deny in <span className="countdown-value">{countdown}s</span>
          </div>
          <div className="footer-actions">
            <button className="btn-deny" onClick={handleDeny}>
              Deny
            </button>
            <button className="btn-approve" onClick={handleApprove}>
              Approve
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Queue manager for multiple pending requests
interface ElevatedModeQueueProps {
  requests: ElevatedModeRequest[];
  onApprove: (id: string, options?: { remember?: boolean; duration?: number }) => void;
  onDeny: (id: string) => void;
  onApproveAll: () => void;
  onDenyAll: () => void;
}

export function ElevatedModeQueue({
  requests,
  onApprove,
  onDeny,
  onApproveAll,
  onDenyAll,
}: ElevatedModeQueueProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (requests.length === 0) return null;

  const currentRequest = requests[currentIndex];

  const handleApprove = (id: string, options?: { remember?: boolean; duration?: number }) => {
    onApprove(id, options);
    if (currentIndex < requests.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleDeny = (id: string) => {
    onDeny(id);
    if (currentIndex < requests.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <div className="elevated-queue">
      {requests.length > 1 && (
        <div className="queue-header">
          <span className="queue-count">
            Request {currentIndex + 1} of {requests.length}
          </span>
          <div className="queue-actions">
            <button className="btn-secondary btn-sm" onClick={onDenyAll}>
              Deny All
            </button>
            <button className="btn-primary btn-sm" onClick={onApproveAll}>
              Approve All
            </button>
          </div>
        </div>
      )}
      <ElevatedModeModal
        request={currentRequest}
        onApprove={handleApprove}
        onDeny={handleDeny}
        onClose={() => handleDeny(currentRequest.id)}
      />
    </div>
  );
}
