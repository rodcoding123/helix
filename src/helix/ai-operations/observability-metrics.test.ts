import { describe, it, expect, beforeEach } from 'vitest';
import { ObservabilityMetrics } from './observability-metrics.js';

describe('ObservabilityMetrics', () => {
  let metrics: ObservabilityMetrics;

  beforeEach(() => {
    metrics = new ObservabilityMetrics();
  });

  describe('Operation Tracking', () => {
    it('tracks operation success', () => {
      metrics.recordOperationSuccess('email_analysis', 150);

      const stats = metrics.getOperationStats('email_analysis');
      expect(stats?.totalOperations).toBe(1);
      expect(stats?.successCount).toBe(1);
      expect(stats?.successRate).toBe(1.0);
    });

    it('tracks operation failure', () => {
      metrics.recordOperationFailure('email_analysis', 'timeout');

      const stats = metrics.getOperationStats('email_analysis');
      expect(stats?.totalOperations).toBe(1);
      expect(stats?.failureCount).toBe(1);
      expect(stats?.successRate).toBe(0);
    });

    it('calculates success rate', () => {
      metrics.recordOperationSuccess('tts', 100);
      metrics.recordOperationSuccess('tts', 100);
      metrics.recordOperationFailure('tts', 'error');

      const stats = metrics.getOperationStats('tts');
      expect(stats?.successRate).toBeCloseTo(0.666, 2);
    });

    it('tracks latency percentiles', () => {
      for (let i = 0; i < 100; i++) {
        metrics.recordOperationSuccess('audio', i * 10);
      }

      const stats = metrics.getOperationStats('audio');
      expect(stats?.p95LatencyMs).toBeLessThanOrEqual(950);
      expect(stats?.p95LatencyMs).toBeGreaterThan(500);
    });
  });

  describe('SLA Compliance', () => {
    it('calculates SLA compliance for premium users', () => {
      for (let i = 0; i < 100; i++) {
        if (i < 99) {
          metrics.recordOperationSuccess('premium_user', 50);
        } else {
          metrics.recordOperationFailure('premium_user', 'timeout');
        }
      }

      const compliance = metrics.getSLACompliance('premium');
      expect(compliance).toBeCloseTo(0.99, 2);
    });

    it('tracks SLA target by tier', () => {
      const targetPremium = metrics.getSLATarget('premium');
      const targetStandard = metrics.getSLATarget('standard');

      expect(targetPremium).toBe(0.9999); // 99.99%
      expect(targetStandard).toBe(0.99); // 99%
    });
  });

  describe('Provider Metrics', () => {
    it('tracks per-provider success rate', () => {
      metrics.recordProviderSuccess('anthropic', 100);
      metrics.recordProviderSuccess('anthropic', 100);
      metrics.recordProviderFailure('anthropic', 'error');

      const stats = metrics.getProviderStats('anthropic');
      expect(stats?.successRate).toBeCloseTo(0.666, 2);
    });

    it('calculates provider cost per operation', () => {
      metrics.recordOperationSuccess('gemini', 150);
      metrics.recordProviderCost('gemini', 0.0015);

      const stats = metrics.getProviderStats('gemini');
      expect(stats?.avgCostPerOp).toBe(0.0015);
    });
  });

  describe('Budget Variance', () => {
    it('calculates variance between predicted and actual cost', () => {
      const predictedCost = 100;
      const actualCost = 102;

      const variance = metrics.calculateBudgetVariance(predictedCost, actualCost);
      expect(variance).toBeCloseTo(0.02, 2); // +2%
    });

    it('flags large variance anomalies', () => {
      const variance = metrics.calculateBudgetVariance(100, 150); // +50%
      const isAnomaly = Math.abs(variance) > 0.1; // >10%

      expect(isAnomaly).toBe(true);
    });
  });

  describe('Daily Snapshots', () => {
    it('creates hourly metric snapshots', () => {
      metrics.recordOperationSuccess('email_analysis', 100);
      const snapshot = metrics.createSnapshot();

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.totalOperations).toBe(1);
      expect(snapshot.avgLatencyMs).toBeGreaterThan(0);
    });

    it('tracks metric trends over time', () => {
      for (let i = 0; i < 10; i++) {
        metrics.recordOperationSuccess('tts', 100 + i);
      }

      const snapshot1 = metrics.createSnapshot();

      for (let i = 0; i < 10; i++) {
        metrics.recordOperationSuccess('tts', 200 + i);
      }

      const snapshot2 = metrics.createSnapshot();

      expect(snapshot2.avgLatencyMs).toBeGreaterThan(snapshot1.avgLatencyMs);
    });
  });

  describe('Clear', () => {
    it('clears all metrics', () => {
      metrics.recordOperationSuccess('email_analysis', 100);
      metrics.clear();

      const stats = metrics.getOperationStats('email_analysis');
      expect(stats).toBeNull();
    });
  });
});
