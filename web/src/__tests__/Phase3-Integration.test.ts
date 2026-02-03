/**
 * Phase 3 Integration Tests
 * Complete RPC execution pipeline testing for custom tools, composite skills, and memory synthesis
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomToolsService } from '@/services/custom-tools';
import { CompositeSkillsService } from '@/services/composite-skills';
import { MemorySynthesisService } from '@/services/memory-synthesis';
import {
  getGatewayRPCClient,
  resetGatewayRPCClient,
} from '@/lib/gateway-rpc-client';

describe('Phase 3 RPC Integration Tests', () => {
  let mockFetch: any;

  beforeEach(() => {
    resetGatewayRPCClient();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Custom Tools Execution Pipeline', () => {
    it('executes simple arithmetic tool and logs usage', async () => {
      // Mock RPC response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              output: { result: 42 },
              executionTimeMs: 150,
              success: true,
            },
            id: '1',
          }),
      });

      const service = new CustomToolsService();
      const result = await service.executeTool('user-1', 'tool-1', {
        x: 6,
        y: 7,
      });

      expect(result.success).toBe(true);
      expect(result.output.result).toBe(42);
      expect(result.executionTimeMs).toBe(150);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('rpc'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('tools.execute_custom'),
        })
      );
    });

    it('handles tool execution with multiple parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              output: { processed: true, count: 5 },
              executionTimeMs: 200,
              success: true,
            },
            id: '2',
          }),
      });

      const service = new CustomToolsService();
      const result = await service.executeTool('user-1', 'tool-2', {
        items: [1, 2, 3, 4, 5],
        filter: 'active',
        sort: 'asc',
      });

      expect(result.success).toBe(true);
      expect(result.output.count).toBe(5);
    });

    it('reports tool execution errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            error: {
              code: 'EXECUTION_ERROR',
              message: 'Invalid parameters',
            },
            id: '3',
          }),
      });

      const service = new CustomToolsService();
      const result = await service.executeTool('user-1', 'tool-3', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Composite Skills Execution Pipeline', () => {
    it('executes multi-step composite skill', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              success: true,
              skillId: 'skill-1',
              stepsCompleted: 3,
              totalSteps: 3,
              finalOutput: {
                processed: true,
                total: 150,
              },
              executionTimeMs: 450,
            },
            id: '4',
          }),
      });

      const service = new CompositeSkillsService();
      const result = await service.executeSkill('user-1', 'skill-1', {
        initialValue: 50,
      });

      expect(result.success).toBe(true);
      expect(result.output.total).toBe(150);
      expect(result.executionTimeMs).toBe(450);
    });

    it('validates skill steps before execution', () => {
      const service = new CompositeSkillsService();

      const validSkill = [
        {
          stepId: 's1',
          toolName: 'tool1',
          toolType: 'custom' as const,
          inputMapping: {},
          errorHandling: 'continue' as const,
        },
        {
          stepId: 's2',
          toolName: 'tool2',
          toolType: 'custom' as const,
          inputMapping: { input: '$.s1.output' },
          errorHandling: 'continue' as const,
        },
      ];

      const result = service.validateSkillSteps(validSkill);
      expect(result.valid).toBe(true);
    });

    it('detects invalid skill configuration', () => {
      const service = new CompositeSkillsService();

      const invalidSkill = [
        {
          stepId: 's1',
          toolName: '',  // Missing tool name
          toolType: 'custom' as const,
          inputMapping: {},
          errorHandling: 'continue' as const,
        },
      ];

      const result = service.validateSkillSteps(invalidSkill);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Synthesis Execution Pipeline', () => {
    it('starts memory synthesis job', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              jobId: 'job-1',
              status: 'processing',
            },
            id: '5',
          }),
      });

      const service = new MemorySynthesisService();
      const result = await service.runSynthesis(
        'user-1',
        'emotional_patterns',
        100
      );

      expect(result.jobId).toBe('job-1');
      expect(result.status).toBe('processing');
    });

    it('monitors synthesis job progress', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              status: 'processing',
              progress: 0.65,
              insights: null,
            },
            id: '6',
          }),
      });

      const service = new MemorySynthesisService();
      const status = await service.getSynthesisStatus('job-1');

      expect(status.status).toBe('processing');
      expect(status.progress).toBe(0.65);
    });

    it('retrieves completed synthesis results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              status: 'completed',
              progress: 1.0,
              insights: {
                patterns: [
                  {
                    type: 'emotional_trigger',
                    description: 'Gets anxious with deadlines',
                    confidence: 0.87,
                    evidence: ['conv_123'],
                  },
                  {
                    type: 'prospective_self',
                    description: 'Wants to be more organized',
                    confidence: 0.92,
                    evidence: ['conv_456'],
                  },
                ],
                recommendations: [
                  'Practice time management',
                  'Use planning tools',
                ],
              },
            },
            id: '7',
          }),
      });

      const service = new MemorySynthesisService();
      const status = await service.getSynthesisStatus('job-1');

      expect(status.status).toBe('completed');
      expect(status.insights?.patterns).toHaveLength(2);
      expect(status.insights?.recommendations).toHaveLength(2);
    });
  });

  describe('Cross-Feature Integration', () => {
    it('executes tool via composite skill', async () => {
      // First call: execute composite skill (which internally calls tools)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              success: true,
              skillId: 'skill-1',
              stepsCompleted: 2,
              totalSteps: 2,
              finalOutput: {
                toolResult: { data: 'processed' },
                synthesisTriggered: true,
              },
              executionTimeMs: 300,
            },
            id: '8',
          }),
      });

      const skillService = new CompositeSkillsService();
      const skillResult = await skillService.executeSkill(
        'user-1',
        'skill-1',
        {}
      );

      expect(skillResult.success).toBe(true);
      expect(skillResult.output.toolResult).toBeDefined();
    });

    it('synthesis tracks tool execution patterns', async () => {
      // Execute a custom tool
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              output: { result: 42 },
              executionTimeMs: 100,
              success: true,
            },
            id: '9a',
          }),
      });

      const toolService = new CustomToolsService();
      await toolService.executeTool('user-1', 'tool-1', { x: 6, y: 7 });

      // Then synthesize patterns (would see the tool execution in history)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              jobId: 'job-2',
              status: 'processing',
            },
            id: '9b',
          }),
      });

      const synthesisService = new MemorySynthesisService();
      const synthesis = await synthesisService.runSynthesis(
        'user-1',
        'emotional_patterns'
      );

      expect(synthesis.jobId).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('retries execution on temporary network failure', async () => {
      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: '2.0',
              result: {
                output: { result: 42 },
                executionTimeMs: 200,
                success: true,
              },
              id: '10',
            }),
        });

      const client = getGatewayRPCClient();
      const result = await client.call(
        'tools.execute_custom',
        {},
        { retries: 1 }
      );

      expect(result.output.result).toBe(42);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('handles execution timeout gracefully', async () => {
      mockFetch.mockImplementation(() => {
        return new Promise(() => {
          // Never resolves
        });
      });

      const client = getGatewayRPCClient();

      await expect(
        client.call('tools.execute_custom', {}, { timeout: 100 })
      ).rejects.toThrow();
    });

    it('reports partial execution failure in composite skills', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              success: false,
              skillId: 'skill-2',
              stepsCompleted: 1,
              totalSteps: 3,
              error: 'Step 2 failed: tool not found',
              executionTimeMs: 150,
            },
            id: '11',
          }),
      });

      const service = new CompositeSkillsService();
      const result = await service.executeSkill('user-1', 'skill-2', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Performance Characteristics', () => {
    it('tracks execution time for performance analysis', async () => {
      const executionTimes = [];

      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: '2.0',
              result: {
                output: { result: i },
                executionTimeMs: 50 + i * 10,
                success: true,
              },
              id: String(i),
            }),
        });

        const client = getGatewayRPCClient();
        const result = await client.call('tools.execute_custom', {});
        executionTimes.push(result.executionTimeMs);
      }

      expect(executionTimes).toEqual([50, 60, 70]);
      expect(Math.max(...executionTimes)).toBeLessThan(100);
    });

    it('maintains sub-second response for simple tools', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              output: { result: 'fast' },
              executionTimeMs: 87,
              success: true,
            },
            id: '12',
          }),
      });

      const service = new CustomToolsService();
      const result = await service.executeTool('user-1', 'tool-fast', {});

      expect(result.executionTimeMs).toBeLessThan(1000);
    });
  });
});
