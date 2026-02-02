import { useState } from 'react';
import { useKeyring } from '../../../hooks/useKeyring';
import type { OnboardingState } from '../Onboarding';
import './Steps.css';

interface ApiKeyStepProps {
  state: OnboardingState;
  onUpdate: (updates: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

type Provider = 'anthropic' | 'openai' | 'google';

export function ApiKeyStep({ state, onUpdate, onNext, onBack }: ApiKeyStepProps) {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(state.apiProvider ?? null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setApiKey: storeApiKey } = useKeyring();

  const handleProviderSelect = (provider: Provider) => {
    setSelectedProvider(provider);
    setError(null);
  };

  const handleSave = async () => {
    if (!selectedProvider || !apiKey.trim()) {
      setError('Please select a provider and enter your API key');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await storeApiKey(selectedProvider, apiKey.trim());
      onUpdate({
        apiProvider: selectedProvider,
        apiKeySet: true,
      });
      onNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const providers = [
    {
      id: 'anthropic' as const,
      name: 'Anthropic',
      description: 'Claude models (Recommended)',
      placeholder: 'sk-ant-...',
    },
    {
      id: 'openai' as const,
      name: 'OpenAI',
      description: 'GPT models',
      placeholder: 'sk-...',
    },
    {
      id: 'google' as const,
      name: 'Google',
      description: 'Gemini models',
      placeholder: 'AIza...',
    },
  ];

  return (
    <div className="onboarding-step apikey-step">
      <h1>Connect Your AI Provider</h1>
      <p className="step-description">
        Helix needs access to an AI model. Your API key is stored securely
        in your system's keychain and never leaves your device.
      </p>

      <div className="provider-options">
        {providers.map(provider => (
          <button
            key={provider.id}
            className={`provider-option ${selectedProvider === provider.id ? 'selected' : ''}`}
            onClick={() => handleProviderSelect(provider.id)}
          >
            <span className="provider-name">{provider.name}</span>
            <span className="provider-description">{provider.description}</span>
          </button>
        ))}
      </div>

      {selectedProvider && (
        <div className="api-key-input">
          <label>API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={providers.find(p => p.id === selectedProvider)?.placeholder}
          />
          <p className="input-hint">
            Get your API key from the {selectedProvider === 'anthropic' ? 'Anthropic Console' :
            selectedProvider === 'openai' ? 'OpenAI Dashboard' : 'Google AI Studio'}
          </p>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <div className="step-buttons">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button
          className="primary-button"
          onClick={handleSave}
          disabled={!selectedProvider || !apiKey.trim() || saving}
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
