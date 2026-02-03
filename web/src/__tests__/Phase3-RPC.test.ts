/**
 * Phase 3 RPC Client Tests
 * Verifies gateway RPC connections for custom tools, composite skills, and memory synthesis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGatewayRPCClient, resetGatewayRPCClient } from '@/lib/gateway-rpc-client';

describe('Phase 3 Gateway RPC Client', () => {
  beforeEach(() => {
    resetGatewayRPCClient();
    // Mock fetch
    global.fetch = vi.fn();
  });

  describe('Custom Tools RPC', () => {
    it('executes custom tool with parameters', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        result: {
          output: { result: 42 },
          executionTimeMs: 150,
          success: true,
        },
        id: '123',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = getGatewayRPCClient();
      const result = await client.executeCustomTool(
        'tool-123',
        'user-456',
        { x: 6, y: 7 }
      );

      expect(result.output.result).toBe(42);
      expect(result.success).toBe(true);
    });

    it('handles tool execution errors', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        error: {
          code: 'EXECUTION_ERROR',
          message: 'Tool execution failed',
        },
        id: '123',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = getGatewayRPCClient();
      await expect(
        client.executeCustomTool('tool-123', 'user-456', {})
      ).rejects.toThrow();
    });
  });

  describe('Composite Skills RPC', () => {
    it('executes composite skill with multi-step workflow', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        result: {
          success: true,
          skillId: 'skill-123',
          stepsCompleted: 2,
          totalSteps: 2,
          finalOutput: 110,
          executionTimeMs: 300,
        },
        id: '456',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = getGatewayRPCClient();
      const result = await client.executeCompositeSkill(
        'skill-123',
        'user-456',
        { initialValue: 10 }
      );

      expect(result.success).toBe(true);
      expect(result.finalOutput).toBe(110);
      expect(result.stepsCompleted).toBe(2);
    });
  });

  describe('Memory Synthesis RPC', () => {
    it('starts memory synthesis job', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        result: {
          jobId: 'job-123',
          status: 'processing',
        },
        id: '789',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = getGatewayRPCClient();
      const result = await client.startMemorySynthesis(
        'user-456',
        'emotional_patterns'
      );

      expect(result.jobId).toBe('job-123');
      expect(result.status).toBe('processing');
    });

    it('checks memory synthesis job status', async () => {
      const mockResponse = {
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
              },
            ],
          },
        },
        id: '101',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = getGatewayRPCClient();
      const result = await client.getMemorySynthesisStatus('job-123');

      expect(result.status).toBe('completed');
      expect(result.progress).toBe(1.0);
      expect(result.insights?.patterns).toHaveLength(1);
    });

    it('lists memory patterns', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        result: {
          patterns: [
            {
              id: 'p1',
              type: 'emotional_pattern',
              description: 'Anxiety response to deadlines',
              confidence: 0.87,
            },
          ],
        },
        id: '202',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = getGatewayRPCClient();
      const patterns = await client.listMemoryPatterns('user-456');

      expect(patterns).toHaveLength(1);
      expect(patterns[0].type).toBe('emotional_pattern');
    });
  });

  describe('RPC Client Error Handling', () => {
    it('retries on network failure', async () => {
      const mockError = new Error('Network error');

      (global.fetch as any)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            jsonrpc: '2.0',
            result: { output: 42 },
            id: '123',
          }),
        });

      const client = getGatewayRPCClient();
      const result = await client.call('tools.execute_custom', {}, { retries: 1 });

      expect(result.output).toBe(42);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('throws after max retries exceeded', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const client = getGatewayRPCClient();

      await expect(
        client.call('tools.execute_custom', {}, { retries: 2 })
      ).rejects.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('handles HTTP errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const client = getGatewayRPCClient();

      await expect(
        client.call('tools.execute_custom', {})
      ).rejects.toThrow();
    });
  });
});
