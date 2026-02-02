/**
 * VoiceMemoRecorder Component
 * UI for recording and uploading voice memos
 *
 * Features:
 * - Record voice memo with visual feedback
 * - Playback control
 * - Upload to Supabase
 * - Optional title and tags
 */

import React, { useState } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { uploadVoiceMemo } from '../../services/voice';

interface VoiceMemoRecorderProps {
  onUploadComplete?: (memoId: string) => void;
  onError?: (error: string) => void;
}

export const VoiceMemoRecorder: React.FC<VoiceMemoRecorderProps> = ({
  onUploadComplete,
  onError,
}) => {
  const [state, controls] = useVoiceRecorder();
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!state.audioBlob) {
      onError?.('No recording to upload');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Uploading...');

    try {
      const tagList = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const result = await uploadVoiceMemo(state.audioBlob, title || undefined, tagList);

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadStatus(`Uploaded! Memo ID: ${result.memoId}`);
      onUploadComplete?.(result.memoId);

      // Reset form
      setTimeout(() => {
        controls.clearRecording();
        setTitle('');
        setTags('');
        setUploadStatus(null);
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setUploadStatus(`Error: ${errorMessage}`);
      onError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="voice-memo-recorder">
      <div className="recorder-header">
        <h3>Record Voice Memo</h3>
        <p className="recorder-subtitle">Tap record, speak, then upload</p>
      </div>

      {/* Recording Controls */}
      <div className="recorder-controls">
        <button
          onClick={state.isRecording ? controls.stopRecording : controls.startRecording}
          disabled={state.isUploading}
          className={`recorder-button ${state.isRecording ? 'recording' : ''}`}
        >
          {state.isRecording ? (
            <>
              <span className="recording-indicator">●</span>
              Recording... {state.duration}s
            </>
          ) : (
            <>
              <span className="mic-icon">🎤</span>
              Start Recording
            </>
          )}
        </button>

        {state.audioBlob && (
          <button
            onClick={controls.playRecording}
            disabled={state.isUploading}
            className="recorder-button secondary"
          >
            ▶ Play
          </button>
        )}

        {state.audioBlob && (
          <button
            onClick={controls.clearRecording}
            disabled={state.isUploading}
            className="recorder-button danger"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="recorder-error">
          <span>⚠️ {state.error}</span>
        </div>
      )}

      {/* Memo Metadata */}
      {state.audioBlob && (
        <div className="memo-metadata">
          <input
            type="text"
            placeholder="Memo title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={isUploading}
            maxLength={100}
            className="metadata-input"
          />

          <input
            type="text"
            placeholder="Tags, comma separated (optional)"
            value={tags}
            onChange={e => setTags(e.target.value)}
            disabled={isUploading}
            className="metadata-input"
          />

          <button
            onClick={handleUpload}
            disabled={isUploading || !state.audioBlob}
            className="upload-button"
          >
            {isUploading ? 'Uploading...' : '⬆ Upload Memo'}
          </button>

          {uploadStatus && (
            <p className={`upload-status ${uploadStatus.startsWith('Error') ? 'error' : 'success'}`}>
              {uploadStatus}
            </p>
          )}
        </div>
      )}

      {/* Info Message */}
      {!state.isSupported && (
        <div className="recorder-info">
          <p>📵 Audio recording is not supported in your browser</p>
        </div>
      )}

      {!state.audioBlob && !state.isRecording && state.isSupported && (
        <div className="recorder-info">
          <p>💡 Click "Start Recording" to begin recording your voice memo</p>
        </div>
      )}
    </div>
  );
};
