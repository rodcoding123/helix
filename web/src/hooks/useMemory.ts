import { useState, useCallback, useRef } from 'react';
import type { Conversation, MemoryGreetingData } from '@/lib/types/memory';
import { EmotionDetectionService } from '@/services/emotion-detection';
import { TopicExtractionService } from '@/services/topic-extraction';
import { EmbeddingService } from '@/services/embedding';
import { MemoryRepository } from '@/lib/repositories/memory-repository';

export function useMemory() {
  const [memories, setMemories] = useState<Conversation[]>([]);
  const [greeting, setGreeting] = useState<MemoryGreetingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize services once (lazy-loaded)
  const servicesRef = useRef<{
    emotionDetection: EmotionDetectionService;
    topicExtraction: TopicExtractionService;
    embedding: EmbeddingService;
    repository: MemoryRepository;
  } | null>(null);

  const getServices = useCallback(() => {
    if (!servicesRef.current) {
      servicesRef.current = {
        emotionDetection: new EmotionDetectionService(),
        topicExtraction: new TopicExtractionService(),
        embedding: new EmbeddingService(),
        repository: new MemoryRepository(),
      };
    }
    return servicesRef.current;
  }, []);

  /**
   * Store a new conversation with full emotional analysis
   * Pipeline: emotion detection → topic extraction → embedding → store to DB
   */
  const storeConversation = useCallback(
    async (
      conversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>
    ): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();

        // Step 1: Analyze emotions
        const emotionAnalysis = await services.emotionDetection.analyzeConversation(
          conversation.messages
        );

        // Step 2: Extract topics
        const topics = await services.topicExtraction.extractTopics(
          conversation.messages
        );

        // Step 3: Generate embedding
        const conversationText = conversation.messages
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n');
        const embeddingVector = await services.embedding.generateEmbedding(conversationText);

        // Step 4: Store to database
        const fullConversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at'> = {
          ...conversation,
          primary_emotion: emotionAnalysis.primary_emotion,
          secondary_emotions: emotionAnalysis.secondary_emotions,
          valence: emotionAnalysis.dimensions.valence,
          arousal: emotionAnalysis.dimensions.arousal,
          dominance: emotionAnalysis.dimensions.dominance,
          novelty: emotionAnalysis.dimensions.novelty,
          self_relevance: emotionAnalysis.dimensions.self_relevance,
          emotional_salience: emotionAnalysis.salience_score,
          salience_tier: emotionAnalysis.salience_tier,
          extracted_topics: topics,
          embedding: embeddingVector,
        };

        const storedConversation = await services.repository.storeConversation(
          fullConversation
        );

        // Update memories list
        setMemories((prev) => [storedConversation, ...prev]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to store conversation:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  /**
   * Get the most recent conversation for Day 2 greeting
   * Returns formatted greeting data showing last topic and emotion
   */
  const getGreeting = useCallback(
    async (userId: string): Promise<MemoryGreetingData | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();

        // Fetch the most recent conversation
        const recentMemories = await services.repository.getRecentMemories(userId, 1, 0);

        if (recentMemories.length === 0) {
          setGreeting(null);
          return null;
        }

        const lastConversation = recentMemories[0];

        // Format timestamp as human-readable string
        const formatTimeAgo = (date: Date): string => {
          const now = Date.now();
          const then = new Date(date).getTime();
          const diffMs = now - then;
          const diffSecs = Math.floor(diffMs / 1000);
          const diffMins = Math.floor(diffSecs / 60);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);

          if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
          if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
          if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
          return 'just now';
        };

        // Format greeting data
        const greetingData: MemoryGreetingData = {
          conversation_id: lastConversation.id,
          summary: lastConversation.messages?.[0]?.content?.substring(0, 150) || '',
          topics: lastConversation.extracted_topics || [],
          emotions: [lastConversation.primary_emotion, ...lastConversation.secondary_emotions],
          when: formatTimeAgo(lastConversation.created_at),
        };

        setGreeting(greetingData);
        return greetingData;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to get greeting:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  /**
   * Get recent conversations for memory dashboard
   * Fetches and displays memories with pagination support
   */
  const getSummary = useCallback(
    async (userId: string, limit: number = 10, offset: number = 0): Promise<Conversation[]> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();
        const recentMemories = await services.repository.getRecentMemories(userId, limit, offset);
        setMemories(recentMemories);
        return recentMemories;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to get summary:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  return {
    memories,
    greeting,
    isLoading,
    error,
    storeConversation,
    getGreeting,
    getSummary,
  };
}
