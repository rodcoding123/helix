/**
 * AnalyticsCollector
 *
 * Event capture system that tracks operation metrics, aggregates them by time period,
 * and supports filtering and export.
 *
 * Phase 6: Multi-Tenant Support & Advanced API Management
 * Created: 2026-02-04
 */

export type EventType = 'operation_start' | 'operation_complete' | 'operation_failed';

export interface AnalyticsEvent {
  eventType: EventType;
  operationId: string;
  userId: string;
  operationType: string;
  latencyMs?: number;
  costUsd?: number;
  success?: boolean;
  errorMessage?: string;
  timestamp: number;
}

interface HourlyAggregation {
  eventCount: number;
  totalLatencyMs: number;
  totalCostUsd: number;
  costByType: Record<string, number>;
}

/**
 * AnalyticsCollector - Event capture and aggregation system
 *
 * Responsibilities:
 * 1. Capture analytics events (operation_start, operation_complete, operation_failed)
 * 2. Store events in memory for analysis
 * 3. Filter events by user or operation type
 * 4. Aggregate events by hour for performance metrics
 * 5. Export and clear collected data
 */
export class AnalyticsCollector {
  private events: AnalyticsEvent[] = [];

  /**
   * Capture an analytics event
   *
   * @param eventType Type of event (operation_start, operation_complete, operation_failed)
   * @param data Event data including operation details
   */
  captureEvent(
    eventType: EventType,
    data: {
      operationId: string;
      userId: string;
      operationType: string;
      latencyMs?: number;
      costUsd?: number;
      success?: boolean;
      errorMessage?: string;
    }
  ): void {
    const event: AnalyticsEvent = {
      eventType,
      ...data,
      timestamp: Date.now(),
    };
    this.events.push(event);
  }

  /**
   * Get all captured events
   *
   * @returns Array of all events
   */
  getEvents(): AnalyticsEvent[] {
    return this.events;
  }

  /**
   * Get events for a specific user
   *
   * @param userId User identifier
   * @returns Events for that user
   */
  getEventsByUser(userId: string): AnalyticsEvent[] {
    return this.events.filter(event => event.userId === userId);
  }

  /**
   * Get events for a specific operation type
   *
   * @param operationType Operation type (e.g., 'gpt-4', 'claude-3')
   * @returns Events for that operation type
   */
  getEventsByOperationType(operationType: string): AnalyticsEvent[] {
    return this.events.filter(event => event.operationType === operationType);
  }

  /**
   * Get hourly aggregation of analytics
   *
   * Groups events by hour and computes aggregate metrics:
   * - eventCount: Number of events in the hour
   * - totalLatencyMs: Sum of all latencies
   * - totalCostUsd: Sum of all costs
   * - costByType: Costs broken down by operation type
   *
   * @returns Map of hour -> aggregation data
   */
  getHourlyAggregation(): Record<number, HourlyAggregation> {
    const aggregation: Record<number, HourlyAggregation> = {};

    for (const event of this.events) {
      const hour = Math.floor(event.timestamp / (60 * 60 * 1000));

      if (!aggregation[hour]) {
        aggregation[hour] = {
          eventCount: 0,
          totalLatencyMs: 0,
          totalCostUsd: 0,
          costByType: {},
        };
      }

      aggregation[hour].eventCount += 1;

      if (event.latencyMs) {
        aggregation[hour].totalLatencyMs += event.latencyMs;
      }

      if (event.costUsd) {
        aggregation[hour].totalCostUsd += event.costUsd;
        if (!aggregation[hour].costByType[event.operationType]) {
          aggregation[hour].costByType[event.operationType] = 0;
        }
        aggregation[hour].costByType[event.operationType] += event.costUsd;
      }
    }

    return aggregation;
  }

  /**
   * Clear all events
   *
   * Removes all captured events from memory.
   */
  clear(): void {
    this.events = [];
  }
}
