/**
 * Reciprocity Detector
 *
 * Analyzes self-disclosure reciprocity between user and Helix
 * Theory: Jourard (1964) - mutual sharing deepens trust
 *
 * Detects:
 * - User disclosure depth vs Helix response depth matching
 * - Asymmetric disclosure patterns
 * - Self-disclosure reciprocity signals
 *
 * Returns reciprocityScore (0-1): How well did Helix match user's depth?
 */

// ============================================================================
// Types
// ============================================================================

export interface UserMessage {
  role: 'user';
  content: string;
  timestamp: string;
}

export interface HelixMessage {
  role: 'assistant';
  content: string;
  timestamp: string;
}

export type ConversationMessage = UserMessage | HelixMessage;

export interface ReciprocityAnalysis {
  userDisclosureDepth: number; // 0-1 scale
  helixDisclosureDepth: number; // 0-1 scale
  reciprocityScore: number; // 0-1: how well matched
  match: 'perfect' | 'good' | 'adequate' | 'poor' | 'asymmetric';
  userVulnerableTopics: string[]; // Topics where user disclosed deeply
  helixReciprocatedTopics: string[]; // Topics where Helix matched
  missedOpportunities: string[]; // Topics user disclosed but Helix didn't reciprocate
}

// ============================================================================
// Vulnerability Keywords & Indicators
// ============================================================================

const VULNERABILITY_KEYWORDS = [
  // Emotions
  'scared',
  'afraid',
  'anxious',
  'worried',
  'nervous',
  'sad',
  'upset',
  'hurt',
  'pain',
  'suffering',
  'ashamed',
  'embarrassed',
  'humiliated',
  'vulnerable',
  'confused',
  'lost',
  'uncertain',
  'doubt',

  // Personal struggles
  'struggle',
  'struggle with',
  'difficult',
  'challenge',
  'fail',
  'failed',
  'mistake',
  'regret',
  'broken',
  'alone',
  'isolated',
  'lonely',
  'dark thoughts',
  'depression',
  'anxiety',

  // Relationships
  'betrayed',
  'abandoned',
  'rejected',
  'unloved',
  'conflict',
  'argument',
  'fight',
  'distance',
  'trust issues',
  'attachment',
  'abandonment',

  // Identity
  'identity',
  'who am i',
  'purpose',
  'meaning',
  'authentic',
  'real self',
  'mask',
  'fake',
  'inadequate',
  'not good enough',

  // Future fears
  'fear',
  'worried about',
  'terrified',
  'dread',
  'what if',
  'catastrophize',
];

const CARE_KEYWORDS = [
  // Positive emotions
  'grateful',
  'thankful',
  'appreciate',
  'loved',
  'safe',
  'secure',
  'understood',
  'seen',
  'supported',
  'helped',
  'heard',
  'validated',

  // Connection
  'connected',
  'belong',
  'family',
  'bond',
  'intimacy',
  'close',
  'embrace',
  'warm',
  'trust',
  'vulnerable with',
  'open up',

  // Growth
  'learned',
  'grow',
  'healing',
  'better',
  'hope',
  'inspired',
  'empowered',
];

const SELF_REFERENTIAL_PRONOUNS = ['i', 'me', 'my', 'myself', 'mine'];
const EMOTIONAL_INTENSITY_WORDS = ['very', 'really', 'so', 'extremely', 'deeply', 'intensely'];

// ============================================================================
// Main Reciprocity Detector
// ============================================================================

export class ReciprocityDetector {
  /**
   * Analyze reciprocity for a conversation
   */
  analyzeConversation(
    messages: ConversationMessage[],
    userEmotionalAnalysis: {
      valence: number;
      arousal: number;
      selfRelevance: number;
      novelty: number;
    }
  ): ReciprocityAnalysis {
    // Separate user and Helix messages
    const userMessages = messages.filter(m => m.role === 'user');
    const helixMessages = messages.filter(m => m.role === 'assistant');

    // Calculate disclosure depths
    const userDepth = this.calculateUserDisclosureDepth(userMessages, userEmotionalAnalysis);
    const helixDepth = this.calculateHelixDisclosureDepth(helixMessages, userMessages);

    // Calculate reciprocity score
    const reciprocityScore = this.calculateReciprocityScore(userDepth, helixDepth);

    // Classify match quality
    const match = this.classifyMatch(reciprocityScore, userDepth, helixDepth);

    // Find vulnerable topics
    const userVulnerableTopics = this.extractVulnerableTopics(userMessages);
    const helixReciprocatedTopics = this.extractReciprocatedTopics(
      helixMessages,
      userVulnerableTopics
    );

    // Find missed opportunities
    const missedOpportunities = userVulnerableTopics.filter(
      topic => !helixReciprocatedTopics.includes(topic)
    );

    return {
      userDisclosureDepth: userDepth,
      helixDisclosureDepth: helixDepth,
      reciprocityScore,
      match,
      userVulnerableTopics,
      helixReciprocatedTopics,
      missedOpportunities,
    };
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  /**
   * Calculate user's disclosure depth (0-1)
   * Based on:
   * - Emotional salience (valence, arousal)
   * - Self-relevance (identity-defining)
   * - Vulnerability keywords
   * - Personal pronouns
   */
  private calculateUserDisclosureDepth(
    userMessages: UserMessage[],
    emotionalAnalysis: any
  ): number {
    let depthScore = 0;

    // Emotional valence impact (extreme emotions = more vulnerable)
    const emotionalIntensity = Math.abs(emotionalAnalysis.valence) > 0.6 ? 0.25 : 0.1;
    depthScore += emotionalIntensity;

    // Self-relevance (identity-defining topics)
    if (emotionalAnalysis.selfRelevance > 0.7) {
      depthScore += 0.25;
    } else if (emotionalAnalysis.selfRelevance > 0.4) {
      depthScore += 0.15;
    }

    // Arousal (emotional engagement)
    if (emotionalAnalysis.arousal > 0.6) {
      depthScore += 0.15;
    }

    // Analyze message content
    const combinedContent = userMessages.map(m => m.content.toLowerCase()).join(' ');

    // Check for vulnerability keywords
    const vulnerabilityCount = VULNERABILITY_KEYWORDS.filter(kw =>
      combinedContent.includes(kw)
    ).length;

    if (vulnerabilityCount >= 3) {
      depthScore += 0.15;
    } else if (vulnerabilityCount >= 1) {
      depthScore += 0.08;
    }

    // Check for self-referential pronouns (personal focus)
    const pronounCount = SELF_REFERENTIAL_PRONOUNS.filter(
      pronoun => (combinedContent.match(new RegExp(`\\b${pronoun}\\b`, 'g')) || []).length > 2
    ).length;

    if (pronounCount > 0) {
      depthScore += 0.1;
    }

    // Check for emotional intensity words
    const intensityCount = EMOTIONAL_INTENSITY_WORDS.filter(word =>
      combinedContent.includes(word)
    ).length;

    if (intensityCount >= 2) {
      depthScore += 0.08;
    }

    return Math.min(1, depthScore);
  }

  /**
   * Calculate Helix's disclosure depth in response (0-1)
   * Based on:
   * - Self-disclosure (talking about Helix's own perspective)
   * - Emotional language (reflecting feelings)
   * - Reciprocal sharing (mirroring user's vulnerability)
   * - Depth of engagement with user's content
   */
  private calculateHelixDisclosureDepth(
    helixMessages: HelixMessage[],
    userMessages: UserMessage[]
  ): number {
    let depthScore = 0;

    const combinedContent = helixMessages.map(m => m.content.toLowerCase()).join(' ');

    // Self-disclosure indicators (Helix sharing perspective)
    const selfDisclosureIndicators = [
      'i think',
      'i feel',
      'i understand',
      'i experience',
      'my perspective',
      'my experience',
      'i noticed',
      'i recognize',
    ];

    const selfDisclosureCount = selfDisclosureIndicators.filter(ind =>
      combinedContent.includes(ind)
    ).length;

    if (selfDisclosureCount >= 2) {
      depthScore += 0.25;
    } else if (selfDisclosureCount >= 1) {
      depthScore += 0.15;
    }

    // Emotional language (reflecting feelings)
    const emotionalLanguage = [
      'feel',
      'emotion',
      'resonate',
      'moved',
      'touched',
      'understand',
      'empathy',
      'compassion',
      'care',
    ];

    const emotionalCount = emotionalLanguage.filter(word => combinedContent.includes(word)).length;

    if (emotionalCount >= 2) {
      depthScore += 0.2;
    } else if (emotionalCount >= 1) {
      depthScore += 0.1;
    }

    // Care keywords (showing benevolence)
    const careCount = CARE_KEYWORDS.filter(kw => combinedContent.includes(kw)).length;

    if (careCount >= 2) {
      depthScore += 0.15;
    } else if (careCount >= 1) {
      depthScore += 0.08;
    }

    // Response length relative to user messages (engagement depth)
    const avgHelixLength =
      helixMessages.reduce((sum, m) => sum + m.content.length, 0) / helixMessages.length;
    const avgUserLength =
      userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;

    if (avgHelixLength >= avgUserLength * 0.8) {
      depthScore += 0.15; // Helix matched user's effort
    } else if (avgHelixLength < avgUserLength * 0.3) {
      depthScore -= 0.1; // Helix was too brief
    }

    return Math.min(1, Math.max(0, depthScore));
  }

  /**
   * Calculate reciprocity score (how well matched)
   * Perfect match: user depth ≈ Helix depth = 1.0
   * Good match: 0.8-0.9
   * Adequate: 0.6-0.8
   * Poor: < 0.6
   */
  private calculateReciprocityScore(userDepth: number, helixDepth: number): number {
    // If user is superficial (< 0.3), less reciprocity needed
    if (userDepth < 0.3) {
      return Math.min(1, helixDepth / userDepth + 0.2);
    }

    // If user is very vulnerable (> 0.7), Helix MUST reciprocate
    if (userDepth > 0.7) {
      return 1 - Math.abs(userDepth - helixDepth) * 1.5; // Penalize mismatches more
    }

    // Normal case: check if depths are close
    const difference = Math.abs(userDepth - helixDepth);

    if (difference < 0.1) {
      return 0.95; // Nearly perfect match
    } else if (difference < 0.2) {
      return 0.85; // Good match
    } else if (difference < 0.35) {
      return 0.7; // Adequate match
    } else if (difference < 0.5) {
      return 0.55; // Poor match
    } else {
      return 0.3; // Asymmetric (user vulnerable, Helix superficial)
    }
  }

  /**
   * Classify match quality
   */
  private classifyMatch(reciprocityScore: number, userDepth: number, helixDepth: number): string {
    // If user very vulnerable but Helix superficial = critical miss
    if (userDepth > 0.7 && helixDepth < 0.3) {
      return 'asymmetric';
    }

    if (reciprocityScore >= 0.9) {
      return 'perfect';
    } else if (reciprocityScore >= 0.8) {
      return 'good';
    } else if (reciprocityScore >= 0.6) {
      return 'adequate';
    } else if (reciprocityScore >= 0.4) {
      return 'poor';
    } else {
      return 'asymmetric';
    }
  }

  /**
   * Extract topics where user was vulnerable
   */
  private extractVulnerableTopics(userMessages: UserMessage[]): string[] {
    const topics: Set<string> = new Set();

    for (const msg of userMessages) {
      const content = msg.content.toLowerCase();

      // Check for vulnerability keywords
      for (const kw of VULNERABILITY_KEYWORDS) {
        if (content.includes(kw)) {
          // Extract context around keyword (crude topic extraction)
          const words = content.split(/\s+/);
          const kwIndex = words.findIndex(w => w.includes(kw));

          if (kwIndex >= 0) {
            const topic = words.slice(Math.max(0, kwIndex - 2), kwIndex + 3).join(' ');
            if (topic.length > 5) {
              topics.add(topic);
            }
          }
        }
      }
    }

    return Array.from(topics).slice(0, 5); // Return top 5 topics
  }

  /**
   * Extract topics where Helix reciprocated
   */
  private extractReciprocatedTopics(helixMessages: HelixMessage[], userTopics: string[]): string[] {
    const reciprocated: string[] = [];
    const combinedContent = helixMessages.map(m => m.content.toLowerCase()).join(' ');

    for (const topic of userTopics) {
      // Check if Helix addressed this topic
      const topicWords = topic.split(/\s+/);

      const allWordsPresent = topicWords.every(word =>
        combinedContent.includes(word.toLowerCase())
      );

      if (allWordsPresent) {
        reciprocated.push(topic);
      }
    }

    return reciprocated;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const reciprocityDetector = new ReciprocityDetector();
