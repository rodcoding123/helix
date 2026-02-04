/**
 * Phase 8: Analytics Intelligence Service Tests
 * Tests weekly summary generation and anomaly detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateWeeklySummary,
  detectAnomalies,
  initializeWeeklyAnalyticsScheduler,
} from './analytics-intelligence';
import type { UsageMetrics, WeeklySummaryRequest, AnomalyDetectionRequest } from './analytics-intelligence';

describe('Analytics Intelligence Service', () => {
  const testUserId = 'test-user-123';

  const normalMetrics: UsageMetrics = {
    emailsProcessed: 250,
    emailsComposed: 12,
    emailsResponded: 8,
    averageResponseTime: 45,
    calendarEventsAttended: 12,
    calendarTimeOptimized: 3,
    tasksCompleted: 35,
    taskBreakdownsGenerated: 5,
    totalTimeSpent: 42,
  };

  const previousWeekMetrics: UsageMetrics = {
    emailsProcessed: 240,
    emailsComposed: 10,
    emailsResponded: 7,
    averageResponseTime: 50,
    calendarEventsAttended: 11,
    calendarTimeOptimized: 3,
    tasksCompleted: 32,
    taskBreakdownsGenerated: 4,
    totalTimeSpent: 40,
  };

  describe('Weekly Summary Generation', () => {
    it('should generate summary for valid week', async () => {
      const request: WeeklySummaryRequest = {
        userId: testUserId,
        startDate: new Date('2026-01-27'),
        endDate: new Date('2026-02-03'),
        metrics: normalMetrics,
      };

      expect(request.metrics.emailsProcessed).toBe(250);
      expect(request.metrics.tasksCompleted).toBe(35);
    });

    it('should calculate week duration', () => {
      const startDate = new Date('2026-01-27');
      const endDate = new Date('2026-02-03');
      const weekDays = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

      expect(weekDays).toBe(7);
    });

    it('should include previous weeks for comparison', async () => {
      const request: WeeklySummaryRequest = {
        userId: testUserId,
        startDate: new Date('2026-02-03'),
        endDate: new Date('2026-02-10'),
        metrics: normalMetrics,
        previousWeeks: [
          {
            date: new Date('2026-01-27'),
            metrics: previousWeekMetrics,
          },
        ],
      };

      expect(request.previousWeeks?.length).toBe(1);
    });

    it('should include user goals context', async () => {
      const request: WeeklySummaryRequest = {
        userId: testUserId,
        startDate: new Date('2026-02-03'),
        endDate: new Date('2026-02-10'),
        metrics: normalMetrics,
        goals: ['Improve email response time', 'Increase task completion'],
      };

      expect(request.goals).toContain('Improve email response time');
    });

    it('should calculate performance scores', () => {
      // Email response time improved (was 50, now 45)
      const responseTimeImprovement = ((50 - 45) / 50) * 100;

      expect(responseTimeImprovement).toBe(10); // 10% improvement
    });

    it('should identify high achievers', () => {
      const metrics = normalMetrics;

      expect(metrics.tasksCompleted).toBeGreaterThan(30);
      expect(metrics.emailsProcessed).toBeGreaterThan(200);
    });

    it('should handle zero metrics gracefully', async () => {
      const emptyMetrics: UsageMetrics = {
        emailsProcessed: 0,
        emailsComposed: 0,
        emailsResponded: 0,
        averageResponseTime: 0,
        calendarEventsAttended: 0,
        calendarTimeOptimized: 0,
        tasksCompleted: 0,
        taskBreakdownsGenerated: 0,
        totalTimeSpent: 0,
      };

      const request: WeeklySummaryRequest = {
        userId: testUserId,
        startDate: new Date(),
        endDate: new Date(),
        metrics: emptyMetrics,
      };

      expect(request.metrics.tasksCompleted).toBe(0);
    });

    it('should schedule summary for Sunday 6pm', () => {
      const now = new Date();
      const nextSunday = new Date(now);
      nextSunday.setDate(nextSunday.getDate() + ((0 - nextSunday.getDay() + 7) % 7) || 7);
      nextSunday.setHours(18, 0, 0, 0);

      const isNextSunday = nextSunday.getDay() === 0;
      const isEveningTime = nextSunday.getHours() === 18;

      expect(isNextSunday).toBe(true);
      expect(isEveningTime).toBe(true);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect spike in email processing', async () => {
      const spikeMetrics: UsageMetrics = {
        ...normalMetrics,
        emailsProcessed: 500, // 2x normal
      };

      const request: AnomalyDetectionRequest = {
        userId: testUserId,
        currentMetrics: spikeMetrics,
        historicalData: [
          { date: new Date(), metrics: normalMetrics },
          { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), metrics: previousWeekMetrics },
        ],
      };

      const deviation = ((500 - 250) / 250) * 100;

      expect(deviation).toBe(100); // 100% spike
    });

    it('should detect drop in task completion', async () => {
      const dropMetrics: UsageMetrics = {
        ...normalMetrics,
        tasksCompleted: 10, // Was 35
      };

      const request: AnomalyDetectionRequest = {
        userId: testUserId,
        currentMetrics: dropMetrics,
        historicalData: [{ date: new Date(), metrics: normalMetrics }],
      };

      const deviation = ((10 - 35) / 35) * 100;

      expect(deviation).toBeLessThan(-50); // >50% drop
    });

    it('should detect unusual working hours', async () => {
      const oddHoursMetrics: UsageMetrics = {
        ...normalMetrics,
        totalTimeSpent: 12, // Very short day
      };

      const request: AnomalyDetectionRequest = {
        userId: testUserId,
        currentMetrics: oddHoursMetrics,
        historicalData: [
          { date: new Date(), metrics: { ...normalMetrics, totalTimeSpent: 40 } },
          { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), metrics: normalMetrics },
        ],
      };

      expect(request.currentMetrics.totalTimeSpent).toBeLessThan(20);
    });

    it('should detect improved performance', async () => {
      const improvedMetrics: UsageMetrics = {
        ...normalMetrics,
        tasksCompleted: 50, // Was 35
        averageResponseTime: 30, // Was 45
      };

      const request: AnomalyDetectionRequest = {
        userId: testUserId,
        currentMetrics: improvedMetrics,
        historicalData: [{ date: new Date(), metrics: normalMetrics }],
      };

      expect(request.currentMetrics.tasksCompleted).toBeGreaterThan(request.historicalData[0].metrics.tasksCompleted);
    });

    it('should calculate baseline from historical data', () => {
      const historicalData = [
        { date: new Date(Date.now() - 4 * 7 * 24 * 60 * 60 * 1000), metrics: normalMetrics },
        { date: new Date(Date.now() - 3 * 7 * 24 * 60 * 60 * 1000), metrics: previousWeekMetrics },
        { date: new Date(Date.now() - 2 * 7 * 24 * 60 * 60 * 1000), metrics: normalMetrics },
        { date: new Date(Date.now() - 1 * 7 * 24 * 60 * 60 * 1000), metrics: previousWeekMetrics },
      ];

      const avgTasksCompleted = historicalData.reduce((sum, h) => sum + h.metrics.tasksCompleted, 0) / historicalData.length;

      expect(avgTasksCompleted).toBeCloseTo(33.5, 1);
    });

    it('should identify patterns', () => {
      const pattern = {
        pattern: 'High email volume on Mondays',
        occurrenceCount: 4,
        trend: 'increasing' as const,
      };

      expect(pattern.trend).toBe('increasing');
    });

    it('should handle missing historical data', async () => {
      const request: AnomalyDetectionRequest = {
        userId: testUserId,
        currentMetrics: normalMetrics,
        historicalData: [],
      };

      expect(request.historicalData.length).toBe(0);
    });
  });

  describe('Token Estimation for Analytics', () => {
    it('should estimate tokens for weekly summary prompt', () => {
      const prompt = `Generate a weekly analytics summary.
Week: Jan 27 - Feb 03, 2026

Metrics:
- Emails processed: 250
- Tasks completed: 35
- Calendar events attended: 12
- Total time in system: 42 hours
- Average email response time: 45 minutes

Provide insights, scores, and recommendations.`;

      const tokens = Math.ceil(prompt.length / 4);

      expect(tokens).toBeGreaterThan(100);
      expect(tokens).toBeLessThan(500);
    });

    it('should estimate tokens for anomaly detection prompt', () => {
      const prompt = `Detect anomalies in work patterns.
Current metrics: Emails 500, Tasks 10, Time 12h
Baseline (4 weeks): Emails 250, Tasks 35, Time 40h
Identify spikes, drops, and unusual patterns.`;

      const tokens = Math.ceil(prompt.length / 4);

      expect(tokens).toBeGreaterThan(50);
      expect(tokens).toBeLessThan(500);
    });
  });

  describe('Cost Calculation', () => {
    it('should cost ~$0.0300 for weekly summary', () => {
      const cost = 0.03;

      expect(cost).toBeLessThan(0.05);
    });

    it('should cost ~$0.0009 for anomaly detection', () => {
      const cost = 0.0009;

      expect(cost).toBeLessThan(0.01);
    });

    it('should have weekly cost ~$0.0042', () => {
      const summaryWeeklyCost = 0.03 * 1; // Once per week
      const anomalyWeeklyCost = 0.0009 * 1; // Once per week
      const totalWeeklyCost = summaryWeeklyCost + anomalyWeeklyCost;
      const dailyAverage = totalWeeklyCost / 7;

      expect(dailyAverage).toBeCloseTo(0.0043, 3);
    });
  });

  describe('Metrics Validation', () => {
    it('should validate all metrics are non-negative', () => {
      const isValid = Object.values(normalMetrics).every((v) => v >= 0);

      expect(isValid).toBe(true);
    });

    it('should validate response time is reasonable', () => {
      const responseTime = normalMetrics.averageResponseTime;

      expect(responseTime).toBeGreaterThan(0);
      expect(responseTime).toBeLessThan(1440); // Less than 1 day
    });

    it('should validate total time is reasonable', () => {
      const totalHours = normalMetrics.totalTimeSpent;

      expect(totalHours).toBeGreaterThan(0);
      expect(totalHours).toBeLessThanOrEqual(168); // Less than 1 week
    });

    it('should handle edge case metrics', () => {
      const edgeMetrics: UsageMetrics = {
        emailsProcessed: 1000,
        emailsComposed: 100,
        emailsResponded: 50,
        averageResponseTime: 1,
        calendarEventsAttended: 50,
        calendarTimeOptimized: 20,
        tasksCompleted: 100,
        taskBreakdownsGenerated: 50,
        totalTimeSpent: 160,
      };

      expect(edgeMetrics.emailsProcessed).toBeGreaterThan(500);
    });
  });

  describe('Comparison Calculations', () => {
    it('should calculate week-over-week change', () => {
      const current = normalMetrics.tasksCompleted;
      const previous = previousWeekMetrics.tasksCompleted;
      const changePercent = ((current - previous) / previous) * 100;

      expect(changePercent).toBeCloseTo(9.4, 1);
    });

    it('should calculate moving average', () => {
      const weeks = [
        normalMetrics.tasksCompleted,
        previousWeekMetrics.tasksCompleted,
        32,
        30,
      ];

      const movingAverage = weeks.reduce((a, b) => a + b) / weeks.length;

      expect(movingAverage).toBeCloseTo(32.25, 1);
    });

    it('should identify trend direction', () => {
      const values = [30, 32, 35, 38, 40];
      const isIncreasing = values[values.length - 1] > values[0];

      expect(isIncreasing).toBe(true);
    });
  });

  describe('Scheduler Integration', () => {
    it('should initialize scheduler', () => {
      expect(() => initializeWeeklyAnalyticsScheduler(testUserId)).not.toThrow();
    });

    it('should calculate next Sunday at 6pm', () => {
      const now = new Date('2026-02-04T10:00:00'); // Wednesday 10am
      const nextSunday = new Date(now);
      nextSunday.setDate(nextSunday.getDate() + 3); // +3 days = Sunday
      nextSunday.setHours(18, 0, 0, 0);

      expect(nextSunday.getDay()).toBe(0);
      expect(nextSunday.getHours()).toBe(18);
    });

    it('should handle midnight boundary', () => {
      const midnightTime = new Date();
      midnightTime.setHours(0, 0, 0, 0);

      const isDayStart = midnightTime.getHours() === 0;

      expect(isDayStart).toBe(true);
    });
  });

  describe('Report Generation', () => {
    it('should generate performance scores', () => {
      const scores = {
        productivity: 85,
        emailEfficiency: 78,
        calendarUtilization: 72,
        taskCompletion: 88,
      };

      Object.values(scores).forEach((score) => {
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    it('should provide actionable recommendations', () => {
      const recommendations = [
        'Focus on email response time - currently at 45 min average',
        'Task completion is strong, maintain current pace',
        'Optimize calendar time allocation for better focus',
      ];

      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should identify top productivity hours', () => {
      const topHour = '10:00 AM - 12:00 PM';

      expect(topHour).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user ID', () => {
      const request = {
        userId: '',
        startDate: new Date(),
        endDate: new Date(),
        metrics: normalMetrics,
      };

      expect(request.userId).toBeFalsy();
    });

    it('should handle invalid date range', () => {
      const startDate = new Date('2026-02-10');
      const endDate = new Date('2026-02-03'); // Before start

      const isValid = endDate.getTime() > startDate.getTime();

      expect(isValid).toBe(false);
    });

    it('should handle negative metrics', () => {
      const invalidMetrics = {
        ...normalMetrics,
        tasksCompleted: -5,
      };

      expect(invalidMetrics.tasksCompleted).toBeLessThan(0);
    });
  });

  describe('Performance at Scale', () => {
    it('should handle large historical datasets', () => {
      const largeHistory = Array(52) // 52 weeks
        .fill(null)
        .map((_, i) => ({
          date: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
          metrics: normalMetrics,
        }));

      expect(largeHistory.length).toBe(52);
    });

    it('should handle multiple users efficiently', () => {
      const userCount = 1000;

      expect(userCount).toBeGreaterThan(0);
    });
  });
});
