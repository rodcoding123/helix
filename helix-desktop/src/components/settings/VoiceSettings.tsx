/**
 * Voice Settings - TTS providers and voice configuration
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './SettingsSection.css';

type TTSProvider = 'elevenlabs' | 'openai' | 'edge' | 'none';
type AutoTTSMode = 'off' | 'always' | 'inbound' | 'tagged';

interface VoiceConfig {
  provider: TTSProvider;
  voiceId?: string;
  autoMode: AutoTTSMode;
  speed: number;
  stability?: number;
}

const TTS_PROVIDERS = [
  { id: 'elevenlabs' as const, name: 'ElevenLabs', icon: '🎙️', requiresKey: true },
  { id: 'openai' as const, name: 'OpenAI TTS', icon: '🤖', requiresKey: true },
  { id: 'edge' as const, name: 'Edge TTS', icon: '🔊', requiresKey: false, free: true },
  { id: 'none' as const, name: 'Disabled', icon: '🔇', requiresKey: false },
];

const AUTO_MODES = [
  { id: 'off' as const, label: 'Manual', description: 'Only speak when requested' },
  { id: 'always' as const, label: 'Always', description: 'Speak all responses' },
  { id: 'inbound' as const, label: 'Reply to Voice', description: 'Speak when replying to voice' },
  { id: 'tagged' as const, label: 'Tagged', description: 'Speak responses with voice tags' },
];

export function VoiceSettings() {
  const { getClient } = useGateway();
  const [config, setConfig] = useState<VoiceConfig>({
    provider: 'none',
    autoMode: 'off',
    speed: 1.0,
    stability: 0.5,
  });
  const [loading, setLoading] = useState(true);
  const [testPlaying, setTestPlaying] = useState(false);

  useEffect(() => {
    loadVoiceConfig();
  }, []);

  const loadVoiceConfig = async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      return;
    }

    try {
      const result = await client.request('tts.status') as { config: VoiceConfig };
      if (result.config) {
        setConfig(result.config);
      }
    } catch (err) {
      console.error('Failed to load voice config:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<VoiceConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('tts.setProvider', {
          provider: newConfig.provider,
          voiceId: newConfig.voiceId,
          settings: {
            speed: newConfig.speed,
            stability: newConfig.stability,
          },
        });
      } catch (err) {
        console.error('Failed to update voice config:', err);
      }
    }
  };

  const testVoice = async () => {
    const client = getClient();
    if (!client?.connected || config.provider === 'none') return;

    setTestPlaying(true);
    try {
      await client.request('tts.convert', {
        text: 'Hello, this is a test of the text-to-speech system.',
        play: true,
      });
    } catch (err) {
      console.error('Failed to test voice:', err);
    } finally {
      setTestPlaying(false);
    }
  };

  const currentProvider = TTS_PROVIDERS.find(p => p.id === config.provider);

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Voice & Text-to-Speech</h1>
        <p className="settings-section-description">
          Configure how Helix speaks responses using AI-powered voices.
        </p>
      </header>

      {loading ? (
        <div className="settings-loading">Loading voice settings...</div>
      ) : (
        <>
          <section className="settings-group">
            <h2>TTS Provider</h2>
            <div className="provider-grid">
              {TTS_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  className={`provider-option ${config.provider === provider.id ? 'selected' : ''}`}
                  onClick={() => updateConfig({ provider: provider.id })}
                >
                  <span className="provider-icon">{provider.icon}</span>
                  <span className="provider-name">{provider.name}</span>
                  {provider.free && <span className="free-badge">Free</span>}
                </button>
              ))}
            </div>
          </section>

          {config.provider !== 'none' && (
            <>
              <section className="settings-group">
                <h2>Voice Settings</h2>

                {currentProvider?.requiresKey && (
                  <div className="settings-item">
                    <div className="settings-item-info">
                      <span className="settings-item-label">API Key</span>
                      <span className="settings-item-description">
                        Your {currentProvider.name} API key
                      </span>
                    </div>
                    <input
                      type="password"
                      className="settings-input"
                      placeholder="Enter API key..."
                    />
                  </div>
                )}

                <div className="settings-item">
                  <div className="settings-item-info">
                    <span className="settings-item-label">Voice</span>
                    <span className="settings-item-description">
                      Select the voice to use for speech
                    </span>
                  </div>
                  <select
                    className="settings-select"
                    value={config.voiceId || ''}
                    onChange={(e) => updateConfig({ voiceId: e.target.value })}
                  >
                    <option value="">Default</option>
                    {config.provider === 'openai' && (
                      <>
                        <option value="alloy">Alloy</option>
                        <option value="echo">Echo</option>
                        <option value="fable">Fable</option>
                        <option value="onyx">Onyx</option>
                        <option value="nova">Nova</option>
                        <option value="shimmer">Shimmer</option>
                      </>
                    )}
                    {config.provider === 'elevenlabs' && (
                      <>
                        <option value="rachel">Rachel</option>
                        <option value="adam">Adam</option>
                        <option value="antoni">Antoni</option>
                        <option value="bella">Bella</option>
                        <option value="josh">Josh</option>
                      </>
                    )}
                    {config.provider === 'edge' && (
                      <>
                        <option value="en-US-GuyNeural">Guy (US)</option>
                        <option value="en-US-JennyNeural">Jenny (US)</option>
                        <option value="en-GB-RyanNeural">Ryan (UK)</option>
                        <option value="en-GB-SoniaNeural">Sonia (UK)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="settings-item">
                  <div className="settings-item-info">
                    <span className="settings-item-label">Speed</span>
                    <span className="settings-item-description">
                      {config.speed.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    className="settings-slider"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={config.speed}
                    onChange={(e) => updateConfig({ speed: parseFloat(e.target.value) })}
                  />
                </div>

                {config.provider === 'elevenlabs' && (
                  <div className="settings-item">
                    <div className="settings-item-info">
                      <span className="settings-item-label">Stability</span>
                      <span className="settings-item-description">
                        {Math.round((config.stability || 0.5) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      className="settings-slider"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.stability || 0.5}
                      onChange={(e) => updateConfig({ stability: parseFloat(e.target.value) })}
                    />
                  </div>
                )}

                <div className="settings-item">
                  <button
                    className="btn-secondary"
                    onClick={testVoice}
                    disabled={testPlaying}
                  >
                    {testPlaying ? 'Playing...' : 'Test Voice'}
                  </button>
                </div>
              </section>

              <section className="settings-group">
                <h2>Auto TTS Mode</h2>
                <div className="auto-mode-grid">
                  {AUTO_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      className={`auto-mode-option ${config.autoMode === mode.id ? 'selected' : ''}`}
                      onClick={() => updateConfig({ autoMode: mode.id })}
                    >
                      <span className="mode-label">{mode.label}</span>
                      <span className="mode-description">{mode.description}</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          <section className="settings-group">
            <h2>Voice Wake</h2>
            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">Wake Keywords</span>
                <span className="settings-item-description">
                  Phrases that activate voice input
                </span>
              </div>
              <input
                type="text"
                className="settings-input"
                placeholder="Hey Helix, Helix..."
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
