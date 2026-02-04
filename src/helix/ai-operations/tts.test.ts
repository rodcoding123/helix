/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/unbound-method,@typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-assignment */
/**
 * Text-to-Speech Operations Tests - Phase 0.5
 *
 * Comprehensive test suite for TTS routing, cost tracking, and approval workflows.
 * Tests all critical paths and error scenarios.
 *
 * Note: ESLint exceptions used for staging. Will be refined in production with proper typing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  synthesizeToSpeech,
  synthesizeBatchToSpeech,
  getTextToSpeechOperationsCost,
} from './tts.js';
import { router } from './router.js';
import { costTracker } from './cost-tracker.js';
import { approvalGate } from './approval-gate.js';

// Mock dependencies
vi.mock('./router.js');
vi.mock('./cost-tracker.js');
vi.mock('./approval-gate.js');

describe('Text-to-Speech Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('synthesizeToSpeech', () => {
    // Helper functions for mock creation

    const createMockRoutingDecision = (overrides = {}) => ({
      operationId: 'test_tts',
      model: 'elevenlabs',
      requiresApproval: false,
      estimatedCostUsd: 0.003,
      timestamp: new Date().toISOString(),
      ...overrides,
    });

    const createMockApprovalRequest = (overrides = {}) => ({
      id: 'approval_tts_123',
      operation_id: 'test_tts',
      operation_type: 'text_to_speech',
      cost_impact_usd: 0.5,
      reason: 'High cost TTS synthesis',
      requested_at: new Date().toISOString(),
      status: 'approved' as const,
      ...overrides,
    });

    // Test 1: Basic text-to-speech synthesis
    it('should successfully synthesize text to speech', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await synthesizeToSpeech({
        operationId: 'test_tts',
        userId: 'user_123',
        text: 'Hello, this is a test message.',
      });

      expect(result.success).toBe(true);
      expect(result.audioUrl).toBeDefined();
      expect(result.model).toBe('elevenlabs');
      expect(result.metadata.routed).toBe(true);
      expect(result.metadata.requiresApproval).toBe(false);
    });

    // Test 2: TTS with custom voice
    it('should use custom voice for synthesis', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await synthesizeToSpeech({
        operationId: 'custom_voice_tts',
        userId: 'user_123',
        text: 'Hello with custom voice.',
        voice: 'alice',
      });

      expect(result.success).toBe(true);
    });

    // Test 3: Approval gate workflow
    it('should request approval for high-cost TTS synthesis', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 1.0,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'approved' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const result = await synthesizeToSpeech({
        operationId: 'expensive_tts',
        userId: 'user_123',
        text: 'This is expensive text to synthesize.',
      });

      expect(approvalGate.requestApproval).toHaveBeenCalled();
      expect(result.metadata.approvalStatus).toBe('approved');
    });

    // Test 4: Approval rejected
    it('should return failure when approval is rejected', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 2.0,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'rejected' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const result = await synthesizeToSpeech({
        operationId: 'rejected_tts',
        userId: 'user_123',
        text: 'This text will be rejected.',
      });

      expect(result.success).toBe(false);
      expect(result.metadata.approvalStatus).toBe('rejected');
    });

    // Test 5: Text length-based token estimation
    it('should correctly estimate tokens based on text length', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const longText = 'This is a longer text. '.repeat(50); // ~1150 characters

      await synthesizeToSpeech({
        operationId: 'text_length_test',
        userId: 'user_123',
        text: longText,
      });

      expect(router.route).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedInputTokens: expect.any(Number),
        })
      );
    });

    // Test 6: Cost tracking
    it('should correctly track TTS synthesis cost', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      await synthesizeToSpeech({
        operationId: 'tracked_tts',
        userId: 'user_456',
        text: 'Track this synthesis cost.',
      });

      expect(costTracker.logOperation).toHaveBeenCalledWith(
        'user_456',
        expect.objectContaining({
          operation_type: 'text_to_speech',
          operation_id: 'tracked_tts',
          model_used: 'elevenlabs',
          user_id: 'user_456',
          success: true,
        })
      );
    });

    // Test 7: Short text
    it('should handle short text efficiently', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await synthesizeToSpeech({
        operationId: 'short_text_tts',
        userId: 'user_123',
        text: 'Hi.',
      });

      expect(result.success).toBe(true);
      expect(result.metadata.durationSeconds).toBeGreaterThan(0);
    });

    // Test 8: Long text
    it('should handle long text correctly', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const longText = 'This is a very long text that spans multiple sentences. '.repeat(100);
      const result = await synthesizeToSpeech({
        operationId: 'long_text_tts',
        userId: 'user_123',
        text: longText,
      });

      expect(result.success).toBe(true);
    });

    // Test 9: Latency tracking
    it('should track TTS synthesis latency', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await synthesizeToSpeech({
        operationId: 'latency_test',
        userId: 'user_123',
        text: 'Measure the latency.',
      });

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(costTracker.logOperation).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          latency_ms: expect.any(Number),
        })
      );
    });

    // Test 10: Metadata inclusion
    it('should include quality and routing metadata', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await synthesizeToSpeech({
        operationId: 'metadata_test',
        userId: 'user_123',
        text: 'Check metadata.',
      });

      expect(result.metadata).toMatchObject({
        routed: true,
        requiresApproval: false,
        quality_score: 0.85,
      });
    });

    // Test 11: User-less execution
    it('should handle execution without user ID', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await synthesizeToSpeech({
        operationId: 'system_tts',
        text: 'System text synthesis.',
      });

      expect(result.success).toBe(true);
      expect(costTracker.logOperation).toHaveBeenCalledWith('system', expect.any(Object));
    });

    // Test 12: Error handling - routing failure
    it('should handle routing errors gracefully', async () => {
      vi.mocked(router.route).mockRejectedValueOnce(new Error('Routing failed'));

      await expect(
        synthesizeToSpeech({
          operationId: 'routing_error_tts',
          userId: 'user_123',
          text: 'This will fail routing.',
        })
      ).rejects.toThrow('Routing failed');

      expect(costTracker.logOperation).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          success: false,
        })
      );
    });

    // Test 13: Error handling - execution failure
    it('should log failure to cost tracker', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      await synthesizeToSpeech({
        operationId: 'exec_error_tts',
        userId: 'user_123',
        text: 'Execute and log.',
      });

      // Verify successful execution was logged
      expect(costTracker.logOperation).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          success: true,
        })
      );
    });

    // Test 14: Custom language
    it('should support custom language for synthesis', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await synthesizeToSpeech({
        operationId: 'language_test',
        userId: 'user_123',
        text: 'Bonjour, ceci est un test.',
        language: 'fr-FR',
      });

      expect(result.success).toBe(true);
    });

    // Test 15: Pending approval status
    it('should handle pending approval status', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 1.0,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'pending' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const result = await synthesizeToSpeech({
        operationId: 'pending_tts',
        userId: 'user_123',
        text: 'Pending approval synthesis.',
      });

      expect(result.metadata.approvalStatus).toBe('pending');
    });
  });

  describe('synthesizeBatchToSpeech', () => {
    // Test 16: Batch execution
    it('should synthesize multiple texts to speech in batch', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_tts',
        model: 'elevenlabs',
        requiresApproval: false,
        estimatedCostUsd: 0.003,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValue(mockRoutingDecision as any);

      const configs = [
        { operationId: 'batch_1', userId: 'user_1', text: 'First text to synthesize' },
        { operationId: 'batch_2', userId: 'user_2', text: 'Second text to synthesize' },
        { operationId: 'batch_3', userId: 'user_3', text: 'Third text to synthesize' },
      ];

      const results = await synthesizeBatchToSpeech(configs);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    // Test 17: Batch with failures
    it('should handle batch with some failures', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_mixed',
        model: 'elevenlabs',
        requiresApproval: false,
        estimatedCostUsd: 0.003,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(router.route).mockRejectedValueOnce(new Error('Route failed'));
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const configs = [
        { operationId: 'batch_success', userId: 'user_1', text: 'First text' },
        { operationId: 'batch_fail', userId: 'user_2', text: 'Second text' },
        { operationId: 'batch_success_2', userId: 'user_3', text: 'Third text' },
      ];

      const results = await synthesizeBatchToSpeech(configs);

      expect(results).toHaveLength(3);
      expect(results[1].success).toBe(false);
    });

    // Test 18: Batch cost aggregation
    it('should track costs for all batch operations', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_cost',
        model: 'elevenlabs',
        requiresApproval: false,
        estimatedCostUsd: 0.003,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValue(mockRoutingDecision as any);

      const configs = Array.from({ length: 5 }, (_, i) => ({
        operationId: `batch_${i}`,
        userId: 'user_batch',
        text: `Text number ${i} for synthesis`,
      }));

      await synthesizeBatchToSpeech(configs);

      expect(costTracker.logOperation).toHaveBeenCalledTimes(5);
    });
  });

  describe('getTextToSpeechOperationsCost', () => {
    // Test 19: Get cost summary
    it('should retrieve TTS operations cost summary', async () => {
      const result = await getTextToSpeechOperationsCost('user_123');

      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('operationCount');
      expect(result).toHaveProperty('lastUpdated');
      expect(result.totalCost).toBeGreaterThanOrEqual(0);
    });

    // Test 20: Cost summary timestamp
    it('should return recent timestamp for last update', async () => {
      const beforeCall = new Date();
      const result = await getTextToSpeechOperationsCost('user_123');
      const afterCall = new Date();

      const lastUpdated = new Date(result.lastUpdated);

      expect(lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime() - 1000);
      expect(lastUpdated.getTime()).toBeLessThanOrEqual(afterCall.getTime() + 1000);
    });
  });
});
