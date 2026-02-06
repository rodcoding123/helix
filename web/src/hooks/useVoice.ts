import { useState, useCallback, useRef, useEffect } from 'react';
import { WebRTCVoice, VoiceState, VoiceConfig } from '@/lib/webrtc-voice';

interface UseVoiceOptions {
  userId: string;
  authToken: string;
  /** @deprecated Use userId instead */
  instanceKey?: string;
  signalingUrl?: string;
  onTranscript?: (text: string, isFinal: boolean) => void;
}

interface UseVoiceReturn {
  state: VoiceState;
  audioLevel: number;
  isConnected: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isMuted: boolean;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  startCall: () => Promise<void>;
}

export function useVoice(options: UseVoiceOptions): UseVoiceReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const voiceRef = useRef<WebRTCVoice | null>(null);

  const connect = useCallback(async () => {
    if (voiceRef.current) {
      voiceRef.current.disconnect();
    }

    const id = options.userId;
    const config: VoiceConfig = {
      signalingUrl:
        options.signalingUrl || (import.meta.env.DEV
          ? `ws://127.0.0.1:18789/v1/voice/${id}`
          : `wss://gateway.helix-project.org/v1/voice/${id}`),
      instanceKey: options.instanceKey || id,
      authToken: options.authToken,
      onStateChange: setState,
      onAudioLevel: setAudioLevel,
      onTranscript: options.onTranscript,
      onError: setError,
    };

    voiceRef.current = new WebRTCVoice(config);
    await voiceRef.current.connect();
  }, [options.userId, options.instanceKey, options.authToken, options.signalingUrl, options.onTranscript]);

  const disconnect = useCallback(() => {
    voiceRef.current?.disconnect();
    voiceRef.current = null;
    setState('idle');
    setAudioLevel(0);
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    voiceRef.current?.setMuted(newMuted);
  }, [isMuted]);

  const startCall = useCallback(async () => {
    await voiceRef.current?.startCall();
  }, []);

  useEffect(() => {
    return () => {
      voiceRef.current?.disconnect();
    };
  }, []);

  return {
    state,
    audioLevel,
    isConnected: state === 'connected' || state === 'speaking' || state === 'listening',
    isSpeaking: state === 'speaking',
    isListening: state === 'listening',
    isMuted,
    error,
    connect,
    disconnect,
    toggleMute,
    startCall,
  };
}
