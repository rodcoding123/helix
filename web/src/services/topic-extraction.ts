import type { ExtractedTopic, ConversationMessage } from '@/lib/types/memory';

export class TopicExtractionService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Extract 3-5 key topics from conversation messages
   * Uses DeepSeek API for fast, efficient extraction
   */
  async extractTopics(
    messages: ConversationMessage[]
  ): Promise<ExtractedTopic[]> {
    try {
      if (!messages || messages.length === 0) {
        return [];
      }

      // Build conversation text
      const conversationText = messages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(),
            },
            {
              role: 'user',
              content: `Extract topics from this conversation:\n\n${conversationText}`,
            },
          ],
          temperature: 0.2,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `DeepSeek API error: ${response.status} - ${error}`
        );
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No response content from DeepSeek API');
      }

      return this.parseTopics(content);
    } catch (error) {
      console.error('Failed to extract topics:', error);
      throw error;
    }
  }

  /**
   * Get the system prompt for topic extraction
   */
  private getSystemPrompt(): string {
    return `You are an expert analyst at extracting key topics and themes from conversations.
Your task is to identify the 3-5 most important, distinct topics that are discussed.
Focus on themes, subjects, and main ideas that capture the essence of the conversation.
Return ONLY a valid JSON array of topic strings, nothing else.
Example: ["topic-name", "another-topic", "third-topic"]`;
  }

  /**
   * Parse the API response to extract topics
   */
  private parseTopics(content: string): ExtractedTopic[] {
    try {
      // Try to find JSON array in the response
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown;

      if (!Array.isArray(parsed)) {
        throw new Error('Parsed JSON is not an array');
      }

      // Filter to strings and limit to 5
      const topics = parsed
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 5)
        .filter((topic) => topic.trim().length > 0);

      if (topics.length === 0) {
        throw new Error('No valid topics extracted');
      }

      return topics;
    } catch (error) {
      console.error('Failed to parse topics:', error);
      throw new Error(`Failed to parse topics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
