import { describe, it, expect } from 'vitest';
import { RequestPriorityQueue } from './priority-queue.js';
import { CostPredictor } from './cost-predictor.js';
import { RetryManager } from './retry-manager.js';
import { ObservabilityMetrics } from './observability-metrics.js';

describe('Phase 5: Advanced Features Integration', () => {
  describe('Priority Queue with Cost Prediction', () => {
    it('queues premium users ahead of standard', () => {
      const queue = new RequestPriorityQueue();
      const standard = {
        operationId: 'op1',
        userId: 'u1',
        slaTier: 'standard' as const,
        criticality: 'low' as const,
      };
      const premium = {
        operationId: 'op2',
        userId: 'u2',
        slaTier: 'premium' as const,
        criticality: 'low' as const,
      };

      queue.enqueue(standard);
      queue.enqueue(premium);

      const first = queue.dequeue();
      expect(first?.operationId).toBe('op2'); // Premium first
    });
  });

  describe('Cost Prediction with Budget Alerts', () => {
    it('predicts costs and alerts on budget usage', () => {
      const predictor = new CostPredictor();

      for (let i = 0; i < 10; i++) {
        predictor.recordCost('email_analysis', 0.005);
      }

      const predicted = predictor.predictCost('email_analysis');
      expect(predicted).toBeGreaterThan(0);

      // Record more costs
      for (let i = 0; i < 9; i++) {
        predictor.recordCost('email_analysis', 0.005);
      }

      const dailyBudget = 1;
      const usage = predictor.getBudgetUsagePercent(dailyBudget);
      expect(usage).toBeGreaterThan(0);
    });
  });

  describe('Retry Manager with Observability', () => {
    it('classifies errors and tracks retries', () => {
      const retryManager = new RetryManager();
      const metrics = new ObservabilityMetrics();

      const error = new Error('timeout');
      const errorType = retryManager.classifyError(error);
      expect(errorType).toBe('transient');

      if (retryManager.canRetry(errorType, 0)) {
        retryManager.recordAttempt('op1', errorType, 100);
        metrics.recordOperationFailure('email_analysis', 'timeout');
      }

      const history = retryManager.getRetryHistory('op1');
      expect(history?.attempts).toBe(1);
    });
  });

  describe('End-to-End Workflow', () => {
    it('executes complete Phase 5 workflow', () => {
      const queue = new RequestPriorityQueue();
      const predictor = new CostPredictor();
      const metrics = new ObservabilityMetrics();

      // 1. Enqueue operation with priority
      const operation = {
        operationId: 'op1',
        userId: 'user123',
        slaTier: 'premium' as const,
        criticality: 'high' as const,
      };
      queue.enqueue(operation);

      // 2. Predict cost
      predictor.recordCost('email_analysis', 0.005);
      const predictedCost = predictor.predictCost('email_analysis');
      expect(predictedCost).toBeGreaterThan(0);

      // 3. Execute and record metrics
      metrics.recordOperationSuccess('email_analysis', 150);

      // 4. Check SLA compliance
      const compliance = metrics.getSLACompliance('premium');
      expect(compliance).toBe(1.0); // All operations successful

      // Verify queue
      const dequeued = queue.dequeue();
      expect(dequeued?.operationId).toBe('op1');
    });
  });
});
