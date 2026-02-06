/**
 * Session History - Browse and replay past sessions
 *
 * Gateway methods used:
 *   - sessions.list   -> List all sessions with metadata
 *   - chat.history    -> Load messages for a selected session
 *
 * Layout: Left sidebar (session list, 280px) + Right panel (SessionDetail)
 *
 * Features:
 *   - Search sessions by channel, sender, content
 *   - Filter: All / Active / Archived
 *   - Session cards with channel icon, message count, timestamps, token usage
 *   - Full conversation replay in detail view
 *   - Export to JSON / Markdown
 */

import { useState, useEffect, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { SessionDetail } from './SessionDetail';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface SessionEntry {
  id: string;
  channel?: string;
  sender?: string;
  messageCount: number;
  lastActive: string;
  createdAt: string;
  tokensUsed?: number;
  status: 'active' | 'archived';
  preview?: string;
  model?: string;
}

type FilterOption = 'all' | 'active' | 'archived';

interface SessionHistoryProps {
  onBack?: () => void;
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

/** Channel icon character based on channel name. */
function getChannelIcon(channel?: string): string {
  if (!channel) return '#';
  const lower = channel.toLowerCase();
  if (lower.includes('discord')) return 'D';
  if (lower.includes('telegram')) return 'T';
  if (lower.includes('slack')) return 'S';
  if (lower.includes('whatsapp')) return 'W';
  if (lower.includes('cli')) return '>';
  if (lower.includes('web')) return 'W';
  return '#';
}

/** Mock sessions for disconnected state. */
function buildMockSessions(): SessionEntry[] {
  return [
    {
      id: 'session-a1b2c3d4',
      channel: 'cli',
      sender: 'specter',
      messageCount: 47,
      lastActive: new Date(Date.now() - 1_800_000).toISOString(),
      createdAt: new Date(Date.now() - 18_000_000).toISOString(),
      tokensUsed: 125_000,
      status: 'active',
      preview: 'Working on the React components for the desktop application...',
      model: 'claude-opus-4-5-20251101',
    },
    {
      id: 'session-e5f6g7h8',
      channel: 'discord',
      sender: 'specter',
      messageCount: 23,
      lastActive: new Date(Date.now() - 86_400_000).toISOString(),
      createdAt: new Date(Date.now() - 100_000_000).toISOString(),
      tokensUsed: 45_000,
      status: 'active',
      preview: 'Reviewing the authentication module for security issues...',
      model: 'claude-sonnet-4-20250514',
    },
    {
      id: 'session-i9j0k1l2',
      channel: 'web',
      sender: 'specter',
      messageCount: 15,
      lastActive: new Date(Date.now() - 172_800_000).toISOString(),
      createdAt: new Date(Date.now() - 200_000_000).toISOString(),
      tokensUsed: 28_000,
      status: 'archived',
      preview: 'Debugging the WebSocket connection issues in the gateway client...',
      model: 'claude-sonnet-4-20250514',
    },
    {
      id: 'session-m3n4o5p6',
      channel: 'cli',
      sender: 'specter',
      messageCount: 8,
      lastActive: new Date(Date.now() - 259_200_000).toISOString(),
      createdAt: new Date(Date.now() - 280_000_000).toISOString(),
      tokensUsed: 12_000,
      status: 'archived',
      preview: 'Creating API documentation for the gateway protocol...',
      model: 'claude-3-5-haiku-20241022',
    },
    {
      id: 'session-q7r8s9t0',
      channel: 'discord',
      sender: 'helix',
      messageCount: 34,
      lastActive: new Date(Date.now() - 345_600_000).toISOString(),
      createdAt: new Date(Date.now() - 400_000_000).toISOString(),
      tokensUsed: 67_000,
      status: 'active',
      preview: 'Implementing the seven-layer psychological architecture...',
      model: 'claude-opus-4-5-20251101',
    },
  ];
}

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */

export function SessionHistory({ onBack }: SessionHistoryProps) {
  const { getClient, connected } = useGateway();

  // Session list state
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter / search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');

  // Selected session
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // ── Load sessions ──
  const loadSessions = useCallback(async () => {
    setError(null);
    const client = getClient();

    if (client?.connected) {
      try {
        const result = await client.request<{
          sessions: SessionEntry[];
        }>('sessions.list');
        setSessions(result.sessions ?? []);
      } catch (err) {
        console.error('Failed to load sessions:', err);
        setSessions(buildMockSessions());
      }
    } else {
      setSessions(buildMockSessions());
    }

    setLoading(false);
  }, [getClient]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // ── Filtered sessions ──
  const filteredSessions = sessions
    .filter((s) => {
      // Status filter
      if (filter === 'active' && s.status !== 'active') return false;
      if (filter === 'archived' && s.status !== 'archived') return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (s.channel ?? '').toLowerCase().includes(q) ||
          (s.sender ?? '').toLowerCase().includes(q) ||
          (s.preview ?? '').toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

  // ── Selected session data ──
  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;

  // ── Counts ──
  const activeSessions = sessions.filter((s) => s.status === 'active').length;
  const archivedSessions = sessions.filter((s) => s.status === 'archived').length;

  // ── Render ──
  return (
    <div className="sh-root">
      <style>{sessionHistoryStyles}</style>

      <div className="sh-layout">
        {/* ═══ Left Sidebar: Session List ═══ */}
        <div className="sh-sidebar">
          {/* Header */}
          <div className="sh-sidebar-header">
            <div className="sh-sidebar-title-row">
              {onBack && (
                <button className="sh-back-btn" onClick={onBack}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              <h2 className="sh-title">Sessions</h2>
              <span className="sh-count">{sessions.length}</span>
            </div>
          </div>

          {/* Search */}
          <div className="sh-search">
            <svg className="sh-search-icon" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              className="sh-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by channel, sender, content..."
            />
            {searchQuery && (
              <button className="sh-search-clear" onClick={() => setSearchQuery('')}>
                x
              </button>
            )}
          </div>

          {/* Filter buttons */}
          <div className="sh-filters">
            {([
              ['all', `All (${sessions.length})`],
              ['active', `Active (${activeSessions})`],
              ['archived', `Archived (${archivedSessions})`],
            ] as [FilterOption, string][]).map(([key, label]) => (
              <button
                key={key}
                className={`sh-filter-btn ${filter === key ? 'sh-filter-btn--active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Gateway disconnected */}
          {!connected && (
            <div className="sh-sidebar-warn">
              Gateway offline. Showing mock data.
            </div>
          )}

          {/* Session list */}
          <div className="sh-session-list">
            {loading ? (
              <div className="sh-list-loading">
                <div className="sh-spinner" />
                <span>Loading sessions...</span>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="sh-list-empty">
                <p>
                  {searchQuery
                    ? `No sessions matching "${searchQuery}"`
                    : filter !== 'all'
                      ? 'No sessions in this category'
                      : 'No sessions found'}
                </p>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <button
                  key={session.id}
                  className={`sh-session-card ${selectedSessionId === session.id ? 'sh-session-card--selected' : ''}`}
                  onClick={() => setSelectedSessionId(session.id)}
                >
                  <div className="sh-card-top">
                    <span
                      className="sh-card-channel-icon"
                      title={session.channel ?? 'unknown'}
                    >
                      {getChannelIcon(session.channel)}
                    </span>
                    <div className="sh-card-info">
                      <span className="sh-card-sender">
                        {session.sender ?? 'Unknown'}
                      </span>
                      {session.channel && (
                        <span className="sh-card-channel">#{session.channel}</span>
                      )}
                    </div>
                    <div className="sh-card-right">
                      <span className="sh-card-time">
                        {formatRelativeTime(session.lastActive)}
                      </span>
                      <span className="sh-card-msg-badge">
                        {session.messageCount}
                      </span>
                    </div>
                  </div>
                  {session.preview && (
                    <p className="sh-card-preview">{session.preview}</p>
                  )}
                  <div className="sh-card-meta">
                    {session.tokensUsed != null && session.tokensUsed > 0 && (
                      <span className="sh-card-meta-item">
                        {formatTokens(session.tokensUsed)} tokens
                      </span>
                    )}
                    {session.model && (
                      <span className="sh-card-meta-item sh-card-model">
                        {session.model.split('-').slice(0, 2).join(' ')}
                      </span>
                    )}
                    <span className={`sh-card-status sh-card-status--${session.status}`}>
                      {session.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ═══ Right Panel: Session Detail ═══ */}
        <div className="sh-detail-panel">
          {error && (
            <div className="sh-detail-error">
              <span>{error}</span>
              <button className="btn-sm btn-secondary" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          )}
          {selectedSession ? (
            <SessionDetail
              sessionId={selectedSession.id}
              channel={selectedSession.channel}
              sender={selectedSession.sender}
              onClose={() => setSelectedSessionId(null)}
            />
          ) : (
            <div className="sh-detail-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p>Select a session to view the conversation</p>
              <span className="sh-detail-hint">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''} available
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { SessionHistory as default };

/* ═══════════════════════════════════════════
   Scoped Styles (sh- prefix for SessionHistory)
   ═══════════════════════════════════════════ */

const sessionHistoryStyles = `
.sh-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--text-primary, #fff);
}

.sh-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ═══ Sidebar ═══ */
.sh-sidebar {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sh-sidebar-header {
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.sh-sidebar-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sh-back-btn {
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.sh-back-btn:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.06);
}

.sh-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}

.sh-count {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  background: rgba(255,255,255,0.06);
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
}

/* ── Search ── */
.sh-search {
  position: relative;
  padding: 0.5rem 0.75rem;
  flex-shrink: 0;
}

.sh-search-icon {
  position: absolute;
  left: 1.25rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary, #606080);
  pointer-events: none;
}

.sh-search-input {
  width: 100%;
  padding: 0.4375rem 0.5rem 0.4375rem 2rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-primary, #fff);
  outline: none;
  transition: border-color 0.15s ease;
}

.sh-search-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.sh-search-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.sh-search-clear {
  position: absolute;
  right: 1.25rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.0625rem 0.25rem;
}

.sh-search-clear:hover {
  color: var(--text-primary, #fff);
}

/* ── Filters ── */
.sh-filters {
  display: flex;
  gap: 0.25rem;
  padding: 0 0.75rem 0.5rem;
  flex-shrink: 0;
}

.sh-filter-btn {
  padding: 0.3125rem 0.625rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 0.6875rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.sh-filter-btn:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.12);
}

.sh-filter-btn--active {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  color: white;
}

/* ── Sidebar Warning ── */
.sh-sidebar-warn {
  padding: 0.375rem 0.75rem;
  background: rgba(245, 158, 11, 0.08);
  color: #fbbf24;
  font-size: 0.6875rem;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(245, 158, 11, 0.15);
}

/* ── Session List ── */
.sh-session-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem;
}

.sh-list-loading,
.sh-list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--text-tertiary, #606080);
  font-size: 0.8125rem;
  text-align: center;
}

.sh-list-empty p {
  margin: 0;
}

.sh-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: sh-spin 0.8s linear infinite;
}

@keyframes sh-spin {
  to { transform: rotate(360deg); }
}

/* ── Session Card ── */
.sh-session-card {
  display: block;
  width: 100%;
  padding: 0.625rem 0.75rem;
  margin-bottom: 0.125rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  color: inherit;
}

.sh-session-card:hover {
  background: rgba(255,255,255,0.03);
  border-color: rgba(255,255,255,0.08);
}

.sh-session-card--selected {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.25);
}

.sh-session-card--selected:hover {
  background: rgba(99, 102, 241, 0.15);
}

.sh-card-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sh-card-channel-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sh-card-info {
  flex: 1;
  min-width: 0;
}

.sh-card-sender {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sh-card-channel {
  display: block;
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
}

.sh-card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
  flex-shrink: 0;
}

.sh-card-time {
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
}

.sh-card-msg-badge {
  font-size: 0.5625rem;
  font-weight: 700;
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
  padding: 0.0625rem 0.3125rem;
  border-radius: 9999px;
  min-width: 16px;
  text-align: center;
}

.sh-card-preview {
  font-size: 0.6875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0.375rem 0 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sh-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
  flex-wrap: wrap;
}

.sh-card-meta-item {
  font-size: 0.5625rem;
  color: var(--text-tertiary, #606080);
}

.sh-card-model {
  font-family: var(--font-mono, monospace);
  text-transform: capitalize;
}

.sh-card-status {
  font-size: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.0625rem 0.25rem;
  border-radius: 3px;
}

.sh-card-status--active {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.sh-card-status--archived {
  background: rgba(255,255,255,0.06);
  color: var(--text-tertiary, #606080);
}

/* ═══ Detail Panel ═══ */
.sh-detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.sh-detail-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: rgba(239, 68, 68, 0.08);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  font-size: 0.8125rem;
  flex-shrink: 0;
}

.sh-detail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex: 1;
  color: var(--text-tertiary, #606080);
  font-size: 0.875rem;
}

.sh-detail-empty p {
  margin: 0;
}

.sh-detail-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}
`;
