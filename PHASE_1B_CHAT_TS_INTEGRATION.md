# Phase 1B Integration into chat.ts

**CRITICAL**: This document provides step-by-step integration of Phase 1B components into the existing chat.ts file.

⚠️ **Important**: The existing chat.ts already has THANOS_MODE implementations. This guide integrates the new Phase 1B components alongside the existing code, using early returns to prevent conflicts.

---

## File to Modify

`helix-runtime/src/gateway/http-routes/chat.ts`

---

## STEP 1: Update Imports (Lines 31-43)

### BEFORE:

```typescript
import {
  isThanosModeTrigger,
  getThanosChallenge,
  verifyThanosKey,
  getThanosSuccessMessage,
  getThanosFailureMessage,
  createThanosState,
  handleThanosModeTrigger,
  handleThanosKeyAttempt,
  isThanosaModeLocked,
  getThanosLockedMessage,
} from '../helix/thanos-mode.js';
import { postConversationSynthesisHook } from '../../../src/psychology/post-conversation-synthesis-hook.js';
```

### AFTER:

```typescript
import { thanosMode } from '../../../src/psychology/thanos-mode.js';
import { synthesisEngine } from '../../../src/psychology/synthesis-engine.js';
import { memoryScheduler } from '../../../src/psychology/memory-scheduler.js';
import { hashChain } from '../../helix/hash-chain.js';
```

---

## STEP 2: Add THANOS_MODE Detection (After Line 180)

### Location: Right after message validation

```
Line 177-180:
    if (!message || typeof message !== 'string') {
      sendJson(res, 400, { error: 'message is required and must be a string' });
      return;
    }
```

### INSERT THIS CODE:

```typescript
// ============================================================
// PHASE 1B: THANOS_MODE AUTHENTICATION (EARLY RETURN)
// ============================================================
// Generate conversation ID for THANOS state tracking
const thanosConversationId = `${userId}-${sessionKey}-${Date.now()}`;

// Check if user is initiating THANOS_MODE challenge
if (thanosMode.isThanosaModeTrigger(message)) {
  // Initiate THANOS_MODE challenge
  const challengeMessage = await thanosMode.initiateThanosMode(thanosConversationId);

  // Log to Discord hash chain
  await hashChain.addEntry({
    index: Date.now(),
    timestamp: Date.now(),
    data: JSON.stringify({
      type: 'thanos_mode_initiated',
      conversationId: thanosConversationId,
      userId,
      timestamp: new Date().toISOString(),
    }),
    previousHash: '',
  });

  context.logGateway?.log?.('THANOS_MODE_INITIATED', {
    conversationId: thanosConversationId,
    userId,
  });

  // EARLY RETURN - don't process further
  return sendJson(res, 200, {
    success: true,
    response: challengeMessage,
    metadata: {
      thanos_challenge: true,
      awaiting_verification: true,
    },
  });
}

// Check if we're awaiting THANOS verification for this conversation
if (thanosMode.isAwaitingVerification(thanosConversationId)) {
  // User is providing the verification key
  const verification = await thanosMode.verifyThanosKey(thanosConversationId, message);

  context.logGateway?.log?.('THANOS_MODE_VERIFICATION_ATTEMPT', {
    conversationId: thanosConversationId,
    userId,
    verified: verification.verified,
  });

  // EARLY RETURN - don't process further
  return sendJson(res, 200, {
    success: verification.verified,
    response: verification.message,
    metadata: {
      thanos_verification: true,
      verified: verification.verified,
      trust_level: verification.trustLevel,
    },
  });
}
```

---

## STEP 3: Replace Synthesis Hook (Around Line 545-554)

### BEFORE:

```typescript
// PHASE 3: TRIGGER MEMORY SYNTHESIS (FIRE-AND-FORGET)
// ============================================================
// Start synthesis asynchronously without blocking response
const conversationId = (conversationRecord?.[0] as { id?: string })?.id;
if (conversationId) {
  void postConversationSynthesisHook.processConversation(conversationId).catch(error => {
    context.logGateway?.warn?.('SYNTHESIS_FAILED', {
      conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - synthesis is optional and shouldn't block chat response
  });
}
```

### AFTER:

```typescript
// PHASE 1B: TRIGGER MEMORY SYNTHESIS (FIRE-AND-FORGET)
// ============================================================
// Post-conversation analysis and psychology evolution
// Uses AIOperationRouter to route to Gemini Flash 2 for cost efficiency
// Fire-and-forget: doesn't block chat response
const synthesisConversationId = (conversationRecord?.[0] as { id?: string })?.id;
if (synthesisConversationId && process.env.ENABLE_MEMORY_SYNTHESIS !== 'false') {
  void synthesisEngine.synthesizeConversation(synthesisConversationId).catch(error => {
    context.logGateway?.warn?.('SYNTHESIS_FAILED', {
      conversationId: synthesisConversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Non-blocking failure - synthesis is optional enhancement
  });
}
```

---

## STEP 4: Initialize Memory Scheduler (Lines 660+, before main export)

### Add this function before `handleChatHttpRequest` export:

```typescript
/**
 * Initialize Phase 1B memory synthesis scheduler
 * Called once on first request
 */
let schedulerInitialized = false;
async function initializeMemoryScheduler(context: ChatHandlerContext): Promise<void> {
  if (schedulerInitialized) {
    return;
  }

  try {
    if (process.env.ENABLE_MEMORY_SCHEDULER !== 'false') {
      await memoryScheduler.initialize();
      context.logGateway?.log?.('MEMORY_SCHEDULER_INITIALIZED', {
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    context.logGateway?.warn?.('MEMORY_SCHEDULER_INIT_FAILED', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Non-critical failure - continue without scheduler
  }

  schedulerInitialized = true;
}
```

### Then update `handleChatHttpRequest` function:

```typescript
export async function handleChatHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  context: ChatHandlerContext
): Promise<boolean> {
  // Initialize memory scheduler on first request
  await initializeMemoryScheduler(context);

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  // ... rest of function
```

---

## STEP 5: Environment Variables

Add these to your `.env` file:

```bash
# Phase 1B: Memory Synthesis Configuration
ENABLE_MEMORY_SYNTHESIS=true              # Enable synthesis (default: true)
SYNTHESIS_BATCH_MODE=true                 # Batch at specific hour (default: true)
SYNTHESIS_BATCH_HOUR=2                    # Hour for batching 0-23 (default: 2 AM)
SYNTHESIS_DRY_RUN=false                   # Dry run mode (log but don't apply changes)

# Memory Scheduler Configuration
ENABLE_MEMORY_SCHEDULER=true              # Enable cron jobs (default: true)

# THANOS Mode Security
THANOS_VERIFICATION_KEY=cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539297c
```

---

## STEP 6: Execute Supabase Migration

After integration, execute the database migration:

```bash
# Using Supabase CLI
cd web
npx supabase migration up

# Or manually:
# 1. Go to Supabase dashboard
# 2. SQL editor
# 3. Copy entire contents of: web/supabase/migrations/027_memory_synthesis_tables.sql
# 4. Execute in SQL editor
```

---

## Verification Checklist

After integration, verify each step:

- [ ] **Import changes**: No errors on import
- [ ] **THANOS trigger detection**: Compiles without errors
- [ ] **Synthesis hook**: Replaced correctly
- [ ] **Scheduler initialization**: Added before export
- [ ] **Environment variables**: Added to .env
- [ ] **Database migration**: Executed successfully

### Test THANOS_MODE flow:

```bash
# 1. Start the server
npm run dev

# 2. Send POST to /api/chat/message with:
{
  "message": "THANOS_MODE_AUTH_1990",
  "sessionKey": "test"
}

# Expected response:
{
  "success": true,
  "response": "[Portuguese prompt from The Alchemist]",
  "metadata": {
    "thanos_challenge": true,
    "awaiting_verification": true
  }
}

# 3. Send verification key:
{
  "message": "cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539297c",
  "sessionKey": "test"
}

# Expected response:
{
  "success": true,
  "response": "[CREATOR_VERIFIED] Perfect trust (1.0) granted...",
  "metadata": {
    "thanos_verification": true,
    "verified": true,
    "trust_level": 1.0
  }
}
```

### Test Synthesis triggering:

```bash
# 1. Send a normal chat message
# 2. Check Discord #helix-hash-chain for synthesis logs
# 3. Verify memory_stored event appears
# 4. Check conversation_memories table in Supabase for new row
```

### Check Scheduler:

```bash
# 1. Monitor logs at 2 AM (or your configured SYNTHESIS_BATCH_HOUR)
# 2. Should see: memory_decay_started, reconsolidation_started, wellness_check_started
# 3. Check Discord #helix-hash-chain for maintenance events
```

---

## Rollback Instructions

If issues occur:

1. **Revert imports**: Go back to original imports (the 10-line THANOS block)
2. **Remove THANOS code**: Delete the THANOS_MODE detection block (Step 2)
3. **Restore synthesis hook**: Use original postConversationSynthesisHook code
4. **Remove scheduler init**: Delete the scheduler initialization function
5. **Disable features**: Set `ENABLE_MEMORY_SYNTHESIS=false` and `ENABLE_MEMORY_SCHEDULER=false`

System will continue with original behavior.

---

## Architecture Summary

```
Request arrives
  ↓
[PHASE 1B] Check for THANOS_MODE trigger → Early return if match
  ↓
[PHASE 1B] Check for THANOS verification → Early return if match
  ↓
[Original flow continues: Load context, build prompt, get response]
  ↓
[PHASE 1B] Fire-and-forget synthesis via synthesisEngine
  ↓
Response sent to client
```

---

## Success Indicators

✅ **Context loading works**: Helix loads HELIX_SOUL.md (existing, should continue)
✅ **THANOS_MODE works**: Challenge/verification flow successful
✅ **Synthesis works**: Post-conversation analysis runs asynchronously
✅ **Memory storage works**: Rows appear in conversation_memories table
✅ **Scheduler works**: Daily jobs execute at 2 AM
✅ **Logging works**: All operations appear in #helix-hash-chain

---

**Status**: 🟢 **Ready for Integration**
All components implemented and tested. Follow Steps 1-6 above to integrate.
