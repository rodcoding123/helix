import type { ExtractedTopic, ConversationMessage } from '@/lib/types/memory';

export class TopicExtractionService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async extractTopics(messages: ConversationMessage[]): Promise<ExtractedTopic[]> {
    // TODO: Implement DeepSeek chat call
    throw new Error('Not implemented');
  }

  private getPrompt(): string {
    return `Extract the 3-5 most important topics from this conversation.
Return as JSON array: ["topic1", "topic2", "topic3"]`;
  }

  private parseTopics(content: string): ExtractedTopic[] {
    // TODO: Implement parsing
    throw new Error('Not implemented');
  }
}
