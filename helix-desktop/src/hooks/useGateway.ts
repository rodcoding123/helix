/**
 * Gateway connection hook for Helix Desktop
 * Uses OpenClaw WebSocket protocol
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke, listen } from '../lib/tauri-compat';
import type { UnlistenFn } from '@tauri-apps/api/event';
import {
  GatewayClient,
  createGatewayClient,
  type GatewayEventFrame,
  type GatewayHelloOk,
} from '../lib/gateway-client';

// Local development token - must match Rust backend
const LOCAL_GATEWAY_TOKEN = 'helix-desktop-local';

interface GatewayStatus {
  running: boolean;
  port: number | null;
  pid: number | null;
  url: string | null;
}

interface GatewayStartedPayload {
  port: number;
  url: string;
}

// Chat event types from OpenClaw
interface ChatEvent {
  type: 'chat';
  phase: 'thinking' | 'tool_use' | 'tool_result' | 'content' | 'error' | 'complete';
  runId?: string;
  sessionKey?: string;
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  error?: string;
}

export interface GatewayMessage {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'error' | 'complete';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  error?: string;
  runId?: string;
}

export function useGateway() {
  const [status, setStatus] = useState<GatewayStatus>({
    running: false,
    port: null,
    pid: null,
    url: null,
  });
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<GatewayMessage[]>([]);
  const [hello, setHello] = useState<GatewayHelloOk | null>(null);
  const clientRef = useRef<GatewayClient | null>(null);

  // Check gateway status
  const checkStatus = useCallback(async () => {
    try {
      const result = await invoke<GatewayStatus>('gateway_status');
      setStatus(result);
      return result;
    } catch (error) {
      console.error('Failed to check gateway status:', error);
      return { running: false, port: null, pid: null, url: null };
    }
  }, []);

  // Start gateway
  const start = useCallback(async () => {
    try {
      const result = await invoke<GatewayStartedPayload>('start_gateway');
      setStatus({ running: true, port: result.port, pid: null, url: result.url });
      return result;
    } catch (error) {
      console.error('Failed to start gateway:', error);
      throw error;
    }
  }, []);

  // Stop gateway
  const stop = useCallback(async () => {
    try {
      await invoke('stop_gateway');
      setStatus({ running: false, port: null, pid: null, url: null });
      disconnect();
    } catch (error) {
      console.error('Failed to stop gateway:', error);
      throw error;
    }
  }, []);

  // Handle gateway events
  const handleEvent = useCallback((evt: GatewayEventFrame) => {
    // Handle chat events
    if (evt.event === 'chat') {
      const chatEvt = evt.payload as ChatEvent;
      let message: GatewayMessage | null = null;

      switch (chatEvt.phase) {
        case 'thinking':
          message = { type: 'thinking', content: chatEvt.content, runId: chatEvt.runId };
          break;
        case 'tool_use':
          message = {
            type: 'tool_call',
            toolName: chatEvt.toolName,
            toolInput: chatEvt.toolInput,
            runId: chatEvt.runId,
          };
          break;
        case 'tool_result':
          message = {
            type: 'tool_result',
            toolName: chatEvt.toolName,
            toolOutput: chatEvt.toolOutput,
            runId: chatEvt.runId,
          };
          break;
        case 'content':
          message = { type: 'message', content: chatEvt.content, runId: chatEvt.runId };
          break;
        case 'error':
          message = { type: 'error', error: chatEvt.error, runId: chatEvt.runId };
          break;
        case 'complete':
          message = { type: 'complete', runId: chatEvt.runId };
          break;
      }

      if (message) {
        setMessages((prev) => [...prev, message]);
      }
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(
    (url: string, token?: string) => {
      if (clientRef.current?.connected) {
        return;
      }

      // Stop existing client
      clientRef.current?.stop();

      const client = createGatewayClient({
        url,
        token,
        onHello: (h) => {
          setHello(h);
          setConnected(true);
          console.log('Gateway connected:', h);
        },
        onEvent: handleEvent,
        onClose: ({ code, reason }) => {
          setConnected(false);
          console.log('Gateway disconnected:', code, reason);
        },
        onError: (err) => {
          console.error('Gateway error:', err);
        },
        onConnected: () => {
          setConnected(true);
        },
      });

      client.start();
      clientRef.current = client;
    },
    [handleEvent]
  );

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    clientRef.current?.stop();
    clientRef.current = null;
    setConnected(false);
    setHello(null);
  }, []);

  // Send message
  const sendMessage = useCallback(async (content: string, sessionKey?: string) => {
    if (!clientRef.current?.connected) {
      throw new Error('Gateway not connected');
    }

    setMessages([]); // Clear messages for new conversation turn

    try {
      const result = await clientRef.current.chat({
        content,
        sessionKey: sessionKey ?? 'default',
      });
      return result;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, []);

  // Interrupt current operation
  const interrupt = useCallback(async (sessionKey?: string) => {
    if (!clientRef.current?.connected) {
      return;
    }

    try {
      await clientRef.current.abort({ sessionKey });
    } catch (error) {
      console.error('Failed to interrupt:', error);
    }
  }, []);

  // Get client for advanced operations
  const getClient = useCallback(() => clientRef.current, []);

  // Listen for Tauri events
  useEffect(() => {
    let unlisten: UnlistenFn;

    (async () => {
      unlisten = await listen<GatewayStartedPayload>('gateway:started', (event) => {
        const { port, url } = event.payload;
        setStatus((prev) => ({ ...prev, running: true, port, url }));
        connect(url, LOCAL_GATEWAY_TOKEN);
      });
    })();

    return () => {
      unlisten?.();
    };
  }, [connect]);

  // Listen for gateway stopped event
  useEffect(() => {
    let unlisten: UnlistenFn;

    (async () => {
      unlisten = await listen('gateway:stopped', () => {
        setStatus({ running: false, port: null, pid: null, url: null });
        disconnect();
      });
    })();

    return () => {
      unlisten?.();
    };
  }, [disconnect]);

  // Initial status check and auto-connect
  useEffect(() => {
    checkStatus().then((result) => {
      if (result.running && result.url) {
        connect(result.url, LOCAL_GATEWAY_TOKEN);
      }
    });

    return () => {
      disconnect();
    };
  }, [checkStatus, connect, disconnect]);

  return {
    status,
    connected,
    messages,
    hello,
    start,
    stop,
    connect,
    disconnect,
    sendMessage,
    interrupt,
    checkStatus,
    getClient,
  };
}
