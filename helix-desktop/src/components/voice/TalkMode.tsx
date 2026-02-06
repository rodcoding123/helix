/**
 * Talk Mode Controller
 *
 * Main controller for voice talk mode. Manages the full lifecycle:
 *   idle -> listening -> thinking -> speaking -> listening (loop)
 *
 * Gateway methods:
 *   - channels.talk-mode { action: 'start' | 'stop' }
 *   - chat.send (for text-based interaction in talk mode)
 *   - chat.abort (for interrupting)
 *   - tts.status (for voice config)
 *   - tts.convert { text, play: true } (for preview)
 *
 * Events consumed:
 *   - chat events (thinking, content, complete, error)
 *   - talk-mode.transcript (user speech text from gateway)
 *   - talk-mode.state-change (gateway-driven state transitions)
 *
 * Keyboard shortcuts:
 *   - Space: toggle mute
 *   - Escape: close talk mode
 *
 * CSS prefix: tm-
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { VoiceOverlay } from './VoiceOverlay';

/* =====================================================================
   Types
   ===================================================================== */

export interface TalkModeProps {
  /** Callback when talk mode is closed */
  onClose?: () => void;
  /** Default voice ID to use */
  defaultVoice?: string;
  /** Overlay position anchor */
  overlayPosition?: 'bottom-right' | 'bottom-center' | 'top-right';
}

type TalkState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceOption {
  id: string;
  name: string;
  provider: string;
}

interface VoiceSettings {
  voiceId: string;
  speed: number;
  stability: number;
}

/* =====================================================================
   Inline styles
   ===================================================================== */

const STYLES = `
/* Talk Mode settings panel */
.tm-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: tm-fade-in 0.15s ease forwards;
}

@keyframes tm-fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

.tm-settings {
  width: 360px;
  background: rgba(17, 17, 39, 0.98);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  animation: tm-slide-up 0.2s ease forwards;
}

@keyframes tm-slide-up {
  0% {
    opacity: 0;
    transform: translateY(12px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.tm-settings__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tm-settings__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.tm-settings__close {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #a0a0c0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.15s ease;
  padding: 0;
  line-height: 1;
}

.tm-settings__close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.tm-settings__body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Setting item */
.tm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tm-field__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #a0a0c0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tm-field__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tm-field__value {
  font-size: 0.75rem;
  color: #606080;
  min-width: 36px;
  text-align: right;
}

.tm-select {
  width: 100%;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e0e0ff;
  font-size: 0.8rem;
  cursor: pointer;
  transition: border-color 0.15s ease;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23606080' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
}

.tm-select:hover {
  border-color: rgba(99, 102, 241, 0.35);
}

.tm-select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.tm-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
}

.tm-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #6366f1;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.tm-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.tm-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #6366f1;
  cursor: pointer;
  border: none;
}

/* Preview button */
.tm-preview-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid rgba(99, 102, 241, 0.3);
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tm-preview-btn:hover {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.5);
}

.tm-preview-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Settings gear button (floating) */
.tm-gear {
  position: fixed;
  z-index: 9998;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(17, 17, 39, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #606080;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  padding: 0;
}

.tm-gear:hover {
  color: #a0a0c0;
  border-color: rgba(99, 102, 241, 0.35);
}

/* Disconnected banner */
.tm-disconnected {
  position: fixed;
  z-index: 10001;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  color: #ef4444;
  font-size: 0.8rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: tm-fade-in 0.2s ease forwards;
}
`;

/* =====================================================================
   SVG icons (inline)
   ===================================================================== */

function GearIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

/* =====================================================================
   Default voices (used when gateway is unavailable)
   ===================================================================== */

const DEFAULT_VOICES: VoiceOption[] = [
  { id: 'alloy', name: 'Alloy', provider: 'openai' },
  { id: 'echo', name: 'Echo', provider: 'openai' },
  { id: 'fable', name: 'Fable', provider: 'openai' },
  { id: 'onyx', name: 'Onyx', provider: 'openai' },
  { id: 'nova', name: 'Nova', provider: 'openai' },
  { id: 'shimmer', name: 'Shimmer', provider: 'openai' },
  { id: 'rachel', name: 'Rachel', provider: 'elevenlabs' },
  { id: 'adam', name: 'Adam', provider: 'elevenlabs' },
  { id: 'bella', name: 'Bella', provider: 'elevenlabs' },
  { id: 'josh', name: 'Josh', provider: 'elevenlabs' },
  { id: 'en-US-GuyNeural', name: 'Guy (US)', provider: 'edge' },
  { id: 'en-US-JennyNeural', name: 'Jenny (US)', provider: 'edge' },
];

/* =====================================================================
   Component
   ===================================================================== */

export function TalkMode({
  onClose,
  defaultVoice,
  overlayPosition = 'bottom-right',
}: TalkModeProps) {
  const { connected, messages, getClient, interrupt } = useGateway();

  // -----------------------------------------------------------------
  // Core state
  // -----------------------------------------------------------------
  const [talkState, setTalkState] = useState<TalkState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [muted, setMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Voice settings
  const [voices, setVoices] = useState<VoiceOption[]>(DEFAULT_VOICES);
  const [settings, setSettings] = useState<VoiceSettings>({
    voiceId: defaultVoice || 'alloy',
    speed: 1.0,
    stability: 0.5,
  });

  // Session tracking
  const sessionKeyRef = useRef(`talk-${Date.now()}`);
  const activeRef = useRef(false);
  const stateRef = useRef<TalkState>('idle');

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = talkState;
  }, [talkState]);

  // -----------------------------------------------------------------
  // Determine displayed voice name
  // -----------------------------------------------------------------
  const voiceName =
    voices.find((v) => v.id === settings.voiceId)?.name || settings.voiceId || 'Default';

  // -----------------------------------------------------------------
  // Start talk mode on mount
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!connected) return;

    activeRef.current = true;
    startTalkMode();

    return () => {
      activeRef.current = false;
      stopTalkMode();
    };
  }, [connected]);

  // -----------------------------------------------------------------
  // Process gateway messages -> state transitions
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!activeRef.current || messages.length === 0) return;

    const latest = messages[messages.length - 1];

    switch (latest.type) {
      case 'thinking':
        if (stateRef.current === 'listening' || stateRef.current === 'idle') {
          setTalkState('thinking');
        }
        break;

      case 'message':
        if (latest.content) {
          setTalkState('speaking');
          setResponse((prev) => prev + (latest.content || ''));
        }
        break;

      case 'complete':
        // Response finished -> back to listening
        if (stateRef.current === 'speaking' || stateRef.current === 'thinking') {
          setTalkState('listening');
          // Keep response visible briefly, then clear for next round
          setTimeout(() => {
            if (activeRef.current) {
              setTranscript('');
              setResponse('');
            }
          }, 2000);
        }
        break;

      case 'error':
        console.error('[TalkMode] Gateway error:', latest.error);
        // Return to listening on error
        if (stateRef.current !== 'idle') {
          setTalkState('listening');
        }
        break;
    }
  }, [messages]);

  // -----------------------------------------------------------------
  // Load voices from gateway
  // -----------------------------------------------------------------
  useEffect(() => {
    loadVoices();
  }, [connected]);

  async function loadVoices() {
    const client = getClient();
    if (!client?.connected) return;

    try {
      const result = (await client.request('tts.status')) as {
        config?: { voiceId?: string; provider?: string };
        voices?: VoiceOption[];
      };

      if (result.voices && result.voices.length > 0) {
        setVoices(result.voices);
      }

      // Sync current voice from gateway config
      if (result.config?.voiceId && !defaultVoice) {
        setSettings((prev) => ({ ...prev, voiceId: result.config!.voiceId! }));
      }
    } catch {
      // Gateway may not support tts.status - use defaults
    }
  }

  // -----------------------------------------------------------------
  // Gateway communication
  // -----------------------------------------------------------------

  async function startTalkMode() {
    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('channels.talk-mode', {
        action: 'start',
        sessionKey: sessionKeyRef.current,
        voiceId: settings.voiceId,
        speed: settings.speed,
        stability: settings.stability,
      });
      setTalkState('listening');
    } catch (err) {
      console.error('[TalkMode] Failed to start talk mode:', err);
      // Still allow overlay usage even if gateway method fails
      setTalkState('listening');
    }
  }

  async function stopTalkMode() {
    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('channels.talk-mode', {
        action: 'stop',
        sessionKey: sessionKeyRef.current,
      });
    } catch {
      // Best-effort stop
    }
  }

  // -----------------------------------------------------------------
  // User actions
  // -----------------------------------------------------------------

  const handleInterrupt = useCallback(async () => {
    try {
      await interrupt(sessionKeyRef.current);
      setTalkState('listening');
      setResponse('');
    } catch (err) {
      console.error('[TalkMode] Interrupt failed:', err);
    }
  }, [interrupt]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      // Notify gateway of mute state change
      const client = getClient();
      if (client?.connected) {
        client.request('channels.talk-mode', {
          action: next ? 'mute' : 'unmute',
          sessionKey: sessionKeyRef.current,
        }).catch(() => {
          // Best-effort mute notification
        });
      }
      return next;
    });
  }, [getClient]);

  const handleClose = useCallback(() => {
    activeRef.current = false;
    stopTalkMode();
    onClose?.();
  }, [onClose]);

  // -----------------------------------------------------------------
  // Voice settings handlers
  // -----------------------------------------------------------------

  function handleVoiceChange(voiceId: string) {
    setSettings((prev) => ({ ...prev, voiceId }));

    // Notify gateway of voice change
    const client = getClient();
    if (client?.connected) {
      client.request('tts.setProvider', {
        voiceId,
        settings: { speed: settings.speed, stability: settings.stability },
      }).catch(() => {
        // Best-effort
      });
    }
  }

  function handleSpeedChange(speed: number) {
    setSettings((prev) => ({ ...prev, speed }));
  }

  function handleStabilityChange(stability: number) {
    setSettings((prev) => ({ ...prev, stability }));
  }

  async function handlePreview() {
    const client = getClient();
    if (!client?.connected) return;

    setPreviewing(true);
    try {
      await client.request('tts.convert', {
        text: 'Hello, this is a preview of the selected voice.',
        play: true,
        voiceId: settings.voiceId,
        speed: settings.speed,
        stability: settings.stability,
      });
    } catch (err) {
      console.error('[TalkMode] Preview failed:', err);
    } finally {
      setPreviewing(false);
    }
  }

  // -----------------------------------------------------------------
  // Gear button position (offset from overlay)
  // -----------------------------------------------------------------
  const gearPosition: React.CSSProperties =
    overlayPosition === 'bottom-right'
      ? { bottom: '80px', right: '24px' }
      : overlayPosition === 'bottom-center'
        ? { bottom: '80px', left: '50%', transform: 'translateX(-50%)' }
        : { top: '80px', right: '24px' };

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  return (
    <>
      <style>{STYLES}</style>

      {/* Disconnected banner */}
      {!connected && (
        <div className="tm-disconnected">
          Gateway disconnected - talk mode paused
        </div>
      )}

      {/* Main voice overlay */}
      <VoiceOverlay
        state={talkState}
        transcript={transcript}
        response={response}
        voiceName={voiceName}
        onInterrupt={handleInterrupt}
        onClose={handleClose}
        onToggleMute={handleToggleMute}
        muted={muted}
        position={overlayPosition}
      />

      {/* Settings gear button */}
      <button
        className="tm-gear"
        style={gearPosition}
        onClick={() => setShowSettings(true)}
        aria-label="Voice settings"
        title="Voice settings"
      >
        <GearIcon size={16} />
      </button>

      {/* Settings modal */}
      {showSettings && (
        <div
          className="tm-settings-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <div className="tm-settings" role="dialog" aria-label="Voice settings">
            <div className="tm-settings__header">
              <h3 className="tm-settings__title">Voice Settings</h3>
              <button
                className="tm-settings__close"
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
              >
                &times;
              </button>
            </div>

            <div className="tm-settings__body">
              {/* Voice selector */}
              <div className="tm-field">
                <label className="tm-field__label">Voice</label>
                <select
                  className="tm-select"
                  value={settings.voiceId}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                >
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.provider})
                    </option>
                  ))}
                </select>
              </div>

              {/* Speed slider */}
              <div className="tm-field">
                <label className="tm-field__label">Speed</label>
                <div className="tm-field__row">
                  <input
                    type="range"
                    className="tm-slider"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={settings.speed}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    aria-label="Speech speed"
                  />
                  <span className="tm-field__value">{settings.speed.toFixed(1)}x</span>
                </div>
              </div>

              {/* Stability slider */}
              <div className="tm-field">
                <label className="tm-field__label">Stability</label>
                <div className="tm-field__row">
                  <input
                    type="range"
                    className="tm-slider"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.stability}
                    onChange={(e) => handleStabilityChange(parseFloat(e.target.value))}
                    aria-label="Voice stability"
                  />
                  <span className="tm-field__value">
                    {Math.round(settings.stability * 100)}%
                  </span>
                </div>
              </div>

              {/* Preview button */}
              <button
                className="tm-preview-btn"
                onClick={handlePreview}
                disabled={previewing || !connected}
              >
                <PlayIcon size={14} />
                {previewing ? 'Playing...' : 'Preview Voice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TalkMode;
