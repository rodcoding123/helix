/**
 * Memory Search Panel
 *
 * Advanced memory search with semantic, timeline, and hybrid modes
 * Phase G.2 - Advanced Memory Search
 */

import { useState, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';

type SearchMode = 'semantic' | 'timeline' | 'hybrid';

interface SearchFilters {
  query?: string;
  mode: SearchMode;
  dateRange?: { start: string; end: string };
  salienceMin?: number;
  salienceMax?: number;
  layers?: number[];
  limit?: number;
}

interface SearchResult {
  id: string;
  entityName: string;
  entityType: string;
  observation: string;
  relevanceScore: number;
  salience?: number;
  layer?: number;
  timestamp: string;
}

export function MemorySearchPanel() {
  const { getClient, _connected } = useGateway();
  const [filters, setFilters] = useState<SearchFilters>({
    mode: 'hybrid',
    limit: 50,
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  const handleSearch = useCallback(async () => {
    if (!filters.query && filters.mode !== 'timeline') {
      alert('Please enter a search query');
      return;
    }

    setLoading(true);
    try {
      const client = getClient();
      if (!client?.connected) {
        setLoading(false);
        return;
      }

      const searchResult = (await client.request('memory.search_enhanced', {
        query: filters.query,
        mode: filters.mode,
        dateRange: filters.dateRange,
        salienceMin: filters.salienceMin,
        salienceMax: filters.salienceMax,
        layers: filters.layers,
        limit: filters.limit,
      })) as any;

      if (searchResult?.results) {
        setResults(searchResult.results);
        setTotalResults(searchResult.total || 0);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, getClient]);

  const toggleLayer = (layer: number) => {
    const currentLayers = filters.layers || [];
    const newLayers = currentLayers.includes(layer)
      ? currentLayers.filter(l => l !== layer)
      : [...currentLayers, layer];
    setFilters({ ...filters, layers: newLayers });
  };

  return (
    <div className="memory-search-panel">
      <style>{memorySearchPanelStyles}</style>

      {/* Header */}
      <div className="search-header">
        <h3>Memory Search</h3>
        <p className="subtitle">Search across your memory with semantic and timeline filters</p>
      </div>

      {/* Search Mode Selection */}
      <div className="mode-selector">
        <label className="mode-label">Search Mode</label>
        <div className="mode-buttons">
          {(['semantic', 'timeline', 'hybrid'] as const).map((mode) => (
            <button
              key={mode}
              className={`mode-btn ${filters.mode === mode ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, mode })}
            >
              {mode === 'semantic' && '🔍 Semantic'}
              {mode === 'timeline' && '📅 Timeline'}
              {mode === 'hybrid' && '🔀 Hybrid'}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      {filters.mode !== 'timeline' && (
        <div className="search-input-section">
          <label className="input-label">Search Query</label>
          <input
            type="text"
            placeholder="Ask something about your memories..."
            value={filters.query || ''}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
        </div>
      )}

      {/* Date Range (for timeline) */}
      {filters.mode !== 'semantic' && (
        <div className="date-range-section">
          <label className="input-label">Date Range</label>
          <div className="date-inputs">
            <input
              type="date"
              value={filters.dateRange?.start || ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dateRange: { ...filters.dateRange, start: e.target.value, end: filters.dateRange?.end || '' },
                })
              }
            />
            <span className="to-label">to</span>
            <input
              type="date"
              value={filters.dateRange?.end || ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dateRange: { ...filters.dateRange, end: e.target.value, start: filters.dateRange?.start || '' },
                })
              }
            />
          </div>
        </div>
      )}

      {/* Salience Filter */}
      <div className="filter-section">
        <label className="filter-label">Salience (Importance)</label>
        <div className="salience-sliders">
          <div className="slider-group">
            <label>Min: {filters.salienceMin?.toFixed(2) || '0.00'}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={filters.salienceMin ?? 0}
              onChange={(e) =>
                setFilters({ ...filters, salienceMin: parseFloat(e.target.value) })
              }
            />
          </div>
          <div className="slider-group">
            <label>Max: {filters.salienceMax?.toFixed(2) || '1.00'}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={filters.salienceMax ?? 1}
              onChange={(e) =>
                setFilters({ ...filters, salienceMax: parseFloat(e.target.value) })
              }
            />
          </div>
        </div>
      </div>

      {/* Layer Selection */}
      <div className="filter-section">
        <label className="filter-label">Psychological Layers</label>
        <div className="layer-buttons">
          {[1, 2, 3, 4, 5, 6, 7].map((layer) => (
            <button
              key={layer}
              className={`layer-btn ${filters.layers?.includes(layer) ? 'selected' : ''}`}
              onClick={() => toggleLayer(layer)}
              title={`Layer ${layer}`}
            >
              L{layer}
            </button>
          ))}
        </div>
        <p className="layer-help">
          1=Narrative, 2=Emotional, 3=Relational, 4=Prospective, 5=Integration, 6=Transformation, 7=Purpose
        </p>
      </div>

      {/* Search Button */}
      <div className="search-button-section">
        <button
          className="search-btn"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? '🔍 Searching...' : '🔍 Search Memory'}
        </button>
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <h4>Results ({results.length} of {totalResults})</h4>
          </div>

          <div className="results-list">
            {results.map((result) => (
              <MemoryResultCard key={result.id} result={result} />
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="empty-state">
          <p>No results yet. Try searching or adjusting your filters.</p>
        </div>
      )}
    </div>
  );
}

function MemoryResultCard({ result }: { result: SearchResult }) {
  return (
    <div className="result-card">
      <div className="result-header">
        <div className="result-meta">
          <span className="entity-type">{result.entityType}</span>
          <span className="entity-name">{result.entityName}</span>
        </div>
        <div className="result-scores">
          {result.layer && <span className="layer-badge">L{result.layer}</span>}
          <span className="relevance-score">
            {Math.round(result.relevanceScore * 100)}%
          </span>
        </div>
      </div>

      <p className="result-observation">{result.observation}</p>

      <div className="result-footer">
        <span className="timestamp">
          {new Date(result.timestamp).toLocaleDateString()}
        </span>
        {result.salience && (
          <span className="salience">Salience: {result.salience.toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}

const memorySearchPanelStyles = `
.memory-search-panel {
  padding: 1.5rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.search-header {
  margin-bottom: 1.5rem;
}

.search-header h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.subtitle {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
}

.mode-selector {
  margin-bottom: 1.5rem;
}

.mode-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.75rem;
}

.mode-buttons {
  display: flex;
  gap: 0.75rem;
}

.mode-btn {
  flex: 1;
  padding: 0.75rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 6px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.mode-btn:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.25);
}

.mode-btn.active {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.4);
  color: #818cf8;
}

.search-input-section {
  margin-bottom: 1.5rem;
}

.input-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.5rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 6px;
  color: var(--text-primary, #fff);
  font-size: 0.9rem;
}

.search-input:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.1);
}

.date-range-section {
  margin-bottom: 1.5rem;
}

.date-inputs {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.date-inputs input {
  flex: 1;
  padding: 0.5rem;
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 4px;
  color: var(--text-primary, #fff);
}

.to-label {
  color: var(--text-tertiary, #606080);
  font-size: 0.8125rem;
}

.filter-section {
  margin-bottom: 1.5rem;
}

.filter-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.75rem;
}

.salience-sliders {
  display: flex;
  gap: 1rem;
}

.slider-group {
  flex: 1;
}

.slider-group label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  margin-bottom: 0.5rem;
}

.slider-group input {
  width: 100%;
}

.layer-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.layer-btn {
  width: 36px;
  padding: 0.5rem;
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 4px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.75rem;
  transition: all 0.2s ease;
}

.layer-btn:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
}

.layer-btn.selected {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.4);
  color: #818cf8;
}

.layer-help {
  margin: 0;
  font-size: 0.7rem;
  color: var(--text-tertiary, #606080);
}

.search-button-section {
  margin-bottom: 1.5rem;
}

.search-btn {
  width: 100%;
  padding: 0.875rem;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.search-btn:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.search-btn:disabled {
  opacity: 0.6;
}

.results-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.results-header {
  margin-bottom: 1rem;
}

.results-header h4 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.result-card {
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-card:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.25);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.entity-type {
  padding: 0.25rem 0.5rem;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 3px;
  font-size: 0.65rem;
  color: #818cf8;
  font-weight: 600;
  text-transform: uppercase;
}

.entity-name {
  font-weight: 600;
  color: var(--text-primary, #fff);
  font-size: 0.9rem;
}

.result-scores {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.layer-badge {
  padding: 0.25rem 0.5rem;
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
}

.relevance-score {
  font-size: 0.8125rem;
  color: #818cf8;
  font-weight: 600;
}

.result-observation {
  margin: 0 0 0.75rem 0;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.result-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.7rem;
  color: var(--text-tertiary, #606080);
}

.timestamp {
  font-family: monospace;
}

.salience {
  color: var(--text-tertiary, #606080);
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-tertiary, #606080);
}
`;
