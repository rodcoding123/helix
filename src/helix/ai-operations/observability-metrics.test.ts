/* eslint-disable @typescript-eslint/explicit-function-return-type,@typescript-eslint/require-await */
/**
 * Observability Metrics Tests
 *
 * Comprehensive test coverage for SLA compliance, operation tracking,
 * provider metrics, budget variance, and metric snapshots.
 *
 * Phase 5: Advanced Features & Smart Routing
 * Created: 2026-02-04
 */

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

    it('returns null for untracked operation', () => {
      const stats = metrics.getOperationStats('unknown_operation');
      expect(stats).toBeNull();
    });

    it('tracks multiple operation types independently', () => {
      metrics.recordOperationSuccess('email_analysis', 100);
      metrics.recordOperationSuccess('tts', 150);

      const emailStats = metrics.getOperationStats('email_analysis');
      const ttsStats = metrics.getOperationStats('tts');

      expect(emailStats?.operationType).toBe('email_analysis');
      expect(ttsStats?.operationType).toBe('tts');
      expect(emailStats?.avgLatencyMs).not.toBe(ttsStats?.avgLatencyMs);
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

    it('returns full compliance with no failures', () => {
      for (let i = 0; i < 50; i++) {
        metrics.recordOperationSuccess('chat', 100);
      }

      const compliance = metrics.getSLACompliance('premium');
      expect(compliance).toBe(1.0);
    });

    it('returns zero compliance with all failures', () => {
      for (let i = 0; i < 50; i++) {
        metrics.recordOperationFailure('chat', 'error');
      }

      const compliance = metrics.getSLACompliance('standard');
      expect(compliance).toBe(0);
    });

    it('handles empty metrics for SLA', () => {
      const compliance = metrics.getSLACompliance('premium');
      expect(compliance).toBe(1.0);
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
      metrics.recordProviderSuccess('gemini', 150);
      metrics.recordProviderCost('gemini', 0.0015);

      const stats = metrics.getProviderStats('gemini');
      expect(stats?.avgCostPerOp).toBe(0.0015);
    });

    it('returns null for untracked provider', () => {
      const stats = metrics.getProviderStats('unknown_provider');
      expect(stats).toBeNull();
    });

    it('tracks multiple providers independently', () => {
      metrics.recordProviderSuccess('deepseek', 200);
      metrics.recordProviderSuccess('anthropic', 100);

      const deepseekStats = metrics.getProviderStats('deepseek');
      const anthropicStats = metrics.getProviderStats('anthropic');

      expect(deepseekStats?.avgLatencyMs).toBe(200);
      expect(anthropicStats?.avgLatencyMs).toBe(100);
    });

    it('aggregates costs across multiple operations', () => {
      metrics.recordProviderSuccess('stripe', 100);
      metrics.recordProviderCost('stripe', 0.001);
      metrics.recordProviderSuccess('stripe', 100);
      metrics.recordProviderCost('stripe', 0.002);

      const stats = metrics.getProviderStats('stripe');
      expect(stats?.totalOperations).toBe(2);
      expect(stats?.avgCostPerOp).toBeCloseTo(0.0015, 4);
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

    it('handles zero predicted cost', () => {
      const variance = metrics.calculateBudgetVariance(0, 100);
      expect(variance).toBe(0);
    });

    it('calculates negative variance', () => {
      const variance = metrics.calculateBudgetVariance(100, 80);
      expect(variance).toBeCloseTo(-0.2, 2); // -20%
    });

    it('calculates exact match variance', () => {
      const variance = metrics.calculateBudgetVariance(50, 50);
      expect(variance).toBe(0);
    });
  });

  describe('Daily Snapshots', () => {
    it('creates hourly metric snapshots', () => {
      metrics.recordOperationSuccess('email_analysis', 100);
      const snapshot = metrics.takeSnapshot();

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.totalOperations).toBe(1);
      expect(snapshot.avgLatencyMs).toBeGreaterThan(0);
    });

    it('tracks metric trends over time', () => {
      for (let i = 0; i < 10; i++) {
        metrics.recordOperationSuccess('tts', 100 + i);
      }

      const snapshot1 = metrics.takeSnapshot();

      for (let i = 0; i < 10; i++) {
        metrics.recordOperationSuccess('tts', 200 + i);
      }

      const snapshot2 = metrics.takeSnapshot();

      expect(snapshot2.avgLatencyMs).toBeGreaterThan(snapshot1.avgLatencyMs);
    });

    it('retrieves all snapshots', () => {
      metrics.recordOperationSuccess('chat', 100);
      metrics.takeSnapshot();

      metrics.recordOperationSuccess('chat', 150);
      metrics.takeSnapshot();

      const snapshots = metrics.getSnapshots();
      expect(snapshots.length).toBe(2);
      expect(snapshots[0].totalOperations).toBe(1);
      expect(snapshots[1].totalOperations).toBe(2);
    });

    it('snapshot includes correct operation count', () => {
      for (let i = 0; i < 25; i++) {
        metrics.recordOperationSuccess('audio', 100);
      }
      for (let i = 0; i < 5; i++) {
        metrics.recordOperationFailure('audio', 'error');
      }

      const snapshot = metrics.takeSnapshot();
      expect(snapshot.totalOperations).toBe(30);
      expect(snapshot.successCount).toBe(25);
      expect(snapshot.failureCount).toBe(5);
    });
  });

  describe('Clear', () => {
    it('clears all metrics', () => {
      metrics.recordOperationSuccess('email_analysis', 100);
      metrics.clear();

      const stats = metrics.getOperationStats('email_analysis');
      expect(stats).toBeNull();
    });

    it('clears provider metrics', () => {
      metrics.recordProviderSuccess('anthropic', 100);
      metrics.clear();

      const stats = metrics.getProviderStats('anthropic');
      expect(stats).toBeNull();
    });

    it('clears snapshots', () => {
      metrics.recordOperationSuccess('chat', 100);
      metrics.takeSnapshot();

      expect(metrics.getSnapshots().length).toBe(1);

      metrics.clear();
      expect(metrics.getSnapshots().length).toBe(0);
    });
  });

  describe('Percentile Calculation', () => {
    it('calculates p95 correctly with large dataset', () => {
      // Generate latencies: 10, 20, 30, ..., 1000
      for (let i = 1; i <= 100; i++) {
        metrics.recordOperationSuccess('load_test', i * 10);
      }

      const stats = metrics.getOperationStats('load_test');
      // p95 should be around 950ms (95th percentile of 100-1000)
      expect(stats?.p95LatencyMs).toBeLessThanOrEqual(1000);
      expect(stats?.p95LatencyMs).toBeGreaterThan(800);
    });

    it('calculates p95 with single operation', () => {
      metrics.recordOperationSuccess('single', 500);

      const stats = metrics.getOperationStats('single');
      expect(stats?.p95LatencyMs).toBe(500);
    });
  });

  describe('Real-world Scenarios', () => {
    it('tracks high-volume operation day', () => {
      // Simulate 1000 operations across multiple types
      const opTypes = ['email_analysis', 'tts', 'chat', 'audio_transcription'];
      for (let i = 0; i < 250; i++) {
        for (const opType of opTypes) {
          metrics.recordOperationSuccess(opType, 100 + Math.random() * 50);
        }
      }

      const snapshot = metrics.takeSnapshot();
      expect(snapshot.totalOperations).toBe(1000);
      expect(snapshot.successCount).toBe(1000);
      expect(snapshot.successRate).toBe(1.0);
    });

    it('tracks mixed success/failure day', () => {
      for (let i = 0; i < 90; i++) {
        metrics.recordOperationSuccess('chat', 100);
      }
      for (let i = 0; i < 10; i++) {
        metrics.recordOperationFailure('chat', 'error');
      }

      const stats = metrics.getOperationStats('chat');
      expect(stats?.successRate).toBeCloseTo(0.9, 2);
    });

    it('tracks provider performance across multiple metrics', () => {
      const providers = ['anthropic', 'gemini', 'deepseek'];
      for (const provider of providers) {
        // Record both operation metrics and provider metrics
        for (let i = 0; i < 100; i++) {
          metrics.recordOperationSuccess(provider, 100 + Math.random() * 100);
          if (i % 10 === 0) {
            metrics.recordOperationFailure(provider, 'timeout');
          }
        }
        for (let i = 0; i < 100; i++) {
          metrics.recordProviderCost(provider, 0.001 + Math.random() * 0.005);
        }
      }

      const snapshot = metrics.takeSnapshot();
      expect(snapshot.totalOperations).toBeGreaterThan(300);
      expect(snapshot.successRate).toBeGreaterThan(0.8);
    });
  });
});
