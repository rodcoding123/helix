/**
 * Voice Conversation Component
 * Real-time bidirectional voice conversation with WebRTC
 */

import { useState, useRef, useEffect } from 'react';
import { useWebRTCVoice } from '../../hooks/useWebRTCVoice';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import '../../../styles/components/voice-conversation.css';

export function VoiceConversation() {
  const [state, controls] = useWebRTCVoice();
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Array<{ type: 'sent' | 'received'; text: string }>>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Monitor audio levels if connected
  useEffect(() => {
    if (state.isConnected && state.remoteAudioUrl) {
      // Simulate audio level visualization
      audioLevelIntervalRef.current = setInterval(() => {
        setAudioLevel(Math.random() * 100);
      }, 100);
    }

    return () => {
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
    };
  }, [state.isConnected, state.remoteAudioUrl]);

  const handleStartConversation = async () => {
    await controls.startConversation();
  };

  const handleEndConversation = () => {
    controls.endConversation();
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      return;
    }

    const message = messageText.trim();
    setMessages((prev) => [...prev, { type: 'sent', text: message }]);
    setMessageText('');

    await controls.sendMessage(message);
  };

  const getConnectionStatusColor = () => {
    if (state.error) return 'failed';
    if (state.isInitializing) return 'connecting';
    if (state.isConnected) return 'connected';
    return 'disconnected';
  };

  return (
    <div className="voice-conversation">
      <div className="conversation-header">
        <h3>Live Voice Conversation</h3>
        <div className={`connection-status ${getConnectionStatusColor()}`}>
          <div className="status-indicator"></div>
          <span className="status-text">
            {state.error && 'Error'}
            {state.isInitializing && 'Connecting...'}
            {state.isConnected && 'Connected'}
            {!state.error && !state.isInitializing && !state.isConnected && 'Ready'}
          </span>
        </div>
      </div>

      {state.error && <div className="error-message">{state.error}</div>}

      {!state.isConnected ? (
        <div className="initialization-screen">
          <div className="icon">🎤</div>
          <h2>Start Voice Conversation</h2>
          <p>Connect for real-time bidirectional voice</p>
          <Button onClick={handleStartConversation} variant="primary" size="lg" disabled={state.isInitializing}>
            {state.isInitializing ? 'Connecting...' : 'Start Conversation'}
          </Button>
        </div>
      ) : (
        <div className="active-conversation">
          <div className="conversation-controls">
            <div className="mute-control">
              <Button
                onClick={controls.toggleMute}
                variant={state.isMuted ? 'danger' : 'secondary'}
                size="lg"
              >
                {state.isMuted ? '🔇 Muted' : '🔊 Speaking'}
              </Button>
            </div>

            {state.remoteAudioUrl && (
              <div className="audio-level-indicator">
                <label>Audio Level</label>
                <div className="level-bar">
                  <div
                    className="level-fill"
                    style={{ width: `${audioLevel}%` }}
                  ></div>
                </div>
              </div>
            )}

            <Button
              onClick={handleEndConversation}
              variant="danger"
              size="lg"
            >
              End Call
            </Button>
          </div>

          <div className="messages-container">
            <div className="messages-list">
              {messages.length === 0 ? (
                <div className="empty-messages">
                  <p>Start speaking or type a message...</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.type}`}>
                    <div className="message-content">{msg.text}</div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="message-input-container">
            <Input
              type="text"
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
              disabled={!state.isConnected}
            />
            <Button
              onClick={handleSendMessage}
              variant="primary"
              disabled={!state.isConnected || !messageText.trim()}
            >
              Send
            </Button>
          </div>

          <div className="connection-info">
            <span>State: {state.connectionState}</span>
            {state.remoteAudioUrl && <span>• Audio connected</span>}
            {state.isMuted && <span>• Muted</span>}
          </div>
        </div>
      )}
    </div>
  );
}
