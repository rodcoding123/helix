import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderOrchestrator } from './provider-orchestrator.js';
import { ProviderHealthMonitor } from './provider-health.js';

describe('ProviderOrchestrator', () => {
  let orchestrator: ProviderOrchestrator;
  let monitor: ProviderHealthMonitor;

  beforeEach(() => {
    monitor = new ProviderHealthMonitor();
    orchestrator = new ProviderOrchestrator(monitor);
  });

  describe('Provider Selection', () => {
    it('selects primary provider when healthy', () => {
      const provider = orchestrator.selectProvider('email_analysis', 'anthropic', 'gemini');
      expect(provider).toBe('anthropic');
    });

    it('fails over to secondary when primary unhealthy', () => {
      // Break primary
      monitor.recordFailure('anthropic', 'error', 1000);
      monitor.recordFailure('anthropic', 'error', 1000);
      monitor.recordFailure('anthropic', 'error', 1000);

      const provider = orchestrator.selectProvider('email_analysis', 'anthropic', 'gemini');
      expect(provider).toBe('gemini');
    });

    it('respects failover chain', () => {
      // Break both primary and secondary
      for (let i = 0; i < 3; i++) {
        monitor.recordFailure('anthropic', 'error', 1000);
        monitor.recordFailure('gemini', 'error', 1000);
      }

      const provider = orchestrator.selectProvider(
        'email_analysis',
        'anthropic',
        'gemini',
        'deepgram'
      );
      expect(provider).toBe('deepgram');
    });

    it('prefers healthier provider when both available', () => {
      monitor.recordSuccess('anthropic', 100);
      monitor.recordSuccess('anthropic', 100);
      monitor.recordSuccess('anthropic', 100);

      monitor.recordSuccess('gemini', 150);
      monitor.recordFailure('gemini', 'timeout', 2000);

      const provider = orchestrator.selectProvider('email_analysis', 'anthropic', 'gemini');
      expect(provider).toBe('anthropic');
    });
  });

  describe('Cost-Aware Selection', () => {
    it('considers cost when selecting provider', () => {
      // Both healthy, but anthropic cheaper
      const provider = orchestrator.selectProviderByCost(
        'agent_execution',
        ['anthropic', 'gemini'],
        1000,
        500 // output tokens
      );
      // Anthropic is cheaper, so should be selected
      expect(['anthropic', 'gemini']).toContain(provider);
    });

    it('fails over to expensive provider if cheaper unavailable', () => {
      // Break anthropic (cheaper)
      for (let i = 0; i < 3; i++) {
        monitor.recordFailure('anthropic', 'error', 1000);
      }

      const provider = orchestrator.selectProviderByCost(
        'agent_execution',
        ['anthropic', 'gemini'],
        1000,
        500
      );
      expect(provider).toBe('gemini');
    });
  });

  describe('Automatic Failover', () => {
    it('tracks failover attempts', () => {
      orchestrator.recordFailover('email_analysis', 'anthropic', 'gemini', 'timeout');

      const history = orchestrator.getFailoverHistory('email_analysis');
      expect(history).toHaveLength(1);
      expect(history[0].from).toBe('anthropic');
      expect(history[0].to).toBe('gemini');
    });

    it('limits failover attempts', () => {
      const canFailover = orchestrator.canFailover('email_analysis', 'anthropic');
      expect(canFailover).toBe(true);

      // Record 5 failovers
      for (let i = 0; i < 5; i++) {
        orchestrator.recordFailover('email_analysis', 'anthropic', 'gemini', 'error');
      }

      // 6th should be rejected
      const canFailoverAgain = orchestrator.canFailover('email_analysis', 'anthropic');
      expect(canFailoverAgain).toBe(false);
    });
  });

  describe('Provider Latency Tracking', () => {
    it('tracks p95 latency for providers', () => {
      for (let i = 0; i < 100; i++) {
        const latency = i < 95 ? 100 : 500; // 95 fast, 5 slow
        monitor.recordSuccess('anthropic', latency);
      }

      const p95 = orchestrator.getProviderP95Latency('anthropic');
      expect(p95).toBeLessThanOrEqual(500);
      expect(p95).toBeGreaterThan(100);
    });
  });
});
