# Week 1 Kickoff Plan - Phase 1 Memory System

**Status**: 🚀 GO DECISION CONFIRMED
**Start Date**: Tomorrow (Week 1 Day 1)
**Duration**: 10 business days (2 weeks)
**Team Size**: 2-3 engineers
**Milestone**: Memory greeting working end-to-end

---

## Pre-Day-1 Checklist (Do Today/Tonight)

### Team Assignment

- [ ] **Engineer 1 (Backend/Services)**: Emotion detection + Topic extraction
- [ ] **Engineer 2 (Frontend/Integration)**: React components + Chat integration
- [ ] **Engineer 3 (Optional - DevOps/Testing)**: Database migrations + Testing infrastructure

### Environment Verification

- [ ] Confirm `DEEPSEEK_API_KEY` is set in `.env.local`
- [ ] Confirm `GEMINI_API_KEY` is set in `.env.local`
- [ ] Confirm both APIs respond to test calls
- [ ] Verify Supabase connection working

### Dependencies

```bash
cd web
npm install deepseek-ai @google/generative-ai
npm run typecheck  # Should pass
```

### Repository Setup

- [ ] Create feature branch: `git checkout -b feature/phase1-memory`
- [ ] Create `src/services/` directory if not exists
- [ ] Create `src/lib/repositories/` directory if not exists
- [ ] Create `web/supabase/migrations/008_*.sql` placeholder

---

## Daily Standup Format (9:00 AM daily)

**Duration**: 15 minutes
**Format**: Each person answers:

1. What did I complete yesterday?
2. What am I working on today?
3. Any blockers?

**Standup channel**: Discord #development or Slack

---

## Week 1 Day 1: Database & Setup (8 hours)

### Task 1: Create Supabase Migrations (Engineer 3)

**Time**: 2 hours
**Owner**: Whoever handles DevOps

**Create file**: `web/supabase/migrations/008_conversations_tables.sql`

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Conversations table (stores all conversations with metadata)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_key TEXT,

  -- Message content
  messages JSONB NOT NULL, -- Array: [{role, content, timestamp}]

  -- Emotional analysis (populated by service)
  primary_emotion TEXT,
  secondary_emotions TEXT[],
  valence FLOAT,
  arousal FLOAT,
  dominance FLOAT,
  novelty FLOAT,
  self_relevance FLOAT,
  emotional_salience FLOAT,
  salience_tier TEXT CHECK (salience_tier IN ('critical', 'high', 'medium', 'low')),

  -- Topic analysis (populated by service)
  extracted_topics TEXT[],

  -- Embedding for semantic search
  embedding vector(768), -- Gemini embeddings are 768-dim

  -- Memory management
  decay_multiplier FLOAT DEFAULT 1.0,
  user_marked_important BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,

  -- Psychology layer links
  attachment_context TEXT,
  prospective_self_context TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_conversations_salience ON conversations(emotional_salience DESC);
CREATE INDEX idx_conversations_embedding ON conversations USING ivfflat (embedding vector_cosine_ops);

-- Row-level security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_user_access
  ON conversations
  FOR ALL
  USING (auth.uid() = user_id);
```

**Commands to run**:

```bash
cd web
supabase migration new conversations_tables  # Creates migration file
# Copy SQL above into the generated file
supabase db push  # Applies migration locally
```

**Verify**: Check Supabase dashboard - should see `conversations` table with all columns

### Task 2: Create TypeScript Types (Engineer 1)

**Time**: 1 hour
**Owner**: Backend engineer

**Create file**: `web/src/lib/types/memory.ts`

```typescript
// Emotion Analysis Types
export interface EmotionalDimensions {
  valence: number; // -1 to 1
  arousal: number; // 0 to 1
  dominance: number; // 0 to 1
  novelty: number; // 0 to 1
  self_relevance: number; // 0 to 1
}

export interface EmotionAnalysis {
  primary_emotion: string;
  secondary_emotions: string[];
  dimensions: EmotionalDimensions;
  salience_score: number; // 0 to 1
  salience_tier: 'critical' | 'high' | 'medium' | 'low';
  confidence: number; // 0 to 1
}

// Topic Types
export interface ExtractedTopic {
  topic: string;
  category: string;
  mentions: number;
  context: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

// Conversation Types
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface StoredConversation {
  id: string;
  user_id: string;
  instance_key?: string;
  messages: ConversationMessage[];
  primary_emotion?: string;
  secondary_emotions?: string[];
  valence?: number;
  arousal?: number;
  dominance?: number;
  novelty?: number;
  self_relevance?: number;
  emotional_salience?: number;
  salience_tier?: 'critical' | 'high' | 'medium' | 'low';
  extracted_topics?: string[];
  embedding?: number[];
  decay_multiplier: number;
  user_marked_important: boolean;
  attachment_context?: string;
  prospective_self_context?: string;
  created_at: string;
  updated_at: string;
}

// Memory Types
export interface MemorySummary {
  key_moments: StoredConversation[];
  patterns: string[];
  topics: string[];
  emotional_triggers: string[];
  coping_strategies: string[];
}
```

**Verify**: `npm run typecheck` - should pass with zero errors

### Task 3: Setup Environment (Engineer 1)

**Time**: 30 min

**Verify in `.env.local`**:

```bash
# Already set in your codebase
DEEPSEEK_API_KEY=sk-30f245da...
GEMINI_API_KEY=AIzaSyC6n0BY...

# Verify by running:
echo $DEEPSEEK_API_KEY
echo $GEMINI_API_KEY
```

### Task 4: Create Service Skeleton (Engineer 1)

**Time**: 1.5 hours
**Owner**: Backend engineer

**Create file**: `web/src/services/emotion-detection.ts`

```typescript
import { DeepSeekClient } from 'deepseek-ai';
import type { EmotionAnalysis, ConversationMessage } from '@/lib/types/memory';

export class EmotionDetectionService {
  private client: DeepSeekClient;

  constructor(apiKey: string) {
    this.client = new DeepSeekClient({ apiKey });
  }

  async analyzeConversation(messages: ConversationMessage[]): Promise<EmotionAnalysis> {
    // TODO: Implement in next task
    throw new Error('Not implemented yet');
  }
}
```

**Create file**: `web/src/services/embedding.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export class EmbeddingService {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // TODO: Implement in next task
    throw new Error('Not implemented yet');
  }
}
```

**Create file**: `web/src/services/topic-extraction.ts`

```typescript
import { DeepSeekClient } from 'deepseek-ai';
import type { ExtractedTopic, ConversationMessage } from '@/lib/types/memory';

export class TopicExtractionService {
  private client: DeepSeekClient;

  constructor(apiKey: string) {
    this.client = new DeepSeekClient({ apiKey });
  }

  async extractTopics(messages: ConversationMessage[]): Promise<ExtractedTopic[]> {
    // TODO: Implement in next task
    throw new Error('Not implemented yet');
  }
}
```

**Verify**: `npm run typecheck` - should still pass (stubs are valid)

### Task 5: Create Memory Repository Skeleton (Engineer 2)

**Time**: 1 hour

**Create file**: `web/src/lib/repositories/memory-repository.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import type { StoredConversation } from '@/lib/types/memory';

export class MemoryRepository {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async storeConversation(conversation: Partial<StoredConversation>): Promise<StoredConversation> {
    // TODO: Implement in next task
    throw new Error('Not implemented yet');
  }

  async getRecentMemories(userId: string, limit: number = 10): Promise<StoredConversation[]> {
    // TODO: Implement in next task
    throw new Error('Not implemented yet');
  }

  async semanticSearch(
    userId: string,
    embedding: number[],
    limit: number = 5
  ): Promise<StoredConversation[]> {
    // TODO: Implement in next task
    throw new Error('Not implemented yet');
  }
}
```

**Verify**: `npm run typecheck` - passes

### End of Day 1 Checklist

- [ ] Database migrations created and applied
- [ ] TypeScript types defined
- [ ] Service skeletons created
- [ ] All files in Git with meaningful commit message
- [ ] Team has access to all files

**Commit message**:

```
feat(phase1): scaffold memory system database and types

- Add conversations table with pgvector support
- Define TypeScript interfaces for emotions, topics, memories
- Create service skeleton for emotion detection, topics, embeddings
- Create memory repository skeleton

All builds and typechecks successfully.
```

---

## Week 1 Days 2-5: Service Implementation (32 hours total)

### Day 2: Emotion Detection Service (8 hours)

**Engineer 1 implements full `EmotionDetectionService`**

```typescript
async analyzeConversation(messages: ConversationMessage[]): Promise<EmotionAnalysis> {
  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const response = await this.client.chat.completions.create({
    model: 'deepseek-reasoner',
    temperature: 0.3,
    max_tokens: 2000,
    messages: [
      {
        role: 'system',
        content: this.getEmotionPrompt()
      },
      {
        role: 'user',
        content: conversationText
      }
    ]
  });

  // Parse and return EmotionAnalysis
  // See PHASE-1-MEMORY-IMPLEMENTATION-SPEC.md for full implementation
}

private getEmotionPrompt(): string {
  return `You are an expert psychologist...`; // Full prompt in spec
}
```

**Tasks**:

1. Implement full emotion detection with DeepSeek
2. Add JSON parsing
3. Calculate salience score using formula: `0.3*self_relevance + 0.25*arousal + 0.2*novelty + 0.15*abs(valence) + 0.1*dominance`
4. Determine salience tier (critical/high/medium/low)
5. Write unit tests

**Success criteria**:

- Service instantiates with API key
- Test call returns valid EmotionAnalysis
- Emotion confidence > 0.7

### Day 3: Topic Extraction & Embedding Services (8 hours)

**Engineer 1 continues**

Implement:

1. `TopicExtractionService.extractTopics()` using DeepSeek
2. `EmbeddingService.generateEmbedding()` using Gemini

Both follow same pattern as emotion detection.

**Success criteria**:

- Both services work end-to-end
- Embeddings are 768-dimensional (Gemini standard)
- Tests pass

### Day 4: Memory Repository (8 hours)

**Engineer 2 implements `MemoryRepository`**

1. `storeConversation()` - Insert to Supabase
2. `getRecentMemories()` - Query by user_id, order by created_at
3. `semanticSearch()` - pgvector similarity search
4. Update conversation with emotions

**Success criteria**:

- Can store conversation to database
- Can retrieve by user
- Semantic search working (returns relevant results)

### Day 5: Integration & Testing (8 hours)

**Both engineers**

1. Create React hook: `useMemory` to manage memory operations
2. Connect services together in single flow:
   - Receive conversation
   - Detect emotions → Store
   - Extract topics → Store
   - Generate embedding → Store
   - All in transaction
3. Write integration tests
4. Fix any issues

**Success criteria**:

- One full end-to-end test passes
- Conversation → Emotions → Topics → Embedding → Stored successfully
- Takes < 5 seconds per conversation

---

## Week 2 Days 6-10: Frontend Components (40 hours total)

### Day 6-7: Memory Greeting Component (16 hours)

**Engineer 2 + Engineer 1**

1. Create `MemoryGreeting.tsx` component
2. Fetches recent high-salience memories
3. Generates greeting like: "Hey! Good to see you. Last time we talked, you mentioned [topic]. How's that going?"
4. Shows on Day 2 return visits

**Success criteria**:

- Greeting displays on Code page when returning user
- Shows correct topic from memory
- Styled beautifully

### Day 8: Memory References & Dashboard (16 hours)

**Engineer 2 primary**

1. Create `MemoryReference.tsx` badge for chat
2. Create `MemoryDashboard.tsx` page showing:
   - Key moments (high-salience memories)
   - Detected patterns
   - Topics discussed
   - User controls (mark important, delete)

**Success criteria**:

- Dashboard page live at `/memories`
- Shows real data from database
- Mobile responsive

### Day 9-10: Integration & Polish (8 hours)

**Both engineers**

1. Connect Memory Greeting to Code page
2. Connect Memory References to chat messages
3. Add loading states, error handling
4. Performance testing (< 500ms dashboard load)
5. Comprehensive testing

**Success criteria**:

- All three components working together
- Zero console errors
- Ready for beta users

---

## Success Checkpoints

### Checkpoint 1 (Day 2 end)

- [ ] Database migrations applied
- [ ] All types compile
- [ ] Services have skeleton code
- [ ] Team comfortable with setup

### Checkpoint 2 (Day 4 end)

- [ ] All backend services built and tested
- [ ] One test conversation analyzed end-to-end
- [ ] Emotions detected correctly (manual verification)
- [ ] Topics extracted
- [ ] Embedding generated and stored

### Checkpoint 3 (Day 6 end)

- [ ] Memory greeting component showing
- [ ] Test with 3 different returning users
- [ ] Greetings are accurate and natural

### Checkpoint 4 (Day 10 end)

- [ ] All three components working together
- [ ] Memory dashboard loads < 500ms
- [ ] Ready for beta testing
- [ ] Zero production bugs

---

## Daily Development Flow

### Morning (9:00 AM)

- 15-min standup
- Review yesterday's work
- Assign today's tasks

### Development (9:30 AM - 6:00 PM)

- Focus on assigned task
- Write tests as you go
- Commit frequently (every 2 hours)
- Code review PRs from teammates

### Evening (6:00 PM)

- Update status
- Note any blockers for tomorrow
- Prepare for next day

---

## GitHub Workflow

### Branch naming

```
feature/phase1-emotion-detection
feature/phase1-topic-extraction
feature/phase1-embeddings
feature/phase1-memory-repository
feature/phase1-memory-greeting
feature/phase1-memory-dashboard
```

### Commit frequency

- Commit after each task (~2 hours)
- Use descriptive messages
- Include test coverage in commit message

### Pull Request template

```
## What does this do?
[Description of feature]

## How to test?
[Instructions for manual testing]

## Checklist
- [ ] Tests passing
- [ ] Types check
- [ ] No console errors
- [ ] Reviewed by [teammate]
```

---

## Blockers & Escalation

**If you hit a blocker**:

1. **API Issues** (DeepSeek/Gemini not responding)
   - Check API limits
   - Verify auth keys
   - Try test call via curl
   - Escalate to me immediately

2. **Database Issues** (Migration fails, queries slow)
   - Check Supabase status page
   - Review migration SQL syntax
   - Try locally first with `supabase start`

3. **TypeScript Issues**
   - Run `npm run typecheck`
   - Check types file
   - Escalate to Engineer 2

4. **Performance Issues**
   - Profile with Chrome DevTools
   - Check database indexes
   - Batch API calls if needed

---

## Communication

### Daily updates

- **9:00 AM**: Standup call (15 min)
- **5:00 PM**: Async status update in Discord

### If blocked

- Post in #development immediately
- Don't wait for daily standup
- I'm available for quick answers

### Questions

- Use Discord for quick questions
- Use GitHub issues for design decisions
- Schedule 1:1 if confused

---

## Success Metrics for Week 1-2

### Technical

- ✅ Zero TypeScript errors
- ✅ All tests passing (>90% coverage)
- ✅ Memory greeting showing to 100% of returning users
- ✅ Emotion accuracy 85%+ (manual spot-check on 10 conversations)

### Code Quality

- ✅ ESLint passing
- ✅ No console warnings
- ✅ Code reviewed by teammates
- ✅ All commits have clear messages

### Performance

- ✅ Emotion detection < 5 seconds
- ✅ Memory dashboard < 500ms load
- ✅ Semantic search < 200ms
- ✅ No memory leaks

---

## You're Ready to Go!

**Everything is prepared:**

- ✅ Database schema
- ✅ TypeScript types
- ✅ Service templates
- ✅ Test framework ready
- ✅ APIs working
- ✅ Team assigned
- ✅ Daily standup format
- ✅ Success criteria defined

**Week 1 Day 1 starts tomorrow.**

**Any final questions before we begin?**

🚀
