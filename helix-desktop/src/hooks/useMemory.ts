import { useState, useCallback } from 'react';
import { invoke } from '../lib/tauri-compat';

export interface MemoryEntry {
  id: string;
  entityType: string;
  name: string;
  observations: string[];
  createdAt: string;
  updatedAt: string;
  relations?: {
    from: string;
    to: string;
    relationType: string;
  }[];
}

export interface MemoryStats {
  totalEntities: number;
  totalObservations: number;
  totalRelations: number;
  entityTypes: Record<string, number>;
  lastUpdated: string | null;
}

export interface MemorySearchResult {
  entries: MemoryEntry[];
  totalCount: number;
  query: string;
}

/**
 * Hook for searching and managing memory entries
 * Uses Tauri invoke for memory operations
 */
export function useMemory() {
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MemoryEntry[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Search memory entries by query
   */
  const search = useCallback(async (query: string): Promise<MemoryEntry[]> => {
    setSearching(true);
    setError(null);

    try {
      const response = await invoke<{ entries: MemoryEntry[] }>('memory_search', { query });
      const entries = response?.entries ?? [];
      setResults(entries);
      return entries;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      return [];
    } finally {
      setSearching(false);
    }
  }, []);

  /**
   * Get memory statistics
   */
  const getStats = useCallback(async (): Promise<MemoryStats | null> => {
    try {
      const response = await invoke<MemoryStats>('memory_stats');
      setStats(response);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get stats';
      setError(message);
      return null;
    }
  }, []);

  /**
   * Delete a memory entry by ID
   */
  const deleteEntry = useCallback(async (id: string): Promise<boolean> => {
    try {
      await invoke('memory_delete', { entityId: id });
      // Remove from local results
      setResults((prev) => prev.filter((entry) => entry.id !== id));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      setError(message);
      return false;
    }
  }, []);

  /**
   * Create a new memory entry
   */
  const createEntry = useCallback(
    async (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry | null> => {
      try {
        const response = await invoke<MemoryEntry>('memory_create', { entry });
        if (response) {
          setResults((prev) => [response, ...prev]);
          return response;
        }
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Create failed';
        setError(message);
        return null;
      }
    },
    []
  );

  /**
   * Add observations to an existing entry
   */
  const addObservations = useCallback(
    async (entityName: string, observations: string[]): Promise<boolean> => {
      try {
        await invoke('memory_add_observations', { entityName, observations });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Add observations failed';
        setError(message);
        return false;
      }
    },
    []
  );

  /**
   * Clear search results
   */
  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    // State
    results,
    stats,
    searching,
    error,

    // Actions
    search,
    getStats,
    deleteEntry,
    createEntry,
    addObservations,
    clearResults,
  };
}
