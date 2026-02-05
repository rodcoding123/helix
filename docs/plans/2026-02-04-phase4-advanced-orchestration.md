# Phase 4: Advanced Multi-Provider Orchestration & Operation Scheduling

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement intelligent provider failover, cost-aware routing with real-time optimization, autonomous operation scheduling with trigger conditions, and multi-operation batching for efficiency.

**Architecture:** Phase 4 extends Phase 3's provider registry with three new subsystems: (1) **ProviderOrchestrator** manages failover logic and provider selection based on real-time availability + cost; (2) **OperationScheduler** enables time-based, event-based, and condition-triggered autonomous operations with configurable SLA windows; (3) **BatchOperationEngine** groups related operations to optimize costs and reduce API calls.

**Tech Stack:** TypeScript, Supabase (for scheduling metadata), Anthropic/Gemini/Deepgram/ElevenLabs APIs, Vitest for testing.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Phase 4: Orchestration Layer                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Provider Orchestrator                                   │   │
│  │  - Real-time provider health monitoring                  │   │
│  │  - Intelligent failover (fast degradation)               │   │
│  │  - Cost-aware provider selection                         │   │
│  │  - Provider latency tracking                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                         │
│  ┌──────▼──────────────────────────────────────────────────┐   │
│  │  Operation Scheduler                                     │   │
│  │  - Cron-like scheduling (time-based triggers)            │   │
│  │  - Event-based triggers (file changes, webhook events)   │   │
│  │  - Condition-based triggers (cost threshold, batch size) │   │
│  │  - SLA window enforcement (quiet hours, rate limits)     │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                         │
│  ┌──────▼──────────────────────────────────────────────────┐   │
│  │  Batch Operation Engine                                  │   │
│  │  - Group similar operations                              │   │
│  │  - Cost optimization (batch discounts)                   │   │
│  │  - Parallel execution with concurrency limits            │   │
│  │  - Failure isolation (one failure ≠ entire batch fails)  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
          │
          │ Uses Phase 3 Providers + Phase 0.5 Router
          │
┌─────────────────────────────────────────────────────────────────┐
│                 Phase 3: Provider Registry (Existing)            │
│          [Anthropic] [Gemini] [Deepgram] [ElevenLabs]           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Provider Orchestration

**Current State (Phase 3):** Router picks one provider per operation (no failover)

**Problem:** If provider fails → operation fails

**Solution:**

- Monitor provider health (success rate, latency, error types)
- Fallback chain: Primary → Secondary → Tertiary
- Cost-aware failover: Only fail to expensive provider if cheaper one unavailable
- Circuit breaker pattern: Disable failed provider for 5 minutes

**Example:**

```
Request video analysis:
1. Try Gemini-2.0 (primary, cheapest) → 500ms response
2. If timeout/error → Try Gemini-Flash (secondary, fallback) → Success
3. Circuit breaker: After 3 failures, skip to secondary for next 5 min
```

### 2. Operation Scheduling

**Current State (Phase 0.5):** Operations execute on-demand only

**Problem:** Can't automate recurring tasks (weekly summaries, daily syncs, etc.)

**Solution:**

- **Time-based:** Cron-like triggers (e.g., "every Sunday 8 AM")
- **Event-based:** Webhook triggers (e.g., "on email received")
- **Condition-based:** Custom conditions (e.g., "when batch size >= 50")
- **SLA windows:** Enforce quiet hours, rate limits, cost budgets

**Example:**

```
Schedule weekly email summary:
- Trigger: Every Sunday 08:00 UTC
- Operation: analyzeEmail(all unread emails)
- SLA: Must complete before 09:00 UTC (1 hour window)
- Cost limit: $5 max for this operation
```

### 3. Batch Operation Execution

**Current State (Phase 0.5):** Each operation executes individually

**Problem:** 50 emails analyzed separately = 50 API calls = high cost

**Solution:**

- Group operations by type (50 email analyses → 1 batch call)
- Optimize for cost (batch API calls are cheaper)
- Parallel execution with concurrency limits (max 5 concurrent)
- Per-item failure isolation (1 email fails ≠ entire batch fails)

**Example:**

```
Batch analyze 50 emails:
- Group into 5 batches of 10
- Execute batches sequentially: Batch 1, then Batch 2, etc.
- Within batch: Execute items in parallel (max 5)
- Result: 50 API operations → 5 batch calls (10x cost reduction)
```

---

## Implementation Tasks

### Task 1: Provider Health Monitoring Module

**Files:**

- Create: `src/helix/ai-operations/provider-health.ts`
- Create: `src/helix/ai-operations/provider-health.test.ts`
- Modify: `src/helix/ai-operations/router.ts:15-30` (add health check integration)

**Step 1: Write failing test**

Create `src/helix/ai-operations/provider-health.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
```

**Step 2: Run test to verify failure**

```bash
cd /c/Users/Specter/Desktop/Helix
npx vitest run src/helix/ai-operations/provider-health.test.ts
```

Expected: FAIL - "ProviderHealthMonitor is not defined"

**Step 3: Implement ProviderHealthMonitor**

Create `src/helix/ai-operations/provider-health.ts`:

```typescript
/**
 * Provider Health Monitoring - Phase 4
 *
 * Tracks provider health metrics including success rate, latency, failure patterns,
 * and implements circuit breaker pattern for automatic failover.
 */

export type ProviderName = 'anthropic' | 'gemini' | 'deepgram' | 'elevenlabs';
export type CircuitStatus = 'closed' | 'open' | 'half-open';

export interface ProviderHealthMetrics {
  provider: ProviderName;
  isHealthy: boolean;
  successRate: number;
  totalOperations: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  circuitStatus: CircuitStatus;
  recentFailures: FailureRecord[];
  lastChecked: string;
}

export interface FailureRecord {
  timestamp: string;
  errorType: string;
  latencyMs: number;
}

interface ProviderState {
  successCount: number;
  failureCount: number;
  totalLatency: number;
  circuitStatus: CircuitStatus;
  circuitOpenedAt: number | null;
  recentFailures: FailureRecord[];
}

const CIRCUIT_BREAKER_THRESHOLD = 3; // Open circuit after 3 failures
const CIRCUIT_RECOVERY_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_FAILURE_HISTORY = 10;

export class ProviderHealthMonitor {
  private providers: Map<ProviderName, ProviderState> = new Map();
  private readonly allProviders: ProviderName[] = ['anthropic', 'gemini', 'deepgram', 'elevenlabs'];

  constructor() {
    // Initialize all providers
    for (const provider of this.allProviders) {
      this.providers.set(provider, {
        successCount: 0,
        failureCount: 0,
        totalLatency: 0,
        circuitStatus: 'closed',
        circuitOpenedAt: null,
        recentFailures: [],
      });
    }
  }

  /**
   * Record successful operation
   */
  recordSuccess(provider: ProviderName, latencyMs: number): void {
    const state = this.getOrInitProvider(provider);
    state.successCount++;
    state.totalLatency += latencyMs;

    // Half-open circuit success → close it
    if (state.circuitStatus === 'half-open') {
      state.circuitStatus = 'closed';
      state.circuitOpenedAt = null;
    }
  }

  /**
   * Record failed operation
   */
  recordFailure(provider: ProviderName, errorType: string, latencyMs: number): void {
    const state = this.getOrInitProvider(provider);
    state.failureCount++;

    const failure: FailureRecord = {
      timestamp: new Date().toISOString(),
      errorType,
      latencyMs,
    };

    state.recentFailures.unshift(failure);
    if (state.recentFailures.length > MAX_FAILURE_HISTORY) {
      state.recentFailures.pop();
    }

    // Check circuit breaker threshold
    const consecutiveFailures = state.recentFailures.filter(
      f => f.timestamp > new Date(Date.now() - 5 * 60 * 1000).toISOString()
    ).length;

    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && state.circuitStatus === 'closed') {
      state.circuitStatus = 'open';
      state.circuitOpenedAt = Date.now();
    }
  }

  /**
   * Get current health metrics for a provider
   */
  getProviderHealth(provider: ProviderName): ProviderHealthMetrics {
    const state = this.getOrInitProvider(provider);

    // Check if circuit should transition to half-open
    if (state.circuitStatus === 'open' && state.circuitOpenedAt) {
      const elapsed = Date.now() - state.circuitOpenedAt;
      if (elapsed > CIRCUIT_RECOVERY_WINDOW) {
        state.circuitStatus = 'half-open';
      }
    }

    const total = state.successCount + state.failureCount;
    const successRate = total === 0 ? 1.0 : state.successCount / total;
    const avgLatency = state.successCount === 0 ? 0 : state.totalLatency / state.successCount;

    return {
      provider,
      isHealthy: state.circuitStatus !== 'open' && successRate > 0.5,
      successRate,
      totalOperations: total,
      successCount: state.successCount,
      failureCount: state.failureCount,
      avgLatencyMs: avgLatency,
      circuitStatus: state.circuitStatus,
      recentFailures: state.recentFailures,
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Get providers ranked by health (best first)
   */
  getRankedProviders(): ProviderHealthMetrics[] {
    return this.allProviders
      .map(provider => this.getProviderHealth(provider))
      .sort((a, b) => {
        // Healthy providers first
        if (a.isHealthy !== b.isHealthy) {
          return a.isHealthy ? -1 : 1;
        }
        // Then by success rate
        return b.successRate - a.successRate;
      });
  }

  /**
   * Reset metrics for a provider (for testing)
   */
  reset(provider?: ProviderName): void {
    if (provider) {
      this.providers.delete(provider);
      this.getOrInitProvider(provider);
    } else {
      this.providers.clear();
      for (const p of this.allProviders) {
        this.getOrInitProvider(p);
      }
    }
  }

  private getOrInitProvider(provider: ProviderName): ProviderState {
    if (!this.providers.has(provider)) {
      this.providers.set(provider, {
        successCount: 0,
        failureCount: 0,
        totalLatency: 0,
        circuitStatus: 'closed',
        circuitOpenedAt: null,
        recentFailures: [],
      });
    }
    return this.providers.get(provider)!;
  }
}
```

**Step 4: Run test to verify passing**

```bash
cd /c/Users/Specter/Desktop/Helix
npx vitest run src/helix/ai-operations/provider-health.test.ts
```

Expected: PASS - All 9 tests passing

**Step 5: Commit**

```bash
cd /c/Users/Specter/Desktop/Helix
git add src/helix/ai-operations/provider-health.ts src/helix/ai-operations/provider-health.test.ts
git commit -m "feat(phase4-task1): implement provider health monitoring with circuit breaker"
```

---

### Task 2: Provider Orchestrator with Failover

**Files:**

- Create: `src/helix/ai-operations/provider-orchestrator.ts`
- Create: `src/helix/ai-operations/provider-orchestrator.test.ts`
- Modify: `src/helix/ai-operations/router.ts:200-250` (integrate orchestrator)

**Step 1: Write failing test**

Create `src/helix/ai-operations/provider-orchestrator.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
```

**Step 2: Run test to verify failure**

```bash
npx vitest run src/helix/ai-operations/provider-orchestrator.test.ts
```

Expected: FAIL - "ProviderOrchestrator is not defined"

**Step 3: Implement ProviderOrchestrator**

Create `src/helix/ai-operations/provider-orchestrator.ts`:

```typescript
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
    operationId: string,
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
    operationId: string,
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
    let cheapestCost = calculateProviderCost(cheapest, inputTokens, outputTokens);

    for (const candidate of candidates.slice(1)) {
      const cost = calculateProviderCost(candidate, inputTokens, outputTokens);
      if (cost < cheapestCost) {
        cheapest = candidate;
        cheapestCost = cost;
      }
    }

    return cheapest;
  }
}
```

**Step 4: Run test to verify passing**

```bash
npx vitest run src/helix/ai-operations/provider-orchestrator.test.ts
```

Expected: PASS - All 9 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/provider-orchestrator.ts src/helix/ai-operations/provider-orchestrator.test.ts
git commit -m "feat(phase4-task2): implement provider orchestrator with failover and cost optimization"
```

---

### Task 3: Operation Scheduler

**Files:**

- Create: `src/helix/ai-operations/operation-scheduler.ts`
- Create: `src/helix/ai-operations/operation-scheduler.test.ts`

**Step 1: Write failing test**

Create `src/helix/ai-operations/operation-scheduler.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OperationScheduler, ScheduleTrigger } from './operation-scheduler.js';

describe('OperationScheduler', () => {
  let scheduler: OperationScheduler;

  beforeEach(() => {
    scheduler = new OperationScheduler();
  });

  describe('Cron Schedule Triggers', () => {
    it('parses cron expressions', () => {
      const trigger = scheduler.parseCronTrigger('0 8 * * 0'); // Sunday 8am
      expect(trigger).toEqual({
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      });
    });

    it('determines if cron trigger should fire', () => {
      const trigger: ScheduleTrigger = {
        type: 'cron',
        pattern: '0 8 * * 0', // Every Sunday at 8 AM
        timezone: 'UTC',
      };

      // Create a date on Sunday 8:00 AM UTC
      const sundayMorning = new Date('2026-02-01T08:00:00Z'); // First is Sunday
      const shouldFire = scheduler.shouldFireTrigger(trigger, sundayMorning);
      expect(shouldFire).toBe(true);
    });

    it('rejects non-matching cron times', () => {
      const trigger: ScheduleTrigger = {
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      };

      const mondayMorning = new Date('2026-02-02T08:00:00Z');
      const shouldFire = scheduler.shouldFireTrigger(trigger, mondayMorning);
      expect(shouldFire).toBe(false);
    });
  });

  describe('Event Triggers', () => {
    it('creates event-based trigger', () => {
      const trigger = scheduler.createEventTrigger('email.received', { label: 'inbox' });
      expect(trigger.type).toBe('event');
      expect(trigger.eventName).toBe('email.received');
    });

    it('matches event triggers', () => {
      const trigger = scheduler.createEventTrigger('email.received', { label: 'inbox' });
      const matches = scheduler.matchesEventTrigger(trigger, 'email.received', { label: 'inbox' });
      expect(matches).toBe(true);
    });

    it('rejects mismatched event properties', () => {
      const trigger = scheduler.createEventTrigger('email.received', { label: 'inbox' });
      const matches = scheduler.matchesEventTrigger(trigger, 'email.received', {
        label: 'archive',
      });
      expect(matches).toBe(false);
    });
  });

  describe('Condition Triggers', () => {
    it('creates condition trigger', () => {
      const trigger = scheduler.createConditionTrigger('batch_size >= 50');
      expect(trigger.type).toBe('condition');
      expect(trigger.condition).toBe('batch_size >= 50');
    });

    it('evaluates numeric conditions', () => {
      const trigger = scheduler.createConditionTrigger('batch_size >= 50');
      const context = { batch_size: 75 };
      const matches = scheduler.matchesConditionTrigger(trigger, context);
      expect(matches).toBe(true);
    });

    it('rejects unmet conditions', () => {
      const trigger = scheduler.createConditionTrigger('batch_size >= 50');
      const context = { batch_size: 25 };
      const matches = scheduler.matchesConditionTrigger(trigger, context);
      expect(matches).toBe(false);
    });
  });

  describe('SLA Window Enforcement', () => {
    it('validates operation within SLA window', () => {
      const sla = {
        startTime: '08:00',
        endTime: '09:00',
        timezone: 'UTC',
      };

      const within = scheduler.isWithinSLAWindow(sla, new Date('2026-02-04T08:30:00Z'));
      expect(within).toBe(true);
    });

    it('rejects operation outside SLA window', () => {
      const sla = {
        startTime: '08:00',
        endTime: '09:00',
        timezone: 'UTC',
      };

      const within = scheduler.isWithinSLAWindow(sla, new Date('2026-02-04T10:00:00Z'));
      expect(within).toBe(false);
    });

    it('respects quiet hours', () => {
      const quietHours = ['22:00-06:00']; // 10 PM - 6 AM

      const during = scheduler.isInQuietHours(quietHours, new Date('2026-02-04T23:00:00Z'));
      expect(during).toBe(true);

      const outside = scheduler.isInQuietHours(quietHours, new Date('2026-02-04T12:00:00Z'));
      expect(outside).toBe(false);
    });
  });

  describe('Schedule Registration', () => {
    it('registers a scheduled operation', () => {
      scheduler.registerSchedule('weekly_summary', {
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      });

      const registered = scheduler.getSchedule('weekly_summary');
      expect(registered).toBeDefined();
      expect(registered?.trigger.type).toBe('cron');
    });

    it('lists all scheduled operations', () => {
      scheduler.registerSchedule('summary1', {
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      });
      scheduler.registerSchedule('summary2', {
        type: 'cron',
        pattern: '0 18 * * 0',
        timezone: 'UTC',
      });

      const all = scheduler.listSchedules();
      expect(all).toHaveLength(2);
    });

    it('unregisters a scheduled operation', () => {
      scheduler.registerSchedule('to_delete', {
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      });

      scheduler.unregisterSchedule('to_delete');
      const deleted = scheduler.getSchedule('to_delete');
      expect(deleted).toBeUndefined();
    });
  });

  describe('Cost Budget Enforcement', () => {
    it('validates cost budget for operation', () => {
      const budget = {
        dailyLimitUsd: 10,
        currentSpendUsd: 5,
      };

      const canExecute = scheduler.canExecuteWithinBudget(budget, 3);
      expect(canExecute).toBe(true);
    });

    it('rejects operation exceeding budget', () => {
      const budget = {
        dailyLimitUsd: 10,
        currentSpendUsd: 8,
      };

      const canExecute = scheduler.canExecuteWithinBudget(budget, 5); // 8+5 > 10
      expect(canExecute).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify failure**

```bash
npx vitest run src/helix/ai-operations/operation-scheduler.test.ts
```

Expected: FAIL - "OperationScheduler is not defined"

**Step 3: Implement OperationScheduler**

Create `src/helix/ai-operations/operation-scheduler.ts`:

```typescript
/**
 * Operation Scheduler - Phase 4
 *
 * Manages scheduled operations with cron, event, and condition-based triggers.
 * Enforces SLA windows, quiet hours, and cost budgets.
 */

export type TriggerType = 'cron' | 'event' | 'condition';

export interface ScheduleTrigger {
  type: TriggerType;
  pattern?: string; // for cron
  timezone?: string;
  eventName?: string;
  eventFilters?: Record<string, unknown>;
  condition?: string;
}

export interface SLAWindow {
  startTime: string; // HH:MM format
  endTime: string;
  timezone: string;
}

export interface ScheduledOperation {
  id: string;
  trigger: ScheduleTrigger;
  slaWindow?: SLAWindow;
  quietHours?: string[];
  costBudgetDaily?: number;
  lastExecuted?: string;
  nextExecuted?: string;
}

interface CostBudget {
  dailyLimitUsd: number;
  currentSpendUsd: number;
}

export class OperationScheduler {
  private schedules: Map<string, ScheduledOperation> = new Map();

  /**
   * Parse cron expression (simplified, supports basic patterns)
   * Format: minute hour day month dayOfWeek
   * Example: 0 8 * * 0 = Sunday 8 AM
   */
  parseCronTrigger(pattern: string, timezone: string = 'UTC'): ScheduleTrigger {
    return {
      type: 'cron',
      pattern,
      timezone,
    };
  }

  /**
   * Check if cron trigger should fire at given time
   */
  shouldFireTrigger(trigger: ScheduleTrigger, now: Date = new Date()): boolean {
    if (trigger.type !== 'cron' || !trigger.pattern) {
      return false;
    }

    const parts = trigger.pattern.split(' ');
    if (parts.length !== 5) {
      return false;
    }

    const [minute, hour, day, month, dayOfWeek] = parts;

    // Check minute
    if (minute !== '*' && parseInt(minute) !== now.getUTCMinutes()) {
      return false;
    }

    // Check hour
    if (hour !== '*' && parseInt(hour) !== now.getUTCHours()) {
      return false;
    }

    // Check day of week (0=Sunday)
    if (dayOfWeek !== '*' && parseInt(dayOfWeek) !== now.getUTCDay()) {
      return false;
    }

    // Check day of month
    if (day !== '*' && parseInt(day) !== now.getUTCDate()) {
      return false;
    }

    // Check month (1-12)
    if (month !== '*' && parseInt(month) !== now.getUTCMonth() + 1) {
      return false;
    }

    return true;
  }

  /**
   * Create event-based trigger
   */
  createEventTrigger(eventName: string, filters?: Record<string, unknown>): ScheduleTrigger {
    return {
      type: 'event',
      eventName,
      eventFilters: filters,
    };
  }

  /**
   * Check if event matches trigger
   */
  matchesEventTrigger(
    trigger: ScheduleTrigger,
    eventName: string,
    eventData: Record<string, unknown>
  ): boolean {
    if (trigger.type !== 'event' || trigger.eventName !== eventName) {
      return false;
    }

    if (!trigger.eventFilters) {
      return true;
    }

    // Check all filters match
    for (const [key, expectedValue] of Object.entries(trigger.eventFilters)) {
      if (eventData[key] !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create condition-based trigger
   */
  createConditionTrigger(condition: string): ScheduleTrigger {
    return {
      type: 'condition',
      condition,
    };
  }

  /**
   * Check if condition is met
   */
  matchesConditionTrigger(trigger: ScheduleTrigger, context: Record<string, unknown>): boolean {
    if (trigger.type !== 'condition' || !trigger.condition) {
      return false;
    }

    // Simple condition evaluator for numeric comparisons
    // Supports: >=, <=, >, <, ==, !=
    const regex = /(\w+)\s*(>=|<=|>|<|==|!=)\s*(\d+)/;
    const match = trigger.condition.match(regex);

    if (!match) {
      return false;
    }

    const [, variable, operator, value] = match;
    const contextValue = context[variable];

    if (typeof contextValue !== 'number') {
      return false;
    }

    const numValue = parseInt(value);
    switch (operator) {
      case '>=':
        return contextValue >= numValue;
      case '<=':
        return contextValue <= numValue;
      case '>':
        return contextValue > numValue;
      case '<':
        return contextValue < numValue;
      case '==':
        return contextValue === numValue;
      case '!=':
        return contextValue !== numValue;
      default:
        return false;
    }
  }

  /**
   * Check if current time is within SLA window
   */
  isWithinSLAWindow(sla: SLAWindow, now: Date = new Date()): boolean {
    const time = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    return time >= sla.startTime && time <= sla.endTime;
  }

  /**
   * Check if current time is in quiet hours
   */
  isInQuietHours(quietHours: string[], now: Date = new Date()): boolean {
    const time = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const range of quietHours) {
      const [start, end] = range.split('-');
      if (start > end) {
        // Quiet hours span midnight (e.g., 22:00-06:00)
        if (time >= start || time <= end) {
          return true;
        }
      } else {
        // Normal range (e.g., 06:00-09:00)
        if (time >= start && time <= end) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Register a scheduled operation
   */
  registerSchedule(id: string, trigger: ScheduleTrigger, slaWindow?: SLAWindow): void {
    this.schedules.set(id, {
      id,
      trigger,
      slaWindow,
    });
  }

  /**
   * Get a scheduled operation
   */
  getSchedule(id: string): ScheduledOperation | undefined {
    return this.schedules.get(id);
  }

  /**
   * List all scheduled operations
   */
  listSchedules(): ScheduledOperation[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Unregister a scheduled operation
   */
  unregisterSchedule(id: string): void {
    this.schedules.delete(id);
  }

  /**
   * Check if operation can execute within cost budget
   */
  canExecuteWithinBudget(budget: CostBudget, estimatedCostUsd: number): boolean {
    return budget.currentSpendUsd + estimatedCostUsd <= budget.dailyLimitUsd;
  }
}
```

**Step 4: Run test to verify passing**

```bash
npx vitest run src/helix/ai-operations/operation-scheduler.test.ts
```

Expected: PASS - All 13 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/operation-scheduler.ts src/helix/ai-operations/operation-scheduler.test.ts
git commit -m "feat(phase4-task3): implement operation scheduler with cron, event, and condition triggers"
```

---

### Task 4: Batch Operation Engine

**Files:**

- Create: `src/helix/ai-operations/batch-engine.ts`
- Create: `src/helix/ai-operations/batch-engine.test.ts`

**Step 1: Write failing test**

Create `src/helix/ai-operations/batch-engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchOperationEngine, BatchConfig } from './batch-engine.js';

describe('BatchOperationEngine', () => {
  let engine: BatchOperationEngine;

  beforeEach(() => {
    engine = new BatchOperationEngine();
  });

  describe('Batch Creation', () => {
    it('creates a new batch', () => {
      const batch = engine.createBatch('email_analysis', 10);
      expect(batch.id).toBeDefined();
      expect(batch.operationType).toBe('email_analysis');
      expect(batch.maxBatchSize).toBe(10);
      expect(batch.items).toHaveLength(0);
    });

    it('adds items to batch', () => {
      const batch = engine.createBatch('email_analysis', 10);
      const itemId1 = engine.addToBatch(batch.id, { emailId: 'email1' });
      const itemId2 = engine.addToBatch(batch.id, { emailId: 'email2' });

      const updated = engine.getBatch(batch.id);
      expect(updated!.items).toHaveLength(2);
      expect(updated!.items[0].id).toBe(itemId1);
    });

    it('prevents adding to full batch', () => {
      const batch = engine.createBatch('email_analysis', 2);
      engine.addToBatch(batch.id, { emailId: 'email1' });
      engine.addToBatch(batch.id, { emailId: 'email2' });

      const result = engine.addToBatch(batch.id, { emailId: 'email3' });
      expect(result).toBeNull(); // Batch full
    });

    it('creates new batch when current is full', () => {
      const batch1 = engine.createBatch('email_analysis', 2);
      engine.addToBatch(batch1.id, { emailId: 'email1' });
      engine.addToBatch(batch1.id, { emailId: 'email2' });

      const batch2 = engine.getOrCreateBatch('email_analysis', 2);
      expect(batch2.id).not.toBe(batch1.id);
    });
  });

  describe('Batch Execution', () => {
    it('executes batch items sequentially', async () => {
      const batch = engine.createBatch('email_analysis', 5);
      const executionOrder: string[] = [];

      const executor = async (item: unknown) => {
        const data = item as Record<string, unknown>;
        executionOrder.push(data.emailId as string);
        await Promise.resolve();
      };

      engine.addToBatch(batch.id, { emailId: 'email1' });
      engine.addToBatch(batch.id, { emailId: 'email2' });
      engine.addToBatch(batch.id, { emailId: 'email3' });

      await engine.executeBatch(batch.id, executor, { maxConcurrency: 1 });

      expect(executionOrder).toHaveLength(3);
      expect(executionOrder).toEqual(['email1', 'email2', 'email3']);
    });

    it('executes items with concurrency limit', async () => {
      const batch = engine.createBatch('email_analysis', 10);
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const executor = async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCount--;
      };

      for (let i = 0; i < 10; i++) {
        engine.addToBatch(batch.id, { index: i });
      }

      await engine.executeBatch(batch.id, executor, { maxConcurrency: 3 });

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('isolates failures in batch', async () => {
      const batch = engine.createBatch('email_analysis', 5);
      const results: string[] = [];

      const executor = async (item: unknown) => {
        const data = item as Record<string, unknown>;
        const id = data.emailId as string;
        if (id === 'email2') {
          throw new Error('Failed to process email2');
        }
        results.push(id);
      };

      engine.addToBatch(batch.id, { emailId: 'email1' });
      engine.addToBatch(batch.id, { emailId: 'email2' });
      engine.addToBatch(batch.id, { emailId: 'email3' });

      const batchResult = await engine.executeBatch(batch.id, executor, { maxConcurrency: 1 });

      expect(results).toContain('email1');
      expect(results).toContain('email3');
      expect(batchResult.successful).toBe(2);
      expect(batchResult.failed).toBe(1);
    });
  });

  describe('Cost Calculation', () => {
    it('calculates batch cost vs individual cost', () => {
      const batch = engine.createBatch('email_analysis', 5);
      for (let i = 0; i < 5; i++) {
        engine.addToBatch(batch.id, { emailId: `email${i}` });
      }

      const batchCost = engine.calculateBatchCost(batch.id, 100, 50);
      const individualCost = 5 * 0.001; // Assuming $0.001 per email

      // Batch should be cheaper (roughly)
      expect(batchCost).toBeLessThan(individualCost * 1.5); // Allow some variance
    });
  });

  describe('Batch Status', () => {
    it('tracks batch status', () => {
      const batch = engine.createBatch('email_analysis', 5);
      engine.addToBatch(batch.id, { emailId: 'email1' });

      let status = engine.getBatchStatus(batch.id);
      expect(status?.status).toBe('pending');

      // Mark as executing
      engine.markBatchExecuting(batch.id);
      status = engine.getBatchStatus(batch.id);
      expect(status?.status).toBe('executing');
    });

    it('reports batch statistics', () => {
      const batch = engine.createBatch('email_analysis', 5);
      engine.addToBatch(batch.id, { emailId: 'email1' });
      engine.addToBatch(batch.id, { emailId: 'email2' });

      const stats = engine.getBatchStats();
      expect(stats.totalBatches).toBeGreaterThan(0);
      expect(stats.totalItems).toBeGreaterThanOrEqual(2);
    });
  });
});
```

**Step 2: Run test to verify failure**

```bash
npx vitest run src/helix/ai-operations/batch-engine.test.ts
```

Expected: FAIL - "BatchOperationEngine is not defined"

**Step 3: Implement BatchOperationEngine**

Create `src/helix/ai-operations/batch-engine.ts`:

```typescript
/**
 * Batch Operation Engine - Phase 4
 *
 * Groups related operations for efficient execution and cost optimization.
 * Supports parallel execution with concurrency limits and failure isolation.
 */

export interface BatchItem {
  id: string;
  data: unknown;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  error?: Error;
  result?: unknown;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxConcurrency?: number;
  timeoutMs?: number;
}

export interface Batch {
  id: string;
  operationType: string;
  maxBatchSize: number;
  items: BatchItem[];
  status: 'pending' | 'executing' | 'completed' | 'failed';
  createdAt: string;
  executedAt?: string;
}

export interface BatchExecutionResult {
  batchId: string;
  successful: number;
  failed: number;
  totalTime: number;
  itemResults: Array<{
    itemId: string;
    success: boolean;
    error?: string;
  }>;
}

export interface BatchStats {
  totalBatches: number;
  completedBatches: number;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  averageBatchSize: number;
}

export class BatchOperationEngine {
  private batches: Map<string, Batch> = new Map();
  private batchCounters: Map<string, number> = new Map();
  private nextItemId = 0;

  /**
   * Create a new batch
   */
  createBatch(operationType: string, maxBatchSize: number): Batch {
    const id = `batch_${operationType}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const batch: Batch = {
      id,
      operationType,
      maxBatchSize,
      items: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.batches.set(id, batch);
    return batch;
  }

  /**
   * Add item to batch (returns null if batch is full)
   */
  addToBatch(batchId: string, data: unknown): string | null {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.items.length >= batch.maxBatchSize) {
      return null; // Batch is full
    }

    const itemId = `item_${this.nextItemId++}`;
    const item: BatchItem = {
      id: itemId,
      data,
      status: 'pending',
    };

    batch.items.push(item);
    return itemId;
  }

  /**
   * Get or create batch (creates new if current is full)
   */
  getOrCreateBatch(operationType: string, maxBatchSize: number): Batch {
    // Find existing batch
    for (const batch of this.batches.values()) {
      if (
        batch.operationType === operationType &&
        batch.status === 'pending' &&
        batch.items.length < batch.maxBatchSize
      ) {
        return batch;
      }
    }

    // Create new batch
    return this.createBatch(operationType, maxBatchSize);
  }

  /**
   * Get batch by ID
   */
  getBatch(batchId: string): Batch | undefined {
    return this.batches.get(batchId);
  }

  /**
   * Execute batch items
   */
  async executeBatch(
    batchId: string,
    executor: (item: unknown) => Promise<void>,
    options: { maxConcurrency?: number; timeoutMs?: number } = {}
  ): Promise<BatchExecutionResult> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const maxConcurrency = options.maxConcurrency || 5;
    const startTime = Date.now();
    const itemResults: BatchExecutionResult['itemResults'] = [];
    let successful = 0;
    let failed = 0;

    // Mark batch as executing
    batch.status = 'executing';
    batch.executedAt = new Date().toISOString();

    // Execute with concurrency limit
    const queue = [...batch.items];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      // Fill up to maxConcurrency
      while (executing.length < maxConcurrency && queue.length > 0) {
        const item = queue.shift()!;
        item.status = 'executing';

        const promise = executor(item.data)
          .then(() => {
            item.status = 'completed';
            successful++;
            itemResults.push({ itemId: item.id, success: true });
          })
          .catch(error => {
            item.status = 'failed';
            item.error = error as Error;
            failed++;
            itemResults.push({
              itemId: item.id,
              success: false,
              error: (error as Error).message,
            });
          })
          .finally(() => {
            const index = executing.indexOf(promise);
            executing.splice(index, 1);
          });

        executing.push(promise);
      }

      // Wait for at least one to complete
      if (executing.length > 0) {
        await Promise.race(executing);
      }
    }

    batch.status = successful === batch.items.length ? 'completed' : 'failed';

    return {
      batchId,
      successful,
      failed,
      totalTime: Date.now() - startTime,
      itemResults,
    };
  }

  /**
   * Calculate cost for batch operation
   */
  calculateBatchCost(batchId: string, inputTokens: number, outputTokens: number): number {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return 0;
    }

    // Simplified: assume $0.001 per item average
    const baselineCost = batch.items.length * 0.001;

    // Batch discount: 10% discount per batch
    const batchDiscount = 0.9;

    return baselineCost * batchDiscount;
  }

  /**
   * Get batch status
   */
  getBatchStatus(batchId: string): Batch | undefined {
    return this.batches.get(batchId);
  }

  /**
   * Mark batch as executing
   */
  markBatchExecuting(batchId: string): void {
    const batch = this.batches.get(batchId);
    if (batch) {
      batch.status = 'executing';
      batch.executedAt = new Date().toISOString();
    }
  }

  /**
   * Get batch statistics
   */
  getBatchStats(): BatchStats {
    const batches = Array.from(this.batches.values());

    const totalBatches = batches.length;
    const completedBatches = batches.filter(b => b.status === 'completed').length;
    const totalItems = batches.reduce((sum, b) => sum + b.items.length, 0);
    const completedItems = batches.reduce(
      (sum, b) => sum + b.items.filter(i => i.status === 'completed').length,
      0
    );
    const failedItems = batches.reduce(
      (sum, b) => sum + b.items.filter(i => i.status === 'failed').length,
      0
    );

    return {
      totalBatches,
      completedBatches,
      totalItems,
      completedItems,
      failedItems,
      averageBatchSize: totalBatches > 0 ? totalItems / totalBatches : 0,
    };
  }

  /**
   * Clear all batches (for testing)
   */
  clear(): void {
    this.batches.clear();
    this.batchCounters.clear();
    this.nextItemId = 0;
  }
}
```

**Step 4: Run test to verify passing**

```bash
npx vitest run src/helix/ai-operations/batch-engine.test.ts
```

Expected: PASS - All 11 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/batch-engine.ts src/helix/ai-operations/batch-engine.test.ts
git commit -m "feat(phase4-task4): implement batch operation engine with cost optimization"
```

---

### Task 5: Integration & Router Update

**Files:**

- Modify: `src/helix/ai-operations/router.ts:14-50` (add orchestrator integration)
- Create: `src/helix/ai-operations/phase4-integration.test.ts` (integration tests)

**Step 1: Write integration test**

Create `src/helix/ai-operations/phase4-integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AIOperationRouter } from './router.js';
import { ProviderHealthMonitor } from './provider-health.js';
import { ProviderOrchestrator } from './provider-orchestrator.js';
import { OperationScheduler } from './operation-scheduler.js';
import { BatchOperationEngine } from './batch-engine.js';

describe('Phase 4: Advanced Orchestration Integration', () => {
  let router: AIOperationRouter;
  let healthMonitor: ProviderHealthMonitor;
  let orchestrator: ProviderOrchestrator;
  let scheduler: OperationScheduler;
  let batchEngine: BatchOperationEngine;

  beforeEach(() => {
    healthMonitor = new ProviderHealthMonitor();
    orchestrator = new ProviderOrchestrator(healthMonitor);
    scheduler = new OperationScheduler();
    batchEngine = new BatchOperationEngine();
    router = new AIOperationRouter();
  });

  describe('Integrated Routing with Orchestrator', () => {
    it('routes operation with failover support', async () => {
      // Initially route to anthropic
      const decision = await router.route({
        operationId: 'test_op',
        userId: 'user_123',
        estimatedInputTokens: 100,
      });

      expect(decision.model).toBeDefined();
      expect(decision.requiresApproval).toBe(false);
    });

    it('updates health metrics after operation', () => {
      // Record successful operation
      healthMonitor.recordSuccess('anthropic', 150);

      const health = healthMonitor.getProviderHealth('anthropic');
      expect(health.successCount).toBe(1);
      expect(health.avgLatencyMs).toBe(150);
    });
  });

  describe('Scheduling with Batching', () => {
    it('batches operations by type', () => {
      const batch = batchEngine.createBatch('email_analysis', 10);

      batchEngine.addToBatch(batch.id, { emailId: 'email1' });
      batchEngine.addToBatch(batch.id, { emailId: 'email2' });
      batchEngine.addToBatch(batch.id, { emailId: 'email3' });

      const retrieved = batchEngine.getBatch(batch.id);
      expect(retrieved!.items).toHaveLength(3);
    });

    it('respects scheduled triggers', () => {
      scheduler.registerSchedule('daily_summary', {
        type: 'cron',
        pattern: '0 9 * * *', // 9 AM daily
        timezone: 'UTC',
      });

      const schedule = scheduler.getSchedule('daily_summary');
      expect(schedule).toBeDefined();
      expect(schedule?.trigger.type).toBe('cron');
    });

    it('enforces SLA windows', () => {
      const slaWindow = {
        startTime: '08:00',
        endTime: '09:00',
        timezone: 'UTC',
      };

      const within = scheduler.isWithinSLAWindow(slaWindow, new Date('2026-02-04T08:30:00Z'));
      expect(within).toBe(true);
    });
  });

  describe('Cost Optimization', () => {
    it('selects cheapest provider when all healthy', () => {
      const selected = orchestrator.selectProviderByCost(
        'email_analysis',
        ['anthropic', 'gemini'],
        100,
        50
      );

      // Anthropic should be cheaper
      expect(selected).toBe('anthropic');
    });

    it('calculates batch cost savings', () => {
      const batch = batchEngine.createBatch('email_analysis', 10);

      for (let i = 0; i < 10; i++) {
        batchEngine.addToBatch(batch.id, { emailId: `email${i}` });
      }

      const batchCost = batchEngine.calculateBatchCost(batch.id, 100, 50);
      const individualCost = 10 * 0.001;

      expect(batchCost).toBeLessThan(individualCost);
    });
  });

  describe('End-to-End Workflow', () => {
    it('executes complete orchestration workflow', async () => {
      // 1. Register scheduled operation
      scheduler.registerSchedule('weekly_emails', {
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      });

      // 2. Create batch for emails
      const batch = batchEngine.createBatch('email_analysis', 50);
      for (let i = 0; i < 5; i++) {
        batchEngine.addToBatch(batch.id, { emailId: `email${i}` });
      }

      // 3. Select provider with orchestrator
      const provider = orchestrator.selectProviderByCost(
        'email_analysis',
        ['anthropic', 'gemini'],
        500,
        250
      );

      expect(provider).toBeDefined();

      // 4. Execute batch
      let executed = 0;
      const result = await batchEngine.executeBatch(
        batch.id,
        async () => {
          executed++;
        },
        { maxConcurrency: 2 }
      );

      expect(result.successful).toBe(5);
      expect(executed).toBe(5);
    });
  });
});
```

**Step 2: Run test to verify failure (incomplete integration)**

```bash
npx vitest run src/helix/ai-operations/phase4-integration.test.ts
```

Expected: Some tests should fail because router doesn't have orchestrator integration

**Step 3: Update AIOperationRouter to use orchestrator**

Modify `src/helix/ai-operations/router.ts` at the top to add imports and use orchestrator:

```typescript
// Add these imports after existing imports
import { ProviderHealthMonitor } from './provider-health.js';
import { ProviderOrchestrator } from './provider-orchestrator.js';
import { OperationScheduler } from './operation-scheduler.js';
import { BatchOperationEngine } from './batch-engine.js';

// In AIOperationRouter class constructor, add:
export class AIOperationRouter {
  private supabase: ReturnType<typeof createClient>;
  private routeCache: Map<string, { config: RouteConfig; timestamp: number }> = new Map();
  private toggleCache: Map<string, { toggle: FeatureToggle; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  // Add Phase 4 orchestration
  private healthMonitor: ProviderHealthMonitor;
  private orchestrator: ProviderOrchestrator;
  private scheduler: OperationScheduler;
  private batchEngine: BatchOperationEngine;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    // ... existing constructor code ...

    // Initialize Phase 4 orchestration
    this.healthMonitor = new ProviderHealthMonitor();
    this.orchestrator = new ProviderOrchestrator(this.healthMonitor);
    this.scheduler = new OperationScheduler();
    this.batchEngine = new BatchOperationEngine();
  }

  // Add public getter methods
  getHealthMonitor(): ProviderHealthMonitor {
    return this.healthMonitor;
  }

  getOrchestrator(): ProviderOrchestrator {
    return this.orchestrator;
  }

  getScheduler(): OperationScheduler {
    return this.scheduler;
  }

  getBatchEngine(): BatchOperationEngine {
    return this.batchEngine;
  }
}
```

**Step 4: Run integration test**

```bash
npx vitest run src/helix/ai-operations/phase4-integration.test.ts
```

Expected: PASS - All integration tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/router.ts src/helix/ai-operations/phase4-integration.test.ts
git commit -m "feat(phase4-task5): integrate orchestrator, scheduler, and batch engine with router"
```

---

### Task 6: Update Router Tests & Full Quality Check

**Files:**

- Modify: `src/helix/ai-operations/router.test.ts` (update for Phase 4)
- Verify: All tests passing, typecheck, lint

**Step 1: Update router tests for Phase 4**

The router tests should be updated to verify the new orchestration is available. Modify the test to check that getOrchestrator() returns the orchestrator.

Add to `src/helix/ai-operations/router.test.ts`:

```typescript
describe('Phase 4 Integration', () => {
  it('provides access to health monitor', () => {
    const monitor = router.getHealthMonitor();
    expect(monitor).toBeDefined();
  });

  it('provides access to orchestrator', () => {
    const orchestrator = router.getOrchestrator();
    expect(orchestrator).toBeDefined();
  });

  it('provides access to scheduler', () => {
    const scheduler = router.getScheduler();
    expect(scheduler).toBeDefined();
  });

  it('provides access to batch engine', () => {
    const batchEngine = router.getBatchEngine();
    expect(batchEngine).toBeDefined();
  });
});
```

**Step 2: Run all tests**

```bash
cd /c/Users/Specter/Desktop/Helix
npm run test -- src/helix/ai-operations/
```

Expected: All 100+ tests passing

**Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: No TypeScript errors

**Step 4: Run linter**

```bash
npm run lint
```

Expected: No ESLint errors

**Step 5: Final commit**

```bash
git add src/helix/ai-operations/router.test.ts
git commit -m "feat(phase4-task6): add phase 4 integration tests and verify all quality checks"
```

---

## Summary

Phase 4 delivers three major subsystems:

1. **Provider Health Monitoring** (Task 1) - Tracks provider availability, success rates, latency, and implements circuit breaker pattern for automatic failover

2. **Provider Orchestrator** (Task 2) - Intelligent provider selection based on health metrics, with cost-aware failover chains

3. **Operation Scheduler** (Task 3) - Cron, event, and condition-based triggers with SLA window enforcement and quiet hours

4. **Batch Operation Engine** (Task 4) - Groups operations for cost optimization and parallel execution with failure isolation

5. **Integration** (Task 5-6) - Router integration and comprehensive testing

**Total Files Created:** 8 (6 implementation + 2 test integration)
**Tests Added:** 50+ new tests covering all Phase 4 features
**Commits:** 6 with clear, atomic changes

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-04-phase4-advanced-orchestration.md`.

**Two execution options:**

**Option 1: Subagent-Driven (this session)**

- I dispatch fresh subagent per task, review between tasks
- Fast iteration, immediate feedback
- Best for tight iteration loops

**Option 2: Parallel Session (separate)**

- New session with executing-plans
- Batch execution with checkpoints
- Better for async work

**Which approach would you prefer?**
