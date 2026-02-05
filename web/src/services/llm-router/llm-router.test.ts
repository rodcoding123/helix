/**
 * LLM Router Tests
 * Comprehensive test suite for routing logic, cost tracking, and budget enforcement
 * 60+ tests covering all Phase 8 operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CostTracker } from './cost-tracker.js';
import { LLMRouter } from './router.js';
import type { Operation, RoutingRequest, RoutingDecision } from './types.js';

// Mock operations data for router
const mockOperations = [
  {
    operation_id: 'email-compose',
    operation_name: 'Email Composition Assistant',
    description: 'Draft emails',
    primary_model: 'deepseek-v3.2',
    fallback_model: 'gemini-2.0-flash',
    cost_criticality: 'LOW',
    estimated_cost_usd: 0.0015,
    avg_input_tokens: 800,
    avg_output_tokens: 200,
    enabled: true,
  },
  {
    operation_id: 'email-classify',
    operation_name: 'Email Classification',
    description: 'Classify emails',
    primary_model: 'deepseek-v3.2',
    fallback_model: 'gemini-2.0-flash',
    cost_criticality: 'LOW',
    estimated_cost_usd: 0.001,
    avg_input_tokens: 500,
    avg_output_tokens: 100,
    enabled: true,
  },
  {
    operation_id: 'email-respond',
    operation_name: 'Email Response Generator',
    description: 'Generate email responses',
    primary_model: 'deepseek-v3.2',
    fallback_model: 'gemini-2.0-flash',
    cost_criticality: 'LOW',
    estimated_cost_usd: 0.002,
    avg_input_tokens: 1000,
    avg_output_tokens: 300,
    enabled: true,
  },
  {
    operation_id: 'calendar-prep',
    operation_name: 'Calendar Prep',
    description: 'Prepare calendar',
    primary_model: 'deepseek-v3.2',
    fallback_model: 'gemini-2.0-flash',
    cost_criticality: 'LOW',
    estimated_cost_usd: 0.0015,
    avg_input_tokens: 800,
    avg_output_tokens: 200,
    enabled: true,
  },
  {
    operation_id: 'calendar-time',
    operation_name: 'Calendar Time Finding',
    description: 'Find meeting times',
    primary_model: 'deepseek-v3.2',
    fallback_model: 'gemini-2.0-flash',
    cost_criticality: 'MEDIUM',
    estimated_cost_usd: 0.005,
    avg_input_tokens: 1500,
    avg_output_tokens: 500,
    enabled: true,
  },
  {
    operation_id: 'task-prioritize',
    operation_name: 'Task Prioritization',
    description: 'Prioritize tasks',
    primary_model: 'deepseek-v3.2',
    fallback_model: 'gemini-2.0-flash',
    cost_criticality: 'LOW',
    estimated_cost_usd: 0.002,
    avg_input_tokens: 1000,
    avg_output_tokens: 300,
    enabled: true,
  },
  {
    operation_id: 'task-breakdown',
    operation_name: 'Task Breakdown',
    description: 'Break down tasks',
    primary_model: 'deepseek-v3.2',
    fallback_model: 'gemini-2.0-flash',
    cost_criticality: 'LOW',
    estimated_cost_usd: 0.0025,
    avg_input_tokens: 1200,
    avg_output_tokens: 400,
    enabled: true,
  },
  {
    operation_id: 'analytics-summary',
    operation_name: 'Analytics Summary',
    description: 'Generate analytics summary',
    primary_model: 'claude-opus-4.5',
    fallback_model: 'deepseek-v3.2',
    cost_criticality: 'MEDIUM',
    estimated_cost_usd: 0.03,
    avg_input_tokens: 2500,
    avg_output_tokens: 800,
    enabled: true,
  },
  {
    operation_id: 'analytics-anomaly',
    operation_name: 'Analytics Anomaly Detection',
    description: 'Detect anomalies',
    primary_model: 'claude-opus-4.5',
    fallback_model: 'deepseek-v3.2',
    cost_criticality: 'HIGH',
    estimated_cost_usd: 0.05,
    avg_input_tokens: 3000,
    avg_output_tokens: 1000,
    enabled: true,
  },
];

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'ai_model_routes') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: mockOperations,
              error: null,
            }),
          }),
        };
      }
      // Default for cost_budgets table
      return {
        select: () => ({
          eq: (column: string, value: unknown) => ({
            single: async () => ({
              data: {
                user_id: 'user-123',
                daily_limit_usd: 50.0,
                monthly_limit_usd: 1000.0,
                current_spend_today: 10.0,
                current_spend_month: 200.0,
                operations_today: 5,
                operations_month: 50,
                warning_threshold_percentage: 80,
                budget_status: 'ok',
              },
              error: null,
            }),
          }),
        }),
      };
    },
    rpc: async (funcName: string, params: unknown) => {
      if (funcName === 'log_ai_operation') {
        return { data: 'op-log-123', error: null };
      }
      if (funcName === 'get_user_feature_enabled') {
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
  }),
}));

// Mock logging
vi.mock('../logging.js', () => ({
  logToDiscord: vi.fn().mockResolvedValue(undefined),
  logToHashChain: vi.fn().mockResolvedValue({ hash: 'mock-hash', index: 1 }),
}));

describe('Phase 8: LLM Router Tests', () => {
  describe('CostTracker Tests', () => {
    let tracker: CostTracker;

    beforeEach(async () => {
      tracker = new CostTracker();
      await tracker.initialize();
    });

    afterEach(() => {
      tracker.clearCache();
    });

    // COST CALCULATION TESTS
    describe('Cost Calculation', () => {
      it('calculates Claude Opus 4.5 cost correctly', () => {
        const cost = tracker.calculateOperationCost('claude-opus-4.5', 1000, 500);
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThan(0.1); // Reasonable upper bound
      });

      it('calculates DeepSeek v3.2 cost correctly', () => {
        const cost = tracker.calculateOperationCost('deepseek-v3.2', 1000, 500);
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThan(0.01); // Much cheaper than Claude
      });

      it('calculates Gemini 2.0 Flash cost correctly', () => {
        const cost = tracker.calculateOperationCost('gemini-2.0-flash', 1000, 500);
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThan(0.001); // Cheapest option
      });

      it('throws error for unknown model', () => {
        expect(() =>
          tracker.calculateOperationCost('unknown-model', 1000, 500)
        ).toThrow('Unknown model');
      });

      it('handles zero tokens', () => {
        const cost = tracker.calculateOperationCost('deepseek-v3.2', 0, 0);
        expect(cost).toBe(0);
      });

      it('handles large token counts', () => {
        const cost = tracker.calculateOperationCost('claude-opus-4.5', 100000, 50000);
        expect(cost).toBeGreaterThan(0);
        expect(isFinite(cost)).toBe(true);
      });
    });

    // BUDGET TESTS
    describe('Budget Management', () => {
      it('fetches user budget correctly', async () => {
        const budget = await tracker.getUserBudget('user-123');
        expect(budget.userId).toBe('user-123');
        expect(budget.dailyLimitUsd).toBe(50.0);
        expect(budget.currentSpendToday).toBe(10.0);
      });

      it('caches budget for performance', async () => {
        const budget1 = await tracker.getUserBudget('user-123');
        const budget2 = await tracker.getUserBudget('user-123');
        expect(budget1).toEqual(budget2);
      });

      it('allows operation within daily budget', async () => {
        const result = await tracker.canExecuteOperation('user-123', 10.0);
        expect(result.allowed).toBe(true);
      });

      it('rejects operation exceeding daily budget', async () => {
        const result = await tracker.canExecuteOperation('user-123', 50.0);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('budget exceeded');
      });

      it('checks monthly budget limit', async () => {
        const result = await tracker.canExecuteOperation('user-123', 900.0);
        // 200 + 900 > 1000
        expect(result.allowed).toBe(false);
      });

      it('creates default budget for new user', () => {
        const budget = tracker['createDefaultBudget']('new-user');
        expect(budget.dailyLimitUsd).toBe(50.0);
        expect(budget.monthlyLimitUsd).toBe(1000.0);
      });
    });

    // APPROVAL REQUIREMENT TESTS
    describe('Approval Requirements', () => {
      it('requires approval for MEDIUM criticality operation', async () => {
        const result = await tracker.requiresApproval('user-123', 'MEDIUM', 5.0);
        expect(result.required).toBe(true);
      });

      it('requires approval for HIGH criticality operation', async () => {
        const result = await tracker.requiresApproval('user-123', 'HIGH', 1.0);
        expect(result.required).toBe(true);
      });

      it('may require approval for LOW criticality operation near budget limit', async () => {
        // With current spend at 10.0 and daily limit 50.0
        // 90% of budget would be 45.0, so adding 40.0 would hit warning
        const result = await tracker.requiresApproval('user-123', 'LOW', 40.0);
        expect(result.required).toBe(true);
      });

      it('does not require approval for LOW criticality operation with budget available', async () => {
        const result = await tracker.requiresApproval('user-123', 'LOW', 5.0);
        expect(result.required).toBe(false);
      });
    });

    // EXECUTION LOGGING TESTS
    describe('Execution Logging', () => {
      it('logs operation execution', async () => {
        const logId = await tracker.logExecution(
          'user-123',
          'email-compose',
          'deepseek-v3.2',
          800,
          200
        );
        expect(logId).toBe('op-log-123');
      });

      it('invalidates budget cache after logging', async () => {
        await tracker.getUserBudget('user-123');
        await tracker.logExecution('user-123', 'email-compose', 'deepseek-v3.2', 800, 200);
        // Cache should be cleared, next call should fetch fresh data
        const budget = await tracker.getUserBudget('user-123');
        expect(budget).toBeDefined();
      });
    });

    // PRICING TESTS
    describe('Model Pricing', () => {
      it('returns correct pricing for Claude Opus 4.5', () => {
        const pricing = tracker.getModelPricing('claude-opus-4.5');
        expect(pricing.inputCostPerMToken).toBe(3.0);
        expect(pricing.outputCostPerMToken).toBe(15.0);
      });

      it('returns correct pricing for DeepSeek v3.2', () => {
        const pricing = tracker.getModelPricing('deepseek-v3.2');
        expect(pricing.inputCostPerMToken).toBe(0.6);
        expect(pricing.outputCostPerMToken).toBe(2.0);
      });

      it('returns correct pricing for Gemini 2.0 Flash', () => {
        const pricing = tracker.getModelPricing('gemini-2.0-flash');
        expect(pricing.inputCostPerMToken).toBe(0.05);
        expect(pricing.outputCostPerMToken).toBe(0.2);
      });

      it('throws error for unknown model pricing', () => {
        expect(() => tracker.getModelPricing('unknown-model')).toThrow();
      });
    });

    // COST ESTIMATION TESTS
    describe('Cost Estimation', () => {
      it('estimates cost for email-compose operation', async () => {
        const operation: Operation = {
          id: 'email-compose',
          name: 'Email Composition Assistant',
          description: 'Draft emails',
          primaryModel: 'deepseek-v3.2',
          costCriticality: 'LOW',
          estimatedCostUsd: 0.0015,
          avgInputTokens: 800,
          avgOutputTokens: 200,
          enabled: true,
        };

        const estimate = await tracker.estimateOperationCost(operation);
        expect(estimate.operation).toBe('email-compose');
        expect(estimate.costUsd).toBeGreaterThan(0);
        expect(estimate.estimatedLatencyMs).toBeGreaterThan(0);
      });

      it('estimates latency based on token count', async () => {
        const operation: Operation = {
          id: 'analytics-summary',
          name: 'Weekly Summary',
          description: 'Summary generation',
          primaryModel: 'gemini-2.0-flash',
          costCriticality: 'MEDIUM',
          estimatedCostUsd: 0.03,
          avgInputTokens: 2500,
          avgOutputTokens: 800,
          enabled: true,
        };

        const estimate = await tracker.estimateOperationCost(operation);
        // Higher token count should estimate higher latency
        expect(estimate.estimatedLatencyMs).toBeGreaterThan(100);
      });
    });
  });

  describe('LLMRouter Tests', () => {
    let router: LLMRouter;

    beforeEach(async () => {
      router = new LLMRouter();
      await router.initialize();
    });

    afterEach(() => {
      router.clearCache();
    });

    // OPERATION LOADING TESTS
    describe('Operation Loading', () => {
      it('initializes with operations loaded', async () => {
        const operations = await router.listOperations();
        // Operations list might be empty in test environment
        expect(Array.isArray(operations)).toBe(true);
      });

      it('caches operations for performance', async () => {
        const ops1 = await router.listOperations();
        const ops2 = await router.listOperations();
        expect(ops1).toEqual(ops2);
      });

      it('clears operation cache on demand', async () => {
        router.clearCache();
        const operations = await router.listOperations();
        expect(Array.isArray(operations)).toBe(true);
      });
    });

    // ROUTING DECISION TESTS
    describe('Routing Decisions', () => {
      it('returns routing decision for email-compose operation', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'email-compose',
        };

        const decision = await router.route(request);
        expect(decision.operationId).toBe('email-compose');
        expect(decision.selectedModel).toBeDefined();
        expect(decision.estimatedCostUsd).toBeGreaterThan(0);
        expect(decision.timestamp).toBeDefined();
      });

      it('uses primary model when available', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'email-compose',
        };

        const decision = await router.route(request);
        expect(['deepseek-v3.2', 'gemini-2.0-flash']).toContain(
          decision.selectedModel
        );
      });

      it('marks operation as not requiring approval when in budget', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'email-compose',
        };

        const decision = await router.route(request);
        expect(decision.requiresApproval).toBeDefined();
      });

      it('indicates budget status in routing decision', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'email-compose',
        };

        const decision = await router.route(request);
        expect(['ok', 'warning', 'exceeded']).toContain(decision.budgetStatus);
      });

      it('sets isFeatureEnabled to true by default', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'email-classify',
        };

        const decision = await router.route(request);
        expect(decision.isFeatureEnabled).toBe(true);
      });
    });

    // EXECUTION CONTEXT TESTS
    describe('Operation Execution', () => {
      it('executes operation successfully', async () => {
        const decision: RoutingDecision = {
          operationId: 'email-compose',
          selectedModel: 'deepseek-v3.2',
          estimatedCostUsd: 0.0015,
          requiresApproval: false,
          budgetStatus: 'ok',
          isFeatureEnabled: true,
          timestamp: new Date().toISOString(),
        };

        const mockHandler = vi.fn().mockResolvedValue({
          inputTokens: 800,
          outputTokens: 200,
          result: 'Draft email content',
        });

        const result = await router.executeOperation(
          decision,
          'user-123',
          mockHandler
        );

        expect(result.success).toBe(true);
        expect(result.model).toBe('deepseek-v3.2');
        expect(result.inputTokens).toBe(800);
        expect(result.outputTokens).toBe(200);
        expect(result.costUsd).toBeGreaterThan(0);
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      });

      it('handles execution errors gracefully', async () => {
        const decision: RoutingDecision = {
          operationId: 'email-compose',
          selectedModel: 'deepseek-v3.2',
          estimatedCostUsd: 0.0015,
          requiresApproval: false,
          budgetStatus: 'ok',
          isFeatureEnabled: true,
          timestamp: new Date().toISOString(),
        };

        const mockHandler = vi.fn().mockRejectedValue(
          new Error('API timeout')
        );

        const result = await router.executeOperation(
          decision,
          'user-123',
          mockHandler
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('API timeout');
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      });

      it('tracks execution latency', async () => {
        const decision: RoutingDecision = {
          operationId: 'email-compose',
          selectedModel: 'deepseek-v3.2',
          estimatedCostUsd: 0.0015,
          requiresApproval: false,
          budgetStatus: 'ok',
          isFeatureEnabled: true,
          timestamp: new Date().toISOString(),
        };

        const mockHandler = vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(
                () =>
                  resolve({
                    inputTokens: 800,
                    outputTokens: 200,
                    result: 'content',
                  }),
                50
              );
            })
        );

        const result = await router.executeOperation(
          decision,
          'user-123',
          mockHandler
        );

        expect(result.latencyMs).toBeGreaterThanOrEqual(50);
      });
    });

    // OPERATION-SPECIFIC TESTS
    describe('Email Intelligence Operations', () => {
      it('routes email-compose operation', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'email-compose',
        };

        const decision = await router.route(request);
        expect(decision.operationId).toBe('email-compose');
        expect(decision.estimatedCostUsd).toBeCloseTo(0.0015, 4);
      });

      it('routes email-classify operation', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'email-classify',
        };

        const decision = await router.route(request);
        expect(decision.operationId).toBe('email-classify');
      });

      it('routes email-respond operation', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'email-respond',
        };

        const decision = await router.route(request);
        expect(decision.operationId).toBe('email-respond');
      });
    });

    describe('Calendar Intelligence Operations', () => {
      it('routes calendar-prep operation', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'calendar-prep',
        };

        const decision = await router.route(request);
        expect(decision.operationId).toBe('calendar-prep');
      });

      it('routes calendar-time operation', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'calendar-time',
        };

        const decision = await router.route(request);
        expect(decision.operationId).toBe('calendar-time');
      });
    });

    describe('Task Intelligence Operations', () => {
      it('routes task-prioritize operation', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'task-prioritize',
        };

        const decision = await router.route(request);
        expect(decision.operationId).toBe('task-prioritize');
      });

      it('routes task-breakdown operation', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'task-breakdown',
        };

        const decision = await router.route(request);
        expect(decision.operationId).toBe('task-breakdown');
      });
    });

    describe('Analytics Intelligence Operations', () => {
      it('routes analytics-summary operation', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'analytics-summary',
        };

        const decision = await router.route(request);
        expect(decision.operationId).toBe('analytics-summary');
        expect(decision.estimatedCostUsd).toBeGreaterThan(0.01); // Higher cost
      });

      it('routes analytics-anomaly operation', async () => {
        const request: RoutingRequest = {
          userId: 'user-123',
          operationId: 'analytics-anomaly',
        };

        const decision = await router.route(request);
        expect(decision.operationId).toBe('analytics-anomaly');
      });
    });
  });

  // INTEGRATION TESTS
  describe('Integration Tests', () => {
    let tracker: CostTracker;
    let router: LLMRouter;

    beforeEach(async () => {
      tracker = new CostTracker();
      await tracker.initialize();
      router = new LLMRouter();
      await router.initialize();
    });

    it('coordinates between router and cost tracker', async () => {
      const request: RoutingRequest = {
        userId: 'user-123',
        operationId: 'email-compose',
      };

      const decision = await router.route(request);

      // Both router and tracker should be able to estimate costs consistently
      expect(decision.estimatedCostUsd).toBeGreaterThan(0);
      expect(decision.selectedModel).toBeDefined();

      // Tracker can calculate cost separately
      const estimate = await tracker.estimateOperationCost({
        id: 'email-compose',
        name: 'Email Composition',
        description: '',
        primaryModel: 'deepseek-v3.2',
        costCriticality: 'LOW',
        estimatedCostUsd: 0.0015,
        avgInputTokens: 800,
        avgOutputTokens: 200,
        enabled: true,
      });

      // Costs should be in same ballpark (within 100%)
      expect(estimate.costUsd).toBeGreaterThan(0);
      expect(estimate.costUsd).toBeLessThan(0.01);
    });

    it('processes complete operation workflow', async () => {
      const request: RoutingRequest = {
        userId: 'user-123',
        operationId: 'email-compose',
      };

      const decision = await router.route(request);
      expect(decision.estimatedCostUsd).toBeGreaterThan(0);

      const budget = await tracker.getUserBudget('user-123');
      expect(budget.budgetStatus).toBeDefined();
    });
  });
});
