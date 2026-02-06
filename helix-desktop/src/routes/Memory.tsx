import { useState, useCallback, useEffect } from 'react';
import { useGateway } from '../hooks/useGateway';
import {
  MemorySearch,
  MemoryList,
  MemoryDetail,
  MemoryStats,
  PLACEHOLDER_MEMORY_ENTRIES,
  PLACEHOLDER_MEMORY_STATS,
  type MemoryListEntry,
  type MemoryFilter,
} from '../components/memory';
import './Memory.css';

/**
 * Memory route - browse and search memory entries from the knowledge graph
 * Uses gateway memory.* API when connected, falls back to placeholder data
 */
export default function Memory() {
  const { getClient } = useGateway();
  const [entries, setEntries] = useState<MemoryListEntry[]>(PLACEHOLDER_MEMORY_ENTRIES);
  const [selectedEntry, setSelectedEntry] = useState<MemoryListEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const handleSearch = useCallback(async (query: string, filters: MemoryFilter) => {
    setLoading(true);
    try {
      const client = getClient();
      let filtered = PLACEHOLDER_MEMORY_ENTRIES;

      // Try to use gateway API if connected
      if (client?.connected) {
        try {
          const result = await client.request<{ entries: MemoryListEntry[] }>('memory.search', {
            query: query.trim(),
            filters: {
              type: filters.type,
              tags: filters.tags,
              minScore: filters.minRelevance,
            },
          });

          if (result && typeof result === 'object' && 'entries' in result) {
            const entries = result as { entries: MemoryListEntry[] };
            filtered = entries.entries;
            setEntries(filtered);
            setSelectedEntry(null);
            return;
          }
        } catch (apiErr) {
          // Fall back to placeholder data if API fails
          console.debug('[memory-search] gateway API failed, using placeholder data:', apiErr);
        }
      }

      // Fallback: filter placeholder data locally
      await new Promise(resolve => setTimeout(resolve, 300));

      // Apply query filter
      if (query.trim()) {
        const queryLower = query.toLowerCase();
        filtered = filtered.filter(entry =>
          entry.content.toLowerCase().includes(queryLower) ||
          entry.tags?.some(tag => tag.toLowerCase().includes(queryLower))
        );
      }

      // Apply type filter
      if (filters.type) {
        filtered = filtered.filter(entry => entry.type === filters.type);
      }

      // Apply tag filter
      if (filters.tags && filters.tags.length > 0) {
        filtered = filtered.filter(entry =>
          filters.tags!.some(tag => entry.tags?.includes(tag))
        );
      }

      // Apply relevance filter
      if (filters.minRelevance !== undefined) {
        filtered = filtered.filter(entry =>
          (entry.score || 0) >= filters.minRelevance!
        );
      }

      setEntries(filtered);
      setSelectedEntry(null);
    } catch (error) {
      console.error('Memory search failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial entries on mount and when gateway connects
  useEffect(() => {
    const client = getClient();
    if (client?.connected) {
      // Trigger search with empty query to load all/recent entries
      void handleSearch('', { tags: [] });
    }
  }, [getClient, handleSearch]);

  const handleDelete = async (id: string) => {
    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('memory.delete', { entryId: id });
      } catch (err) {
        console.error('[memory-delete] API failed:', err);
      }
    }

    // Optimistic update
    setEntries(prev => prev.filter(e => e.id !== id));
    if (selectedEntry?.id === id) {
      setSelectedEntry(null);
    }
  };

  const availableTags = Array.from(
    new Set(PLACEHOLDER_MEMORY_ENTRIES.flatMap(e => e.tags || []))
  );

  return (
    <div className="memory-page">
      <header className="memory-header">
        <div className="memory-header-content">
          <h1>Memory Browser</h1>
          <p>Search and explore the knowledge graph</p>
        </div>
        <button
          className={`memory-stats-toggle ${showStats ? 'active' : ''}`}
          onClick={() => setShowStats(!showStats)}
        >
          📊 Stats
        </button>
      </header>

      {showStats && (
        <MemoryStats stats={PLACEHOLDER_MEMORY_STATS} />
      )}

      <MemorySearch
        onSearch={handleSearch}
        isLoading={loading}
        availableTypes={['conversation', 'knowledge', 'context']}
        availableTags={availableTags}
      />

      <div className="memory-content">
        <aside className="memory-sidebar">
          <MemoryList
            entries={entries}
            selectedId={selectedEntry?.id}
            onSelect={setSelectedEntry}
            isLoading={loading}
            emptyMessage={
              entries.length === 0
                ? 'No memories match your search'
                : 'Enter a search query to find memories'
            }
          />
        </aside>

        <main className="memory-main">
          <MemoryDetail
            entry={selectedEntry}
            onDelete={handleDelete}
          />
        </main>
      </div>

      <footer className="memory-footer">
        <span>{entries.length} memories</span>
        {selectedEntry && (
          <span className="memory-selected-info">
            Viewing: {selectedEntry.id}
          </span>
        )}
      </footer>
    </div>
  );
}
