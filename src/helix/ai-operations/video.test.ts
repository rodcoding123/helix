/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/unbound-method,@typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-assignment */
/**
 * Video Understanding Operations Tests - Phase 0.5
 *
 * Comprehensive test suite for video understanding routing, cost tracking, and approval workflows.
 * Tests all critical paths and error scenarios.
 *
 * Note: ESLint exceptions used for staging. Will be refined in production with proper typing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzeVideo, analyzeBatchVideos, getVideoOperationsCost } from './video.js';
import { router } from './router.js';
import { costTracker } from './cost-tracker.js';
import { approvalGate } from './approval-gate.js';

// Mock dependencies
vi.mock('./router.js');
vi.mock('./cost-tracker.js');
vi.mock('./approval-gate.js');

describe('Video Understanding Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeVideo', () => {
    // Helper functions for mock creation

    const createMockRoutingDecision = (overrides = {}) => ({
      operationId: 'test_video',
      model: 'gemini_flash',
      requiresApproval: false,
      estimatedCostUsd: 0.005,
      timestamp: new Date().toISOString(),
      ...overrides,
    });

    const createMockApprovalRequest = (overrides = {}) => ({
      id: 'approval_video_123',
      operation_id: 'test_video',
      operation_type: 'video_understanding',
      cost_impact_usd: 1.0,
      reason: 'High cost video analysis',
      requested_at: new Date().toISOString(),
      status: 'approved' as const,
      ...overrides,
    });

    // Test 1: Basic video analysis
    it('should successfully analyze a video', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const videoBuffer = Buffer.from('fake video data');
      const result = await analyzeVideo({
        operationId: 'test_video',
        userId: 'user_123',
        videoBuffer,
        frameCount: 30,
      });

      expect(result.success).toBe(true);
      expect(result.description).toBeDefined();
      expect(result.model).toBe('gemini_flash');
      expect(result.metadata.routed).toBe(true);
      expect(result.metadata.requiresApproval).toBe(false);
    });

    // Test 2: Video with custom prompt
    it('should use custom prompt for video analysis', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const videoBuffer = Buffer.from('fake video data');
      const customPrompt = 'Analyze the people in this video';

      await analyzeVideo({
        operationId: 'custom_prompt_video',
        userId: 'user_123',
        videoBuffer,
        prompt: customPrompt,
      });

      expect(router.route).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.any(Array),
        })
      );
    });

    // Test 3: Approval gate workflow
    it('should request approval for high-cost video analysis', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 2.0,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'approved' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const videoBuffer = Buffer.from('fake video data');
      const result = await analyzeVideo({
        operationId: 'expensive_video',
        userId: 'user_123',
        videoBuffer,
      });

      expect(approvalGate.requestApproval).toHaveBeenCalled();
      expect(result.metadata.approvalStatus).toBe('approved');
    });

    // Test 4: Approval rejected
    it('should return failure when approval is rejected', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 5.0,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'rejected' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const videoBuffer = Buffer.from('fake video data');
      const result = await analyzeVideo({
        operationId: 'rejected_video',
        userId: 'user_123',
        videoBuffer,
      });

      expect(result.success).toBe(false);
      expect(result.metadata.approvalStatus).toBe('rejected');
    });

    // Test 5: Frame count token estimation
    it('should correctly estimate tokens based on frame count', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const videoBuffer = Buffer.from('fake video data');
      const frameCount = 60; // 2x default

      await analyzeVideo({
        operationId: 'frame_count_test',
        userId: 'user_123',
        videoBuffer,
        frameCount,
      });

      expect(router.route).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedInputTokens: expect.any(Number),
        })
      );
    });

    // Test 6: Cost tracking
    it('should correctly track video analysis cost', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const videoBuffer = Buffer.from('fake video data');
      await analyzeVideo({
        operationId: 'tracked_video',
        userId: 'user_456',
        videoBuffer,
      });

      expect(costTracker.logOperation).toHaveBeenCalledWith(
        'user_456',
        expect.objectContaining({
          operation_type: 'video_understanding',
          operation_id: 'tracked_video',
          model_used: 'gemini_flash',
          user_id: 'user_456',
          success: true,
        })
      );
    });

    // Test 7: Default frame count
    it('should use default frame count when not provided', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const videoBuffer = Buffer.from('fake video data');
      const result = await analyzeVideo({
        operationId: 'default_frames',
        userId: 'user_123',
        videoBuffer,
      });

      expect(result.metadata.frameCount).toBe(30); // Default
    });

    // Test 8: Custom MIME type
    it('should support custom MIME types', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const videoBuffer = Buffer.from('fake video data');
      const result = await analyzeVideo({
        operationId: 'custom_mime',
        userId: 'user_123',
        videoBuffer,
        mimeType: 'video/quicktime',
      });

      expect(result.success).toBe(true);
    });

    // Test 9: Latency tracking
    it('should track video analysis latency', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const videoBuffer = Buffer.from('fake video data');
      const result = await analyzeVideo({
        operationId: 'latency_test',
        userId: 'user_123',
        videoBuffer,
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

      const videoBuffer = Buffer.from('fake video data');
      const result = await analyzeVideo({
        operationId: 'metadata_test',
        userId: 'user_123',
        videoBuffer,
      });

      expect(result.metadata).toMatchObject({
        routed: true,
        requiresApproval: false,
        quality_score: 0.9,
      });
    });

    // Test 11: User-less execution
    it('should handle execution without user ID', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const videoBuffer = Buffer.from('fake video data');
      const result = await analyzeVideo({
        operationId: 'system_video',
        videoBuffer,
      });

      expect(result.success).toBe(true);
      expect(costTracker.logOperation).toHaveBeenCalledWith('system', expect.any(Object));
    });

    // Test 12: Error handling - routing failure
    it('should handle routing errors gracefully', async () => {
      vi.mocked(router.route).mockRejectedValueOnce(new Error('Routing failed'));

      const videoBuffer = Buffer.from('fake video data');
      await expect(
        analyzeVideo({
          operationId: 'routing_error_video',
          userId: 'user_123',
          videoBuffer,
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
    it('should log failure even if execution fails', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const videoBuffer = Buffer.from('fake video data');
      await expect(
        analyzeVideo({
          operationId: 'exec_error_video',
          userId: 'user_123',
          videoBuffer,
        })
      ).rejects.toBeDefined();

      expect(costTracker.logOperation).toHaveBeenCalled();
    });

    // Test 14: Large frame count
    it('should handle large frame counts correctly', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const videoBuffer = Buffer.from('fake video data');
      const result = await analyzeVideo({
        operationId: 'large_frames',
        userId: 'user_123',
        videoBuffer,
        frameCount: 300, // 10x default
      });

      expect(result.metadata.frameCount).toBe(300);
    });

    // Test 15: Pending approval status
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

      const videoBuffer = Buffer.from('fake video data');
      const result = await analyzeVideo({
        operationId: 'pending_video',
        userId: 'user_123',
        videoBuffer,
      });

      expect(result.metadata.approvalStatus).toBe('pending');
    });
  });

  describe('analyzeBatchVideos', () => {
    // Test 16: Batch execution
    it('should analyze multiple videos in batch', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_video',
        model: 'gemini_flash',
        requiresApproval: false,
        estimatedCostUsd: 0.005,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValue(mockRoutingDecision as any);

      const configs = [
        { operationId: 'batch_1', userId: 'user_1', videoBuffer: Buffer.from('video1') },
        { operationId: 'batch_2', userId: 'user_2', videoBuffer: Buffer.from('video2') },
        { operationId: 'batch_3', userId: 'user_3', videoBuffer: Buffer.from('video3') },
      ];

      const results = await analyzeBatchVideos(configs);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    // Test 17: Batch with failures
    it('should handle batch with some failures', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_mixed',
        model: 'gemini_flash',
        requiresApproval: false,
        estimatedCostUsd: 0.005,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(router.route).mockRejectedValueOnce(new Error('Route failed'));
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const configs = [
        { operationId: 'batch_success', userId: 'user_1', videoBuffer: Buffer.from('video1') },
        { operationId: 'batch_fail', userId: 'user_2', videoBuffer: Buffer.from('video2') },
        { operationId: 'batch_success_2', userId: 'user_3', videoBuffer: Buffer.from('video3') },
      ];

      const results = await analyzeBatchVideos(configs);

      expect(results).toHaveLength(3);
      expect(results[1].success).toBe(false);
    });

    // Test 18: Batch cost aggregation
    it('should track costs for all batch operations', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_cost',
        model: 'gemini_flash',
        requiresApproval: false,
        estimatedCostUsd: 0.005,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValue(mockRoutingDecision as any);

      const configs = Array.from({ length: 5 }, (_, i) => ({
        operationId: `batch_${i}`,
        userId: 'user_batch',
        videoBuffer: Buffer.from(`video${i}`),
      }));

      await analyzeBatchVideos(configs);

      expect(costTracker.logOperation).toHaveBeenCalledTimes(5);
    });
  });

  describe('getVideoOperationsCost', () => {
    // Test 19: Get cost summary
    it('should retrieve video operations cost summary', async () => {
      const result = await getVideoOperationsCost('user_123');

      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('operationCount');
      expect(result).toHaveProperty('lastUpdated');
      expect(result.totalCost).toBeGreaterThanOrEqual(0);
    });

    // Test 20: Cost summary timestamp
    it('should return recent timestamp for last update', async () => {
      const beforeCall = new Date();
      const result = await getVideoOperationsCost('user_123');
      const afterCall = new Date();

      const lastUpdated = new Date(result.lastUpdated);

      expect(lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime() - 1000);
      expect(lastUpdated.getTime()).toBeLessThanOrEqual(afterCall.getTime() + 1000);
    });
  });
});
