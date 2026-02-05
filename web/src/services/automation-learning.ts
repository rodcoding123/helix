/**
 * Automation Learning Engine - Phase 7 Track 4
 * ML-based pattern detection and automation optimization
 */

import { supabase } from '@/lib/supabase';
import { logToDiscord } from '@/helix/logging';
import type { AutomationExecution, DetectedPattern, AutomationSuggestion } from './automation.types.js';

interface PatternAnalysis {
  pattern: string;
  frequency: number;
  successRate: number;
  lastOccurrence: Date;
}

export class AutomationLearningEngine {
  private static instance: AutomationLearningEngine;

  private constructor() {}

  static getInstance(): AutomationLearningEngine {
    if (!AutomationLearningEngine.instance) {
      AutomationLearningEngine.instance = new AutomationLearningEngine();
    }
    return AutomationLearningEngine.instance;
  }

  /**
   * Analyze user patterns to improve automation suggestions
   */
  async analyzePatterns(userId: string): Promise<DetectedPattern[]> {
    try {
      // Get execution history
      const executions = await this.getExecutionHistory(userId);

      if (executions.length < 5) {
        return []; // Need minimum data
      }

      // Detect patterns
      const patterns = this.detectPatterns(executions);

      // Calculate success rates
      const enrichedPatterns = patterns.map((pattern) => ({
        id: `pattern-${Date.now()}-${Math.random()}`,
        userId,
        pattern: pattern.pattern,
        frequency: pattern.frequency,
        lastOccurrenceAt: pattern.lastOccurrence,
        triggerType: this.inferTriggerType(pattern.pattern),
        successRate: pattern.successRate,
      }));

      // Log analysis
      await logToDiscord({
        channel: 'helix-automation',
        type: 'pattern_analysis_complete',
        userId,
        patternsDetected: enrichedPatterns.length,
        totalExecutions: executions.length,
        avgSuccessRate: this.calculateAverageSuccessRate(enrichedPatterns),
        timestamp: new Date().toISOString(),
      });

      return enrichedPatterns;
    } catch (error) {
      await logToDiscord({
        channel: 'helix-alerts',
        type: 'pattern_analysis_failed',
        error: String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Detect patterns in execution history
   */
  private detectPatterns(executions: AutomationExecution[]): PatternAnalysis[] {
    const patterns = new Map<string, { successes: number; failures: number; last: Date }>();

    for (const execution of executions) {
      const pattern = this.extractPattern(execution);

      if (!patterns.has(pattern)) {
        patterns.set(pattern, { successes: 0, failures: 0, last: new Date() });
      }

      const stats = patterns.get(pattern)!;

      if (execution.status === 'success') {
        stats.successes++;
      } else {
        stats.failures++;
      }

      stats.last = new Date(execution.executedAt);
    }

    // Convert to array and filter by frequency
    return Array.from(patterns.entries())
      .filter(([, stats]) => stats.successes + stats.failures >= 3) // Minimum 3 executions
      .map(([pattern, stats]) => ({
        pattern,
        frequency: stats.successes + stats.failures,
        successRate:
          stats.successes / (stats.successes + stats.failures), // Return as decimal (0-1)
        lastOccurrence: stats.last,
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Extract pattern from execution
   */
  private extractPattern(execution: AutomationExecution): string {
    // Pattern format: "trigger_type:action_result"
    const triggerType = execution.triggerId?.split('-')[0] || 'unknown';
    const success = execution.status === 'success' ? 'success' : 'failure';
    return `${triggerType}:${success}`;
  }

  /**
   * Infer trigger type from pattern
   */
  private inferTriggerType(pattern: string): string {
    const parts = pattern.split(':');
    return parts[0] || 'email_received';
  }

  /**
   * Generate automation suggestions based on patterns
   */
  async suggestNewAutomations(userId: string): Promise<AutomationSuggestion[]> {
    try {
      const patterns = await this.analyzePatterns(userId);

      if (patterns.length === 0) {
        return [];
      }

      const suggestions: AutomationSuggestion[] = [];

      for (const pattern of patterns.slice(0, 3)) {
        // Generate suggestions for top 3 patterns
        if (pattern.successRate >= 0.8) {
          // Only suggest for high-success patterns
          const suggestion = this.generateSuggestion(pattern);
          if (suggestion) {
            suggestions.push({
              ...suggestion,
              userId,
              basedOnPatterns: [pattern.pattern],
            });
          }
        }
      }

      return suggestions;
    } catch (error) {
      console.error('Failed to generate automation suggestions:', error);
      return [];
    }
  }

  /**
   * Generate automation suggestion from pattern
   */
  private generateSuggestion(pattern: DetectedPattern): Omit<AutomationSuggestion, 'userId' | 'basedOnPatterns'> | null {
    // This would generate specific trigger conditions and actions based on the pattern
    // For now, return a basic suggestion

    return {
      id: `suggestion-${Date.now()}`,
      suggestedTrigger: {
        type: 'email',
        emailFrom: [],
        subjectKeywords: ['follow-up'],
      },
      suggestedActions: [
        {
          actionType: 'create_task',
          actionConfig: {
            title: 'Follow-up action',
            priority: 'normal',
          },
        },
      ],
      confidence: pattern.successRate,
      createdAt: new Date(),
    };
  }

  /**
   * Get execution history
   */
  private async getExecutionHistory(userId: string): Promise<AutomationExecution[]> {
    try {
      const { data, error } = await supabase
        .from('automation_executions')
        .select('*')
        .eq('user_id', userId)
        .order('executed_at', { ascending: false })
        .limit(100);

      if (error || !data) {
        return [];
      }

      return data.map((record) => ({
        id: record.id,
        userId: record.user_id,
        triggerId: record.trigger_id,
        status: record.status as 'success' | 'failed' | 'skipped',
        result: record.result,
        error: record.error,
        executedAt: new Date(record.executed_at),
      }));
    } catch (error) {
      console.error('Failed to get execution history:', error);
      return [];
    }
  }

  /**
   * Calculate average success rate
   */
  private calculateAverageSuccessRate(patterns: DetectedPattern[]): number {
    if (patterns.length === 0) {
      return 0;
    }

    const total = patterns.reduce((sum, p) => sum + p.successRate, 0);
    return total / patterns.length;
  }

  /**
   * Optimize existing rules based on performance
   */
  async optimizeRules(userId: string): Promise<void> {
    try {
      const patterns = await this.analyzePatterns(userId);

      // Find underperforming patterns
      const underperforming = patterns.filter((p) => p.successRate < 0.6);

      if (underperforming.length > 0) {
        await logToDiscord({
          channel: 'helix-automation',
          type: 'rules_optimization_suggested',
          userId,
          underperformingPatterns: underperforming.length,
          suggestions: underperforming.map((p) => ({
            pattern: p.pattern,
            successRate: p.successRate,
          })),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to optimize rules:', error);
    }
  }

  /**
   * Get high-performing patterns
   */
  async getHighPerformingPatterns(userId: string): Promise<DetectedPattern[]> {
    try {
      const patterns = await this.analyzePatterns(userId);
      return patterns.filter((p) => p.successRate >= 0.8).slice(0, 5);
    } catch (error) {
      console.error('Failed to get high-performing patterns:', error);
      return [];
    }
  }

  /**
   * Calculate pattern confidence
   */
  private calculateConfidence(pattern: DetectedPattern): number {
    // Confidence based on success rate and frequency
    const frequencyBoost = Math.min(pattern.frequency / 20, 0.2); // Max 0.2 boost
    return Math.min(pattern.successRate + frequencyBoost, 1.0);
  }

  /**
   * Get learning report for user
   */
  async getLearningReport(userId: string): Promise<{
    totalPatterns: number;
    avgSuccessRate: number;
    bestPerformingPattern?: DetectedPattern;
    suggestions: number;
  }> {
    try {
      const patterns = await this.analyzePatterns(userId);
      const suggestions = await this.suggestNewAutomations(userId);

      return {
        totalPatterns: patterns.length,
        avgSuccessRate: this.calculateAverageSuccessRate(patterns),
        bestPerformingPattern: patterns[0],
        suggestions: suggestions.length,
      };
    } catch (error) {
      console.error('Failed to generate learning report:', error);
      return {
        totalPatterns: 0,
        avgSuccessRate: 0,
        suggestions: 0,
      };
    }
  }
}

export function getAutomationLearningEngine(): AutomationLearningEngine {
  return AutomationLearningEngine.getInstance();
}
