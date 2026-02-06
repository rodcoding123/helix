/**
 * BrowserActions - Browser action controls, tab management, and action log
 *
 * Three collapsible sections:
 *   1. Tabs - List/switch/close/new tabs
 *   2. Actions - Quick action buttons with parameter inputs
 *   3. Snapshot - Accessibility tree viewer with search
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowserTab {
  title: string;
  url: string;
  active: boolean;
}

export interface ActionLogEntry {
  timestamp: number;
  action: string;
  target?: string;
  result?: string;
  success: boolean;
}

export interface BrowserActionsProps {
  tabs: BrowserTab[];
  activeTabIndex: number;
  actionLog: ActionLogEntry[];
  snapshotData?: string;
  onSwitchTab: (index: number) => void;
  onCloseTab: (index: number) => void;
  onNewTab: () => void;
  onAction: (action: string, params: Record<string, string>) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface ActionDefinition {
  id: string;
  label: string;
  icon: string;
  params: { key: string; placeholder: string }[];
}

const BROWSER_ACTIONS: ActionDefinition[] = [
  {
    id: 'click',
    label: 'Click',
    icon: 'M15 15l-2 5L9 9l11 4-5 2z',
    params: [{ key: 'ref', placeholder: 'Element ref (e.g. S1a)' }],
  },
  {
    id: 'type',
    label: 'Type',
    icon: 'M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
    params: [
      { key: 'ref', placeholder: 'Element ref (e.g. S1a)' },
      { key: 'text', placeholder: 'Text to type' },
    ],
  },
  {
    id: 'scroll',
    label: 'Scroll',
    icon: 'M12 5v14M5 12l7-7 7 7',
    params: [
      { key: 'direction', placeholder: 'up or down' },
      { key: 'amount', placeholder: 'Pixels (default: 300)' },
    ],
  },
  {
    id: 'wait',
    label: 'Wait',
    icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2',
    params: [{ key: 'time', placeholder: 'Seconds (e.g. 2)' }],
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  count,
  expanded,
  onToggle,
}: {
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button className="ba-section-header" onClick={onToggle} type="button">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`ba-chevron ${expanded ? 'ba-chevron--expanded' : ''}`}
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
      <span className="ba-section-title">{title}</span>
      {count !== undefined && (
        <span className="ba-section-count">{count}</span>
      )}
    </button>
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function truncateUrl(url: string, maxLen: number = 40): string {
  if (url.length <= maxLen) return url;
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    if (path.length > maxLen - u.host.length - 5) {
      return u.host + path.slice(0, maxLen - u.host.length - 5) + '...';
    }
    return u.host + path;
  } catch {
    return url.slice(0, maxLen) + '...';
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BrowserActions({
  tabs,
  activeTabIndex,
  actionLog,
  snapshotData,
  onSwitchTab,
  onCloseTab,
  onNewTab,
  onAction,
}: BrowserActionsProps) {
  const [expandedTabs, setExpandedTabs] = useState(true);
  const [expandedActions, setExpandedActions] = useState(true);
  const [expandedSnapshot, setExpandedSnapshot] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [actionParams, setActionParams] = useState<Record<string, string>>({});
  const [snapshotSearch, setSnapshotSearch] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll action log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actionLog.length]);

  const handleActionSelect = useCallback((actionId: string) => {
    setSelectedAction((prev) => (prev === actionId ? null : actionId));
    setActionParams({});
  }, []);

  const handleParamChange = useCallback((key: string, value: string) => {
    setActionParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleExecuteAction = useCallback(() => {
    if (!selectedAction) return;
    onAction(selectedAction, actionParams);
    setActionParams({});
  }, [selectedAction, actionParams, onAction]);

  const handleActionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleExecuteAction();
      }
    },
    [handleExecuteAction]
  );

  const currentActionDef = useMemo(
    () => BROWSER_ACTIONS.find((a) => a.id === selectedAction),
    [selectedAction]
  );

  // Snapshot search filtering
  const filteredSnapshot = useMemo(() => {
    if (!snapshotData) return '';
    if (!snapshotSearch.trim()) return snapshotData;
    const lines = snapshotData.split('\n');
    const query = snapshotSearch.toLowerCase();
    return lines.filter((line) => line.toLowerCase().includes(query)).join('\n');
  }, [snapshotData, snapshotSearch]);

  return (
    <div className="ba-root">
      <style>{browserActionsStyles}</style>

      {/* ---- Tabs Section ---- */}
      <div className="ba-section">
        <SectionHeader
          title="Tabs"
          count={tabs.length}
          expanded={expandedTabs}
          onToggle={() => setExpandedTabs((p) => !p)}
        />
        {expandedTabs && (
          <div className="ba-section-content">
            <div className="ba-tabs-strip">
              {tabs.length === 0 ? (
                <div className="ba-tabs-empty">No tabs open</div>
              ) : (
                tabs.map((tab, idx) => (
                  <div
                    key={`tab-${idx}-${tab.url}`}
                    className={`ba-tab ${idx === activeTabIndex ? 'ba-tab--active' : ''}`}
                    onClick={() => onSwitchTab(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSwitchTab(idx);
                    }}
                    title={tab.url}
                  >
                    <div className="ba-tab-info">
                      <span className="ba-tab-title">
                        {tab.title || 'Untitled'}
                      </span>
                      <span className="ba-tab-url">
                        {truncateUrl(tab.url)}
                      </span>
                    </div>
                    <button
                      className="ba-tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(idx);
                      }}
                      title="Close tab"
                      type="button"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              className="ba-new-tab-btn"
              onClick={onNewTab}
              type="button"
              title="Open new tab"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Tab
            </button>
          </div>
        )}
      </div>

      {/* ---- Actions Section ---- */}
      <div className="ba-section">
        <SectionHeader
          title="Actions"
          count={actionLog.length}
          expanded={expandedActions}
          onToggle={() => setExpandedActions((p) => !p)}
        />
        {expandedActions && (
          <div className="ba-section-content">
            {/* Quick action buttons */}
            <div className="ba-action-buttons">
              {BROWSER_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  className={`ba-action-btn ${selectedAction === action.id ? 'ba-action-btn--selected' : ''}`}
                  onClick={() => handleActionSelect(action.id)}
                  type="button"
                  title={action.label}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={action.icon} />
                  </svg>
                  {action.label}
                </button>
              ))}
            </div>

            {/* Action parameter inputs */}
            {currentActionDef && (
              <div className="ba-action-params">
                {currentActionDef.params.map((param) => (
                  <input
                    key={param.key}
                    className="ba-action-input"
                    type="text"
                    placeholder={param.placeholder}
                    value={actionParams[param.key] ?? ''}
                    onChange={(e) => handleParamChange(param.key, e.target.value)}
                    onKeyDown={handleActionKeyDown}
                    spellCheck={false}
                  />
                ))}
                <button
                  className="ba-action-execute"
                  onClick={handleExecuteAction}
                  type="button"
                  title="Execute action"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Run
                </button>
              </div>
            )}

            {/* Action log */}
            <div className="ba-action-log">
              {actionLog.length === 0 ? (
                <div className="ba-log-empty">No actions performed yet</div>
              ) : (
                actionLog.map((entry, idx) => (
                  <div
                    key={`log-${idx}-${entry.timestamp}`}
                    className={`ba-log-entry ${entry.success ? 'ba-log-entry--success' : 'ba-log-entry--failure'}`}
                  >
                    <span className="ba-log-time">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                    <span className={`ba-log-badge ${entry.success ? 'ba-log-badge--success' : 'ba-log-badge--failure'}`}>
                      {entry.action}
                    </span>
                    {entry.target && (
                      <span className="ba-log-target" title={entry.target}>
                        {entry.target.length > 30
                          ? entry.target.slice(0, 30) + '...'
                          : entry.target}
                      </span>
                    )}
                    {entry.result && (
                      <span className="ba-log-result" title={entry.result}>
                        {entry.result.length > 50
                          ? entry.result.slice(0, 50) + '...'
                          : entry.result}
                      </span>
                    )}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* ---- Snapshot Section ---- */}
      <div className="ba-section">
        <SectionHeader
          title="Snapshot"
          expanded={expandedSnapshot}
          onToggle={() => setExpandedSnapshot((p) => !p)}
        />
        {expandedSnapshot && (
          <div className="ba-section-content">
            {snapshotData ? (
              <>
                <div className="ba-snapshot-search">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ba-snapshot-search-icon">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    className="ba-snapshot-search-input"
                    type="text"
                    placeholder="Search snapshot..."
                    value={snapshotSearch}
                    onChange={(e) => setSnapshotSearch(e.target.value)}
                    spellCheck={false}
                  />
                  {snapshotSearch && (
                    <button
                      className="ba-snapshot-search-clear"
                      onClick={() => setSnapshotSearch('')}
                      type="button"
                      title="Clear search"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
                <pre className="ba-snapshot-content">{filteredSnapshot}</pre>
              </>
            ) : (
              <div className="ba-snapshot-empty">
                No accessibility snapshot available. Click on the screenshot to capture one.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowserActions;

// ---------------------------------------------------------------------------
// Scoped styles (ba- prefix)
// ---------------------------------------------------------------------------

const browserActionsStyles = `
/* Root */
.ba-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--bg-secondary, #111127);
}

.ba-root::-webkit-scrollbar {
  width: 6px;
}

.ba-root::-webkit-scrollbar-track {
  background: transparent;
}

.ba-root::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.ba-root::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Sections */
.ba-section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.ba-section:last-child {
  border-bottom: none;
}

.ba-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 12px;
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0c0);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.15s ease;
}

.ba-section-header:hover {
  background: rgba(255, 255, 255, 0.03);
}

.ba-chevron {
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.ba-chevron--expanded {
  transform: rotate(90deg);
}

.ba-section-title {
  flex: 1;
}

.ba-section-count {
  padding: 1px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary, #606080);
  line-height: 1.2;
}

.ba-section-content {
  padding: 0 12px 12px;
}

/* Tabs */
.ba-tabs-strip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
}

.ba-tabs-strip::-webkit-scrollbar {
  width: 4px;
}

.ba-tabs-strip::-webkit-scrollbar-track {
  background: transparent;
}

.ba-tabs-strip::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.ba-tabs-empty {
  padding: 12px 0;
  text-align: center;
  font-size: 11px;
  color: var(--text-tertiary, #606080);
}

.ba-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
  border: 1px solid transparent;
}

.ba-tab:hover {
  background: rgba(255, 255, 255, 0.04);
}

.ba-tab--active {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.2);
}

.ba-tab-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ba-tab-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ba-tab-url {
  font-size: 10px;
  color: var(--text-tertiary, #606080);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ba-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.ba-tab-close:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.ba-new-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  margin-top: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--text-secondary, #a0a0c0);
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ba-new-tab-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #fff);
  border-color: rgba(255, 255, 255, 0.12);
}

/* Action buttons */
.ba-action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.ba-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--text-secondary, #a0a0c0);
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ba-action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #fff);
  border-color: rgba(255, 255, 255, 0.12);
}

.ba-action-btn--selected {
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  border-color: rgba(99, 102, 241, 0.3);
}

/* Action params */
.ba-action-params {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}

.ba-action-input {
  width: 100%;
  padding: 6px 8px;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary, #fff);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.ba-action-input:focus {
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.ba-action-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.ba-action-execute {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 14px;
  background: var(--accent-color, #6366f1);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
  align-self: flex-end;
}

.ba-action-execute:hover {
  background: #818cf8;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
}

/* Action log */
.ba-action-log {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ba-action-log::-webkit-scrollbar {
  width: 4px;
}

.ba-action-log::-webkit-scrollbar-track {
  background: transparent;
}

.ba-action-log::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.ba-log-empty {
  padding: 16px 0;
  text-align: center;
  font-size: 11px;
  color: var(--text-tertiary, #606080);
}

.ba-log-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 11px;
  transition: background 0.1s ease;
}

.ba-log-entry:hover {
  background: rgba(255, 255, 255, 0.03);
}

.ba-log-time {
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  font-size: 10px;
  color: var(--text-tertiary, #606080);
  flex-shrink: 0;
}

.ba-log-badge {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.ba-log-badge--success {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.ba-log-badge--failure {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.ba-log-target {
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  font-size: 10px;
  color: #a5b4fc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.ba-log-result {
  font-size: 10px;
  color: var(--text-tertiary, #606080);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

/* Snapshot */
.ba-snapshot-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  margin-bottom: 8px;
}

.ba-snapshot-search-icon {
  flex-shrink: 0;
  color: var(--text-tertiary, #606080);
}

.ba-snapshot-search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary, #fff);
  font-size: 12px;
  font-family: inherit;
  padding: 2px 0;
}

.ba-snapshot-search-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.ba-snapshot-search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 3px;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.ba-snapshot-search-clear:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary, #a0a0c0);
}

.ba-snapshot-content {
  margin: 0;
  padding: 10px;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  font-size: 11px;
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  color: var(--text-secondary, #a0a0c0);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}

.ba-snapshot-content::-webkit-scrollbar {
  width: 4px;
}

.ba-snapshot-content::-webkit-scrollbar-track {
  background: transparent;
}

.ba-snapshot-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.ba-snapshot-empty {
  padding: 16px 0;
  text-align: center;
  font-size: 11px;
  color: var(--text-tertiary, #606080);
  line-height: 1.4;
}
`;
