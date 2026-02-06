import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Conversation {
  id: string;
  sessionKey: string;
  userId: string;
  title?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  metadata?: Record<string, unknown>;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  filteredConversations: Conversation[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  createConversation: () => Promise<Conversation>;
  deleteConversation: (sessionKey: string) => Promise<void>;
  archiveConversation: (sessionKey: string, isArchived: boolean) => Promise<void>;
  getConversation: (sessionKey: string) => Conversation | undefined;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load conversations from Supabase
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setConversations([]);
        return;
      }

      const { data, error: err } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_archived', false)
        .order('updated_at', { ascending: false });

      if (err) throw err;

      const conversations: Conversation[] = (data || []).map((row: any) => ({
        id: row.id,
        sessionKey: row.session_key,
        userId: row.user_id,
        title: row.title,
        messageCount: row.message_count || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isArchived: row.is_archived || false,
        metadata: row.metadata,
      }));

      setConversations(conversations);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error loading conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Subscribe to real-time updates
  useEffect(() => {
    const setupSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const channel = supabase
        .channel(`conversations:${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              const newConversation: Conversation = {
                id: payload.new.id,
                sessionKey: payload.new.session_key,
                userId: payload.new.user_id,
                title: payload.new.title,
                messageCount: payload.new.message_count || 0,
                createdAt: payload.new.created_at,
                updatedAt: payload.new.updated_at,
                isArchived: payload.new.is_archived || false,
                metadata: payload.new.metadata,
              };
              setConversations(prev => [newConversation, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setConversations(prev =>
                prev.map(conv =>
                  conv.id === payload.new.id
                    ? {
                        id: payload.new.id,
                        sessionKey: payload.new.session_key,
                        userId: payload.new.user_id,
                        title: payload.new.title,
                        messageCount: payload.new.message_count || 0,
                        createdAt: payload.new.created_at,
                        updatedAt: payload.new.updated_at,
                        isArchived: payload.new.is_archived || false,
                        metadata: payload.new.metadata,
                      }
                    : conv
                )
              );
            } else if (payload.eventType === 'DELETE') {
              setConversations(prev => prev.filter(conv => conv.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        void channel.unsubscribe();
      };
    };

    const unsubscribe = setupSubscription();
    return () => {
      void unsubscribe.then(unsub => unsub?.());
    };
  }, []);

  // Create new conversation
  const createConversation = useCallback(async (): Promise<Conversation> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const sessionKey = `chat-${crypto.randomUUID()}`;

    const { data, error: err } = await supabase
      .from('conversations')
      .insert({
        user_id: session.user.id,
        session_key: sessionKey,
        title: 'New conversation',
        message_count: 0,
        is_archived: false,
      })
      .select()
      .single();

    if (err) throw err;

    const conversation: Conversation = {
      id: data.id,
      sessionKey: data.session_key,
      userId: data.user_id,
      title: data.title,
      messageCount: data.message_count || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isArchived: data.is_archived || false,
      metadata: data.metadata,
    };

    return conversation;
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (sessionKey: string) => {
    const { error: err } = await supabase
      .from('conversations')
      .delete()
      .eq('session_key', sessionKey);

    if (err) throw err;
  }, []);

  // Archive conversation
  const archiveConversation = useCallback(
    async (sessionKey: string, isArchived: boolean) => {
      const { error: err } = await supabase
        .from('conversations')
        .update({ is_archived: isArchived })
        .eq('session_key', sessionKey);

      if (err) throw err;
    },
    []
  );

  // Get single conversation
  const getConversation = useCallback(
    (sessionKey: string) => {
      return conversations.find(conv => conv.sessionKey === sessionKey);
    },
    [conversations]
  );

  // Filter conversations by search query
  const filteredConversations = conversations.filter(conv => {
    const query = searchQuery.toLowerCase();
    return (
      (conv.title && conv.title.toLowerCase().includes(query)) ||
      conv.sessionKey.toLowerCase().includes(query)
    );
  });

  return {
    conversations,
    isLoading,
    error,
    filteredConversations,
    searchQuery,
    setSearchQuery,
    createConversation,
    deleteConversation,
    archiveConversation,
    getConversation,
  };
}
