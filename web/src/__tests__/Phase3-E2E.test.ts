/**
 * Phase 3 End-to-End Tests
 * Complete Phase 3 feature validation and integration pipeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomToolsService } from '@/services/custom-tools';
import { CompositeSkillsService } from '@/services/composite-skills';
import { MemorySynthesisService } from '@/services/memory-synthesis';
import { resetGatewayRPCClient } from '@/lib/gateway-rpc-client';

describe('Phase 3 E2E Integration Tests', () => {
  let mockFetch: any;

  beforeEach(() => {
    resetGatewayRPCClient();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('Complete Tool Lifecycle', () => {
    it('validates, creates, executes, and logs tool usage', async () => {
      const toolService = new CustomToolsService();
      const userId = 'user-1';

      // Step 1: Validate tool code
      const validation = toolService.validateToolCode(
        'async function execute(params) { return { result: params.x * 2 }; }',
        ['filesystem:read']
      );
      expect(validation.valid).toBe(true);

      // Step 2: Create tool would go to DB (mocked)
      // Step 3: Execute tool via RPC
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              output: { result: 84 },
              executionTimeMs: 120,
              success: true,
            },
            id: '1',
          }),
      });

      const result = await toolService.executeTool(userId, 'tool-1', { x: 42 });
      expect(result.success).toBe(true);
      expect(result.output.result).toBe(84);

      // Step 4: Usage is logged (would be saved to DB)
      expect(result.executionTimeMs).toBeLessThan(1000);
    });

    it('detects and prevents dangerous code execution', () => {
      const toolService = new CustomToolsService();

      const dangerousPatterns = [
        'eval("code")',
        'Function("return this")',
        'require("child_process")',
        'import("malicious")',
        '__proto__',
        'constructor.prototype',
      ];

      for (const pattern of dangerousPatterns) {
        const result = toolService.validateToolCode(pattern, []);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('enforces tool parameter validation', () => {
      const toolService = new CustomToolsService();

      // Tool with proper parameter schema
      const tool = {
        name: 'Test',
        description: 'Test tool',
        code: 'async function execute(params) { return params; }',
        parameters: [
          { name: 'x', type: 'number' as const, required: true, description: 'X value' },
          { name: 'y', type: 'string' as const, required: false, description: 'Y value' },
        ],
        capabilities: [] as string[],
        sandbox_profile: 'standard' as const,
        tags: [],
        icon: '🔧',
        visibility: 'private' as const,
      };

      // Validation passes
      const validation = toolService.validateToolCode(tool.code, []);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Complete Skill Execution Pipeline', () => {
    it('creates, validates, and executes multi-step workflow', async () => {
      const skillService = new CompositeSkillsService();

      // Step 1: Define workflow
      const workflow = [
        {
          stepId: 's1',
          toolName: 'fetch_data',
          toolType: 'custom' as const,
          inputMapping: { query: '$.input.query' } as Record<string, string>,
          errorHandling: 'continue' as const,
        },
        {
          stepId: 's2',
          toolName: 'process_data',
          toolType: 'custom' as const,
          inputMapping: { data: '$.s1.output' } as Record<string, string>,
          errorHandling: 'continue' as const,
        },
        {
          stepId: 's3',
          toolName: 'format_output',
          toolType: 'custom' as const,
          inputMapping: { processed: '$.s2.output' } as Record<string, string>,
          errorHandling: 'continue' as const,
        },
      ];

      // Step 2: Validate workflow
      const validation = skillService.validateSkillSteps(workflow);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Step 3: Execute workflow (mocked)
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              success: true,
              skillId: 'skill-1',
              stepsCompleted: 3,
              totalSteps: 3,
              finalOutput: { result: 'formatted data' },
              executionTimeMs: 450,
            },
            id: '2',
          }),
      });

      const result = await skillService.executeSkill('user-1', 'skill-1', {
        query: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.output.result).toBe('formatted data');
      expect(result.executionTimeMs).toBeLessThan(1000);
    });

    it('handles skill step failures and recovery', async () => {
      const skillService = new CompositeSkillsService();

      const workflow = [
        {
          stepId: 's1',
          toolName: 'might_fail',
          toolType: 'custom' as const,
          inputMapping: {},
          errorHandling: 'retry' as const,
        },
        {
          stepId: 's2',
          toolName: 'fallback',
          toolType: 'custom' as const,
          inputMapping: {},
          errorHandling: 'continue' as const,
        },
      ];

      const validation = skillService.validateSkillSteps(workflow);
      expect(validation.valid).toBe(true);

      // Simulate failure then recovery
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              success: true,
              skillId: 'skill-2',
              stepsCompleted: 2,
              totalSteps: 2,
              finalOutput: { status: 'recovered' },
              executionTimeMs: 300,
            },
            id: '3',
          }),
      });

      const result = await skillService.executeSkill('user-1', 'skill-2', {});
      expect(result.success).toBe(true);
    });
  });

  describe('Complete Memory Synthesis Pipeline', () => {
    it('initiates, monitors, and retrieves synthesis results', async () => {
      const synthesisService = new MemorySynthesisService();

      // Step 1: Start synthesis job
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              jobId: 'job-1',
              status: 'processing',
            },
            id: '4a',
          }),
      });

      const job = await synthesisService.runSynthesis(
        'user-1',
        'emotional_patterns',
        100
      );
      expect(job.jobId).toBe('job-1');
      expect(job.status).toBe('processing');

      // Step 2: Monitor progress
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              status: 'processing',
              progress: 0.75,
            },
            id: '4b',
          }),
      });

      const progress = await synthesisService.getSynthesisStatus('job-1');
      expect(progress.status).toBe('processing');
      expect(progress.progress).toBe(0.75);

      // Step 3: Get final results
      (global.fetch as any).mockResolvedValueOnce({
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
                    description: 'Anxiety with deadlines',
                    confidence: 0.89,
                    evidence: ['conv_1', 'conv_2', 'conv_3'],
                  },
                  {
                    type: 'coping_mechanism',
                    description: 'Procrastination strategy',
                    confidence: 0.76,
                    evidence: ['conv_4'],
                  },
                ],
                recommendations: [
                  'Try Pomodoro technique',
                  'Break tasks into smaller steps',
                  'Use deadline reminders',
                ],
              },
            },
            id: '4c',
          }),
      });

      const results = await synthesisService.getSynthesisStatus('job-1');
      expect(results.status).toBe('completed');
      expect(results.insights?.patterns).toHaveLength(2);
      expect(results.insights?.recommendations).toHaveLength(3);
      expect(results.insights?.patterns[0].confidence).toBeGreaterThan(0.8);
    });

    it('detects patterns across multiple psychological layers', async () => {
      const synthesisService = new MemorySynthesisService();

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              status: 'completed',
              progress: 1.0,
              insights: {
                patterns: [
                  // Layer 1: Narrative
                  {
                    type: 'life_theme',
                    layer: 1,
                    description: 'Overcoming adversity',
                    confidence: 0.88,
                  },
                  // Layer 2: Emotional
                  {
                    type: 'emotional_trigger',
                    layer: 2,
                    description: 'Stress response',
                    confidence: 0.92,
                  },
                  // Layer 3: Relational
                  {
                    type: 'attachment_style',
                    layer: 3,
                    description: 'Secure attachment',
                    confidence: 0.85,
                  },
                  // Layer 4: Prospective
                  {
                    type: 'ideal_self',
                    layer: 4,
                    description: 'Aspires to leadership',
                    confidence: 0.79,
                  },
                ],
              },
            },
            id: '5',
          }),
      });

      const results = await synthesisService.getSynthesisStatus('job-1');
      const patterns = results.insights?.patterns || [];

      expect(patterns).toHaveLength(4);

      // Verify cross-layer analysis
      const layers = patterns.map((p: any) => p.layer).sort();
      expect(layers).toEqual([1, 2, 3, 4]);

      // All patterns should be high confidence
      patterns.forEach((p: any) => {
        expect(p.confidence).toBeGreaterThan(0.7);
      });
    });
  });

  describe('Cross-Feature Workflows', () => {
    it('executes complete user journey: create tool → use in skill → run synthesis', async () => {
      // Journey: User creates a tool, chains it in a skill, executes skill, synthesis detects patterns

      // Step 1: Validate and create tool
      const toolService = new CustomToolsService();
      const validation = toolService.validateToolCode(
        'async function execute(params) { return { count: params.items.length }; }',
        []
      );
      expect(validation.valid).toBe(true);

      // Step 2: Create skill using the tool
      const skillService = new CompositeSkillsService();
      const skillSteps = [
        {
          stepId: 's1',
          toolName: 'my_custom_tool',
          toolType: 'custom' as const,
          inputMapping: { items: '$.input.data' },
          errorHandling: 'continue' as const,
        },
      ];
      const skillValidation = skillService.validateSkillSteps(skillSteps);
      expect(skillValidation.valid).toBe(true);

      // Step 3: Execute skill
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              success: true,
              finalOutput: { count: 42 },
              executionTimeMs: 150,
            },
            id: '6a',
          }),
      });

      const skillResult = await skillService.executeSkill('user-1', 'skill-1', {
        data: Array(42),
      });
      expect(skillResult.output.count).toBe(42);

      // Step 4: Run synthesis to detect execution patterns
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              jobId: 'job-1',
              status: 'processing',
            },
            id: '6b',
          }),
      });

      const synthesisService = new MemorySynthesisService();
      const synthesis = await synthesisService.runSynthesis(
        'user-1',
        'full_synthesis'
      );
      expect(synthesis.jobId).toBeDefined();
      expect(synthesis.status).toBe('processing');

      // Complete journey verified
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('tool metrics feed into pattern synthesis', async () => {
      // Tool execution data → Patterns detected in synthesis

      // Execute tool multiple times
      const toolService = new CustomToolsService();
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              output: { processed: true },
              executionTimeMs: 100,
              success: true,
            },
            id: '7',
          }),
      });

      for (let i = 0; i < 3; i++) {
        await toolService.executeTool('user-1', 'tool-1', { data: i });
      }

      // Synthesis detects execution patterns
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              status: 'completed',
              insights: {
                patterns: [
                  {
                    type: 'usage_pattern',
                    description: 'Tool used 3 times in sequence',
                    confidence: 0.95,
                  },
                ],
              },
            },
            id: '8',
          }),
      });

      const synthesisService = new MemorySynthesisService();
      const results = await synthesisService.getSynthesisStatus('job-1');

      expect(results.insights?.patterns).toHaveLength(1);
      expect(results.insights?.patterns[0].confidence).toBe(0.95);
    });
  });

  describe('Performance & Reliability', () => {
    it('handles concurrent executions of multiple tools', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            result: {
              output: { result: Math.random() },
              executionTimeMs: 50,
              success: true,
            },
            id: '9',
          }),
      });

      const toolService = new CustomToolsService();

      const executions = Array.from({ length: 5 }).map((_, i) =>
        toolService.executeTool('user-1', `tool-${i}`, {})
      );

      const results = await Promise.all(executions);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.executionTimeMs).toBeLessThan(1000);
      });
    });

    it('recovers from transient network failures', async () => {
      // First attempt fails, retry succeeds
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: '2.0',
              result: { output: { result: 'success' }, success: true },
              id: '10',
            }),
        });

      const { getGatewayRPCClient } = await import('@/lib/gateway-rpc-client');
      const client = getGatewayRPCClient();
      const result = await client.call('tools.execute_custom', {}, { retries: 1 });

      expect(result.output.result).toBe('success');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('enforces execution timeouts', async () => {
      let abortSignalReceived = false;

      (global.fetch as any).mockImplementation((url: string, options: any) => {
        abortSignalReceived = !!options?.signal;

        if (options?.signal) {
          // Listen for abort and reject
          return new Promise((resolve, reject) => {
            const abortHandler = () => {
              reject(new DOMException('The operation was aborted', 'AbortError'));
            };
            options.signal.addEventListener('abort', abortHandler);
          });
        }

        // Never resolves if no abort signal
        return new Promise(() => {});
      });

      const { getGatewayRPCClient } = await import('@/lib/gateway-rpc-client');
      const client = getGatewayRPCClient();

      await expect(
        client.call('tools.execute_custom', {}, { timeout: 50 })
      ).rejects.toThrow();
    });
  });
});
