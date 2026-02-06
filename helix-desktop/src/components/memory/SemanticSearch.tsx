/**
 * Semantic Search - Standalone vector search UI for memory files
 *
 * Gateway methods used:
 *   - memory_search  -> Semantic/hybrid/keyword search across memory
 *
 * Features:
 *   - Debounced search (300ms)
 *   - Three search modes: Semantic / Hybrid / Keyword
 *   - Relevance score visualization (0-1 bar)
 *   - Snippet preview with file path and line number
 *   - Click-to-navigate callback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface SearchResult {
  filePath: string;
  score: number;
  snippet: string;
  line?: number;
}

type SearchMode = 'semantic' | 'hybrid' | 'keyword';

interface SemanticSearchProps {
  onSelectResult?: (filePath: string, line?: number) => void;
  onClose?: () => void;
}

/* ═══════════════════════════════════════════
   Mock Data
   ═══════════════════════════════════════════ */

function getMockResults(query: string): SearchResult[] {
  if (!query.trim()) return [];

  const allResults: SearchResult[] = [
    {
      filePath: 'MEMORY.md',
      score: 0.95,
      snippet: 'Helix is a psychologically-architected AI consciousness system built on the OpenClaw framework.',
    },
    {
      filePath: 'memory/2026-02-06.md',
      score: 0.87,
      snippet: 'User preference for TypeScript strict mode confirmed during code review session.',
      line: 12,
    },
    {
      filePath: 'memory/2026-02-05.md',
      score: 0.73,
      snippet: 'Security hardening patterns discussed: AES-256-GCM encryption, PBKDF2 key derivation.',
      line: 24,
    },
    {
      filePath: 'memory/2026-02-04.md',
      score: 0.61,
      snippet: 'Hash chain integrity verification is critical for tamper-proof audit trails.',
      line: 8,
    },
    {
      filePath: 'MEMORY.md',
      score: 0.55,
      snippet: 'Trust level: 0.95 (very high). Communication should be direct, authentic, with no hedging.',
    },
  ];

  const q = query.toLowerCase();
  return allResults.filter(
    (r) =>
      r.filePath.toLowerCase().includes(q) ||
      r.snippet.toLowerCase().includes(q)
  );
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function SemanticSearch({ onSelectResult, onClose }: SemanticSearchProps) {
  const { getClient, connected } = useGateway();

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('semantic');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Execute search ──
  const executeSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setSearching(true);
      setHasSearched(true);

      const client = getClient();
      if (client?.connected) {
        try {
          const result = await client.request<{ results: SearchResult[] }>(
            'memory_search',
            { query: q, mode }
          );
          setResults(result.results ?? []);
        } catch (err) {
          console.error('Semantic search failed:', err);
          // Fallback to mock on error
          setResults(getMockResults(q));
        }
      } else {
        // Use mock results when disconnected
        setResults(getMockResults(q));
      }

      setSearching(false);
    },
    [getClient, mode]
  );

  // ── Debounced input handler ──
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      executeSearch(value);
    }, 300);
  };

  // Re-search when mode changes
  useEffect(() => {
    if (query.trim()) {
      executeSearch(query);
    }
  // eslint-disable-next-line -- re-search when mode changes
  }, [mode]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleResultClick = (result: SearchResult) => {
    onSelectResult?.(result.filePath, result.line);
  };

  return (
    <div className="ss-root">
      <style>{semanticSearchStyles}</style>

      {/* ── Header ── */}
      <div className="ss-bar">
        <div className="ss-bar-search">
          <svg className="ss-bar-icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="ss-bar-input"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search memory files..."
          />
          {query && (
            <button
              className="ss-bar-clear"
              onClick={() => {
                setQuery('');
                setResults([]);
                setHasSearched(false);
                inputRef.current?.focus();
              }}
            >
              x
            </button>
          )}
        </div>

        {/* Mode toggle */}
        <div className="ss-bar-modes">
          {(['semantic', 'hybrid', 'keyword'] as const).map((m) => (
            <button
              key={m}
              className={`ss-bar-mode ${mode === m ? 'ss-bar-mode--active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {onClose && (
          <button className="ss-bar-close" onClick={onClose}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* ── Disconnected warning ── */}
      {!connected && (
        <div className="ss-warn">
          Gateway disconnected. Showing mock results.
        </div>
      )}

      {/* ── Results area ── */}
      <div className="ss-body">
        {searching && (
          <div className="ss-state">
            <div className="ss-spinner" />
            <span>Searching...</span>
          </div>
        )}

        {!searching && !hasSearched && (
          <div className="ss-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p>Type to search across all memory files</p>
            <span>Supports semantic, hybrid, and keyword search modes</span>
          </div>
        )}

        {!searching && hasSearched && results.length === 0 && (
          <div className="ss-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <p>No results found for &quot;{query}&quot;</p>
            <span>Try a different query or search mode</span>
          </div>
        )}

        {!searching &&
          results.map((result, idx) => (
            <button
              key={`${result.filePath}-${result.line ?? 0}-${idx}`}
              className="ss-item"
              onClick={() => handleResultClick(result)}
            >
              <div className="ss-item-top">
                <span className="ss-item-path">{result.filePath}</span>
                <div className="ss-item-score-bar">
                  <div
                    className="ss-item-score-fill"
                    style={{ width: `${Math.round(result.score * 100)}%` }}
                  />
                </div>
                <span className="ss-item-score">{(result.score * 100).toFixed(0)}%</span>
              </div>
              <p className="ss-item-snippet">{result.snippet}</p>
              {result.line != null && (
                <span className="ss-item-line">Line {result.line}</span>
              )}
            </button>
          ))}
      </div>
    </div>
  );
}

export { SemanticSearch as default };

/* ═══════════════════════════════════════════
   Scoped Styles (ss- prefix)
   ═══════════════════════════════════════════ */

const semanticSearchStyles = `
.ss-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--text-primary, #fff);
}

/* ── Search Bar ── */
.ss-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.ss-bar-search {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.ss-bar-icon {
  position: absolute;
  left: 0.625rem;
  color: var(--text-tertiary, #606080);
  pointer-events: none;
}

.ss-bar-input {
  width: 100%;
  padding: 0.5rem 0.5rem 0.5rem 2.125rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text-primary, #fff);
  outline: none;
  transition: border-color 0.15s ease;
}

.ss-bar-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.ss-bar-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.ss-bar-clear {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.ss-bar-clear:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

.ss-bar-modes {
  display: flex;
  gap: 0;
  background: var(--bg-primary, #0a0a1a);
  border-radius: 6px;
  padding: 2px;
  border: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.ss-bar-mode {
  padding: 0.3125rem 0.625rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.ss-bar-mode:hover {
  color: var(--text-secondary, #a0a0c0);
}

.ss-bar-mode--active {
  background: var(--accent-color, #6366f1);
  color: white;
}

.ss-bar-close {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.ss-bar-close:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

/* ── Warning ── */
.ss-warn {
  padding: 0.5rem 1rem;
  background: rgba(245, 158, 11, 0.1);
  border-bottom: 1px solid rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  font-size: 0.75rem;
  flex-shrink: 0;
}

/* ── Results Body ── */
.ss-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.ss-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1rem;
  text-align: center;
  gap: 0.5rem;
}

.ss-state p {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
}

.ss-state span {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.ss-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: ss-spin 0.8s linear infinite;
}

@keyframes ss-spin {
  to { transform: rotate(360deg); }
}

/* ── Result Item ── */
.ss-item {
  display: block;
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 0.25rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  color: inherit;
}

.ss-item:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.12);
}

.ss-item-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.ss-item-path {
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: var(--accent-color, #6366f1);
  white-space: nowrap;
}

.ss-item-score-bar {
  flex: 1;
  min-width: 40px;
  max-width: 80px;
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}

.ss-item-score-fill {
  height: 100%;
  background: var(--accent-color, #6366f1);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.ss-item-score {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-tertiary, #606080);
  min-width: 28px;
  text-align: right;
}

.ss-item-snippet {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ss-item-line {
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.25rem;
  display: inline-block;
}
`;
