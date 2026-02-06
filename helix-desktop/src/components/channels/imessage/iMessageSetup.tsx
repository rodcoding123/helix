/**
 * iMessage Setup - Step wizard for connecting iMessage via BlueBubbles
 *
 * Flow:
 *   Step 1: Platform Check - macOS detection, BlueBubbles server URL/password
 *   Step 2: Verification - connection test, server info display
 *   Step 3: Configuration - contact allowlist, read receipts, typing indicators
 *
 * Uses gateway `channels.login` (imessage) for BlueBubbles bridge auth
 * and `config.patch` for persisting channel configuration.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGateway } from '../../../hooks/useGateway';
import { useGatewayConfig } from '../../../hooks/useGatewayConfig';

/* ===================================================================
   Types
   =================================================================== */

export interface iMessageSetupProps {
  onBack?: () => void;
  onConnected?: () => void;
}

type SetupStep = 'platform-check' | 'verification' | 'configuration';

interface BlueBubblesServerInfo {
  version?: string;
  connectedDevices?: number;
  macOsVersion?: string;
  serverName?: string;
}

/* ===================================================================
   Helpers
   =================================================================== */

/**
 * Detect if the current platform is macOS.
 * Uses navigator.platform and navigator.userAgent for detection.
 */
function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform?.toLowerCase() ?? '';
  const userAgent = navigator.userAgent?.toLowerCase() ?? '';
  return platform.includes('mac') || userAgent.includes('macintosh') || userAgent.includes('mac os');
}

/**
 * Validate a server URL format.
 */
function isValidServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/* ===================================================================
   Component
   =================================================================== */

export function iMessageSetup({ onBack, onConnected }: iMessageSetupProps) {
  const { getClient, connected: gatewayConnected } = useGateway();
  const { patchGatewayConfig } = useGatewayConfig();

  // Platform check
  const [platformIsMac] = useState(() => isMacOS());

  // Step wizard state
  const [step, setStep] = useState<SetupStep>('platform-check');
  const [animDirection, setAnimDirection] = useState<'forward' | 'backward'>('forward');

  // Step 1: Platform Check
  const [serverUrl, setServerUrl] = useState('');
  const [serverPassword, setServerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Verification
  const [connecting, setConnecting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<BlueBubblesServerInfo>({});

  // Step 3: Configuration
  const [contactAllowlist, setContactAllowlist] = useState<string[]>([]);
  const [contactInput, setContactInput] = useState('');
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicators, setTypingIndicators] = useState(true);

  // Focus URL input on mount
  useEffect(() => {
    if (step === 'platform-check' && platformIsMac) {
      urlInputRef.current?.focus();
    }
  }, [step, platformIsMac]);

  /* ---------------------------------------------------------------
     Navigation helpers
     --------------------------------------------------------------- */

  const goToStep = useCallback((target: SetupStep, direction: 'forward' | 'backward' = 'forward') => {
    setAnimDirection(direction);
    setStep(target);
  }, []);

  /* ---------------------------------------------------------------
     Step 1: Connect to BlueBubbles
     --------------------------------------------------------------- */

  const handleServerUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setServerUrl(e.target.value);
    setConnectError(null);
  }, []);

  const handleServerPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setServerPassword(e.target.value);
    setConnectError(null);
  }, []);

  const handleConnect = useCallback(async () => {
    const url = serverUrl.trim();
    const password = serverPassword.trim();

    if (!url) {
      setConnectError('Please enter the BlueBubbles server URL.');
      return;
    }

    if (!isValidServerUrl(url)) {
      setConnectError('Invalid URL format. Example: http://localhost:1234');
      return;
    }

    if (!password) {
      setConnectError('Please enter the server password.');
      return;
    }

    const client = getClient();
    if (!client?.connected) {
      setConnectError('Gateway not connected. Please start the gateway first.');
      return;
    }

    // Move to verification step
    goToStep('verification');
    setConnecting(true);
    setVerifyError(null);

    try {
      const result = await client.request<{
        status?: string;
        error?: string;
        server?: BlueBubblesServerInfo;
      }>('channels.login', {
        channel: 'imessage',
        serverUrl: url,
        password,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setServerInfo(result.server ?? {});
      setConnecting(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setVerifyError(
        message.includes('ECONNREFUSED') || message.includes('network')
          ? 'Cannot connect to BlueBubbles server. Make sure it is running and the URL is correct.'
          : message.includes('401') || message.includes('Unauthorized') || message.includes('password')
            ? 'Invalid server password. Please check your password and try again.'
            : `Connection failed: ${message}`
      );
      setConnecting(false);
    }
  }, [serverUrl, serverPassword, getClient, goToStep]);

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConnect();
      }
    },
    [handleConnect]
  );

  const handlePasswordKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConnect();
      }
    },
    [handleConnect]
  );

  /* ---------------------------------------------------------------
     Step 3: Configuration - allowlist management
     --------------------------------------------------------------- */

  const handleAddContact = useCallback(() => {
    const value = contactInput.trim();
    if (!value) return;
    if (!contactAllowlist.includes(value)) {
      setContactAllowlist((prev) => [...prev, value]);
    }
    setContactInput('');
  }, [contactInput, contactAllowlist]);

  const handleRemoveContact = useCallback((contact: string) => {
    setContactAllowlist((prev) => prev.filter((c) => c !== contact));
  }, []);

  const handleContactKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddContact();
      }
    },
    [handleAddContact]
  );

  /* ---------------------------------------------------------------
     Save & finish
     --------------------------------------------------------------- */

  const handleSaveAndDone = useCallback(async () => {
    try {
      await patchGatewayConfig({
        'channels.imessage': {
          enabled: true,
          config: {
            serverUrl: serverUrl.trim(),
            contactAllowlist,
            readReceipts,
            typingIndicators,
          },
        },
      });
    } catch (err) {
      console.error('Failed to save iMessage config:', err);
    }

    onConnected?.();
  }, [patchGatewayConfig, serverUrl, contactAllowlist, readReceipts, typingIndicators, onConnected]);

  /* ---------------------------------------------------------------
     Render
     --------------------------------------------------------------- */

  return (
    <div className="ims-container">
      <style>{iMessageSetupStyles}</style>

      {/* Gateway disconnected banner */}
      {!gatewayConnected && (
        <div className="ims-banner ims-banner-warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. iMessage setup requires an active gateway connection.
        </div>
      )}

      {/* Step progress indicator */}
      <div className="ims-progress">
        <div className={`ims-progress-step ${step === 'platform-check' ? 'active' : 'done'}`}>
          <span className="ims-progress-dot">
            {step !== 'platform-check' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '1'}
          </span>
          <span className="ims-progress-label">Platform Check</span>
        </div>
        <div className="ims-progress-line" />
        <div className={`ims-progress-step ${step === 'verification' ? 'active' : step === 'configuration' ? 'done' : ''}`}>
          <span className="ims-progress-dot">
            {step === 'configuration' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '2'}
          </span>
          <span className="ims-progress-label">Verification</span>
        </div>
        <div className="ims-progress-line" />
        <div className={`ims-progress-step ${step === 'configuration' ? 'active' : ''}`}>
          <span className="ims-progress-dot">3</span>
          <span className="ims-progress-label">Configuration</span>
        </div>
      </div>

      {/* Step content with animated transitions */}
      <div className={`ims-step-content ims-anim-${animDirection}`} key={step}>
        {/* ============================================================
            STEP 1: Platform Check
            ============================================================ */}
        {step === 'platform-check' && (
          <div className="ims-step">
            <div className="ims-header">
              <div className="ims-icon-circle">
                <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                  <path d="M12 15l1.57-3.43L17 10l-3.43-1.57L12 5l-1.57 3.43L7 10l3.43 1.57z" />
                </svg>
              </div>
              <h2 className="ims-title">Connect iMessage</h2>
              <p className="ims-subtitle">
                Link your iMessage account through BlueBubbles to enable messaging capabilities.
              </p>
            </div>

            {/* Platform check */}
            {!platformIsMac ? (
              /* Not macOS - show platform warning */
              <div className="ims-platform-warning">
                <div className="ims-platform-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 className="ims-platform-title">iMessage is only available on macOS</h3>
                <p className="ims-platform-desc">
                  iMessage integration requires a Mac running the BlueBubbles server application.
                  BlueBubbles acts as a bridge between iMessage and external applications.
                </p>
                <a
                  href="https://bluebubbles.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ims-link"
                >
                  Learn more about BlueBubbles
                </a>
                {onBack && (
                  <div className="ims-actions" style={{ marginTop: '1rem' }}>
                    <button className="ims-btn ims-btn-secondary" onClick={onBack} type="button">
                      Back
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* macOS - show setup form */
              <>
                {/* Prerequisites */}
                <div className="ims-checklist">
                  <h4 className="ims-checklist-title">Prerequisites</h4>
                  <div className="ims-checklist-items">
                    <div className="ims-check-item">
                      <div className="ims-check-icon">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="ims-check-label">Messages.app configured and signed in</span>
                    </div>
                    <div className="ims-check-item">
                      <div className="ims-check-icon">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="ims-check-label">BlueBubbles server installed and running</span>
                    </div>
                    <div className="ims-check-item">
                      <div className="ims-check-icon">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="ims-check-label">BlueBubbles server URL and password ready</span>
                    </div>
                  </div>
                </div>

                {/* Server URL input */}
                <div className="ims-field">
                  <label className="ims-label" htmlFor="ims-url-input">Server URL</label>
                  <input
                    id="ims-url-input"
                    ref={urlInputRef}
                    type="url"
                    className={`ims-input ${connectError && !serverPassword ? 'ims-input-error' : ''}`}
                    placeholder="http://localhost:1234"
                    value={serverUrl}
                    onChange={handleServerUrlChange}
                    onKeyDown={handleUrlKeyDown}
                    autoComplete="url"
                  />
                </div>

                {/* Server password input */}
                <div className="ims-field">
                  <label className="ims-label" htmlFor="ims-password-input">Server Password</label>
                  <div className="ims-password-row">
                    <input
                      id="ims-password-input"
                      type={showPassword ? 'text' : 'password'}
                      className={`ims-input ${connectError ? 'ims-input-error' : ''}`}
                      placeholder="Enter server password"
                      value={serverPassword}
                      onChange={handleServerPasswordChange}
                      onKeyDown={handlePasswordKeyDown}
                      autoComplete="current-password"
                    />
                    <button
                      className="ims-show-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
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
                  {connectError && <span className="ims-field-error">{connectError}</span>}
                </div>

                {/* Actions */}
                <div className="ims-actions">
                  {onBack && (
                    <button className="ims-btn ims-btn-secondary" onClick={onBack} type="button">
                      Back
                    </button>
                  )}
                  <button
                    className="ims-btn ims-btn-primary"
                    onClick={handleConnect}
                    disabled={!gatewayConnected || !serverUrl.trim() || !serverPassword.trim()}
                    type="button"
                  >
                    Connect
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ============================================================
            STEP 2: Verification
            ============================================================ */}
        {step === 'verification' && (
          <div className="ims-step">
            {connecting ? (
              /* Connecting state */
              <div className="ims-verifying">
                <div className="ims-spinner" />
                <h3 className="ims-verifying-title">Connecting to BlueBubbles...</h3>
                <p className="ims-verifying-desc">Testing connection to your BlueBubbles server</p>
              </div>
            ) : verifyError ? (
              /* Error state */
              <div className="ims-verify-error">
                <div className="ims-error-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h3 className="ims-error-title">Connection Failed</h3>
                <p className="ims-error-message">{verifyError}</p>
                <div className="ims-actions">
                  <button
                    className="ims-btn ims-btn-secondary"
                    onClick={() => goToStep('platform-check', 'backward')}
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    className="ims-btn ims-btn-primary"
                    onClick={handleConnect}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              /* Success state */
              <div className="ims-verify-success">
                <div className="ims-success-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3 className="ims-success-title">BlueBubbles Connected!</h3>

                {/* Server info card */}
                <div className="ims-server-card">
                  <div className="ims-server-avatar">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                      <path d="M12 15l1.57-3.43L17 10l-3.43-1.57L12 5l-1.57 3.43L7 10l3.43 1.57z" />
                    </svg>
                  </div>
                  <div className="ims-server-details">
                    {serverInfo.serverName && (
                      <div className="ims-server-row">
                        <span className="ims-server-label">Server</span>
                        <span className="ims-server-value">{serverInfo.serverName}</span>
                      </div>
                    )}
                    {serverInfo.version && (
                      <div className="ims-server-row">
                        <span className="ims-server-label">Version</span>
                        <span className="ims-server-value">{serverInfo.version}</span>
                      </div>
                    )}
                    {serverInfo.connectedDevices !== undefined && (
                      <div className="ims-server-row">
                        <span className="ims-server-label">Connected Devices</span>
                        <span className="ims-server-value">{serverInfo.connectedDevices}</span>
                      </div>
                    )}
                    {serverInfo.macOsVersion && (
                      <div className="ims-server-row">
                        <span className="ims-server-label">macOS</span>
                        <span className="ims-server-value">{serverInfo.macOsVersion}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Continue */}
                <div className="ims-actions">
                  <button
                    className="ims-btn ims-btn-secondary"
                    onClick={() => goToStep('platform-check', 'backward')}
                    type="button"
                  >
                    Change Server
                  </button>
                  <button
                    className="ims-btn ims-btn-primary"
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
          <div className="ims-step">
            {/* Success header */}
            <div className="ims-header">
              <div className="ims-success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2 className="ims-title">iMessage Connected!</h2>
              <p className="ims-subtitle">
                Configure messaging behavior for your iMessage integration.
              </p>
            </div>

            {/* Contact allowlist */}
            <div className="ims-section">
              <h3 className="ims-section-title">Contact Allowlist</h3>
              <p className="ims-section-desc">
                Only respond to messages from these contacts. Supports phone numbers and email addresses.
                Leave empty to respond to all contacts.
              </p>
              <div className="ims-tag-input-area">
                <div className="ims-tag-input-row">
                  <input
                    type="text"
                    className="ims-input"
                    placeholder="Phone or email (e.g., +1234567890, user@icloud.com)"
                    value={contactInput}
                    onChange={(e) => setContactInput(e.target.value)}
                    onKeyDown={handleContactKeyDown}
                  />
                  <button
                    className="ims-btn ims-btn-small"
                    onClick={handleAddContact}
                    disabled={!contactInput.trim()}
                    type="button"
                  >
                    Add
                  </button>
                </div>
                {contactAllowlist.length > 0 && (
                  <div className="ims-tags">
                    {contactAllowlist.map((contact) => (
                      <span key={contact} className="ims-tag">
                        {contact}
                        <button
                          className="ims-tag-remove"
                          onClick={() => handleRemoveContact(contact)}
                          type="button"
                          aria-label={`Remove ${contact}`}
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Read receipts toggle */}
            <div className="ims-setting-row">
              <div className="ims-setting-info">
                <span className="ims-setting-name">Send Read Receipts</span>
                <span className="ims-setting-desc">Let senders know when their messages have been read</span>
              </div>
              <label className="ims-toggle">
                <input
                  type="checkbox"
                  checked={readReceipts}
                  onChange={(e) => setReadReceipts(e.target.checked)}
                />
                <span className="ims-toggle-slider" />
              </label>
            </div>

            {/* Typing indicators toggle */}
            <div className="ims-setting-row">
              <div className="ims-setting-info">
                <span className="ims-setting-name">Typing Indicators</span>
                <span className="ims-setting-desc">Show typing indicator when composing a response</span>
              </div>
              <label className="ims-toggle">
                <input
                  type="checkbox"
                  checked={typingIndicators}
                  onChange={(e) => setTypingIndicators(e.target.checked)}
                />
                <span className="ims-toggle-slider" />
              </label>
            </div>

            {/* Actions */}
            <div className="ims-actions">
              <button
                className="ims-btn ims-btn-primary"
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

export default iMessageSetup;

/* ===================================================================
   Scoped styles (ims- prefix)
   =================================================================== */

const iMessageSetupStyles = `
/* Container */
.ims-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
}

/* Banner */
.ims-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.ims-banner-warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* Progress indicator */
.ims-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0.5rem 0;
}

.ims-progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  min-width: 80px;
}

.ims-progress-dot {
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

.ims-progress-step.active .ims-progress-dot {
  background: #007AFF;
  border-color: #007AFF;
  color: #fff;
}

.ims-progress-step.done .ims-progress-dot {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

.ims-progress-label {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary, #606080);
  transition: color 0.3s ease;
}

.ims-progress-step.active .ims-progress-label {
  color: var(--text-primary, #fff);
}

.ims-progress-step.done .ims-progress-label {
  color: #10b981;
}

.ims-progress-line {
  flex: 1;
  max-width: 60px;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 0.5rem;
  margin-bottom: 1.25rem;
}

/* Step content animation */
.ims-step-content {
  animation: ims-slide-in 0.3s ease;
}

.ims-anim-forward {
  animation-name: ims-slide-forward;
}

.ims-anim-backward {
  animation-name: ims-slide-backward;
}

@keyframes ims-slide-forward {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes ims-slide-backward {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Step */
.ims-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Header */
.ims-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.ims-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(0, 122, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #007AFF;
  margin-bottom: 0.5rem;
}

.ims-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.ims-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  line-height: 1.5;
  max-width: 480px;
}

/* Platform warning */
.ims-platform-warning {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 2rem;
  text-align: center;
}

.ims-platform-icon {
  color: #f59e0b;
}

.ims-platform-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.ims-platform-desc {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  max-width: 420px;
  line-height: 1.5;
}

.ims-link {
  color: #007AFF;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
}

.ims-link:hover {
  text-decoration: underline;
}

/* Checklist */
.ims-checklist {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.ims-checklist-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.75rem;
}

.ims-checklist-items {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.ims-check-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ims-check-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 122, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #007AFF;
  flex-shrink: 0;
}

.ims-check-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

/* Field */
.ims-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.ims-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

.ims-input {
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

.ims-input:focus {
  border-color: #007AFF;
}

.ims-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.ims-input-error {
  border-color: #ef4444;
}

.ims-input-error:focus {
  border-color: #ef4444;
}

.ims-password-row {
  display: flex;
  gap: 0;
}

.ims-password-row .ims-input {
  border-radius: 8px 0 0 8px;
}

.ims-show-toggle {
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

.ims-show-toggle:hover {
  color: var(--text-secondary, #a0a0c0);
  background: rgba(255, 255, 255, 0.04);
}

.ims-field-error {
  font-size: 0.75rem;
  color: #ef4444;
}

/* Verifying state */
.ims-verifying {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  text-align: center;
}

.ims-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  border-top-color: #007AFF;
  border-radius: 50%;
  animation: ims-spin 0.8s linear infinite;
}

@keyframes ims-spin {
  to { transform: rotate(360deg); }
}

.ims-verifying-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.ims-verifying-desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
}

/* Verify error */
.ims-verify-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 2rem;
  text-align: center;
}

.ims-error-icon {
  color: #ef4444;
}

.ims-error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.ims-error-message {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  max-width: 400px;
  line-height: 1.5;
}

/* Verify success */
.ims-verify-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 2rem;
  text-align: center;
}

.ims-success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
  margin-bottom: 0.5rem;
  animation: ims-success-pop 0.4s ease;
}

@keyframes ims-success-pop {
  0% { transform: scale(0.5); opacity: 0; }
  70% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.ims-success-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

/* Server card */
.ims-server-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 2rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  width: 100%;
  max-width: 360px;
}

.ims-server-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 122, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #007AFF;
}

.ims-server-details {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ims-server-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ims-server-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

.ims-server-value {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

/* Section */
.ims-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ims-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ims-section-desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
  line-height: 1.4;
}

/* Tag input area */
.ims-tag-input-area {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.ims-tag-input-row {
  display: flex;
  gap: 0.5rem;
}

.ims-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.ims-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.375rem 0.25rem 0.625rem;
  background: rgba(0, 122, 255, 0.12);
  border: 1px solid rgba(0, 122, 255, 0.2);
  border-radius: 6px;
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: #66b2ff;
}

.ims-tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-tertiary, #606080);
  padding: 0;
  transition: all 0.15s ease;
}

.ims-tag-remove:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Setting row */
.ims-setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.ims-setting-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.ims-setting-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.ims-setting-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

/* Toggle */
.ims-toggle {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  cursor: pointer;
}

.ims-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.ims-toggle-slider {
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

.ims-toggle-slider::before {
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

.ims-toggle input:checked + .ims-toggle-slider {
  background: #007AFF;
}

.ims-toggle input:checked + .ims-toggle-slider::before {
  transform: translateX(20px);
}

/* Buttons */
.ims-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.ims-btn {
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

.ims-btn-primary {
  background: #007AFF;
  color: #fff;
}

.ims-btn-primary:hover:not(:disabled) {
  background: #0063d1;
  transform: translateY(-1px);
}

.ims-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ims-btn-secondary {
  background: transparent;
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ims-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--text-primary, #fff);
}

.ims-btn-small {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: #007AFF;
  color: #fff;
  border-radius: 6px;
}

.ims-btn-small:hover:not(:disabled) {
  background: #0063d1;
}

.ims-btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 480px) {
  .ims-container {
    padding: 1rem;
  }

  .ims-actions {
    flex-direction: column-reverse;
  }

  .ims-actions .ims-btn {
    width: 100%;
    justify-content: center;
  }

  .ims-progress-label {
    font-size: 0.625rem;
  }

  .ims-progress-step {
    min-width: 60px;
  }

  .ims-tag-input-row {
    flex-direction: column;
  }
}
`;
