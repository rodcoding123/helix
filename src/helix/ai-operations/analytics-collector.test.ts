import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsCollector } from './analytics-collector';

describe('AnalyticsCollector', () => {
  let collector: AnalyticsCollector;

  beforeEach(() => {
    collector = new AnalyticsCollector();
  });

  it('should capture operation start events', () => {
    collector.captureEvent('operation_start', {
      operationId: 'op1',
      userId: 'user1',
      operationType: 'gpt-4',
    });

    const events = collector.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('operation_start');
  });

  it('should capture operation complete events', () => {
    collector.captureEvent('operation_complete', {
      operationId: 'op1',
      userId: 'user1',
      operationType: 'gpt-4',
      latencyMs: 150,
      costUsd: 0.5,
      success: true,
    });

    const events = collector.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].success).toBe(true);
  });

  it('should capture operation failed events', () => {
    collector.captureEvent('operation_failed', {
      operationId: 'op1',
      userId: 'user1',
      operationType: 'gpt-4',
      errorMessage: 'Rate limit exceeded',
    });

    const events = collector.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].errorMessage).toBe('Rate limit exceeded');
  });

  it('should filter events by user', () => {
    collector.captureEvent('operation_start', {
      operationId: 'op1',
      userId: 'user1',
      operationType: 'gpt-4',
    });
    collector.captureEvent('operation_start', {
      operationId: 'op2',
      userId: 'user2',
      operationType: 'gpt-4',
    });

    const user1Events = collector.getEventsByUser('user1');
    expect(user1Events).toHaveLength(1);
    expect(user1Events[0].userId).toBe('user1');
  });

  it('should filter events by operation type', () => {
    collector.captureEvent('operation_start', {
      operationId: 'op1',
      userId: 'user1',
      operationType: 'gpt-4',
    });
    collector.captureEvent('operation_start', {
      operationId: 'op2',
      userId: 'user1',
      operationType: 'claude-3',
    });

    const gpt4Events = collector.getEventsByOperationType('gpt-4');
    expect(gpt4Events).toHaveLength(1);
    expect(gpt4Events[0].operationType).toBe('gpt-4');
  });

  it('should aggregate events by hour', () => {
    const now = Date.now();

    // Add two events at the same hour
    collector.captureEvent('operation_complete', {
      operationId: 'op1',
      userId: 'user1',
      operationType: 'gpt-4',
      latencyMs: 100,
      costUsd: 0.5,
      success: true,
    });
    collector.captureEvent('operation_complete', {
      operationId: 'op2',
      userId: 'user1',
      operationType: 'gpt-4',
      latencyMs: 200,
      costUsd: 0.75,
      success: true,
    });

    const hourly = collector.getHourlyAggregation();
    const currentHour = Math.floor(now / (60 * 60 * 1000));

    expect(hourly[currentHour]).toBeDefined();
    expect(hourly[currentHour].eventCount).toBe(2);
    expect(hourly[currentHour].totalLatencyMs).toBe(300);
    expect(hourly[currentHour].totalCostUsd).toBe(1.25);
  });

  it('should accumulate cost by operation type in aggregation', () => {
    collector.captureEvent('operation_complete', {
      operationId: 'op1',
      userId: 'user1',
      operationType: 'gpt-4',
      latencyMs: 100,
      costUsd: 0.5,
      success: true,
    });
    collector.captureEvent('operation_complete', {
      operationId: 'op2',
      userId: 'user1',
      operationType: 'claude-3',
      latencyMs: 200,
      costUsd: 0.75,
      success: true,
    });

    const hourly = collector.getHourlyAggregation();
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));

    expect(hourly[currentHour].costByType['gpt-4']).toBe(0.5);
    expect(hourly[currentHour].costByType['claude-3']).toBe(0.75);
  });

  it('should clear all events', () => {
    collector.captureEvent('operation_start', {
      operationId: 'op1',
      userId: 'user1',
      operationType: 'gpt-4',
    });
    collector.clear();

    const events = collector.getEvents();
    expect(events).toHaveLength(0);
  });
});
