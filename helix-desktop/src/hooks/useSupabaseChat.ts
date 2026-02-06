/**
 * useSupabaseChat Hook
 *
 * React hook for desktop chat with Supabase backend.
 * Provides:
 * - Real-time message sync
 * - Conversation management
 * - Offline support with automatic queueing
 * - Context loading for Helix personality
 */

import { useCallback, useEffect, useState } from 'react';
import {
  SupabaseDesktopClient,
  createSupabaseDesktopClient,
  Message,
  Conversation,
} from '../lib/supabase-desktop-client.js';
import {
  OfflineSyncQueue,
  getOfflineSyncQueue,
  SyncStatus,
} from '../lib/offline-sync-queue.js';

// ============================================================================
// Types
// ============================================================================

export interface UseSupabaseChatState {
  // Current session
  currentSessionKey: string | null;
  conversation: Conversation | null;

  // Messages
  messages: Message[];
  isLoadingMessages: boolean;
  messageError: string | null;

  // All conversations
  conversations: Conversation[];
  isLoadingConversations: boolean;

  // Offline support
  syncStatus: SyncStatus;

  // Context for Helix
  helixContext: string[];
  isLoadingContext: boolean;
}

export interface UseSupabaseChatActions {
  // Session management
  selectConversation: (sessionKey: string) => Promise<void>;
  createConversation: (title?: string) => Promise<void>;

  // Message operations
  sendMessage: (content: string) => Promise<void>;
  loadMessages: (sessionKey: string) => Promise<(() => void) | undefined>;

  // Sync operations
  syncNow: () => Promise<void>;

  // Cleanup
  disconnect: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSupabaseChat(): UseSupabaseChatState & UseSupabaseChatActions {
  const [user] = useState<{ id: string } | null>(null); // TODO: Implement actual auth context
  const [client, setClient] = useState<SupabaseDesktopClient | null>(null);
  const [syncQueue, setSyncQueue] = useState<OfflineSyncQueue | null>(null);

  // State
  const [currentSessionKey, setCurrentSessionKey] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    queueLength: 0,
    isSyncing: false,
    failedCount: 0,
  });
  const [helixContext, setHelixContext] = useState<string[]>([]);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  // Initialize Supabase client
  useEffect(() => {
    if (!user?.id) return;

    const initClient = async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('[useSupabaseChat] Missing Supabase configuration');
        return;
      }

      const newClient = createSupabaseDesktopClient(supabaseUrl, supabaseAnonKey);
      await newClient.initialize(user.id);
      setClient(newClient);

      // Initialize sync queue
      const queue = getOfflineSyncQueue();
      setSyncQueue(queue);

      // Subscribe to sync status
      queue.onStatusChange(setSyncStatus);

      // Load initial conversations
      await loadConversations(newClient);
    };

    void initClient();
  }, [user?.id]);

  // Load conversations from Supabase
  const loadConversations = useCallback(async (clientArg?: SupabaseDesktopClient) => {
    const targetClient = clientArg || client;
    if (!targetClient) return;

    setIsLoadingConversations(true);
    try {
      const convos = await targetClient.loadConversations();
      setConversations(convos);

      // Subscribe to real-time updates
      const unsubscribe = targetClient.subscribeToConversations((updated) => {
        setConversations(updated);
      });

      return unsubscribe;
    } catch (err) {
      console.error('[useSupabaseChat] Failed to load conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [client]);

  // Load messages for a session
  const loadMessages = useCallback(async (sessionKey: string) => {
    if (!client) return;

    setIsLoadingMessages(true);
    setMessageError(null);

    try {
      const msgs = await client.loadConversation(sessionKey);
      setMessages(msgs);

      // Subscribe to real-time message updates
      const unsubscribe = client.subscribeToMessages(sessionKey, (newMessage) => {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage];
        });
      });

      return unsubscribe;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load messages';
      setMessageError(errorMsg);
      console.error('[useSupabaseChat] Failed to load messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [client]);

  // Select a conversation
  const selectConversation = useCallback(
    async (sessionKey: string) => {
      setCurrentSessionKey(sessionKey);

      // Find conversation from list
      const conv = conversations.find((c) => c.session_key === sessionKey) || null;
      setConversation(conv);

      // Load messages
      await loadMessages(sessionKey);

      // Load Helix context (personality, user profile, etc.)
      await loadHelixContext();
    },
    [conversations, loadMessages]
  );

  // Create a new conversation
  const createConversation = useCallback(
    async (title?: string) => {
      if (!client) return;

      try {
        const newConv = await client.createConversation(title);
        setConversations((prev) => [newConv, ...prev]);
        await selectConversation(newConv.session_key);
      } catch (err) {
        console.error('[useSupabaseChat] Failed to create conversation:', err);
      }
    },
    [client, selectConversation]
  );

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!client || !currentSessionKey) return;

      const idempotencyKey = crypto.randomUUID();

      // Optimistic UI update
      const optimisticMessage: Message = {
        id: crypto.randomUUID(),
        session_key: currentSessionKey,
        user_id: user?.id || '',
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
        metadata: { idempotencyKey, optimistic: true },
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const result = await client.sendMessage({
          content,
          sessionKey: currentSessionKey,
          idempotencyKey,
        });

        // If queued, add to sync queue for later processing
        if (result.queued && syncQueue) {
          await syncQueue.queueMessage(optimisticMessage);
        }
      } catch (err) {
        console.error('[useSupabaseChat] Failed to send message:', err);
        setMessageError('Failed to send message');

        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      }
    },
    [client, currentSessionKey, user?.id, syncQueue]
  );

  // Load Helix context (personality, psychology, etc.)
  const loadHelixContext = useCallback(async () => {
    setIsLoadingContext(true);
    try {
      // TODO: Implement actual context loading
      // For now, load from local Helix files
      // This would use the context-loader from Phase 1
      const contextItems = [
        'HELIX_SOUL.md',
        'USER.md',
        'psychology/attachments.json',
        'identity/goals.json',
      ];
      setHelixContext(contextItems);
    } catch (err) {
      console.error('[useSupabaseChat] Failed to load Helix context:', err);
    } finally {
      setIsLoadingContext(false);
    }
  }, []);

  // Sync queued messages
  const syncNow = useCallback(async () => {
    if (!syncQueue || !client) return;

    await syncQueue.processQueue(async (operation) => {
      // This would be called by the sync service
      // For now, just remove from queue (actual sync would happen here)
      console.log('[useSupabaseChat] Syncing operation:', operation.id);
    });
  }, [syncQueue, client]);

  // Disconnect on unmount
  const disconnect = useCallback(() => {
    client?.disconnect();
  }, [client]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
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
  };
}
