/**
 * Auth Profile Manager - Comprehensive auth profile management dashboard
 *
 * Features:
 *   - List of auth profiles (Anthropic, OpenAI, Google, DeepSeek, Azure, etc.)
 *   - Each profile shows: provider name, icon/badge, status, usage stats
 *   - Add new profile via OAuth flow or direct API key entry
 *   - Profile ordering via drag-and-drop (priority for failover)
 *   - Profile health check / repair per profile
 *   - API key direct entry with masked input (show/hide toggle)
 *   - Usage statistics: requests today, tokens used, cost estimate
 *   - Delete profile with confirmation dialog
 *
 * Gateway Methods:
 *   - auth.profiles.list     -> List all auth profiles
 *   - auth.profiles.add      -> Add a new profile (OAuth or API key)
 *   - auth.profiles.delete   -> Remove a profile
 *   - auth.profiles.check    -> Health check a profile
 *   - auth.profiles.reorder  -> Reorder profiles (failover priority)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { OAuthFlowDialog } from './OAuthFlowDialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthProfileUsage {
  requestsToday: number;
  tokensUsed: number;
  costEstimate: number;
}

export interface AuthProfile {
  id: string;
  provider: string;
  label: string;
  status: 'active' | 'expired' | 'error' | 'unchecked';
  lastChecked?: string;
  usage?: AuthProfileUsage;
  createdAt: string;
  authMethod: 'oauth' | 'api_key';
  errorMessage?: string;
}

type AddMethod = 'oauth' | 'api_key' | null;

// ---------------------------------------------------------------------------
// Provider Constants
// ---------------------------------------------------------------------------

interface ProviderInfo {
  id: string;
  name: string;
  color: string;
  icon: string;
  supportsOAuth: boolean;
  apiKeyPrefix?: string;
  apiKeyPlaceholder: string;
  apiKeyPattern?: RegExp;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#D4A574',
    icon: 'A',
    supportsOAuth: false,
    apiKeyPrefix: 'sk-ant-',
    apiKeyPlaceholder: 'sk-ant-api03-...',
    apiKeyPattern: /^sk-ant-/,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10A37F',
    icon: 'O',
    supportsOAuth: true,
    apiKeyPrefix: 'sk-',
    apiKeyPlaceholder: 'sk-proj-...',
    apiKeyPattern: /^sk-/,
  },
  {
    id: 'google',
    name: 'Google',
    color: '#4285F4',
    icon: 'G',
    supportsOAuth: true,
    apiKeyPlaceholder: 'AIza...',
    apiKeyPattern: /^AIza/,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#0066FF',
    icon: 'D',
    supportsOAuth: false,
    apiKeyPrefix: 'sk-',
    apiKeyPlaceholder: 'sk-...',
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    color: '#0078D4',
    icon: 'Az',
    supportsOAuth: true,
    apiKeyPlaceholder: 'Enter your Azure API key...',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    color: '#FF7000',
    icon: 'M',
    supportsOAuth: false,
    apiKeyPlaceholder: 'Enter your Mistral API key...',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    color: '#39594D',
    icon: 'C',
    supportsOAuth: false,
    apiKeyPlaceholder: 'Enter your Cohere API key...',
  },
  {
    id: 'groq',
    name: 'Groq',
    color: '#F55036',
    icon: 'Gq',
    supportsOAuth: false,
    apiKeyPrefix: 'gsk_',
    apiKeyPlaceholder: 'gsk_...',
    apiKeyPattern: /^gsk_/,
  },
];

function getProviderInfo(providerId: string): ProviderInfo {
  return (
    PROVIDERS.find((p) => p.id === providerId) ?? {
      id: providerId,
      name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
      color: '#8b5cf6',
      icon: providerId.charAt(0).toUpperCase(),
      supportsOAuth: false,
      apiKeyPlaceholder: 'Enter your API key...',
    }
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(cost: number): string {
  if (cost < 0.01) return '< $0.01';
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function statusLabel(status: AuthProfile['status']): { text: string; cls: string } {
  switch (status) {
    case 'active':
      return { text: 'Active', cls: 'apm-status--active' };
    case 'expired':
      return { text: 'Expired', cls: 'apm-status--expired' };
    case 'error':
      return { text: 'Error', cls: 'apm-status--error' };
    case 'unchecked':
      return { text: 'Unchecked', cls: 'apm-status--unchecked' };
  }
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 7) + '...' + key.slice(-4);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Profile card in the list. */
function ProfileCard({
  profile,
  index,
  totalProfiles,
  checking,
  onCheck,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  profile: AuthProfile;
  index: number;
  totalProfiles: number;
  checking: boolean;
  onCheck: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const provider = getProviderInfo(profile.provider);
  const st = statusLabel(profile.status);

  return (
    <div
      className={`apm-card ${profile.status === 'active' ? 'apm-card--active' : ''} ${profile.status === 'error' ? 'apm-card--error' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      {/* Priority badge */}
      <div className="apm-card__priority" title="Failover priority">
        #{index + 1}
      </div>

      {/* Header row: icon + name + status */}
      <div className="apm-card__header">
        <div
          className="apm-card__provider-icon"
          style={{ backgroundColor: provider.color }}
          title={provider.name}
        >
          {provider.icon}
        </div>
        <div className="apm-card__info">
          <div className="apm-card__name-row">
            <span className="apm-card__label">{profile.label}</span>
            <span className="apm-card__method">
              {profile.authMethod === 'oauth' ? 'OAuth' : 'API Key'}
            </span>
          </div>
          <div className="apm-card__provider-name">{provider.name}</div>
        </div>
        <div className={`apm-card__status ${st.cls}`}>
          <span className="apm-card__status-dot" />
          {st.text}
        </div>
      </div>

      {/* Error message if any */}
      {profile.status === 'error' && profile.errorMessage && (
        <div className="apm-card__error-msg">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>{profile.errorMessage}</span>
        </div>
      )}

      {/* Usage stats */}
      {profile.usage && (
        <div className="apm-card__usage">
          <div className="apm-card__usage-item">
            <span className="apm-card__usage-label">Requests</span>
            <span className="apm-card__usage-value">{profile.usage.requestsToday}</span>
          </div>
          <div className="apm-card__usage-item">
            <span className="apm-card__usage-label">Tokens</span>
            <span className="apm-card__usage-value">{formatTokens(profile.usage.tokensUsed)}</span>
          </div>
          <div className="apm-card__usage-item">
            <span className="apm-card__usage-label">Cost</span>
            <span className="apm-card__usage-value">{formatCost(profile.usage.costEstimate)}</span>
          </div>
        </div>
      )}

      {/* Last checked */}
      {profile.lastChecked && (
        <div className="apm-card__checked">
          Checked {formatRelativeTime(profile.lastChecked)}
        </div>
      )}

      {/* Footer: actions */}
      <div className="apm-card__actions">
        <div className="apm-card__reorder">
          <button
            className="apm-card__reorder-btn"
            disabled={index === 0}
            onClick={onMoveUp}
            title="Move up (higher priority)"
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2L2 7h8L6 2z" fill="currentColor" />
            </svg>
          </button>
          <button
            className="apm-card__reorder-btn"
            disabled={index === totalProfiles - 1}
            onClick={onMoveDown}
            title="Move down (lower priority)"
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 10L2 5h8L6 10z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div className="apm-card__action-btns">
          <button
            className="apm-btn apm-btn--secondary apm-btn--sm"
            onClick={onCheck}
            disabled={checking}
            type="button"
          >
            {checking ? (
              <>
                <span className="apm-spinner apm-spinner--sm" />
                Checking...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Health Check
              </>
            )}
          </button>
          <button
            className="apm-btn apm-btn--danger apm-btn--sm"
            onClick={onDelete}
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/** Add profile dialog: choose method (OAuth or API key), then provider, then credentials. */
function AddProfileDialog({
  onAdd,
  onStartOAuth,
  onClose,
  adding,
}: {
  onAdd: (provider: string, apiKey: string, label: string) => void;
  onStartOAuth: (provider: string) => void;
  onClose: () => void;
  adding: boolean;
}) {
  const [step, setStep] = useState<'method' | 'provider' | 'credentials'>('method');
  const [method, setMethod] = useState<AddMethod>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [label, setLabel] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const provider = selectedProvider ? getProviderInfo(selectedProvider) : null;

  // Available providers for each method
  const availableProviders = useMemo(() => {
    if (method === 'oauth') {
      return PROVIDERS.filter((p) => p.supportsOAuth);
    }
    return PROVIDERS;
  }, [method]);

  const handleMethodSelect = (m: AddMethod) => {
    setMethod(m);
    setStep('provider');
    setSelectedProvider('');
    setApiKey('');
    setLabel('');
    setValidationError(null);
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    const prov = getProviderInfo(providerId);
    setLabel(`${prov.name} API Key`);

    if (method === 'oauth') {
      // Start OAuth flow immediately
      onStartOAuth(providerId);
    } else {
      setStep('credentials');
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleSubmit = () => {
    if (!apiKey.trim()) {
      setValidationError('API key is required');
      return;
    }

    // Optional pattern validation
    if (provider?.apiKeyPattern && !provider.apiKeyPattern.test(apiKey.trim())) {
      setValidationError(
        `This doesn't look like a valid ${provider.name} API key. Expected format: ${provider.apiKeyPlaceholder}`
      );
      return;
    }

    setValidationError(null);
    onAdd(selectedProvider, apiKey.trim(), label.trim() || `${provider?.name ?? selectedProvider} Key`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && apiKey.trim()) {
      handleSubmit();
    }
  };

  return (
    <div className="apm-modal-overlay" onClick={onClose}>
      <div className="apm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="apm-modal__header">
          <h3 className="apm-modal__title">
            {step === 'method' && 'Add Auth Profile'}
            {step === 'provider' && (method === 'oauth' ? 'Select OAuth Provider' : 'Select Provider')}
            {step === 'credentials' && `Enter ${provider?.name ?? ''} API Key`}
          </h3>
          <button className="apm-modal__close" onClick={onClose} type="button">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="apm-modal__breadcrumb">
          <span
            className={`apm-modal__crumb ${step === 'method' ? 'apm-modal__crumb--active' : 'apm-modal__crumb--done'}`}
            onClick={() => { setStep('method'); setMethod(null); }}
          >
            1. Method
          </span>
          <span className="apm-modal__crumb-sep">&rsaquo;</span>
          <span
            className={`apm-modal__crumb ${step === 'provider' ? 'apm-modal__crumb--active' : step === 'credentials' ? 'apm-modal__crumb--done' : ''}`}
            onClick={() => { if (method) setStep('provider'); }}
          >
            2. Provider
          </span>
          {method === 'api_key' && (
            <>
              <span className="apm-modal__crumb-sep">&rsaquo;</span>
              <span className={`apm-modal__crumb ${step === 'credentials' ? 'apm-modal__crumb--active' : ''}`}>
                3. Credentials
              </span>
            </>
          )}
        </div>

        {/* Step 1: Choose method */}
        {step === 'method' && (
          <div className="apm-modal__methods">
            <button
              className="apm-modal__method-card"
              onClick={() => handleMethodSelect('api_key')}
              type="button"
            >
              <div className="apm-modal__method-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <div className="apm-modal__method-text">
                <span className="apm-modal__method-name">API Key</span>
                <span className="apm-modal__method-desc">
                  Enter your API key directly. Works with all providers.
                </span>
              </div>
            </button>

            <button
              className="apm-modal__method-card"
              onClick={() => handleMethodSelect('oauth')}
              type="button"
            >
              <div className="apm-modal__method-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                </svg>
              </div>
              <div className="apm-modal__method-text">
                <span className="apm-modal__method-name">OAuth</span>
                <span className="apm-modal__method-desc">
                  Authenticate via browser. Available for OpenAI, Google, and Azure.
                </span>
              </div>
            </button>
          </div>
        )}

        {/* Step 2: Choose provider */}
        {step === 'provider' && (
          <div className="apm-modal__providers">
            {availableProviders.map((prov) => (
              <button
                key={prov.id}
                className="apm-modal__provider-card"
                onClick={() => handleProviderSelect(prov.id)}
                type="button"
              >
                <div
                  className="apm-modal__provider-icon"
                  style={{ backgroundColor: prov.color }}
                >
                  {prov.icon}
                </div>
                <span className="apm-modal__provider-name">{prov.name}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="apm-modal__provider-arrow">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Enter credentials (API key only) */}
        {step === 'credentials' && provider && (
          <div className="apm-modal__credentials">
            {/* Provider badge */}
            <div className="apm-modal__selected-provider">
              <div
                className="apm-modal__provider-icon apm-modal__provider-icon--sm"
                style={{ backgroundColor: provider.color }}
              >
                {provider.icon}
              </div>
              <span>{provider.name}</span>
            </div>

            {/* Label input */}
            <div className="apm-modal__field">
              <label className="apm-modal__field-label">Profile Label</label>
              <input
                className="apm-modal__input"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`e.g. ${provider.name} Production`}
              />
              <span className="apm-modal__field-hint">
                A friendly name to identify this profile
              </span>
            </div>

            {/* API Key input */}
            <div className="apm-modal__field">
              <label className="apm-modal__field-label">API Key</label>
              <div className="apm-modal__key-input-wrapper">
                <input
                  ref={inputRef}
                  className="apm-modal__input apm-modal__input--key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setValidationError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={provider.apiKeyPlaceholder}
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  className="apm-modal__key-toggle"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? 'Hide key' : 'Show key'}
                  type="button"
                >
                  {showKey ? (
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
              {apiKey && (
                <span className="apm-modal__field-hint apm-modal__field-hint--masked">
                  Stored as: {maskApiKey(apiKey)}
                </span>
              )}
            </div>

            {/* Validation error */}
            {validationError && (
              <div className="apm-modal__validation-error">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{validationError}</span>
              </div>
            )}

            {/* Security note */}
            <div className="apm-modal__security-note">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>
                Your API key is encrypted and stored in the OS keyring. It never leaves this device.
              </span>
            </div>

            {/* Actions */}
            <div className="apm-modal__actions">
              <button
                className="apm-btn apm-btn--secondary"
                onClick={() => setStep('provider')}
                type="button"
              >
                Back
              </button>
              <button
                className="apm-btn apm-btn--primary"
                onClick={handleSubmit}
                disabled={!apiKey.trim() || adding}
                type="button"
              >
                {adding ? (
                  <>
                    <span className="apm-spinner apm-spinner--sm" />
                    Adding...
                  </>
                ) : (
                  'Add Profile'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Delete confirmation dialog. */
function DeleteConfirmDialog({
  profile,
  onConfirm,
  onCancel,
  deleting,
}: {
  profile: AuthProfile;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  const provider = getProviderInfo(profile.provider);

  return (
    <div className="apm-modal-overlay" onClick={onCancel}>
      <div className="apm-modal apm-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="apm-delete-confirm">
          <div className="apm-delete-confirm__icon">
            <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="apm-delete-confirm__title">Delete Auth Profile</h3>
          <p className="apm-delete-confirm__msg">
            Are you sure you want to delete the <strong>{profile.label}</strong> profile ({provider.name})?
            This will remove the stored credentials. Any services using this profile will stop working.
          </p>
          <div className="apm-delete-confirm__actions">
            <button
              className="apm-btn apm-btn--secondary"
              onClick={onCancel}
              disabled={deleting}
              type="button"
            >
              Cancel
            </button>
            <button
              className="apm-btn apm-btn--danger"
              onClick={onConfirm}
              disabled={deleting}
              type="button"
            >
              {deleting ? (
                <>
                  <span className="apm-spinner apm-spinner--sm" />
                  Deleting...
                </>
              ) : (
                'Delete Profile'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AuthProfileManager() {
  const { getClient, connected } = useGateway();

  // State
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showOAuthDialog, setShowOAuthDialog] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<string>('');
  const [checking, setChecking] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AuthProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Drag state
  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  // --- Gateway helpers ---
  const sendRequest = useCallback(
    async <T = unknown,>(method: string, params?: unknown): Promise<T | null> => {
      const client = getClient();
      if (!client?.connected) return null;
      return client.request<T>(method, params);
    },
    [getClient]
  );

  // --- Load profiles ---
  const loadProfiles = useCallback(async () => {
    setError(null);
    try {
      const result = await sendRequest<{ profiles: AuthProfile[] }>('auth.profiles.list');
      if (result?.profiles) {
        setProfiles(result.profiles);
      }
    } catch (err) {
      console.error('Failed to load auth profiles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load auth profiles');
    } finally {
      setLoading(false);
    }
  }, [sendRequest]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles, connected]);

  // --- Health check ---
  const checkProfile = useCallback(
    async (profileId: string) => {
      setChecking(profileId);
      try {
        const result = await sendRequest<{
          status: AuthProfile['status'];
          errorMessage?: string;
        }>('auth.profiles.check', { profileId });

        if (result) {
          setProfiles((prev) =>
            prev.map((p) =>
              p.id === profileId
                ? {
                    ...p,
                    status: result.status,
                    lastChecked: new Date().toISOString(),
                    errorMessage: result.errorMessage,
                  }
                : p
            )
          );
        }
      } catch (err) {
        console.error('Health check failed:', err);
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === profileId
              ? {
                  ...p,
                  status: 'error',
                  lastChecked: new Date().toISOString(),
                  errorMessage: err instanceof Error ? err.message : 'Health check failed',
                }
              : p
          )
        );
      } finally {
        setChecking(null);
      }
    },
    [sendRequest]
  );

  // --- Add profile (API key) ---
  const addProfile = useCallback(
    async (provider: string, apiKey: string, label: string) => {
      setAdding(true);
      setError(null);
      try {
        const result = await sendRequest<{ profile: AuthProfile }>('auth.profiles.add', {
          provider,
          credentials: { apiKey },
          label,
          authMethod: 'api_key',
        });

        if (result?.profile) {
          setProfiles((prev) => [...prev, result.profile]);
        } else {
          // Optimistic fallback
          const newProfile: AuthProfile = {
            id: `profile-${Date.now()}`,
            provider,
            label,
            status: 'unchecked',
            createdAt: new Date().toISOString(),
            authMethod: 'api_key',
          };
          setProfiles((prev) => [...prev, newProfile]);
        }

        setShowAddDialog(false);
      } catch (err) {
        console.error('Failed to add profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to add profile');
      } finally {
        setAdding(false);
      }
    },
    [sendRequest]
  );

  // --- Add profile via OAuth ---
  const handleStartOAuth = useCallback(
    (provider: string) => {
      setShowAddDialog(false);
      setOauthProvider(provider);
      setShowOAuthDialog(true);
    },
    []
  );

  const handleOAuthComplete = useCallback(
    (profile: AuthProfile) => {
      setShowOAuthDialog(false);
      setOauthProvider('');
      setProfiles((prev) => [...prev, profile]);
    },
    []
  );

  const handleOAuthCancel = useCallback(() => {
    setShowOAuthDialog(false);
    setOauthProvider('');
  }, []);

  // --- Delete profile ---
  const deleteProfile = useCallback(
    async (profileId: string) => {
      setDeleting(true);
      setError(null);
      try {
        await sendRequest('auth.profiles.delete', { profileId });
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
        setDeleteTarget(null);
      } catch (err) {
        console.error('Failed to delete profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete profile');
      } finally {
        setDeleting(false);
      }
    },
    [sendRequest]
  );

  // --- Reorder profiles ---
  const reorderProfiles = useCallback(
    async (newOrder: string[]) => {
      try {
        await sendRequest('auth.profiles.reorder', { order: newOrder });
      } catch (err) {
        console.error('Failed to reorder profiles:', err);
        // Reload to get the server order
        await loadProfiles();
      }
    },
    [sendRequest, loadProfiles]
  );

  const moveProfile = useCallback(
    (fromIndex: number, toIndex: number) => {
      setProfiles((prev) => {
        const updated = [...prev];
        const [removed] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, removed);
        // Persist new order
        reorderProfiles(updated.map((p) => p.id));
        return updated;
      });
    },
    [reorderProfiles]
  );

  // --- Drag handlers ---
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    dragItemRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight delay to allow the drag image to render
    const target = e.currentTarget as HTMLElement;
    target.classList.add('apm-card--dragging');
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverRef.current = index;
  };

  const handleDrop = (_index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragItemRef.current !== null && dragOverRef.current !== null) {
      if (dragItemRef.current !== dragOverRef.current) {
        moveProfile(dragItemRef.current, dragOverRef.current);
      }
    }
    dragItemRef.current = null;
    dragOverRef.current = null;
  };

  const handleDragEnd = () => {
    dragItemRef.current = null;
    dragOverRef.current = null;
    // Remove dragging class from all cards
    document.querySelectorAll('.apm-card--dragging').forEach((el) => {
      el.classList.remove('apm-card--dragging');
    });
  };

  // --- Summary stats ---
  const activeCount = profiles.filter((p) => p.status === 'active').length;
  const errorCount = profiles.filter((p) => p.status === 'error').length;
  const totalRequests = profiles.reduce((sum, p) => sum + (p.usage?.requestsToday ?? 0), 0);
  const totalCost = profiles.reduce((sum, p) => sum + (p.usage?.costEstimate ?? 0), 0);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <>
      <style>{authProfileManagerStyles}</style>

      <div className="apm-container">
        {/* Header */}
        <header className="apm-header">
          <div className="apm-header__text">
            <h2 className="apm-header__title">Auth Profiles</h2>
            <p className="apm-header__subtitle">
              Manage API credentials and authentication for AI providers
            </p>
          </div>
          <button
            className="apm-btn apm-btn--primary"
            onClick={() => setShowAddDialog(true)}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Add Profile
          </button>
        </header>

        {/* Summary bar */}
        {profiles.length > 0 && (
          <div className="apm-summary">
            <div className="apm-summary__item">
              <span className="apm-summary__value">{profiles.length}</span>
              <span className="apm-summary__label">Profiles</span>
            </div>
            <div className="apm-summary__divider" />
            <div className="apm-summary__item">
              <span className="apm-summary__value apm-summary__value--active">{activeCount}</span>
              <span className="apm-summary__label">Active</span>
            </div>
            {errorCount > 0 && (
              <>
                <div className="apm-summary__divider" />
                <div className="apm-summary__item">
                  <span className="apm-summary__value apm-summary__value--error">{errorCount}</span>
                  <span className="apm-summary__label">Errors</span>
                </div>
              </>
            )}
            <div className="apm-summary__divider" />
            <div className="apm-summary__item">
              <span className="apm-summary__value">{totalRequests}</span>
              <span className="apm-summary__label">Requests Today</span>
            </div>
            <div className="apm-summary__divider" />
            <div className="apm-summary__item">
              <span className="apm-summary__value">{formatCost(totalCost)}</span>
              <span className="apm-summary__label">Est. Cost</span>
            </div>
          </div>
        )}

        {/* Not connected banner */}
        {!connected && (
          <div className="apm-banner apm-banner--warn">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Gateway disconnected. Auth profile management requires an active gateway connection.
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="apm-banner apm-banner--error">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
            <button
              className="apm-banner__dismiss"
              onClick={() => setError(null)}
              type="button"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="apm-loading">
            <div className="apm-spinner" />
            <span>Loading auth profiles...</span>
          </div>
        ) : profiles.length === 0 ? (
          /* Empty state */
          <div className="apm-empty">
            <div className="apm-empty__icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h3 className="apm-empty__title">No Auth Profiles</h3>
            <p className="apm-empty__desc">
              Add your first API key or OAuth connection to start using AI providers.
              Profiles can be prioritized for automatic failover.
            </p>
            <button
              className="apm-btn apm-btn--primary"
              onClick={() => setShowAddDialog(true)}
              type="button"
            >
              Add Your First Profile
            </button>
          </div>
        ) : (
          /* Profile list */
          <>
            <div className="apm-list-hint">
              Drag to reorder profiles. Higher priority profiles are tried first for failover.
            </div>
            <div className="apm-profile-list">
              {profiles.map((profile, index) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  index={index}
                  totalProfiles={profiles.length}
                  checking={checking === profile.id}
                  onCheck={() => checkProfile(profile.id)}
                  onDelete={() => setDeleteTarget(profile)}
                  onMoveUp={() => moveProfile(index, index - 1)}
                  onMoveDown={() => moveProfile(index, index + 1)}
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop(index)}
                />
              ))}
            </div>
          </>
        )}

        {/* Add profile dialog */}
        {showAddDialog && (
          <AddProfileDialog
            onAdd={addProfile}
            onStartOAuth={handleStartOAuth}
            onClose={() => setShowAddDialog(false)}
            adding={adding}
          />
        )}

        {/* OAuth flow dialog */}
        {showOAuthDialog && oauthProvider && (
          <OAuthFlowDialog
            provider={oauthProvider}
            onComplete={handleOAuthComplete}
            onCancel={handleOAuthCancel}
          />
        )}

        {/* Delete confirmation dialog */}
        {deleteTarget && (
          <DeleteConfirmDialog
            profile={deleteTarget}
            onConfirm={() => deleteProfile(deleteTarget.id)}
            onCancel={() => setDeleteTarget(null)}
            deleting={deleting}
          />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles (apm- prefix)
// ---------------------------------------------------------------------------

const authProfileManagerStyles = `
/* ==============================
   Auth Profile Manager Styles
   ============================== */

.apm-container {
  max-width: 860px;
  margin: 0 auto;
  padding: 0;
}

/* ── Header ── */
.apm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 1rem;
}

.apm-header__title {
  font-size: 1.375rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0;
}

.apm-header__subtitle {
  font-size: 0.8125rem;
  color: #a0a0a0;
  margin: 0.25rem 0 0;
}

/* ── Buttons (shared) ── */
.apm-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.apm-btn--sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.apm-btn--primary {
  background: #8b5cf6;
  color: white;
}

.apm-btn--primary:hover {
  background: #7c3aed;
}

.apm-btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.apm-btn--secondary {
  background: rgba(255, 255, 255, 0.06);
  color: #e0e0e0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.apm-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
}

.apm-btn--secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.apm-btn--danger {
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.apm-btn--danger:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.35);
}

.apm-btn--danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Summary bar ── */
.apm-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.apm-summary__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.apm-summary__value {
  font-size: 1.125rem;
  font-weight: 700;
  color: #e0e0e0;
}

.apm-summary__value--active {
  color: #34d399;
}

.apm-summary__value--error {
  color: #fca5a5;
}

.apm-summary__label {
  font-size: 0.6875rem;
  color: #a0a0a0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 500;
}

.apm-summary__divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.08);
}

/* ── Banner ── */
.apm-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

.apm-banner--warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

.apm-banner--error {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.apm-banner__dismiss {
  margin-left: auto;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.75rem;
  opacity: 0.7;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.apm-banner__dismiss:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
}

/* ── Loading ── */
.apm-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 4rem;
  color: #a0a0a0;
}

.apm-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: apm-spin 0.8s linear infinite;
}

.apm-spinner--sm {
  width: 14px;
  height: 14px;
  border-width: 2px;
}

@keyframes apm-spin {
  to { transform: rotate(360deg); }
}

/* ── Empty state ── */
.apm-empty {
  text-align: center;
  padding: 4rem 2rem;
  color: #a0a0a0;
}

.apm-empty__icon {
  color: rgba(139, 92, 246, 0.5);
  margin-bottom: 1rem;
}

.apm-empty__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #e0e0e0;
  margin: 0 0 0.5rem;
}

.apm-empty__desc {
  font-size: 0.875rem;
  line-height: 1.5;
  max-width: 420px;
  margin: 0 auto 1.5rem;
}

/* ── Profile list ── */
.apm-list-hint {
  font-size: 0.75rem;
  color: #a0a0a0;
  margin-bottom: 0.75rem;
  padding-left: 0.25rem;
}

.apm-profile-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

/* ── Profile card ── */
.apm-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  position: relative;
  transition: all 0.2s ease;
  cursor: grab;
}

.apm-card:hover {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
}

.apm-card--active {
  border-color: rgba(139, 92, 246, 0.25);
}

.apm-card--active:hover {
  border-color: rgba(139, 92, 246, 0.4);
}

.apm-card--error {
  border-color: rgba(239, 68, 68, 0.25);
}

.apm-card--error:hover {
  border-color: rgba(239, 68, 68, 0.4);
}

.apm-card--dragging {
  opacity: 0.5;
  transform: scale(0.98);
}

/* Priority */
.apm-card__priority {
  position: absolute;
  top: 0.625rem;
  right: 0.75rem;
  font-size: 0.625rem;
  font-weight: 700;
  color: #a0a0a0;
  background: rgba(255, 255, 255, 0.04);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  letter-spacing: 0.02em;
}

/* Header */
.apm-card__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
}

.apm-card__provider-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
  letter-spacing: -0.02em;
}

.apm-card__info {
  flex: 1;
  min-width: 0;
}

.apm-card__name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.apm-card__label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #e0e0e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.apm-card__method {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #a0a0a0;
  background: rgba(255, 255, 255, 0.06);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  flex-shrink: 0;
}

.apm-card__provider-name {
  font-size: 0.75rem;
  color: #a0a0a0;
  margin-top: 0.125rem;
}

/* Status badge */
.apm-card__status {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
}

.apm-card__status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.apm-status--active {
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
}

.apm-status--active .apm-card__status-dot {
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.5);
}

.apm-status--expired {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
}

.apm-status--expired .apm-card__status-dot {
  background: #fbbf24;
}

.apm-status--error {
  color: #fca5a5;
  background: rgba(252, 165, 165, 0.1);
}

.apm-status--error .apm-card__status-dot {
  background: #fca5a5;
  box-shadow: 0 0 6px rgba(252, 165, 165, 0.4);
}

.apm-status--unchecked {
  color: #a0a0a0;
  background: rgba(160, 160, 160, 0.08);
}

.apm-status--unchecked .apm-card__status-dot {
  background: #a0a0a0;
}

/* Error message */
.apm-card__error-msg {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.06);
  padding: 0.5rem 0.625rem;
  border-radius: 6px;
  margin-bottom: 0.625rem;
  line-height: 1.4;
}

.apm-card__error-msg svg {
  flex-shrink: 0;
  margin-top: 0.0625rem;
}

/* Usage stats */
.apm-card__usage {
  display: flex;
  gap: 1.25rem;
  padding: 0.625rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 0.375rem;
}

.apm-card__usage-item {
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
}

.apm-card__usage-label {
  font-size: 0.625rem;
  color: #a0a0a0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 500;
}

.apm-card__usage-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e0e0e0;
  font-variant-numeric: tabular-nums;
}

/* Checked timestamp */
.apm-card__checked {
  font-size: 0.6875rem;
  color: #a0a0a0;
  margin-bottom: 0.625rem;
}

/* Actions footer */
.apm-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.625rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.apm-card__reorder {
  display: flex;
  gap: 0.25rem;
}

.apm-card__reorder-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  color: #a0a0a0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.apm-card__reorder-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: #e0e0e0;
}

.apm-card__reorder-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.apm-card__action-btns {
  display: flex;
  gap: 0.5rem;
}

/* ═══════════════════════════════
   Modal (shared by add + delete)
   ═══════════════════════════════ */

.apm-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: apm-fade-in 0.15s ease;
}

@keyframes apm-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.apm-modal {
  background: #141420;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  width: 90%;
  max-width: 520px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(139, 92, 246, 0.08);
  animation: apm-modal-in 0.2s ease;
}

.apm-modal--sm {
  max-width: 400px;
}

@keyframes apm-modal-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.apm-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.apm-modal__title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0;
}

.apm-modal__close {
  background: none;
  border: none;
  color: #a0a0a0;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.apm-modal__close:hover {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.08);
}

/* Breadcrumb */
.apm-modal__breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  font-size: 0.75rem;
}

.apm-modal__crumb {
  color: #a0a0a0;
  cursor: pointer;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  transition: color 0.15s;
}

.apm-modal__crumb:hover {
  color: #e0e0e0;
}

.apm-modal__crumb--active {
  color: #8b5cf6;
  font-weight: 600;
}

.apm-modal__crumb--done {
  color: #34d399;
}

.apm-modal__crumb-sep {
  color: rgba(255, 255, 255, 0.2);
  font-size: 0.875rem;
}

/* Method selection */
.apm-modal__methods {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.apm-modal__method-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  width: 100%;
  color: inherit;
}

.apm-modal__method-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(139, 92, 246, 0.35);
  transform: translateY(-1px);
}

.apm-modal__method-icon {
  color: #8b5cf6;
  flex-shrink: 0;
}

.apm-modal__method-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.apm-modal__method-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #e0e0e0;
}

.apm-modal__method-desc {
  font-size: 0.8125rem;
  color: #a0a0a0;
  line-height: 1.4;
}

/* Provider selection */
.apm-modal__providers {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.apm-modal__provider-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  text-align: left;
  color: inherit;
}

.apm-modal__provider-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.apm-modal__provider-icon {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
}

.apm-modal__provider-icon--sm {
  width: 24px;
  height: 24px;
  font-size: 0.625rem;
  border-radius: 5px;
}

.apm-modal__provider-name {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  color: #e0e0e0;
}

.apm-modal__provider-arrow {
  color: #a0a0a0;
  flex-shrink: 0;
}

/* Credentials form */
.apm-modal__credentials {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.apm-modal__selected-provider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #e0e0e0;
  font-weight: 500;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.apm-modal__field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.apm-modal__field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #e0e0e0;
}

.apm-modal__input {
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #e0e0e0;
  outline: none;
  transition: border-color 0.15s ease;
  font-family: inherit;
}

.apm-modal__input:focus {
  border-color: #8b5cf6;
}

.apm-modal__input::placeholder {
  color: #666;
}

.apm-modal__input--key {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  letter-spacing: 0.02em;
  padding-right: 2.5rem;
}

.apm-modal__key-input-wrapper {
  position: relative;
}

.apm-modal__key-toggle {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #a0a0a0;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.apm-modal__key-toggle:hover {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.08);
}

.apm-modal__field-hint {
  font-size: 0.6875rem;
  color: #a0a0a0;
}

.apm-modal__field-hint--masked {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  color: #666;
}

/* Validation error */
.apm-modal__validation-error {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.06);
  padding: 0.5rem 0.625rem;
  border-radius: 6px;
  line-height: 1.4;
}

.apm-modal__validation-error svg {
  flex-shrink: 0;
  margin-top: 0.0625rem;
}

/* Security note */
.apm-modal__security-note {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #a0a0a0;
  background: rgba(139, 92, 246, 0.06);
  padding: 0.625rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(139, 92, 246, 0.12);
  line-height: 1.4;
}

.apm-modal__security-note svg {
  flex-shrink: 0;
  color: #8b5cf6;
  margin-top: 0.0625rem;
}

/* Modal actions */
.apm-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  margin-top: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* ═══ Delete Confirm ═══ */
.apm-delete-confirm {
  text-align: center;
  padding: 0.5rem 0;
}

.apm-delete-confirm__icon {
  color: #fbbf24;
  margin-bottom: 0.75rem;
}

.apm-delete-confirm__title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0 0 0.75rem;
}

.apm-delete-confirm__msg {
  font-size: 0.8125rem;
  color: #a0a0a0;
  line-height: 1.5;
  margin: 0 0 1.25rem;
}

.apm-delete-confirm__msg strong {
  color: #e0e0e0;
}

.apm-delete-confirm__actions {
  display: flex;
  justify-content: center;
  gap: 0.625rem;
}

/* ═══ Scrollbar ═══ */
.apm-modal::-webkit-scrollbar {
  width: 6px;
}

.apm-modal::-webkit-scrollbar-track {
  background: transparent;
}

.apm-modal::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.apm-modal::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
`;
