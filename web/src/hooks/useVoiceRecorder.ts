/**
 * Voice Recorder Hook
 * Phase 4.1 Week 2: Voice Recording UI - Task 2.1
 *
 * Manages real-time voice recording with:
 * - MediaRecorder API for browser-based capture
 * - Audio chunk collection and Blob formation
 * - Playback preview functionality
 * - Integration with transcription service
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { VoiceRecordingState } from '../lib/types/voice-memo';

interface UseVoiceRecorderOptions {
  onTranscriptionComplete?: (transcript: string) => void;
  onRecordingComplete?: (blob: Blob) => void;
  autoTranscribe?: boolean;
  minDurationSeconds?: number;
}

interface VoiceRecorderControlState extends VoiceRecordingState {
  audioBlob?: Blob;
  isSupported?: boolean;
  isUploading?: boolean;
  playbackPosition?: number;
  isPlaying?: boolean;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const minDuration = options.minDurationSeconds || 1; // Require at least 1 second

  const [state, setState] = useState<VoiceRecorderControlState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    isSupported: typeof window !== 'undefined' && !!navigator.mediaDevices,
    isUploading: false,
    isPlaying: false,
    playbackPosition: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('MediaRecorder API not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // 16kHz for transcription compatibility
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Determine best MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/wav';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      // Collect audio chunks as they become available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setState(prev => ({
          ...prev,
          audioBlob,
          isRecording: false,
          isPaused: false,
        }));

        // Stop stream tracks
        stream.getTracks().forEach(track => track.stop());

        // Trigger callback if provided
        options.onRecordingComplete?.(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect chunks every 100ms

      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
        error: undefined,
      }));

      // Update duration every second
      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to start recording';
      setState(prev => ({ ...prev, error: errorMsg }));
    }
  }, [options]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [state.isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      mediaRecorderRef.current.pause();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, [state.isRecording, state.isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      mediaRecorderRef.current.resume();

      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, [state.isRecording, state.isPaused]);

  const clearRecording = useCallback(() => {
    stopRecording();
    audioChunksRef.current = [];
    if (audioElementRef.current) {
      audioElementRef.current.src = '';
    }
    setState(prev => ({
      ...prev,
      audioBlob: undefined,
      duration: 0,
      isRecording: false,
      isPaused: false,
      error: undefined,
      isPlaying: false,
      playbackPosition: 0,
    }));
  }, [stopRecording]);

  const playRecording = useCallback(() => {
    if (!state.audioBlob) {
      setState(prev => ({ ...prev, error: 'No recording to play' }));
      return;
    }

    if (!audioElementRef.current) {
      audioElementRef.current = new Audio();
    }

    const blobUrl = URL.createObjectURL(state.audioBlob);
    audioElementRef.current.src = blobUrl;
    audioElementRef.current.play();

    setState(prev => ({ ...prev, isPlaying: true }));

    audioElementRef.current.onended = () => {
      setState(prev => ({ ...prev, isPlaying: false }));
      URL.revokeObjectURL(blobUrl);
    };
  }, [state.audioBlob]);

  const stopPlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setState(prev => ({ ...prev, isPlaying: false, playbackPosition: 0 }));
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  const getWaveformData = useCallback((): number[] => {
    // Generate 32 waveform values for visualization
    // In a real implementation, this would analyze actual audio data
    return Array.from({ length: 32 }, () => Math.random() * 0.8 + 0.1);
  }, []);

  const reset = useCallback(() => {
    clearRecording();
  }, [clearRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.isRecording) {
        stopRecording();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [stopRecording, state.isRecording]);

  return {
    // State
    isRecording: state.isRecording,
    isPaused: state.isPaused,
    duration: state.duration,
    audioBlob: state.audioBlob,
    error: state.error,
    isSupported: state.isSupported,
    isUploading: state.isUploading,
    isPlaying: state.isPlaying,
    playbackPosition: state.playbackPosition,
    minDurationMet: state.duration >= minDuration,

    // Controls
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    playRecording,
    stopPlayback,
    reset,

    // Utilities
    formatDuration,
    getWaveformData,
    setIsUploading: (uploading: boolean) => setState(prev => ({ ...prev, isUploading: uploading })),
  };
}
