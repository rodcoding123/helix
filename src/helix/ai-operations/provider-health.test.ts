import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderHealthMonitor } from './provider-health.js';

describe('ProviderHealthMonitor', () => {
  let monitor: ProviderHealthMonitor;

  beforeEach(() => {
    monitor = new ProviderHealthMonitor();
  });

  describe('Health Tracking', () => {
    it('initializes with all providers healthy', () => {
      const health = monitor.getProviderHealth('anthropic');
      expect(health.isHealthy).toBe(true);
      expect(health.successRate).toBe(1.0);
    });

    it('tracks successful operations', () => {
      monitor.recordSuccess('anthropic', 125);
      const health = monitor.getProviderHealth('anthropic');
      expect(health.totalOperations).toBe(1);
      expect(health.successCount).toBe(1);
    });

    it('tracks failed operations', () => {
      monitor.recordFailure('anthropic', 'timeout', 2000);
      const health = monitor.getProviderHealth('anthropic');
      expect(health.totalOperations).toBe(1);
      expect(health.failureCount).toBe(1);
      expect(health.successRate).toBe(0);
    });

    it('calculates success rate', () => {
      monitor.recordSuccess('gemini', 150);
      monitor.recordSuccess('gemini', 150);
      monitor.recordFailure('gemini', 'error', 1000);
      const health = monitor.getProviderHealth('gemini');
      expect(health.successRate).toBeCloseTo(0.666, 2);
    });

    it('tracks provider latency', () => {
      monitor.recordSuccess('deepgram', 250);
      monitor.recordSuccess('deepgram', 150);
      monitor.recordSuccess('deepgram', 200);
      const health = monitor.getProviderHealth('deepgram');
      expect(health.avgLatencyMs).toBe(200);
    });

    it('implements circuit breaker', () => {
      // 3 failures = circuit opens
      monitor.recordFailure('elevenlabs', 'error', 1000);
      monitor.recordFailure('elevenlabs', 'error', 1000);
      monitor.recordFailure('elevenlabs', 'error', 1000);
      const health = monitor.getProviderHealth('elevenlabs');
      expect(health.circuitStatus).toBe('open');
      expect(health.isHealthy).toBe(false);
    });

    it('auto-recovers circuit breaker after timeout', async () => {
      // Open circuit
      monitor.recordFailure('anthropic', 'error', 1000);
      monitor.recordFailure('anthropic', 'error', 1000);
      monitor.recordFailure('anthropic', 'error', 1000);

      let health = monitor.getProviderHealth('anthropic');
      expect(health.circuitStatus).toBe('open');

      // Wait for recovery window
      await new Promise(resolve => setTimeout(resolve, 310));

      health = monitor.getProviderHealth('anthropic');
      expect(health.circuitStatus).toBe('half-open');
    });
  });

  describe('Provider Ranking', () => {
    it('ranks providers by success rate', () => {
      monitor.recordSuccess('anthropic', 100);
      monitor.recordSuccess('anthropic', 100);
      monitor.recordFailure('gemini', 'error', 1000);

      const ranking = monitor.getRankedProviders();
      expect(ranking[0].provider).toBe('anthropic');
      expect(ranking[1].provider).toBe('gemini');
    });

    it('deprioritizes unhealthy providers', () => {
      // All healthy initially
      monitor.recordSuccess('anthropic', 100);
      monitor.recordSuccess('gemini', 100);

      // Break gemini
      monitor.recordFailure('gemini', 'error', 1000);
      monitor.recordFailure('gemini', 'error', 1000);
      monitor.recordFailure('gemini', 'error', 1000);

      const ranking = monitor.getRankedProviders();
      expect(ranking[0].provider).toBe('anthropic');
      expect(ranking[1].provider).toBe('gemini');
      expect(ranking[1].isHealthy).toBe(false);
    });
  });

  describe('Failure Analysis', () => {
    it('categorizes failure types', () => {
      monitor.recordFailure('anthropic', 'timeout', 3000);
      monitor.recordFailure('anthropic', 'rate_limit', 1000);
      monitor.recordFailure('anthropic', 'invalid_key', 500);

      const health = monitor.getProviderHealth('anthropic');
      expect(health.recentFailures).toHaveLength(3);
      expect(health.recentFailures[0].errorType).toBe('timeout');
    });

    it('identifies patterns in failures', () => {
      // Simulate pattern: all timeouts
      for (let i = 0; i < 5; i++) {
        monitor.recordFailure('gemini', 'timeout', 2500);
      }

      const health = monitor.getProviderHealth('gemini');
      const timeouts = health.recentFailures.filter(f => f.errorType === 'timeout');
      expect(timeouts).toHaveLength(5);
    });
  });
});
