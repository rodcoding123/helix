/**
 * Chat Page - Web MVP
 * Basic chat interface for interacting with Claude (localStorage-based)
 * Platform: Web
 * Tier: Free + Starter (basic chat, no real-time voice)
 */

import { useEffect, useState, useRef } from 'react';
import { loadChatHistory, sendChatMessage } from '../services/chat';
import '../styles/pages/chat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokenCount?: number;
}

const SESSION_KEY = 'web-mvp-session';

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load session history on mount
  useEffect(() => {
    const history = loadChatHistory(SESSION_KEY);
    setMessages(history);
  }, []);

  async function handleSendMessage(content: string) {
    if (!content.trim() || isLoading) return;

    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendChatMessage(content, SESSION_KEY);

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }

      // Reload messages from localStorage (they were saved by sendChatMessage)
      const updated = loadChatHistory(SESSION_KEY);
      setMessages(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="chat-page">
      <div className="chat-header">
        <h1>Helix Chat</h1>
        <p className="chat-subtitle">Have a conversation with Claude</p>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <h2>Start a conversation</h2>
            <p>Ask me anything. I remember our conversation.</p>
            <div className="chat-suggestions">
              <button onClick={() => handleSendMessage('What can you help me with?')}>
                What can you help me with?
              </button>
              <button onClick={() => handleSendMessage('Tell me about yourself')}>
                Tell me about yourself
              </button>
              <button onClick={() => handleSendMessage('How does Helix work?')}>
                How does Helix work?
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`message message-${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <p>{msg.content}</p>
                  {msg.tokenCount && (
                    <span className="message-tokens">{msg.tokenCount} tokens</span>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message message-assistant">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {error && (
        <div className="chat-error">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="chat-input-area">
        <form onSubmit={e => {
          e.preventDefault();
          handleSendMessage(input);
        }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            maxLength={1000}
            autoFocus
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="chat-send-button"
          >
            Send
          </button>
        </form>
        <p className="chat-disclaimer">
          Helix remembers our conversation. She'll reference what you share.
        </p>
      </div>
    </div>
  );
}
