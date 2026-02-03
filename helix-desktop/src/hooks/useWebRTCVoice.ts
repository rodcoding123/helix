/**
 * Desktop WebRTC Voice Conversation Hook
 * Enables real-time bidirectional voice conversations with the gateway
 *
 * Features:
 * - Automatic peer connection establishment
 * - Audio stream setup with constraints
 * - ICE candidate handling
 * - Offer/Answer SDP exchange
 * - Connection state monitoring
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGateway } from './useGateway';

export interface WebRTCVoiceState {
  isConnected: boolean;
  isInitializing: boolean;
  isMuted: boolean;
  error: string | null;
  connectionState: RTCPeerConnectionState;
  remoteAudioUrl: string | null;
}

export interface WebRTCVoiceControls {
  startConversation: () => Promise<void>;
  endConversation: () => void;
  toggleMute: () => void;
  sendMessage: (message: string) => Promise<void>;
}

/**
 * Hook for managing WebRTC voice conversations on desktop
 */
export function useWebRTCVoice(
  options?: {
    iceServers?: RTCIceServer[];
    audioConstraints?: MediaStreamConstraints['audio'];
    onRemoteAudioTrack?: (track: MediaStreamTrack) => void;
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  }
): [WebRTCVoiceState, WebRTCVoiceControls] {
  const [state, setState] = useState<WebRTCVoiceState>({
    isConnected: false,
    isInitializing: false,
    isMuted: false,
    error: null,
    connectionState: 'new',
    remoteAudioUrl: null,
  });

  const { getClient } = useGateway();
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const webSocketRef = useRef<WebSocket | null>(null);

  /**
   * Initialize WebRTC peer connection
   */
  const initializePeerConnection = useCallback(async () => {
    try {
      setState((s) => ({ ...s, isInitializing: true, error: null }));

      // Create peer connection with STUN/TURN servers
      const peerConnection = new RTCPeerConnection({
        iceServers: options?.iceServers || [
          { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        ],
      });

      // Get local audio stream
      const audioConstraints = options?.audioConstraints || {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      localStreamRef.current = stream;

      // Add local audio tracks to peer connection
      stream.getAudioTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote audio tracks
      peerConnection.ontrack = (event) => {
        console.log('Received remote audio track', event.streams);
        remoteStreamRef.current.addTrack(event.track);

        // Remote audio is handled by the audio element receiving the stream
        // Set a non-null value to indicate audio is ready
        if (!state.remoteAudioUrl) {
          setState((s) => ({ ...s, remoteAudioUrl: 'connected' }));
        }

        options?.onRemoteAudioTrack?.(event.track);
      };

      // Monitor connection state
      peerConnection.onconnectionstatechange = () => {
        const connectionState = peerConnection.connectionState;
        setState((s) => ({ ...s, connectionState }));
        options?.onConnectionStateChange?.(connectionState);

        if (connectionState === 'connected') {
          setState((s) => ({ ...s, isConnected: true, isInitializing: false }));
        } else if (connectionState === 'failed' || connectionState === 'disconnected') {
          setState((s) => ({
            ...s,
            isConnected: false,
            error: `Connection ${connectionState}`,
          }));
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && webSocketRef.current?.readyState === WebSocket.OPEN) {
          webSocketRef.current.send(
            JSON.stringify({
              type: 'ice-candidate',
              candidate: event.candidate,
            })
          );
        }
      };

      peerConnection.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', peerConnection.iceGatheringState);
      };

      peerConnectionRef.current = peerConnection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize WebRTC';
      setState((s) => ({
        ...s,
        isInitializing: false,
        error: errorMessage,
        isConnected: false,
      }));
    }
  }, [options, state.remoteAudioUrl]);

  /**
   * Start WebRTC voice conversation
   */
  const startConversation = useCallback(async () => {
    try {
      await initializePeerConnection();

      if (!peerConnectionRef.current) {
        throw new Error('Failed to create peer connection');
      }

      // Create offer
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
      });

      await peerConnectionRef.current.setLocalDescription(offer);

      // Get gateway client to determine WebSocket URL
      const client = getClient();
      if (!client) {
        throw new Error('Gateway client not available');
      }

      // Setup WebSocket connection for signaling
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/voice/webrtc`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Send offer to gateway
        ws.send(
          JSON.stringify({
            type: 'offer',
            offer: peerConnectionRef.current?.localDescription,
          })
        );
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'answer' && peerConnectionRef.current) {
          const answer = new RTCSessionDescription(message.answer);
          await peerConnectionRef.current.setRemoteDescription(answer);
        } else if (message.type === 'ice-candidate' && peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(message.candidate)
            );
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
        }
      };

      ws.onerror = () => {
        setState((s) => ({
          ...s,
          error: 'WebSocket connection error',
          isConnected: false,
        }));
      };

      ws.onclose = () => {
        setState((s) => ({
          ...s,
          isConnected: false,
        }));
      };

      webSocketRef.current = ws;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start conversation';
      setState((s) => ({
        ...s,
        error: errorMessage,
        isInitializing: false,
      }));
    }
  }, [initializePeerConnection, getClient]);

  /**
   * End WebRTC voice conversation
   */
  const endConversation = useCallback(() => {
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close WebSocket
    if (webSocketRef.current) {
      webSocketRef.current.close();
      webSocketRef.current = null;
    }

    // Reset state
    setState({
      isConnected: false,
      isInitializing: false,
      isMuted: false,
      error: null,
      connectionState: 'new',
      remoteAudioUrl: null,
    });
  }, []);

  /**
   * Toggle mute for local audio
   */
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const isMuted = !state.isMuted;
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
      setState((s) => ({ ...s, isMuted }));
    }
  }, [state.isMuted]);

  /**
   * Send message during voice conversation
   */
  const sendMessage = useCallback(async (message: string) => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(
        JSON.stringify({
          type: 'message',
          text: message,
        })
      );
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endConversation();
    };
  }, [endConversation]);

  return [
    state,
    {
      startConversation,
      endConversation,
      toggleMute,
      sendMessage,
    },
  ];
}
