/**
 * Voice Recorder Component
 * Week 5 Track 5: Voice Recording UI - Task 5.1
 */

import React from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { AudioVisualizer } from './AudioVisualizer';

interface VoiceRecorderProps {
  onSave?: (title: string, tags: string[]) => void;
  onClose?: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSave, onClose }) => {
  const {
    isRecording,
    isPaused,
    duration,
    transcript,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    saveMemo,
    reset,
    formatDuration,
  } = useVoiceRecorder({
    autoTranscribe: true,
  });

  const [title, setTitle] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');

  const handleSave = async () => {
    const memo = await saveMemo(title || `Voice Memo ${new Date().toLocaleDateString()}`, tags);
    if (onSave) {
      onSave(title, tags);
    }
    reset();
  };

  const addTag = () => {
    if (tagInput.trim()) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-100">Voice Recording</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl"
          >
            ✕
          </button>
        )}
      </div>

      {/* Recording Status */}
      <div className="mb-6 p-4 bg-slate-800 rounded-lg">
        <div className="text-3xl font-bold text-blue-400 text-center mb-4">
          {formatDuration(duration)}
        </div>

        {/* Visualizer */}
        <AudioVisualizer isActive={isRecording} />

        {/* Status */}
        <div className="text-center text-sm text-slate-400 mt-4">
          {!isRecording && duration === 0 && 'Ready to record'}
          {isRecording && !isPaused && 'Recording...'}
          {isRecording && isPaused && 'Paused'}
        </div>
      </div>

      {/* Transcript Preview */}
      {transcript && (
        <div className="mb-6 p-3 bg-slate-800 rounded-lg">
          <p className="text-sm text-slate-300">{transcript}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-100 text-sm">
          {error}
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-2 mb-6">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors text-white"
          >
            Start Recording
          </button>
        ) : (
          <>
            {!isPaused ? (
              <button
                onClick={pauseRecording}
                className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition-colors text-white"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={resumeRecording}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-white"
              >
                Resume
              </button>
            )}
            <button
              onClick={stopRecording}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
            >
              Stop
            </button>
          </>
        )}
      </div>

      {/* Title Input */}
      {!isRecording && duration > 0 && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Voice memo title"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Tags Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Tags</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addTag();
                  }
                }}
                placeholder="Add tag"
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={addTag}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Add
              </button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-900/50 border border-blue-700 rounded-full text-sm text-blue-100 flex items-center gap-2"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(index)}
                      className="hover:text-blue-300"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors text-white"
          >
            Save Recording
          </button>
        </>
      )}
    </div>
  );
};
