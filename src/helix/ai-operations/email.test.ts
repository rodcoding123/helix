/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/unbound-method,@typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-assignment */
/**
 * Email Analysis Operations Tests - Phase 0.5
 *
 * Comprehensive test suite for email analysis routing, cost tracking, and approval workflows.
 * Tests all critical paths and error scenarios.
 *
 * Note: ESLint exceptions used for staging. Will be refined in production with proper typing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzeEmail, analyzeBatchEmails, getEmailAnalysisOperationsCost } from './email.js';
import { router } from './router.js';
import { costTracker } from './cost-tracker.js';
import { approvalGate } from './approval-gate.js';

// Mock dependencies
vi.mock('./router.js');
vi.mock('./cost-tracker.js');
vi.mock('./approval-gate.js');

describe('Email Analysis Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeEmail', () => {
    // Helper functions for mock creation

    const createMockRoutingDecision = (overrides = {}) => ({
      operationId: 'test_email',
      model: 'email_analyzer',
      requiresApproval: false,
      estimatedCostUsd: 0.001,
      timestamp: new Date().toISOString(),
      ...overrides,
    });

    const createMockApprovalRequest = (overrides = {}) => ({
      id: 'approval_email_123',
      operation_id: 'test_email',
      operation_type: 'email_analysis',
      cost_impact_usd: 0.3,
      reason: 'Email analysis approval',
      requested_at: new Date().toISOString(),
      status: 'approved' as const,
      ...overrides,
    });

    const createBasicEmail = (overrides = {}) => ({
      operationId: 'test_email',
      userId: 'user_123',
      emailFrom: 'sender@example.com',
      emailTo: 'recipient@example.com',
      emailSubject: 'Test Email Subject',
      emailBody: 'This is a test email body with some content.',
      ...overrides,
    });

    // Test 1: Basic email analysis
    it('should successfully analyze a basic email', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await analyzeEmail(createBasicEmail());

      expect(result.success).toBe(true);
      expect(result.sentiment).toBeDefined();
      expect(result.model).toBe('email_analyzer');
      expect(result.metadata.routed).toBe(true);
      expect(result.metadata.requiresApproval).toBe(false);
    });

    // Test 2: Email with sentiment analysis type
    it('should analyze email sentiment specifically', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await analyzeEmail(
        createBasicEmail({
          analysisType: 'sentiment',
        })
      );

      expect(result.success).toBe(true);
      expect(result.metadata.analysisType).toBe('sentiment');
    });

    // Test 3: Email with categorization analysis type
    it('should categorize email into category types', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await analyzeEmail(
        createBasicEmail({
          analysisType: 'categorization',
        })
      );

      expect(result.success).toBe(true);
      expect(result.metadata.analysisType).toBe('categorization');
    });

    // Test 4: Approval gate workflow
    it('should request approval for high-cost email analysis', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 0.5,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'approved' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const result = await analyzeEmail(createBasicEmail());

      expect(approvalGate.requestApproval).toHaveBeenCalled();
      expect(result.metadata.approvalStatus).toBe('approved');
    });

    // Test 5: Approval rejected
    it('should return failure when approval is rejected', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 1.0,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'rejected' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const result = await analyzeEmail(createBasicEmail());

      expect(result.success).toBe(false);
      expect(result.metadata.approvalStatus).toBe('rejected');
    });

    // Test 6: Email body length token estimation
    it('should correctly estimate tokens based on email content length', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const longEmailBody = 'This is a long email. '.repeat(100);
      await analyzeEmail(
        createBasicEmail({
          emailBody: longEmailBody,
        })
      );

      expect(router.route).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedInputTokens: expect.any(Number),
        })
      );
    });

    // Test 7: Cost tracking
    it('should correctly track email analysis cost', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      await analyzeEmail(
        createBasicEmail({
          userId: 'user_456',
          operationId: 'tracked_email',
        })
      );

      expect(costTracker.logOperation).toHaveBeenCalledWith(
        'user_456',
        expect.objectContaining({
          operation_type: 'email_analysis',
          operation_id: 'tracked_email',
          model_used: 'email_analyzer',
          user_id: 'user_456',
          success: true,
        })
      );
    });

    // Test 8: Short email
    it('should handle short emails efficiently', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await analyzeEmail(
        createBasicEmail({
          emailBody: 'Hi!',
        })
      );

      expect(result.success).toBe(true);
    });

    // Test 9: Long email with multiple paragraphs
    it('should handle long emails with multiple paragraphs', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const longEmailBody = Array(20)
        .fill(
          'This is a paragraph with multiple sentences. ' +
            'It contains detailed information. It spans multiple lines. '
        )
        .join('\n\n');

      const result = await analyzeEmail(
        createBasicEmail({
          emailBody: longEmailBody,
        })
      );

      expect(result.success).toBe(true);
    });

    // Test 10: Latency tracking
    it('should track email analysis latency', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await analyzeEmail(createBasicEmail());

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(costTracker.logOperation).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          latency_ms: expect.any(Number),
        })
      );
    });

    // Test 11: Metadata inclusion
    it('should include quality and routing metadata', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await analyzeEmail(createBasicEmail());

      expect(result.metadata).toMatchObject({
        routed: true,
        requiresApproval: false,
        quality_score: 0.82,
      });
    });

    // Test 12: User-less execution
    it('should handle execution without user ID', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const email = createBasicEmail();
      const { userId, ...emailWithoutUserId } = email;
      const emailForTest = emailWithoutUserId as any;

      const result = await analyzeEmail(emailForTest);

      expect(result.success).toBe(true);
      expect(costTracker.logOperation).toHaveBeenCalledWith('system', expect.any(Object));
    });

    // Test 13: Error handling - routing failure
    it('should handle routing errors gracefully', async () => {
      vi.mocked(router.route).mockRejectedValueOnce(new Error('Routing failed'));

      await expect(analyzeEmail(createBasicEmail())).rejects.toThrow('Routing failed');

      expect(costTracker.logOperation).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          success: false,
        })
      );
    });

    // Test 14: Pending approval status
    it('should handle pending approval status', async () => {
      const mockRoutingDecision = createMockRoutingDecision({
        requiresApproval: true,
        estimatedCostUsd: 0.5,
      });

      const mockApproval = createMockApprovalRequest({
        status: 'pending' as const,
      });

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(approvalGate.requestApproval).mockResolvedValueOnce(mockApproval as any);

      const result = await analyzeEmail(createBasicEmail());

      expect(result.metadata.approvalStatus).toBe('pending');
    });

    // Test 15: Data extraction analysis type
    it('should support extraction analysis type', async () => {
      const mockRoutingDecision = createMockRoutingDecision();
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const result = await analyzeEmail(
        createBasicEmail({
          analysisType: 'extraction',
        })
      );

      expect(result.success).toBe(true);
      expect(result.metadata.analysisType).toBe('extraction');
    });
  });

  describe('analyzeBatchEmails', () => {
    // Test 16: Batch execution
    it('should analyze multiple emails in batch', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_email',
        model: 'email_analyzer',
        requiresApproval: false,
        estimatedCostUsd: 0.001,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValue(mockRoutingDecision as any);

      const configs = [
        {
          operationId: 'batch_1',
          userId: 'user_1',
          emailFrom: 'sender1@example.com',
          emailTo: 'recipient1@example.com',
          emailSubject: 'First email',
          emailBody: 'First email content',
        },
        {
          operationId: 'batch_2',
          userId: 'user_2',
          emailFrom: 'sender2@example.com',
          emailTo: 'recipient2@example.com',
          emailSubject: 'Second email',
          emailBody: 'Second email content',
        },
        {
          operationId: 'batch_3',
          userId: 'user_3',
          emailFrom: 'sender3@example.com',
          emailTo: 'recipient3@example.com',
          emailSubject: 'Third email',
          emailBody: 'Third email content',
        },
      ];

      const results = await analyzeBatchEmails(configs);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    // Test 17: Batch with failures
    it('should handle batch with some failures', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_mixed',
        model: 'email_analyzer',
        requiresApproval: false,
        estimatedCostUsd: 0.001,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);
      vi.mocked(router.route).mockRejectedValueOnce(new Error('Route failed'));
      vi.mocked(router.route).mockResolvedValueOnce(mockRoutingDecision as any);

      const configs = [
        {
          operationId: 'batch_success',
          userId: 'user_1',
          emailFrom: 'sender1@example.com',
          emailTo: 'recipient1@example.com',
          emailSubject: 'Email 1',
          emailBody: 'Content 1',
        },
        {
          operationId: 'batch_fail',
          userId: 'user_2',
          emailFrom: 'sender2@example.com',
          emailTo: 'recipient2@example.com',
          emailSubject: 'Email 2',
          emailBody: 'Content 2',
        },
        {
          operationId: 'batch_success_2',
          userId: 'user_3',
          emailFrom: 'sender3@example.com',
          emailTo: 'recipient3@example.com',
          emailSubject: 'Email 3',
          emailBody: 'Content 3',
        },
      ];

      const results = await analyzeBatchEmails(configs);

      expect(results).toHaveLength(3);
      expect(results[1].success).toBe(false);
    });

    // Test 18: Batch cost aggregation
    it('should track costs for all batch operations', async () => {
      const mockRoutingDecision = {
        operationId: 'batch_cost',
        model: 'email_analyzer',
        requiresApproval: false,
        estimatedCostUsd: 0.001,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(router.route).mockResolvedValue(mockRoutingDecision as any);

      const configs = Array.from({ length: 5 }, (_, i) => ({
        operationId: `batch_${i}`,
        userId: 'user_batch',
        emailFrom: `sender${i}@example.com`,
        emailTo: `recipient${i}@example.com`,
        emailSubject: `Email ${i}`,
        emailBody: `Content for email ${i}`,
      }));

      await analyzeBatchEmails(configs);

      expect(costTracker.logOperation).toHaveBeenCalledTimes(5);
    });
  });

  describe('getEmailAnalysisOperationsCost', () => {
    // Test 19: Get cost summary
    it('should retrieve email analysis operations cost summary', async () => {
      const result = await getEmailAnalysisOperationsCost('user_123');

      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('operationCount');
      expect(result).toHaveProperty('lastUpdated');
      expect(result.totalCost).toBeGreaterThanOrEqual(0);
    });

    // Test 20: Cost summary timestamp
    it('should return recent timestamp for last update', async () => {
      const beforeCall = new Date();
      const result = await getEmailAnalysisOperationsCost('user_123');
      const afterCall = new Date();

      const lastUpdated = new Date(result.lastUpdated);

      expect(lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime() - 1000);
      expect(lastUpdated.getTime()).toBeLessThanOrEqual(afterCall.getTime() + 1000);
    });
  });
});
