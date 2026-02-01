/**
 * Provider Selection Step - All 14 provider groups with OAuth + API key options
 * Mirrors OpenClaw's auth-choice-options.ts
 */

import { useState } from 'react';
import './ProviderSelectionStep.css';

export type AuthChoice =
  | 'token'  // Anthropic setup-token (OAuth)
  | 'apiKey' // Anthropic API key
  | 'openai-codex' // OpenAI Codex OAuth
  | 'openai-api-key'
  | 'chutes' // Chutes OAuth
  | 'github-copilot' // GitHub device flow
  | 'copilot-proxy'
  | 'gemini-api-key'
  | 'google-antigravity' // Google OAuth
  | 'google-gemini-cli' // Google OAuth
  | 'openrouter-api-key'
  | 'moonshot-api-key'
  | 'kimi-code-api-key'
  | 'minimax-portal' // MiniMax OAuth
  | 'minimax-api'
  | 'minimax-api-lightning'
  | 'qwen-portal' // Qwen OAuth
  | 'zai-api-key'
  | 'xiaomi-api-key'
  | 'synthetic-api-key'
  | 'venice-api-key'
  | 'ai-gateway-api-key'
  | 'opencode-zen'
  | 'skip';

interface AuthOption {
  value: AuthChoice;
  label: string;
  hint?: string;
  isOAuth?: boolean;
}

interface ProviderGroup {
  id: string;
  label: string;
  hint: string;
  icon: string;
  options: AuthOption[];
  recommended?: boolean;
}

// Provider groups matching OpenClaw's auth-choice-options.ts
const PROVIDER_GROUPS: ProviderGroup[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    hint: 'Claude models - Best for coding and reasoning',
    icon: '🧠',
    recommended: true,
    options: [
      { value: 'token', label: 'Login with Claude', hint: 'Recommended - Use your Claude subscription', isOAuth: true },
      { value: 'apiKey', label: 'API Key', hint: 'For developers with API access' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    hint: 'GPT-4 and Codex models',
    icon: '🤖',
    options: [
      { value: 'openai-codex', label: 'Login with ChatGPT', hint: 'Use your ChatGPT subscription', isOAuth: true },
      { value: 'openai-api-key', label: 'API Key', hint: 'For developers with API access' },
    ],
  },
  {
    id: 'google',
    label: 'Google',
    hint: 'Gemini models',
    icon: '🔷',
    options: [
      { value: 'google-gemini-cli', label: 'Login with Google (Gemini CLI)', hint: 'OAuth via Gemini CLI', isOAuth: true },
      { value: 'google-antigravity', label: 'Login with Google (Antigravity)', hint: 'OAuth via Antigravity', isOAuth: true },
      { value: 'gemini-api-key', label: 'Gemini API Key', hint: 'For developers with API access' },
    ],
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    hint: 'Use your Copilot subscription',
    icon: '🐙',
    options: [
      { value: 'github-copilot', label: 'Login with GitHub', hint: 'Device flow authentication', isOAuth: true },
      { value: 'copilot-proxy', label: 'Copilot Proxy', hint: 'Local proxy for VS Code' },
    ],
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    hint: 'M2.1 models - Fast and capable',
    icon: '⚡',
    options: [
      { value: 'minimax-portal', label: 'Login with MiniMax', hint: '3-day free trial for new users!', isOAuth: true },
      { value: 'minimax-api', label: 'M2.1 API Key' },
      { value: 'minimax-api-lightning', label: 'M2.1 Lightning', hint: 'Faster, higher output cost' },
    ],
  },
  {
    id: 'qwen',
    label: 'Qwen',
    hint: 'Alibaba\'s Qwen models',
    icon: '🌐',
    options: [
      { value: 'qwen-portal', label: 'Login with Qwen', isOAuth: true },
    ],
  },
  {
    id: 'moonshot',
    label: 'Moonshot AI',
    hint: 'Kimi K2 and Kimi Coding',
    icon: '🌙',
    options: [
      { value: 'moonshot-api-key', label: 'Moonshot API Key' },
      { value: 'kimi-code-api-key', label: 'Kimi Coding API Key' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'Access 100+ models via one API',
    icon: '🔀',
    options: [
      { value: 'openrouter-api-key', label: 'OpenRouter API Key' },
    ],
  },
  {
    id: 'zai',
    label: 'Z.AI (GLM 4.7)',
    hint: 'Zhipu AI models',
    icon: '🔮',
    options: [
      { value: 'zai-api-key', label: 'Z.AI API Key' },
    ],
  },
  {
    id: 'ai-gateway',
    label: 'Vercel AI Gateway',
    hint: 'Multi-provider gateway',
    icon: '▲',
    options: [
      { value: 'ai-gateway-api-key', label: 'AI Gateway API Key' },
    ],
  },
  {
    id: 'opencode-zen',
    label: 'OpenCode Zen',
    hint: 'Claude, GPT, Gemini via opencode.ai/zen',
    icon: '🧘',
    options: [
      { value: 'opencode-zen', label: 'OpenCode Zen API Key' },
    ],
  },
  {
    id: 'xiaomi',
    label: 'Xiaomi',
    hint: 'Xiaomi AI models',
    icon: '📱',
    options: [
      { value: 'xiaomi-api-key', label: 'Xiaomi API Key' },
    ],
  },
  {
    id: 'synthetic',
    label: 'Synthetic',
    hint: 'Anthropic-compatible multi-model',
    icon: '🔬',
    options: [
      { value: 'synthetic-api-key', label: 'Synthetic API Key' },
    ],
  },
  {
    id: 'venice',
    label: 'Venice AI',
    hint: 'Privacy-focused, uncensored models',
    icon: '🎭',
    options: [
      { value: 'venice-api-key', label: 'Venice API Key' },
    ],
  },
];

interface ProviderSelectionStepProps {
  mode: 'quickstart' | 'advanced';
  onSelect: (choice: AuthChoice) => void;
  onBack: () => void;
  onSkip?: () => void;
}

export function ProviderSelectionStep({
  mode,
  onSelect,
  onBack,
  onSkip,
}: ProviderSelectionStepProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>('anthropic');
  const [selectedChoice, setSelectedChoice] = useState<AuthChoice | null>(null);

  const handleGroupClick = (groupId: string) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  const handleOptionSelect = (choice: AuthChoice) => {
    setSelectedChoice(choice);
  };

  const handleContinue = () => {
    if (selectedChoice) {
      onSelect(selectedChoice);
    }
  };

  // In quickstart mode, show OAuth options more prominently
  const sortedGroups = mode === 'quickstart'
    ? [...PROVIDER_GROUPS].sort((a, b) => {
        // Recommended first
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        // OAuth-first providers next
        const aHasOAuth = a.options.some(o => o.isOAuth);
        const bHasOAuth = b.options.some(o => o.isOAuth);
        if (aHasOAuth && !bHasOAuth) return -1;
        if (!aHasOAuth && bHasOAuth) return 1;
        return 0;
      })
    : PROVIDER_GROUPS;

  return (
    <div className="provider-selection-step">
      <h2>Choose your AI Provider</h2>
      <p className="step-description">
        {mode === 'quickstart'
          ? 'Select your preferred AI provider. OAuth login is recommended for the easiest setup.'
          : 'Select your AI provider and authentication method.'}
      </p>

      <div className="provider-groups">
        {sortedGroups.map((group) => (
          <div
            key={group.id}
            className={`provider-group ${expandedGroup === group.id ? 'expanded' : ''} ${group.recommended ? 'recommended' : ''}`}
          >
            <button
              type="button"
              className="provider-group-header"
              onClick={() => handleGroupClick(group.id)}
            >
              <span className="provider-icon">{group.icon}</span>
              <div className="provider-info">
                <span className="provider-label">{group.label}</span>
                <span className="provider-hint">{group.hint}</span>
              </div>
              {group.recommended && <span className="recommended-badge">Recommended</span>}
              <span className="expand-icon">{expandedGroup === group.id ? '−' : '+'}</span>
            </button>

            {expandedGroup === group.id && (
              <div className="provider-options">
                {group.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`provider-option ${selectedChoice === option.value ? 'selected' : ''} ${option.isOAuth ? 'oauth' : ''}`}
                    onClick={() => handleOptionSelect(option.value)}
                  >
                    <span className="option-indicator">
                      {selectedChoice === option.value ? '●' : '○'}
                    </span>
                    <div className="option-content">
                      <span className="option-label">
                        {option.label}
                        {option.isOAuth && <span className="oauth-badge">OAuth</span>}
                      </span>
                      {option.hint && <span className="option-hint">{option.hint}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="step-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <div className="action-group">
          {onSkip && (
            <button type="button" className="btn-text" onClick={onSkip}>
              Skip for now
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={handleContinue}
            disabled={!selectedChoice}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export { PROVIDER_GROUPS };
