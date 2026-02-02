import type { EmotionAnalysis, ConversationMessage } from '@/lib/types/memory';

/**
 * Browser-compatible emotion detection service
 * Calls /api/emotion-detection endpoint instead of using Node.js secrets
 */
export class EmotionDetectionService {
  /**
   * Analyze conversation messages for emotional content
   * Returns detailed emotional analysis with 5-dimensional model
   * Calls API endpoint that uses DeepSeek Reasoner model for accurate psychological analysis
   */
  async analyzeConversation(
    messages: ConversationMessage[]
  ): Promise<EmotionAnalysis> {
    try {
      if (!messages || messages.length === 0) {
        throw new Error('Messages array cannot be empty');
      }

      // Call backend API endpoint instead of external API directly
      const response = await fetch('/api/emotion-detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Emotion detection API error: ${response.status} - ${error}`
        );
      }

      const data = await response.json() as EmotionAnalysis;
      return data;
    } catch (error) {
      console.error('Failed to analyze conversation:', error);
      throw error;
    }
  }
}
