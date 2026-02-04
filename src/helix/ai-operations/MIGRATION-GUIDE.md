# Phase 0.5 Operation Migration Guide

## Quick Reference

This guide explains how to migrate each of the 10 AI operations to use the centralized router.

## The 3-Step Migration Pattern

```typescript
// Step 1: Import router and trackers
import { router } from './router.js';
import { costTracker } from './cost-tracker.js';

// Step 2: Route before executing
const routing = await router.route({
  operationId: 'operation_name',
  userId: currentUserId,
  estimatedInputTokens: inputSize,
});

// Step 3: Log after executing
await costTracker.logOperation(userId, {
  operation_type: 'operation_name',
  operation_id: 'operation_name',
  model_used: routing.model,
  cost_usd: estimatedCost,
  latency_ms: duration,
  success: true,
});
```

## Completed Migrations

### ✅ 1. chat.ts (chat_message)

**File:** `helix-runtime/src/gateway/http-routes/chat.ts`
**Status:** COMPLETE
**Model:** DeepSeek (was: Claude Sonnet)
**Changes:**

- Imported router, costTracker, approvalGate
- Added routing decision before model execution
- Integrated cost tracking with token counting
- Added approval gates for high-cost operations
- Replaced hardcoded `claude-3-5-sonnet-20241022` with dynamic routing

**Key Lines Changed:**

- Line 11-12: Added router imports
- Line 165→: Replaced Anthropic client with router.route()
- Line 190+: Added costTracker.logOperation()

---

## Remaining Migrations

### 2. agent.ts (agent_execution) - P0

**File:** `helix-runtime/src/gateway/server-methods/agent.ts`
**Current Model:** Claude Sonnet (hardcoded in defaults.js)
**Target Model:** DeepSeek

**Where to Look for Model Selection:**

- Line 11: Imports DEFAULT_MODEL from defaults.js
- Check `agents/defaults.js` for model references
- Check `agents/model-selection.js` for resolveConfiguredModelRef()

**Migration Approach:**

1. Add router import at top
2. Find where model is determined (likely in `resolveConfiguredModelRef()`)
3. Wrap model resolution with `router.route()` call
4. Update model name before passing to agent execution
5. Add costTracker.logOperation() in agent completion handler

---

### 3. memory-synthesis.ts (memory_synthesis) - P1

**File:** `helix-runtime/src/gateway/server-methods/memory-synthesis.ts`
**Current Model:** Claude Sonnet
**Target Model:** Gemini Flash

**Migration Steps:**

1. Import router, costTracker
2. Find model initialization
3. Call `router.route({ operationId: 'memory_synthesis', ... })`
4. Use returned model for synthesis
5. Log with costTracker

---

### 4. sentiment-analyze.ts (sentiment_analysis) - P1

**File:** `web/src/pages/api/sentiment-analyze.ts`
**Current Model:** Claude Sonnet
**Target Model:** Gemini Flash

**Pattern:** Simple API endpoint - similar to chat.ts but probably simpler

1. Route operation
2. Execute with routed model
3. Log operation
4. Return result

---

### 5. video.ts (video_understanding) - P1

**File:** `helix-runtime/src/media-understanding/providers/google/video.ts`
**Current Model:** Gemini Vision
**Target Model:** Gemini Flash

**Migration Steps:**

1. Import router
2. Check model selection logic
3. Route to Gemini Flash via router
4. Log operation

---

### 6. audio.ts (audio_transcription) - P2

**File:** `helix-runtime/src/media-understanding/providers/deepgram/audio.ts`
**Current Model:** Deepgram
**Target Model:** Deepgram (no change, but route through control plane)

**Note:** Already uses Deepgram, just add routing for consistency and cost tracking

---

### 7. text-to-speech.ts (text_to_speech) - P2

**File:** `helix-runtime/src/helix/voice/text-to-speech.ts`
**Current Model:** ElevenLabs
**Target Model:** Edge-TTS (100% FREE!)

**This is a significant cost reduction!**

1. Import router
2. Route to edge_tts
3. Execute with Edge-TTS API instead of ElevenLabs
4. Log operation (cost will be $0)

---

### 8. email.ts (email_analysis) - P3

**File:** `helix-runtime/src/gateway/server-methods/email.ts`
**Current Model:** None (new capability)
**Target Model:** Gemini Flash

**This is a new feature**

1. Add email analysis operation
2. Route to Gemini Flash
3. Implement analysis logic
4. Log operation

---

## Cost Savings Summary

| Operation           | Old Model     | New Model     | Estimated Savings     |
| ------------------- | ------------- | ------------- | --------------------- |
| chat_message        | Sonnet        | DeepSeek      | 99% (batch optimized) |
| agent_execution     | Sonnet        | DeepSeek      | 99%                   |
| memory_synthesis    | Sonnet        | Gemini Flash  | 95%                   |
| sentiment_analysis  | Sonnet        | Gemini Flash  | 95%                   |
| video_understanding | Gemini Vision | Gemini Flash  | 80% (faster model)    |
| audio_transcription | Deepgram      | Deepgram      | 0% (no change)        |
| text_to_speech      | ElevenLabs    | Edge-TTS      | 100% (FREE)           |
| email_analysis      | None          | Gemini Flash  | NEW (low cost)        |
| **TOTAL EXPECTED**  | ~$130/month   | ~$30-40/month | **70-75% reduction**  |

---

## Testing Each Migration

For each operation, test:

```typescript
describe('Migration: [OperationName]', () => {
  it('should route to [expected_model]', async () => {
    const routing = await router.route({
      operationId: '[operation_id]',
      userId: 'test-user',
    });
    expect(routing.model).toBe('[expected_model]');
  });

  it('should log operation to database', async () => {
    // Execute operation
    // Verify costTracker.logOperation() was called
    // Verify cost_usd is > 0
  });

  it('should not have hardcoded model references', () => {
    // Check source code for hardcoded model names
    // e.g., 'claude-3', 'gpt-4', 'eleven-labs'
    // These should all go through router
  });

  it('should handle approval gates for high-cost ops', async () => {
    // Check if routing.requiresApproval is true
    // Verify approvalGate.requestApproval() called
  });
});
```

---

## Deployment Order

### Phase 1: Priority P0 (must complete)

- ✅ chat.ts
- [ ] agent.ts

### Phase 2: Priority P1 (should complete)

- [ ] memory-synthesis.ts
- [ ] sentiment-analyze.ts
- [ ] video.ts

### Phase 3: Priority P2-P3 (nice to have)

- [ ] audio.ts
- [ ] text-to-speech.ts
- [ ] email.ts

---

## Common Issues & Solutions

### Issue: "Module not found: router"

**Solution:** Check import path is correct relative to file location

```typescript
// If in helix-runtime/src/gateway/server-methods/:
import { router } from '../../../helix/ai-operations/router.js';

// If in web/src/pages/:
import { router } from '../../helix/ai-operations/router.js';
```

### Issue: "Cannot read property 'create' of undefined"

**Solution:** Model client not initialized. Make sure:

1. Model is returned from router.route()
2. Model client is properly imported
3. Model ID mapping is correct

### Issue: "operationId not found in database"

**Solution:** Ensure operation_id is registered in ai_model_routes table

```sql
INSERT INTO ai_model_routes (operation_id, operation_name, primary_model, fallback_model)
VALUES ('operation_name', 'Operation Display Name', 'deepseek', 'gemini_flash');
```

### Issue: "Cost not tracking"

**Solution:** Verify costTracker.logOperation() is called with all required fields:

- operation_type
- operation_id
- model_used
- cost_usd
- latency_ms
- success

---

## Files Changed Summary

```
helix-runtime/src/gateway/http-routes/
  ✅ chat.ts (COMPLETE)

helix-runtime/src/gateway/server-methods/
  [ ] agent.ts (P0)
  [ ] memory-synthesis.ts (P1)
  [ ] email.ts (P3)

helix-runtime/src/media-understanding/providers/
  [ ] google/video.ts (P1)
  [ ] deepgram/audio.ts (P2)

helix-runtime/src/helix/voice/
  [ ] text-to-speech.ts (P2)

web/src/pages/api/
  [ ] sentiment-analyze.ts (P1)

src/helix/ai-operations/
  ✅ migration-template.ts (reference)
  ✅ router.ts
  ✅ cost-tracker.ts
  ✅ approval-gate.ts
  ✅ feature-toggles.ts
```

---

## Next: Admin Dashboard

After completing 6/8 migrations (P0 + P1), build admin dashboard:

- Tier 1: Observability (view spend, quality, latency)
- Tier 2: Control (change routing, toggle features, set budgets)
- Tier 3: Intelligence (Helix recommendations)

This will unblock final testing and production deployment.
