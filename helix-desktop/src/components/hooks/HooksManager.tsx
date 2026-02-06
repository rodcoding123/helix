/**
 * Hooks Management Dashboard - Comprehensive hook lifecycle management
 *
 * Displays all bundled and custom OpenClaw hooks with:
 *   - Enable/disable toggles per hook
 *   - Expandable configuration panels
 *   - Hook execution log (last 10 triggers)
 *   - Filtering by type and status
 *   - Sorting by name or last triggered
 *   - Custom hook creation via HookEditor
 *
 * Gateway methods used:
 *   - config.get { path: 'hooks' }  -> Fetch hooks configuration
 *   - config.patch { path: 'hooks', value: {...} } -> Update hooks configuration
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { HookEditor } from './HookEditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HookConfig {
  name: string;
  description: string;
  type: 'bundled' | 'custom';
  enabled: boolean;
  event: string;
  scriptPath?: string;
  timeout?: number;
  lastTriggered?: string;
  triggerCount?: number;
  config?: Record<string, unknown>;
  env?: Record<string, string>;
}

interface HookLogEntry {
  timestamp: string;
  hookName: string;
  event: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

type FilterMode = 'all' | 'bundled' | 'custom' | 'enabled' | 'disabled';
type SortMode = 'name' | 'lastTriggered';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUNDLED_HOOKS: HookConfig[] = [
  {
    name: 'boot-md',
    description: 'Loads bootstrap markdown files on startup. Injects system prompts, personality, and context files into the initial conversation.',
    type: 'bundled',
    enabled: true,
    event: 'session:start',
    triggerCount: 0,
    config: {
      files: ['HELIX_SOUL.md', 'USER.md', 'CLAUDE.md'],
      maxTokens: 8000,
    },
  },
  {
    name: 'command-logger',
    description: 'Logs all shell commands to file for audit and replay. Each command is recorded with timestamp, working directory, exit code, and truncated output.',
    type: 'bundled',
    enabled: true,
    event: 'command:after',
    triggerCount: 0,
    config: {
      logFile: '.helix-state/command-log.jsonl',
      maxOutputLength: 2000,
      includeEnv: false,
    },
  },
  {
    name: 'session-memory',
    description: 'Persists session context to memory files between restarts. Captures key decisions, user preferences, and conversation summaries for continuity.',
    type: 'bundled',
    enabled: true,
    event: 'session:end',
    triggerCount: 0,
    config: {
      memoryDir: '.helix-state/memory/',
      maxEntries: 500,
      compressionLevel: 'medium',
    },
  },
  {
    name: 'context-pruner',
    description: 'Prunes old context when the token limit approaches. Uses importance scoring to retain high-value messages while removing less relevant ones.',
    type: 'bundled',
    enabled: true,
    event: 'message:before',
    triggerCount: 0,
    config: {
      maxTokens: 180000,
      pruneThreshold: 0.85,
      preserveSystemMessages: true,
      preserveRecentCount: 10,
    },
  },
  {
    name: 'message-queue',
    description: 'Queues inbound messages during active processing. Prevents message loss when the agent is busy and delivers queued messages in order once idle.',
    type: 'bundled',
    enabled: true,
    event: 'message:before',
    triggerCount: 0,
    config: {
      maxQueueSize: 50,
      queueTimeoutMs: 60000,
      deduplication: true,
    },
  },
  {
    name: 'heartbeat',
    description: 'Periodic health check pings to verify the agent is responsive. Reports uptime, memory usage, and active session count to monitoring channels.',
    type: 'bundled',
    enabled: true,
    event: 'session:start',
    triggerCount: 0,
    config: {
      intervalMs: 60000,
      reportMemory: true,
      reportSessions: true,
      discordChannel: '#helix-heartbeat',
    },
  },
  {
    name: 'file-watcher',
    description: 'Monitors workspace file changes and notifies the agent. Tracks creates, modifications, and deletions with debounced event delivery.',
    type: 'bundled',
    enabled: false,
    event: 'file:change',
    triggerCount: 0,
    config: {
      watchPatterns: ['**/*.ts', '**/*.tsx', '**/*.md'],
      ignorePatterns: ['node_modules/**', '.git/**', 'dist/**'],
      debounceMs: 500,
    },
  },
  {
    name: 'auto-compact',
    description: 'Auto-compacts sessions when they get too large. Creates a summary of the conversation so far and replaces older messages to stay within context limits.',
    type: 'bundled',
    enabled: false,
    event: 'message:after',
    triggerCount: 0,
    config: {
      triggerTokenCount: 150000,
      summaryMaxTokens: 4000,
      preserveSystemContext: true,
    },
  },
];

const EVENT_LABELS: Record<string, string> = {
  'command:before': 'Before Command',
  'command:after': 'After Command',
  'message:before': 'Before Message',
  'message:after': 'After Message',
  'session:start': 'Session Start',
  'session:end': 'Session End',
  'file:change': 'File Change',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts?: string): string {
  if (!ts) return 'Never';
  try {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Unknown';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getEventColor(event: string): string {
  if (event.startsWith('command:')) return '#f59e0b';
  if (event.startsWith('message:')) return '#8b5cf6';
  if (event.startsWith('session:')) return '#10b981';
  if (event.startsWith('file:')) return '#3b82f6';
  return '#6b7280';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Compact display of a hook's recent execution log entries. */
function HookLogView({ entries }: { entries: HookLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="hm-log-empty">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3l2 1.5" />
        </svg>
        <span>No execution history yet</span>
      </div>
    );
  }

  return (
    <div className="hm-log-list">
      <div className="hm-log-header-row">
        <span className="hm-log-col-time">Time</span>
        <span className="hm-log-col-event">Event</span>
        <span className="hm-log-col-dur">Duration</span>
        <span className="hm-log-col-status">Status</span>
      </div>
      {entries.map((entry, idx) => (
        <div
          key={`${entry.timestamp}-${idx}`}
          className={`hm-log-row ${entry.success ? '' : 'hm-log-row--error'}`}
        >
          <span className="hm-log-col-time">{formatTimestamp(entry.timestamp)}</span>
          <span className="hm-log-col-event">
            <span
              className="hm-event-dot"
              style={{ backgroundColor: getEventColor(entry.event) }}
            />
            {entry.event}
          </span>
          <span className="hm-log-col-dur">{formatDuration(entry.durationMs)}</span>
          <span className="hm-log-col-status">
            {entry.success ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8l3 3 5-5" />
              </svg>
            ) : (
              <span className="hm-log-error-badge" title={entry.error ?? 'Failed'}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Expandable configuration viewer for a hook's config object. */
function HookConfigView({
  config,
  env,
}: {
  config?: Record<string, unknown>;
  env?: Record<string, string>;
}) {
  const hasConfig = config && Object.keys(config).length > 0;
  const hasEnv = env && Object.keys(env).length > 0;

  if (!hasConfig && !hasEnv) {
    return (
      <div className="hm-config-empty">
        No configuration options for this hook.
      </div>
    );
  }

  return (
    <div className="hm-config-view">
      {hasConfig && (
        <div className="hm-config-section">
          <h4 className="hm-config-section-title">Configuration</h4>
          <div className="hm-config-table">
            {Object.entries(config).map(([key, value]) => (
              <div key={key} className="hm-config-row">
                <span className="hm-config-key">{key}</span>
                <span className="hm-config-value">
                  {typeof value === 'boolean' ? (
                    <span className={`hm-config-bool ${value ? 'hm-config-bool--true' : 'hm-config-bool--false'}`}>
                      {String(value)}
                    </span>
                  ) : typeof value === 'number' ? (
                    <span className="hm-config-number">{value.toLocaleString()}</span>
                  ) : Array.isArray(value) ? (
                    <span className="hm-config-array">
                      {value.map((item, i) => (
                        <code key={i} className="hm-config-array-item">{String(item)}</code>
                      ))}
                    </span>
                  ) : (
                    <code className="hm-config-string">{String(value)}</code>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasEnv && (
        <div className="hm-config-section">
          <h4 className="hm-config-section-title">Environment Variables</h4>
          <div className="hm-config-table">
            {Object.entries(env).map(([key, value]) => (
              <div key={key} className="hm-config-row">
                <span className="hm-config-key">{key}</span>
                <span className="hm-config-value">
                  <code className="hm-config-string">{value}</code>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Single hook card in the list. */
function HookCard({
  hook,
  expanded,
  logEntries,
  onToggle,
  onExpand,
  onEdit,
  toggling,
}: {
  hook: HookConfig;
  expanded: boolean;
  logEntries: HookLogEntry[];
  onToggle: () => void;
  onExpand: () => void;
  onEdit: () => void;
  toggling: boolean;
}) {
  const eventLabel = EVENT_LABELS[hook.event] ?? hook.event;
  const eventColor = getEventColor(hook.event);

  return (
    <div className={`hm-card ${hook.enabled ? 'hm-card--enabled' : ''} ${expanded ? 'hm-card--expanded' : ''}`}>
      {/* Main card row */}
      <div className="hm-card__main" onClick={onExpand} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(); } }}>
        {/* Left: Status indicator + name + description */}
        <div className="hm-card__left">
          <div className="hm-card__indicator" style={{ backgroundColor: hook.enabled ? '#10b981' : 'rgba(255,255,255,0.15)' }} />
          <div className="hm-card__info">
            <div className="hm-card__name-row">
              <span className="hm-card__name">{hook.name}</span>
              <span className={`hm-card__type-badge hm-card__type-badge--${hook.type}`}>
                {hook.type}
              </span>
              <span className="hm-card__event-badge" style={{ borderColor: `${eventColor}40`, color: eventColor }}>
                <span className="hm-event-dot" style={{ backgroundColor: eventColor }} />
                {eventLabel}
              </span>
            </div>
            <p className="hm-card__desc">{hook.description}</p>
          </div>
        </div>

        {/* Right: Stats + toggle + expand chevron */}
        <div className="hm-card__right" onClick={(e) => e.stopPropagation()}>
          <div className="hm-card__stats">
            {hook.triggerCount != null && hook.triggerCount > 0 && (
              <span className="hm-card__stat" title="Total triggers">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 2L4 9h4l-1 5 5-7H8l1-5z" />
                </svg>
                {hook.triggerCount}
              </span>
            )}
            {hook.lastTriggered && (
              <span className="hm-card__stat" title="Last triggered">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3l2 1.5" />
                </svg>
                {formatTimestamp(hook.lastTriggered)}
              </span>
            )}
          </div>

          {/* Toggle */}
          <label className="hm-toggle" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={hook.enabled}
              disabled={toggling}
              onChange={onToggle}
            />
            <span className="hm-toggle__slider" />
          </label>

          {/* Edit button (custom hooks) or expand */}
          {hook.type === 'custom' && (
            <button
              className="hm-card__edit-btn"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Edit hook"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
              </svg>
            </button>
          )}

          {/* Expand chevron */}
          <button className="hm-card__chevron" onClick={onExpand} title={expanded ? 'Collapse' : 'Expand'}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="hm-card__panel">
          <div className="hm-card__panel-grid">
            {/* Left column: Config */}
            <div className="hm-card__panel-col">
              <h4 className="hm-card__panel-title">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="3" />
                  <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
                </svg>
                Configuration
              </h4>
              <HookConfigView config={hook.config} env={hook.env} />
              {hook.scriptPath && (
                <div className="hm-card__script-path">
                  <span className="hm-card__script-label">Script:</span>
                  <code className="hm-card__script-value">{hook.scriptPath}</code>
                </div>
              )}
              {hook.timeout != null && (
                <div className="hm-card__timeout-info">
                  <span className="hm-card__timeout-label">Timeout:</span>
                  <span className="hm-card__timeout-value">{formatDuration(hook.timeout)}</span>
                </div>
              )}
            </div>

            {/* Right column: Execution log */}
            <div className="hm-card__panel-col">
              <h4 className="hm-card__panel-title">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="12" height="12" rx="2" />
                  <path d="M5 6h6M5 8h4M5 10h5" />
                </svg>
                Execution Log
              </h4>
              <HookLogView entries={logEntries} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HooksManager() {
  const { getClient, connected } = useGateway();

  // State
  const [hooks, setHooks] = useState<HookConfig[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortBy, setSortBy] = useState<SortMode>('name');
  const [expandedHook, setExpandedHook] = useState<string | null>(null);
  const [editingHook, setEditingHook] = useState<HookConfig | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingHook, setTogglingHook] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hookLogs, setHookLogs] = useState<Record<string, HookLogEntry[]>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadHooks = useCallback(async () => {
    setError(null);
    const client = getClient();

    if (client?.connected) {
      try {
        const result = await client.request<{ hooks?: Record<string, unknown> }>('config.get', { path: 'hooks' });
        if (result?.hooks && typeof result.hooks === 'object') {
          // Merge gateway hooks with bundled defaults
          const gatewayHooks = result.hooks as Record<string, {
            enabled?: boolean;
            event?: string;
            scriptPath?: string;
            timeout?: number;
            description?: string;
            config?: Record<string, unknown>;
            env?: Record<string, string>;
            lastTriggered?: string;
            triggerCount?: number;
          }>;

          const merged: HookConfig[] = BUNDLED_HOOKS.map((bundled) => {
            const remote = gatewayHooks[bundled.name];
            if (remote) {
              return {
                ...bundled,
                enabled: remote.enabled ?? bundled.enabled,
                lastTriggered: remote.lastTriggered,
                triggerCount: remote.triggerCount ?? bundled.triggerCount,
                config: remote.config ?? bundled.config,
              };
            }
            return { ...bundled };
          });

          // Add custom hooks from gateway that aren't bundled
          const bundledNames = new Set(BUNDLED_HOOKS.map((h) => h.name));
          for (const [name, hookData] of Object.entries(gatewayHooks)) {
            if (!bundledNames.has(name) && hookData) {
              merged.push({
                name,
                description: hookData.description ?? 'Custom hook',
                type: 'custom',
                enabled: hookData.enabled ?? false,
                event: hookData.event ?? 'command:after',
                scriptPath: hookData.scriptPath,
                timeout: hookData.timeout ?? 5000,
                lastTriggered: hookData.lastTriggered,
                triggerCount: hookData.triggerCount ?? 0,
                config: hookData.config,
                env: hookData.env,
              });
            }
          }

          setHooks(merged);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Failed to load hooks config from gateway:', err);
        // Fall through to defaults
      }
    }

    // Fallback: use bundled defaults
    setHooks(BUNDLED_HOOKS.map((h) => ({ ...h })));
    setLoading(false);
  }, [getClient]);

  const loadHookLogs = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) return;

    try {
      const result = await client.request<{ logs?: Record<string, HookLogEntry[]> }>('config.get', { path: 'hookLogs' });
      if (result?.logs) {
        setHookLogs(result.logs);
      }
    } catch {
      // Hook logs are optional - fail silently
    }
  }, [getClient]);

  useEffect(() => {
    loadHooks();
    loadHookLogs();
  }, [loadHooks, loadHookLogs, connected]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const toggleHook = useCallback(async (hookName: string) => {
    const hook = hooks.find((h) => h.name === hookName);
    if (!hook) return;

    const newEnabled = !hook.enabled;
    setTogglingHook(hookName);

    // Optimistic update
    setHooks((prev) =>
      prev.map((h) => (h.name === hookName ? { ...h, enabled: newEnabled } : h))
    );

    const client = getClient();
    if (client?.connected) {
      try {
        // Build the hooks value object from current state
        const hooksValue: Record<string, { enabled: boolean }> = {};
        hooks.forEach((h) => {
          hooksValue[h.name] = { enabled: h.name === hookName ? newEnabled : h.enabled };
        });

        await client.request('config.patch', {
          path: 'hooks',
          value: { [hookName]: { enabled: newEnabled } },
        });

        showSuccess(`${hookName} ${newEnabled ? 'enabled' : 'disabled'}`);
      } catch (err) {
        console.error('Failed to toggle hook:', err);
        // Revert on failure
        setHooks((prev) =>
          prev.map((h) => (h.name === hookName ? { ...h, enabled: !newEnabled } : h))
        );
        setError(`Failed to ${newEnabled ? 'enable' : 'disable'} ${hookName}`);
      }
    }

    setTogglingHook(null);
  }, [hooks, getClient]);

  const saveHook = useCallback(async (hookConfig: HookConfig) => {
    const client = getClient();
    const isNew = !hooks.find((h) => h.name === hookConfig.name);

    if (client?.connected) {
      try {
        await client.request('config.patch', {
          path: 'hooks',
          value: {
            [hookConfig.name]: {
              enabled: hookConfig.enabled,
              event: hookConfig.event,
              scriptPath: hookConfig.scriptPath,
              timeout: hookConfig.timeout,
              description: hookConfig.description,
              config: hookConfig.config,
              env: hookConfig.env,
            },
          },
        });
      } catch (err) {
        console.error('Failed to save hook:', err);
        setError(`Failed to save hook "${hookConfig.name}"`);
        return;
      }
    }

    // Update local state
    if (isNew) {
      setHooks((prev) => [...prev, hookConfig]);
    } else {
      setHooks((prev) =>
        prev.map((h) => (h.name === hookConfig.name ? hookConfig : h))
      );
    }

    setShowEditor(false);
    setEditingHook(null);
    showSuccess(isNew ? `Hook "${hookConfig.name}" created` : `Hook "${hookConfig.name}" updated`);
  }, [hooks, getClient]);

  const deleteHook = useCallback(async (hookName: string) => {
    const hook = hooks.find((h) => h.name === hookName);
    if (!hook || hook.type !== 'custom') return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('config.patch', {
          path: 'hooks',
          value: { [hookName]: null },
        });
      } catch (err) {
        console.error('Failed to delete hook:', err);
        setError(`Failed to delete hook "${hookName}"`);
        return;
      }
    }

    setHooks((prev) => prev.filter((h) => h.name !== hookName));
    setShowEditor(false);
    setEditingHook(null);
    showSuccess(`Hook "${hookName}" deleted`);
  }, [hooks, getClient]);

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const filteredHooks = useMemo(() => {
    let list = hooks;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.event.toLowerCase().includes(q)
      );
    }

    // Type/status filter
    switch (filter) {
      case 'bundled':
        list = list.filter((h) => h.type === 'bundled');
        break;
      case 'custom':
        list = list.filter((h) => h.type === 'custom');
        break;
      case 'enabled':
        list = list.filter((h) => h.enabled);
        break;
      case 'disabled':
        list = list.filter((h) => !h.enabled);
        break;
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // Sort by last triggered (most recent first, never-triggered last)
      const aTime = a.lastTriggered ? new Date(a.lastTriggered).getTime() : 0;
      const bTime = b.lastTriggered ? new Date(b.lastTriggered).getTime() : 0;
      return bTime - aTime;
    });
  }, [hooks, filter, sortBy, searchQuery]);

  const counts = useMemo(() => ({
    all: hooks.length,
    bundled: hooks.filter((h) => h.type === 'bundled').length,
    custom: hooks.filter((h) => h.type === 'custom').length,
    enabled: hooks.filter((h) => h.enabled).length,
    disabled: hooks.filter((h) => !h.enabled).length,
  }), [hooks]);

  // ---------------------------------------------------------------------------
  // Editor handlers
  // ---------------------------------------------------------------------------

  const openCreateEditor = useCallback(() => {
    setEditingHook(null);
    setShowEditor(true);
  }, []);

  const openEditEditor = useCallback((hook: HookConfig) => {
    setEditingHook(hook);
    setShowEditor(true);
  }, []);

  const closeEditor = useCallback(() => {
    setShowEditor(false);
    setEditingHook(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Disconnected state
  if (!connected && hooks.length === 0 && !loading) {
    return (
      <>
        <style>{hooksManagerStyles}</style>
        <div className="hm-disconnected">
          <div className="hm-disconnected__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h3 className="hm-disconnected__title">Gateway Not Connected</h3>
          <p className="hm-disconnected__desc">
            Start the gateway to manage hooks. Hook configuration requires an active gateway connection.
          </p>
        </div>
      </>
    );
  }

  // Loading state
  if (loading) {
    return (
      <>
        <style>{hooksManagerStyles}</style>
        <div className="hm-loading">
          <div className="hm-loading__spinner" />
          <span>Loading hooks...</span>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{hooksManagerStyles}</style>
      <div className="hm-container">
        {/* Header */}
        <header className="hm-header">
          <div className="hm-header__text">
            <h2 className="hm-header__title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
              Hooks
            </h2>
            <p className="hm-header__subtitle">
              {counts.enabled} of {counts.all} hooks enabled
              {counts.custom > 0 && ` (${counts.custom} custom)`}
            </p>
          </div>
          <button className="hm-btn-primary" onClick={openCreateEditor}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Add Custom Hook
          </button>
        </header>

        {/* Success toast */}
        {successMessage && (
          <div className="hm-toast hm-toast--success">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8l3 3 5-5" />
            </svg>
            {successMessage}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="hm-error-banner">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3M8 10h.01" />
            </svg>
            <span>{error}</span>
            <button className="hm-error-dismiss" onClick={() => setError(null)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        )}

        {/* Disconnected warning (when we have cached hooks but no connection) */}
        {!connected && hooks.length > 0 && (
          <div className="hm-warn-banner">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 1l7 14H1L8 1zM8 6v3M8 11h.01" />
            </svg>
            Gateway disconnected. Showing cached configuration. Changes may not be persisted.
          </div>
        )}

        {/* Toolbar: search + filters + sort */}
        <div className="hm-toolbar">
          <div className="hm-search">
            <svg className="hm-search__icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              placeholder="Search hooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="hm-search__input"
            />
            {searchQuery && (
              <button className="hm-search__clear" onClick={() => setSearchQuery('')}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            )}
          </div>

          <div className="hm-toolbar__right">
            {/* Sort dropdown */}
            <div className="hm-sort">
              <label className="hm-sort__label">Sort:</label>
              <select
                className="hm-sort__select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortMode)}
              >
                <option value="name">Name</option>
                <option value="lastTriggered">Last Triggered</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="hm-filters">
          {(
            [
              ['all', `All (${counts.all})`],
              ['bundled', `Bundled (${counts.bundled})`],
              ['custom', `Custom (${counts.custom})`],
              ['enabled', `Enabled (${counts.enabled})`],
              ['disabled', `Disabled (${counts.disabled})`],
            ] as [FilterMode, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={`hm-filter-btn ${filter === key ? 'hm-filter-btn--active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Hook list */}
        {filteredHooks.length === 0 ? (
          <div className="hm-empty">
            <div className="hm-empty__icon">
              {searchQuery ? (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              ) : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                </svg>
              )}
            </div>
            <h3 className="hm-empty__title">
              {searchQuery
                ? `No hooks matching "${searchQuery}"`
                : filter !== 'all'
                  ? `No ${filter} hooks found`
                  : 'No hooks configured'}
            </h3>
            <p className="hm-empty__desc">
              {!searchQuery && filter === 'custom' && (
                <>Create your first custom hook to extend the agent lifecycle.</>
              )}
              {!searchQuery && filter === 'all' && (
                <>Hook configuration will appear here once the gateway is running.</>
              )}
            </p>
            {!searchQuery && (filter === 'custom' || filter === 'all') && (
              <button className="hm-btn-primary" onClick={openCreateEditor}>
                Create Custom Hook
              </button>
            )}
          </div>
        ) : (
          <div className="hm-list">
            {filteredHooks.map((hook) => (
              <HookCard
                key={hook.name}
                hook={hook}
                expanded={expandedHook === hook.name}
                logEntries={hookLogs[hook.name] ?? []}
                onToggle={() => toggleHook(hook.name)}
                onExpand={() => setExpandedHook(expandedHook === hook.name ? null : hook.name)}
                onEdit={() => openEditEditor(hook)}
                toggling={togglingHook === hook.name}
              />
            ))}
          </div>
        )}

        {/* Summary footer */}
        {filteredHooks.length > 0 && (
          <div className="hm-footer">
            <span className="hm-footer__text">
              Showing {filteredHooks.length} of {counts.all} hooks
            </span>
            <div className="hm-footer__legend">
              <span className="hm-footer__legend-item">
                <span className="hm-footer__legend-dot" style={{ backgroundColor: '#f59e0b' }} />
                Command
              </span>
              <span className="hm-footer__legend-item">
                <span className="hm-footer__legend-dot" style={{ backgroundColor: '#8b5cf6' }} />
                Message
              </span>
              <span className="hm-footer__legend-item">
                <span className="hm-footer__legend-dot" style={{ backgroundColor: '#10b981' }} />
                Session
              </span>
              <span className="hm-footer__legend-item">
                <span className="hm-footer__legend-dot" style={{ backgroundColor: '#3b82f6' }} />
                File
              </span>
            </div>
          </div>
        )}

        {/* Hook Editor Modal */}
        {showEditor && (
          <HookEditor
            hook={editingHook}
            existingNames={hooks.map((h) => h.name)}
            onSave={saveHook}
            onDelete={editingHook?.type === 'custom' ? () => deleteHook(editingHook.name) : undefined}
            onCancel={closeEditor}
          />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles (hm- prefix)
// ---------------------------------------------------------------------------

const hooksManagerStyles = `
/* ============================================
   HooksManager Container
   ============================================ */

.hm-container {
  padding: 0;
  max-width: 960px;
  margin: 0 auto;
}

/* ── Header ── */
.hm-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.hm-header__text {
  flex: 1;
  min-width: 200px;
}

.hm-header__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.375rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0 0 0.25rem;
}

.hm-header__title svg {
  color: #8b5cf6;
}

.hm-header__subtitle {
  font-size: 0.8125rem;
  color: #a0a0a0;
  margin: 0;
}

/* ── Primary button ── */
.hm-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: #8b5cf6;
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.hm-btn-primary:hover {
  background: #7c3aed;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.hm-btn-primary:active {
  transform: scale(0.98);
}

/* ── Toast notification ── */
.hm-toast {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 1rem;
  animation: hm-slide-in 0.25s ease;
}

.hm-toast--success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #34d399;
}

@keyframes hm-slide-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── Error banner ── */
.hm-error-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #fca5a5;
  margin-bottom: 1rem;
}

.hm-error-banner span {
  flex: 1;
}

.hm-error-dismiss {
  background: none;
  border: none;
  color: #fca5a5;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hm-error-dismiss:hover {
  background: rgba(239, 68, 68, 0.15);
}

/* ── Warning banner ── */
.hm-warn-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #fbbf24;
  margin-bottom: 1rem;
}

/* ── Disconnected state ── */
.hm-disconnected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.hm-disconnected__icon {
  color: #a0a0a0;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.hm-disconnected__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #e0e0e0;
  margin: 0 0 0.5rem;
}

.hm-disconnected__desc {
  font-size: 0.875rem;
  color: #a0a0a0;
  max-width: 400px;
  margin: 0;
}

/* ── Loading state ── */
.hm-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 4rem;
  color: #a0a0a0;
  font-size: 0.875rem;
}

.hm-loading__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: hm-spin 0.8s linear infinite;
}

@keyframes hm-spin {
  to { transform: rotate(360deg); }
}

/* ── Toolbar ── */
.hm-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.hm-toolbar__right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* ── Search ── */
.hm-search {
  flex: 1;
  min-width: 200px;
  position: relative;
}

.hm-search__icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.25);
  pointer-events: none;
}

.hm-search__input {
  width: 100%;
  padding: 0.5rem 2rem 0.5rem 2.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #e0e0e0;
  outline: none;
  transition: border-color 0.15s ease;
}

.hm-search__input:focus {
  border-color: rgba(139, 92, 246, 0.5);
}

.hm-search__input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.hm-search__clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.hm-search__clear:hover {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.08);
}

/* ── Sort ── */
.hm-sort {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.hm-sort__label {
  font-size: 0.75rem;
  color: #a0a0a0;
  white-space: nowrap;
}

.hm-sort__select {
  padding: 0.375rem 0.625rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #e0e0e0;
  outline: none;
  cursor: pointer;
}

.hm-sort__select:focus {
  border-color: rgba(139, 92, 246, 0.5);
}

/* ── Filters ── */
.hm-filters {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.hm-filter-btn {
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #a0a0a0;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.hm-filter-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
  color: #e0e0e0;
}

.hm-filter-btn--active {
  background: #8b5cf6;
  border-color: #8b5cf6;
  color: #fff;
}

.hm-filter-btn--active:hover {
  background: #7c3aed;
  border-color: #7c3aed;
  color: #fff;
}

/* ── Empty state ── */
.hm-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 1.5rem;
}

.hm-empty__icon {
  color: rgba(255, 255, 255, 0.2);
  margin-bottom: 1rem;
}

.hm-empty__title {
  font-size: 1rem;
  font-weight: 600;
  color: #e0e0e0;
  margin: 0 0 0.375rem;
}

.hm-empty__desc {
  font-size: 0.8125rem;
  color: #a0a0a0;
  max-width: 360px;
  margin: 0 0 1rem;
}

/* ============================================
   Hook List & Cards
   ============================================ */

.hm-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ── Card ── */
.hm-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.hm-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

.hm-card--enabled {
  border-color: rgba(139, 92, 246, 0.15);
}

.hm-card--enabled:hover {
  border-color: rgba(139, 92, 246, 0.3);
}

.hm-card--expanded {
  border-color: rgba(139, 92, 246, 0.25);
  background: rgba(255, 255, 255, 0.04);
}

/* ── Card main row ── */
.hm-card__main {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1rem;
  cursor: pointer;
  user-select: none;
}

.hm-card__main:focus-visible {
  outline: 2px solid #8b5cf6;
  outline-offset: -2px;
}

/* ── Left side ── */
.hm-card__left {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.hm-card__indicator {
  width: 4px;
  height: 32px;
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: 2px;
  transition: background-color 0.2s ease;
}

.hm-card__info {
  flex: 1;
  min-width: 0;
}

.hm-card__name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
}

.hm-card__name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #e0e0e0;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}

.hm-card__type-badge {
  display: inline-block;
  padding: 0.0625rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.hm-card__type-badge--bundled {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.hm-card__type-badge--custom {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
}

.hm-card__event-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.0625rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 500;
  border-radius: 3px;
  border: 1px solid;
}

.hm-event-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.hm-card__desc {
  font-size: 0.8125rem;
  color: #a0a0a0;
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Right side ── */
.hm-card__right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.hm-card__stats {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  align-items: flex-end;
}

.hm-card__stat {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
}

/* ── Toggle switch ── */
.hm-toggle {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  cursor: pointer;
}

.hm-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.hm-toggle__slider {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.hm-toggle__slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  bottom: 2px;
  background: #e0e0e0;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.hm-toggle input:checked + .hm-toggle__slider {
  background: #8b5cf6;
}

.hm-toggle input:checked + .hm-toggle__slider::before {
  transform: translateX(16px);
  background: #fff;
}

.hm-toggle input:disabled + .hm-toggle__slider {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Edit button ── */
.hm-card__edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #a0a0a0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.hm-card__edit-btn:hover {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.3);
  color: #c084fc;
}

/* ── Chevron ── */
.hm-card__chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.hm-card__chevron:hover {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.06);
}

/* ============================================
   Expanded Panel
   ============================================ */

.hm-card__panel {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 1rem;
  animation: hm-panel-open 0.2s ease;
}

@keyframes hm-panel-open {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 600px;
  }
}

.hm-card__panel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 700px) {
  .hm-card__panel-grid {
    grid-template-columns: 1fr;
  }
}

.hm-card__panel-col {
  min-width: 0;
}

.hm-card__panel-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #a0a0a0;
  margin: 0 0 0.75rem;
}

.hm-card__panel-title svg {
  color: rgba(139, 92, 246, 0.6);
}

/* ── Script path / timeout ── */
.hm-card__script-path,
.hm-card__timeout-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  font-size: 0.75rem;
}

.hm-card__script-label,
.hm-card__timeout-label {
  color: #a0a0a0;
  font-weight: 500;
}

.hm-card__script-value {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.6875rem;
  color: #c084fc;
  background: rgba(139, 92, 246, 0.08);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hm-card__timeout-value {
  color: #e0e0e0;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.6875rem;
}

/* ============================================
   Config View
   ============================================ */

.hm-config-empty {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
  padding: 0.75rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border: 1px dashed rgba(255, 255, 255, 0.06);
}

.hm-config-view {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hm-config-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 0.625rem;
}

.hm-config-section-title {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.35);
  margin: 0 0 0.5rem;
}

.hm-config-table {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.hm-config-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.25rem 0;
  font-size: 0.75rem;
}

.hm-config-key {
  color: #a0a0a0;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.6875rem;
  flex-shrink: 0;
}

.hm-config-value {
  text-align: right;
  min-width: 0;
}

.hm-config-bool {
  font-weight: 600;
  font-size: 0.6875rem;
}

.hm-config-bool--true {
  color: #34d399;
}

.hm-config-bool--false {
  color: #f87171;
}

.hm-config-number {
  color: #60a5fa;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.6875rem;
}

.hm-config-string {
  color: #fbbf24;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.6875rem;
  word-break: break-all;
}

.hm-config-array {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  justify-content: flex-end;
}

.hm-config-array-item {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.625rem;
  padding: 0.0625rem 0.25rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  color: #a0a0a0;
}

/* ============================================
   Log View
   ============================================ */

.hm-log-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 1.25rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.25);
  font-style: italic;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border: 1px dashed rgba(255, 255, 255, 0.06);
}

.hm-log-list {
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  overflow: hidden;
}

.hm-log-header-row {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 0.8fr 0.5fr;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.5625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.3);
}

.hm-log-row {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 0.8fr 0.5fr;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  font-size: 0.6875rem;
  color: #a0a0a0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  transition: background 0.1s ease;
}

.hm-log-row:last-child {
  border-bottom: none;
}

.hm-log-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.hm-log-row--error {
  background: rgba(239, 68, 68, 0.04);
}

.hm-log-col-time {
  white-space: nowrap;
}

.hm-log-col-event {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.625rem;
}

.hm-log-col-dur {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.625rem;
  color: rgba(255, 255, 255, 0.4);
}

.hm-log-col-status {
  display: flex;
  align-items: center;
  justify-content: center;
}

.hm-log-error-badge {
  display: flex;
  align-items: center;
  cursor: help;
}

/* ============================================
   Footer
   ============================================ */

.hm-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding: 0.75rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.hm-footer__text {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.3);
}

.hm-footer__legend {
  display: flex;
  gap: 1rem;
}

.hm-footer__legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.625rem;
  color: rgba(255, 255, 255, 0.35);
}

.hm-footer__legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
`;
