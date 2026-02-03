/**
 * Voice Memo List Component
 * Phase 4.1 Week 2: Voice Recording & Transcription
 *
 * Features:
 * - Display list of recorded voice memos
 * - Infinite scroll pagination
 * - Search and filter by tags
 * - Play/delete memo controls
 * - Transcription status indicator
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listVoiceMemos } from '../../services/voice';
import type { VoiceMemo } from '../../lib/types/voice-memo';

interface VoiceMemoListProps {
  onSelectMemo?: (memo: VoiceMemo) => void;
  onDeleteMemo?: (memoId: string) => void;
  onRefresh?: () => void;
}

const ITEMS_PER_PAGE = 10;

export const VoiceMemoList: React.FC<VoiceMemoListProps> = ({
  onSelectMemo,
  onDeleteMemo,
  onRefresh,
}) => {
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  /**
   * Load voice memos with pagination
   */
  const loadMemos = useCallback(async (resetOffset = false) => {
    setIsLoading(true);
    setError(null);

    const currentOffset = resetOffset ? 0 : offset;

    try {
      const result = await listVoiceMemos(ITEMS_PER_PAGE, currentOffset);

      if (!result.success) {
        throw new Error(result.error || 'Failed to load memos');
      }

      // Extract all unique tags for filtering
      const tags = new Set<string>();
      result.memos.forEach(memo => {
        memo.tags?.forEach(tag => tags.add(tag));
      });
      setAllTags(Array.from(tags).sort());

      if (resetOffset) {
        setMemos(result.memos);
      } else {
        setMemos(prev => [...prev, ...result.memos]);
      }

      setHasMore(result.memos.length === ITEMS_PER_PAGE);
      if (resetOffset) {
        setOffset(ITEMS_PER_PAGE);
      } else {
        setOffset(prev => prev + ITEMS_PER_PAGE);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load memos';
      setError(errorMsg);
      console.error('Error loading memos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [offset]);

  /**
   * Load initial memos on mount
   */
  useEffect(() => {
    loadMemos(true);
  }, []);

  /**
   * Setup intersection observer for infinite scroll
   */
  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMemos();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMemos]);

  /**
   * Filter memos based on search and tags
   */
  const filteredMemos = memos.filter(memo => {
    const matchesSearch =
      !searchQuery ||
      (memo.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (memo.transcript?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesTags =
      selectedTags.length === 0 ||
      (memo.tags && selectedTags.some(tag => memo.tags?.includes(tag)));

    return matchesSearch && matchesTags;
  });

  /**
   * Handle tag selection toggle
   */
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  /**
   * Format duration in seconds to MM:SS
   */
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  /**
   * Format date for display
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Handle memo playback
   */
  const handlePlay = (memo: VoiceMemo) => {
    if (!memo.audio_url) return;

    if (playingMemoId === memo.id) {
      setPlayingMemoId(null);
      return;
    }

    // In a real implementation, this would use an audio player component
    const audio = new Audio(memo.audio_url);
    audio.play().catch(error => {
      console.error('Playback error:', error);
      setError('Failed to play audio');
    });

    setPlayingMemoId(memo.id);

    audio.onended = () => setPlayingMemoId(null);
  };

  return (
    <div ref={containerRef} className="voice-memo-list space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-100">Voice Memos</h3>
        <button
          onClick={() => {
            setMemos([]);
            setOffset(0);
            loadMemos(true);
            onRefresh?.();
          }}
          className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Search Box */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search memos by title or transcript..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-sm"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
          🔍
        </span>
      </div>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase">Filter by Tags</p>
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
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

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">✗ {error}</p>
        </div>
      )}

      {/* Memos List */}
      <div className="space-y-2">
        {filteredMemos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">
              {memos.length === 0 ? 'No voice memos yet' : 'No memos match your search'}
            </p>
          </div>
        ) : (
          filteredMemos.map(memo => (
            <div
              key={memo.id}
              className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/80 transition-colors"
            >
              {/* Title and Duration */}
              <div className="flex justify-between items-start gap-4 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-slate-100 truncate">
                    {memo.title || 'Untitled Memo'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatDate(memo.recorded_at)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono text-slate-300">
                    {formatDuration(memo.audio_duration_ms)}
                  </p>
                </div>
              </div>

              {/* Transcription Status */}
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span
                  className={`px-2 py-1 rounded font-medium ${
                    memo.transcription_status === 'completed'
                      ? 'bg-green-500/20 text-green-400'
                      : memo.transcription_status === 'processing'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-slate-600/50 text-slate-300'
                  }`}
                >
                  {memo.transcription_status === 'completed'
                    ? '✓ Transcribed'
                    : memo.transcription_status === 'processing'
                      ? '⟳ Transcribing...'
                      : memo.transcription_status === 'failed'
                        ? '✗ Failed'
                        : '⊙ Pending'}
                </span>
                {memo.transcript_confidence && (
                  <span className="text-slate-400">
                    Confidence: {(memo.transcript_confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Transcript Preview */}
              {memo.transcript && (
                <p className="text-xs text-slate-300 line-clamp-2 mb-3 bg-slate-900/50 p-2 rounded">
                  {memo.transcript}
                </p>
              )}

              {/* Tags */}
              {memo.tags && memo.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {memo.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                      {tag}
                    </span>
                  ))}
                  {memo.tags.length > 3 && (
                    <span className="text-xs px-2 py-0.5 text-slate-400">
                      +{memo.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handlePlay(memo)}
                  className={`flex-1 text-sm py-2 px-3 rounded font-medium transition-colors ${
                    playingMemoId === memo.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                  }`}
                >
                  {playingMemoId === memo.id ? '⏹ Stop' : '▶ Play'}
                </button>

                <button
                  onClick={() => onSelectMemo?.(memo)}
                  className="flex-1 text-sm py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded font-medium transition-colors"
                >
                  📖 View
                </button>

                <button
                  onClick={() => {
                    onDeleteMemo?.(memo.id);
                    setMemos(prev => prev.filter(m => m.id !== memo.id));
                  }}
                  className="text-sm py-2 px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded font-medium transition-colors"
                >
                  🗑
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More Trigger */}
      {hasMore && <div ref={loadMoreRef} className="h-4" />}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <span className="animate-spin">⟳</span>
            <span>Loading memos...</span>
          </div>
        </div>
      )}
    </div>
  );
}
