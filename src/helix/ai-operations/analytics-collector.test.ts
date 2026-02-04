import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsCollector } from './analytics-collector.js';

describe('AnalyticsCollector', () => {
  let collector: AnalyticsCollector;

  beforeEach(() => {
    collector = new AnalyticsCollector();
  });

  describe('Event Capture', () => {
    it('captures operation_start event', () => {
      collector.captureEvent('operation_start', {
        operationId: 'op_123',
        userId: 'user_123',
        operationType: 'email_analysis',
      });

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('operation_start');
    });

    it('captures operation_complete event', () => {
      collector.captureEvent('operation_complete', {
        operationId: 'op_123',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 245,
        costUsd: 0.005,
        success: true,
      });

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('operation_complete');
    });

    it('captures operation_failed event', () => {
      collector.captureEvent('operation_failed', {
        operationId: 'op_123',
        userId: 'user_123',
        operationType: 'email_analysis',
        errorMessage: 'Timeout',
      });

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('operation_failed');
    });
  });

  describe('Time-Series Data', () => {
    it('aggregates events by hour', () => {
      for (let i = 0; i < 10; i++) {
        collector.captureEvent('operation_complete', {
          operationId: `op_${i}`,
          userId: 'user_123',
          operationType: 'email_analysis',
          latencyMs: 100 + i * 10,
          costUsd: 0.005,
          success: true,
        });
      }

      const hourly = collector.getHourlyAggregation();
      expect(hourly.totalEvents).toBe(10);
      expect(hourly.avgLatencyMs).toBeGreaterThan(100);
    });
  });

  describe('Custom Dimensions', () => {
    it('filters events by user', () => {
      collector.captureEvent('operation_complete', {
        operationId: 'op_1',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 100,
        costUsd: 0.005,
        success: true,
      });

      collector.captureEvent('operation_complete', {
        operationId: 'op_2',
        userId: 'user_456',
        operationType: 'email_analysis',
        latencyMs: 150,
        costUsd: 0.005,
        success: true,
      });

      const user123Events = collector.getEventsByUser('user_123');
      expect(user123Events).toHaveLength(1);
      expect(user123Events[0].userId).toBe('user_123');
    });

    it('filters events by operation type', () => {
      collector.captureEvent('operation_complete', {
        operationId: 'op_1',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 100,
        costUsd: 0.005,
        success: true,
      });

      collector.captureEvent('operation_complete', {
        operationId: 'op_2',
        userId: 'user_123',
        operationType: 'video_analysis',
        latencyMs: 500,
        costUsd: 0.05,
        success: true,
      });

      const emailEvents = collector.getEventsByOperationType('email_analysis');
      expect(emailEvents).toHaveLength(1);
      expect(emailEvents[0].operationType).toBe('email_analysis');
    });
  });

  describe('Success Rate Calculation', () => {
    it('calculates success rate', () => {
      collector.captureEvent('operation_complete', {
        operationId: 'op_1',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 100,
        costUsd: 0.005,
        success: true,
      });

      collector.captureEvent('operation_failed', {
        operationId: 'op_2',
        userId: 'user_123',
        operationType: 'email_analysis',
        errorMessage: 'Timeout',
      });

      collector.captureEvent('operation_complete', {
        operationId: 'op_3',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 150,
        costUsd: 0.005,
        success: true,
      });

      const hourly = collector.getHourlyAggregation();
      expect(hourly.successRate).toBeCloseTo(0.666, 2); // 2 successes out of 3
    });
  });

  describe('Clear', () => {
    it('clears all events', () => {
      collector.captureEvent('operation_complete', {
        operationId: 'op_123',
        userId: 'user_123',
        operationType: 'email_analysis',
        latencyMs: 100,
        costUsd: 0.005,
        success: true,
      });

      collector.clear();
      const events = collector.getEvents();
      expect(events).toHaveLength(0);
    });
  });
});
