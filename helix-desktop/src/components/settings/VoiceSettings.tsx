/**
 * VoiceSettings - TTS configuration settings panel for Helix Desktop
 *
 * Manages voice provider selection, voice browsing, tuning parameters,
 * output settings, and test playback. Persists via gateway config.patch.
 *
 * Gateway methods:
 *   - config.patch (messages.tts.*) - TTS configuration
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface VoiceSettingsProps {
  onBack?: () => void;
}

type TTSProvider = 'elevenlabs' | 'openai' | 'edge-tts';

interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
}

type OutputFormat = 'mp3' | 'wav' | 'opus' | 'pcm';

interface TTSConfig {
  provider: TTSProvider;
  voiceId: string;
  speed: number;
  stability: number;
  similarityBoost: number;
  style: number;
  outputFormat: OutputFormat;
  autoPlay: boolean;
  volume: number;
}

/* ═══════════════════════════════════════════
   Voice Data
   ═══════════════════════════════════════════ */

const PROVIDERS: { id: TTSProvider; name: string; description: string; recommended?: boolean }[] = [
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Premium quality, most natural',
    recommended: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Good quality, fast, built-in',
  },
  {
    id: 'edge-tts',
    name: 'Edge TTS',
    description: 'Free, decent quality, local',
  },
];

const VOICES: Record<TTSProvider, VoiceInfo[]> = {
  elevenlabs: [
    { id: 'rachel', name: 'Rachel', language: 'English', gender: 'female', accent: 'American' },
    { id: 'adam', name: 'Adam', language: 'English', gender: 'male', accent: 'American' },
    { id: 'bella', name: 'Bella', language: 'English', gender: 'female', accent: 'British' },
    { id: 'antoni', name: 'Antoni', language: 'English', gender: 'male', accent: 'American' },
    { id: 'elli', name: 'Elli', language: 'English', gender: 'female', accent: 'American' },
    { id: 'josh', name: 'Josh', language: 'English', gender: 'male', accent: 'American' },
  ],
  openai: [
    { id: 'alloy', name: 'Alloy', language: 'English', gender: 'neutral' },
    { id: 'echo', name: 'Echo', language: 'English', gender: 'male' },
    { id: 'fable', name: 'Fable', language: 'English', gender: 'neutral' },
    { id: 'onyx', name: 'Onyx', language: 'English', gender: 'male' },
    { id: 'nova', name: 'Nova', language: 'English', gender: 'female' },
    { id: 'shimmer', name: 'Shimmer', language: 'English', gender: 'female' },
  ],
  'edge-tts': [
    { id: 'en-US-GuyNeural', name: 'Guy', language: 'English', gender: 'male', accent: 'US' },
    { id: 'en-US-JennyNeural', name: 'Jenny', language: 'English', gender: 'female', accent: 'US' },
    { id: 'en-US-AriaNeural', name: 'Aria', language: 'English', gender: 'female', accent: 'US' },
  ],
};

const OUTPUT_FORMATS: { id: OutputFormat; label: string }[] = [
  { id: 'mp3', label: 'MP3' },
  { id: 'wav', label: 'WAV' },
  { id: 'opus', label: 'Opus' },
  { id: 'pcm', label: 'PCM' },
];

const DEFAULT_CONFIG: TTSConfig = {
  provider: 'elevenlabs',
  voiceId: 'rachel',
  speed: 1.0,
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.0,
  outputFormat: 'mp3',
  autoPlay: true,
  volume: 80,
};

const DEFAULT_TEST_PHRASE = "Hello, I'm Helix. How can I help you today?";

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

/** Parse TTS config from gateway config raw messages.tts object */
function parseTTSConfig(raw: Record<string, unknown> | undefined): TTSConfig {
  if (!raw) return { ...DEFAULT_CONFIG };

  return {
    provider: (raw.provider as TTSProvider) ?? DEFAULT_CONFIG.provider,
    voiceId: (raw.voiceId as string) ?? (raw.voice as string) ?? DEFAULT_CONFIG.voiceId,
    speed: typeof raw.speed === 'number' ? raw.speed : DEFAULT_CONFIG.speed,
    stability: typeof raw.stability === 'number' ? raw.stability : DEFAULT_CONFIG.stability,
    similarityBoost: typeof raw.similarityBoost === 'number' ? raw.similarityBoost : DEFAULT_CONFIG.similarityBoost,
    style: typeof raw.style === 'number' ? raw.style : DEFAULT_CONFIG.style,
    outputFormat: (raw.outputFormat as OutputFormat) ?? DEFAULT_CONFIG.outputFormat,
    autoPlay: typeof raw.autoPlay === 'boolean' ? raw.autoPlay : DEFAULT_CONFIG.autoPlay,
    volume: typeof raw.volume === 'number' ? raw.volume : DEFAULT_CONFIG.volume,
  };
}

/** Check if config has unsaved changes compared to saved version */
function hasChanges(current: TTSConfig, saved: TTSConfig): boolean {
  return (
    current.provider !== saved.provider ||
    current.voiceId !== saved.voiceId ||
    current.speed !== saved.speed ||
    current.stability !== saved.stability ||
    current.similarityBoost !== saved.similarityBoost ||
    current.style !== saved.style ||
    current.outputFormat !== saved.outputFormat ||
    current.autoPlay !== saved.autoPlay ||
    current.volume !== saved.volume
  );
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function VoiceSettings({ onBack }: VoiceSettingsProps) {
  const { getClient, connected } = useGateway();
  const { gatewayConfig, patchGatewayConfig } = useGatewayConfig();

  // Config state
  const [config, setConfig] = useState<TTSConfig>({ ...DEFAULT_CONFIG });
  const [savedConfig, setSavedConfig] = useState<TTSConfig>({ ...DEFAULT_CONFIG });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Voice browser filters
  const [voiceSearch, setVoiceSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'neutral'>('all');

  // Test playback
  const [testPhrase, setTestPhrase] = useState(DEFAULT_TEST_PHRASE);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);

  // Load config from gateway on mount / connect
  useEffect(() => {
    const ttsRaw = gatewayConfig.messages?.tts as Record<string, unknown> | undefined;
    const parsed = parseTTSConfig(ttsRaw);
    setConfig(parsed);
    setSavedConfig(parsed);
  }, [gatewayConfig.messages]);

  // Derived: unsaved changes
  const isDirty = useMemo(() => hasChanges(config, savedConfig), [config, savedConfig]);

  // Voices for current provider
  const providerVoices = useMemo(() => {
    let voices = VOICES[config.provider] ?? [];

    if (voiceSearch) {
      const q = voiceSearch.toLowerCase();
      voices = voices.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.language.toLowerCase().includes(q) ||
          (v.accent ?? '').toLowerCase().includes(q)
      );
    }

    if (genderFilter !== 'all') {
      voices = voices.filter((v) => v.gender === genderFilter);
    }

    return voices;
  }, [config.provider, voiceSearch, genderFilter]);

  // Update config field
  const updateField = useCallback(<K extends keyof TTSConfig>(key: K, value: TTSConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaveError(null);
  }, []);

  // Change provider (resets voice to first available)
  const changeProvider = useCallback((provider: TTSProvider) => {
    const firstVoice = VOICES[provider]?.[0]?.id ?? '';
    setConfig((prev) => ({
      ...prev,
      provider,
      voiceId: firstVoice,
    }));
    setSaveError(null);
  }, []);

  // Save config
  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    try {
      await patchGatewayConfig({
        messages: {
          ...gatewayConfig.messages,
          tts: {
            provider: config.provider,
            voiceId: config.voiceId,
            speed: config.speed,
            stability: config.stability,
            similarityBoost: config.similarityBoost,
            style: config.style,
            outputFormat: config.outputFormat,
            autoPlay: config.autoPlay,
            volume: config.volume,
          },
        },
      });

      setSavedConfig({ ...config });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save TTS settings');
    } finally {
      setSaving(false);
    }
  }, [config, gatewayConfig.messages, patchGatewayConfig]);

  // Discard changes
  const discard = useCallback(() => {
    setConfig({ ...savedConfig });
    setSaveError(null);
  }, [savedConfig]);

  // Preview voice
  const previewVoice = useCallback(async (voiceId: string) => {
    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('nodes.invoke', {
        capability: 'tts.speak',
        args: {
          text: 'Hello, this is a voice preview.',
          provider: config.provider,
          voiceId,
          speed: config.speed,
        },
      });
    } catch (err) {
      console.error('Voice preview failed:', err);
    }
  }, [getClient, config.provider, config.speed]);

  // Test speak
  const testSpeak = useCallback(async () => {
    const client = getClient();
    if (!client?.connected || !testPhrase.trim()) return;

    setPlaying(true);
    playingRef.current = true;

    try {
      await client.request('nodes.invoke', {
        capability: 'tts.speak',
        args: {
          text: testPhrase,
          provider: config.provider,
          voiceId: config.voiceId,
          speed: config.speed,
          stability: config.stability,
          similarityBoost: config.similarityBoost,
          style: config.style,
          outputFormat: config.outputFormat,
          volume: config.volume,
        },
      });
    } catch (err) {
      console.error('TTS test failed:', err);
    } finally {
      setPlaying(false);
      playingRef.current = false;
    }
  }, [getClient, testPhrase, config]);

  // Stop playback
  const stopPlayback = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) return;

    playingRef.current = false;
    setPlaying(false);

    try {
      await client.request('nodes.invoke', {
        capability: 'tts.stop',
        args: {},
      });
    } catch {
      // Ignore stop errors
    }
  }, [getClient]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (playingRef.current) {
        const client = getClient();
        if (client?.connected) {
          client.request('nodes.invoke', {
            capability: 'tts.stop',
            args: {},
          }).catch(() => {});
        }
      }
    };
  }, [getClient]);

  // Gender icon
  const genderIcon = (gender: string): string => {
    switch (gender) {
      case 'male': return 'M';
      case 'female': return 'F';
      default: return 'N';
    }
  };

  return (
    <div className="vs-container">
      <style>{voiceSettingsStyles}</style>

      {/* Header */}
      <div className="vs-header">
        {onBack && (
          <button className="vs-back-btn" onClick={onBack} type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        )}
        <div className="vs-header-text">
          <h2 className="vs-title">Voice Settings</h2>
          <p className="vs-subtitle">Configure text-to-speech for Helix responses</p>
        </div>
      </div>

      {/* Not connected banner */}
      {!connected && (
        <div className="vs-banner vs-banner--warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Gateway disconnected. Voice settings require an active gateway connection to save.
        </div>
      )}

      {/* Section 1: Provider Selection */}
      <section className="vs-section">
        <h3 className="vs-section-title">Provider</h3>
        <div className="vs-provider-grid">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              className={`vs-provider-card ${config.provider === provider.id ? 'vs-provider-card--active' : ''}`}
              onClick={() => changeProvider(provider.id)}
              type="button"
            >
              <div className="vs-provider-card-header">
                <span className="vs-provider-name">{provider.name}</span>
                {provider.recommended && (
                  <span className="vs-provider-badge">Recommended</span>
                )}
              </div>
              <span className="vs-provider-desc">{provider.description}</span>
              {config.provider === provider.id && (
                <div className="vs-provider-check">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Section 2: Voice Browser */}
      <section className="vs-section">
        <h3 className="vs-section-title">Voice</h3>

        {/* Search and filter */}
        <div className="vs-voice-toolbar">
          <div className="vs-voice-search">
            <svg className="vs-voice-search-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              placeholder="Search voices..."
              value={voiceSearch}
              onChange={(e) => setVoiceSearch(e.target.value)}
              className="vs-voice-search-input"
            />
          </div>
          <div className="vs-voice-filters">
            {(['all', 'male', 'female', 'neutral'] as const).map((g) => (
              <button
                key={g}
                className={`vs-voice-filter-btn ${genderFilter === g ? 'vs-voice-filter-btn--active' : ''}`}
                onClick={() => setGenderFilter(g)}
                type="button"
              >
                {g === 'all' ? 'All' : g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Voice grid */}
        <div className="vs-voice-grid">
          {providerVoices.length === 0 ? (
            <div className="vs-voice-empty">
              No voices match your search.
            </div>
          ) : (
            providerVoices.map((voice) => (
              <button
                key={voice.id}
                className={`vs-voice-card ${config.voiceId === voice.id ? 'vs-voice-card--active' : ''}`}
                onClick={() => updateField('voiceId', voice.id)}
                type="button"
              >
                <div className="vs-voice-card-left">
                  <span className={`vs-voice-gender vs-voice-gender--${voice.gender}`}>
                    {genderIcon(voice.gender)}
                  </span>
                  <div className="vs-voice-card-info">
                    <span className="vs-voice-card-name">{voice.name}</span>
                    <div className="vs-voice-card-meta">
                      <span className="vs-voice-card-lang">{voice.language}</span>
                      {voice.accent && (
                        <span className="vs-voice-card-accent">{voice.accent}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  className="vs-voice-preview-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    previewVoice(voice.id);
                  }}
                  type="button"
                  title="Preview voice"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </button>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Section 3: Voice Tuning */}
      <section className="vs-section">
        <h3 className="vs-section-title">Voice Tuning</h3>

        <div className="vs-tuning-grid">
          {/* Speed */}
          <div className="vs-slider-group">
            <div className="vs-slider-header">
              <label className="vs-slider-label">Speed</label>
              <span className="vs-slider-value">{config.speed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              className="vs-slider"
              min={0.25}
              max={4.0}
              step={0.05}
              value={config.speed}
              onChange={(e) => updateField('speed', parseFloat(e.target.value))}
            />
            <div className="vs-slider-ticks">
              <span>0.25x</span>
              <span>1.0x</span>
              <span>4.0x</span>
            </div>
          </div>

          {/* ElevenLabs-specific sliders */}
          {config.provider === 'elevenlabs' && (
            <>
              <div className="vs-slider-group">
                <div className="vs-slider-header">
                  <label className="vs-slider-label">Stability</label>
                  <span className="vs-slider-value">{config.stability.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  className="vs-slider"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.stability}
                  onChange={(e) => updateField('stability', parseFloat(e.target.value))}
                />
                <div className="vs-slider-ticks">
                  <span>Variable</span>
                  <span>Stable</span>
                </div>
              </div>

              <div className="vs-slider-group">
                <div className="vs-slider-header">
                  <label className="vs-slider-label">Similarity Boost</label>
                  <span className="vs-slider-value">{config.similarityBoost.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  className="vs-slider"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.similarityBoost}
                  onChange={(e) => updateField('similarityBoost', parseFloat(e.target.value))}
                />
                <div className="vs-slider-ticks">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>

              <div className="vs-slider-group">
                <div className="vs-slider-header">
                  <label className="vs-slider-label">Style</label>
                  <span className="vs-slider-value">{config.style.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  className="vs-slider"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.style}
                  onChange={(e) => updateField('style', parseFloat(e.target.value))}
                />
                <div className="vs-slider-ticks">
                  <span>Neutral</span>
                  <span>Expressive</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Section 4: Output */}
      <section className="vs-section">
        <h3 className="vs-section-title">Output</h3>

        <div className="vs-output-grid">
          {/* Format selector */}
          <div className="vs-field">
            <label className="vs-field-label">Output Format</label>
            <div className="vs-format-selector">
              {OUTPUT_FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  className={`vs-format-btn ${config.outputFormat === fmt.id ? 'vs-format-btn--active' : ''}`}
                  onClick={() => updateField('outputFormat', fmt.id)}
                  type="button"
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-play toggle */}
          <div className="vs-field vs-field--row">
            <div>
              <span className="vs-field-label">Auto-play Responses</span>
              <span className="vs-field-hint">Automatically speak Helix responses aloud</span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={config.autoPlay}
                onChange={() => updateField('autoPlay', !config.autoPlay)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Volume */}
          <div className="vs-slider-group">
            <div className="vs-slider-header">
              <label className="vs-slider-label">Volume</label>
              <span className="vs-slider-value">{config.volume}%</span>
            </div>
            <input
              type="range"
              className="vs-slider"
              min={0}
              max={100}
              step={1}
              value={config.volume}
              onChange={(e) => updateField('volume', parseInt(e.target.value, 10))}
            />
            <div className="vs-slider-ticks">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Test */}
      <section className="vs-section">
        <h3 className="vs-section-title">Test</h3>

        <div className="vs-test-area">
          <textarea
            className="vs-test-input"
            value={testPhrase}
            onChange={(e) => setTestPhrase(e.target.value)}
            placeholder="Enter text to speak..."
            rows={2}
          />
          <div className="vs-test-actions">
            {playing ? (
              <button className="vs-test-btn vs-test-btn--stop" onClick={stopPlayback} type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stop
              </button>
            ) : (
              <button
                className="vs-test-btn vs-test-btn--speak"
                onClick={testSpeak}
                disabled={!connected || !testPhrase.trim()}
                type="button"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                </svg>
                Speak
              </button>
            )}
            {playing && (
              <div className="vs-test-playing">
                <div className="vs-test-playing-bar" />
                <div className="vs-test-playing-bar" />
                <div className="vs-test-playing-bar" />
                <div className="vs-test-playing-bar" />
                <div className="vs-test-playing-bar" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Save bar */}
      {isDirty && (
        <div className="vs-save-bar">
          {saveError && (
            <span className="vs-save-error">{saveError}</span>
          )}
          <span className="vs-save-indicator">Unsaved changes</span>
          <div className="vs-save-actions">
            <button className="vs-save-btn vs-save-btn--discard" onClick={discard} type="button">
              Discard
            </button>
            <button
              className="vs-save-btn vs-save-btn--save"
              onClick={save}
              disabled={saving || !connected}
              type="button"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceSettings;

/* ═══════════════════════════════════════════
   Scoped styles (vs- prefix)
   ═══════════════════════════════════════════ */

const voiceSettingsStyles = `
.vs-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 5rem;
}

/* -- Header -- */
.vs-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.vs-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  font-size: 0.8125rem;
  padding: 0.25rem 0;
  transition: color 0.15s ease;
  align-self: flex-start;
}

.vs-back-btn:hover {
  color: var(--text-primary, #fff);
}

.vs-header-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.vs-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.vs-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
}

/* -- Banner -- */
.vs-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.vs-banner--warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* -- Section -- */
.vs-section {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 1.25rem;
}

.vs-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  margin: 0 0 1rem;
}

/* -- Provider selection -- */
.vs-provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.vs-provider-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.vs-provider-card:hover {
  border-color: rgba(255,255,255,0.15);
}

.vs-provider-card--active {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.06);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15);
}

.vs-provider-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vs-provider-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.vs-provider-badge {
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.375rem;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border-radius: 3px;
}

.vs-provider-desc {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
}

.vs-provider-check {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  color: var(--accent-color, #6366f1);
}

/* -- Voice browser -- */
.vs-voice-toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.vs-voice-search {
  flex: 1;
  min-width: 160px;
  position: relative;
}

.vs-voice-search-icon {
  position: absolute;
  left: 0.625rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary, #606080);
  pointer-events: none;
}

.vs-voice-search-input {
  width: 100%;
  padding: 0.4375rem 0.625rem 0.4375rem 2rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  outline: none;
  transition: border-color 0.15s ease;
}

.vs-voice-search-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.vs-voice-search-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.vs-voice-filters {
  display: flex;
  gap: 0.25rem;
}

.vs-voice-filter-btn {
  padding: 0.375rem 0.625rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
}

.vs-voice-filter-btn:hover {
  border-color: rgba(255,255,255,0.15);
  color: var(--text-primary, #fff);
}

.vs-voice-filter-btn--active {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  color: white;
}

.vs-voice-grid {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.vs-voice-empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--text-tertiary, #606080);
  font-size: 0.8125rem;
}

.vs-voice-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.vs-voice-card:hover {
  border-color: rgba(255,255,255,0.12);
}

.vs-voice-card--active {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.06);
}

.vs-voice-card-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.vs-voice-gender {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.vs-voice-gender--male {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.vs-voice-gender--female {
  background: rgba(236, 72, 153, 0.15);
  color: #f472b6;
}

.vs-voice-gender--neutral {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.vs-voice-card-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.vs-voice-card-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.vs-voice-card-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.vs-voice-card-lang {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

.vs-voice-card-accent {
  font-size: 0.5625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.0625rem 0.25rem;
  background: rgba(255,255,255,0.06);
  border-radius: 3px;
  color: var(--text-tertiary, #606080);
}

.vs-voice-preview-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.vs-voice-preview-btn:hover {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  color: white;
}

/* -- Tuning sliders -- */
.vs-tuning-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.vs-slider-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.vs-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.vs-slider-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.vs-slider-value {
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: var(--accent-color, #6366f1);
  font-weight: 600;
}

.vs-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.vs-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  border: 2px solid var(--bg-secondary, #111127);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
  transition: transform 0.1s ease;
}

.vs-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.vs-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  border: 2px solid var(--bg-secondary, #111127);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
}

.vs-slider-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
}

/* -- Output -- */
.vs-output-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.vs-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.vs-field--row {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.vs-field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
  display: block;
}

.vs-field-hint {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  display: block;
  margin-top: 0.125rem;
}

.vs-format-selector {
  display: flex;
  gap: 0.375rem;
}

.vs-format-btn {
  padding: 0.4375rem 0.875rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: var(--font-mono, monospace);
  text-transform: uppercase;
  transition: all 0.15s ease;
}

.vs-format-btn:hover {
  border-color: rgba(255,255,255,0.15);
  color: var(--text-primary, #fff);
}

.vs-format-btn--active {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.08);
  color: var(--accent-color, #6366f1);
}

/* -- Test -- */
.vs-test-area {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.vs-test-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  outline: none;
  resize: vertical;
  min-height: 50px;
  font-family: inherit;
  transition: border-color 0.15s ease;
}

.vs-test-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.vs-test-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.vs-test-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.vs-test-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.vs-test-btn--speak {
  background: var(--accent-color, #6366f1);
  color: white;
}

.vs-test-btn--speak:hover:not(:disabled) {
  background: #4f46e5;
}

.vs-test-btn--speak:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vs-test-btn--stop {
  background: #ef4444;
  color: white;
}

.vs-test-btn--stop:hover {
  background: #dc2626;
}

/* Playing indicator - audio bars */
.vs-test-playing {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 20px;
}

.vs-test-playing-bar {
  width: 3px;
  background: var(--accent-color, #6366f1);
  border-radius: 1.5px;
  animation: vs-audio-bar 0.8s ease-in-out infinite;
}

.vs-test-playing-bar:nth-child(1) { height: 8px; animation-delay: 0s; }
.vs-test-playing-bar:nth-child(2) { height: 14px; animation-delay: 0.15s; }
.vs-test-playing-bar:nth-child(3) { height: 20px; animation-delay: 0.3s; }
.vs-test-playing-bar:nth-child(4) { height: 12px; animation-delay: 0.45s; }
.vs-test-playing-bar:nth-child(5) { height: 6px; animation-delay: 0.6s; }

@keyframes vs-audio-bar {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1.0); }
}

/* -- Save bar -- */
.vs-save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: var(--bg-secondary, #111127);
  border-top: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(12px);
  z-index: 100;
  animation: vs-slide-up 0.2s ease;
}

@keyframes vs-slide-up {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.vs-save-error {
  font-size: 0.75rem;
  color: #ef4444;
  margin-right: auto;
}

.vs-save-indicator {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  font-weight: 500;
}

.vs-save-actions {
  display: flex;
  gap: 0.5rem;
}

.vs-save-btn {
  padding: 0.4375rem 1rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.vs-save-btn--discard {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  color: var(--text-secondary, #a0a0c0);
}

.vs-save-btn--discard:hover {
  border-color: rgba(255,255,255,0.2);
  color: var(--text-primary, #fff);
}

.vs-save-btn--save {
  background: var(--accent-color, #6366f1);
  border: none;
  color: white;
}

.vs-save-btn--save:hover:not(:disabled) {
  background: #4f46e5;
}

.vs-save-btn--save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;
