/**
 * WhatsApp Channel Setup - Step wizard for connecting WhatsApp
 *
 * Flow:
 *   Step 1: Introduction - account type selection, privacy notice
 *   Step 2: QR Code Pairing - scan QR from gateway, auto-refresh on expiry
 *   Step 3: Connected - success state, quick settings, done
 *
 * Uses gateway `channels.login` (whatsapp) for QR pairing and listens
 * for WhatsApp events for QR code updates and connection status.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../../../hooks/useGateway';
import { useGatewayConfig } from '../../../hooks/useGatewayConfig';
import { QRScanner } from './QRScanner';

/* ===================================================================
   Types
   =================================================================== */

export interface WhatsAppSetupProps {
  onBack?: () => void;
  onConnected?: () => void;
}

type SetupStep = 'intro' | 'qr-pairing' | 'connected';
type AccountType = 'personal' | 'business';

interface WhatsAppAccount {
  phoneNumber?: string;
  name?: string;
  pushName?: string;
  platform?: string;
}

/* ===================================================================
   Constants
   =================================================================== */

const QR_REFRESH_INTERVAL_MS = 30_000;

/* ===================================================================
   Component
   =================================================================== */

export function WhatsAppSetup({ onBack, onConnected }: WhatsAppSetupProps) {
  const { getClient, connected: gatewayConnected } = useGateway();
  const { patchGatewayConfig } = useGatewayConfig();

  // Step wizard state
  const [step, setStep] = useState<SetupStep>('intro');
  const [animDirection, setAnimDirection] = useState<'forward' | 'backward'>('forward');

  // Step 1: Intro
  const [accountType, setAccountType] = useState<AccountType>('personal');

  // Step 2: QR Pairing
  const [qrData, setQrData] = useState<string | undefined>(undefined);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrExpired, setQrExpired] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<string>('');
  const [pairingError, setPairingError] = useState<string | null>(null);
  const qrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3: Connected
  const [accountInfo, setAccountInfo] = useState<WhatsAppAccount>({});
  const [readReceipts, setReadReceipts] = useState(true);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [allowlistInput, setAllowlistInput] = useState('');

  // Cleanup QR timer on unmount
  useEffect(() => {
    return () => {
      if (qrTimerRef.current) {
        clearTimeout(qrTimerRef.current);
      }
    };
  }, []);

  // Listen for WhatsApp events from gateway
  useEffect(() => {
    const client = getClient();
    if (!client) return;

    // The gateway emits events through the onEvent handler in useGateway.
    // We listen for specific WhatsApp events via the client's event system.
    // For now, we poll the channels status to detect connection changes.
    // In production, the gateway would push events like:
    //   - whatsapp.qr (new QR data)
    //   - whatsapp.connected (pairing success)
    //   - whatsapp.disconnected
    //   - whatsapp.error
  }, [getClient, gatewayConnected]);

  /* ---------------------------------------------------------------
     Navigation helpers
     --------------------------------------------------------------- */

  const goToStep = useCallback((target: SetupStep, direction: 'forward' | 'backward' = 'forward') => {
    setAnimDirection(direction);
    setStep(target);
  }, []);

  /* ---------------------------------------------------------------
     Step 2: QR pairing logic
     --------------------------------------------------------------- */

  const requestQrCode = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      setPairingError('Gateway not connected. Please start the gateway first.');
      return;
    }

    setQrLoading(true);
    setQrExpired(false);
    setPairingError(null);
    setPairingStatus('Requesting QR code...');

    // Clear any existing timer
    if (qrTimerRef.current) {
      clearTimeout(qrTimerRef.current);
      qrTimerRef.current = null;
    }

    try {
      const result = await client.request<{
        qr?: string;
        status?: string;
        account?: WhatsAppAccount;
        alreadyConnected?: boolean;
      }>('channels.login', {
        channel: 'whatsapp',
        accountType,
      });

      if (result.alreadyConnected) {
        // Already connected - jump to step 3
        setAccountInfo(result.account ?? {});
        goToStep('connected');
        return;
      }

      if (result.qr) {
        setQrData(result.qr);
        setPairingStatus('Waiting for scan...');
        setQrLoading(false);

        // Auto-expire after interval
        qrTimerRef.current = setTimeout(() => {
          setQrExpired(true);
          setPairingStatus('QR code expired. Click refresh to get a new one.');
        }, QR_REFRESH_INTERVAL_MS);

        // Start polling for connection status
        pollConnectionStatus();
      } else {
        setPairingStatus(result.status ?? 'Waiting for QR code...');
        setQrLoading(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPairingError(`Failed to start pairing: ${message}`);
      setPairingStatus('');
      setQrLoading(false);
    }
  }, [getClient, accountType, goToStep]);

  const pollConnectionStatus = useCallback(() => {
    const client = getClient();
    if (!client?.connected) return;

    let attempts = 0;
    const maxAttempts = 60; // Poll for up to ~2 minutes

    const poll = async () => {
      attempts++;
      if (attempts > maxAttempts) return;

      try {
        const status = await client.request<{
          channels?: Record<string, { status?: string; account?: WhatsAppAccount }>;
        }>('channels.status');

        const wa = status.channels?.whatsapp;
        if (wa?.status === 'connected') {
          // Pairing succeeded
          if (qrTimerRef.current) {
            clearTimeout(qrTimerRef.current);
            qrTimerRef.current = null;
          }
          setAccountInfo(wa.account ?? {});
          goToStep('connected');
          return;
        }
      } catch {
        // Ignore polling errors
      }

      // Continue polling
      setTimeout(poll, 2000);
    };

    setTimeout(poll, 2000);
  }, [getClient, goToStep]);

  const handleRefreshQr = useCallback(() => {
    requestQrCode();
  }, [requestQrCode]);

  const beginSetup = useCallback(() => {
    goToStep('qr-pairing');
    // Automatically request QR code when entering step 2
    setTimeout(() => requestQrCode(), 100);
  }, [goToStep, requestQrCode]);

  /* ---------------------------------------------------------------
     Step 3: Settings handlers
     --------------------------------------------------------------- */

  const handleAddAllowlistEntry = useCallback(() => {
    const value = allowlistInput.trim();
    if (!value) return;

    // Basic phone number validation (digits, optional + prefix)
    const cleaned = value.replace(/[\s\-()]/g, '');
    if (!/^\+?\d{7,15}$/.test(cleaned)) {
      return; // Invalid format, silently ignore
    }

    if (!allowlist.includes(cleaned)) {
      setAllowlist((prev) => [...prev, cleaned]);
    }
    setAllowlistInput('');
  }, [allowlistInput, allowlist]);

  const handleRemoveAllowlistEntry = useCallback((number: string) => {
    setAllowlist((prev) => prev.filter((n) => n !== number));
  }, []);

  const handleAllowlistKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddAllowlistEntry();
      }
    },
    [handleAddAllowlistEntry]
  );

  const handleDone = useCallback(async () => {
    // Save settings to gateway config
    try {
      await patchGatewayConfig({
        'channels.whatsapp': {
          enabled: true,
          config: {
            accountType,
            readReceipts,
            allowlist,
          },
        },
      });
    } catch (err) {
      console.error('Failed to save WhatsApp config:', err);
      // Continue anyway - settings are best-effort
    }

    onConnected?.();
  }, [patchGatewayConfig, accountType, readReceipts, allowlist, onConnected]);

  /* ---------------------------------------------------------------
     Render
     --------------------------------------------------------------- */

  return (
    <div className="was-container">
      <style>{whatsAppSetupStyles}</style>

      {/* Gateway disconnected banner */}
      {!gatewayConnected && (
        <div className="was-banner was-banner-warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. WhatsApp setup requires an active gateway connection.
        </div>
      )}

      {/* Step progress indicator */}
      <div className="was-progress">
        <div className={`was-progress-step ${step === 'intro' ? 'active' : 'done'}`}>
          <span className="was-progress-dot">
            {step !== 'intro' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '1'}
          </span>
          <span className="was-progress-label">Introduction</span>
        </div>
        <div className="was-progress-line" />
        <div className={`was-progress-step ${step === 'qr-pairing' ? 'active' : step === 'connected' ? 'done' : ''}`}>
          <span className="was-progress-dot">
            {step === 'connected' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '2'}
          </span>
          <span className="was-progress-label">QR Pairing</span>
        </div>
        <div className="was-progress-line" />
        <div className={`was-progress-step ${step === 'connected' ? 'active' : ''}`}>
          <span className="was-progress-dot">3</span>
          <span className="was-progress-label">Connected</span>
        </div>
      </div>

      {/* Step content with animated transitions */}
      <div className={`was-step-content was-anim-${animDirection}`} key={step}>
        {/* ============================================================
            STEP 1: Introduction
            ============================================================ */}
        {step === 'intro' && (
          <div className="was-step">
            <div className="was-header">
              <div className="was-icon-circle">
                <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <h2 className="was-title">Connect WhatsApp</h2>
              <p className="was-subtitle">
                Link your WhatsApp account to enable messaging capabilities.
                Messages will be processed by your Helix instance.
              </p>
            </div>

            {/* Account type selector */}
            <div className="was-section">
              <label className="was-label">Account Type</label>
              <div className="was-account-types">
                <button
                  className={`was-account-btn ${accountType === 'personal' ? 'active' : ''}`}
                  onClick={() => setAccountType('personal')}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span className="was-account-name">Personal</span>
                  <span className="was-account-desc">Standard WhatsApp account</span>
                </button>
                <button
                  className={`was-account-btn ${accountType === 'business' ? 'active' : ''}`}
                  onClick={() => setAccountType('business')}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                  </svg>
                  <span className="was-account-name">Business</span>
                  <span className="was-account-desc">WhatsApp Business account</span>
                </button>
              </div>
            </div>

            {/* Privacy notice */}
            <div className="was-privacy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <div>
                <strong>Privacy Notice:</strong> WhatsApp messages are processed locally on your device
                through the gateway. Message content is not stored permanently unless you configure
                logging. Your WhatsApp credentials remain on this device.
              </div>
            </div>

            {/* Actions */}
            <div className="was-actions">
              {onBack && (
                <button className="was-btn was-btn-secondary" onClick={onBack} type="button">
                  Back
                </button>
              )}
              <button
                className="was-btn was-btn-primary"
                onClick={beginSetup}
                disabled={!gatewayConnected}
                type="button"
              >
                Begin Setup
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 2: QR Code Pairing
            ============================================================ */}
        {step === 'qr-pairing' && (
          <div className="was-step">
            <div className="was-header">
              <h2 className="was-title">Scan QR Code</h2>
              <p className="was-subtitle">
                Open WhatsApp on your phone, then scan the code below to link your account.
              </p>
            </div>

            {/* QR Scanner */}
            <div className="was-qr-area">
              <QRScanner
                qrData={qrData}
                loading={qrLoading}
                expired={qrExpired}
                onRefresh={handleRefreshQr}
              />
            </div>

            {/* Instructions */}
            <div className="was-instructions">
              <h4 className="was-instructions-title">How to scan</h4>
              <ol className="was-instructions-list">
                <li>Open <strong>WhatsApp</strong> on your phone</li>
                <li>
                  Go to <strong>Settings</strong> &gt; <strong>Linked Devices</strong>
                </li>
                <li>
                  Tap <strong>Link a Device</strong>
                </li>
                <li>Point your phone camera at the QR code above</li>
              </ol>
            </div>

            {/* Status indicator */}
            {pairingStatus && !pairingError && (
              <div className="was-status">
                <div className="was-status-dot was-status-dot-pulse" />
                <span>{pairingStatus}</span>
              </div>
            )}

            {/* Error */}
            {pairingError && (
              <div className="was-error">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{pairingError}</span>
                <button
                  className="was-btn was-btn-small"
                  onClick={handleRefreshQr}
                  type="button"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="was-actions">
              <button
                className="was-btn was-btn-secondary"
                onClick={() => {
                  if (qrTimerRef.current) {
                    clearTimeout(qrTimerRef.current);
                    qrTimerRef.current = null;
                  }
                  goToStep('intro', 'backward');
                }}
                type="button"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 3: Connected
            ============================================================ */}
        {step === 'connected' && (
          <div className="was-step">
            {/* Success header */}
            <div className="was-header">
              <div className="was-success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2 className="was-title">WhatsApp Connected!</h2>
              <p className="was-subtitle">
                Your WhatsApp account has been linked successfully.
              </p>
            </div>

            {/* Account info */}
            <div className="was-account-info">
              <div className="was-account-info-row">
                <span className="was-info-label">Phone Number</span>
                <span className="was-info-value">{accountInfo.phoneNumber ?? 'N/A'}</span>
              </div>
              {accountInfo.name && (
                <div className="was-account-info-row">
                  <span className="was-info-label">Account Name</span>
                  <span className="was-info-value">{accountInfo.name}</span>
                </div>
              )}
              {accountInfo.pushName && (
                <div className="was-account-info-row">
                  <span className="was-info-label">Push Name</span>
                  <span className="was-info-value">{accountInfo.pushName}</span>
                </div>
              )}
              {accountInfo.platform && (
                <div className="was-account-info-row">
                  <span className="was-info-label">Platform</span>
                  <span className="was-info-value">{accountInfo.platform}</span>
                </div>
              )}
              <div className="was-account-info-row">
                <span className="was-info-label">Account Type</span>
                <span className="was-info-value was-info-badge">
                  {accountType === 'business' ? 'Business' : 'Personal'}
                </span>
              </div>
            </div>

            {/* Quick settings */}
            <div className="was-section">
              <h3 className="was-section-title">Quick Settings</h3>

              {/* Read receipts toggle */}
              <div className="was-setting-row">
                <div className="was-setting-info">
                  <span className="was-setting-name">Read Receipts</span>
                  <span className="was-setting-desc">Send read receipts when messages are processed</span>
                </div>
                <label className="was-toggle">
                  <input
                    type="checkbox"
                    checked={readReceipts}
                    onChange={(e) => setReadReceipts(e.target.checked)}
                  />
                  <span className="was-toggle-slider" />
                </label>
              </div>

              {/* Contact allowlist */}
              <div className="was-setting-block">
                <div className="was-setting-info">
                  <span className="was-setting-name">Contact Allowlist</span>
                  <span className="was-setting-desc">
                    Only respond to messages from these phone numbers. Leave empty to respond to all contacts.
                  </span>
                </div>
                <div className="was-allowlist">
                  <div className="was-allowlist-input-row">
                    <input
                      type="text"
                      className="was-input"
                      placeholder="+1234567890"
                      value={allowlistInput}
                      onChange={(e) => setAllowlistInput(e.target.value)}
                      onKeyDown={handleAllowlistKeyDown}
                    />
                    <button
                      className="was-btn was-btn-small"
                      onClick={handleAddAllowlistEntry}
                      disabled={!allowlistInput.trim()}
                      type="button"
                    >
                      Add
                    </button>
                  </div>
                  {allowlist.length > 0 && (
                    <div className="was-allowlist-tags">
                      {allowlist.map((number) => (
                        <span key={number} className="was-allowlist-tag">
                          {number}
                          <button
                            className="was-tag-remove"
                            onClick={() => handleRemoveAllowlistEntry(number)}
                            type="button"
                            aria-label={`Remove ${number}`}
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
            </div>

            {/* Actions */}
            <div className="was-actions">
              <button
                className="was-btn was-btn-primary"
                onClick={handleDone}
                type="button"
              >
                Done
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

export default WhatsAppSetup;

/* ===================================================================
   Scoped styles (was- prefix)
   =================================================================== */

const whatsAppSetupStyles = `
/* Container */
.was-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
}

/* Banner */
.was-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.was-banner-warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* Progress indicator */
.was-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0.5rem 0;
}

.was-progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  min-width: 80px;
}

.was-progress-dot {
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

.was-progress-step.active .was-progress-dot {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  color: #fff;
}

.was-progress-step.done .was-progress-dot {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

.was-progress-label {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary, #606080);
  transition: color 0.3s ease;
}

.was-progress-step.active .was-progress-label {
  color: var(--text-primary, #fff);
}

.was-progress-step.done .was-progress-label {
  color: #10b981;
}

.was-progress-line {
  flex: 1;
  max-width: 60px;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 0.5rem;
  margin-bottom: 1.25rem;
}

/* Step content animation */
.was-step-content {
  animation: was-slide-in 0.3s ease;
}

.was-anim-forward {
  animation-name: was-slide-forward;
}

.was-anim-backward {
  animation-name: was-slide-backward;
}

@keyframes was-slide-forward {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes was-slide-backward {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Step */
.was-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Header */
.was-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.was-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(37, 211, 102, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #25d366;
  margin-bottom: 0.5rem;
}

.was-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.was-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  line-height: 1.5;
  max-width: 480px;
}

/* Section */
.was-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.was-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.was-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

/* Account type buttons */
.was-account-types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.was-account-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 1.25rem;
  background: var(--bg-primary, #0a0a1a);
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-secondary, #a0a0c0);
}

.was-account-btn:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.02);
}

.was-account-btn.active {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.08);
  color: var(--text-primary, #fff);
}

.was-account-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: inherit;
}

.was-account-desc {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

.was-account-btn.active .was-account-desc {
  color: var(--text-secondary, #a0a0c0);
}

/* Privacy notice */
.was-privacy {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 10px;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--text-secondary, #a0a0c0);
}

.was-privacy svg {
  flex-shrink: 0;
  color: #10b981;
  margin-top: 0.125rem;
}

.was-privacy strong {
  color: #34d399;
}

/* QR area */
.was-qr-area {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

/* Instructions */
.was-instructions {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.was-instructions-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.625rem;
}

.was-instructions-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.was-instructions-list li {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  line-height: 1.4;
}

.was-instructions-list strong {
  color: var(--text-primary, #fff);
}

/* Status */
.was-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
}

.was-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
}

.was-status-dot-pulse {
  animation: was-pulse 1.5s ease-in-out infinite;
}

@keyframes was-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Error */
.was-error {
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

.was-error svg {
  flex-shrink: 0;
  color: #ef4444;
}

.was-error span {
  flex: 1;
}

/* Success icon */
.was-success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
  margin-bottom: 0.5rem;
  animation: was-success-pop 0.4s ease;
}

@keyframes was-success-pop {
  0% { transform: scale(0.5); opacity: 0; }
  70% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

/* Account info card */
.was-account-info {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.was-account-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.was-info-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

.was-info-value {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.was-info-badge {
  padding: 0.125rem 0.5rem;
  background: rgba(99, 102, 241, 0.15);
  border-radius: 4px;
  font-size: 0.75rem;
  color: #818cf8;
}

/* Settings row */
.was-setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.was-setting-block {
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.was-setting-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.was-setting-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.was-setting-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

/* Toggle */
.was-toggle {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  cursor: pointer;
}

.was-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.was-toggle-slider {
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

.was-toggle-slider::before {
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

.was-toggle input:checked + .was-toggle-slider {
  background: var(--accent-color, #6366f1);
}

.was-toggle input:checked + .was-toggle-slider::before {
  transform: translateX(20px);
}

/* Allowlist */
.was-allowlist {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.was-allowlist-input-row {
  display: flex;
  gap: 0.5rem;
}

.was-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  outline: none;
  transition: border-color 0.15s ease;
}

.was-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.was-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.was-allowlist-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.was-allowlist-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.375rem 0.25rem 0.625rem;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 6px;
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: #c7d2fe;
}

.was-tag-remove {
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

.was-tag-remove:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Buttons */
.was-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.was-btn {
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

.was-btn-primary {
  background: var(--accent-color, #6366f1);
  color: #fff;
}

.was-btn-primary:hover:not(:disabled) {
  background: #4f46e5;
  transform: translateY(-1px);
}

.was-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.was-btn-secondary {
  background: transparent;
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.was-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--text-primary, #fff);
}

.was-btn-small {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--accent-color, #6366f1);
  color: #fff;
  border-radius: 6px;
}

.was-btn-small:hover {
  background: #4f46e5;
}

.was-btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 480px) {
  .was-container {
    padding: 1rem;
  }

  .was-account-types {
    grid-template-columns: 1fr;
  }

  .was-actions {
    flex-direction: column-reverse;
  }

  .was-actions .was-btn {
    width: 100%;
    justify-content: center;
  }

  .was-progress-label {
    font-size: 0.625rem;
  }

  .was-progress-step {
    min-width: 60px;
  }
}
`;
