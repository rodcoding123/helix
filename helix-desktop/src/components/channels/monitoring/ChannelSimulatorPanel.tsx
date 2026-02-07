/**
 * Channel Simulator Panel - Test messages without live channels
 *
 * Features:
 * - Send test messages to agents
 * - Simulate different message types
 * - View test results and responses
 */

import { useState, useCallback } from 'react';
import { useGateway } from '../../../hooks/useGateway';
import './channel-simulator-panel.css';

export interface ChannelSimulatorPanelProps {
  channel: string;
  onTestComplete?: () => void;
}

interface SimulatorSession {
  sessionId: string;
  createdAt: number;
  messages: Array<{
    type: 'sent' | 'received';
    content: string;
    timestamp: number;
  }>;
}

export function ChannelSimulatorPanel({ channel, onTestComplete }: ChannelSimulatorPanelProps) {
  const { getClient } = useGateway();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<SimulatorSession['messages']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start session
  const startSession = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      setError('Gateway not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = (await client.request('channels.simulator.start_session', {
        channel,
      })) as {
        ok?: boolean;
        session?: { sessionId: string };
      };

      if (result.session?.sessionId) {
        setSessionId(result.session.sessionId);
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setLoading(false);
    }
  }, [channel, getClient]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!messageInput.trim() || !sessionId) {
      return;
    }

    const client = getClient();
    if (!client?.connected) {
      setError('Gateway not connected');
      return;
    }

    setLoading(true);
    setError(null);

    // Add to UI immediately
    setMessages((prev) => [
      ...prev,
      {
        type: 'sent',
        content: messageInput,
        timestamp: Date.now(),
      },
    ]);

    try {
      const result = (await client.request('channels.simulator.send_message', {
        sessionId,
        message: {
          type: 'text',
          content: messageInput,
          from: `test-${channel}`,
          timestamp: Date.now(),
        },
      })) as {
        ok?: boolean;
        result?: {
          response?: string;
          handled: boolean;
        };
      };

      if (result.result?.response) {
        setMessages((prev) => [
          ...prev,
          {
            type: 'received',
            content: result.result?.response || 'No response',
            timestamp: Date.now(),
          },
        ]);
      }

      setMessageInput('');
      onTestComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove the sent message if error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [messageInput, sessionId, channel, getClient, onTestComplete]);

  // End session
  const endSession = useCallback(async () => {
    if (!sessionId) return;

    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('channels.simulator.end_session', {
        sessionId,
      });
      setSessionId(null);
      setMessages([]);
    } catch (err) {
      console.error('[simulator] Failed to end session:', err);
    }
  }, [sessionId, getClient]);

  return (
    <div className="csp-container">
      {!sessionId ? (
        <div className="csp-start">
          <h3>Channel Simulator</h3>
          <p className="csp-description">
            Start a test session to send simulated messages without affecting live channels.
          </p>
          <button
            className="csp-start-btn"
            onClick={startSession}
            disabled={loading}
          >
            {loading ? 'Starting...' : 'Start Test Session'}
          </button>
        </div>
      ) : (
        <div className="csp-session">
          <div className="csp-session-header">
            <div>
              <h3>Test Session Active</h3>
              <div className="csp-session-id">{channel}</div>
            </div>
            <button
              className="csp-end-btn"
              onClick={endSession}
              disabled={loading}
            >
              End Session
            </button>
          </div>

          {/* Messages */}
          <div className="csp-messages">
            {messages.length === 0 ? (
              <div className="csp-messages-empty">
                <p>No messages yet. Send a test message below.</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={`msg-${idx}`}
                  className={`csp-message csp-message-${msg.type}`}
                >
                  <div className="csp-message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="csp-message-content">{msg.content}</div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          {error && (
            <div className="csp-error">
              <span>{error}</span>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          <div className="csp-input-group">
            <textarea
              className="csp-input"
              placeholder="Enter test message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={loading}
              rows={3}
            />
            <button
              className="csp-send-btn"
              onClick={sendMessage}
              disabled={loading || !messageInput.trim()}
            >
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
