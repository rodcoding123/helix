/**
 * Analytics Collector - Phase 6
 *
 * Captures operation metadata for dashboards and trend analysis.
 */

export interface AnalyticsEvent {
  eventType: 'operation_start' | 'operation_complete' | 'operation_failed';
  operationId: string;
  userId: string;
  operationType: string;
  timestamp: string;
  latencyMs?: number;
  costUsd?: number;
  success?: boolean;
  errorMessage?: string;
}

export interface HourlyAggregation {
  totalEvents: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  totalCostUsd: number;
}

export class AnalyticsCollector {
  private events: AnalyticsEvent[] = [];

  /**
   * Capture analytics event
   */
  captureEvent(
    eventType: 'operation_start' | 'operation_complete' | 'operation_failed',
    data: Omit<AnalyticsEvent, 'eventType' | 'timestamp'>
  ): void {
    this.events.push({
      ...data,
      eventType,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get all events
   */
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Get events by user
   */
  getEventsByUser(userId: string): AnalyticsEvent[] {
    return this.events.filter(e => e.userId === userId);
  }

  /**
   * Get events by operation type
   */
  getEventsByOperationType(operationType: string): AnalyticsEvent[] {
    return this.events.filter(e => e.operationType === operationType);
  }

  /**
   * Get hourly aggregation of metrics
   */
  getHourlyAggregation(): HourlyAggregation {
    const successCount = this.events.filter(e => e.eventType === 'operation_complete').length;
    const failureCount = this.events.filter(e => e.eventType === 'operation_failed').length;
    const totalEvents = successCount + failureCount;

    const latencies = this.events.filter(e => e.latencyMs !== undefined).map(e => e.latencyMs || 0);
    const avgLatencyMs =
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    const totalCostUsd = this.events.reduce((sum, e) => sum + (e.costUsd || 0), 0);

    return {
      totalEvents,
      successCount,
      failureCount,
      successRate: totalEvents === 0 ? 0 : successCount / totalEvents,
      avgLatencyMs,
      totalCostUsd,
    };
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }
}
