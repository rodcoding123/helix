import { useCallback, useEffect } from 'react';
import { useChatStore, type ChatSession } from '../stores/chatStore';
import { useSessionStore } from '../stores/sessionStore';

/**
 * Hook for managing chat sessions
 * Combines chat store session management with gateway session state
 */
export function useSession() {
  const {
    currentSessionId,
    sessions,
    createSession,
    selectSession,
    deleteSession,
    renameSession,
    getCurrentSession,
    getSessionList,
    clearMessages,
  } = useChatStore();

  const {
    gatewaySession,
    isGatewayRunning,
    activeAgentId,
    setActiveAgent,
  } = useSessionStore();

  // Ensure we always have at least one session
  useEffect(() => {
    if (Object.keys(sessions).length === 0) {
      createSession('New Chat');
    }
  }, [sessions, createSession]);

  const startNewSession = useCallback(
    (name?: string) => {
      const sessionId = createSession(name);
      return sessionId;
    },
    [createSession]
  );

  const switchSession = useCallback(
    (sessionId: string) => {
      if (sessions[sessionId]) {
        selectSession(sessionId);
      }
    },
    [sessions, selectSession]
  );

  const removeSession = useCallback(
    (sessionId: string) => {
      deleteSession(sessionId);

      // If we deleted the last session, create a new one
      if (Object.keys(sessions).length <= 1) {
        createSession('New Chat');
      }
    },
    [sessions, deleteSession, createSession]
  );

  const updateSessionName = useCallback(
    (sessionId: string, name: string) => {
      renameSession(sessionId, name);
    },
    [renameSession]
  );

  const clearCurrentSession = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const currentSession = getCurrentSession();
  const sessionList = getSessionList();

  return {
    // Current session
    currentSessionId,
    currentSession,
    sessionList,

    // Gateway state
    isConnected: !!gatewaySession && gatewaySession.status === 'connected',
    isGatewayRunning,
    gatewaySession,

    // Agent state
    activeAgentId,
    setActiveAgent,

    // Actions
    startNewSession,
    switchSession,
    removeSession,
    updateSessionName,
    clearCurrentSession,
  };
}

export type { ChatSession };
