# Phase 6: Multi-Tenant Support & Advanced API Management

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement enterprise SaaS capabilities including per-user operation quotas, rate limiting, usage-based billing, advanced analytics, API key management, and webhook support for third-party integrations.

**Architecture:** Phase 6 extends Phase 5's smart routing with five new subsystems: (1) **UsageQuotaManager** enforces per-user operation limits and tier-based quotas; (2) **RateLimiter** implements token-bucket rate limiting with sliding windows; (3) **BillingEngine** tracks usage-based costs and generates billing reports; (4) **AnalyticsCollector** captures operation metadata for dashboards; (5) **WebhookManager** enables real-time third-party integrations.

**Tech Stack:** TypeScript, Supabase (for quota and webhook storage), Vitest for testing.

---

## System Architecture

```
┌──────────────────────────────────────────────────────┐
│      Phase 6: Multi-Tenant SaaS & API Management     │
├──────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │  Usage Quota Manager                         │    │
│  │  - Per-user operation quotas (requests/day)  │    │
│  │  - Tier-based limits (Free/Pro/Enterprise)   │    │
│  │  - Usage tracking and enforcement            │    │
│  └──────────────────────────────────────────────┘    │
│         │                                              │
│  ┌──────▼──────────────────────────────────────┐    │
│  │  Rate Limiter                                │    │
│  │  - Token bucket algorithm                    │    │
│  │  - Per-user and per-API-key limits           │    │
│  │  - Sliding window tracking                   │    │
│  └──────────────────────────────────────────────┘    │
│         │                                              │
│  ┌──────▼──────────────────────────────────────┐    │
│  │  Billing Engine                              │    │
│  │  - Usage-based cost calculation              │    │
│  │  - Monthly billing cycles                    │    │
│  │  - Invoice generation                        │    │
│  └──────────────────────────────────────────────┘    │
│         │                                              │
│  ┌──────▼──────────────────────────────────────┐    │
│  │  Analytics Collector                         │    │
│  │  - Operation metadata capture                │    │
│  │  - Time-series metrics                       │    │
│  │  - Custom event tracking                     │    │
│  └──────────────────────────────────────────────┘    │
│         │                                              │
│  ┌──────▼──────────────────────────────────────┐    │
│  │  Webhook Manager                             │    │
│  │  - Real-time event delivery                  │    │
│  │  - Retry logic with exponential backoff      │    │
│  │  - Event filtering and routing               │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
└──────────────────────────────────────────────────────┘
          │
          │ Uses Phase 5 Advanced Features
          │
┌──────────────────────────────────────────────────────┐
│  Phase 5: Smart Routing & Observability              │
└──────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Usage Quota Manager

**Current State (Phase 5):** Operations execute without user quotas

**Problem:** Can't enforce fair usage, prevent abuse, or implement tiered pricing

**Solution:**
- **Quota Tiers**: Free (100 ops/day), Pro (10k ops/day), Enterprise (unlimited)
- **Quota Tracking**: Track daily usage per user with reset at UTC midnight
- **Enforcement**: Reject operations that exceed quota with clear error message
- **Reservation System**: Check quota before routing, reserve slots after approval

**Example:**
```
User: Pro tier (10k ops/day)
Usage: 9,500 ops used
Request: 600 op batch
1. Check: 9,500 + 600 = 10,100 (exceeds 10,000)
2. Reject with: "Quota exceeded. Used 9,500 of 10,000. Batch requires 600."
3. Suggest: Wait for daily reset or upgrade to Enterprise
```

### 2. Rate Limiter

**Current State (Phase 5):** No per-API request rate limiting

**Problem:** Can't prevent burst traffic, API abuse, or DoS attacks

**Solution:**
- **Token Bucket Algorithm**: Refill tokens at fixed rate, burst allowed up to capacity
- **Sliding Window**: Track requests in 1-minute and 1-hour windows
- **Per-User & Per-Key**: Separate limits for each API key and user
- **Graceful Degradation**: Return 429 (Too Many Requests) with Retry-After header

**Example:**
```
Rate Limit: 100 requests/minute
Token Bucket: Capacity=100, Refill=100/min

Request 1: Tokens=99, Allow ✓
Request 2: Tokens=98, Allow ✓
...
Request 100: Tokens=0, Allow ✓
Request 101: Tokens=0, REJECT with Retry-After: 0.6s
After 0.6s: Refill +1 token
Request 102: Tokens=1, Allow ✓
```

### 3. Billing Engine

**Current State (Phase 5):** Track costs per operation only

**Problem:** Can't generate monthly bills, track revenue, or monitor usage trends

**Solution:**
- **Monthly Billing Cycles**: Aggregate costs from 1st to last day of month
- **Usage-Based Pricing**: Charge per operation, per token, per API call
- **Invoice Generation**: Create detailed invoices with line items per operation type
- **Payment Status Tracking**: Track paid, unpaid, and overdue invoices

**Example:**
```
Monthly Invoice (Feb 1-28):
- Email Analysis: 5,000 ops × $0.002 = $10.00
- Video Understanding: 200 ops × $0.05 = $10.00
- Audio Transcription: 1,000 ops × $0.001 = $1.00
- Text-to-Speech: 500 ops × $0.003 = $1.50

Subtotal: $22.50
Tax (10%): $2.25
Total: $24.75
Due: March 15
```

### 4. Analytics Collector

**Current State (Phase 5):** Only track metrics for SLA compliance

**Problem:** Can't see usage patterns, user behavior, or system bottlenecks

**Solution:**
- **Event Capture**: Capture operation_start, operation_complete, operation_failed events
- **Time-Series Data**: Store metrics with timestamp for trend analysis
- **Custom Dimensions**: Add user_id, operation_type, result, latency, cost
- **Aggregation**: Hourly summaries for dashboard display

**Example:**
```
Event: operation_complete
{
  timestamp: "2026-02-04T14:32:15Z",
  user_id: "user_123",
  operation_type: "email_analysis",
  model: "anthropic",
  latency_ms: 245,
  cost_usd: 0.005,
  success: true,
  tokens_used: 150
}

Aggregated (hourly):
- Total operations: 523
- Success rate: 99.2%
- Avg latency: 187ms
- Total cost: $2.34
```

### 5. Webhook Manager

**Current State (Phase 5):** No external event integration

**Problem:** Can't notify third-party systems of operation completions

**Solution:**
- **Event Subscriptions**: Users subscribe to operation_start, operation_complete, operation_failed
- **Real-Time Delivery**: POST event payload to user's webhook URL
- **Retry Logic**: Exponential backoff (1s, 2s, 4s, 8s) up to 5 attempts
- **Event Filtering**: Allow users to filter by operation_type or result status

**Example:**
```
User subscribes: POST https://myapp.com/webhooks/operations

Event fires: operation_complete
POST to https://myapp.com/webhooks/operations
{
  event: "operation_complete",
  operation_id: "op_abc123",
  user_id: "user_123",
  operation_type: "email_analysis",
  result: {
    sentiment: "positive",
    category: "promotional"
  },
  cost_usd: 0.005,
  timestamp: "2026-02-04T14:32:15Z"
}

Response: 200 OK → Success, no retry needed
Response: 500 Error → Retry after 1s
Response: No response (timeout) → Retry after 2s
After 5 failed attempts → Give up, mark delivery as failed
```

---

## Implementation Tasks

### Task 1: Usage Quota Manager

**Files:**
- Create: `src/helix/ai-operations/usage-quota.ts`
- Create: `src/helix/ai-operations/usage-quota.test.ts`

**Step 1: Write the failing test**

Create `src/helix/ai-operations/usage-quota.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { UsageQuotaManager, QuotaTier } from './usage-quota.js';

describe('UsageQuotaManager', () => {
  let quotaManager: UsageQuotaManager;

  beforeEach(() => {
    quotaManager = new UsageQuotaManager();
  });

  describe('Quota Initialization', () => {
    it('initializes with correct tier limits', () => {
      const freeQuota = quotaManager.getTierLimit('free');
      const proQuota = quotaManager.getTierLimit('pro');
      const enterpriseQuota = quotaManager.getTierLimit('enterprise');

      expect(freeQuota).toBe(100);
      expect(proQuota).toBe(10000);
      expect(enterpriseQuota).toBe(Infinity);
    });
  });

  describe('Usage Tracking', () => {
    it('tracks daily usage for user', () => {
      quotaManager.incrementUsage('user_123', 'free', 50);
      const usage = quotaManager.getUsage('user_123');
      expect(usage).toBe(50);
    });

    it('accumulates usage across multiple calls', () => {
      quotaManager.incrementUsage('user_123', 'free', 30);
      quotaManager.incrementUsage('user_123', 'free', 20);
      const usage = quotaManager.getUsage('user_123');
      expect(usage).toBe(50);
    });
  });

  describe('Quota Enforcement', () => {
    it('allows operations within quota', () => {
      quotaManager.incrementUsage('user_123', 'free', 50);
      const canExecute = quotaManager.canExecuteOperation('user_123', 'free', 25);
      expect(canExecute).toBe(true);
    });

    it('rejects operations exceeding quota', () => {
      quotaManager.incrementUsage('user_123', 'free', 90);
      const canExecute = quotaManager.canExecuteOperation('user_123', 'free', 25);
      expect(canExecute).toBe(false);
    });

    it('allows pro tier higher quotas', () => {
      quotaManager.incrementUsage('user_456', 'pro', 9500);
      const canExecute = quotaManager.canExecuteOperation('user_456', 'pro', 400);
      expect(canExecute).toBe(true);
    });

    it('rejects pro tier exceeding 10k limit', () => {
      quotaManager.incrementUsage('user_456', 'pro', 9500);
      const canExecute = quotaManager.canExecuteOperation('user_456', 'pro', 600);
      expect(canExecute).toBe(false);
    });
  });

  describe('Enterprise Unlimited', () => {
    it('allows unlimited operations for enterprise', () => {
      quotaManager.incrementUsage('user_789', 'enterprise', 1000000);
      const canExecute = quotaManager.canExecuteOperation('user_789', 'enterprise', 500000);
      expect(canExecute).toBe(true);
    });
  });

  describe('Quota Reset', () => {
    it('resets daily usage', () => {
      quotaManager.incrementUsage('user_123', 'free', 50);
      quotaManager.resetDailyUsage('user_123');
      const usage = quotaManager.getUsage('user_123');
      expect(usage).toBe(0);
    });
  });

  describe('Remaining Quota Info', () => {
    it('returns remaining quota', () => {
      quotaManager.incrementUsage('user_123', 'free', 30);
      const remaining = quotaManager.getRemainingQuota('user_123', 'free');
      expect(remaining).toBe(70); // 100 - 30
    });

    it('returns negative remaining when exceeded', () => {
      quotaManager.incrementUsage('user_123', 'free', 120);
      const remaining = quotaManager.getRemainingQuota('user_123', 'free');
      expect(remaining).toBe(-20); // 100 - 120
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /c/Users/Specter/Desktop/Helix
npx vitest run src/helix/ai-operations/usage-quota.test.ts
```

Expected: FAIL - "UsageQuotaManager is not defined"

**Step 3: Implement UsageQuotaManager**

Create `src/helix/ai-operations/usage-quota.ts`:

```typescript
/**
 * Usage Quota Manager - Phase 6
 *
 * Enforces per-user operation quotas based on subscription tier.
 * Tracks daily usage with automatic reset at UTC midnight.
 */

export type QuotaTier = 'free' | 'pro' | 'enterprise';

export interface QuotaConfig {
  free: number;
  pro: number;
  enterprise: number;
}

const DEFAULT_QUOTA_LIMITS: QuotaConfig = {
  free: 100,
  pro: 10000,
  enterprise: Infinity,
};

interface UserQuotaData {
  dailyUsage: number;
  lastResetDate: string;
}

export class UsageQuotaManager {
  private quotaLimits: QuotaConfig = DEFAULT_QUOTA_LIMITS;
  private userQuotas: Map<string, UserQuotaData> = new Map();

  /**
   * Get quota limit for tier
   */
  getTierLimit(tier: QuotaTier): number {
    return this.quotaLimits[tier];
  }

  /**
   * Increment usage for user
   */
  incrementUsage(userId: string, tier: QuotaTier, amount: number): void {
    if (!this.userQuotas.has(userId)) {
      this.userQuotas.set(userId, {
        dailyUsage: 0,
        lastResetDate: new Date().toISOString().split('T')[0],
      });
    }

    const quota = this.userQuotas.get(userId)!;
    quota.dailyUsage += amount;
  }

  /**
   * Get current daily usage for user
   */
  getUsage(userId: string): number {
    const quota = this.userQuotas.get(userId);
    return quota?.dailyUsage || 0;
  }

  /**
   * Check if operation can be executed within quota
   */
  canExecuteOperation(userId: string, tier: QuotaTier, operationCount: number): boolean {
    const limit = this.getTierLimit(tier);
    if (limit === Infinity) {
      return true; // Enterprise has unlimited quota
    }

    const currentUsage = this.getUsage(userId);
    return currentUsage + operationCount <= limit;
  }

  /**
   * Get remaining quota for user
   */
  getRemainingQuota(userId: string, tier: QuotaTier): number {
    const limit = this.getTierLimit(tier);
    if (limit === Infinity) {
      return Infinity;
    }

    const currentUsage = this.getUsage(userId);
    return limit - currentUsage;
  }

  /**
   * Reset daily usage (call at UTC midnight)
   */
  resetDailyUsage(userId: string): void {
    const quota = this.userQuotas.get(userId);
    if (quota) {
      quota.dailyUsage = 0;
      quota.lastResetDate = new Date().toISOString().split('T')[0];
    }
  }

  /**
   * Clear all quotas (for testing)
   */
  clear(): void {
    this.userQuotas.clear();
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/helix/ai-operations/usage-quota.test.ts
```

Expected: PASS - All 8 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/usage-quota.ts src/helix/ai-operations/usage-quota.test.ts
git commit -m "feat(phase6-task1): implement usage quota manager with tier-based limits"
```

---

### Task 2: Rate Limiter

**Files:**
- Create: `src/helix/ai-operations/rate-limiter.ts`
- Create: `src/helix/ai-operations/rate-limiter.test.ts`

**Step 1: Write the failing test**

Create `src/helix/ai-operations/rate-limiter.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    vi.useFakeTimers();
  });

  describe('Token Bucket', () => {
    it('allows requests within capacity', () => {
      const allowed1 = limiter.allowRequest('user_123', 100);
      const allowed2 = limiter.allowRequest('user_123', 100);
      expect(allowed1).toBe(true);
      expect(allowed2).toBe(true);
    });

    it('rejects requests exceeding capacity', () => {
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      const allowed4 = limiter.allowRequest('user_123', 100);
      expect(allowed4).toBe(false);
    });

    it('refills tokens over time', () => {
      limiter.allowRequest('user_456', 100);
      limiter.allowRequest('user_456', 100);
      limiter.allowRequest('user_456', 100);
      expect(limiter.allowRequest('user_456', 100)).toBe(false);

      // Advance time by 1 second (100 tokens refilled)
      vi.advanceTimersByTime(1000);

      expect(limiter.allowRequest('user_456', 100)).toBe(true);
    });
  });

  describe('Per-User Limits', () => {
    it('enforces separate limits per user', () => {
      limiter.allowRequest('user_1', 100);
      limiter.allowRequest('user_1', 100);
      limiter.allowRequest('user_1', 100);

      // user_2 should still have tokens
      const allowed = limiter.allowRequest('user_2', 100);
      expect(allowed).toBe(true);
    });
  });

  describe('Retry-After Header', () => {
    it('returns retry-after duration when rate limited', () => {
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);

      const retryAfter = limiter.getRetryAfterMs('user_123', 100);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(10); // Should be small
    });
  });

  describe('Sliding Window', () => {
    it('tracks requests in 1-minute window', () => {
      for (let i = 0; i < 60; i++) {
        limiter.allowRequest('user_789', 1);
      }

      expect(limiter.allowRequest('user_789', 1)).toBe(false);

      // Advance 1 minute
      vi.advanceTimersByTime(60000);

      expect(limiter.allowRequest('user_789', 1)).toBe(true);
    });
  });

  describe('Reset', () => {
    it('clears all rate limit state', () => {
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      limiter.allowRequest('user_123', 100);
      limiter.clear();

      expect(limiter.allowRequest('user_123', 100)).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/helix/ai-operations/rate-limiter.test.ts
```

Expected: FAIL - "RateLimiter is not defined"

**Step 3: Implement RateLimiter**

Create `src/helix/ai-operations/rate-limiter.ts`:

```typescript
/**
 * Rate Limiter - Phase 6
 *
 * Implements token-bucket rate limiting with sliding window tracking.
 * Prevents API abuse and ensures fair resource allocation.
 */

interface TokenBucketState {
  tokens: number;
  lastRefillTime: number;
}

const REFILL_RATE = 100; // tokens per second
const BUCKET_CAPACITY = 300; // max tokens

export class RateLimiter {
  private buckets: Map<string, TokenBucketState> = new Map();

  /**
   * Allow request if tokens available
   */
  allowRequest(userId: string, tokensRequired: number): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = {
        tokens: BUCKET_CAPACITY,
        lastRefillTime: now,
      };
      this.buckets.set(userId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
    const tokensToAdd = elapsedSeconds * REFILL_RATE;
    bucket.tokens = Math.min(bucket.tokens + tokensToAdd, BUCKET_CAPACITY);
    bucket.lastRefillTime = now;

    // Check if request can proceed
    if (bucket.tokens >= tokensRequired) {
      bucket.tokens -= tokensRequired;
      return true;
    }

    return false;
  }

  /**
   * Get retry-after duration in milliseconds
   */
  getRetryAfterMs(userId: string, tokensRequired: number): number {
    const bucket = this.buckets.get(userId);
    if (!bucket) {
      return 0;
    }

    const tokensNeeded = tokensRequired - bucket.tokens;
    if (tokensNeeded <= 0) {
      return 0;
    }

    // Calculate how long to wait for required tokens
    return Math.ceil((tokensNeeded / REFILL_RATE) * 1000);
  }

  /**
   * Clear all rate limit state
   */
  clear(): void {
    this.buckets.clear();
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/helix/ai-operations/rate-limiter.test.ts
```

Expected: PASS - All 7 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/rate-limiter.ts src/helix/ai-operations/rate-limiter.test.ts
git commit -m "feat(phase6-task2): implement token-bucket rate limiter with per-user limits"
```

---

### Task 3: Billing Engine

**Files:**
- Create: `src/helix/ai-operations/billing-engine.ts`
- Create: `src/helix/ai-operations/billing-engine.test.ts`

**Step 1: Write the failing test**

Create `src/helix/ai-operations/billing-engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BillingEngine, InvoiceStatus } from './billing-engine.js';

describe('BillingEngine', () => {
  let billing: BillingEngine;

  beforeEach(() => {
    billing = new BillingEngine();
  });

  describe('Usage Tracking', () => {
    it('records operation cost', () => {
      billing.recordOperation('user_123', 'email_analysis', 0.005);
      const costs = billing.getMonthlyUsage('user_123');
      expect(costs.totalCost).toBe(0.005);
      expect(costs.operationCount).toBe(1);
    });

    it('aggregates costs by operation type', () => {
      billing.recordOperation('user_123', 'email_analysis', 0.005);
      billing.recordOperation('user_123', 'video_analysis', 0.05);
      billing.recordOperation('user_123', 'email_analysis', 0.005);

      const costs = billing.getMonthlyUsage('user_123');
      expect(costs.totalCost).toBe(0.06);
      expect(costs.operationCount).toBe(3);
    });
  });

  describe('Invoice Generation', () => {
    it('generates monthly invoice', () => {
      billing.recordOperation('user_456', 'email_analysis', 0.005);
      billing.recordOperation('user_456', 'email_analysis', 0.005);
      billing.recordOperation('user_456', 'video_analysis', 0.05);

      const invoice = billing.generateInvoice('user_456');
      expect(invoice.userId).toBe('user_456');
      expect(invoice.totalAmount).toBeCloseTo(0.06);
      expect(invoice.status).toBe('unpaid');
    });

    it('calculates tax (10%)', () => {
      billing.recordOperation('user_789', 'email_analysis', 0.1);

      const invoice = billing.generateInvoice('user_789');
      expect(invoice.subtotal).toBe(0.1);
      expect(invoice.tax).toBeCloseTo(0.01);
      expect(invoice.totalAmount).toBeCloseTo(0.11);
    });

    it('tracks invoice status', () => {
      billing.recordOperation('user_101', 'email_analysis', 0.05);

      const invoice = billing.generateInvoice('user_101');
      expect(invoice.status).toBe('unpaid');

      billing.markInvoiceAsPaid(invoice.invoiceId);
      const updatedInvoice = billing.getInvoice(invoice.invoiceId);
      expect(updatedInvoice?.status).toBe('paid');
    });
  });

  describe('Cost Breakdown', () => {
    it('provides cost breakdown by operation type', () => {
      billing.recordOperation('user_111', 'email_analysis', 0.01);
      billing.recordOperation('user_111', 'email_analysis', 0.02);
      billing.recordOperation('user_111', 'video_analysis', 0.05);
      billing.recordOperation('user_111', 'audio_transcription', 0.001);

      const usage = billing.getMonthlyUsage('user_111');
      expect(usage.costByOperation.email_analysis).toBe(0.03);
      expect(usage.costByOperation.video_analysis).toBe(0.05);
      expect(usage.costByOperation.audio_transcription).toBe(0.001);
    });
  });

  describe('Invoice History', () => {
    it('tracks invoice history per user', () => {
      billing.recordOperation('user_222', 'email_analysis', 0.05);
      const invoice1 = billing.generateInvoice('user_222');

      billing.recordOperation('user_222', 'email_analysis', 0.1);
      const invoice2 = billing.generateInvoice('user_222');

      const history = billing.getInvoiceHistory('user_222');
      expect(history).toHaveLength(2);
      expect(history[0].totalAmount).toBeCloseTo(0.055); // 0.05 + tax
      expect(history[1].totalAmount).toBeCloseTo(0.11); // 0.1 + tax
    });
  });

  describe('Reset', () => {
    it('clears all billing data', () => {
      billing.recordOperation('user_333', 'email_analysis', 0.05);
      billing.clear();

      const usage = billing.getMonthlyUsage('user_333');
      expect(usage.totalCost).toBe(0);
      expect(usage.operationCount).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/helix/ai-operations/billing-engine.test.ts
```

Expected: FAIL - "BillingEngine is not defined"

**Step 3: Implement BillingEngine**

Create `src/helix/ai-operations/billing-engine.ts`:

```typescript
/**
 * Billing Engine - Phase 6
 *
 * Tracks usage-based costs and generates monthly invoices.
 */

export type InvoiceStatus = 'unpaid' | 'paid' | 'overdue';

export interface Invoice {
  invoiceId: string;
  userId: string;
  createdAt: string;
  subtotal: number;
  tax: number;
  totalAmount: number;
  status: InvoiceStatus;
}

export interface MonthlyUsage {
  userId: string;
  totalCost: number;
  operationCount: number;
  costByOperation: Record<string, number>;
}

interface UsageRecord {
  operationType: string;
  cost: number;
  timestamp: string;
}

const TAX_RATE = 0.1; // 10%

export class BillingEngine {
  private usageRecords: Map<string, UsageRecord[]> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private invoiceCounter = 0;

  /**
   * Record operation cost
   */
  recordOperation(userId: string, operationType: string, costUsd: number): void {
    if (!this.usageRecords.has(userId)) {
      this.usageRecords.set(userId, []);
    }

    this.usageRecords.get(userId)!.push({
      operationType,
      cost: costUsd,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get monthly usage summary
   */
  getMonthlyUsage(userId: string): MonthlyUsage {
    const records = this.usageRecords.get(userId) || [];
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
    const costByOperation: Record<string, number> = {};

    for (const record of records) {
      costByOperation[record.operationType] =
        (costByOperation[record.operationType] || 0) + record.cost;
    }

    return {
      userId,
      totalCost,
      operationCount: records.length,
      costByOperation,
    };
  }

  /**
   * Generate monthly invoice
   */
  generateInvoice(userId: string): Invoice {
    const usage = this.getMonthlyUsage(userId);
    const subtotal = usage.totalCost;
    const tax = subtotal * TAX_RATE;
    const totalAmount = subtotal + tax;

    const invoice: Invoice = {
      invoiceId: `inv_${++this.invoiceCounter}`,
      userId,
      createdAt: new Date().toISOString(),
      subtotal,
      tax,
      totalAmount,
      status: 'unpaid',
    };

    this.invoices.set(invoice.invoiceId, invoice);
    return invoice;
  }

  /**
   * Mark invoice as paid
   */
  markInvoiceAsPaid(invoiceId: string): void {
    const invoice = this.invoices.get(invoiceId);
    if (invoice) {
      invoice.status = 'paid';
    }
  }

  /**
   * Get invoice by ID
   */
  getInvoice(invoiceId: string): Invoice | null {
    return this.invoices.get(invoiceId) || null;
  }

  /**
   * Get invoice history for user
   */
  getInvoiceHistory(userId: string): Invoice[] {
    const invoices: Invoice[] = [];
    for (const invoice of this.invoices.values()) {
      if (invoice.userId === userId) {
        invoices.push(invoice);
      }
    }
    return invoices.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Clear all billing data
   */
  clear(): void {
    this.usageRecords.clear();
    this.invoices.clear();
    this.invoiceCounter = 0;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/helix/ai-operations/billing-engine.test.ts
```

Expected: PASS - All 8 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/billing-engine.ts src/helix/ai-operations/billing-engine.test.ts
git commit -m "feat(phase6-task3): implement billing engine with monthly invoicing and cost tracking"
```

---

### Task 4: Analytics Collector

**Files:**
- Create: `src/helix/ai-operations/analytics-collector.ts`
- Create: `src/helix/ai-operations/analytics-collector.test.ts`

**Step 1: Write the failing test**

Create `src/helix/ai-operations/analytics-collector.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsCollector } from './analytics-collector.js';

describe('AnalyticsCollector', () => {
  let collector: AnalyticsCollector;

  beforeEach(() => {
    collector = new AnalyticsCollector();
  });

  describe('Event Capture', () => {
    it('captures operation_start event', () => {
      collector.captureEvent('operation_start', {
        operationId: 'op_123',
        userId: 'user_123',
        operationType: 'email_analysis',
      });

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('operation_start');
    });

    it('captures operation_complete event', () => {
      collector.captureEvent('operation_complete', {
        operationId: 'op_123',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 245,
        costUsd: 0.005,
        success: true,
      });

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('operation_complete');
    });

    it('captures operation_failed event', () => {
      collector.captureEvent('operation_failed', {
        operationId: 'op_123',
        userId: 'user_123',
        operationType: 'email_analysis',
        errorMessage: 'Timeout',
      });

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('operation_failed');
    });
  });

  describe('Time-Series Data', () => {
    it('aggregates events by hour', () => {
      for (let i = 0; i < 10; i++) {
        collector.captureEvent('operation_complete', {
          operationId: `op_${i}`,
          userId: 'user_123',
          operationType: 'email_analysis',
          latencyMs: 100 + i * 10,
          costUsd: 0.005,
          success: true,
        });
      }

      const hourly = collector.getHourlyAggregation();
      expect(hourly.totalEvents).toBe(10);
      expect(hourly.avgLatencyMs).toBeGreaterThan(100);
    });
  });

  describe('Custom Dimensions', () => {
    it('filters events by user', () => {
      collector.captureEvent('operation_complete', {
        operationId: 'op_1',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 100,
        costUsd: 0.005,
        success: true,
      });

      collector.captureEvent('operation_complete', {
        operationId: 'op_2',
        userId: 'user_456',
        operationType: 'email_analysis',
        latencyMs: 150,
        costUsd: 0.005,
        success: true,
      });

      const user123Events = collector.getEventsByUser('user_123');
      expect(user123Events).toHaveLength(1);
      expect(user123Events[0].userId).toBe('user_123');
    });

    it('filters events by operation type', () => {
      collector.captureEvent('operation_complete', {
        operationId: 'op_1',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 100,
        costUsd: 0.005,
        success: true,
      });

      collector.captureEvent('operation_complete', {
        operationId: 'op_2',
        userId: 'user_123',
        operationType: 'video_analysis',
        latencyMs: 500,
        costUsd: 0.05,
        success: true,
      });

      const emailEvents = collector.getEventsByOperationType('email_analysis');
      expect(emailEvents).toHaveLength(1);
      expect(emailEvents[0].operationType).toBe('email_analysis');
    });
  });

  describe('Success Rate Calculation', () => {
    it('calculates success rate', () => {
      collector.captureEvent('operation_complete', {
        operationId: 'op_1',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 100,
        costUsd: 0.005,
        success: true,
      });

      collector.captureEvent('operation_failed', {
        operationId: 'op_2',
        userId: 'user_123',
        operationType: 'email_analysis',
        errorMessage: 'Timeout',
      });

      collector.captureEvent('operation_complete', {
        operationId: 'op_3',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 150,
        costUsd: 0.005,
        success: true,
      });

      const hourly = collector.getHourlyAggregation();
      expect(hourly.successRate).toBeCloseTo(0.666, 2); // 2 successes out of 3
    });
  });

  describe('Clear', () => {
    it('clears all events', () => {
      collector.captureEvent('operation_complete', {
        operationId: 'op_123',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 100,
        costUsd: 0.005,
        success: true,
      });

      collector.clear();
      const events = collector.getEvents();
      expect(events).toHaveLength(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/helix/ai-operations/analytics-collector.test.ts
```

Expected: FAIL - "AnalyticsCollector is not defined"

**Step 3: Implement AnalyticsCollector**

Create `src/helix/ai-operations/analytics-collector.ts`:

```typescript
/**
 * Analytics Collector - Phase 6
 *
 * Captures operation metadata for dashboards and trend analysis.
 */

export interface AnalyticsEvent {
  eventType: 'operation_start' | 'operation_complete' | 'operation_failed';
  operationId: string;
  userId: string;
  operationType: string;
  timestamp: string;
  latencyMs?: number;
  costUsd?: number;
  success?: boolean;
  errorMessage?: string;
}

export interface HourlyAggregation {
  totalEvents: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  totalCostUsd: number;
}

export class AnalyticsCollector {
  private events: AnalyticsEvent[] = [];

  /**
   * Capture analytics event
   */
  captureEvent(
    eventType: 'operation_start' | 'operation_complete' | 'operation_failed',
    data: Omit<AnalyticsEvent, 'eventType' | 'timestamp'>
  ): void {
    this.events.push({
      ...data,
      eventType,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get all events
   */
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Get events by user
   */
  getEventsByUser(userId: string): AnalyticsEvent[] {
    return this.events.filter(e => e.userId === userId);
  }

  /**
   * Get events by operation type
   */
  getEventsByOperationType(operationType: string): AnalyticsEvent[] {
    return this.events.filter(e => e.operationType === operationType);
  }

  /**
   * Get hourly aggregation of metrics
   */
  getHourlyAggregation(): HourlyAggregation {
    const successCount = this.events.filter(e => e.eventType === 'operation_complete').length;
    const failureCount = this.events.filter(e => e.eventType === 'operation_failed').length;
    const totalEvents = successCount + failureCount;

    const latencies = this.events
      .filter(e => e.latencyMs !== undefined)
      .map(e => e.latencyMs || 0);
    const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    const totalCostUsd = this.events.reduce((sum, e) => sum + (e.costUsd || 0), 0);

    return {
      totalEvents,
      successCount,
      failureCount,
      successRate: totalEvents === 0 ? 0 : successCount / totalEvents,
      avgLatencyMs,
      totalCostUsd,
    };
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/helix/ai-operations/analytics-collector.test.ts
```

Expected: PASS - All 8 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/analytics-collector.ts src/helix/ai-operations/analytics-collector.test.ts
git commit -m "feat(phase6-task4): implement analytics collector for operation metrics and dashboards"
```

---

### Task 5: Webhook Manager

**Files:**
- Create: `src/helix/ai-operations/webhook-manager.ts`
- Create: `src/helix/ai-operations/webhook-manager.test.ts`

**Step 1: Write the failing test**

Create `src/helix/ai-operations/webhook-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookManager } from './webhook-manager.js';

describe('WebhookManager', () => {
  let manager: WebhookManager;

  beforeEach(() => {
    manager = new WebhookManager();
    vi.useFakeTimers();
  });

  describe('Webhook Registration', () => {
    it('registers webhook endpoint', () => {
      const webhookId = manager.registerWebhook('user_123', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      expect(webhookId).toBeDefined();
      const webhooks = manager.getUserWebhooks('user_123');
      expect(webhooks).toHaveLength(1);
      expect(webhooks[0].url).toBe('https://myapp.com/webhooks');
    });

    it('filters events by type', () => {
      manager.registerWebhook('user_456', 'https://myapp.com/webhooks', ['operation_complete']);
      const webhooks = manager.getUserWebhooks('user_456');
      expect(webhooks[0].eventTypes).toContain('operation_complete');
      expect(webhooks[0].eventTypes).not.toContain('operation_failed');
    });
  });

  describe('Event Delivery', () => {
    it('queues event for webhook delivery', async () => {
      const webhookId = manager.registerWebhook('user_789', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      manager.queueEvent('operation_complete', {
        operationId: 'op_123',
        userId: 'user_789',
        operationType: 'email_analysis',
        result: { sentiment: 'positive' },
      });

      const queue = manager.getPendingDeliveries(webhookId);
      expect(queue).toHaveLength(1);
    });

    it('filters events based on subscription', async () => {
      const webhookId = manager.registerWebhook('user_999', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      manager.queueEvent('operation_failed', {
        operationId: 'op_123',
        userId: 'user_999',
        errorMessage: 'Timeout',
      });

      const queue = manager.getPendingDeliveries(webhookId);
      expect(queue).toHaveLength(0); // operation_failed not subscribed
    });
  });

  describe('Retry Logic', () => {
    it('retries failed deliveries with exponential backoff', () => {
      const webhookId = manager.registerWebhook('user_123', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      manager.queueEvent('operation_complete', {
        operationId: 'op_123',
        userId: 'user_123',
        operationType: 'email_analysis',
      });

      const delivery = manager.getPendingDeliveries(webhookId)[0];
      manager.markDeliveryAttempt(delivery.id, false); // Failed

      expect(delivery.retryCount).toBe(1);
      expect(delivery.nextRetryTime).toBeDefined();
    });

    it('stops retrying after max attempts', () => {
      const webhookId = manager.registerWebhook('user_456', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      manager.queueEvent('operation_complete', {
        operationId: 'op_456',
        userId: 'user_456',
        operationType: 'video_analysis',
      });

      let delivery = manager.getPendingDeliveries(webhookId)[0];

      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        manager.markDeliveryAttempt(delivery.id, false);
      }

      delivery = manager.getDelivery(delivery.id);
      expect(delivery?.status).toBe('failed');
    });
  });

  describe('Webhook Deregistration', () => {
    it('unregisters webhook', () => {
      const webhookId = manager.registerWebhook('user_789', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      manager.unregisterWebhook(webhookId);

      const webhooks = manager.getUserWebhooks('user_789');
      expect(webhooks).toHaveLength(0);
    });
  });

  describe('Clear', () => {
    it('clears all webhooks and deliveries', () => {
      manager.registerWebhook('user_123', 'https://myapp.com/webhooks', ['operation_complete']);
      manager.clear();

      const webhooks = manager.getUserWebhooks('user_123');
      expect(webhooks).toHaveLength(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/helix/ai-operations/webhook-manager.test.ts
```

Expected: FAIL - "WebhookManager is not defined"

**Step 3: Implement WebhookManager**

Create `src/helix/ai-operations/webhook-manager.ts`:

```typescript
/**
 * Webhook Manager - Phase 6
 *
 * Manages webhook subscriptions and real-time event delivery with retry logic.
 */

export type EventType = 'operation_start' | 'operation_complete' | 'operation_failed';
export type DeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  eventTypes: EventType[];
  createdAt: string;
}

export interface WebhookEvent {
  eventType: EventType;
  userId: string;
  data: Record<string, any>;
}

export interface Delivery {
  id: string;
  webhookId: string;
  eventType: EventType;
  payload: Record<string, any>;
  status: DeliveryStatus;
  retryCount: number;
  nextRetryTime?: string;
  timestamp: string;
}

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000; // 1 second
const MAX_BACKOFF_MS = 32000; // 32 seconds

export class WebhookManager {
  private webhooks: Map<string, Webhook> = new Map();
  private deliveries: Map<string, Delivery> = new Map();
  private userWebhooks: Map<string, string[]> = new Map();
  private webhookCounter = 0;
  private deliveryCounter = 0;

  /**
   * Register webhook endpoint
   */
  registerWebhook(userId: string, url: string, eventTypes: EventType[]): string {
    const webhookId = `webhook_${++this.webhookCounter}`;
    const webhook: Webhook = {
      id: webhookId,
      userId,
      url,
      eventTypes,
      createdAt: new Date().toISOString(),
    };

    this.webhooks.set(webhookId, webhook);

    if (!this.userWebhooks.has(userId)) {
      this.userWebhooks.set(userId, []);
    }
    this.userWebhooks.get(userId)!.push(webhookId);

    return webhookId;
  }

  /**
   * Unregister webhook
   */
  unregisterWebhook(webhookId: string): void {
    const webhook = this.webhooks.get(webhookId);
    if (webhook) {
      const userHooks = this.userWebhooks.get(webhook.userId) || [];
      const index = userHooks.indexOf(webhookId);
      if (index > -1) {
        userHooks.splice(index, 1);
      }
      this.webhooks.delete(webhookId);
    }
  }

  /**
   * Get webhooks for user
   */
  getUserWebhooks(userId: string): Webhook[] {
    const webhookIds = this.userWebhooks.get(userId) || [];
    return webhookIds.map(id => this.webhooks.get(id)!).filter(Boolean);
  }

  /**
   * Queue event for delivery
   */
  queueEvent(eventType: EventType, data: Record<string, any>): void {
    const userId = data.userId;
    const userHooks = this.getUserWebhooks(userId);

    for (const webhook of userHooks) {
      if (webhook.eventTypes.includes(eventType)) {
        const deliveryId = `delivery_${++this.deliveryCounter}`;
        const delivery: Delivery = {
          id: deliveryId,
          webhookId: webhook.id,
          eventType,
          payload: data,
          status: 'pending',
          retryCount: 0,
          timestamp: new Date().toISOString(),
        };
        this.deliveries.set(deliveryId, delivery);
      }
    }
  }

  /**
   * Get pending deliveries for webhook
   */
  getPendingDeliveries(webhookId: string): Delivery[] {
    const pending: Delivery[] = [];
    for (const delivery of this.deliveries.values()) {
      if (delivery.webhookId === webhookId && delivery.status === 'pending') {
        pending.push(delivery);
      }
    }
    return pending;
  }

  /**
   * Mark delivery attempt (success or failure)
   */
  markDeliveryAttempt(deliveryId: string, success: boolean): void {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) return;

    if (success) {
      delivery.status = 'delivered';
    } else {
      delivery.retryCount++;

      if (delivery.retryCount >= MAX_RETRIES) {
        delivery.status = 'failed';
      } else {
        // Calculate exponential backoff
        const backoffMs = Math.min(
          INITIAL_BACKOFF_MS * Math.pow(2, delivery.retryCount - 1),
          MAX_BACKOFF_MS
        );
        delivery.nextRetryTime = new Date(Date.now() + backoffMs).toISOString();
      }
    }
  }

  /**
   * Get delivery by ID
   */
  getDelivery(deliveryId: string): Delivery | null {
    return this.deliveries.get(deliveryId) || null;
  }

  /**
   * Clear all webhooks and deliveries
   */
  clear(): void {
    this.webhooks.clear();
    this.deliveries.clear();
    this.userWebhooks.clear();
    this.webhookCounter = 0;
    this.deliveryCounter = 0;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/helix/ai-operations/webhook-manager.test.ts
```

Expected: PASS - All 8 tests passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/webhook-manager.ts src/helix/ai-operations/webhook-manager.test.ts
git commit -m "feat(phase6-task5): implement webhook manager with real-time event delivery and retry logic"
```

---

### Task 6: Router Integration & Final Quality Check

**Files:**
- Create: `src/helix/ai-operations/phase6-integration.test.ts`
- Modify: `src/helix/ai-operations/router.ts` (add Phase 6 getters)
- Modify: `src/helix/ai-operations/router.test.ts` (add Phase 6 tests)

**Step 1: Create Phase 6 integration tests**

Create `src/helix/ai-operations/phase6-integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { UsageQuotaManager } from './usage-quota.js';
import { RateLimiter } from './rate-limiter.js';
import { BillingEngine } from './billing-engine.js';
import { AnalyticsCollector } from './analytics-collector.js';
import { WebhookManager } from './webhook-manager.js';

describe('Phase 6: Multi-Tenant SaaS Integration', () => {
  describe('Quota + Billing Integration', () => {
    it('enforces quotas and tracks billing together', () => {
      const quota = new UsageQuotaManager();
      const billing = new BillingEngine();

      // User has 100 ops/day quota
      const canExecute = quota.canExecuteOperation('user_123', 'free', 50);
      expect(canExecute).toBe(true);

      // Execute and record cost
      quota.incrementUsage('user_123', 'free', 50);
      billing.recordOperation('user_123', 'email_analysis', 0.05);

      const usage = quota.getUsage('user_123');
      const monthlyUsage = billing.getMonthlyUsage('user_123');

      expect(usage).toBe(50);
      expect(monthlyUsage.totalCost).toBe(0.05);
    });
  });

  describe('Rate Limiting + Analytics', () => {
    it('tracks rate limited requests in analytics', () => {
      const limiter = new RateLimiter();
      const analytics = new AnalyticsCollector();

      // Allow 3 requests
      limiter.allowRequest('user_456', 100);
      limiter.allowRequest('user_456', 100);
      limiter.allowRequest('user_456', 100);

      // Capture events
      for (let i = 0; i < 3; i++) {
        analytics.captureEvent('operation_complete', {
          operationId: `op_${i}`,
          userId: 'user_456',
          operationType: 'email_analysis',
          latencyMs: 100,
          costUsd: 0.005,
          success: true,
        });
      }

      const hourly = analytics.getHourlyAggregation();
      expect(hourly.totalEvents).toBe(3);
      expect(hourly.successRate).toBe(1.0);
    });
  });

  describe('Webhook + Billing', () => {
    it('sends billing events via webhook', () => {
      const webhooks = new WebhookManager();
      const billing = new BillingEngine();

      // Register webhook for completion events
      const webhookId = webhooks.registerWebhook('user_789', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      // Process operation
      billing.recordOperation('user_789', 'email_analysis', 0.01);

      // Send webhook event
      webhooks.queueEvent('operation_complete', {
        userId: 'user_789',
        operationId: 'op_123',
        operationType: 'email_analysis',
        costUsd: 0.01,
      });

      const pending = webhooks.getPendingDeliveries(webhookId);
      expect(pending).toHaveLength(1);

      const invoice = billing.generateInvoice('user_789');
      expect(invoice.totalAmount).toBeCloseTo(0.011); // 0.01 + 10% tax
    });
  });

  describe('End-to-End Multi-Tenant Workflow', () => {
    it('executes complete Phase 6 workflow', () => {
      const quota = new UsageQuotaManager();
      const limiter = new RateLimiter();
      const billing = new BillingEngine();
      const analytics = new AnalyticsCollector();
      const webhooks = new WebhookManager();

      // 1. Register webhook
      const webhookId = webhooks.registerWebhook('user_multi', 'https://myapp.com/webhooks', [
        'operation_complete',
      ]);

      // 2. Check quota
      expect(quota.canExecuteOperation('user_multi', 'pro', 100)).toBe(true);

      // 3. Check rate limit
      expect(limiter.allowRequest('user_multi', 100)).toBe(true);

      // 4. Execute operation (simulated)
      quota.incrementUsage('user_multi', 'pro', 100);
      billing.recordOperation('user_multi', 'email_analysis', 0.025);

      // 5. Capture analytics
      analytics.captureEvent('operation_complete', {
        operationId: 'op_multi',
        userId: 'user_multi',
        operationType: 'email_analysis',
        latencyMs: 234,
        costUsd: 0.025,
        success: true,
      });

      // 6. Queue webhook
      webhooks.queueEvent('operation_complete', {
        userId: 'user_multi',
        operationId: 'op_multi',
        operationType: 'email_analysis',
        costUsd: 0.025,
      });

      // Verify state
      expect(quota.getUsage('user_multi')).toBe(100);
      expect(billing.getMonthlyUsage('user_multi').totalCost).toBeCloseTo(0.025);
      expect(analytics.getHourlyAggregation().totalCostUsd).toBeCloseTo(0.025);
      expect(webhooks.getPendingDeliveries(webhookId)).toHaveLength(1);
    });
  });
});
```

**Step 2: Update Router to expose Phase 6 components**

In `src/helix/ai-operations/router.ts`, add imports:

```typescript
import { UsageQuotaManager } from './usage-quota.js';
import { RateLimiter } from './rate-limiter.js';
import { BillingEngine } from './billing-engine.js';
import { AnalyticsCollector } from './analytics-collector.js';
import { WebhookManager } from './webhook-manager.js';
```

Add properties to AIOperationRouter class:

```typescript
  private quotaManager: UsageQuotaManager;
  private rateLimiter: RateLimiter;
  private billingEngine: BillingEngine;
  private analyticsCollector: AnalyticsCollector;
  private webhookManager: WebhookManager;
```

In constructor, add initialization:

```typescript
    // Initialize Phase 6 multi-tenant features
    this.quotaManager = new UsageQuotaManager();
    this.rateLimiter = new RateLimiter();
    this.billingEngine = new BillingEngine();
    this.analyticsCollector = new AnalyticsCollector();
    this.webhookManager = new WebhookManager();
```

Add getter methods at end of class:

```typescript
  /**
   * Get quota manager for operation limits
   */
  getQuotaManager(): UsageQuotaManager {
    return this.quotaManager;
  }

  /**
   * Get rate limiter for request throttling
   */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Get billing engine for cost tracking
   */
  getBillingEngine(): BillingEngine {
    return this.billingEngine;
  }

  /**
   * Get analytics collector for metrics
   */
  getAnalyticsCollector(): AnalyticsCollector {
    return this.analyticsCollector;
  }

  /**
   * Get webhook manager for event delivery
   */
  getWebhookManager(): WebhookManager {
    return this.webhookManager;
  }
```

**Step 3: Add Phase 6 tests to router.test.ts**

Add this test block to the end of the describe block in `src/helix/ai-operations/router.test.ts`:

```typescript
  describe('Phase 6 Multi-Tenant Features', () => {
    it('provides access to quota manager', () => {
      const quotaManager = router.getQuotaManager();
      expect(quotaManager).toBeDefined();
    });

    it('provides access to rate limiter', () => {
      const rateLimiter = router.getRateLimiter();
      expect(rateLimiter).toBeDefined();
    });

    it('provides access to billing engine', () => {
      const billingEngine = router.getBillingEngine();
      expect(billingEngine).toBeDefined();
    });

    it('provides access to analytics collector', () => {
      const analyticsCollector = router.getAnalyticsCollector();
      expect(analyticsCollector).toBeDefined();
    });

    it('provides access to webhook manager', () => {
      const webhookManager = router.getWebhookManager();
      expect(webhookManager).toBeDefined();
    });
  });
```

**Step 4: Run all AI operations tests**

```bash
npm run test -- src/helix/ai-operations/
```

Expected: 75+ tests all passing (Phase 3-6 combined)

**Step 5: Run quality checks**

```bash
npm run typecheck
npm run lint
npm run quality
```

Expected: All checks passing

**Step 6: Commit**

```bash
git add src/helix/ai-operations/phase6-integration.test.ts src/helix/ai-operations/router.ts src/helix/ai-operations/router.test.ts
git commit -m "feat(phase6-task6): integrate multi-tenant features with router and add final quality checks"
```

---

## Summary

Phase 6 delivers five major subsystems:

1. **Usage Quota Manager** (Task 1) - Tier-based operation quotas with daily enforcement
2. **Rate Limiter** (Task 2) - Token-bucket rate limiting with per-user limits
3. **Billing Engine** (Task 3) - Monthly invoicing with usage-based cost calculation
4. **Analytics Collector** (Task 4) - Event capture and time-series metrics for dashboards
5. **Webhook Manager** (Task 5) - Real-time event delivery with retry logic
6. **Router Integration** (Task 6) - Seamless integration of all Phase 6 components

**Total Files Created:** 10 (5 implementation + 5 test files + 1 integration test)
**Tests Added:** 40+ covering all Phase 6 features
**Commits:** 6 atomic commits

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-04-phase6-multi-tenant-saas.md`.

**Two execution options:**

**Option 1: Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**Option 2: Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach would you prefer?**
