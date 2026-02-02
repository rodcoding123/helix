import { useState, useCallback, useRef, useEffect } from 'react';
import { WebRTCVoice, VoiceState, VoiceConfig } from '@/lib/webrtc-voice';

interface UseVoiceOptions {
  instanceKey: string;
  authToken: string;
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

    const config: VoiceConfig = {
      signalingUrl:
        options.signalingUrl || `wss://gateway.helix-project.org/v1/voice/${options.instanceKey}`,
      instanceKey: options.instanceKey,
      authToken: options.authToken,
      onStateChange: setState,
      onAudioLevel: setAudioLevel,
      onTranscript: options.onTranscript,
      onError: setError,
    };

    voiceRef.current = new WebRTCVoice(config);
    await voiceRef.current.connect();
  }, [options.instanceKey, options.authToken, options.signalingUrl, options.onTranscript]);

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
