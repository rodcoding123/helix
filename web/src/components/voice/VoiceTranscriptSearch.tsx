/**
 * Voice Transcript Search Component
 * Phase 4.1 Week 3: Full-text search UI for voice memos
 *
 * Features:
 * - Real-time search on transcripts
 * - Filter by date range, tags, confidence
 * - Search suggestions/autocomplete
 * - Display results with relevance scoring
 * - Click to view full memo details
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  searchVoiceTranscripts,
  getVoiceSearchSuggestions,
  getVoiceMemTags,
  getVoiceSearchStats,
  type VoiceSearchResult,
  type VoiceSearchFilters,
} from '../../services/voice-search';
import type { VoiceMemo } from '../../lib/types/voice-memo';

interface VoiceTranscriptSearchProps {
  onSelectMemo?: (memo: VoiceMemo) => void;
}

export const VoiceTranscriptSearch: React.FC<VoiceTranscriptSearchProps> = ({
  onSelectMemo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<VoiceSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filters
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [onlyTranscribed, setOnlyTranscribed] = useState(false);

  const [stats, setStats] = useState({
    totalMemos: 0,
    totalTranscribed: 0,
    averageConfidence: 0,
    uniqueTags: 0,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load tags on mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await getVoiceMemTags();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };

    const loadStats = async () => {
      try {
        const searchStats = await getVoiceSearchStats();
        setStats(searchStats);
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };

    loadTags();
    loadStats();
  }, []);

  // Handle search with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length === 0) {
        setResults([]);
        setSuggestions([]);
        return;
      }

      if (searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      performSearch();
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, selectedTags, dateFrom, dateTo, minConfidence, onlyTranscribed]);

  // Get search suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const sug = await getVoiceSearchSuggestions(searchQuery, 5);
        setSuggestions(sug);
      } catch (error) {
        console.error('Failed to get suggestions:', error);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * Perform the actual search
   */
  const performSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters: VoiceSearchFilters = {
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        dateFrom,
        dateTo,
        minConfidence: minConfidence > 0 ? minConfidence : undefined,
        onlyTranscribed,
      };

      const result = await searchVoiceTranscripts(searchQuery, filters, 50, 0);
      setResults(result.results);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Search failed';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTags, dateFrom, dateTo, minConfidence, onlyTranscribed]);

  /**
   * Handle tag selection toggle
   */
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  /**
   * Format date for input
   */
  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  /**
   * Format date for display
   */
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Get relevance color
   */
  const getRelevanceColor = (relevance: number): string => {
    if (relevance >= 0.9) return 'bg-green-500/20 text-green-400';
    if (relevance >= 0.7) return 'bg-blue-500/20 text-blue-400';
    return 'bg-slate-600/30 text-slate-300';
  };

  return (
    <div className="voice-transcript-search space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Search Voice Memos</h2>
        <p className="text-slate-400 text-sm">
          {stats.totalMemos} memos ({stats.totalTranscribed} transcribed)
        </p>
      </div>

      {/* Search Box */}
      <div className="relative">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search by title or transcript..."
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            setShowSuggestions(e.target.value.length >= 2);
          }}
          onFocus={() => setShowSuggestions(searchQuery.length >= 2)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-lg focus:outline-none focus:border-blue-500"
        />

        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10"
          >
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                onClick={() => {
                  setSearchQuery(suggestion);
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-4 py-2 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">✗ {error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        {/* Confidence Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-slate-300">
              Minimum Confidence
            </label>
            <span className="text-sm text-slate-400">
              {(minConfidence * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={minConfidence}
            onChange={e => setMinConfidence(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-1">
              From
            </label>
            <input
              type="date"
              value={formatDateForInput(dateFrom)}
              onChange={e =>
                setDateFrom(
                  e.target.value ? new Date(e.target.value) : undefined
                )
              }
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-1">
              To
            </label>
            <input
              type="date"
              value={formatDateForInput(dateTo)}
              onChange={e =>
                setDateTo(e.target.value ? new Date(e.target.value) : undefined)
              }
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
            />
          </div>
        </div>

        {/* Transcribed Only */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyTranscribed}
            onChange={e => setOnlyTranscribed(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600"
          />
          <span className="text-sm text-slate-300">Only show transcribed memos</span>
        </label>

        {/* Tags Filter */}
        {availableTags.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-300 mb-2">Filter by Tags</p>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-sm px-3 py-1 rounded transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="animate-spin">⟳</span>
            <span>Searching...</span>
          </div>
        </div>
      )}

      {!isLoading && results.length === 0 && searchQuery && (
        <div className="text-center py-8">
          <p className="text-slate-400">No results found</p>
        </div>
      )}

      {!isLoading && results.length === 0 && !searchQuery && (
        <div className="text-center py-8">
          <p className="text-slate-400">Enter a search query to get started</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </p>

          {results.map(result => (
            <button
              key={result.memo.id}
              onClick={() => onSelectMemo?.(result.memo)}
              className="w-full text-left p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 hover:border-blue-500 transition-all group"
            >
              {/* Title and relevance */}
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                  {result.memo.title || 'Untitled Memo'}
                </h3>
                <span
                  className={`text-xs px-2 py-1 rounded font-medium ${getRelevanceColor(
                    result.relevance
                  )}`}
                >
                  {(result.relevance * 100).toFixed(0)}% match
                </span>
              </div>

              {/* Match type and date */}
              <div className="flex items-center gap-3 mb-2 text-xs text-slate-400">
                <span className="px-2 py-0.5 bg-slate-700 rounded">
                  {result.matchType === 'title'
                    ? '📝 Title'
                    : result.matchType === 'transcript'
                      ? '📄 Transcript'
                      : '🏷️ Tag'}
                </span>
                <span>{formatDate(result.memo.recorded_at)}</span>
              </div>

              {/* Snippet */}
              <p className="text-sm text-slate-300 line-clamp-2 mb-2">{result.snippet}</p>

              {/* Confidence and transcript status */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {result.memo.transcript_confidence && (
                  <span>
                    Confidence: {(result.memo.transcript_confidence * 100).toFixed(0)}%
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded ${
                    result.memo.transcription_status === 'completed'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-600/50 text-slate-300'
                  }`}
                >
                  {result.memo.transcription_status === 'completed'
                    ? '✓ Transcribed'
                    : '⊙ Pending'}
                </span>
              </div>

              {/* Tags */}
              {result.memo.tags && result.memo.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.memo.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {result.memo.tags.length > 3 && (
                    <span className="text-xs text-slate-400">
                      +{result.memo.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
