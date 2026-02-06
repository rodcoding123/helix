/**
 * ApprovalRequestCard - Individual exec approval request card
 *
 * Displays a pending command approval with live countdown timer,
 * timeout progress bar, and action buttons (approve/deny/always-allow).
 * Supports keyboard shortcuts A/D when focused.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/* ===================================================================
   Types
   =================================================================== */

export interface ApprovalRequestCardProps {
  id: string;
  command: string;
  args?: string[];
  agentId: string;
  agentName?: string;
  requestedAt: number; // timestamp ms
  timeoutAt?: number; // timestamp ms
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onAlwaysAllow: (id: string, pattern: string) => void;
}

/* ===================================================================
   Helpers
   =================================================================== */

function formatRelativeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function derivePattern(command: string): string {
  // Extract the base command (first word) and create a glob pattern
  const parts = command.trim().split(/\s+/);
  if (parts.length <= 1) return command;
  return `${parts[0]} *`;
}

/* ===================================================================
   Component
   =================================================================== */

export function ApprovalRequestCard({
  id,
  command,
  args,
  agentId,
  agentName,
  requestedAt,
  timeoutAt,
  onApprove,
  onDeny,
  onAlwaysAllow,
}: ApprovalRequestCardProps) {
  const [elapsed, setElapsed] = useState(Date.now() - requestedAt);
  const [actionTaken, setActionTaken] = useState<'approve' | 'deny' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Live timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - requestedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [requestedAt]);

  // Timeout progress (0 = just requested, 1 = timed out)
  const timeoutProgress = timeoutAt
    ? Math.min(1, Math.max(0, (Date.now() - requestedAt) / (timeoutAt - requestedAt)))
    : 0;

  const remainingMs = timeoutAt ? Math.max(0, timeoutAt - Date.now()) : null;
  const remainingSeconds = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;

  // Progress bar color: green -> yellow -> red
  function getProgressColor(progress: number): string {
    if (progress < 0.5) return '#10b981';
    if (progress < 0.8) return '#f59e0b';
    return '#ef4444';
  }

  // Action handlers with animation
  const handleApprove = useCallback(() => {
    if (actionTaken) return;
    setActionTaken('approve');
    onApprove(id);
  }, [id, onApprove, actionTaken]);

  const handleDeny = useCallback(() => {
    if (actionTaken) return;
    setActionTaken('deny');
    onDeny(id);
  }, [id, onDeny, actionTaken]);

  const handleAlwaysAllow = useCallback(() => {
    if (actionTaken) return;
    const pattern = derivePattern(command);
    onAlwaysAllow(id, pattern);
  }, [id, command, onAlwaysAllow, actionTaken]);

  // Keyboard shortcuts when card is focused
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleApprove();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleDeny();
      }
    };

    card.addEventListener('keydown', handleKeyDown);
    return () => card.removeEventListener('keydown', handleKeyDown);
  }, [handleApprove, handleDeny]);

  return (
    <div
      ref={cardRef}
      className={`arc-card ${actionTaken ? `arc-card-${actionTaken}` : ''}`}
      tabIndex={0}
      role="region"
      aria-label={`Approval request: ${command}`}
    >
      <style>{approvalCardStyles}</style>

      {/* Amber left border indicator */}
      <div className="arc-border-accent" />

      {/* Header row: agent + time */}
      <div className="arc-header">
        <span className="arc-agent-badge" title={`Agent: ${agentId}`}>
          {agentName || agentId}
        </span>
        <span className="arc-time" title={new Date(requestedAt).toLocaleString()}>
          {formatRelativeTime(elapsed)}
        </span>
      </div>

      {/* Command display */}
      <div className="arc-command-block">
        <code className="arc-command">{command}</code>
        {args && args.length > 0 && (
          <div className="arc-args">
            {args.map((arg, i) => (
              <code key={i} className="arc-arg">{arg}</code>
            ))}
          </div>
        )}
      </div>

      {/* Timeout progress bar */}
      {timeoutAt && (
        <div className="arc-timeout-section">
          <div className="arc-timeout-bar">
            <div
              className="arc-timeout-fill"
              style={{
                width: `${(1 - timeoutProgress) * 100}%`,
                backgroundColor: getProgressColor(timeoutProgress),
              }}
            />
          </div>
          <span className="arc-timeout-label">
            {remainingSeconds !== null && remainingSeconds > 0
              ? `${remainingSeconds}s remaining`
              : 'Timed out'}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="arc-actions">
        <button
          className="arc-btn arc-btn-approve"
          onClick={handleApprove}
          disabled={actionTaken !== null}
          title="Approve (A)"
          aria-label="Approve command"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Approve
        </button>
        <button
          className="arc-btn arc-btn-deny"
          onClick={handleDeny}
          disabled={actionTaken !== null}
          title="Deny (D)"
          aria-label="Deny command"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Deny
        </button>
        <button
          className="arc-btn arc-btn-always"
          onClick={handleAlwaysAllow}
          disabled={actionTaken !== null}
          title="Always allow this pattern"
          aria-label="Always allow this command pattern"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path
              fillRule="evenodd"
              d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5C17.944 5.652 18 6.32 18 7c0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.68.056-1.348.166-2.001zm3.482 3.294a1 1 0 011.414 0L8 9.231l2.938-2.938a1 1 0 111.414 1.414l-3.645 3.645a1 1 0 01-1.414 0L5.648 9.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Always Allow
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="arc-kbd-hint">
        Press <kbd>A</kbd> to approve, <kbd>D</kbd> to deny
      </div>
    </div>
  );
}

/* ===================================================================
   Scoped styles (arc- prefix)
   =================================================================== */

const approvalCardStyles = `
/* ---- Card ---- */
.arc-card {
  position: relative;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 1rem 1rem 1rem 1.25rem;
  transition: all 0.2s ease;
  outline: none;
  overflow: hidden;
}

.arc-card:focus-visible {
  box-shadow: 0 0 0 2px var(--accent-color, #6366f1);
}

.arc-card:hover {
  border-color: rgba(255,255,255,0.12);
}

.arc-card-approve {
  opacity: 0.6;
  border-color: rgba(16, 185, 129, 0.3);
}

.arc-card-deny {
  opacity: 0.6;
  border-color: rgba(239, 68, 68, 0.3);
}

/* Amber left border accent */
.arc-border-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #f59e0b;
  border-radius: 12px 0 0 12px;
}

/* ---- Header ---- */
.arc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.arc-agent-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1875rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arc-time {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  font-variant-numeric: tabular-nums;
}

/* ---- Command block ---- */
.arc-command-block {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 0.625rem 0.75rem;
  margin-bottom: 0.75rem;
  overflow-x: auto;
}

.arc-command {
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
  font-size: 0.8125rem;
  color: #fbbf24;
  word-break: break-all;
  line-height: 1.5;
}

.arc-args {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255,255,255,0.04);
}

.arc-arg {
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 3px;
  color: var(--text-secondary, #a0a0c0);
}

/* ---- Timeout ---- */
.arc-timeout-section {
  margin-bottom: 0.75rem;
}

.arc-timeout-bar {
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.arc-timeout-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 1s linear, background-color 0.5s ease;
}

.arc-timeout-label {
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
  font-variant-numeric: tabular-nums;
}

/* ---- Actions ---- */
.arc-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.arc-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.arc-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.arc-btn-approve {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.25);
}

.arc-btn-approve:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.25);
  border-color: rgba(16, 185, 129, 0.4);
}

.arc-btn-deny {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.2);
}

.arc-btn-deny:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.35);
}

.arc-btn-always {
  background: rgba(99, 102, 241, 0.12);
  color: #818cf8;
  border-color: rgba(99, 102, 241, 0.2);
}

.arc-btn-always:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.35);
}

/* ---- Keyboard hint ---- */
.arc-kbd-hint {
  margin-top: 0.5rem;
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.arc-card:focus-visible .arc-kbd-hint,
.arc-card:focus-within .arc-kbd-hint {
  opacity: 1;
}

.arc-kbd-hint kbd {
  display: inline-block;
  padding: 0.0625rem 0.3125rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.5625rem;
  font-weight: 600;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 3px;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0.125rem;
}
`;
