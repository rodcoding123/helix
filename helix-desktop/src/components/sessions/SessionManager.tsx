/**
 * Session Manager - View, resume, and export chat sessions
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './SessionManager.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: number;
  tokensUsed?: number;
}

interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  tokensUsed: number;
  model: string;
  agent?: string;
  status: 'active' | 'completed' | 'archived';
  preview?: string;
  messages?: ChatMessage[];
}

type SortOption = 'recent' | 'oldest' | 'most_messages' | 'most_tokens';
type FilterOption = 'all' | 'active' | 'completed' | 'archived';

export function SessionManager() {
  const { getClient } = useGateway();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('sessions.list') as { sessions: Session[] };
        setSessions(result.sessions || []);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    } else {
      // Mock data
      setSessions([
        {
          id: '1',
          title: 'Implementing Helix Desktop',
          createdAt: '2026-02-01T10:00:00Z',
          updatedAt: '2026-02-01T15:30:00Z',
          messageCount: 47,
          tokensUsed: 125000,
          model: 'claude-opus-4-5-20251101',
          agent: 'Helix',
          status: 'active',
          preview: 'Working on the React components for the desktop application...',
        },
        {
          id: '2',
          title: 'Code Review Session',
          createdAt: '2026-01-31T14:00:00Z',
          updatedAt: '2026-01-31T16:45:00Z',
          messageCount: 23,
          tokensUsed: 45000,
          model: 'claude-sonnet-4-20250514',
          status: 'completed',
          preview: 'Reviewing the authentication module for security issues...',
        },
        {
          id: '3',
          title: 'Bug Investigation',
          createdAt: '2026-01-30T09:00:00Z',
          updatedAt: '2026-01-30T11:30:00Z',
          messageCount: 15,
          tokensUsed: 28000,
          model: 'claude-sonnet-4-20250514',
          status: 'archived',
          preview: 'Debugging the WebSocket connection issues...',
        },
        {
          id: '4',
          title: 'Documentation Writing',
          createdAt: '2026-01-29T13:00:00Z',
          updatedAt: '2026-01-29T14:20:00Z',
          messageCount: 8,
          tokensUsed: 12000,
          model: 'claude-3-5-haiku-20241022',
          status: 'completed',
          preview: 'Creating API documentation for the gateway protocol...',
        },
      ]);
    }
    setLoading(false);
  };

  const loadSessionDetails = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('sessions.get', { id: sessionId }) as { session: Session };
        setSelectedSession(result.session);
      } catch (err) {
        console.error('Failed to load session details:', err);
      }
    } else {
      // Mock messages
      setSelectedSession({
        ...session,
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Can you help me implement the session manager component?',
            timestamp: session.createdAt,
          },
          {
            id: '2',
            role: 'assistant',
            content: "I'll help you create a session manager component. Let me start by designing the interface...",
            timestamp: new Date(new Date(session.createdAt).getTime() + 60000).toISOString(),
            toolCalls: 2,
            tokensUsed: 1500,
          },
          {
            id: '3',
            role: 'user',
            content: 'That looks good. Can you add export functionality?',
            timestamp: new Date(new Date(session.createdAt).getTime() + 120000).toISOString(),
          },
          {
            id: '4',
            role: 'assistant',
            content: "Sure! I'll add export options for Markdown and JSON formats...",
            timestamp: new Date(new Date(session.createdAt).getTime() + 180000).toISOString(),
            toolCalls: 1,
            tokensUsed: 2000,
          },
        ],
      });
    }
  };

  const resumeSession = async (sessionId: string) => {
    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('sessions.resume', { id: sessionId });
        // Navigate to chat with this session
      } catch (err) {
        console.error('Failed to resume session:', err);
      }
    }
    // For now, just alert
    alert('Session resumed! (Navigate to chat)');
  };

  const archiveSession = async (sessionId: string) => {
    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('sessions.archive', { id: sessionId });
      } catch (err) {
        console.error('Failed to archive session:', err);
        return;
      }
    }
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, status: 'archived' as const } : s
    ));
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('sessions.delete', { id: sessionId });
      } catch (err) {
        console.error('Failed to delete session:', err);
        return;
      }
    }
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (selectedSession?.id === sessionId) {
      setSelectedSession(null);
    }
  };

  const exportSession = async (session: Session, format: 'markdown' | 'json') => {
    setExporting(true);

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'markdown') {
      content = generateMarkdown(session);
      filename = `${session.title.replace(/[^a-z0-9]/gi, '_')}.md`;
      mimeType = 'text/markdown';
    } else {
      content = JSON.stringify(session, null, 2);
      filename = `${session.title.replace(/[^a-z0-9]/gi, '_')}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
  };

  const generateMarkdown = (session: Session): string => {
    let md = `# ${session.title}\n\n`;
    md += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
    md += `**Model:** ${session.model}\n`;
    if (session.agent) md += `**Agent:** ${session.agent}\n`;
    md += `**Messages:** ${session.messageCount}\n`;
    md += `**Tokens Used:** ${session.tokensUsed.toLocaleString()}\n\n`;
    md += `---\n\n`;

    if (session.messages) {
      for (const msg of session.messages) {
        const role = msg.role === 'user' ? '**You**' : msg.role === 'assistant' ? '**Assistant**' : '**System**';
        md += `### ${role}\n`;
        md += `*${new Date(msg.timestamp).toLocaleString()}*\n\n`;
        md += `${msg.content}\n\n`;
        if (msg.toolCalls) md += `*Tool calls: ${msg.toolCalls}*\n\n`;
        md += `---\n\n`;
      }
    }

    return md;
  };

  const filteredSessions = sessions
    .filter(s => {
      if (filterBy !== 'all' && s.status !== filterBy) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          s.title.toLowerCase().includes(query) ||
          s.preview?.toLowerCase().includes(query) ||
          s.agent?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'most_messages':
          return b.messageCount - a.messageCount;
        case 'most_tokens':
          return b.tokensUsed - a.tokensUsed;
        default:
          return 0;
      }
    });

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return String(tokens);
  };

  const formatDate = (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="sessions-loading">Loading sessions...</div>;
  }

  return (
    <div className="session-manager">
      <div className="sessions-sidebar">
        <header className="sidebar-header">
          <h2>Sessions</h2>
          <span className="session-count">{sessions.length}</span>
        </header>

        <div className="sidebar-toolbar">
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="sidebar-filters">
          <select value={filterBy} onChange={(e) => setFilterBy(e.target.value as FilterOption)}>
            <option value="all">All Sessions</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="most_messages">Most Messages</option>
            <option value="most_tokens">Most Tokens</option>
          </select>
        </div>

        <div className="sessions-list">
          {filteredSessions.length === 0 ? (
            <div className="no-sessions">
              <span className="no-sessions-icon">💬</span>
              <p>No sessions found</p>
            </div>
          ) : (
            filteredSessions.map(session => (
              <button
                key={session.id}
                className={`session-item ${selectedSession?.id === session.id ? 'selected' : ''} ${session.status}`}
                onClick={() => loadSessionDetails(session.id)}
              >
                <div className="session-item-header">
                  <span className="session-title">{session.title}</span>
                  <span className={`session-status status-${session.status}`}>
                    {session.status}
                  </span>
                </div>
                <p className="session-preview">{session.preview}</p>
                <div className="session-meta">
                  <span>{formatDate(session.updatedAt)}</span>
                  <span>{session.messageCount} msgs</span>
                  <span>{formatTokens(session.tokensUsed)} tokens</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="session-detail">
        {selectedSession ? (
          <>
            <header className="detail-header">
              <div className="detail-info">
                <h3>{selectedSession.title}</h3>
                <div className="detail-meta">
                  <span className="meta-item">
                    <span className="meta-icon">🤖</span>
                    {selectedSession.model}
                  </span>
                  {selectedSession.agent && (
                    <span className="meta-item">
                      <span className="meta-icon">👤</span>
                      {selectedSession.agent}
                    </span>
                  )}
                  <span className="meta-item">
                    <span className="meta-icon">💬</span>
                    {selectedSession.messageCount} messages
                  </span>
                  <span className="meta-item">
                    <span className="meta-icon">📊</span>
                    {formatTokens(selectedSession.tokensUsed)} tokens
                  </span>
                </div>
              </div>
              <div className="detail-actions">
                {selectedSession.status !== 'archived' && (
                  <button className="btn-primary" onClick={() => resumeSession(selectedSession.id)}>
                    Resume
                  </button>
                )}
                <div className="dropdown">
                  <button className="btn-secondary">Export ▾</button>
                  <div className="dropdown-content">
                    <button onClick={() => exportSession(selectedSession, 'markdown')} disabled={exporting}>
                      Export as Markdown
                    </button>
                    <button onClick={() => exportSession(selectedSession, 'json')} disabled={exporting}>
                      Export as JSON
                    </button>
                  </div>
                </div>
                {selectedSession.status !== 'archived' && (
                  <button className="btn-secondary" onClick={() => archiveSession(selectedSession.id)}>
                    Archive
                  </button>
                )}
                <button className="btn-danger" onClick={() => deleteSession(selectedSession.id)}>
                  Delete
                </button>
              </div>
            </header>

            <div className="messages-container">
              {selectedSession.messages ? (
                selectedSession.messages.map(msg => (
                  <div key={msg.id} className={`message-item ${msg.role}`}>
                    <div className="message-header">
                      <span className="message-role">
                        {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Assistant' : 'System'}
                      </span>
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-content">{msg.content}</div>
                    {(msg.toolCalls || msg.tokensUsed) && (
                      <div className="message-stats">
                        {msg.toolCalls && <span>🔧 {msg.toolCalls} tool calls</span>}
                        {msg.tokensUsed && <span>📊 {msg.tokensUsed} tokens</span>}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="loading-messages">Loading messages...</div>
              )}
            </div>
          </>
        ) : (
          <div className="no-selection">
            <span className="no-selection-icon">📂</span>
            <p>Select a session to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
