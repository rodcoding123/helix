import { useState, useCallback } from 'react';
import type { Conversation, MemoryGreetingData } from '@/lib/types/memory';

export function useMemory() {
  const [memories] = useState<Conversation[]>([]);
  const [greeting] = useState<MemoryGreetingData | null>(null);
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  // TODO: These will be fully implemented in Day 5
  const storeConversation = useCallback(
    async (
      _conversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>
    ): Promise<void> => {
      // Implementation coming
      throw new Error('Not implemented');
    },
    []
  );

  const getGreeting = useCallback(
    async (_userId: string): Promise<MemoryGreetingData | null> => {
      // Implementation coming
      throw new Error('Not implemented');
    },
    []
  );

  const getSummary = useCallback(
    async (_userId: string): Promise<Conversation[]> => {
      // Implementation coming
      throw new Error('Not implemented');
    },
    []
  );

  return {
    memories,
    greeting,
    isLoading,
    error,
    storeConversation,
    getGreeting,
    getSummary
  };
}
