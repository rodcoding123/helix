/**
 * Phase 10: React Hook for Metrics Streaming
 * Provides easy integration of real-time metrics in React components
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { getMetricsStreamService, MetricsEvent } from '@/services/monitoring/metrics-stream';
import { useAuth } from './useAuth';

export interface UseMetricsStreamOptions {
  eventTypes?: string[];
  enabled?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Hook for subscribing to real-time metrics events
 */
export function useMetricsStream(
  callback: (event: MetricsEvent) => void,
  options: UseMetricsStreamOptions = {}
) {
  const { user } = useAuth();
  const service = getMetricsStreamService();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const {
    eventTypes = ['*'],
    enabled = true,
    onConnect,
    onDisconnect,
  } = options;

  // Subscribe to metrics events
  useEffect(() => {
    if (!enabled || !user?.id) return;

    const subscribe = async () => {
      try {
        // Connect if not already connected
        if (!service.isConnected()) {
          await service.connect(user.id);
          setIsConnected(true);
          onConnect?.();
        }

        // Subscribe to events
        unsubscribeRef.current = service.subscribeMultiple(
          eventTypes,
          callback
        );
      } catch (error) {
        console.error('[useMetricsStream] Failed to subscribe:', error);
      }
    };

    subscribe();

    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [enabled, user?.id, callback, eventTypes, onConnect, service]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    service.disconnect();
    setIsConnected(false);
    onDisconnect?.();
  }, [service, onDisconnect]);

  return { isConnected, disconnect };
}

/**
 * Hook for aggregating metrics into a dashboard state
 */
export function useMetricsDashboard() {
  const [metrics, setMetrics] = useState({
    totalOperations: 0,
    totalCost: 0,
    errorRate: 0,
    p95Latency: 0,
    recentEvents: [] as MetricsEvent[],
  });

  const handleMetricsEvent = useCallback((event: MetricsEvent) => {
    setMetrics((prev) => {
      const updated = { ...prev };

      // Update recent events
      updated.recentEvents = [event, ...prev.recentEvents.slice(0, 49)];

      // Update aggregated metrics based on event type
      switch (event.type) {
        case 'operation_complete':
          updated.totalOperations += 1;
          if (event.data.cost) {
            updated.totalCost += event.data.cost;
          }
          break;

        case 'error_rate':
          if (typeof event.data.errorRate === 'number') {
            updated.errorRate = event.data.errorRate;
          }
          break;

        case 'latency_update':
          if (typeof event.data.p95Latency === 'number') {
            updated.p95Latency = event.data.p95Latency;
          }
          break;
      }

      return updated;
    });
  }, []);

  const { isConnected } = useMetricsStream(handleMetricsEvent, {
    enabled: true,
  });

  return { metrics, isConnected };
}
