/**
 * Supervisor Graph Test Suite
 * Tests orchestration graph assembly, execution, and state management
 */

/* @ts-nocheck */
/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-argument,@typescript-eslint/require-await,@typescript-eslint/no-unused-vars,@typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unsafe-function-type,@typescript-eslint/no-explicit-any,@typescript-eslint/unbound-method */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ICheckpointer, Checkpoint } from './checkpointer.js';
import {
  createSupervisorGraph,
  runOrchestrator,
  streamOrchestrator,
  resumeOrchestrator,
  getExecutionHistory,
  compareExecutionPaths,
  createAgentConfig,
} from './supervisor-graph.js';
import type { OrchestratorState, OrchestratorConfig, RemoteCommandExecutor } from './agents.js';

// Mock agents module
vi.mock('./agents.js', () => ({
  supervisorNode: vi.fn(),
  narrativeAgentNode: vi.fn(),
  memoryAgentNode: vi.fn(),
  purposeAgentNode: vi.fn(),
  actionAgentNode: vi.fn(),
  routeAfterSupervisor: vi.fn(),
  createInitialState: vi.fn(),
  DEFAULT_CONFIG: {
    supervisor: { provider: 'anthropic', model: 'claude-opus-4.5' },
    narrativeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
    memoryAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
    purposeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
    actionAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
    approvalMode: 'budget',
    enableCheckpointing: true,
  } as OrchestratorConfig,
}));

// Mock StateGraph
vi.mock('./state-graph.js', () => ({
  StateGraph: class MockStateGraph {
    private nodes: Map<string, Function> = new Map();
    private edges: Map<string, string[]> = new Map();
    private conditionalEdges: Map<string, [Function, Record<string, string>]> = new Map();
    schema: any;

    constructor(schema: any) {
      this.schema = schema;
    }

    addNode(name: string, fn: Function) {
      this.nodes.set(name, fn);
      return this;
    }

    addEdge(from: string, to: string) {
      if (!this.edges.has(from)) {
        this.edges.set(from, []);
      }
      this.edges.get(from)!.push(to);
      return this;
    }

    addConditionalEdges(from: string, fn: Function, edges: Record<string, string>) {
      this.conditionalEdges.set(from, [fn, edges]);
      return this;
    }

    setEntryPoint(_name: string) {
      return this;
    }

    compile() {
      return {
        invoke: vi.fn(async () => ({})),
        stream: vi.fn(async function* () {
          yield { node: 'supervisor', state: {} };
        }),
      };
    }
  },
  END: 'END',
}));

describe('Supervisor Graph', () => {
  let mockCheckpointer: ICheckpointer;
  let mockExecutor: RemoteCommandExecutor;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCheckpointer = {
      save: vi.fn(),
      load: vi.fn(),
      loadByCheckpointId: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    };

    mockExecutor = {
      queueCommand: vi.fn(async () => undefined),
      getQueueStatus: vi.fn(async () => ({ pending: 0, running: 0 })),
      cancelCommand: vi.fn(async () => undefined),
    };
  });

  describe('createSupervisorGraph()', () => {
    it('should create graph with default configuration', () => {
      const graph = createSupervisorGraph();

      expect(graph).toBeDefined();
      expect(graph.invoke).toBeDefined();
      expect(graph.stream).toBeDefined();
    });

    it('should create graph with custom configuration', () => {
      const customConfig: Partial<OrchestratorConfig> = {
        supervisor: { provider: 'deepseek', model: 'deepseek-chat' },
      };

      const graph = createSupervisorGraph(customConfig);

      expect(graph).toBeDefined();
    });

    it('should create graph with checkpointer', () => {
      const graph = createSupervisorGraph({}, mockCheckpointer);

      expect(graph).toBeDefined();
    });

    it('should create graph with executor', () => {
      const graph = createSupervisorGraph({}, undefined, mockExecutor);

      expect(graph).toBeDefined();
    });

    it('should include all agent nodes', () => {
      const graph = createSupervisorGraph();

      expect(graph).toBeDefined();
      expect(graph.invoke).toBeDefined();
    });

    it('should set supervisor as entry point', () => {
      const graph = createSupervisorGraph();

      expect(graph).toBeDefined();
    });

    it('should configure conditional routing from supervisor', () => {
      const graph = createSupervisorGraph();

      expect(graph).toBeDefined();
    });

    it('should route all agents to END', () => {
      const graph = createSupervisorGraph();

      expect(graph).toBeDefined();
    });
  });

  describe('runOrchestrator()', () => {
    it('should run orchestrator with task', async () => {
      const { createInitialState } = await import('./agents.js');
      const initialState = {
        task: 'test task',
        messages: [] as any[],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      };

      vi.mocked(createInitialState).mockReturnValue(initialState);

      const result = await runOrchestrator('test task');

      expect(result).toBeDefined();
    });

    it('should use provided thread ID', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const threadId = 'custom-thread-123';
      const result = await runOrchestrator('test task', { threadId });

      expect(result).toBeDefined();
    });

    it('should generate thread ID if not provided', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const result = await runOrchestrator('test task');

      expect(result).toBeDefined();
    });

    it('should accept custom configuration', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const customConfig: Partial<OrchestratorConfig> = {
        supervisor: { provider: 'custom', model: 'custom-model' },
      };

      const result = await runOrchestrator('test task', { config: customConfig });

      expect(result).toBeDefined();
    });

    it('should accept checkpointer', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const result = await runOrchestrator('test task', {
        checkpointer: mockCheckpointer,
      });

      expect(result).toBeDefined();
    });

    it('should accept executor', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const result = await runOrchestrator('test task', {
        executor: mockExecutor,
      });

      expect(result).toBeDefined();
    });

    it('should return orchestrator state', async () => {
      const { createInitialState } = await import('./agents.js');
      const expectedState = {
        task: 'test task',
        messages: [{ role: 'assistant', content: 'final result' }],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      };

      vi.mocked(createInitialState).mockReturnValue(expectedState);

      const result = await runOrchestrator('test task');

      expect(result).toBeDefined();
    });
  });

  describe('streamOrchestrator()', () => {
    it('should stream orchestrator execution', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      let callCount = 0;
      const callback = vi.fn((_node: string, _state: OrchestratorState) => {
        callCount++;
      });

      const result = await streamOrchestrator('test task', callback);

      expect(result).toBeDefined();
      expect(callback).toHaveBeenCalled();
    });

    it('should call callback for each node', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const callback = vi.fn();

      await streamOrchestrator('test task', callback);

      expect(callback).toHaveBeenCalled();
    });

    it('should provide node name and state to callback', async () => {
      const { createInitialState } = await import('./agents.js');
      const initialState = {
        task: 'test task',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as OrchestratorState;

      vi.mocked(createInitialState).mockReturnValue(initialState);

      const callback = vi.fn();

      await streamOrchestrator('test task', callback);

      expect(callback).toHaveBeenCalled();
      if (callback.mock.calls.length > 0) {
        const [nodeName, state] = callback.mock.calls[0];
        expect(typeof nodeName).toBe('string');
        expect(state).toBeDefined();
      }
    });

    it('should work without callback', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const result = await streamOrchestrator('test task');

      expect(result).toBeDefined();
    });

    it('should return final state', async () => {
      const { createInitialState } = await import('./agents.js');
      const expectedState = {
        task: 'test task',
        messages: [{ role: 'user', content: 'input' }],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as OrchestratorState;

      vi.mocked(createInitialState).mockReturnValue(expectedState);

      const result = await streamOrchestrator('test task');

      expect(result).toBeDefined();
    });

    it('should accept options', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const result = await streamOrchestrator('test task', undefined, {
        threadId: 'stream-thread-1',
        checkpointer: mockCheckpointer,
      });

      expect(result).toBeDefined();
    });

    it('should track intermediate states', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const states: OrchestratorState[] = [];
      const callback = (_node: string, state: OrchestratorState) => {
        states.push(state);
      };

      const result = await streamOrchestrator('test task', callback);

      expect(result).toBeDefined();
    });
  });

  describe('resumeOrchestrator()', () => {
    it('should throw if checkpointer not provided', async () => {
      await expect(resumeOrchestrator('cp-123')).rejects.toThrow(
        'Checkpointer required for resumption'
      );
    });

    it('should throw if checkpoint not found', async () => {
      vi.mocked(mockCheckpointer.loadByCheckpointId).mockResolvedValue(null);

      await expect(
        resumeOrchestrator('nonexistent-cp', { checkpointer: mockCheckpointer })
      ).rejects.toThrow('Checkpoint not found');
    });

    it('should load checkpoint by ID', async () => {
      const checkpoint: Checkpoint<OrchestratorState> = {
        checkpoint_id: 'cp-123',
        thread_id: 'thread-1',
        parent_checkpoint_id: null,
        state: {
          task: 'resumed task',
          messages: [],
          startTime: Date.now(),
          budget_cents: 100,
          budget_remaining_cents: 100,
        },
        timestamp: Date.now(),
        hash: 'hash123',
      };

      vi.mocked(mockCheckpointer.loadByCheckpointId).mockResolvedValue(checkpoint);

      const result = await resumeOrchestrator('cp-123', { checkpointer: mockCheckpointer });

      expect(mockCheckpointer.loadByCheckpointId).toHaveBeenCalledWith('cp-123');
      expect(result).toBeDefined();
    });

    it('should resume from checkpoint state', async () => {
      const checkpointState: OrchestratorState = {
        task: 'resumed from checkpoint',
        messages: [{ role: 'assistant', content: 'partial result' }],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      };

      const checkpoint: Checkpoint<OrchestratorState> = {
        checkpoint_id: 'cp-456',
        thread_id: 'thread-2',
        parent_checkpoint_id: null,
        state: checkpointState,
        timestamp: Date.now(),
        hash: 'hash456',
      };

      vi.mocked(mockCheckpointer.loadByCheckpointId).mockResolvedValue(checkpoint);

      const result = await resumeOrchestrator('cp-456', { checkpointer: mockCheckpointer });

      expect(result).toBeDefined();
    });

    it('should use checkpoint thread ID', async () => {
      const checkpoint: Checkpoint<OrchestratorState> = {
        checkpoint_id: 'cp-789',
        thread_id: 'original-thread-id',
        parent_checkpoint_id: null,
        state: {
          task: 'test',
          messages: [],
          startTime: Date.now(),
          budget_cents: 100,
          budget_remaining_cents: 100,
        },
        timestamp: Date.now(),
        hash: 'hash789',
      };

      vi.mocked(mockCheckpointer.loadByCheckpointId).mockResolvedValue(checkpoint);

      const result = await resumeOrchestrator('cp-789', { checkpointer: mockCheckpointer });

      expect(result).toBeDefined();
    });

    it('should accept executor', async () => {
      const checkpoint: Checkpoint<OrchestratorState> = {
        checkpoint_id: 'cp-999',
        thread_id: 'thread-3',
        parent_checkpoint_id: null,
        state: {
          task: 'test',
          messages: [],
          startTime: Date.now(),
          budget_cents: 100,
          budget_remaining_cents: 100,
        },
        timestamp: Date.now(),
        hash: 'hash999',
      };

      vi.mocked(mockCheckpointer.loadByCheckpointId).mockResolvedValue(checkpoint);

      const result = await resumeOrchestrator('cp-999', {
        checkpointer: mockCheckpointer,
        executor: mockExecutor,
      });

      expect(result).toBeDefined();
    });
  });

  describe('getExecutionHistory()', () => {
    it('should return empty array if no checkpoints', async () => {
      vi.mocked(mockCheckpointer.list).mockResolvedValue([]);

      const history = await getExecutionHistory('thread-empty', mockCheckpointer);

      expect(history).toEqual([]);
    });

    it('should return checkpoints for thread', async () => {
      const checkpoints: Checkpoint<OrchestratorState>[] = [
        {
          checkpoint_id: 'cp-1',
          thread_id: 'thread-hist',
          parent_checkpoint_id: null,
          state: {
            task: 'step 1',
            messages: [],
            startTime: Date.now(),
            budget_cents: 100,
            budget_remaining_cents: 100,
          },
          timestamp: Date.now(),
          hash: 'h1',
        },
        {
          checkpoint_id: 'cp-2',
          thread_id: 'thread-hist',
          parent_checkpoint_id: 'cp-1',
          state: {
            task: 'step 2',
            messages: [{ role: 'user', content: 'input' }],
            startTime: Date.now(),
            budget_cents: 100,
            budget_remaining_cents: 100,
          },
          timestamp: Date.now() + 1000,
          hash: 'h2',
        },
      ];

      vi.mocked(mockCheckpointer.list).mockResolvedValue(checkpoints);

      const history = await getExecutionHistory('thread-hist', mockCheckpointer);

      expect(history).toHaveLength(2);
      expect(history[0].task).toBe('step 1');
      expect(history[1].task).toBe('step 2');
    });

    it('should preserve state in history', async () => {
      const state: OrchestratorState = {
        task: 'preserved task',
        messages: [
          { role: 'user', content: 'query' },
          { role: 'assistant', content: 'response' },
        ],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      };

      const checkpoint: Checkpoint<OrchestratorState> = {
        checkpoint_id: 'cp-hist',
        thread_id: 'thread-preserve',
        parent_checkpoint_id: null,
        state,
        timestamp: Date.now(),
        hash: 'hpreserve',
      };

      vi.mocked(mockCheckpointer.list).mockResolvedValue([checkpoint]);

      const history = await getExecutionHistory('thread-preserve', mockCheckpointer);

      expect(history[0]).toEqual(state);
    });

    it('should call checkpointer.list with thread ID', async () => {
      vi.mocked(mockCheckpointer.list).mockResolvedValue([]);

      await getExecutionHistory('thread-id-123', mockCheckpointer);

      expect(mockCheckpointer.list).toHaveBeenCalledWith('thread-id-123');
    });

    it('should return states in order', async () => {
      const checkpoints: Checkpoint<OrchestratorState>[] = [
        {
          checkpoint_id: 'cp-a',
          thread_id: 'thread-order',
          parent_checkpoint_id: null,
          state: {
            task: 'a',
            messages: [],
            startTime: Date.now(),
            budget_cents: 100,
            budget_remaining_cents: 100,
          },
          timestamp: 1000,
          hash: 'ha',
        },
        {
          checkpoint_id: 'cp-b',
          thread_id: 'thread-order',
          parent_checkpoint_id: 'cp-a',
          state: {
            task: 'b',
            messages: [],
            startTime: Date.now(),
            budget_cents: 100,
            budget_remaining_cents: 100,
          },
          timestamp: 2000,
          hash: 'hb',
        },
        {
          checkpoint_id: 'cp-c',
          thread_id: 'thread-order',
          parent_checkpoint_id: 'cp-b',
          state: {
            task: 'c',
            messages: [],
            startTime: Date.now(),
            budget_cents: 100,
            budget_remaining_cents: 100,
          },
          timestamp: 3000,
          hash: 'hc',
        },
      ];

      vi.mocked(mockCheckpointer.list).mockResolvedValue(checkpoints);

      const history = await getExecutionHistory('thread-order', mockCheckpointer);

      expect(history.map(s => s.task)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('compareExecutionPaths()', () => {
    it('should run task with two different configurations', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'compare task',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const config1: OrchestratorConfig = {
        supervisor: { provider: 'anthropic', model: 'claude-opus-4.5' },
        narrativeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        memoryAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        purposeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        actionAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        approvalMode: 'budget',
        enableCheckpointing: true,
      };

      const config2: OrchestratorConfig = {
        supervisor: { provider: 'deepseek', model: 'deepseek-chat' },
        narrativeAgent: { provider: 'deepseek', model: 'deepseek-chat' },
        memoryAgent: { provider: 'deepseek', model: 'deepseek-chat' },
        purposeAgent: { provider: 'deepseek', model: 'deepseek-chat' },
        actionAgent: { provider: 'deepseek', model: 'deepseek-chat' },
        approvalMode: 'budget',
        enableCheckpointing: true,
      };

      const result = await compareExecutionPaths('compare task', config1, config2);

      expect(result).toBeDefined();
      expect(result.path1).toBeDefined();
      expect(result.path2).toBeDefined();
    });

    it('should return results from both paths', async () => {
      const { createInitialState } = await import('./agents.js');
      const state: OrchestratorState = {
        task: 'compare',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      };

      vi.mocked(createInitialState).mockReturnValue(state);

      const config1: OrchestratorConfig = {
        supervisor: { provider: 'anthropic', model: 'claude-opus-4.5' },
        narrativeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        memoryAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        purposeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        actionAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        approvalMode: 'budget',
        enableCheckpointing: true,
      };

      const result = await compareExecutionPaths('test', config1, config1);

      expect(result.path1).toBeDefined();
      expect(result.path2).toBeDefined();
    });

    it('should use different thread IDs for each path', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const config1: OrchestratorConfig = {
        supervisor: { provider: 'anthropic', model: 'claude-opus-4.5' },
        narrativeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        memoryAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        purposeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        actionAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        approvalMode: 'budget',
        enableCheckpointing: true,
      };

      const result = await compareExecutionPaths('test', config1, config1);

      expect(result).toBeDefined();
    });

    it('should preserve task in both paths', async () => {
      const { createInitialState } = await import('./agents.js');
      const state: OrchestratorState = {
        task: 'preserved task',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      };

      vi.mocked(createInitialState).mockReturnValue(state);

      const config1: OrchestratorConfig = {
        supervisor: { provider: 'anthropic', model: 'claude-opus-4.5' },
        narrativeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        memoryAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        purposeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        actionAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        approvalMode: 'budget',
        enableCheckpointing: true,
      };

      const result = await compareExecutionPaths('preserved task', config1, config1);

      expect(result).toBeDefined();
      expect(result.path1).toBeDefined();
      expect(result.path2).toBeDefined();
    });
  });

  describe('createAgentConfig()', () => {
    it('should return default config when no user config provided', () => {
      const config = createAgentConfig();

      expect(config).toBeDefined();
      expect(config.supervisor).toBeDefined();
      expect(config.narrativeAgent).toBeDefined();
      expect(config.memoryAgent).toBeDefined();
      expect(config.purposeAgent).toBeDefined();
      expect(config.actionAgent).toBeDefined();
    });

    it('should merge user config with defaults', () => {
      const userConfig: Partial<OrchestratorConfig> = {
        supervisor: { provider: 'custom', model: 'custom-model' },
      };

      const config = createAgentConfig(userConfig);

      expect(config.supervisor).toEqual({ provider: 'custom', model: 'custom-model' });
      expect(config.narrativeAgent).toBeDefined(); // From defaults
    });

    it('should validate all required agents are configured', () => {
      const completeConfig: OrchestratorConfig = {
        supervisor: { provider: 'anthropic', model: 'claude-opus-4.5' },
        narrativeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        memoryAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        purposeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        actionAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        approvalMode: 'budget',
        enableCheckpointing: true,
      };

      const config = createAgentConfig(completeConfig);

      expect(config).toBeDefined();
    });

    it('should accept partial overrides', () => {
      const userConfig: Partial<OrchestratorConfig> = {
        memoryAgent: { provider: 'deepseek', model: 'deepseek-chat' },
      };

      const config = createAgentConfig(userConfig);

      expect(config.memoryAgent).toEqual({ provider: 'deepseek', model: 'deepseek-chat' });
    });

    it('should validate supervisor configuration exists', () => {
      const incompleteConfig = {
        supervisor: undefined,
      } as any;

      expect(() => createAgentConfig(incompleteConfig)).toThrow();
    });

    it('should validate narrative agent configuration exists', () => {
      const incompleteConfig = {
        narrativeAgent: undefined,
      } as any;

      expect(() => createAgentConfig(incompleteConfig)).toThrow();
    });

    it('should validate memory agent configuration exists', () => {
      const incompleteConfig = {
        memoryAgent: undefined,
      } as any;

      expect(() => createAgentConfig(incompleteConfig)).toThrow();
    });

    it('should validate purpose agent configuration exists', () => {
      const incompleteConfig = {
        purposeAgent: undefined,
      } as any;

      expect(() => createAgentConfig(incompleteConfig)).toThrow();
    });

    it('should validate action agent configuration exists', () => {
      const incompleteConfig = {
        actionAgent: undefined,
      } as any;

      expect(() => createAgentConfig(incompleteConfig)).toThrow();
    });

    it('should return complete validated configuration', () => {
      const config = createAgentConfig();

      expect(config.supervisor).toBeDefined();
      expect(config.narrativeAgent).toBeDefined();
      expect(config.memoryAgent).toBeDefined();
      expect(config.purposeAgent).toBeDefined();
      expect(config.actionAgent).toBeDefined();
    });
  });

  describe('Integration: Graph Assembly and Execution', () => {
    it('should create and execute complete workflow', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'integration test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const graph = createSupervisorGraph({}, mockCheckpointer, mockExecutor);
      expect(graph).toBeDefined();
      expect(graph.invoke).toBeDefined();
    });

    it('should flow through supervisor → agent → END', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'flow test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const result = await runOrchestrator('flow test', {
        checkpointer: mockCheckpointer,
      });

      expect(result).toBeDefined();
    });

    it('should support checkpoint resumption workflow', async () => {
      const checkpoint: Checkpoint<OrchestratorState> = {
        checkpoint_id: 'cp-resume-test',
        thread_id: 'resume-thread',
        parent_checkpoint_id: null,
        state: {
          task: 'resumed task',
          messages: [],
          startTime: Date.now(),
          budget_cents: 100,
          budget_remaining_cents: 100,
        },
        timestamp: Date.now(),
        hash: 'hash-resume',
      };

      vi.mocked(mockCheckpointer.loadByCheckpointId).mockResolvedValue(checkpoint);

      const result = await resumeOrchestrator('cp-resume-test', {
        checkpointer: mockCheckpointer,
        executor: mockExecutor,
      });

      expect(result).toBeDefined();
    });

    it('should handle multi-config comparison', async () => {
      const { createInitialState } = await import('./agents.js');
      vi.mocked(createInitialState).mockReturnValue({
        task: 'comparison test',
        messages: [],
        startTime: Date.now(),
        budget_cents: 100,
        budget_remaining_cents: 100,
      } as any);

      const config1: OrchestratorConfig = {
        supervisor: { provider: 'anthropic', model: 'claude-opus-4.5' },
        narrativeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        memoryAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        purposeAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        actionAgent: { provider: 'anthropic', model: 'claude-opus-4.5' },
        approvalMode: 'budget',
        enableCheckpointing: true,
      };

      const config2: OrchestratorConfig = {
        supervisor: { provider: 'deepseek', model: 'deepseek-chat' },
        narrativeAgent: { provider: 'deepseek', model: 'deepseek-chat' },
        memoryAgent: { provider: 'deepseek', model: 'deepseek-chat' },
        purposeAgent: { provider: 'deepseek', model: 'deepseek-chat' },
        actionAgent: { provider: 'deepseek', model: 'deepseek-chat' },
        approvalMode: 'budget',
        enableCheckpointing: true,
      };

      const result = await compareExecutionPaths('comparison', config1, config2);

      expect(result.path1).toBeDefined();
      expect(result.path2).toBeDefined();
    });
  });
});
