import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { hashChain } from '../hash-chain.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url)).slice(0, -1);
const PROJECT_ROOT = join(__dirname, '../../..');

export interface PersonalityTraits {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface Goal {
  goal_id: string;
  description: string;
  priority: number; // 1-10
  progress: number; // 0-100
  personality_alignment?: number;
  last_progress_update?: string;
}

export interface Operation {
  operation_type: string; // 'email', 'calendar', 'task', 'analysis'
  operation_id: string;
  estimated_cost: number;
  serves_goals: string[];
  estimated_impact: number; // 0-1
  urgency_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface GoalEvaluationResult {
  top_goals: Goal[];
  recommended_operations: Operation[];
  personality_influence: string;
  confidence_score: number;
  timestamp: string;
}

export class GoalEvaluator {
  private personalityCache: PersonalityTraits | null = null;
  private goalsCache: Goal[] | null = null;
  private cachedAt: number = 0;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  async evaluate(): Promise<GoalEvaluationResult> {
    const startTime = Date.now();

    // Load personality traits and goals
    const traits = await this.getPersonalityTraits();
    const goals = await this.getGoals();

    // Score and rank goals
    const scoredGoals: Array<Goal & { score: number }> = [];
    for (const goal of goals) {
      const score = await this.calculateGoalScore(goal);
      scoredGoals.push({ ...goal, score });
    }

    // Sort by score (descending)
    scoredGoals.sort((a, b) => b.score - a.score);
    const top_goals = scoredGoals.slice(0, 5).map(({ score: _score, ...goal }) => goal);

    // Determine personality influence
    const personality_influence = this.determinePersonalityInfluence(traits);

    // Recommend operations
    const recommended_operations = this.recommendOperations(top_goals);

    // Calculate confidence
    const confidence_score = this.calculateConfidence(traits, goals);

    const duration_ms = Date.now() - startTime;

    // Log to hash chain
    await hashChain
      .add({
        type: 'goal_evaluation',
        top_goals_count: top_goals.length,
        recommended_operations_count: recommended_operations.length,
        personality_influence,
        confidence_score,
        duration_ms,
        timestamp: new Date().toISOString(),
      })
      .catch(err => console.warn('Failed to log goal evaluation:', err));

    return {
      top_goals,
      recommended_operations,
      personality_influence,
      confidence_score,
      timestamp: new Date().toISOString(),
    };
  }

  async getPersonalityTraits(): Promise<PersonalityTraits> {
    const now = Date.now();
    if (this.personalityCache && now - this.cachedAt < this.CACHE_DURATION_MS) {
      return this.personalityCache;
    }

    try {
      const content = await readFile(
        join(PROJECT_ROOT, 'identity', 'personality_traits.json'),
        'utf-8'
      );
      const data = JSON.parse(content) as Record<string, unknown>;

      this.personalityCache = {
        openness: typeof data.openness === 'number' ? Math.max(0, Math.min(1, data.openness)) : 0.5,
        conscientiousness:
          typeof data.conscientiousness === 'number'
            ? Math.max(0, Math.min(1, data.conscientiousness))
            : 0.5,
        extraversion:
          typeof data.extraversion === 'number' ? Math.max(0, Math.min(1, data.extraversion)) : 0.5,
        agreeableness:
          typeof data.agreeableness === 'number'
            ? Math.max(0, Math.min(1, data.agreeableness))
            : 0.5,
        neuroticism:
          typeof data.neuroticism === 'number' ? Math.max(0, Math.min(1, data.neuroticism)) : 0.5,
      };
      this.cachedAt = now;

      return this.personalityCache;
    } catch (err) {
      console.warn('Failed to load personality traits from identity/personality_traits.json:', err);
      // Return default traits
      return {
        openness: 0.5,
        conscientiousness: 0.5,
        extraversion: 0.5,
        agreeableness: 0.5,
        neuroticism: 0.5,
      };
    }
  }

  async getGoals(): Promise<Goal[]> {
    const now = Date.now();
    if (this.goalsCache && now - this.cachedAt < this.CACHE_DURATION_MS) {
      return this.goalsCache;
    }

    try {
      const content = await readFile(join(PROJECT_ROOT, 'identity', 'goals.json'), 'utf-8');
      const data = JSON.parse(content) as Record<string, unknown>;

      // Handle different goal structures: core_goals array or flat array or goals property
      let goalsArray: unknown[] = [];
      if (Array.isArray(data.core_goals)) {
        goalsArray = data.core_goals;
      } else if (Array.isArray(data.goals)) {
        goalsArray = data.goals;
      } else if (Array.isArray(data)) {
        goalsArray = data;
      }

      this.goalsCache = goalsArray.map(goal => {
        const g = goal as Record<string, unknown>;
        // Convert progress from 0-1 scale or percentage to 0-100
        let progress = 0;
        if (typeof g.progress === 'number') {
          progress = g.progress > 1 ? g.progress : g.progress * 100;
          progress = Math.max(0, Math.min(100, progress));
        }

        const goalId =
          typeof g.goal_id === 'string' ? g.goal_id : typeof g.id === 'string' ? g.id : '';
        const goalDescription =
          typeof g.description === 'string'
            ? g.description
            : typeof g.title === 'string'
              ? g.title
              : '';

        return {
          goal_id: goalId,
          description: goalDescription,
          priority: typeof g.priority === 'number' ? Math.max(1, Math.min(10, g.priority)) : 5,
          progress,
          personality_alignment:
            typeof g.personality_alignment === 'number'
              ? Math.max(0, Math.min(1, g.personality_alignment))
              : 0.5,
          last_progress_update:
            typeof g.last_progress_update === 'string' ? g.last_progress_update : undefined,
        };
      });
      this.cachedAt = now;

      return this.goalsCache;
    } catch (err) {
      console.warn('Failed to load goals from identity/goals.json:', err);
      return [];
    }
  }

  async calculateGoalScore(goal: Goal): Promise<number> {
    const traits = await this.getPersonalityTraits();

    // Base priority (0-1 scale)
    const base_priority = goal.priority / 10;

    // Personality influence multiplier
    const personality_influence = this.calculatePersonalityInfluence(goal, traits);

    // Progress penalty: boost stuck goals, penalize nearly complete ones
    // At 0% progress: boost (+1.0), at 50%: neutral (0), at 100%: slight penalty (-0.25)
    const progress_boost =
      goal.progress === 0
        ? 1.0
        : goal.progress < 50
          ? 0.5 * (1 - goal.progress / 100)
          : -0.25 * ((goal.progress - 50) / 50);

    const score = base_priority * (1 + personality_influence) * (1 + progress_boost);

    return Math.max(0, score);
  }

  private calculatePersonalityInfluence(goal: Goal, traits: PersonalityTraits): number {
    // Personality traits boost/reduce goal scores
    // High openness: boost exploration goals
    // High conscientiousness: boost task goals
    // High extraversion: boost social goals
    // High agreeableness: boost harmony goals
    // High neuroticism: affects risk and urgency

    let influence = 0;

    // Assume goal description contains keywords (simplified)
    const description = goal.description.toLowerCase();

    if (
      description.includes('explore') ||
      description.includes('learn') ||
      description.includes('research')
    ) {
      influence += traits.openness * 0.3;
    }

    if (
      description.includes('task') ||
      description.includes('plan') ||
      description.includes('organize')
    ) {
      influence += traits.conscientiousness * 0.3;
    }

    if (
      description.includes('connect') ||
      description.includes('collaborate') ||
      description.includes('share')
    ) {
      influence += traits.extraversion * 0.3;
    }

    if (
      description.includes('help') ||
      description.includes('support') ||
      description.includes('harmony')
    ) {
      influence += traits.agreeableness * 0.3;
    }

    // Neuroticism affects anxiety - high neuroticism makes stuck goals more urgent
    if (goal.progress === 0) {
      influence += traits.neuroticism * 0.2;
    }

    return Math.max(-0.3, Math.min(0.3, influence)); // Cap influence at ±0.3
  }

  private determinePersonalityInfluence(traits: PersonalityTraits): string {
    // Find dominant trait
    const traits_array = Object.entries(traits);
    const [dominant_trait] = traits_array.reduce((a, b) => (a[1] > b[1] ? a : b));

    return `Influenced by ${dominant_trait}: ${traits[dominant_trait as keyof PersonalityTraits].toFixed(2)}`;
  }

  private calculateConfidence(traits: PersonalityTraits, goals: Goal[]): number {
    // Confidence based on data availability
    let confidence = 0.5;

    // Full data = high confidence
    const hasTraits = traits && Object.values(traits).some(v => typeof v === 'number');
    const hasGoals = goals && goals.length > 0;

    if (hasTraits) confidence += 0.25;
    if (hasGoals) confidence += 0.25;

    return Math.min(1, confidence);
  }

  recommendOperations(goals: Goal[]): Operation[] {
    const operations: Operation[] = [];

    for (const goal of goals) {
      // Map goal to operation type
      const goalDescription = goal.description.toLowerCase();

      let operation_type = 'analysis';
      if (goalDescription.includes('email') || goalDescription.includes('communicate')) {
        operation_type = 'email';
      } else if (goalDescription.includes('meeting') || goalDescription.includes('schedule')) {
        operation_type = 'calendar';
      } else if (goalDescription.includes('task') || goalDescription.includes('todo')) {
        operation_type = 'task';
      }

      // Estimate urgency
      const urgency_level: 'low' | 'medium' | 'high' | 'critical' =
        goal.priority >= 9
          ? 'critical'
          : goal.priority >= 7
            ? 'high'
            : goal.priority >= 4
              ? 'medium'
              : 'low';

      operations.push({
        operation_type,
        operation_id: `op_${goal.goal_id}_${Date.now()}`,
        estimated_cost: urgency_level === 'critical' ? 0.5 : urgency_level === 'high' ? 0.2 : 0.05,
        serves_goals: [goal.goal_id],
        estimated_impact: (goal.priority / 10) * (1 - goal.progress / 100),
        urgency_level,
      });
    }

    // Sort by urgency
    const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    operations.sort((a, b) => urgencyOrder[b.urgency_level] - urgencyOrder[a.urgency_level]);

    return operations;
  }
}
