/**
 * Message Timeline
 *
 * Virtualized message timeline for context window visualization
 * Phase G.4 - Context Visualization & Integration
 */

import { useState, useCallback } from 'react';

interface TimelineMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tokens: number;
  timestamp: string;
  modelUsed?: string;
  toolCalls?: Array<{ tool: string; args: string }>;
}

interface MessageTimelineProps {
  messages: TimelineMessage[];
  selectedMessageId?: string;
  onSelectMessage?: (messageId: string) => void;
}

export function MessageTimeline({
  messages,
  selectedMessageId,
  onSelectMessage,
}: MessageTimelineProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const toggleMessage = useCallback((messageId: string) => {
    const newSet = new Set(expandedMessages);
    if (newSet.has(messageId)) {
      newSet.delete(messageId);
    } else {
      newSet.add(messageId);
    }
    setExpandedMessages(newSet);
  }, [expandedMessages]);

  const roleEmoji: Record<string, string> = {
    user: '👤',
    assistant: '🤖',
    system: '⚙️',
    tool: '🔧',
  };

  const roleColors: Record<string, string> = {
    user: '#818cf8',
    assistant: '#10b981',
    system: '#f59e0b',
    tool: '#06b6d4',
  };

  return (
    <div className="message-timeline">
      <style>{messageTimelineStyles}</style>

      <div className="timeline-container">
        {messages.length === 0 ? (
          <div className="empty-timeline">
            <p>No messages in timeline</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={`timeline-item role-${message.role} ${
                selectedMessageId === message.id ? 'selected' : ''
              } ${expandedMessages.has(message.id) ? 'expanded' : ''}`}
              onClick={() => {
                toggleMessage(message.id);
                onSelectMessage?.(message.id);
              }}
            >
              {/* Timeline Dot and Connector */}
              <div className="timeline-marker">
                <div className="dot" style={{ backgroundColor: roleColors[message.role] }} />
                {index < messages.length - 1 && <div className="connector" />}
              </div>

              {/* Message Card */}
              <div className="message-card">
                {/* Header */}
                <div className="message-header">
                  <div className="header-left">
                    <span className="role-emoji">{roleEmoji[message.role]}</span>
                    <span className="role-label">{message.role.toUpperCase()}</span>
                    <span className="timestamp">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="header-right">
                    <span className="token-count">{message.tokens} tokens</span>
                    {message.modelUsed && (
                      <span className="model-badge">{message.modelUsed}</span>
                    )}
                    <span className="expand-icon">
                      {expandedMessages.has(message.id) ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {/* Preview */}
                <div className="message-preview">
                  <p>{message.content.substring(0, 150)}</p>
                  {message.content.length > 150 && <span className="truncated">...</span>}
                </div>

                {/* Expanded Content */}
                {expandedMessages.has(message.id) && (
                  <div className="message-expanded">
                    <div className="full-content">
                      <p>{message.content}</p>
                    </div>

                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="tool-calls">
                        <strong>Tool Calls:</strong>
                        {message.toolCalls.map((call, idx) => (
                          <div key={idx} className="tool-call">
                            <span className="tool-name">{call.tool}</span>
                            <code>{call.args}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const messageTimelineStyles = `
.message-timeline {
  padding: 1.5rem;
  background: var(--bg-primary, #0a0a1a);
  border-radius: 12px;
}

.timeline-container {
  position: relative;
}

.empty-timeline {
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary, #606080);
}

.timeline-item {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  cursor: pointer;
}

.timeline-marker {
  position: relative;
  width: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  z-index: 2;
  transition: all 0.2s ease;
}

.timeline-item:hover .dot {
  width: 16px;
  height: 16px;
  box-shadow: 0 0 8px currentColor;
}

.connector {
  position: absolute;
  width: 2px;
  flex: 1;
  background: rgba(99, 102, 241, 0.2);
  top: 20px;
  bottom: -20px;
}

.message-card {
  flex: 1;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.timeline-item:hover .message-card {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.25);
}

.timeline-item.selected .message-card {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.4);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.role-emoji {
  font-size: 1.25rem;
}

.role-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary, #a0a0c0);
}

.timestamp {
  font-size: 0.7rem;
  color: var(--text-tertiary, #606080);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.token-count {
  font-size: 0.75rem;
  color: #818cf8;
  font-weight: 600;
}

.model-badge {
  padding: 0.25rem 0.5rem;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 3px;
  font-size: 0.65rem;
  color: #818cf8;
}

.expand-icon {
  color: var(--text-tertiary, #606080);
  width: 1rem;
  text-align: center;
  transition: transform 0.2s ease;
}

.timeline-item.expanded .expand-icon {
  transform: rotate(0deg);
}

.message-preview {
  padding: 0.75rem 1rem;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.message-preview p {
  margin: 0;
}

.truncated {
  color: var(--text-tertiary, #606080);
}

.message-expanded {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.1);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.full-content {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  border-left: 3px solid rgba(99, 102, 241, 0.3);
}

.full-content p {
  margin: 0;
  color: var(--text-primary, #fff);
  font-size: 0.8125rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.tool-calls {
  font-size: 0.8125rem;
}

.tool-calls strong {
  color: var(--text-secondary, #a0a0c0);
  display: block;
  margin-bottom: 0.5rem;
}

.tool-call {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: rgba(6, 182, 212, 0.05);
  border: 1px solid rgba(6, 182, 212, 0.15);
  border-radius: 3px;
}

.tool-name {
  display: block;
  color: #06b6d4;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.tool-call code {
  display: block;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.5rem;
  border-radius: 3px;
  color: #818cf8;
  font-size: 0.75rem;
  overflow-x: auto;
}

/* Responsive */
@media (max-width: 640px) {
  .timeline-item {
    gap: 0.75rem;
  }

  .message-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
  }
}
`;
