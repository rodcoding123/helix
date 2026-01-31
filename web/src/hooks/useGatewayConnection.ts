import { useState, useEffect, useCallback, useRef } from 'react';
import { GatewayConnection, ConnectionStatus, GatewayMessage, GatewayConnectionConfig } from '@/lib/gateway-connection';

interface UseGatewayConnectionOptions {
  instanceKey: string;
  authToken: string;
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

export function useGatewayConnection(options: UseGatewayConnectionOptions): UseGatewayConnectionReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<GatewayMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const connectionRef = useRef<GatewayConnection | null>(null);

  const handleMessage = useCallback((message: GatewayMessage) => {
    setMessages((prev) => [...prev, message]);
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
      instanceKey: options.instanceKey,
      authToken: options.authToken,
      gatewayUrl: options.gatewayUrl,
      onMessage: handleMessage,
      onStatusChange: handleStatusChange,
      onError: handleError,
    };

    connectionRef.current = new GatewayConnection(config);
    await connectionRef.current.connect();
  }, [options.instanceKey, options.authToken, options.gatewayUrl, handleMessage, handleStatusChange, handleError]);

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
