/**
 * Auth Configuration Step - OAuth flows and API key entry
 * Handles the actual authentication based on the selected provider
 */

import { useState, useEffect } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { AuthChoice } from './ProviderSelectionStep';
import './AuthConfigStep.css';

interface AuthConfigStepProps {
  authChoice: AuthChoice;
  onComplete: (config: AuthConfig) => void;
  onBack: () => void;
}

export interface AuthConfig {
  authChoice: AuthChoice;
  token?: string;
  apiKey?: string;
  provider?: string;
}

// OAuth endpoints and instructions
const OAUTH_CONFIG: Record<string, { name: string; hint: string; setupCommand?: string }> = {
  token: {
    name: 'Anthropic (Claude)',
    hint: 'Run `claude setup-token` in another terminal, then paste the token here.',
    setupCommand: 'claude setup-token',
  },
  'openai-codex': {
    name: 'OpenAI Codex',
    hint: 'This will open a browser window to authenticate with ChatGPT.',
  },
  'github-copilot': {
    name: 'GitHub Copilot',
    hint: 'This will start a device code flow. Follow the prompts to authenticate with GitHub.',
  },
  'google-antigravity': {
    name: 'Google (Antigravity)',
    hint: 'This will open a browser window to authenticate with Google.',
  },
  'google-gemini-cli': {
    name: 'Google (Gemini CLI)',
    hint: 'This will open a browser window to authenticate with Google.',
  },
  'minimax-portal': {
    name: 'MiniMax',
    hint: 'This will open a browser window to authenticate with MiniMax. New users get a 3-day free trial!',
  },
  'qwen-portal': {
    name: 'Qwen',
    hint: 'This will open a browser window to authenticate with Qwen.',
  },
  chutes: {
    name: 'Chutes',
    hint: 'This will open a browser window to authenticate with Chutes.',
  },
};

// API key configurations
const API_KEY_CONFIG: Record<string, { name: string; hint: string; placeholder: string; pattern: RegExp }> = {
  apiKey: {
    name: 'Anthropic API Key',
    hint: 'Get your API key from console.anthropic.com',
    placeholder: 'sk-ant-api...',
    pattern: /^sk-ant-api[a-zA-Z0-9_-]+$/,
  },
  'openai-api-key': {
    name: 'OpenAI API Key',
    hint: 'Get your API key from platform.openai.com',
    placeholder: 'sk-...',
    pattern: /^sk-[a-zA-Z0-9_-]+$/,
  },
  'gemini-api-key': {
    name: 'Google Gemini API Key',
    hint: 'Get your API key from aistudio.google.com',
    placeholder: 'AIza...',
    pattern: /^AIza[a-zA-Z0-9_-]+$/,
  },
  'openrouter-api-key': {
    name: 'OpenRouter API Key',
    hint: 'Get your API key from openrouter.ai',
    placeholder: 'sk-or-...',
    pattern: /^sk-or-[a-zA-Z0-9_-]+$/,
  },
  'moonshot-api-key': {
    name: 'Moonshot AI API Key',
    hint: 'Get your API key from moonshot.ai',
    placeholder: 'sk-...',
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  'kimi-code-api-key': {
    name: 'Kimi Coding API Key',
    hint: 'Get your API key from moonshot.ai',
    placeholder: 'sk-...',
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  'zai-api-key': {
    name: 'Z.AI (GLM 4.7) API Key',
    hint: 'Get your API key from zhipu.ai',
    placeholder: 'sk-...',
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  'xiaomi-api-key': {
    name: 'Xiaomi API Key',
    hint: 'Get your API key from Xiaomi AI',
    placeholder: 'sk-...',
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  'synthetic-api-key': {
    name: 'Synthetic API Key',
    hint: 'Get your API key from synthetic.ai',
    placeholder: 'sk-...',
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  'venice-api-key': {
    name: 'Venice AI API Key',
    hint: 'Get your API key from venice.ai',
    placeholder: 'sk-...',
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  'ai-gateway-api-key': {
    name: 'Vercel AI Gateway API Key',
    hint: 'Get your API key from Vercel',
    placeholder: 'sk-...',
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  'opencode-zen': {
    name: 'OpenCode Zen API Key',
    hint: 'Get your API key from opencode.ai/zen',
    placeholder: 'sk-...',
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  'minimax-api': {
    name: 'MiniMax API Key',
    hint: 'Get your API key from minimax.chat',
    placeholder: 'eyJ...',
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  'minimax-api-lightning': {
    name: 'MiniMax Lightning API Key',
    hint: 'Get your API key from minimax.chat',
    placeholder: 'eyJ...',
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  'copilot-proxy': {
    name: 'Copilot Proxy',
    hint: 'Configure the local Copilot proxy URL',
    placeholder: 'http://localhost:11435',
    pattern: /^https?:\/\/.+$/,
  },
};

export function AuthConfigStep({ authChoice, onComplete, onBack }: AuthConfigStepProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  const isOAuthFlow = authChoice in OAUTH_CONFIG && authChoice !== 'token';
  const isTokenFlow = authChoice === 'token';
  const isApiKeyFlow = authChoice in API_KEY_CONFIG;

  const config = isOAuthFlow || isTokenFlow
    ? OAUTH_CONFIG[authChoice]
    : API_KEY_CONFIG[authChoice];

  useEffect(() => {
    // Reset state when auth choice changes
    setInputValue('');
    setError(null);
    setOauthStatus('idle');
  }, [authChoice]);

  const handleOAuthStart = async () => {
    setIsLoading(true);
    setOauthStatus('pending');
    setError(null);

    try {
      // For now, we'll show the user the instructions
      // In the future, this will call the gateway to initiate the OAuth flow
      // The gateway will return a URL to open or device code to display

      // TODO: Call gateway RPC to initiate OAuth flow
      // const result = await gatewayClient.request('auth.initiate', { choice: authChoice });

      // Simulate OAuth flow for now
      if (authChoice === 'github-copilot') {
        // Device code flow - would show a code to enter at github.com/login/device
        await new Promise(resolve => setTimeout(resolve, 1000));
        setOauthStatus('success');
        onComplete({ authChoice, provider: 'github-copilot' });
      } else {
        // Browser OAuth flow
        await new Promise(resolve => setTimeout(resolve, 1000));
        setOauthStatus('success');
        onComplete({ authChoice, provider: authChoice });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth flow failed');
      setOauthStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenSubmit = () => {
    if (!inputValue.trim()) {
      setError('Please enter the token');
      return;
    }

    // Anthropic setup-token starts with sk-ant-oat01-
    if (!inputValue.trim().startsWith('sk-ant-oat01-')) {
      setError('Invalid setup token. It should start with sk-ant-oat01-');
      return;
    }

    setError(null);
    onComplete({ authChoice, token: inputValue.trim() });
  };

  const handleApiKeySubmit = () => {
    if (!inputValue.trim()) {
      setError('Please enter the API key');
      return;
    }

    const keyConfig = API_KEY_CONFIG[authChoice];
    if (keyConfig?.pattern && !keyConfig.pattern.test(inputValue.trim())) {
      setError(`Invalid API key format. Expected format: ${keyConfig.placeholder}`);
      return;
    }

    setError(null);
    onComplete({ authChoice, apiKey: inputValue.trim() });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTokenFlow) {
      handleTokenSubmit();
    } else if (isApiKeyFlow) {
      handleApiKeySubmit();
    }
  };

  const openSetupTokenDocs = () => {
    openUrl('https://docs.anthropic.com/en/docs/claude-code/setup');
  };

  return (
    <div className="auth-config-step">
      <h2>Configure {config?.name || 'Authentication'}</h2>
      <p className="step-description">{config?.hint}</p>

      {/* OAuth Flow */}
      {isOAuthFlow && (
        <div className="oauth-section">
          {oauthStatus === 'idle' && (
            <button
              type="button"
              className="btn-oauth"
              onClick={handleOAuthStart}
              disabled={isLoading}
            >
              <span className="oauth-icon">🔐</span>
              <span>Authenticate with {config?.name}</span>
            </button>
          )}

          {oauthStatus === 'pending' && (
            <div className="oauth-status pending">
              <div className="spinner" />
              <p>Waiting for authentication...</p>
              <p className="oauth-hint">Complete the authentication in the browser window</p>
            </div>
          )}

          {oauthStatus === 'success' && (
            <div className="oauth-status success">
              <span className="status-icon">✓</span>
              <p>Authentication successful!</p>
            </div>
          )}

          {oauthStatus === 'error' && (
            <div className="oauth-status error">
              <span className="status-icon">✕</span>
              <p>Authentication failed</p>
              <button type="button" className="btn-retry" onClick={handleOAuthStart}>
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Token Flow (Anthropic setup-token) */}
      {isTokenFlow && (
        <form className="token-section" onSubmit={handleSubmit}>
          <div className="setup-instructions">
            <p>To get your setup token:</p>
            <ol>
              <li>Open a new terminal window</li>
              <li>Run: <code>claude setup-token</code></li>
              <li>Complete the authentication in your browser</li>
              <li>Copy the token that appears in the terminal</li>
              <li>Paste it below</li>
            </ol>
            <button type="button" className="btn-text" onClick={openSetupTokenDocs}>
              View documentation →
            </button>
          </div>

          <div className="input-group">
            <label htmlFor="token-input">Setup Token</label>
            <input
              id="token-input"
              type="password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="sk-ant-oat01-..."
              className={error ? 'error' : ''}
            />
            {error && <span className="error-message">{error}</span>}
          </div>

          <button type="submit" className="btn-primary" disabled={!inputValue.trim()}>
            Continue
          </button>
        </form>
      )}

      {/* API Key Flow */}
      {isApiKeyFlow && !isTokenFlow && (
        <form className="api-key-section" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="api-key-input">{config?.name}</label>
            <input
              id="api-key-input"
              type="password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={API_KEY_CONFIG[authChoice]?.placeholder || 'Enter API key...'}
              className={error ? 'error' : ''}
            />
            {error && <span className="error-message">{error}</span>}
          </div>

          <button type="submit" className="btn-primary" disabled={!inputValue.trim()}>
            Continue
          </button>
        </form>
      )}

      <div className="step-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
