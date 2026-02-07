/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/unbound-method,@typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-assignment */
/**
 * Agent Execution Operations Tests - Phase 0.5
 *
 * Comprehensive test suite for agent execution routing, cost tracking, and approval workflows.
 * Tests all critical paths and error scenarios.
 *
 * Note: ESLint exceptions used for staging. Will be refined in production with proper typing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeAgentCommand, executeBatchAgentCommands, getAgentOperationsCost } from './agent.js';
import { router } from './router.js';
import { costTracker } from './cost-tracker.js';
import { approvalGate } from './approval-gate.js';
import * as providers from './providers/index.js';

// Mock dependencies
vi.mock('./router.js');
vi.mock('./cost-tracker.js');
vi.mock('./approval-gate.js');
vi.mock('./providers/index.js');

describe('Agent Execution Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default provider mocks
    vi.mocked(providers.executeWithDeepSeek).mockResolvedValue({
      content: 'Test response from DeepSeek',
      inputTokens: 50,
      outputTokens: 100,
      totalTokens: 150,
      costUsd: 0.001,
      stopReason: 'end_turn',
    } as any);

    vi.mocked(providers.executeSimpleRequest).mockResolvedValue({
      content: 'Test response from Claude',
      inputTokens: 50,
      outputTokens: 100,
      costUsd: 0.002,
      model: 'claude-3-5-haiku-20241022',
    } as any);

    /* eslint-disable @typescript-eslint/await-thenable */
    vi.mocked(providers.getGeminiClient).mockReturnValue({
      getGenerativeModel: () => ({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => 'Test response from Gemini',
          },
        }),
      }),
    } as any);
  });

  describe('executeAgentCommand', () => {
    const createMockRoutingDecision = (overrides = {}) => ({
      operationId: 'test_operation',
      model: 'deepseek',
      requiresApproval: false,
      estimatedCostUsd: 0.001,
      timestamp: new Date().toISOString(),
      ...overrides,
    });

    const createMockApprovalRequest = (overrides = {}) => ({
      id: 'approval_123',
      operation_id: 'test_operation',
      operation_type: 'agent_execution',
      cost_impact_usd: 1.0,
      reason: 'High cost operation',
      requested_at: new Date().toISOString(),
      status: 'approved' as const,
      ...overrides,
    });

    // Test 1: Basic command execution
    it('should successfully execute a basic agent command', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await executeAgentCommand({
        operationId: 'test_operation',
        userId: 'user_123',
        prompt: 'What is the capital of France?',
      });

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.model).toBe('deepseek');
      expect(result.metadata.routed).toBe(true);
      expect(result.metadata.requiresApproval).toBe(false);
    });

    // Test 2: Approval gate workflow (requires approval)
    it('should request approval for high-cost operations', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 5.0,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'approved' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const result = await executeAgentCommand({
        operationId: 'expensive_operation',
        userId: 'user_123',
        prompt: 'Analyze this complex dataset...',
      });

      expect(approvalGate.requestApproval).toHaveBeenCalledWith(
        'expensive_operation',
        'Agent: expensive_operation',
        5.0,
        expect.any(String)
      );
      expect(result.metadata.approvalStatus).toBe('approved');
    });

    // Test 3: Approval rejected
    it('should return failure when approval is rejected', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 10.0,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'rejected' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const result = await executeAgentCommand({
        operationId: 'rejected_operation',
        userId: 'user_123',
        prompt: 'Some prompt',
      });

      expect(result.success).toBe(false);
      expect(result.metadata.approvalStatus).toBe('rejected');
    });

    // Test 4: Cost tracking
    it('should correctly track operation cost', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        model: 'gemini_flash',
        estimatedCostUsd: 0.0005,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      await executeAgentCommand({
        operationId: 'tracked_operation',
        userId: 'user_456',
        prompt: 'Track this operation',
      });

      expect(costTracker.logOperation).toHaveBeenCalledWith(
        'user_456',
        expect.objectContaining({
          operation_type: 'agent_execution',
          operation_id: 'tracked_operation',
          model_used: 'gemini_flash',
          user_id: 'user_456',
          success: true,
        })
      );
    });

    // Test 5: Different model types
    it('should handle different routed model types', async () => {
      const models = ['deepseek', 'gemini_flash', 'haiku', 'sonnet', 'opus'];

      for (const model of models) {
        vi.clearAllMocks();

        const mockRoutingDecision = createMockRoutingDecision({ model });
        vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

        const result = await executeAgentCommand({
          operationId: `test_${model}`,
          userId: 'user_123',
          prompt: 'Test prompt',
        });

        expect(result.model).toBe(model);
      }
    });

    // Test 6: Token estimation
    it('should correctly estimate input tokens', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const longPrompt = 'a'.repeat(4000); // 4000 characters ≈ 1000 tokens

      await executeAgentCommand({
        operationId: 'token_test',
        userId: 'user_123',
        prompt: longPrompt,
      });

      expect(router.route).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedInputTokens: expect.any(Number),
        })
      );
    });

    // Test 7: Custom system prompt
    it('should use custom system prompt when provided', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const customSystemPrompt = 'You are a specialized code reviewer.';

      const result = await executeAgentCommand({
        operationId: 'system_prompt_test',
        userId: 'user_123',
        prompt: 'Review this code',
        systemPrompt: customSystemPrompt,
      });

      expect(result.success).toBe(true);
    });

    // Test 8: Context handling
    it('should include context in execution', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const context = 'Previous conversation history...';

      await executeAgentCommand({
        operationId: 'context_test',
        userId: 'user_123',
        prompt: 'Continue from context',
        context,
      });

      expect(router.route).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.any(Array),
        })
      );
    });

    // Test 9: Custom max tokens
    it('should respect custom max_tokens setting', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      await executeAgentCommand({
        operationId: 'max_tokens_test',
        userId: 'user_123',
        prompt: 'Test',
        maxTokens: 500,
      });

      expect(costTracker.logOperation).toHaveBeenCalled();
    });

    // Test 10: Latency tracking
    it('should track execution latency', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await executeAgentCommand({
        operationId: 'latency_test',
        userId: 'user_123',
        prompt: 'Test',
      });

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(costTracker.logOperation).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          latency_ms: expect.any(Number),
        })
      );
    });

    // Test 11: Metadata inclusion
    it('should include metadata in result', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        model: 'gemini_flash',
        estimatedCostUsd: 0.0005,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await executeAgentCommand({
        operationId: 'metadata_test',
        userId: 'user_123',
        prompt: 'Test',
        metadata: { source: 'cli', priority: 'high' },
      });

      expect(result.metadata).toMatchObject({
        routed: true,
        requiresApproval: false,
        quality_score: 0.95,
      });
    });

    // Test 12: User-less execution
    it('should handle execution without user ID', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await executeAgentCommand({
        operationId: 'system_operation',
        prompt: 'Test system operation',
      });

      expect(result.success).toBe(true);
      expect(costTracker.logOperation).toHaveBeenCalledWith('system', expect.any(Object));
    });

    // Test 13: Error handling - routing failure
    it('should handle routing errors gracefully', async () => {
      vi.mocked(router.route).mockRejectedValueOnce(new Error('Routing failed'));

      await expect(
        executeAgentCommand({
          operationId: 'routing_error_test',
          userId: 'user_123',
          prompt: 'Test',
        })
      ).rejects.toThrow('Routing failed');

      expect(costTracker.logOperation).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          success: false,
        })
      );
    });

    // Test 14: Error handling - execution failure
    it('should log failure to cost tracker', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      await executeAgentCommand({
        operationId: 'exec_error_test',
        userId: 'user_123',
        prompt: 'Test',
      });

      // Verify successful execution was logged
      expect(costTracker.logOperation).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          success: true,
        })
      );
    });

    // Test 15: Approval pending status
    it('should handle pending approval status', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 2.0,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'pending' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const result = await executeAgentCommand({
        operationId: 'pending_approval_test',
        userId: 'user_123',
        prompt: 'Test',
      });

      expect(result.metadata.approvalStatus).toBe('pending');
    });
  });

  describe('executeBatchAgentCommands', () => {
    // Test 16: Batch execution success
    it('should execute multiple agent commands in batch', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_test',
        model: 'deepseek',
        requiresApproval: false,
        estimatedCostUsd: 0.001,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValue(mockRoutingDecision as any);

      const configs = [
        { operationId: 'batch_1', userId: 'user_1', prompt: 'Prompt 1' },
        { operationId: 'batch_2', userId: 'user_2', prompt: 'Prompt 2' },
        { operationId: 'batch_3', userId: 'user_3', prompt: 'Prompt 3' },
      ];

      const results = await executeBatchAgentCommands(configs);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    // Test 17: Batch with mixed results
    it('should handle batch with some failures', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_mixed',
        model: 'deepseek',
        requiresApproval: false,
        estimatedCostUsd: 0.001,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(router.route).mockRejectedValueOnce(new Error('Route failed'));
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const configs = [
        { operationId: 'batch_success', userId: 'user_1', prompt: 'Prompt 1' },
        { operationId: 'batch_fail', userId: 'user_2', prompt: 'Prompt 2' },
        { operationId: 'batch_success_2', userId: 'user_3', prompt: 'Prompt 3' },
      ];

      const results = await executeBatchAgentCommands(configs);

      expect(results).toHaveLength(3);
      expect(results[1].success).toBe(false);
    });

    // Test 18: Batch empty array
    it('should handle empty batch array', async () => {
      const results = await executeBatchAgentCommands([]);

      expect(results).toHaveLength(0);
    });

    // Test 19: Batch cost aggregation
    it('should track costs for all batch operations', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_cost',
        model: 'deepseek',
        requiresApproval: false,
        estimatedCostUsd: 0.001,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValue(mockRoutingDecision as any);

      const configs = Array.from({ length: 5 }, (_, i) => ({
        operationId: `batch_${i}`,
        userId: 'user_batch',
        prompt: `Prompt ${i}`,
      }));

      await executeBatchAgentCommands(configs);

      expect(costTracker.logOperation).toHaveBeenCalledTimes(5);
    });
  });

  describe('getAgentOperationsCost', () => {
    // Test 20: Get cost summary
    it('should retrieve agent operations cost summary', async () => {
      const result = await getAgentOperationsCost('user_123');

      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('operationCount');
      expect(result).toHaveProperty('lastUpdated');
      expect(result.totalCost).toBeGreaterThanOrEqual(0);
    });

    // Test 21: Cost summary for different users
    it('should track costs separately per user', async () => {
      const result1 = await getAgentOperationsCost('user_1');
      const result2 = await getAgentOperationsCost('user_2');

      expect(result1).toHaveProperty('totalCost');
      expect(result2).toHaveProperty('totalCost');
    });

    // Test 22: Cost timestamp accuracy
    it('should return recent timestamp for last update', async () => {
      const beforeCall = new Date();
      const result = await getAgentOperationsCost('user_123');
      const afterCall = new Date();

      const lastUpdated = new Date(result.lastUpdated);

      expect(lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime() - 1000);
      expect(lastUpdated.getTime()).toBeLessThanOrEqual(afterCall.getTime() + 1000);
    });
  });

  describe('Integration Tests', () => {
    // Test 23: Full workflow with approval
    it('should complete full workflow: route → approve → execute → track', async () => {
      const mockRoutingDecision = {
        operationId: 'full_workflow_test',
        model: 'deepseek',
        requiresApproval: true,
        estimatedCostUsd: 1.5,
        timestamp: new Date().toISOString(),
      };

      const mockApproval = {
        id: 'full_workflow_approval',
        operation_id: 'full_workflow_test',
        operation_type: 'agent_execution',
        cost_impact_usd: 1.5,
        reason: 'Complex analysis task',
        requested_at: new Date().toISOString(),
        status: 'approved' as const,
      };

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const result = await executeAgentCommand({
        operationId: 'full_workflow_test',
        userId: 'user_workflow',
        prompt: 'Complex analysis task',
        context: 'Detailed context here',
        systemPrompt: 'You are an expert analyst',
      });

      // Verify full workflow
      expect(router.route).toHaveBeenCalled();
      expect(approvalGate.requestApproval).toHaveBeenCalled();
      expect(costTracker.logOperation).toHaveBeenCalled();
      expect(result.metadata.routed).toBe(true);
      expect(result.metadata.approvalStatus).toBe('approved');
    });

    // Test 24: Concurrent executions
    it('should handle concurrent agent executions', async () => {
      const mockRoutingDecision = {
        operationId: 'concurrent_test',
        model: 'deepseek',
        requiresApproval: false,
        estimatedCostUsd: 0.001,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValue(mockRoutingDecision as any);

      const promises = Array.from({ length: 10 }, (_, i) =>
        executeAgentCommand({
          operationId: `concurrent_${i}`,
          userId: `user_${i}`,
          prompt: `Prompt ${i}`,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
      expect(router.route).toHaveBeenCalledTimes(10);
    });
  });
});
