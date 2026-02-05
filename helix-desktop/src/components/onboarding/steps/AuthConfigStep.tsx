/**
 * Auth Configuration Step - Browser-based OAuth flows
 * Like mainstream apps: opens browser for authentication
 * Detects existing Claude Code credentials when available
 */

import { useState, useEffect } from 'react';
import { useOAuth } from '../../../hooks/useOAuth';
import { invoke } from '../../../lib/tauri-compat';
import * as openclawOAuth from '../../../services/openclaw-oauth';
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
  usesClaudeCode?: boolean;
}

// Claude Code CLI detection result
interface ClaudeCodeInfo {
  cliAvailable: boolean;
  cliPath: string | null;
  installed: boolean;
  authenticated: boolean;
  subscriptionType: string | null;
  expiresAt: number | null;
}

// Provider display names and icons
const PROVIDER_INFO: Record<string, { name: string; icon: string; color: string }> = {
  token: { name: 'Claude', icon: '🧠', color: '#D97706' },
  'openai-codex': { name: 'ChatGPT', icon: '🤖', color: '#10A37F' },
  'github-copilot': { name: 'GitHub Copilot', icon: '🐙', color: '#238636' },
  'google-gemini-cli': { name: 'Google Gemini', icon: '🔷', color: '#4285F4' },
  'google-antigravity': { name: 'Google', icon: '🔷', color: '#4285F4' },
  'minimax-portal': { name: 'MiniMax', icon: '⚡', color: '#FF6B35' },
  'qwen-portal': { name: 'Qwen', icon: '🌐', color: '#6366F1' },
};

// API key configurations - keyed by authChoice values
const API_KEY_CONFIG: Record<string, {
  name: string;
  hint: string;
  placeholder: string;
  docsUrl: string;
}> = {
  // Main providers (match authChoice values from ProviderSelectionStep)
  'token': {
    name: 'Anthropic API Key',
    hint: 'Get your API key from the Anthropic Console',
    placeholder: 'sk-ant-api...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  'openai-codex': {
    name: 'OpenAI API Key',
    hint: 'Get your API key from OpenAI Platform',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  'google-gemini-cli': {
    name: 'Google Gemini API Key',
    hint: 'Get your API key from Google AI Studio',
    placeholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  'google-antigravity': {
    name: 'Google AI API Key',
    hint: 'Get your API key from Google AI Studio',
    placeholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  'minimax-portal': {
    name: 'MiniMax API Key',
    hint: 'M2.1 models from MiniMax',
    placeholder: 'eyJ...',
    docsUrl: 'https://www.minimax.chat/user/basic',
  },
  'qwen-portal': {
    name: 'Qwen API Key',
    hint: 'Dashscope/Aliyun API for Qwen models',
    placeholder: 'sk-...',
    docsUrl: 'https://dashscope.console.aliyun.com/apiKey',
  },
  // Additional API key types (for direct API key entry options)
  'openrouter-api-key': {
    name: 'OpenRouter API Key',
    hint: 'Access 100+ models with one API key',
    placeholder: 'sk-or-...',
    docsUrl: 'https://openrouter.ai/keys',
  },
  'moonshot-api-key': {
    name: 'Moonshot AI API Key',
    hint: 'Kimi K2 and Kimi Coding models',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  'kimi-code-api-key': {
    name: 'Kimi Coding API Key',
    hint: 'Specialized for coding tasks',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  'zai-api-key': {
    name: 'Z.AI (GLM 4.7) API Key',
    hint: 'Zhipu AI models',
    placeholder: 'sk-...',
    docsUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  'venice-api-key': {
    name: 'Venice AI API Key',
    hint: 'Privacy-focused, uncensored models',
    placeholder: 'sk-...',
    docsUrl: 'https://venice.ai/settings/api',
  },
};

/**
 * Providers with real OAuth flows
 *
 * **Phase 1 Enhancement**: Claude (token) and OpenAI Codex now use OpenClaw OAuth
 * instead of API key redirects. This provides:
 * - Native OAuth flows (setup-token for Claude, PKCE for OpenAI)
 * - Credentials stored locally in ~/.openclaw/agents/main/agent/auth-profiles.json
 * - BYOK principle: tokens never transmitted to Helix servers
 */
const REAL_OAUTH_PROVIDERS = [
  'github-copilot',      // GitHub Device Flow
  'token',               // Claude via OpenClaw setup-token
  'openai-codex',        // OpenAI via OpenClaw PKCE
];

/**
 * Providers that show the "Get API Key" button flow
 * These still require users to manually get and enter API keys
 */
const API_KEY_REDIRECT_PROVIDERS = ['google-gemini-cli', 'google-antigravity', 'minimax-portal', 'qwen-portal'];

export function AuthConfigStep({ authChoice, onComplete, onBack }: AuthConfigStepProps) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [claudeCodeInfo, setClaudeCodeInfo] = useState<ClaudeCodeInfo | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const oauth = useOAuth();

  const hasRealOAuth = REAL_OAUTH_PROVIDERS.includes(authChoice);
  const isOpenClawOAuth = authChoice === 'token' || authChoice === 'openai-codex';
  const isGitHubOAuth = authChoice === 'github-copilot';
  const isApiKeyRedirect = API_KEY_REDIRECT_PROVIDERS.includes(authChoice);
  const isApiKeyFlow = authChoice in API_KEY_CONFIG;
  const providerInfo = PROVIDER_INFO[authChoice];
  const apiKeyConfig = API_KEY_CONFIG[authChoice];

  // Check for Claude (token) provider - can use Claude Code CLI
  // CLI must be available AND user must be authenticated
  const canUseClaudeCode = authChoice === 'token' && claudeCodeInfo?.cliAvailable && claudeCodeInfo?.authenticated;

  // Detect Claude Code credentials on mount (for Claude provider)
  useEffect(() => {
    if (authChoice === 'token') {
      setIsDetecting(true);
      invoke<ClaudeCodeInfo>('detect_claude_code')
        .then((info) => {
          setClaudeCodeInfo(info);
        })
        .catch((err) => {
          console.error('Failed to detect Claude Code:', err);
          setClaudeCodeInfo(null);
        })
        .finally(() => {
          setIsDetecting(false);
        });
    } else {
      setClaudeCodeInfo(null);
      setIsDetecting(false);
    }
  }, [authChoice]);

  // Handle using Claude Code CLI
  // We don't extract tokens - we'll use the CLI as subprocess
  const handleUseClaudeCode = () => {
    if (claudeCodeInfo?.cliAvailable && claudeCodeInfo?.authenticated) {
      onComplete({
        authChoice,
        provider: 'claude-code-cli',
        usesClaudeCode: true,
        // No token - we use the CLI subprocess
      });
    }
  };

  // Reset state when auth choice changes
  useEffect(() => {
    setApiKey('');
    setError(null);
    setShowApiKeyInput(false);
    oauth.reset();
  }, [authChoice]);

  // Handle OAuth completion (only for real OAuth like GitHub)
  useEffect(() => {
    if (oauth.status === 'success') {
      // Small delay for visual feedback
      const timer = setTimeout(() => {
        onComplete({
          authChoice,
          token: 'oauth-token', // Will be replaced with real token
          provider: authChoice,
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [oauth.status, authChoice, onComplete]);

  /**
   * Handle OpenClaw OAuth flows for Claude and OpenAI Codex
   *
   * **Phase 1 Integration**:
   * - Delegates to Module 1 service (openclaw-oauth.ts)
   * - Uses Module 2 Tauri commands (run_openclaw_oauth)
   * - Credentials stored in ~/.openclaw/agents/main/agent/auth-profiles.json
   * - BYOK: No token transmission to Helix
   */
  const handleOpenClawOAuth = async (provider: 'anthropic' | 'openai-codex') => {
    setError(null);
    setIsAuthenticating(true);

    try {
      const result =
        provider === 'anthropic'
          ? await openclawOAuth.initiateAnthropicSetupToken()
          : await openclawOAuth.initiateOpenAIPkceOAuth();

      if (result.success) {
        // OAuth completed successfully
        // Credentials are now stored in auth-profiles.json
        onComplete({
          authChoice: provider === 'anthropic' ? 'token' : 'openai-codex',
          provider: provider === 'anthropic' ? 'anthropic' : 'openai-codex',
          token: 'oauth-credential', // Managed by OpenClaw, not used directly
        });
      } else {
        setError(result.error || 'OAuth flow failed. Please try again.');
      }
    } catch (err) {
      setError(`OAuth failed: ${String(err)}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleOAuthStart = async () => {
    setError(null);
    const result = await oauth.startOAuth(authChoice);

    // If it's not real OAuth, it returns SHOW_API_KEY_INPUT
    if (!result.success && result.error === 'SHOW_API_KEY_INPUT') {
      setShowApiKeyInput(true);
      return;
    }

    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  const handleGetApiKey = async () => {
    const result = await oauth.openApiKeyPage(authChoice);
    if (result.error === 'SHOW_API_KEY_INPUT') {
      setShowApiKeyInput(true);
    }
  };

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('Please enter your API key');
      return;
    }
    setError(null);
    onComplete({ authChoice, apiKey: apiKey.trim() });
  };

  const openDocs = (url: string) => {
    oauth.openInBrowser(url);
  };

  // Render OpenClaw OAuth flow for Claude and OpenAI Codex
  // **Phase 1 Enhancement**: Native OAuth through OpenClaw
  if (isOpenClawOAuth && !showApiKeyInput) {
    return (
      <div className="auth-config-step">
        <div className="auth-header">
          <div
            className="provider-logo"
            style={{ backgroundColor: `${providerInfo?.color}20` }}
          >
            <span className="provider-icon-large">{providerInfo?.icon || '🔐'}</span>
          </div>
          <h2>Authenticate with {providerInfo?.name || 'Provider'}</h2>
          <p className="step-description">
            {authChoice === 'token'
              ? 'Set up your Claude access via OpenClaw OAuth'
              : 'Set up your OpenAI Codex access via OAuth'}
          </p>
        </div>

        <div className="oauth-content">
          {!isAuthenticating && !error && (
            <button
              type="button"
              className="oauth-signin-btn"
              onClick={() =>
                handleOpenClawOAuth(
                  authChoice === 'token' ? 'anthropic' : 'openai-codex'
                )
              }
              style={{ '--provider-color': providerInfo?.color } as React.CSSProperties}
            >
              <span className="oauth-btn-icon">{providerInfo?.icon || '🔐'}</span>
              <span className="oauth-btn-text">
                Continue with {providerInfo?.name || 'Provider'}
              </span>
              <span className="oauth-btn-arrow">→</span>
            </button>
          )}

          {isAuthenticating && (
            <div className="oauth-status initiating">
              <div className="spinner" />
              <p>
                {authChoice === 'token'
                  ? 'Launching Claude setup-token flow...'
                  : 'Launching OpenAI OAuth flow...'}
              </p>
            </div>
          )}

          {error && (
            <div className="oauth-status error">
              <div className="error-icon">✕</div>
              <h3>Authentication failed</h3>
              <p>{error}</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setError(null);
                  setIsAuthenticating(false);
                }}
              >
                Try again
              </button>
            </div>
          )}

          <p className="already-have-key">
            <button
              type="button"
              className="btn-text"
              onClick={() => setShowApiKeyInput(true)}
            >
              I already have an API key
            </button>
          </p>
        </div>

        <div className="step-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>
            ← Back
          </button>
          {isAuthenticating && (
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setIsAuthenticating(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render GitHub Copilot OAuth flow
  if (isGitHubOAuth && hasRealOAuth) {
    return (
      <div className="auth-config-step">
        <div className="auth-header">
          <div
            className="provider-logo"
            style={{ backgroundColor: `${providerInfo?.color}20` }}
          >
            <span className="provider-icon-large">{providerInfo?.icon || '🔐'}</span>
          </div>
          <h2>Sign in with {providerInfo?.name || 'Provider'}</h2>
          <p className="step-description">
            Authenticate with your GitHub account to use Copilot
          </p>
        </div>

        <div className="oauth-content">
          {/* Idle State - Show sign in button */}
          {oauth.status === 'idle' && (
            <button
              type="button"
              className="oauth-signin-btn"
              onClick={handleOAuthStart}
              style={{ '--provider-color': providerInfo?.color } as React.CSSProperties}
            >
              <span className="oauth-btn-icon">{providerInfo?.icon || '🔐'}</span>
              <span className="oauth-btn-text">
                Continue with {providerInfo?.name || 'Provider'}
              </span>
              <span className="oauth-btn-arrow">→</span>
            </button>
          )}

          {/* Initiating */}
          {oauth.status === 'initiating' && (
            <div className="oauth-status initiating">
              <div className="spinner" />
              <p>Preparing authentication...</p>
            </div>
          )}

          {/* Device Code Flow (GitHub) */}
          {(oauth.status === 'waiting-device-code' || oauth.status === 'polling') && oauth.deviceCode && (
            <div className="oauth-status device-code">
              <div className="device-code-box">
                <p className="device-code-label">Enter this code on GitHub:</p>
                <div className="device-code-value">
                  {oauth.deviceCode.userCode}
                </div>
                <button
                  type="button"
                  className="btn-copy"
                  onClick={() => navigator.clipboard.writeText(oauth.deviceCode!.userCode)}
                >
                  Copy code
                </button>
              </div>

              <div className="device-code-steps">
                <div className="step-item">
                  <span className="step-number">1</span>
                  <span>Go to <strong>github.com/login/device</strong></span>
                </div>
                <div className="step-item">
                  <span className="step-number">2</span>
                  <span>Enter the code above</span>
                </div>
                <div className="step-item">
                  <span className="step-number">3</span>
                  <span>Authorize Helix</span>
                </div>
              </div>

              {oauth.status === 'polling' && (
                <div className="polling-indicator">
                  <div className="spinner small" />
                  <span>Waiting for authorization...</span>
                </div>
              )}

              <button
                type="button"
                className="btn-secondary"
                onClick={() => oauth.openInBrowser(oauth.deviceCode!.verificationUrl)}
              >
                Open GitHub →
              </button>
            </div>
          )}

          {/* Success */}
          {oauth.status === 'success' && (
            <div className="oauth-status success">
              <div className="success-icon">✓</div>
              <h3>Successfully connected!</h3>
              <p>Redirecting...</p>
            </div>
          )}

          {/* Error */}
          {oauth.status === 'error' && (
            <div className="oauth-status error">
              <div className="error-icon">✕</div>
              <h3>Authentication failed</h3>
              <p>{oauth.error || error || 'Something went wrong'}</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  oauth.reset();
                  setError(null);
                }}
              >
                Try again
              </button>
            </div>
          )}
        </div>

        <div className="step-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>
            ← Back
          </button>
          {oauth.status !== 'idle' && oauth.status !== 'success' && (
            <button type="button" className="btn-text" onClick={oauth.cancel}>
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render "Get API Key" flow for providers like Claude, OpenAI, etc.
  // Shows Claude Code option if available, then API key options
  if (isApiKeyRedirect && !showApiKeyInput) {
    // Show loading state while detecting Claude Code
    if (authChoice === 'token' && isDetecting) {
      return (
        <div className="auth-config-step">
          <div className="auth-header">
            <div
              className="provider-logo"
              style={{ backgroundColor: `${providerInfo?.color}20` }}
            >
              <span className="provider-icon-large">{providerInfo?.icon || '🔑'}</span>
            </div>
            <h2>Connect {providerInfo?.name || 'Provider'}</h2>
            <p className="step-description">Checking for existing credentials...</p>
          </div>
          <div className="oauth-content">
            <div className="oauth-status initiating">
              <div className="spinner" />
              <p>Detecting Claude Code...</p>
            </div>
          </div>
          <div className="step-actions">
            <button type="button" className="btn-secondary" onClick={onBack}>
              ← Back
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="auth-config-step">
        <div className="auth-header">
          <div
            className="provider-logo"
            style={{ backgroundColor: `${providerInfo?.color}20` }}
          >
            <span className="provider-icon-large">{providerInfo?.icon || '🔑'}</span>
          </div>
          <h2>Connect {providerInfo?.name || 'Provider'}</h2>
          <p className="step-description">
            {canUseClaudeCode
              ? 'Claude Code detected! Use your existing credentials or enter a new API key.'
              : `You'll need an API key from ${providerInfo?.name}. Click below to get one.`}
          </p>
        </div>

        <div className="oauth-content">
          {/* Claude Code detected - show as primary option */}
          {canUseClaudeCode && (
            <>
              <button
                type="button"
                className="oauth-signin-btn claude-code-btn"
                onClick={handleUseClaudeCode}
                style={{ '--provider-color': '#7C3AED' } as React.CSSProperties}
              >
                <span className="oauth-btn-icon">✨</span>
                <span className="oauth-btn-text">
                  Use Claude Code Credentials
                </span>
                <span className="oauth-btn-arrow">→</span>
              </button>

              {claudeCodeInfo?.subscriptionType && (
                <p className="claude-code-info">
                  {claudeCodeInfo.subscriptionType === 'max' ? 'Claude Max' :
                   claudeCodeInfo.subscriptionType === 'pro' ? 'Claude Pro' :
                   'Claude'} subscription detected
                </p>
              )}

              <div className="auth-divider">
                <span>or</span>
              </div>
            </>
          )}

          {/* Get API Key button */}
          <button
            type="button"
            className={`oauth-signin-btn ${canUseClaudeCode ? 'secondary-auth' : ''}`}
            onClick={handleGetApiKey}
            style={{ '--provider-color': canUseClaudeCode ? '#6B7280' : providerInfo?.color } as React.CSSProperties}
          >
            <span className="oauth-btn-icon">🔑</span>
            <span className="oauth-btn-text">
              Get {providerInfo?.name} API Key
            </span>
            <span className="oauth-btn-arrow">→</span>
          </button>

          <p className="already-have-key">
            <button
              type="button"
              className="btn-text"
              onClick={() => setShowApiKeyInput(true)}
            >
              I already have an API key
            </button>
          </p>
        </div>

        <div className="step-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // Render API Key flow
  if (isApiKeyFlow) {
    return (
      <div className="auth-config-step">
        <div className="auth-header">
          <div
            className="provider-logo"
            style={{ backgroundColor: providerInfo ? `${providerInfo.color}20` : undefined }}
          >
            <span className="provider-icon-large">{providerInfo?.icon || '🔑'}</span>
          </div>
          <h2>Enter {providerInfo?.name || apiKeyConfig?.name || 'API Key'}</h2>
          <p className="step-description">{apiKeyConfig?.hint}</p>
        </div>

        <form className="api-key-form" onSubmit={handleApiKeySubmit}>
          <div className="input-group">
            <label htmlFor="api-key-input">API Key</label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError(null);
              }}
              placeholder={apiKeyConfig?.placeholder || 'Enter API key...'}
              className={error ? 'error' : ''}
              autoFocus
            />
            {error && <span className="error-message">{error}</span>}
          </div>

          {apiKeyConfig?.docsUrl && (
            <button
              type="button"
              className="btn-get-key"
              onClick={() => openDocs(apiKeyConfig.docsUrl)}
            >
              Get API Key →
            </button>
          )}

          <div className="security-note">
            <span className="lock-icon">🔒</span>
            <p>Your API key is encrypted and stored securely in your system's keychain. It never leaves your device.</p>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onBack}>
              ← Back
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!apiKey.trim()}
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Fallback for unknown auth types
  return (
    <div className="auth-config-step">
      <h2>Configure Authentication</h2>
      <p>Unknown authentication type: {authChoice}</p>
      <button type="button" className="btn-secondary" onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}
