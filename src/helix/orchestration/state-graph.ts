/**
 * TypeScript State Graph - Phase 2 Module 1
 *
 * Pure TypeScript implementation of LangGraph's state graph pattern.
 * Enables supervisor + specialized agents to coordinate via state transitions.
 *
 * **Why TypeScript Implementation?**
 * LangGraph is Python-only. We need TypeScript for:
 * - OpenClaw gateway integration
 * - Supabase checkpointing
 * - Discord logging
 * - Multi-device execution (Phase 1 RemoteCommandExecutor)
 *
 * **Architecture**:
 * ```
 * Input State
 *   → Node 1 (modify state)
 *   → ConditionalEdge (route based on state)
 *   → Node 2 or Node 3 (parallel possible)
 *   → Checkpoint (save state)
 *   → END
 * Output State
 * ```
 *
 * **Pattern from Lingxi**:
 * - State immutability (spread operator for updates)
 * - Generic TState for strong typing
 * - Conditional routing for complex flows
 * - Checkpointing for replay/debugging
 */

/**
 * Node function: Takes state, returns updated state (or partial)
 * Async for AI model calls, database queries, etc.
 */
export type NodeFunction<TState> = (
  state: TState
) => TState | Partial<TState> | Promise<TState | Partial<TState>>;

/**
 * Conditional edge function: Analyzes state, returns next node name
 * Used for routing based on task type, priority, etc.
 */
export type ConditionalEdgeFn<TState> = (state: TState) => string;

/**
 * Mapping from outcome to node name
 * Result of conditional edge function maps to destination node
 */
export interface ConditionalEdgeMapping {
  [outcome: string]: string;
}

/**
 * Edge configuration: from → to with optional condition
 */
export interface EdgeConfig<TState> {
  from: string;
  to: string | ConditionalEdgeFn<TState>;
  condition?: (state: TState) => boolean;
}

/**
 * Built-in END node (marks graph completion)
 */
export const END = 'END' as const;

/**
 * StateGraph Builder
 *
 * Fluent API for constructing graphs:
 * ```typescript
 * const graph = new StateGraph(stateSchema)
 *   .addNode('supervisor', supervisorNode)
 *   .addNode('narrative_agent', narrativeNode)
 *   .addNode('action_agent', actionNode)
 *   .addEdge('supervisor', 'narrative_agent')
 *   .addConditionalEdges('narrative_agent', routeAfterNarrative, {
 *     'needs_action': 'action_agent',
 *     'complete': END,
 *   })
 *   .setEntryPoint('supervisor');
 *
 * const compiled = graph.compile(checkpointer);
 * const result = await compiled.invoke(initialState);
 * ```
 */
export class StateGraph<TState = any> {
  private nodes = new Map<string, NodeFunction<TState>>();
  private edges: EdgeConfig<TState>[] = [];
  private conditionalEdges = new Map<
    string,
    { fn: ConditionalEdgeFn<TState>; mapping: ConditionalEdgeMapping }
  >();
  private entryPoint: string | null = null;

  constructor(_stateSchema?: any) {
    // stateSchema parameter for future type validation
    void _stateSchema;
  }

  /**
   * Add a node (state transformation function)
   *
   * @param name Node identifier
   * @param fn Function that transforms state
   */
  public addNode(name: string, fn: NodeFunction<TState>): this {
    if (name === END) {
      throw new Error('Cannot add node with name "END" - it is reserved');
    }
    this.nodes.set(name, fn);
    return this;
  }

  /**
   * Add an edge from one node to another
   *
   * @param from Source node
   * @param to Destination node or conditional function
   */
  public addEdge(from: string, to: string, condition?: (state: TState) => boolean): this {
    if (!this.nodes.has(from) && from !== END) {
      throw new Error(`Edge source not found: ${from}`);
    }
    this.edges.push({ from, to, condition });
    return this;
  }

  /**
   * Add conditional edges (routing based on state)
   *
   * @param source Source node
   * @param fn Function that determines next node name
   * @param mapping Map from outcome to node name
   */
  public addConditionalEdges(
    source: string,
    fn: ConditionalEdgeFn<TState>,
    mapping: ConditionalEdgeMapping
  ): this {
    if (!this.nodes.has(source) && source !== END) {
      throw new Error(`Conditional edge source not found: ${source}`);
    }

    // Validate mapping points to existing nodes
    for (const [_outcome, dest] of Object.entries(mapping)) {
      if (dest !== END && !this.nodes.has(dest)) {
        throw new Error(`Conditional edge destination not found: ${dest}`);
      }
    }

    this.conditionalEdges.set(source, { fn, mapping });
    return this;
  }

  /**
   * Set graph entry point
   *
   * @param node Node to start execution from
   */
  public setEntryPoint(node: string): this {
    if (!this.nodes.has(node)) {
      throw new Error(`Entry point not found: ${node}`);
    }
    this.entryPoint = node;
    return this;
  }

  /**
   * Compile graph into executable form
   *
   * Validates graph integrity before compiling.
   * Returns CompiledGraph with invoke/stream methods.
   *
   * @param checkpointer Optional checkpointer for state persistence
   */
  public compile(checkpointer?: any): CompiledGraph<TState> {
    // Validate entry point
    if (!this.entryPoint) {
      throw new Error('Entry point not set. Call setEntryPoint() before compiling.');
    }

    // Validate all edges point to existing nodes
    for (const edge of this.edges) {
      if (typeof edge.to === 'string' && edge.to !== END) {
        if (!this.nodes.has(edge.to)) {
          throw new Error(`Edge destination not found: ${edge.to}`);
        }
      }
    }

    return new CompiledGraph(
      this.nodes,
      this.edges,
      this.entryPoint,
      this.conditionalEdges,
      checkpointer,
      undefined
    );
  }
}

/**
 * Compiled Graph (Executable)
 *
 * Ready-to-run graph with invoke/stream methods.
 * Handles node execution, routing, checkpointing.
 */
export class CompiledGraph<TState = any> {
  constructor(
    private nodes: Map<string, NodeFunction<TState>>,
    private edges: EdgeConfig<TState>[],
    private entryPoint: string,
    private conditionalEdges: Map<string, { fn: ConditionalEdgeFn<TState>; mapping: any }>,
    private checkpointer?: any,
    _stateSchema?: any
  ) {
    // stateSchema parameter accepted for future type validation
    void _stateSchema;
  }

  /**
   * Execute graph to completion
   *
   * Runs from entry point, following edges, until reaching END node.
   * Optionally saves checkpoints after each node.
   *
   * @param initialState Initial state object
   * @param config Configuration (e.g., thread_id for checkpoints)
   * @returns Final state
   */
  public async invoke(
    initialState: TState,
    config?: { thread_id?: string }
  ): Promise<TState> {
    let currentNode = this.entryPoint;
    let state = initialState;
    let stepCount = 0;
    const maxSteps = 100; // Prevent infinite loops

    while (currentNode !== END && stepCount < maxSteps) {
      stepCount++;

      // Save checkpoint before node execution (pre-execution pattern)
      if (this.checkpointer && config?.thread_id) {
        try {
          await this.checkpointer.save({
            checkpoint_id: this._generateId(),
            thread_id: config.thread_id,
            parent_checkpoint_id: null,
            state,
            timestamp: Date.now(),
            hash: '',
          });
        } catch (err) {
          console.warn('Checkpoint save failed:', err);
          // Don't fail - continue execution
        }
      }

      // Execute current node
      const nodeFn = this.nodes.get(currentNode);
      if (!nodeFn) {
        throw new Error(`Node not found: ${currentNode}`);
      }

      const nodeResult = await nodeFn(state);

      // Merge result into state (immutable update)
      state = this._mergeState(state, nodeResult);

      // Determine next node
      currentNode = this._getNextNode(currentNode, state);
    }

    if (stepCount >= maxSteps) {
      throw new Error('Graph execution exceeded maximum steps (100)');
    }

    return state;
  }

  /**
   * Stream graph execution
   *
   * Yields state after each node for real-time progress updates.
   * Useful for dashboards and live monitoring.
   *
   * @param initialState Initial state
   * @param config Configuration
   */
  public async *stream(
    initialState: TState,
    _config?: { thread_id?: string }
  ): AsyncGenerator<{ node: string; state: TState }, void, unknown> {
    let currentNode = this.entryPoint;
    let state = initialState;
    let stepCount = 0;
    const maxSteps = 100;

    while (currentNode !== END && stepCount < maxSteps) {
      stepCount++;

      // Execute node
      const nodeFn = this.nodes.get(currentNode);
      if (!nodeFn) {
        throw new Error(`Node not found: ${currentNode}`);
      }

      const nodeResult = await nodeFn(state);
      state = this._mergeState(state, nodeResult);

      // Yield after node execution
      yield { node: currentNode, state };

      // Determine next node
      currentNode = this._getNextNode(currentNode, state);
    }

    if (stepCount >= maxSteps) {
      throw new Error('Graph execution exceeded maximum steps (100)');
    }
  }

  /**
   * Determine next node based on edges and routing
   */
  private _getNextNode(currentNode: string, state: TState): string {
    // Check for conditional edges first
    const conditionalEdge = this.conditionalEdges.get(currentNode);
    if (conditionalEdge) {
      const outcome = conditionalEdge.fn(state);
      const nextNode = conditionalEdge.mapping[outcome];
      if (!nextNode) {
        throw new Error(
          `Conditional edge mapping missing outcome: ${outcome} from node ${currentNode}`
        );
      }
      return nextNode;
    }

    // Check for regular edges
    for (const edge of this.edges) {
      if (edge.from === currentNode) {
        // If edge has condition, check it
        if (edge.condition && !edge.condition(state)) {
          continue;
        }

        // If to is a function, call it
        if (typeof edge.to === 'function') {
          return edge.to(state);
        }

        // Otherwise use string destination
        return edge.to;
      }
    }

    // No edge found - go to END
    return END;
  }

  /**
   * Merge node result into state immutably
   */
  private _mergeState(state: TState, result: any): TState {
    if (!result) {
      return state;
    }

    // If result is a Promise, we shouldn't reach here (should be awaited)
    if (result instanceof Promise) {
      throw new Error('Promise not awaited in node function');
    }

    // Merge using spread operator (shallow merge)
    return { ...state, ...result } as TState;
  }

  /**
   * Generate a unique ID for checkpoints
   */
  private _generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

/**
 * Helper to create a state update function
 *
 * Useful for conditional node functions that only update certain fields:
 * ```typescript
 * .addNode('analyze', (state) =>
 *   updateState(state, { analysis: result })
 * )
 * ```
 */
export function updateState<TState>(_state: TState, updates: Partial<TState>): Partial<TState> {
  return updates;
}

/**
 * Helper to create a node that logs and passes state through
 *
 * Useful for debugging:
 * ```typescript
 * .addNode('log', passthrough((state) => {
 *   console.log('State:', state);
 * }))
 * ```
 */
export function passthrough<TState>(
  fn: (state: TState) => void | Promise<void>
): NodeFunction<TState> {
  return async (state: TState) => {
    await fn(state);
    return state;
  };
}
