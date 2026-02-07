/**
 * Desktop Chat with Supabase Integration
 *
 * Refactored chat interface using Supabase backend instead of OpenClaw gateway.
 * Features:
 * - Real-time message sync with Supabase
 * - Offline support with automatic message queueing
 * - Multi-session management
 * - Helix context loading
 * - Cross-platform conversation continuity
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSupabaseChat } from '../../hooks/useSupabaseChat.js';
import { getOfflineSyncQueueSync } from '../../lib/offline-sync-queue.js';
import { ChatHeader } from './ChatHeader.js';
import { ChatStatusBar, type ActivityStatus } from './ChatStatusBar.js';
import { MessageList, type Message } from './MessageList.js';
import { ChatInput } from './ChatInput.js';
import { type ToolExecutionData } from './ToolExecution.js';
import './ChatInterface.css';

interface SessionInfo {
  key: string;
  name?: string;
  messageCount?: number;
  createdAt?: string;
}

interface ModelInfo {
  provider: string;
  model: string;
}

export function DesktopChatSupabase() {
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
    loadMessages,
    syncNow,
    disconnect,
  } = useSupabaseChat();

  const [inputValue, setInputValue] = useState('');
  const [activityStatus, setActivityStatus] = useState<ActivityStatus>('idle');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [modelInfo] = useState<ModelInfo>({
    provider: 'anthropic',
    model: 'claude-opus-4-6',
  });
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const syncQueue = getOfflineSyncQueueSync();

  // Convert hook messages to display format
  const displayMessages: Message[] = messages.map((msg: any) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
  })) || [];

  // Update session info when conversation changes
  useEffect(() => {
    if (conversation) {
      setSessionInfo({
        key: conversation.session_key,
        name: conversation.title || 'Untitled',
        messageCount: messages.length,
        createdAt: conversation.created_at,
      });
    }
  }, [conversation, messages]);

  // Update activity status based on sync and loading states
  useEffect(() => {
    if (isLoadingMessages) {
      setActivityStatus('waiting');
    } else if (isLoadingContext) {
      setActivityStatus('thinking');
    } else if (syncStatus.isSyncing) {
      setActivityStatus('streaming');
    } else if (!syncStatus.isOnline) {
      setActivityStatus('disconnected');
    } else if (isSending) {
      setActivityStatus('sending');
    } else {
      setActivityStatus('idle');
    }
  }, [isLoadingMessages, isLoadingContext, syncStatus, isSending]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, streamingContent]);

  // Create new conversation on mount if none selected
  useEffect(() => {
    if (!currentSessionKey && conversations.length === 0) {
      createConversation('New Chat').catch((err) => {
        console.error('Failed to create initial conversation:', err);
      });
    }
  }, [currentSessionKey, conversations.length, createConversation]);

  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || !currentSessionKey || !syncStatus.isOnline) {
      return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    setStreamingContent('');
    setIsSending(true);

    try {
      await sendMessage(userMessage);

      // Message was sent (may be pending if offline)
      // The message will appear in the UI when synced
      if (!syncStatus.isOnline) {
        setActivityStatus('disconnected');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Keep message in input on error
      setInputValue(userMessage);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, currentSessionKey, sendMessage, syncStatus.isOnline]);

  const handleCommand = useCallback((command: string, args: string) => {
    setInputValue('');

    switch (command) {
      case 'help':
        console.log('Available commands:');
        console.log('  /help                - Show this help message');
        console.log('  /clear               - Clear current conversation');
        console.log('  /new, /reset         - Start a new conversation');
        console.log('  /sync                - Force sync with server');
        console.log('  /status              - Show sync status');
        console.log('  /sessions            - Toggle session list');
        break;

      case 'clear':
        if (currentSessionKey && displayMessages.length > 0) {
          if (window.confirm('Are you sure you want to clear this conversation? This cannot be undone.')) {
            createConversation('New Chat').catch((err) => {
              console.error('Failed to clear conversation:', err);
            });
          }
        } else {
          console.log('Nothing to clear.');
        }
        break;

      case 'new':
      case 'reset':
        createConversation('New Chat').catch((err) => {
          console.error('Failed to create conversation:', err);
        });
        break;

      case 'sync':
        syncNow().catch((err) => {
          console.error('Failed to sync:', err);
        });
        break;

      case 'status':
        console.log('Sync Status:', {
          isOnline: syncStatus.isOnline,
          queueLength: syncStatus.queueLength,
          isSyncing: syncStatus.isSyncing,
          failedCount: syncStatus.failedCount,
        });
        break;

      case 'sessions':
        setShowSessionList(!showSessionList);
        break;

      default:
        console.log(`Unknown command: ${command}`);
    }
  }, [createConversation, syncNow, syncStatus, showSessionList]);

  const handleNewSession = useCallback(() => {
    createConversation('New Chat').catch((err) => {
      console.error('Failed to create conversation:', err);
    });
  }, [createConversation]);

  const handleSelectSession = useCallback(
    async (sessionKey: string) => {
      try {
        await selectConversation(sessionKey);
        setShowSessionList(false);
      } catch (err) {
        console.error('Failed to select conversation:', err);
      }
    },
    [selectConversation]
  );

  const handleSync = useCallback(() => {
    syncNow().catch((err) => {
      console.error('Failed to sync:', err);
    });
  }, [syncNow]);

  const isStreaming = ['sending', 'waiting', 'streaming', 'thinking'].includes(activityStatus);
  const showDisconnectedBanner = !syncStatus.isOnline;
  const canSendMessage = syncStatus.isOnline || true; // Allow queuing offline messages

  return (
    <div className="chat-interface">
      <ChatHeader
        session={sessionInfo}
        model={modelInfo}
        connected={syncStatus.isOnline}
        onNewSession={handleNewSession}
      />

      {/* Session list sidebar */}
      {showSessionList && (
        <div className="session-list-panel">
          <div className="session-list-header">
            <h3>Conversations</h3>
            <button onClick={() => setShowSessionList(false)} className="close-btn">
              ✕
            </button>
          </div>

          <button
            className="new-session-btn"
            onClick={handleNewSession}
            disabled={isLoadingConversations}
          >
            + New Chat
          </button>

          <div className="session-list">
            {isLoadingConversations ? (
              <div className="loading">Loading conversations...</div>
            ) : conversations.length === 0 ? (
              <div className="empty">No conversations yet</div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.session_key}
                  className={`session-item ${conv.session_key === currentSessionKey ? 'active' : ''}`}
                  onClick={() => handleSelectSession(conv.session_key)}
                >
                  <div className="session-title">{conv.title || 'Untitled'}</div>
                  <div className="session-date">
                    {conv.created_at ? new Date(conv.created_at).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Offline banner */}
      {showDisconnectedBanner && (
        <div className="disconnected-banner">
          <span className="disconnected-icon">⚠️</span>
          <span className="disconnected-text">Offline Mode</span>
          <span className="disconnected-hint">
            {syncStatus.queueLength > 0
              ? `${syncStatus.queueLength} message(s) queued`
              : 'Messages will sync when online'}
          </span>
          {syncStatus.queueLength > 0 && (
            <button className="sync-btn" onClick={handleSync}>
              Sync Now
            </button>
          )}
        </div>
      )}

      {/* Messages area */}
      <div className="chat-messages">
        {isLoadingMessages && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading conversation...</p>
          </div>
        )}

        {messageError && (
          <div className="error-message">
            <p>Error loading messages: {messageError}</p>
            <button onClick={() => loadMessages(currentSessionKey || '')}>Retry</button>
          </div>
        )}

        <MessageList
          messages={displayMessages}
          thinking={isLoadingContext ? 'Loading context...' : undefined}
          isStreaming={isStreaming}
          showThinking={isLoadingContext}
          streamingContent={streamingContent}
        />

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-container">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          onCommand={handleCommand}
          isStreaming={isStreaming}
          disabled={!canSendMessage || isLoadingMessages}
          placeholder={
            !syncStatus.isOnline
              ? 'Offline - messages will be queued...'
              : 'Type a message...'
          }
        />
      </div>

      {/* Status bar */}
      <ChatStatusBar
        status={activityStatus}
        modelName={modelInfo.model}
        startTime={undefined}
      />

      {/* Helix Context Loading */}
      {isLoadingContext && (
        <div className="context-loading">
          <p>Loading Helix context...</p>
        </div>
      )}
    </div>
  );
}
