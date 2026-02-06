/**
 * NodeCommands - Command execution panel for a node
 *
 * Provides a terminal-like interface for executing commands on a remote node.
 * Features: command input, output display, command history, cancel support.
 *
 * Gateway methods used:
 *   - nodes.invoke (capability: system.run)
 *
 * CSS prefix: nc-
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeCommandsProps {
  nodeId: string;
  nodeName: string;
  onClose?: () => void;
}

interface CommandEntry {
  id: string;
  command: string;
  cwd?: string;
  timestamp: number;
  status: 'running' | 'success' | 'error' | 'cancelled';
  output?: string;
  error?: string;
  exitCode?: number;
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = `
/* ── Container ── */
.nc-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ── Back button ── */
.nc-back {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0.375rem 0;
  margin-bottom: 1rem;
  transition: color 0.15s ease;
}

.nc-back:hover {
  color: var(--text-primary, #fff);
}

/* ── Header ── */
.nc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.nc-header__info {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.nc-header__icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nc-header__icon svg {
  color: var(--accent-color, #6366f1);
}

.nc-header__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.nc-header__subtitle {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  margin: 0.125rem 0 0;
}

.nc-header__actions {
  display: flex;
  gap: 0.5rem;
}

.nc-header__btn {
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.nc-header__btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #fff);
}

.nc-header__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.nc-header__btn--danger {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.25);
}

.nc-header__btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

/* ── Output area ── */
.nc-output {
  flex: 1;
  min-height: 200px;
  max-height: calc(100vh - 360px);
  background: #08081a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow-y: auto;
  font-family: 'SF Mono', 'Consolas', 'Monaco', 'Liberation Mono', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
  padding: 0;
  margin-bottom: 0.75rem;
}

.nc-output::-webkit-scrollbar {
  width: 6px;
}

.nc-output::-webkit-scrollbar-track {
  background: transparent;
}

.nc-output::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.nc-output::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* ── Output entries ── */
.nc-entry {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.nc-entry:last-child {
  border-bottom: none;
}

.nc-entry__prompt {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.nc-entry__prompt-symbol {
  color: var(--accent-color, #6366f1);
  font-weight: 700;
  user-select: none;
}

.nc-entry__command {
  color: var(--text-primary, #fff);
  font-weight: 500;
}

.nc-entry__cwd {
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
  margin-left: auto;
}

.nc-entry__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.nc-entry__status {
  font-size: 0.5625rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.0625rem 0.25rem;
  border-radius: 3px;
}

.nc-entry__status--running {
  color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.1);
}

.nc-entry__status--success {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.nc-entry__status--error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.nc-entry__status--cancelled {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.nc-entry__duration {
  font-size: 0.5625rem;
  color: var(--text-tertiary, #606080);
}

.nc-entry__exit-code {
  font-size: 0.5625rem;
  color: var(--text-tertiary, #606080);
}

.nc-entry__output {
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-secondary, #a0a0c0);
  margin-top: 0.25rem;
  max-height: 300px;
  overflow-y: auto;
}

.nc-entry__output::-webkit-scrollbar {
  width: 3px;
}

.nc-entry__output::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.nc-entry__error {
  white-space: pre-wrap;
  word-break: break-all;
  color: #fca5a5;
  margin-top: 0.25rem;
}

/* ── ANSI basic colors ── */
.nc-ansi-red { color: #ef4444; }
.nc-ansi-green { color: #10b981; }
.nc-ansi-yellow { color: #f59e0b; }
.nc-ansi-blue { color: #6366f1; }
.nc-ansi-magenta { color: #d946ef; }
.nc-ansi-cyan { color: #06b6d4; }
.nc-ansi-white { color: #fff; }
.nc-ansi-bold { font-weight: 700; }
.nc-ansi-dim { opacity: 0.6; }

/* ── Spinner in output ── */
.nc-running-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--accent-color, #6366f1);
  font-size: 0.6875rem;
}

.nc-running-spinner {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(99, 102, 241, 0.2);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: nc-spin 0.7s linear infinite;
}

@keyframes nc-spin {
  to { transform: rotate(360deg); }
}

/* ── Empty output ── */
.nc-output-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 150px;
  color: var(--text-tertiary, #606080);
  font-size: 0.8125rem;
  gap: 0.5rem;
  font-family: inherit;
}

.nc-output-empty svg {
  opacity: 0.3;
}

/* ── Input bar ── */
.nc-input-bar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.nc-input-bar__prompt {
  color: var(--accent-color, #6366f1);
  font-family: 'SF Mono', 'Consolas', monospace;
  font-weight: 700;
  font-size: 0.875rem;
  flex-shrink: 0;
  user-select: none;
}

.nc-input {
  flex: 1;
  padding: 0.625rem 0.875rem;
  background: #08081a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  font-family: 'SF Mono', 'Consolas', monospace;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.nc-input:focus {
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.nc-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.nc-input:disabled {
  opacity: 0.5;
}

.nc-execute-btn {
  padding: 0.625rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  background: var(--accent-color, #6366f1);
  color: #fff;
  border: none;
  flex-shrink: 0;
}

.nc-execute-btn:hover:not(:disabled) {
  background: #4f46e5;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
}

.nc-execute-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── CWD row ── */
.nc-cwd-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}

.nc-cwd-label {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  flex-shrink: 0;
  font-weight: 500;
}

.nc-cwd-input {
  flex: 1;
  padding: 0.35rem 0.625rem;
  background: #08081a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  font-size: 0.6875rem;
  color: var(--text-secondary, #a0a0c0);
  font-family: 'SF Mono', 'Consolas', monospace;
  outline: none;
  transition: border-color 0.15s ease;
}

.nc-cwd-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.nc-cwd-input::placeholder {
  color: var(--text-tertiary, #606080);
}

/* ── History sidebar ── */
.nc-history {
  margin-top: 0.75rem;
}

.nc-history__title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary, #606080);
  margin: 0 0 0.5rem;
}

.nc-history__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.nc-history__item {
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
  font-family: 'SF Mono', 'Consolas', monospace;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nc-history__item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-primary, #fff);
}
`;

// ---------------------------------------------------------------------------
// ANSI color parser (basic)
// ---------------------------------------------------------------------------

function parseAnsiOutput(text: string): string {
  // Strip ANSI codes for now - render as plain text with basic class hints
  // A full parser would convert \e[31m to <span class="nc-ansi-red"> etc.
  // Basic strip:
  // eslint-disable-next-line no-control-regex -- stripping ANSI escape codes requires matching \x1b
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NodeCommands({ nodeId, nodeName, onClose }: NodeCommandsProps) {
  const { getClient, connected } = useGateway();

  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('');
  const [entries, setEntries] = useState<CommandEntry[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [entries]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ------ Command history (unique, last 20) ------
  const commandHistory = entries
    .filter((e) => e.status !== 'cancelled')
    .map((e) => e.command)
    .filter((cmd, idx, arr) => arr.indexOf(cmd) === idx)
    .reverse()
    .slice(0, 20);

  // ------ Execute ------
  const executeCommand = useCallback(async () => {
    const trimmed = command.trim();
    if (!trimmed) return;

    const client = getClient();
    if (!client?.connected) return;

    const entryId = crypto.randomUUID();
    const entry: CommandEntry = {
      id: entryId,
      command: trimmed,
      cwd: cwd.trim() || undefined,
      timestamp: Date.now(),
      status: 'running',
    };

    setEntries((prev) => [...prev, entry]);
    setRunningId(entryId);
    setCommand('');
    setHistoryIndex(-1);

    const startTime = Date.now();

    try {
      const result = await client.request<{
        output?: string;
        stdout?: string;
        stderr?: string;
        exitCode?: number;
        error?: string;
      }>('nodes.invoke', {
        nodeId,
        capability: 'system.run',
        params: {
          command: trimmed,
          cwd: cwd.trim() || undefined,
        },
      });

      const elapsed = Date.now() - startTime;
      const output = result.output ?? result.stdout ?? '';
      const errorOutput = result.stderr ?? result.error;
      const exitCode = result.exitCode ?? 0;

      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                status: exitCode === 0 && !result.error ? 'success' : 'error',
                output: output || undefined,
                error: errorOutput || undefined,
                exitCode,
                durationMs: elapsed,
              }
            : e
        )
      );
    } catch (err) {
      const elapsed = Date.now() - startTime;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                status: 'error',
                error: err instanceof Error ? err.message : String(err),
                durationMs: elapsed,
              }
            : e
        )
      );
    } finally {
      setRunningId(null);
      inputRef.current?.focus();
    }
  }, [command, cwd, getClient, nodeId]);

  // ------ Cancel ------
  const cancelRunning = useCallback(() => {
    if (!runningId) return;
    // Optimistic cancel - in real impl this would call a gateway abort method
    setEntries((prev) =>
      prev.map((e) =>
        e.id === runningId
          ? { ...e, status: 'cancelled', error: 'Cancelled by user' }
          : e
      )
    );
    setRunningId(null);
  }, [runningId]);

  // ------ Clear output ------
  const clearOutput = useCallback(() => {
    setEntries([]);
    setRunningId(null);
  }, []);

  // ------ Key handling ------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !runningId) {
        executeCommand();
        return;
      }

      // History navigation
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length === 0) return;
        const nextIdx = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(nextIdx);
        setCommand(commandHistory[nextIdx]);
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          setCommand('');
          return;
        }
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCommand(commandHistory[nextIdx]);
      }

      // Ctrl+C to cancel
      if (e.key === 'c' && e.ctrlKey && runningId) {
        e.preventDefault();
        cancelRunning();
      }

      // Ctrl+L to clear
      if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        clearOutput();
      }
    },
    [executeCommand, runningId, commandHistory, historyIndex, cancelRunning, clearOutput]
  );

  // ------ History click ------
  const selectHistory = useCallback((cmd: string) => {
    setCommand(cmd);
    inputRef.current?.focus();
  }, []);

  const isDisabled = !connected;

  return (
    <div className="nc-container">
      <style>{styles}</style>

      {/* Back button */}
      <button className="nc-back" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Nodes
      </button>

      {/* Header */}
      <div className="nc-header">
        <div className="nc-header__info">
          <div className="nc-header__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </div>
          <div>
            <h3 className="nc-header__title">Terminal - {nodeName}</h3>
            <p className="nc-header__subtitle">{nodeId}</p>
          </div>
        </div>
        <div className="nc-header__actions">
          <button
            className="nc-header__btn"
            onClick={clearOutput}
            disabled={entries.length === 0}
            title="Clear output (Ctrl+L)"
          >
            Clear
          </button>
          {runningId && (
            <button
              className="nc-header__btn nc-header__btn--danger"
              onClick={cancelRunning}
              title="Cancel running command (Ctrl+C)"
            >
              Kill
            </button>
          )}
        </div>
      </div>

      {/* Output area */}
      <div className="nc-output" ref={outputRef}>
        {entries.length === 0 ? (
          <div className="nc-output-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span>Type a command and press Enter to execute on {nodeName}</span>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="nc-entry">
              <div className="nc-entry__prompt">
                <span className="nc-entry__prompt-symbol">&gt;</span>
                <span className="nc-entry__command">{entry.command}</span>
                {entry.cwd && <span className="nc-entry__cwd">{entry.cwd}</span>}
              </div>
              <div className="nc-entry__meta">
                <span className={`nc-entry__status nc-entry__status--${entry.status}`}>
                  {entry.status === 'running' ? (
                    <span className="nc-running-indicator">
                      <span className="nc-running-spinner" />
                      running
                    </span>
                  ) : (
                    entry.status
                  )}
                </span>
                {entry.durationMs != null && (
                  <span className="nc-entry__duration">{formatDuration(entry.durationMs)}</span>
                )}
                {entry.exitCode != null && entry.status !== 'running' && (
                  <span className="nc-entry__exit-code">exit {entry.exitCode}</span>
                )}
                <span className="nc-entry__duration">{formatTimestamp(entry.timestamp)}</span>
              </div>
              {entry.output && (
                <pre className="nc-entry__output">{parseAnsiOutput(entry.output)}</pre>
              )}
              {entry.error && (
                <pre className="nc-entry__error">{entry.error}</pre>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input bar */}
      <div className="nc-input-bar">
        <span className="nc-input-bar__prompt">&gt;</span>
        <input
          ref={inputRef}
          className="nc-input"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isDisabled ? 'Gateway disconnected...' : 'Enter command...'}
          disabled={isDisabled}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className="nc-execute-btn"
          onClick={executeCommand}
          disabled={isDisabled || !command.trim() || !!runningId}
        >
          {runningId ? 'Running...' : 'Execute'}
        </button>
      </div>

      {/* Working directory */}
      <div className="nc-cwd-row">
        <span className="nc-cwd-label">CWD:</span>
        <input
          className="nc-cwd-input"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          placeholder="Working directory (optional)"
          disabled={isDisabled}
        />
      </div>

      {/* Command history */}
      {commandHistory.length > 0 && (
        <div className="nc-history">
          <h4 className="nc-history__title">Recent Commands</h4>
          <div className="nc-history__list">
            {commandHistory.map((cmd, idx) => (
              <button
                key={`${cmd}-${idx}`}
                className="nc-history__item"
                onClick={() => selectHistory(cmd)}
                title={cmd}
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NodeCommands;
