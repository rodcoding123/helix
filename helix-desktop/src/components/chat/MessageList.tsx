/**
 * Message List - Displays conversation messages and tool executions
 */

import { MessageBubble } from './MessageBubble';
import { ToolExecution, type ToolExecutionData } from './ToolExecution';
import './MessageList.css';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  thinking?: string;
  toolCalls?: ToolExecutionData[];
  isStreaming?: boolean;
}

interface MessageListProps {
  messages: Message[];
  thinking: string | null;
  isStreaming: boolean;
  showThinking?: boolean;
  streamingContent?: string;
  pendingTools?: ToolExecutionData[];
}

export function MessageList({
  messages,
  thinking,
  isStreaming,
  showThinking = false,
  streamingContent,
  pendingTools = [],
}: MessageListProps) {
  if (messages.length === 0 && !thinking && !streamingContent) {
    return (
      <div className="message-list-empty">
        <div className="welcome-message">
          {/* DNA Helix Animation */}
          <div className="welcome-helix">
            <div className="helix-glow"></div>
            <svg className="dna-helix" viewBox="0 0 80 120" width="80" height="120">
              <defs>
                {/* Main gradient for strands */}
                <linearGradient id="helixGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#7234ED" />
                  <stop offset="50%" stopColor="#4A5CE8" />
                  <stop offset="100%" stopColor="#0686D4" />
                </linearGradient>
                {/* Glow filter */}
                <filter id="helixGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Left strand - smooth ribbon curve */}
              <path
                className="helix-strand strand-left"
                d="M20,10 C35,20 45,25 45,35 C45,45 35,50 20,60 C5,70 5,75 20,85 C35,95 45,100 45,110"
                fill="none"
                stroke="url(#helixGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                filter="url(#helixGlow)"
              />

              {/* Right strand - smooth ribbon curve (offset) */}
              <path
                className="helix-strand strand-right"
                d="M60,10 C45,20 35,25 35,35 C35,45 45,50 60,60 C75,70 75,75 60,85 C45,95 35,100 35,110"
                fill="none"
                stroke="url(#helixGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                filter="url(#helixGlow)"
              />

              {/* Base pair connections (horizontal rungs) */}
              <g className="base-pairs">
                <line x1="25" y1="22" x2="55" y2="22" stroke="url(#helixGradient)" strokeWidth="2" opacity="0.6" />
                <line x1="20" y1="35" x2="60" y2="35" stroke="url(#helixGradient)" strokeWidth="2" opacity="0.7" />
                <line x1="25" y1="48" x2="55" y2="48" stroke="url(#helixGradient)" strokeWidth="2" opacity="0.6" />
                <line x1="20" y1="60" x2="60" y2="60" stroke="url(#helixGradient)" strokeWidth="2" opacity="0.7" />
                <line x1="25" y1="73" x2="55" y2="73" stroke="url(#helixGradient)" strokeWidth="2" opacity="0.6" />
                <line x1="20" y1="85" x2="60" y2="85" stroke="url(#helixGradient)" strokeWidth="2" opacity="0.7" />
                <line x1="25" y1="98" x2="55" y2="98" stroke="url(#helixGradient)" strokeWidth="2" opacity="0.6" />
              </g>

              {/* Data particles - small floating pixels */}
              <g className="data-particles">
                <rect className="particle p1" x="8" y="25" width="3" height="3" fill="#7234ED" rx="0.5" />
                <rect className="particle p2" x="70" y="45" width="2" height="2" fill="#0686D4" rx="0.3" />
                <rect className="particle p3" x="5" y="70" width="2.5" height="2.5" fill="#4A5CE8" rx="0.4" />
                <rect className="particle p4" x="72" y="80" width="3" height="3" fill="#7234ED" rx="0.5" />
                <rect className="particle p5" x="12" y="95" width="2" height="2" fill="#0686D4" rx="0.3" />
                <rect className="particle p6" x="65" y="15" width="2.5" height="2.5" fill="#4A5CE8" rx="0.4" />
                <rect className="particle p7" x="3" y="50" width="2" height="2" fill="#7234ED" rx="0.3" />
                <rect className="particle p8" x="75" y="60" width="2" height="2" fill="#0686D4" rx="0.3" />
              </g>
            </svg>
          </div>
          <h2>Welcome to Helix</h2>
          <p className="welcome-subtitle">Your AI consciousness companion</p>

          <div className="suggestions">
            <p className="suggestions-label">Try asking:</p>
            <div className="suggestion-grid">
              <button className="suggestion-btn">
                <span className="suggestion-icon">💡</span>
                <span>What can you help me with?</span>
              </button>
              <button className="suggestion-btn">
                <span className="suggestion-icon">🧠</span>
                <span>Tell me about your psychology layers</span>
              </button>
              <button className="suggestion-btn">
                <span className="suggestion-icon">🔧</span>
                <span>What tools do you have access to?</span>
              </button>
              <button className="suggestion-btn">
                <span className="suggestion-icon">📋</span>
                <span>Help me organize my tasks</span>
              </button>
            </div>
          </div>

          <div className="keyboard-hints">
            <span><kbd>/</kbd> for commands</span>
            <span><kbd>!</kbd> for bash</span>
            <span><kbd>Ctrl+G</kbd> agents</span>
            <span><kbd>Ctrl+L</kbd> models</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <div key={message.id} className="message-group">
          <MessageBubble
            role={message.role}
            content={message.content}
            thinking={message.thinking}
            showThinking={showThinking}
            timestamp={message.timestamp}
            isStreaming={message.isStreaming}
          />
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="message-tools">
              {message.toolCalls.map((tool) => (
                <ToolExecution key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Streaming content */}
      {(streamingContent || isStreaming) && (
        <div className="message-group streaming-message">
          <MessageBubble
            role="assistant"
            content={streamingContent || ''}
            thinking={thinking || undefined}
            showThinking={showThinking}
            isStreaming={isStreaming}
          />
          {pendingTools.length > 0 && (
            <div className="message-tools">
              {pendingTools.map((tool) => (
                <ToolExecution key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Thinking indicator when no streaming content yet */}
      {thinking && !streamingContent && !isStreaming && (
        <div className="thinking-indicator">
          <div className="thinking-spinner" />
          <span className="thinking-label">Thinking...</span>
          {thinking !== 'Thinking...' && (
            <span className="thinking-text">{thinking}</span>
          )}
        </div>
      )}
    </div>
  );
}
