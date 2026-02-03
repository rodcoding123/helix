/**
 * Voice Transcript Search Component
 * Full-text search across voice memos and transcripts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useStreaming } from '../../hooks/useStreaming';
import { Search, Loader, Trash2, Tag, Calendar, Volume2 } from 'lucide-react';

interface VoiceResult {
  id: string;
  title: string;
  transcript: string;
  duration_ms: number;
  tags: string[];
  created_at: string;
  relevance?: number;
}

export const VoiceTranscriptSearch: React.FC = () => {
  const { user } = useAuth();
  const { stream } = useStreaming();

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<VoiceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load all unique tags
  useEffect(() => {
    loadAllTags();
  }, [user]);

  const loadAllTags = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/voice/tags?userId=${user.id}`);
      const data = await response.json();
      setAllTags(data.tags || []);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  // Debounced search
  const performSearch = useCallback(async () => {
    if (!user || !searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        query: searchQuery,
        userId: user.id,
        tags: selectedTags.join(','),
      });

      const response = await fetch(`/api/voice/search?${params}`);
      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery, selectedTags]);

  // Trigger search on query change
  useEffect(() => {
    const timer = setTimeout(performSearch, 300); // Debounce 300ms
    return () => clearTimeout(timer);
  }, [searchQuery, selectedTags, performSearch]);

  const deleteResult = async (id: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/voice/memo/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        setResults(results.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete memo:', err);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const highlightMatches = (text: string, query: string): React.ReactNode => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-400/30">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Search Header */}
      <div className="sticky top-0 bg-slate-900/80 backdrop-blur border-b border-slate-700/50 p-6 z-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-purple-400" />
            Search Voice Transcripts
          </h2>

          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search by words in transcripts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Filter by tags:</p>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() =>
                      setSelectedTags(
                        selectedTags.includes(tag)
                          ? selectedTags.filter(t => t !== tag)
                          : [...selectedTags, tag]
                      )
                    }
                    className={`px-3 py-1 rounded-full text-sm transition ${
                      selectedTags.includes(tag)
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 text-purple-400 animate-spin" />
              <span className="ml-3 text-gray-400">Searching transcripts...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && searchQuery && (
            <div className="text-center py-12">
              <Volume2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No transcripts found matching "{searchQuery}"</p>
            </div>
          )}

          {!loading && !error && results.length === 0 && !searchQuery && (
            <div className="text-center py-12">
              <Volume2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Start typing to search your voice memos</p>
            </div>
          )}

          {/* Results List */}
          <div className="space-y-4">
            {results.map(result => (
              <VoiceResultCard
                key={result.id}
                result={result}
                query={searchQuery}
                isExpanded={expandedId === result.id}
                onToggle={() =>
                  setExpandedId(expandedId === result.id ? null : result.id)
                }
                onDelete={() => deleteResult(result.id)}
                highlightMatches={highlightMatches}
                formatDuration={formatDuration}
              />
            ))}
          </div>

          {/* Result Count */}
          {results.length > 0 && (
            <p className="text-center text-gray-400 mt-6">
              Found {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

interface VoiceResultCardProps {
  result: VoiceResult;
  query: string;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  highlightMatches: (text: string, query: string) => React.ReactNode;
  formatDuration: (ms: number) => string;
}

const VoiceResultCard: React.FC<VoiceResultCardProps> = ({
  result,
  query,
  isExpanded,
  onToggle,
  onDelete,
  highlightMatches,
  formatDuration,
}) => {
  // Extract excerpt around first match
  const getExcerpt = (): string => {
    if (!query || !result.transcript) return result.transcript.substring(0, 200);

    const index = result.transcript.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return result.transcript.substring(0, 200);

    const start = Math.max(0, index - 50);
    const end = Math.min(result.transcript.length, index + query.length + 150);
    const excerpt = result.transcript.substring(start, end);

    return (start > 0 ? '...' : '') + excerpt + (end < result.transcript.length ? '...' : '');
  };

  const date = new Date(result.created_at);
  const formattedDate = date.toLocaleDateString();
  const formattedTime = date.toLocaleTimeString();

  return (
    <div className="border border-slate-700 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-white">
            {result.title || 'Voice Memo'}
          </h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formattedDate} {formattedTime}
            </div>
            <div className="flex items-center gap-1">
              <Volume2 className="w-4 h-4" />
              {formatDuration(result.duration_ms)}
            </div>
            {result.relevance && (
              <div>
                Relevance: {(result.relevance * 100).toFixed(0)}%
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-gray-500 hover:text-red-400 transition p-2"
          title="Delete memo"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Tags */}
      {result.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {result.tags.map(tag => (
            <div key={tag} className="flex items-center gap-1 bg-purple-600/20 px-2 py-1 rounded text-xs text-purple-300">
              <Tag className="w-3 h-3" />
              {tag}
            </div>
          ))}
        </div>
      )}

      {/* Excerpt */}
      <div className="text-sm text-gray-300 mb-3">
        {highlightMatches(getExcerpt(), query)}
      </div>

      {/* Full Transcript (Expanded) */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {highlightMatches(result.transcript, query)}
          </p>
        </div>
      )}

      {/* Expand Button */}
      <button
        onClick={onToggle}
        className="text-sm text-purple-400 hover:text-purple-300 transition mt-2"
      >
        {isExpanded ? 'Show Less' : 'Show Full Transcript'}
      </button>
    </div>
  );
};

export default VoiceTranscriptSearch;
