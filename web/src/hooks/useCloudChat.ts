import { useState, useCallback, useRef } from 'react';
import { getCloudChatClient, QuotaExceededError } from '@/lib/cloud-chat-client';
import type { ChatQuota, OnboardingStatus } from '@/lib/cloud-chat-client';

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
  onboardingReady: boolean;
  onboarding: OnboardingStatus | null;
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
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const clientRef = useRef(getCloudChatClient());

  const sendMessage = useCallback(async (content: string) => {
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
      if (response.onboarding) {
        setOnboarding(response.onboarding);
      }
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setQuota(err.quota);
        setQuotaExceeded(true);
        setUpgradeInfo(err.upgrade);
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      } else {
        setError((err as Error).message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, options?.sessionKey, options?.isOnboarding]);

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setQuota(null);
    setQuotaExceeded(false);
    setUpgradeInfo(null);
    setOnboarding(null);
  }, []);

  // Onboarding is ready when the backend signals the profile has a name
  const onboardingReady = onboarding?.step === 'chat' || onboarding?.step === 'completed';

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    quota,
    quotaExceeded,
    upgradeInfo,
    onboardingReady,
    onboarding,
    clearError,
    reset,
  };
}
