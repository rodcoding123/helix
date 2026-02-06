/**
 * ApprovalHistory - Collapsible log of past exec approval decisions
 *
 * Displays a table of recent approval decisions with color-coded badges,
 * truncated commands with click-to-expand, and relative timestamps.
 */

import { useState, useMemo } from 'react';

/* ===================================================================
   Types
   =================================================================== */

export interface ApprovalHistoryEntry {
  id: string;
  command: string;
  agentId: string;
  agentName?: string;
  decision: 'approved' | 'denied' | 'timeout';
  resolvedBy: 'user' | 'policy' | 'timeout';
  timestamp: number;
}

export interface ApprovalHistoryProps {
  entries: ApprovalHistoryEntry[];
  expanded?: boolean;
  onToggle?: () => void;
}

/* ===================================================================
   Helpers
   =================================================================== */

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getDecisionConfig(decision: 'approved' | 'denied' | 'timeout'): {
  label: string;
  cls: string;
} {
  switch (decision) {
    case 'approved':
      return { label: 'Approved', cls: 'ah-decision-approved' };
    case 'denied':
      return { label: 'Denied', cls: 'ah-decision-denied' };
    case 'timeout':
      return { label: 'Timed Out', cls: 'ah-decision-timeout' };
  }
}

function getResolvedByLabel(resolvedBy: 'user' | 'policy' | 'timeout'): string {
  switch (resolvedBy) {
    case 'user':
      return 'User';
    case 'policy':
      return 'Auto-policy';
    case 'timeout':
      return 'Timeout';
  }
}

/* ===================================================================
   Component
   =================================================================== */

export function ApprovalHistory({ entries, expanded = false, onToggle }: ApprovalHistoryProps) {
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50),
    [entries]
  );

  const toggleCommand = (id: string) => {
    setExpandedCommands((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const approvedCount = entries.filter((e) => e.decision === 'approved').length;
  const deniedCount = entries.filter((e) => e.decision === 'denied').length;

  return (
    <div className="ah-container">
      <style>{approvalHistoryStyles}</style>

      {/* Collapsible header */}
      <button
        className="ah-header"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls="ah-content"
      >
        <div className="ah-header-left">
          <svg
            className={`ah-chevron ${expanded ? 'ah-chevron-open' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            width="16"
            height="16"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="ah-title">Recent History</h3>
          <span className="ah-entry-count">{entries.length}</span>
        </div>
        <div className="ah-header-right">
          {approvedCount > 0 && (
            <span className="ah-stat ah-stat-approved">{approvedCount} approved</span>
          )}
          {deniedCount > 0 && (
            <span className="ah-stat ah-stat-denied">{deniedCount} denied</span>
          )}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div id="ah-content" className="ah-content">
          {sortedEntries.length === 0 ? (
            <div className="ah-empty">
              <svg viewBox="0 0 20 20" fill="currentColor" width="32" height="32">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <p>No approval history yet</p>
            </div>
          ) : (
            <div className="ah-table-wrapper">
              <table className="ah-table">
                <thead>
                  <tr>
                    <th className="ah-th">Time</th>
                    <th className="ah-th ah-th-command">Command</th>
                    <th className="ah-th">Agent</th>
                    <th className="ah-th">Decision</th>
                    <th className="ah-th">Resolved By</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry) => {
                    const decision = getDecisionConfig(entry.decision);
                    const isExpanded = expandedCommands.has(entry.id);
                    const commandTruncated = entry.command.length > 60;

                    return (
                      <tr key={entry.id} className="ah-row">
                        <td
                          className="ah-td ah-td-time"
                          title={new Date(entry.timestamp).toLocaleString()}
                        >
                          {formatRelativeTime(entry.timestamp)}
                        </td>
                        <td className="ah-td ah-td-command">
                          <button
                            className="ah-command-btn"
                            onClick={() => commandTruncated && toggleCommand(entry.id)}
                            title={commandTruncated ? 'Click to expand' : undefined}
                            style={{
                              cursor: commandTruncated ? 'pointer' : 'default',
                            }}
                          >
                            <code className="ah-command-text">
                              {isExpanded || !commandTruncated
                                ? entry.command
                                : `${entry.command.slice(0, 57)}...`}
                            </code>
                          </button>
                        </td>
                        <td className="ah-td">
                          <span className="ah-agent">{entry.agentName || entry.agentId}</span>
                        </td>
                        <td className="ah-td">
                          <span className={`ah-decision-badge ${decision.cls}`}>
                            {decision.label}
                          </span>
                        </td>
                        <td className="ah-td ah-td-resolver">
                          {getResolvedByLabel(entry.resolvedBy)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ===================================================================
   Scoped styles (ah- prefix)
   =================================================================== */

const approvalHistoryStyles = `
/* ---- Container ---- */
.ah-container {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  overflow: hidden;
}

/* ---- Header ---- */
.ah-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.875rem 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
}

.ah-header:hover {
  background: rgba(255,255,255,0.02);
}

.ah-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ah-header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ah-chevron {
  color: var(--text-tertiary, #606080);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.ah-chevron-open {
  transform: rotate(90deg);
}

.ah-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.ah-entry-count {
  font-size: 0.6875rem;
  font-weight: 600;
  background: rgba(255,255,255,0.08);
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
  color: var(--text-secondary, #a0a0c0);
}

.ah-stat {
  font-size: 0.6875rem;
  font-weight: 500;
}

.ah-stat-approved {
  color: #34d399;
}

.ah-stat-denied {
  color: #f87171;
}

/* ---- Content ---- */
.ah-content {
  border-top: 1px solid rgba(255,255,255,0.06);
  animation: ah-slide-in 0.15s ease;
}

@keyframes ah-slide-in {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 2000px;
  }
}

/* ---- Empty state ---- */
.ah-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1rem;
  color: var(--text-tertiary, #606080);
  gap: 0.5rem;
}

.ah-empty svg {
  opacity: 0.3;
}

.ah-empty p {
  font-size: 0.8125rem;
  margin: 0;
}

/* ---- Table ---- */
.ah-table-wrapper {
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.ah-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.ah-th {
  padding: 0.625rem 0.75rem;
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  white-space: nowrap;
  position: sticky;
  top: 0;
  background: var(--bg-secondary, #111127);
  z-index: 1;
}

.ah-th-command {
  min-width: 200px;
}

.ah-row {
  transition: background 0.1s ease;
}

.ah-row:hover {
  background: rgba(255,255,255,0.02);
}

.ah-td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  vertical-align: middle;
  color: var(--text-secondary, #a0a0c0);
}

.ah-td-time {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary, #606080);
  white-space: nowrap;
}

.ah-td-command {
  max-width: 400px;
}

.ah-command-btn {
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  display: block;
  width: 100%;
}

.ah-command-text {
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  word-break: break-all;
}

.ah-agent {
  font-size: 0.75rem;
  color: #818cf8;
  white-space: nowrap;
}

.ah-td-resolver {
  font-size: 0.75rem;
  white-space: nowrap;
}

/* ---- Decision badges ---- */
.ah-decision-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1875rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 4px;
  white-space: nowrap;
}

.ah-decision-approved {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.ah-decision-denied {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
}

.ah-decision-timeout {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
}
`;
