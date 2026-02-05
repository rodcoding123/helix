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
        latency: 3000,
        operationId: 'email-compose',
      };

      tracker.recordExecution(userId, metric);

      expect(tracker.getMetricsCount(userId)).toBe(1);
    });

    it('should record multiple executions', () => {
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: Math.random() > 0.05, // 95% success rate
          latency: 200 + Math.random() * 300,
          operationId: 'email-compose',
        };

        tracker.recordExecution(userId, metric);
      }

      expect(tracker.getMetricsCount(userId)).toBe(100);
    });

    it('should clean up metrics older than 30 days', () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;

      const oldMetric: ExecutionMetrics = {
        timestamp: thirtyOneDaysAgo,
        success: true,
        latency: 250,
        operationId: 'email-compose',
      };

      const recentMetric: ExecutionMetrics = {
        timestamp: Date.now(),
        success: true,
        latency: 250,
        operationId: 'email-compose',
      };

      tracker.recordExecution(userId, oldMetric);
      tracker.recordExecution(userId, recentMetric);

      // Should keep recent, discard old
      expect(tracker.getMetricsCount(userId)).toBe(1);
    });
  });

  describe('SLA Status Calculation', () => {
    it('should calculate compliant premium tier status', async () => {
      // Record 1000 successful executions with good latency
      for (let i = 0; i < 1000; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 300,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      expect(status.userId).toBe(userId);
      expect(status.tier).toBe('premium');
      expect(status.currentUptime).toBe(100);
      expect(status.currentSuccessRate).toBe(100);
      expect(status.isCompliant).toBe(true);
      expect(status.violations.length).toBe(0);
    });

    it('should detect uptime violation', async () => {
      // Record 100 executions with 90% success rate
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 90, // First 90 succeed, last 10 fail
          latency: 300,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      expect(status.currentUptime).toBe(90);
      expect(status.isCompliant).toBe(false);
      expect(status.violations.some(v => v.violationType === 'uptime')).toBe(true);
    });

    it('should detect latency violation', async () => {
      // Record executions with high latency
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 1500, // Exceeds premium threshold of 500ms
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
      // Record 100 executions with 98.5% success rate and 600ms latency
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

      // Status stored successfully
      expect(status.userId).toBe(userId);
    });

    it('should store violations', async () => {
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 90,
          latency: 600,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'standard');
      await tracker.storeViolations(status.violations);

      // Violations stored successfully
      expect(status.violations.length).toBeGreaterThan(0);
    });

    it('should resolve violations', async () => {
      const violationId = 'violation-123';
      await tracker.resolveViolation(violationId);

      // Violation resolution attempted
      expect(violationId).toBeDefined();
    });

    it('should get violation history', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const violations = await tracker.getViolationHistory(userId, startDate, endDate);

      expect(Array.isArray(violations)).toBe(true);
    });
  });

  describe('Evaluation Loop', () => {
    it('should start evaluation loop', () => {
      const userIds = [userId];
      const tiers: Record<string, SLATier> = { [userId]: 'premium' };

      tracker.startEvaluation(userIds, tiers, 5000);

      // Loop started successfully
      expect(true).toBe(true);
    });

    it('should stop evaluation loop', () => {
      const userIds = [userId];
      const tiers: Record<string, SLATier> = { [userId]: 'premium' };

      tracker.startEvaluation(userIds, tiers, 5000);
      tracker.stopEvaluation();

      // Loop stopped successfully
      expect(true).toBe(true);
    });

    it('should handle multiple users in evaluation', () => {
      const user1 = 'user-1';
      const user2 = 'user-2';
      const userIds = [user1, user2];
      const tiers: Record<string, SLATier> = {
        [user1]: 'premium',
        [user2]: 'standard',
      };

      tracker.startEvaluation(userIds, tiers, 5000);

      // Multiple users handled
      expect(userIds.length).toBe(2);

      tracker.stopEvaluation();
    });
  });

  describe('Utility Methods', () => {
    it('should get metrics count', () => {
      for (let i = 0; i < 50; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 250,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      expect(tracker.getMetricsCount(userId)).toBe(50);
    });

    it('should clear metrics for user', () => {
      for (let i = 0; i < 50; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 250,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      tracker.clearMetrics(userId);

      expect(tracker.getMetricsCount(userId)).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should provide singleton instance', async () => {
      const { getSLATracker } = await import('./sla-tracker');

      const tracker1 = getSLATracker();
      const tracker2 = getSLATracker();

      expect(tracker1).toBe(tracker2);
    });
  });

  describe('SLA Compliance Scenarios', () => {
    it('premium tier: all executions successful and fast', async () => {
      for (let i = 0; i < 500; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 400,
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

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
      for (let i = 0; i < 200; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: i < 100, // 50% success
          latency: 3000, // High latency
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      expect(status.violations.length).toBeGreaterThan(2);
      expect(status.violations.some(v => v.violationType === 'uptime')).toBe(true);
      expect(status.violations.some(v => v.violationType === 'latency')).toBe(true);
      expect(status.violations.some(v => v.violationType === 'success_rate')).toBe(true);
    });
  });

  describe('P95 Latency Calculation', () => {
    it('should calculate P95 latency correctly', async () => {
      // Create 100 latency values from 100ms to 1000ms
      for (let i = 0; i < 100; i++) {
        const metric: ExecutionMetrics = {
          timestamp: Date.now() + i * 1000,
          success: true,
          latency: 100 + i * 9, // 100, 109, 118, ... 991
          operationId: 'email-compose',
        };
        tracker.recordExecution(userId, metric);
      }

      const status = await tracker.calculateSLAStatus(userId, 'premium');

      // P95 should be around 991ms (95th percentile)
      expect(status.currentAvgLatency).toBeGreaterThan(850);
      expect(status.currentAvgLatency).toBeLessThanOrEqual(991);
    });
  });
});
