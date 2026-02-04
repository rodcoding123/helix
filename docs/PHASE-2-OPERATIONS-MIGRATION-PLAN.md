# Phase 2: Operations Migration - Complete Implementation Plan

**Date:** 2026-02-05
**Status:** READY FOR IMPLEMENTATION
**Target:** Migrate remaining 5 AI operations to centralized router
**Duration:** Week 2 (after Phase 0.5 staging validation)

---

## Executive Summary

Phase 2 migrates the remaining 5 AI operations to use the centralized AIOperationRouter, CostTracker, and ApprovalGate infrastructure established in Phase 0.5. These operations vary in complexity:

- **P2 Priority (Week 2):** 4 operations (agent.ts, video.ts, audio.ts, tts.ts)
- **P3 Priority (Week 3):** 1 operation (email.ts)

All operations follow the proven migration pattern established by chat.ts, memory-synthesis.ts, and sentiment-analyze.ts.

---

## Operations to Migrate

### Priority 1: HIGH Criticality

#### 1. **agent_execution** (COMPLEX orchestration) 📋

- **File:** `src/helix/ai-operations/agent.ts`
- **Current:** Hardcoded Claude Opus orchestration
- **Model:** DeepSeek (cost-optimized)
- **Cost Criticality:** HIGH
- **Complexity:** COMPLEX (command execution orchestration)
- **Effort:** 4-5 hours
- **Pattern:** Complex - needs approval gate for safety-critical operations
- **Key Challenge:** Integrates with command execution layer

#### 2. **video_understanding** (Provider-level routing) 🎬

- **File:** `helix-runtime/src/media-understanding/providers/google/video.ts`
- **Current:** Direct Gemini Video API calls
- **Model:** Gemini Flash
- **Cost Criticality:** MEDIUM
- **Complexity:** MEDIUM (provider abstraction)
- **Effort:** 3-4 hours
- **Pattern:** Provider-level routing (add routing metadata to provider)
- **Key Challenge:** Video frame handling and token estimation

#### 3. **audio_transcription** (Provider-level routing) 🎙️

- **File:** `helix-runtime/src/media-understanding/providers/deepgram/audio.ts`
- **Current:** Direct Deepgram API calls
- **Model:** Deepgram
- **Cost Criticality:** MEDIUM
- **Complexity:** MEDIUM (provider abstraction)
- **Effort:** 3-4 hours
- **Pattern:** Provider-level routing (same as video)
- **Key Challenge:** Audio stream handling

#### 4. **text_to_speech** (Provider-level routing) 🔊

- **File:** `helix-runtime/src/helix/voice/text-to-speech.ts`
- **Current:** Direct Edge-TTS calls
- **Model:** Edge-TTS
- **Cost Criticality:** LOW
- **Complexity:** LOW (simple provider)
- **Effort:** 2-3 hours
- **Pattern:** Provider-level routing (simplest case)
- **Key Challenge:** Simple payload, but need character counting for cost

### Priority 2: LOW Criticality (Week 3)

#### 5. **email_analysis** (Server-method routing) 📧

- **File:** `src/helix/gateway/server-methods/email.ts`
- **Current:** Hardcoded Gemini Flash
- **Model:** Gemini Flash
- **Cost Criticality:** LOW
- **Complexity:** LOW (server method)
- **Effort:** 2-3 hours
- **Pattern:** Server-method routing (similar to sentiment-analyze)
- **Key Challenge:** Email content size handling

---

## Migration Pattern Reference

### Standard Pattern (From Phase 0.5)

```typescript
// 1. Import router components
import { router } from '../../../helix/ai-operations/router.js';
import { costTracker } from '../../../helix/ai-operations/cost-tracker.js';
import { approvalGate } from '../../../helix/ai-operations/approval-gate.js';

// 2. Route through centralized router
const routingDecision = await router.route({
  operationId: 'operation_name',
  userId,
  input: [{ role: 'user' as const, content: prompt }],
  estimatedInputTokens,
});

// 3. Check approval requirements
if (routingDecision.requiresApproval) {
  await approvalGate.requestApproval(
    'operation_id',
    'Human Readable Name',
    routingDecision.estimatedCostUsd,
    'Request details'
  );
}

// 4. Execute with routed model
const modelClient = getModelClientForOperation(routingDecision.model);
const response = await modelClient.messages.create({
  model: getModelIdForRoute(routingDecision.model),
  messages: input,
  max_tokens: 1024,
});

// 5. Track cost
const costUsd = router['estimateCost'](routingDecision.model, estimatedInputTokens, outputTokens);

await costTracker.logOperation(userId, {
  operation_type: 'operation_name',
  operation_id: 'operation_name',
  model_used: routingDecision.model,
  user_id: userId,
  input_tokens: estimatedInputTokens,
  output_tokens: outputTokens,
  cost_usd: costUsd,
  latency_ms: totalLatency,
  quality_score: 0.85,
  success: true,
});
```

---

## Implementation Order

### Week 2: Phase 2 Main (4 operations)

**Day 1-2: Complex Operations**

1. Agent Execution (4-5 hours)
   - Hardest due to command execution orchestration
   - Needs thorough testing
   - High priority due to cost criticality

**Day 2-3: Provider-Level Routing** 2. Video Understanding (3-4 hours) 3. Audio Transcription (3-4 hours) 4. Text-to-Speech (2-3 hours)

- Similar patterns, faster to implement
- Test in parallel

**Day 4: Integration & Validation**

- Run full integration tests
- Verify all 8 operations routed correctly
- Total cost calculation accuracy
- Admin dashboard showing all operations

### Week 3: Phase 2 Extended (1 operation)

**Day 1: Low Priority** 5. Email Analysis (2-3 hours)

- Can be done after main Phase 2 validation
- Low cost impact

---

## Task Breakdown

### Task 1: Migrate agent_execution (COMPLEX)

**Files to Modify:**

- `src/helix/ai-operations/agent.ts` (new)
- `src/helix/types.ts` (add AgentExecutionEntry to hash chain)

**Changes:**

1. Add router imports
2. Extract current Claude Opus model to routing decision
3. Implement command execution wrapper with approval gates
4. Add cost tracking for each command execution
5. Update response metadata with routing info
6. Add comprehensive error handling

**Testing:**

```bash
npm run test -- src/helix/ai-operations/agent.test.ts
# Expect: 20+ tests covering orchestration scenarios
```

**Estimated Time:** 4-5 hours

---

### Task 2: Migrate video_understanding (MEDIUM)

**Files to Modify:**

- `helix-runtime/src/media-understanding/providers/google/video.ts`
- `helix-runtime/src/media-understanding/types.ts`

**Changes:**

1. Add routing decision logic before Gemini call
2. Implement token counting for video frames
3. Add cost calculation for video operations
4. Update provider interface to support routing
5. Add metadata to response

**Token Estimation:**

- Video frames: ~1000 tokens per frame
- Base prompt: ~500 tokens
- Buffer: +20%

**Estimated Time:** 3-4 hours

---

### Task 3: Migrate audio_transcription (MEDIUM)

**Files to Modify:**

- `helix-runtime/src/media-understanding/providers/deepgram/audio.ts`
- `helix-runtime/src/media-understanding/types.ts`

**Changes:**

1. Add routing decision logic
2. Implement token counting for audio duration
3. Add cost tracking per transcription
4. Update provider interface
5. Add metadata to response

**Token Estimation:**

- Audio: ~100 tokens per minute
- Plus output tokens for transcription

**Estimated Time:** 3-4 hours

---

### Task 4: Migrate text_to_speech (LOW)

**Files to Modify:**

- `helix-runtime/src/helix/voice/text-to-speech.ts`
- `src/helix/ai-operations/router.ts` (add model support)

**Changes:**

1. Add routing decision
2. Implement character counting for cost
3. Add cost tracking
4. Update response metadata
5. Simple error handling

**Token Estimation:**

- Characters: ~1 token per 4 characters
- Output: ~100 tokens per minute of speech

**Estimated Time:** 2-3 hours

---

### Task 5: Migrate email_analysis (LOW)

**Files to Modify:**

- `src/helix/gateway/server-methods/email.ts`
- `src/helix/types.ts` (add EmailAnalysisEntry)

**Changes:**

1. Add routing logic (similar to sentiment-analyze)
2. Implement email content token counting
3. Add cost tracking
4. Update response metadata
5. Error handling

**Token Estimation:**

- Email headers: ~100 tokens
- Body: ~1 token per 4 characters
- Analysis: ~500 tokens

**Estimated Time:** 2-3 hours

---

## Success Criteria

Each operation migration succeeds when:

- ✅ Operation routes through AIOperationRouter
- ✅ Cost tracked to Supabase ai_operation_log
- ✅ Approval gates fire for HIGH criticality
- ✅ Response includes \_metadata with routing info
- ✅ 10+ integration tests pass
- ✅ TypeScript compilation clean
- ✅ Pre-commit checks pass
- ✅ Discord alerts fire correctly

---

## Testing Strategy

### Unit Tests (Per Operation)

```bash
npm run test -- src/helix/ai-operations/agent.test.ts
npm run test -- src/helix/ai-operations/video.test.ts
npm run test -- src/helix/ai-operations/audio.test.ts
npm run test -- src/helix/ai-operations/tts.test.ts
npm run test -- src/helix/ai-operations/email.test.ts
```

### Integration Tests

```bash
npm run test -- src/helix/ai-operations/integration.test.ts
# Should show all 8 operations routed correctly
```

### Cost Accuracy Validation

```sql
-- Verify all 8 operations logged with costs
SELECT operation_type, COUNT(*) as count, SUM(cost_usd) as total_cost
FROM ai_operation_log
GROUP BY operation_type
ORDER BY operation_type;
```

---

## Risk Mitigation

### Risk 1: Agent Execution Complexity

- **Mitigation:** Start with agent.ts early, allocate extra time
- **Testing:** Comprehensive test scenarios for command execution

### Risk 2: Provider-Level Routing

- **Mitigation:** Create reusable provider abstraction pattern
- **Testing:** Test video and audio in parallel

### Risk 3: Token Estimation Accuracy

- **Mitigation:** Conservative estimates with +20% buffer
- **Validation:** Compare actual vs estimated costs in staging

### Risk 4: Approval Gate Safety

- **Mitigation:** All HIGH criticality operations require approval
- **Testing:** Test approval workflow for agent.ts

---

## Deployment Checklist

Before deploying Phase 2 to production:

- [ ] All 8 operations route successfully
- [ ] Cost tracking accurate (±1%)
- [ ] 50+ new integration tests passing
- [ ] Total daily cost < $50 (budget limit)
- [ ] No routing errors in 24-hour monitoring
- [ ] Admin dashboard shows all 8 operations
- [ ] Approval gates working for HIGH operations
- [ ] Discord alerts firing correctly
- [ ] Rollback procedures documented

---

## Phase 2 Timeline

| Task               | Start      | Duration | End   | Status     |
| ------------------ | ---------- | -------- | ----- | ---------- |
| Plan & Setup       | Wed Feb 5  | 1h       | 10 AM | 📋 Ready   |
| Agent (COMPLEX)    | Wed Feb 5  | 5h       | 3 PM  | ⏳ Pending |
| Video (MEDIUM)     | Thu Feb 6  | 4h       | 12 PM | ⏳ Pending |
| Audio (MEDIUM)     | Thu Feb 6  | 4h       | 4 PM  | ⏳ Pending |
| TTS (LOW)          | Fri Feb 7  | 3h       | 10 AM | ⏳ Pending |
| Integration Tests  | Fri Feb 7  | 2h       | 12 PM | ⏳ Pending |
| Staging Validation | Fri Feb 7  | 4h       | 4 PM  | ⏳ Pending |
| Email (LOW)        | Mon Feb 10 | 3h       | 10 AM | ⏳ Pending |
| Final Testing      | Mon Feb 10 | 2h       | 12 PM | ⏳ Pending |

**Total Phase 2 Time:** ~28 hours (spread over 2 weeks)

---

## Phase 3 Roadmap (Future)

After Phase 2 validation:

1. **Phase 3a: Model Adapters**
   - Implement actual DeepSeek adapter (currently using Claude placeholders)
   - Implement actual Gemini adapter (currently using Claude placeholders)
   - Real API integration testing

2. **Phase 3b: Advanced Routing**
   - Dynamic model selection based on operation complexity
   - Regional routing for latency optimization
   - Cost-based optimization suggestions

3. **Phase 3c: Production Hardening**
   - Rate limiting per operation
   - Circuit breaker improvements
   - Advanced monitoring and alerting

---

## References

- `PHASE-0.5-PROGRESS.md` - Current implementation status
- `migration-template.ts` - Code pattern reference
- `PHASE-0.5-STAGING-DEPLOYMENT-VERIFICATION.md` - Deployment procedures

---

**Ready to begin Phase 2 implementation? All patterns established. All templates ready.**
