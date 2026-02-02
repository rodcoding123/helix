import type { EmotionAnalysis, ConversationMessage } from '@/lib/types/memory';

export class EmotionDetectionService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeConversation(messages: ConversationMessage[]): Promise<EmotionAnalysis> {
    // TODO: Implement DeepSeek reasoner call
    // Will implement in Day 2
    throw new Error('Not implemented');
  }

  private getPrompt(): string {
    return `You are an expert psychologist analyzing emotional content.

Analyze the conversation for:
1. PRIMARY EMOTION (dominant feeling)
2. SECONDARY EMOTIONS (2-3 supporting feelings)
3. DIMENSIONAL ANALYSIS:
   - Valence: -1 (very negative) to 1 (very positive)
   - Arousal: 0 (calm) to 1 (intense)
   - Dominance: 0 (powerless) to 1 (empowered)
   - Novelty: 0 (routine) to 1 (surprising)
   - Self-relevance: 0 (external) to 1 (identity-defining)

Return ONLY valid JSON (no markdown):
{
  "primary_emotion": "string",
  "secondary_emotions": ["string", "string"],
  "valence": number,
  "arousal": number,
  "dominance": number,
  "novelty": number,
  "self_relevance": number,
  "confidence": number
}`;
  }

  private parseResponse(content: string): EmotionAnalysis {
    // TODO: Implement parsing
    throw new Error('Not implemented');
  }
}
