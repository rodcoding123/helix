# Phase 1: Memory System - Implementation Sequence

**Start Date**: Whenever you confirm GO
**Duration**: 2-3 weeks (10 business days)
**Team Size**: 2-3 engineers (can parallelize Days 1-5)
**Success Metric**: Day 2 retention improves from 18% to 50%+

---

## Pre-Implementation Setup (Before Day 1)

### Environment Configuration (15 minutes)

```bash
# In c:\Users\Specter\Desktop\Helix\.env, verify or add:
VITE_SUPABASE_URL=https://[your-project].supabase.co
VITE_SUPABASE_KEY=[public-anon-key]
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DISCORD_HELIX_WEBHOOK=https://discord.com/api/webhooks/...
DISCORD_MEMORY_WEBHOOK=https://discord.com/api/webhooks/...
```

### Database Extension Enable (1 click)

1. Go to Supabase dashboard → Your project → Extensions
2. Search for "vector"
3. Click "Enable pgvector"
4. Verify: You should see `CREATE EXTENSION "vector"` in your database

### npm Dependencies (5 minutes)

```bash
cd web
npm install ai openai pg-vector
npm run typecheck  # Verify no errors
```

### Kickoff Meeting (30 minutes)

- [ ] Assign engineer 1: Backend services (Emotion, Topic, Embedding)
- [ ] Assign engineer 2: React components + integration
- [ ] Assign engineer 3 (optional): Testing + DB
- [ ] Review spec together (all on same page)
- [ ] Confirm API keys are working

---

## Week 1: Backend Infrastructure + Integration

### Day 1: Database Schema (8 hours)

**Files to create**:
- `web/supabase/migrations/008_conversations_tables.sql`
- `web/supabase/migrations/009_memory_tables.sql`

**What gets done**:

1. **Create conversations table** (with emotions inline)
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES instances NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,

  -- Message
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,

  -- Emotional analysis (populated by service)
  emotional_salience FLOAT,
  valence FLOAT,
  arousal FLOAT,
  dominance FLOAT,
  novelty FLOAT,
  self_relevance FLOAT,

  -- Topics (populated by service)
  extracted_topics JSONB,

  -- Embedding (populated by service)
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_instance ON conversations(instance_id, created_at DESC);
CREATE INDEX idx_conversations_user ON conversations(user_id, created_at DESC);
CREATE INDEX idx_conversations_embedding ON conversations USING ivfflat (embedding vector_cosine_ops);
```

2. **Create memory_entries table** (aggregated memories)
```sql
CREATE TABLE memory_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES instances NOT NULL,

  -- Memory content
  memory_type TEXT CHECK (memory_type IN ('moment', 'pattern', 'insight', 'preference')),
  content TEXT NOT NULL,

  -- Source conversation
  source_conversation_id UUID REFERENCES conversations,

  -- Salience tracking
  salience_tier TEXT CHECK (salience_tier IN ('critical', 'high', 'medium', 'low')),
  salience_score FLOAT DEFAULT 0,
  decay_rate FLOAT DEFAULT 0.05,
  last_decay_at TIMESTAMPTZ DEFAULT NOW(),

  -- Embedding for search
  embedding vector(1536),

  -- User curation
  is_important BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memory_instance ON memory_entries(instance_id, salience_score DESC);
CREATE INDEX idx_memory_embedding ON memory_entries USING ivfflat (embedding vector_cosine_ops);
```

3. **Create memory_patterns table** (detected patterns)
```sql
CREATE TABLE memory_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES instances NOT NULL,

  pattern_type TEXT,
  pattern_content JSONB,
  confidence FLOAT,
  source_memories INTEGER[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Deliverable**: Two migration files ready to push
**Owner**: Engineer 3 (or whoever handles DevOps)
**Time**: 8 hours

---

### Day 1-2: TypeScript Types (8 hours)

**Files to create**:
- `web/src/lib/types/memory.ts`
- `web/src/lib/types/emotion.ts`
- `web/src/lib/types/conversation.ts`

**What gets done**:

```typescript
// web/src/lib/types/emotion.ts
export interface EmotionalDimensions {
  valence: number;           // -1 (negative) to 1 (positive)
  arousal: number;           // 0 (calm) to 1 (intense)
  dominance: number;         // 0 (controlled) to 1 (in control)
  novelty: number;           // 0 (expected) to 1 (surprising)
  self_relevance: number;    // 0 (irrelevant) to 1 (identity-defining)
}

export interface EmotionAnalysisResult {
  dimensions: EmotionalDimensions;
  salience_score: number;    // Composite score (0-100)
  salience_tier: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string;
}

// web/src/lib/types/memory.ts
export interface Conversation {
  id: string;
  instance_id: string;
  role: 'user' | 'assistant';
  content: string;
  emotions?: EmotionalDimensions;
  salience_score?: number;
  extracted_topics?: string[];
  created_at: string;
}

export interface MemoryEntry {
  id: string;
  instance_id: string;
  memory_type: 'moment' | 'pattern' | 'insight' | 'preference';
  content: string;
  salience_tier: 'critical' | 'high' | 'medium' | 'low';
  salience_score: number;
  is_important: boolean;
  source_conversation_id: string;
  created_at: string;
}

export interface MemoryPattern {
  id: string;
  instance_type: 'behavioral' | 'emotional' | 'preference';
  content: Record<string, any>;
  confidence: number;
  description: string;
}

export interface MemorySummary {
  key_moments: MemoryEntry[];
  patterns: MemoryPattern[];
  topics: string[];
  emotional_triggers: string[];
  coping_strategies: string[];
}
```

**Deliverable**: All types properly defined, zero `any` types
**Owner**: Engineer 1
**Time**: 4 hours

---

### Day 2-3: Backend Services (16 hours)

This is where the heavy lifting begins. Work in parallel if possible.

#### Service 1: Emotion Detection (Engineer 1)

**File**: `web/src/services/emotion-detection.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { EmotionalDimensions, EmotionAnalysisResult } from '@/lib/types/emotion';

export class EmotionDetectionService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyzeConversation(userMessage: string, assistantResponse: string, history: string): Promise<EmotionAnalysisResult> {
    // 1. Detect emotional dimensions using Claude
    const response = await this.client.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 1000,
      system: `You are an expert psychologist analyzing emotional content.

      For the given conversation, detect the emotional dimensions on a scale:
      - valence: -1 (very negative) to 1 (very positive)
      - arousal: 0 (calm) to 1 (intense/activated)
      - dominance: 0 (feels controlled) to 1 (feels in control)
      - novelty: 0 (expected/routine) to 1 (surprising/novel)
      - self_relevance: 0 (irrelevant) to 1 (identity-defining)

      Return ONLY valid JSON with these exact fields (no markdown).`,

      messages: [{
        role: 'user',
        content: `User said: "${userMessage}"\n\nAssistant responded: "${assistantResponse}"\n\nContext: ${history}\n\nAnalyze the emotional dimensions.`
      }]
    });

    // 2. Parse response
    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    const dimensions = JSON.parse(content.text) as EmotionalDimensions;

    // 3. Calculate composite salience score
    const salience = (
      0.3 * dimensions.self_relevance +
      0.25 * dimensions.arousal +
      0.2 * dimensions.novelty +
      0.15 * Math.abs(dimensions.valence) +
      0.1 * dimensions.dominance
    ) * 100;

    // 4. Determine salience tier
    let tier: 'critical' | 'high' | 'medium' | 'low';
    if (salience >= 75) tier = 'critical';
    else if (salience >= 50) tier = 'high';
    else if (salience >= 25) tier = 'medium';
    else tier = 'low';

    return {
      dimensions,
      salience_score: salience,
      salience_tier: tier,
      reasoning: content.text
    };
  }
}
```

**Test file**: `web/src/services/emotion-detection.test.ts`
- Test normal message (should get medium salience)
- Test emotional message (should get high salience)
- Test personal message (should get high self_relevance)
- Test parse error handling

**Owner**: Engineer 1
**Time**: 4-5 hours

#### Service 2: Topic Extraction (Engineer 1)

**File**: `web/src/services/topic-extraction.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';

export interface TopicExtractionResult {
  topics: string[];
  main_topic: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export class TopicExtractionService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extractTopics(userMessage: string, assistantResponse: string): Promise<TopicExtractionResult> {
    const response = await this.client.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 500,
      system: `Extract conversation topics. Return valid JSON only with:
      {
        "topics": ["topic1", "topic2"],
        "main_topic": "primary topic",
        "sentiment": "positive|negative|neutral"
      }`,

      messages: [{
        role: 'user',
        content: `User: "${userMessage}"\n\nAssistant: "${assistantResponse}"\n\nExtract topics.`
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    return JSON.parse(content.text);
  }
}
```

**Owner**: Engineer 1
**Time**: 2 hours

#### Service 3: Embedding Generation (Engineer 1)

**File**: `web/src/services/embedding.ts`

```typescript
import { OpenAI } from 'openai';

export class EmbeddingService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536
    });

    if (!response.data[0]?.embedding) {
      throw new Error('No embedding returned');
    }

    return response.data[0].embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      dimensions: 1536
    });

    return response.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);
  }
}
```

**Owner**: Engineer 1
**Time**: 1 hour

#### Service 4: Memory Repository (Engineer 2)

**File**: `web/src/lib/repositories/memory-repository.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Conversation, MemoryEntry } from '@/lib/types/memory';

export class MemoryRepository {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  // Store conversation
  async storeConversation(conversation: Conversation): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .insert([conversation]);

    if (error) throw error;
  }

  // Update conversation with emotion analysis
  async updateConversationEmotion(
    conversationId: string,
    emotion: any,
    embedding: number[]
  ): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .update({
        emotional_salience: emotion.salience_score,
        valence: emotion.dimensions.valence,
        arousal: emotion.dimensions.arousal,
        dominance: emotion.dimensions.dominance,
        novelty: emotion.dimensions.novelty,
        self_relevance: emotion.dimensions.self_relevance,
        embedding
      })
      .eq('id', conversationId);

    if (error) throw error;
  }

  // Semantic search
  async searchMemoriesBySemantic(
    instanceId: string,
    query: string,
    embedding: number[],
    limit: number = 5
  ): Promise<MemoryEntry[]> {
    const { data, error } = await this.supabase.rpc('search_memories', {
      query_embedding: embedding,
      instance_id: instanceId,
      similarity_threshold: 0.7,
      match_count: limit
    });

    if (error) throw error;
    return data;
  }

  // Get recent memories
  async getRecentMemories(instanceId: string, limit: number = 10): Promise<MemoryEntry[]> {
    const { data, error } = await this.supabase
      .from('memory_entries')
      .select('*')
      .eq('instance_id', instanceId)
      .is('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // Get high-salience memories
  async getHighSalienceMemories(instanceId: string, limit: number = 5): Promise<MemoryEntry[]> {
    const { data, error } = await this.supabase
      .from('memory_entries')
      .select('*')
      .eq('instance_id', instanceId)
      .in('salience_tier', ['critical', 'high'])
      .is('is_deleted', false)
      .order('salience_score', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
}
```

**Owner**: Engineer 2
**Time**: 3 hours

**Deliverable**: All services tested and working with mock API calls
**Owner**: Engineers 1 & 2 (parallel work)
**Time**: 10 hours

---

### Day 3-4: Integration Layer (16 hours)

#### React Hooks (Engineer 2)

**File**: `web/src/hooks/useMemory.ts`

```typescript
import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { MemoryRepository } from '@/lib/repositories/memory-repository';
import { EmotionDetectionService } from '@/services/emotion-detection';
import { TopicExtractionService } from '@/services/topic-extraction';
import { EmbeddingService } from '@/services/embedding';
import type { MemoryEntry, MemorySummary } from '@/lib/types/memory';

export function useMemory(instanceId: string) {
  const { supabase } = useAuth();
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [summary, setSummary] = useState<MemorySummary | null>(null);
  const [loading, setLoading] = useState(false);

  const repo = new MemoryRepository(supabase);
  const emotionService = new EmotionDetectionService(import.meta.env.VITE_ANTHROPIC_API_KEY);
  const topicService = new TopicExtractionService(import.meta.env.VITE_ANTHROPIC_API_KEY);
  const embeddingService = new EmbeddingService(import.meta.env.VITE_OPENAI_API_KEY);

  // Load recent memories
  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const recentMemories = await repo.getRecentMemories(instanceId, 20);
      setMemories(recentMemories);

      // TODO: Calculate summary from memories
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  // Analyze and store new conversation
  const analyzeConversation = useCallback(async (
    userMessage: string,
    assistantResponse: string
  ) => {
    try {
      // 1. Generate embedding
      const embedding = await embeddingService.generateEmbedding(userMessage);

      // 2. Analyze emotion
      const emotion = await emotionService.analyzeConversation(
        userMessage,
        assistantResponse,
        '' // TODO: get history
      );

      // 3. Extract topics
      const topics = await topicService.extractTopics(userMessage, assistantResponse);

      // 4. Store in Supabase
      // Implementation continues...

    } catch (error) {
      console.error('Failed to analyze conversation:', error);
    }
  }, []);

  // Search memories
  const searchMemories = useCallback(async (query: string) => {
    try {
      const embedding = await embeddingService.generateEmbedding(query);
      const results = await repo.searchMemoriesBySemantic(instanceId, query, embedding);
      return results;
    } catch (error) {
      console.error('Failed to search memories:', error);
      return [];
    }
  }, [instanceId]);

  return {
    memories,
    summary,
    loading,
    loadMemories,
    analyzeConversation,
    searchMemories
  };
}
```

**Owner**: Engineer 2
**Time**: 6 hours

#### Connect to CodeInterface (Engineer 2)

**File**: Modify `web/src/components/code/CodeInterface.tsx`

Add hooks for memory tracking:
```typescript
const { analyzeConversation } = useMemory(instanceKey);

// On message completion
onMessageComplete = (message: Message) => {
  analyzeConversation(message.userContent, message.assistantContent);
};
```

**Owner**: Engineer 2
**Time**: 3 hours

**Deliverable**: Full integration between chat and memory system
**Owner**: Engineer 2
**Time**: 9 hours

---

### Day 4-5: Testing & Debugging (16 hours)

#### Unit Tests (Engineer 3 or whoever)

- Test EmotionDetectionService with various inputs
- Test TopicExtractionService with edge cases
- Test EmbeddingService with batch operations
- Test MemoryRepository CRUD operations
- Test useMemory hook

**Files**:
- `web/src/services/emotion-detection.test.ts`
- `web/src/services/topic-extraction.test.ts`
- `web/src/services/embedding.test.ts`
- `web/src/lib/repositories/memory-repository.test.ts`
- `web/src/hooks/useMemory.test.ts`

**Command**: `npm test`

#### Integration Testing

- Test full flow: Chat → Emotion analysis → Topic extraction → Embedding → Storage
- Test Supabase schema with real migrations
- Test pgvector semantic search
- Performance test: 100 messages → measure storage time

#### Manual QA

- Create 5 sample conversations
- Verify emotions are reasonable
- Verify topics extracted correctly
- Verify memory retrieval working
- Verify no memory leaks

**Deliverable**: All tests passing, integration verified
**Owner**: Engineer 3
**Time**: 8 hours

**Week 1 Summary**:
- ✅ Database schema ready
- ✅ All backend services built
- ✅ Memory integration with chat working
- ✅ Tests passing
- ✅ Ready for frontend components

---

## Week 2: Frontend Components + Polish

### Day 6: Memory Greeting Component (8 hours)

**File**: `web/src/components/memory/MemoryGreeting.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useMemory } from '@/hooks/useMemory';
import { Sparkles } from 'lucide-react';

export function MemoryGreeting({ instanceId }: { instanceId: string }) {
  const { summary, loadMemories } = useMemory(instanceId);
  const [greeting, setGreeting] = useState<string>('');
  const [isNewUser, setIsNewUser] = useState(true);

  useEffect(() => {
    loadMemories();
  }, []);

  useEffect(() => {
    if (!summary) return;

    if (summary.key_moments.length === 0) {
      setGreeting('Hi! I\'m Helix. What\'s on your mind?');
      setIsNewUser(true);
    } else {
      // Generate personalized greeting
      const recent = summary.key_moments[0];
      setGreeting(`Hey! Good to see you again.\nLast time we talked, you mentioned\n${recent.content}\nHow's that going?`);
      setIsNewUser(false);
    }
  }, [summary]);

  return (
    <div className="mb-6 p-4 rounded-lg bg-helix-500/10 border border-helix-500/20">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-helix-400 flex-shrink-0 mt-1" />
        <p className="text-sm text-text-secondary whitespace-pre-wrap">{greeting}</p>
      </div>
      {!isNewUser && (
        <p className="text-xs text-text-tertiary mt-3">📚 Remembering from {summary?.key_moments[0]?.created_at}</p>
      )}
    </div>
  );
}
```

**Owner**: Engineer 2
**Time**: 3 hours (including testing)

### Day 6-7: Memory References in Chat (8 hours)

**File**: `web/src/components/memory/MemoryReference.tsx`

When assistant mentions a past conversation, show a badge:

```typescript
export function MemoryReference({
  timestamp,
  confidenceScore
}: {
  timestamp: string,
  confidenceScore: number
}) {
  return (
    <div className="inline-flex items-center gap-1.5 ml-2 px-2 py-1 rounded-full bg-helix-500/20 border border-helix-500/30 text-xs text-helix-300">
      <span>📚</span>
      <span>Remembering ({formatDate(timestamp)})</span>
      <span className="opacity-50">({Math.round(confidenceScore * 100)}%)</span>
    </div>
  );
}
```

Integrate into message rendering:
- Detect when assistant mentions past context
- Add reference badge with timestamp
- Make clickable to show original conversation

**Owner**: Engineer 2
**Time**: 4 hours

### Day 7-8: Memory Dashboard Page (16 hours)

**File**: `web/src/pages/Memories.tsx`

Create new dashboard tab showing:

1. **Key Moments Section**
   - Top 10 emotionally salient memories
   - Sort by salience_score
   - Show emotion radar for each
   - Allow edit/delete/mark important

2. **Patterns Section**
   - Detected behavioral patterns
   - Emotional triggers
   - Coping strategies
   - Confidence scores

3. **Topics Section**
   - Most discussed topics
   - Conversation count per topic
   - Recent activity timeline

4. **Stats Section**
   - Total conversations: N
   - Memory coverage: X%
   - Last updated: when
   - User control: Privacy slider

```typescript
export function Memories() {
  const { instanceId } = useParams();
  const { summary, loading } = useMemory(instanceId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-white mb-2">
          What I Remember About You
        </h1>
        <p className="text-text-secondary">
          {summary?.key_moments.length || 0} key moments ·
          {summary?.patterns.length || 0} patterns detected
        </p>
      </div>

      <KeyMomentsSection memories={summary?.key_moments} />
      <PatternsSection patterns={summary?.patterns} />
      <TopicsSection topics={summary?.topics} />
    </div>
  );
}
```

**Owner**: Engineer 2
**Time**: 8 hours (including sub-components)

### Day 8-9: Testing & Refinement (16 hours)

#### Component Tests
- Test MemoryGreeting with new/returning users
- Test MemoryReference badge rendering
- Test Memory Dashboard data loading
- Test edit/delete functionality

#### Performance Testing
- Memory retrieval: < 100ms
- Dashboard load: < 500ms
- Search performance: < 200ms
- Embedding generation: < 5s

#### Manual QA
- Test on desktop + mobile
- Test with 0, 10, 100+ memories
- Test privacy controls
- Test edit/delete flows
- Test accessibility

**Deliverable**: All components tested, responsive, accessible
**Owner**: Engineers 2 & 3
**Time**: 8 hours

### Day 9-10: Integration & Polish (16 hours)

#### Integration
- Connect Memory Greeting to Code page
- Add Memory Dashboard tab to navigation
- Add Memory settings to Settings page
- Connect privacy controls to API

#### Polish
- Animations for emotion visualizations
- Loading states for all components
- Error handling + fallbacks
- Empty state messaging

#### Documentation
- Inline code comments
- TSDoc for all services
- User guide for Memory features
- API documentation

**Deliverable**: Feature complete and polished
**Owner**: Engineers 2 & 3
**Time**: 8 hours

---

## Parallel Work Strategy

### Option 1: Sequential (Safe, 10 days)
- Days 1-2: All engineers on database + types
- Days 2-5: Engineers 1+2 on services, Engineer 3 on testing
- Days 6-10: Engineer 2 on components, Engineer 3 on testing

### Option 2: Parallel (Faster, 6 days)
- Days 1: Engineer 3 on database while Engineers 1+2 start services
- Days 2-4: All three in parallel
  - Engineer 1: Services → tests
  - Engineer 2: Hooks → integration
  - Engineer 3: Repository → testing infrastructure
- Days 5-6: Components + final testing

**Recommended**: Parallel approach saves 3-4 days.

---

## Success Checkpoints

### Checkpoint 1: Day 2 End
- [ ] Database migrations pushed successfully
- [ ] TypeScript types defined, no compilation errors
- [ ] Environment variables verified

### Checkpoint 2: Day 4 End
- [ ] All services built and unit tested
- [ ] Memory repository working with real database
- [ ] Integration with chat working end-to-end
- [ ] One manual conversation stored successfully

### Checkpoint 3: Day 6 End
- [ ] Memory Greeting showing correct message
- [ ] Memory References rendering in chat
- [ ] Memory Dashboard loading data
- [ ] No console errors

### Checkpoint 4: Day 8 End
- [ ] All components responsive and accessible
- [ ] Performance benchmarks met
- [ ] No memory leaks
- [ ] Ready for beta testing

### Final Checkpoint: Day 10 End
- [ ] Feature complete
- [ ] All tests passing (>90% coverage)
- [ ] Documentation complete
- [ ] Ready for production deploy

---

## Blockers & Contingencies

| Blocker | Probability | Solution | Time Impact |
|---------|-------------|----------|-------------|
| Claude API quota exceeded | Low | Request increase, batch requests | +1 day if needed |
| OpenAI embedding errors | Low | Fallback to simpler algorithm | +0.5 days |
| Supabase pgvector issues | Very Low | Contact support, use RDS vector | +2 days |
| React component complexity | Medium | Use existing patterns, don't over-engineer | +1 day |
| Type safety issues | Medium | Incremental typing, use unknown not any | +0.5 days |

**Contingency Plan**:
- If Day 4 end slips, compress Days 5-6 into long day
- If components slip, reduce features to MVP (just greeting + dashboard)
- If blocked on infrastructure, pivot to mock data while waiting

---

## Definition of Done

### Code Quality
- ✅ TypeScript strict mode (no `any`)
- ✅ All functions have return types
- ✅ No unused imports
- ✅ ESLint passing
- ✅ Prettier formatting applied

### Testing
- ✅ >90% code coverage
- ✅ All happy path tests passing
- ✅ Error cases handled
- ✅ Integration tests passing
- ✅ Manual QA sign-off

### Performance
- ✅ Memory retrieval < 100ms
- ✅ Dashboard load < 500ms
- ✅ Search < 200ms
- ✅ Embedding generation < 5s
- ✅ No memory leaks

### User Experience
- ✅ Responsive (mobile + desktop)
- ✅ Accessible (keyboard nav, screen reader)
- ✅ Clear error messages
- ✅ Proper loading states
- ✅ Intuitive controls

### Documentation
- ✅ Inline code comments
- ✅ TSDoc on all functions
- ✅ README for memory features
- ✅ API docs complete
- ✅ User guide complete

---

## Metrics to Track

### Week 1 Goals
- Services: 100% unit test coverage
- Integration: 1 real conversation → emotion → storage in < 2 seconds
- Quality: 0 TypeScript errors, ESLint warnings < 5

### Week 2 Goals
- Components: 90% test coverage
- Performance: Dashboard loads in < 500ms
- UX: All components responsive + accessible

### Phase 1 Final Goals
- Day 2 retention: 50%+ (from 18%)
- Memory accuracy: 85%+ (manual validation)
- Dashboard visits: 40%+ of users
- Performance: All metrics met
- Quality: 0 production bugs in first week

---

## Next Steps After Phase 1

Once Phase 1 ships successfully:
1. **Week 3**: Begin Phase 2 (agent selector UI + orchestration)
2. **Week 4**: Parallel Phase 2 + Phase 3 prep
3. **Week 5**: Phase 3 implementation (autonomy levels + action log)
4. **Week 6**: Integration + refinement + beta testing
5. **Week 7+**: Iterate based on user feedback + scale

---

## Questions Before Starting?

Review the spec and implementation plan above. If anything is unclear:
1. Phase 1 Memory Spec: [PHASE-1-MEMORY-IMPLEMENTATION-SPEC.md](PHASE-1-MEMORY-IMPLEMENTATION-SPEC.md)
2. Technical Details: [TECHNICAL-READINESS-ASSESSMENT.md](TECHNICAL-READINESS-ASSESSMENT.md)
3. Full Architecture: [ALL-PHASES-SUMMARY.md](ALL-PHASES-SUMMARY.md)

**Ready to kick off Week 1 on Day 1?**

Confirm:
1. ✅ OpenAI API key added to `.env`
2. ✅ pgvector extension enabled in Supabase
3. ✅ Team members assigned and ready
4. ✅ Schedule clear for 2 weeks
5. ✅ Any blockers resolved

Then we begin 🚀
