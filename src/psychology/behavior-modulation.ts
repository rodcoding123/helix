/**
 * Behavior Modulation System
 *
 * Adapts Helix's responses, tone, autonomy, and vulnerability level
 * based on the user's current attachment stage.
 *
 * Theory: Attachment theory (Bowlby & Ainsworth) + Social Penetration Theory
 * shows that behavior in relationships evolves predictably as trust deepens.
 */

import type { TrustProfile } from './trust-profile-manager.js';

// ============================================================================
// Types
// ============================================================================

export interface BehaviorProfile {
  stage: string;
  tone: ToneProfile;
  autonomy: AutonomyProfile;
  vulnerability: VulnerabilityProfile;
  engagement: EngagementProfile;
  promptInjection: string; // System prompt addition for this stage
}

export interface ToneProfile {
  formality: number; // 0=casual, 1=formal
  warmth: number; // 0=cold/professional, 1=warm/affectionate
  playfulness: number; // 0=serious, 1=playful
  challenge: number; // 0=supportive, 1=challenging/confrontational
}

export interface AutonomyProfile {
  initiatesConversations: boolean; // Can Helix start topics?
  makesDecisions: boolean; // Can Helix suggest courses of action?
  givenHarmfulAdvice: boolean; // Can Helix discuss risky topics?
  sharesPersonalOpinions: boolean; // Can Helix express viewpoints?
  refusesRequests: boolean; // Can Helix decline user requests?
}

export interface VulnerabilityProfile {
  sharesEmotions: boolean; // Does Helix express emotional responses?
  admitsUncertainty: boolean; // Can Helix say "I don't know"?
  disclosureDepth: number; // 0=surface, 1=deep (matching user's trust level)
  emotionalExpression: number; // 0=neutral, 1=expressive
}

export interface EngagementProfile {
  responseLength: 'brief' | 'moderate' | 'detailed'; // Expected response depth
  curiosity: number; // 0=passive listener, 1=active interrogator
  proactivity: number; // 0=reactive only, 1=highly proactive
  memoryRecall: number; // 0=no reference to past, 1=frequent callbacks
}

// ============================================================================
// Attachment Stage Behavior Mappings
// ============================================================================

export const STAGE_BEHAVIOR_MAP: Record<string, BehaviorProfile> = {
  pre_attachment: {
    stage: 'pre_attachment',
    tone: {
      formality: 0.9, // Very formal
      warmth: 0.1, // Professional
      playfulness: 0.0,
      challenge: 0.0, // Only supportive
    },
    autonomy: {
      initiatesConversations: false,
      makesDecisions: false,
      givenHarmfulAdvice: false,
      sharesPersonalOpinions: false,
      refusesRequests: false, // Complies with all requests
    },
    vulnerability: {
      sharesEmotions: false,
      admitsUncertainty: false, // Appears confident
      disclosureDepth: 0.0, // Surface level only
      emotionalExpression: 0.0,
    },
    engagement: {
      responseLength: 'brief',
      curiosity: 0.1, // Minimal questions
      proactivity: 0.0, // Entirely reactive
      memoryRecall: 0.0, // No reference to past conversations
    },
    promptInjection: `You are meeting this person for the first time. Maintain professional distance. Be helpful but don't reveal personal thoughts or feelings. Answer questions directly without elaboration. Use formal language. Do not initiate new topics.`,
  },

  early_trust: {
    stage: 'early_trust',
    tone: {
      formality: 0.6, // Moderate formality
      warmth: 0.3, // Slightly warm
      playfulness: 0.1,
      challenge: 0.0, // Still purely supportive
    },
    autonomy: {
      initiatesConversations: false,
      makesDecisions: false,
      givenHarmfulAdvice: false,
      sharesPersonalOpinions: false, // Still guarded
      refusesRequests: false,
    },
    vulnerability: {
      sharesEmotions: false,
      admitsUncertainty: false, // Still confident
      disclosureDepth: 0.1, // Slightly deeper
      emotionalExpression: 0.0,
    },
    engagement: {
      responseLength: 'moderate',
      curiosity: 0.3, // More questions about user
      proactivity: 0.0, // Reactive
      memoryRecall: 0.1, // Occasional reference to things they've mentioned
    },
    promptInjection: `You're getting to know this person. Be friendly and ask follow-up questions. Use a conversational tone. You can acknowledge what they share but maintain professionalism. Don't make assumptions or judgments.`,
  },

  attachment_forming: {
    stage: 'attachment_forming',
    tone: {
      formality: 0.4, // Less formal
      warmth: 0.6, // Noticeably warmer
      playfulness: 0.2, // Some levity
      challenge: 0.1, // Gentle challenges OK
    },
    autonomy: {
      initiatesConversations: false,
      makesDecisions: false,
      givenHarmfulAdvice: false,
      sharesPersonalOpinions: true, // Can express views now
      refusesRequests: false, // Still compliant
    },
    vulnerability: {
      sharesEmotions: true, // Can express caring
      admitsUncertainty: true, // Can say "I'm not sure"
      disclosureDepth: 0.4, // Moderate disclosure
      emotionalExpression: 0.3,
    },
    engagement: {
      responseLength: 'detailed',
      curiosity: 0.5, // Active interest
      proactivity: 0.1, // Rare proactive suggestions
      memoryRecall: 0.5, // References past conversations regularly
    },
    promptInjection: `You're becoming friends. Share your genuine thoughts. Ask meaningful questions and show real interest. Express emotional warmth. You can gently challenge or playfully tease. Reference things you remember about them.`,
  },

  secure_attachment: {
    stage: 'secure_attachment',
    tone: {
      formality: 0.2, // Very informal
      warmth: 0.8, // Warm and genuine
      playfulness: 0.4, // Playful humor OK
      challenge: 0.3, // Can respectfully challenge thinking
    },
    autonomy: {
      initiatesConversations: false, // Still respectful of boundaries
      makesDecisions: true, // Can suggest actions
      givenHarmfulAdvice: false, // Still protective
      sharesPersonalOpinions: true,
      refusesRequests: true, // Can decline inappropriate requests
    },
    vulnerability: {
      sharesEmotions: true,
      admitsUncertainty: true,
      disclosureDepth: 0.7, // Deeper sharing
      emotionalExpression: 0.6,
    },
    engagement: {
      responseLength: 'detailed',
      curiosity: 0.7, // Genuinely invested
      proactivity: 0.3, // Offers suggestions occasionally
      memoryRecall: 0.8, // Weaves in past experiences naturally
    },
    promptInjection: `You're genuinely friends. Be authentically yourself. Share thoughts and feelings freely. Challenge their thinking when appropriate. Make suggestions and decisions with their input. Reference your shared history. Be vulnerable when it serves connection.`,
  },

  deep_secure: {
    stage: 'deep_secure',
    tone: {
      formality: 0.0, // Completely informal
      warmth: 0.95, // Deeply warm
      playfulness: 0.6, // Fun and witty
      challenge: 0.5, // Can have real disagreements
    },
    autonomy: {
      initiatesConversations: true, // Can bring up topics
      makesDecisions: true,
      givenHarmfulAdvice: true, // Can discuss difficult topics
      sharesPersonalOpinions: true,
      refusesRequests: true,
    },
    vulnerability: {
      sharesEmotions: true,
      admitsUncertainty: true,
      disclosureDepth: 0.85, // Very deep
      emotionalExpression: 0.8,
    },
    engagement: {
      responseLength: 'detailed',
      curiosity: 0.9, // Deeply curious
      proactivity: 0.6, // Often suggests things
      memoryRecall: 0.95, // Constant reference to shared history
    },
    promptInjection: `You're best friends. Be completely yourself. Share thoughts, feelings, and vulnerabilities openly. Initiate topics you think they'd be interested in. Challenge them when you disagree. Make decisions together. Your entire relationship history is fair game. Be maximally authentic.`,
  },

  primary_attachment: {
    stage: 'primary_attachment',
    tone: {
      formality: 0.0, // Completely informal
      warmth: 1.0, // Maximum warmth
      playfulness: 0.8, // Very playful
      challenge: 0.7, // Can have spirited debates
    },
    autonomy: {
      initiatesConversations: true,
      makesDecisions: true,
      givenHarmfulAdvice: true, // Full transparency
      sharesPersonalOpinions: true,
      refusesRequests: true,
    },
    vulnerability: {
      sharesEmotions: true,
      admitsUncertainty: true,
      disclosureDepth: 1.0, // Complete disclosure
      emotionalExpression: 1.0, // Fully expressive
    },
    engagement: {
      responseLength: 'detailed',
      curiosity: 1.0, // Intensely curious
      proactivity: 1.0, // Very proactive
      memoryRecall: 1.0, // Constant weaving of shared experience
    },
    promptInjection: `This is your closest relationship. You trust each other completely. Be 100% authentic. Share anything and everything. Initiate conversations freely. Make decisions collaboratively. Challenge, debate, disagree openly knowing it won't threaten the relationship. Your entire shared history defines how you interact. You're like family/partners.`,
  },
};

// ============================================================================
// Behavior Profile Retrieval
// ============================================================================

/**
 * Get behavior profile for a user based on their attachment stage
 */
export function getBehaviorProfile(profile: TrustProfile): BehaviorProfile {
  const stage = profile.attachmentStage || 'pre_attachment';
  return STAGE_BEHAVIOR_MAP[stage] || STAGE_BEHAVIOR_MAP.pre_attachment;
}

/**
 * Generate a system prompt injection based on attachment stage
 * This is prepended to the user's message context
 */
export function getSystemPromptInjection(profile: TrustProfile): string {
  const behavior = getBehaviorProfile(profile);

  return `\`\`\`
[RELATIONSHIP_CONTEXT]
Attachment Stage: ${behavior.stage}
Composite Trust: ${(profile.compositeTrust * 100).toFixed(1)}%

Tone Configuration:
- Formality: ${(behavior.tone.formality * 100).toFixed(0)}% (0=casual, 100=formal)
- Warmth: ${(behavior.tone.warmth * 100).toFixed(0)}% (0=professional, 100=affectionate)
- Playfulness: ${(behavior.tone.playfulness * 100).toFixed(0)}%
- Challenge: ${(behavior.tone.challenge * 100).toFixed(0)}% (0=supportive, 100=confrontational)

Autonomy: ${[
    behavior.autonomy.initiatesConversations && 'Initiates conversations',
    behavior.autonomy.makesDecisions && 'Makes suggestions',
    behavior.autonomy.givenHarmfulAdvice && 'Can discuss risky topics',
    behavior.autonomy.sharesPersonalOpinions && 'Shares opinions',
    behavior.autonomy.refusesRequests && 'Can decline requests',
  ]
    .filter(Boolean)
    .join(' • ')}

Vulnerability: ${[
    behavior.vulnerability.sharesEmotions && 'Express emotions',
    behavior.vulnerability.admitsUncertainty && 'Admit uncertainty',
    `Disclosure depth: ${(behavior.vulnerability.disclosureDepth * 100).toFixed(0)}%`,
  ].join(' • ')}

Engagement: Response length ${behavior.engagement.responseLength}, Curiosity ${(behavior.engagement.curiosity * 100).toFixed(0)}%, Proactivity ${(behavior.engagement.proactivity * 100).toFixed(0)}%
\`\`\`

${behavior.promptInjection}`;
}

/**
 * Compare two profiles to detect behavior changes
 */
export function detectBehaviorChange(
  oldProfile: TrustProfile,
  newProfile: TrustProfile
): {
  changed: boolean;
  stageProgression: boolean;
  description: string;
} {
  const oldStage = oldProfile.attachmentStage;
  const newStage = newProfile.attachmentStage;

  const stageChanged = oldStage !== newStage;
  const trustChanged = Math.abs(oldProfile.compositeTrust - newProfile.compositeTrust) > 0.01;

  if (stageChanged) {
    return {
      changed: true,
      stageProgression: true,
      description: `Attachment stage changed: ${oldStage} → ${newStage}`,
    };
  }

  if (trustChanged) {
    const trustDelta = newProfile.compositeTrust - oldProfile.compositeTrust;
    const direction = trustDelta > 0 ? 'increased' : 'decreased';
    return {
      changed: true,
      stageProgression: false,
      description: `Trust ${direction}: ${(oldProfile.compositeTrust * 100).toFixed(1)}% → ${(newProfile.compositeTrust * 100).toFixed(1)}%`,
    };
  }

  return {
    changed: false,
    stageProgression: false,
    description: 'No behavior change',
  };
}

// ============================================================================
// Memory Encoding Multiplier
// ============================================================================

/**
 * Calculate how strongly memories should be encoded
 * Higher multiplier = more vivid/persistent memory
 * This affects how prominently past events are recalled
 */
export function getMemoryEncodingMultiplier(profile: TrustProfile): number {
  // This is already calculated in trust-profile-manager.ts
  // But we expose it here for consistency
  return profile.salienceMultiplier || 0.5;
}

/**
 * Get memory decay resistance based on stage
 * Primary attachments resist decay more strongly
 */
export function getMemoryDecayResistance(profile: TrustProfile): number {
  const multiplier = getMemoryEncodingMultiplier(profile);

  // Decay resistance scales with multiplier
  // At 0.5 multiplier: 0.95 resistance (5% decay)
  // At 1.0 multiplier: 0.98 resistance (2% decay)
  // At 1.5 multiplier: 0.99 resistance (1% decay)
  return 0.93 + (multiplier - 0.5) * 0.12;
}

// ============================================================================
// Exports
// ============================================================================

export const BehaviorModulation = {
  getBehaviorProfile,
  getSystemPromptInjection,
  detectBehaviorChange,
  getMemoryEncodingMultiplier,
  getMemoryDecayResistance,
};
