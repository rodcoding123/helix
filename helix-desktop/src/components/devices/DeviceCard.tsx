/**
 * DeviceCard - Individual device display card
 *
 * Shows a paired device with platform icon, status indicator,
 * capabilities tags, and actions (rotate token, revoke, rename).
 *
 * Inline rename via double-click on the device name.
 * Dangerous actions (revoke, rotate) require confirmation.
 *
 * CSS prefix: dc-
 */

import { useState, useRef, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeviceCardProps {
  id: string;
  name: string;
  platform: string; // 'macos' | 'windows' | 'linux' | 'ios' | 'android'
  capabilities: string[];
  status: 'online' | 'offline';
  lastSeen?: string; // ISO timestamp
  isCurrentDevice?: boolean;
  onRotateToken?: (id: string) => void;
  onRevoke?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
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

/** Format "last seen" into a relative time string */
function formatLastSeen(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (isNaN(then)) return 'Unknown';

  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;

  return new Date(iso).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeviceCard({
  id,
  name,
  platform,
  capabilities,
  status,
  lastSeen,
  isCurrentDevice,
  onRotateToken,
  onRevoke,
  onRename,
}: DeviceCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const [confirmAction, setConfirmAction] = useState<'revoke' | 'rotate' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync external name changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(name);
    }
  }, [name, isEditing]);

  const handleDoubleClick = useCallback(() => {
    if (onRename) {
      setIsEditing(true);
      setEditValue(name);
    }
  }, [name, onRename]);

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    setIsEditing(false);
    if (trimmed && trimmed !== name) {
      onRename?.(id, trimmed);
    } else {
      setEditValue(name);
    }
  }, [editValue, name, id, onRename]);

  const cancelRename = useCallback(() => {
    setIsEditing(false);
    setEditValue(name);
  }, [name]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        commitRename();
      } else if (e.key === 'Escape') {
        cancelRename();
      }
    },
    [commitRename, cancelRename]
  );

  const handleConfirmAction = useCallback(() => {
    if (confirmAction === 'revoke') {
      onRevoke?.(id);
    } else if (confirmAction === 'rotate') {
      onRotateToken?.(id);
    }
    setConfirmAction(null);
  }, [confirmAction, id, onRevoke, onRotateToken]);

  const isOnline = status === 'online';

  return (
    <div className={`dc-card ${isOnline ? 'dc-card--online' : 'dc-card--offline'}`}>
      <style>{deviceCardStyles}</style>

      {/* Header: icon + name + status */}
      <div className="dc-header">
        <span className="dc-icon">{platformIcon(platform)}</span>
        <div className="dc-title-group">
          {isEditing ? (
            <input
              ref={inputRef}
              className="dc-name-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              maxLength={64}
            />
          ) : (
            <span
              className="dc-name"
              onDoubleClick={handleDoubleClick}
              title={onRename ? 'Double-click to rename' : undefined}
            >
              {name}
            </span>
          )}
          <div className="dc-subtitle-row">
            <span className="dc-platform">{platformLabel(platform)}</span>
            {isCurrentDevice && <span className="dc-this-badge">This device</span>}
          </div>
        </div>
      </div>

      {/* Status row */}
      <div className="dc-status-row">
        <span className={`dc-status ${isOnline ? 'dc-status--online' : 'dc-status--offline'}`}>
          <span className="dc-status-dot" />
          {isOnline ? 'Online' : 'Offline'}
        </span>
        {!isOnline && lastSeen && (
          <span className="dc-last-seen">Last seen: {formatLastSeen(lastSeen)}</span>
        )}
      </div>

      {/* Capabilities */}
      {capabilities.length > 0 && (
        <div className="dc-caps">
          {capabilities.map((cap) => (
            <span key={cap} className="dc-cap-tag">
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* Confirm dialog overlay */}
      {confirmAction !== null && (
        <div className="dc-confirm">
          <span className="dc-confirm-text">
            {confirmAction === 'revoke'
              ? 'Revoke access for this device? This cannot be undone.'
              : 'Rotate this device token? The device will need to re-authenticate.'}
          </span>
          <div className="dc-confirm-btns">
            <button
              className="dc-btn dc-btn--secondary dc-btn--sm"
              onClick={() => setConfirmAction(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={`dc-btn dc-btn--sm ${confirmAction === 'revoke' ? 'dc-btn--danger' : 'dc-btn--warning'}`}
              onClick={handleConfirmAction}
              type="button"
            >
              {confirmAction === 'revoke' ? 'Revoke' : 'Rotate'}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {confirmAction === null && (
        <div className="dc-actions">
          {onRotateToken && (
            <button
              className="dc-btn dc-btn--secondary dc-btn--sm"
              onClick={() => setConfirmAction('rotate')}
              type="button"
              title="Rotate device token"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              Rotate Token
            </button>
          )}
          {onRevoke && !isCurrentDevice && (
            <button
              className="dc-btn dc-btn--danger dc-btn--sm"
              onClick={() => setConfirmAction('revoke')}
              type="button"
              title="Revoke device access"
            >
              Revoke
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default DeviceCard;

// ---------------------------------------------------------------------------
// Scoped Styles (dc- prefix)
// ---------------------------------------------------------------------------

const deviceCardStyles = `
.dc-card {
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.25rem;
  transition: all 0.2s ease;
}

.dc-card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.08);
  background: rgba(255, 255, 255, 0.05);
}

.dc-card--offline {
  opacity: 0.7;
}

.dc-card--offline:hover {
  opacity: 0.9;
}

/* Header */
.dc-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.dc-icon {
  font-size: 1.75rem;
  line-height: 1;
  flex-shrink: 0;
}

.dc-title-group {
  flex: 1;
  min-width: 0;
}

.dc-name {
  display: block;
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
  border-radius: 4px;
  padding: 1px 2px;
  margin: -1px -2px;
  transition: background 0.15s ease;
}

.dc-name:hover {
  background: rgba(255, 255, 255, 0.04);
}

.dc-name-input {
  width: 100%;
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary, #fff);
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid var(--accent-color, #6366f1);
  border-radius: 4px;
  padding: 1px 4px;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  font-family: inherit;
}

.dc-subtitle-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.2rem;
}

.dc-platform {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.dc-this-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.15);
  padding: 0.1rem 0.375rem;
  border-radius: 3px;
}

/* Status */
.dc-status-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.dc-status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.dc-status--online {
  color: #10b981;
}

.dc-status--offline {
  color: var(--text-tertiary, #606080);
}

.dc-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.dc-status--online .dc-status-dot {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
}

.dc-status--offline .dc-status-dot {
  background: #606080;
}

.dc-last-seen {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

/* Capabilities */
.dc-caps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.875rem;
}

.dc-cap-tag {
  font-size: 0.625rem;
  font-weight: 500;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary, #a0a0c0);
  white-space: nowrap;
}

/* Confirm overlay */
.dc-confirm {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.dc-confirm-text {
  font-size: 0.8125rem;
  color: #fca5a5;
  line-height: 1.4;
}

.dc-confirm-btns {
  display: flex;
  gap: 0.5rem;
}

/* Actions */
.dc-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* Buttons */
.dc-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  border: none;
}

.dc-btn--sm {
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
}

.dc-btn--secondary {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.dc-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #fff);
}

.dc-btn--danger {
  background: transparent;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.dc-btn--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.6);
}

.dc-btn--warning {
  background: transparent;
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.dc-btn--warning:hover {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.6);
}

/* Responsive */
@media (max-width: 480px) {
  .dc-card {
    padding: 1rem;
  }

  .dc-actions {
    flex-direction: column;
  }
}
`;
