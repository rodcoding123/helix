import type { ExtractedTopic, ConversationMessage } from '@/lib/types/memory';

/**
 * Browser-compatible topic extraction service
 * Calls /api/topic-extraction endpoint instead of using DeepSeek API directly
 */
export class TopicExtractionService {
  /**
   * Extract 3-5 key topics from conversation messages
   * Uses API endpoint that calls DeepSeek for fast, efficient extraction
   */
  async extractTopics(
    messages: ConversationMessage[]
  ): Promise<ExtractedTopic[]> {
    try {
      if (!messages || messages.length === 0) {
        return [];
      }

      const response = await fetch('/api/topic-extraction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Topic extraction API error: ${response.status} - ${error}`
        );
      }

      const data = await response.json() as { topics: ExtractedTopic[] };
      return data.topics;
    } catch (error) {
      console.error('Failed to extract topics:', error);
      throw error;
    }
  }
}
