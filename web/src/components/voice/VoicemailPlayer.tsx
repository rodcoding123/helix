/**
 * Voicemail Player Component
 * Phase 4.1 Week 4: Display and play voicemail messages
 *
 * Features:
 * - Audio playback with timeline scrubbing
 * - Mark as read/important
 * - Archive or delete voicemail
 * - Display caller info and transcript
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  markVoicemailAsRead,
  toggleVoicemailImportant,
  archiveVoicemail,
  deleteVoicemail,
  formatDuration,
  formatReceivedTime,
} from '../../services/voicemail';
import type { VoicemailMessage } from '../../lib/types/voice-memo';

interface VoicemailPlayerProps {
  voicemail: VoicemailMessage;
  onClose: () => void;
  onUpdate?: (updated: VoicemailMessage) => void;
}

export const VoicemailPlayer: React.FC<VoicemailPlayerProps> = ({
  voicemail,
  onClose,
  onUpdate,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mutable state for UI updates
  const [isRead, setIsRead] = useState(voicemail.is_read);
  const [isImportant, setIsImportant] = useState(voicemail.is_important);

  const audioRef = useRef<HTMLAudioElement>(null);

  /**
   * Format time display
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
   * Handle mark as read
   */
  const handleMarkAsRead = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await markVoicemailAsRead(voicemail.id, !isRead);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update read status');
      }

      setIsRead(!isRead);

      // Notify parent
      if (onUpdate) {
        onUpdate({
          ...voicemail,
          is_read: !isRead,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle toggle important
   */
  const handleToggleImportant = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await toggleVoicemailImportant(voicemail.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to toggle important');
      }

      setIsImportant(!isImportant);

      // Notify parent
      if (onUpdate) {
        onUpdate({
          ...voicemail,
          is_important: !isImportant,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle archive
   */
  const handleArchive = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await archiveVoicemail(voicemail.id, true);

      if (!result.success) {
        throw new Error(result.error || 'Failed to archive');
      }

      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to archive';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle delete
   */
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this voicemail?')) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await deleteVoicemail(voicemail.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete');
      }

      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              {voicemail.from_name || voicemail.from_number || 'Unknown Caller'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">{formatReceivedTime(voicemail.received_at)}</p>
          </div>
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

          {/* Caller Info */}
          <div className="space-y-2">
            {voicemail.from_number && (
              <p className="text-sm text-slate-300">
                <span className="text-slate-400">Phone: </span>
                {voicemail.from_number}
              </p>
            )}
            <p className="text-sm text-slate-300">
              <span className="text-slate-400">Duration: </span>
              {formatDuration(voicemail.audio_duration_ms)}
            </p>
          </div>

          {/* Audio Player */}
          <div className="space-y-3 bg-slate-800/50 p-4 rounded-lg">
            <audio
              ref={audioRef}
              src={voicemail.audio_url}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Play Button */}
            <button
              onClick={handlePlayPause}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isPlaying ? (
                <span>⏹ Stop</span>
              ) : (
                <span>▶ Play</span>
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

          {/* Transcript */}
          {voicemail.transcript && (
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-100">Transcript</h3>
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <p className="text-sm text-slate-200 leading-relaxed">{voicemail.transcript}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 border-t border-slate-700 pt-6">
            <div className="grid grid-cols-2 gap-2">
              {/* Mark as Read */}
              <button
                onClick={handleMarkAsRead}
                disabled={isLoading}
                className={`py-2 px-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  isRead
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                    : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400'
                }`}
              >
                {isRead ? '✓ Read' : '○ Unread'}
              </button>

              {/* Mark Important */}
              <button
                onClick={handleToggleImportant}
                disabled={isLoading}
                className={`py-2 px-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  isImportant
                    ? 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                }`}
              >
                {isImportant ? '★ Important' : '☆ Mark Important'}
              </button>
            </div>

            {/* Archive and Delete */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleArchive}
                disabled={isLoading}
                className="py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                📦 Archive
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="py-2 px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
