/**
 * Memory Synthesis System Types
 * Enables automated psychological layer analysis and pattern detection
 */

export type SynthesisType =
  | 'emotional_patterns'
  | 'prospective_self'
  | 'relational_memory'
  | 'narrative_coherence'
  | 'full_synthesis';

export type PatternType =
  | 'emotional_trigger'
  | 'goal_theme'
  | 'relationship_dynamic'
  | 'behavioral_pattern'
  | 'value_conflict'
  | 'growth_area';

export type RecommendationCategory = 'psychological' | 'behavioral' | 'relational' | 'growth';

export interface MemorySynthesisJob {
  id: string;
  user_id: string;
  synthesis_type: SynthesisType;
  time_range_start: string | null;
  time_range_end: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  error_message: string | null;
  insights: SynthesisInsights | null;
  memories_analyzed: number;
  patterns_detected: number;
  is_recurring: boolean;
  cron_schedule: string | null;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
  updated_at: string;
}

export interface SynthesisInsights {
  summary: string;
  patterns: MemoryPattern[];
  recommendations: SynthesisRecommendation[];
  emotionalProfile?: EmotionalProfile;
  prospectiveSelf?: ProspectiveSelfAnalysis;
  relationalDynamics?: RelationalDynamics;
  narrativeThemes?: string[];
}

export interface MemoryPattern {
  id: string;
  user_id: string;
  pattern_type: PatternType;
  layer: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  description: string;
  evidence: string[];  // Conversation IDs
  confidence: number;  // 0-1
  first_detected: string;
  last_observed: string;
  observation_count: number;
  user_confirmed: boolean | null;
  user_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SynthesisRecommendation {
  id: string;
  user_id: string;
  pattern_id: string | null;
  recommendation: string;
  category: RecommendationCategory;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'acknowledged' | 'working_on' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface EmotionalProfile {
  dominantEmotions: Array<{ emotion: string; frequency: number }>;
  emotionalRange: {
    min: string;
    max: string;
  };
  emotionalTriggers: Array<{
    trigger: string;
    responses: string[];
    frequency: number;
  }>;
  emotionalStability: number; // 0-1
}

export interface ProspectiveSelfAnalysis {
  aspirations: string[];
  fears: string[];
  identityThemes: string[];
  goalAlignment: number; // 0-1 how aligned goals are
  growthAreas: string[];
}

export interface RelationalDynamics {
  keyRelationships: Array<{
    person: string;
    pattern: string;
    strength: number;
  }>;
  attachmentPatterns: string[];
  trustLevels: Record<string, number>;
}

export interface SynthesisJobDefinition {
  synthesis_type: SynthesisType;
  time_range_start?: string;
  time_range_end?: string;
  is_recurring?: boolean;
  cron_schedule?: string;
}

export interface PatternConfirmation {
  pattern_id: string;
  confirmed: boolean;
  notes?: string;
}
