import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GatewayConnection,
  ConnectionStatus,
  GatewayMessage,
  GatewayConnectionConfig,
} from '@/lib/gateway-connection';

interface UseGatewayConnectionOptions {
  userId: string;
  authToken: string;
  /** @deprecated Use userId instead */
  instanceKey?: string;
  gatewayUrl?: string;
  autoConnect?: boolean;
}

interface UseGatewayConnectionReturn {
  status: ConnectionStatus;
  messages: GatewayMessage[];
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (content: string) => void;
  interrupt: () => void;
  clearMessages: () => void;
  isConnected: boolean;
  error: Error | null;
}

export function useGatewayConnection(
  options: UseGatewayConnectionOptions
): UseGatewayConnectionReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<GatewayMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const connectionRef = useRef<GatewayConnection | null>(null);

  const handleMessage = useCallback((message: GatewayMessage) => {
    setMessages(prev => {
      // Implement circular buffer: keep only last 1000 messages
      // Prevents unbounded memory growth (17MB leak over 8 hours)
      // At ~1KB per message, 1000 messages = ~1MB memory usage (stable)
      const maxMessages = 1000;
      const updated = [...prev, message];
      return updated.length > maxMessages ? updated.slice(-maxMessages) : updated;
    });
  }, []);

  const handleStatusChange = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err);
  }, []);

  const connect = useCallback(async () => {
    if (connectionRef.current?.isConnected) {
      return;
    }

    const config: GatewayConnectionConfig = {
      userId: options.userId,
      authToken: options.authToken,
      instanceKey: options.instanceKey,
      gatewayUrl: options.gatewayUrl,
      onMessage: handleMessage,
      onStatusChange: handleStatusChange,
      onError: handleError,
    };

    connectionRef.current = new GatewayConnection(config);
    await connectionRef.current.connect();
  }, [
    options.userId,
    options.authToken,
    options.instanceKey,
    options.gatewayUrl,
    handleMessage,
    handleStatusChange,
    handleError,
  ]);

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
  }, []);

  const sendMessage = useCallback((content: string) => {
    connectionRef.current?.sendMessage(content);
  }, []);

  const interrupt = useCallback(() => {
    connectionRef.current?.interrupt();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    if (options.autoConnect) {
      connect().catch(console.error);
    }

    return () => {
      disconnect();
    };
  }, [options.autoConnect, connect, disconnect]);

  return {
    status,
    messages,
    connect,
    disconnect,
    sendMessage,
    interrupt,
    clearMessages,
    isConnected: status === 'connected',
    error,
  };
}
