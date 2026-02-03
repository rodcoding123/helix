/**
 * VoiceMemoRecorder Component
 * Phase 4.1 Week 2: Voice Recording & Transcription
 *
 * Features:
 * - Record voice memo with MediaRecorder API
 * - Real-time duration display
 * - Pause/resume functionality
 * - Playback preview
 * - Upload to Supabase with transcription
 * - Optional title and tags
 */

import React, { useState, useEffect } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { uploadVoiceMemo } from '../../services/voice';
import { getTranscriptionService } from '../../services/voice-transcription';
import { AudioVisualizer } from './AudioVisualizer';
import type { TranscriptionResult } from '../../services/voice-transcription';

interface VoiceMemoRecorderProps {
  onUploadComplete?: (memoId: string) => void;
  onError?: (error: string) => void;
  autoTranscribe?: boolean;
}

export const VoiceMemoRecorder: React.FC<VoiceMemoRecorderProps> = ({
  onUploadComplete,
  onError,
  autoTranscribe = true,
}) => {
  const recorder = useVoiceRecorder({
    autoTranscribe,
  });

  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Handle transcription when recording stops
  useEffect(() => {
    const handleStoppedRecording = async () => {
      if (recorder.audioBlob && autoTranscribe && !transcriptionResult) {
        setIsTranscribing(true);
        try {
          const service = getTranscriptionService();
          if (!service.isConfigured()) {
            console.warn('No transcription provider configured');
            setIsTranscribing(false);
            return;
          }

          const result = await service.transcribe(recorder.audioBlob);
          setTranscriptionResult(result);
        } catch (error) {
          console.error('Transcription error:', error);
        } finally {
          setIsTranscribing(false);
        }
      }
    };

    if (recorder.audioBlob && !recorder.isRecording && !transcriptionResult) {
      handleStoppedRecording();
    }
  }, [recorder.audioBlob, recorder.isRecording, autoTranscribe, transcriptionResult]);

  const handleUpload = async () => {
    if (!recorder.audioBlob) {
      const error = 'No recording to upload';
      setUploadStatus(`Error: ${error}`);
      onError?.(error);
      return;
    }

    recorder.setIsUploading(true);
    setUploadStatus('Uploading...');

    try {
      const tagList = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const result = await uploadVoiceMemo(
        recorder.audioBlob,
        title || undefined,
        tagList
      );

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadStatus(`✓ Uploaded! Memo ID: ${result.memoId}`);
      onUploadComplete?.(result.memoId);

      // Reset form after 2 seconds
      setTimeout(() => {
        recorder.clearRecording();
        setTitle('');
        setTags('');
        setUploadStatus(null);
        setTranscriptionResult(null);
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadStatus(`✗ Error: ${errorMessage}`);
      onError?.(errorMessage);
    } finally {
      recorder.setIsUploading(false);
    }
  };

  const recordingTimeDisplay = recorder.formatDuration(recorder.duration);
  const canRecord = recorder.isSupported && !recorder.isUploading;

  return (
    <div className="voice-memo-recorder space-y-4">
      {/* Header */}
      <div className="recorder-header">
        <h3 className="text-lg font-semibold text-slate-100">Record Voice Memo</h3>
        <p className="text-sm text-slate-400">Tap record, speak, then upload</p>
      </div>

      {/* Browser Support Check */}
      {!recorder.isSupported && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">📵 Audio recording not supported in your browser</p>
        </div>
      )}

      {/* Recording Controls */}
      {canRecord && (
        <div className="recorder-controls flex gap-2">
          <button
            onClick={recorder.isRecording ? recorder.stopRecording : recorder.startRecording}
            disabled={recorder.isUploading}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              recorder.isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } disabled:opacity-50`}
          >
            {recorder.isRecording ? (
              <>
                <span className="animate-pulse">●</span>
                <span>Stop Recording</span>
              </>
            ) : (
              <>
                <span>🎤</span>
                <span>Start Recording</span>
              </>
            )}
          </button>

          {recorder.isRecording && (
            <button
              onClick={recorder.isPaused ? recorder.resumeRecording : recorder.pauseRecording}
              className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              {recorder.isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
          )}
        </div>
      )}

      {/* Duration Display */}
      {recorder.isRecording && (
        <div className="text-center py-4">
          <div className="text-4xl font-mono text-blue-400 font-bold">{recordingTimeDisplay}</div>
          <p className="text-xs text-slate-400 mt-1">
            {recorder.minDurationMet ? '✓ Recording...' : 'Keep recording (min 1 second)'}
          </p>
        </div>
      )}

      {/* Audio Visualizer */}
      {recorder.isRecording && (
        <AudioVisualizer
          isActive={recorder.isRecording}
          waveform={recorder.getWaveformData()}
        />
      )}

      {/* Error Display */}
      {recorder.error && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">⚠️ {recorder.error}</p>
        </div>
      )}

      {/* Recording Preview */}
      {recorder.audioBlob && !recorder.isRecording && (
        <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          {/* Duration and Size Info */}
          <div className="flex justify-between text-sm text-slate-300">
            <span>Duration: {recorder.formatDuration(recorder.duration)}</span>
            <span>Size: {(recorder.audioBlob.size / 1024).toFixed(1)} KB</span>
          </div>

          {/* Transcription Status */}
          {autoTranscribe && (
            <div>
              {isTranscribing && (
                <div className="flex items-center gap-2 text-blue-400 text-sm">
                  <span className="animate-spin">⟳</span>
                  <span>Transcribing...</span>
                </div>
              )}
              {transcriptionResult && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    {transcriptionResult.success ? (
                      <span className="text-green-400 text-sm">✓ Transcribed</span>
                    ) : (
                      <span className="text-orange-400 text-sm">⚠ Transcription unavailable</span>
                    )}
                  </div>
                  {transcriptionResult.success && transcriptionResult.text && (
                    <div className="bg-slate-700/50 p-3 rounded text-sm text-slate-200 max-h-24 overflow-y-auto">
                      {transcriptionResult.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Playback Controls */}
          <div className="flex gap-2">
            {!recorder.isPlaying ? (
              <button
                onClick={recorder.playRecording}
                disabled={recorder.isUploading}
                className="flex-1 py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                ▶ Play Recording
              </button>
            ) : (
              <button
                onClick={recorder.stopPlayback}
                className="flex-1 py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-sm font-medium transition-colors"
              >
                ⏹ Stop Playback
              </button>
            )}

            <button
              onClick={recorder.clearRecording}
              disabled={recorder.isUploading}
              className="py-2 px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              ✕ Clear
            </button>
          </div>

          {/* Metadata Inputs */}
          <div className="space-y-3 border-t border-slate-700 pt-4">
            <input
              type="text"
              placeholder="Memo title (optional)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={recorder.isUploading}
              maxLength={100}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 text-sm disabled:opacity-50"
            />

            <input
              type="text"
              placeholder="Tags, comma separated (optional)"
              value={tags}
              onChange={e => setTags(e.target.value)}
              disabled={recorder.isUploading}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 text-sm disabled:opacity-50"
            />

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={recorder.isUploading || !recorder.audioBlob}
              className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {recorder.isUploading ? (
                <>
                  <span className="animate-spin">⟳</span>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <span>⬆</span>
                  <span>Upload Memo</span>
                </>
              )}
            </button>
          </div>

          {/* Upload Status */}
          {uploadStatus && (
            <div
              className={`text-sm text-center py-2 rounded ${
                uploadStatus.startsWith('✗')
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-green-500/10 text-green-400'
              }`}
            >
              {uploadStatus}
            </div>
          )}
        </div>
      )}

      {/* Info Message */}
      {!recorder.audioBlob && !recorder.isRecording && recorder.isSupported && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
          <p className="text-blue-400 text-sm">💡 Click "Start Recording" to begin recording your voice memo</p>
        </div>
      )}
    </div>
  );
};
