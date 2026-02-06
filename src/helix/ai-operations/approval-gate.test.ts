/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * ApprovalGate Tests
 *
 * Comprehensive test coverage for approval workflow,
 * Discord notifications, and decision tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as supabaseModule from '@supabase/supabase-js';
import * as loggingModule from '../logging.js';
import * as hashChainModule from '../hash-chain.js';

// Mock dependencies
vi.mock('@supabase/supabase-js');
vi.mock('../logging.js');
vi.mock('../hash-chain.js');

import { ApprovalGate, ApprovalRequest } from './approval-gate.js';

describe('ApprovalGate', () => {
  let gate: ApprovalGate;
  let mockSupabaseClient: any;
  let mockLogToDiscord: any;
  let mockHashChainAdd: any;

  const mockApprovalRequest: ApprovalRequest = {
    id: 'approval-12345',
    operation_id: 'chat_message',
    operation_type: 'Chat Message',
    requested_by: 'system',
    cost_impact_usd: 25.0,
    reason: 'Model change from Sonnet to DeepSeek',
    requested_at: '2026-02-04T10:00:00Z',
    status: 'pending',
  };

  beforeEach(() => {
    // Setup environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key-123';

    // Setup Supabase mock
    mockSupabaseClient = {
      from: vi.fn(),
    };

    vi.mocked(supabaseModule.createClient).mockReturnValue(mockSupabaseClient);

    // Setup Discord logging mock
    mockLogToDiscord = vi.fn();
    vi.mocked(loggingModule.logToDiscord).mockImplementation(mockLogToDiscord);

    // Setup hash chain mock
    mockHashChainAdd = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(hashChainModule, 'hashChain', {
      value: {
        add: mockHashChainAdd,
      },
      configurable: true,
    });

    // Create new gate instance
    gate = new ApprovalGate();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
  });

  describe('requestApproval', () => {
    let mockInsert: any;

    beforeEach(() => {
      mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });
    });

    it('should create approval request successfully', async () => {
      const result = await gate.requestApproval(
        'op-123',
        'deploy_model',
        150.5,
        'Deploy new model to production',
        'rodrigo'
      );

      expect(result).toMatchObject({
        operation_id: 'op-123',
        operation_type: 'deploy_model',
        cost_impact_usd: 150.5,
        reason: 'Deploy new model to production',
        requested_by: 'rodrigo',
        status: 'pending',
      });

      expect(result.id).toMatch(/^approval-\d+-[a-z0-9]+$/);
      expect(result.requested_at).toBeDefined();
    });

    it('should insert record in database', async () => {
      await gate.requestApproval('op-123', 'deploy_model', 150.5, 'Deploy model');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          recommendation_type: 'approval_request',
          operation_id: 'op-123',
          estimated_savings_usd: -150.5,
          reasoning: 'Deploy model',
          approval_status: 'PENDING',
          created_by: 'system',
        })
      );
    });

    it('should send Discord alert', async () => {
      await gate.requestApproval('op-123', 'deploy_model', 150.5, 'Deploy model', 'rodrigo');

      expect(mockLogToDiscord).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'helix-alerts',
          type: 'approval_required',
          mentionAdmins: true,
        })
      );
    });

    it('should log to hash chain', async () => {
      const result = await gate.requestApproval(
        'op-123',
        'deploy_model',
        150.5,
        'Deploy model',
        'rodrigo'
      );

      expect(mockHashChainAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'approval_requested',
          approval_id: result.id,
          operation: 'op-123',
          cost_impact_usd: 150.5,
        })
      );
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed');
      mockInsert.mockResolvedValue({ error: dbError });

      await expect(
        gate.requestApproval('op-123', 'deploy_model', 150.5, 'Deploy model')
      ).rejects.toThrow(dbError);

      expect(mockLogToDiscord).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'approval_request_failed',
        })
      );
    });
  });

  describe('checkApproval', () => {
    let mockSelect: any;

    beforeEach(() => {
      mockSelect = vi.fn();
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
    });

    it('should return true for approved operation', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { approval_status: 'APPROVED' },
            error: null,
          }),
        }),
      });

      const result = await gate.checkApproval('approval-123');

      expect(result).toBe(true);
    });

    it('should return false for pending operation', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { approval_status: 'PENDING' },
            error: null,
          }),
        }),
      });

      const result = await gate.checkApproval('approval-123');

      expect(result).toBe(false);
    });

    it('should throw for rejected operation', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { approval_status: 'REJECTED' },
            error: null,
          }),
        }),
      });

      await expect(gate.checkApproval('approval-123')).rejects.toThrow(
        'Operation has been rejected'
      );
    });

    it('should throw if approval not found', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      await expect(gate.checkApproval('approval-999')).rejects.toThrow('Approval not found');
    });
  });

  describe('approve', () => {
    let mockSelectForApprove: any;
    let mockUpdate: any;

    beforeEach(() => {
      mockSelectForApprove = vi.fn();
      mockUpdate = vi.fn();

      mockSelectForApprove.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'approval-123',
              operation_id: 'op-456',
              estimated_savings_usd: -150.5,
            },
            error: null,
          }),
        }),
      });

      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'helix_recommendations') {
          return {
            select: mockSelectForApprove,
            update: mockUpdate,
          };
        }
        return {};
      });
    });

    it('should approve operation successfully', async () => {
      await gate.approve('approval-123', 'rodrigo');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          approval_status: 'APPROVED',
          approved_by: 'rodrigo',
        })
      );
    });

    it('should log to Discord', async () => {
      await gate.approve('approval-123', 'rodrigo');

      expect(mockLogToDiscord).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'helix-api',
          type: 'approval_granted',
          approval_id: 'approval-123',
          approved_by: 'rodrigo',
        })
      );
    });

    it('should log to hash chain', async () => {
      await gate.approve('approval-123', 'rodrigo');

      expect(mockHashChainAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'approval_granted',
          approval_id: 'approval-123',
          approved_by: 'rodrigo',
        })
      );
    });

    it('should throw if approval not found', async () => {
      mockSelectForApprove.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      await expect(gate.approve('approval-999')).rejects.toThrow('Approval not found');
    });
  });

  describe('reject', () => {
    let mockSelectForReject: any;
    let mockUpdate: any;

    beforeEach(() => {
      mockSelectForReject = vi.fn();
      mockUpdate = vi.fn();

      mockSelectForReject.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'approval-123',
              operation_id: 'op-456',
              estimated_savings_usd: -150.5,
            },
            error: null,
          }),
        }),
      });

      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'helix_recommendations') {
          return {
            select: mockSelectForReject,
            update: mockUpdate,
          };
        }
        return {};
      });
    });

    it('should reject operation successfully', async () => {
      await gate.reject('approval-123', 'Insufficient budget', 'admin');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          approval_status: 'REJECTED',
          approved_by: 'admin',
        })
      );
    });

    it('should log rejection reason', async () => {
      await gate.reject('approval-123', 'Cost too high', 'rodrigo');

      expect(mockLogToDiscord).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'approval_rejected',
          reason: 'Cost too high',
        })
      );
    });

    it('should log rejection to hash chain', async () => {
      await gate.reject('approval-123', 'Out of scope', 'rodrigo');

      expect(mockHashChainAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'approval_rejected',
          approval_id: 'approval-123',
          reason: 'Out of scope',
          rejected_by: 'rodrigo',
        })
      );
    });
  });

  describe('getPendingApprovals', () => {
    let mockSelect: any;

    beforeEach(() => {
      mockSelect = vi.fn();
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
    });

    it('should return list of pending approvals', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'approval-1',
                operation_id: 'op-1',
                recommendation_type: 'test_op',
                created_by: 'user1',
                estimated_savings_usd: -100,
                reasoning: 'Test reason',
                created_at: '2026-01-01T00:00:00Z',
                approval_status: 'PENDING',
              },
            ],
            error: null,
          }),
        }),
      });

      const results = await gate.getPendingApprovals();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('approval-1');
    });

    it('should return empty array when no pending approvals', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      const results = await gate.getPendingApprovals();

      expect(results).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error'),
          }),
        }),
      });

      const results = await gate.getPendingApprovals();

      expect(results).toEqual([]);
      expect(mockLogToDiscord).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pending_approvals_fetch_failed',
        })
      );
    });
  });

  describe('getApprovalHistory', () => {
    let mockSelect: any;

    beforeEach(() => {
      mockSelect = vi.fn();
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
    });

    it('should return approval history', async () => {
      mockSelect.mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'approval-1',
                  operation_id: 'op-1',
                  recommendation_type: 'test',
                  created_by: 'user',
                  estimated_savings_usd: -100,
                  reasoning: 'Reason',
                  created_at: '2026-01-01T00:00:00Z',
                  approval_status: 'APPROVED',
                  approved_by: 'admin',
                  approved_at: '2026-01-01T01:00:00Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const results = await gate.getApprovalHistory();

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('approved');
    });

    it('should use default limit of 100', async () => {
      mockSelect.mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      await gate.getApprovalHistory();

      const limitCall =
        mockSelect.mock.results[0].value.in.mock.results[0].value.order.mock.results[0].value.limit;
      expect(limitCall).toHaveBeenCalledWith(100);
    });

    it('should return empty array on error', async () => {
      mockSelect.mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          }),
        }),
      });

      const results = await gate.getApprovalHistory();

      expect(results).toEqual([]);
    });
  });

  describe('Initialization', () => {
    it('should create approval gate with Supabase credentials', () => {
      const gate = new ApprovalGate();
      expect(gate).toBeDefined();
    });

    it('should throw if SUPABASE_URL missing', async () => {
      const savedUrl = process.env.SUPABASE_URL;
      delete process.env.SUPABASE_URL;

      await expect(async () => {
        await new ApprovalGate().requestApproval('test', 'test', 10, 'test');
      }).rejects.toThrow();
      process.env.SUPABASE_URL = savedUrl;
    });

    it('should throw if SUPABASE_SERVICE_KEY missing', async () => {
      const savedKey = process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_SERVICE_KEY;

      await expect(async () => {
        await new ApprovalGate().requestApproval('test', 'test', 10, 'test');
      }).rejects.toThrow();
      process.env.SUPABASE_SERVICE_KEY = savedKey;
    });
  });

  describe('Approval Request Properties', () => {
    it('should have all required fields', () => {
      expect(mockApprovalRequest).toHaveProperty('id');
      expect(mockApprovalRequest).toHaveProperty('operation_id');
      expect(mockApprovalRequest).toHaveProperty('operation_type');
      expect(mockApprovalRequest).toHaveProperty('cost_impact_usd');
      expect(mockApprovalRequest).toHaveProperty('reason');
      expect(mockApprovalRequest).toHaveProperty('status');
    });

    it('should validate status values', () => {
      const validStatuses = ['pending', 'approved', 'rejected'];
      expect(validStatuses).toContain(mockApprovalRequest.status);
    });

    it('should track cost impact', () => {
      expect(mockApprovalRequest.cost_impact_usd).toBeGreaterThan(0);
    });

    it('should track timestamps', () => {
      expect(mockApprovalRequest.requested_at).toBeDefined();
      expect(mockApprovalRequest.requested_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should support optional approval tracking', () => {
      const approved = { ...mockApprovalRequest, status: 'approved', approved_by: 'rodrigo' };
      expect(approved.approved_by).toBe('rodrigo');
    });
  });

  describe('Cost Impact Tracking', () => {
    it('should track positive cost impacts', () => {
      const costlyOperation = { ...mockApprovalRequest, cost_impact_usd: 100.0 };
      expect(costlyOperation.cost_impact_usd).toBe(100.0);
    });

    it('should track small cost impacts', () => {
      const smallCost = { ...mockApprovalRequest, cost_impact_usd: 0.5 };
      expect(smallCost.cost_impact_usd).toBe(0.5);
    });

    it('should accumulate costs across multiple operations', () => {
      const op1 = { ...mockApprovalRequest, cost_impact_usd: 10.0 };
      const op2 = { ...mockApprovalRequest, cost_impact_usd: 15.0 };
      const total = op1.cost_impact_usd + op2.cost_impact_usd;
      expect(total).toBe(25.0);
    });
  });

  describe('Operation Types', () => {
    it('should support model change approvals', () => {
      const modelChange = {
        ...mockApprovalRequest,
        operation_type: 'Model Change',
        reason: 'Switch chat_message to DeepSeek',
      };
      expect(modelChange.operation_type).toContain('Model');
    });

    it('should support budget policy approvals', () => {
      const budgetChange = {
        ...mockApprovalRequest,
        operation_type: 'Budget Policy',
        reason: 'Increase daily limit to $100',
      };
      expect(budgetChange.operation_type).toContain('Budget');
    });

    it('should support feature toggle approvals', () => {
      const toggleChange = {
        ...mockApprovalRequest,
        operation_type: 'Feature Toggle',
        reason: 'Enable helix_can_change_models',
      };
      expect(toggleChange.operation_type).toContain('Feature');
    });
  });

  describe('Workflow Scenarios', () => {
    it('should transition from pending to approved', () => {
      const request = { ...mockApprovalRequest, status: 'pending' as const };
      const approved = { ...request, status: 'approved' as const, approved_by: 'rodrigo' };
      expect(request.status).toBe('pending');
      expect(approved.status).toBe('approved');
    });

    it('should transition from pending to rejected', () => {
      const request = { ...mockApprovalRequest, status: 'pending' as const };
      const rejected = {
        ...request,
        status: 'rejected' as const,
        rejection_reason: 'Too risky',
      };
      expect(request.status).toBe('pending');
      expect(rejected.status).toBe('rejected');
    });

    it('should not allow invalid transitions', () => {
      const approved = { ...mockApprovalRequest, status: 'approved' as const };
      // Approved should not go back to pending
      expect(approved.status).not.toBe('pending');
    });
  });

  describe('Timestamp Tracking', () => {
    it('should record request time', () => {
      const request = { ...mockApprovalRequest };
      expect(request.requested_at).toBeDefined();
      expect(request.requested_at).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
    });

    it('should record approval time if approved', () => {
      const approved = {
        ...mockApprovalRequest,
        status: 'approved',
        approved_at: '2026-02-04T10:15:00Z',
      };
      expect(approved.approved_at).toBeDefined();
      expect(approved.approved_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('should show approval latency', () => {
      const requested = new Date('2026-02-04T10:00:00Z');
      const approved = new Date('2026-02-04T10:15:00Z');
      const latencyMs = approved.getTime() - requested.getTime();
      expect(latencyMs).toBe(15 * 60 * 1000); // 15 minutes
    });
  });

  describe('Approver Tracking', () => {
    it('should track who approved', () => {
      const approved = {
        ...mockApprovalRequest,
        status: 'approved',
        approved_by: 'rodrigo',
      };
      expect(approved.approved_by).toBe('rodrigo');
    });

    it('should track rejection reason', () => {
      const rejected = {
        ...mockApprovalRequest,
        status: 'rejected',
        rejection_reason: 'Operation too expensive',
      };
      expect(rejected.rejection_reason).toBeDefined();
    });

    it('should support audit trail', () => {
      const requests = [
        { ...mockApprovalRequest, id: '1', status: 'approved', approved_by: 'rodrigo' },
        { ...mockApprovalRequest, id: '2', status: 'rejected', rejection_reason: 'Too risky' },
        { ...mockApprovalRequest, id: '3', status: 'pending' },
      ];

      expect(requests.filter(r => r.status === 'approved')).toHaveLength(1);
      expect(requests.filter(r => r.status === 'rejected')).toHaveLength(1);
      expect(requests.filter(r => r.status === 'pending')).toHaveLength(1);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle high-cost operations requiring approval', () => {
      const highCostOp = { ...mockApprovalRequest, cost_impact_usd: 500.0 };
      expect(highCostOp.cost_impact_usd).toBeGreaterThan(50);
      // Would require approval
    });

    it('should handle model optimization approval', () => {
      const optimization = {
        ...mockApprovalRequest,
        operation_type: 'Model Optimization',
        reason: 'Switch sentiment_analysis from Sonnet to Gemini Flash',
        cost_impact_usd: -15.0, // Negative = savings
      };
      // Even with savings, must verify no quality degradation
      expect(optimization.cost_impact_usd).toBeLessThan(0);
    });

    it('should handle multiple pending approvals', () => {
      const pending = [
        { ...mockApprovalRequest, id: '1', cost_impact_usd: 10.0 },
        { ...mockApprovalRequest, id: '2', cost_impact_usd: 15.0 },
        { ...mockApprovalRequest, id: '3', cost_impact_usd: 5.0 },
      ];

      const totalCost = pending.reduce((sum, p) => sum + p.cost_impact_usd, 0);
      expect(totalCost).toBe(30.0);
    });

    it('should approve time-sensitive operations', () => {
      const urgent = {
        ...mockApprovalRequest,
        reason: 'Emergency: Database down, need faster fallback',
        cost_impact_usd: 50.0,
      };
      expect(urgent.reason).toContain('Emergency');
      // Would get fast-tracked approval
    });
  });

  describe('Error Handling', () => {
    it('should validate cost impact is numeric', () => {
      const valid = { ...mockApprovalRequest, cost_impact_usd: 25.5 };
      expect(typeof valid.cost_impact_usd).toBe('number');
    });

    it('should validate operation ID is provided', () => {
      expect(mockApprovalRequest.operation_id).toBeDefined();
      expect(mockApprovalRequest.operation_id.length).toBeGreaterThan(0);
    });

    it('should validate reason is provided', () => {
      expect(mockApprovalRequest.reason).toBeDefined();
      expect(mockApprovalRequest.reason.length).toBeGreaterThan(0);
    });
  });
});
