import { useState, useEffect, useCallback } from 'react';
import { getLiveStats } from '@/lib/api';
import type { LiveStats } from '@/lib/types';

interface UseRealtimeReturn {
  stats: LiveStats | null;
  loading: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRealtime(pollInterval = 30000): UseRealtimeReturn {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getLiveStats();
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Poll for updates
    const interval = setInterval(fetchStats, pollInterval);

    return () => clearInterval(interval);
  }, [fetchStats, pollInterval]);

  return {
    stats,
    loading,
    isLoading: loading,
    error,
    refresh: fetchStats,
  };
}

// Alias for backwards compatibility
export const useRealtimeStats = useRealtime;
