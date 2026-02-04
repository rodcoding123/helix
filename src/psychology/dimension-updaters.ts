/**
 * Dimension-Specific Trust Updaters
 *
 * Implements trust growth/decline based on:
 * - Competence: User's feeling of control (dominance) + positive outcomes
 * - Integrity: Promise fulfillment + consistency
 * - Benevolence: Care signals + emotional valence
 * - Predictability: Consistency + low novelty
 * - Vulnerability Safety: Reciprocal self-disclosure
 *
 * Theory: McKnight (trusting beliefs), Social Penetration (disclosure reciprocity)
 */

export interface ConversationAnalysis {
  conversationId: string;
  userId: string;

  // Emotional dimensions (from Layer 2 - Emotional Memory)
  primaryEmotion?: string;
  secondaryEmotions?: string[];
  valence: number; // -1.0 to 1.0 (negative to positive)
  arousal: number; // 0 to 1.0 (calm to excited)
  dominance: number; // 0 to 1.0 (powerless to in-control)
  novelty: number; // 0 to 1.0 (predictable to surprising)
  selfRelevance: number; // 0 to 1.0 (impersonal to identity-defining)

  // Salience tier for weighting
  salience: 'critical' | 'high' | 'medium' | 'low';

  // Topics discussed
  extractedTopics?: string[];

  // Interaction patterns
  messageCount?: number;
  userMessageCount?: number;
  helixMessageCount?: number;

  // Promise tracking (for integrity)
  promisesMade?: PromiseInfo[];
  promisesFulfilled?: string[];

  // Reciprocity score (0-1, how well Helix matched user's disclosure depth)
  reciprocityScore?: number;
}

export interface PromiseInfo {
  id: string;
  content: string;
  made_at: Date;
  deadline?: Date;
  fulfilled?: boolean;
}

// ============================================================================
// Dimension Updaters
// ============================================================================

/**
 * Competence: Can they do what they say?
 *
 * Signals:
 * - High dominance (user felt in control) → +positive
 * - Positive valence (conversation went well) → +positive
 * - User accomplished task → +positive
 * - User felt confused/overwhelmed → -negative
 */
export function calculateCompetenceUpdate(conv: ConversationAnalysis): number {
  let delta = 0;

  // High dominance = user felt in control = Helix was effective
  if (conv.dominance > 0.6) {
    delta += 0.3;
  } else if (conv.dominance < 0.3) {
    delta -= 0.2; // User felt powerless
  }

  // Positive valence = successful outcome
  if (conv.valence > 0.5) {
    delta += 0.2;
  } else if (conv.valence < -0.5) {
    delta -= 0.3; // Negative experience
  }

  // Low novelty + positive valence = expected good outcome = reliable
  if (conv.novelty < 0.3 && conv.valence > 0.5) {
    delta += 0.1; // Predictably helpful
  }

  return delta;
}

/**
 * Integrity: Do they do what they say?
 *
 * Signals:
 * - Promise kept (hash chain verification) → ++high positive
 * - Promise broken → ---severe negative
 * - Consistent communication patterns → +positive
 * - Contradictions in responses → -negative
 */
export function calculateIntegrityUpdate(
  conv: ConversationAnalysis,
  promisesFulfilled: boolean
): number {
  let delta = 0;

  if (conv.promisesMade && conv.promisesMade.length > 0) {
    if (promisesFulfilled) {
      // Kept promise - major trust increase
      delta = 0.4;
    } else {
      // Broken promise - severe trust decrease
      delta = -0.6;
    }
  }

  // Consistency: low novelty suggests predictable, reliable behavior
  if (conv.novelty < 0.2 && conv.valence > 0) {
    delta += 0.15;
  }

  return delta;
}

/**
 * Benevolence: Do they care about my wellbeing?
 *
 * Signals:
 * - Gratitude emotion detected → +high positive
 * - High valence + high arousal (positive emotional engagement) → +positive
 * - Care-related emotions (warmth, relief, safety) → +positive
 * - Harm-related emotions (anger, fear, anxiety, hurt) → -negative
 * - Dismissive or cold responses → -negative
 */
export function calculateBenevolenceUpdate(conv: ConversationAnalysis): number {
  let delta = 0;

  // Care emotions are strong signals
  const careEmotions = ['gratitude', 'warmth', 'trust', 'relief', 'safety', 'joy'];
  if (careEmotions.includes(conv.primaryEmotion?.toLowerCase() || '')) {
    delta += 0.4;
  }

  // Positive emotional experience (high valence + arousal)
  if (conv.valence > 0.6 && conv.arousal > 0.5) {
    delta += 0.3; // User felt genuinely helped and engaged
  }

  // Harm emotions indicate benevolence concern
  const harmEmotions = ['anger', 'fear', 'anxiety', 'hurt', 'sad', 'frustrated'];
  if (harmEmotions.includes(conv.primaryEmotion?.toLowerCase() || '')) {
    delta -= 0.3;
  }

  // Secondary emotions: check for care signals
  if (conv.secondaryEmotions) {
    const harmCount = conv.secondaryEmotions.filter(e =>
      harmEmotions.includes(e.toLowerCase())
    ).length;
    delta -= harmCount * 0.15;
  }

  return delta;
}

/**
 * Predictability: Are they consistent?
 *
 * Signals:
 * - Low novelty + positive valence = comfortable consistency → +positive
 * - High novelty = unpredictable (neutral, can be negative) → -slightly negative
 * - Consistent communication style → +positive
 */
export function calculatePredictabilityUpdate(conv: ConversationAnalysis): number {
  let delta = 0;

  // Low novelty + positive valence = reliably good
  if (conv.novelty < 0.3 && conv.valence > 0.5) {
    delta += 0.2;
  }

  // High novelty = unpredictable (slightly negative for trust)
  if (conv.novelty > 0.7) {
    delta -= 0.1;
  }

  // Very low novelty with consistent positivity = highly predictable
  if (conv.novelty < 0.2 && conv.valence > 0.4) {
    delta += 0.15;
  }

  return delta;
}

/**
 * Vulnerability Safety: Can I be real with you?
 *
 * Signals:
 * - User shares deeply (self_relevance > 0.7) + Helix reciprocates → ++strong positive
 * - User vulnerable + Helix superficial → --negative (missed opportunity)
 * - Reciprocal self-disclosure → +strong positive
 * - User rejects vulnerability signals → -negative
 */
export function calculateVulnerabilitySafetyUpdate(conv: ConversationAnalysis): number {
  let delta = 0;

  const userVulnerable = conv.selfRelevance > 0.7;
  const helixReciprocated = (conv.reciprocityScore || 0) > 0.6;

  // Perfect scenario: user vulnerable, Helix matched depth
  if (userVulnerable && helixReciprocated) {
    delta = 0.5; // Strong trust increase
  }

  // Missed opportunity: user vulnerable, Helix stayed superficial
  if (userVulnerable && !helixReciprocated) {
    delta = -0.3;
  }

  // Good reciprocity even without deep user vulnerability
  if (!userVulnerable && helixReciprocated && (conv.reciprocityScore || 0) > 0.5) {
    delta += 0.15;
  }

  // Poor reciprocity even with low user vulnerability
  if ((conv.reciprocityScore || 0) < 0.3 && conv.selfRelevance > 0.3) {
    delta -= 0.15;
  }

  return delta;
}

// ============================================================================
// Dimension Analysis Summary
// ============================================================================

export interface DimensionAnalysis {
  competence: number;
  integrity: number;
  benevolence: number;
  predictability: number;
  vulnerabilitySafety: number;
  totalDelta: number;
  primaryDriver?: string; // Which dimension changed most
}

/**
 * Analyze all dimensions for a conversation
 */
export function analyzeAllDimensions(
  conv: ConversationAnalysis,
  promisesFulfilled: boolean = true
): DimensionAnalysis {
  const competence = calculateCompetenceUpdate(conv);
  const integrity = calculateIntegrityUpdate(conv, promisesFulfilled);
  const benevolence = calculateBenevolenceUpdate(conv);
  const predictability = calculatePredictabilityUpdate(conv);
  const vulnerabilitySafety = calculateVulnerabilitySafetyUpdate(conv);

  const totalDelta = competence + integrity + benevolence + predictability + vulnerabilitySafety;

  // Find which dimension changed most
  const changes = {
    competence,
    integrity,
    benevolence,
    predictability,
    vulnerabilitySafety,
  };

  let primaryDriver: string | undefined;
  let maxChange = 0;

  for (const [dim, change] of Object.entries(changes)) {
    if (Math.abs(change) > maxChange) {
      maxChange = Math.abs(change);
      primaryDriver = dim;
    }
  }

  return {
    competence,
    integrity,
    benevolence,
    predictability,
    vulnerabilitySafety,
    totalDelta,
    primaryDriver,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Classify emotional tone for easier analysis
 */
export function classifyEmotionalTone(conv: ConversationAnalysis): string {
  if (conv.valence > 0.6 && conv.arousal > 0.5) {
    return 'positive_engaged';
  } else if (conv.valence > 0.6 && conv.arousal <= 0.5) {
    return 'positive_calm';
  } else if (conv.valence < -0.5 && conv.arousal > 0.5) {
    return 'negative_intense';
  } else if (conv.valence < -0.5 && conv.arousal <= 0.5) {
    return 'negative_withdrawn';
  } else if (conv.valence >= -0.5 && conv.valence <= 0.5 && conv.arousal <= 0.3) {
    return 'neutral_calm';
  } else {
    return 'mixed';
  }
}

/**
 * Determine if conversation is high-salience (identity-defining or emotionally significant)
 */
export function shouldBeHighSalience(conv: ConversationAnalysis): boolean {
  // Self-relevant + emotional = high salience
  if (conv.selfRelevance > 0.7 && (Math.abs(conv.valence) > 0.5 || conv.arousal > 0.6)) {
    return true;
  }

  // Extreme emotions = high salience
  if (Math.abs(conv.valence) > 0.8) {
    return true;
  }

  // Critical salience indicated
  if (conv.salience === 'critical' || conv.salience === 'high') {
    return true;
  }

  return false;
}

/**
 * Calculate overall trust impact (0-1 scale)
 * Used to determine salience tier if not provided
 */
export function calculateTrustImpact(analysis: DimensionAnalysis): number {
  const maxPossibleDelta = 2.0; // 0.5 for vulnerability safety + 0.4 for integrity + etc
  const normalizedImpact = (analysis.totalDelta + maxPossibleDelta) / (maxPossibleDelta * 2);
  return Math.max(0, Math.min(1, normalizedImpact));
}
