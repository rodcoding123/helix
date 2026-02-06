import { supabase } from './supabase';

export interface OnboardingStatus {
  profileUpdated: boolean;
  displayName: string | null;
  step: string;
}

export interface ChatResponse {
  message: string;
  messageId: string;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  quota: ChatQuota;
  onboarding?: OnboardingStatus;
}

export interface ChatQuota {
  used: number;
  limit: number;
  remaining: number;
}

export interface QuotaExceededResponse {
  error: string;
  quota: ChatQuota;
  upgrade: {
    message: string;
    url: string;
  } | null;
}

export interface ConversationMetadata {
  id: string;
  sessionKey: string;
  title?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export class CloudChatClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  }

  getEndpointUrl(): string {
    return `${this.baseUrl}/functions/v1/cloud-chat`;
  }

  async sendMessage(
    message: string,
    options?: {
      sessionKey?: string;
      isOnboarding?: boolean;
    }
  ): Promise<ChatResponse> {
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    if (message.length > 4000) {
      throw new Error('Message too long (max 4000 characters)');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(this.getEndpointUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        ...(session.refresh_token ? { 'X-Refresh-Token': session.refresh_token } : {}),
      },
      body: JSON.stringify({
        message: message.trim(),
        sessionKey: options?.sessionKey,
        isOnboarding: options?.isOnboarding ?? false,
      }),
    });

    if (response.status === 429) {
      const data: QuotaExceededResponse = await response.json();
      throw new QuotaExceededError(data);
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  async completeOnboarding(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    await supabase
      .from('user_profiles')
      .update({ onboarding_completed: true, onboarding_step: 'completed' })
      .eq('user_id', session.user.id);
  }

  async getProfile(): Promise<{
    displayName: string | null;
    onboardingCompleted: boolean;
    messagesToday: number;
  } | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data } = await supabase
      .from('user_profiles')
      .select('display_name, onboarding_completed, messages_today')
      .eq('user_id', session.user.id)
      .single();

    if (!data) return null;

    return {
      displayName: data.display_name,
      onboardingCompleted: data.onboarding_completed,
      messagesToday: data.messages_today,
    };
  }

  async updateProfile(updates: {
    displayName?: string;
    role?: string;
    interests?: string[];
  }): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    await supabase
      .from('user_profiles')
      .update({
        display_name: updates.displayName,
        role: updates.role,
        interests: updates.interests,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', session.user.id);
  }

  async getConversation(sessionKey: string): Promise<ConversationMetadata | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data } = await supabase
      .from('conversations')
      .select('id, session_key, title, message_count, created_at, updated_at')
      .eq('user_id', session.user.id)
      .eq('session_key', sessionKey)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      sessionKey: data.session_key,
      title: data.title,
      messageCount: data.message_count || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async loadConversationMessages(
    sessionKey: string
  ): Promise<Array<{ id: string; role: string; content: string; timestamp: string }>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data } = await supabase
      .from('session_messages')
      .select('id, role, content, created_at')
      .eq('user_id', session.user.id)
      .eq('session_key', sessionKey)
      .order('created_at', { ascending: true });

    if (!data) return [];

    return data.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.created_at,
    }));
  }

  async updateConversationTitle(
    sessionKey: string,
    title: string
  ): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    await supabase
      .from('conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('user_id', session.user.id)
      .eq('session_key', sessionKey);
  }
}

export class QuotaExceededError extends Error {
  public quota: ChatQuota;
  public upgrade: QuotaExceededResponse['upgrade'];

  constructor(data: QuotaExceededResponse) {
    super(data.error);
    this.name = 'QuotaExceededError';
    this.quota = data.quota;
    this.upgrade = data.upgrade;
  }
}

let chatClient: CloudChatClient | null = null;

export function getCloudChatClient(): CloudChatClient {
  if (!chatClient) {
    chatClient = new CloudChatClient();
  }
  return chatClient;
}
