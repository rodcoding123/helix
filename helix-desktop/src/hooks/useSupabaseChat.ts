/**
 * Supabase Chat Hook for Desktop
 *
 * Replaces useGateway to provide unified chat across web and desktop.
 * Communicates with the HTTP gateway instead of WebSocket.
 *
 * Phase 4A: Desktop Unification
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getDesktopChatClient } from '../lib/supabase-chat-client';

export interface ChatStreamMessage {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'error' | 'complete';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  error?: string;
  runId?: string;
}

export interface ChatStatus {
  running: boolean;
  connected: boolean;
  error?: string;
}

/**
 * Hook for unified Supabase-based chat
 * Compatible with the existing useGateway interface
 */
export function useSupabaseChat(baseUrl?: string) {
  const [status, setStatus] = useState<ChatStatus>({
    running: true,
    connected: true,
  });

  const [connected, setConnected] = useState(true);
  const [messages, setMessages] = useState<ChatStreamMessage[]>([]);
  const [sessionKey, setSessionKey] = useState('default');
  const [authToken, setAuthToken] = useState<string | null>(null);

  const clientRef = useRef(getDesktopChatClient(baseUrl));
  const abortControllerRef = useRef<AbortController | null>(null);

  // Set auth token from Supabase
  useEffect(() => {
    if (authToken) {
      clientRef.current.setAuthToken(authToken);
    }
  }, [authToken]);

  // Health check on mount and periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const healthy = await clientRef.current.healthCheck();
        setConnected(healthy);
        setStatus(prev => ({ ...prev, connected: healthy }));
      } catch (error) {
        console.error('[useSupabaseChat] Health check failed:', error);
        setConnected(false);
        setStatus(prev => ({ ...prev, connected: false, error: String(error) }));
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Send message to gateway via HTTP
   */
  const sendMessage = useCallback(
    async (content: string, key?: string) => {
      const key_ = key || sessionKey;
      setSessionKey(key_);
      clientRef.current.setSessionKey(key_);

      setMessages([]);

      const thinkingMsg: ChatStreamMessage = {
        type: 'thinking',
        content: 'Processing...',
        runId: String(Date.now()),
      };
      setMessages([thinkingMsg]);

      try {
        abortControllerRef.current = new AbortController();

        const response = await clientRef.current.sendMessage(content);

        if (!response.success) {
          const errorMsg: ChatStreamMessage = {
            type: 'error',
            error: response.response || 'Unknown error',
            runId: String(Date.now()),
          };
          setMessages(prev => [...prev, errorMsg]);
          return;
        }

        const contentMsg: ChatStreamMessage = {
          type: 'message',
          content: response.response,
          runId: String(Date.now()),
        };
        setMessages(prev => [...prev, contentMsg]);

        const completeMsg: ChatStreamMessage = {
          type: 'complete',
          runId: contentMsg.runId,
        };
        setMessages(prev => [...prev, completeMsg]);

        return response;
      } catch (error) {
        const errorMsg: ChatStreamMessage = {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          runId: String(Date.now()),
        };
        setMessages(prev => [...prev, errorMsg]);
        throw error;
      }
    },
    [sessionKey]
  );

  /**
   * Interrupt current operation
   */
  const interrupt = useCallback((_key?: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const interruptMsg: ChatStreamMessage = {
      type: 'error',
      error: 'Operation interrupted',
      runId: String(Date.now()),
    };
    setMessages(prev => [...prev, interruptMsg]);
  }, []);

  /**
   * Set authentication token
   */
  const setSupabaseToken = useCallback((token: string) => {
    setAuthToken(token);
  }, []);

  const hello = {
    snapshot: {
      sessionKey,
      model: 'claude-opus-4-6',
      agent: { id: 'helix-desktop', name: 'Helix Desktop' },
    },
  };

  const getClient = useCallback(() => {
    return {
      connected,
      request: async (handler: string, _args: unknown) => {
        throw new Error(`Command ${handler} not supported in HTTP mode`);
      },
    };
  }, [connected]);

  return {
    status,
    connected,
    messages,
    hello,
    sendMessage,
    interrupt,
    getClient,
    setSessionKey,
    setSupabaseToken,
    start: async () => {},
    stop: async () => {},
    connect: async () => {},
    disconnect: () => {},
    checkStatus: async () => status,
  };
}
