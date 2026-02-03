/**
 * Desktop Voice Memos Component
 * Voice memo recording, playback, and search using Tauri IPC
 */

import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import {
  Microphone,
  Square,
  Play,
  Pause,
  Trash2,
  Tag,
  Calendar,
  Volume2,
  Search,
  Loader,
} from 'lucide-react';

interface VoiceMemo {
  id: string;
  title: string;
  transcript: string;
  duration_ms: number;
  tags: string[];
  created_at: string;
  audio_url?: string;
}

export const DesktopVoiceMemos: React.FC = () => {
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load initial memos
  useEffect(() => {
    loadMemos();
    loadTags();
  }, []);

  // Search when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    } else {
      loadMemos();
    }
  }, [searchQuery, selectedTags]);

  const loadMemos = async () => {
    setLoading(true);
    try {
      const result = await invoke<VoiceMemo[]>('voice_get_memos', {
        limit: 50,
        offset: 0,
      });
      setMemos(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memos');
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const result = await invoke<string[]>('voice_get_tags', {});
      setAllTags(result);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  const performSearch = async () => {
    setLoading(true);
    try {
      const result = await invoke<VoiceMemo[]>('voice_search_transcripts', {
        query: searchQuery,
        tags: selectedTags,
      });
      setMemos(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        recordedChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(recordedChunksRef.current, {
          type: 'audio/wav',
        });

        // Convert blob to base64 and send to Tauri
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          try {
            await invoke('voice_save_memo', {
              audio_data: base64Audio,
              title: `Voice Memo ${new Date().toLocaleString()}`,
              duration_ms: recordingTime * 1000,
            });
            loadMemos();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save memo');
          }
        };
        reader.readAsDataURL(audioBlob);

        // Clean up stream
        stream.getTracks().forEach((track) => track.stop());
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setRecording(true);

      // Update recording time
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to start recording'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const deleteMemo = async (id: string) => {
    try {
      await invoke('voice_delete_memo', { memo_id: id });
      setMemos(memos.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memo');
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/80 backdrop-blur border-b border-slate-700/50 p-6 z-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-purple-400" />
            Voice Memos
          </h2>

          {/* Recording Section */}
          <div className="bg-slate-800/50 rounded-lg p-4 mb-4 border border-slate-700/50">
            {!recording ? (
              <button
                onClick={startRecording}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                <Microphone className="w-5 h-5" />
                Start Recording
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                    <span className="text-white font-semibold">
                      Recording: {formatRecordingTime(recordingTime)}
                    </span>
                  </div>
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg transition"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search Section */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search transcripts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Tag Filters */}
            {allTags.length > 0 && (
              <div>
                <p className="text-sm text-gray-400 mb-2">Filter by tags:</p>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
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

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Memos List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 text-purple-400 animate-spin" />
              <span className="ml-3 text-gray-400">Loading memos...</span>
            </div>
          )}

          {!loading && memos.length === 0 && (
            <div className="text-center py-12">
              <Microphone className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {searchQuery
                  ? `No memos found matching "${searchQuery}"`
                  : 'No voice memos yet. Start recording!'}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {memos.map((memo) => (
              <div
                key={memo.id}
                className="border border-slate-700 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition p-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{memo.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(memo.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Volume2 className="w-4 h-4" />
                        {formatDuration(memo.duration_ms)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setPlayingId(playingId === memo.id ? null : memo.id)
                      }
                      className="text-gray-500 hover:text-purple-400 transition p-2"
                    >
                      {playingId === memo.id ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteMemo(memo.id)}
                      className="text-gray-500 hover:text-red-400 transition p-2"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Tags */}
                {memo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {memo.tags.map((tag) => (
                      <div
                        key={tag}
                        className="flex items-center gap-1 bg-purple-600/20 px-2 py-1 rounded text-xs text-purple-300"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </div>
                    ))}
                  </div>
                )}

                {/* Transcript Preview */}
                {memo.transcript && (
                  <>
                    <div className="text-sm text-gray-300 mb-2 line-clamp-2">
                      {memo.transcript}
                    </div>
                    <button
                      onClick={() =>
                        setExpandedId(
                          expandedId === memo.id ? null : memo.id
                        )
                      }
                      className="text-sm text-purple-400 hover:text-purple-300 transition"
                    >
                      {expandedId === memo.id
                        ? 'Show Less'
                        : 'Show Full Transcript'}
                    </button>

                    {/* Full Transcript */}
                    {expandedId === memo.id && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {memo.transcript}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {!loading && memos.length > 0 && (
            <p className="text-center text-gray-400 mt-6">
              {memos.length} memo{memos.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesktopVoiceMemos;
