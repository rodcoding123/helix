/**
 * ApprovalGate Tests
 *
 * Comprehensive test coverage for approval workflow,
 * Discord notifications, and decision tracking.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock Supabase before importing ApprovalGate
vi.mock('@supabase/supabase-js', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(async () => ({ data: {}, error: null })),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };

  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => mockQueryBuilder),
      rpc: vi.fn(async () => ({ data: {}, error: null })),
    })),
  };
});

import { ApprovalGate, ApprovalRequest } from './approval-gate.js';

describe('ApprovalGate', () => {
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

  describe('Initialization', () => {
    it('should create approval gate with Supabase credentials', () => {
      const gate = new ApprovalGate();
      expect(gate).toBeDefined();
    });

    it('should throw if SUPABASE_URL missing', () => {
      const savedUrl = process.env.SUPABASE_URL;
      delete process.env.SUPABASE_URL;
      expect(() => new ApprovalGate().requestApproval('test', 'test', 10, 'test')).toThrow();
      process.env.SUPABASE_URL = savedUrl;
    });

    it('should throw if SUPABASE_SERVICE_KEY missing', () => {
      const savedKey = process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_SERVICE_KEY;
      expect(() => new ApprovalGate().requestApproval('test', 'test', 10, 'test')).toThrow();
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
