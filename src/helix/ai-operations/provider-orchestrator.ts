/**
 * Provider Orchestrator - Phase 4
 *
 * Manages provider selection, failover, and cost-aware routing.
 * Integrates with ProviderHealthMonitor for intelligent decision-making.
 */

import { ProviderHealthMonitor, ProviderName } from './provider-health.js';
import { calculateProviderCost } from './providers/index.js';

export interface FailoverRecord {
  timestamp: string;
  operationId: string;
  from: ProviderName;
  to: ProviderName;
  reason: string;
}

const MAX_FAILOVER_ATTEMPTS = 5;
const FAILOVER_RESET_WINDOW = 60 * 60 * 1000; // 1 hour

export class ProviderOrchestrator {
  private healthMonitor: ProviderHealthMonitor;
  private failoverHistory: Map<string, FailoverRecord[]> = new Map();
  private failoverAttempts: Map<string, number[]> = new Map(); // operation_id -> [timestamp, ...]

  constructor(monitor: ProviderHealthMonitor) {
    this.healthMonitor = monitor;
  }

  /**
   * Select best provider from options (primary, secondary, tertiary)
   */
  selectProvider(
    _operationId: string,
    primaryProvider: ProviderName,
    secondaryProvider?: ProviderName,
    tertiaryProvider?: ProviderName
  ): ProviderName {
    const candidates = [primaryProvider, secondaryProvider, tertiaryProvider].filter(
      (p): p is ProviderName => p !== undefined
    );

    // Get ranked providers by health
    const ranked = this.healthMonitor.getRankedProviders();
    const rankedMap = new Map(ranked.map(r => [r.provider, r]));

    // Find first healthy candidate
    for (const candidate of candidates) {
      const health = rankedMap.get(candidate);
      if (health?.isHealthy) {
        return candidate;
      }
    }

    // If all unhealthy, return best-health candidate
    return candidates.reduce((best, current) => {
      const bestHealth = rankedMap.get(best);
      const currentHealth = rankedMap.get(current);
      return (currentHealth?.successRate || 0) > (bestHealth?.successRate || 0) ? current : best;
    });
  }

  /**
   * Select provider based on cost optimization
   */
  selectProviderByCost(
    _operationId: string,
    candidates: ProviderName[],
    inputTokens: number,
    outputTokens: number
  ): ProviderName {
    const ranked = this.healthMonitor.getRankedProviders();
    const rankedMap = new Map(ranked.map(r => [r.provider, r]));

    // Get healthy candidates
    const healthyCandidates = candidates.filter(c => rankedMap.get(c)?.isHealthy);

    if (healthyCandidates.length === 0) {
      // All unhealthy, return cheapest
      return this.selectCheapestProvider(candidates, inputTokens, outputTokens);
    }

    // Return cheapest among healthy
    return this.selectCheapestProvider(healthyCandidates, inputTokens, outputTokens);
  }

  /**
   * Record a failover event
   */
  recordFailover(operationId: string, from: ProviderName, to: ProviderName, reason: string): void {
    const key = `${operationId}_${from}`;
    if (!this.failoverHistory.has(key)) {
      this.failoverHistory.set(key, []);
    }

    this.failoverHistory.get(key)!.push({
      timestamp: new Date().toISOString(),
      operationId,
      from,
      to,
      reason,
    });

    // Track attempt count
    if (!this.failoverAttempts.has(key)) {
      this.failoverAttempts.set(key, []);
    }
    this.failoverAttempts.get(key)!.push(Date.now());
  }

  /**
   * Check if more failovers are allowed
   */
  canFailover(operationId: string, from: ProviderName): boolean {
    const key = `${operationId}_${from}`;
    const attempts = this.failoverAttempts.get(key) || [];

    // Clean old attempts outside reset window
    const now = Date.now();
    const recentAttempts = attempts.filter(t => now - t < FAILOVER_RESET_WINDOW);

    return recentAttempts.length < MAX_FAILOVER_ATTEMPTS;
  }

  /**
   * Get failover history for operation
   */
  getFailoverHistory(operationId: string): FailoverRecord[] {
    const allRecords: FailoverRecord[] = [];
    for (const [key, records] of this.failoverHistory) {
      if (key.startsWith(operationId)) {
        allRecords.push(...records);
      }
    }
    return allRecords.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get p95 latency for provider
   */
  getProviderP95Latency(provider: ProviderName): number {
    const health = this.healthMonitor.getProviderHealth(provider);
    if (health.totalOperations === 0) return 0;

    // Simple approximation: average + std dev
    const avg = health.avgLatencyMs;
    // Assuming failures take longer, use failure count as proxy for high latency
    const failureImpact = (health.failureCount / Math.max(health.totalOperations, 1)) * avg;

    return avg + failureImpact;
  }

  private selectCheapestProvider(
    candidates: ProviderName[],
    inputTokens: number,
    outputTokens: number
  ): ProviderName {
    let cheapest = candidates[0];
    let cheapestCost = this.getCostForProvider(cheapest, inputTokens, outputTokens);

    for (const candidate of candidates.slice(1)) {
      const cost = this.getCostForProvider(candidate, inputTokens, outputTokens);
      if (cost < cheapestCost) {
        cheapest = candidate;
        cheapestCost = cost;
      }
    }

    return cheapest;
  }

  private getCostForProvider(
    provider: ProviderName,
    inputTokens: number,
    outputTokens: number
  ): number {
    // Map provider names to model names for cost calculation
    const modelMap: Record<ProviderName, string> = {
      anthropic: 'claude-3-5-sonnet-20241022',
      gemini: 'gemini-2-0-flash',
      deepgram: 'nova-2',
      elevenlabs: 'eleven_turbo_v2_5',
    };
    const model = modelMap[provider];
    return calculateProviderCost(model, inputTokens, outputTokens);
  }
}
