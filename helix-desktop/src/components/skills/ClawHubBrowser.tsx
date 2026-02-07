/**
 * ClawHub Marketplace Browser
 *
 * Rich browsing experience for the ClawHub skill registry.
 * Features: featured skills, trending, category browsing,
 * search with filters, sort options, and infinite scroll.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, TrendingUp, ChevronRight,
  Sparkles, Grid3X3, List, SortAsc, Loader2, AlertCircle,
} from 'lucide-react';
import { getClawHubClient } from '../../lib/clawhub-client';
import type {
  ClawHubSkill,
  ClawHubCategory,
  ClawHubSearchOptions,
} from '../../lib/clawhub-client';
import { getGatewayClient } from '../../lib/gateway-client';
import { SkillCard, type SkillCardSkill } from './SkillCard';

type SortOption = 'rating' | 'downloads' | 'recent' | 'updated';
type ViewMode = 'grid' | 'list';

const CATEGORIES: { id: ClawHubCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Development', label: 'Development' },
  { id: 'Communication', label: 'Communication' },
  { id: 'Productivity', label: 'Productivity' },
  { id: 'Automation', label: 'Automation' },
  { id: 'AI', label: 'AI' },
  { id: 'Integration', label: 'Integration' },
  { id: 'Utility', label: 'Utility' },
];

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'rating', label: 'Top Rated' },
  { id: 'downloads', label: 'Most Popular' },
  { id: 'recent', label: 'Newest' },
  { id: 'updated', label: 'Recently Updated' },
];

interface ClawHubBrowserProps {
  onInstall?: (name: string) => Promise<void>;
  installedSkillNames?: Set<string>;
}

export function ClawHubBrowser({ onInstall, installedSkillNames }: ClawHubBrowserProps) {
  const [skills, setSkills] = useState<ClawHubSkill[]>([]);
  const [featured, setFeatured] = useState<ClawHubSkill[]>([]);
  const [trending, setTrending] = useState<ClawHubSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<ClawHubCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [showFeatured, setShowFeatured] = useState(true);
  const offsetRef = useRef(0);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clawhub = useMemo(() => getClawHubClient(), []);

  // Load featured and trending on mount
  useEffect(() => {
    const loadHighlights = async () => {
      try {
        const [featuredResult, trendingResult] = await Promise.allSettled([
          clawhub.getFeatured(6),
          clawhub.getTrending(6),
        ]);
        if (featuredResult.status === 'fulfilled') setFeatured(featuredResult.value);
        if (trendingResult.status === 'fulfilled') setTrending(trendingResult.value);
      } catch (err) {
        console.error('[clawhub-browser] Failed to load highlights:', err);
      }
    };
    loadHighlights();
  }, [clawhub]);

  // Search skills
  const searchSkills = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const options: ClawHubSearchOptions = {
        query: searchQuery || undefined,
        category: category !== 'all' ? category : undefined,
        sortBy,
        limit: 20,
        offset: offsetRef.current,
      };

      const result = await clawhub.search(options);

      if (reset) {
        setSkills(result.skills);
      } else {
        setSkills((prev) => [...prev, ...result.skills]);
      }

      setTotal(result.total);
      setHasMore(result.hasMore);
      offsetRef.current += result.skills.length;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search skills');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [clawhub, searchQuery, category, sortBy]);

  // Trigger search on filter changes
  useEffect(() => {
    searchSkills(true);
  }, [searchSkills]);

  // Debounced search input
  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    setShowFeatured(!value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      searchSkills(true);
    }, 400);
  }, [searchSkills]);

  // Install handler
  const handleInstall = useCallback(async (name: string) => {
    if (onInstall) {
      await onInstall(name);
    } else {
      const client = getGatewayClient();
      if (!client?.connected) throw new Error('Gateway not connected');
      await client.request('skills.install', { name });
    }
  }, [onInstall]);

  const isSearchActive = searchQuery || category !== 'all';

  return (
    <div className="clawhub-browser">
      <style>{clawHubBrowserStyles}</style>

      {/* Search Bar */}
      <div className="chb-search-bar">
        <div className="chb-search-input">
          <Search className="w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search ClawHub skills..."
          />
        </div>

        <div className="chb-controls">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="chb-sort-select"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>

          <div className="chb-view-toggle">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="chb-categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`chb-cat-btn ${category === cat.id ? 'active' : ''}`}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="chb-error">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Featured Section */}
      {showFeatured && !isSearchActive && featured.length > 0 && (
        <div className="chb-section">
          <div className="chb-section-header">
            <Sparkles className="w-4 h-4" />
            <h3>Featured Skills</h3>
          </div>
          <div className="chb-featured-row">
            {featured.map((skill) => (
              <SkillCard
                key={skill.name}
                skill={mapToSkillCard(skill, installedSkillNames)}
                variant="marketplace"
                onInstall={!installedSkillNames?.has(skill.name) ? handleInstall : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trending Section */}
      {showFeatured && !isSearchActive && trending.length > 0 && (
        <div className="chb-section">
          <div className="chb-section-header">
            <TrendingUp className="w-4 h-4" />
            <h3>Trending This Week</h3>
          </div>
          <div className="chb-featured-row">
            {trending.map((skill) => (
              <SkillCard
                key={skill.name}
                skill={mapToSkillCard(skill, installedSkillNames)}
                variant="marketplace"
                onInstall={!installedSkillNames?.has(skill.name) ? handleInstall : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search Results / All Skills */}
      <div className="chb-section">
        {isSearchActive && (
          <div className="chb-section-header">
            <SortAsc className="w-4 h-4" />
            <h3>
              {total > 0 ? `${total} skill${total !== 1 ? 's' : ''} found` : 'No skills found'}
            </h3>
          </div>
        )}

        {loading ? (
          <div className="chb-loading">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p>Searching ClawHub...</p>
          </div>
        ) : skills.length === 0 ? (
          <div className="chb-empty">
            <Search className="w-8 h-8" />
            <p>No skills match your search</p>
            <button onClick={() => { setSearchQuery(''); setCategory('all'); }}>
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className={`chb-results ${viewMode}`}>
              {skills.map((skill) => (
                <SkillCard
                  key={skill.name}
                  skill={mapToSkillCard(skill, installedSkillNames)}
                  variant="marketplace"
                  onInstall={!installedSkillNames?.has(skill.name) ? handleInstall : undefined}
                />
              ))}
            </div>

            {hasMore && (
              <div className="chb-load-more">
                <button onClick={() => searchSkills(false)} disabled={loadingMore}>
                  {loadingMore ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                  ) : (
                    <><ChevronRight className="w-4 h-4" /> Load More</>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function mapToSkillCard(
  skill: ClawHubSkill,
  installedNames?: Set<string>
): SkillCardSkill {
  return {
    name: skill.name,
    description: skill.description,
    version: skill.version,
    enabled: false,
    builtin: false,
    icon: skill.icon,
    author: skill.author,
    rating: skill.rating,
    downloads: skill.downloads,
    category: skill.category,
    tags: skill.tags,
    installed: installedNames?.has(skill.name),
  };
}

const clawHubBrowserStyles = `
.clawhub-browser {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.chb-search-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.chb-search-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  flex: 1;
  min-width: 200px;
  color: var(--text-tertiary, #606080);
}

.chb-search-input input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary, #fff);
  font-size: 0.8125rem;
}

.chb-search-input input::placeholder {
  color: var(--text-tertiary, #606080);
}

.chb-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chb-sort-select {
  padding: 0.375rem 0.625rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.75rem;
  cursor: pointer;
}

.chb-view-toggle {
  display: flex;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  overflow: hidden;
}

.chb-view-toggle button {
  padding: 0.375rem 0.5rem;
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  transition: all 0.15s;
}

.chb-view-toggle button:hover {
  color: var(--text-secondary, #a0a0c0);
}

.chb-view-toggle button.active {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.chb-categories {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.chb-cat-btn {
  padding: 0.25rem 0.75rem;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 99px;
  color: var(--text-tertiary, #606080);
  font-size: 0.6875rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.chb-cat-btn:hover {
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-secondary, #a0a0c0);
}

.chb-cat-btn.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
  color: #818cf8;
}

.chb-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 0.8125rem;
}

.chb-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chb-section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary, #a0a0c0);
}

.chb-section-header h3 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.chb-featured-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
}

.chb-results.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.chb-results.list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chb-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-tertiary, #606080);
}

.chb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-tertiary, #606080);
  font-size: 0.875rem;
}

.chb-empty button {
  padding: 0.375rem 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 6px;
  color: #818cf8;
  font-size: 0.75rem;
  cursor: pointer;
}

.chb-load-more {
  display: flex;
  justify-content: center;
  padding: 1rem;
}

.chb-load-more button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  color: #818cf8;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;
}

.chb-load-more button:hover {
  background: rgba(99, 102, 241, 0.2);
}

.chb-load-more button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;
