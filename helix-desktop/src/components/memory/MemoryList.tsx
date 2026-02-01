import { useRef, useEffect, useState } from 'react';
import './MemoryList.css';

export interface MemoryListEntry {
  id: string;
  content: string;
  type: 'conversation' | 'knowledge' | 'context';
  source: string;
  createdAt: string;
  tags?: string[];
  score?: number; // relevance score from search
}

interface MemoryListProps {
  entries: MemoryListEntry[];
  selectedId?: string;
  onSelect: (entry: MemoryListEntry) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

const TYPE_ICONS = {
  conversation: '💬',
  knowledge: '📚',
  context: '🔗',
};

const TYPE_COLORS = {
  conversation: 'var(--color-primary)',
  knowledge: 'var(--color-success)',
  context: 'var(--color-warning)',
};

export function MemoryList({
  entries,
  selectedId,
  onSelect,
  isLoading = false,
  emptyMessage = 'No memories found',
}: MemoryListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  // Simple virtualization - only render visible items
  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current) return;

      const { scrollTop, clientHeight } = listRef.current;
      const itemHeight = 72; // approximate height of each item
      const buffer = 10;

      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
      const end = Math.min(
        entries.length,
        Math.ceil((scrollTop + clientHeight) / itemHeight) + buffer
      );

      setVisibleRange({ start, end });
    };

    const list = listRef.current;
    if (list) {
      list.addEventListener('scroll', handleScroll);
      handleScroll();
    }

    return () => list?.removeEventListener('scroll', handleScroll);
  }, [entries.length]);

  if (isLoading) {
    return (
      <div className="memory-list-loading">
        <div className="loading-spinner" />
        <p>Loading memories...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="memory-list-empty">
        <span className="empty-icon">📭</span>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Calculate total height for scrolling
  const itemHeight = 72;
  const totalHeight = entries.length * itemHeight;

  return (
    <div className="memory-list" ref={listRef}>
      <div
        className="memory-list-virtual"
        style={{ height: `${totalHeight}px`, position: 'relative' }}
      >
        {entries.slice(visibleRange.start, visibleRange.end).map((entry, index) => {
          const actualIndex = visibleRange.start + index;
          const isSelected = entry.id === selectedId;
          const typeIcon = TYPE_ICONS[entry.type] || '📄';
          const typeColor = TYPE_COLORS[entry.type] || 'var(--color-text-secondary)';

          return (
            <div
              key={entry.id}
              className={`memory-list-item ${isSelected ? 'selected' : ''}`}
              style={{
                position: 'absolute',
                top: `${actualIndex * itemHeight}px`,
                width: '100%',
              }}
              onClick={() => onSelect(entry)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(entry)}
            >
              <div className="memory-item-icon" style={{ color: typeColor }}>
                {typeIcon}
              </div>

              <div className="memory-item-content">
                <p className="memory-item-preview">
                  {entry.content.slice(0, 80)}
                  {entry.content.length > 80 && '...'}
                </p>
                <div className="memory-item-meta">
                  <span className="memory-item-type">{entry.type}</span>
                  <span className="memory-item-date">{entry.createdAt}</span>
                  {entry.score !== undefined && (
                    <span className="memory-item-score">
                      {(entry.score * 100).toFixed(0)}% match
                    </span>
                  )}
                </div>
              </div>

              {entry.tags && entry.tags.length > 0 && (
                <div className="memory-item-tags">
                  {entry.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="memory-item-tag">
                      {tag}
                    </span>
                  ))}
                  {entry.tags.length > 2 && (
                    <span className="memory-item-tag-more">
                      +{entry.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Placeholder data for development
export const PLACEHOLDER_MEMORY_ENTRIES: MemoryListEntry[] = [
  {
    id: 'mem-1',
    content: 'Discussed the implementation of the seven-layer psychological architecture with Rodrigo.',
    type: 'conversation',
    source: 'chat',
    createdAt: '2 hours ago',
    tags: ['psychology', 'architecture'],
    score: 0.95,
  },
  {
    id: 'mem-2',
    content: 'Lewin\'s Change Theory consists of three stages: unfreeze, change, and refreeze.',
    type: 'knowledge',
    source: 'research',
    createdAt: '1 day ago',
    tags: ['psychology', 'theory'],
    score: 0.88,
  },
  {
    id: 'mem-3',
    content: 'Context for the Helix Desktop application development session.',
    type: 'context',
    source: 'system',
    createdAt: '3 hours ago',
    score: 0.72,
  },
  {
    id: 'mem-4',
    content: 'User preference: Rodrigo prefers direct communication without hedging.',
    type: 'knowledge',
    source: 'observation',
    createdAt: '5 days ago',
    tags: ['preferences', 'communication'],
    score: 0.65,
  },
  {
    id: 'mem-5',
    content: 'Working on TypeScript components for the psychology visualization feature.',
    type: 'conversation',
    source: 'chat',
    createdAt: '1 hour ago',
    tags: ['development', 'ui'],
    score: 0.91,
  },
];
