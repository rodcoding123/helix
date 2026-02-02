import { useState, useCallback, useRef, useEffect } from 'react';
import {
  SessionManager,
  Session,
  SessionMessage,
  SessionStatus,
  SessionManagerConfig,
} from '@/lib/session-manager';
import { useAuth } from './useAuth';

interface UseSessionOptions {
  instanceKey: string;
  autoStart?: boolean;
}

interface UseSessionReturn {
  session: Session | null;
  status: SessionStatus;
  messages: SessionMessage[];
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  addMessage: (message: Omit<SessionMessage, 'id' | 'timestamp'>) => Promise<SessionMessage | null>;
  loadSession: (sessionId: string) => Promise<void>;
  handoffToObservatory: () => Promise<void>;
  handoffToLocal: () => Promise<void>;
  error: Error | null;
}

export function useSession(options: UseSessionOptions): UseSessionReturn {
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('local');
  const [error, setError] = useState<Error | null>(null);
  const managerRef = useRef<SessionManager | null>(null);

  // Initialize session manager
  useEffect(() => {
    if (!user) return;

    const config: SessionManagerConfig = {
      instanceKey: options.instanceKey,
      userId: user.id,
      onStatusChange: setStatus,
      onSessionUpdate: setSession,
      onError: setError,
    };

    managerRef.current = new SessionManager(config);

    if (options.autoStart) {
      managerRef.current.startSession().catch(setError);
    }

    return () => {
      managerRef.current?.unsubscribe();
    };
  }, [user, options.instanceKey, options.autoStart]);

  const startSession = useCallback(async () => {
    if (!managerRef.current) {
      setError(new Error('Session manager not initialized'));
      return;
    }

    try {
      await managerRef.current.startSession();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start session'));
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!managerRef.current) return;

    try {
      await managerRef.current.endSession();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to end session'));
    }
  }, []);

  const addMessage = useCallback(
    async (message: Omit<SessionMessage, 'id' | 'timestamp'>): Promise<SessionMessage | null> => {
      if (!managerRef.current) {
        setError(new Error('Session manager not initialized'));
        return null;
      }

      try {
        return await managerRef.current.addMessage(message);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to add message'));
        return null;
      }
    },
    []
  );

  const loadSession = useCallback(async (sessionId: string) => {
    if (!managerRef.current) {
      setError(new Error('Session manager not initialized'));
      return;
    }

    try {
      await managerRef.current.loadSession(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load session'));
    }
  }, []);

  const handoffToObservatory = useCallback(async () => {
    if (!managerRef.current) {
      setError(new Error('Session manager not initialized'));
      return;
    }

    try {
      await managerRef.current.handoffToObservatory();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to handoff to Observatory'));
    }
  }, []);

  const handoffToLocal = useCallback(async () => {
    if (!managerRef.current) {
      setError(new Error('Session manager not initialized'));
      return;
    }

    try {
      await managerRef.current.handoffToLocal();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to handoff to local'));
    }
  }, []);

  return {
    session,
    status,
    messages: session?.messages || [],
    startSession,
    endSession,
    addMessage,
    loadSession,
    handoffToObservatory,
    handoffToLocal,
    error,
  };
}
