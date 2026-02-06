/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * StateGraph Tests
 *
 * Comprehensive test coverage for TypeScript state graph execution,
 * node routing, conditional edges, and state merging.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StateGraph,
  CompiledGraph,
  END,
  updateState,
  passthrough,
  type NodeFunction,
  type ConditionalEdgeFn,
} from './state-graph.js';

describe('StateGraph', () => {
  interface TestState {
    count: number;
    message: string;
    processed: boolean;
  }

  let graph: StateGraph<TestState>;
  const initialState: TestState = { count: 0, message: 'test', processed: false };

  beforeEach(() => {
    graph = new StateGraph<TestState>();
  });

  describe('constructor', () => {
    it('should create StateGraph instance', () => {
      expect(graph).toBeDefined();
      expect(graph).toBeInstanceOf(StateGraph);
    });

    it('should accept optional state schema parameter', () => {
      const schema = { count: 'number', message: 'string' };
      const newGraph = new StateGraph(schema);
      expect(newGraph).toBeDefined();
    });
  });

  describe('addNode', () => {
    it('should add a node successfully', () => {
      const nodeFn: NodeFunction<TestState> = (state) => ({ ...state, count: state.count + 1 });
      const result = graph.addNode('increment', nodeFn);

      expect(result).toBe(graph); // Fluent API
    });

    it('should add multiple nodes', () => {
      graph.addNode('node1', (state) => state).addNode('node2', (state) => state);

      const compiled = graph
        .setEntryPoint('node1')
        .addEdge('node1', 'node2')
        .compile();
      expect(compiled).toBeInstanceOf(CompiledGraph);
    });

    it('should throw if adding node with reserved END name', () => {
      expect(() => {
        graph.addNode(END, (state) => state);
      }).toThrow('Cannot add node with name "END"');
    });

    it('should allow async node functions', async () => {
      const asyncNode: NodeFunction<TestState> = async (state) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ...state, processed: true };
      };

      graph
        .addNode('async_node', asyncNode)
        .setEntryPoint('async_node');

      const compiled = graph.compile();
      const result = await compiled.invoke(initialState);

      expect(result.processed).toBe(true);
    });

    it('should return partial state updates', async () => {
      const partialNode: NodeFunction<TestState> = (state) => ({
        count: state.count + 5,
      });

      graph
        .addNode('partial', partialNode)
        .setEntryPoint('partial');

      const compiled = graph.compile();
      const result = await compiled.invoke(initialState);

      expect(result.count).toBe(5);
      expect(result.message).toBe('test'); // Unchanged
    });
  });

  describe('addEdge', () => {
    it('should add a simple edge', () => {
      graph.addNode('node1', (state) => state).addNode('node2', (state) => state);

      const result = graph.addEdge('node1', 'node2');
      expect(result).toBe(graph); // Fluent API
    });

    it('should throw if source node does not exist', () => {
      graph.addNode('node2', (state) => state);

      expect(() => {
        graph.addEdge('nonexistent', 'node2');
      }).toThrow('Edge source not found');
    });

    it('should allow edge from any node to END', () => {
      graph.addNode('node1', (state) => state);

      expect(() => {
        graph.addEdge('node1', END);
      }).not.toThrow();
    });

    it('should add conditional edge parameter', () => {
      graph.addNode('node1', (state) => state).addNode('node2', (state) => state);

      const condition = (state: TestState) => state.count > 0;
      const result = graph.addEdge('node1', 'node2', condition);

      expect(result).toBe(graph);
    });

    it('should support edge chain', () => {
      graph
        .addNode('a', (state) => state)
        .addNode('b', (state) => state)
        .addNode('c', (state) => state)
        .addEdge('a', 'b')
        .addEdge('b', 'c');

      expect(graph).toBeDefined();
    });
  });

  describe('addConditionalEdges', () => {
    it('should add conditional edges with mapping', () => {
      const conditionalFn: ConditionalEdgeFn<TestState> = (state) =>
        state.count > 5 ? 'high' : 'low';

      graph
        .addNode('check', (state) => state)
        .addNode('high_path', (state) => state)
        .addNode('low_path', (state) => state);

      const result = graph.addConditionalEdges('check', conditionalFn, {
        high: 'high_path',
        low: 'low_path',
      });

      expect(result).toBe(graph);
    });

    it('should throw if source node does not exist', () => {
      const conditionalFn: ConditionalEdgeFn<TestState> = () => 'outcome';

      graph.addNode('dest', (state) => state);

      expect(() => {
        graph.addConditionalEdges('nonexistent', conditionalFn, {
          outcome: 'dest',
        });
      }).toThrow('Conditional edge source not found');
    });

    it('should throw if destination node does not exist', () => {
      const conditionalFn: ConditionalEdgeFn<TestState> = () => 'outcome';

      graph.addNode('source', (state) => state);

      expect(() => {
        graph.addConditionalEdges('source', conditionalFn, {
          outcome: 'nonexistent',
        });
      }).toThrow('Conditional edge destination not found');
    });

    it('should allow mapping to END', () => {
      const conditionalFn: ConditionalEdgeFn<TestState> = () => 'done';

      graph.addNode('source', (state) => state);

      expect(() => {
        graph.addConditionalEdges('source', conditionalFn, {
          done: END,
        });
      }).not.toThrow();
    });

    it('should execute conditional routing correctly', async () => {
      const conditionalFn: ConditionalEdgeFn<TestState> = (state) =>
        state.count > 0 ? 'high' : 'low';

      graph
        .addNode('init', (state) => ({ ...state, count: 10 }))
        .addNode('high', (state) => ({ ...state, message: 'high' }))
        .addNode('low', (state) => ({ ...state, message: 'low' }))
        .addConditionalEdges('init', conditionalFn, {
          high: 'high',
          low: 'low',
        })
        .setEntryPoint('init');

      const compiled = graph.compile();
      const result = await compiled.invoke(initialState);

      expect(result.message).toBe('high');
      expect(result.count).toBe(10);
    });
  });

  describe('setEntryPoint', () => {
    it('should set entry point successfully', () => {
      graph.addNode('start', (state) => state);

      const result = graph.setEntryPoint('start');
      expect(result).toBe(graph);
    });

    it('should throw if entry point node does not exist', () => {
      expect(() => {
        graph.setEntryPoint('nonexistent');
      }).toThrow('Entry point not found');
    });

    it('should allow changing entry point', () => {
      graph
        .addNode('first', (state) => state)
        .addNode('second', (state) => state);

      graph.setEntryPoint('first');
      graph.setEntryPoint('second');

      expect(graph).toBeDefined();
    });
  });

  describe('compile', () => {
    it('should compile successfully with valid configuration', () => {
      graph
        .addNode('start', (state) => state)
        .setEntryPoint('start');

      const compiled = graph.compile();
      expect(compiled).toBeInstanceOf(CompiledGraph);
    });

    it('should throw if entry point not set', () => {
      graph.addNode('node', (state) => state);

      expect(() => {
        graph.compile();
      }).toThrow('Entry point not set');
    });

    it('should throw if edge destination does not exist', () => {
      graph
        .addNode('source', (state) => state)
        .setEntryPoint('source')
        .addEdge('source', 'nonexistent');

      expect(() => {
        graph.compile();
      }).toThrow('Edge destination not found');
    });

    it('should accept optional checkpointer', () => {
      const mockCheckpointer = {
        save: vi.fn().mockResolvedValue(undefined),
      };

      graph
        .addNode('node', (state) => state)
        .setEntryPoint('node');

      const compiled = graph.compile(mockCheckpointer);
      expect(compiled).toBeInstanceOf(CompiledGraph);
    });

    it('should allow END in edges', () => {
      graph
        .addNode('node', (state) => state)
        .setEntryPoint('node')
        .addEdge('node', END);

      const compiled = graph.compile();
      expect(compiled).toBeInstanceOf(CompiledGraph);
    });
  });
});

describe('CompiledGraph', () => {
  interface TestState {
    count: number;
    message: string;
    steps: string[];
  }

  let graph: StateGraph<TestState>;
  const initialState: TestState = { count: 0, message: 'test', steps: [] };

  beforeEach(() => {
    graph = new StateGraph<TestState>();
  });

  describe('invoke', () => {
    it('should execute single node graph', async () => {
      graph
        .addNode('increment', (state) => ({
          ...state,
          count: state.count + 1,
        }))
        .setEntryPoint('increment');

      const compiled = graph.compile();
      const result = await compiled.invoke(initialState);

      expect(result.count).toBe(1);
    });

    it('should execute multi-node graph in order', async () => {
      graph
        .addNode('step1', (state) => ({
          ...state,
          count: state.count + 1,
          steps: [...state.steps, 'step1'],
        }))
        .addNode('step2', (state) => ({
          ...state,
          count: state.count + 2,
          steps: [...state.steps, 'step2'],
        }))
        .addEdge('step1', 'step2')
        .setEntryPoint('step1');

      const compiled = graph.compile();
      const result = await compiled.invoke(initialState);

      expect(result.count).toBe(3);
      expect(result.steps).toEqual(['step1', 'step2']);
    });

    it('should handle conditional routing', async () => {
      graph
        .addNode('check', (state) => ({ ...state, count: 10 }))
        .addNode('high', (state) => ({
          ...state,
          message: 'high',
          steps: [...state.steps, 'high'],
        }))
        .addNode('low', (state) => ({
          ...state,
          message: 'low',
          steps: [...state.steps, 'low'],
        }))
        .addConditionalEdges('check', (state) => (state.count > 5 ? 'high' : 'low'), {
          high: 'high',
          low: 'low',
        })
        .setEntryPoint('check');

      const compiled = graph.compile();
      const result = await compiled.invoke(initialState);

      expect(result.message).toBe('high');
      expect(result.steps).toEqual(['high']);
    });

    it('should terminate at END node', async () => {
      graph
        .addNode('start', (state) => ({
          ...state,
          steps: [...state.steps, 'start'],
        }))
        .addEdge('start', END)
        .setEntryPoint('start');

      const compiled = graph.compile();
      const result = await compiled.invoke(initialState);

      expect(result.steps).toEqual(['start']);
    });

    it('should apply conditional edge correctly', async () => {
      graph
        .addNode('check', (state) => ({ ...state, count: 3 }))
        .addNode('yes', (state) => ({ ...state, message: 'yes' }))
        .addNode('no', (state) => ({ ...state, message: 'no' }))
        .addConditionalEdges('check', (state) => (state.count > 5 ? 'yes' : 'no'), {
          yes: 'yes',
          no: 'no',
        })
        .setEntryPoint('check');

      const compiled = graph.compile();
      const result = await compiled.invoke(initialState);

      expect(result.message).toBe('no');
    });

    it('should throw if node not found', async () => {
      // Manually create a compiled graph with invalid node reference
      const invalidGraph = new StateGraph<TestState>();
      invalidGraph
        .addNode('valid', (state) => state)
        .setEntryPoint('valid')
        .addEdge('valid', 'invalid');

      // This should throw at compile time
      expect(() => {
        invalidGraph.compile();
      }).toThrow('Edge destination not found');
    });

    it('should throw on max steps exceeded', async () => {
      graph
        .addNode('loop', (state) => state)
        .addEdge('loop', 'loop')
        .setEntryPoint('loop');

      const compiled = graph.compile();

      await expect(compiled.invoke(initialState)).rejects.toThrow(
        'Graph execution exceeded maximum steps'
      );
    });

    it('should handle async nodes', async () => {
      graph
        .addNode('async_node', async (state) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { ...state, count: 42 };
        })
        .setEntryPoint('async_node');

      const compiled = graph.compile();
      const result = await compiled.invoke(initialState);

      expect(result.count).toBe(42);
    });

    it('should merge partial state updates', async () => {
      graph
        .addNode('partial', (state) => ({
          count: 99,
        }))
        .setEntryPoint('partial');

      const compiled = graph.compile();
      const result = await compiled.invoke(initialState);

      expect(result.count).toBe(99);
      expect(result.message).toBe('test'); // Preserved
      expect(result.steps).toEqual([]); // Preserved
    });

    it('should preserve state when node returns undefined', async () => {
      graph
        .addNode('noop', (state) => {
          // Returns undefined implicitly
          void state;
          return undefined;
        })
        .setEntryPoint('noop');

      const compiled = graph.compile();
      const result = await compiled.invoke(initialState);

      expect(result).toEqual(initialState);
    });

    it('should save checkpoints when checkpointer provided', async () => {
      const mockSave = vi.fn().mockResolvedValue(undefined);
      const mockCheckpointer = { save: mockSave };

      graph
        .addNode('step1', (state) => ({ ...state, count: 1 }))
        .addNode('step2', (state) => ({ ...state, count: 2 }))
        .addEdge('step1', 'step2')
        .setEntryPoint('step1');

      const compiled = graph.compile(mockCheckpointer);
      await compiled.invoke(initialState, { thread_id: 'test-thread' });

      expect(mockSave).toHaveBeenCalled();
      expect(mockSave.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should continue on checkpoint save error', async () => {
      const mockCheckpointer = {
        save: vi.fn().mockRejectedValue(new Error('Checkpoint failed')),
      };

      graph
        .addNode('step', (state) => ({ ...state, count: 1 }))
        .setEntryPoint('step');

      const compiled = graph.compile(mockCheckpointer);
      const result = await compiled.invoke(initialState, { thread_id: 'test' });

      expect(result.count).toBe(1); // Execution succeeded despite checkpoint error
    });
  });

  describe('stream', () => {
    it('should yield state after each node', async () => {
      graph
        .addNode('step1', (state) => ({
          ...state,
          count: 1,
          steps: [...state.steps, 'step1'],
        }))
        .addNode('step2', (state) => ({
          ...state,
          count: 2,
          steps: [...state.steps, 'step2'],
        }))
        .addEdge('step1', 'step2')
        .setEntryPoint('step1');

      const compiled = graph.compile();
      const results = [];

      for await (const update of compiled.stream(initialState)) {
        results.push(update);
      }

      expect(results).toHaveLength(2);
      expect(results[0].node).toBe('step1');
      expect(results[0].state.count).toBe(1);
      expect(results[1].node).toBe('step2');
      expect(results[1].state.count).toBe(2);
    });

    it('should yield state at each step', async () => {
      graph
        .addNode('a', (state) => ({ ...state, steps: [...state.steps, 'a'] }))
        .addNode('b', (state) => ({ ...state, steps: [...state.steps, 'b'] }))
        .addNode('c', (state) => ({ ...state, steps: [...state.steps, 'c'] }))
        .addEdge('a', 'b')
        .addEdge('b', 'c')
        .setEntryPoint('a');

      const compiled = graph.compile();
      const nodes: string[] = [];

      for await (const { node } of compiled.stream(initialState)) {
        nodes.push(node);
      }

      expect(nodes).toEqual(['a', 'b', 'c']);
    });

    it('should handle conditional edges in stream', async () => {
      graph
        .addNode('check', (state) => ({ ...state, count: 10 }))
        .addNode('branch', (state) => ({ ...state, message: 'branched' }))
        .addConditionalEdges('check', () => 'next', {
          next: 'branch',
        })
        .setEntryPoint('check');

      const compiled = graph.compile();
      const results = [];

      for await (const update of compiled.stream(initialState)) {
        results.push(update.node);
      }

      expect(results).toEqual(['check', 'branch']);
    });

    it('should throw on max steps in stream', async () => {
      graph
        .addNode('loop', (state) => state)
        .addEdge('loop', 'loop')
        .setEntryPoint('loop');

      const compiled = graph.compile();

      const streamFn = async () => {
        for await (const _ of compiled.stream(initialState)) {
          // Iterate through stream
        }
      };

      await expect(streamFn()).rejects.toThrow('Graph execution exceeded maximum steps');
    });
  });
});

describe('Helper Functions', () => {
  describe('updateState', () => {
    it('should return partial state update', () => {
      const update = updateState({ count: 0, message: 'test' }, { count: 5 });

      expect(update).toEqual({ count: 5 });
    });

    it('should work with any type', () => {
      interface ComplexState {
        data: { nested: string };
        items: number[];
      }

      const update = updateState({ data: { nested: 'old' }, items: [1, 2] }, {
        data: { nested: 'new' },
      });

      expect(update).toEqual({ data: { nested: 'new' } });
    });

    it('should allow multiple fields', () => {
      const update = updateState(
        { a: 1, b: 'test', c: true },
        { a: 2, b: 'updated' }
      );

      expect(update).toEqual({ a: 2, b: 'updated' });
    });
  });

  describe('passthrough', () => {
    it('should return state unchanged after executing side effect', async () => {
      const state = { count: 5, message: 'test' };
      const sideEffect = vi.fn();
      const passthroughFn = passthrough(sideEffect);

      const result = await passthroughFn(state);

      expect(result).toEqual(state);
      expect(sideEffect).toHaveBeenCalledWith(state);
    });

    it('should handle async side effects', async () => {
      const state = { count: 5, message: 'test' };
      let called = false;

      const passthroughFn = passthrough(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        called = true;
      });

      const result = await passthroughFn(state);

      expect(result).toEqual(state);
      expect(called).toBe(true);
    });

    it('should work with node functions', async () => {
      interface TestState {
        log: string[];
      }

      const graph = new StateGraph<TestState>();
      const logs: string[] = [];

      graph
        .addNode('log_node', passthrough((state) => {
          logs.push('executed');
          void state;
        }))
        .setEntryPoint('log_node');

      const compiled = graph.compile();
      const result = await compiled.invoke({ log: [] });

      expect(logs).toEqual(['executed']);
      expect(result).toEqual({ log: [] });
    });
  });
});

describe('Integration Scenarios', () => {
  interface AgentState {
    task: string;
    analysis: string;
    decision: string;
    result: string;
  }

  it('should execute complex multi-step workflow', async () => {
    const graph = new StateGraph<AgentState>();

    graph
      .addNode('analyze', (state) => ({
        ...state,
        analysis: `Analyzed: ${state.task}`,
      }))
      .addNode('decide', (state) => ({
        ...state,
        decision: state.analysis.length > 10 ? 'proceed' : 'reject',
      }))
      .addNode('execute', (state) => ({
        ...state,
        result: `Executed: ${state.decision}`,
      }))
      .addNode('reject', (state) => ({
        ...state,
        result: 'Rejected',
      }))
      .addEdge('analyze', 'decide')
      .addConditionalEdges('decide', (state) => state.decision, {
        proceed: 'execute',
        reject: 'reject',
      })
      .setEntryPoint('analyze');

    const compiled = graph.compile();
    const result = await compiled.invoke({
      task: 'Process user request',
      analysis: '',
      decision: '',
      result: '',
    });

    expect(result.analysis).toContain('Analyzed');
    expect(result.decision).toBe('proceed');
    expect(result.result).toBe('Executed: proceed');
  });

  it('should handle branching based on state', async () => {
    const graph = new StateGraph<{ value: number; path: string }>();

    graph
      .addNode('init', (state) => ({
        ...state,
        value: Math.random() * 100,
      }))
      .addNode('high_path', (state) => ({
        ...state,
        path: 'high',
      }))
      .addNode('low_path', (state) => ({
        ...state,
        path: 'low',
      }))
      .addConditionalEdges('init', (state) => (state.value > 50 ? 'high' : 'low'), {
        high: 'high_path',
        low: 'low_path',
      })
      .setEntryPoint('init');

    const compiled = graph.compile();
    const result = await compiled.invoke({ value: 0, path: '' });

    expect(['high', 'low']).toContain(result.path);
  });
});
