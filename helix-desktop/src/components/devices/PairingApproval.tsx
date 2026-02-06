/**
 * PairingApproval - Pairing request approval card
 *
 * Displays a pending pairing request with device info,
 * requested capabilities, and approve/deny actions.
 * Amber left border indicates pending state.
 *
 * CSS prefix: pa-
 */

import { useState, useMemo, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PairingApprovalProps {
  requestId: string;
  deviceName: string;
  platform: string;
  requestedAt: number; // epoch ms
  capabilities: string[];
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Platform icon (emoji) mapping */
function platformIcon(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'macos':
    case 'windows':
    case 'linux':
      return '\uD83D\uDCBB'; // laptop
    case 'ios':
    case 'android':
      return '\uD83D\uDCF1'; // phone
    default:
      return '\uD83D\uDDA5\uFE0F'; // desktop monitor
  }
}

/** Platform display label */
function platformLabel(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'macos':
      return 'macOS';
    case 'windows':
      return 'Windows';
    case 'linux':
      return 'Linux';
    case 'ios':
      return 'iOS';
    case 'android':
      return 'Android';
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1);
  }
}

/** Format time-ago from epoch ms */
function formatTimeAgo(epochMs: number): string {
  const now = Date.now();
  const diffMs = now - epochMs;
  if (diffMs < 0) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec} seconds ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PairingApproval({
  requestId,
  deviceName,
  platform,
  requestedAt,
  capabilities,
  onApprove,
  onDeny,
}: PairingApprovalProps) {
  const [acting, setActing] = useState<'approve' | 'deny' | null>(null);

  const timeAgo = useMemo(() => formatTimeAgo(requestedAt), [requestedAt]);

  const handleApprove = useCallback(() => {
    setActing('approve');
    onApprove(requestId);
  }, [requestId, onApprove]);

  const handleDeny = useCallback(() => {
    setActing('deny');
    onDeny(requestId);
  }, [requestId, onDeny]);

  return (
    <div className="pa-card">
      <style>{pairingApprovalStyles}</style>

      {/* Device info */}
      <div className="pa-header">
        <span className="pa-icon">{platformIcon(platform)}</span>
        <div className="pa-info">
          <span className="pa-device-name">{deviceName}</span>
          <span className="pa-platform">{platformLabel(platform)}</span>
        </div>
        <span className="pa-time">Requested {timeAgo}</span>
      </div>

      {/* Requested capabilities */}
      {capabilities.length > 0 && (
        <div className="pa-caps-section">
          <span className="pa-caps-label">Requested capabilities:</span>
          <div className="pa-caps">
            {capabilities.map((cap) => (
              <span key={cap} className="pa-cap-tag">
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Auto-expire note */}
      <div className="pa-expire-note">
        Pairing requests expire after 10 minutes of inactivity.
      </div>

      {/* Actions */}
      <div className="pa-actions">
        <button
          className="pa-btn pa-btn--approve"
          onClick={handleApprove}
          disabled={acting !== null}
          type="button"
        >
          {acting === 'approve' ? 'Approving...' : 'Approve'}
        </button>
        <button
          className="pa-btn pa-btn--deny"
          onClick={handleDeny}
          disabled={acting !== null}
          type="button"
        >
          {acting === 'deny' ? 'Denying...' : 'Deny'}
        </button>
      </div>
    </div>
  );
}

export default PairingApproval;

// ---------------------------------------------------------------------------
// Scoped Styles (pa- prefix)
// ---------------------------------------------------------------------------

const pairingApprovalStyles = `
.pa-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-left: 3px solid #f59e0b;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  transition: all 0.2s ease;
}

.pa-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(245, 158, 11, 0.4);
  border-left-color: #f59e0b;
}

/* Header */
.pa-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.pa-icon {
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
}

.pa-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.pa-device-name {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pa-platform {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.pa-time {
  font-size: 0.6875rem;
  color: #fbbf24;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Capabilities */
.pa-caps-section {
  margin-bottom: 0.625rem;
}

.pa-caps-label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.375rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pa-caps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.pa-cap-tag {
  font-size: 0.625rem;
  font-weight: 500;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: rgba(245, 158, 11, 0.1);
  color: #fbbf24;
  white-space: nowrap;
}

/* Expire note */
.pa-expire-note {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  font-style: italic;
  margin-bottom: 0.75rem;
}

/* Actions */
.pa-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.625rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.pa-btn {
  padding: 0.4rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  border: none;
}

.pa-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pa-btn--approve {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.pa-btn--approve:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.25);
  border-color: rgba(16, 185, 129, 0.5);
}

.pa-btn--deny {
  background: transparent;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.pa-btn--deny:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.5);
}

/* Responsive */
@media (max-width: 480px) {
  .pa-card {
    padding: 0.875rem 1rem;
  }

  .pa-actions {
    flex-direction: column;
  }

  .pa-btn {
    width: 100%;
    text-align: center;
  }
}
`;
