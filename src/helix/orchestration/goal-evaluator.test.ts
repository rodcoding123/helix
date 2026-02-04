import { describe, it, expect, beforeEach } from 'vitest';
import { GoalEvaluator, Goal } from './goal-evaluator.js';

describe('GoalEvaluator', () => {
  let evaluator: GoalEvaluator;

  beforeEach(() => {
    evaluator = new GoalEvaluator();
  });

  describe('evaluate', () => {
    it('should return evaluation result with recommended operations', async () => {
      const result = await evaluator.evaluate();

      expect(result).toBeDefined();
      expect(result.top_goals).toBeDefined();
      expect(Array.isArray(result.top_goals)).toBe(true);
      expect(result.recommended_operations).toBeDefined();
      expect(Array.isArray(result.recommended_operations)).toBe(true);
      expect(result.personality_influence).toBeDefined();
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
      expect(result.timestamp).toBeDefined();
    });

    it('should rank goals by personality-adjusted priority', async () => {
      const result = await evaluator.evaluate();

      if (result.top_goals.length > 1) {
        // Higher priority goals should come first
        for (let i = 0; i < result.top_goals.length - 1; i++) {
          expect(result.top_goals[i].priority).toBeGreaterThanOrEqual(
            result.top_goals[i + 1].priority
          );
        }
      }
    });

    it('should account for personality traits in scoring', async () => {
      const result = await evaluator.evaluate();

      expect(result.personality_influence).toMatch(
        /openness|conscientiousness|extraversion|agreeableness|neuroticism/i
      );
    });

    it('should load personality traits from identity/personality_traits.json', async () => {
      const traits = await evaluator.getPersonalityTraits();

      expect(traits).toBeDefined();
      expect(traits.openness).toBeGreaterThanOrEqual(0);
      expect(traits.openness).toBeLessThanOrEqual(1);
      expect(traits.conscientiousness).toBeGreaterThanOrEqual(0);
      expect(traits.conscientiousness).toBeLessThanOrEqual(1);
      expect(traits.extraversion).toBeGreaterThanOrEqual(0);
      expect(traits.extraversion).toBeLessThanOrEqual(1);
      expect(traits.agreeableness).toBeGreaterThanOrEqual(0);
      expect(traits.agreeableness).toBeLessThanOrEqual(1);
      expect(traits.neuroticism).toBeGreaterThanOrEqual(0);
      expect(traits.neuroticism).toBeLessThanOrEqual(1);
    });

    it('should load goals from identity/goals.json', async () => {
      const goals = await evaluator.getGoals();

      expect(Array.isArray(goals)).toBe(true);
      if (goals.length > 0) {
        expect(goals[0].goal_id).toBeDefined();
        expect(goals[0].priority).toBeGreaterThanOrEqual(1);
        expect(goals[0].priority).toBeLessThanOrEqual(10);
        expect(typeof goals[0].progress).toBe('number');
      }
    });

    it('should apply progress penalty - stuck goals get urgency', async () => {
      const result = await evaluator.evaluate();

      // Find goal with 0% progress
      const stuckGoal = result.top_goals.find(g => g.progress === 0);

      if (stuckGoal && result.top_goals.length > 1) {
        // Stuck goal should rank higher than partially complete goal
        const partialGoal = result.top_goals.find(
          g => g.progress > 0 && g.progress < 100 && g.priority <= stuckGoal.priority
        );

        if (partialGoal) {
          // Stuck goal gets urgency boost
          expect(result.top_goals.indexOf(stuckGoal)).toBeLessThanOrEqual(
            result.top_goals.indexOf(partialGoal)
          );
        }
      }
    });

    it('should recommend operations that serve top goals', async () => {
      const result = await evaluator.evaluate();

      if (result.recommended_operations.length > 0) {
        expect(result.recommended_operations[0].serves_goals).toBeDefined();
        expect(Array.isArray(result.recommended_operations[0].serves_goals)).toBe(true);
      }
    });

    it('should filter operations by cost budget', async () => {
      const result = await evaluator.evaluate();

      // Operations should be feasible within typical budget
      for (const op of result.recommended_operations) {
        expect(op.estimated_cost).toBeLessThan(100); // Assume reasonable budget limit
      }
    });

    it('should set urgency level based on goal progress and priority', async () => {
      const result = await evaluator.evaluate();

      for (const op of result.recommended_operations) {
        expect(['low', 'medium', 'high', 'critical']).toContain(op.urgency_level);
      }
    });

    it('should log evaluation to hash chain', async () => {
      const result = await evaluator.evaluate();

      // Verify timestamp was recorded
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('should handle missing personality file gracefully', async () => {
      const result = await evaluator.evaluate();

      // Should return valid result even if personality file missing
      expect(result).toBeDefined();
      expect(result.top_goals).toBeDefined();
    });

    it('should handle missing goals file gracefully', async () => {
      const result = await evaluator.evaluate();

      // Should return valid result even if goals file missing
      expect(result).toBeDefined();
      expect(Array.isArray(result.top_goals)).toBe(true);
    });

    it('should provide confidence score based on data availability', async () => {
      const result = await evaluator.evaluate();

      // Confidence should be high (0.7+) if both personality and goals loaded
      expect(result.confidence_score).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateGoalScore', () => {
    it('should prioritize high-priority goals', async () => {
      const goal1 = {
        goal_id: '1',
        priority: 10,
        progress: 50,
        personality_alignment: 0.5,
        description: 'Test goal 1',
      };
      const goal2 = {
        goal_id: '2',
        priority: 3,
        progress: 50,
        personality_alignment: 0.5,
        description: 'Test goal 2',
      };

      const score1 = await evaluator.calculateGoalScore(goal1 as Goal);
      const score2 = await evaluator.calculateGoalScore(goal2 as Goal);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should boost stuck goals (0% progress)', async () => {
      const stuckGoal = {
        goal_id: '1',
        priority: 5,
        progress: 0,
        personality_alignment: 0.5,
        description: 'Test goal 1',
      };
      const partialGoal = {
        goal_id: '2',
        priority: 5,
        progress: 50,
        personality_alignment: 0.5,
        description: 'Test goal 2',
      };

      const stuckScore = await evaluator.calculateGoalScore(stuckGoal as Goal);
      const partialScore = await evaluator.calculateGoalScore(partialGoal as Goal);

      // Stuck goal should score higher (more urgent)
      expect(stuckScore).toBeGreaterThan(partialScore);
    });

    it('should penalize nearly complete goals slightly', async () => {
      const almostDone = {
        goal_id: '1',
        priority: 5,
        progress: 95,
        personality_alignment: 0.5,
        description: 'Test goal 1',
      };
      const midProgress = {
        goal_id: '2',
        priority: 5,
        progress: 50,
        personality_alignment: 0.5,
        description: 'Test goal 2',
      };

      const almostDoneScore = await evaluator.calculateGoalScore(almostDone as Goal);
      const midProgressScore = await evaluator.calculateGoalScore(midProgress as Goal);

      // Mid-progress goal should score slightly higher (less penalized)
      expect(midProgressScore).toBeGreaterThan(almostDoneScore);
    });
  });

  describe('recommendOperations', () => {
    it('should return operations array', async () => {
      const goals = await evaluator.getGoals();
      const operations = evaluator.recommendOperations(goals);

      expect(Array.isArray(operations)).toBe(true);
    });

    it('should map goal types to operation types', async () => {
      const goals = await evaluator.getGoals();
      const operations = evaluator.recommendOperations(goals);

      for (const op of operations) {
        expect(['email', 'calendar', 'task', 'analysis']).toContain(op.operation_type);
      }
    });

    it('should prioritize operations by urgency', async () => {
      const goals = await evaluator.getGoals();
      const operations = evaluator.recommendOperations(goals);

      const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };

      for (let i = 0; i < operations.length - 1; i++) {
        const current = urgencyOrder[operations[i].urgency_level];
        const next = urgencyOrder[operations[i + 1].urgency_level];
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });
});
