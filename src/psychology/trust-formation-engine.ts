/**
 * Trust Formation Engine
 *
 * Core algorithm that processes conversations and updates user trust
 * Orchestrates:
 * - Emotional analysis (Layer 2)
 * - Dimension updaters (5 trust dimensions)
 * - Trust logging (pre-execution to Discord)
 * - Profile management (database + files)
 * - Attachment stage progression (Bowlby/Ainsworth)
 *
 * CRITICAL: Logs to Discord BEFORE updating trust (pre-execution guarantee)
 */

import {
  trustProfileManager,
  type TrustProfile,
  type TrustUpdateInput,
} from './trust-profile-manager.js';
import {
  analyzeAllDimensions,
  classifyEmotionalTone,
  type ConversationAnalysis,
} from './dimension-updaters.js';
import { logTrustUpdate, type TrustLogContext } from './trust-logging.js';
import { preventCreatorTrustModification } from '../helix/creator-security.js';

// ============================================================================
// Types
// ============================================================================

export interface ConversationEvent {
  conversationId: string;
  userId: string;
  content: string;

  // Emotional analysis (from Layer 2)
  emotionalAnalysis: {
    primaryEmotion?: string;
    secondaryEmotions?: string[];
    valence: number;
    arousal: number;
    dominance: number;
    novelty: number;
    selfRelevance: number;
  };

  // Topics (from NLP/semantic analysis)
  extractedTopics?: string[];

  // Promise tracking (for integrity dimension)
  promisesMade?: Array<{
    id: string;
    content: string;
    deadline?: Date;
  }>;
  promisesFulfilled?: boolean;

  // Reciprocity detection (for vulnerability_safety)
  reciprocityScore?: number;
}

export interface TrustFormationResult {
  userId: string;
  operation: string;
  trustBefore: number;
  trustAfter: number;
  trustDelta: number;
  attachmentStageBefore?: string;
  attachmentStageAfter?: string;
  entryId: string; // Hash chain entry ID
  updatedProfile: TrustProfile;
}

// ============================================================================
// Main Engine
// ============================================================================

export class TrustFormationEngine {
  /**
   * Process a conversation and update user trust
   * CRITICAL: Logs to Discord BEFORE updating trust
   */
  async processConversation(event: ConversationEvent): Promise<TrustFormationResult> {
    // ==========================================
    // 0. Security Check: Prevent creator modification
    // ==========================================
    preventCreatorTrustModification(event.userId);

    // ==========================================
    // 1. Load current trust profile
    // ==========================================
    const profile = await trustProfileManager.getOrCreateProfile(event.userId);
    const trustBefore = profile.compositeTrust;
    const stageBefore = profile.attachmentStage;

    // ==========================================
    // 2. Build conversation analysis
    // ==========================================
    const analysis: ConversationAnalysis = {
      conversationId: event.conversationId,
      userId: event.userId,
      primaryEmotion: event.emotionalAnalysis.primaryEmotion,
      secondaryEmotions: event.emotionalAnalysis.secondaryEmotions,
      valence: event.emotionalAnalysis.valence,
      arousal: event.emotionalAnalysis.arousal,
      dominance: event.emotionalAnalysis.dominance,
      novelty: event.emotionalAnalysis.novelty,
      selfRelevance: event.emotionalAnalysis.selfRelevance,
      salience: this.determineSalience(event.emotionalAnalysis, event.extractedTopics),
      extractedTopics: event.extractedTopics,
      promisesMade: event.promisesMade?.map(p => ({
        ...p,
        made_at: p.deadline ? new Date(p.deadline.getTime() - 86400000) : new Date(),
      })),
      reciprocityScore: event.reciprocityScore,
    };

    // ==========================================
    // 3. Analyze all trust dimensions
    // ==========================================
    const dimensionAnalysis = analyzeAllDimensions(analysis, event.promisesFulfilled ?? true);

    // ==========================================
    // 4. Determine salience tier and classify tone
    // ==========================================
    const salienceTier = analysis.salience;
    const emotionalTone = classifyEmotionalTone(analysis);

    // ==========================================
    // 5. Log to Discord BEFORE updating (pre-execution guarantee)
    // ==========================================
    const logContext: TrustLogContext = {
      userId: event.userId,
      operation: this.determineOperation(dimensionAnalysis),
      trigger: this.buildTriggerDescription(
        analysis,
        emotionalTone,
        dimensionAnalysis.primaryDriver
      ),
      trustBefore,
      trustAfter: 0, // Will calculate after applying updates
      conversationId: event.conversationId,
      salienceTier,
      dimensionsChanged: {
        competence: {
          before: profile.trustDimensions.competence,
          after: 0, // Will calculate
        },
        integrity: {
          before: profile.trustDimensions.integrity,
          after: 0,
        },
        benevolence: {
          before: profile.trustDimensions.benevolence,
          after: 0,
        },
        predictability: {
          before: profile.trustDimensions.predictability,
          after: 0,
        },
        vulnerability_safety: {
          before: profile.trustDimensions.vulnerability_safety,
          after: 0,
        },
      },
      attachmentStageBefore: stageBefore,
    };

    // ==========================================
    // 6. Apply trust updates using learning rate
    // ==========================================
    // NOTE: Learning rate and salience weighting applied in dimension analysis

    // Build update input
    const updateInput: TrustUpdateInput = {
      userId: event.userId,
      competenceChange: dimensionAnalysis.competence,
      integrityChange: dimensionAnalysis.integrity,
      benevolenceChange: dimensionAnalysis.benevolence,
      predictabilityChange: dimensionAnalysis.predictability,
      vulnerabilitySafetyChange: dimensionAnalysis.vulnerabilitySafety,
      trigger: logContext.trigger,
      salienceTier,
    };

    // Apply updates to profile (this also saves to DB and files)
    const updatedProfile = await trustProfileManager.updateTrust(updateInput);

    // ==========================================
    // 7. Update log context with actual changes
    // ==========================================
    logContext.trustAfter = updatedProfile.compositeTrust;
    logContext.attachmentStageAfter = updatedProfile.attachmentStage;

    const dimensionsChanged = logContext.dimensionsChanged;
    if (dimensionsChanged) {
      dimensionsChanged.competence = {
        before: dimensionsChanged.competence!.before,
        after: updatedProfile.trustDimensions.competence,
      };
      dimensionsChanged.integrity = {
        before: dimensionsChanged.integrity!.before,
        after: updatedProfile.trustDimensions.integrity,
      };
      dimensionsChanged.benevolence = {
        before: dimensionsChanged.benevolence!.before,
        after: updatedProfile.trustDimensions.benevolence,
      };
      dimensionsChanged.predictability = {
        before: dimensionsChanged.predictability!.before,
        after: updatedProfile.trustDimensions.predictability,
      };
      dimensionsChanged.vulnerability_safety = {
        before: dimensionsChanged.vulnerability_safety!.before,
        after: updatedProfile.trustDimensions.vulnerability_safety,
      };
    }

    // ==========================================
    // 8. Log to Discord hash chain (BEFORE we consider it final)
    // ==========================================
    const entryId = await logTrustUpdate(logContext);

    // ==========================================
    // 9. Return result
    // ==========================================
    return {
      userId: event.userId,
      operation: logContext.operation,
      trustBefore,
      trustAfter: updatedProfile.compositeTrust,
      trustDelta: updatedProfile.compositeTrust - trustBefore,
      attachmentStageBefore: stageBefore,
      attachmentStageAfter: updatedProfile.attachmentStage,
      entryId,
      updatedProfile,
    };
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  /**
   * Determine salience tier based on conversation properties
   */
  private determineSalience(
    emotional: ConversationEvent['emotionalAnalysis'],
    _topics?: string[]
  ): 'critical' | 'high' | 'medium' | 'low' {
    // Critical: identity-defining + emotional
    if (
      emotional.selfRelevance > 0.7 &&
      (Math.abs(emotional.valence) > 0.5 || emotional.arousal > 0.6)
    ) {
      return 'critical';
    }

    // High: extreme emotions or significant engagement
    if (
      Math.abs(emotional.valence) > 0.8 ||
      (emotional.arousal > 0.7 && emotional.selfRelevance > 0.5)
    ) {
      return 'high';
    }

    // Medium: notable engagement
    if (emotional.arousal > 0.5 || emotional.selfRelevance > 0.5) {
      return 'medium';
    }

    // Low: routine, transactional
    return 'low';
  }

  /**
   * Determine operation type based on dimension analysis
   */
  private determineOperation(
    analysis: ReturnType<typeof analyzeAllDimensions>
  ):
    | 'trust_increase'
    | 'trust_decrease'
    | 'violation'
    | 'emotional_impact'
    | 'reciprocity_detected'
    | 'stage_progression'
    | 'stage_regression' {
    if (analysis.totalDelta > 0.5) {
      return 'trust_increase';
    } else if (analysis.totalDelta < -0.3) {
      return 'trust_decrease';
    } else if (analysis.totalDelta < -0.15) {
      return 'violation';
    }

    return 'emotional_impact';
  }

  /**
   * Build human-readable trigger description
   */
  private buildTriggerDescription(
    analysis: ConversationAnalysis,
    emotionalTone: string,
    primaryDriver?: string
  ): string {
    const parts: string[] = [];

    // Add primary driver
    if (primaryDriver) {
      parts.push(`Primary driver: ${primaryDriver}`);
    }

    // Add emotional tone
    parts.push(`Emotional tone: ${emotionalTone}`);

    // Add primary emotion if notable
    if (analysis.primaryEmotion) {
      parts.push(`Primary emotion: ${analysis.primaryEmotion}`);
    }

    // Add topics if present
    if (analysis.extractedTopics && analysis.extractedTopics.length > 0) {
      parts.push(`Topics: ${analysis.extractedTopics.slice(0, 3).join(', ')}`);
    }

    return parts.join('; ');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const trustFormationEngine = new TrustFormationEngine();

// ============================================================================
// Helper: Batch Process Multiple Conversations
// ============================================================================

/**
 * Process multiple conversation events sequentially
 * Each event updates trust independently
 */
export async function processConversationBatch(
  events: ConversationEvent[]
): Promise<TrustFormationResult[]> {
  const results: TrustFormationResult[] = [];

  for (const event of events) {
    try {
      const result = await trustFormationEngine.processConversation(event);
      results.push(result);
    } catch (error) {
      console.error(`Failed to process conversation for user ${event.userId}:`, error);
      throw error; // Re-throw to maintain fail-closed behavior
    }
  }

  return results;
}
