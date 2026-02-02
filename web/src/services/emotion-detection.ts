import { loadSecret } from '@/lib/secrets-loader';
import type { EmotionAnalysis, ConversationMessage } from '@/lib/types/memory';

export class EmotionDetectionService {
  private apiKey: string | null = null;

  /**
   * Lazy-load API key from 1Password or .env fallback
   * Cached in memory for performance
   */
  private async getApiKey(): Promise<string> {
    if (this.apiKey) {
      return this.apiKey;
    }
    this.apiKey = await loadSecret('DeepSeek API Key');
    return this.apiKey;
  }

  /**
   * Analyze conversation messages for emotional content
   * Returns detailed emotional analysis with 5-dimensional model
   * Uses DeepSeek Reasoner model for accurate psychological analysis
   */
  async analyzeConversation(
    messages: ConversationMessage[]
  ): Promise<EmotionAnalysis> {
    try {
      if (!messages || messages.length === 0) {
        throw new Error('Messages array cannot be empty');
      }

      // Build conversation text
      const conversationText = messages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      const apiKey = await this.getApiKey();

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-reasoner',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(),
            },
            {
              role: 'user',
              content: `Analyze this conversation for emotional content:\n\n${conversationText}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
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

      return this.parseResponse(content);
    } catch (error) {
      console.error('Failed to analyze conversation:', error);
      throw error;
    }
  }

  /**
   * Get the system prompt for emotion analysis
   * Uses psychological frameworks for accurate analysis
   */
  private getSystemPrompt(): string {
    return `You are an expert psychologist analyzing emotional content in conversations using evidence-based psychological models.

Analyze conversations using the 5-dimensional emotion model:
- Valence: -1 (very negative) to 1 (very positive)
- Arousal: 0 (calm) to 1 (intense)
- Dominance: 0 (powerless) to 1 (empowered)
- Novelty: 0 (routine) to 1 (surprising)
- Self-relevance: 0 (external) to 1 (identity-defining)

Return ONLY valid JSON with no additional text or markdown:
{
  "primary_emotion": "string (joy, sadness, anger, fear, trust, disgust, surprise, anticipation)",
  "secondary_emotions": ["string", "string"],
  "valence": number between -1 and 1,
  "arousal": number between 0 and 1,
  "dominance": number between 0 and 1,
  "novelty": number between 0 and 1,
  "self_relevance": number between 0 and 1,
  "confidence": number between 0 and 1
}`;
  }

  /**
   * Parse the API response to extract emotion analysis
   */
  private parseResponse(content: string): EmotionAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        primary_emotion?: string;
        secondary_emotions?: string[];
        valence?: number;
        arousal?: number;
        dominance?: number;
        novelty?: number;
        self_relevance?: number;
        confidence?: number;
      };

      // Validate required fields
      if (!parsed.primary_emotion) {
        throw new Error('Missing primary_emotion in response');
      }

      // Default values for missing fields
      const secondaryEmotions = Array.isArray(parsed.secondary_emotions)
        ? parsed.secondary_emotions.filter((e) => typeof e === 'string')
        : [];

      const valence = this.clampDimension(parsed.valence ?? 0, -1, 1);
      const arousal = this.clampDimension(parsed.arousal ?? 0.5, 0, 1);
      const dominance = this.clampDimension(parsed.dominance ?? 0.5, 0, 1);
      const novelty = this.clampDimension(parsed.novelty ?? 0.5, 0, 1);
      const selfRelevance = this.clampDimension(parsed.self_relevance ?? 0.5, 0, 1);
      const confidence = this.clampDimension(parsed.confidence ?? 0.7, 0, 1);

      // Calculate salience score (0-1) based on dimensions
      const salienceScore = this.calculateSalience(
        valence,
        arousal,
        dominance,
        novelty,
        selfRelevance
      );

      // Classify salience tier
      const salienceTier = this.classifySalienceTier(salienceScore);

      return {
        primary_emotion: parsed.primary_emotion,
        secondary_emotions: secondaryEmotions,
        dimensions: {
          valence,
          arousal,
          dominance,
          novelty,
          self_relevance: selfRelevance,
        },
        salience_score: salienceScore,
        salience_tier: salienceTier,
        confidence,
      };
    } catch (error) {
      console.error('Failed to parse emotion response:', error);
      throw new Error(
        `Failed to parse emotion response: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Clamp a value between min and max
   */
  private clampDimension(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Calculate emotional salience (0-1) based on dimensions
   * Formula: salience = 0.3*self_relevance + 0.25*arousal + 0.2*novelty + 0.15*abs(valence) + 0.1*dominance
   * Based on psychological research on memory consolidation
   */
  private calculateSalience(
    valence: number,
    arousal: number,
    dominance: number,
    novelty: number,
    selfRelevance: number,
  ): number {
    // Weighted formula from psychological research
    const salienceScore =
      0.3 * selfRelevance +
      0.25 * arousal +
      0.2 * novelty +
      0.15 * Math.abs(valence) +
      0.1 * dominance;

    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, salienceScore));
  }

  /**
   * Classify salience into discrete tiers based on score
   * critical: > 0.75, high: > 0.55, medium: > 0.35, low: <= 0.35
   */
  private classifySalienceTier(
    salience: number
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (salience > 0.75) return 'critical';
    if (salience > 0.55) return 'high';
    if (salience > 0.35) return 'medium';
    return 'low';
  }
}
