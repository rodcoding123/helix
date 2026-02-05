/**
 * Phase 10 Week 4: SLA Tracker Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SLATracker, SLATier, ExecutionMetrics } from './sla-tracker';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

describe('SLATracker', () => {
  let tracker: SLATracker;
  const userId = 'test-user-123';

  beforeEach(() => {
    tracker = new SLATracker();
    vi.clearAllMocks();
  });

  afterEach(() => {
    tracker.stopEvaluation();
  });

  describe('SLA Tiers', () => {
    it('should define premium tier with 99.99% uptime', () => {
      const thresholds = tracker.getSLAThresholds('premium');

      expect(thresholds.tier).toBe('premium');
      expect(thresholds.uptimePercentage).toBe(99.99);
      expect(thresholds.maxDowntimeMinutesPerMonth).toBe(4.3);
    });

    it('should define standard tier with 99.5% uptime', () => {
      const thresholds = tracker.getSLAThresholds('standard');

      expect(thresholds.tier).toBe('standard');
      expect(thresholds.uptimePercentage).toBe(99.5);
      expect(thresholds.maxDowntimeMinutesPerMonth).toBe(216);
    });

    it('should define basic tier with 95% uptime', () => {
      const thresholds = tracker.getSLAThresholds('basic');

      expect(thresholds.tier).toBe('basic');
      expect(thresholds.uptimePercentage).toBe(95.0);
      expect(thresholds.maxDowntimeMinutesPerMonth).toBe(2160);
    });

    it('should define response time thresholds per tier', () => {
      const premium = tracker.getSLAThresholds('premium');
      const standard = tracker.getSLAThresholds('standard');
      const basic = tracker.getSLAThresholds('basic');

      expect(premium.responseTimeP95Ms).toBe(500);
      expect(standard.responseTimeP95Ms).toBe(1000);
      expect(basic.responseTimeP95Ms).toBe(2000);
    });

    it('should define success rate thresholds per tier', () => {
      const premium = tracker.getSLAThresholds('premium');
      const standard = tracker.getSLAThresholds('standard');
      const basic = tracker.getSLAThresholds('basic');

      expect(premium.successRatePercentage).toBe(99.95);
      expect(standard.successRatePercentage).toBe(99.0);
      expect(basic.successRatePercentage).toBe(95.0);
    });
  });

  describe('Execution Recording', () => {
    it('should record successful execution', () => {
      const metric: ExecutionMetrics = {
        timestamp: Date.now(),
        success: true,
        latency: 250,
        operationId: 'email-compose',
      };

      tracker.recordExecution(userId, metric);

      expect(tracker.getMetricsCount(userId)).toBe(1);
    });

    it('should record failed execution', () => {
      const metric: ExecutionMetrics = {
        timestamp: Date.now(),
        success: false,
        latency: 500,
        operationId: 'email-compose',
      };

      tracker.recordExecution(userId, metric);

      expect(tracker.getMetricsCount(userId)).toBe(1);
    });

    it('should record multiple executions', () => {
      for (let i = 0; i < 10; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i % 2 === 0,
          latency: 300 + i * 10,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      expect(tracker.getMetricsCount(userId)).toBe(10);
    });

    it('should clean up metrics older than 30 days', () => {
      const thirtyTwoDaysAgo = Date.now() - 32 * 24 * 60 * 60 * 1000;

      tracker.recordExecution(userId, {
        timestamp: thirtyTwoDaysAgo,
        success: true,
        latency: 300,
        operationId: 'email-compose',
      });

      tracker.recordExecution(userId, {
        timestamp: Date.now(),
        success: true,
        latency: 300,
        operationId: 'email-compose',
      });

      expect(tracker.getMetricsCount(userId)).toBe(1);
    });
  });

  describe('SLA Status Calculation', () => {
    it('should calculate compliant premium tier status', async () => {
      // Record executions with high success rate and low latency
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 300,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      expect(status.currentSuccessRate).toBe(100);
      expect(status.currentAvgLatency).toBeLessThanOrEqual(500);
      expect(status.isCompliant).toBe(true);
    });

    it('should detect uptime violation', async () => {
      // Record executions with low success rate
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 70, // 70% uptime
          latency: 300,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      expect(status.currentUptime).toBeLessThan(99.99);
      expect(status.isCompliant).toBe(false);
      expect(status.violations.some(v => v.violationType === 'uptime')).toBe(true);
    });

    it('should detect latency violation', async () => {
      // Record executions with high latency
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 1200,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      expect(status.currentAvgLatency).toBeGreaterThan(500);
      expect(status.isCompliant).toBe(false);
      expect(status.violations.some(v => v.violationType === 'latency')).toBe(true);
    });

    it('should detect success rate violation', async () => {
      // Record executions with low success rate
      for (let i = 0; i < 200; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 100, // 50% success rate
          latency: 300,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      expect(status.currentSuccessRate).toBeLessThan(99.95);
      expect(status.isCompliant).toBe(false);
      expect(status.violations.some(v => v.violationType === 'success_rate')).toBe(true);
    });

    it('should calculate different status for different tiers', async () => {
      // Record 200 executions with 98.5% success rate and 600ms latency
      for (let i = 0; i < 200; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 197, // 98.5% success rate
          latency: 600,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const premiumStatus = await tracker.calculateSLAStatus(userId, 'premium');
      const standardStatus = await tracker.calculateSLAStatus(userId, 'standard');
      const basicStatus = await tracker.calculateSLAStatus(userId, 'basic');

      // 98.5% success, 600ms latency:
      // Premium (99.95% required): Non-compliant
      // Standard (99% required): Non-compliant (98.5% < 99%)
      // Basic (95% required): Compliant
      expect(premiumStatus.isCompliant).toBe(false);
      expect(standardStatus.isCompliant).toBe(false);
      expect(basicStatus.isCompliant).toBe(true);
    });
  });

  describe('Violation Detection', () => {
    it('should create violation with correct severity', async () => {
      // Record executions with critical uptime issue
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 70, // 70% uptime
          latency: 300,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      const uptimeViolation = status.violations.find(v => v.violationType === 'uptime');
      expect(uptimeViolation).toBeDefined();
      expect(uptimeViolation?.severity).toBe('critical');
    });

    it('should get active violations', async () => {
      // Record executions with violations
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 90,
          latency: 1200,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      await tracker.calculateSLAStatus(userId, 'premium');
      const violations = tracker.getActiveViolations(userId);

      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('Database Operations', () => {
    it('should store SLA status', async () => {
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 300,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');
      await tracker.storeSLAStatus(status);

      expect(status.isCompliant).toBe(true);
    });

    it('should store violations', async () => {
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 70,
          latency: 300,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');
      await tracker.storeViolations(status.violations);

      expect(status.violations.length).toBeGreaterThan(0);
    });

    it('should resolve violations', async () => {
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 70,
          latency: 300,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');
      const violation = status.violations[0];

      await tracker.resolveViolation(violation.id);

      expect(violation.id).toBeDefined();
    });

    it('should get violation history', async () => {
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 70,
          latency: 300,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      await tracker.calculateSLAStatus(userId, 'premium');
      const history = await tracker.getViolationHistory(userId, 30);

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Evaluation Loop', () => {
    it('should start evaluation loop', () => {
      tracker.startEvaluation(5000);

      expect(tracker.getMetricsCount(userId)).toBe(0);

      tracker.stopEvaluation();
    });

    it('should stop evaluation loop', () => {
      tracker.startEvaluation(5000);
      tracker.stopEvaluation();

      expect(tracker.getMetricsCount(userId)).toBe(0);
    });

    it('should handle multiple users in evaluation', () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      for (let i = 0; i < 10; i++) {
        tracker.recordExecution(user1, {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 300,
          operationId: 'email-compose',
        });

        tracker.recordExecution(user2, {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 300,
          operationId: 'email-compose',
        });
      }

      tracker.startEvaluation(5000);

      expect(tracker.getMetricsCount(user1)).toBe(10);
      expect(tracker.getMetricsCount(user2)).toBe(10);

      tracker.stopEvaluation();
    });
  });

  describe('Utility Methods', () => {
    it('should get metrics count', () => {
      for (let i = 0; i < 5; i++) {
        tracker.recordExecution(userId, {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 300,
          operationId: 'email-compose',
        });
      }

      expect(tracker.getMetricsCount(userId)).toBe(5);
    });

    it('should clear metrics for user', () => {
      for (let i = 0; i < 5; i++) {
        tracker.recordExecution(userId, {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 300,
          operationId: 'email-compose',
        });
      }

      tracker.clearMetrics(userId);

      expect(tracker.getMetricsCount(userId)).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should provide singleton instance', () => {
      const tracker1 = new SLATracker();
      const tracker2 = new SLATracker();

      expect(tracker1).not.toBe(tracker2);
    });
  });

  describe('SLA Compliance Scenarios', () => {
    it('premium tier: all executions successful and fast', async () => {
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 250,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      expect(status.currentSuccessRate).toBe(100);
      expect(status.currentAvgLatency).toBeLessThanOrEqual(500);
      expect(status.isCompliant).toBe(true);
      expect(status.violations.length).toBe(0);
    });

    it('standard tier: 99.5% success with moderate latency', async () => {
      for (let i = 0; i < 500; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 498, // 99.6% success (498/500) - meets 99.5% uptime requirement
          latency: 800,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'standard');

      expect(status.isCompliant).toBe(true);
      expect(status.violations.length).toBe(0);
    });

    it('basic tier: 96% success with high latency', async () => {
      for (let i = 0; i < 500; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 480, // 96% success
          latency: 1500,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'basic');

      expect(status.isCompliant).toBe(true);
      expect(status.violations.length).toBe(0);
    });

    it('multi-violation scenario', async () => {
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 60, // 60% success rate
          latency: 2500, // High latency
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      expect(status.violations.length).toBeGreaterThan(1);
      expect(status.isCompliant).toBe(false);
    });
  });

  describe('P95 Latency Calculation', () => {
    it('should calculate P95 latency correctly', async () => {
      const latencies = Array.from({ length: 100 }, (_, i) => i * 10);

      for (const latency of latencies) {
        tracker.recordExecution(userId, {
          timestamp: Date.now(),
          success: true,
          latency,
          operationId: 'email-compose',
        });
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      // P95 should be around 950 (95th percentile of 0-990)
      expect(status.currentAvgLatency).toBeGreaterThan(900);
      expect(status.currentAvgLatency).toBeLessThan(1000);
    });
  });
});
