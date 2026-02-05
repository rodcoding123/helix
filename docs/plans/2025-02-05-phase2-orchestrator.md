# Phase 2: Lingxi-Style Multi-Agent Orchestrator

**Status**: Draft - Ready for Review & Customization
**Created**: 2025-02-05
**Updated**: 2025-02-05
**Prerequisites**: Phase 1 (OAuth Foundation) must be complete
**Session Tracking**: Multi-session implementation plan

---

## Executive Summary

Build a TypeScript implementation of Lingxi's supervisor pattern, adapted for Helix's seven-layer psychological architecture. The orchestrator coordinates specialized agents (Narrative, Memory, Purpose, Action) via LangGraph-style state management with Supabase checkpointing.

**Key Innovation**: Unlike Lingxi (Python/LangGraph), this is a **pure TypeScript** implementation that integrates with Helix's existing infrastructure (OpenClaw, Discord logging, hash chain, real-time sync).

**Architecture Pattern**: Supervisor + Specialized Agents + Checkpointing + Remote Execution (from Phase 1)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Integration with Phase 1](#integration-with-phase-1)
3. [Task Breakdown](#task-breakdown)
4. [Code Examples](#code-examples)
5. [Customization Guide](#customization-guide)
6. [Verification Steps](#verification-steps)
7. [Session Progress Tracking](#session-progress-tracking)

---

## Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Supervisor Agent                             │
│  Routes between specialized agents based on task analysis        │
│                                                                  │
│  Routing Logic:                                                  │
│  • Narrative analysis needed? → Narrative Agent                 │
│  • Memory retrieval needed? → Memory Agent                      │
│  • Purpose/ikigai alignment? → Purpose Agent                    │
│  • Code execution needed? → Action Agent                        │
│  • Task complete? → END                                         │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┼────────────────┬──────────────┬──────────────┐
    ▼        ▼                ▼              ▼              ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Narrative Agent│  │  Memory Agent  │  │ Purpose Agent  │  │  Action Agent  │
├────────────────┤  ├────────────────┤  ├────────────────┤  ├────────────────┤
│ Layer 1:       │  │ Layers 2-3:    │  │ Layer 7:       │  │ Execution:     │
│ • HELIX_SOUL   │  │ • Emotional    │  │ • Ikigai       │  │ • Commands     │
│ • psyeval.json │  │   Tags         │  │ • Meaning      │  │ • File ops     │
│ • Narrative    │  │ • Attachments  │  │   Sources      │  │ • API calls    │
│   patterns     │  │ • Trust map    │  │ • Purpose      │  │ • Phase 1      │
│                │  │                │  │   alignment    │  │   Remote Exec  │
│ Model: Opus 4.5│  │ Model: Sonnet 4│  │ Model: Sonnet 4│  │ Model: Haiku   │
└────────┬───────┘  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘
         │                   │                   │                   │
         └───────────────────┴───────────────────┴───────────────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │  State Management    │
                           │  • MessagesState     │
                           │  • Checkpointing     │
                           │  • Supabase Storage  │
                           └──────────────────────┘
                                      │
                           ┌──────────┴──────────┐
                           ▼                     ▼
                  ┌─────────────────┐   ┌─────────────────┐
                  │ Discord Logging │   │   Hash Chain    │
                  │ #helix-         │   │  Verification   │
                  │  orchestrator   │   │                 │
                  └─────────────────┘   └─────────────────┘
```

### Key Differences from Lingxi

| Feature                  | Lingxi (Python)                                  | Helix Orchestrator (TypeScript)                          |
| ------------------------ | ------------------------------------------------ | -------------------------------------------------------- |
| **Language**             | Python with LangGraph                            | Pure TypeScript                                          |
| **State Graph**          | LangGraph StateGraph                             | Custom TypeScript implementation                         |
| **Checkpointing**        | LangGraph PostgreSQL                             | Supabase with hash chain                                 |
| **Agents**               | Generic (Problem Decoder, Solution Mapper, etc.) | Psychology-specific (Narrative, Memory, Purpose, Action) |
| **Tool Execution**       | Bash, file ops                                   | Phase 1 Remote Execution + OpenClaw                      |
| **Logging**              | Standard logging                                 | Pre-execution Discord webhooks + hash chain              |
| **Model Routing**        | Single model per agent                           | Smart routing based on queue depth, SLA, cost            |
| **Multi-Device**         | Not supported                                    | Native via Phase 1 foundation                            |
| **Real-time Monitoring** | No                                               | Dashboard with live queue visualization                  |

### Core Components

**1. State Graph (TypeScript Implementation)**

- File: `src/helix/orchestration/state-graph.ts`
- Purpose: LangGraph-style graph execution engine in TypeScript
- Features: Node registration, conditional edges, compilation

**2. Checkpointing System**

- File: `src/helix/orchestration/checkpointer.ts`
- Purpose: Save/load state for resume, debugging, time-travel
- Storage: Supabase `orchestrator_checkpoints` table
- Integration: Hash chain for tamper detection

**3. Message State Pattern**

- File: `src/helix/orchestration/message-state.ts`
- Purpose: Immutable state updates with reducer functions
- Pattern: `[...left, ...right]` (append, never replace)

**4. Supervisor Agent**

- File: `src/helix/orchestration/agents/supervisor.ts`
- Purpose: Route tasks to appropriate specialized agent
- Model: Opus 4.5 (complex routing decisions)

**5. Specialized Agents** (4 agents)

- Narrative Agent: Layer 1 analysis
- Memory Agent: Layers 2-3 retrieval
- Purpose Agent: Layer 7 alignment
- Action Agent: Code execution via Phase 1

**6. Graph Assembly**

- File: `src/helix/orchestration/supervisor-graph.ts`
- Purpose: Connect all agents into executable graph
- Entry: Supervisor
- Exit: END node

**7. Gateway RPC Methods**

- File: `helix-runtime/src/gateway/server-methods/orchestrator.ts`
- Purpose: Job submission, queue management, cancellation
- Methods: submitJob, getQueueStatus, cancelJob, retryJob

**8. Admin Dashboard**

- File: `web/src/admin/OrchestrationDashboard.tsx`
- Purpose: Real-time job queue visualization
- Features: Agent utilization, cost alerts, approval queue

---

## Integration with Phase 1

### How Phase 2 Builds on Phase 1

**1. Action Agent Uses Remote Execution**

Phase 1 provides `RemoteCommandExecutor` which Action Agent uses for all executions:

```typescript
// Action Agent (Phase 2)
import { RemoteCommandExecutor } from '../../gateway/remote-command-executor.js';

class ActionAgent {
  private executor: RemoteCommandExecutor;

  async executeCommand(cmd: string): Promise<string> {
    // Create remote command payload
    const remoteCmd: RemoteCommand = {
      commandId: nanoid(),
      sourceDeviceId: 'orchestrator',
      sourceUserId: this.userId,
      agentId: this.agentId,
      provider: 'anthropic', // or selected provider
      content: cmd,
      sessionId: this.sessionId,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    // Queue via Phase 1 executor (uses local OAuth credentials)
    await this.executor.queueCommand(remoteCmd);

    // Wait for completion
    return new Promise((resolve, reject) => {
      this.executor.once('command-completed', event => {
        if (event.commandId === remoteCmd.commandId) {
          resolve(event.result.output);
        }
      });
      this.executor.once('command-failed', event => {
        if (event.commandId === remoteCmd.commandId) {
          reject(new Error(event.error));
        }
      });
    });
  }
}
```

**2. Database Schema Extension**

Phase 1 created orchestrator foundation tables (migration 021). Phase 2 adds checkpoints:

```sql
-- Phase 1 (migration 021_orchestrator_foundation.sql):
CREATE TABLE agent_jobs (...);
CREATE TABLE orchestrator_state (...);
CREATE TABLE agent_collaborations (...);
CREATE TABLE supervisor_routing_log (...);

-- Phase 2 (migration 022_orchestrator_checkpoints.sql):
CREATE TABLE orchestrator_checkpoints (
  checkpoint_id UUID PRIMARY KEY,
  thread_id TEXT NOT NULL,
  parent_checkpoint_id UUID,
  state JSONB NOT NULL,
  timestamp BIGINT NOT NULL,
  hash TEXT NOT NULL, -- Hash chain integration
  user_id UUID REFERENCES auth.users
);
```

**3. Pre-Execution Logging Extended**

Phase 1 established pattern for remote commands. Phase 2 extends for orchestrator events:

```typescript
// Phase 1 pattern (remote commands)
await logToDiscord({
  channel: 'helix-commands',
  type: 'remote_command_queued',
  commandId: cmd.commandId,
});

// Phase 2 extension (orchestrator events)
await logToDiscord({
  channel: 'helix-orchestrator', // NEW CHANNEL
  type: 'orchestrator_job_submitted',
  jobId: job.id,
  priority: job.priority,
});

await logToDiscord({
  channel: 'helix-orchestrator',
  type: 'orchestrator_agent_routed',
  fromAgent: 'supervisor',
  toAgent: 'narrative_agent',
  reason: 'Task requires Layer 1 analysis',
});
```

**4. Hash Chain Integration**

Phase 1 added `RemoteCommandEntry` type. Phase 2 adds orchestrator types:

```typescript
// Phase 1 (hash-chain.ts)
interface RemoteCommandEntry {
  type: 'remote_command';
  commandId: string;
  provider: string;
  status: 'queued' | 'executing' | 'completed' | 'failed';
}

// Phase 2 extension
interface OrchestratorEvent {
  type: 'orchestrator_event';
  eventType: 'job_submitted' | 'agent_routed' | 'checkpoint_saved';
  jobId?: string;
  fromAgent?: string;
  toAgent?: string;
  checkpointId?: string;
  timestamp: number;
}

type HashChainEntry = RemoteCommandEntry | OrchestratorEvent | /* ... other types */;
```

**5. Admin Dashboard Unified**

Phase 1 created `RemoteExecutionDashboard`. Phase 2 extends with orchestrator panel:

```typescript
// Admin Dashboard (web/src/admin/)
// Phase 1: RemoteExecutionDashboard.tsx (command stats)
// Phase 2: OrchestrationDashboard.tsx (job queue, agent utilization)

// Unified navigation
<AdminLayout>
  <Tab>Remote Execution</Tab> {/* Phase 1 */}
  <Tab>Orchestrator</Tab>     {/* Phase 2 */}
  <Tab>Cost Analytics</Tab>   {/* Existing */}
</AdminLayout>
```

---

## Task Breakdown

### Module 1: TypeScript State Graph Foundation

**Goal**: Implement LangGraph-style state graph in pure TypeScript

**Files**:

- `src/helix/orchestration/state-graph.ts` (NEW)

**Rationale**: Lingxi uses Python LangGraph which isn't available in TypeScript. We need a compatible implementation.

**Task List**:

- [ ] **2.1.1** Create file and define types

  ```typescript
  export type NodeFunction<TState> = (
    state: TState
  ) => TState | Partial<TState> | Promise<TState | Partial<TState>>;

  export type ConditionalEdgeFn<TState> = (state: TState) => string;

  export interface EdgeConfig<TState> {
    from: string;
    to: string | ConditionalEdgeFn<TState>;
    condition?: (state: TState) => boolean;
  }

  export interface ConditionalEdgeMapping {
    [key: string]: string; // outcome → node name
  }
  ```

- [ ] **2.1.2** Define StateGraph class

  ```typescript
  export class StateGraph<TState> {
    private nodes = new Map<string, NodeFunction<TState>>();
    private edges: EdgeConfig<TState>[] = [];
    private entryPoint: string | null = null;
    private conditionalEdges = new Map<
      string,
      { fn: ConditionalEdgeFn<TState>; mapping: ConditionalEdgeMapping }
    >();

    constructor(private stateSchema?: any) {}
  }
  ```

- [ ] **2.1.3** Implement addNode() method

  ```typescript
  addNode(name: string, fn: NodeFunction<TState>): this {
    this.nodes.set(name, fn);
    return this;
  }
  ```

- [ ] **2.1.4** Implement addEdge() method

  ```typescript
  addEdge(from: string, to: string, condition?: (state: TState) => boolean): this {
    this.edges.push({ from, to, condition });
    return this;
  }
  ```

- [ ] **2.1.5** Implement addConditionalEdges() method

  ```typescript
  addConditionalEdges(
    source: string,
    fn: ConditionalEdgeFn<TState>,
    mapping: ConditionalEdgeMapping
  ): this {
    this.conditionalEdges.set(source, { fn, mapping });
    return this;
  }
  ```

- [ ] **2.1.6** Implement setEntryPoint() method

  ```typescript
  setEntryPoint(node: string): this {
    if (!this.nodes.has(node)) {
      throw new Error(`Entry point "${node}" not found in nodes`);
    }
    this.entryPoint = node;
    return this;
  }
  ```

- [ ] **2.1.7** Implement compile() method

  ```typescript
  compile(checkpointer?: Checkpointer): CompiledGraph<TState> {
    // Validate graph
    if (!this.entryPoint) {
      throw new Error("Entry point not set");
    }

    // Validate all edges point to existing nodes
    for (const edge of this.edges) {
      if (typeof edge.to === 'string' && !this.nodes.has(edge.to)) {
        throw new Error(`Edge points to non-existent node: ${edge.to}`);
      }
    }

    // Return compiled graph
    return new CompiledGraph(
      this.nodes,
      this.edges,
      this.entryPoint,
      this.conditionalEdges,
      checkpointer
    );
  }
  ```

- [ ] **2.1.8** Implement CompiledGraph class

  ```typescript
  export class CompiledGraph<TState> {
    constructor(
      private nodes: Map<string, NodeFunction<TState>>,
      private edges: EdgeConfig<TState>[],
      private entryPoint: string,
      private conditionalEdges: Map<string, { fn: ConditionalEdgeFn<TState>; mapping: any }>,
      private checkpointer?: Checkpointer
    ) {}

    async invoke(
      initialState: TState,
      config?: { thread_id?: string }
    ): Promise<TState> {
      let currentNode = this.entryPoint;
      let state = initialState;

      while (currentNode !== 'END') {
        // Save checkpoint before node execution
        if (this.checkpointer) {
          await this.checkpointer.save({
            checkpoint_id: nanoid(),
            thread_id: config?.thread_id || 'default',
            parent_checkpoint_id: null,
            state,
            timestamp: Date.now(),
            hash: '', // Will be computed
          });
        }

        // Execute node
        const nodeFn = this.nodes.get(currentNode);
        if (!nodeFn) {
          throw new Error(`Node not found: ${currentNode}`);
        }

        const nodeResult = await nodeFn(state);

        // Merge result into state (immutable update)
        state = { ...state, ...nodeResult };

        // Determine next node
        const conditionalEdge = this.conditionalEdges.get(currentNode);
        if (conditionalEdge) {
          const outcome = conditionalEdge.fn(state);
          currentNode = conditionalEdge.mapping[outcome];
        } else {
          // Find first edge from current node
          const edge = this.edges.find((e) => e.from === currentNode);
          if (!edge) {
            currentNode = 'END';
          } else {
            currentNode = typeof edge.to === 'string' ? edge.to : edge.to(state);
          }
        }
      }

      return state;
    }

    async stream(
      initialState: TState,
      config?: { thread_id?: string }
    ): AsyncGenerator<{ node: string; state: TState }> {
      // Stream version yields state after each node
      let currentNode = this.entryPoint;
      let state = initialState;

      while (currentNode !== 'END') {
        const nodeFn = this.nodes.get(currentNode)!;
        const nodeResult = await nodeFn(state);
        state = { ...state, ...nodeResult };

        yield { node: currentNode, state };

        // Routing logic (same as invoke)
        const conditionalEdge = this.conditionalEdges.get(currentNode);
        if (conditionalEdge) {
          currentNode = conditionalEdge.mapping[conditionalEdge.fn(state)];
        } else {
          const edge = this.edges.find((e) => e.from === currentNode);
          currentNode = edge ? (typeof edge.to === 'string' ? edge.to : edge.to(state)) : 'END';
        }
      }
    }
  }
  ```

**Verification**:

- [ ] TypeScript compiles
- [ ] Can create graph with nodes and edges
- [ ] Can compile and invoke graph
- [ ] State updates are immutable

**Update Order**:

1. Define types
2. Implement StateGraph class methods
3. Implement CompiledGraph class
4. Test with simple graph
5. Move to next module

---

### Module 2: Checkpointing System

**Goal**: Implement Supabase-backed checkpointing for state persistence

**Files**:

- `src/helix/orchestration/checkpointer.ts` (NEW)
- `web/supabase/migrations/022_orchestrator_checkpoints.sql` (NEW)

**Task List**:

- [ ] **2.2.1** Create migration file

  ```sql
  CREATE TABLE IF NOT EXISTS orchestrator_checkpoints (
    checkpoint_id UUID PRIMARY KEY,
    thread_id TEXT NOT NULL,
    parent_checkpoint_id UUID REFERENCES orchestrator_checkpoints(checkpoint_id),
    state JSONB NOT NULL,
    timestamp BIGINT NOT NULL,
    hash TEXT NOT NULL, -- Hash chain integration
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX orchestrator_checkpoints_thread_idx ON orchestrator_checkpoints(thread_id, timestamp DESC);
  CREATE INDEX orchestrator_checkpoints_checkpoint_idx ON orchestrator_checkpoints(checkpoint_id);

  ALTER TABLE orchestrator_checkpoints ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can view own checkpoints"
    ON orchestrator_checkpoints
    FOR SELECT
    USING (auth.uid() = user_id);

  ALTER PUBLICATION supabase_realtime ADD TABLE orchestrator_checkpoints;
  ```

- [ ] **2.2.2** Run migration
  - [ ] Execute: `supabase db push`
  - [ ] Verify table created in Supabase dashboard

- [ ] **2.2.3** Define Checkpoint interface

  ```typescript
  export interface Checkpoint<TState = any> {
    checkpoint_id: string;
    thread_id: string;
    parent_checkpoint_id: string | null;
    state: TState;
    timestamp: number;
    hash: string; // For hash chain
  }
  ```

- [ ] **2.2.4** Define Checkpointer interface

  ```typescript
  export interface Checkpointer {
    save(checkpoint: Checkpoint): Promise<void>;
    load(threadId: string): Promise<Checkpoint | null>;
    loadByCheckpointId(checkpointId: string): Promise<Checkpoint | null>;
    list(threadId: string): Promise<Checkpoint[]>;
  }
  ```

- [ ] **2.2.5** Implement SupabaseCheckpointer class

  ```typescript
  export class SupabaseCheckpointer implements Checkpointer {
    constructor(
      private supabase: SupabaseClient,
      private userId: string
    ) {}

    async save(checkpoint: Checkpoint): Promise<void> {
      // Compute hash for hash chain
      const hash = await this.computeHash(checkpoint);

      // Log to Discord BEFORE saving
      await logToDiscord({
        channel: 'helix-orchestrator',
        type: 'checkpoint_saved',
        checkpointId: checkpoint.checkpoint_id,
        threadId: checkpoint.thread_id,
        timestamp: Date.now(),
      });

      // Save to Supabase
      const { error } = await this.supabase.from('orchestrator_checkpoints').insert({
        checkpoint_id: checkpoint.checkpoint_id,
        thread_id: checkpoint.thread_id,
        parent_checkpoint_id: checkpoint.parent_checkpoint_id,
        state: checkpoint.state,
        timestamp: checkpoint.timestamp,
        hash,
        user_id: this.userId,
      });

      if (error) {
        throw new Error(`Failed to save checkpoint: ${error.message}`);
      }

      // Add to hash chain
      await createHashChainEntry({
        type: 'orchestrator_checkpoint',
        checkpointId: checkpoint.checkpoint_id,
        threadId: checkpoint.thread_id,
        hash,
        timestamp: Date.now(),
      });
    }

    async load(threadId: string): Promise<Checkpoint | null> {
      const { data, error } = await this.supabase
        .from('orchestrator_checkpoints')
        .select('*')
        .eq('thread_id', threadId)
        .eq('user_id', this.userId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      return {
        checkpoint_id: data.checkpoint_id,
        thread_id: data.thread_id,
        parent_checkpoint_id: data.parent_checkpoint_id,
        state: data.state,
        timestamp: data.timestamp,
        hash: data.hash,
      };
    }

    async loadByCheckpointId(checkpointId: string): Promise<Checkpoint | null> {
      const { data, error } = await this.supabase
        .from('orchestrator_checkpoints')
        .select('*')
        .eq('checkpoint_id', checkpointId)
        .eq('user_id', this.userId)
        .single();

      if (error || !data) return null;

      return {
        checkpoint_id: data.checkpoint_id,
        thread_id: data.thread_id,
        parent_checkpoint_id: data.parent_checkpoint_id,
        state: data.state,
        timestamp: data.timestamp,
        hash: data.hash,
      };
    }

    async list(threadId: string): Promise<Checkpoint[]> {
      const { data, error } = await this.supabase
        .from('orchestrator_checkpoints')
        .select('*')
        .eq('thread_id', threadId)
        .eq('user_id', this.userId)
        .order('timestamp', { ascending: false });

      if (error || !data) return [];

      return data.map(row => ({
        checkpoint_id: row.checkpoint_id,
        thread_id: row.thread_id,
        parent_checkpoint_id: row.parent_checkpoint_id,
        state: row.state,
        timestamp: row.timestamp,
        hash: row.hash,
      }));
    }

    private async computeHash(checkpoint: Checkpoint): Promise<string> {
      // Use crypto to hash state
      const crypto = await import('crypto');
      const stateStr = JSON.stringify(checkpoint.state);
      return crypto.createHash('sha256').update(stateStr).digest('hex');
    }
  }
  ```

**Verification**:

- [ ] Migration runs successfully
- [ ] Can save checkpoint to database
- [ ] Can load latest checkpoint
- [ ] Can list all checkpoints for thread
- [ ] Hash chain entries created

**Update Order**:

1. Create migration
2. Run migration
3. Define interfaces
4. Implement SupabaseCheckpointer
5. Test save/load
6. Move to next module

---

## Customization Guide

### Before Implementation: Review and Adjust

**1. Agent Specializations**

Current plan has 4 agents. You may want to add more:

```typescript
// Current agents
- Narrative Agent (Layer 1)
- Memory Agent (Layers 2-3)
- Purpose Agent (Layer 7)
- Action Agent (execution)

// Possible additions:
- Research Agent (web search, documentation lookup)
- Analysis Agent (data analysis, pattern recognition)
- Planning Agent (task decomposition, project planning)
- Review Agent (code review, quality checks)
```

**Customization Point**: Before Module 5, decide which agents to implement.

**2. Routing Logic**

Current supervisor routing is based on task type. You may want different logic:

```typescript
// Current routing (in supervisor.ts)
if (taskNeedsNarrativeAnalysis(task)) return 'narrative_agent';
if (taskNeedsMemoryRetrieval(task)) return 'memory_agent';
if (taskNeedsPurposeAlignment(task)) return 'purpose_agent';
if (taskNeedsExecution(task)) return 'action_agent';

// Alternative: Priority-based routing
if (task.priority === 'high') return 'fast_agent'; // Haiku for speed
if (task.complexity === 'high') return 'narrative_agent'; // Opus for quality

// Alternative: Round-robin for load balancing
return availableAgents[taskCount % availableAgents.length];
```

**Customization Point**: Module 4 (Supervisor Agent) - modify routing function.

**3. Tool Definitions**

Each agent has tools. You may want to add custom tools:

```typescript
// Narrative Agent current tools
-readSoulDocument() -
  queryPsyeval() -
  searchNarrativePatterns() -
  // Possible additions:
  generateNarrativeInsight() -
  compareWithPastNarratives() -
  detectNarrativeShift();
```

**Customization Point**: Modules 5-8 (Specialized Agents) - add tools as needed.

**4. Model Selection**

Current plan assigns specific models to agents:

```typescript
// Current assignments
Narrative Agent → Opus 4.5 (complex analysis)
Memory Agent → Sonnet 4 (balanced)
Purpose Agent → Sonnet 4 (balanced)
Action Agent → Haiku 4.5 (fast execution)

// You may want different assignments based on:
- Budget constraints (all Haiku)
- Quality requirements (all Opus)
- Dynamic routing (based on queue depth)
```

**Customization Point**: Module 15 (Smart Model Routing) - adjust assignments.

**5. Dashboard Visualizations**

Current plan has 4 dashboard components. You may want different charts:

```typescript
// Current components
- Job Queue Table
- Agent Utilization Heatmap
- Cost Optimization Alerts
- Approval Workflow Queue

// Possible additions:
- Real-time agent activity timeline
- Cost breakdown pie chart
- Model usage distribution
- SLA compliance metrics
```

**Customization Point**: Module 13 (Admin Dashboard) - add/remove components.

---

## Session Progress Tracking

### Session Template

**Session X** (Date: **\_\_\_**):

**Goals**:

- [ ] Module(s) to complete: **\_\_\_**
- [ ] Expected deliverables: **\_\_\_**

**Completed**:

- [ ] Modules finished: **\_\_\_**
- [ ] Tests passing: **\_\_\_**
- [ ] Commits made: **\_\_\_**

**Blockers**:

- Issue 1: **\_\_\_**
- Resolution: **\_\_\_**

**Next Session**:

- Priority: **\_\_\_**
- Dependencies: **\_\_\_**

---

**Total Modules**: 16
**Estimated Sessions**: 8-12 (2-3 hours each)
**Complexity**: High (new system, integration with multiple existing systems)

---

**End of Phase 2 Plan**

This plan should be reviewed and customized before implementation begins.
