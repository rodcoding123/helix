# PHASE 0.5: UNIFIED AI OPERATIONS CONTROL PLANE
## Detailed Implementation Roadmap (Weeks 1-2)

**Goal:** Migrate all 10 scattered AI operations to centralized router with cost tracking, approval gates, and admin control.

**Outcome:** Every AI call in Helix goes through the same router. Admin sees all costs. Margin-impacting changes blocked. Ready for Phase 0 orchestration.

---

## WEEK 1: Foundation

### Day 1-2: Database Schema (Supabase)

**Files to Create:**
- `supabase/migrations/001_ai_operations.sql`

```sql
-- Core configuration table
CREATE TABLE ai_model_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id VARCHAR UNIQUE NOT NULL,        -- "chat_message", "memory_synthesis"
  operation_name VARCHAR NOT NULL,
  primary_model VARCHAR NOT NULL,              -- "deepseek", "gemini_flash"
  fallback_model VARCHAR,
  enabled BOOLEAN DEFAULT true,
  cost_criticality ENUM('LOW', 'MEDIUM', 'HIGH'),
  created_by VARCHAR,
  updated_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cost tracking (every operation logged)
CREATE TABLE ai_operation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type VARCHAR NOT NULL,
  operation_id VARCHAR,
  model_used VARCHAR NOT NULL,
  user_id UUID,
  input_tokens INT,
  output_tokens INT,
  cost_usd DECIMAL(10, 6),
  latency_ms INT,
  quality_score DECIMAL(3, 2),
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX (user_id, created_at),
  INDEX (operation_type, created_at)
);

-- Cost budgets & alerts
CREATE TABLE cost_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  daily_limit_usd DECIMAL(10, 2) DEFAULT 50.00,
  warning_threshold_usd DECIMAL(10, 2) DEFAULT 25.00,
  current_spend_today DECIMAL(10, 2) DEFAULT 0.00,
  operations_today INT DEFAULT 0,
  last_checked TIMESTAMP DEFAULT NOW()
);

-- Hardcoded safety toggles
CREATE TABLE feature_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toggle_name VARCHAR UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  locked BOOLEAN DEFAULT true,
  controlled_by ENUM('ADMIN_ONLY', 'USER', 'BOTH'),
  notes TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Helix's recommendations
CREATE TABLE helix_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id VARCHAR,
  recommendation_type VARCHAR,
  current_config JSONB,
  proposed_config JSONB,
  estimated_savings_usd DECIMAL(10, 2),
  estimated_quality_impact DECIMAL(4, 2),
  confidence DECIMAL(3, 2),
  reasoning TEXT,
  approval_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert safety toggles
INSERT INTO feature_toggles VALUES
  (gen_random_uuid(), 'helix_can_change_models', false, true, 'ADMIN_ONLY', 'Helix cannot change models'),
  (gen_random_uuid(), 'helix_can_approve_costs', false, true, 'ADMIN_ONLY', 'Helix cannot approve costs'),
  (gen_random_uuid(), 'helix_can_recommend_optimizations', false, false, 'BOTH', 'Helix can suggest optimizations'),
  (gen_random_uuid(), 'helix_autonomy_enabled', false, false, 'USER', 'Users can enable autonomy');

-- Insert model routing config
INSERT INTO ai_model_routes VALUES
  (gen_random_uuid(), 'chat_message', 'Chat Messages', 'deepseek', 'gemini_flash', true, 'HIGH', 'system', 'system', NOW(), NOW()),
  (gen_random_uuid(), 'agent_execution', 'Agent Execution', 'deepseek', 'gemini_flash', true, 'HIGH', 'system', 'system', NOW(), NOW()),
  (gen_random_uuid(), 'memory_synthesis', 'Memory Synthesis', 'gemini_flash', 'deepseek', true, 'MEDIUM', 'system', 'system', NOW(), NOW()),
  (gen_random_uuid(), 'sentiment_analysis', 'Sentiment Analysis', 'gemini_flash', 'deepseek', true, 'LOW', 'system', 'system', NOW(), NOW()),
  (gen_random_uuid(), 'video_understanding', 'Video Understanding', 'gemini_flash', NULL, true, 'MEDIUM', 'system', 'system', NOW(), NOW()),
  (gen_random_uuid(), 'audio_transcription', 'Audio Transcription', 'deepgram', 'openai', true, 'MEDIUM', 'system', 'system', NOW(), NOW()),
  (gen_random_uuid(), 'text_to_speech', 'Text to Speech', 'edge_tts', 'elevenlabs', true, 'LOW', 'system', 'system', NOW(), NOW()),
  (gen_random_uuid(), 'email_analysis', 'Email Analysis', 'gemini_flash', 'deepseek', false, 'LOW', 'system', 'system', NOW(), NOW());
```

**Time: 3-4 hours**

### Day 2-3: Core Router (~300 lines)

**File:** `src/helix/ai-operations/router.ts`

```typescript
import { supabase } from '@/lib/supabase';
import { logToDiscord } from '@/helix/logging';
import { FeatureToggleError, ApprovalRequiredError } from '@/helix/errors';

interface AIOperation {
  operationId: string;
  input: any;
  user?: string;
  requiresApproval?: boolean;
}

interface RoutingDecision {
  model: string;
  cost: number;
  rationale: string;
}

export class AIOperationRouter {
  private routeCache: Map<string, any> = new Map();
  private lastCacheRefresh = 0;
  private CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async route(operation: AIOperation): Promise<RoutingDecision> {
    // 1. Load routing config (cached)
    const route = await this.getRoute(operation.operationId);

    if (!route.enabled) {
      throw new Error(`Operation ${operation.operationId} is disabled`);
    }

    // 2. Check if approval required
    if (this.requiresApproval(route, operation)) {
      const approval = await this.checkApproval(operation);
      if (!approval) {
        throw new ApprovalRequiredError(
          `Operation ${operation.operationId} requires approval`
        );
      }
    }

    // 3. Check cost budget
    await this.enforceBudget(operation.user);

    // 4. Log pre-execution
    await logToDiscord({
      type: 'ai_operation_routing',
      operationId: operation.operationId,
      suggestedModel: route.primary_model,
      cost: await this.estimateCost(route.primary_model, operation.input)
    });

    // 5. Return routing decision
    return {
      model: route.primary_model,
      cost: await this.estimateCost(route.primary_model, operation.input),
      rationale: `Routed to ${route.primary_model} per configuration`
    };
  }

  private async getRoute(operationId: string) {
    // Check cache
    if (this.routeCache.has(operationId) &&
        Date.now() - this.lastCacheRefresh < this.CACHE_TTL_MS) {
      return this.routeCache.get(operationId);
    }

    // Fetch from DB
    const { data, error } = await supabase
      .from('ai_model_routes')
      .select('*')
      .eq('operation_id', operationId)
      .single();

    if (error || !data) {
      throw new Error(`Operation ${operationId} not configured`);
    }

    // Cache it
    this.routeCache.set(operationId, data);
    this.lastCacheRefresh = Date.now();

    return data;
  }

  private requiresApproval(route: any, operation: AIOperation): boolean {
    // Money operations always need approval
    if (route.cost_criticality === 'HIGH') {
      return true;
    }

    return operation.requiresApproval ?? false;
  }

  private async checkApproval(operation: AIOperation): Promise<boolean> {
    // TODO: Implement approval workflow in Phase 1
    // For now, hardcoded to require explicit approval for HIGH criticality
    return false;
  }

  private async enforceBudget(userId?: string): Promise<void> {
    if (!userId) return;

    const { data: budget } = await supabase
      .from('cost_budgets')
      .select('daily_limit_usd, current_spend_today')
      .eq('user_id', userId)
      .single();

    if (!budget) return;

    if (budget.current_spend_today >= budget.daily_limit_usd) {
      throw new Error(`Daily budget exceeded for user ${userId}`);
    }
  }

  private async estimateCost(model: string, input: any): Promise<number> {
    // Estimate based on input size
    const modelCosts = {
      'deepseek': { inputRate: 0.0027 / 1000000, outputRate: 0.0108 / 1000000 },
      'gemini_flash': { inputRate: 0.50 / 1000000, outputRate: 3.00 / 1000000 },
      'deepgram': { inputRate: 0.0044 / 60 }, // Per minute
      'edge_tts': { inputRate: 0 }, // FREE
    };

    const cost = modelCosts[model];
    if (!cost) return 0;

    // Rough estimate: 1 token ≈ 4 chars
    const estimatedTokens = JSON.stringify(input).length / 4;
    return estimatedTokens * cost.inputRate;
  }

  async clearCache(): Promise<void> {
    this.routeCache.clear();
  }
}

export const router = new AIOperationRouter();
```

**Time: 4-5 hours**

### Day 3-4: Cost Tracker (~150 lines)

**File:** `src/helix/ai-operations/cost-tracker.ts`

```typescript
import { supabase } from '@/lib/supabase';

export interface OperationMetrics {
  operationType: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  qualityScore?: number;
  success: boolean;
  errorMessage?: string;
}

export class CostTracker {
  async logOperation(
    userId: string | undefined,
    metrics: OperationMetrics
  ): Promise<void> {
    // Insert into log
    const { error: logError } = await supabase
      .from('ai_operation_log')
      .insert([
        {
          operation_type: metrics.operationType,
          model_used: metrics.modelUsed,
          user_id: userId,
          input_tokens: metrics.inputTokens,
          output_tokens: metrics.outputTokens,
          cost_usd: metrics.costUsd,
          latency_ms: metrics.latencyMs,
          quality_score: metrics.qualityScore,
          success: metrics.success,
          error_message: metrics.errorMessage,
          created_at: new Date().toISOString()
        }
      ]);

    if (logError) {
      console.error('Failed to log operation:', logError);
    }

    // Update daily budget
    if (userId) {
      const today = new Date().toISOString().split('T')[0];
      const { data: budget } = await supabase
        .from('cost_budgets')
        .select('current_spend_today, operations_today')
        .eq('user_id', userId)
        .single();

      if (budget) {
        const { error: updateError } = await supabase
          .from('cost_budgets')
          .update({
            current_spend_today: budget.current_spend_today + metrics.costUsd,
            operations_today: budget.operations_today + 1,
            last_checked: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Failed to update budget:', updateError);
        }
      }
    }
  }

  async getDailySpend(userId: string): Promise<number> {
    const { data } = await supabase
      .from('cost_budgets')
      .select('current_spend_today')
      .eq('user_id', userId)
      .single();

    return data?.current_spend_today ?? 0;
  }

  async getDailyOperationCount(userId: string): Promise<number> {
    const { data } = await supabase
      .from('cost_budgets')
      .select('operations_today')
      .eq('user_id', userId)
      .single();

    return data?.operations_today ?? 0;
  }

  async resetDailyMetrics(): Promise<void> {
    // Run daily at midnight
    const { error } = await supabase
      .from('cost_budgets')
      .update({
        current_spend_today: 0,
        operations_today: 0,
        last_checked: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to reset daily metrics:', error);
    }
  }
}

export const costTracker = new CostTracker();
```

**Time: 2-3 hours**

---

## WEEK 2: Integration & Admin Panel

### Day 1: Migrate 10 AI Operations (~8 hours)

**Priority Order (migrate sequentially):**

1. `helix-runtime/src/gateway/http-routes/chat.ts` - **HIGHEST IMPACT**
   ```typescript
   // OLD
   const response = await claude.messages.create(...)

   // NEW
   const { model } = await router.route({ operationId: 'chat_message', input: messages });
   const response = await models[model].messages.create(...)
   await costTracker.logOperation(userId, { operationType: 'chat_message', modelUsed: model, ... })
   ```

2. `helix-runtime/src/gateway/server-methods/agent.ts`
   - Same pattern: route → execute → log

3. `helix-runtime/src/gateway/server-methods/memory-synthesis.ts`
   - Same pattern

4. `web/src/pages/api/sentiment-analyze.ts`
   - Same pattern

5. `helix-runtime/src/media-understanding/providers/google/video.ts`
   - Same pattern

6. `helix-runtime/src/media-understanding/providers/deepgram/audio.ts`
   - Same pattern

7. `helix-runtime/src/helix/voice/text-to-speech.ts`
   - Same pattern

8. `helix-runtime/src/gateway/server-methods/email.ts`
   - Same pattern

Each migration: 1-1.5 hours

**Total: 8-12 hours**

### Day 2-3: Approval Gate System (~200 lines)

**File:** `src/helix/ai-operations/approval-gate.ts`

```typescript
import { supabase } from '@/lib/supabase';
import { logToDiscord } from '@/helix/logging';

export interface ApprovalRequest {
  operationId: string;
  change: 'model_switch' | 'cost_increase' | 'budget_change';
  current: any;
  proposed: any;
  estimatedImpact: string;
  requiredBy: Date;
}

export class ApprovalGate {
  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    // Log to Discord for Rodrigo
    await logToDiscord({
      type: 'approval_required',
      operation: request.operationId,
      change: request.change,
      estimatedImpact: request.estimatedImpact
    });

    // Store in DB
    const { data } = await supabase
      .from('helix_recommendations')
      .insert([{
        operation_id: request.operationId,
        recommendation_type: request.change,
        current_config: request.current,
        proposed_config: request.proposed,
        approval_status: 'PENDING',
        created_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    // TODO: Implement user approval flow via admin panel
    // For now, return false (requires manual approval)
    return false;
  }

  async checkApproval(operationId: string): Promise<boolean> {
    const { data } = await supabase
      .from('helix_recommendations')
      .select('approval_status')
      .eq('operation_id', operationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data?.approval_status === 'APPROVED';
  }
}

export const approvalGate = new ApprovalGate();
```

**Time: 3 hours**

### Day 3-4: Feature Toggles (Safety) (~100 lines)

**File:** `src/helix/ai-operations/feature-toggles.ts`

```typescript
import { supabase } from '@/lib/supabase';

class FeatureToggleError extends Error {
  constructor(message: string, public toggle: string) {
    super(message);
  }
}

export class FeatureToggles {
  private cache: Map<string, boolean> = new Map();

  async isEnabled(toggleName: string): Promise<boolean> {
    // Check cache
    if (this.cache.has(toggleName)) {
      return this.cache.get(toggleName)!;
    }

    // Fetch from DB
    const { data } = await supabase
      .from('feature_toggles')
      .select('enabled, locked')
      .eq('toggle_name', toggleName)
      .single();

    if (!data) {
      throw new FeatureToggleError(`Toggle ${toggleName} not found`, toggleName);
    }

    this.cache.set(toggleName, data.enabled);
    return data.enabled;
  }

  async enforce(toggleName: string): Promise<void> {
    const { data } = await supabase
      .from('feature_toggles')
      .select('enabled, locked')
      .eq('toggle_name', toggleName)
      .single();

    if (!data) {
      throw new FeatureToggleError(`Toggle ${toggleName} not found`, toggleName);
    }

    // Locked toggles cannot be bypassed
    if (data.locked && !data.enabled) {
      throw new FeatureToggleError(
        `Toggle ${toggleName} is locked for safety. Contact admin.`,
        toggleName
      );
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const featureToggles = new FeatureToggles();
```

**Time: 2 hours**

### Day 4-5: Admin Dashboard (Web UI)

**Files:**
- `web/src/admin/dashboard.tsx` - Tier 1: Observability (~300 lines)
- `web/src/admin/controls.tsx` - Tier 2: Control (~400 lines)
- `web/src/admin/intelligence.tsx` - Tier 3: Helix Recs (~300 lines)

**Time: 12-16 hours**

---

## WEEK 2: Testing & Deployment

### Day 1: Unit Tests (~400 lines)

**File:** `src/helix/ai-operations/ai-operations.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { router } from './router';
import { costTracker } from './cost-tracker';
import { approvalGate } from './approval-gate';

describe('AI Operations Router', () => {
  it('routes chat to deepseek by default', async () => {
    const decision = await router.route({
      operationId: 'chat_message',
      input: { message: 'hello' }
    });
    expect(decision.model).toBe('deepseek');
  });

  it('routes memory_synthesis to gemini_flash', async () => {
    const decision = await router.route({
      operationId: 'memory_synthesis',
      input: { data: 'test' }
    });
    expect(decision.model).toBe('gemini_flash');
  });

  it('enforces cost budget', async () => {
    // Setup user with $1 daily budget
    // Log $1.50 worth of operations
    // Expect 3rd operation to throw
    expect(async () => {
      await router.route({
        operationId: 'chat_message',
        user: 'test_user'
      });
    }).rejects.toThrow('Daily budget exceeded');
  });

  it('tracks operations in database', async () => {
    await costTracker.logOperation('test_user', {
      operationType: 'chat_message',
      modelUsed: 'deepseek',
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.0015,
      latencyMs: 423,
      success: true
    });

    const spend = await costTracker.getDailySpend('test_user');
    expect(spend).toBeGreaterThan(0);
  });

  it('respects feature toggles', async () => {
    // When helix_can_change_models is locked and disabled
    // Helix cannot route to different models
    expect(async () => {
      await featureToggles.enforce('helix_can_change_models');
    }).rejects.toThrow();
  });
});

describe('Cost Tracker', () => {
  // 10+ tests for cost tracking accuracy
});

describe('Approval Gate', () => {
  // 5+ tests for approval workflow
});
```

**Time: 6 hours**

### Day 2: Integration Tests (~200 lines)

- Full workflow: Route → Execute → Log → Track
- Cost budget enforcement
- Approval gate blocking
- Feature toggle enforcement

**Time: 4 hours**

### Day 3: Performance Tests

- Router latency < 10ms
- Cost calculation accuracy
- Cache hit rates
- Database query performance

**Time: 3 hours**

### Day 4-5: Deployment & Monitoring

- Deploy to staging
- Run full test suite
- Validate cost tracking against actual API bills
- Set up monitoring dashboards
- Train Rodrigo on admin UI
- Document operational procedures

**Time: 8 hours**

---

## Summary: Phase 0.5 Deliverables

### Code (Total: ~2,500 lines)
```
Database Schema:         ~300 lines (SQL)
Router:                  ~300 lines (TS)
Cost Tracker:            ~150 lines (TS)
Approval Gate:           ~200 lines (TS)
Feature Toggles:         ~100 lines (TS)
Migration (10 files):    ~400 lines (TS)
Tests:                   ~600 lines (TS)
Admin Dashboard:         ~900 lines (React/TS)
───────────────────────────────────────
TOTAL:                   ~2,850 lines
```

### Outcomes
✅ All 10 AI operations unified under one router
✅ Every AI call logged and tracked
✅ Cost transparency (real-time dashboard)
✅ Approval gates for margin-impacting decisions
✅ Hardcoded safety toggles Helix cannot bypass
✅ Admin panel (Tiers 1-3) fully functional
✅ Ready for Phase 0 orchestration

### Effort Estimate
- **Total: 60-75 hours (2-3 weeks with 1 engineer)**
- Database: 1 day
- Router/Core: 3 days
- Integration: 3-4 days
- Admin UI: 3-4 days
- Testing: 2 days
- Deployment: 2 days

---

## Next: Phase 0 (Orchestration Foundation)

Once Phase 0.5 complete, begin Phase 0:
- Conductor loop (autonomous operation)
- Context formatter (consciousness loading)
- Goal evaluator (achievement detection)
- Model spawning (DeepSeek + Gemini Flash)
- Discord logging integration

This builds on Phase 0.5's unified routing to add orchestration logic.

