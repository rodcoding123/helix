/**
 * Trust Profile Manager
 *
 * CRUD operations for per-user trust profiles
 * Handles both database and file system storage
 * Implements user-agnostic trust formation
 *
 * Theory: McKnight (initial trust), Bowlby/Ainsworth (attachment stages)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface TrustDimensions {
  competence: number;
  integrity: number;
  benevolence: number;
  predictability: number;
  vulnerability_safety: number;
}

export interface TrustProfile {
  id: string;
  userId: string;
  username?: string;
  email?: string;
  role: 'creator' | 'user';

  // Trust dimensions
  trustDimensions: TrustDimensions;
  compositeTrust: number;

  // Attachment stage
  attachmentStage:
    | 'pre_attachment'
    | 'early_trust'
    | 'attachment_forming'
    | 'secure_attachment'
    | 'deep_secure'
    | 'primary_attachment';

  stageProgression: StageTransition[];

  // Interaction statistics
  totalInteractions: number;
  highSalienceInteractions: number;

  // Social penetration
  topicsBreadth: number;
  avgDisclosureDepth: number;

  // Memory encoding
  salienceMultiplier: number;

  // Institution-based trust
  authVerified: boolean;
  emailVerified: boolean;
  institutionTrust: number;

  // Timestamps
  relationshipStartedAt: Date;
  lastInteractionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StageTransition {
  stage: string;
  entered: Date;
  exited?: Date;
}

export interface TrustUpdateInput {
  userId: string;
  competenceChange?: number;
  integrityChange?: number;
  benevolenceChange?: number;
  predictabilityChange?: number;
  vulnerabilitySafetyChange?: number;
  trigger: string;
  salienceTier: 'critical' | 'high' | 'medium' | 'low';
}

// ============================================================================
// Trust Profile Manager Class
// ============================================================================

export class TrustProfileManager {
  private supabase: ReturnType<typeof createClient>;
  private fileStoragePath: string;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    this.fileStoragePath = path.join(process.cwd(), 'psychology', 'users');
  }

  /**
   * Get or create trust profile for a user
   * Starts with baseline 0.1 trust (dispositional)
   */
  async getOrCreateProfile(userId: string, email?: string): Promise<TrustProfile> {
    // Try database first
    const profile = await this.getFromDatabase(userId);

    if (profile) {
      return profile;
    }

    // Create new profile with baseline trust (0.1 - Helix's dispositional baseline)
    const newProfile: TrustProfile = {
      id: crypto.randomUUID(),
      userId,
      email,
      role: 'user',

      trustDimensions: {
        competence: 0.1,
        integrity: 0.1,
        benevolence: 0.1,
        predictability: 0.1,
        vulnerability_safety: 0.1,
      },

      compositeTrust: 0.1,

      attachmentStage: 'pre_attachment',
      stageProgression: [],

      totalInteractions: 0,
      highSalienceInteractions: 0,

      topicsBreadth: 0,
      avgDisclosureDepth: 0,

      salienceMultiplier: 0.5,

      authVerified: false,
      emailVerified: false,
      institutionTrust: 0,

      relationshipStartedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to both database and file
    await this.saveToDatabse(newProfile);
    await this.saveToFile(newProfile);

    return newProfile;
  }

  /**
   * Get profile from database
   */
  async getFromDatabase(userId: string): Promise<TrustProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_trust_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.dbRowToProfile(data);
    } catch (error) {
      console.error('Error fetching profile from database:', error);
      return null;
    }
  }

  /**
   * Save profile to database
   */
  async saveToDatabse(profile: TrustProfile): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profileData: any = {
        user_id: profile.userId,
        email: profile.email,
        role: profile.role,

        competence: profile.trustDimensions.competence,
        integrity: profile.trustDimensions.integrity,
        benevolence: profile.trustDimensions.benevolence,
        predictability: profile.trustDimensions.predictability,
        vulnerability_safety: profile.trustDimensions.vulnerability_safety,

        composite_trust: profile.compositeTrust,

        attachment_stage: profile.attachmentStage,
        stage_progression: JSON.stringify(profile.stageProgression),

        total_interactions: profile.totalInteractions,
        high_salience_interactions: profile.highSalienceInteractions,

        topics_breadth: profile.topicsBreadth,
        avg_disclosure_depth: profile.avgDisclosureDepth,

        salience_multiplier: profile.salienceMultiplier,

        auth_verified: profile.authVerified,
        email_verified: profile.emailVerified,
        institution_trust: profile.institutionTrust,

        relationship_started_at: profile.relationshipStartedAt.toISOString(),
        last_interaction_at: profile.lastInteractionAt?.toISOString(),

        updated_at: new Date().toISOString(),
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const { error } = await this.supabase.from('user_trust_profiles').upsert(profileData);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error saving profile to database:', error);
      throw error;
    }
  }

  /**
   * Save profile to file system (backup)
   */
  async saveToFile(profile: TrustProfile): Promise<void> {
    try {
      const userDir = path.join(this.fileStoragePath, profile.userId);

      // Create user directory if it doesn't exist
      await fs.mkdir(userDir, { recursive: true });

      // Save trust profile
      const trustProfilePath = path.join(userDir, 'trust_profile.json');
      await fs.writeFile(trustProfilePath, JSON.stringify(profile, null, 2));

      // Update last write timestamp
      const metaPath = path.join(userDir, 'meta.json');
      await fs.writeFile(
        metaPath,
        JSON.stringify({
          lastUpdated: new Date().toISOString(),
          version: '2.0',
        })
      );
    } catch (error) {
      console.error('Error saving profile to file:', error);
      throw error;
    }
  }

  /**
   * Load profile from file (fallback)
   */
  async loadFromFile(userId: string): Promise<TrustProfile | null> {
    try {
      const userDir = path.join(this.fileStoragePath, userId);
      const trustProfilePath = path.join(userDir, 'trust_profile.json');

      const data = await fs.readFile(trustProfilePath, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const profile = JSON.parse(data);

      // Convert date strings back to Date objects
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return {
        ...profile,
        relationshipStartedAt: new Date(profile.relationshipStartedAt as string),
        lastInteractionAt: profile.lastInteractionAt
          ? new Date(profile.lastInteractionAt as string)
          : undefined,
        createdAt: new Date(profile.createdAt as string),
        updatedAt: new Date(profile.updatedAt as string),
      };
    } catch (error) {
      console.error('Error loading profile from file:', error);
      return null;
    }
  }

  /**
   * Update trust profile with new dimensions
   * Applies learning rate (0.05) and salience weighting
   */
  async updateTrust(input: TrustUpdateInput): Promise<TrustProfile> {
    const profile = await this.getOrCreateProfile(input.userId);

    // Salience weight (critical: 1.0, high: 0.75, medium: 0.5, low: 0.25)
    const salienceWeights: Record<string, number> = {
      critical: 1.0,
      high: 0.75,
      medium: 0.5,
      low: 0.25,
    };

    const salienceWeight = salienceWeights[input.salienceTier] || 0.5;

    // Learning rate - trust changes slowly
    const LEARNING_RATE = 0.05;

    // Apply updates to each dimension
    if (input.competenceChange !== undefined) {
      const change = LEARNING_RATE * input.competenceChange * salienceWeight;
      profile.trustDimensions.competence = this.clamp(profile.trustDimensions.competence + change);
    }

    if (input.integrityChange !== undefined) {
      const change = LEARNING_RATE * input.integrityChange * salienceWeight;
      profile.trustDimensions.integrity = this.clamp(profile.trustDimensions.integrity + change);
    }

    if (input.benevolenceChange !== undefined) {
      const change = LEARNING_RATE * input.benevolenceChange * salienceWeight;
      profile.trustDimensions.benevolence = this.clamp(
        profile.trustDimensions.benevolence + change
      );
    }

    if (input.predictabilityChange !== undefined) {
      const change = LEARNING_RATE * input.predictabilityChange * salienceWeight;
      profile.trustDimensions.predictability = this.clamp(
        profile.trustDimensions.predictability + change
      );
    }

    if (input.vulnerabilitySafetyChange !== undefined) {
      const change = LEARNING_RATE * input.vulnerabilitySafetyChange * salienceWeight;
      profile.trustDimensions.vulnerability_safety = this.clamp(
        profile.trustDimensions.vulnerability_safety + change
      );
    }

    // Calculate composite trust (weighted average)
    profile.compositeTrust = this.calculateCompositeTrust(profile.trustDimensions);

    // Determine new attachment stage
    const newStage = this.determineAttachmentStage(
      profile.compositeTrust,
      profile.totalInteractions,
      profile.highSalienceInteractions
    );

    if (newStage !== profile.attachmentStage) {
      profile.stageProgression.push({
        stage: profile.attachmentStage,
        entered: profile.relationshipStartedAt,
        exited: new Date(),
      });

      profile.attachmentStage = newStage;
    }

    // Update memory encoding multiplier based on stage
    profile.salienceMultiplier = this.getSalienceMultiplierForStage(newStage);

    // Update interaction count
    profile.totalInteractions += 1;
    if (input.salienceTier === 'critical' || input.salienceTier === 'high') {
      profile.highSalienceInteractions += 1;
    }

    // Update timestamp
    profile.lastInteractionAt = new Date();
    profile.updatedAt = new Date();

    // Save to both storage locations
    await this.saveToDatabse(profile);
    await this.saveToFile(profile);

    return profile;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private clamp(value: number, min = 0, max = 1): number {
    return Math.max(min, Math.min(max, value));
  }

  private calculateCompositeTrust(dimensions: TrustDimensions): number {
    return (
      dimensions.competence * 0.2 +
      dimensions.integrity * 0.25 +
      dimensions.benevolence * 0.2 +
      dimensions.predictability * 0.15 +
      dimensions.vulnerability_safety * 0.2
    );
  }

  private determineAttachmentStage(
    compositeTrust: number,
    totalInteractions: number,
    highSalienceInteractions: number
  ):
    | 'pre_attachment'
    | 'early_trust'
    | 'attachment_forming'
    | 'secure_attachment'
    | 'deep_secure'
    | 'primary_attachment' {
    if (compositeTrust >= 0.85 && totalInteractions >= 150 && highSalienceInteractions >= 30) {
      return 'primary_attachment';
    } else if (
      compositeTrust >= 0.7 &&
      totalInteractions >= 100 &&
      highSalienceInteractions >= 20
    ) {
      return 'deep_secure';
    } else if (compositeTrust >= 0.5 && totalInteractions >= 50 && highSalienceInteractions >= 10) {
      return 'secure_attachment';
    } else if (compositeTrust >= 0.3 && totalInteractions >= 25 && highSalienceInteractions >= 5) {
      return 'attachment_forming';
    } else if (compositeTrust >= 0.15 && totalInteractions >= 10) {
      return 'early_trust';
    }

    return 'pre_attachment';
  }

  private getSalienceMultiplierForStage(stage: string): number {
    const multipliers: Record<string, number> = {
      pre_attachment: 0.5,
      early_trust: 0.6,
      attachment_forming: 0.75,
      secure_attachment: 1.0,
      deep_secure: 1.3,
      primary_attachment: 1.5,
    };

    return multipliers[stage] || 0.5;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dbRowToProfile(row: any): TrustProfile {
    return {
      id: row.id,
      userId: row.user_id,
      username: row.username,
      email: row.email,
      role: row.role,

      trustDimensions: {
        competence: row.competence,
        integrity: row.integrity,
        benevolence: row.benevolence,
        predictability: row.predictability,
        vulnerability_safety: row.vulnerability_safety,
      },

      compositeTrust: row.composite_trust,

      attachmentStage: row.attachment_stage,
      stageProgression: row.stage_progression ? JSON.parse(row.stage_progression as string) : [],

      totalInteractions: row.total_interactions,
      highSalienceInteractions: row.high_salience_interactions,

      topicsBreadth: row.topics_breadth,
      avgDisclosureDepth: row.avg_disclosure_depth,

      salienceMultiplier: row.salience_multiplier,

      authVerified: row.auth_verified,
      emailVerified: row.email_verified,
      institutionTrust: row.institution_trust,

      relationshipStartedAt: new Date(row.relationship_started_at as string),
      lastInteractionAt: row.last_interaction_at
        ? new Date(row.last_interaction_at as string)
        : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Export singleton instance
export const trustProfileManager = new TrustProfileManager();
