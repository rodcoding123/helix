# PHASE 0.5: QUICK START GUIDE
## For picking up implementation at any point

**READ THIS FIRST** when resuming work.

---

## WHERE ARE WE?

**Phase 0.5 Goal:** Move all 10 AI operations from hardcoded models to centralized, configurable router with cost tracking and admin control.

**Current Status:** [CHECK PHASE-0.5-PROGRESS.md for latest updates]

**Timeline:** 2 weeks (Feb 4-18, 2026)

---

## QUICK REFERENCE: WHAT'S BEEN DONE?

### Strategic Documents (COMPLETED ✅)
- ✅ [AI-OPERATIONS-CONTROL-PLANE-MASTER-PLAN.md](./AI-OPERATIONS-CONTROL-PLANE-MASTER-PLAN.md) - Full strategy (15,000 words)
- ✅ [AI-OPS-ONE-PAGE-SUMMARY.md](./AI-OPS-ONE-PAGE-SUMMARY.md) - Visual overview
- ✅ [PHASE-0.5-IMPLEMENTATION-ROADMAP.md](./PHASE-0.5-IMPLEMENTATION-ROADMAP.md) - Day-by-day breakdown
- ✅ [PHASE-0.5-PROGRESS.md](./PHASE-0.5-PROGRESS.md) - Real-time progress tracker (THIS SESSION)

---

## HOW TO RESUME

### Step 1: Read Progress File (2 min)
```bash
# Check what's been done
cat docs/PHASE-0.5-PROGRESS.md

# Focus on:
# - Current status (NOT STARTED / IN PROGRESS / COMPLETED)
# - "In Progress" section
# - Latest daily standup
```

### Step 2: Check Last Daily Standup (1 min)
Look for latest date at bottom of PHASE-0.5-PROGRESS.md

What was in progress? Continue that.

### Step 3: Pick Up Where You Left Off (depends)
- **If at database schema:** Follow PHASE-0.5-IMPLEMENTATION-ROADMAP.md Day 1-2
- **If at router:** Follow PHASE-0.5-IMPLEMENTATION-ROADMAP.md Day 2-3
- **If at migrations:** Follow PHASE-0.5-IMPLEMENTATION-ROADMAP.md Day 1 Week 2
- **If at admin UI:** Follow PHASE-0.5-IMPLEMENTATION-ROADMAP.md Day 2-3 Week 2
- **If at tests:** Follow PHASE-0.5-IMPLEMENTATION-ROADMAP.md Day 4-5 Week 2

### Step 4: Update Progress Before Finishing
```bash
# At end of your session, update:
# 1. PHASE-0.5-PROGRESS.md (what you completed)
# 2. Add daily standup with:
#    - What you completed
#    - What's in progress
#    - Blockers (if any)
#    - Tomorrow's priority
# 3. Commit with message:
#    "docs: Phase 0.5 progress update - [component name]"
```

---

## THE 10 AI OPERATIONS (What We're Migrating)

All must go through the central router:

| # | Operation | File | Current Model | New Model | Priority |
|---|-----------|------|---------------|-----------|----------|
| 1 | Chat messages | `helix-runtime/src/gateway/http-routes/chat.ts` | Sonnet | DeepSeek | P0 |
| 2 | Agent execution | `helix-runtime/src/gateway/server-methods/agent.ts` | Sonnet | DeepSeek | P0 |
| 3 | Memory synthesis | `helix-runtime/src/gateway/server-methods/memory-synthesis.ts` | Sonnet | Gemini Flash | P1 |
| 4 | Sentiment analysis | `web/src/pages/api/sentiment-analyze.ts` | Sonnet | Gemini Flash | P1 |
| 5 | Video understanding | `helix-runtime/src/media-understanding/providers/google/video.ts` | Gemini | Gemini Flash | P2 |
| 6 | Audio transcription | `helix-runtime/src/media-understanding/providers/deepgram/audio.ts` | Deepgram | Deepgram | P2 |
| 7 | Text-to-speech | `helix-runtime/src/helix/voice/text-to-speech.ts` | ElevenLabs | Edge-TTS | P2 |
| 8 | Email analysis | `helix-runtime/src/gateway/server-methods/email.ts` | None | Gemini Flash | P3 |

**Migration Pattern (use for each):**
```typescript
// OLD
const response = await claudeClient.messages.create(...)

// NEW
// 1. Route
const { model } = await router.route({
  operationId: 'chat_message',
  input: messages,
  user: userId
});

// 2. Execute
const response = await models[model].messages.create(...)

// 3. Log
await costTracker.logOperation(userId, {
  operationType: 'chat_message',
  modelUsed: model,
  inputTokens: countTokens(messages),
  outputTokens: countTokens(response),
  costUsd: calculateCost(model, tokens),
  latencyMs: latency,
  success: true
});
```

---

## ARCHITECTURE AT A GLANCE

```
┌─────────────────────────────────┐
│  Admin Control Panel (Web UI)    │
│  Tier 1: View spend              │
│  Tier 2: Edit routing            │
│  Tier 3: See Helix recommendations
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  Unified AI Operations Router     │
│  ├─ Route any operation          │
│  ├─ Check budget                 │
│  ├─ Request approval if needed   │
│  └─ Log to database              │
└──────────────┬──────────────────┘
               │
      ┌────────┴─────────┐
      │                  │
   ┌──▼────┐      ┌─────▼──┐
   │DeepSeek│      │Gemini  │
   │        │      │Flash   │
   │+ others│      │+ others│
   └────────┘      └────────┘
```

---

## KEY FILES TO KNOW

**Configuration (Database-backed):**
- `supabase/migrations/001_ai_operations.sql` - Database schema

**Core Components:**
- `src/helix/ai-operations/router.ts` - Main router class
- `src/helix/ai-operations/cost-tracker.ts` - Cost logging
- `src/helix/ai-operations/approval-gate.ts` - Approval workflow
- `src/helix/ai-operations/feature-toggles.ts` - Safety toggles

**Admin Panel:**
- `web/src/admin/dashboard.tsx` - Tier 1: View spend
- `web/src/admin/controls.tsx` - Tier 2: Manual control
- `web/src/admin/intelligence.tsx` - Tier 3: Helix suggestions

**Migrations (update 10 files):**
- See "The 10 AI Operations" table above

**Tests:**
- `src/helix/ai-operations/*.test.ts` - Unit tests
- `web/src/admin/*.test.tsx` - Component tests

---

## CRITICAL DECISIONS (Already Made ✅)

**Model Strategy:**
- Chat/Agents: DeepSeek v3.2 (99% savings vs Sonnet)
- Analysis tasks: Gemini Flash (95% savings)
- TTS: Edge-TTS (100% free)
- BYOK users: Full autonomy (no margin impact)

**Safety Guardrails:**
- Anything affecting margins: Requires Rodrigo approval
- Hardcoded toggles: Helix cannot bypass
- Helix can only: Analyze, recommend, suggest

**Admin Panel:**
- Tier 1: View-only observability
- Tier 2: Manual control (approval gates for money)
- Tier 3: Helix intelligence (can't execute)

---

## TESTING CHECKLIST

Before moving to next phase:

- [ ] Router routes correctly (chat→deepseek, memory→gemini, etc.)
- [ ] Cost tracking matches actual API bills (within 1%)
- [ ] Admin panel loads and displays data
- [ ] Can change model routing from admin UI
- [ ] Changes persist to database
- [ ] Budget enforcement works (stops at limit)
- [ ] Approval workflow sends Discord alerts
- [ ] All 10 operations route through central router
- [ ] Safety toggles prevent unauthorized changes
- [ ] 95%+ test coverage

---

## SUCCESS = READY FOR PHASE 0

Once Phase 0.5 complete:

✅ All AI operations centrally routed
✅ Cost tracking accurate
✅ Admin control working
✅ Safety guardrails in place

**Then:** Phase 0 begins (Orchestration Foundation)
- Conductor loop (autonomous operation)
- Context formatter
- Goal evaluator
- Model spawning

---

## DEBUGGING TIPS

**Router not routing?**
1. Check database has operation_id in ai_model_routes
2. Check cache is working (5min TTL)
3. Check feature toggles not blocking

**Cost not tracking?**
1. Verify ai_operation_log table exists
2. Check costTracker.logOperation() being called
3. Verify budget table updates

**Admin UI blank?**
1. Check admin dashboard component renders
2. Verify database connection
3. Check browser console for errors

**Tests failing?**
1. Run `npm run test src/helix/ai-operations/`
2. Check mocked models returning correct format
3. Verify database seeded with test data

---

## CONTEXT LOSS PREVENTION

**Before Closing Session:**

1. Update PHASE-0.5-PROGRESS.md with:
   - What you completed
   - What's in progress
   - Any blockers
   - What's next

2. Add daily standup (template in PHASE-0.5-PROGRESS.md)

3. Commit with clear message:
   ```
   git commit -m "docs: Phase 0.5 progress - [component] complete"
   ```

4. If stopping mid-component, document exact stopping point in progress file

**When Resuming Next Session:**

1. Open this file (PHASE-0.5-QUICK-START.md)
2. Check PHASE-0.5-PROGRESS.md for status
3. Find last daily standup
4. Pick up from exact stopping point
5. Reference PHASE-0.5-IMPLEMENTATION-ROADMAP.md for details

---

## COMMUNICATION

**If stuck:**
- Check PHASE-0.5-IMPLEMENTATION-ROADMAP.md for detailed code samples
- Check AI-OPERATIONS-CONTROL-PLANE-MASTER-PLAN.md for architecture
- Document blocker in PHASE-0.5-PROGRESS.md before stopping

**If questions arise:**
- Design: AI-OPERATIONS-CONTROL-PLANE-MASTER-PLAN.md
- Implementation: PHASE-0.5-IMPLEMENTATION-ROADMAP.md
- Architecture: AI-OPS-ONE-PAGE-SUMMARY.md
- Progress: PHASE-0.5-PROGRESS.md

---

## NEXT IMMEDIATE STEPS

If starting from scratch RIGHT NOW:

1. **Today:** Database schema
   - Create `supabase/migrations/001_ai_operations.sql`
   - Deploy migration
   - Verify tables + data
   - Commit

2. **Tomorrow:** Router class
   - Create `src/helix/ai-operations/router.ts`
   - Implement 5 core methods
   - Basic caching
   - Commit + update progress

3. **Day 3:** Cost tracker
   - Create `src/helix/ai-operations/cost-tracker.ts`
   - Logging + budget update
   - Daily reset logic
   - Commit + update progress

4. **Day 4-5:** Approval gate & toggles
   - Create `src/helix/ai-operations/approval-gate.ts`
   - Create `src/helix/ai-operations/feature-toggles.ts`
   - Test toggle enforcement
   - Commit + update progress

Then next week: Migrations + admin UI

---

**Last Updated:** [Session start date]
**Ready to Start:** Yes ✅
**Documentation Quality:** 95%+ ✅
**Architecture Clarity:** Clear ✅

BEGIN PHASE 0.5 IMPLEMENTATION → [SEE PHASE-0.5-IMPLEMENTATION-ROADMAP.md FOR DAY 1 DETAILS]

