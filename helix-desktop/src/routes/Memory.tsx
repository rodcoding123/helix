import { useState, useCallback } from 'react';
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
 */
export default function Memory() {
  const [entries, setEntries] = useState<MemoryListEntry[]>(PLACEHOLDER_MEMORY_ENTRIES);
  const [selectedEntry, setSelectedEntry] = useState<MemoryListEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const handleSearch = useCallback(async (query: string, filters: MemoryFilter) => {
    setLoading(true);
    try {
      // TODO: Connect to actual memory API via gateway
      // For now, filter placeholder data
      await new Promise(resolve => setTimeout(resolve, 300));

      let filtered = PLACEHOLDER_MEMORY_ENTRIES;

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

  const handleDelete = async (id: string) => {
    // TODO: Implement delete via API
    console.log('Delete memory:', id);
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
