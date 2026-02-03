/**
 * Voice Recorder Hook
 * Week 5 Track 5: Voice Recording UI - Task 5.1
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { VoiceRecorderState } from '../../../helix-runtime/src/types/voice';

interface UseVoiceRecorderOptions {
  onTranscriptionComplete?: (transcript: string) => void;
  onRecordingComplete?: (blob: Blob) => void;
  autoTranscribe?: boolean;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/wav';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setState(prev => ({ ...prev, audioBlob, isRecording: false }));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setState(prev => ({ ...prev, isRecording: true, isPaused: false, duration: 0 }));

      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } catch (error) {
      setState(prev => ({ ...prev, error: `Failed to start recording: ${(error as Error).message}` }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    }
  }, [state.isRecording]);

  const formatDuration = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    return () => { stopRecording(); if (durationIntervalRef.current) clearInterval(durationIntervalRef.current); };
  }, [stopRecording]);

  return {
    isRecording: state.isRecording,
    isPaused: state.isPaused,
    duration: state.duration,
    audioBlob: state.audioBlob,
    transcript: state.transcript,
    error: state.error,
    startRecording,
    stopRecording,
    formatDuration,
  };
}
