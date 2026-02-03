/**
 * Mobile Voice Memos Component
 * Week 5 Track 6.2: Mobile PWA Responsive Components
 * Touch-optimized voice memo list and recording
 */

import React from 'react';
import { VoiceMemo } from '../../types/voice';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';

interface MobileVoiceMemosProps {
  memos: VoiceMemo[];
  isLoading: boolean;
  onSelectMemo: (memo: VoiceMemo) => void;
  onDeleteMemo: (memoId: string) => void;
}

export const MobileVoiceMemos: React.FC<MobileVoiceMemosProps> = ({
  memos,
  isLoading,
  onSelectMemo,
  onDeleteMemo,
}) => {
  const [showRecorder, setShowRecorder] = React.useState(false);
  const {
    isRecording,
    isPaused,
    duration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    formatDuration,
  } = useVoiceRecorder();

  if (showRecorder) {
    return (
      <div className="flex flex-col h-full bg-slate-950">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100">New Recording</h2>
            <button
              onClick={() => setShowRecorder(false)}
              className="p-2 hover:bg-slate-800 rounded-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Recorder Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          {/* Duration Display */}
          <div className="text-5xl font-bold text-blue-400 mb-8 tabular-nums">
            {formatDuration(duration)}
          </div>

          {/* Waveform Visualization */}
          <div className="w-full mb-8 h-24 bg-slate-900 rounded-lg flex items-center justify-center">
            <p className="text-sm text-slate-500">
              {isRecording ? 'Recording...' : 'Tap to start'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="w-full mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-100 text-sm text-center">
              {error}
            </div>
          )}

          {/* Control Buttons */}
          <div className="w-full space-y-3">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="w-full px-6 py-4 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white text-lg touch-target"
              >
                Start Recording
              </button>
            ) : (
              <>
                <div className="flex gap-3">
                  {!isPaused ? (
                    <button
                      onClick={pauseRecording}
                      className="flex-1 px-4 py-4 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold text-white touch-target"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={resumeRecording}
                      className="flex-1 px-4 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-white touch-target"
                    >
                      Resume
                    </button>
                  )}

                  <button
                    onClick={stopRecording}
                    className="flex-1 px-4 py-4 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold text-white touch-target"
                  >
                    Stop
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => setShowRecorder(false)}
              className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium text-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-4 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-slate-100">Voice Memos</h1>
        </div>

        <button
          onClick={() => setShowRecorder(true)}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white text-sm touch-target"
        >
          🎤 New Recording
        </button>
      </div>

      {/* Memos List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 touch-pan-y">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">Loading memos...</div>
          </div>
        ) : memos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <p>No voice memos yet</p>
            <button
              onClick={() => setShowRecorder(true)}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
            >
              Record one
            </button>
          </div>
        ) : (
          memos.map((memo) => (
            <button
              key={memo.id}
              onClick={() => onSelectMemo(memo)}
              className="w-full text-left bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-blue-600 active:bg-slate-800 transition-colors touch-target"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-100 text-sm">
                    {memo.title || `Recording ${new Date(memo.created_at).toLocaleDateString()}`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {(memo.duration_ms / 1000).toFixed(1)}s •{' '}
                    {new Date(memo.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {memo.transcript && (
                    <p className="text-xs text-slate-500 line-clamp-2 mt-2">
                      {memo.transcript}
                    </p>
                  )}
                </div>

                {/* Play icon */}
                <div className="text-2xl flex-shrink-0">▶</div>
              </div>

              {/* Tags */}
              {memo.tags && memo.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {memo.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-blue-900/50 text-blue-100 text-xs rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
