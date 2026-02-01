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
          <div className="welcome-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
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
