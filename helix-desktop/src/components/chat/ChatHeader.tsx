/**
 * Chat Header - Session info, model, agent selector
 */

import { useState } from 'react';
import './ChatHeader.css';

interface SessionInfo {
  key: string;
  name?: string;
}

interface ModelInfo {
  provider: string;
  model: string;
}

interface AgentInfo {
  id: string;
  name: string;
  description?: string;
}

interface ChatHeaderProps {
  session: SessionInfo | null;
  model: ModelInfo | null;
  agent: AgentInfo | null;
  tokensUsed?: number;
  connected: boolean;
  onSessionSelect?: () => void;
  onModelSelect?: () => void;
  onAgentSelect?: () => void;
  onNewSession?: () => void;
}

export function ChatHeader({
  session,
  model,
  agent,
  tokensUsed,
  connected,
  onSessionSelect,
  onModelSelect,
  onAgentSelect,
  onNewSession,
}: ChatHeaderProps) {
  const [showSessionMenu, setShowSessionMenu] = useState(false);

  const formatTokens = (tokens: number): string => {
    if (tokens < 1000) return tokens.toString();
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
    return `${(tokens / 1000000).toFixed(1)}M`;
  };

  return (
    <header className="chat-header">
      <div className="header-left">
        <div className="connection-status">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
          <span className="status-text">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="header-center">
        <button
          className="session-selector"
          onClick={() => {
            setShowSessionMenu(!showSessionMenu);
            onSessionSelect?.();
          }}
        >
          <span className="session-icon">💬</span>
          <span className="session-name">{session?.name || session?.key || 'New Chat'}</span>
          <svg className="dropdown-icon" viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M7 10l5 5 5-5z" />
          </svg>
        </button>
      </div>

      <div className="header-right">
        {agent && (
          <button className="header-chip agent" onClick={onAgentSelect}>
            <span className="chip-icon">🎭</span>
            <span className="chip-label">{agent.name}</span>
          </button>
        )}

        {model && (
          <button className="header-chip model" onClick={onModelSelect}>
            <span className="chip-icon">🤖</span>
            <span className="chip-label">{model.model}</span>
          </button>
        )}

        {tokensUsed !== undefined && (
          <div className="header-chip tokens">
            <span className="chip-icon">📊</span>
            <span className="chip-label">{formatTokens(tokensUsed)}</span>
          </div>
        )}

        <button className="new-chat-btn" onClick={onNewSession} title="New Chat (Ctrl+N)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
