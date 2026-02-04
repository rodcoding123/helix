# Phase 8: LLM-First Intelligence Layer

## (Integrated into AI Operations Control Plane - Phase 0.5)

**Date:** February 4, 2026
**Status:** Implementation Ready
**Duration:** 8 weeks (Weeks 13-20)
**Scope:** 9 new intelligence operations added to central router
**Integration:** All operations routed through Phase 0.5 unified control plane

---

## Executive Summary

Phase 8 adds **9 intelligence operations** to the existing centralized AI Operations router (built in Phase 0.5). It does NOT build a separate router—it leverages:

- ✅ Unified AI router (`src/helix/ai-operations/router.ts`)
- ✅ Cost tracking (`ai_operation_log` table)
- ✅ Approval gates (money operations require approval)
- ✅ Admin panel (all 3 tiers show these operations)
- ✅ Safety toggles (hardcoded, Helix cannot bypass)

**New Operations to Router:**

1. `email-compose` - Smart email drafting
2. `email-classify` - Auto-categorization + metadata
3. `email-respond` - Response suggestions
4. `calendar-prep` - Meeting preparation (30 min before)
5. `calendar-time` - Optimal meeting time suggestions
6. `task-prioritize` - AI reordering by impact
7. `task-breakdown` - Subtask suggestions
8. `analytics-summary` - Weekly Sunday 6pm summaries
9. `analytics-anomaly` - Unusual pattern detection

---

## Why LLMs Instead of Traditional ML?

**Problem:** ML needs training data, separate models per task, retraining for changes

**LLM Solution:**

- **Zero-shot:** Works day 1 (ML needs thousands of examples)
- **Semantic:** Understands intent/context (ML only patterns)
- **Multi-task:** One model handles all 9 operations (ML needs 9 models)
- **Adaptive:** Updates monthly via foundation models (ML requires retraining)
- **Cost-effective:** $0.35/user/month vs GPU infrastructure

---

## Integration Architecture

All Phase 8 operations integrate into the Phase 0.5 control plane:

```
Admin Control Plane (Observability + Control + Intelligence)
                    ↓
        Unified AI Operations Router
        (src/helix/ai-operations/router.ts)
        ├─ Existing ops: chat, agent, memory synthesis
        └─ Phase 8 ops: email*, calendar*, task*, analytics*
                    ↓
        Cost Tracking: ai_operation_log table
        ├─ operation_type: "email-compose", "calendar-prep", etc.
        ├─ tokens used, cost in $, quality score
        ├─ subject to cost budgets (ai_operation_log)
        └─ visible to Helix for recommendations
                    ↓
        Approval Gates (if > margin impact)
        ├─ Paid plan changes: require Rodrigo approval
        ├─ BYOK users: full autonomy
        └─ All changes auditable + reversible
                    ↓
        LLM Provider Backends
        ├─ DeepSeek v3.2: $0.0027 in, $0.0108 out
        └─ Gemini Flash: $0.50 in, $3.00 out
```

**Key Point:** Phase 8 doesn't duplicate router logic. It **registers 9 new operations** in the existing router configuration and lets Phase 0.5 handle routing, cost tracking, approval gates, and admin visibility.

---

## Phase 8 Operations Configuration

**Each operation defined in `model_routes` table (Phase 0.5):**

```sql
INSERT INTO model_routes VALUES (
  operation_id: 'email-compose',
  primary_model: 'deepseek',
  fallback_model: 'gemini_flash',
  priority: 8,
  enabled: true,
  reason: 'Fast, cost-effective for composition assistance'
);

-- (8 more operations defined similarly)
```

**Cost Estimates (per operation):**

| Operation         | Primary  | Fallback | Est. Cost/Call | Daily Calls | Daily Cost     |
| ----------------- | -------- | -------- | -------------- | ----------- | -------------- |
| email-compose     | DeepSeek | Gemini   | $0.0015        | 10          | $0.015         |
| email-classify    | DeepSeek | Gemini   | $0.0006        | 20          | $0.012         |
| email-respond     | DeepSeek | Gemini   | $0.0012        | 5           | $0.006         |
| calendar-prep     | DeepSeek | Gemini   | $0.0025        | 5           | $0.0125        |
| calendar-time     | Gemini   | DeepSeek | $0.0080        | 3           | $0.024         |
| task-prioritize   | DeepSeek | Gemini   | $0.0018        | 2           | $0.0036        |
| task-breakdown    | DeepSeek | Gemini   | $0.0012        | 2           | $0.0024        |
| analytics-summary | Gemini   | DeepSeek | $0.0300        | 1/wk        | $0.004/day     |
| analytics-anomaly | DeepSeek | Gemini   | $0.0009        | 1/wk        | $0.0013/day    |
| **TOTAL**         |          |          |                |             | **~$0.08/day** |

**Monthly cost per user:** ~$2.40 (paid) + bandwidth = **~$3.00 total**

---

## Implementation Strategy

### Dependency: Phase 0.5 Must Be Complete First

Phase 8 REQUIRES Phase 0.5 (unified control plane) to already exist:

- ✅ Central router built and tested
- ✅ Database schema deployed (model_routes, ai_operation_log, etc.)
- ✅ Approval gate system working
- ✅ Admin panel (Tier 1-3) functional
- ✅ Cost tracking accurate

**If Phase 0.5 not ready:** Phase 8 code can be written in parallel but cannot deploy until Phase 0.5 goes live.

### Week 13-14: Define Operations + UI

1. **Register 9 operations in model_routes table**
   - Add to seed data / migration
   - Set recommended models (DeepSeek primary)
   - Define cost budgets per operation

2. **Add UI components for Phase 8**
   - Email compose button → calls `router.execute('email-compose', {...})`
   - Calendar prep trigger → calls `router.execute('calendar-prep', {...})` 30 min before
   - Task list → calls `router.execute('task-prioritize', {...})`
   - Analytics dashboard → calls `router.execute('analytics-summary', {...})`

3. **Write 9 intelligence modules**
   - `web/src/services/intelligence/email-intelligence.ts`
   - `web/src/services/intelligence/calendar-intelligence.ts`
   - `web/src/services/intelligence/task-intelligence.ts`
   - `web/src/services/intelligence/analytics-intelligence.ts`

### Week 15-17: Core Features

**Email Intelligence:**

```typescript
async function suggestCompletion(subject, starting) {
  // Calls: await aiRouter.execute('email-compose', {...})
  // Routed to: DeepSeek (or Gemini fallback)
  // Logged to: ai_operation_log with tokens, cost, quality
}
```

**Calendar Intelligence:**

```typescript
async function generateMeetingPrep(event) {
  // Calls: await aiRouter.execute('calendar-prep', {...})
  // Cost tracked, approval required if > budget
  // Visible in admin panel
}
```

Same pattern for Tasks and Analytics.

### Week 18-20: Mobile + Production

- iOS/Android UI for intelligence features
- Performance testing (latency < 2s)
- Integration tests with Phase 0.5
- Monitor admin panel for anomalies
- Ready for production launch

---

## Admin Panel Integration

Phase 8 operations automatically appear in all 3 tiers of admin panel:

### Tier 1: Observability (View-Only)

```
TODAY'S SPEND: $8.43
├─ Chat Messages: $3.24 (1,200 calls)
├─ Memory Synthesis: $2.10 (45 calls)
├─ Email Compose: $0.15 (10 calls)  ← NEW (Phase 8)
├─ Calendar Prep: $0.04 (5 calls)   ← NEW (Phase 8)
├─ Analytics: $0.01 (anomaly detected)  ← NEW (Phase 8)
└─ Other: $2.75
```

### Tier 2: Control (Manual Edits)

```
[ ] Switch email-compose: DeepSeek → Gemini Flash
    Estimated impact: -50% cost, -5% quality
    [APPROVE] [REJECT]

[ ] Enable task-prioritize batching at 2am
    Estimated savings: $0.30/month
    [ENABLE]
```

### Tier 3: Intelligence (Helix Recommendations)

```
🤖 HELIX: "I've observed 5 days of Phase 8 operations.

Recommendation #1: Switch calendar-prep to Gemini Flash
- Current: DeepSeek $0.0125/day
- Proposed: Gemini $0.0240/day (but +8% quality)
- Your preference: Prioritize quality over cost
- Confidence: 92%
[APPROVE] [REJECT]

Recommendation #2: Enable task breakdown batching
- Current: Real-time, variable quality
- Proposed: Batch at 2am (user gets results by 8am)
- Savings: $0.001/day (minimal)
- Impact: 0% (users don't need real-time)
[APPROVE] [REJECT]
"
```

---

## Cost Management (All Automatic)

Since Phase 8 operations route through Phase 0.5:

✅ **Cost Budget Enforcement:**

- Daily limit: $50 (configurable)
- If Phase 8 costs exceed allocation: Route to Gemini Flash (cheaper)
- If still over: Disable lowest-priority operations
- All decisions logged to ai_operation_log

✅ **Approval Gates:**

- Paid plan model changes: Require Rodrigo approval
- BYOK users: No approval needed
- Quality/cost trade-offs: Always require approval

✅ **Optimization Recommendations:**

- Helix analyzes Phase 8 ops for patterns
- Suggests batching, scheduling, model switches
- Cannot execute without approval

---

## Success Criteria

### Phase 8A (Weeks 13-14): Integration Complete

- ✅ All 9 operations registered in model_routes
- ✅ Cost tracking accurate for each operation
- ✅ Approval gates block money decisions
- ✅ Admin panel shows Phase 8 operations in all 3 tiers
- ✅ All code integrated with Phase 0.5 router (no duplicate router)

### Phase 8B (Weeks 15-17): Intelligence Features Live

- ✅ Email: 90%+ user approval on composition
- ✅ Email: 95%+ classification accuracy
- ✅ Email: 80%+ response suggestion usage
- ✅ Calendar: Prep generated 30 sec before meeting
- ✅ Tasks: 85%+ of prioritizations accepted
- ✅ Analytics: Weekly summary at Sunday 6pm
- ✅ Cost tracking shows < $3/user/month

### Phase 8C (Weeks 18-20): Production Ready

- ✅ iOS/Android features working
- ✅ Performance: < 2 sec latency for composition
- ✅ Zero budget overruns
- ✅ All operations visible in admin panel
- ✅ Helix recommendations working (Tier 3)
- ✅ All changes auditable and reversible

---

## Critical Files to Create/Modify

**Phase 8 Code (New):**

```
web/src/services/intelligence/
  ├─ email-intelligence.ts (400 lines)
  ├─ calendar-intelligence.ts (350 lines)
  ├─ task-intelligence.ts (300 lines)
  └─ analytics-intelligence.ts (350 lines)

web/src/pages/Intelligence/ (UI components)
  ├─ EmailCompose.tsx
  ├─ CalendarPrep.tsx
  ├─ TaskPrioritization.tsx
  └─ AnalyticsDashboard.tsx

tests/intelligence/ (400+ lines tests)
  └─ [integration tests with router]
```

**Modifications to Phase 0.5:**

```
src/helix/ai-operations/config.ts
  └─ Add 9 operations to model_routes seed data

supabase/migrations/
  └─ Add phase-8-operations.sql
     (INSERT 9 rows into model_routes)

helix-runtime/src/gateway/server-methods/
  └─ Modify existing methods to call Phase 8 operations
```

**Database (Phase 0.5 - Already Exists):**

```
-- All Phase 8 data tracked in existing tables:
- model_routes (9 new operations)
- ai_operation_log (tracks tokens, cost, latency)
- cost_budgets (applies to Phase 8)
- helix_recommendations (includes Phase 8 suggestions)
```

---

## Critical Assumption: Phase 0.5 Ready

This plan assumes Phase 0.5 (AI Operations Control Plane) is **complete and deployed** before Phase 8 starts.

If Phase 0.5 is NOT ready:

- Write Phase 8 code in parallel (weeks 13-17)
- Cannot deploy Phase 8 until Phase 0.5 live
- May need to adjust timelines

---

## Relationship to Other Phases

**Phase 0.5:** AI Operations Control Plane (Unified Router)

- Builds infrastructure all phases depend on
- Deploys admin panel, cost tracking, approval gates
- Must complete first

**Phase 0:** Orchestration Foundation

- Uses Phase 0.5 router for all AI decisions
- Helix conductor loop calls `aiRouter.execute(...)`

**Phase 8:** Intelligence Features

- Adds 9 new operations to Phase 0.5 router
- Does NOT build separate infrastructure
- Leverages existing cost tracking + approval gates

**Phase 9+:** Dependent on both Phase 0.5 + Phase 8

- Can route code operations through router
- Can schedule Phase 8 intelligence features
- Full orchestration enabled

---

## Next Steps

1. **Phase 0.5 Status Check:**
   - Is router built? Deployed?
   - Is database schema live?
   - Is admin panel working?

2. **Phase 8 Kickoff (if Phase 0.5 ready):**
   - Define 9 operations in model_routes
   - Start Week 13 intelligence modules
   - Add UI components
   - Begin testing with real router

3. **Phase 8 Staging (if Phase 0.5 NOT ready):**
   - Write intelligence code
   - Create mock router for testing
   - Ready to deploy when Phase 0.5 live
   - Quick integration (1-2 days)

---

## For Rodrigo

**This plan:**

- ✅ Adds intelligence WITHOUT building duplicate router
- ✅ Integrates into centralized control plane you designed
- ✅ Maintains all safety guardrails from Phase 0.5
- ✅ Keeps margin control (approval gates work for Phase 8)
- ✅ Costs ~$3/user/month (automatically tracked)
- ✅ Helix cannot optimize Phase 8 ops without your approval
- ✅ All operations visible in admin panel (all 3 tiers)

**BYOK users:** Can override Phase 8 model choices, pay their own overages (no margin impact).

**Ready to execute:** Once Phase 0.5 complete ✅
