/**
 * Voice Memo Recorder Component
 * Desktop interface for recording, uploading, and managing voice memos
 */

import { useState } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import '../../styles/components/voice.css';

interface VoiceMemoRecorderProps {
  onMemoUploaded?: (memoId: string) => void;
}

export function VoiceMemoRecorder({ onMemoUploaded }: VoiceMemoRecorderProps) {
  const [state, controls] = useVoiceRecorder();
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleStartRecording = async () => {
    await controls.startRecording();
  };

  const handleStopRecording = async () => {
    await controls.stopRecording();
  };

  const handleAddTag = () => {
    if (tagInput.trim() && tags.length < 5) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!state.audioBlob) {
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch('/api/voice/upload-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBlob: Array.from(new Uint8Array(await state.audioBlob.arrayBuffer())),
          title,
          tags,
          durationMs: state.duration * 1000,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onMemoUploaded?.(result.memoId);
        controls.clearRecording();
        setTitle('');
        setTags([]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="voice-memo-recorder">
      <div className="recorder-header">
        <h3>Voice Memo</h3>
      </div>

      {state.error && <div className="error-message">{state.error}</div>}

      <div className="recorder-controls">
        {!state.isRecording ? (
          <Button onClick={handleStartRecording} variant="primary" size="lg">
            Start Recording
          </Button>
        ) : (
          <Button onClick={handleStopRecording} variant="danger" size="lg">
            Stop Recording
          </Button>
        )}

        {state.audioUrl && (
          <>
            <Button onClick={controls.playRecording} variant="secondary">
              Play
            </Button>
            <Button onClick={controls.stopPlayback} variant="secondary">
              Stop
            </Button>
            <Button onClick={() => controls.downloadRecording()} variant="secondary">
              Download
            </Button>
          </>
        )}
      </div>

      {state.isRecording && (
        <div className="recording-status">
          <div className="recording-indicator">
            <div className="pulse"></div>
          </div>
          <span>{state.duration}s</span>
        </div>
      )}

      {state.audioBlob && (
        <div className="memo-form">
          <Input
            type="text"
            placeholder="Memo title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isUploading}
          />

          <div className="tags-input">
            <div className="tags-list">
              {tags.map((tag, index) => (
                <div key={index} className="tag">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(index)}
                    disabled={isUploading}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {tags.length < 5 && (
              <div className="tag-input-group">
                <input
                  type="text"
                  placeholder="Add tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  disabled={isUploading}
                />
                <Button onClick={handleAddTag} variant="secondary" size="sm" disabled={isUploading}>
                  Add
                </Button>
              </div>
            )}
          </div>

          <Button
            onClick={handleUpload}
            variant="primary"
            size="lg"
            disabled={isUploading}
            loading={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Memo'}
          </Button>
        </div>
      )}
    </div>
  );
}
