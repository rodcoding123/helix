/**
 * OAuth Flow Dialog - Modal dialog for OAuth authentication flows
 *
 * Handles the full OAuth lifecycle:
 *   1. Initiates the OAuth flow with the gateway
 *   2. Shows the auth URL / opens external browser
 *   3. Polls for flow completion every 2 seconds
 *   4. Shows success/failure states with retry option
 *   5. Loading animation while waiting for OAuth callback
 *
 * Gateway Methods:
 *   - auth.oauth.start   -> Initiate flow, returns { flowId, authUrl }
 *   - auth.oauth.status  -> Poll completion, returns { status, profile? }
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';
import type { AuthProfile } from './AuthProfileManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OAuthFlowDialogProps {
  provider: string;
  onComplete: (profile: AuthProfile) => void;
  onCancel: () => void;
}

type FlowStatus = 'initiating' | 'waiting' | 'success' | 'error';

interface ProviderDisplay {
  name: string;
  color: string;
  icon: string;
  scopes: string[];
  description: string;
}

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

const PROVIDER_DISPLAY: Record<string, ProviderDisplay> = {
  openai: {
    name: 'OpenAI',
    color: '#10A37F',
    icon: 'O',
    scopes: ['model.read', 'model.request', 'usage.read'],
    description:
      'Connect your OpenAI account to access GPT-4o and other models. You will be redirected to OpenAI to authorize access.',
  },
  google: {
    name: 'Google',
    color: '#4285F4',
    icon: 'G',
    scopes: ['generativelanguage.generate', 'generativelanguage.models.list'],
    description:
      'Connect your Google Cloud account to access Gemini models. You will be redirected to Google for authentication.',
  },
  azure: {
    name: 'Azure OpenAI',
    color: '#0078D4',
    icon: 'Az',
    scopes: ['cognitive_services.read', 'cognitive_services.generate'],
    description:
      'Connect your Azure subscription to access Azure OpenAI Service. You will sign in with your Microsoft account.',
  },
  anthropic: {
    name: 'Anthropic',
    color: '#D4A574',
    icon: 'A',
    scopes: ['messages.create', 'models.list'],
    description:
      'Connect your Anthropic account to access Claude models directly via OAuth.',
  },
  deepseek: {
    name: 'DeepSeek',
    color: '#0066FF',
    icon: 'D',
    scopes: ['chat.completions', 'models.list'],
    description:
      'Connect your DeepSeek account for model access.',
  },
};

function getProviderDisplay(provider: string): ProviderDisplay {
  return (
    PROVIDER_DISPLAY[provider] ?? {
      name: provider.charAt(0).toUpperCase() + provider.slice(1),
      color: '#8b5cf6',
      icon: provider.charAt(0).toUpperCase(),
      scopes: [],
      description: `Connect your ${provider} account for model access.`,
    }
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // 5 minutes at 2s intervals

function formatCountdown(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OAuthFlowDialog({ provider, onComplete, onCancel }: OAuthFlowDialogProps) {
  const { getClient } = useGateway();

  // State
  const [status, setStatus] = useState<FlowStatus>('initiating');
  const [flowId, setFlowId] = useState<string>('');
  const [authUrl, setAuthUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pollCount, setPollCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes
  const [urlCopied, setUrlCopied] = useState(false);

  // Refs for cleanup
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const flowIdRef = useRef<string>('');

  const display = getProviderDisplay(provider);

  // --- Cleanup on unmount ---
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // --- Gateway request helper ---
  const sendRequest = useCallback(
    async <T = unknown,>(method: string, params?: unknown): Promise<T> => {
      const client = getClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }
      return client.request<T>(method, params);
    },
    [getClient]
  );

  // --- Start the OAuth flow ---
  const startFlow = useCallback(async () => {
    setStatus('initiating');
    setErrorMessage('');
    setPollCount(0);
    setTimeRemaining(300);
    setUrlCopied(false);

    try {
      const result = await sendRequest<{ flowId: string; authUrl: string }>(
        'auth.oauth.start',
        { provider }
      );

      if (!mountedRef.current) return;

      if (!result.flowId || !result.authUrl) {
        throw new Error('Invalid OAuth flow response from gateway');
      }

      setFlowId(result.flowId);
      flowIdRef.current = result.flowId;
      setAuthUrl(result.authUrl);
      setStatus('waiting');

      // Try to open the URL in an external browser
      try {
        window.open(result.authUrl, '_blank', 'noopener,noreferrer');
      } catch {
        // If window.open fails (e.g. in Tauri), the user can copy the URL
        console.debug('Could not auto-open auth URL, user must copy it manually');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to start OAuth flow'
      );
    }
  }, [provider, sendRequest]);

  // --- Poll for completion ---
  useEffect(() => {
    if (status !== 'waiting' || !flowIdRef.current) return;

    const poll = async () => {
      if (!mountedRef.current) return;

      try {
        const result = await sendRequest<{
          status: 'pending' | 'completed' | 'failed' | 'expired';
          profile?: AuthProfile;
          error?: string;
        }>('auth.oauth.status', { flowId: flowIdRef.current });

        if (!mountedRef.current) return;

        setPollCount((prev) => prev + 1);

        if (result.status === 'completed' && result.profile) {
          setStatus('success');
          // Brief delay so the user sees the success state
          setTimeout(() => {
            if (mountedRef.current) {
              onComplete(result.profile!);
            }
          }, 1500);
          return;
        }

        if (result.status === 'failed') {
          setStatus('error');
          setErrorMessage(result.error ?? 'OAuth authentication failed');
          return;
        }

        if (result.status === 'expired') {
          setStatus('error');
          setErrorMessage('OAuth flow expired. Please try again.');
          return;
        }

        // Still pending - continue polling
      } catch (err) {
        if (!mountedRef.current) return;
        // Network errors during polling are non-fatal, continue
        console.warn('OAuth poll error (will retry):', err);
      }
    };

    // Start polling
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    // Also poll immediately on first mount
    poll();

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [status, sendRequest, onComplete]);

  // --- Countdown timer ---
  useEffect(() => {
    if (status !== 'waiting') return;

    countdownRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setStatus('error');
          setErrorMessage('OAuth flow timed out. Please try again.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [status]);

  // --- Check if max attempts exceeded ---
  useEffect(() => {
    if (pollCount >= MAX_POLL_ATTEMPTS && status === 'waiting') {
      setStatus('error');
      setErrorMessage('Maximum polling attempts reached. Please try again.');
    }
  }, [pollCount, status]);

  // --- Initiate flow on mount ---
  useEffect(() => {
    startFlow();
  }, []);

  // --- Copy URL to clipboard ---
  const copyUrl = useCallback(async () => {
    if (!authUrl) return;
    try {
      await navigator.clipboard.writeText(authUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = authUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }
  }, [authUrl]);

  // --- Retry flow ---
  const handleRetry = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    startFlow();
  }, [startFlow]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <>
      <style>{oauthFlowStyles}</style>

      <div className="ofd-overlay" onClick={onCancel}>
        <div className="ofd-dialog" onClick={(e) => e.stopPropagation()}>
          {/* Close button */}
          <button className="ofd-close" onClick={onCancel} type="button">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Provider header */}
          <div className="ofd-provider-header">
            <div
              className="ofd-provider-icon"
              style={{ backgroundColor: display.color }}
            >
              {display.icon}
            </div>
            <div className="ofd-provider-info">
              <h3 className="ofd-provider-name">
                {status === 'initiating' && `Connecting to ${display.name}...`}
                {status === 'waiting' && `Authenticate with ${display.name}`}
                {status === 'success' && `${display.name} Connected`}
                {status === 'error' && `${display.name} Connection Failed`}
              </h3>
              <p className="ofd-provider-desc">
                {status === 'initiating' && 'Preparing OAuth authentication flow...'}
                {status === 'waiting' && display.description}
                {status === 'success' && 'Your account has been successfully linked.'}
                {status === 'error' && 'Something went wrong during authentication.'}
              </p>
            </div>
          </div>

          {/* ── INITIATING STATE ── */}
          {status === 'initiating' && (
            <div className="ofd-state ofd-state--initiating">
              <div className="ofd-loader">
                <div className="ofd-loader__ring" style={{ borderTopColor: display.color }} />
                <div className="ofd-loader__ring ofd-loader__ring--inner" style={{ borderTopColor: display.color }} />
              </div>
              <span className="ofd-state__text">
                Contacting {display.name} OAuth service...
              </span>
            </div>
          )}

          {/* ── WAITING STATE ── */}
          {status === 'waiting' && (
            <div className="ofd-state ofd-state--waiting">
              {/* Animated waiting indicator */}
              <div className="ofd-waiting-animation">
                <div className="ofd-waiting-pulse" style={{ backgroundColor: display.color }} />
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={display.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                </svg>
              </div>

              <p className="ofd-waiting-text">
                A browser window has been opened. Complete the authentication in your browser, then return here.
              </p>

              {/* Timer */}
              <div className="ofd-timer">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" className="ofd-timer__icon">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span className="ofd-timer__text">
                  Time remaining: {formatCountdown(timeRemaining)}
                </span>
              </div>

              {/* URL section */}
              <div className="ofd-url-section">
                <span className="ofd-url-label">
                  If the browser didn't open, use this link:
                </span>
                <div className="ofd-url-row">
                  <input
                    className="ofd-url-input"
                    value={authUrl}
                    readOnly
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    className="ofd-url-copy"
                    onClick={copyUrl}
                    type="button"
                  >
                    {urlCopied ? (
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                    )}
                    {urlCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <button
                  className="ofd-url-open"
                  onClick={() => window.open(authUrl, '_blank', 'noopener,noreferrer')}
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                  Open in Browser
                </button>
              </div>

              {/* Scopes */}
              {display.scopes.length > 0 && (
                <div className="ofd-scopes">
                  <span className="ofd-scopes__label">Requested permissions:</span>
                  <div className="ofd-scopes__list">
                    {display.scopes.map((scope) => (
                      <span key={scope} className="ofd-scopes__item">
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Poll status */}
              <div className="ofd-poll-status">
                <span className="ofd-poll-dot" />
                Listening for authentication callback...
              </div>
            </div>
          )}

          {/* ── SUCCESS STATE ── */}
          {status === 'success' && (
            <div className="ofd-state ofd-state--success">
              <div className="ofd-success-icon">
                <svg width="56" height="56" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h4 className="ofd-success-title">Authentication Successful</h4>
              <p className="ofd-success-text">
                Your {display.name} account has been connected. The profile will now appear in your auth profiles list.
              </p>
              <div className="ofd-success-check">
                <div className="ofd-success-check__bar" style={{ backgroundColor: display.color }} />
              </div>
            </div>
          )}

          {/* ── ERROR STATE ── */}
          {status === 'error' && (
            <div className="ofd-state ofd-state--error">
              <div className="ofd-error-icon">
                <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h4 className="ofd-error-title">Authentication Failed</h4>
              <p className="ofd-error-text">{errorMessage}</p>

              <div className="ofd-error-details">
                <div className="ofd-error-detail-row">
                  <span className="ofd-error-detail-label">Provider</span>
                  <span className="ofd-error-detail-value">{display.name}</span>
                </div>
                {flowId && (
                  <div className="ofd-error-detail-row">
                    <span className="ofd-error-detail-label">Flow ID</span>
                    <span className="ofd-error-detail-value ofd-error-detail-value--mono">
                      {flowId.slice(0, 12)}...
                    </span>
                  </div>
                )}
                <div className="ofd-error-detail-row">
                  <span className="ofd-error-detail-label">Attempts</span>
                  <span className="ofd-error-detail-value">{pollCount}</span>
                </div>
              </div>

              <div className="ofd-error-actions">
                <button
                  className="ofd-btn ofd-btn--secondary"
                  onClick={onCancel}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="ofd-btn ofd-btn--primary"
                  onClick={handleRetry}
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Bottom cancel for non-error states */}
          {(status === 'initiating' || status === 'waiting') && (
            <div className="ofd-bottom-actions">
              <button
                className="ofd-btn ofd-btn--secondary"
                onClick={onCancel}
                type="button"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles (ofd- prefix)
// ---------------------------------------------------------------------------

const oauthFlowStyles = `
/* ═══════════════════════════════
   OAuth Flow Dialog Styles
   ═══════════════════════════════ */

.ofd-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  animation: ofd-fade-in 0.15s ease;
}

@keyframes ofd-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.ofd-dialog {
  background: #141420;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 1.75rem;
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(139, 92, 246, 0.08);
  animation: ofd-dialog-in 0.25s ease;
  position: relative;
}

@keyframes ofd-dialog-in {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Close button */
.ofd-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  color: #a0a0a0;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: all 0.15s ease;
  z-index: 1;
}

.ofd-close:hover {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.08);
}

/* ── Provider header ── */
.ofd-provider-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-right: 2rem;
}

.ofd-provider-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
  letter-spacing: -0.02em;
}

.ofd-provider-info {
  flex: 1;
  min-width: 0;
}

.ofd-provider-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0 0 0.25rem;
}

.ofd-provider-desc {
  font-size: 0.8125rem;
  color: #a0a0a0;
  line-height: 1.5;
  margin: 0;
}

/* ── Shared state container ── */
.ofd-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem 0;
}

.ofd-state__text {
  font-size: 0.875rem;
  color: #a0a0a0;
  margin-top: 1rem;
}

/* ── Initiating: loader animation ── */
.ofd-loader {
  position: relative;
  width: 56px;
  height: 56px;
}

.ofd-loader__ring {
  position: absolute;
  inset: 0;
  border: 3px solid rgba(255, 255, 255, 0.06);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: ofd-ring-spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.ofd-loader__ring--inner {
  inset: 8px;
  animation-direction: reverse;
  animation-duration: 0.7s;
  border-top-color: #a78bfa;
}

@keyframes ofd-ring-spin {
  to { transform: rotate(360deg); }
}

/* ── Waiting state ── */
.ofd-state--waiting {
  gap: 1rem;
}

.ofd-waiting-animation {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
}

.ofd-waiting-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  opacity: 0.15;
  animation: ofd-pulse 2s ease-in-out infinite;
}

@keyframes ofd-pulse {
  0%, 100% {
    transform: scale(0.85);
    opacity: 0.1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.25;
  }
}

.ofd-waiting-text {
  font-size: 0.875rem;
  color: #a0a0a0;
  line-height: 1.5;
  max-width: 360px;
  margin: 0;
}

/* Timer */
.ofd-timer {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #a0a0a0;
  background: rgba(255, 255, 255, 0.03);
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.ofd-timer__icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.ofd-timer__text {
  font-variant-numeric: tabular-nums;
}

/* URL section */
.ofd-url-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.ofd-url-label {
  font-size: 0.6875rem;
  color: #a0a0a0;
  text-align: left;
}

.ofd-url-row {
  display: flex;
  gap: 0.375rem;
}

.ofd-url-input {
  flex: 1;
  padding: 0.375rem 0.625rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 0.6875rem;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  color: #a0a0a0;
  outline: none;
  min-width: 0;
  cursor: text;
}

.ofd-url-input:focus {
  border-color: #8b5cf6;
  color: #e0e0e0;
}

.ofd-url-copy {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.ofd-url-copy:hover {
  background: rgba(255, 255, 255, 0.1);
}

.ofd-url-open {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  color: #8b5cf6;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.25rem 0;
  transition: color 0.15s;
  align-self: flex-start;
}

.ofd-url-open:hover {
  color: #a78bfa;
}

/* Scopes */
.ofd-scopes {
  width: 100%;
  text-align: left;
  padding: 0.625rem 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.ofd-scopes__label {
  display: block;
  font-size: 0.6875rem;
  color: #a0a0a0;
  margin-bottom: 0.375rem;
  font-weight: 500;
}

.ofd-scopes__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.ofd-scopes__item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: #34d399;
  background: rgba(52, 211, 153, 0.08);
  padding: 0.1875rem 0.5rem;
  border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}

.ofd-scopes__item svg {
  flex-shrink: 0;
}

/* Poll status */
.ofd-poll-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #a0a0a0;
}

.ofd-poll-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8b5cf6;
  animation: ofd-poll-blink 1.5s ease-in-out infinite;
}

@keyframes ofd-poll-blink {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* ── Success state ── */
.ofd-state--success {
  gap: 0.75rem;
  padding: 1.5rem 0;
}

.ofd-success-icon {
  color: #34d399;
  animation: ofd-success-pop 0.4s ease;
}

@keyframes ofd-success-pop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

.ofd-success-title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0;
}

.ofd-success-text {
  font-size: 0.8125rem;
  color: #a0a0a0;
  line-height: 1.5;
  max-width: 340px;
  margin: 0;
}

.ofd-success-check {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  margin-top: 0.5rem;
  overflow: hidden;
}

.ofd-success-check__bar {
  height: 100%;
  border-radius: 2px;
  animation: ofd-success-fill 1.5s ease-out forwards;
}

@keyframes ofd-success-fill {
  from { width: 0%; }
  to { width: 100%; }
}

/* ── Error state ── */
.ofd-state--error {
  gap: 0.75rem;
  padding: 1rem 0;
}

.ofd-error-icon {
  color: #fca5a5;
}

.ofd-error-title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0;
}

.ofd-error-text {
  font-size: 0.8125rem;
  color: #fca5a5;
  line-height: 1.5;
  max-width: 360px;
  margin: 0;
  background: rgba(239, 68, 68, 0.06);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  width: 100%;
  text-align: left;
}

.ofd-error-details {
  width: 100%;
  padding: 0.625rem 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.ofd-error-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ofd-error-detail-label {
  font-size: 0.6875rem;
  color: #a0a0a0;
  font-weight: 500;
}

.ofd-error-detail-value {
  font-size: 0.75rem;
  color: #e0e0e0;
}

.ofd-error-detail-value--mono {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.6875rem;
  color: #a0a0a0;
}

.ofd-error-actions {
  display: flex;
  gap: 0.625rem;
  margin-top: 0.5rem;
}

/* ── Buttons ── */
.ofd-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1.125rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ofd-btn--primary {
  background: #8b5cf6;
  color: white;
}

.ofd-btn--primary:hover {
  background: #7c3aed;
}

.ofd-btn--secondary {
  background: rgba(255, 255, 255, 0.06);
  color: #e0e0e0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ofd-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Bottom actions */
.ofd-bottom-actions {
  display: flex;
  justify-content: center;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* ═══ Scrollbar ═══ */
.ofd-dialog::-webkit-scrollbar {
  width: 6px;
}

.ofd-dialog::-webkit-scrollbar-track {
  background: transparent;
}

.ofd-dialog::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.ofd-dialog::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
`;
