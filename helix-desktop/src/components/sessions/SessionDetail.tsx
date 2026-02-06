/**
 * Session Detail - Individual session replay with full conversation view
 *
 * Gateway methods used:
 *   - chat.history   -> Fetch paginated message history for a session
 *
 * Features:
 *   - Chronological message replay with role-based styling
 *   - Tool call visualization (collapsible cards)
 *   - Model badge per message
 *   - Token counter per message
 *   - Export to JSON / Markdown
 *   - "Load more" pagination at top
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  model?: string;
  tokensUsed?: number;
  toolCalls?: ToolCallInfo[];
}

interface ToolCallInfo {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  status?: 'success' | 'error';
}

interface SessionDetailProps {
  sessionId: string;
  channel?: string;
  sender?: string;
  onClose?: () => void;
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

/** Safely render a JSON value as a formatted string. */
function renderJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Escape HTML entities for safe rendering in text content. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Group consecutive messages by date for separator rendering. */
function groupByDate(messages: ChatMessage[]): { date: string; messages: ChatMessage[] }[] {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  let currentDate = '';

  for (const msg of messages) {
    const msgDate = formatDate(msg.timestamp);
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groups.push({ date: msgDate, messages: [] });
    }
    groups[groups.length - 1].messages.push(msg);
  }

  return groups;
}

/** Build mock messages for offline display. */
function buildMockMessages(sessionId: string): ChatMessage[] {
  const base = new Date('2026-02-06T10:00:00Z');
  return [
    {
      id: `${sessionId}-1`,
      role: 'user',
      content: 'Can you help me review the security hardening implementation?',
      timestamp: base.toISOString(),
    },
    {
      id: `${sessionId}-2`,
      role: 'assistant',
      content:
        "I'll review the security hardening implementation. Let me start by examining the key files.\n\nThe implementation follows the pre-execution logging pattern correctly. Here are my findings:\n\n1. **EncryptedSecretsCache** - Uses AES-256-GCM with proper key derivation\n2. **LogSanitizer** - 25+ patterns for redacting sensitive data\n3. **EnvironmentProxy** - Blocks 16 categories of sensitive env vars",
      timestamp: new Date(base.getTime() + 60_000).toISOString(),
      model: 'claude-opus-4-5-20251101',
      tokensUsed: 2400,
      toolCalls: [
        {
          id: 'tc-1',
          name: 'Read',
          args: { file_path: 'src/lib/secrets-cache-encrypted.ts' },
          result: '// 280+ lines of encrypted cache implementation...',
          status: 'success',
        },
        {
          id: 'tc-2',
          name: 'Read',
          args: { file_path: 'src/lib/log-sanitizer.ts' },
          result: '// 250+ lines of log sanitization...',
          status: 'success',
        },
      ],
    },
    {
      id: `${sessionId}-3`,
      role: 'user',
      content: 'What about the plugin isolation? Is it properly blocking env access?',
      timestamp: new Date(base.getTime() + 180_000).toISOString(),
    },
    {
      id: `${sessionId}-4`,
      role: 'assistant',
      content:
        'The plugin isolation is well-implemented. The EnvironmentProxy uses a virtual proxy with an explicit allowlist approach:\n\n- **Allowed**: NODE_ENV, PATH, HOME, USER, LANG, TZ, SHELL, etc.\n- **Blocked**: 16 categories including DISCORD_WEBHOOK_*, STRIPE_*, all *API_KEY, *SECRET, *TOKEN patterns\n- **Logging**: All blocked access attempts are logged to the hash chain for audit\n\nThis is a fail-closed design, which is the correct approach for security-critical systems.',
      timestamp: new Date(base.getTime() + 240_000).toISOString(),
      model: 'claude-opus-4-5-20251101',
      tokensUsed: 1800,
      toolCalls: [
        {
          id: 'tc-3',
          name: 'Grep',
          args: { pattern: 'BLOCKED_PATTERNS', path: 'helix-runtime/src/plugins/environment-proxy.ts' },
          result: 'Found 16 blocked pattern categories',
          status: 'success',
        },
      ],
    },
  ];
}

/** Generate markdown export of the conversation. */
function generateMarkdown(
  sessionId: string,
  channel: string | undefined,
  sender: string | undefined,
  messages: ChatMessage[]
): string {
  let md = `# Session: ${sessionId}\n\n`;
  if (channel) md += `**Channel:** ${channel}\n`;
  if (sender) md += `**Sender:** ${sender}\n`;
  md += `**Messages:** ${messages.length}\n`;
  md += `**Exported:** ${new Date().toISOString()}\n\n---\n\n`;

  const totalTokens = messages.reduce((sum, m) => sum + (m.tokensUsed ?? 0), 0);
  if (totalTokens > 0) md += `**Total tokens:** ${formatTokens(totalTokens)}\n\n---\n\n`;

  for (const msg of messages) {
    const role =
      msg.role === 'user'
        ? '**You**'
        : msg.role === 'assistant'
          ? '**Assistant**'
          : msg.role === 'system'
            ? '**System**'
            : '**Tool**';

    md += `### ${role}\n`;
    md += `*${new Date(msg.timestamp).toLocaleString()}*`;
    if (msg.model) md += ` | Model: ${msg.model}`;
    if (msg.tokensUsed) md += ` | ${msg.tokensUsed} tokens`;
    md += '\n\n';
    md += `${msg.content}\n\n`;

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      md += `**Tool Calls:**\n\n`;
      for (const tc of msg.toolCalls) {
        md += `- \`${tc.name}\`: ${renderJson(tc.args)}\n`;
        if (tc.result) md += `  Result: ${typeof tc.result === 'string' ? tc.result.slice(0, 200) : renderJson(tc.result).slice(0, 200)}\n`;
      }
      md += '\n';
    }

    md += '---\n\n';
  }

  return md;
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function ToolCallCard({ toolCall }: { toolCall: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="sd-tool-card">
      <button
        className="sd-tool-header"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          className={`sd-tool-chevron ${expanded ? 'sd-tool-chevron--open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M4.5 2.5L8 6L4.5 9.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="sd-tool-name">{toolCall.name}</span>
        {toolCall.status && (
          <span className={`sd-tool-status sd-tool-status--${toolCall.status}`}>
            {toolCall.status}
          </span>
        )}
      </button>
      {expanded && (
        <div className="sd-tool-body">
          <div className="sd-tool-section">
            <span className="sd-tool-label">Arguments</span>
            <pre className="sd-tool-code">{renderJson(toolCall.args)}</pre>
          </div>
          {toolCall.result != null && (
            <div className="sd-tool-section">
              <span className="sd-tool-label">Result</span>
              <pre className="sd-tool-code">
                {typeof toolCall.result === 'string'
                  ? escapeHtml(toolCall.result)
                  : renderJson(toolCall.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`sd-message sd-message--${message.role}`}>
      <div className="sd-message-header">
        <span className="sd-message-role">
          {isUser ? 'You' : isSystem ? 'System' : 'Assistant'}
        </span>
        <span className="sd-message-time">{formatTime(message.timestamp)}</span>
        {message.model && (
          <span className="sd-message-model">{message.model.split('-').slice(0, 3).join(' ')}</span>
        )}
        {message.tokensUsed != null && message.tokensUsed > 0 && (
          <span className="sd-message-tokens">{formatTokens(message.tokensUsed)} tok</span>
        )}
      </div>
      <div className="sd-message-content">
        {message.content.split('\n').map((line, i) => (
          <span key={i}>
            {line}
            {i < message.content.split('\n').length - 1 && <br />}
          </span>
        ))}
      </div>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="sd-message-tools">
          {message.toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */

export function SessionDetail({ sessionId, channel, sender, onClose }: SessionDetailProps) {
  const { getClient, connected } = useGateway();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // ── Initial load ──
  const loadMessages = useCallback(async () => {
    setError(null);
    const client = getClient();

    if (client?.connected) {
      try {
        const result = await client.request<{
          messages: ChatMessage[];
          hasMore: boolean;
        }>('chat.history', {
          sessionKey: sessionId,
          limit: 50,
        });
        setMessages(result.messages ?? []);
        setHasMore(result.hasMore ?? false);
      } catch (err) {
        console.error('Failed to load chat history:', err);
        setMessages(buildMockMessages(sessionId));
        setHasMore(false);
      }
    } else {
      setMessages(buildMockMessages(sessionId));
      setHasMore(false);
    }

    setLoading(false);
  }, [getClient, sessionId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Scroll to bottom after initial load
  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [loading]);

  // ── Load older messages ──
  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);

    const client = getClient();
    if (client?.connected && messages.length > 0) {
      try {
        const oldestTimestamp = messages[0].timestamp;
        const result = await client.request<{
          messages: ChatMessage[];
          hasMore: boolean;
        }>('chat.history', {
          sessionKey: sessionId,
          limit: 50,
          before: oldestTimestamp,
        });
        setMessages((prev) => [...(result.messages ?? []), ...prev]);
        setHasMore(result.hasMore ?? false);
      } catch (err) {
        console.error('Failed to load older messages:', err);
      }
    }

    setLoadingMore(false);
  }, [getClient, sessionId, messages, hasMore, loadingMore]);

  // ── Export ──
  const handleExport = useCallback(
    (format: 'json' | 'markdown') => {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'json') {
        content = JSON.stringify(
          { sessionId, channel, sender, messages, exportedAt: new Date().toISOString() },
          null,
          2
        );
        filename = `session-${sessionId}.json`;
        mimeType = 'application/json';
      } else {
        content = generateMarkdown(sessionId, channel, sender, messages);
        filename = `session-${sessionId}.md`;
        mimeType = 'text/markdown';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportMenu(false);
    },
    [sessionId, channel, sender, messages]
  );

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  // ── Computed values ──
  const totalTokens = messages.reduce((sum, m) => sum + (m.tokensUsed ?? 0), 0);
  const dateGroups = groupByDate(messages);
  const createdDate = messages.length > 0 ? formatDate(messages[0].timestamp) : '';

  // ── Render ──
  return (
    <div className="sd-root">
      <style>{sessionDetailStyles}</style>

      {/* ── Header ── */}
      <div className="sd-header">
        <div className="sd-header-info">
          <div className="sd-header-top">
            <h3 className="sd-header-title">
              {channel ? `#${channel}` : `Session ${sessionId.slice(0, 8)}`}
            </h3>
            {sender && <span className="sd-header-sender">{sender}</span>}
          </div>
          <div className="sd-header-meta">
            <span className="sd-header-meta-item">ID: {sessionId.slice(0, 12)}</span>
            {createdDate && <span className="sd-header-meta-item">{createdDate}</span>}
            <span className="sd-header-meta-item">{messages.length} messages</span>
            {totalTokens > 0 && (
              <span className="sd-header-meta-item">{formatTokens(totalTokens)} tokens</span>
            )}
          </div>
        </div>
        <div className="sd-header-actions">
          {/* Export dropdown */}
          <div className="sd-export-wrap" ref={exportMenuRef}>
            <button
              className="sd-header-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
              </svg>
              Export
            </button>
            {showExportMenu && (
              <div className="sd-export-menu">
                <button
                  className="sd-export-option"
                  onClick={() => handleExport('json')}
                >
                  Export as JSON
                </button>
                <button
                  className="sd-export-option"
                  onClick={() => handleExport('markdown')}
                >
                  Export as Markdown
                </button>
              </div>
            )}
          </div>
          {onClose && (
            <button className="sd-header-btn" onClick={onClose}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Gateway disconnected banner ── */}
      {!connected && (
        <div className="sd-banner">
          Gateway disconnected. Showing mock conversation data.
        </div>
      )}

      {error && (
        <div className="sd-error">
          <span>{error}</span>
          <button className="btn-sm btn-secondary" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* ── Conversation replay ── */}
      {loading ? (
        <div className="sd-loading">
          <div className="sd-spinner" />
          <span>Loading conversation...</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="sd-empty">
          <p>No messages in this session</p>
        </div>
      ) : (
        <div className="sd-conversation" ref={scrollRef}>
          {/* Load more button */}
          {hasMore && (
            <div className="sd-load-more">
              <button
                className="sd-load-more-btn"
                onClick={loadOlderMessages}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <div className="sd-spinner-sm" />
                    Loading...
                  </>
                ) : (
                  'Load older messages'
                )}
              </button>
            </div>
          )}

          {/* Messages grouped by date */}
          {dateGroups.map((group) => (
            <div key={group.date}>
              <div className="sd-date-separator">
                <span className="sd-date-label">{group.date}</span>
              </div>
              {group.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { SessionDetail as default };

/* ═══════════════════════════════════════════
   Scoped Styles (sd- prefix)
   ═══════════════════════════════════════════ */

const sessionDetailStyles = `
.sd-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--text-primary, #fff);
}

/* ── Header ── */
.sd-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
  gap: 1rem;
}

.sd-header-info {
  min-width: 0;
}

.sd-header-top {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.sd-header-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary, #fff);
}

.sd-header-sender {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
}

.sd-header-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.25rem;
  flex-wrap: wrap;
}

.sd-header-meta-item {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

.sd-header-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.sd-header-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sd-header-btn:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.15);
  color: var(--text-primary, #fff);
}

/* ── Export Dropdown ── */
.sd-export-wrap {
  position: relative;
}

.sd-export-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 0.25rem;
  min-width: 160px;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.sd-export-option {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s ease;
}

.sd-export-option:hover {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary, #fff);
}

/* ── Banner / Error ── */
.sd-banner {
  padding: 0.5rem 1rem;
  background: rgba(245, 158, 11, 0.1);
  border-bottom: 1px solid rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.sd-error {
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

/* ── Loading / Empty ── */
.sd-loading,
.sd-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex: 1;
  color: var(--text-tertiary, #606080);
  font-size: 0.875rem;
}

.sd-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: sd-spin 0.8s linear infinite;
}

.sd-spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: sd-spin 0.8s linear infinite;
}

@keyframes sd-spin {
  to { transform: rotate(360deg); }
}

/* ── Conversation ── */
.sd-conversation {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem;
}

.sd-load-more {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0 1rem;
}

.sd-load-more-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 1rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sd-load-more-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.2);
}

.sd-load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Date Separator ── */
.sd-date-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0;
}

.sd-date-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  background: var(--bg-primary, #0a0a1a);
  padding: 0.125rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid rgba(255,255,255,0.06);
}

/* ── Message Bubble ── */
.sd-message {
  margin-bottom: 0.75rem;
  max-width: 85%;
}

.sd-message--user {
  margin-left: auto;
}

.sd-message--assistant,
.sd-message--system,
.sd-message--tool {
  margin-right: auto;
}

.sd-message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  flex-wrap: wrap;
}

.sd-message-role {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
}

.sd-message--user .sd-message-role {
  color: var(--accent-color, #6366f1);
}

.sd-message-time {
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
}

.sd-message-model {
  font-size: 0.5625rem;
  font-weight: 600;
  text-transform: capitalize;
  padding: 0.0625rem 0.375rem;
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  border-radius: 3px;
}

.sd-message-tokens {
  font-size: 0.5625rem;
  color: var(--text-tertiary, #606080);
  font-family: var(--font-mono, monospace);
}

.sd-message-content {
  padding: 0.625rem 0.875rem;
  border-radius: 12px;
  font-size: 0.8125rem;
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.sd-message--user .sd-message-content {
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-bottom-right-radius: 4px;
  color: var(--text-primary, #fff);
}

.sd-message--assistant .sd-message-content {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-bottom-left-radius: 4px;
  color: var(--text-primary, #fff);
}

.sd-message--system .sd-message-content {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  font-size: 0.75rem;
  font-style: italic;
}

.sd-message--tool .sd-message-content {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.15);
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
}

/* ── Tool Calls ── */
.sd-message-tools {
  margin-top: 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sd-tool-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  overflow: hidden;
}

.sd-tool-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.375rem 0.625rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.75rem;
  text-align: left;
  transition: background 0.1s ease;
}

.sd-tool-header:hover {
  background: rgba(255,255,255,0.04);
}

.sd-tool-chevron {
  flex-shrink: 0;
  color: var(--text-tertiary, #606080);
  transition: transform 0.15s ease;
}

.sd-tool-chevron--open {
  transform: rotate(90deg);
}

.sd-tool-name {
  font-weight: 600;
  font-family: var(--font-mono, monospace);
  color: #34d399;
}

.sd-tool-status {
  font-size: 0.5625rem;
  font-weight: 600;
  padding: 0.0625rem 0.25rem;
  border-radius: 3px;
  text-transform: uppercase;
  margin-left: auto;
}

.sd-tool-status--success {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.sd-tool-status--error {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}

.sd-tool-body {
  padding: 0.5rem 0.625rem;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.sd-tool-section {
  margin-bottom: 0.5rem;
}

.sd-tool-section:last-child {
  margin-bottom: 0;
}

.sd-tool-label {
  display: block;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.25rem;
}

.sd-tool-code {
  margin: 0;
  padding: 0.375rem 0.5rem;
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 4px;
  font-size: 0.6875rem;
  font-family: 'JetBrains Mono', 'Fira Code', var(--font-mono, monospace);
  color: var(--text-secondary, #a0a0c0);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}
`;
