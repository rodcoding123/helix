import { useConfigStore, type ModelConfig } from '../../stores/configStore';

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-20241022'] },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'google', name: 'Google', models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
  { id: 'local', name: 'Local', models: ['ollama/llama3', 'ollama/mixtral'] },
] as const;

export function ModelSettings() {
  const { config, updateConfig } = useConfigStore();

  const handleChange = (field: keyof ModelConfig, value: string | number) => {
    updateConfig('model', { [field]: value });
  };

  const handleProviderChange = (provider: string) => {
    const providerConfig = PROVIDERS.find((p) => p.id === provider);
    if (providerConfig) {
      updateConfig('model', {
        provider: provider as ModelConfig['provider'],
        model: providerConfig.models[0],
      });
    }
  };

  const currentProvider = PROVIDERS.find((p) => p.id === config.model.provider);

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Model Settings</h1>
        <p>Configure AI model and parameters</p>
      </header>

      <div className="settings-group">
        <h3>Provider</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">AI Provider</div>
            <div className="settings-item-description">
              Select your preferred AI provider
            </div>
          </div>
          <select
            className="settings-select"
            value={config.model.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            {PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Model</div>
            <div className="settings-item-description">
              Select the specific model to use
            </div>
          </div>
          <select
            className="settings-select"
            value={config.model.model}
            onChange={(e) => handleChange('model', e.target.value)}
          >
            {currentProvider?.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-group">
        <h3>Parameters</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Temperature</div>
            <div className="settings-item-description">
              Higher values make output more random
            </div>
          </div>
          <div className="settings-slider">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.model.temperature}
              onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            />
            <span className="settings-slider-value">
              {config.model.temperature.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Max Tokens</div>
            <div className="settings-item-description">
              Maximum response length
            </div>
          </div>
          <select
            className="settings-select"
            value={config.model.maxTokens}
            onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
          >
            <option value="2048">2,048</option>
            <option value="4096">4,096</option>
            <option value="8192">8,192</option>
            <option value="16384">16,384</option>
            <option value="32768">32,768</option>
          </select>
        </div>
      </div>

      <div className="settings-group">
        <h3>API Key</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">API Key Status</div>
            <div className="settings-item-description">
              Stored securely in system keyring
            </div>
          </div>
          <button className="secondary-button">
            Update API Key
          </button>
        </div>
      </div>
    </div>
  );
}
