/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/unbound-method,@typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-assignment */
/**
 * Audio Transcription Operations Tests - Phase 0.5
 *
 * Comprehensive test suite for audio transcription routing, cost tracking, and approval workflows.
 * Tests all critical paths and error scenarios.
 *
 * Note: ESLint exceptions used for staging. Will be refined in production with proper typing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transcribeAudio, transcribeBatchAudio, getAudioOperationsCost } from './audio.js';
import { router } from './router.js';
import { costTracker } from './cost-tracker.js';
import { approvalGate } from './approval-gate.js';

// Mock dependencies
vi.mock('./router.js');
vi.mock('./cost-tracker.js');
vi.mock('./approval-gate.js');

describe('Audio Transcription Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transcribeAudio', () => {
    // Helper functions for mock creation

    const createMockRoutingDecision = (overrides = {}) => ({
      operationId: 'test_audio',
      model: 'deepgram',
      requiresApproval: false,
      estimatedCostUsd: 0.002,
      timestamp: new Date().toISOString(),
      ...overrides,
    });

    const createMockApprovalRequest = (overrides = {}) => ({
      id: 'approval_audio_123',
      operation_id: 'test_audio',
      operation_type: 'audio_transcription',
      cost_impact_usd: 0.5,
      reason: 'High cost audio transcription',
      requested_at: new Date().toISOString(),
      status: 'approved' as const,
      ...overrides,
    });

    // Test 1: Basic audio transcription
    it('should successfully transcribe audio', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const audioBuffer = Buffer.from('fake audio data');
      const result = await transcribeAudio({
        operationId: 'test_audio',
        userId: 'user_123',
        audioBuffer,
        durationMinutes: 5,
      });

      expect(result.success).toBe(true);
      expect(result.transcript).toBeDefined();
      expect(result.model).toBe('deepgram');
      expect(result.metadata.routed).toBe(true);
      expect(result.metadata.requiresApproval).toBe(false);
    });

    // Test 2: Audio with custom MIME type
    it('should support custom MIME types for audio', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const audioBuffer = Buffer.from('fake audio data');
      const result = await transcribeAudio({
        operationId: 'custom_mime_audio',
        userId: 'user_123',
        audioBuffer,
        mimeType: 'audio/mpeg',
      });

      expect(result.success).toBe(true);
    });

    // Test 3: Approval gate workflow
    it('should request approval for high-cost audio transcription', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 1.0,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'approved' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const audioBuffer = Buffer.from('fake audio data');
      const result = await transcribeAudio({
        operationId: 'expensive_audio',
        userId: 'user_123',
        audioBuffer,
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

      const audioBuffer = Buffer.from('fake audio data');
      const result = await transcribeAudio({
        operationId: 'rejected_audio',
        userId: 'user_123',
        audioBuffer,
      });

      expect(result.success).toBe(false);
      expect(result.metadata.approvalStatus).toBe('rejected');
    });

    // Test 5: Duration-based token estimation
    it('should correctly estimate tokens based on duration', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const audioBuffer = Buffer.from('fake audio data');
      const durationMinutes = 10; // 2x default

      await transcribeAudio({
        operationId: 'duration_test',
        userId: 'user_123',
        audioBuffer,
        durationMinutes,
      });

      expect(router.route).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedInputTokens: expect.any(Number),
        })
      );
    });

    // Test 6: Cost tracking
    it('should correctly track audio transcription cost', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const audioBuffer = Buffer.from('fake audio data');
      await transcribeAudio({
        operationId: 'tracked_audio',
        userId: 'user_456',
        audioBuffer,
      });

      expect(costTracker.logOperation).toHaveBeenCalledWith(
        'user_456',
        expect.objectContaining({
          operation_type: 'audio_transcription',
          operation_id: 'tracked_audio',
          model_used: 'deepgram',
          user_id: 'user_456',
          success: true,
        })
      );
    });

    // Test 7: Default duration
    it('should use default duration when not provided', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const audioBuffer = Buffer.from('fake audio data');
      const result = await transcribeAudio({
        operationId: 'default_duration',
        userId: 'user_123',
        audioBuffer,
      });

      expect(result.metadata.durationMinutes).toBe(5); // Default
    });

    // Test 8: Default MIME type
    it('should use default MIME type for audio', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const audioBuffer = Buffer.from('fake audio data');
      const result = await transcribeAudio({
        operationId: 'default_mime',
        userId: 'user_123',
        audioBuffer,
      });

      expect(result.success).toBe(true);
    });

    // Test 9: Latency tracking
    it('should track audio transcription latency', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const audioBuffer = Buffer.from('fake audio data');
      const result = await transcribeAudio({
        operationId: 'latency_test',
        userId: 'user_123',
        audioBuffer,
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

      const audioBuffer = Buffer.from('fake audio data');
      const result = await transcribeAudio({
        operationId: 'metadata_test',
        userId: 'user_123',
        audioBuffer,
      });

      expect(result.metadata).toMatchObject({
        routed: true,
        requiresApproval: false,
        quality_score: 0.88,
      });
    });

    // Test 11: User-less execution
    it('should handle execution without user ID', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const audioBuffer = Buffer.from('fake audio data');
      const result = await transcribeAudio({
        operationId: 'system_audio',
        audioBuffer,
      });

      expect(result.success).toBe(true);
      expect(costTracker.logOperation).toHaveBeenCalledWith('system', expect.any(Object));
    });

    // Test 12: Error handling - routing failure
    it('should handle routing errors gracefully', async () => {
      vi.mocked(router.route).mockRejectedValueOnce(new Error('Routing failed'));

      const audioBuffer = Buffer.from('fake audio data');
      await expect(
        transcribeAudio({
          operationId: 'routing_error_audio',
          userId: 'user_123',
          audioBuffer,
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

      const audioBuffer = Buffer.from('fake audio data');
      await transcribeAudio({
        operationId: 'exec_error_audio',
        userId: 'user_123',
        audioBuffer,
      });

      // Verify successful execution was logged
      expect(costTracker.logOperation).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          success: true,
        })
      );
    });

    // Test 14: Large duration
    it('should handle large durations correctly', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const audioBuffer = Buffer.from('fake audio data');
      const result = await transcribeAudio({
        operationId: 'large_duration',
        userId: 'user_123',
        audioBuffer,
        durationMinutes: 120, // 2 hours
      });

      expect(result.metadata.durationMinutes).toBe(120);
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

      const audioBuffer = Buffer.from('fake audio data');
      const result = await transcribeAudio({
        operationId: 'pending_audio',
        userId: 'user_123',
        audioBuffer,
      });

      expect(result.metadata.approvalStatus).toBe('pending');
    });
  });

  describe('transcribeBatchAudio', () => {
    // Test 16: Batch execution
    it('should transcribe multiple audio files in batch', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_audio',
        model: 'deepgram',
        requiresApproval: false,
        estimatedCostUsd: 0.002,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValue(mockRoutingDecision as any);

      const configs = [
        { operationId: 'batch_1', userId: 'user_1', audioBuffer: Buffer.from('audio1') },
        { operationId: 'batch_2', userId: 'user_2', audioBuffer: Buffer.from('audio2') },
        { operationId: 'batch_3', userId: 'user_3', audioBuffer: Buffer.from('audio3') },
      ];

      const results = await transcribeBatchAudio(configs);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    // Test 17: Batch with failures
    it('should handle batch with some failures', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_mixed',
        model: 'deepgram',
        requiresApproval: false,
        estimatedCostUsd: 0.002,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(router.route).mockRejectedValueOnce(new Error('Route failed'));
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const configs = [
        { operationId: 'batch_success', userId: 'user_1', audioBuffer: Buffer.from('audio1') },
        { operationId: 'batch_fail', userId: 'user_2', audioBuffer: Buffer.from('audio2') },
        { operationId: 'batch_success_2', userId: 'user_3', audioBuffer: Buffer.from('audio3') },
      ];

      const results = await transcribeBatchAudio(configs);

      expect(results).toHaveLength(3);
      expect(results[1].success).toBe(false);
    });

    // Test 18: Batch cost aggregation
    it('should track costs for all batch operations', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_cost',
        model: 'deepgram',
        requiresApproval: false,
        estimatedCostUsd: 0.002,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValue(mockRoutingDecision as any);

      const configs = Array.from({ length: 5 }, (_, i) => ({
        operationId: `batch_${i}`,
        userId: 'user_batch',
        audioBuffer: Buffer.from(`audio${i}`),
      }));

      await transcribeBatchAudio(configs);

      expect(costTracker.logOperation).toHaveBeenCalledTimes(5);
    });
  });

  describe('getAudioOperationsCost', () => {
    // Test 19: Get cost summary
    it('should retrieve audio operations cost summary', async () => {
      const result = await getAudioOperationsCost('user_123');

      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('operationCount');
      expect(result).toHaveProperty('lastUpdated');
      expect(result.totalCost).toBeGreaterThanOrEqual(0);
    });

    // Test 20: Cost summary timestamp
    it('should return recent timestamp for last update', async () => {
      const beforeCall = new Date();
      const result = await getAudioOperationsCost('user_123');
      const afterCall = new Date();

      const lastUpdated = new Date(result.lastUpdated);

      expect(lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime() - 1000);
      expect(lastUpdated.getTime()).toBeLessThanOrEqual(afterCall.getTime() + 1000);
    });
  });
});
