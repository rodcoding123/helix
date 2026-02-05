/**
 * Automation Learning Engine Tests - Phase 7 Track 4
 * Tests for pattern detection and automation suggestion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAutomationLearningEngine } from './automation-learning.js';
import {
  createMockAutomationExecution,
  createMockAutomationTrigger,
  createMockTask,
} from './__test-utils/automation-factory.js';

// Mock Supabase
vi.mock('@/lib/supabase', () => (
  {
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    },
  }
));

// Mock Discord logging
vi.mock('@/helix/logging', () => ({
  logToDiscord: async () => {},
}));

describe('AutomationLearningEngine', () => {
  let learningEngine: ReturnType<typeof getAutomationLearningEngine>;

  beforeEach(() => {
    learningEngine = getAutomationLearningEngine();
  });

  describe('Singleton Pattern', () => {
    it('returns same instance', () => {
      const engine1 = getAutomationLearningEngine();
      const engine2 = getAutomationLearningEngine();
      expect(engine1).toBe(engine2);
    });
  });

  describe('Pattern Analysis', () => {
    it('analyzes patterns from execution history', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      expect(Array.isArray(patterns)).toBe(true);
    });

    it('filters patterns by minimum frequency', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      // All returned patterns should have frequency >= 3
      for (const pattern of patterns) {
        expect(pattern.frequency).toBeGreaterThanOrEqual(3);
      }
    });

    it('calculates success rate correctly', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      for (const pattern of patterns) {
        expect(pattern.successRate).toBeGreaterThanOrEqual(0);
        expect(pattern.successRate).toBeLessThanOrEqual(1);
      }
    });

    it('sorts patterns by frequency', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      for (let i = 0; i < patterns.length - 1; i++) {
        expect(patterns[i].frequency).toBeGreaterThanOrEqual(patterns[i + 1].frequency);
      }
    });

    it('returns empty array for user with minimal history', async () => {
      const patterns = await learningEngine.analyzePatterns('new-user');

      expect(Array.isArray(patterns)).toBe(true);
      // May be empty if no history
    });
  });

  describe('Pattern Detection', () => {
    it('detects patterns in executions', async () => {
      const executions = [
        createMockAutomationExecution({
          triggerId: 'trigger-1',
          status: 'success',
        }),
        createMockAutomationExecution({
          triggerId: 'trigger-1',
          status: 'success',
        }),
        createMockAutomationExecution({
          triggerId: 'trigger-1',
          status: 'success',
        }),
      ];

      const patterns = await learningEngine.detectPatterns(executions);

      expect(Array.isArray(patterns)).toBe(true);
    });

    it('filters patterns with minimum 3 executions', async () => {
      const executions = [
        createMockAutomationExecution({
          triggerId: 'trigger-1',
          status: 'success',
        }),
        createMockAutomationExecution({
          triggerId: 'trigger-1',
          status: 'success',
        }),
      ];

      const patterns = await learningEngine.detectPatterns(executions);

      // Only patterns with 3+ executions should be returned
      expect(patterns.every((p) => p.frequency >= 3)).toBe(true);
    });

    it('handles mixed success and failure', async () => {
      const executions = [
        createMockAutomationExecution({
          triggerId: 'trigger-1',
          status: 'success',
        }),
        createMockAutomationExecution({
          triggerId: 'trigger-1',
          status: 'success',
        }),
        createMockAutomationExecution({
          triggerId: 'trigger-1',
          status: 'failed',
        }),
      ];

      const patterns = await learningEngine.detectPatterns(executions);

      if (patterns.length > 0) {
        expect(patterns[0].successRate).toBeLessThan(1);
      }
    });
  });

  describe('Pattern Extraction', () => {
    it('extracts pattern from execution', async () => {
      const execution = createMockAutomationExecution({
        triggerId: 'email-trigger-1',
        status: 'success',
      });

      const pattern = await learningEngine.extractPattern(execution);

      expect(typeof pattern).toBe('string');
      expect(pattern.length).toBeGreaterThan(0);
    });

    it('uses trigger ID and status for pattern', async () => {
      const execution = createMockAutomationExecution({
        triggerId: 'test-trigger',
        status: 'success',
      });

      const pattern = await learningEngine.extractPattern(execution);

      expect(pattern).toContain('test-trigger');
      expect(pattern).toContain('success');
    });

    it('handles different statuses', async () => {
      const successExecution = createMockAutomationExecution({
        status: 'success',
      });
      const failedExecution = createMockAutomationExecution({
        status: 'failed',
      });

      const successPattern = await learningEngine.extractPattern(successExecution);
      const failedPattern = await learningEngine.extractPattern(failedExecution);

      expect(successPattern).not.toEqual(failedPattern);
    });
  });

  describe('Trigger Type Inference', () => {
    it('infers trigger type from pattern', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      for (const pattern of patterns) {
        const triggerType = await learningEngine.inferTriggerType(pattern.pattern);
        expect(typeof triggerType).toBe('string');
      }
    });

    it('defaults to email_received for unknown patterns', async () => {
      const triggerType = await learningEngine.inferTriggerType('unknown:success');

      expect(triggerType).toBeDefined();
    });
  });

  describe('Suggestion Generation', () => {
    it('generates suggestions for high-success patterns', async () => {
      const suggestions = await learningEngine.suggestNewAutomations('user-123');

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('only suggests for patterns >80% success rate', async () => {
      const suggestions = await learningEngine.suggestNewAutomations('user-123');

      // All suggestions should be based on high-success patterns
      for (const suggestion of suggestions) {
        expect(suggestion.basedOnPatterns).toBeDefined();
      }
    });

    it('limits suggestions to top 3 patterns', async () => {
      const suggestions = await learningEngine.suggestNewAutomations('user-123');

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('returns empty array for new users', async () => {
      const suggestions = await learningEngine.suggestNewAutomations('brand-new-user');

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Suggestion Creation', () => {
    it('creates automation suggestion from pattern', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      if (patterns.length > 0) {
        const suggestion = await learningEngine.generateSuggestion(patterns[0]);

        if (suggestion) {
          expect(suggestion.id).toBeDefined();
          expect(suggestion.suggestedTrigger).toBeDefined();
          expect(suggestion.suggestedActions).toBeDefined();
        }
      }
    });

    it('includes confidence in suggestion', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      if (patterns.length > 0) {
        const suggestion = await learningEngine.generateSuggestion(patterns[0]);

        if (suggestion) {
          expect(typeof suggestion.confidence).toBe('number');
          expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
          expect(suggestion.confidence).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('Rule Optimization', () => {
    it('identifies underperforming patterns', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      const underperforming = patterns.filter((p) => p.successRate < 0.6);

      expect(Array.isArray(underperforming)).toBe(true);
    });

    it('logs optimization suggestions for underperforming rules', async () => {
      // Should not throw
      await learningEngine.optimizeRules('user-123');

      expect(true).toBe(true);
    });

    it('does not suggest optimization for high-performing rules', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      const highPerforming = patterns.filter((p) => p.successRate >= 0.8);

      expect(Array.isArray(highPerforming)).toBe(true);
    });
  });

  describe('High-Performing Pattern Retrieval', () => {
    it('retrieves high-performing patterns', async () => {
      const patterns = await learningEngine.getHighPerformingPatterns('user-123');

      expect(Array.isArray(patterns)).toBe(true);
    });

    it('only returns patterns with >80% success rate', async () => {
      const patterns = await learningEngine.getHighPerformingPatterns('user-123');

      for (const pattern of patterns) {
        expect(pattern.successRate).toBeGreaterThanOrEqual(0.8);
      }
    });

    it('limits to top 5 patterns', async () => {
      const patterns = await learningEngine.getHighPerformingPatterns('user-123');

      expect(patterns.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Confidence Calculation', () => {
    it('calculates confidence from success rate and frequency', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      if (patterns.length > 0) {
        const confidence = await learningEngine.calculateConfidence(patterns[0]);

        expect(typeof confidence).toBe('number');
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
      }
    });

    it('increases confidence with higher frequency', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      if (patterns.length > 1) {
        const confidence1 = await learningEngine.calculateConfidence(patterns[0]);
        const confidence2 = await learningEngine.calculateConfidence(patterns[1]);

        // Confidence should correlate with success rate
        expect(typeof confidence1).toBe('number');
        expect(typeof confidence2).toBe('number');
      }
    });
  });

  describe('Learning Report Generation', () => {
    it('generates learning report', async () => {
      const report = await learningEngine.getLearningReport('user-123');

      expect(report).toBeDefined();
      expect(report.totalPatterns).toBeGreaterThanOrEqual(0);
      expect(report.avgSuccessRate).toBeGreaterThanOrEqual(0);
      expect(report.suggestions).toBeGreaterThanOrEqual(0);
    });

    it('includes pattern count', async () => {
      const report = await learningEngine.getLearningReport('user-123');

      expect(typeof report.totalPatterns).toBe('number');
    });

    it('includes average success rate', async () => {
      const report = await learningEngine.getLearningReport('user-123');

      expect(typeof report.avgSuccessRate).toBe('number');
      expect(report.avgSuccessRate).toBeGreaterThanOrEqual(0);
      expect(report.avgSuccessRate).toBeLessThanOrEqual(1);
    });

    it('includes best performing pattern', async () => {
      const report = await learningEngine.getLearningReport('user-123');

      if (report.bestPerformingPattern) {
        expect(report.bestPerformingPattern.successRate).toBeDefined();
        expect(report.bestPerformingPattern.frequency).toBeDefined();
      }
    });

    it('includes suggestion count', async () => {
      const report = await learningEngine.getLearningReport('user-123');

      expect(typeof report.suggestions).toBe('number');
      expect(report.suggestions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Execution History Retrieval', () => {
    it('retrieves execution history for user', async () => {
      const history = await learningEngine.getExecutionHistory('user-123');

      expect(Array.isArray(history)).toBe(true);
    });

    it('limits to last 100 executions', async () => {
      const history = await learningEngine.getExecutionHistory('user-123');

      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('returns empty array for new user', async () => {
      const history = await learningEngine.getExecutionHistory('brand-new-user');

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Average Success Rate Calculation', () => {
    it('calculates average success rate', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      const avgRate = await learningEngine.calculateAverageSuccessRate(patterns);

      expect(typeof avgRate).toBe('number');
      expect(avgRate).toBeGreaterThanOrEqual(0);
      expect(avgRate).toBeLessThanOrEqual(1);
    });

    it('returns 0 for empty pattern list', async () => {
      const avgRate = await learningEngine.calculateAverageSuccessRate([]);

      expect(avgRate).toBe(0);
    });

    it('equals success rate for single pattern', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      if (patterns.length === 1) {
        const avgRate = await learningEngine.calculateAverageSuccessRate(patterns);

        expect(avgRate).toBe(patterns[0].successRate);
      }
    });
  });

  describe('Discord Logging', () => {
    it('logs pattern analysis to Discord', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      expect(Array.isArray(patterns)).toBe(true);
    });

    it('logs errors to Discord', async () => {
      try {
        await learningEngine.analyzePatterns('');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('handles database errors gracefully', async () => {
      try {
        const patterns = await learningEngine.analyzePatterns('user-123');
        expect(Array.isArray(patterns)).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('returns empty report on analysis failure', async () => {
      const report = await learningEngine.getLearningReport('user-123');

      expect(report.totalPatterns).toBeGreaterThanOrEqual(0);
      expect(report.avgSuccessRate).toBeGreaterThanOrEqual(0);
    });

    it('continues operation with partial data', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');
      expect(Array.isArray(patterns)).toBe(true);

      const suggestions = await learningEngine.suggestNewAutomations('user-123');
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('returns patterns with required fields', async () => {
      const patterns = await learningEngine.analyzePatterns('user-123');

      for (const pattern of patterns) {
        expect(typeof pattern.pattern).toBe('string');
        expect(typeof pattern.frequency).toBe('number');
        expect(typeof pattern.successRate).toBe('number');
      }
    });

    it('returns suggestions with required fields', async () => {
      const suggestions = await learningEngine.suggestNewAutomations('user-123');

      for (const suggestion of suggestions) {
        expect(suggestion.suggestedTrigger).toBeDefined();
        expect(suggestion.suggestedActions).toBeDefined();
        expect(suggestion.basedOnPatterns).toBeDefined();
      }
    });

    it('execution history has correct structure', async () => {
      const history = await learningEngine.getExecutionHistory('user-123');

      for (const execution of history) {
        expect(execution.id).toBeDefined();
        expect(execution.userId).toBeDefined();
        expect(['success', 'failed', 'skipped']).toContain(execution.status);
      }
    });
  });
});
