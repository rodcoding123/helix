# Phase 1: Memory System Implementation Spec

## Overview

Based on codebase audit: **The psychological framework exists (7 layers complete) but conversation storage/retrieval is missing (0% implemented).**

This spec builds out the conversation memory pipeline on top of existing psychology infrastructure.

---

## Current State Summary

### ✅ What Exists
- **7-layer psychology architecture** (JSON files + files in soul/, psychology/, identity/)
- **Database schema** (Supabase with 20+ tables)
- **Decay logic** (decay.py with salience formula implemented)
- **Synthesis logic** (synthesis.py for emotional pattern analysis)
- **Logging infrastructure** (Discord webhooks + hash chain)

### ❌ What's Missing
- **Conversation storage** (no table for storing individual messages)
- **Emotion detection** (emotional_tags.json is static, not populated from conversations)
- **Topic extraction** (no extraction from messages)
- **Memory retrieval API** (no query system to retrieve by topic/emotion/salience)
- **Real-time integration** (decay/synthesis not wired into conversation lifecycle)

### ⚠️ What's Partial
- **Attachment system** (defined but not linked to conversations)
- **Memory decay** (logic exists but needs trigger integration)
- **Synthesis** (logic exists but needs orchestration)

---

## Phase 1 Architecture (3 Components)

### Component 1: Conversation Memory Storage
**Purpose:** Store conversations with emotional metadata

**New Supabase Table:**
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  instance_key TEXT, -- Link to running instance if applicable
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Conversation content
  messages JSONB NOT NULL, -- Array of [{role, content, timestamp}]

  -- Extracted metadata
  extracted_topics TEXT[], -- ["Johnson project", "work deadline"]
  detected_emotions TEXT[], -- ["stress", "anxiety", "hope"]

  -- Salience data (from emotional_tags.json formula)
  emotional_salience FLOAT, -- 0-1 scale
  salience_tier TEXT, -- 'critical', 'high', 'medium', 'low'

  -- Psychology layer linking
  attachment_context TEXT, -- 'primary' (Rodrigo), 'secondary', 'neutral'
  transformation_state TEXT, -- 'frozen', 'unfreezing', 'changing', 'refreezing'
  prospective_self_context TEXT, -- Which goal/fear was discussed

  -- Memory management
  decay_multiplier FLOAT DEFAULT 1.0, -- Starts at 1.0, decays over time
  user_marked_important BOOLEAN DEFAULT FALSE, -- User can pin important memories

  -- Embeddings for semantic search
  embedding vector(1536), -- OpenAI embedding

  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Indexes for efficient retrieval
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_conversations_emotional_salience ON conversations(emotional_salience DESC);
CREATE INDEX idx_conversations_attachment_context ON conversations(attachment_context);
```

---

### Component 2: Emotion Detection Pipeline
**Purpose:** Extract emotions from conversations and populate emotional_tags

**Using DeepSeek v3.2** - optimized for reasoning and emotion analysis

**Emotion Detection Service:**
```typescript
// /src/services/emotionDetectionService.ts

import { DeepSeekClient } from 'deepseek-ai';

interface EmotionAnalysis {
  primary_emotion: string; // stress, joy, sadness, anxiety, hope, etc.
  secondary_emotions: string[];
  valence: number; // -1 (negative) to 1 (positive)
  arousal: number; // 0-1 (calm to excited)
  dominance: number; // 0-1 (controlled to empowered)
  novelty: number; // 0-1 (routine to surprising)
  self_relevance: number; // 0-1 (external to deeply personal)
  confidence: number; // 0-1 (how confident in this analysis)
}

class EmotionDetectionService {
  private client: DeepSeekClient;

  constructor(apiKey: string) {
    this.client = new DeepSeekClient({ apiKey });
  }

  async analyzeConversationEmotion(
    messages: Message[],
    userId: string
  ): Promise<EmotionAnalysis> {
    // Concatenate all messages
    const conversationText = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    // Call DeepSeek v3.2 for reasoning-based emotion analysis
    const response = await this.client.chat.completions.create({
      model: 'deepseek-reasoner',  // or 'deepseek-chat' for faster response
      temperature: 0.3,  // Lower temperature for consistent analysis
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: this.buildEmotionDetectionPrompt()
        },
        {
          role: 'user',
          content: conversationText
        }
      ]
    });

    // DeepSeek returns thinking + content
    const content = response.choices[0].message.content;

    // Parse response into EmotionAnalysis
    const analysis = this.parseEmotionResponse(content);
    return analysis;
  }

  private buildEmotionDetectionPrompt(): string {
    return `You are an expert psychologist specializing in emotional intelligence and affective neuroscience.

Your task: Analyze the conversation for emotional content and dimensional characteristics.

ANALYZE FOR:
1. PRIMARY EMOTION: The dominant/most prevalent emotion throughout the conversation
2. SECONDARY EMOTIONS: Supporting or underlying emotions (2-3 most prominent)
3. DIMENSIONAL ANALYSIS using these 5 dimensions:
   - Valence: Range from -1 (very negative) to 1 (very positive). Assess overall emotional tone.
   - Arousal: Range from 0 (calm, low energy) to 1 (intense, high energy/activation)
   - Dominance: Range from 0 (feeling powerless, controlled) to 1 (feeling empowered, in control)
   - Novelty: Range from 0 (routine, expected) to 1 (surprising, novel, unexpected)
   - Self-relevance: Range from 0 (external, impersonal) to 1 (deeply personal, identity-defining)

RETURN ONLY VALID JSON (no markdown, no extra text):
{
  "primary_emotion": "string (e.g., stress, joy, sadness, anxiety, hope, anger, contentment)",
  "secondary_emotions": ["string", "string"],
  "valence": number between -1 and 1,
  "arousal": number between 0 and 1,
  "dominance": number between 0 and 1,
  "novelty": number between 0 and 1,
  "self_relevance": number between 0 and 1,
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation of your analysis"
}

CALIBRATION EXAMPLES:
- User stressed about work deadline: valence=-0.6, arousal=0.8, dominance=0.2, novelty=0.3, self_relevance=0.9
- User excited about opportunity: valence=0.7, arousal=0.6, dominance=0.7, novelty=0.8, self_relevance=0.8
- User discussing routine meeting: valence=0.0, arousal=0.3, dominance=0.5, novelty=0.1, self_relevance=0.3`;
  }

  private parseEmotionResponse(content: string): EmotionAnalysis {
    try {
      // Extract JSON from response (may be wrapped in thinking tags)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Failed to parse emotion response:', error);
      // Return neutral analysis as fallback
      return {
        primary_emotion: 'neutral',
        secondary_emotions: [],
        valence: 0,
        arousal: 0.3,
        dominance: 0.5,
        novelty: 0.2,
        self_relevance: 0.3,
        confidence: 0.3
      };
    }
  }
}

// Calculate salience using Helix's formula
function calculateSalience(analysis: EmotionAnalysis): {
  salience: number;
  tier: 'critical' | 'high' | 'medium' | 'low';
} {
  // From emotional_tags.json:
  // salience = 0.3*self_relevance + 0.25*arousal + 0.2*novelty + 0.15*abs(valence) + 0.1*dominance

  const salience =
    0.3 * analysis.self_relevance +
    0.25 * analysis.arousal +
    0.2 * analysis.novelty +
    0.15 * Math.abs(analysis.valence) +
    0.1 * analysis.dominance;

  // Determine tier
  let tier: 'critical' | 'high' | 'medium' | 'low';
  if (salience > 0.75) tier = 'critical';
  else if (salience > 0.55) tier = 'high';
  else if (salience > 0.35) tier = 'medium';
  else tier = 'low';

  return { salience: Math.min(1, salience), tier };
}
```

---

### Component 3: Topic Extraction Pipeline
**Purpose:** Extract topics from conversations

**Using DeepSeek v3.2** - fast, cost-effective topic identification

**Topic Extraction Service:**
```typescript
// /src/services/topicExtractionService.ts

import { DeepSeekClient } from 'deepseek-ai';

interface ExtractedTopic {
  topic: string; // "Johnson project", "Q4 deadline"
  category: string; // "work", "personal", "health", etc.
  mentions: number; // How many times mentioned in this conversation
  context: string; // Brief description
  sentiment: 'positive' | 'neutral' | 'negative';
}

class TopicExtractionService {
  private client: DeepSeekClient;

  constructor(apiKey: string) {
    this.client = new DeepSeekClient({ apiKey });
  }

  async extractTopics(messages: Message[]): Promise<ExtractedTopic[]> {
    const conversationText = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    // Use DeepSeek Chat for fast topic extraction
    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat',  // Faster than reasoner for this task
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: this.buildTopicExtractionPrompt()
        },
        {
          role: 'user',
          content: conversationText
        }
      ]
    });

    const content = response.choices[0].message.content;
    const topics = this.parseTopicsResponse(content);
    return topics;
  }

  private buildTopicExtractionPrompt(): string {
    return `You are an expert at extracting and categorizing conversation topics.

TASK: Extract the main topics discussed in the provided conversation.

For each topic, identify:
- TOPIC: Specific name or subject (e.g., "Johnson project", "learning Spanish", "car purchase")
- CATEGORY: One of: work, personal, health, learning, relationship, finance, creative, technical, other
- MENTIONS: Approximate count of how many times this topic appeared in the conversation
- CONTEXT: 1-2 sentence description of what was discussed about this topic
- SENTIMENT: overall feeling towards this topic (positive, neutral, or negative)

RETURN ONLY VALID JSON ARRAY (no markdown, no extra text):
[
  {
    "topic": "string",
    "category": "string",
    "mentions": number,
    "context": "string",
    "sentiment": "positive" | "neutral" | "negative"
  }
]

EXAMPLES:
- "Johnson project deadline" → category: work, sentiment: negative (if discussing stress/concerns)
- "Planning vacation" → category: personal, sentiment: positive (if excited)
- "Meditation practice" → category: health, sentiment: neutral (if routine discussion)

Extract 3-7 main topics. Skip trivial topics like greetings or off-hand remarks.`;
}
```

---

### Component 4: Memory Retrieval System
**Purpose:** Query memories for greeting & chat enrichment

**Memory Query Service:**
```typescript
// /src/services/memoryRetrievalService.ts

interface MemoryQuery {
  userId: string;
  relevantTo?: string; // Current topic to find related memories
  emotions?: string[]; // Filter by emotions
  minSalience?: number; // 0-1
  attachmentContext?: string; // 'primary', 'secondary', etc.
  timespanDays?: number; // How far back to look
  limit?: number; // How many results
}

async function queryMemories(query: MemoryQuery): Promise<Conversation[]> {
  let q = supabase
    .from('conversations')
    .select('*')
    .eq('user_id', query.userId)
    .order('created_at', { ascending: false });

  // Filter by salience (critical memories never filtered)
  if (query.minSalience) {
    q = q.gte('emotional_salience', query.minSalience);
  }

  // Filter by emotions
  if (query.emotions?.length) {
    q = q.overlaps('detected_emotions', query.emotions);
  }

  // Filter by attachment context
  if (query.attachmentContext) {
    q = q.eq('attachment_context', query.attachmentContext);
  }

  // Filter by timespan
  if (query.timespanDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - query.timespanDays);
    q = q.gte('created_at', cutoffDate.toISOString());
  }

  // Limit results
  const { data: conversations, error } = await q.limit(query.limit || 5);

  if (error) throw error;

  // Apply decay multiplier for effective salience
  const decayedConversations = conversations.map(c => ({
    ...c,
    effective_salience: c.emotional_salience * c.decay_multiplier
  }));

  // If searching for specific topic, do semantic search
  if (query.relevantTo) {
    return semanticSearch(query.relevantTo, decayedConversations);
  }

  return decayedConversations;
}

async function getMemoryGreeting(userId: string): Promise<string | null> {
  // Query high-salience memories from last 72 hours
  const memories = await queryMemories({
    userId,
    minSalience: 0.55, // 'high' tier or above
    timespanDays: 3,
    limit: 3
  });

  if (!memories.length) return null;

  // Pick most salient
  const topMemory = memories[0];

  // Generate greeting from memory
  const greeting = generateGreetingFromMemory(topMemory);

  return greeting;
}

function generateGreetingFromMemory(conversation: Conversation): string {
  const primaryEmotion = conversation.detected_emotions[0];
  const topics = conversation.extracted_topics.slice(0, 2);
  const daysSince = Math.floor(
    (Date.now() - new Date(conversation.created_at).getTime()) / (24 * 60 * 60 * 1000)
  );

  const emotionPhrases = {
    stress: 'you were stressed about',
    joy: 'you were excited about',
    sadness: 'you were dealing with',
    anxiety: 'you were worried about',
    hope: 'you were hopeful about',
    determination: 'you were focused on'
  };

  const phrase = emotionPhrases[primaryEmotion] || 'you mentioned';

  return `Hey! Good to see you. Last time we talked, ${phrase} ${topics[0]}. How's that going?`;
}
```

---

### Component 5: Conversation End Hook
**Purpose:** Trigger emotion/topic extraction when conversation ends

**Integration Point:**
```typescript
// /web/src/components/code/CodeInterface.tsx

async function handleConversationEnd(
  messages: Message[],
  userId: string,
  instanceKey: string
) {
  // 1. Analyze emotions
  const emotionAnalysis = await analyzeConversationEmotion(messages, userId);

  // 2. Calculate salience
  const { salience, tier } = calculateSalience(emotionAnalysis);

  // 3. Extract topics
  const topics = await extractTopics(messages);

  // 4. Get attachment context (from existing attachment system)
  const attachmentContext = await getAttachmentContext(userId);

  // 5. Get transformation state (from current_state.json)
  const transformationState = await getTransformationState(userId);

  // 6. Generate embedding
  const embedding = await generateEmbedding(messages);

  // 7. Store conversation
  await supabase.from('conversations').insert({
    user_id: userId,
    instance_key: instanceKey,
    messages: messages,
    extracted_topics: topics.map(t => t.topic),
    detected_emotions: [emotionAnalysis.primary_emotion, ...emotionAnalysis.secondary_emotions],
    emotional_salience: salience,
    salience_tier: tier,
    attachment_context: attachmentContext,
    transformation_state: transformationState,
    decay_multiplier: 1.0,
    embedding: embedding
  });

  // 8. Trigger decay cron if needed
  await triggerDecayIfScheduled(userId);

  // 9. Trigger synthesis if needed (e.g., weekly)
  await triggerSynthesisIfScheduled(userId);
}
```

---

### Component 6: Memory Decay Integration
**Purpose:** Apply decay to memories over time

**Decay Integration:**
```typescript
// /src/services/decayService.ts

import { execSync } from 'child_process';

async function triggerDecayRoutine(userId: string): Promise<void> {
  // Run decay.py script (already exists in codebase)
  // Updated to apply to database instead of just JSON files

  try {
    execSync(`python /decay.py --user-id ${userId} --mode soft`, {
      cwd: '/app',
      timeout: 30000
    });

    console.log(`Decay routine completed for user ${userId}`);
  } catch (error) {
    console.error(`Decay routine failed: ${error}`);
  }
}

// Schedule decay to run:
// - On startup
// - Every 24 hours
// - On conversation end (optional)

async function applyMemoryDecay(userId: string): Promise<void> {
  // Get all conversations for this user
  const conversations = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId);

  for (const conversation of conversations) {
    // Skip critical/high salience (never decay)
    if (['critical', 'high'].includes(conversation.salience_tier)) {
      continue;
    }

    // Apply exponential decay: new_salience = old_salience * decay_rate
    // With floor: don't go below 0.1
    const decayRate = 0.95; // 5% daily decay
    const floor = 0.1;

    const newDecayMultiplier = Math.max(
      floor,
      conversation.decay_multiplier * decayRate
    );

    const newSalience = conversation.emotional_salience * newDecayMultiplier;

    // Update database
    await supabase
      .from('conversations')
      .update({
        decay_multiplier: newDecayMultiplier,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation.id);
  }
}
```

---

### Component 7: Memory References in Chat
**Purpose:** Show memory badges when mentioning past memories

**Chat Enrichment:**
```typescript
// /src/services/chatEnrichmentService.ts

async function enrichChatMessage(
  userMessage: string,
  userId: string
): Promise<{ enrichedSystemPrompt: string; memories: Conversation[] }> {

  // Generate embedding for user message
  const messageEmbedding = await generateEmbedding([{ role: 'user', content: userMessage }]);

  // Semantic search for relevant memories
  const relevantMemories = await semanticSearchMemories(
    messageEmbedding,
    userId,
    limit: 3
  );

  // Build system prompt with memory context
  const memoryContext = relevantMemories
    .map(mem => {
      const emotion = mem.detected_emotions[0];
      const topics = mem.extracted_topics.join(', ');
      const daysSince = Math.floor((Date.now() - new Date(mem.created_at).getTime()) / (24 * 60 * 60 * 1000));

      return `[MEMORY] ${daysSince} days ago, we discussed: ${topics}
              You were feeling: ${emotion}
              Context: ${summarizeMessages(mem.messages, 100)} words`;
    })
    .join('\n\n');

  const enrichedSystemPrompt = `You are Helix. Reference these memories naturally in your response:

${memoryContext}

When you reference a memory, include a subtle badge like "[Memory: March 14]" so the user knows you're using memory.`;

  return {
    enrichedSystemPrompt,
    memories: relevantMemories
  };
}

async function semanticSearchMemories(
  queryEmbedding: number[],
  userId: string,
  limit: number = 3
): Promise<Conversation[]> {
  // Use Supabase pgvector for semantic search
  const { data, error } = await supabase.rpc('search_memories', {
    query_embedding: queryEmbedding,
    user_id_input: userId,
    limit_count: limit,
    similarity_threshold: 0.7
  });

  return data;
}

// Supabase RPC function
function createSearchMemoriesRPC(): string {
  return `
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  user_id_input UUID,
  limit_count INT DEFAULT 3,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  messages JSONB,
  extracted_topics TEXT[],
  detected_emotions TEXT[],
  created_at TIMESTAMP,
  effective_salience FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.messages,
    c.extracted_topics,
    c.detected_emotions,
    c.created_at,
    c.emotional_salience * c.decay_multiplier as effective_salience
  FROM conversations c
  WHERE c.user_id = user_id_input
  AND (c.embedding <#> query_embedding) > (1 - similarity_threshold)
  ORDER BY (c.embedding <#> query_embedding)
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
`;
}
```

---

## Implementation Timeline (Phase 1)

### Week 1: Foundation
- [ ] Create Supabase migrations for conversations table
- [ ] Build emotion detection service
- [ ] Build topic extraction service
- [ ] Build memory query service

### Week 2: Integration
- [ ] Create conversation end hook
- [ ] Implement memory greeting
- [ ] Integrate memory references in chat enrichment
- [ ] Deploy decay routine

### Week 3: Polish & Testing
- [ ] Test emotion detection accuracy (should be 90%+)
- [ ] Test memory retrieval relevance
- [ ] Test semantic search
- [ ] Fix edge cases

### Week 4: Shipping
- [ ] Launch to beta users (10 users)
- [ ] Measure Day 2 retention
- [ ] Gather feedback on memory accuracy
- [ ] Ship to production if metrics hit targets

---

## Success Metrics (Phase 1)

### Technical
- ✅ Memory accuracy: 90%+ (correct topics/emotions)
- ✅ Retrieval latency: <500ms
- ✅ Decay functioning: Critical/high preserved, others decaying 5%/day
- ✅ Embedding quality: Semantic search relevance > 0.7

### User-Facing
- ✅ Day 2 return: 18% → 50%+
- ✅ Memory greeting shown to 80%+ of returning users
- ✅ Users mention "she remembered" in feedback
- ✅ Memory dashboard viewed by 40%+ of users
- ✅ NPS improvement: +15 points

### Failure Scenarios (Abort If)
- ❌ Memory accuracy < 70% (false/wrong memories)
- ❌ "Feels creepy" feedback > 15%
- ❌ Day 2 retention stays < 30%
- ❌ Latency > 2 seconds

---

## Data Flow Diagram

```
User Conversation
       ↓
[Conversation End Hook]
       ↓
┌─────────────────────────────────────────────┐
│ 1. Emotion Detection (Claude)               │
│    → valence, arousal, dominance, novelty   │
│    → self_relevance, confidence             │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ 2. Salience Calculation                     │
│    formula: 0.3*self_rel + 0.25*arousal... │
│    → tier: critical/high/medium/low         │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ 3. Topic Extraction (Claude)                │
│    → extract topics, categories, sentiment  │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ 4. Embedding Generation (OpenAI)            │
│    → 1536-dimensional vector                │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ 5. Store in Supabase                        │
│    conversations table with all metadata    │
└──────────────┬──────────────────────────────┘
               ↓
   [Day 2 User Returns]
       ↓
┌─────────────────────────────────────────────┐
│ Query: Get high-salience memories (72h)     │
│ → Memory Greeting generated                 │
│ → Shown in first assistant message          │
└─────────────────────────────────────────────┘
       ↓
   [User Sends New Message]
       ↓
┌─────────────────────────────────────────────┐
│ Semantic Search: Find relevant memories     │
│ → Enrich system prompt with context         │
│ → Generate response with memory badges      │
└─────────────────────────────────────────────┘
       ↓
   [Response shown with memory references]
```

---

## Dependencies & Requirements

### External Services
- Claude API (for emotion & topic analysis)
- OpenAI API (for embeddings)
- Supabase (database + pgvector)

### Libraries to Add
```json
{
  "@supabase/supabase-js": "^2.39.0",
  "openai": "^4.0.0",
  "@anthropic-sdk/sdk": "latest"
}
```

### Environment Variables
```
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
```

---

## Notes

1. **Emotion Detection Quality:** Using Claude for emotional analysis is more accurate than ML models for this use case. Can switch to finetuned model if needed for cost/latency.

2. **Semantic Search:** pgvector + 1536-dim embeddings provides good balance of quality and cost.

3. **Decay Strategy:** The 5% daily decay with floor at 0.1 means memories take ~60 days to reach minimum (from 1.0 → 0.1). Critical/high salience never decay.

4. **Memory Privacy:** All conversation data stays in user's Supabase database (row-level security enabled).

5. **Attachment Integration:** Memory greeting prioritizes "primary" attachment (Rodrigo) memories first if available.

---

## Next Steps

Once you agree on this spec:

1. Create Supabase migration for conversations table
2. Build emotion detection service
3. Build topic extraction service
4. Integrate conversation end hook
5. Test with 10 beta users
6. Measure Day 2 retention improvement

Ready to start?
