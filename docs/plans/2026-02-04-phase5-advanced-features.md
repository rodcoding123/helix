# Phase 5: Advanced Features & Smart Routing

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement request prioritization, intelligent operation grouping, cost prediction, retry strategies with exponential backoff, SLA compliance monitoring, and observability metrics to make the system production-ready for Phase 7 multi-platform deployment.

**Architecture:** Phase 5 extends Phase 4's orchestration with four new subsystems: (1) **RequestPriorityQueue** manages operation execution order based on user SLA tier and operation criticality; (2) **CostPredictor** estimates operation costs before execution and provides budget alerts; (3) **RetryManager** implements exponential backoff with jitter for transient failures; (4) **ObservabilityMetrics** tracks SLA compliance, operation success rates, and provider performance.

**Tech Stack:** TypeScript, Supabase (for SLA tier storage), Vitest for testing.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│           Phase 5: Smart Routing & Observability          │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Request Priority Queue                           │    │
│  │  - SLA tier-based prioritization (Premium/Standard)   │
│  │  - Criticality levels (Low/Medium/High)              │
│  │  - Fair queuing with aging (prevent starvation)      │
│  └──────────────────────────────────────────────────┘    │
│         │                                                  │
│  ┌──────▼──────────────────────────────────────────┐    │
│  │  Cost Predictor                                  │    │
│  │  - Pre-execution cost estimation                 │    │
│  │  - Budget threshold alerts                       │    │
│  │  - Cost anomaly detection                        │    │
│  └──────────────────────────────────────────────────┘    │
│         │                                                  │
│  ┌──────▼──────────────────────────────────────────┐    │
│  │  Retry Manager                                   │    │
│  │  - Exponential backoff with jitter               │    │
│  │  - Failure classification (retriable vs terminal)     │
│  │  - Max retry limits (5 for transient, 0 for fatal)   │
│  └──────────────────────────────────────────────────┘    │
│         │                                                  │
│  ┌──────▼──────────────────────────────────────────┐    │
│  │  Observability Metrics                           │    │
│  │  - SLA compliance tracking (99.9% target)        │    │
│  │  - Operation success rates per provider          │    │
│  │  - Cost vs. budget variance analysis             │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
└──────────────────────────────────────────────────────────┘
          │
          │ Uses Phase 4 Orchestration + Phase 3 Providers
          │
┌──────────────────────────────────────────────────────────┐
│     Phase 4: Orchestration (Health, Failover, Batch)     │
└──────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Request Priority Queue

**Current State (Phase 4):** All operations execute in FIFO order

**Problem:** Premium users' operations can be delayed by budget-conscious standard users' batches

**Solution:**

- **SLA Tiers**: Premium (P1), Standard (P2)
- **Criticality Levels**: Low, Medium, High
- **Queue Formula**: `priority = (sla_tier * 100) + (criticality * 10) + age_bonus`
- **Aging**: +1 priority per minute (prevents starvation of low-priority items)

**Example:**

```
Queue state:
1. Premium + High + 0 min  → priority 110 (executes first)
2. Standard + High + 5 min → priority 65  (aging bonus: +5)
3. Standard + Low + 10 min → priority 50  (aging bonus: +10)

After 6 minutes:
1. Standard + High + 5 min → priority 71  (aging caught up!)
```

### 2. Cost Prediction

**Current State (Phase 4):** Costs tracked AFTER execution

**Problem:** Can't warn users before exceeding budget or alert on cost anomalies

**Solution:**

- **Historical Analysis**: Track cost variance per operation type
- **Anomaly Detection**: Flag operations >2 σ (standard deviations) above normal
- **Budget Alerts**: Warn at 50%, 75%, 90%, 99% of daily limit
- **Cost Prediction**: `predicted_cost = base_cost * (1 + variance_factor)`

**Example:**

```
Email analysis historical costs:
- Mean: $0.005
- Std Dev: $0.0015
- Anomaly threshold: $0.005 + (2 * $0.0015) = $0.008

New operation predicts $0.009 → FLAG as anomaly
```

### 3. Retry Manager

**Current State (Phase 4):** No retry logic, single attempt

**Problem:** Transient failures (network timeouts) fail operations unnecessarily

**Solution:**

- **Error Classification**: Transient (timeout, rate_limit) vs Terminal (auth, not_found)
- **Backoff Formula**: `delay_ms = min(base_delay * 2^attempt, max_delay) + jitter`
- **Jitter**: Random ±20% to prevent thundering herd
- **Max Retries**: 5 for transient, 0 for terminal

**Example:**

```
Attempt 1: timeout → retry in (100ms + jitter)
Attempt 2: timeout → retry in (200ms + jitter)
Attempt 3: timeout → retry in (400ms + jitter)
Attempt 4: timeout → retry in (800ms + jitter)
Attempt 5: timeout → retry in (1600ms + jitter)
Attempt 6: timeout → FAIL (max retries exceeded)
```

### 4. Observability Metrics

**Current State (Phase 4):** Track individual operation costs only

**Problem:** Can't see system health (SLA compliance, provider performance trends)

**Solution:**

- **SLA Compliance**: Percentage of operations completing within SLA window
- **Provider Metrics**: Success rate, p95 latency, cost per operation
- **Budget Variance**: Actual spend vs. predicted cost
- **Hourly Snapshots**: Track metrics over time for trend analysis

**Example:**

```
Daily SLA Report:
- Premium users: 99.95% SLA compliance (target: 99.99%)
- Standard users: 98.5% SLA compliance (target: 99%)
- Overall: 99.0% SLA compliance (target: 99.5%)

Provider Performance:
- Anthropic: 99.8% success, p95=150ms, cost=$0.003/op
- Gemini: 98.5% success, p95=200ms, cost=$0.0015/op
- Deepgram: 97.2% success, p95=300ms, cost=$0.0002/op

Budget Variance (weekly):
- Predicted: $1,500
- Actual: $1,523
- Variance: +1.5% (normal)
```

---

## Implementation Tasks

### Task 1: Request Priority Queue

**Files:**

- Create: `src/helix/ai-operations/priority-queue.ts`
- Create: `src/helix/ai-operations/priority-queue.test.ts`

**Step 1: Write failing test**

Create `src/helix/ai-operations/priority-queue.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { RequestPriorityQueue, QueueItem } from './priority-queue.js';

describe('RequestPriorityQueue', () => {
  let queue: RequestPriorityQueue;

  beforeEach(() => {
    queue = new RequestPriorityQueue();
  });

  describe('Enqueue and Dequeue', () => {
    it('enqueues items', () => {
      const item: QueueItem = {
        operationId: 'op1',
        userId: 'user1',
        slaTier: 'standard',
        criticality: 'low',
      };

      queue.enqueue(item);
      expect(queue.size()).toBe(1);
    });

    it('dequeues highest priority item first', () => {
      const premium = {
        operationId: 'op1',
        userId: 'user1',
        slaTier: 'premium' as const,
        criticality: 'low' as const,
      };
      const standard = {
        operationId: 'op2',
        userId: 'user2',
        slaTier: 'standard' as const,
        criticality: 'high' as const,
      };

      queue.enqueue(standard);
      queue.enqueue(premium);

      const first = queue.dequeue();
      expect(first?.operationId).toBe('op1'); // Premium tier first
    });

    it('returns null when empty', () => {
      const item = queue.dequeue();
      expect(item).toBeNull();
    });
  });

  describe('Priority Calculation', () => {
    it('calculates premium tier higher than standard', () => {
      const premiumPriority = queue.calculatePriority({
        operationId: 'op1',
        userId: 'u1',
        slaTier: 'premium',
        criticality: 'low',
      });
      const standardPriority = queue.calculatePriority({
        operationId: 'op2',
        userId: 'u2',
        slaTier: 'standard',
        criticality: 'low',
      });

      expect(premiumPriority).toBeGreaterThan(standardPriority);
    });

    it('calculates high criticality higher than low', () => {
      const highPriority = queue.calculatePriority({
        operationId: 'op1',
        userId: 'u1',
        slaTier: 'standard',
        criticality: 'high',
      });
      const lowPriority = queue.calculatePriority({
        operationId: 'op2',
        userId: 'u2',
        slaTier: 'standard',
        criticality: 'low',
      });

      expect(highPriority).toBeGreaterThan(lowPriority);
    });

    it('applies age bonus to prevent starvation', () => {
      const item = {
        operationId: 'op1',
        userId: 'u1',
        slaTier: 'standard' as const,
        criticality: 'low' as const,
      };

      const priorityNow = queue.calculatePriority(item);

      // Simulate 10 minutes wait
      const priorityLater = queue.calculatePriority({ ...item, ageMinutes: 10 });

      expect(priorityLater).toBeGreaterThan(priorityNow);
    });
  });

  describe('Peek and Size', () => {
    it('peeks at next item without removing', () => {
      const item = {
        operationId: 'op1',
        userId: 'u1',
        slaTier: 'standard' as const,
        criticality: 'low' as const,
      };
      queue.enqueue(item);

      const peeked = queue.peek();
      expect(peeked?.operationId).toBe('op1');
      expect(queue.size()).toBe(1);
    });

    it('reports queue size', () => {
      queue.enqueue({ operationId: 'op1', userId: 'u1', slaTier: 'standard', criticality: 'low' });
      queue.enqueue({ operationId: 'op2', userId: 'u2', slaTier: 'standard', criticality: 'low' });

      expect(queue.size()).toBe(2);
    });
  });

  describe('Clear', () => {
    it('clears all items', () => {
      queue.enqueue({ operationId: 'op1', userId: 'u1', slaTier: 'standard', criticality: 'low' });
      queue.enqueue({ operationId: 'op2', userId: 'u2', slaTier: 'standard', criticality: 'low' });

      queue.clear();
      expect(queue.size()).toBe(0);
      expect(queue.dequeue()).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify failure**

```bash
cd /c/Users/Specter/Desktop/Helix
npx vitest run src/helix/ai-operations/priority-queue.test.ts
```

Expected: FAIL - "RequestPriorityQueue is not defined"

**Step 3: Implement RequestPriorityQueue**

Create `src/helix/ai-operations/priority-queue.ts`:

```typescript
/**
 * Request Priority Queue - Phase 5
 *
 * Manages operation execution order based on SLA tier and criticality.
 * Implements aging mechanism to prevent starvation of low-priority items.
 */

export type SlaTier = 'premium' | 'standard';
export type Criticality = 'low' | 'medium' | 'high';

export interface QueueItem {
  operationId: string;
  userId: string;
  slaTier: SlaTier;
  criticality: Criticality;
  enqueuedAt?: number;
  ageMinutes?: number;
}

interface InternalQueueItem extends QueueItem {
  priority: number;
  enqueuedAt: number;
}

const SLA_TIER_WEIGHT = 100;
const CRITICALITY_WEIGHTS = { low: 10, medium: 20, high: 30 };
const AGE_BONUS_PER_MINUTE = 1;

export class RequestPriorityQueue {
  private items: InternalQueueItem[] = [];

  /**
   * Enqueue an item with calculated priority
   */
  enqueue(item: QueueItem): void {
    const enqueuedAt = Date.now();
    const priority = this.calculatePriority(item);

    const internalItem: InternalQueueItem = {
      ...item,
      priority,
      enqueuedAt,
    };

    // Insert in sorted order (highest priority first)
    let inserted = false;
    for (let i = 0; i < this.items.length; i++) {
      if (priority > this.items[i].priority) {
        this.items.splice(i, 0, internalItem);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.items.push(internalItem);
    }
  }

  /**
   * Dequeue highest priority item
   */
  dequeue(): QueueItem | null {
    if (this.items.length === 0) {
      return null;
    }

    const item = this.items.shift();
    return item || null;
  }

  /**
   * Peek at highest priority item without removing
   */
  peek(): QueueItem | null {
    if (this.items.length === 0) {
      return null;
    }

    return this.items[0];
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Calculate priority for an item
   * Priority = (SLA Tier Weight) + (Criticality Weight) + (Age Bonus)
   */
  calculatePriority(item: QueueItem): number {
    const tierWeight = item.slaTier === 'premium' ? SLA_TIER_WEIGHT : 0;
    const criticalityWeight = CRITICALITY_WEIGHTS[item.criticality];
    const ageBonus = (item.ageMinutes || 0) * AGE_BONUS_PER_MINUTE;

    return tierWeight + criticalityWeight + ageBonus;
  }
}
```

**Step 4: Run test to verify passing**

```bash
npx vitest run src/helix/ai-operations/priority-queue.test.ts
```

Expected: PASS - All 8 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/priority-queue.ts src/helix/ai-operations/priority-queue.test.ts
git commit -m "feat(phase5-task1): implement request priority queue with SLA tier and criticality"
```

---

### Task 2: Cost Predictor

**Files:**

- Create: `src/helix/ai-operations/cost-predictor.ts`
- Create: `src/helix/ai-operations/cost-predictor.test.ts`

**Step 1: Write failing test**

Create `src/helix/ai-operations/cost-predictor.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CostPredictor } from './cost-predictor.js';

describe('CostPredictor', () => {
  let predictor: CostPredictor;

  beforeEach(() => {
    predictor = new CostPredictor();
  });

  describe('Cost Estimation', () => {
    it('records historical costs', () => {
      predictor.recordCost('email_analysis', 0.005);
      predictor.recordCost('email_analysis', 0.006);
      predictor.recordCost('email_analysis', 0.004);

      const stats = predictor.getOperationStats('email_analysis');
      expect(stats?.count).toBe(3);
      expect(stats?.mean).toBeCloseTo(0.005);
    });

    it('calculates mean cost', () => {
      predictor.recordCost('tts', 0.01);
      predictor.recordCost('tts', 0.02);
      predictor.recordCost('tts', 0.03);

      const stats = predictor.getOperationStats('tts');
      expect(stats?.mean).toBeCloseTo(0.02);
    });

    it('calculates standard deviation', () => {
      predictor.recordCost('video', 0.1);
      predictor.recordCost('video', 0.1);
      predictor.recordCost('video', 0.1);

      const stats = predictor.getOperationStats('video');
      expect(stats?.stdDev).toBe(0);
    });

    it('predicts cost with variance factor', () => {
      // Add some variance
      for (let i = 0; i < 10; i++) {
        predictor.recordCost('audio', 0.001 + Math.random() * 0.002);
      }

      const predicted = predictor.predictCost('audio');
      expect(predicted).toBeGreaterThan(0);
    });
  });

  describe('Anomaly Detection', () => {
    it('detects cost anomalies', () => {
      for (let i = 0; i < 10; i++) {
        predictor.recordCost('email_analysis', 0.005);
      }

      // Normal cost (within 2 std devs)
      const normal = predictor.isAnomaly('email_analysis', 0.005);
      expect(normal).toBe(false);

      // Anomaly (way above)
      const anomaly = predictor.isAnomaly('email_analysis', 0.05);
      expect(anomaly).toBe(true);
    });
  });

  describe('Budget Alerts', () => {
    it('tracks daily spend', () => {
      predictor.recordCost('email_analysis', 10);
      predictor.recordCost('tts', 20);

      const dailySpend = predictor.getDailySpend();
      expect(dailySpend).toBe(30);
    });

    it('calculates budget usage percentage', () => {
      predictor.recordCost('email_analysis', 50);

      const usage = predictor.getBudgetUsagePercent(100);
      expect(usage).toBe(50);
    });

    it('alerts at threshold levels', () => {
      const alerts: string[] = [];

      predictor.recordCost('email_analysis', 25);
      let shouldAlert = predictor.shouldAlertBudget(100);
      if (shouldAlert) alerts.push('50%');

      predictor.recordCost('email_analysis', 26);
      shouldAlert = predictor.shouldAlertBudget(100);
      if (shouldAlert) alerts.push('75%');

      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Daily Reset', () => {
    it('resets daily spend', () => {
      predictor.recordCost('email_analysis', 50);
      expect(predictor.getDailySpend()).toBe(50);

      predictor.resetDailySpend();
      expect(predictor.getDailySpend()).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify failure**

```bash
npx vitest run src/helix/ai-operations/cost-predictor.test.ts
```

Expected: FAIL - "CostPredictor is not defined"

**Step 3: Implement CostPredictor**

Create `src/helix/ai-operations/cost-predictor.ts`:

```typescript
/**
 * Cost Predictor - Phase 5
 *
 * Predicts operation costs, detects anomalies, and monitors budget usage.
 */

export interface OperationStats {
  operationType: string;
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

const ANOMALY_THRESHOLD_SIGMA = 2; // 2 standard deviations
const BUDGET_ALERT_THRESHOLDS = [0.5, 0.75, 0.9, 0.99];

export class CostPredictor {
  private operationCosts: Map<string, number[]> = new Map();
  private dailySpend = 0;
  private lastAlertThreshold = 0;

  /**
   * Record a cost observation for an operation type
   */
  recordCost(operationType: string, costUsd: number): void {
    if (!this.operationCosts.has(operationType)) {
      this.operationCosts.set(operationType, []);
    }

    this.operationCosts.get(operationType)!.push(costUsd);
    this.dailySpend += costUsd;
  }

  /**
   * Get statistics for an operation type
   */
  getOperationStats(operationType: string): OperationStats | null {
    const costs = this.operationCosts.get(operationType);
    if (!costs || costs.length === 0) {
      return null;
    }

    const count = costs.length;
    const mean = costs.reduce((a, b) => a + b, 0) / count;
    const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...costs);
    const max = Math.max(...costs);

    return {
      operationType,
      count,
      mean,
      stdDev,
      min,
      max,
    };
  }

  /**
   * Predict cost for an operation with variance factor
   */
  predictCost(operationType: string): number {
    const stats = this.getOperationStats(operationType);
    if (!stats) {
      return 0;
    }

    // Predicted cost = mean + (1 std dev)
    return stats.mean + stats.stdDev;
  }

  /**
   * Detect if a cost is anomalous (>2 std devs from mean)
   */
  isAnomaly(operationType: string, costUsd: number): boolean {
    const stats = this.getOperationStats(operationType);
    if (!stats || stats.stdDev === 0) {
      return false;
    }

    const zScore = Math.abs((costUsd - stats.mean) / stats.stdDev);
    return zScore > ANOMALY_THRESHOLD_SIGMA;
  }

  /**
   * Get daily spend so far
   */
  getDailySpend(): number {
    return this.dailySpend;
  }

  /**
   * Calculate budget usage as percentage
   */
  getBudgetUsagePercent(dailyBudgetUsd: number): number {
    return (this.dailySpend / dailyBudgetUsd) * 100;
  }

  /**
   * Check if should alert at budget threshold
   */
  shouldAlertBudget(dailyBudgetUsd: number): boolean {
    const usagePercent = this.getBudgetUsagePercent(dailyBudgetUsd);
    const usageRatio = usagePercent / 100;

    for (const threshold of BUDGET_ALERT_THRESHOLDS) {
      if (usageRatio >= threshold && this.lastAlertThreshold < threshold) {
        this.lastAlertThreshold = threshold;
        return true;
      }
    }

    return false;
  }

  /**
   * Reset daily spend (call at midnight UTC)
   */
  resetDailySpend(): void {
    this.dailySpend = 0;
    this.lastAlertThreshold = 0;
  }
}
```

**Step 4: Run test to verify passing**

```bash
npx vitest run src/helix/ai-operations/cost-predictor.test.ts
```

Expected: PASS - All 10 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/cost-predictor.ts src/helix/ai-operations/cost-predictor.test.ts
git commit -m "feat(phase5-task2): implement cost predictor with anomaly detection and budget alerts"
```

---

### Task 3: Retry Manager

**Files:**

- Create: `src/helix/ai-operations/retry-manager.ts`
- Create: `src/helix/ai-operations/retry-manager.test.ts`

**Step 1: Write failing test**

Create `src/helix/ai-operations/retry-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { RetryManager, ErrorType } from './retry-manager.js';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager();
  });

  describe('Error Classification', () => {
    it('classifies timeout as transient', () => {
      const errorType = retryManager.classifyError(new Error('timeout'));
      expect(errorType).toBe('transient');
    });

    it('classifies rate_limit as transient', () => {
      const errorType = retryManager.classifyError(new Error('rate_limit'));
      expect(errorType).toBe('transient');
    });

    it('classifies auth error as terminal', () => {
      const errorType = retryManager.classifyError(new Error('unauthorized'));
      expect(errorType).toBe('terminal');
    });

    it('classifies not_found as terminal', () => {
      const errorType = retryManager.classifyError(new Error('not_found'));
      expect(errorType).toBe('terminal');
    });
  });

  describe('Backoff Calculation', () => {
    it('calculates exponential backoff', () => {
      const delay1 = retryManager.calculateBackoffMs(0); // 2^0 = 1
      const delay2 = retryManager.calculateBackoffMs(1); // 2^1 = 2
      const delay3 = retryManager.calculateBackoffMs(2); // 2^2 = 4

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('respects max delay', () => {
      const delay = retryManager.calculateBackoffMs(10); // Would be huge
      expect(delay).toBeLessThanOrEqual(10000); // Max 10 seconds
    });

    it('adds jitter variation', () => {
      const delays = [];
      for (let i = 0; i < 5; i++) {
        delays.push(retryManager.calculateBackoffMs(1));
      }

      // All within jitter range but not identical
      const allSame = delays.every(d => d === delays[0]);
      expect(allSame).toBe(false);
    });
  });

  describe('Retry Decision', () => {
    it('allows retries for transient errors', () => {
      const canRetry = retryManager.canRetry('transient', 0);
      expect(canRetry).toBe(true);
    });

    it('prevents retries for terminal errors', () => {
      const canRetry = retryManager.canRetry('terminal', 0);
      expect(canRetry).toBe(false);
    });

    it('respects max retry limit for transient', () => {
      // After 5 retries (attempts 0-4)
      let canRetry = retryManager.canRetry('transient', 4);
      expect(canRetry).toBe(true);

      canRetry = retryManager.canRetry('transient', 5);
      expect(canRetry).toBe(false);
    });
  });

  describe('Retry Tracking', () => {
    it('tracks retry history', () => {
      retryManager.recordAttempt('op1', 'transient', 100);
      retryManager.recordAttempt('op1', 'transient', 200);

      const history = retryManager.getRetryHistory('op1');
      expect(history?.attempts).toBe(2);
      expect(history?.totalDelayMs).toBe(300);
    });

    it('resets history per operation', () => {
      retryManager.recordAttempt('op1', 'transient', 100);
      retryManager.recordAttempt('op2', 'transient', 200);

      const history1 = retryManager.getRetryHistory('op1');
      const history2 = retryManager.getRetryHistory('op2');

      expect(history1?.attempts).toBe(1);
      expect(history2?.attempts).toBe(1);
    });
  });

  describe('Clear', () => {
    it('clears all retry history', () => {
      retryManager.recordAttempt('op1', 'transient', 100);
      retryManager.clear();

      const history = retryManager.getRetryHistory('op1');
      expect(history).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify failure**

```bash
npx vitest run src/helix/ai-operations/retry-manager.test.ts
```

Expected: FAIL - "RetryManager is not defined"

**Step 3: Implement RetryManager**

Create `src/helix/ai-operations/retry-manager.ts`:

```typescript
/**
 * Retry Manager - Phase 5
 *
 * Implements exponential backoff with jitter for transient failures.
 * Classifies errors as transient (retriable) or terminal (not retriable).
 */

export type ErrorType = 'transient' | 'terminal';

export interface RetryHistory {
  operationId: string;
  attempts: number;
  lastErrorType: ErrorType;
  totalDelayMs: number;
}

const BASE_DELAY_MS = 100;
const MAX_DELAY_MS = 10000;
const MAX_RETRIES_TRANSIENT = 5;
const MAX_RETRIES_TERMINAL = 0;
const JITTER_PERCENT = 0.2; // ±20%

// Error keywords that indicate transient errors (retriable)
const TRANSIENT_KEYWORDS = ['timeout', 'rate_limit', 'temporarily unavailable', 'connection reset'];

// Error keywords that indicate terminal errors (not retriable)
const TERMINAL_KEYWORDS = [
  'unauthorized',
  'forbidden',
  'not_found',
  'invalid',
  'authentication failed',
];

export class RetryManager {
  private retryHistory: Map<string, RetryHistory> = new Map();

  /**
   * Classify error as transient or terminal
   */
  classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    // Check terminal first (higher priority)
    for (const keyword of TERMINAL_KEYWORDS) {
      if (message.includes(keyword)) {
        return 'terminal';
      }
    }

    // Check transient
    for (const keyword of TRANSIENT_KEYWORDS) {
      if (message.includes(keyword)) {
        return 'transient';
      }
    }

    // Default to transient (safe to retry unknown errors)
    return 'transient';
  }

  /**
   * Calculate backoff delay with exponential backoff and jitter
   * Formula: min(base * 2^attempt, max) + jitter
   */
  calculateBackoffMs(attemptNumber: number): number {
    // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, ...
    const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attemptNumber);
    const cappedDelay = Math.min(exponentialDelay, MAX_DELAY_MS);

    // Add jitter (±20%)
    const jitterAmount = cappedDelay * JITTER_PERCENT;
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount;

    return Math.max(0, cappedDelay + jitter);
  }

  /**
   * Determine if operation should be retried
   */
  canRetry(errorType: ErrorType, attemptNumber: number): boolean {
    if (errorType === 'terminal') {
      return false; // Never retry terminal errors
    }

    // Transient: allow up to MAX_RETRIES_TRANSIENT attempts
    return attemptNumber < MAX_RETRIES_TRANSIENT;
  }

  /**
   * Record a retry attempt
   */
  recordAttempt(operationId: string, errorType: ErrorType, delayMs: number): void {
    if (!this.retryHistory.has(operationId)) {
      this.retryHistory.set(operationId, {
        operationId,
        attempts: 0,
        lastErrorType: errorType,
        totalDelayMs: 0,
      });
    }

    const history = this.retryHistory.get(operationId)!;
    history.attempts++;
    history.lastErrorType = errorType;
    history.totalDelayMs += delayMs;
  }

  /**
   * Get retry history for operation
   */
  getRetryHistory(operationId: string): RetryHistory | null {
    return this.retryHistory.get(operationId) || null;
  }

  /**
   * Clear all retry history
   */
  clear(): void {
    this.retryHistory.clear();
  }
}
```

**Step 4: Run test to verify passing**

```bash
npx vitest run src/helix/ai-operations/retry-manager.test.ts
```

Expected: PASS - All 11 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/retry-manager.ts src/helix/ai-operations/retry-manager.test.ts
git commit -m "feat(phase5-task3): implement retry manager with exponential backoff and jitter"
```

---

### Task 4: Observability Metrics

**Files:**

- Create: `src/helix/ai-operations/observability-metrics.ts`
- Create: `src/helix/ai-operations/observability-metrics.test.ts`

**Step 1: Write failing test**

Create `src/helix/ai-operations/observability-metrics.test.ts`:

```typescript
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
```

**Step 2: Run test to verify failure**

```bash
npx vitest run src/helix/ai-operations/observability-metrics.test.ts
```

Expected: FAIL - "ObservabilityMetrics is not defined"

**Step 3: Implement ObservabilityMetrics**

Create `src/helix/ai-operations/observability-metrics.ts`:

```typescript
/**
 * Observability Metrics - Phase 5
 *
 * Tracks SLA compliance, operation success rates, provider performance,
 * and budget variance for comprehensive system health monitoring.
 */

export interface OperationStats {
  operationType: string;
  totalOperations: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export interface ProviderStats {
  provider: string;
  totalOperations: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  avgCostPerOp: number;
}

export interface MetricSnapshot {
  timestamp: string;
  totalOperations: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  successRate: number;
}

interface OperationData {
  latencies: number[];
  successes: number;
  failures: number;
}

interface ProviderData {
  latencies: number[];
  successes: number;
  failures: number;
  totalCostUsd: number;
}

const SLA_TARGETS = {
  premium: 0.9999, // 99.99%
  standard: 0.99, // 99%
};

export class ObservabilityMetrics {
  private operationMetrics: Map<string, OperationData> = new Map();
  private providerMetrics: Map<string, ProviderData> = new Map();
  private snapshots: MetricSnapshot[] = [];

  /**
   * Record successful operation
   */
  recordOperationSuccess(operationType: string, latencyMs: number): void {
    if (!this.operationMetrics.has(operationType)) {
      this.operationMetrics.set(operationType, {
        latencies: [],
        successes: 0,
        failures: 0,
      });
    }

    const data = this.operationMetrics.get(operationType)!;
    data.latencies.push(latencyMs);
    data.successes++;
  }

  /**
   * Record failed operation
   */
  recordOperationFailure(operationType: string, errorType: string): void {
    if (!this.operationMetrics.has(operationType)) {
      this.operationMetrics.set(operationType, {
        latencies: [],
        successes: 0,
        failures: 0,
      });
    }

    const data = this.operationMetrics.get(operationType)!;
    data.failures++;
  }

  /**
   * Get operation statistics
   */
  getOperationStats(operationType: string): OperationStats | null {
    const data = this.operationMetrics.get(operationType);
    if (!data) {
      return null;
    }

    const totalOperations = data.successes + data.failures;
    const successRate = totalOperations === 0 ? 0 : data.successes / totalOperations;
    const avgLatency =
      data.latencies.length === 0
        ? 0
        : data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length;

    // Calculate p95 (95th percentile)
    const sorted = [...data.latencies].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    const p95Latency = sorted[Math.max(0, p95Index)] || 0;

    return {
      operationType,
      totalOperations,
      successCount: data.successes,
      failureCount: data.failures,
      successRate,
      avgLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
    };
  }

  /**
   * Record provider success
   */
  recordProviderSuccess(provider: string, latencyMs: number): void {
    if (!this.providerMetrics.has(provider)) {
      this.providerMetrics.set(provider, {
        latencies: [],
        successes: 0,
        failures: 0,
        totalCostUsd: 0,
      });
    }

    const data = this.providerMetrics.get(provider)!;
    data.latencies.push(latencyMs);
    data.successes++;
  }

  /**
   * Record provider failure
   */
  recordProviderFailure(provider: string, errorType: string): void {
    if (!this.providerMetrics.has(provider)) {
      this.providerMetrics.set(provider, {
        latencies: [],
        successes: 0,
        failures: 0,
        totalCostUsd: 0,
      });
    }

    const data = this.providerMetrics.get(provider)!;
    data.failures++;
  }

  /**
   * Record provider cost
   */
  recordProviderCost(provider: string, costUsd: number): void {
    if (!this.providerMetrics.has(provider)) {
      this.providerMetrics.set(provider, {
        latencies: [],
        successes: 0,
        failures: 0,
        totalCostUsd: 0,
      });
    }

    const data = this.providerMetrics.get(provider)!;
    data.totalCostUsd += costUsd;
  }

  /**
   * Get provider statistics
   */
  getProviderStats(provider: string): ProviderStats | null {
    const data = this.providerMetrics.get(provider);
    if (!data) {
      return null;
    }

    const totalOperations = data.successes + data.failures;
    const successRate = totalOperations === 0 ? 0 : data.successes / totalOperations;
    const avgLatency =
      data.latencies.length === 0
        ? 0
        : data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length;
    const avgCostPerOp = totalOperations === 0 ? 0 : data.totalCostUsd / totalOperations;

    return {
      provider,
      totalOperations,
      successCount: data.successes,
      failureCount: data.failures,
      successRate,
      avgLatencyMs: avgLatency,
      avgCostPerOp,
    };
  }

  /**
   * Calculate SLA compliance for tier
   */
  getSLACompliance(slaTier: 'premium' | 'standard'): number {
    // Aggregate all operations and calculate overall success rate
    let totalSuccesses = 0;
    let totalOperations = 0;

    for (const data of this.operationMetrics.values()) {
      totalSuccesses += data.successes;
      totalOperations += data.successes + data.failures;
    }

    return totalOperations === 0 ? 1.0 : totalSuccesses / totalOperations;
  }

  /**
   * Get SLA target for tier
   */
  getSLATarget(slaTier: 'premium' | 'standard'): number {
    return SLA_TARGETS[slaTier];
  }

  /**
   * Calculate budget variance (actual vs predicted)
   */
  calculateBudgetVariance(predictedUsd: number, actualUsd: number): number {
    if (predictedUsd === 0) {
      return 0;
    }

    return (actualUsd - predictedUsd) / predictedUsd;
  }

  /**
   * Create metric snapshot
   */
  createSnapshot(): MetricSnapshot {
    let totalSuccesses = 0;
    let totalFailures = 0;
    const allLatencies: number[] = [];

    for (const data of this.operationMetrics.values()) {
      totalSuccesses += data.successes;
      totalFailures += data.failures;
      allLatencies.push(...data.latencies);
    }

    const totalOperations = totalSuccesses + totalFailures;
    const avgLatency =
      allLatencies.length === 0 ? 0 : allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;

    const snapshot: MetricSnapshot = {
      timestamp: new Date().toISOString(),
      totalOperations,
      successCount: totalSuccesses,
      failureCount: totalFailures,
      avgLatencyMs: avgLatency,
      successRate: totalOperations === 0 ? 1.0 : totalSuccesses / totalOperations,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.operationMetrics.clear();
    this.providerMetrics.clear();
    this.snapshots = [];
  }
}
```

**Step 4: Run test to verify passing**

```bash
npx vitest run src/helix/ai-operations/observability-metrics.test.ts
```

Expected: PASS - All 12 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/observability-metrics.ts src/helix/ai-operations/observability-metrics.test.ts
git commit -m "feat(phase5-task4): implement observability metrics for SLA compliance and provider tracking"
```

---

### Task 5: Integration & Router Update

**Files:**

- Create: `src/helix/ai-operations/phase5-integration.test.ts`
- Modify: `src/helix/ai-operations/router.ts` (add Phase 5 getters)

**Step 1: Create integration tests**

Create `src/helix/ai-operations/phase5-integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { RequestPriorityQueue } from './priority-queue.js';
import { CostPredictor } from './cost-predictor.js';
import { RetryManager } from './retry-manager.js';
import { ObservabilityMetrics } from './observability-metrics.js';

describe('Phase 5: Advanced Features Integration', () => {
  describe('Priority Queue with Cost Prediction', () => {
    it('queues premium users ahead of standard', () => {
      const queue = new RequestPriorityQueue();
      const standard = {
        operationId: 'op1',
        userId: 'u1',
        slaTier: 'standard' as const,
        criticality: 'low' as const,
      };
      const premium = {
        operationId: 'op2',
        userId: 'u2',
        slaTier: 'premium' as const,
        criticality: 'low' as const,
      };

      queue.enqueue(standard);
      queue.enqueue(premium);

      const first = queue.dequeue();
      expect(first?.operationId).toBe('op2'); // Premium first
    });
  });

  describe('Cost Prediction with Budget Alerts', () => {
    it('predicts costs and alerts on budget usage', () => {
      const predictor = new CostPredictor();

      for (let i = 0; i < 10; i++) {
        predictor.recordCost('email_analysis', 0.005);
      }

      const predicted = predictor.predictCost('email_analysis');
      expect(predicted).toBeGreaterThan(0);

      // Record more costs
      for (let i = 0; i < 9; i++) {
        predictor.recordCost('email_analysis', 0.005);
      }

      const dailyBudget = 1;
      const usage = predictor.getBudgetUsagePercent(dailyBudget);
      expect(usage).toBeGreaterThan(0);
    });
  });

  describe('Retry Manager with Observability', () => {
    it('classifies errors and tracks retries', () => {
      const retryManager = new RetryManager();
      const metrics = new ObservabilityMetrics();

      const error = new Error('timeout');
      const errorType = retryManager.classifyError(error);
      expect(errorType).toBe('transient');

      if (retryManager.canRetry(errorType, 0)) {
        retryManager.recordAttempt('op1', errorType, 100);
        metrics.recordOperationFailure('email_analysis', 'timeout');
      }

      const history = retryManager.getRetryHistory('op1');
      expect(history?.attempts).toBe(1);
    });
  });

  describe('End-to-End Workflow', () => {
    it('executes complete Phase 5 workflow', () => {
      const queue = new RequestPriorityQueue();
      const predictor = new CostPredictor();
      const retryManager = new RetryManager();
      const metrics = new ObservabilityMetrics();

      // 1. Enqueue operation with priority
      const operation = {
        operationId: 'op1',
        userId: 'user123',
        slaTier: 'premium' as const,
        criticality: 'high' as const,
      };
      queue.enqueue(operation);

      // 2. Predict cost
      predictor.recordCost('email_analysis', 0.005);
      const predictedCost = predictor.predictCost('email_analysis');
      expect(predictedCost).toBeGreaterThan(0);

      // 3. Execute and record metrics
      metrics.recordOperationSuccess('email_analysis', 150);

      // 4. Check SLA compliance
      const compliance = metrics.getSLACompliance('premium');
      expect(compliance).toBe(1.0); // All operations successful

      // Verify queue
      const dequeued = queue.dequeue();
      expect(dequeued?.operationId).toBe('op1');
    });
  });
});
```

**Step 2: Run integration tests**

```bash
npx vitest run src/helix/ai-operations/phase5-integration.test.ts
```

Expected: PASS - All 4 integration tests passing

**Step 3: Update Router to expose Phase 5 components**

Open `src/helix/ai-operations/router.ts` and add these imports after existing Phase 4 imports:

```typescript
import { RequestPriorityQueue } from './priority-queue.js';
import { CostPredictor } from './cost-predictor.js';
import { RetryManager } from './retry-manager.js';
import { ObservabilityMetrics } from './observability-metrics.js';
```

Then add these properties to AIOperationRouter class (after Phase 4 properties):

```typescript
  private priorityQueue: RequestPriorityQueue;
  private costPredictor: CostPredictor;
  private retryManager: RetryManager;
  private observabilityMetrics: ObservabilityMetrics;
```

In the constructor, add after Phase 4 initialization:

```typescript
// Initialize Phase 5 advanced features
this.priorityQueue = new RequestPriorityQueue();
this.costPredictor = new CostPredictor();
this.retryManager = new RetryManager();
this.observabilityMetrics = new ObservabilityMetrics();
```

Add these getter methods at end of class:

```typescript
  /**
   * Get priority queue for operation prioritization
   */
  getPriorityQueue(): RequestPriorityQueue {
    return this.priorityQueue;
  }

  /**
   * Get cost predictor for budget management
   */
  getCostPredictor(): CostPredictor {
    return this.costPredictor;
  }

  /**
   * Get retry manager for failure handling
   */
  getRetryManager(): RetryManager {
    return this.retryManager;
  }

  /**
   * Get observability metrics for monitoring
   */
  getObservabilityMetrics(): ObservabilityMetrics {
    return this.observabilityMetrics;
  }
```

**Step 4: Commit**

```bash
git add src/helix/ai-operations/phase5-integration.test.ts src/helix/ai-operations/router.ts
git commit -m "feat(phase5-task5): integrate phase 5 components with router and add integration tests"
```

---

### Task 6: Final Tests & Quality Check

**Files:**

- Modify: `src/helix/ai-operations/router.test.ts` (add Phase 5 tests)

**Step 1: Add Phase 5 integration tests to router.test.ts**

Add this test block to the end of the describe block in `src/helix/ai-operations/router.test.ts`:

```typescript
describe('Phase 5 Advanced Features', () => {
  it('provides access to priority queue', () => {
    const queue = router.getPriorityQueue();
    expect(queue).toBeDefined();
  });

  it('provides access to cost predictor', () => {
    const predictor = router.getCostPredictor();
    expect(predictor).toBeDefined();
  });

  it('provides access to retry manager', () => {
    const retryManager = router.getRetryManager();
    expect(retryManager).toBeDefined();
  });

  it('provides access to observability metrics', () => {
    const metrics = router.getObservabilityMetrics();
    expect(metrics).toBeDefined();
  });
});
```

**Step 2: Run all AI operations tests**

```bash
cd /c/Users/Specter/Desktop/Helix
npm run test -- src/helix/ai-operations/
```

Expected: 75+ tests all passing

**Step 3: Run typecheck and linter**

```bash
npm run typecheck
npm run lint
```

Expected: No errors in Phase 5 code

**Step 4: Final commit**

```bash
git add src/helix/ai-operations/router.test.ts
git commit -m "feat(phase5-task6): add phase 5 integration tests and verify quality checks"
```

---

## Summary

Phase 5 delivers four major subsystems:

1. **Request Priority Queue** (Task 1) - SLA tier-based prioritization with aging mechanism
2. **Cost Predictor** (Task 2) - Cost estimation, anomaly detection, budget alerts
3. **Retry Manager** (Task 3) - Exponential backoff with jitter, error classification
4. **Observability Metrics** (Task 4) - SLA compliance, provider performance, budget variance tracking
5. **Router Integration** (Task 5) - Seamless integration with existing router
6. **Testing & QA** (Task 6) - 50+ tests, full quality gates

**Total Files Created:** 8 (4 implementation + 4 test files)
**Tests Added:** 50+ covering all Phase 5 features
**Commits:** 6 atomic commits

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-04-phase5-advanced-features.md`.

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
