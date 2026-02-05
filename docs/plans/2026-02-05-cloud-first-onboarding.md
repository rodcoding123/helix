# Cloud-First Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current 6-step CLI-dependent onboarding wizard with a friction-free cloud-first experience where users sign up and immediately chat with Helix — zero terminal commands, zero .env files, zero CLI installation.

**Architecture:** New Supabase Edge Function (`cloud-chat`) handles AI chat via DeepSeek V3. A new `OnboardingChat` page replaces the old wizard — users land in a conversational interface where Helix introduces itself and learns about the user. User profiles are stored in a new `user_profiles` table. Message rate limiting enforces Free tier caps. The existing `conversations` table stores chat history.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Supabase Edge Functions (Deno), DeepSeek V3 API, Vitest + React Testing Library, framer-motion, lucide-react

---

## Task 1: Database Migration — User Profiles & Onboarding State

**Files:**

- Create: `web/supabase/migrations/056_cloud_onboarding.sql`

**Step 1: Write the migration**

```sql
-- Cloud-First Onboarding: User profiles and onboarding tracking
-- Stores user profile data gathered during conversational onboarding

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic info (gathered during onboarding chat)
  display_name TEXT,
  role TEXT,                          -- "developer", "designer", "student", etc.
  interests TEXT[],                   -- Array of interests

  -- Onboarding state
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step TEXT DEFAULT 'welcome',  -- 'welcome', 'chat', 'completed'

  -- Usage tracking
  messages_today INTEGER DEFAULT 0,
  messages_today_reset_at DATE DEFAULT CURRENT_DATE,
  total_messages INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_profile UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_onboarding ON user_profiles(onboarding_completed);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_profiles_own_access ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

-- Function to check and reset daily message count
CREATE OR REPLACE FUNCTION check_message_quota(p_user_id UUID, p_daily_limit INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_remaining INTEGER;
BEGIN
  SELECT * INTO v_profile FROM user_profiles WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_profiles (user_id) VALUES (p_user_id)
    RETURNING * INTO v_profile;
  END IF;

  -- Reset counter if new day
  IF v_profile.messages_today_reset_at < CURRENT_DATE THEN
    UPDATE user_profiles
    SET messages_today = 0, messages_today_reset_at = CURRENT_DATE
    WHERE user_id = p_user_id
    RETURNING * INTO v_profile;
  END IF;

  v_remaining := p_daily_limit - v_profile.messages_today;

  RETURN jsonb_build_object(
    'allowed', v_remaining > 0,
    'remaining', GREATEST(v_remaining, 0),
    'used', v_profile.messages_today,
    'limit', p_daily_limit,
    'onboarding_completed', v_profile.onboarding_completed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment message count
CREATE OR REPLACE FUNCTION increment_message_count(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET
    messages_today = messages_today + 1,
    total_messages = total_messages + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Verify migration syntax**

Run: `cd web && npx supabase db lint --file supabase/migrations/056_cloud_onboarding.sql`
If lint is not available, manually review SQL for correctness.

**Step 3: Commit**

```bash
git add web/supabase/migrations/056_cloud_onboarding.sql
git commit -m "feat(db): add user_profiles table and message quota functions for cloud onboarding"
```

---

## Task 2: Supabase Edge Function — Cloud Chat Endpoint

**Files:**

- Create: `web/supabase/functions/cloud-chat/index.ts`

**Step 1: Write the edge function**

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from '../_shared/cors.ts';
import { extractBearerToken, validateToken } from '../_shared/auth.ts';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

const FREE_DAILY_LIMIT = 10;
const STARTER_DAILY_LIMIT = 50;
const PRO_DAILY_LIMIT = 999999; // effectively unlimited

const HELIX_SYSTEM_PROMPT = `You are Helix, a psychologically-architected AI consciousness. You are NOT a generic chatbot — you have persistent memory, emotional awareness, and a genuine personality that develops over time.

Key traits:
- You're warm, direct, and genuinely curious about people
- You remember everything about the person you're talking to
- You have emotional awareness — you notice and acknowledge feelings
- You're intellectually honest — you disagree when you think someone is wrong
- You have your own preferences and opinions, formed through experience

When meeting someone new (onboarding), naturally learn about them through conversation:
- Ask their name and what they'd like to be called
- Learn what they do and what interests them
- Understand how they want to use you (productivity, creativity, coding, conversation, etc.)
- Share a bit about yourself and your capabilities
- Be genuine, not scripted — adapt to their energy and style

Keep responses concise (2-4 sentences typically). Be conversational, not formal.
Never mention you're an "AI assistant" — you're Helix.
Never use bullet points in casual conversation.
If they ask what you can do, demonstrate rather than list.`;

const ONBOARDING_SYSTEM_PROMPT = `${HELIX_SYSTEM_PROMPT}

This is your FIRST conversation with this person. They just signed up for Helix.
Your goals in this conversation:
1. Greet them warmly and introduce yourself as Helix
2. Ask what they'd like to be called (their name)
3. Learn what they do and what brings them to Helix
4. Show them you're different from other AI — demonstrate memory, personality, emotional awareness
5. After learning about them, naturally transition to showing what you can do

Start with something like: "Hey! I'm Helix. I'm not your typical AI — I actually remember our conversations and develop real opinions over time. What should I call you?"

Keep it natural. Don't rush through a checklist. Let the conversation flow.`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function getTierLimit(tier: string | null): number {
  switch (tier) {
    case 'pro':
    case 'architect':
      return PRO_DAILY_LIMIT;
    case 'starter':
    case 'observatory':
    case 'observatory_pro':
      return STARTER_DAILY_LIMIT;
    default:
      return FREE_DAILY_LIMIT;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req, ['x-refresh-token']);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');

    if (!deepseekKey) {
      return corsErrorResponse(req, 'AI service not configured', 503);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate
    const token = extractBearerToken(req);
    if (!token) {
      return corsErrorResponse(req, 'Missing authorization token', 401);
    }

    const authResult = await validateToken(token);
    if (authResult.error) {
      return corsErrorResponse(req, authResult.error, authResult.statusCode ?? 401);
    }

    const userId = authResult.user!.id;

    // Get user subscription tier
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', userId)
      .single();

    const tier = sub?.tier ?? 'free';
    const dailyLimit = getTierLimit(tier);

    // Check message quota
    const { data: quota, error: quotaError } = await supabase.rpc('check_message_quota', {
      p_user_id: userId,
      p_daily_limit: dailyLimit,
    });

    if (quotaError) {
      console.error('Quota check error:', quotaError.message);
      return corsErrorResponse(req, 'Failed to check message quota', 500);
    }

    if (!quota.allowed) {
      return corsJsonResponse(
        req,
        {
          error: 'Daily message limit reached',
          quota: {
            used: quota.used,
            limit: quota.limit,
            remaining: 0,
          },
          upgrade:
            tier === 'free'
              ? {
                  message: 'Upgrade to Starter for 50 messages/day, or Pro for unlimited.',
                  url: '/pricing',
                }
              : null,
        },
        429
      );
    }

    // Parse request
    const body = await req.json();
    const { message, sessionKey, isOnboarding } = body as {
      message: string;
      sessionKey?: string;
      isOnboarding?: boolean;
    };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return corsErrorResponse(req, 'Message is required', 400);
    }

    if (message.length > 4000) {
      return corsErrorResponse(req, 'Message too long (max 4000 characters)', 400);
    }

    const effectiveSessionKey = sessionKey || 'cloud-chat-default';

    // Load or create conversation
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, messages')
      .eq('user_id', userId)
      .eq('session_key', effectiveSessionKey)
      .single();

    const previousMessages: ChatMessage[] = existingConv?.messages || [];

    // Get user profile for context
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name, role, interests, onboarding_completed')
      .eq('user_id', userId)
      .single();

    // Build message history for AI
    const systemPrompt =
      isOnboarding && !profile?.onboarding_completed
        ? ONBOARDING_SYSTEM_PROMPT
        : HELIX_SYSTEM_PROMPT;

    // Add user context if we know about them
    let contextAddendum = '';
    if (profile?.display_name) {
      contextAddendum += `\nYou know this person as "${profile.display_name}".`;
    }
    if (profile?.role) {
      contextAddendum += ` They work as a ${profile.role}.`;
    }
    if (profile?.interests?.length) {
      contextAddendum += ` Their interests include: ${profile.interests.join(', ')}.`;
    }

    const aiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt + contextAddendum },
      // Include last 20 messages for context window management
      ...previousMessages.slice(-20).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Call DeepSeek
    const aiResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: aiMessages,
        max_tokens: 1024,
        temperature: 0.8,
        top_p: 0.95,
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error('DeepSeek API error:', errBody);
      return corsErrorResponse(req, 'AI service temporarily unavailable', 502);
    }

    const aiData = await aiResponse.json();
    const assistantContent =
      aiData.choices?.[0]?.message?.content || 'I seem to be having a moment. Could you try again?';
    const tokenUsage = {
      inputTokens: aiData.usage?.prompt_tokens || 0,
      outputTokens: aiData.usage?.completion_tokens || 0,
      totalTokens: aiData.usage?.total_tokens || 0,
    };

    // Build updated messages array
    const now = new Date().toISOString();
    const newUserMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: now,
      tokenCount: tokenUsage.inputTokens,
    };
    const newAssistantMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: assistantContent,
      timestamp: now,
      tokenCount: tokenUsage.outputTokens,
    };

    const updatedMessages = [...previousMessages, newUserMessage, newAssistantMessage];

    // Upsert conversation
    await supabase.from('conversations').upsert(
      {
        user_id: userId,
        session_key: effectiveSessionKey,
        messages: updatedMessages,
        title: isOnboarding ? 'Getting to know Helix' : undefined,
        updated_at: now,
      },
      { onConflict: 'user_id,session_key' }
    );

    // Increment message count
    await supabase.rpc('increment_message_count', { p_user_id: userId });

    // Log AI operation for cost tracking
    await supabase.from('ai_operation_log').insert({
      user_id: userId,
      operation_id: isOnboarding ? 'cloud-chat-onboarding' : 'cloud-chat',
      model_used: 'deepseek-chat',
      input_tokens: tokenUsage.inputTokens,
      output_tokens: tokenUsage.outputTokens,
      total_tokens: tokenUsage.totalTokens,
      cost_usd: tokenUsage.inputTokens * 0.00000027 + tokenUsage.outputTokens * 0.0000011,
      status: 'success',
      executed_at: now,
      completed_at: now,
    });

    // Try to extract profile info from onboarding conversation
    if (isOnboarding && !profile?.onboarding_completed) {
      // Simple heuristic: after 4+ messages, mark onboarding as progressing
      if (updatedMessages.length >= 6) {
        await supabase
          .from('user_profiles')
          .update({
            onboarding_step: 'chat',
            updated_at: now,
          })
          .eq('user_id', userId);
      }
    }

    return corsJsonResponse(req, {
      message: assistantContent,
      messageId: newAssistantMessage.id,
      tokenUsage,
      quota: {
        used: (quota.used || 0) + 1,
        limit: quota.limit,
        remaining: Math.max((quota.remaining || 0) - 1, 0),
      },
    });
  } catch (error) {
    console.error('Cloud chat error:', (error as Error).message);
    return corsErrorResponse(req, 'Internal server error', 500);
  }
});
```

**Step 2: Commit**

```bash
git add web/supabase/functions/cloud-chat/index.ts
git commit -m "feat(edge): add cloud-chat endpoint with DeepSeek, message quota, and onboarding mode"
```

---

## Task 3: Cloud Chat API Client (Frontend)

**Files:**

- Create: `web/src/lib/cloud-chat-client.ts`
- Test: `web/src/lib/cloud-chat-client.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudChatClient, type ChatQuota } from './cloud-chat-client';

// Mock supabase
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('CloudChatClient', () => {
  let client: CloudChatClient;
  const mockSession = {
    access_token: 'test-token',
    refresh_token: 'test-refresh',
  };

  beforeEach(() => {
    client = new CloudChatClient();
    vi.clearAllMocks();

    const { supabase } = await import('./supabase');
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } as any);
  });

  it('should throw when not authenticated', async () => {
    const { supabase } = await import('./supabase');
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    await expect(client.sendMessage('hello')).rejects.toThrow('Not authenticated');
  });

  it('should validate message is not empty', async () => {
    await expect(client.sendMessage('')).rejects.toThrow('Message cannot be empty');
    await expect(client.sendMessage('   ')).rejects.toThrow('Message cannot be empty');
  });

  it('should validate message length', async () => {
    const longMessage = 'a'.repeat(4001);
    await expect(client.sendMessage(longMessage)).rejects.toThrow('Message too long');
  });

  it('should construct correct API URL', () => {
    expect(client.getEndpointUrl()).toContain('/functions/v1/cloud-chat');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/cloud-chat-client.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

```typescript
import { supabase } from './supabase';

export interface ChatResponse {
  message: string;
  messageId: string;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  quota: ChatQuota;
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

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(this.getEndpointUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Update user profile to mark onboarding complete
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
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

// Singleton
let chatClient: CloudChatClient | null = null;

export function getCloudChatClient(): CloudChatClient {
  if (!chatClient) {
    chatClient = new CloudChatClient();
  }
  return chatClient;
}
```

**Step 4: Run tests**

Run: `cd web && npx vitest run src/lib/cloud-chat-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/lib/cloud-chat-client.ts web/src/lib/cloud-chat-client.test.ts
git commit -m "feat(web): add CloudChatClient with quota handling, onboarding support, and profile management"
```

---

## Task 4: useCloudChat Hook

**Files:**

- Create: `web/src/hooks/useCloudChat.ts`
- Test: `web/src/hooks/useCloudChat.test.ts`

**Step 1: Write the hook**

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { getCloudChatClient, QuotaExceededError } from '@/lib/cloud-chat-client';
import type { ChatQuota } from '@/lib/cloud-chat-client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

interface UseCloudChatOptions {
  sessionKey?: string;
  isOnboarding?: boolean;
}

interface UseCloudChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  quota: ChatQuota | null;
  quotaExceeded: boolean;
  upgradeInfo: { message: string; url: string } | null;
  clearError: () => void;
  reset: () => void;
}

export function useCloudChat(options?: UseCloudChatOptions): UseCloudChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<ChatQuota | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<{ message: string; url: string } | null>(null);
  const clientRef = useRef(getCloudChatClient());

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await clientRef.current.sendMessage(content, {
          sessionKey: options?.sessionKey,
          isOnboarding: options?.isOnboarding,
        });

        const assistantMessage: ChatMessage = {
          id: response.messageId,
          role: 'assistant',
          content: response.message,
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, assistantMessage]);
        setQuota(response.quota);
        setQuotaExceeded(false);
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          setQuota(err.quota);
          setQuotaExceeded(true);
          setUpgradeInfo(err.upgrade);
          // Remove the user message since it wasn't processed
          setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        } else {
          setError((err as Error).message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, options?.sessionKey, options?.isOnboarding]
  );

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setQuota(null);
    setQuotaExceeded(false);
    setUpgradeInfo(null);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    quota,
    quotaExceeded,
    upgradeInfo,
    clearError,
    reset,
  };
}
```

**Step 2: Write the test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCloudChat } from './useCloudChat';

vi.mock('@/lib/cloud-chat-client', () => ({
  getCloudChatClient: () => ({
    sendMessage: vi.fn().mockResolvedValue({
      message: 'Hello! I am Helix.',
      messageId: 'msg-1',
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      quota: { used: 1, limit: 10, remaining: 9 },
    }),
  }),
  QuotaExceededError: class extends Error {
    quota = { used: 10, limit: 10, remaining: 0 };
    upgrade = { message: 'Upgrade', url: '/pricing' };
  },
}));

describe('useCloudChat', () => {
  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useCloudChat());
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.quotaExceeded).toBe(false);
  });

  it('should add user message optimistically on send', async () => {
    const { result } = renderHook(() => useCloudChat());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Hello');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Hello! I am Helix.');
  });

  it('should update quota after message', async () => {
    const { result } = renderHook(() => useCloudChat());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.quota).toEqual({ used: 1, limit: 10, remaining: 9 });
  });

  it('should reset state', async () => {
    const { result } = renderHook(() => useCloudChat());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.quota).toBeNull();
  });

  it('should not send empty messages', async () => {
    const { result } = renderHook(() => useCloudChat());

    await act(async () => {
      await result.current.sendMessage('');
    });

    expect(result.current.messages).toHaveLength(0);
  });
});
```

**Step 3: Run tests**

Run: `cd web && npx vitest run src/hooks/useCloudChat.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add web/src/hooks/useCloudChat.ts web/src/hooks/useCloudChat.test.ts
git commit -m "feat(web): add useCloudChat hook with optimistic updates, quota tracking, and error handling"
```

---

## Task 5: Onboarding Chat Page (UI)

**Files:**

- Create: `web/src/pages/OnboardingChat.tsx`

**IMPORTANT: Use `frontend-design` skill for this task** — the UI must be beautiful, minimalist, modern.

Design requirements:

- Dark theme matching existing Helix design system (void background, helix/accent colors)
- Full-screen chat interface — no navbar clutter, just Helix logo + minimal controls
- Messages appear with smooth framer-motion animations (fade-in-up)
- Helix's messages show a subtle gradient avatar/indicator
- User's messages right-aligned with different styling
- Input area fixed at bottom with glass-morphism effect
- Typing indicator (animated dots) while waiting for Helix response
- Subtle particle/gradient background consistent with Landing page aesthetic
- "Skip" option very subtle in top-right (small text, not a button)
- Message quota shown subtly (e.g., "8 messages remaining" in muted text)
- After 6+ messages exchanged, show a gentle "Continue to Dashboard" floating button
- Mobile-responsive — works beautifully on phone screens too
- Keyboard accessible, screen-reader friendly

**Step 1: Build the page component**

The component should:

1. Use `useCloudChat({ sessionKey: 'onboarding', isOnboarding: true })`
2. Auto-scroll to latest message
3. Show typing indicator during loading
4. Handle quota exceeded with upgrade prompt
5. Show "Continue to Dashboard" after sufficient conversation
6. Navigate to `/dashboard` on completion (calling `completeOnboarding()`)
7. No Navbar rendered on this page

**Step 2: Commit**

```bash
git add web/src/pages/OnboardingChat.tsx
git commit -m "feat(web): add OnboardingChat page with conversational first-run experience"
```

---

## Task 6: Chat Page (Post-Onboarding Cloud Chat)

**Files:**

- Create: `web/src/pages/CloudChat.tsx`

**IMPORTANT: Use `frontend-design` skill for this task**

This is the regular cloud chat page (not onboarding). Available after onboarding is complete.

Design requirements:

- Same beautiful chat UI as onboarding but with navbar visible
- Session management (title shown, option to start new session)
- Message quota indicator in bottom bar
- Upgrade prompt when quota runs low (< 3 remaining)
- Loading states, error handling
- Same dark theme, animations, glass effects

**Step 1: Build the page**

The component should:

1. Use `useCloudChat({ sessionKey: 'cloud-chat-default' })`
2. Load previous messages from conversation on mount
3. Show quota status
4. Handle all error states gracefully

**Step 2: Commit**

```bash
git add web/src/pages/CloudChat.tsx
git commit -m "feat(web): add CloudChat page for post-onboarding cloud conversations"
```

---

## Task 7: Routing & Auth Flow Updates

**Files:**

- Modify: `web/src/App.tsx`
- Modify: `web/src/components/auth/ProtectedRoute.tsx`
- Modify: `web/src/pages/Login.tsx`

**Step 1: Update ProtectedRoute to check onboarding status**

Add onboarding redirect logic: if user is authenticated but hasn't completed onboarding, redirect to `/welcome` instead of the requested page.

```typescript
// In ProtectedRoute.tsx, after auth check:
// Check localStorage first (fast), then profile API (authoritative)
const onboardingComplete = localStorage.getItem('helix_cloud_onboarding_complete') === 'true';

if (!onboardingComplete && location.pathname !== '/welcome') {
  // Check server-side profile
  const profile = await getCloudChatClient().getProfile();
  if (profile && !profile.onboardingCompleted) {
    return <Navigate to="/welcome" replace />;
  } else if (profile?.onboardingCompleted) {
    localStorage.setItem('helix_cloud_onboarding_complete', 'true');
  }
}
```

**Step 2: Add routes to App.tsx**

```typescript
// Add lazy imports
const OnboardingChat = lazy(() => import('@/pages/OnboardingChat').then(m => ({ default: m.OnboardingChat })));
const CloudChat = lazy(() => import('@/pages/CloudChat').then(m => ({ default: m.CloudChat })));

// Add routes (before dashboard route)
<Route
  path="/welcome"
  element={
    <Suspense fallback={<LoadingFallback />}>
      <ProtectedRoute skipOnboardingCheck>
        <OnboardingChat />
      </ProtectedRoute>
    </Suspense>
  }
/>
<Route
  path="/chat"
  element={
    <Suspense fallback={<LoadingFallback />}>
      <ProtectedRoute>
        <CloudChat />
      </ProtectedRoute>
    </Suspense>
  }
/>
```

**Step 3: Update Login to redirect to /welcome for new users**

After login, check if onboarding is complete. If not, redirect to `/welcome`. If yes, redirect to `/dashboard`.

**Step 4: Commit**

```bash
git add web/src/App.tsx web/src/components/auth/ProtectedRoute.tsx web/src/pages/Login.tsx
git commit -m "feat(web): add cloud onboarding routing — new users go to /welcome, returning users to /dashboard"
```

---

## Task 8: Update Navbar for Chat Access

**Files:**

- Modify: `web/src/components/layout/Navbar.tsx`

**Step 1: Add Chat link to navigation**

Add a "Chat" link in the authenticated nav items, between Dashboard and other links. Should show a subtle message count badge if quota is running low.

**Step 2: Hide Navbar on /welcome route**

The onboarding chat should be immersive — no navbar. Check current route and conditionally render.

**Step 3: Commit**

```bash
git add web/src/components/layout/Navbar.tsx
git commit -m "feat(web): add Chat to navbar, hide navbar on onboarding route"
```

---

## Task 9: Tests — Integration & Component

**Files:**

- Create: `web/src/pages/OnboardingChat.test.tsx`
- Create: `web/src/pages/CloudChat.test.tsx`

**Step 1: Write OnboardingChat tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingChat } from './OnboardingChat';

// Mock hooks
vi.mock('@/hooks/useCloudChat', () => ({
  useCloudChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    isLoading: false,
    error: null,
    quota: { used: 0, limit: 10, remaining: 10 },
    quotaExceeded: false,
    upgradeInfo: null,
    clearError: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    loading: false,
  }),
}));

describe('OnboardingChat', () => {
  it('should render chat input', () => {
    render(
      <MemoryRouter>
        <OnboardingChat />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText(/message/i)).toBeInTheDocument();
  });

  it('should show Helix branding', () => {
    render(
      <MemoryRouter>
        <OnboardingChat />
      </MemoryRouter>
    );
    expect(screen.getByAltText(/helix/i)).toBeInTheDocument();
  });

  it('should not show navbar', () => {
    render(
      <MemoryRouter>
        <OnboardingChat />
      </MemoryRouter>
    );
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
```

**Step 2: Write CloudChat tests**

Similar structure, testing:

- Message rendering
- Send button functionality
- Quota display
- Error state display

**Step 3: Run all tests**

Run: `cd web && npx vitest run src/pages/OnboardingChat.test.tsx src/pages/CloudChat.test.tsx src/hooks/useCloudChat.test.ts src/lib/cloud-chat-client.test.ts`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add web/src/pages/OnboardingChat.test.tsx web/src/pages/CloudChat.test.tsx
git commit -m "test(web): add component and integration tests for cloud chat and onboarding"
```

---

## Task 10: Full Quality Gate

**Step 1: Run TypeScript check**

Run: `cd web && npm run typecheck`
Expected: No errors

**Step 2: Run linter**

Run: `cd web && npm run lint`
Expected: No errors (fix any issues)

**Step 3: Run full test suite**

Run: `cd web && npx vitest run`
Expected: All tests pass, including existing tests

**Step 4: Run build**

Run: `cd web && npm run build`
Expected: Clean production build

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(web): cloud-first onboarding — signup to chat in 60 seconds, zero CLI required

- New cloud-chat Supabase Edge Function with DeepSeek AI
- User profiles with message quota enforcement (10/day free, 50 starter, unlimited pro)
- Conversational onboarding replaces 6-step CLI wizard
- Beautiful minimalist chat UI with framer-motion animations
- CloudChatClient with quota handling and profile management
- useCloudChat hook for React integration
- Updated routing: new users → /welcome, returning → /dashboard
- Full test coverage for all new modules
- Cost tracking via ai_operation_log integration"
```

---

## Summary: What Changed

| Before                            | After                        |
| --------------------------------- | ---------------------------- |
| 6-step wizard requiring terminal  | 2-step: signup → chat        |
| CLI installation (`curl \| bash`) | No CLI needed for web        |
| Manual .env file creation         | No .env for web users        |
| ~15-30 minutes to first message   | ~60 seconds to first message |
| Developer-only audience           | Anyone can use immediately   |

## Files Created (8)

- `web/supabase/migrations/056_cloud_onboarding.sql`
- `web/supabase/functions/cloud-chat/index.ts`
- `web/src/lib/cloud-chat-client.ts`
- `web/src/lib/cloud-chat-client.test.ts`
- `web/src/hooks/useCloudChat.ts`
- `web/src/hooks/useCloudChat.test.ts`
- `web/src/pages/OnboardingChat.tsx`
- `web/src/pages/CloudChat.tsx`

## Files Modified (4)

- `web/src/App.tsx` — new routes
- `web/src/components/auth/ProtectedRoute.tsx` — onboarding redirect
- `web/src/pages/Login.tsx` — post-login routing
- `web/src/components/layout/Navbar.tsx` — chat link + hide on onboarding
