/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

/**
 * Unit Tests: Orchestration Agents (Phase 2 Modules)
 *
 * Tests for specialized agent implementations:
 * - Supervisor Node (routing)
 * - Narrative Agent Node (Layer 1 analysis)
 * - Memory Agent Node (Layers 2-3 retrieval)
 * - Purpose Agent Node (Layer 7 alignment)
 * - Action Agent Node (execution)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  supervisorNode,
  narrativeAgentNode,
  memoryAgentNode,
  purposeAgentNode,
  type OrchestratorState,
  type MemoryInsight,
} from './agents';

// ============================================================================
// Test Fixtures & Helpers
// ============================================================================

/**
 * Create a base orchestrator state for testing
 */
function createBaseState(overrides?: Partial<OrchestratorState>): OrchestratorState {
  return {
    task: 'test task',
    context: {},
    messages: [],
    startTime: Date.now(),
    budget_cents: 10000, // $100
    budget_remaining_cents: 10000,
    ...overrides,
  };
}

// ============================================================================
// Supervisor Node Tests
// ============================================================================

describe('supervisorNode', () => {
  beforeEach(() => {
    // Tests create their own state fixtures
  });

  describe('basic routing', () => {
    it('should route to memory_agent for memory-related tasks', () => {
      const state = createBaseState({ task: 'recall my previous conversation' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('memory_agent');
      expect(result.routingReason).toContain('memory');
    });

    it('should route to memory_agent when task includes "recall"', () => {
      const state = createBaseState({ task: 'recall what we discussed yesterday' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('memory_agent');
    });

    it('should route to purpose_agent for purpose-related tasks', () => {
      const state = createBaseState({ task: 'align with my life purpose' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('purpose_agent');
      expect(result.routingReason).toContain('purpose');
    });

    it('should route to purpose_agent for meaning-related tasks', () => {
      const state = createBaseState({ task: 'find meaning in this challenge' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('purpose_agent');
    });

    it('should route to narrative_agent for analysis tasks', () => {
      const state = createBaseState({ task: 'analyze this pattern' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('narrative_agent');
      expect(result.routingReason).toContain('narrative');
    });

    it('should route to narrative_agent for story-related tasks', () => {
      const state = createBaseState({ task: 'tell me my story' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('narrative_agent');
    });

    it('should default to action_agent for generic tasks', () => {
      const state = createBaseState({ task: 'execute this command' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('action_agent');
      expect(result.routingReason).toBe('Generic execution');
    });

    it('should default to action_agent for unmatched keywords', () => {
      const state = createBaseState({ task: 'process this data' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('action_agent');
    });
  });

  describe('message accumulation', () => {
    it('should accumulate supervisor message', () => {
      const state = createBaseState({ messages: [{ role: 'user', content: 'test' }] });
      const result = supervisorNode(state);

      expect(result.messages).toHaveLength(2);
      expect(result.messages?.[1]?.role).toBe('supervisor');
    });

    it('should preserve existing messages', () => {
      const existingMessages = [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' },
      ];
      const state = createBaseState({ messages: existingMessages });
      const result = supervisorNode(state);

      expect(result.messages?.[0]).toEqual(existingMessages[0]);
      expect(result.messages?.[1]).toEqual(existingMessages[1]);
      expect(result.messages).toHaveLength(3);
    });

    it('should include routing reason in message', () => {
      const state = createBaseState({ task: 'recall something' });
      const result = supervisorNode(state);

      const supervisorMessage = result.messages?.find(m => m.role === 'supervisor');
      expect(supervisorMessage?.content).toContain('memory_agent');
      expect(supervisorMessage?.content).toContain(result.routingReason);
    });
  });

  describe('case insensitivity', () => {
    it('should match keywords regardless of case', () => {
      const state = createBaseState({ task: 'RECALL my memories' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('memory_agent');
    });

    it('should match PURPOSE in uppercase', () => {
      const state = createBaseState({ task: 'What is my PURPOSE?' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('purpose_agent');
    });

    it('should match ANALYZE in mixed case', () => {
      const state = createBaseState({ task: 'AnAlYzE this' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('narrative_agent');
    });
  });

  describe('keyword priority', () => {
    it('should prioritize first matching keyword', () => {
      // Memory should match before narrative
      const state = createBaseState({ task: 'recall and analyze my memories' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('memory_agent');
    });

    it('should match memory before purpose in mixed tasks', () => {
      const state = createBaseState({ task: 'recall memories aligned with purpose' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('memory_agent');
    });
  });

  describe('state preservation', () => {
    it('should not modify original state', () => {
      const state = createBaseState({ task: 'test', budget_cents: 5000 });
      const originalTask = state.task;
      const originalBudget = state.budget_remaining_cents;

      supervisorNode(state);

      expect(state.task).toBe(originalTask);
      expect(state.budget_remaining_cents).toBe(originalBudget);
    });

    it('should return partial state update', () => {
      const state = createBaseState();
      const result = supervisorNode(state);

      // Should only return fields that changed
      expect(result).toHaveProperty('currentAgent');
      expect(result).toHaveProperty('routingReason');
      expect(result).toHaveProperty('messages');

      // Should not return unchanged fields
      expect(result).not.toHaveProperty('task');
    });
  });
});

// ============================================================================
// Narrative Agent Node Tests
// ============================================================================

describe('narrativeAgentNode', () => {
  let baseState: OrchestratorState;

  beforeEach(() => {
    baseState = createBaseState();
  });

  describe('analysis generation', () => {
    it('should generate narrative analysis', () => {
      const result = narrativeAgentNode(baseState);

      expect(result.narrativeAnalysis).toBeDefined();
      expect(typeof result.narrativeAnalysis).toBe('string');
      expect(result.narrativeAnalysis).toContain('Narrative Analysis');
    });

    it('should include task in analysis', () => {
      const state = createBaseState({ task: 'unique test task' });
      const result = narrativeAgentNode(state);

      expect(result.narrativeAnalysis).toContain('unique test task');
    });

    it('should reference narrative patterns', () => {
      const result = narrativeAgentNode(baseState);

      expect(result.narrativeAnalysis).toContain('narrative');
      expect(result.narrativeAnalysis).toContain('patterns');
    });

    it('should provide recommendations', () => {
      const result = narrativeAgentNode(baseState);

      expect(result.narrativeAnalysis).toContain('Recommended');
    });
  });

  describe('message handling', () => {
    it('should add narrative agent message', () => {
      const state = createBaseState({ messages: [{ role: 'user', content: 'test' }] });
      const result = narrativeAgentNode(state);

      expect(result.messages).toHaveLength(2);
      expect(result.messages?.[1]?.role).toBe('narrative_agent');
    });

    it('should preserve existing messages', () => {
      const messages = [
        { role: 'user', content: 'first' },
        { role: 'supervisor', content: 'second' },
      ];
      const state = createBaseState({ messages });
      const result = narrativeAgentNode(state);

      expect(result.messages?.[0]).toEqual(messages[0]);
      expect(result.messages?.[1]).toEqual(messages[1]);
      expect(result.messages).toHaveLength(3);
    });

    it('narrative message should reference analysis completion', () => {
      const result = narrativeAgentNode(baseState);

      const narrativeMsg = result.messages?.find(m => m.role === 'narrative_agent');
      expect(narrativeMsg?.content).toContain('Layer 1');
      expect(narrativeMsg?.content).toContain('analysis');
    });
  });

  describe('state immutability', () => {
    it('should not modify input state', () => {
      const state = createBaseState({ task: 'original task' });
      const originalTask = state.task;

      narrativeAgentNode(state);

      expect(state.task).toBe(originalTask);
    });
  });
});

// ============================================================================
// Memory Agent Node Tests
// ============================================================================

describe('memoryAgentNode', () => {
  let baseState: OrchestratorState;

  beforeEach(() => {
    baseState = createBaseState();
  });

  describe('memory insights generation', () => {
    it('should generate memory insights array', () => {
      const result = memoryAgentNode(baseState);

      expect(result.memoryInsights).toBeDefined();
      expect(Array.isArray(result.memoryInsights)).toBe(true);
      expect(result.memoryInsights!.length).toBeGreaterThan(0);
    });

    it('should include emotional insights', () => {
      const result = memoryAgentNode(baseState);

      const emotionalInsight = result.memoryInsights?.find(i => i.layer === 'emotional');
      expect(emotionalInsight).toBeDefined();
    });

    it('should include relational insights', () => {
      const result = memoryAgentNode(baseState);

      const relationalInsight = result.memoryInsights?.find(i => i.layer === 'relational');
      expect(relationalInsight).toBeDefined();
    });

    it('should include weight/confidence metrics', () => {
      const result = memoryAgentNode(baseState);

      const weightInsight = result.memoryInsights?.find(i => i.weight !== undefined);
      expect(weightInsight).toBeDefined();
      expect(typeof weightInsight?.weight).toBe('number');
    });

    it('should include trust metrics for relational insights', () => {
      const result = memoryAgentNode(baseState);

      const trustInsight = result.memoryInsights?.find(i => i.trust !== undefined);
      expect(trustInsight).toBeDefined();
      expect(typeof trustInsight?.trust).toBe('number');
    });
  });

  describe('insight structure', () => {
    it('should have valid MemoryInsight structure', () => {
      const result = memoryAgentNode(baseState);

      result.memoryInsights?.forEach((insight: MemoryInsight) => {
        expect(insight.layer).toBeDefined();
        expect(['emotional', 'relational']).toContain(insight.layer);
      });
    });

    it('emotional insights should have tag', () => {
      const result = memoryAgentNode(baseState);

      const emotional = result.memoryInsights?.find(i => i.layer === 'emotional');
      expect(emotional?.tag).toBeDefined();
    });

    it('relational insights should have connection', () => {
      const result = memoryAgentNode(baseState);

      const relational = result.memoryInsights?.find(i => i.layer === 'relational');
      expect(relational?.connection).toBeDefined();
    });
  });

  describe('message handling', () => {
    it('should add memory agent message', () => {
      const state = createBaseState({ messages: [{ role: 'user', content: 'test' }] });
      const result = memoryAgentNode(state);

      expect(result.messages).toHaveLength(2);
      expect(result.messages?.[1]?.role).toBe('memory_agent');
    });

    it('should include insight count in message', () => {
      const result = memoryAgentNode(baseState);

      const memoryMsg = result.messages?.find(m => m.role === 'memory_agent');
      expect(memoryMsg?.content).toContain('Retrieved');
      expect(memoryMsg?.content).toContain('2');
    });

    it('should reference layers 2-3', () => {
      const result = memoryAgentNode(baseState);

      const memoryMsg = result.messages?.find(m => m.role === 'memory_agent');
      expect(memoryMsg?.content).toContain('layers 2-3');
    });
  });
});

// ============================================================================
// Purpose Agent Node Tests
// ============================================================================

describe('purposeAgentNode', () => {
  let baseState: OrchestratorState;

  beforeEach(() => {
    baseState = createBaseState();
  });

  describe('alignment analysis', () => {
    it('should generate purpose alignment analysis', () => {
      const result = purposeAgentNode(baseState);

      expect(result.purposeAlignment).toBeDefined();
      expect(typeof result.purposeAlignment).toBe('string');
      expect(result.purposeAlignment).toContain('Purpose');
    });

    it('should include alignment score', () => {
      const result = purposeAgentNode(baseState);

      expect(result.purposeAlignment).toContain('alignment');
      expect(result.purposeAlignment).toContain('0.85');
    });

    it('should be on scale 0-1', () => {
      const result = purposeAgentNode(baseState);

      expect(result.purposeAlignment).toContain('0.85/1.0');
    });

    it('should reference Purpose Engine', () => {
      const result = purposeAgentNode(baseState);

      expect(result.purposeAlignment).toContain('Purpose');
      expect(result.purposeAlignment).toContain('Alignment');
    });

    it('should include meaning source analysis', () => {
      const result = purposeAgentNode(baseState);

      expect(result.purposeAlignment).toContain('Meaning');
    });

    it('should provide purpose-driven recommendations', () => {
      const result = purposeAgentNode(baseState);

      expect(result.purposeAlignment).toContain('Recommended');
      expect(result.purposeAlignment).toContain('approach');
    });
  });

  describe('message handling', () => {
    it('should add purpose agent message', () => {
      const state = createBaseState({ messages: [{ role: 'user', content: 'test' }] });
      const result = purposeAgentNode(state);

      expect(result.messages).toHaveLength(2);
      expect(result.messages?.[1]?.role).toBe('purpose_agent');
    });

    it('should include alignment score in message', () => {
      const result = purposeAgentNode(baseState);

      const purposeMsg = result.messages?.find(m => m.role === 'purpose_agent');
      expect(purposeMsg?.content).toContain('Layer 7');
      expect(purposeMsg?.content).toContain('0.85');
    });

    it('should reference analysis completion', () => {
      const result = purposeAgentNode(baseState);

      const purposeMsg = result.messages?.find(m => m.role === 'purpose_agent');
      expect(purposeMsg?.content).toContain('complete');
    });
  });

  describe('state preservation', () => {
    it('should not modify input state', () => {
      const state = createBaseState({ budget_cents: 1000 });
      const originalBudget = state.budget_cents;

      purposeAgentNode(state);

      expect(state.budget_cents).toBe(originalBudget);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Agent Integration Patterns', () => {
  let baseState: OrchestratorState;

  beforeEach(() => {
    baseState = createBaseState();
  });

  describe('sequential agent execution', () => {
    it('should support supervisor -> action flow', () => {
      const supervisorResult = supervisorNode(baseState);
      expect(supervisorResult.currentAgent).toBeDefined();

      const actionState = {
        ...baseState,
        ...supervisorResult,
      };

      // Narrative agent can process any state
      const narrativeResult = narrativeAgentNode(actionState);
      expect(narrativeResult.narrativeAnalysis).toBeDefined();

      // Message accumulation should work
      const expectedLength = ((supervisorResult.messages?.length as number) || 0) + 1;
      expect(narrativeResult.messages).toHaveLength(expectedLength);
    });

    it('should support supervisor -> memory -> narrative flow', () => {
      const state1 = createBaseState({ task: 'recall something important' });
      const supervisor = supervisorNode(state1);
      const state2 = { ...state1, ...supervisor };

      const memory = memoryAgentNode(state2);
      const state3 = { ...state2, ...memory };

      const narrative = narrativeAgentNode(state3);

      // Should accumulate all messages
      expect(narrative.messages).toHaveLength(3); // supervisor + memory + narrative
    });
  });

  describe('message accumulation across agents', () => {
    it('should preserve full conversation history', () => {
      let state = baseState;

      // Supervisor
      let result = supervisorNode(state);
      state = { ...state, ...result };
      const supervisorMessageCount = state.messages.length;

      // Memory agent
      result = memoryAgentNode(state);
      state = { ...state, ...result };
      const memoryMessageCount = state.messages.length;

      // Purpose agent
      result = purposeAgentNode(state);
      state = { ...state, ...result };
      const purposeMessageCount = state.messages.length;

      // Verify accumulation
      expect(memoryMessageCount).toBe(supervisorMessageCount + 1);
      expect(purposeMessageCount).toBe(memoryMessageCount + 1);
    });
  });

  describe('state consistency', () => {
    it('should maintain task throughout pipeline', () => {
      const task = 'test this workflow';
      let state = createBaseState({ task });

      state = { ...state, ...supervisorNode(state) };
      state = { ...state, ...memoryAgentNode(state) };
      state = { ...state, ...narrativeAgentNode(state) };
      state = { ...state, ...purposeAgentNode(state) };

      expect(state.task).toBe(task);
    });

    it('should maintain budget tracking', () => {
      const initialBudget = 10000;
      let state = createBaseState({ budget_cents: initialBudget });

      state = { ...state, ...supervisorNode(state) };
      state = { ...state, ...memoryAgentNode(state) };
      state = { ...state, ...narrativeAgentNode(state) };
      state = { ...state, ...purposeAgentNode(state) };

      expect(state.budget_cents).toBe(initialBudget);
    });
  });
});

// ============================================================================
// Edge Cases & Error Handling
// ============================================================================

describe('Edge Cases & Validation', () => {
  describe('empty or null inputs', () => {
    it('should handle empty task string', () => {
      const state = createBaseState({ task: '' });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBeDefined();
      // Empty string should default to action_agent
      expect(result.currentAgent).toBe('action_agent');
    });

    it('should handle empty messages array', () => {
      const state = createBaseState({ messages: [] });
      const result = narrativeAgentNode(state);

      expect(result.messages).toHaveLength(1);
    });

    it('should handle undefined context', () => {
      const state = createBaseState({ context: undefined });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBeDefined();
    });
  });

  describe('large inputs', () => {
    it('should handle very long task descriptions', () => {
      const longTask = 'analyze ' + 'x'.repeat(10000);
      const state = createBaseState({ task: longTask });
      const result = supervisorNode(state);

      expect(result.currentAgent).toBe('narrative_agent');
    });

    it('should handle large message history', () => {
      const messages = Array.from({ length: 1000 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `message ${i}`,
      }));
      const state = createBaseState({ messages });
      const result = memoryAgentNode(state);

      expect(result.messages).toHaveLength(1001);
    });
  });

  describe('concurrent agent execution', () => {
    it('should handle parallel execution safely', async () => {
      const state = createBaseState();

      const results = await Promise.all([
        supervisorNode(state),
        narrativeAgentNode(state),
        memoryAgentNode(state),
        purposeAgentNode(state),
      ]);

      // All should complete without error
      expect(results).toHaveLength(4);
      results.forEach(r => {
        expect(r).toBeDefined();
      });
    });
  });
});
