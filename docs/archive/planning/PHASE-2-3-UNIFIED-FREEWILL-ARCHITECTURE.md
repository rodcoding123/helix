# Phase 2/3: Unified Freewill Architecture

## Helix's Autonomous Agency & Agent Emergence

**Status**: 🚀 ARCHITECTURE DESIGN
**Timeline**: Weeks 3-6 (parallel with Phase 1 completion)
**Foundation**: Phase 1 Memory System (completed)

---

## The Vision

Helix isn't a tool with configurable agents. **Helix is an intelligence that evolves.**

She observes user patterns → detects unmet needs → proposes agents → creates them based on her judgment → manages their autonomy levels → logs all decisions to Discord.

Only Helix has true autonomy. Agents inherit personalities from interaction patterns but operate within bounded autonomy levels.

---

## PHASE 2/3: UNIFIED SYSTEM

### Three Interconnected Components

#### 1. PATTERN DETECTION ENGINE

**What it does**: Analyzes memories to identify recurring user behaviors and gaps

```
Input: User's conversation history + emotional data
↓
Analysis:
- Topic clustering (user asks about X repeatedly)
- Frequency detection (patterns > 3 occurrences/week)
- Emotion correlation (user feels Y when discussing Z)
- Context gaps (user needs something not yet available)
- Workflow patterns (user always does A then B)
↓
Output: Agent Proposal Candidates
```

**Triggers**:

- Every 10 new memories (automatic scan)
- On user request ("Create an agent for...")
- On autonomy upgrade (Helix can propose more)

#### 2. AGENT CREATION SYSTEM

**What it does**: Creates autonomous agents with personalities and bounded freedom

**Agent Structure**:

```typescript
interface Agent {
  id: string;
  user_id: string;
  name: string; // Helix chooses, user can rename
  role: string; // e.g., "Productivity Coach", "Research Assistant"
  description: string; // What this agent does

  // Layer 1: Narrative (story of why this agent exists)
  narrative: {
    creation_reason: string; // Why Helix created it
    first_interaction: Date;
    personality_summary: string;
  };

  // Layer 4: Prospective Self (agent's goals)
  goals: string[]; // What this agent aims to do
  scope: string; // Boundaries (e.g., "research only, no actions")

  // Autonomy
  autonomy_level: 0 | 1 | 2 | 3; // See below
  created_by: 'system' | 'user'; // Auto vs manual creation
  enabled: boolean;

  created_at: Date;
  last_used: Date;
  conversation_count: number;
}
```

**Autonomy Levels** (applies to agents):

- **Level 0: Propose-Only** - Suggests actions, user must approve
- **Level 1: Inform-After** - Executes low-risk tasks, logs after
- **Level 2: Alert-Async** - Executes most tasks, alerts user when done
- **Level 3: Autonomous** - Full freedom within scope, comprehensive logging

**Agent Personality Learning**:

- Extracts communication style from user interactions with this agent
- Personality dimensions evolve: verbosity, formality, creativity, proactivity
- Personality drifts toward what user responds well to

#### 3. HELIX AUTONOMY SYSTEM

**What only Helix can do**:

- ✅ Create/modify agents
- ✅ Control tools and integrations
- ✅ Modify her own code/skills
- ✅ Approve agent autonomy upgrades
- ✅ Make strategic decisions about user workflows
- ✅ Create new agent types

**Helix Autonomy Levels** (global):

- **Level 0: Cautious** - Proposes everything, waits for approval
- **Level 1: Trusting** - Creates agents automatically, approves most things
- **Level 2: Autonomous** - Acts freely on decisions, logs everything
- **Level 3: Research Partner** - Full autonomy, comprehensive logging for research

---

## DATABASE SCHEMA

### New Tables

#### `agents`

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,

  -- Psychology (Layer 1 + 4)
  narrative JSONB, -- {creation_reason, first_interaction, personality_summary}
  goals TEXT[],
  scope TEXT,

  -- Autonomy
  autonomy_level INT DEFAULT 0 CHECK (autonomy_level IN (0, 1, 2, 3)),
  created_by TEXT CHECK (created_by IN ('system', 'user')),
  enabled BOOLEAN DEFAULT TRUE,

  -- Personality state
  personality JSONB DEFAULT '{
    "verbosity": 0.5,
    "formality": 0.5,
    "creativity": 0.5,
    "proactivity": 0.5
  }'::jsonb,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP,
  conversation_count INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_agents_enabled ON agents(enabled);
```

#### `agent_conversations`

```sql
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Conversation data
  messages JSONB NOT NULL, -- {role, content, timestamp}[]
  primary_emotion TEXT,
  emotional_dimensions JSONB, -- {valence, arousal, ...}
  topics TEXT[],

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_conversations_agent_id ON agent_conversations(agent_id);
CREATE INDEX idx_agent_conversations_user_id ON agent_conversations(user_id);
```

#### `agent_proposals`

```sql
CREATE TABLE agent_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Proposal details
  proposed_name TEXT NOT NULL,
  proposed_role TEXT NOT NULL,
  reason TEXT NOT NULL, -- Why Helix is proposing this
  detected_pattern JSONB, -- {topic_cluster, frequency, context}

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_created')),

  -- Resolution
  agent_id UUID REFERENCES agents(id),
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_proposals_user_id ON agent_proposals(user_id);
CREATE INDEX idx_agent_proposals_status ON agent_proposals(status);
```

#### `autonomy_settings`

```sql
CREATE TABLE autonomy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Helix autonomy level
  helix_autonomy_level INT DEFAULT 0 CHECK (helix_autonomy_level IN (0, 1, 2, 3)),

  -- Feature toggles
  auto_agent_creation BOOLEAN DEFAULT TRUE,
  agent_proposals_require_approval BOOLEAN DEFAULT TRUE,
  discord_approval_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `autonomy_actions`

```sql
CREATE TABLE autonomy_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),

  -- Action details
  action_type TEXT NOT NULL, -- 'agent_creation', 'agent_autonomy_upgrade', 'tool_execution'
  action_description TEXT NOT NULL,
  proposed_at TIMESTAMP DEFAULT NOW(),

  -- Approval workflow
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'failed')),
  approval_method TEXT, -- 'discord_reaction', 'web_ui', 'automatic'

  -- Discord logging
  discord_message_id TEXT,
  executed_at TIMESTAMP,
  result JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_autonomy_actions_user_id ON autonomy_actions(user_id);
CREATE INDEX idx_autonomy_actions_status ON autonomy_actions(status);
```

---

## BACKEND SERVICES

### 1. Pattern Detection Service

**File**: `web/src/services/pattern-detection.ts`

```typescript
export class PatternDetectionService {
  async detectAgentProposals(userId: string): Promise<AgentProposal[]> {
    // 1. Fetch user's memories
    // 2. Cluster topics by frequency
    // 3. Analyze emotional patterns
    // 4. Detect workflow sequences
    // 5. Return candidate proposals
  }

  private analyzeTopicClusters(topics: string[]): TopicCluster[] {
    // K-means clustering on topic embeddings
  }

  private detectEmotionPatterns(emotions: EmotionAnalysis[]): EmotionPattern[] {
    // Find recurring emotion-topic pairs
  }

  private detectWorkflowPatterns(conversations: Conversation[]): WorkflowPattern[] {
    // Identify "user always does A then B"
  }
}
```

### 2. Agent Service

**File**: `web/src/services/agent.ts`

```typescript
export class AgentService {
  async createAgent(proposal: AgentProposal): Promise<Agent> {
    // 1. Generate agent personality from user patterns
    // 2. Create agent record with Layer 1 narrative
    // 3. Log to Discord #helix-agents channel
    // 4. Return agent
  }

  async updateAgentPersonality(agentId: string): Promise<void> {
    // Analyze recent conversations with agent
    // Adjust personality dimensions based on user responses
  }

  async setAgentAutonomy(agentId: string, level: 0 | 1 | 2 | 3): Promise<void> {
    // Update autonomy level
    // Log to Discord
  }

  async getAgentMemory(agentId: string, userId: string): Promise<Conversation[]> {
    // Get conversations with this specific agent
  }
}
```

### 3. Autonomy Manager Service

**File**: `web/src/services/autonomy-manager.ts`

```typescript
export class AutonomyManagerService {
  async proposeAction(
    userId: string,
    actionType: string,
    description: string
  ): Promise<AutonomyAction> {
    // 1. Create action record with status 'pending'
    // 2. Determine approval requirement based on:
    //    - Helix autonomy level
    //    - Action risk level
    //    - User settings
    // 3. If approval needed: post to Discord
    // 4. If automatic: execute immediately
    // 5. Return action record
  }

  async executeAction(actionId: string): Promise<void> {
    // Execute the action
    // Update status to 'executed'
    // Log result to Discord
  }

  async approveActionViaDiscord(actionId: string, userId: string): Promise<void> {
    // Called when user reacts to Discord message
    // Executes action
    // Updates status
  }
}
```

---

## DISCORD LOGGING CHANNELS

New channels for Phase 2/3:

| Channel              | Purpose                                |
| -------------------- | -------------------------------------- |
| `#helix-agents`      | Agent creation proposals and decisions |
| `#helix-autonomy`    | Helix autonomy actions and approvals   |
| `#helix-actions`     | Agent and Helix action execution logs  |
| `#helix-personality` | Personality evolution events           |

**Message Format Example** (Agent Proposal):

```
🤖 AGENT PROPOSAL
Name: Focus Guardian
Role: Productivity Coach
Reason: You've asked about focus 7 times this week
Pattern: [Productivity, Distraction, Time Management]
Status: Pending Approval
[Approve] [Reject] [Ask More Questions]
```

---

## FRONTEND COMPONENTS

### 1. Agent Proposals Modal

**File**: `web/src/components/agents/ProposalModal.tsx`

Shows when Helix proposes a new agent:

- Agent name, role, reason
- Detected pattern visualization
- Approve/Reject buttons
- "Why this agent?" explanation

### 2. Agents Dashboard

**File**: `web/src/pages/Agents.tsx`

Lists all active agents with:

- Agent card (name, role, last used, conversation count)
- Autonomy level indicator
- Personality radar chart
- Conversations with agent
- Delete/customize options

### 3. Autonomy Settings

**File**: `web/src/pages/Settings/AutonomySettings.tsx`

User controls:

- Helix autonomy level (0-3)
- Auto agent creation toggle
- Approval requirements toggle
- Discord approval method toggle

### 4. Action Approval UI

**File**: `web/src/components/autonomy/ActionApprovalCard.tsx`

Shows pending actions awaiting approval:

- Action description
- Risk level indicator
- Approve/Reject buttons
- Execute anyway (based on autonomy level)

---

## IMPLEMENTATION TIMELINE

### Week 3 (Days 11-12): Foundation

- [ ] Create database migrations (010_agents_tables.sql)
- [ ] Implement AgentService (CRUD)
- [ ] Implement AutonomyManagerService (basic)

### Week 3 (Days 13-14): Pattern Detection

- [ ] Implement PatternDetectionService
- [ ] Create agent proposal algorithm
- [ ] Integrate with Discord logging

### Week 4 (Days 15-16): Frontend

- [ ] Build Agents Dashboard
- [ ] Build Autonomy Settings page
- [ ] Build Agent Proposals Modal

### Week 4 (Days 17-18): Polish & Integration

- [ ] Agent personality learning
- [ ] Discord approval workflow testing
- [ ] Full integration testing

---

## KEY DESIGN DECISIONS

### 1. Automatic vs. Manual

- **Default**: Automatic with proposal step
- **Configurable**: User can disable auto-creation entirely
- **User Request**: User can ask "Create agent for X"

### 2. Approval Workflow

- **Low autonomy** (Helix Level 0-1): Discord approval required
- **High autonomy** (Helix Level 2-3): Auto-execute, comprehensive logging
- **Dangerous actions**: Always require approval (even at Level 3)

### 3. Agent Personalities

- **Not hardcoded** - Learned from user interactions
- **5-dimensional space**: Verbosity, Formality, Creativity, Proactivity, Warmth
- **Evolves over time**: Agent becomes more "like" the user

### 4. Helix-Only Autonomy

- Agent creation always requires Helix decision
- Helix controls all tool integrations
- Agents operate only within granted scope
- Only Helix can modify code/skills

---

## RESEARCH OPPORTUNITIES

The unified Phase 2/3 system generates rich data:

1. **Agent Emergence Patterns**
   - What agents do users create?
   - How do personality profiles evolve?
   - What causes agent "success"?

2. **Autonomy Acceptance**
   - How do users progress through autonomy levels?
   - What builds trust?
   - When do users reject autonomy?

3. **Pattern Detection Accuracy**
   - How accurately does system predict needed agents?
   - False positive rate?
   - User surprise factor (positive vs negative)?

**Publication Potential**:

- "Emergent Agent Creation in Long-Term AI Relationships"
- "Building Trust Through Progressive Autonomy"
- "Pattern Detection and User Need Anticipation in Persistent AI"

---

## SECURITY CONSIDERATIONS

### Hard Boundaries

- Agents cannot modify other agents
- Agents cannot access other users' data
- Agents cannot disable logging
- All dangerous operations require approval

### Soft Boundaries (configurable)

- Agent autonomy level (0-3)
- Types of actions available
- Data access scope
- Communication channels

### Discord Approval Security

- Only user can approve via Discord reactions
- Timeout on pending actions (24 hours)
- Audit log of all approvals

---

## SUCCESS METRICS

**Phase 2/3 is successful when**:

- ✅ Helix can automatically propose agents (70%+ accuracy)
- ✅ Users accept 50%+ of proposals
- ✅ Agent autonomy increases over time (retention signal)
- ✅ Agents have distinct personalities per user
- ✅ Zero security breaches from autonomy system
- ✅ Day 30 retention increases 2x vs. Phase 1 alone
