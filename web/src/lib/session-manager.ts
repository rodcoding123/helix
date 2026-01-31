// Session Manager for Helix Observatory
// Handles session sync between local Helix and Observatory

import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SessionStatus = 'local' | 'syncing' | 'synced' | 'observatory' | 'error';

export interface Session {
  id: string;
  instance_key: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  source: 'local' | 'observatory';
  messages: SessionMessage[];
  metadata?: Record<string, unknown>;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tool_calls?: Array<{
    name: string;
    input: Record<string, unknown>;
    output?: string;
  }>;
}

export interface SessionManagerConfig {
  instanceKey: string;
  userId: string;
  onStatusChange: (status: SessionStatus) => void;
  onSessionUpdate: (session: Session) => void;
  onError: (error: Error) => void;
}

export class SessionManager {
  private config: SessionManagerConfig;
  private channel: RealtimeChannel | null = null;
  private currentSession: Session | null = null;
  private status: SessionStatus = 'local';

  constructor(config: SessionManagerConfig) {
    this.config = config;
  }

  async startSession(): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      instance_key: this.config.instanceKey,
      user_id: this.config.userId,
      started_at: new Date().toISOString(),
      source: 'local',
      messages: [],
    };

    this.currentSession = session;

    // Try to sync to Supabase
    try {
      this.setStatus('syncing');
      await this.syncSession(session);
      this.setStatus('synced');
    } catch (error) {
      console.error('Failed to sync session:', error);
      this.setStatus('local');
    }

    return session;
  }

  async syncSession(session: Session): Promise<void> {
    const { error } = await supabase
      .from('sessions')
      .upsert({
        id: session.id,
        instance_key: session.instance_key,
        user_id: session.user_id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        source: session.source,
        metadata: session.metadata,
      });

    if (error) throw error;
  }

  async addMessage(message: Omit<SessionMessage, 'id' | 'timestamp'>): Promise<SessionMessage> {
    const fullMessage: SessionMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    if (this.currentSession) {
      this.currentSession.messages.push(fullMessage);
      this.config.onSessionUpdate(this.currentSession);

      // Sync message to Supabase
      try {
        await supabase.from('session_messages').insert({
          id: fullMessage.id,
          session_id: this.currentSession.id,
          role: fullMessage.role,
          content: fullMessage.content,
          timestamp: fullMessage.timestamp,
          tool_calls: fullMessage.tool_calls,
        });
      } catch (error) {
        console.error('Failed to sync message:', error);
      }
    }

    return fullMessage;
  }

  subscribeToSession(sessionId: string): void {
    // Unsubscribe from any existing channel
    this.unsubscribe();

    // Subscribe to real-time updates
    this.channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && this.currentSession) {
            const newMessage = payload.new as SessionMessage;
            // Only add if not already present (avoid duplicates from local sync)
            if (!this.currentSession.messages.find((m) => m.id === newMessage.id)) {
              this.currentSession.messages.push(newMessage);
              this.config.onSessionUpdate(this.currentSession);
            }
          }
        }
      )
      .subscribe();
  }

  async loadSession(sessionId: string): Promise<Session | null> {
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      return null;
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from('session_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (messagesError) {
      console.error('Failed to load messages:', messagesError);
    }

    const session: Session = {
      ...sessionData,
      messages: messagesData || [],
    };

    this.currentSession = session;
    this.config.onSessionUpdate(session);
    this.subscribeToSession(sessionId);
    this.setStatus('synced');

    return session;
  }

  async handoffToObservatory(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session to handoff');
    }

    this.setStatus('syncing');

    try {
      // Update session source to observatory
      await supabase
        .from('sessions')
        .update({ source: 'observatory' })
        .eq('id', this.currentSession.id);

      this.currentSession.source = 'observatory';
      this.setStatus('observatory');
      this.config.onSessionUpdate(this.currentSession);
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  async handoffToLocal(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session to handoff');
    }

    this.setStatus('syncing');

    try {
      await supabase
        .from('sessions')
        .update({ source: 'local' })
        .eq('id', this.currentSession.id);

      this.currentSession.source = 'local';
      this.setStatus('synced');
      this.config.onSessionUpdate(this.currentSession);
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    const endedAt = new Date().toISOString();
    this.currentSession.ended_at = endedAt;

    try {
      await supabase
        .from('sessions')
        .update({ ended_at: endedAt })
        .eq('id', this.currentSession.id);
    } catch (error) {
      console.error('Failed to end session:', error);
    }

    this.config.onSessionUpdate(this.currentSession);
    this.unsubscribe();
    this.currentSession = null;
    this.setStatus('local');
  }

  unsubscribe(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private setStatus(status: SessionStatus): void {
    this.status = status;
    this.config.onStatusChange(status);
  }

  get currentStatus(): SessionStatus {
    return this.status;
  }

  get session(): Session | null {
    return this.currentSession;
  }
}
