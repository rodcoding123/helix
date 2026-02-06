/**
 * DesktopChat (Refactored) - Using Supabase Backend
 *
 * Refactored desktop chat component that uses the new Supabase backend
 * instead of the gateway WebSocket client.
 *
 * Features:
 * - Real-time message sync across platforms
 * - Offline support with automatic queueing
 * - Helix personality context loading
 * - Session persistence
 */

import React, { useEffect, useRef, useState } from 'react';
import { useSupabaseChat } from '../../hooks/useSupabaseChat';

// ============================================================================
// Component
// ============================================================================

export function DesktopChatRefactored() {
  const {
    // State
    currentSessionKey,
    conversation,
    messages,
    isLoadingMessages,
    messageError,
    conversations,
    isLoadingConversations,
    syncStatus,
    helixContext,
    isLoadingContext,

    // Actions
    selectConversation,
    createConversation,
    sendMessage,
    disconnect,
  } = useSupabaseChat();

  // Local state
  const [input, setInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);
  const isUserScrollingRef = useRef(false);

  // ==========================================
  // Scroll Management (Fixed Auto-Scroll Bug)
  // ==========================================

  // Detect if user scrolled away from bottom
  useEffect(() => {
    const container = document.querySelector('.messages-container');
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom =
        Math.abs(
          container.scrollHeight - container.scrollTop - container.clientHeight
        ) < 10;
      isUserScrollingRef.current = !isAtBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll only when message count increases AND user at bottom
  useEffect(() => {
    const messageCountIncreased = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (messageCountIncreased && !isUserScrollingRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ==========================================
  // Session Management
  // ==========================================

  const handleSelectConversation = async (sessionKey: string) => {
    setSelectedIndex(conversations.findIndex((c) => c.session_key === sessionKey));
    await selectConversation(sessionKey);
  };

  const handleNewConversation = async () => {
    const title = `Conversation ${conversations.length + 1}`;
    await createConversation(title);
  };

  // ==========================================
  // Message Handling
  // ==========================================

  const handleSendMessage = async () => {
    if (!input.trim() || !currentSessionKey) return;

    const content = input.trim();
    setInput(''); // Clear immediately for UX

    await sendMessage(content);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  // ==========================================
  // Cleanup
  // ==========================================

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className="desktop-chat">
      {/* Offline Banner */}
      {!syncStatus.isOnline && (
        <div className="offline-banner">
          <span>⚠️ Offline</span>
          {syncStatus.queueLength > 0 && <span> • {syncStatus.queueLength} message(s) queued</span>}
        </div>
      )}

      {/* Sync Indicator */}
      {syncStatus.isSyncing && (
        <div className="sync-indicator">
          <span className="spinner">⟳</span>
          <span>Syncing {syncStatus.queueLength} message(s)...</span>
        </div>
      )}

      <div className="chat-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Conversations</h2>
            <button
              className="btn-new-chat"
              onClick={handleNewConversation}
              disabled={isLoadingConversations}
            >
              + New Chat
            </button>
          </div>

          <div className="conversations-list">
            {isLoadingConversations ? (
              <div className="placeholder">Loading conversations...</div>
            ) : conversations.length === 0 ? (
              <div className="placeholder">No conversations yet</div>
            ) : (
              conversations.map((conv, idx) => (
                <div
                  key={conv.session_key}
                  className={`conversation-item ${
                    selectedIndex === idx ? 'active' : ''
                  }`}
                  onClick={() => handleSelectConversation(conv.session_key)}
                >
                  <div className="title">{conv.title || 'Untitled'}</div>
                  <div className="meta">
                    {new Date(conv.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <main className="chat-area">
          {!conversation ? (
            <div className="empty-state">
              <h3>Select a conversation or create a new one</h3>
              <button onClick={handleNewConversation}>Start New Conversation</button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="chat-header">
                <h3>{conversation.title || 'Untitled'}</h3>
                {isLoadingContext && <span className="loading">Loading context...</span>}
                {helixContext.length > 0 && (
                  <span className="context-loaded">
                    ✓ {helixContext.length} context items loaded
                  </span>
                )}
              </div>

              {/* Messages */}
              <div className="messages-container">
                {isLoadingMessages ? (
                  <div className="placeholder">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="placeholder">Start a conversation...</div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`message ${msg.role}`}
                        data-optimistic={(msg.metadata as any)?.optimistic ? 'true' : undefined}
                      >
                        <div className="message-content">{msg.content}</div>
                        <div className="message-meta">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input Area */}
              <div className="input-area">
                {messageError && <div className="error-banner">{messageError}</div>}

                <textarea
                  className="input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message... (Shift+Enter for new line)"
                  disabled={!conversation}
                />

                <button
                  className="btn-send"
                  onClick={handleSendMessage}
                  disabled={!input.trim() || !conversation}
                >
                  Send
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// Styles (TailwindCSS/CSS Modules - adapt as needed)
// ============================================================================

export const styles = `
.desktop-chat {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a1a;
  color: #fff;
}

.offline-banner {
  padding: 8px 16px;
  background: #cc3300;
  color: white;
  font-size: 14px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.sync-indicator {
  padding: 8px 16px;
  background: #1f40af;
  color: white;
  font-size: 14px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.sync-indicator .spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.chat-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 0;
}

.sidebar {
  width: 320px;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  background: #0d0d0d;
  overflow: hidden;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.btn-new-chat {
  padding: 6px 12px;
  background: #1f40af;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.btn-new-chat:hover {
  background: #2a52d1;
}

.btn-new-chat:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.conversations-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.conversation-item {
  padding: 12px;
  margin: 4px 0;
  background: #1a1a1a;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.conversation-item:hover {
  background: #2a2a2a;
}

.conversation-item.active {
  background: #1f40af;
}

.conversation-item .title {
  font-weight: 500;
  margin-bottom: 4px;
}

.conversation-item .meta {
  font-size: 12px;
  opacity: 0.7;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  padding: 16px;
  border-bottom: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.loading {
  font-size: 12px;
  opacity: 0.7;
}

.context-loaded {
  font-size: 12px;
  color: #4a9eff;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  font-size: 14px;
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 80%;
  padding: 12px;
  border-radius: 8px;
  line-height: 1.4;
}

.message.user {
  align-self: flex-end;
  background: #1f40af;
  color: white;
}

.message.assistant {
  align-self: flex-start;
  background: #2a2a2a;
  color: #e0e0e0;
}

.message[data-optimistic="true"] {
  opacity: 0.7;
}

.message-content {
  word-wrap: break-word;
  margin: 0;
}

.message-meta {
  font-size: 11px;
  opacity: 0.6;
  margin-top: 4px;
}

.input-area {
  padding: 16px;
  border-top: 1px solid #333;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-banner {
  padding: 8px 12px;
  background: #cc3300;
  color: white;
  font-size: 12px;
  border-radius: 4px;
}

.input {
  flex: 1;
  padding: 12px;
  background: #1a1a1a;
  border: 1px solid #333;
  color: white;
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  resize: none;
  min-height: 60px;
  max-height: 120px;
}

.input:focus {
  outline: none;
  border-color: #1f40af;
  box-shadow: 0 0 0 2px rgba(31, 64, 175, 0.1);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-send {
  padding: 10px 16px;
  background: #1f40af;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  align-self: flex-end;
}

.btn-send:hover {
  background: #2a52d1;
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.empty-state h3 {
  color: #666;
  font-size: 16px;
  margin: 0;
}
`;
