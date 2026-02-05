/**
 * Orchestrator Agents - Phase 2 Modules 3-8
 *
 * Specialized agents for different layers of Helix's seven-layer architecture.
 * Each agent has dedicated model (configurable) and specialized tools.
 *
 * **Agent Types** (4 core agents):
 * 1. **Supervisor**: Routes tasks to appropriate agent (Opus 4.5)
 * 2. **Narrative Agent**: Layer 1 analysis (Opus 4.5)
 * 3. **Memory Agent**: Layers 2-3 retrieval (Sonnet 4)
 * 4. **Purpose Agent**: Layer 7 alignment (Sonnet 4)
 * 5. **Action Agent**: Code execution via Phase 1 (Haiku 4.5)
 *
 * **Model-Agnostic Architecture**:
 * Users configure which provider powers each agent:
 * - Provider: anthropic, openai-codex, deepseek, etc.
 * - Model: user selects based on budget/quality
 * - API Key: from OAuth-stored credentials
 *
 * **Integration with Phase 1**:
 * Action Agent uses RemoteCommandExecutor for all execution.
 * Credentials managed by OpenClaw OAuth (never exposed).
 */

// Types only - helix-runtime is compiled separately
type RemoteCommandExecutor = any;


/**
 * Shared orchestrator state across all agents
 * Passed between agents, accumulated, immutable updates
 */
export interface OrchestratorState {
  // Input
  task: string;
  context?: Record<string, any>;

  // Routing
  currentAgent?: string;
  routingReason?: string;

  // Processing
  narrativeAnalysis?: string;
  memoryInsights?: any[];
  purposeAlignment?: string;
  actionResult?: string;

  // Metadata
  messages: Array<{ role: string; content: string }>;
  startTime: number;
  budget_cents: number;
  budget_remaining_cents: number;
}

/**
 * Supervisor Node
 *
 * Routes tasks to appropriate specialized agent based on analysis.
 * **Model**: Opus 4.5 (complex routing decisions)
 *
 * **Routing Logic**:
 * - Narrative analysis task? → Narrative Agent
 * - Memory retrieval task? → Memory Agent
 * - Purpose/ikigai alignment? → Purpose Agent
 * - Direct execution? → Action Agent
 * - Task complete? → END
 *
 * **Future Enhancement**: Cost-aware routing
 * - Analyze estimated cost for each path
 * - Prefer cheaper agents when quality similar
 * - Respect budget_remaining_cents
 */
export async function supervisorNode(state: OrchestratorState): Promise<Partial<OrchestratorState>> {
  // In production, this would use Claude API to analyze task
  // For now: simple routing based on keywords

  let nextAgent = 'action_agent'; // Default to action
  let reason = 'Generic execution';

  if (state.task.toLowerCase().includes('memory') || state.task.toLowerCase().includes('recall')) {
    nextAgent = 'memory_agent';
    reason = 'Task requires memory retrieval from layers 2-3';
  } else if (state.task.toLowerCase().includes('purpose') || state.task.toLowerCase().includes('meaning')) {
    nextAgent = 'purpose_agent';
    reason = 'Task requires purpose/ikigai alignment from layer 7';
  } else if (
    state.task.toLowerCase().includes('analyze') ||
    state.task.toLowerCase().includes('story')
  ) {
    nextAgent = 'narrative_agent';
    reason = 'Task requires narrative analysis from layer 1';
  }

  const updatedMessages = [
    ...state.messages,
    {
      role: 'supervisor',
      content: `Routing to ${nextAgent}: ${reason}`,
    },
  ];

  return {
    currentAgent: nextAgent,
    routingReason: reason,
    messages: updatedMessages,
  };
}

/**
 * Narrative Agent Node
 *
 * Analyzes task through Layer 1 (Narrative Core) lens.
 * **Model**: Opus 4.5 (complex narrative analysis)
 *
 * **Available Tools**:
 * - readSoulDocument(): Access HELIX_SOUL.md
 * - queryPsyeval(): Query psychological evaluation
 * - searchNarrativePatterns(): Find similar patterns in history
 * - generateNarrativeInsight(): Compute new insight
 *
 * **Input**: state.task
 * **Output**: state.narrativeAnalysis
 */
export async function narrativeAgentNode(
  state: OrchestratorState
): Promise<Partial<OrchestratorState>> {
  // Mock implementation
  const analysis = `Narrative Analysis of: "${state.task}"

  This task relates to Helix's core identity and narrative patterns.
  Pattern recognition suggests connection to [mock pattern].
  Recommended approach: [mock recommendation]`;

  const updatedMessages = [
    ...state.messages,
    {
      role: 'narrative_agent',
      content: `Completed Layer 1 analysis: ${analysis}`,
    },
  ];

  return {
    narrativeAnalysis: analysis,
    messages: updatedMessages,
  };
}

/**
 * Memory Agent Node
 *
 * Retrieves and synthesizes from Layers 2-3 (Emotional & Relational Memory).
 * **Model**: Sonnet 4 (balanced for typical retrieval)
 *
 * **Available Tools**:
 * - queryEmotionalTags(): Get emotional context
 * - searchAttachments(): Query relationship data
 * - getTrustMap(): Analyze trust levels
 * - synthesizeMemory(): Combine multiple memories
 *
 * **Input**: state.task
 * **Output**: state.memoryInsights
 */
export async function memoryAgentNode(
  state: OrchestratorState
): Promise<Partial<OrchestratorState>> {
  // Mock implementation
  const insights = [
    { layer: 'emotional', tag: 'relevant_memory', weight: 0.8 },
    { layer: 'relational', connection: 'related_entity', trust: 0.9 },
  ];

  const updatedMessages = [
    ...state.messages,
    {
      role: 'memory_agent',
      content: `Retrieved ${insights.length} memory insights from layers 2-3`,
    },
  ];

  return {
    memoryInsights: insights,
    messages: updatedMessages,
  };
}

/**
 * Purpose Agent Node
 *
 * Aligns task with Layer 7 (Purpose Engine) - ikigai and meaning.
 * **Model**: Sonnet 4 (balanced for alignment checking)
 *
 * **Available Tools**:
 * - queryIkigai(): Get purpose vectors
 * - getMeaningSources(): Query meaning sources
 * - evaluatePurposeAlignment(): Rate alignment score (0-1)
 * - suggestPurposefulApproach(): Reframe task for purpose
 *
 * **Input**: state.task
 * **Output**: state.purposeAlignment
 */
export async function purposeAgentNode(
  state: OrchestratorState
): Promise<Partial<OrchestratorState>> {
  // Mock implementation
  const alignment = `Purpose Alignment Analysis:

  Ikigai alignment: 0.85/1.0
  Meaning source: [mock source]
  Recommended purpose-driven approach: [mock approach]`;

  const updatedMessages = [
    ...state.messages,
    {
      role: 'purpose_agent',
      content: `Layer 7 analysis complete. Alignment: 0.85`,
    },
  ];

  return {
    purposeAlignment: alignment,
    messages: updatedMessages,
  };
}

/**
 * Action Agent Node
 *
 * Executes actions via Phase 1 RemoteCommandExecutor.
 * **Model**: Haiku 4.5 (fast execution, simple routing)
 *
 * **Available Tools**:
 * - executeRemoteCommand(): Queue command via Phase 1
 * - getQueueStatus(): Monitor executor
 * - cancelCommand(): Stop execution
 *
 * **Key Pattern - BYOK**:
 * - Uses credentials from ~/.openclaw/agents/main/agent/auth-profiles.json
 * - Never stores credentials in state
 * - Credentials managed by OpenClaw OAuth
 * - Remote devices never see tokens
 *
 * **Integration with Phase 1**:
 * ```typescript
 * const executor = getRemoteCommandExecutor(logger);
 * await executor.queueCommand(remoteCommand);
 * // Result broadcast via sync relay
 * ```
 *
 * @param state Orchestrator state
 * @param executor Phase 1 RemoteCommandExecutor instance
 * @returns Updated state with actionResult
 */
export async function actionAgentNode(
  state: OrchestratorState,
  _executor?: RemoteCommandExecutor
): Promise<Partial<OrchestratorState>> {
  // Mock implementation (would use executor in production)
  const result = `Action executed: ${state.task}
  Result: [mock execution result]`;

  const updatedMessages = [
    ...state.messages,
    {
      role: 'action_agent',
      content: `Execution complete. Result: ${result}`,
    },
  ];

  return {
    actionResult: result,
    messages: updatedMessages,
  };
}

/**
 * Routing function after supervisor
 * Determines which agent to route to
 */
export function routeAfterSupervisor(state: OrchestratorState): string {
  if (!state.currentAgent) {
    return 'END'; // No agent selected, complete
  }

  switch (state.currentAgent) {
    case 'narrative_agent':
      return 'narrative_agent';
    case 'memory_agent':
      return 'memory_agent';
    case 'purpose_agent':
      return 'purpose_agent';
    case 'action_agent':
      return 'action_agent';
    default:
      return 'END';
  }
}

/**
 * Routing function after specialized agents
 * All specialized agents route back to supervisor or end
 */
export function routeAfterAgent(_state: OrchestratorState): string {
  // Check if another agent is needed
  // For now: after one agent, complete
  return 'END';
}

/**
 * Create initial state for orchestration
 */
export function createInitialState(task: string, budget_cents = 100): OrchestratorState {
  return {
    task,
    context: {},
    messages: [
      {
        role: 'user',
        content: task,
      },
    ],
    startTime: Date.now(),
    budget_cents,
    budget_remaining_cents: budget_cents,
  };
}

/**
 * Agent Configuration
 * Users customize which model/provider powers each agent
 */
export interface AgentConfig {
  provider: string; // 'anthropic', 'openai-codex', 'deepseek', etc.
  model: string; // 'claude-opus-4.5', 'gpt-4', 'deepseek-v3', etc.
  credential?: string; // From auth-profiles.json
}

export interface OrchestratorConfig {
  supervisor: AgentConfig;
  narrativeAgent: AgentConfig;
  memoryAgent: AgentConfig;
  purposeAgent: AgentConfig;
  actionAgent: AgentConfig;

  // Approval settings (Phase 2 extension)
  approvalMode: 'budget' | 'operation' | 'cost-threshold' | 'manual';
  budgetThresholds?: {
    autoApprove?: number; // cents
    requireApproval?: number; // cents
  };

  // Checkpointing
  enableCheckpointing: boolean;
}

/**
 * Default configuration
 * All models with high quality (Opus, Sonnet, no Haiku for demos)
 */
export const DEFAULT_CONFIG: OrchestratorConfig = {
  supervisor: {
    provider: 'anthropic',
    model: 'claude-opus-4.5',
  },
  narrativeAgent: {
    provider: 'anthropic',
    model: 'claude-opus-4.5',
  },
  memoryAgent: {
    provider: 'anthropic',
    model: 'claude-sonnet-4',
  },
  purposeAgent: {
    provider: 'anthropic',
    model: 'claude-sonnet-4',
  },
  actionAgent: {
    provider: 'anthropic',
    model: 'claude-haiku-4.5',
  },

  approvalMode: 'budget',
  budgetThresholds: {
    autoApprove: 50, // $0.50
    requireApproval: 100, // $1.00
  },

  enableCheckpointing: true,
};
