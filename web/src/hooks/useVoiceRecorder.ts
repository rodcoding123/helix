/**
 * useVoiceRecorder - Voice Recording Hook
 * Handles microphone access, audio recording, and playback
 *
 * Features:
 * - Start/stop recording
 * - Real-time audio level visualization data
 * - Playback control
 * - WAV/WebM encoding
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface VoiceRecorderState {
  isRecording: boolean;
  isSupported: boolean;
  error: string | null;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  isUploading?: boolean;
}

interface VoiceRecorderControls {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  playRecording: () => void;
  stopPlayback: () => void;
  clearRecording: () => void;
  downloadRecording: (filename?: string) => void;
}

export function useVoiceRecorder(): [VoiceRecorderState, VoiceRecorderControls] {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isSupported: typeof window !== 'undefined' && !!window.navigator.mediaDevices?.getUserMedia,
    error: null,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({
        ...prev,
        error: 'Audio recording is not supported in your browser',
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, error: null }));
      chunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Set up audio analysis
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        const errorEvent = event as any;
        setState(prev => ({
          ...prev,
          error: `Recording error: ${errorEvent.error?.name || 'Unknown error'}`,
          isRecording: false,
        }));
      };

      mediaRecorderRef.current = mediaRecorder;

      // Start recording
      mediaRecorder.start();
      setState(prev => ({
        ...prev,
        isRecording: true,
        duration: 0,
      }));

      // Track duration
      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: prev.duration + 1,
        }));
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isRecording: false,
      }));
    }
  }, [state.isSupported]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !state.isRecording) {
      return;
    }

    return new Promise<void>(resolve => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = () => {
        // Stop duration tracking
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        // Stop stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Create blob and URL
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);

        setState(prev => ({
          ...prev,
          isRecording: false,
          audioBlob,
          audioUrl,
        }));

        resolve();
      };

      mediaRecorder.stop();
    });
  }, [state.isRecording]);

  const playRecording = useCallback(() => {
    if (!state.audioUrl) {
      return;
    }

    if (!audioElementRef.current) {
      audioElementRef.current = new Audio();
    }

    audioElementRef.current.src = state.audioUrl;
    audioElementRef.current.play().catch(err => {
      setState(prev => ({
        ...prev,
        error: `Playback error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    });
  }, [state.audioUrl]);

  const stopPlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
  }, []);

  const clearRecording = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    stopPlayback();
    setState(prev => ({
      ...prev,
      audioBlob: null,
      audioUrl: null,
      duration: 0,
    }));
    chunksRef.current = [];
  }, [state.audioUrl, stopPlayback]);

  const downloadRecording = useCallback(
    (filename: string = `recording-${Date.now()}.webm`) => {
      if (!state.audioBlob) {
        return;
      }

      const url = URL.createObjectURL(state.audioBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [state.audioBlob]
  );

  return [
    state,
    {
      startRecording,
      stopRecording,
      playRecording,
      stopPlayback,
      clearRecording,
      downloadRecording,
    },
  ];
}
