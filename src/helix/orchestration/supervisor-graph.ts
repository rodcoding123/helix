/**
 * Supervisor Graph Assembly - Phase 2 Module 9
 *
 * Wires StateGraph + Agents into complete orchestrator.
 * Entry point for orchestration pipeline.
 *
 * **Architecture**:
 * ```
 * Supervisor (routing hub)
 *   ├→ Narrative Agent → END
 *   ├→ Memory Agent → END
 *   ├→ Purpose Agent → END
 *   └→ Action Agent → END
 * ```
 *
 * **State Flow**:
 * 1. Task enters at Supervisor
 * 2. Supervisor analyzes and routes
 * 3. Selected agent processes with specialized tools
 * 4. Result added to state
 * 5. Route back to Supervisor or END
 *
 * **With Checkpointing**:
 * State saved after each node (TRAE pattern)
 * Enables resumption and replay
 */

import { StateGraph, END } from './state-graph.js';
import type { CompiledGraph } from './state-graph.js';
import type { ICheckpointer } from './checkpointer.js';
import {
  supervisorNode,
  narrativeAgentNode,
  memoryAgentNode,
  purposeAgentNode,
  actionAgentNode,
  routeAfterSupervisor,
  type OrchestratorState,
  type OrchestratorConfig,
  DEFAULT_CONFIG,
} from './agents.js';

// Remote command executor type (from Phase 1, compiled separately)
type RemoteCommandExecutor = any;

/**
 * Create and compile the supervisor graph
 *
 * **Parameters**:
 * - config: Agent model configuration (providers, models)
 * - checkpointer: Optional Supabase checkpointer for state persistence
 * - executor: Phase 1 RemoteCommandExecutor for action agent
 *
 * **Returns**: CompiledGraph ready for invoke/stream
 *
 * @example
 * ```typescript
 * const graph = createSupervisorGraph({
 *   supervisor: { provider: 'anthropic', model: 'claude-opus-4.5' },
 *   // ... other agent configs
 * });
 *
 * const result = await graph.invoke(initialState, { thread_id: 'session-123' });
 * ```
 */
export function createSupervisorGraph(
  config: Partial<OrchestratorConfig> = {},
  checkpointer?: ICheckpointer,
  executor?: RemoteCommandExecutor
): CompiledGraph<OrchestratorState> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  void finalConfig; // Use finalConfig to silence unused warning - will be used in production

  // Create state schema (optional but helps with type checking)
  const stateSchema = {
    task: { type: 'string' },
    messages: { type: 'array' },
    narrativeAnalysis: { type: 'string' },
    memoryInsights: { type: 'array' },
    purposeAlignment: { type: 'string' },
    actionResult: { type: 'string' },
  };

  // Build graph with fluent API
  const graph = new StateGraph<OrchestratorState>(stateSchema)
    // Add nodes
    .addNode('supervisor', supervisorNode)
    .addNode('narrative_agent', (state) => narrativeAgentNode(state))
    .addNode('memory_agent', (state) => memoryAgentNode(state))
    .addNode('purpose_agent', (state) => purposeAgentNode(state))
    .addNode('action_agent', (state) => actionAgentNode(state, executor))

    // Add edges: each agent back to supervisor or END
    .addConditionalEdges('supervisor', routeAfterSupervisor, {
      narrative_agent: 'narrative_agent',
      memory_agent: 'memory_agent',
      purpose_agent: 'purpose_agent',
      action_agent: 'action_agent',
      END: END,
    })

    // After specialized agents, go to END
    // (In production, could route back to supervisor for multi-step workflows)
    .addEdge('narrative_agent', END)
    .addEdge('memory_agent', END)
    .addEdge('purpose_agent', END)
    .addEdge('action_agent', END)

    // Set entry point
    .setEntryPoint('supervisor');

  // Compile with optional checkpointer
  return graph.compile(checkpointer);
}

/**
 * Run orchestrator with input task
 *
 * Simplified API for common use case:
 * - Submit task
 * - Let orchestrator route and execute
 * - Get result
 *
 * @param task User's input task
 * @param options Configuration options
 * @returns Final orchestrator state with results
 */
export async function runOrchestrator(
  task: string,
  options?: {
    config?: Partial<OrchestratorConfig>;
    checkpointer?: ICheckpointer;
    executor?: RemoteCommandExecutor;
    threadId?: string;
  }
): Promise<OrchestratorState> {
  const { createInitialState } = await import('./agents.js');

  // Create graph
  const graph = createSupervisorGraph(
    options?.config,
    options?.checkpointer,
    options?.executor
  );

  // Create initial state
  const initialState = createInitialState(task);

  // Execute
  const result = await graph.invoke(initialState, {
    thread_id: options?.threadId || `session-${Date.now()}`,
  });

  return result;
}

/**
 * Stream orchestrator execution
 *
 * For real-time progress updates in dashboard.
 * Yields after each node executes.
 *
 * @param task User's input task
 * @param onNodeComplete Callback after each node
 * @param options Configuration
 * @returns Final state
 */
export async function streamOrchestrator(
  task: string,
  onNodeComplete?: (node: string, state: OrchestratorState) => void,
  options?: {
    config?: Partial<OrchestratorConfig>;
    checkpointer?: ICheckpointer;
    executor?: RemoteCommandExecutor;
    threadId?: string;
  }
): Promise<OrchestratorState> {
  const { createInitialState } = await import('./agents.js');

  // Create graph
  const graph = createSupervisorGraph(
    options?.config,
    options?.checkpointer,
    options?.executor
  );

  // Create initial state
  const initialState = createInitialState(task);

  // Stream and collect results
  let finalState = initialState;
  for await (const { node, state } of graph.stream(initialState, {
    thread_id: options?.threadId || `session-${Date.now()}`,
  })) {
    onNodeComplete?.(node, state);
    finalState = state;
  }

  return finalState;
}

/**
 * Resume orchestrator from checkpoint
 *
 * Useful after interruption or for continuing partial execution.
 *
 * @param checkpointId ID of checkpoint to resume from
 * @param options Configuration
 * @returns Final state
 */
export async function resumeOrchestrator(
  checkpointId: string,
  options?: {
    checkpointer?: ICheckpointer;
    executor?: RemoteCommandExecutor;
  }
): Promise<OrchestratorState> {
  if (!options?.checkpointer) {
    throw new Error('Checkpointer required for resumption');
  }

  // Load checkpoint
  const checkpoint = await options.checkpointer.loadByCheckpointId(checkpointId);
  if (!checkpoint) {
    throw new Error(`Checkpoint not found: ${checkpointId}`);
  }

  // Resume execution from this state
  const graph = createSupervisorGraph({}, options.checkpointer, options.executor);
  const result = await graph.invoke(checkpoint.state as OrchestratorState, {
    thread_id: checkpoint.thread_id,
  });

  return result;
}

/**
 * Get execution history for a session
 *
 * Shows all checkpoints and their state snapshots.
 * Useful for debugging and analysis.
 *
 * @param threadId Session/thread identifier
 * @param checkpointer Checkpointer with stored history
 * @returns Array of checkpoint states
 */
export async function getExecutionHistory(
  threadId: string,
  checkpointer: ICheckpointer
): Promise<OrchestratorState[]> {
  const checkpoints = await checkpointer.list(threadId);
  return checkpoints.map((cp) => cp.state) as OrchestratorState[];
}

/**
 * Compare two execution paths
 *
 * Useful for A/B testing different routing strategies.
 * Returns final state from each path for comparison.
 *
 * @param task Shared task
 * @param config1 First configuration
 * @param config2 Second configuration
 * @returns Results from both paths
 */
export async function compareExecutionPaths(
  task: string,
  config1: OrchestratorConfig,
  config2: OrchestratorConfig
): Promise<{
  path1: OrchestratorState;
  path2: OrchestratorState;
}> {
  const path1 = await runOrchestrator(task, {
    config: config1,
    threadId: 'compare-path-1',
  });

  const path2 = await runOrchestrator(task, {
    config: config2,
    threadId: 'compare-path-2',
  });

  return { path1, path2 };
}

/**
 * Create agent model configuration from user preferences
 *
 * Users can specify which provider/model for each agent.
 * Validates that all required agents are configured.
 *
 * @param userConfig User's preferences
 * @returns Complete validated configuration
 */
export function createAgentConfig(
  userConfig?: Partial<OrchestratorConfig>
): OrchestratorConfig {
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  // Validate all agents are configured
  const requiredAgents = [
    'supervisor',
    'narrativeAgent',
    'memoryAgent',
    'purposeAgent',
    'actionAgent',
  ] as const;

  for (const agent of requiredAgents) {
    if (!config[agent as keyof OrchestratorConfig]) {
      throw new Error(`Missing configuration for agent: ${agent}`);
    }
  }

  return config;
}
