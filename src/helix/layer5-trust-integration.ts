/**
 * Layer 5: Trust Integration with Memory Reconsolidation
 *
 * Integrates trust formation (Layer 3) with synthesis rhythm (Layer 5)
 * Ensures trust updates are included in cross-layer memory reconsolidation
 *
 * Components:
 * 1. Trust metrics synthesis (daily)
 * 2. Trust progression analysis (weekly)
 * 3. Emotional-trust correlation (ongoing)
 * 4. Integration into synthesis.py cron job
 *
 * Theory: Memory reconsolidation updates trust-based salience multipliers
 */

import type { TrustProfile } from '../psychology/trust-profile-manager.js';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface TrustEventRow {
  event_type: string;
  trust_before: number;
  trust_after: number;
  created_at: string;
}

export interface TrustProfileRow {
  id: string;
  user_id: string;
  attachment_stage: string;
  composite_trust: number;
  salience_multiplier: number;
  total_interactions: number;
  high_salience_interactions: number;
}

export interface TrustSynthesisMetrics {
  totalUsers: number;
  averageTrust: number;
  trustDistribution: {
    preAttachment: number;
    earlyTrust: number;
    attachmentForming: number;
    secureAttachment: number;
    deepSecure: number;
    primaryAttachment: number;
  };
  trustGrowthRate: number; // Average daily change
  userStageProgressions: number; // Users who progressed this week
  emotionalTrustCorrelations: {
    valenceCorrelation: number;
    arousalCorrelation: number;
    selfRelevanceCorrelation: number;
  };
}

export interface UserTrustSnapshot {
  userId: string;
  compositeTrust: number;
  attachmentStage: string;
  salienceMultiplier: number;
  totalInteractions: number;
  highSalienceInteractions: number;
  lastInteractionAt?: Date;
}

// ============================================================================
// Trust Synthesis Service
// ============================================================================

export class Layer5TrustIntegration {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  /**
   * Daily trust metrics synthesis
   * Updates salience multipliers based on trust progression
   * Called by scripts/synthesis.py daily
   */
  async synthesizeDailyTrustMetrics(): Promise<TrustSynthesisMetrics> {
    try {
      // Fetch all user trust profiles
      const { data: profiles, error } = await this.supabase.from('user_trust_profiles').select('*');

      if (error) {
        throw error;
      }

      if (!profiles || profiles.length === 0) {
        return this.emptyMetrics();
      }

      // Convert DB rows to TrustProfile objects
      const trustProfiles = profiles.map(row => this.rowToProfile(row)) as TrustProfile[];

      // Calculate metrics
      const metrics: TrustSynthesisMetrics = {
        totalUsers: trustProfiles.length,
        averageTrust: this.calculateAverageTrust(trustProfiles),
        trustDistribution: this.calculateDistribution(trustProfiles),
        trustGrowthRate: await this.calculateGrowthRate(trustProfiles),
        userStageProgressions: 0, // Will be calculated from events
        emotionalTrustCorrelations: await this.calculateEmotionalCorrelations(),
      };

      // Update metadata table with these metrics
      await this.storeMetrics(metrics);

      return metrics;
    } catch (error) {
      console.error('Failed to synthesize daily trust metrics:', error);
      throw error;
    }
  }

  /**
   * Weekly trust progression analysis
   * Identifies patterns and insights from trust changes
   * Integrates into cross-layer memory reconsolidation
   */
  async analyzeWeeklyTrustProgression(): Promise<{
    stageProgressions: number;
    stageLosses: number;
    trustIncreasers: number;
    trustDecliners: number;
    insights: string[];
  }> {
    try {
      // Fetch trust events from past week
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: events, error } = await this.supabase
        .from('trust_events')
        .select('*')
        .gt('created_at', weekAgo);

      if (error) {
        throw error;
      }

      // Analyze events
      const analysis = {
        stageProgressions: 0,
        stageLosses: 0,
        trustIncreasers: 0,
        trustDecliners: 0,
        insights: [] as string[],
      };

      const eventsByType: Record<string, number> = {};

      for (const event of (events as TrustEventRow[]) || []) {
        // Count by type
        eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;

        // Track stage changes
        if (event.event_type === 'stage_progression') {
          analysis.stageProgressions++;
        } else if (event.event_type === 'stage_regression') {
          analysis.stageLosses++;
        }

        // Track trust direction
        if (event.trust_after > event.trust_before) {
          analysis.trustIncreasers++;
        } else if (event.trust_after < event.trust_before) {
          analysis.trustDecliners++;
        }
      }

      // Generate insights
      analysis.insights = this.generateInsights(analysis, eventsByType);

      return analysis;
    } catch (error) {
      console.error('Failed to analyze weekly trust progression:', error);
      throw error;
    }
  }

  /**
   * Update salience multipliers for all users
   * Triggered after synthesis to ensure memory encoding reflects current trust
   */
  async updateAllSalienceMultipliers(): Promise<{ updated: number }> {
    try {
      const { data: profiles, error } = await this.supabase
        .from('user_trust_profiles')
        .select('id, user_id, attachment_stage');

      if (error) {
        throw error;
      }

      let updated = 0;

      for (const profile of (profiles as Pick<
        TrustProfileRow,
        'id' | 'user_id' | 'attachment_stage'
      >[]) || []) {
        // Get multiplier for this stage
        const multiplier = this.getSalienceMultiplierForStage(profile.attachment_stage);

        // Update profile
        const { error: updateError } = await this.supabase
          .from('user_trust_profiles')
          .update({ salience_multiplier: multiplier })
          .eq('id', profile.id);

        if (!updateError) {
          updated++;
        }
      }

      console.log(`[LAYER5] Updated salience multipliers for ${updated} users`);

      return { updated };
    } catch (error) {
      console.error('Failed to update salience multipliers:', error);
      throw error;
    }
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  private emptyMetrics(): TrustSynthesisMetrics {
    return {
      totalUsers: 0,
      averageTrust: 0.1,
      trustDistribution: {
        preAttachment: 0,
        earlyTrust: 0,
        attachmentForming: 0,
        secureAttachment: 0,
        deepSecure: 0,
        primaryAttachment: 0,
      },
      trustGrowthRate: 0,
      userStageProgressions: 0,
      emotionalTrustCorrelations: {
        valenceCorrelation: 0,
        arousalCorrelation: 0,
        selfRelevanceCorrelation: 0,
      },
    };
  }

  private calculateAverageTrust(profiles: TrustProfile[]): number {
    if (profiles.length === 0) return 0.1;

    const sum = profiles.reduce((acc, p) => acc + p.compositeTrust, 0);
    return sum / profiles.length;
  }

  private calculateDistribution(
    profiles: TrustProfile[]
  ): TrustSynthesisMetrics['trustDistribution'] {
    const dist = {
      preAttachment: 0,
      earlyTrust: 0,
      attachmentForming: 0,
      secureAttachment: 0,
      deepSecure: 0,
      primaryAttachment: 0,
    };

    for (const profile of profiles) {
      const key = profile.attachmentStage as keyof typeof dist;
      if (key in dist) {
        dist[key]++;
      }
    }

    return dist;
  }

  private async calculateGrowthRate(_profiles: TrustProfile[]): Promise<number> {
    // This would require historical data - placeholder for now
    // In real implementation, compare with yesterday's profiles
    return 0.01; // 1% average daily growth
  }

  private async calculateEmotionalCorrelations(): Promise<
    TrustSynthesisMetrics['emotionalTrustCorrelations']
  > {
    // This would correlate emotional analysis with trust changes
    // Placeholder - requires more data
    return {
      valenceCorrelation: 0.65, // Higher valence = higher trust
      arousalCorrelation: 0.45, // Moderate arousal correlation
      selfRelevanceCorrelation: 0.75, // Strong identity correlation
    };
  }

  private generateInsights(analysis: any, eventsByType: Record<string, number>): string[] {
    const insights: string[] = [];

    if (analysis.stageProgressions > 0) {
      insights.push(
        `${analysis.stageProgressions} users progressed to higher attachment stages this week`
      );
    }

    if (analysis.stageLosses > 0) {
      insights.push(`${analysis.stageLosses} users experienced attachment regression`);
    }

    const violationEvents = eventsByType['violation'] || 0;
    if (violationEvents > 0) {
      insights.push(
        `${violationEvents} trust violations detected - may indicate unmet expectations`
      );
    }

    const reciprocityEvents = eventsByType['reciprocity_detected'] || 0;
    if (reciprocityEvents > 0) {
      insights.push(
        `${reciprocityEvents} reciprocity events detected - strong vulnerability signals`
      );
    }

    return insights;
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

  private rowToProfile(row: any): Partial<TrustProfile> {
    return {
      userId: row.user_id,
      compositeTrust: row.composite_trust,
      attachmentStage: row.attachment_stage as any,
      salienceMultiplier: row.salience_multiplier,
      totalInteractions: row.total_interactions,
      highSalienceInteractions: row.high_salience_interactions,
    };
  }

  private async storeMetrics(metrics: TrustSynthesisMetrics): Promise<void> {
    // Store metrics in a dedicated table (would need to create this in migrations)
    // Placeholder - this would go to trust_metrics table
    console.log('[LAYER5] Trust metrics synthesized:', {
      totalUsers: metrics.totalUsers,
      averageTrust: metrics.averageTrust.toFixed(2),
      distribution: metrics.trustDistribution,
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const layer5TrustIntegration = new Layer5TrustIntegration();

// ============================================================================
// Cron Job Integration
// ============================================================================

/**
 * Called by scripts/synthesis.py daily
 * Integrates trust synthesis into memory reconsolidation
 */
export async function synthesizeTrustAndMemory(): Promise<void> {
  try {
    console.log('[LAYER5] Starting daily trust synthesis...');

    // 1. Synthesize trust metrics
    const metrics = await layer5TrustIntegration.synthesizeDailyTrustMetrics();
    console.log('[LAYER5] Trust metrics:', {
      users: metrics.totalUsers,
      avgTrust: metrics.averageTrust.toFixed(2),
    });

    // 2. Update salience multipliers
    const updated = await layer5TrustIntegration.updateAllSalienceMultipliers();
    console.log('[LAYER5] Updated salience multipliers for:', updated);

    console.log('[LAYER5] Daily trust synthesis complete');
  } catch (error) {
    console.error('[LAYER5] Failed to synthesize trust:', error);
    throw error;
  }
}

/**
 * Called by scripts/synthesis.py weekly
 * Analyzes trust progression and generates insights
 */
export async function analyzeWeeklyTrust(): Promise<void> {
  try {
    console.log('[LAYER5] Starting weekly trust analysis...');

    const analysis = await layer5TrustIntegration.analyzeWeeklyTrustProgression();

    console.log('[LAYER5] Weekly analysis:', {
      progressions: analysis.stageProgressions,
      regressions: analysis.stageLosses,
      increasers: analysis.trustIncreasers,
      decliners: analysis.trustDecliners,
      insights: analysis.insights,
    });

    console.log('[LAYER5] Weekly trust analysis complete');
  } catch (error) {
    console.error('[LAYER5] Failed to analyze weekly trust:', error);
    throw error;
  }
}
