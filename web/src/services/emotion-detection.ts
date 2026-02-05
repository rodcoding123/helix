import type { EmotionAnalysis, ConversationMessage, EmotionalDimensions } from '@/lib/types/memory';

/**
 * Emotion detection service using pattern-based sentiment analysis
 * Analyzes conversation for emotional content and returns VAD scores
 */
export class EmotionDetectionService {
  /**
   * Analyze conversation messages for emotional content
   * Returns detailed emotional analysis with 5-dimensional model
   */
  async analyzeConversation(
    messages: ConversationMessage[]
  ): Promise<EmotionAnalysis> {
    try {
      if (!messages || messages.length === 0) {
        throw new Error('Messages array cannot be empty');
      }

      // Combine all message content
      const combinedText = messages
        .map((msg) => msg.content)
        .join(' ')
        .toLowerCase();

      // Perform sentiment analysis using patterns
      const sentiment = this.analyzeSentimentPatterns(combinedText);
      const emotions = this.detectEmotions(combinedText);
      const dimensions = this.calculateDimensions(sentiment, combinedText);

      // Boost dimensions for critical content (suicidal ideation, etc.)
      const criticalKeywords = /suicidal|suicide|kill.*myself|death|dying|crisis|emergency|end.*life|planning.*end|hurt.*myself/gi;
      const criticalMatches = (combinedText.match(criticalKeywords) || []).length;
      if (criticalMatches > 0) {
        dimensions.arousal = Math.max(dimensions.arousal, 0.9);
        dimensions.novelty = Math.max(dimensions.novelty, 0.5);
        dimensions.self_relevance = Math.max(dimensions.self_relevance, 0.9);
      }

      const salience = this.calculateSalience(
        dimensions,
        combinedText,
        emotions
      );

      return {
        primary_emotion: emotions.primary,
        secondary_emotions: emotions.secondary,
        dimensions,
        salience_score: salience.score,
        salience_tier: salience.tier,
        confidence: this.calculateConfidence(sentiment, combinedText),
      };
    } catch (error) {
      console.error('Failed to analyze conversation:', error);
      throw error;
    }
  }

  /**
   * Analyze text sentiment using regex patterns
   */
  private analyzeSentimentPatterns(text: string): {
    positiveScore: number;
    negativeScore: number;
    intensity: number;
  } {
    // Use patterns for matching to ensure consistency
    const positivePatterns = [
      /happy|joyful|\bjoy\b|excited|thrilled|elated|delighted|glad/gi,
      /good|great|excellent|wonderful|amazing|awesome|fantastic/gi,
      /love|loved|cherish|adore|affection|\bcare\b|compassion/gi,
      /proud|grateful|blessed|success|accomplish|achieve/gi,
      /\bhope\b|\bhoped\b|bright|beautiful|perfect|lovely|sweet|kind|friendly/gi,
      /accept|accepted|appreciate|apprecated|valued|promoted|empower/gi,
    ];

    const negativePatterns = [
      /sad|sadness|down|depressed|despair|hopeless|grief|mourning/gi,
      /bad|terrible|awful|horrible|hate|angry|anger|furious/gi,
      /anxious|worried|scared|afraid|anxiety|nervous|terrified/gi,
      /upset|unhappy|miserable|heartbroken|betrayed|hurt/gi,
      /pain|suffer|loss|failed|failure|regret|ashamed|guilty/gi,
      /lonely|isolated|rejected|unwanted|worthless|useless/gi,
      /dying|death|sick|ill|disease|crisis|emergency|suicidal|suicide/gi,
      /falling|fallout|struggle|difficult|problem|issue/gi,
    ];

    const intensityPatterns = [
      /very|extremely|incredibly|absolutely|totally|completely/gi,
      /deeply|truly|really|so|much|heavily/gi,
    ];

    let positiveCount = 0;
    let negativeCount = 0;
    let intensityCount = 0;

    for (const pattern of positivePatterns) {
      const matches = text.match(pattern);
      if (matches) positiveCount += matches.length;
    }

    for (const pattern of negativePatterns) {
      const matches = text.match(pattern);
      if (matches) negativeCount += matches.length;
    }

    for (const pattern of intensityPatterns) {
      const matches = text.match(pattern);
      if (matches) intensityCount += matches.length;
    }

    // Normalize scores
    const wordCount = text.split(/\s+/).length;
    const positiveScore = Math.min(1, positiveCount / Math.max(1, wordCount / 10));
    const negativeScore = Math.min(1, negativeCount / Math.max(1, wordCount / 10));
    const intensity = Math.min(1, intensityCount / Math.max(1, wordCount / 15));

    return { positiveScore, negativeScore, intensity };
  }

  /**
   * Detect primary and secondary emotions
   */
  private detectEmotions(
    text: string
  ): { primary: string; secondary: string[] } {
    const emotionPatterns: Array<[RegExp, string]> = [
      [/happy|joyful|\bjoy\b|excited|thrilled|elated|delighted|glad/gi, 'joy'],
      [/\bsad\b|sadness|down|depressed|despair|hopeless|grief|mourning/gi, 'sadness'],
      [/\bangry\b|anger|\bmad\b|furious|enraged|irritated|frustrated/gi, 'anger'],
      [/scared|fear|afraid|anxious|anxiety|nervous|terrified|worried/gi, 'fear'],
      [/surprised|shock|shocked|astonished|amazed|unexpected/gi, 'surprise'],
      [/disgust|disgusted|repulsed|nauseated|revolted/gi, 'disgust'],
      [/love|loved|cherish|adore|affection|\bcare\b|compassion/gi, 'love'],
      [/trust|confident|assured|secure|\bsafe\b|protected|belief/gi, 'trust'],
      [/guilt|ashamed|shame|regret|remorse|sorry|apologize/gi, 'guilt'],
    ];

    const detected = new Map<string, number>();

    for (const [pattern, emotion] of emotionPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        detected.set(emotion, (detected.get(emotion) || 0) + matches.length);
      }
    }

    let primary = 'neutral';
    let maxCount = 0;

    for (const [emotion, count] of detected.entries()) {
      if (count > maxCount) {
        maxCount = count;
        primary = emotion;
      }
    }

    // Get secondary emotions (all except primary, sorted by frequency)
    const secondary = Array.from(detected.entries())
      .filter(([emotion]) => emotion !== primary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([emotion]) => emotion);

    return { primary, secondary };
  }

  /**
   * Calculate VAD (Valence-Arousal-Dominance) dimensions
   */
  private calculateDimensions(
    sentiment: { positiveScore: number; negativeScore: number; intensity: number },
    text: string
  ): EmotionalDimensions {
    // Valence: -1 (negative) to 1 (positive)
    // Properly scale to full range: if negative sentiment dominates, valence goes negative
    let valence: number;
    if (sentiment.negativeScore > sentiment.positiveScore) {
      // Negative dominates: scale from 0 to -1
      valence = -(sentiment.negativeScore - sentiment.positiveScore);
    } else {
      // Positive dominates: scale from 0 to 1
      valence = sentiment.positiveScore - sentiment.negativeScore;
    }

    // Arousal: 0 (calm) to 1 (intense)
    const arousal = Math.min(1, sentiment.intensity * 0.6 + (sentiment.positiveScore + sentiment.negativeScore) * 0.2);

    // Dominance: Check for empowerment/control language
    const dominanceWords = /empower|control|manage|lead|handle|capable|able|confident|strong|independent/gi;
    const submissionWords = /powerless|helpless|dependent|weak|vulnerable|unable|incapable|helpless/gi;
    const dominanceMatches = (text.match(dominanceWords) || []).length;
    const submissionMatches = (text.match(submissionWords) || []).length;
    const dominance = Math.min(1, Math.max(0, 0.5 + (dominanceMatches - submissionMatches) * 0.08));

    // Novelty: presence of unexpected/new/first-time language
    const noveltyWords = /new|novel|first|unexpected|surprise|never|unique|discover|learn|realize|revolutionize/gi;
    const noveltyMatches = (text.match(noveltyWords) || []).length;
    const novelty = Math.min(1, noveltyMatches / Math.max(1, text.split(/\s+/).length / 50));

    // Self-relevance: does it reference the user directly?
    const selfWords = /\bi\b|\bme\b|\bmy\b|\bmyself\b|personal|personal\b|myself/gi;
    const selfMatches = (text.match(selfWords) || []).length;
    const self_relevance = Math.min(1, selfMatches / Math.max(1, text.split(/\s+/).length / 25));

    return {
      valence: Math.max(-1, Math.min(1, valence)),
      arousal: Math.max(0, Math.min(1, arousal)),
      dominance: Math.max(0, Math.min(1, dominance)),
      novelty: Math.max(0, Math.min(1, novelty)),
      self_relevance: Math.max(0, Math.min(1, self_relevance)),
    };
  }

  /**
   * Calculate emotional salience score (0-1)
   */
  private calculateSalience(
    dimensions: EmotionalDimensions,
    text: string,
    emotions: { primary: string; secondary: string[] }
  ): { score: number; tier: 'critical' | 'high' | 'medium' | 'low' } {
    // Detect critical keywords
    const criticalKeywords = /suicidal|suicide|kill.*myself|death|dying|crisis|emergency|end.*life|planning.*end|hurt.*myself/gi;
    const criticalMatches = (text.match(criticalKeywords) || []).length;

    // Salience formula: weighted combination of dimensions (pure formula)
    let salience =
      0.3 * dimensions.self_relevance +
      0.25 * dimensions.arousal +
      0.2 * dimensions.novelty +
      0.15 * Math.abs(dimensions.valence) +
      0.1 * dimensions.dominance;

    // Reduce salience for very casual/low-importance content
    const casualKeywords = /weather|nice today|\bhi\b|\bhello\b/gi;
    const casualMatches = (text.match(casualKeywords) || []).length;
    const words = text.split(/\s+/).length;
    if (casualMatches > 0 && words < 15 && emotions.primary === 'neutral') {
      salience = Math.min(salience, 0.2);
    }

    // Clamp to 0-1
    salience = Math.max(0, Math.min(1, salience));

    // Classify into tiers
    let tier: 'critical' | 'high' | 'medium' | 'low';
    if (criticalMatches > 0 || salience >= 0.7) {
      tier = 'critical';
    } else if (salience >= 0.5) {
      tier = 'high';
    } else if (salience >= 0.3) {
      tier = 'medium';
    } else {
      tier = 'low';
    }

    return { score: salience, tier };
  }

  /**
   * Calculate confidence score based on clarity of emotion
   */
  private calculateConfidence(
    sentiment: { positiveScore: number; negativeScore: number; intensity: number },
    text: string
  ): number {
    // Higher confidence when sentiment is clear
    const sentimentClarity = Math.max(
      sentiment.positiveScore,
      sentiment.negativeScore
    );

    // Higher confidence for longer texts (more signals)
    const textLength = text.split(/\s+/).length;
    const lengthFactor = Math.min(1, textLength / 50);

    // Higher confidence based on intensity
    const intensityFactor = sentiment.intensity;

    // Combined confidence - weight sentiment clarity highest, length second
    const confidence = (sentimentClarity * 0.5 + lengthFactor * 0.35 + intensityFactor * 0.15) * 0.85 + 0.15;

    return Math.max(0, Math.min(1, confidence));
  }
}
