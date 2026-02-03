/**
 * Voice Memo Detail Component
 * Phase 4.1 Week 2: View and edit individual voice memos
 *
 * Features:
 * - Play audio with timeline scrubbing
 * - View and edit title/tags
 * - Display transcription with timestamps
 * - Trigger memory synthesis
 * - Share or export memo
 */

import React, { useState, useRef, useEffect } from 'react';
import type { VoiceMemo } from '../../lib/types/voice-memo';

interface VoiceMemoDetailProps {
  memo: VoiceMemo;
  onClose: () => void;
  onSave?: (updated: Partial<VoiceMemo>) => Promise<void>;
  onDelete?: (memoId: string) => Promise<void>;
  onSynthesis?: (memoId: string) => Promise<void>;
}

export const VoiceMemoDetail: React.FC<VoiceMemoDetailProps> = ({
  memo,
  onClose,
  onSave,
  onDelete,
  onSynthesis,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(memo.title || '');
  const [editedTags, setEditedTags] = useState((memo.tags || []).join(', '));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  /**
   * Format time in MM:SS
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  /**
   * Format date
   */
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Handle play/pause
   */
  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  /**
   * Handle save
   */
  const handleSave = async () => {
    setError(null);
    setIsSaving(true);

    try {
      const tags = editedTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const updated: Partial<VoiceMemo> = {
        title: editedTitle || undefined,
        tags,
      };

      await onSave?.(updated);
      setIsEditing(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Save failed';
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle delete
   */
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this memo?')) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await onDelete?.(memo.id);
      onClose();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Delete failed';
      setError(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Handle synthesis
   */
  const handleSynthesis = async () => {
    setError(null);

    try {
      await onSynthesis?.(memo.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Synthesis failed';
      setError(errorMsg);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-100">Voice Memo</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">✗ {error}</p>
            </div>
          )}

          {/* Recording Info */}
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Recorded on {formatDate(memo.recorded_at)}</p>
            <p className="text-xs text-slate-500">
              Duration: {formatTime(memo.audio_duration_ms / 1000)}
            </p>
          </div>

          {/* Audio Player */}
          <div className="space-y-3 bg-slate-800/50 p-4 rounded-lg">
            <audio
              ref={audioRef}
              src={memo.audio_url}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
            />

            {/* Play Button */}
            <button
              onClick={handlePlayPause}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isPlaying ? (
                <>
                  <span>⏹ Stop</span>
                </>
              ) : (
                <>
                  <span>▶ Play</span>
                </>
              )}
            </button>

            {/* Timeline */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={e => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Number(e.target.value);
                  }
                }}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Transcription Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100">Transcription</h3>
              <span
                className={`text-xs px-2 py-1 rounded font-medium ${
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
                    ? '⟳ Processing...'
                    : 'Pending'}
              </span>
            </div>

            {memo.transcript && (
              <div className="bg-slate-800/50 p-4 rounded-lg space-y-2">
                <p className="text-sm text-slate-200 leading-relaxed">{memo.transcript}</p>
                {memo.transcript_confidence && (
                  <p className="text-xs text-slate-400">
                    Confidence: {(memo.transcript_confidence * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Title and Tags - View/Edit Mode */}
          {!isEditing ? (
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-slate-100">
                  {memo.title || 'Untitled Memo'}
                </h3>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded transition-colors"
                >
                  Edit
                </button>
              </div>

              {memo.tags && memo.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {memo.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-3 py-1 bg-slate-700 text-slate-300 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={e => setEditedTitle(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 text-sm"
                  placeholder="Memo title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Tags</label>
                <input
                  type="text"
                  value={editedTags}
                  onChange={e => setEditedTags(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 text-sm"
                  placeholder="comma, separated, tags"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditedTitle(memo.title || '');
                    setEditedTags((memo.tags || []).join(', '));
                    setIsEditing(false);
                  }}
                  className="flex-1 py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 border-t border-slate-700 pt-6">
            {memo.transcript && (
              <button
                onClick={handleSynthesis}
                className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                🧠 Trigger Memory Synthesis
              </button>
            )}

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full py-2 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isDeleting ? '...' : '🗑 Delete Memo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
