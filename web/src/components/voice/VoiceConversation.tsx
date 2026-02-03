/**
 * Real-Time Voice Conversation Component
 * Enables bidirectional voice communication with the gateway via WebRTC
 *
 * Features:
 * - Live audio streaming
 * - Mute/unmute control
 * - Connection state indicator
 * - Message sending during conversation
 * - Audio level visualization
 */

import React, { useRef, useEffect, useState } from 'react';
import { useWebRTCVoice } from '../../hooks/useWebRTCVoice';
import '../styles/voice-conversation.css';

interface VoiceConversationProps {
  gatewayUrl: string;
  onMessageSent?: (message: string) => void;
  onError?: (error: string) => void;
}

export const VoiceConversation: React.FC<VoiceConversationProps> = ({
  gatewayUrl,
  onMessageSent,
  onError,
}) => {
  const [state, controls] = useWebRTCVoice(gatewayUrl);
  const [messageInput, setMessageInput] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Monitor audio levels for visualization
  useEffect(() => {
    if (!state.isConnected) return;

    const updateAudioLevel = () => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
      }
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state.isConnected]);

  // Update remote audio element
  useEffect(() => {
    if (remoteAudioRef.current && state.remoteAudioUrl) {
      remoteAudioRef.current.srcObject = new MediaStream();
      remoteAudioRef.current.src = state.remoteAudioUrl;
      remoteAudioRef.current.play().catch((error) => {
        console.error('Failed to play remote audio:', error);
      });
    }
  }, [state.remoteAudioUrl]);

  // Report errors
  useEffect(() => {
    if (state.error && onError) {
      onError(state.error);
    }
  }, [state.error, onError]);

  const handleStartConversation = async () => {
    try {
      await controls.startConversation();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start conversation';
      onError?.(errorMessage);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    try {
      await controls.sendMessage(messageInput);
      onMessageSent?.(messageInput);
      setMessageInput('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      onError?.(errorMessage);
    }
  };

  const getConnectionStatusColor = () => {
    switch (state.connectionState) {
      case 'connected':
        return 'connected';
      case 'connecting':
        return 'connecting';
      case 'disconnected':
      case 'failed':
        return 'failed';
      default:
        return 'idle';
    }
  };

  return (
    <div className="voice-conversation">
      <div className="voice-conversation-header">
        <h2>Voice Conversation</h2>
        <div className={`connection-status ${getConnectionStatusColor()}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {state.isInitializing
              ? 'Initializing...'
              : state.isConnected
                ? 'Connected'
                : state.connectionState === 'connecting'
                  ? 'Connecting...'
                  : 'Disconnected'}
          </span>
        </div>
      </div>

      {state.error && <div className="voice-error-banner">{state.error}</div>}

      <div className="voice-conversation-main">
        {!state.isConnected ? (
          <div className="voice-init-screen">
            <div className="voice-init-icon">🎤</div>
            <h3>Start Voice Conversation</h3>
            <p>Click below to begin a real-time voice conversation with Helix</p>
            <button
              onClick={handleStartConversation}
              disabled={state.isInitializing}
              className="voice-start-button"
            >
              {state.isInitializing ? 'Initializing...' : 'Start Conversation'}
            </button>
          </div>
        ) : (
          <>
            <div className="voice-controls">
              <button
                onClick={controls.toggleMute}
                className={`voice-mute-button ${state.isMuted ? 'muted' : ''}`}
                title={state.isMuted ? 'Unmute' : 'Mute'}
              >
                {state.isMuted ? '🔇' : '🎤'}
              </button>

              <div className="audio-level-indicator">
                <div
                  className="audio-level-bar"
                  style={{ width: `${audioLevel * 100}%` }}
                ></div>
              </div>

              <button
                onClick={controls.endConversation}
                className="voice-end-button"
                title="End conversation"
              >
                ✕ End
              </button>
            </div>

            <div className="voice-message-area">
              <div className="voice-status-info">
                <p>Connection: {state.connectionState}</p>
                <p>Muted: {state.isMuted ? 'Yes' : 'No'}</p>
              </div>

              <form onSubmit={handleSendMessage} className="voice-message-form">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Send message during conversation..."
                  disabled={!state.isConnected}
                  maxLength={500}
                  className="voice-message-input"
                />
                <button
                  type="submit"
                  disabled={!state.isConnected || !messageInput.trim()}
                  className="voice-message-send"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        )}

        <audio
          ref={remoteAudioRef}
          autoPlay
          style={{ display: 'none' }}
          onError={(e) => console.error('Remote audio error:', e)}
        />
      </div>
    </div>
  );
};
