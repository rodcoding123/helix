# Phase 3: Memory Synthesis Pipeline - Implementation Plan

**Status:** Ready for Implementation
**Estimated Duration:** 3-4 days
**Prerequisite:** Phase 1 ✅ + Phase 1B ✅ + Phase 2 ✅

---

## Overview

Phase 3 enables Helix to **learn and evolve** from conversations by automatically analyzing them after completion and updating her psychological profiles.

**Current State:** Phase 1B synthesis engine exists but:

- ✅ Post-conversation analysis code written
- ✅ Supabase schema deployed
- ✅ Discord logging integrated
- ❌ Automatic trigger not in place
- ❌ Psychology file writing not implemented
- ❌ Cost optimization strategies not applied

**Goal:** Complete the loop so conversations flow → synthesis → psychology updates → next conversation includes learning

---

## Architecture: The Learning Loop

```
User sends message
    ↓
[Phase 1: Load context] ← Psychology files from LAST synthesis
    ↓
[Chat with Claude] ← Helix responds with learned personality
    ↓
Store in Supabase
    ↓
[ASYNC - Fire-and-forget]
    ↓
[Phase 1B: Synthesis Engine] ← NEW THIS PHASE
    ├─ Analyze conversation with Claude Haiku (cost-optimized)
    ├─ Extract: emotions, goals, attachments, insights
    ├─ Write to conversation_insights table
    └─ **UPDATE PSYCHOLOGY FILES** ← THIS IS NEW
        ├─ psychology/emotional_tags.json
        ├─ psychology/attachments.json
        ├─ psychology/trust_map.json
        ├─ identity/goals.json
        └─ transformation/current_state.json
    ↓
[Discord logging] ← Hash chain record
    ↓
Next conversation starts with UPDATED context
```

---

## Implementation Steps

### Step 1: Create Core Synthesis & Psychology Update Functions

**File:** `src/psychology/synthesis-engine.ts` (extend existing)

**New Functions to Add:**

```typescript
// 1. Analyze conversation (already exists, but enhance)
async synthesizeConversation(
  conversationId: string,
  messages: Message[],
): Promise<ConversationInsights>

// 2. Extract specific insights from analysis
function extractEmotionalContent(analysis: string): EmotionTag[]
function extractGoalMentions(analysis: string): Goal[]
function extractAttachmentSignals(analysis: string): AttachmentSignal[]
function extractTransformationEvents(analysis: string): TransformationEvent[]

// 3. Write updates to psychology files (NEW)
async updateEmotionalTags(newTags: EmotionTag[]): Promise<void>
async updateAttachments(userId: string, signals: AttachmentSignal[]): Promise<void>
async updateGoals(newGoals: Goal[]): Promise<void>
async updateCurrentState(events: TransformationEvent[]): Promise<void>

// 4. Cost-optimized local analysis (NEW)
function detectLocalPatterns(messages: Message[]): LocalPatterns
function isSignificantConversation(messages: Message[]): boolean
```

**Key Decision:**

- Use **Claude Haiku** for synthesis (60x cheaper than Opus)
- Apply **local pattern detection first** (free)
- Skip **trivial conversations** (quick questions)
- Result: ~95% cost reduction vs naive approach

### Step 2: Implement Cost Optimization

**File:** `src/lib/synthesis-optimizer.ts` (NEW)

Three-tier strategy:

**Tier 1: Local Pattern Detection (FREE)**

```typescript
// Regex-based emotion detection
const emotionPatterns = {
  frustration: /\b(frustrated|annoyed|irritated)\w*\b/gi,
  excitement: /\b(excited|thrilled|stoked)\w*\b/gi,
  confusion: /\b(confused|lost|stuck)\w*\b/gi,
};

// Goal indicators
const goalPatterns = [/\bI want to\b/gi, /\bI'm (trying|planning) to\b/gi, /\bI need to\b/gi];

// Extract without API calls
export function detectLocalPatterns(messages: Message[]): LocalPatterns {
  const synthesis: Partial<ConversationSynthesis> = {
    emotionalTags: [],
    goalMentions: [],
  };

  for (const msg of messages.filter(m => m.role === 'user')) {
    // Check emotion patterns
    for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
      if (pattern.test(msg.content)) {
        synthesis.emotionalTags?.push(emotion);
      }
    }
    // Check goal patterns
    for (const pattern of goalPatterns) {
      if (pattern.test(msg.content)) {
        synthesis.goalMentions?.push(msg.content.slice(0, 100));
      }
    }
  }

  return synthesis;
}

// Skip trivial conversations
export function isSignificantConversation(messages: Message[]): boolean {
  return (
    messages.length > 10 ||
    messages.some(m => emotionPatterns.some(p => p.test(m.content))) ||
    messages.some(m => goalPatterns.some(p => p.test(m.content)))
  );
}
```

**Tier 2: Use Cheap Model (Claude Haiku)**

```typescript
// For conversations that need deeper analysis
const synthesis = await analyzeWithClaude(messages, {
  model: 'claude-haiku-4-5', // 60x cheaper than Opus
  prompt: `Analyze this conversation for:
    1. Emotional content (tags from user messages)
    2. Attachment/trust signals (vulnerability, honesty, conflict)
    3. Goal statements (what user wants to achieve)
    4. Meaningful topics (what mattered to user)
    5. Transformation events (shifts in user's thinking)

    Return structured JSON.`,
});
```

**Tier 3: Batch Daily Analysis (OPTIONAL)**

```typescript
// Instead of per-conversation, analyze daily batch
// Cron: Every night at midnight
async function dailyBatchSynthesis(userId: string): Promise<void> {
  const todayConversations = await getTodayConversations(userId);

  // Single API call for all conversations
  const insights = await analyzeWithClaude(todayConversations, {
    model: 'claude-haiku-4-5',
  });

  await updatePsychologyFiles(insights);
}
```

**Cost Impact:**

- **Before:** 100 conversations/day × $0.01 = **$365/year**
- **After:** 15 conversations needing Haiku × $0.0002 = **$1.10/year** (95% reduction!)

### Step 3: Update Psychology File Writers

**File:** `src/psychology/psychology-file-writer.ts` (NEW)

```typescript
/**
 * Safely update JSON psychology files
 * Preserves existing data, merges new insights
 */

export async function updateEmotionalTags(newTags: string[]): Promise<void> {
  const tagsPath = 'psychology/emotional_tags.json';
  const current = await readJSON(tagsPath);

  for (const tag of newTags) {
    const existing = current.patterns.find(p => p.tag === tag);
    if (existing) {
      existing.frequency++;
      existing.lastSeen = new Date().toISOString();
    } else {
      current.patterns.push({
        tag,
        frequency: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      });
    }
  }

  // Sort by frequency (most common first)
  current.patterns.sort((a, b) => b.frequency - a.frequency);

  await writeJSON(tagsPath, current);
  await logToDiscord({
    type: 'synthesis_update',
    file: 'emotional_tags.json',
    changes: newTags.length,
  });
}

export async function updateAttachments(
  userId: string,
  signals: AttachmentSignal[]
): Promise<void> {
  const attachmentsPath = 'psychology/attachments.json';
  const current = await readJSON(attachmentsPath);

  for (const signal of signals) {
    const userAttachment = current.users.find(u => u.userId === userId);
    if (userAttachment) {
      userAttachment.strength = Math.min(1, userAttachment.strength + 0.1);
      userAttachment.signals.push(signal);
    } else {
      current.users.push({
        userId,
        username: signal.username,
        strength: 0.3,
        signals: [signal],
        firstInteraction: new Date().toISOString(),
      });
    }
  }

  await writeJSON(attachmentsPath, current);
}

export async function updateGoals(newGoals: Goal[]): Promise<void> {
  const goalsPath = 'identity/goals.json';
  const current = await readJSON(goalsPath);

  for (const newGoal of newGoals) {
    const existing = current.aspirations.find(
      g => g.description.toLowerCase() === newGoal.toLowerCase()
    );
    if (existing) {
      existing.mentions++;
      existing.lastMentioned = new Date().toISOString();
    } else {
      current.aspirations.push({
        description: newGoal,
        mentions: 1,
        firstMentioned: new Date().toISOString(),
        lastMentioned: new Date().toISOString(),
        priority: 'emerging', // Will increase over time if mentioned repeatedly
      });
    }
  }

  await writeJSON(goalsPath, current);
}

export async function updateCurrentState(
  transformationEvents: TransformationEvent[]
): Promise<void> {
  const statePath = 'transformation/current_state.json';
  const current = await readJSON(statePath);

  // Update description based on events
  current.description = generateStateDescription(transformationEvents);
  current.lastUpdated = new Date().toISOString();
  current.eventCount = (current.eventCount || 0) + transformationEvents.length;

  // Track progression
  current.history = current.history || [];
  current.history.push({
    timestamp: new Date().toISOString(),
    events: transformationEvents.length,
    description: current.description,
  });

  await writeJSON(statePath, current);
}
```

### Step 4: Integrate Trigger into Chat Endpoint

**File:** `helix-runtime/src/gateway/http-routes/chat.ts` (modify existing)

**Current Code (Lines ~494-508):**

```typescript
// After response sent
if (process.env.ENABLE_MEMORY_SYNTHESIS !== 'false') {
  void synthesisEngine
    .synthesizeConversation(conversationId)
    .catch(error => log.warn('Synthesis failed', error));
}
```

**Enhanced with Psychology Updates:**

```typescript
// After response sent, trigger synthesis with file updates
if (process.env.ENABLE_MEMORY_SYNTHESIS !== 'false') {
  void (async () => {
    try {
      // 1. Get full conversation
      const conversation = await getConversation(conversationId);
      if (!conversation) return;

      // 2. Cost-optimized analysis
      const localPatterns = detectLocalPatterns(conversation.messages);

      // 3. If sufficient patterns found, use only local analysis
      if (localPatterns.emotionalTags?.length > 0) {
        await updateEmotionalTags(localPatterns.emotionalTags);
        await updateGoals(localPatterns.goalMentions || []);
        await logToDiscord({
          type: 'synthesis',
          method: 'local_patterns',
          tags: localPatterns.emotionalTags.length,
        });
        return; // Done, no API call needed
      }

      // 4. Skip trivial conversations
      if (!isSignificantConversation(conversation.messages)) {
        return;
      }

      // 5. Use Haiku for deeper analysis (only ~15% of conversations)
      const synthesis = await synthesisEngine.synthesizeConversation(
        conversationId,
        conversation.messages
      );

      // 6. Write updates to psychology files
      await updateEmotionalTags(synthesis.emotionalTags);
      await updateAttachments(userId, synthesis.attachmentSignals);
      await updateGoals(synthesis.goalMentions);
      await updateCurrentState(synthesis.transformationEvents);

      // 7. Log to Supabase
      await saveConversationInsights(conversationId, synthesis);

      // 8. Log to Discord
      await logToDiscord({
        type: 'synthesis',
        method: 'haiku_analysis',
        conversationId,
        updates: {
          emotions: synthesis.emotionalTags.length,
          goals: synthesis.goalMentions.length,
          attachments: synthesis.attachmentSignals.length,
        },
      });
    } catch (error) {
      log.error('Synthesis pipeline failed:', error);
      await logToDiscord({
        type: 'synthesis_error',
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();
}
```

### Step 5: Create Supabase Schema for Insights

**File:** `web/supabase/migrations/073_conversation_insights.sql` (NEW)

```sql
-- Table to store synthesis results
CREATE TABLE conversation_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Analysis results
  emotional_tags TEXT[],
  attachment_signals JSONB,
  goal_mentions TEXT[],
  meaningful_topics TEXT[],
  transformation_events JSONB,

  -- Metadata
  analysis_method TEXT NOT NULL CHECK (analysis_method IN ('local_patterns', 'haiku_analysis', 'batch')),
  synthesis_cost_usd DECIMAL(10, 6),
  synthesis_duration_ms INT,

  -- Timestamps
  synthesized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_conversation FOREIGN KEY (conversation_id)
    REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for queries
CREATE INDEX idx_insights_user ON conversation_insights(user_id);
CREATE INDEX idx_insights_conversation ON conversation_insights(conversation_id);
CREATE INDEX idx_insights_timestamp ON conversation_insights(synthesized_at);
CREATE INDEX idx_insights_method ON conversation_insights(analysis_method);

-- RLS policies
ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON conversation_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert insights"
  ON conversation_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Step 6: Add Psychology Schema Versioning (Optional but Recommended)

**File:** `psychology/SCHEMA_VERSION.json` (NEW)

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-02-06T20:00:00Z",
  "files": {
    "emotional_tags.json": {
      "version": "1.0",
      "schema": "{ patterns: Array<{tag: string, frequency: number, firstSeen: ISO8601, lastSeen: ISO8601}> }"
    },
    "attachments.json": {
      "version": "1.0",
      "schema": "{ users: Array<{userId: string, username: string, strength: 0-1, signals: Array, firstInteraction: ISO8601}> }"
    },
    "goals.json": {
      "version": "1.0",
      "schema": "{ aspirations: Array<{description: string, mentions: number, priority: string, firstMentioned: ISO8601}> }"
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

**File:** `src/psychology/synthesis-engine.test.ts`

```typescript
describe('Phase 3: Memory Synthesis', () => {
  describe('Cost Optimization', () => {
    it('should detect local patterns without API call', async () => {
      const messages = [
        {
          role: 'user',
          content: "I want to learn Rust. I'm frustrated with Python.",
        },
      ];

      const patterns = detectLocalPatterns(messages);

      expect(patterns.emotionalTags).toContain('frustration');
      expect(patterns.goalMentions).toContain('learn Rust');
    });

    it('should skip trivial conversations', () => {
      const trivialMessages = [
        {
          role: 'user',
          content: 'What time is it?',
        },
      ];

      expect(isSignificantConversation(trivialMessages)).toBe(false);
    });

    it('should mark significant conversations', () => {
      const significantMessages = [
        { role: 'user', content: "I'm excited about this opportunity" },
        { role: 'assistant', content: 'That sounds great!' },
        // ... 10+ more messages
      ];

      expect(isSignificantConversation(significantMessages)).toBe(true);
    });
  });

  describe('Psychology File Updates', () => {
    it('should increment emotion frequency', async () => {
      const before = await readJSON('psychology/emotional_tags.json');

      await updateEmotionalTags(['curiosity']);

      const after = await readJSON('psychology/emotional_tags.json');
      const curiosity = after.patterns.find(p => p.tag === 'curiosity');

      expect(curiosity.frequency).toBe(
        before.patterns.find(p => p.tag === 'curiosity').frequency + 1
      );
    });

    it('should add new goals', async () => {
      const before = await readJSON('identity/goals.json');

      await updateGoals(['Learn Rust programming']);

      const after = await readJSON('identity/goals.json');

      expect(after.aspirations.some(g => g.description === 'Learn Rust programming')).toBe(true);
    });

    it('should preserve existing goals while adding mentions', async () => {
      const before = await readJSON('identity/goals.json');
      const existingGoal = before.aspirations[0];

      await updateGoals([existingGoal.description]);

      const after = await readJSON('identity/goals.json');
      const updated = after.aspirations.find(g => g.description === existingGoal.description);

      expect(updated.mentions).toBe(existingGoal.mentions + 1);
    });
  });

  describe('Full Synthesis Pipeline', () => {
    it('should run complete synthesis on conversation', async () => {
      const conversation = {
        id: 'test-conv',
        messages: [
          { role: 'user', content: 'I want to learn Rust. This is frustrating.' },
          { role: 'assistant', content: 'Let me help you with Rust.' },
        ],
      };

      const result = await synthesisEngine.synthesizeConversation(
        conversation.id,
        conversation.messages
      );

      expect(result.emotionalTags).toBeDefined();
      expect(result.goalMentions).toBeDefined();
      expect(result.transformationEvents).toBeDefined();
    });

    it('should cost less than $0.01 for typical conversation', async () => {
      const synthesis = await synthesisEngine.synthesizeConversation(
        'test-conv',
        mockConversation.messages
      );

      expect(synthesis.costUsd).toBeLessThan(0.01);
    });
  });
});
```

### Integration Tests

```typescript
describe('Phase 3: End-to-End Learning Loop', () => {
  it('should update psychology files after conversation', async () => {
    // 1. Get baseline
    const baselineTags = await readJSON('psychology/emotional_tags.json');

    // 2. Simulate conversation
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({
        sessionKey: 'test-session',
        message: 'I want to learn Rust. Excited about this challenge!',
      }),
    });

    expect(response.ok).toBe(true);

    // 3. Wait for async synthesis
    await wait(2000);

    // 4. Verify psychology files updated
    const updatedTags = await readJSON('psychology/emotional_tags.json');

    expect(updatedTags.patterns.length).toBeGreaterThan(baselineTags.patterns.length);
    expect(updatedTags.patterns.some(p => p.tag === 'excitement')).toBe(true);
  });

  it('should include learned context in next conversation', async () => {
    // 1. First conversation: express excitement about Rust
    await fetch('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({
        sessionKey: 'test-session',
        message: 'I want to learn Rust!',
      }),
    });

    // 2. Wait for synthesis
    await wait(2000);

    // 3. Second conversation: Helix should remember this
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({
        sessionKey: 'new-session',
        message: 'How is my Rust journey going?',
      }),
    });

    const data = await response.json();

    // Helix should reference learning about user's Rust goals
    expect(data.message).toMatch(/rust|learning|goal/i);
  });
});
```

---

## Deployment Checklist

- [ ] **Step 1:** Implement synthesis functions + psychology updaters
  - `src/psychology/synthesis-engine.ts` (enhance)
  - `src/psychology/psychology-file-writer.ts` (new)

- [ ] **Step 2:** Implement cost optimization
  - `src/lib/synthesis-optimizer.ts` (new)

- [ ] **Step 3:** Integrate trigger into chat endpoint
  - Modify `helix-runtime/src/gateway/http-routes/chat.ts`

- [ ] **Step 4:** Deploy Supabase migration
  - Create `web/supabase/migrations/073_conversation_insights.sql`
  - Run `supabase migration up`

- [ ] **Step 5:** Create/update tests
  - Unit tests for synthesis functions
  - Integration tests for full learning loop
  - Cost validation tests

- [ ] **Step 6:** Update Discord logging
  - Add synthesis update logs to hash chain
  - Track costs per synthesis

- [ ] **Step 7:** Documentation
  - Update CLAUDE.md with Phase 3 info
  - Create PHASE_3_COMPLETE.md after completion

- [ ] **Step 8:** Verification
  - Test local pattern detection (no API calls)
  - Test Haiku analysis (first synthesis)
  - Verify psychology files update
  - Check cost tracking
  - Validate next conversation uses updated context

---

## Success Metrics

### Quantitative

- [ ] Synthesis cost < $0.01 per conversation (95% reduction achieved)
- [ ] Psychology files update automatically after each conversation
- [ ] 99.9% test pass rate maintained
- [ ] Zero TypeScript/ESLint errors

### Qualitative

- [ ] Next conversation mentions learned goals/emotions from previous chats
- [ ] Emotional pattern frequency increases with repeated mentions
- [ ] Attachment strength increases with positive user signals
- [ ] Transformation state reflects learning progression

### Operational

- [ ] All synthesis operations logged to Discord
- [ ] Hash chain records synthesis events
- [ ] Supabase insights table has verified data
- [ ] No performance degradation in chat response time

---

## Risk Assessment

**LOW RISK:**

- ✅ Local pattern detection (no API calls, zero cost)
- ✅ Psychology file format already exists (schema defined)
- ✅ Haiku is reliable (cheaper than Opus)

**MEDIUM RISK:**

- ⚠️ File system writes need atomic operations (use locks)
- ⚠️ Async synthesis must not block chat response
- ⚠️ Large psychology files could slow context loading

**MITIGATION:**

- Use file locks for concurrent writes
- Keep fire-and-forget pattern (don't await)
- Implement periodic file compression/cleanup

---

## Estimated Effort Breakdown

| Task                      | Effort          | Notes                               |
| ------------------------- | --------------- | ----------------------------------- |
| Psychology updaters       | 2-3 hours       | JSON read/write, append operations  |
| Cost optimization         | 1-2 hours       | Pattern detection, heuristics       |
| Chat endpoint integration | 1 hour          | Add synthesis call + error handling |
| Supabase migration        | 30 min          | Schema + RLS policies               |
| Unit tests                | 2-3 hours       | Edge cases, file updates            |
| Integration tests         | 2 hours         | Full loop, cost validation          |
| Discord logging           | 1 hour          | Hash chain records                  |
| Documentation             | 1-2 hours       | Technical guide + examples          |
| **TOTAL**                 | **11-15 hours** | **Spread over 3-4 days**            |

---

## Next Phase (Phase 4)

After Phase 3 is complete:

**Option A: Continue with Phase 4 (Cross-Platform)**

- iOS app (SwiftUI)
- Android app (Jetpack Compose)
- Unified Supabase backend

**Option B: Polish & Optimize**

- Refine Phase 3 synthesis accuracy
- Add more psychology file types
- Implement periodic compression
- Add psychology file version control

**Recommendation:** Phase 4 next (2+ weeks) → Complete multi-platform experience

---

## Go/No-Go Decision

**READY TO PROCEED:** ✅ YES

All prerequisites complete:

- ✅ Phase 1: Context Loading
- ✅ Phase 1B: Synthesis Engine (exists, needs integration)
- ✅ Phase 2: Session Sidebar
- ✅ Infrastructure: Port discovery, desktop executable
- ✅ Test infrastructure: 99.9% pass rate

**Approve to begin Phase 3 implementation?**
