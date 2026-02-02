import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type {
  MemorySynthesisJob,
  SynthesisJobDefinition,
  MemoryPattern,
  SynthesisRecommendation,
  SynthesisInsights,
  PatternConfirmation,
} from '@/lib/types/memory-synthesis';

/**
 * MemorySynthesisService: Manages memory synthesis jobs and pattern analysis
 * Handles automated psychological layer analysis across 7 layers
 */
export class MemorySynthesisService {
  private supabase: SupabaseClient | null = null;

  private getSupabaseClient(): SupabaseClient {
    if (this.supabase) return this.supabase;
    this.supabase = getSupabaseBrowserClient();
    return this.supabase;
  }

  /**
   * Create a synthesis job
   */
  async createSynthesisJob(
    userId: string,
    definition: SynthesisJobDefinition
  ): Promise<MemorySynthesisJob> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('memory_synthesis_jobs')
        .insert([
          {
            user_id: userId,
            synthesis_type: definition.synthesis_type,
            time_range_start: definition.time_range_start,
            time_range_end: definition.time_range_end,
            is_recurring: definition.is_recurring || false,
            cron_schedule: definition.cron_schedule,
            status: 'pending',
            progress: 0,
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create synthesis job: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to create synthesis job:', error);
      throw error;
    }
  }

  /**
   * Get synthesis jobs for user
   */
  async getSynthesisJobs(userId: string): Promise<MemorySynthesisJob[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('memory_synthesis_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch synthesis jobs: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get synthesis jobs:', error);
      throw error;
    }
  }

  /**
   * Get memory patterns for user
   */
  async getMemoryPatterns(userId: string, layer?: number): Promise<MemoryPattern[]> {
    try {
      const supabase = this.getSupabaseClient();

      let query = supabase
        .from('memory_patterns')
        .select('*')
        .eq('user_id', userId)
        .order('confidence', { ascending: false });

      if (layer) {
        query = query.eq('layer', layer);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch memory patterns: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get memory patterns:', error);
      throw error;
    }
  }

  /**
   * Create a memory pattern
   */
  async createMemoryPattern(
    userId: string,
    pattern: Omit<MemoryPattern, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<MemoryPattern> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('memory_patterns')
        .insert([
          {
            user_id: userId,
            ...pattern,
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create pattern: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to create memory pattern:', error);
      throw error;
    }
  }

  /**
   * Confirm or reject a memory pattern
   */
  async confirmPattern(
    patternId: string,
    confirmation: PatternConfirmation
  ): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      await supabase
        .from('memory_patterns')
        .update({
          user_confirmed: confirmation.confirmed,
          user_notes: confirmation.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', patternId);
    } catch (error) {
      console.error('Failed to confirm pattern:', error);
      throw error;
    }
  }

  /**
   * Get recommendations for user
   */
  async getRecommendations(userId: string): Promise<SynthesisRecommendation[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('synthesis_recommendations')
        .select('*')
        .eq('user_id', userId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch recommendations: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      throw error;
    }
  }

  /**
   * Update recommendation status
   */
  async updateRecommendationStatus(
    recommendationId: string,
    status: SynthesisRecommendation['status']
  ): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      await supabase
        .from('synthesis_recommendations')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recommendationId);
    } catch (error) {
      console.error('Failed to update recommendation:', error);
      throw error;
    }
  }

  /**
   * Simulate synthesis analysis (generates mock insights)
   * In production, this would call Claude API for analysis
   */
  async synthesizeMemoryPatterns(
    userId: string,
    jobId: string,
    synthesisType: string
  ): Promise<SynthesisInsights> {
    try {
      const supabase = this.getSupabaseClient();

      // Update job status
      await supabase
        .from('memory_synthesis_jobs')
        .update({
          status: 'running',
          progress: 0.25,
        })
        .eq('id', jobId);

      // Simulate analysis delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update progress
      await supabase
        .from('memory_synthesis_jobs')
        .update({ progress: 0.75 })
        .eq('id', jobId);

      // Generate mock insights based on synthesis type
      let insights: SynthesisInsights;

      switch (synthesisType) {
        case 'emotional_patterns':
          insights = {
            summary: 'Your emotional patterns show consistent themes around achievement and connection.',
            patterns: [
              {
                id: crypto.randomUUID(),
                user_id: userId,
                pattern_type: 'emotional_trigger',
                layer: 2,
                description: 'Anxiety triggered by uncertain outcomes',
                evidence: [],
                confidence: 0.87,
                first_detected: new Date().toISOString(),
                last_observed: new Date().toISOString(),
                observation_count: 8,
                user_confirmed: null,
                user_notes: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            recommendations: [],
            emotionalProfile: {
              dominantEmotions: [
                { emotion: 'curious', frequency: 42 },
                { emotion: 'thoughtful', frequency: 35 },
                { emotion: 'ambitious', frequency: 28 },
              ],
              emotionalRange: { min: 'calm', max: 'excited' },
              emotionalTriggers: [
                { trigger: 'new challenges', responses: ['enthusiasm', 'focus'], frequency: 5 },
              ],
              emotionalStability: 0.78,
            },
          };
          break;

        case 'prospective_self':
          insights = {
            summary: 'Your aspirations center on meaningful impact and continuous growth.',
            patterns: [
              {
                id: crypto.randomUUID(),
                user_id: userId,
                pattern_type: 'goal_theme',
                layer: 4,
                description: 'Strong drive toward creating lasting positive impact',
                evidence: [],
                confidence: 0.92,
                first_detected: new Date().toISOString(),
                last_observed: new Date().toISOString(),
                observation_count: 12,
                user_confirmed: null,
                user_notes: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            recommendations: [],
            prospectiveSelf: {
              aspirations: ['Create meaningful work', 'Build deep relationships', 'Continuous learning'],
              fears: ['Stagnation', 'Irrelevance', 'Unfinished potential'],
              identityThemes: ['Creator', 'Learner', 'Builder'],
              goalAlignment: 0.85,
              growthAreas: ['Delegation', 'Work-life balance', 'Patience'],
            },
          };
          break;

        case 'relational_memory':
          insights = {
            summary: 'Your relational patterns show strong capacity for deep connection with selective trust.',
            patterns: [
              {
                id: crypto.randomUUID(),
                user_id: userId,
                pattern_type: 'relationship_dynamic',
                layer: 3,
                description: 'Tendency to build trust slowly but deeply with key relationships',
                evidence: [],
                confidence: 0.81,
                first_detected: new Date().toISOString(),
                last_observed: new Date().toISOString(),
                observation_count: 6,
                user_confirmed: null,
                user_notes: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            recommendations: [],
            relationalDynamics: {
              keyRelationships: [
                { person: 'Close mentors', pattern: 'Guiding and supportive', strength: 0.9 },
              ],
              attachmentPatterns: ['Secure base building', 'Selective vulnerability'],
              trustLevels: { 'close-friends': 0.85, 'colleagues': 0.65, 'new-contacts': 0.4 },
            },
          };
          break;

        default:
          insights = {
            summary: 'Full synthesis analysis pending.',
            patterns: [],
            recommendations: [],
            narrativeThemes: ['Growth', 'Connection', 'Impact'],
          };
      }

      // Save patterns
      for (const pattern of insights.patterns) {
        await this.createMemoryPattern(userId, {
          pattern_type: pattern.pattern_type as any,
          layer: pattern.layer,
          description: pattern.description,
          evidence: pattern.evidence,
          confidence: pattern.confidence,
          first_detected: pattern.first_detected,
          last_observed: pattern.last_observed,
          observation_count: pattern.observation_count,
          user_confirmed: pattern.user_confirmed,
          user_notes: pattern.user_notes,
        });
      }

      // Complete job
      await supabase
        .from('memory_synthesis_jobs')
        .update({
          status: 'completed',
          progress: 1.0,
          insights,
          patterns_detected: insights.patterns.length,
          memories_analyzed: 24,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return insights;
    } catch (error) {
      console.error('Failed to synthesize memory patterns:', error);

      // Mark job as failed
      const supabase = this.getSupabaseClient();
      await supabase
        .from('memory_synthesis_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', jobId);

      throw error;
    }
  }

  /**
   * Schedule recurring synthesis
   */
  async scheduleRecurringSynthesis(
    userId: string,
    synthesisType: string,
    cronSchedule: string
  ): Promise<MemorySynthesisJob> {
    try {
      return await this.createSynthesisJob(userId, {
        synthesis_type: synthesisType as any,
        is_recurring: true,
        cron_schedule: cronSchedule,
      });
    } catch (error) {
      console.error('Failed to schedule synthesis:', error);
      throw error;
    }
  }

  /**
   * Cancel synthesis job
   */
  async cancelSynthesisJob(jobId: string): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      await supabase
        .from('memory_synthesis_jobs')
        .update({
          status: 'failed',
          error_message: 'Cancelled by user',
        })
        .eq('id', jobId);
    } catch (error) {
      console.error('Failed to cancel job:', error);
      throw error;
    }
  }
}
