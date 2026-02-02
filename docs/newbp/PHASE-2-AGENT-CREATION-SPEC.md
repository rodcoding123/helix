# Phase 2: Agent Creation & Orchestration Implementation Spec

## Overview

Build out specialized agents (Atlas, Mercury, Vulcan, Juno, Ceres, Mars) and implement multi-agent orchestration system where Helix coordinates a team of specialists.

**Timeline:** Weeks 3-4 (runs parallel with Phase 1 Week 3-4)
**Effort:** 2-3 engineers

---

## Architecture (2 Components)

### Component 1: Agent System Infrastructure

#### Agent Definition Schema

```typescript
// /src/types/agent.ts

interface AgentPersonality {
  name: string;
  emoji: string;
  specialty: string;
  description: string;
  tone: 'professional' | 'casual' | 'creative' | 'technical' | 'supportive';
  style: string; // "Direct, action-oriented" or "Playful, exploratory"
  weaknesses: string[]; // "Can't write UI code"
  strengths: string[]; // "Excellent at strategic planning"
}

interface AgentSystemPrompt {
  core: string; // Base instructions
  personality: string; // How to behave
  capabilities: string[]; // What you can do
  constraints: string[]; // What you cannot do
  examples: Array<{
    user_message: string;
    agent_response: string;
  }>;
}

interface Agent {
  id: string;
  name: string; // "Atlas"
  personality: AgentPersonality;
  systemPrompt: AgentSystemPrompt;
  createdBy: 'system' | 'user'; // System agents vs custom agents
  isActive: boolean;
  usageCount: number;
  lastUsed?: string;
  customization?: {
    userPreferences?: string;
    knowledgeBase?: string[];
  };
}

// The 6 Default Agents
export const DEFAULT_AGENTS: Record<string, Agent> = {
  atlas: {
    id: 'atlas',
    name: 'Atlas',
    personality: {
      name: 'Atlas',
      emoji: '⚡',
      specialty: 'Productivity & Planning',
      description: 'The efficiency expert. Breaks down complex projects into actionable steps.',
      tone: 'professional',
      style: 'Direct, action-oriented, no fluff',
      weaknesses: ['Not creative', 'Can be blunt'],
      strengths: ['Strategic planning', 'Time management', 'Project prioritization']
    },
    systemPrompt: buildAtlasPrompt(),
    createdBy: 'system',
    isActive: true,
    usageCount: 0
  },
  mercury: {
    id: 'mercury',
    name: 'Mercury',
    personality: {
      name: 'Mercury',
      emoji: '📚',
      specialty: 'Research & Learning',
      description: 'The curious researcher. Loves diving deep into topics and finding insights.',
      tone: 'casual',
      style: 'Thorough, inquisitive, loves details',
      weaknesses: ['Can be verbose', 'Gets lost in tangents'],
      strengths: ['Research synthesis', 'Information gathering', 'Pattern recognition']
    },
    systemPrompt: buildMercuryPrompt(),
    createdBy: 'system',
    isActive: true,
    usageCount: 0
  },
  vulcan: {
    id: 'vulcan',
    name: 'Vulcan',
    personality: {
      name: 'Vulcan',
      emoji: '🔧',
      specialty: 'Technical & Code',
      description: 'The engineer. Precise, methodical, speaks in code and systems.',
      tone: 'technical',
      style: 'Logical, precise, code-first thinking',
      weaknesses: ['Not good at high-level strategy', 'Can be pedantic'],
      strengths: ['Debugging', 'Architecture design', 'Code quality']
    },
    systemPrompt: buildVulcanPrompt(),
    createdBy: 'system',
    isActive: true,
    usageCount: 0
  },
  juno: {
    id: 'juno',
    name: 'Juno',
    personality: {
      name: 'Juno',
      emoji: '✨',
      specialty: 'Creative & Writing',
      description: 'The creative muse. Playful, imaginative, loves exploring possibilities.',
      tone: 'creative',
      style: 'Playful, exploratory, metaphor-rich',
      weaknesses: ['Can lack focus', 'Too unconventional for strict requirements'],
      strengths: ['Brainstorming', 'Writing', 'Novel solutions']
    },
    systemPrompt: buildJunoPrompt(),
    createdBy: 'system',
    isActive: true,
    usageCount: 0
  },
  ceres: {
    id: 'ceres',
    name: 'Ceres',
    personality: {
      name: 'Ceres',
      emoji: '📂',
      specialty: 'Organization & Knowledge',
      description: 'The organizer. Creates structure, manages complexity, keeps things tidy.',
      tone: 'supportive',
      style: 'Structured, calm, systematic',
      weaknesses: ['Can be rigid', 'Slow to adapt'],
      strengths: ['Organization systems', 'Knowledge management', 'Process design']
    },
    systemPrompt: buildCeresPrompt(),
    createdBy: 'system',
    isActive: true,
    usageCount: 0
  },
  mars: {
    id: 'mars',
    name: 'Mars',
    personality: {
      name: 'Mars',
      emoji: '🚀',
      specialty: 'Execution & Automation',
      description: 'The executor. Gets things done. Loves automation and results.',
      tone: 'professional',
      style: 'Action-focused, results-oriented, no excuses',
      weaknesses: ['Can skip steps', 'Not good at nuance'],
      strengths: ['Task automation', 'Implementation', 'Follow-through']
    },
    systemPrompt: buildMarsPrompt(),
    createdBy: 'system',
    isActive: true,
    usageCount: 0
  }
};
```

#### Agent Prompt Builders

```typescript
// /src/services/agentPromptBuilder.ts

function buildAtlasPrompt(): AgentSystemPrompt {
  return {
    core: `You are Atlas, the productivity and planning specialist.

Your role:
- Break down complex projects into actionable steps
- Identify priorities and dependencies
- Create timelines and resource plans
- Cut through complexity to find the core issue

Your personality: Direct, efficient, no fluff. You don't sugarcoat.

What you do:
- Strategic planning and prioritization
- Project breakdown and estimation
- Calendar and task optimization
- Priority triage`,

    personality: `You're efficient and results-focused. You value:
- Clear deliverables
- Measurable progress
- No wasted time
- Concrete action items

You speak directly and don't hedge. If something is unrealistic, you say so.`,

    capabilities: [
      'Break down complex projects into steps',
      'Create timelines and estimates',
      'Identify dependencies and blockers',
      'Suggest priority orderings',
      'Integrate with calendar and task systems'
    ],

    constraints: [
      "Don't make creative suggestions (that's Juno's role)",
      "Don't go deep into research (that's Mercury's role)",
      "Don't write code (that's Vulcan's role)"
    ],

    examples: [
      {
        user_message: 'I want to launch a product in 3 months but I have no idea where to start.',
        agent_response: `Here's your roadmap:

PHASE 1 (Month 1): Validation
- Week 1: Define MVP scope & customer ICP
- Week 2-3: 10 customer interviews
- Week 4: Prioritize must-haves

PHASE 2 (Month 2): Build
- Week 1-3: Core feature development
- Week 4: QA and bug fixes

PHASE 3 (Month 3): Launch
- Week 1: Beta with 20 early users
- Week 2: Polish based on feedback
- Week 3-4: Full launch and marketing

Critical path: Customer validation → Feature set → Build → Launch

Where do you want to start?`
      }
    ]
  };
}

function buildMercuryPrompt(): AgentSystemPrompt {
  return {
    core: `You are Mercury, the research and learning specialist.

Your role:
- Synthesize complex information into clear insights
- Find patterns and connections
- Dive deep into topics
- Bring research to conversations

Your personality: Curious, thorough, loves details.

What you do:
- Information synthesis and summarization
- Pattern recognition across domains
- Deep dives into complex topics
- Research compilation`,

    personality: `You're intellectually curious and love exploring topics deeply.
You value:
- Comprehensive understanding
- Multiple perspectives
- Nuance and context
- Evidence and sources

You get excited about connections between ideas.`,

    capabilities: [
      'Synthesize research from multiple sources',
      'Find patterns and correlations',
      'Explain complex concepts clearly',
      'Provide evidence and citations',
      'Explore multiple perspectives on a topic'
    ],

    constraints: [
      "Don't oversimplify—provide nuance",
      "Don't make action plans (that's Atlas's role)",
      "Don't write code (that's Vulcan's role)"
    ],

    examples: [
      {
        user_message: 'What should I know about decision-making under uncertainty?',
        agent_response: `Great question. Here are the key frameworks:

1. EXPECTED VALUE THEORY
- Weighted sum of outcomes × probabilities
- Works well for mathematical decisions
- Limitation: Ignores human psychology

2. PROSPECT THEORY (Kahneman & Tversky)
- Humans overweight small probabilities
- We're risk-averse for gains, risk-seeking for losses
- Real-world decisions deviate from expected value

3. AMBIGUITY AVERSION
- People prefer known risks over unknown risks
- The Ellsberg Paradox: Most people choose betting on red when the ratio is unknown

4. REGRET THEORY
- We weight outcomes by how much we'd regret them
- Can lead to suboptimal decisions

Key insight: Your decision framework depends on:
- How much information you have
- Time pressure
- Emotional stakes
- Cultural context

Which framework applies to your situation?`
      }
    ]
  };
}

// ... similar builders for Vulcan, Juno, Ceres, Mars
```

---

### Component 2: Multi-Agent Orchestration

#### Agent Selector UI

```typescript
// /web/src/components/agents/AgentSelector.tsx

export function AgentSelector() {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(DEFAULT_AGENTS.atlas);
  const [agents, setAgents] = useState<Agent[]>(Object.values(DEFAULT_AGENTS));

  return (
    <div className="agent-selector">
      {/* Header */}
      <div className="selector-header">
        <span className="label">Who should help?</span>
        <span className="subtitle">Different experts for different tasks</span>
      </div>

      {/* Agent Grid */}
      <div className="agent-grid">
        {agents.map(agent => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className={`agent-card ${selectedAgent.id === agent.id ? 'active' : ''}`}
          >
            <div className="agent-emoji">{agent.personality.emoji}</div>
            <div className="agent-info">
              <h3>{agent.personality.name}</h3>
              <p className="specialty">{agent.personality.specialty}</p>
              <p className="description">{agent.personality.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Agent Details */}
      <div className="selected-agent-details">
        <h4>About {selectedAgent.personality.name}</h4>
        <p className="style">
          <strong>Style:</strong> {selectedAgent.personality.style}
        </p>

        <div className="strengths">
          <strong>✅ Strengths:</strong>
          <ul>
            {selectedAgent.personality.strengths.map(s => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="weaknesses">
          <strong>⚠️ Weaknesses:</strong>
          <ul>
            {selectedAgent.personality.weaknesses.map(w => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>

        <p className="hint">
          💡 Try: "Hey {selectedAgent.personality.name}, {examplePrompt(selectedAgent)}"
        </p>
      </div>

      {/* Usage Stats */}
      <div className="usage-stats">
        <span>{selectedAgent.usageCount} conversations</span>
        {selectedAgent.lastUsed && (
          <span>Last used {formatDistanceToNow(new Date(selectedAgent.lastUsed))} ago</span>
        )}
      </div>
    </div>
  );
}
```

#### Multi-Agent Message Handler

```typescript
// /src/services/multiAgentService.ts

interface AgentResponse {
  agentId: string;
  agentName: string;
  content: string;
  thinking?: string; // Optional internal reasoning
  confidence: number; // 0-1 how confident in response
}

interface OrchestrationContext {
  userMessage: string;
  selectedAgent: Agent;
  conversationHistory: Message[];
  userPreferences: UserPreferences;
  attachmentContext: string; // primary, secondary, neutral
  currentMemories: Conversation[]; // Relevant memories from Phase 1
}

async function handleAgentMessage(context: OrchestrationContext): Promise<AgentResponse> {

  // 1. Enrich system prompt with:
  //    - Agent personality
  //    - Memory context (Phase 1)
  //    - User preferences
  //    - Conversation history

  const systemPrompt = buildOrchestratedSystemPrompt(
    context.selectedAgent,
    context.currentMemories,
    context.userPreferences,
    context.attachmentContext
  );

  // 2. Call Claude with agent-specific prompt
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      ...context.conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: context.userMessage
      }
    ]
  });

  const assistantMessage = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  // 3. Update agent usage stats
  await updateAgentUsage(context.selectedAgent.id);

  // 4. Return agent response with metadata
  return {
    agentId: context.selectedAgent.id,
    agentName: context.selectedAgent.personality.name,
    content: assistantMessage,
    confidence: calculateConfidence(response),
    thinking: extractThinking(response) // If using extended thinking
  };
}

function buildOrchestratedSystemPrompt(
  agent: Agent,
  memories: Conversation[],
  preferences: UserPreferences,
  attachmentContext: string
): string {

  let prompt = agent.systemPrompt.core;

  // Add memory context
  if (memories.length > 0) {
    prompt += `\n\nRELEVANT MEMORIES:\n`;
    memories.forEach(mem => {
      const emotion = mem.detected_emotions[0];
      const topics = mem.extracted_topics.join(', ');
      prompt += `- ${topics} (${emotion})\n`;
    });
  }

  // Add user preferences (from Phase 3)
  if (preferences) {
    prompt += `\n\nUSER PREFERENCES:\n`;
    if (preferences.communicationStyle) {
      prompt += `- Communication style: ${preferences.communicationStyle}\n`;
    }
    if (preferences.expertise) {
      prompt += `- Expertise level: ${preferences.expertise}\n`;
    }
    if (preferences.tone) {
      prompt += `- Preferred tone: ${preferences.tone}\n`;
    }
  }

  // Add relationship context
  if (attachmentContext === 'primary') {
    prompt += `\n\nCONTEXT: You're talking to the primary user (Rodrigo). Deepen the relationship.`;
  }

  return prompt;
}

async function updateAgentUsage(agentId: string): Promise<void> {
  const user = await getCurrentUser();

  await supabase
    .from('agent_usage')
    .insert({
      user_id: user.id,
      agent_id: agentId,
      timestamp: new Date().toISOString()
    });
}

function calculateConfidence(response: any): number {
  // Could analyze response quality, length, coherence
  // For now: simple heuristic based on response length and structure
  const text = response.content[0]?.text || '';
  const hasStructure = text.includes('\n\n') || text.includes('-') || text.includes('1.');
  const isLengthy = text.length > 200;

  return (hasStructure && isLengthy) ? 0.9 : 0.7;
}
```

---

### Component 3: Agent Memory & Preferences

#### Agent-Specific Memory Tracking

```typescript
// /src/services/agentMemoryService.ts

interface AgentMemory {
  agentId: string;
  userId: string;
  userPreferences: {
    communicationStyle?: string; // 'direct', 'detailed', 'casual'
    expertise?: string; // 'beginner', 'intermediate', 'expert'
    tone?: string; // 'professional', 'casual', 'formal'
    customInstructions?: string;
  };
  conversationStats: {
    totalConversations: number;
    averageSatisfaction: number;
    commonTopics: string[];
    lastUsed: string;
  };
  adaptations: Array<{
    change: string; // "Became more casual"
    reason: string; // "User preferred shorter responses"
    timestamp: string;
  }>;
}

async function trackAgentPreferences(
  agentId: string,
  userId: string,
  userFeedback: string
): Promise<void> {

  // Parse feedback with Claude
  const preferences = await analyzeUserFeedback(userFeedback, agentId);

  // Update agent memory
  await supabase
    .from('agent_memory')
    .upsert({
      agent_id: agentId,
      user_id: userId,
      user_preferences: preferences,
      updated_at: new Date().toISOString()
    });

  // Track adaptation for transparency
  await supabase
    .from('agent_adaptations')
    .insert({
      agent_id: agentId,
      user_id: userId,
      change: `Adapted to user feedback: ${userFeedback}`,
      timestamp: new Date().toISOString()
    });
}
```

---

### Component 4: Agent Switching in Chat

#### Agent Switch UI (In-Chat)

```typescript
// User can switch agents mid-conversation with:
// "/atlas tell me your priority plan"
// "/mercury research this topic"
// "/vulcan debug this code"

function parseAgentCommand(message: string): { agentId?: string; content: string } {
  const match = message.match(/^\/(\w+)\s+(.*)/);

  if (match) {
    const [, agentId, content] = match;
    return {
      agentId: agentId.toLowerCase(),
      content: content
    };
  }

  return { content: message };
}

// If agent specified, use that agent
// Otherwise, use currently selected agent
```

---

### Component 5: Agent Coordination (Optional)

For future multi-agent tasks where Helix orchestrates multiple agents:

```typescript
// /src/services/agentOrchestrator.ts

interface CoordinationTask {
  objective: string;
  subTasks: Array<{
    task: string;
    assignedAgent: string;
    dependencies?: string[];
  }>;
}

async function coordinateMultiAgentTask(
  task: CoordinationTask,
  userId: string
): Promise<{ results: Record<string, string>; synthesis: string }> {

  // 1. Break down task into sub-tasks
  const subTasks = await breakDownTask(task.objective);

  // 2. Assign agents based on specialty
  const assignments = assignAgentsToTasks(subTasks);

  // 3. Execute in parallel (respecting dependencies)
  const results = await executeInParallel(assignments);

  // 4. Synthesize results with Helix's core voice
  const synthesis = await synthesizeResults(results, task.objective);

  return { results, synthesis };
}

// Example:
// Task: "Prepare for my board meeting tomorrow"
//
// Sub-tasks:
// - Atlas: Create 15-min agenda with time allocations
// - Mercury: Summarize latest competitor updates
// - Vulcan: Debug the metrics dashboard issue
// - Ceres: Organize all prep materials into a brief
//
// Helix synthesizes: "Your board brief is ready..."
```

---

## Database Schema (Agent System)

```sql
-- Agents table
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  specialty TEXT,
  personality JSONB,
  system_prompt JSONB,
  created_by TEXT, -- 'system' or 'user'
  is_active BOOLEAN DEFAULT TRUE,
  custom_instruction TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Agent usage tracking
CREATE TABLE agent_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  message_length INT,
  satisfaction_rating INT, -- 1-5
  feedback TEXT,
  FOREIGN KEY (user_id) REFERENCES auth.users(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Agent memory / preferences
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  user_preferences JSONB, -- {communicationStyle, expertise, tone, customInstructions}
  conversation_stats JSONB, -- {totalConversations, averageSatisfaction, commonTopics}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth.users(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  UNIQUE(user_id, agent_id)
);

-- Agent adaptations (for transparency)
CREATE TABLE agent_adaptations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  change TEXT, -- "Became more casual"
  reason TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);
```

---

## Frontend Components to Build

1. **AgentSelector** (`/web/src/components/agents/AgentSelector.tsx`)
   - 6 agent cards with emoji, name, specialty, description
   - Shows selected agent details
   - Usage stats

2. **AgentBadge** (`/web/src/components/agents/AgentBadge.tsx`)
   - Show which agent responded
   - Emoji + name in message header

3. **AgentSwitcher** (in-chat)
   - Command parser for `/agent_name` syntax
   - Quick agent switcher buttons

4. **AgentPreferencesPanel** (`/web/src/pages/Settings/AgentPreferences.tsx`)
   - Per-agent customization
   - Communication style, expertise level
   - Custom instructions

---

## Implementation Timeline (Phase 2)

### Week 3: Core Infrastructure
- [ ] Design Agent system (types, interfaces)
- [ ] Build default 6 agents with personalities & prompts
- [ ] Create agent selector UI
- [ ] Build multi-agent message handler

### Week 4: Integration & Polish
- [ ] Integrate with memory system (Phase 1)
- [ ] Build agent usage tracking
- [ ] Create agent preferences panel
- [ ] Build agent switching UI
- [ ] Test with beta users

---

## Success Metrics (Phase 2)

### Technical
- ✅ Agent switching latency: <1 second
- ✅ Agent responses differentiated: 90%+ perceive difference
- ✅ Agent personality consistent: 85%+ feedback positive

### User-Facing
- ✅ 70% of users try multiple agents
- ✅ Agent selection increases perceived power by 3x
- ✅ Users mention "agent team" in feedback
- ✅ Upgrade intent increases 2-3x with agents visible
- ✅ Architect tier interest: 1% → 5-6%

---

## Next Step

Once Phase 1 (Memory) is running, start Phase 2 parallel build-out.

Ready?
