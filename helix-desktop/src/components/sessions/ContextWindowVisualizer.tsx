/**
 * Context Window Visualizer
 *
 * Real-time visualization of session context window with token annotations
 * Phase G.4 - Context Visualization & Integration
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';

interface ContextMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tokens: number;
  timestamp: string;
}

interface ContextWindowData {
  sessionKey: string;
  totalTokens: number;
  maxTokens: number;
  percentageUsed: number;
  messages: ContextMessage[];
}

export function ContextWindowVisualizer({ sessionKey }: { sessionKey?: string }) {
  const { getClient, connected } = useGateway();
  const [contextData, setContextData] = useState<ContextWindowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'chronological' | 'size'>('chronological');

  useEffect(() => {
    if (sessionKey && connected) {
      loadContextWindow();
      const interval = setInterval(loadContextWindow, 5000); // Refresh every 5s
      return () => clearInterval(interval);
    }
  }, [sessionKey, connected]);

  const loadContextWindow = useCallback(async () => {
    if (!sessionKey) return;

    try {
      const client = getClient();
      if (!client?.connected) {
        setLoading(false);
        return;
      }

      // Fetch chat history for context breakdown
      const historyResult = (await client.request('chat.history', {
        sessionKey,
        limit: 100,
      })) as any;

      if (historyResult?.messages) {
        // Estimate tokens for each message
        const messages: ContextMessage[] = historyResult.messages.map((msg: any) => ({
          id: msg.id || `msg-${Math.random().toString(36).slice(7)}`,
          role: msg.role || 'user',
          content: msg.content || '',
          tokens: Math.ceil((msg.content?.length || 0) / 4), // 4 chars ≈ 1 token
          timestamp: msg.timestamp || new Date().toISOString(),
        }));

        const totalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0);
        const maxTokens = 100000; // Default context window

        setContextData({
          sessionKey,
          totalTokens,
          maxTokens,
          percentageUsed: totalTokens / maxTokens,
          messages,
        });
      }
    } catch (err) {
      console.error('Failed to load context window:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionKey, getClient]);

  const sortedMessages = useMemo(() => {
    if (!contextData) return [];

    const messages = [...contextData.messages];
    if (sortBy === 'size') {
      messages.sort((a, b) => b.tokens - a.tokens);
    }
    return messages;
  }, [contextData, sortBy]);

  const toggleMessage = (messageId: string) => {
    const newSet = new Set(expandedMessages);
    if (newSet.has(messageId)) {
      newSet.delete(messageId);
    } else {
      newSet.add(messageId);
    }
    setExpandedMessages(newSet);
  };

  const roleColors: Record<string, string> = {
    user: '#818cf8',
    assistant: '#10b981',
    system: '#f59e0b',
    tool: '#06b6d4',
  };

  if (loading) {
    return <div className="context-visualizer loading">Loading context window...</div>;
  }

  if (!contextData) {
    return <div className="context-visualizer empty">No session selected</div>;
  }

  const warningLevel = contextData.percentageUsed > 0.9 ? 'critical' : contextData.percentageUsed > 0.7 ? 'warning' : 'normal';

  return (
    <div className="context-visualizer">
      <style>{contextVisualizerStyles}</style>

      {/* Header */}
      <div className="visualizer-header">
        <h3>Context Window</h3>
        <span className="session-badge">{sessionKey}</span>
      </div>

      {/* Usage Summary */}
      <div className="usage-summary">
        <div className="summary-card">
          <div className="summary-icon">📊</div>
          <div className="summary-content">
            <div className="summary-label">Used</div>
            <div className="summary-value">{contextData.totalTokens.toLocaleString()}</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">📈</div>
          <div className="summary-content">
            <div className="summary-label">Capacity</div>
            <div className="summary-value">{contextData.maxTokens.toLocaleString()}</div>
          </div>
        </div>

        <div className={`summary-card usage-level-${warningLevel}`}>
          <div className="summary-icon">⚠️</div>
          <div className="summary-content">
            <div className="summary-label">Usage</div>
            <div className="summary-value">{Math.round(contextData.percentageUsed * 100)}%</div>
          </div>
        </div>
      </div>

      {/* Context Bar */}
      <div className="context-bar-section">
        <div className="context-bar">
          {sortedMessages.map((msg) => (
            <div
              key={msg.id}
              className="context-segment"
              style={{
                width: `${(msg.tokens / contextData.maxTokens) * 100}%`,
                backgroundColor: roleColors[msg.role],
              }}
              title={`${msg.role}: ${msg.tokens} tokens`}
              onClick={() => toggleMessage(msg.id)}
            />
          ))}
        </div>
        <div className="context-labels">
          <span>Used: {contextData.totalTokens}</span>
          <span>Available: {contextData.maxTokens - contextData.totalTokens}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="controls-section">
        <label className="sort-control">
          Sort by:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="chronological">Chronological</option>
            <option value="size">Token Count (Large to Small)</option>
          </select>
        </label>
      </div>

      {/* Messages Timeline */}
      <div className="messages-timeline">
        <div className="timeline-header">
          <h4>Messages ({sortedMessages.length})</h4>
          <span className="total-tokens">{contextData.totalTokens.toLocaleString()} tokens</span>
        </div>

        <div className="messages-list">
          {sortedMessages.map((msg) => (
            <div
              key={msg.id}
              className={`message-item role-${msg.role} ${expandedMessages.has(msg.id) ? 'expanded' : ''}`}
            >
              <div
                className="message-header"
                onClick={() => toggleMessage(msg.id)}
              >
                <div className="message-meta">
                  <span
                    className="role-badge"
                    style={{ backgroundColor: roleColors[msg.role] }}
                  >
                    {msg.role.toUpperCase()}
                  </span>
                  <span className="timestamp">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="message-stats">
                  <span className="token-count">{msg.tokens} tokens</span>
                  <span className="percentage">
                    {((msg.tokens / contextData.maxTokens) * 100).toFixed(1)}%
                  </span>
                  <span className="expand-icon">
                    {expandedMessages.has(msg.id) ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {expandedMessages.has(msg.id) && (
                <div className="message-content">
                  <p>{msg.content.substring(0, 500)}</p>
                  {msg.content.length > 500 && (
                    <p className="truncated">... ({msg.content.length - 500} more characters)</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Warning Box */}
      {warningLevel === 'critical' && (
        <div className="warning-box critical">
          <strong>🚨 Critical:</strong> Context window nearly full. Consider compacting the session soon.
        </div>
      )}
      {warningLevel === 'warning' && (
        <div className="warning-box warning">
          <strong>⚠️ Warning:</strong> Context window at {Math.round(contextData.percentageUsed * 100)}%. May want to compact soon.
        </div>
      )}

      {/* Legend */}
      <div className="legend">
        <div className="legend-title">Message Types</div>
        <div className="legend-items">
          {Object.entries(roleColors).map(([role, color]) => (
            <div key={role} className="legend-item">
              <span
                className="legend-color"
                style={{ backgroundColor: color }}
              />
              <span className="legend-label">{role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const contextVisualizerStyles = `
.context-visualizer {
  padding: 1.5rem;
  background: var(--bg-primary, #0a0a1a);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.context-visualizer.loading,
.context-visualizer.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-tertiary, #606080);
}

.visualizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.visualizer-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.session-badge {
  padding: 0.25rem 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 4px;
  font-size: 0.75rem;
  color: #818cf8;
  font-family: monospace;
}

.usage-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
}

.summary-card.usage-level-warning {
  background: rgba(245, 158, 11, 0.04);
  border-color: rgba(245, 158, 11, 0.15);
}

.summary-card.usage-level-critical {
  background: rgba(239, 68, 68, 0.04);
  border-color: rgba(239, 68, 68, 0.15);
}

.summary-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.summary-content {
  flex: 1;
}

.summary-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.25rem;
}

.summary-value {
  font-size: 1rem;
  font-weight: 600;
  color: #818cf8;
}

.usage-level-warning .summary-value {
  color: #f59e0b;
}

.usage-level-critical .summary-value {
  color: #ef4444;
}

.context-bar-section {
  margin-bottom: 1.5rem;
}

.context-bar {
  display: flex;
  height: 40px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.context-segment {
  min-width: 2px;
  cursor: pointer;
  transition: opacity 0.2s ease;
  opacity: 0.8;
}

.context-segment:hover {
  opacity: 1;
}

.context-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.controls-section {
  margin-bottom: 1.5rem;
  display: flex;
  gap: 1rem;
}

.sort-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.sort-control select {
  padding: 0.5rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  cursor: pointer;
}

.messages-timeline {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  max-height: 500px;
  overflow-y: auto;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.timeline-header h4 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.total-tokens {
  font-size: 0.75rem;
  color: #818cf8;
  font-weight: 600;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message-item {
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 6px;
  overflow: hidden;
}

.message-item.expanded {
  border-color: rgba(99, 102, 241, 0.3);
  background: rgba(99, 102, 241, 0.08);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.message-header:hover {
  background: rgba(255, 255, 255, 0.02);
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.role-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.6rem;
  font-weight: 600;
  color: #fff;
}

.timestamp {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.message-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.75rem;
}

.token-count {
  color: #818cf8;
  font-weight: 600;
}

.percentage {
  color: var(--text-tertiary, #606080);
}

.expand-icon {
  color: var(--text-tertiary, #606080);
  width: 1rem;
  text-align: center;
}

.message-content {
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.message-content p {
  margin: 0;
  color: var(--text-secondary, #a0a0c0);
}

.message-content .truncated {
  color: var(--text-tertiary, #606080);
  font-style: italic;
  margin-top: 0.5rem;
}

.warning-box {
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.8125rem;
}

.warning-box.warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: #fcd34d;
}

.warning-box.warning strong {
  color: #fcd34d;
}

.warning-box.critical {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.warning-box.critical strong {
  color: #fca5a5;
}

.legend {
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 6px;
}

.legend-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.75rem;
}

.legend-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.75rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-label {
  color: var(--text-secondary, #a0a0c0);
}
`;
