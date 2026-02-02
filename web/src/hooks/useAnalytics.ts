import { useState, useCallback, useRef } from 'react';
import type { TimeRange, AnalyticsData } from '@/lib/types/analytics';
import { AnalyticsService } from '@/services/analytics';

export function useAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  // Initialize service once (lazy-loaded)
  const serviceRef = useRef<AnalyticsService | null>(null);

  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = new AnalyticsService();
    }
    return serviceRef.current;
  }, []);

  /**
   * Fetch analytics data
   */
  const fetchAnalytics = useCallback(
    async (userId: string, range: TimeRange = '7d'): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const data = await service.getAnalytics(userId, range);
        setAnalyticsData(data);
        setTimeRange(range);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch analytics';
        setError(message);
        console.error('Failed to fetch analytics:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Refresh analytics (clear cache and refetch)
   */
  const refresh = useCallback(
    async (userId: string): Promise<void> => {
      const service = getService();
      service.clearUserCache(userId);
      await fetchAnalytics(userId, timeRange);
    },
    [getService, fetchAnalytics, timeRange]
  );

  /**
   * Change time range
   */
  const changeTimeRange = useCallback(
    async (userId: string, newRange: TimeRange): Promise<void> => {
      await fetchAnalytics(userId, newRange);
    },
    [fetchAnalytics]
  );

  return {
    // State
    analyticsData,
    isLoading,
    error,
    timeRange,

    // Methods
    fetchAnalytics,
    refresh,
    changeTimeRange,
  };
}
