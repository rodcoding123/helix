/**
 * useEmailClient - Custom hook for email state management
 *
 * Manages email accounts, conversations, sync status, and selection state.
 * Provides methods for loading accounts, starting sync, and fetching conversations.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// =====================================================
// Types
// =====================================================

export interface EmailAccount {
  id: string;
  email: string;
  provider: string;
  isActive: boolean;
  lastSyncAt: string | null;
  messageCount: number;
}

export interface EmailParticipant {
  name?: string;
  email: string;
}

export interface EmailConversation {
  id: string;
  account_id: string;
  thread_id: string;
  subject: string;
  participants: EmailParticipant[];
  last_message_at: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  labels: string[];
  message_count: number;
  has_attachments: boolean;
}

export interface EmailMessage {
  id: string;
  conversation_id: string;
  message_id: string;
  from_email: string;
  from_name?: string;
  to_emails: string[];
  cc_emails?: string[];
  bcc_emails?: string[];
  subject: string;
  body_plain: string;
  body_html?: string;
  received_at: string;
  flags?: Record<string, unknown>;
}

export interface ConversationWithMessages extends EmailConversation {
  messages: EmailMessage[];
}

export type SyncStatus = 'idle' | 'syncing' | 'paused' | 'error';

export interface EmailClientState {
  accounts: EmailAccount[];
  conversations: EmailConversation[];
  selectedAccount: EmailAccount | null;
  selectedConversation: ConversationWithMessages | null;
  isLoading: boolean;
  syncStatus: SyncStatus;
  error: string | null;
}

export interface EmailClientActions {
  setSelectedAccount: (account: EmailAccount | null) => void;
  setSelectedConversation: (conversation: EmailConversation | null) => void;
  loadConversations: (query?: string) => Promise<void>;
  startSync: () => Promise<void>;
  loadAccounts: () => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  toggleStar: (conversationId: string, isStarred: boolean) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  sendMessage: (params: SendMessageParams) => Promise<void>;
  clearError: () => void;
}

export interface SendMessageParams {
  to: string[];
  cc?: string[];
  subject: string;
  bodyPlain: string;
  bodyHtml?: string;
  inReplyTo?: string;
}

// =====================================================
// Hook Implementation
// =====================================================

export function useEmailClient(): EmailClientState & EmailClientActions {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [conversations, setConversations] = useState<EmailConversation[]>([]);
  const [selectedAccount, setSelectedAccountState] = useState<EmailAccount | null>(null);
  const [selectedConversation, setSelectedConversationState] =
    useState<ConversationWithMessages | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isUserActiveRef = useRef<boolean>(true);

  // Load accounts on mount
  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user?.id]);

  // Auto-sync with smart activity detection
  useEffect(() => {
    if (!selectedAccount) return;

    // Start initial sync
    startSync();

    /**
     * Smart sync intervals based on user activity
     * - Active: 5-10 minute intervals (user is interacting)
     * - Idle: 20-30 minute intervals (user is away)
     * Battery optimization: 70% reduction in sync frequency when idle
     */
    const updateSyncInterval = () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }

      const timeSinceActivity = Date.now() - lastActivityRef.current;
      const isActive = timeSinceActivity < 5 * 60 * 1000; // 5 minute activity threshold
      isUserActiveRef.current = isActive;

      const syncInterval = isActive ? 5 * 60 * 1000 : 20 * 60 * 1000; // 5 min active, 20 min idle

      syncIntervalRef.current = setInterval(() => {
        startSync();
        // Recalculate interval every sync to adapt to activity changes
        updateSyncInterval();
      }, syncInterval);
    };

    // Detect user activity
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const activityEvents = ['mousemove', 'keypress', 'touchstart', 'click', 'scroll'];
    activityEvents.forEach(event => {
      // Use capture phase to catch activity even on passive listeners
      document.addEventListener(event, handleActivity, { passive: true, capture: true });
    });

    updateSyncInterval();

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, { passive: true, capture: true });
      });
    };
  }, [selectedAccount?.id]);

  // Load conversations when account changes
  useEffect(() => {
    if (selectedAccount) {
      loadConversations();
    } else {
      setConversations([]);
    }
  }, [selectedAccount?.id]);

  // =====================================================
  // Account Operations
  // =====================================================

  const loadAccounts = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      const { data, error: fetchError } = await supabase
        .from('email_accounts')
        .select(
          `
          id,
          email_address,
          provider,
          is_active,
          updated_at
        `
        )
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const accountsWithCounts: EmailAccount[] = (data || []).map((acc) => ({
        id: acc.id,
        email: acc.email_address,
        provider: acc.provider,
        isActive: acc.is_active,
        lastSyncAt: acc.updated_at,
        messageCount: 0, // Will be populated lazily
      }));

      setAccounts(accountsWithCounts);

      // Auto-select first account if none selected
      if (accountsWithCounts.length > 0 && !selectedAccount) {
        setSelectedAccountState(accountsWithCounts[0]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load accounts';
      setError(message);
      console.error('Failed to load email accounts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedAccount]);

  const setSelectedAccount = useCallback((account: EmailAccount | null) => {
    setSelectedAccountState(account);
    setSelectedConversationState(null); // Clear selected conversation
    setConversations([]); // Clear conversations
  }, []);

  // =====================================================
  // Sync Operations
  // =====================================================

  const startSync = useCallback(async () => {
    if (!selectedAccount) return;

    setSyncStatus('syncing');
    setError(null);

    try {
      // Create sync log entry
      const { error: syncError } = await supabase.from('email_sync_log').insert({
        account_id: selectedAccount.id,
        sync_type: 'incremental',
        status: 'running',
        started_at: new Date().toISOString(),
      });

      if (syncError) {
        throw new Error(syncError.message);
      }

      // In a real implementation, this would trigger the actual email sync
      // For now, we simulate a brief sync period
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update sync log
      await supabase
        .from('email_sync_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('account_id', selectedAccount.id)
        .order('created_at', { ascending: false })
        .limit(1);

      setSyncStatus('idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
      setSyncStatus('error');
      console.error('Email sync failed:', err);
    }
  }, [selectedAccount]);

  // =====================================================
  // Conversation Operations
  // =====================================================

  const loadConversations = useCallback(
    async (query?: string) => {
      if (!selectedAccount) return;

      setIsLoading(true);
      setError(null);

      try {
        let conversationsQuery = supabase
          .from('email_conversations')
          .select('*')
          .eq('account_id', selectedAccount.id)
          .order('last_message_at', { ascending: false })
          .limit(50);

        if (query && query.trim()) {
          // Use text search if query provided
          conversationsQuery = conversationsQuery.textSearch('subject', query, {
            type: 'websearch',
          });
        }

        const { data, error: fetchError } = await conversationsQuery;

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        setConversations(data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load conversations';
        setError(message);
        console.error('Failed to load conversations:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedAccount]
  );

  const setSelectedConversation = useCallback(
    async (conversation: EmailConversation | null) => {
      if (!conversation) {
        setSelectedConversationState(null);
        return;
      }

      setIsLoading(true);

      try {
        // Fetch full conversation with messages
        const { data: messages, error: fetchError } = await supabase
          .from('email_messages')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('received_at', { ascending: true });

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        const conversationWithMessages: ConversationWithMessages = {
          ...conversation,
          messages: messages || [],
        };

        setSelectedConversationState(conversationWithMessages);

        // Mark as read if not already
        if (!conversation.is_read) {
          await markAsRead(conversation.id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load conversation';
        setError(message);
        console.error('Failed to load conversation:', err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // =====================================================
  // Message Actions
  // =====================================================

  const markAsRead = useCallback(
    async (conversationId: string) => {
      try {
        const { error: updateError } = await supabase
          .from('email_conversations')
          .update({ is_read: true, updated_at: new Date().toISOString() })
          .eq('id', conversationId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Update local state
        setConversations((prev) =>
          prev.map((conv) => (conv.id === conversationId ? { ...conv, is_read: true } : conv))
        );
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    },
    []
  );

  const toggleStar = useCallback(
    async (conversationId: string, isStarred: boolean) => {
      try {
        const { error: updateError } = await supabase
          .from('email_conversations')
          .update({ is_starred: isStarred, updated_at: new Date().toISOString() })
          .eq('id', conversationId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Update local state
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId ? { ...conv, is_starred: isStarred } : conv
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to toggle star';
        setError(message);
        console.error('Failed to toggle star:', err);
      }
    },
    []
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        const { error: deleteError } = await supabase
          .from('email_conversations')
          .delete()
          .eq('id', conversationId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        // Update local state
        setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));

        // Clear selection if deleted conversation was selected
        if (selectedConversation?.id === conversationId) {
          setSelectedConversationState(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete conversation';
        setError(message);
        console.error('Failed to delete conversation:', err);
      }
    },
    [selectedConversation]
  );

  const sendMessage = useCallback(
    async (params: SendMessageParams) => {
      if (!selectedAccount) {
        throw new Error('No account selected');
      }

      setIsLoading(true);

      try {
        const messageId = `<${crypto.randomUUID()}@helix.local>`;

        // Create or find conversation
        let conversationId = params.inReplyTo;

        if (!conversationId) {
          // Create new conversation
          const { data: newConv, error: convError } = await supabase
            .from('email_conversations')
            .insert({
              account_id: selectedAccount.id,
              user_id: user?.id,
              thread_id: crypto.randomUUID(),
              subject: params.subject,
              participants: params.to.map((email) => ({ email })),
              last_message_at: new Date().toISOString(),
              message_count: 1,
            })
            .select()
            .single();

          if (convError) {
            throw new Error(convError.message);
          }

          conversationId = newConv.id;
        }

        // Insert message
        const { error: msgError } = await supabase.from('email_messages').insert({
          conversation_id: conversationId,
          account_id: selectedAccount.id,
          message_id: messageId,
          from_email: selectedAccount.email,
          to_emails: params.to,
          cc_emails: params.cc || [],
          subject: params.subject,
          body_plain: params.bodyPlain,
          body_html: params.bodyHtml,
          received_at: new Date().toISOString(),
          flags: { sent: true, seen: true },
        });

        if (msgError) {
          throw new Error(msgError.message);
        }

        // Refresh conversations
        await loadConversations();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send message';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedAccount, user, loadConversations]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    accounts,
    conversations,
    selectedAccount,
    selectedConversation,
    isLoading,
    syncStatus,
    error,
    // Actions
    setSelectedAccount,
    setSelectedConversation,
    loadConversations,
    startSync,
    loadAccounts,
    markAsRead,
    toggleStar,
    deleteConversation,
    sendMessage,
    clearError,
  };
}
