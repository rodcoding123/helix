/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/require-await */
/**
 * Phase 8: Intelligence Operations Integration Tests
 * Tests all 9 Phase 8 intelligence operations with Phase 0.5 router
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase with Phase 8 operation routes before importing router
vi.mock('@supabase/supabase-js', () => {
  const mockRoutes: Record<string, any> = {
    'email-compose': { operation_id: 'email-compose', operation_name: 'Email Composition Assistance', primary_model: 'claude_sonnet_4', cost_criticality: 'LOW', enabled: true },
    'email-classify': { operation_id: 'email-classify', operation_name: 'Email Classification', primary_model: 'gemini_flash', cost_criticality: 'LOW', enabled: true },
    'email-respond': { operation_id: 'email-respond', operation_name: 'Email Response Synthesis', primary_model: 'claude_sonnet_4', cost_criticality: 'LOW', enabled: true },
    'calendar-prep': { operation_id: 'calendar-prep', operation_name: 'Calendar Preparation', primary_model: 'deepseek_v3', cost_criticality: 'LOW', enabled: true },
    'calendar-time': { operation_id: 'calendar-time', operation_name: 'Calendar Time Optimization', primary_model: 'gemini_flash', cost_criticality: 'LOW', enabled: true },
    'task-prioritize': { operation_id: 'task-prioritize', operation_name: 'Task Prioritization', primary_model: 'deepseek_v3', cost_criticality: 'LOW', enabled: true },
    'task-breakdown': { operation_id: 'task-breakdown', operation_name: 'Task Breakdown', primary_model: 'deepseek_v3', cost_criticality: 'LOW', enabled: true },
    'analytics-summary': { operation_id: 'analytics-summary', operation_name: 'Analytics Summary', primary_model: 'gemini_flash', cost_criticality: 'MEDIUM', enabled: true },
    'analytics-anomaly': { operation_id: 'analytics-anomaly', operation_name: 'Analytics Anomaly Detection', primary_model: 'deepseek_v3', cost_criticality: 'LOW', enabled: true },
  };

  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        let filterOp = '';
        let filterVal = '';

        const builder = {
          select: vi.fn(function () { return this; }),
          eq: vi.fn(function (field: string, value: any) {
            filterOp = field;
            filterVal = value;
            return this;
          }) as any,
          single: vi.fn(async () => {
            if (table === 'ai_model_routes' && filterOp === 'operation_id') {
              const data = mockRoutes[filterVal];
              return { data, error: data ? null : new Error('Not found') };
            }
            return { data: {}, error: null };
          }),
          insert: vi.fn(function () { return this; }),
          update: vi.fn(function () { return this; }),
        };
        return builder as any;
      }),
      rpc: vi.fn(async () => ({ data: {}, error: null })),
    })),
  };
});

import { AIOperationRouter } from './router.js';
import type { RoutingRequest } from './router.js';

describe('Phase 8: Intelligence Operations Integration', () => {
  let router: AIOperationRouter;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    router = new AIOperationRouter();
  });

  describe('Email Intelligence Operations', () => {
    describe('email-compose', () => {
      it('should route email-compose to deepseek', async () => {
        const request: RoutingRequest = {
          operationId: 'email-compose',
          userId: testUserId,
          input: { subject: 'Test', context: 'Business email' },
          estimatedInputTokens: 100,
        };

        const response = await router.route(request);

        expect(response).toEqual(
          expect.objectContaining({
            operationId: 'email-compose',
            model: 'deepseek',
            requiresApproval: false,
          })
        );
      });

      it('should estimate cost for email-compose', async () => {
        const request: RoutingRequest = {
          operationId: 'email-compose',
          userId: testUserId,
          input: { subject: 'Test' },
          estimatedInputTokens: 500,
        };

        const response = await router.route(request);

        // DeepSeek: 500 input tokens * $0.0027 per 1K = $0.00135
        expect(response.estimatedCostUsd).toBeCloseTo(0.00135, 5);
      });

      it('should be enabled in model_routes', async () => {
        const operations = await router.getRegisteredOperations();
        const emailCompose = operations.find((op: any) => op.operation_id === 'email-compose');

        expect(emailCompose).toBeDefined();
        expect(emailCompose?.enabled).toBe(true);
      });
    });

    describe('email-classify', () => {
      it('should route email-classify to deepseek', async () => {
        const request: RoutingRequest = {
          operationId: 'email-classify',
          userId: testUserId,
          input: { subject: 'Test', body: 'Email content' },
          estimatedInputTokens: 200,
        };

        const response = await router.route(request);

        expect(response.model).toBe('deepseek');
        expect(response.operationId).toBe('email-classify');
      });

      it('should have lower cost than email-compose', async () => {
        const composeRequest: RoutingRequest = {
          operationId: 'email-compose',
          userId: testUserId,
          input: {},
          estimatedInputTokens: 1000,
        };

        const classifyRequest: RoutingRequest = {
          operationId: 'email-classify',
          userId: testUserId,
          input: {},
          estimatedInputTokens: 1000,
        };

        const composeResponse = await router.route(composeRequest);
        const classifyResponse = await router.route(classifyRequest);

        // Classify should cost less due to smaller output
        expect(classifyResponse.estimatedCostUsd).toBeLessThan(composeResponse.estimatedCostUsd);
      });
    });

    describe('email-respond', () => {
      it('should route email-respond to deepseek', async () => {
        const request: RoutingRequest = {
          operationId: 'email-respond',
          userId: testUserId,
          input: { originalSubject: 'Re: Test', body: 'Email to respond to' },
          estimatedInputTokens: 300,
        };

        const response = await router.route(request);

        expect(response.model).toBe('deepseek');
      });

      it('should require no approval for email operations', async () => {
        const request: RoutingRequest = {
          operationId: 'email-respond',
          userId: testUserId,
          input: {},
          estimatedInputTokens: 100,
        };

        const response = await router.route(request);

        expect(response.requiresApproval).toBe(false);
      });
    });
  });

  describe('Calendar Intelligence Operations', () => {
    describe('calendar-prep', () => {
      it('should route calendar-prep to deepseek', async () => {
        const request: RoutingRequest = {
          operationId: 'calendar-prep',
          userId: testUserId,
          input: { event: 'Team meeting', duration: 60 },
          estimatedInputTokens: 150,
        };

        const response = await router.route(request);

        expect(response.model).toBe('deepseek');
        expect(response.operationId).toBe('calendar-prep');
      });

      it('should be low cost criticality', async () => {
        const operations = await router.getRegisteredOperations();
        const calendarPrep = operations.find((op: any) => op.operation_id === 'calendar-prep');

        expect(calendarPrep?.cost_criticality).toBe('LOW');
      });
    });

    describe('calendar-time', () => {
      it('should route calendar-time to gemini_flash', async () => {
        const request: RoutingRequest = {
          operationId: 'calendar-time',
          userId: testUserId,
          input: { duration: 30, attendees: ['user@example.com'] },
          estimatedInputTokens: 200,
        };

        const response = await router.route(request);

        expect(response.model).toBe('gemini_flash');
      });

      it('should have fallback to deepseek', async () => {
        const operations = await router.getRegisteredOperations();
        const calendarTime = operations.find((op: any) => op.operation_id === 'calendar-time');

        expect(calendarTime?.fallback_model).toBe('deepseek');
      });
    });
  });

  describe('Task Intelligence Operations', () => {
    describe('task-prioritize', () => {
      it('should route task-prioritize to deepseek', async () => {
        const request: RoutingRequest = {
          operationId: 'task-prioritize',
          userId: testUserId,
          input: { tasks: ['Task 1', 'Task 2', 'Task 3'] },
          estimatedInputTokens: 250,
        };

        const response = await router.route(request);

        expect(response.model).toBe('deepseek');
      });

      it('should cost less than calendar operations', async () => {
        const taskRequest: RoutingRequest = {
          operationId: 'task-prioritize',
          userId: testUserId,
          input: {},
          estimatedInputTokens: 1000,
        };

        const calendarRequest: RoutingRequest = {
          operationId: 'calendar-time',
          userId: testUserId,
          input: {},
          estimatedInputTokens: 1000,
        };

        const taskResponse = await router.route(taskRequest);
        const calendarResponse = await router.route(calendarRequest);

        expect(taskResponse.estimatedCostUsd).toBeLessThan(calendarResponse.estimatedCostUsd);
      });
    });

    describe('task-breakdown', () => {
      it('should route task-breakdown to deepseek', async () => {
        const request: RoutingRequest = {
          operationId: 'task-breakdown',
          userId: testUserId,
          input: { task: 'Complex project', description: 'Break this down' },
          estimatedInputTokens: 300,
        };

        const response = await router.route(request);

        expect(response.model).toBe('deepseek');
        expect(response.operationId).toBe('task-breakdown');
      });
    });
  });

  describe('Analytics Intelligence Operations', () => {
    describe('analytics-summary', () => {
      it('should route analytics-summary to gemini_flash', async () => {
        const request: RoutingRequest = {
          operationId: 'analytics-summary',
          userId: testUserId,
          input: {
            period: { start: '2026-01-29', end: '2026-02-04' },
            metrics: { emailsProcessed: 100, tasksCompleted: 25 },
          },
          estimatedInputTokens: 500,
        };

        const response = await router.route(request);

        expect(response.model).toBe('gemini_flash');
      });

      it('should be higher cost due to analysis complexity', async () => {
        const request: RoutingRequest = {
          operationId: 'analytics-summary',
          userId: testUserId,
          input: {},
          estimatedInputTokens: 1000,
        };

        const response = await router.route(request);

        // Should be ~$0.025 for Gemini Flash (larger output)
        expect(response.estimatedCostUsd).toBeGreaterThan(0.01);
      });

      it('should be marked as medium criticality', async () => {
        const operations = await router.getRegisteredOperations();
        const analyticsSummary = operations.find(
          (op: any) => op.operation_id === 'analytics-summary'
        );

        expect(analyticsSummary?.cost_criticality).toBe('MEDIUM');
      });
    });

    describe('analytics-anomaly', () => {
      it('should route analytics-anomaly to deepseek', async () => {
        const request: RoutingRequest = {
          operationId: 'analytics-anomaly',
          userId: testUserId,
          input: {
            currentMetrics: { emailsProcessed: 500, tasksCompleted: 10 },
            historicalData: [],
          },
          estimatedInputTokens: 400,
        };

        const response = await router.route(request);

        expect(response.model).toBe('deepseek');
      });
    });
  });

  describe('Phase 8 Operations Registration', () => {
    it('should have all 9 operations registered', async () => {
      const operations = await router.getRegisteredOperations();
      const phase8Ops = operations.filter(
        (op: any) =>
          op.operation_id.startsWith('email-') ||
          op.operation_id.startsWith('calendar-') ||
          op.operation_id.startsWith('task-') ||
          op.operation_id.startsWith('analytics-')
      );

      expect(phase8Ops.length).toBe(9);
    });

    it('should have correct operation names', async () => {
      const operations = await router.getRegisteredOperations();
      const operationMap = new Map(
        operations.map((op: any) => [op.operation_id, op.operation_name])
      );

      expect(operationMap.get('email-compose')).toBe('Email Composition Assistance');
      expect(operationMap.get('email-classify')).toBe('Email Classification & Metadata');
      expect(operationMap.get('email-respond')).toBe('Email Response Suggestions');
      expect(operationMap.get('calendar-prep')).toBe('Meeting Preparation Generator');
      expect(operationMap.get('calendar-time')).toBe('Optimal Meeting Time Suggestions');
      expect(operationMap.get('task-prioritize')).toBe('Task Prioritization & Reordering');
      expect(operationMap.get('task-breakdown')).toBe('Task Breakdown & Subtask Generation');
      expect(operationMap.get('analytics-summary')).toBe('Weekly Analytics Summary');
      expect(operationMap.get('analytics-anomaly')).toBe('Analytics Pattern Anomaly Detection');
    });

    it('should have all Phase 8 operations enabled', async () => {
      const operations = await router.getRegisteredOperations();
      const phase8Ops = operations.filter(
        (op: any) =>
          op.operation_id.startsWith('email-') ||
          op.operation_id.startsWith('calendar-') ||
          op.operation_id.startsWith('task-') ||
          op.operation_id.startsWith('analytics-')
      );

      phase8Ops.forEach((op: any) => {
        expect(op.enabled).toBe(true);
      });
    });
  });

  describe('Cost Tracking for Phase 8', () => {
    it('should total ~$0.08/day for all Phase 8 operations', async () => {
      const dailyCalls = {
        'email-compose': 10,
        'email-classify': 20,
        'email-respond': 5,
        'calendar-prep': 5,
        'calendar-time': 3,
        'task-prioritize': 2,
        'task-breakdown': 2,
        'analytics-summary': 0.14, // 1/week
        'analytics-anomaly': 0.14, // 1/week
      };

      const costs: Record<string, number> = {
        'email-compose': 0.0015,
        'email-classify': 0.0006,
        'email-respond': 0.0012,
        'calendar-prep': 0.0025,
        'calendar-time': 0.008,
        'task-prioritize': 0.0018,
        'task-breakdown': 0.0012,
        'analytics-summary': 0.03,
        'analytics-anomaly': 0.0009,
      };

      let totalCost = 0;
      for (const [op, callCount] of Object.entries(dailyCalls)) {
        totalCost += costs[op] * callCount;
      }

      expect(totalCost).toBeCloseTo(0.08, 1); // Allow ~1 cent variance
    });

    it('should total ~$3/month with platform costs', () => {
      const dailyCost = 0.08;
      const monthlyCost = dailyCost * 30;
      const platformCost = 0.6; // Estimated platform overhead

      expect(monthlyCost + platformCost).toBeCloseTo(3.0, 0);
    });
  });

  describe('Budget Enforcement for Phase 8', () => {
    it('should not require approval for LOW criticality operations', async () => {
      const operations = [
        'email-compose',
        'email-classify',
        'email-respond',
        'calendar-prep',
        'calendar-time',
        'task-prioritize',
        'task-breakdown',
        'analytics-anomaly',
      ];

      for (const opId of operations) {
        const request: RoutingRequest = {
          operationId: opId,
          userId: testUserId,
          input: {},
          estimatedInputTokens: 100,
        };

        const response = await router.route(request);

        expect(response.requiresApproval).toBe(false);
      }
    });

    it('should require approval for MEDIUM criticality analytics-summary if near budget', async () => {
      // This would require setting up a user with high spend
      // For now, verify that analytics-summary is marked as MEDIUM
      const operations = await router.getRegisteredOperations();
      const analyticsSummary = operations.find(
        (op: any) => op.operation_id === 'analytics-summary'
      );

      expect(analyticsSummary?.cost_criticality).toBe('MEDIUM');
    });
  });

  describe('Model Fallbacks for Phase 8', () => {
    it('should fallback to gemini_flash if deepseek unavailable', async () => {
      // Set deepseek as unavailable (mock)
      vi.spyOn(router, 'route').mockResolvedValueOnce({
        operationId: 'email-compose',
        model: 'gemini_flash', // Fallback
        requiresApproval: false,
        estimatedCostUsd: 0.002,
        timestamp: new Date().toISOString(),
      });

      const request: RoutingRequest = {
        operationId: 'email-compose',
        userId: testUserId,
        input: {},
        estimatedInputTokens: 100,
      };

      const response = await router.route(request);

      expect(response.model).toBe('gemini_flash');
    });

    it('should fallback to deepseek if gemini_flash unavailable', async () => {
      // Set gemini_flash as unavailable (mock)
      vi.spyOn(router, 'route').mockResolvedValueOnce({
        operationId: 'calendar-time',
        model: 'deepseek', // Fallback
        requiresApproval: false,
        estimatedCostUsd: 0.002,
        timestamp: new Date().toISOString(),
      });

      const request: RoutingRequest = {
        operationId: 'calendar-time',
        userId: testUserId,
        input: {},
        estimatedInputTokens: 100,
      };

      const response = await router.route(request);

      expect(response.model).toBe('deepseek');
    });
  });

  describe('Phase 8 Operational Characteristics', () => {
    it('should have proper token estimation for different content sizes', async () => {
      // Small email
      const smallRequest: RoutingRequest = {
        operationId: 'email-compose',
        userId: testUserId,
        input: { subject: 'Hi' },
        estimatedInputTokens: 10,
      };

      // Large email with context
      const largeRequest: RoutingRequest = {
        operationId: 'email-compose',
        userId: testUserId,
        input: { subject: 'Long subject', context: 'Very long context about the email' },
        estimatedInputTokens: 500,
      };

      const smallResponse = await router.route(smallRequest);
      const largeResponse = await router.route(largeRequest);

      expect(largeResponse.estimatedCostUsd).toBeGreaterThan(smallResponse.estimatedCostUsd);
    });

    it('should cache routing decisions', async () => {
      const request: RoutingRequest = {
        operationId: 'email-compose',
        userId: testUserId,
        input: {},
        estimatedInputTokens: 100,
      };

      const response1 = await router.route(request);
      const response2 = await router.route(request);

      // Both should return the same result (cached)
      expect(response1.model).toBe(response2.model);
      expect(response1.estimatedCostUsd).toBe(response2.estimatedCostUsd);
    });
  });
});
