/**
 * Supabase Desktop Chat Client
 *
 * Provides cross-platform chat functionality using Supabase backend.
 * Supports:
 * - Real-time message sync via Supabase channels
 * - Offline message queueing with automatic sync
 * - Session management across web/desktop/mobile
 * - Context loading for Helix personality
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface Message {
  id: string;
  session_key: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  user_id: string;
  session_key: string;
  title?: string;
  messages?: Message[];
  created_at: string;
  updated_at: string;
  synthesized_at?: string;
  synthesis_insights?: string;
}

export interface QueuedMessage {
  content: string;
  sessionKey: string;
  idempotencyKey: string;
  timestamp: number;
  retries: number;
}

// ============================================================================
// Supabase Desktop Client
// ============================================================================

export class SupabaseDesktopClient {
  private supabase: SupabaseClient | null = null;
  private userId: string | null = null;
  private messageQueue: QueuedMessage[] = [];
  private subscriptions = new Map<string, { unsubscribe: () => void }>();
  private isOnline = navigator.onLine;

  constructor(
    private supabaseUrl: string,
    private supabaseAnonKey: string
  ) {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Initialize Supabase client
   */
  async initialize(userId?: string): Promise<void> {
    if (!this.supabase) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);
    }

    // If userId not provided, get from auth
    if (!userId) {
      const { data } = await this.supabase.auth.getUser();
      userId = data.user?.id;
    }

    if (!userId) {
      throw new Error('Failed to initialize: no user ID available');
    }

    this.userId = userId;
  }

  /**
   * Send a chat message
   * Returns immediately even if offline (queues for later sync)
   */
  async sendMessage(params: {
    content: string;
    sessionKey: string;
    idempotencyKey?: string;
  }): Promise<{ messageId: string; queued: boolean }> {
    if (!this.userId || !this.supabase) {
      throw new Error('Client not initialized');
    }

    const idempotencyKey = params.idempotencyKey || crypto.randomUUID();

    // If online, send immediately
    if (this.isOnline) {
      try {
        const message: Message = {
          id: crypto.randomUUID(),
          session_key: params.sessionKey,
          user_id: this.userId,
          role: 'user',
          content: params.content,
          timestamp: new Date().toISOString(),
          metadata: { idempotencyKey },
        };

        const { error } = await this.supabase.from('session_messages').insert([message]);

        if (error) {
          throw error;
        }

        return {
          messageId: message.id,
          queued: false,
        };
      } catch (err) {
        console.error('[supabase-client] Failed to send message:', err);
        // Fall through to queueing
      }
    }

    // Queue for later sync
    this.messageQueue.push({
      content: params.content,
      sessionKey: params.sessionKey,
      idempotencyKey,
      timestamp: Date.now(),
      retries: 0,
    });

    return {
      messageId: crypto.randomUUID(),
      queued: true,
    };
  }

  /**
   * Load conversation messages from Supabase
   */
  async loadConversation(sessionKey: string): Promise<Message[]> {
    if (!this.supabase) {
      throw new Error('Client not initialized');
    }

    const { data, error } = await this.supabase
      .from('session_messages')
      .select('*')
      .eq('session_key', sessionKey)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('[supabase-client] Failed to load conversation:', error);
      throw error;
    }

    return (data || []) as Message[];
  }

  /**
   * Load all conversations for current user
   */
  async loadConversations(): Promise<Conversation[]> {
    if (!this.userId || !this.supabase) {
      throw new Error('Client not initialized');
    }

    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[supabase-client] Failed to load conversations:', error);
      throw error;
    }

    return (data || []) as Conversation[];
  }

  /**
   * Create a new conversation session
   */
  async createConversation(title?: string): Promise<Conversation> {
    if (!this.userId || !this.supabase) {
      throw new Error('Client not initialized');
    }

    const sessionKey = `desktop-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const conversation: Conversation = {
      id: crypto.randomUUID(),
      user_id: this.userId,
      session_key: sessionKey,
      title: title || 'New Conversation',
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await this.supabase
      .from('conversations')
      .insert([conversation])
      .select()
      .single();

    if (error) {
      console.error('[supabase-client] Failed to create conversation:', error);
      throw error;
    }

    return data as Conversation;
  }

  /**
   * Subscribe to message updates for a session
   */
  subscribeToMessages(
    sessionKey: string,
    onMessage: (message: Message) => void
  ): () => void {
    if (!this.supabase) {
      throw new Error('Client not initialized');
    }

    const channelKey = `messages:${sessionKey}`;

    const channel = this.supabase
      .channel(channelKey)
      .on<Message>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_messages',
          filter: `session_key=eq.${sessionKey}`,
        },
        (payload) => {
          onMessage(payload.new as Message);
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, {
      unsubscribe: () => {
        void this.supabase?.removeChannel(channel);
      },
    });

    return () => {
      this.subscriptions.get(channelKey)?.unsubscribe();
      this.subscriptions.delete(channelKey);
    };
  }

  /**
   * Subscribe to conversation list updates
   */
  subscribeToConversations(onUpdate: (conversations: Conversation[]) => void): () => void {
    if (!this.userId || !this.supabase) {
      throw new Error('Client not initialized');
    }

    const channelKey = `conversations:${this.userId}`;

    const channel = this.supabase
      .channel(channelKey)
      .on<Conversation>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${this.userId}`,
        },
        async () => {
          // Reload all conversations on any change
          const conversations = await this.loadConversations();
          onUpdate(conversations);
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, {
      unsubscribe: () => {
        void this.supabase?.removeChannel(channel);
      },
    });

    return () => {
      this.subscriptions.get(channelKey)?.unsubscribe();
      this.subscriptions.delete(channelKey);
    };
  }

  /**
   * Handle coming online - sync queued messages
   */
  private async handleOnline(): Promise<void> {
    this.isOnline = true;
    console.log('[supabase-client] Coming online, syncing message queue');
    await this.syncQueue();
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    this.isOnline = false;
    console.log('[supabase-client] Going offline, messages will queue');
  }

  /**
   * Sync queued messages to Supabase
   */
  private async syncQueue(): Promise<void> {
    if (!this.supabase || !this.userId) {
      return;
    }

    const toSync = [...this.messageQueue];
    this.messageQueue = [];

    for (const queued of toSync) {
      try {
        const message: Message = {
          id: crypto.randomUUID(),
          session_key: queued.sessionKey,
          user_id: this.userId,
          role: 'user',
          content: queued.content,
          timestamp: new Date().toISOString(),
          metadata: { idempotencyKey: queued.idempotencyKey, queuedAt: queued.timestamp },
        };

        const { error } = await this.supabase.from('session_messages').insert([message]);

        if (error) {
          throw error;
        }

        console.log('[supabase-client] Synced queued message:', queued.idempotencyKey);
      } catch (err) {
        console.error('[supabase-client] Failed to sync queued message:', err);

        // Re-queue with retry count
        if (queued.retries < 3) {
          this.messageQueue.push({ ...queued, retries: queued.retries + 1 });
        } else {
          console.error(
            '[supabase-client] Message failed after 3 retries, discarding:',
            queued.idempotencyKey
          );
        }
      }
    }
  }

  /**
   * Get queued messages (for debugging)
   */
  getQueuedMessages(): QueuedMessage[] {
    return [...this.messageQueue];
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    // Unsubscribe from all channels
    for (const [, subscription] of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();

    // Clean up event listeners
    window.removeEventListener('online', () => this.handleOnline());
    window.removeEventListener('offline', () => this.handleOffline());
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let desktopClient: SupabaseDesktopClient | null = null;

export function getSupabaseDesktopClient(): SupabaseDesktopClient | null {
  return desktopClient;
}

export function createSupabaseDesktopClient(
  supabaseUrl: string,
  supabaseAnonKey: string
): SupabaseDesktopClient {
  if (desktopClient) {
    desktopClient.disconnect();
  }
  desktopClient = new SupabaseDesktopClient(supabaseUrl, supabaseAnonKey);
  return desktopClient;
}
