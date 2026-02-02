import { useState, useCallback } from 'react';
import './MemorySearch.css';

export interface MemoryFilter {
  dateRange?: { start: string; end: string };
  type?: string;
  minRelevance?: number;
  tags?: string[];
}

interface MemorySearchProps {
  onSearch: (query: string, filters: MemoryFilter) => void;
  isLoading?: boolean;
  availableTypes?: string[];
  availableTags?: string[];
}

export function MemorySearch({
  onSearch,
  isLoading = false,
  availableTypes = ['conversation', 'knowledge', 'context'],
  availableTags = [],
}: MemorySearchProps) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<MemoryFilter>({});

  const handleSearch = useCallback(() => {
    onSearch(query, filters);
  }, [query, filters, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSearch();
    }
  };

  const updateFilter = <K extends keyof MemoryFilter>(key: K, value: MemoryFilter[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)
  );

  return (
    <div className="memory-search-container">
      <div className="memory-search-main">
        <div className="memory-search-input-wrapper">
          <span className="memory-search-icon">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search memories..."
            className="memory-search-input"
            disabled={isLoading}
          />
          {query && (
            <button
              className="memory-search-clear"
              onClick={() => setQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <button
          className={`memory-filter-toggle ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          title="Toggle filters"
        >
          <span className="filter-icon">⚙️</span>
          {hasActiveFilters && <span className="filter-badge" />}
        </button>

        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="primary-button memory-search-button"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {showFilters && (
        <div className="memory-search-filters">
          <div className="filter-group">
            <label className="filter-label">Type</label>
            <select
              className="filter-select"
              value={filters.type || ''}
              onChange={(e) => updateFilter('type', e.target.value || undefined)}
            >
              <option value="">All types</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Date Range</label>
            <div className="filter-date-range">
              <input
                type="date"
                className="filter-date"
                value={filters.dateRange?.start || ''}
                onChange={(e) =>
                  updateFilter('dateRange', {
                    ...filters.dateRange,
                    start: e.target.value,
                    end: filters.dateRange?.end || '',
                  })
                }
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                className="filter-date"
                value={filters.dateRange?.end || ''}
                onChange={(e) =>
                  updateFilter('dateRange', {
                    ...filters.dateRange,
                    start: filters.dateRange?.start || '',
                    end: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">Min Relevance</label>
            <div className="filter-slider">
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={(filters.minRelevance || 0) * 100}
                onChange={(e) =>
                  updateFilter('minRelevance', parseInt(e.target.value) / 100)
                }
              />
              <span className="filter-slider-value">
                {((filters.minRelevance || 0) * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {availableTags.length > 0 && (
            <div className="filter-group">
              <label className="filter-label">Tags</label>
              <div className="filter-tags">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    className={`filter-tag ${filters.tags?.includes(tag) ? 'active' : ''}`}
                    onClick={() => {
                      const currentTags = filters.tags || [];
                      if (currentTags.includes(tag)) {
                        updateFilter('tags', currentTags.filter((t) => t !== tag));
                      } else {
                        updateFilter('tags', [...currentTags, tag]);
                      }
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <button className="filter-clear" onClick={clearFilters}>
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
