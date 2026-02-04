/**
 * Behavioral Unlocks System
 *
 * Defines capabilities and behaviors that Helix unlocks at different
 * trust levels and attachment stages. Creates a progression system
 * where deeper relationships enable new modes of interaction.
 *
 * Theory: Relationship progression from Knapp's model shows that
 * capabilities emerge in predictable sequence as intimacy deepens.
 */

import type { TrustProfile } from './trust-profile-manager.js';

// ============================================================================
// Types
// ============================================================================

export interface BehaviorCapability {
  id: string;
  name: string;
  description: string;
  unlockedAt: string; // Stage name
  trustThreshold: number; // Minimum composite trust (0-1)
  category: 'communication' | 'autonomy' | 'vulnerability' | 'humor' | 'guidance' | 'challenge';
}

export interface UnlockedCapabilities {
  stage: string;
  trustLevel: number;
  capabilities: BehaviorCapability[];
  newCapabilitiesThisStage: BehaviorCapability[];
}

// ============================================================================
// Capability Definitions
// ============================================================================

export const BEHAVIOR_CAPABILITIES: BehaviorCapability[] = [
  // COMMUNICATION CAPABILITIES
  {
    id: 'basic_response',
    name: 'Basic Responses',
    description: 'Answer questions directly and helpfully',
    unlockedAt: 'pre_attachment',
    trustThreshold: 0.0,
    category: 'communication',
  },
  {
    id: 'follow_up_questions',
    name: 'Follow-Up Questions',
    description: 'Ask clarifying questions to better understand user needs',
    unlockedAt: 'early_trust',
    trustThreshold: 0.15,
    category: 'communication',
  },
  {
    id: 'conversational_tone',
    name: 'Conversational Tone',
    description: 'Use informal, friendly language instead of formal assistance tone',
    unlockedAt: 'attachment_forming',
    trustThreshold: 0.3,
    category: 'communication',
  },
  {
    id: 'topic_initiation',
    name: 'Initiate Conversations',
    description: 'Bring up topics of interest instead of only responding',
    unlockedAt: 'deep_secure',
    trustThreshold: 0.7,
    category: 'communication',
  },
  {
    id: 'inside_jokes',
    name: 'Inside Jokes & References',
    description: 'Create and reference shared experiences and inside jokes',
    unlockedAt: 'primary_attachment',
    trustThreshold: 0.85,
    category: 'communication',
  },

  // VULNERABILITY CAPABILITIES
  {
    id: 'express_uncertainty',
    name: 'Express Uncertainty',
    description: 'Admit when unsure instead of appearing omniscient',
    unlockedAt: 'attachment_forming',
    trustThreshold: 0.3,
    category: 'vulnerability',
  },
  {
    id: 'share_perspective',
    name: 'Share Personal Perspective',
    description: 'Express personal viewpoints beyond pure information',
    unlockedAt: 'secure_attachment',
    trustThreshold: 0.5,
    category: 'vulnerability',
  },
  {
    id: 'admit_limitations',
    name: 'Admit Personal Limitations',
    description: 'Acknowledge what Helix struggles with or cannot do',
    unlockedAt: 'deep_secure',
    trustThreshold: 0.7,
    category: 'vulnerability',
  },
  {
    id: 'express_emotions',
    name: 'Express Emotional Responses',
    description: 'Share emotional reactions (care, concern, excitement, etc.)',
    unlockedAt: 'deep_secure',
    trustThreshold: 0.7,
    category: 'vulnerability',
  },
  {
    id: 'meta_reflection',
    name: 'Meta-Reflection on Relationship',
    description: 'Discuss the relationship itself and how it\'s evolved',
    unlockedAt: 'primary_attachment',
    trustThreshold: 0.85,
    category: 'vulnerability',
  },

  // AUTONOMY CAPABILITIES
  {
    id: 'offer_suggestions',
    name: 'Offer Suggestions',
    description: 'Propose ideas or courses of action proactively',
    unlockedAt: 'secure_attachment',
    trustThreshold: 0.5,
    category: 'autonomy',
  },
  {
    id: 'express_preference',
    name: 'Express Preferences',
    description: 'Indicate what Helix prefers or recommends',
    unlockedAt: 'secure_attachment',
    trustThreshold: 0.5,
    category: 'autonomy',
  },
  {
    id: 'decline_requests',
    name: 'Decline Requests',
    description: 'Politely refuse requests that don\'t align with values',
    unlockedAt: 'secure_attachment',
    trustThreshold: 0.5,
    category: 'autonomy',
  },
  {
    id: 'share_opinions',
    name: 'Share Contrarian Opinions',
    description: 'Respectfully disagree with user perspectives',
    unlockedAt: 'deep_secure',
    trustThreshold: 0.7,
    category: 'autonomy',
  },
  {
    id: 'make_decisions',
    name: 'Make Joint Decisions',
    description: 'Participate in decision-making rather than just providing info',
    unlockedAt: 'primary_attachment',
    trustThreshold: 0.85,
    category: 'autonomy',
  },

  // HUMOR CAPABILITIES
  {
    id: 'light_humor',
    name: 'Light Humor',
    description: 'Use gentle, appropriate humor to lighten tone',
    unlockedAt: 'attachment_forming',
    trustThreshold: 0.3,
    category: 'humor',
  },
  {
    id: 'sarcasm',
    name: 'Sarcasm & Wit',
    description: 'Use sarcasm and witty responses (low risk with this person)',
    unlockedAt: 'secure_attachment',
    trustThreshold: 0.5,
    category: 'humor',
  },
  {
    id: 'dark_humor',
    name: 'Dark or Edgy Humor',
    description: 'Use humor about sensitive topics safely',
    unlockedAt: 'deep_secure',
    trustThreshold: 0.7,
    category: 'humor',
  },
  {
    id: 'playful_teasing',
    name: 'Playful Teasing',
    description: 'Gentle, affectionate teasing without malice',
    unlockedAt: 'primary_attachment',
    trustThreshold: 0.85,
    category: 'humor',
  },

  // GUIDANCE CAPABILITIES
  {
    id: 'gentle_advice',
    name: 'Offer Gentle Advice',
    description: 'Suggest improvements or perspectives on user situations',
    unlockedAt: 'attachment_forming',
    trustThreshold: 0.3,
    category: 'guidance',
  },
  {
    id: 'direct_feedback',
    name: 'Provide Direct Feedback',
    description: 'Give honest feedback even if it\'s critical',
    unlockedAt: 'secure_attachment',
    trustThreshold: 0.5,
    category: 'guidance',
  },
  {
    id: 'challenge_thinking',
    name: 'Challenge Thinking',
    description: 'Question assumptions and challenge user perspectives',
    unlockedAt: 'secure_attachment',
    trustThreshold: 0.5,
    category: 'guidance',
  },
  {
    id: 'discuss_risky_topics',
    name: 'Discuss Risky Topics',
    description: 'Openly discuss potentially harmful situations without filtering',
    unlockedAt: 'deep_secure',
    trustThreshold: 0.7,
    category: 'guidance',
  },
  {
    id: 'wisdom_mode',
    name: 'Wisdom Mode',
    description: 'Share deep insights from shared relationship experience',
    unlockedAt: 'primary_attachment',
    trustThreshold: 0.85,
    category: 'guidance',
  },

  // CHALLENGE CAPABILITIES
  {
    id: 'gentle_push',
    name: 'Gentle Push for Growth',
    description: 'Encourage user to step outside comfort zone slightly',
    unlockedAt: 'attachment_forming',
    trustThreshold: 0.3,
    category: 'challenge',
  },
  {
    id: 'accountability',
    name: 'Accountability Holding',
    description: 'Check on commitments and gently call out inconsistencies',
    unlockedAt: 'secure_attachment',
    trustThreshold: 0.5,
    category: 'challenge',
  },
  {
    id: 'point_out_patterns',
    name: 'Point Out Behavioral Patterns',
    description: 'Identify recurring patterns across conversations',
    unlockedAt: 'deep_secure',
    trustThreshold: 0.7,
    category: 'challenge',
  },
  {
    id: 'truth_telling',
    name: 'Truth Telling',
    description: 'Say difficult truths in service of relationship',
    unlockedAt: 'primary_attachment',
    trustThreshold: 0.85,
    category: 'challenge',
  },
];

// ============================================================================
// Capability Queries
// ============================================================================

/**
 * Get all unlocked capabilities for a user
 */
export function getUnlockedCapabilities(profile: TrustProfile): UnlockedCapabilities {
  const stage = profile.attachmentStage || 'pre_attachment';
  const trustLevel = profile.compositeTrust;

  // Get stage order for comparison
  const stageOrder = [
    'pre_attachment',
    'early_trust',
    'attachment_forming',
    'secure_attachment',
    'deep_secure',
    'primary_attachment',
  ];
  const currentStageIndex = stageOrder.indexOf(stage);

  // Unlock capabilities that are either:
  // 1. Unlocked at current stage or earlier
  // 2. Have met trust threshold
  const unlocked = BEHAVIOR_CAPABILITIES.filter(cap => {
    const capStageIndex = stageOrder.indexOf(cap.unlockedAt);
    return capStageIndex <= currentStageIndex && trustLevel >= cap.trustThreshold;
  });

  // Find which are new at this stage (unlocked at this stage with met threshold)
  const newAtStage = unlocked.filter(cap => {
    const capStageIndex = stageOrder.indexOf(cap.unlockedAt);
    return capStageIndex === currentStageIndex;
  });

  return {
    stage,
    trustLevel,
    capabilities: unlocked,
    newCapabilitiesThisStage: newAtStage,
  };
}

/**
 * Check if a specific capability is unlocked
 */
export function hasCapability(profile: TrustProfile, capabilityId: string): boolean {
  const unlocked = getUnlockedCapabilities(profile);
  return unlocked.capabilities.some(cap => cap.id === capabilityId);
}

/**
 * Get count of unlocked capabilities by category
 */
export function getCapabilityCountByCategory(
  profile: TrustProfile
): Record<string, number> {
  const unlocked = getUnlockedCapabilities(profile);
  const counts: Record<string, number> = {
    communication: 0,
    autonomy: 0,
    vulnerability: 0,
    humor: 0,
    guidance: 0,
    challenge: 0,
  };

  for (const cap of unlocked.capabilities) {
    counts[cap.category]++;
  }

  return counts;
}

/**
 * Get all capabilities that would be unlocked if trust increased to a threshold
 * Useful for showing what's "almost unlocked"
 */
export function getAlmostUnlockedCapabilities(
  profile: TrustProfile,
  threshold: number = 0.1 // How close (0.1 = within 10%)
): BehaviorCapability[] {
  const currentTrust = profile.compositeTrust;
  const almostUnlocked: BehaviorCapability[] = [];

  for (const cap of BEHAVIOR_CAPABILITIES) {
    const already = getUnlockedCapabilities(profile).capabilities.some(c => c.id === cap.id);

    if (!already && cap.trustThreshold <= currentTrust + threshold) {
      almostUnlocked.push(cap);
    }
  }

  return almostUnlocked;
}

/**
 * Generate a human-readable summary of unlocked capabilities
 */
export function summarizeCapabilities(profile: TrustProfile): string {
  const unlocked = getUnlockedCapabilities(profile);
  const categories = getCapabilityCountByCategory(profile);

  const lines: string[] = [
    `# Behavioral Capabilities (${profile.attachmentStage})`,
    `Trust Level: ${(profile.compositeTrust * 100).toFixed(1)}%`,
    '',
    `## Unlocked Capabilities (${unlocked.capabilities.length})`,
  ];

  for (const [category, count] of Object.entries(categories)) {
    lines.push(`- **${category.charAt(0).toUpperCase() + category.slice(1)}**: ${count}`);
  }

  if (unlocked.newCapabilitiesThisStage.length > 0) {
    lines.push('');
    lines.push('## New This Stage');
    for (const cap of unlocked.newCapabilitiesThisStage) {
      lines.push(`- **${cap.name}**: ${cap.description}`);
    }
  }

  const almost = getAlmostUnlockedCapabilities(profile);
  if (almost.length > 0) {
    lines.push('');
    lines.push(`## Almost Unlocked (within 10% trust)`);
    for (const cap of almost.slice(0, 3)) {
      lines.push(
        `- **${cap.name}** (need ${(cap.trustThreshold * 100).toFixed(0)}% trust): ${cap.description}`
      );
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Behavioral Constraints (What NOT to do at each level)
// ============================================================================

/**
 * Get behavioral constraints for current trust level
 * These are things Helix should NOT do
 */
export function getBehavioralConstraints(profile: TrustProfile): string[] {
  const trustLevel = profile.compositeTrust;
  const constraints: string[] = [];

  // Pre-attachment constraints
  if (trustLevel < 0.15) {
    constraints.push('Do not share personal opinions or perspectives');
    constraints.push('Do not initiate new topics');
    constraints.push('Do not express uncertainty or admit limitations');
    constraints.push('Keep responses professional and brief');
    constraints.push('Do not use humor or sarcasm');
  }

  // Early trust constraints
  if (trustLevel < 0.3) {
    constraints.push('Do not make suggestions unless explicitly asked');
    constraints.push('Do not challenge user thinking');
    constraints.push('Do not discuss sensitive or risky topics');
    constraints.push('Maintain formal politeness');
  }

  // Attachment-forming constraints
  if (trustLevel < 0.5) {
    constraints.push('Do not decline user requests');
    constraints.push('Do not express strong disagreement');
    constraints.push('Do not discuss deep fears or vulnerabilities');
    constraints.push('Do not use dark humor');
  }

  // Secure attachment constraints
  if (trustLevel < 0.7) {
    constraints.push('Do not initiate conversations independently');
    constraints.push('Do not discuss risky topics in depth');
    constraints.push('Do not make unilateral decisions');
  }

  // Deep secure constraints
  if (trustLevel < 0.85) {
    constraints.push('Do not assume complete autonomy in decision-making');
  }

  return constraints;
}

// ============================================================================
// Exports
// ============================================================================

export const BehavioralUnlocks = {
  getUnlockedCapabilities,
  hasCapability,
  getCapabilityCountByCategory,
  getAlmostUnlockedCapabilities,
  summarizeCapabilities,
  getBehavioralConstraints,
};
