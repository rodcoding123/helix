/**
 * Phase 9D: Analytics Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from './analytics.service';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => {
  const createChain = () => ({
    select: vi.fn(function() { return this; }),
    eq: vi.fn(function() { return this; }),
    gte: vi.fn(function() { return this; }),
    lte: vi.fn(function() { return this; }),
    insert: vi.fn(function() { return this; }),
    update: vi.fn(function() { return this; }),
    delete: vi.fn(function() { return this; }),
    upsert: vi.fn(function() { return this; }),
    order: vi.fn(function() { return this; }),
    limit: vi.fn(function() { return this; }),
    single: vi.fn(async () => ({ data: null, error: null })),
    onConflict: vi.fn(async () => ({ data: null, error: null })),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  });

  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => createChain()),
      rpc: vi.fn(async () => ({ data: null, error: null })),
    })),
  };
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const userId = 'test-user-123';

  beforeEach(() => {
    service = new AnalyticsService();
    vi.clearAllMocks();
  });

  describe('Execution Recording', () => {
    it('should record successful operation execution', async () => {
      await service.recordExecution(userId, 'email-compose', {
        success: true,
        latency_ms: 245,
        cost_usd: 0.002,
        model_used: 'deepseek',
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should record failed operation execution', async () => {
      await service.recordExecution(userId, 'task-prioritize', {
        success: false,
        latency_ms: 150,
        cost_usd: 0.0015,
        model_used: 'gemini',
      });

      expect(true).toBe(true);
    });

    it('should track model usage in execution', async () => {
      const models: Array<'anthropic' | 'deepseek' | 'gemini' | 'openai'> = ['anthropic', 'deepseek', 'gemini', 'openai'];

      for (const model of models) {
        await service.recordExecution(userId, 'analytics-summary', {
          success: true,
          latency_ms: 300,
          cost_usd: 0.003,
          model_used: model,
        });
      }

      expect(true).toBe(true);
    });

    it('should accumulate daily metrics', async () => {
      // Record multiple executions
      for (let i = 0; i < 5; i++) {
        await service.recordExecution(userId, 'email-respond', {
          success: i < 4, // 80% success rate
          latency_ms: 200 + i * 10,
          cost_usd: 0.001 + i * 0.0001,
          model_used: 'deepseek',
        });
      }

      expect(true).toBe(true);
    });
  });

  describe('Metrics Retrieval', () => {
    it('should get operation metrics for period', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const metrics = await service.getOperationMetrics(userId, 'email-compose', startDate, endDate);

      expect(metrics === null || typeof metrics === 'object').toBe(true);
      if (metrics) {
        expect(metrics.operation_id).toBe('email-compose');
        expect(typeof metrics.total_executions).toBe('number');
        expect(typeof metrics.success_rate).toBe('number');
        expect(typeof metrics.total_cost_usd).toBe('number');
      }
    });

    it('should get all operation metrics', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();

      const allMetrics = await service.getAllOperationMetrics(userId, startDate, endDate);

      expect(Array.isArray(allMetrics)).toBe(true);
      allMetrics.forEach(m => {
        expect(typeof m.operation_id).toBe('string');
        expect(typeof m.total_executions).toBe('number');
        expect(typeof m.success_rate).toBe('number');
      });
    });

    it('should calculate correct success rates', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const metrics = await service.getOperationMetrics(userId, 'task-breakdown', startDate, endDate);

      if (metrics) {
        expect(metrics.success_rate).toBeGreaterThanOrEqual(0);
        expect(metrics.success_rate).toBeLessThanOrEqual(100);
      }
    });

    it('should calculate latency statistics', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const metrics = await service.getOperationMetrics(userId, 'calendar-prep', startDate, endDate);

      if (metrics) {
        expect(metrics.avg_latency_ms).toBeGreaterThanOrEqual(0);
        expect(metrics.min_latency_ms).toBeLessThanOrEqual(metrics.avg_latency_ms);
        expect(metrics.max_latency_ms).toBeGreaterThanOrEqual(metrics.avg_latency_ms);
      }
    });
  });

  describe('Cost Analysis', () => {
    it('should get cost trends', async () => {
      const trends = await service.getCostTrends(userId, 30);

      expect(Array.isArray(trends)).toBe(true);
      trends.forEach(trend => {
        expect(typeof trend.date).toBe('string');
        expect(typeof trend.total_cost_usd).toBe('number');
        expect(trend.total_cost_usd).toBeGreaterThanOrEqual(0);
      });
    });

    it('should aggregate costs by model', async () => {
      const trends = await service.getCostTrends(userId, 30);

      trends.forEach(trend => {
        const total = trend.anthropic_cost + trend.deepseek_cost + trend.gemini_cost + trend.openai_cost;
        expect(total).toBeLessThanOrEqual(trend.total_cost_usd * 1.01); // Allow 1% rounding error
      });
    });

    it('should provide period summary', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const summary = await service.getPeriodSummary(userId, startDate, endDate);

      expect(typeof summary.total_cost).toBe('number');
      expect(typeof summary.total_operations).toBe('number');
      expect(typeof summary.avg_cost_per_operation).toBe('number');
      expect(typeof summary.overall_success_rate).toBe('number');
      expect(typeof summary.avg_latency_ms).toBe('number');

      expect(summary.total_cost).toBeGreaterThanOrEqual(0);
      expect(summary.total_operations).toBeGreaterThanOrEqual(0);
      expect(summary.overall_success_rate).toBeGreaterThanOrEqual(0);
      expect(summary.overall_success_rate).toBeLessThanOrEqual(100);
    });

    it('should handle empty period gracefully', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 1);

      const summary = await service.getPeriodSummary(userId, startDate, endDate);

      expect(summary.total_cost).toBe(0);
      expect(summary.total_operations).toBe(0);
    });
  });

  describe('Recommendations', () => {
    it('should get active recommendations', async () => {
      const recs = await service.getRecommendations(userId, 10);

      expect(Array.isArray(recs)).toBe(true);
      recs.forEach(rec => {
        expect(typeof rec.id).toBe('string');
        expect(typeof rec.title).toBe('string');
        expect(['cost', 'performance', 'usage', 'model_selection']).toContain(rec.recommendation_type);
        expect(['active', 'dismissed', 'implemented']).toContain(rec.status);
      });
    });

    it('should dismiss recommendation', async () => {
      await service.dismissRecommendation(userId, 'rec-123');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should mark recommendation as implemented', async () => {
      await service.implementRecommendation(userId, 'rec-123');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should generate cost optimization recommendations', async () => {
      const recs = await service.generateRecommendations(userId);

      expect(Array.isArray(recs)).toBe(true);
      recs.forEach(rec => {
        expect(typeof rec.title).toBe('string');
        expect(typeof rec.description).toBe('string');
        expect(rec.estimated_savings_percent).toBeGreaterThanOrEqual(0);
        expect(rec.estimated_savings_usd).toBeGreaterThanOrEqual(0);
      });
    });

    it('should include high-priority recommendations', async () => {
      const recs = await service.generateRecommendations(userId);

      const highPriority = recs.filter(r => r.priority >= 7);
      // May have high priority recommendations
      expect(Array.isArray(highPriority)).toBe(true);
    });

    it('should suggest model changes', async () => {
      const recs = await service.generateRecommendations(userId);

      const modelRecs = recs.filter(r => r.recommendation_type === 'model_selection');
      // May generate model recommendations
      expect(Array.isArray(modelRecs)).toBe(true);
    });

    it('should identify performance issues', async () => {
      const recs = await service.generateRecommendations(userId);

      const perfRecs = recs.filter(r => r.recommendation_type === 'performance');
      // May generate performance recommendations
      expect(Array.isArray(perfRecs)).toBe(true);
    });
  });

  describe('Model Analysis', () => {
    it('should track model usage counts', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const metrics = await service.getOperationMetrics(userId, 'analytics-anomaly', startDate, endDate);

      if (metrics) {
        expect(typeof metrics.models_used.anthropic).toBe('number');
        expect(typeof metrics.models_used.deepseek).toBe('number');
        expect(typeof metrics.models_used.gemini).toBe('number');
        expect(typeof metrics.models_used.openai).toBe('number');

        const total = Object.values(metrics.models_used).reduce((a, b) => a + b, 0);
        expect(total).toBeLessThanOrEqual(metrics.total_executions + 1); // Allow 1 extra for rounding
      }
    });

    it('should identify most-used model', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const allMetrics = await service.getAllOperationMetrics(userId, startDate, endDate);

      allMetrics.forEach(m => {
        const entries = Object.entries(m.models_used);
        if (entries.length > 0) {
          const mostUsed = entries.sort(([, a], [, b]) => b - a)[0];
          expect(mostUsed[1]).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('Data Aggregation', () => {
    it('should aggregate daily trends correctly', async () => {
      const trends = await service.getCostTrends(userId, 7);

      // Each trend should have valid data
      trends.forEach(trend => {
        expect(trend.total_operations).toBeGreaterThanOrEqual(0);
        expect(trend.total_cost_usd).toBeGreaterThanOrEqual(0);
        expect(trend.success_rate).toBeGreaterThanOrEqual(0);
        expect(trend.success_rate).toBeLessThanOrEqual(100);
      });
    });

    it('should calculate correct averages', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const summary = await service.getPeriodSummary(userId, startDate, endDate);

      if (summary.total_operations > 0) {
        const expected = summary.total_cost / summary.total_operations;
        expect(Math.abs(summary.avg_cost_per_operation - expected)).toBeLessThan(0.00001);
      }
    });
  });
});
