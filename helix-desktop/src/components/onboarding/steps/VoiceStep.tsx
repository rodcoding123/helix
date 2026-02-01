/**
 * Voice Step - Configure Text-to-Speech (TTS) settings
 * Supports ElevenLabs, OpenAI TTS, and Edge TTS
 */

import { useState, useCallback } from 'react';
import type { OnboardingState } from '../Onboarding';
import './VoiceStep.css';

interface VoiceStepProps {
  state: OnboardingState;
  onUpdate: (updates: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

type TTSProvider = 'elevenlabs' | 'openai' | 'edge' | 'none';

interface TTSProviderConfig {
  id: TTSProvider;
  name: string;
  icon: string;
  description: string;
  features: string[];
  requiresApiKey: boolean;
  apiKeyHint?: string;
  voices?: { id: string; name: string; preview?: string }[];
  free?: boolean;
}

const TTS_PROVIDERS: TTSProviderConfig[] = [
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    icon: '🎙️',
    description: 'Premium AI voices with voice cloning and multilingual support',
    features: ['29+ languages', 'Voice cloning', 'Emotion control', 'High quality'],
    requiresApiKey: true,
    apiKeyHint: 'Get your API key from elevenlabs.io/app/settings',
    voices: [
      { id: 'rachel', name: 'Rachel', preview: 'Calm, American female' },
      { id: 'adam', name: 'Adam', preview: 'Deep, American male' },
      { id: 'antoni', name: 'Antoni', preview: 'Warm, American male' },
      { id: 'bella', name: 'Bella', preview: 'Soft, American female' },
      { id: 'josh', name: 'Josh', preview: 'Deep, American male' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI TTS',
    icon: '🤖',
    description: 'GPT-4O-mini powered text-to-speech with natural voices',
    features: ['6 voices', 'Natural cadence', 'Fast generation', 'HD quality'],
    requiresApiKey: true,
    apiKeyHint: 'Uses your OpenAI API key (same as chat)',
    voices: [
      { id: 'alloy', name: 'Alloy', preview: 'Neutral, versatile' },
      { id: 'echo', name: 'Echo', preview: 'Warm, conversational' },
      { id: 'fable', name: 'Fable', preview: 'British, narrative' },
      { id: 'onyx', name: 'Onyx', preview: 'Deep, authoritative' },
      { id: 'nova', name: 'Nova', preview: 'Energetic, friendly' },
      { id: 'shimmer', name: 'Shimmer', preview: 'Soft, expressive' },
    ],
  },
  {
    id: 'edge',
    name: 'Microsoft Edge TTS',
    icon: '🔊',
    description: 'Free, offline-capable TTS using Microsoft Edge voices',
    features: ['300+ voices', 'Offline capable', 'Free to use', '100+ languages'],
    requiresApiKey: false,
    free: true,
    voices: [
      { id: 'en-US-GuyNeural', name: 'Guy (US)', preview: 'American male' },
      { id: 'en-US-JennyNeural', name: 'Jenny (US)', preview: 'American female' },
      { id: 'en-GB-RyanNeural', name: 'Ryan (UK)', preview: 'British male' },
      { id: 'en-GB-SoniaNeural', name: 'Sonia (UK)', preview: 'British female' },
      { id: 'en-AU-NatashaNeural', name: 'Natasha (AU)', preview: 'Australian female' },
    ],
  },
  {
    id: 'none',
    name: 'No Voice',
    icon: '🔇',
    description: 'Disable text-to-speech - Helix will respond with text only',
    features: ['Text-only responses', 'Faster replies', 'No API costs'],
    requiresApiKey: false,
  },
];

type AutoTTSMode = 'off' | 'always' | 'inbound' | 'tagged';

const AUTO_TTS_MODES: { id: AutoTTSMode; label: string; description: string }[] = [
  { id: 'off', label: 'Manual', description: 'Only speak when explicitly requested' },
  { id: 'always', label: 'Always', description: 'Speak all responses automatically' },
  { id: 'inbound', label: 'Reply to Voice', description: 'Speak only when replying to voice messages' },
  { id: 'tagged', label: 'Tagged Only', description: 'Speak responses that include voice tags' },
];

export interface VoiceSettings {
  provider: TTSProvider;
  apiKey?: string;
  voiceId?: string;
  autoMode: AutoTTSMode;
  speed?: number;
  stability?: number;
}

export function VoiceStep({ state, onUpdate, onNext, onBack }: VoiceStepProps) {
  const [selectedProvider, setSelectedProvider] = useState<TTSProvider>(
    (state as { voiceSettings?: VoiceSettings }).voiceSettings?.provider || 'none'
  );
  const [apiKey, setApiKey] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState<AutoTTSMode>('off');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [stability, setStability] = useState(0.5);

  const currentProvider = TTS_PROVIDERS.find(p => p.id === selectedProvider);

  const handleProviderSelect = useCallback((providerId: TTSProvider) => {
    setSelectedProvider(providerId);
    setSelectedVoice(null);
    // Auto-select first voice for provider
    const provider = TTS_PROVIDERS.find(p => p.id === providerId);
    if (provider?.voices?.length) {
      setSelectedVoice(provider.voices[0].id);
    }
  }, []);

  const handleContinue = () => {
    const voiceSettings: VoiceSettings = {
      provider: selectedProvider,
      autoMode,
      speed,
      stability,
    };

    if (selectedProvider !== 'none') {
      if (apiKey) voiceSettings.apiKey = apiKey;
      if (selectedVoice) voiceSettings.voiceId = selectedVoice;
    }

    onUpdate({ voiceSettings } as Partial<OnboardingState>);
    onNext();
  };

  const canContinue = selectedProvider === 'none' ||
    !currentProvider?.requiresApiKey ||
    apiKey.trim().length > 0;

  return (
    <div className="onboarding-step voice-step">
      <h1>Voice Settings</h1>
      <p className="step-description">
        Helix can speak responses using AI-powered text-to-speech.
        Choose a voice provider or skip to use text-only mode.
      </p>

      {/* Provider Selection */}
      <div className="provider-grid">
        {TTS_PROVIDERS.map(provider => (
          <button
            key={provider.id}
            className={`provider-card ${selectedProvider === provider.id ? 'selected' : ''} ${provider.free ? 'free' : ''}`}
            onClick={() => handleProviderSelect(provider.id)}
          >
            <div className="provider-header">
              <span className="provider-icon">{provider.icon}</span>
              <span className="provider-name">{provider.name}</span>
              {provider.free && <span className="free-badge">Free</span>}
            </div>
            <p className="provider-description">{provider.description}</p>
            <div className="provider-features">
              {provider.features.slice(0, 3).map(f => (
                <span key={f} className="feature-tag">{f}</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Provider Configuration */}
      {selectedProvider !== 'none' && currentProvider && (
        <div className="provider-config">
          {/* API Key */}
          {currentProvider.requiresApiKey && (
            <div className="config-section">
              <label>
                <span className="label-text">API Key</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Enter your ${currentProvider.name} API key`}
                />
              </label>
              {currentProvider.apiKeyHint && (
                <p className="config-hint">{currentProvider.apiKeyHint}</p>
              )}
            </div>
          )}

          {/* Voice Selection */}
          {currentProvider.voices && (
            <div className="config-section">
              <span className="section-label">Select Voice</span>
              <div className="voice-grid">
                {currentProvider.voices.map(voice => (
                  <button
                    key={voice.id}
                    className={`voice-option ${selectedVoice === voice.id ? 'selected' : ''}`}
                    onClick={() => setSelectedVoice(voice.id)}
                  >
                    <span className="voice-name">{voice.name}</span>
                    {voice.preview && (
                      <span className="voice-preview">{voice.preview}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Auto TTS Mode */}
          <div className="config-section">
            <span className="section-label">When to Speak</span>
            <div className="auto-mode-options">
              {AUTO_TTS_MODES.map(mode => (
                <button
                  key={mode.id}
                  className={`auto-mode-option ${autoMode === mode.id ? 'selected' : ''}`}
                  onClick={() => setAutoMode(mode.id)}
                >
                  <span className="mode-label">{mode.label}</span>
                  <span className="mode-description">{mode.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Settings */}
          <button
            className="advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Settings
          </button>

          {showAdvanced && (
            <div className="advanced-settings">
              <div className="slider-group">
                <label>
                  <span className="slider-label">Speed</span>
                  <span className="slider-value">{speed.toFixed(1)}x</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                />
              </div>

              {selectedProvider === 'elevenlabs' && (
                <div className="slider-group">
                  <label>
                    <span className="slider-label">Stability</span>
                    <span className="slider-value">{Math.round(stability * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={stability}
                    onChange={(e) => setStability(parseFloat(e.target.value))}
                  />
                  <p className="slider-hint">
                    Higher = more consistent, Lower = more expressive
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="step-actions">
        <button className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button
          className="btn-primary"
          onClick={handleContinue}
          disabled={!canContinue}
        >
          {selectedProvider === 'none' ? 'Skip Voice Setup' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
