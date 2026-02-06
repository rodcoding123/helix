/**
 * LINE Bot Setup - Step wizard for connecting a LINE bot via Bot SDK
 *
 * Flow:
 *   Step 1: Bot Credentials - Channel Access Token and Channel Secret input
 *   Step 2: Verification - connection test, bot info display, webhook status
 *   Step 3: Configuration - auto-reply, rich menu, friend/group response settings
 *
 * Uses gateway `channels.login` (line) for Bot SDK auth
 * and `config.patch` for persisting channel configuration.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGateway } from '../../../hooks/useGateway';
import { useGatewayConfig } from '../../../hooks/useGatewayConfig';

/* ===================================================================
   Types
   =================================================================== */

export interface LineSetupProps {
  onBack?: () => void;
  onConnected?: () => void;
}

type SetupStep = 'credentials' | 'verification' | 'configuration';

interface LineBotInfo {
  displayName?: string;
  basicId?: string;
  pictureUrl?: string;
  chatMode?: string;
  markAsReadMode?: string;
  plan?: string;
}

interface WebhookStatus {
  url?: string;
  active?: boolean;
  verified?: boolean;
}

/* ===================================================================
   Helpers
   =================================================================== */

/**
 * Validate LINE Channel Access Token format.
 * Tokens are long alphanumeric strings (typically 170+ characters).
 */
function isValidAccessToken(token: string): boolean {
  return token.trim().length >= 50;
}

/**
 * Validate LINE Channel Secret format.
 * Typically a 32-character hex string.
 */
function isValidChannelSecret(secret: string): boolean {
  return /^[a-f0-9]{32}$/i.test(secret.trim());
}

/* ===================================================================
   Component
   =================================================================== */

export function LineSetup({ onBack, onConnected }: LineSetupProps) {
  const { getClient, connected: gatewayConnected } = useGateway();
  const { patchGatewayConfig } = useGatewayConfig();

  // Step wizard state
  const [step, setStep] = useState<SetupStep>('credentials');
  const [animDirection, setAnimDirection] = useState<'forward' | 'backward'>('forward');

  // Step 1: Credentials
  const [accessToken, setAccessToken] = useState('');
  const [channelSecret, setChannelSecret] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Verification
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [botInfo, setBotInfo] = useState<LineBotInfo>({});
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus>({});

  // Step 3: Configuration
  const [autoReply, setAutoReply] = useState(true);
  const [richMenu, setRichMenu] = useState(false);
  const [friendAllowlistEnabled, setFriendAllowlistEnabled] = useState(false);
  const [groupResponse, setGroupResponse] = useState(false);

  // Focus token input on mount
  useEffect(() => {
    if (step === 'credentials') {
      tokenInputRef.current?.focus();
    }
  }, [step]);

  /* ---------------------------------------------------------------
     Navigation helpers
     --------------------------------------------------------------- */

  const goToStep = useCallback((target: SetupStep, direction: 'forward' | 'backward' = 'forward') => {
    setAnimDirection(direction);
    setStep(target);
  }, []);

  /* ---------------------------------------------------------------
     Step 1: Credential validation and submission
     --------------------------------------------------------------- */

  const handleAccessTokenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAccessToken(e.target.value);
    setCredentialError(null);
  }, []);

  const handleChannelSecretChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setChannelSecret(e.target.value);
    setCredentialError(null);
  }, []);

  const handleWebhookUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setWebhookUrl(e.target.value);
  }, []);

  const handleConnect = useCallback(async () => {
    const token = accessToken.trim();
    const secret = channelSecret.trim();

    if (!token) {
      setCredentialError('Please enter the Channel Access Token.');
      return;
    }

    if (!isValidAccessToken(token)) {
      setCredentialError('Channel Access Token appears too short. Please check your token from the LINE Developers Console.');
      return;
    }

    if (!secret) {
      setCredentialError('Please enter the Channel Secret.');
      return;
    }

    if (!isValidChannelSecret(secret)) {
      setCredentialError('Invalid Channel Secret format. Expected a 32-character hexadecimal string.');
      return;
    }

    const client = getClient();
    if (!client?.connected) {
      setCredentialError('Gateway not connected. Please start the gateway first.');
      return;
    }

    // Move to verification step
    goToStep('verification');
    setVerifying(true);
    setVerifyError(null);

    try {
      const result = await client.request<{
        bot?: LineBotInfo;
        webhook?: WebhookStatus;
        status?: string;
        error?: string;
      }>('channels.login', {
        channel: 'line',
        accessToken: token,
        channelSecret: secret,
        webhookUrl: webhookUrl.trim() || undefined,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setBotInfo(result.bot ?? {});
      setWebhookStatus(result.webhook ?? {});
      setVerifying(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setVerifyError(
        message.includes('401') || message.includes('Unauthorized') || message.includes('invalid')
          ? 'Invalid credentials. Please check your Channel Access Token and Channel Secret.'
          : message.includes('network') || message.includes('ECONNREFUSED')
            ? 'Network error. Please check your internet connection.'
            : `Connection failed: ${message}`
      );
      setVerifying(false);
    }
  }, [accessToken, channelSecret, webhookUrl, getClient, goToStep]);

  const handleTokenKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConnect();
      }
    },
    [handleConnect]
  );

  /* ---------------------------------------------------------------
     Save & finish
     --------------------------------------------------------------- */

  const handleSaveAndDone = useCallback(async () => {
    try {
      await patchGatewayConfig({
        'channels.line': {
          enabled: true,
          config: {
            accessToken: accessToken.trim(),
            channelSecret: channelSecret.trim(),
            webhookUrl: webhookUrl.trim() || undefined,
            botName: botInfo.displayName,
            botBasicId: botInfo.basicId,
            autoReply,
            richMenu,
            friendAllowlistEnabled,
            groupResponse,
          },
        },
      });
    } catch (err) {
      console.error('Failed to save LINE config:', err);
    }

    onConnected?.();
  }, [
    patchGatewayConfig,
    accessToken,
    channelSecret,
    webhookUrl,
    botInfo,
    autoReply,
    richMenu,
    friendAllowlistEnabled,
    groupResponse,
    onConnected,
  ]);

  /* ---------------------------------------------------------------
     Render
     --------------------------------------------------------------- */

  return (
    <div className="lns-container">
      <style>{lineSetupStyles}</style>

      {/* Gateway disconnected banner */}
      {!gatewayConnected && (
        <div className="lns-banner lns-banner-warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. LINE setup requires an active gateway connection.
        </div>
      )}

      {/* Step progress indicator */}
      <div className="lns-progress">
        <div className={`lns-progress-step ${step === 'credentials' ? 'active' : 'done'}`}>
          <span className="lns-progress-dot">
            {step !== 'credentials' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '1'}
          </span>
          <span className="lns-progress-label">Bot Credentials</span>
        </div>
        <div className="lns-progress-line" />
        <div className={`lns-progress-step ${step === 'verification' ? 'active' : step === 'configuration' ? 'done' : ''}`}>
          <span className="lns-progress-dot">
            {step === 'configuration' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '2'}
          </span>
          <span className="lns-progress-label">Verification</span>
        </div>
        <div className="lns-progress-line" />
        <div className={`lns-progress-step ${step === 'configuration' ? 'active' : ''}`}>
          <span className="lns-progress-dot">3</span>
          <span className="lns-progress-label">Configuration</span>
        </div>
      </div>

      {/* Step content with animated transitions */}
      <div className={`lns-step-content lns-anim-${animDirection}`} key={step}>
        {/* ============================================================
            STEP 1: Bot Credentials
            ============================================================ */}
        {step === 'credentials' && (
          <div className="lns-step">
            <div className="lns-header">
              <div className="lns-icon-circle">
                <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
              </div>
              <h2 className="lns-title">Connect LINE Bot</h2>
              <p className="lns-subtitle">
                Enter your bot credentials from the LINE Developers Console to connect your LINE bot.
              </p>
            </div>

            {/* Instructions */}
            <div className="lns-instructions">
              <h4 className="lns-instructions-title">How to get bot credentials</h4>
              <ol className="lns-instructions-list">
                <li>
                  Go to{' '}
                  <a
                    href="https://developers.line.biz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lns-link"
                  >
                    developers.line.biz
                  </a>
                </li>
                <li>Create a new <strong>Messaging API</strong> channel or select an existing one</li>
                <li>Copy the <strong>Channel Access Token</strong> and <strong>Channel Secret</strong></li>
              </ol>
            </div>

            {/* Channel Access Token */}
            <div className="lns-field">
              <label className="lns-label" htmlFor="lns-token-input">Channel Access Token</label>
              <div className="lns-masked-input-row">
                <input
                  id="lns-token-input"
                  ref={tokenInputRef}
                  type={showToken ? 'text' : 'password'}
                  className={`lns-input lns-input-mono ${credentialError && !channelSecret ? 'lns-input-error' : ''}`}
                  placeholder="Enter your Channel Access Token"
                  value={accessToken}
                  onChange={handleAccessTokenChange}
                  onKeyDown={handleTokenKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  className="lns-show-toggle"
                  onClick={() => setShowToken(!showToken)}
                  type="button"
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Channel Secret */}
            <div className="lns-field">
              <label className="lns-label" htmlFor="lns-secret-input">Channel Secret</label>
              <div className="lns-masked-input-row">
                <input
                  id="lns-secret-input"
                  type={showSecret ? 'text' : 'password'}
                  className={`lns-input lns-input-mono ${credentialError ? 'lns-input-error' : ''}`}
                  placeholder="32-character hex string"
                  value={channelSecret}
                  onChange={handleChannelSecretChange}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  className="lns-show-toggle"
                  onClick={() => setShowSecret(!showSecret)}
                  type="button"
                  aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                >
                  {showSecret ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Webhook URL (optional) */}
            <div className="lns-field">
              <label className="lns-label" htmlFor="lns-webhook-input">
                Webhook URL <span className="lns-label-optional">(optional)</span>
              </label>
              <p className="lns-field-hint">
                Auto-generated if left empty. Set manually if you have a custom webhook endpoint.
              </p>
              <input
                id="lns-webhook-input"
                type="url"
                className="lns-input"
                placeholder="https://your-domain.com/webhook/line"
                value={webhookUrl}
                onChange={handleWebhookUrlChange}
                autoComplete="url"
              />
            </div>

            {/* Error */}
            {credentialError && (
              <div className="lns-error-banner">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{credentialError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="lns-actions">
              {onBack && (
                <button className="lns-btn lns-btn-secondary" onClick={onBack} type="button">
                  Back
                </button>
              )}
              <button
                className="lns-btn lns-btn-primary"
                onClick={handleConnect}
                disabled={!gatewayConnected || !accessToken.trim() || !channelSecret.trim()}
                type="button"
              >
                Connect
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 2: Verification
            ============================================================ */}
        {step === 'verification' && (
          <div className="lns-step">
            {verifying ? (
              /* Connecting state */
              <div className="lns-verifying">
                <div className="lns-spinner" />
                <h3 className="lns-verifying-title">Connecting to LINE...</h3>
                <p className="lns-verifying-desc">Verifying your bot credentials with the LINE API</p>
              </div>
            ) : verifyError ? (
              /* Error state */
              <div className="lns-verify-error">
                <div className="lns-error-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h3 className="lns-error-title">Connection Failed</h3>
                <p className="lns-error-message">{verifyError}</p>
                <div className="lns-actions">
                  <button
                    className="lns-btn lns-btn-secondary"
                    onClick={() => goToStep('credentials', 'backward')}
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    className="lns-btn lns-btn-primary"
                    onClick={handleConnect}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              /* Success state */
              <div className="lns-verify-success">
                <div className="lns-success-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3 className="lns-success-title">Bot Verified!</h3>

                {/* Bot info card */}
                <div className="lns-bot-card">
                  <div className="lns-bot-avatar">
                    {botInfo.pictureUrl ? (
                      <img src={botInfo.pictureUrl} alt={botInfo.displayName ?? 'Bot'} className="lns-bot-avatar-img" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                      </svg>
                    )}
                  </div>
                  <div className="lns-bot-details">
                    <span className="lns-bot-name">{botInfo.displayName ?? 'LINE Bot'}</span>
                    {botInfo.basicId && (
                      <span className="lns-bot-id">@{botInfo.basicId}</span>
                    )}
                  </div>
                  <div className="lns-bot-badges">
                    {botInfo.plan && (
                      <span className="lns-badge lns-badge-green">{botInfo.plan}</span>
                    )}
                    {webhookStatus.active && (
                      <span className="lns-badge lns-badge-green">Webhook Active</span>
                    )}
                    {webhookStatus.active === false && (
                      <span className="lns-badge lns-badge-yellow">Webhook Inactive</span>
                    )}
                    {webhookStatus.verified && (
                      <span className="lns-badge lns-badge-green">Webhook Verified</span>
                    )}
                  </div>
                  {webhookStatus.url && (
                    <div className="lns-webhook-url">
                      <span className="lns-webhook-label">Webhook URL</span>
                      <code className="lns-webhook-value">{webhookStatus.url}</code>
                    </div>
                  )}
                </div>

                {/* Continue */}
                <div className="lns-actions">
                  <button
                    className="lns-btn lns-btn-secondary"
                    onClick={() => goToStep('credentials', 'backward')}
                    type="button"
                  >
                    Use different credentials
                  </button>
                  <button
                    className="lns-btn lns-btn-primary"
                    onClick={() => goToStep('configuration')}
                    type="button"
                  >
                    Continue to Configuration
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            STEP 3: Configuration
            ============================================================ */}
        {step === 'configuration' && (
          <div className="lns-step">
            <div className="lns-header">
              <h2 className="lns-title">Configure Bot</h2>
              <p className="lns-subtitle">
                Customize the behavior of your LINE bot.
              </p>
            </div>

            {/* Bot info summary */}
            <div className="lns-bot-summary">
              <div className="lns-bot-avatar-sm">
                {botInfo.pictureUrl ? (
                  <img src={botInfo.pictureUrl} alt={botInfo.displayName ?? 'Bot'} className="lns-bot-avatar-img-sm" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                )}
              </div>
              <div>
                <span className="lns-summary-name">{botInfo.displayName ?? 'LINE Bot'}</span>
                {botInfo.basicId && (
                  <span className="lns-summary-id">@{botInfo.basicId}</span>
                )}
              </div>
            </div>

            {/* Auto-reply toggle */}
            <div className="lns-setting-row">
              <div className="lns-setting-info">
                <span className="lns-setting-name">Auto-Reply</span>
                <span className="lns-setting-desc">Automatically respond to incoming messages</span>
              </div>
              <label className="lns-toggle">
                <input
                  type="checkbox"
                  checked={autoReply}
                  onChange={(e) => setAutoReply(e.target.checked)}
                />
                <span className="lns-toggle-slider" />
              </label>
            </div>

            {/* Rich Menu toggle */}
            <div className="lns-setting-row">
              <div className="lns-setting-info">
                <span className="lns-setting-name">Rich Menu</span>
                <span className="lns-setting-desc">Enable rich menu for the bot</span>
                <span className="lns-setting-note">Configure rich menus in the LINE Developers Console</span>
              </div>
              <label className="lns-toggle">
                <input
                  type="checkbox"
                  checked={richMenu}
                  onChange={(e) => setRichMenu(e.target.checked)}
                />
                <span className="lns-toggle-slider" />
              </label>
            </div>

            {/* Friend Allowlist toggle */}
            <div className="lns-setting-row">
              <div className="lns-setting-info">
                <span className="lns-setting-name">Friend Allowlist</span>
                <span className="lns-setting-desc">
                  {friendAllowlistEnabled
                    ? 'Only respond to approved friends'
                    : 'Respond to all friends who message the bot'}
                </span>
              </div>
              <label className="lns-toggle">
                <input
                  type="checkbox"
                  checked={friendAllowlistEnabled}
                  onChange={(e) => setFriendAllowlistEnabled(e.target.checked)}
                />
                <span className="lns-toggle-slider" />
              </label>
            </div>

            {/* Group Response toggle */}
            <div className="lns-setting-row">
              <div className="lns-setting-info">
                <span className="lns-setting-name">Group Response</span>
                <span className="lns-setting-desc">Allow the bot to respond to messages in group chats</span>
              </div>
              <label className="lns-toggle">
                <input
                  type="checkbox"
                  checked={groupResponse}
                  onChange={(e) => setGroupResponse(e.target.checked)}
                />
                <span className="lns-toggle-slider" />
              </label>
            </div>

            {/* Actions */}
            <div className="lns-actions">
              <button
                className="lns-btn lns-btn-secondary"
                onClick={() => goToStep('verification', 'backward')}
                type="button"
              >
                Back
              </button>
              <button
                className="lns-btn lns-btn-primary"
                onClick={handleSaveAndDone}
                type="button"
              >
                Save & Done
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LineSetup;

/* ===================================================================
   Scoped styles (lns- prefix)
   =================================================================== */

const lineSetupStyles = `
/* Container */
.lns-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
}

/* Banner */
.lns-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.lns-banner-warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* Progress indicator */
.lns-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0.5rem 0;
}

.lns-progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  min-width: 80px;
}

.lns-progress-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--bg-primary, #0a0a1a);
  border: 2px solid rgba(255, 255, 255, 0.12);
  color: var(--text-tertiary, #606080);
  transition: all 0.3s ease;
}

.lns-progress-step.active .lns-progress-dot {
  background: #06C755;
  border-color: #06C755;
  color: #fff;
}

.lns-progress-step.done .lns-progress-dot {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

.lns-progress-label {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary, #606080);
  transition: color 0.3s ease;
}

.lns-progress-step.active .lns-progress-label {
  color: var(--text-primary, #fff);
}

.lns-progress-step.done .lns-progress-label {
  color: #10b981;
}

.lns-progress-line {
  flex: 1;
  max-width: 60px;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 0.5rem;
  margin-bottom: 1.25rem;
}

/* Step content animation */
.lns-step-content {
  animation: lns-slide-in 0.3s ease;
}

.lns-anim-forward {
  animation-name: lns-slide-forward;
}

.lns-anim-backward {
  animation-name: lns-slide-backward;
}

@keyframes lns-slide-forward {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes lns-slide-backward {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Step */
.lns-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Header */
.lns-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.lns-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(6, 199, 85, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #06C755;
  margin-bottom: 0.5rem;
}

.lns-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.lns-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  line-height: 1.5;
  max-width: 480px;
}

/* Instructions */
.lns-instructions {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.lns-instructions-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.625rem;
}

.lns-instructions-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lns-instructions-list li {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  line-height: 1.4;
}

.lns-instructions-list strong {
  color: var(--text-primary, #fff);
}

.lns-link {
  color: #06C755;
  text-decoration: none;
  font-weight: 500;
}

.lns-link:hover {
  text-decoration: underline;
}

/* Field */
.lns-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.lns-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

.lns-label-optional {
  font-weight: 400;
  color: var(--text-tertiary, #606080);
  font-size: 0.75rem;
}

.lns-field-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
}

.lns-masked-input-row {
  display: flex;
  gap: 0;
}

.lns-input {
  flex: 1;
  padding: 0.625rem 0.875rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text-primary, #fff);
  outline: none;
  transition: border-color 0.15s ease;
}

.lns-input:focus {
  border-color: #06C755;
}

.lns-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.lns-input-mono {
  font-family: var(--font-mono, monospace);
  font-size: 0.8125rem;
}

.lns-input-error {
  border-color: #ef4444;
}

.lns-input-error:focus {
  border-color: #ef4444;
}

.lns-masked-input-row .lns-input {
  border-radius: 8px 0 0 8px;
}

.lns-show-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left: none;
  border-radius: 0 8px 8px 0;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  transition: all 0.15s ease;
}

.lns-show-toggle:hover {
  color: var(--text-secondary, #a0a0c0);
  background: rgba(255, 255, 255, 0.04);
}

.lns-field-error {
  font-size: 0.75rem;
  color: #ef4444;
}

/* Error banner */
.lns-error-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #fca5a5;
}

.lns-error-banner svg {
  flex-shrink: 0;
  color: #ef4444;
}

/* Verifying state */
.lns-verifying {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  text-align: center;
}

.lns-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  border-top-color: #06C755;
  border-radius: 50%;
  animation: lns-spin 0.8s linear infinite;
}

@keyframes lns-spin {
  to { transform: rotate(360deg); }
}

.lns-verifying-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.lns-verifying-desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
}

/* Verify error */
.lns-verify-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 2rem;
  text-align: center;
}

.lns-error-icon {
  color: #ef4444;
}

.lns-error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.lns-error-message {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  max-width: 400px;
  line-height: 1.5;
}

/* Verify success */
.lns-verify-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 2rem;
  text-align: center;
}

.lns-success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
  margin-bottom: 0.5rem;
  animation: lns-success-pop 0.4s ease;
}

@keyframes lns-success-pop {
  0% { transform: scale(0.5); opacity: 0; }
  70% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.lns-success-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

/* Bot card */
.lns-bot-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 2rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  width: 100%;
  max-width: 360px;
}

.lns-bot-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(6, 199, 85, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #06C755;
  overflow: hidden;
}

.lns-bot-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.lns-bot-details {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.lns-bot-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.lns-bot-id {
  font-size: 0.8125rem;
  color: #06C755;
}

.lns-bot-badges {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  justify-content: center;
}

.lns-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 500;
  border-radius: 4px;
}

.lns-badge-green {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.lns-badge-yellow {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.lns-webhook-url {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.lns-webhook-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
}

.lns-webhook-value {
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  word-break: break-all;
  background: rgba(255, 255, 255, 0.04);
  padding: 0.375rem 0.5rem;
  border-radius: 4px;
}

/* Bot summary (step 3 header) */
.lns-bot-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.lns-bot-avatar-sm {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(6, 199, 85, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #06C755;
  flex-shrink: 0;
  overflow: hidden;
}

.lns-bot-avatar-img-sm {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.lns-summary-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  display: block;
}

.lns-summary-id {
  font-size: 0.75rem;
  color: #06C755;
}

/* Setting row */
.lns-setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.lns-setting-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;
}

.lns-setting-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.lns-setting-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.lns-setting-note {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  font-style: italic;
  margin-top: 0.125rem;
}

/* Toggle */
.lns-toggle {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  cursor: pointer;
}

.lns-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.lns-toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  transition: background 0.2s ease;
}

.lns-toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.lns-toggle input:checked + .lns-toggle-slider {
  background: #06C755;
}

.lns-toggle input:checked + .lns-toggle-slider::before {
  transform: translateX(20px);
}

/* Buttons */
.lns-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.lns-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.lns-btn-primary {
  background: #06C755;
  color: #fff;
}

.lns-btn-primary:hover:not(:disabled) {
  background: #05a847;
  transform: translateY(-1px);
}

.lns-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lns-btn-secondary {
  background: transparent;
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.lns-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--text-primary, #fff);
}

.lns-btn-small {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: #06C755;
  color: #fff;
  border-radius: 6px;
}

.lns-btn-small:hover:not(:disabled) {
  background: #05a847;
}

.lns-btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 480px) {
  .lns-container {
    padding: 1rem;
  }

  .lns-actions {
    flex-direction: column-reverse;
  }

  .lns-actions .lns-btn {
    width: 100%;
    justify-content: center;
  }

  .lns-progress-label {
    font-size: 0.625rem;
  }

  .lns-progress-step {
    min-width: 60px;
  }
}
`;
