/**
 * Signal Messenger Setup - Step wizard for connecting Signal via signal-cli
 *
 * Flow:
 *   Step 1: Prerequisites - signal-cli install check, phone number input
 *   Step 2: Verification - SMS/call verification code entry
 *   Step 3: Configuration - contact allowlist, group allowlist, disappearing messages
 *
 * Uses gateway `channels.login` (signal) for CLI bridge auth
 * and `config.patch` for persisting channel configuration.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGateway } from '../../../hooks/useGateway';
import { useGatewayConfig } from '../../../hooks/useGatewayConfig';

/* ===================================================================
   Types
   =================================================================== */

export interface SignalSetupProps {
  onBack?: () => void;
  onConnected?: () => void;
}

type SetupStep = 'prerequisites' | 'verification' | 'configuration';

interface SignalAccountInfo {
  phoneNumber?: string;
  deviceName?: string;
  signalVersion?: string;
}

/* ===================================================================
   Helpers
   =================================================================== */

/**
 * Validate international phone number format.
 * Must start with + followed by 7-15 digits.
 */
function isValidPhoneNumber(phone: string): boolean {
  return /^\+\d{7,15}$/.test(phone.trim().replace(/[\s\-()]/g, ''));
}

/**
 * Validate a 6-digit verification code.
 */
function isValidVerificationCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/* ===================================================================
   Component
   =================================================================== */

export function SignalSetup({ onBack, onConnected }: SignalSetupProps) {
  const { getClient, connected: gatewayConnected } = useGateway();
  const { patchGatewayConfig } = useGatewayConfig();

  // Step wizard state
  const [step, setStep] = useState<SetupStep>('prerequisites');
  const [animDirection, setAnimDirection] = useState<'forward' | 'backward'>('forward');

  // Step 1: Prerequisites
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Verification
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Configuration
  const [accountInfo, setAccountInfo] = useState<SignalAccountInfo>({});
  const [contactAllowlist, setContactAllowlist] = useState<string[]>([]);
  const [contactInput, setContactInput] = useState('');
  const [groupAllowlist, setGroupAllowlist] = useState<string[]>([]);
  const [groupInput, setGroupInput] = useState('');
  const [disappearingMessages, setDisappearingMessages] = useState(false);

  // Focus phone input on mount
  useEffect(() => {
    if (step === 'prerequisites') {
      phoneInputRef.current?.focus();
    }
    if (step === 'verification') {
      codeInputRef.current?.focus();
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
     Step 1: Begin registration
     --------------------------------------------------------------- */

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(e.target.value);
    setPhoneError(null);
  }, []);

  const handleBeginRegistration = useCallback(async () => {
    const cleaned = phoneNumber.trim().replace(/[\s\-()]/g, '');

    if (!cleaned) {
      setPhoneError('Please enter your phone number.');
      return;
    }

    if (!isValidPhoneNumber(cleaned)) {
      setPhoneError('Invalid phone number. Use international format: +1234567890');
      return;
    }

    const client = getClient();
    if (!client?.connected) {
      setPhoneError('Gateway not connected. Please start the gateway first.');
      return;
    }

    setSendingCode(true);
    setPhoneError(null);

    try {
      const result = await client.request<{
        status?: string;
        error?: string;
        codeSent?: boolean;
      }>('channels.login', {
        channel: 'signal',
        action: 'register',
        phoneNumber: cleaned,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setCodeSent(true);
      setSendingCode(false);
      goToStep('verification');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPhoneError(`Registration failed: ${message}`);
      setSendingCode(false);
    }
  }, [phoneNumber, getClient, goToStep]);

  const handlePhoneKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleBeginRegistration();
      }
    },
    [handleBeginRegistration]
  );

  /* ---------------------------------------------------------------
     Step 2: Verification
     --------------------------------------------------------------- */

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 6
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(val);
    setVerifyError(null);
  }, []);

  const handleVerify = useCallback(async () => {
    const code = verificationCode.trim();

    if (!isValidVerificationCode(code)) {
      setVerifyError('Please enter a valid 6-digit verification code.');
      return;
    }

    const client = getClient();
    if (!client?.connected) {
      setVerifyError('Gateway not connected. Please start the gateway first.');
      return;
    }

    setVerifying(true);
    setVerifyError(null);

    try {
      const result = await client.request<{
        status?: string;
        error?: string;
        account?: SignalAccountInfo;
      }>('channels.login', {
        channel: 'signal',
        action: 'verify',
        phoneNumber: phoneNumber.trim().replace(/[\s\-()]/g, ''),
        verificationCode: code,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setAccountInfo(result.account ?? { phoneNumber: phoneNumber.trim().replace(/[\s\-()]/g, '') });
      setVerifying(false);
      goToStep('configuration');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setVerifyError(
        message.includes('expired')
          ? 'Verification code expired. Please request a new code.'
          : message.includes('invalid') || message.includes('incorrect')
            ? 'Invalid verification code. Please check and try again.'
            : `Verification failed: ${message}`
      );
      setVerifying(false);
    }
  }, [verificationCode, phoneNumber, getClient, goToStep]);

  const handleResendCode = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) return;

    setSendingCode(true);
    setVerifyError(null);

    try {
      await client.request<{ status?: string }>('channels.login', {
        channel: 'signal',
        action: 'register',
        phoneNumber: phoneNumber.trim().replace(/[\s\-()]/g, ''),
      });

      setCodeSent(true);
      setSendingCode(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setVerifyError(`Failed to resend code: ${message}`);
      setSendingCode(false);
    }
  }, [phoneNumber, getClient]);

  const handleCodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleVerify();
      }
    },
    [handleVerify]
  );

  /* ---------------------------------------------------------------
     Step 3: Configuration - allowlist management
     --------------------------------------------------------------- */

  const handleAddContact = useCallback(() => {
    const value = contactInput.trim().replace(/[\s\-()]/g, '');
    if (!value) return;
    if (!/^\+?\d{7,15}$/.test(value)) return;
    const normalized = value.startsWith('+') ? value : `+${value}`;
    if (!contactAllowlist.includes(normalized)) {
      setContactAllowlist((prev) => [...prev, normalized]);
    }
    setContactInput('');
  }, [contactInput, contactAllowlist]);

  const handleRemoveContact = useCallback((number: string) => {
    setContactAllowlist((prev) => prev.filter((n) => n !== number));
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

  const handleAddGroup = useCallback(() => {
    const value = groupInput.trim();
    if (!value) return;
    if (!groupAllowlist.includes(value)) {
      setGroupAllowlist((prev) => [...prev, value]);
    }
    setGroupInput('');
  }, [groupInput, groupAllowlist]);

  const handleRemoveGroup = useCallback((groupId: string) => {
    setGroupAllowlist((prev) => prev.filter((g) => g !== groupId));
  }, []);

  const handleGroupKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddGroup();
      }
    },
    [handleAddGroup]
  );

  /* ---------------------------------------------------------------
     Save & finish
     --------------------------------------------------------------- */

  const handleSaveAndDone = useCallback(async () => {
    try {
      await patchGatewayConfig({
        'channels.signal': {
          enabled: true,
          config: {
            phoneNumber: phoneNumber.trim().replace(/[\s\-()]/g, ''),
            contactAllowlist,
            groupAllowlist,
            disappearingMessages,
          },
        },
      });
    } catch (err) {
      console.error('Failed to save Signal config:', err);
    }

    onConnected?.();
  }, [patchGatewayConfig, phoneNumber, contactAllowlist, groupAllowlist, disappearingMessages, onConnected]);

  /* ---------------------------------------------------------------
     Render
     --------------------------------------------------------------- */

  return (
    <div className="sgs-container">
      <style>{signalSetupStyles}</style>

      {/* Gateway disconnected banner */}
      {!gatewayConnected && (
        <div className="sgs-banner sgs-banner-warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. Signal setup requires an active gateway connection.
        </div>
      )}

      {/* Step progress indicator */}
      <div className="sgs-progress">
        <div className={`sgs-progress-step ${step === 'prerequisites' ? 'active' : 'done'}`}>
          <span className="sgs-progress-dot">
            {step !== 'prerequisites' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '1'}
          </span>
          <span className="sgs-progress-label">Prerequisites</span>
        </div>
        <div className="sgs-progress-line" />
        <div className={`sgs-progress-step ${step === 'verification' ? 'active' : step === 'configuration' ? 'done' : ''}`}>
          <span className="sgs-progress-dot">
            {step === 'configuration' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '2'}
          </span>
          <span className="sgs-progress-label">Verification</span>
        </div>
        <div className="sgs-progress-line" />
        <div className={`sgs-progress-step ${step === 'configuration' ? 'active' : ''}`}>
          <span className="sgs-progress-dot">3</span>
          <span className="sgs-progress-label">Configuration</span>
        </div>
      </div>

      {/* Step content with animated transitions */}
      <div className={`sgs-step-content sgs-anim-${animDirection}`} key={step}>
        {/* ============================================================
            STEP 1: Prerequisites
            ============================================================ */}
        {step === 'prerequisites' && (
          <div className="sgs-step">
            <div className="sgs-header">
              <div className="sgs-icon-circle">
                <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 4.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v1c0 .83-.67 1.5-1.5 1.5S11 8.33 11 7.5v-1zm5.3 9.8a7.06 7.06 0 01-8.6 0A1 1 0 018.3 16a5.08 5.08 0 007.4 0 1 1 0 011.6 1.3zM16 12.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-8 0c-.83 0-1.5-.67-1.5-1.5S7.17 9.5 8 9.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                </svg>
              </div>
              <h2 className="sgs-title">Connect Signal Messenger</h2>
              <p className="sgs-subtitle">
                Link your Signal account via signal-cli to enable secure messaging capabilities.
              </p>
            </div>

            {/* Prerequisites checklist */}
            <div className="sgs-checklist">
              <h4 className="sgs-checklist-title">Prerequisites</h4>
              <div className="sgs-checklist-items">
                <div className="sgs-check-item">
                  <div className="sgs-check-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="sgs-check-content">
                    <span className="sgs-check-label">signal-cli installed</span>
                    <div className="sgs-install-hints">
                      <code className="sgs-code">brew install signal-cli</code>
                      <span className="sgs-hint-divider">or</span>
                      <code className="sgs-code">apt install signal-cli</code>
                    </div>
                  </div>
                </div>
                <div className="sgs-check-item">
                  <div className="sgs-check-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="sgs-check-content">
                    <span className="sgs-check-label">Phone number registered with Signal</span>
                  </div>
                </div>
                <div className="sgs-check-item">
                  <div className="sgs-check-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="sgs-check-content">
                    <span className="sgs-check-label">Signal desktop or phone active for verification</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Phone number input */}
            <div className="sgs-field">
              <label className="sgs-label" htmlFor="sgs-phone-input">Phone Number</label>
              <p className="sgs-field-hint">Enter your phone number in international format</p>
              <input
                id="sgs-phone-input"
                ref={phoneInputRef}
                type="tel"
                className={`sgs-input ${phoneError ? 'sgs-input-error' : ''}`}
                placeholder="+1234567890"
                value={phoneNumber}
                onChange={handlePhoneChange}
                onKeyDown={handlePhoneKeyDown}
                autoComplete="tel"
              />
              {phoneError && <span className="sgs-field-error">{phoneError}</span>}
            </div>

            {/* Actions */}
            <div className="sgs-actions">
              {onBack && (
                <button className="sgs-btn sgs-btn-secondary" onClick={onBack} type="button">
                  Back
                </button>
              )}
              <button
                className="sgs-btn sgs-btn-primary"
                onClick={handleBeginRegistration}
                disabled={!gatewayConnected || !phoneNumber.trim() || sendingCode}
                type="button"
              >
                {sendingCode ? (
                  <>
                    <div className="sgs-btn-spinner" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    Begin Registration
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 2: Verification
            ============================================================ */}
        {step === 'verification' && (
          <div className="sgs-step">
            <div className="sgs-header">
              <div className="sgs-icon-circle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <h2 className="sgs-title">Verify Your Number</h2>
              <p className="sgs-subtitle">
                A verification code has been sent to <strong>{phoneNumber}</strong>.
                Enter the 6-digit code below.
              </p>
            </div>

            {/* Code sent confirmation */}
            {codeSent && !verifyError && (
              <div className="sgs-info-banner">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Verification code sent via SMS. Check your phone.
              </div>
            )}

            {/* Verification code input */}
            <div className="sgs-field">
              <label className="sgs-label" htmlFor="sgs-code-input">Verification Code</label>
              <input
                id="sgs-code-input"
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                className={`sgs-input sgs-input-code ${verifyError ? 'sgs-input-error' : ''}`}
                placeholder="000000"
                value={verificationCode}
                onChange={handleCodeChange}
                onKeyDown={handleCodeKeyDown}
                maxLength={6}
                autoComplete="one-time-code"
              />
              {verifyError && <span className="sgs-field-error">{verifyError}</span>}
            </div>

            {/* Resend option */}
            <div className="sgs-resend-row">
              <span className="sgs-resend-text">Didn&apos;t receive the code?</span>
              <button
                className="sgs-resend-btn"
                onClick={handleResendCode}
                disabled={sendingCode}
                type="button"
              >
                {sendingCode ? 'Sending...' : 'Resend Code'}
              </button>
            </div>

            {/* Actions */}
            <div className="sgs-actions">
              <button
                className="sgs-btn sgs-btn-secondary"
                onClick={() => goToStep('prerequisites', 'backward')}
                type="button"
              >
                Back
              </button>
              <button
                className="sgs-btn sgs-btn-primary"
                onClick={handleVerify}
                disabled={!gatewayConnected || verificationCode.length !== 6 || verifying}
                type="button"
              >
                {verifying ? (
                  <>
                    <div className="sgs-btn-spinner" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 3: Configuration
            ============================================================ */}
        {step === 'configuration' && (
          <div className="sgs-step">
            {/* Success header */}
            <div className="sgs-header">
              <div className="sgs-success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2 className="sgs-title">Signal Connected!</h2>
              <p className="sgs-subtitle">
                Your Signal account has been linked successfully.
              </p>
            </div>

            {/* Account info */}
            <div className="sgs-account-info">
              <div className="sgs-account-info-row">
                <span className="sgs-info-label">Phone Number</span>
                <span className="sgs-info-value">{accountInfo.phoneNumber ?? phoneNumber}</span>
              </div>
              {accountInfo.deviceName && (
                <div className="sgs-account-info-row">
                  <span className="sgs-info-label">Device Name</span>
                  <span className="sgs-info-value">{accountInfo.deviceName}</span>
                </div>
              )}
              {accountInfo.signalVersion && (
                <div className="sgs-account-info-row">
                  <span className="sgs-info-label">Signal CLI Version</span>
                  <span className="sgs-info-value">{accountInfo.signalVersion}</span>
                </div>
              )}
              <div className="sgs-account-info-row">
                <span className="sgs-info-label">Status</span>
                <span className="sgs-info-value sgs-info-badge-green">Connected</span>
              </div>
            </div>

            {/* Contact allowlist */}
            <div className="sgs-section">
              <h3 className="sgs-section-title">Contact Allowlist</h3>
              <p className="sgs-section-desc">
                Only respond to messages from these phone numbers. Leave empty to respond to all contacts.
              </p>
              <div className="sgs-tag-input-area">
                <div className="sgs-tag-input-row">
                  <input
                    type="tel"
                    className="sgs-input"
                    placeholder="+1234567890"
                    value={contactInput}
                    onChange={(e) => setContactInput(e.target.value)}
                    onKeyDown={handleContactKeyDown}
                  />
                  <button
                    className="sgs-btn sgs-btn-small"
                    onClick={handleAddContact}
                    disabled={!contactInput.trim()}
                    type="button"
                  >
                    Add
                  </button>
                </div>
                {contactAllowlist.length > 0 && (
                  <div className="sgs-tags">
                    {contactAllowlist.map((number) => (
                      <span key={number} className="sgs-tag">
                        {number}
                        <button
                          className="sgs-tag-remove"
                          onClick={() => handleRemoveContact(number)}
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

            {/* Group allowlist */}
            <div className="sgs-section">
              <h3 className="sgs-section-title">Group Allowlist</h3>
              <p className="sgs-section-desc">
                Only respond in these Signal groups. Leave empty to respond in all groups.
              </p>
              <div className="sgs-tag-input-area">
                <div className="sgs-tag-input-row">
                  <input
                    type="text"
                    className="sgs-input"
                    placeholder="Group ID (e.g., group_abc123)"
                    value={groupInput}
                    onChange={(e) => setGroupInput(e.target.value)}
                    onKeyDown={handleGroupKeyDown}
                  />
                  <button
                    className="sgs-btn sgs-btn-small"
                    onClick={handleAddGroup}
                    disabled={!groupInput.trim()}
                    type="button"
                  >
                    Add
                  </button>
                </div>
                {groupAllowlist.length > 0 && (
                  <div className="sgs-tags">
                    {groupAllowlist.map((groupId) => (
                      <span key={groupId} className="sgs-tag">
                        {groupId}
                        <button
                          className="sgs-tag-remove"
                          onClick={() => handleRemoveGroup(groupId)}
                          type="button"
                          aria-label={`Remove ${groupId}`}
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

            {/* Disappearing messages toggle */}
            <div className="sgs-setting-row">
              <div className="sgs-setting-info">
                <span className="sgs-setting-name">Disappearing Messages</span>
                <span className="sgs-setting-desc">Automatically delete messages after they have been read</span>
              </div>
              <label className="sgs-toggle">
                <input
                  type="checkbox"
                  checked={disappearingMessages}
                  onChange={(e) => setDisappearingMessages(e.target.checked)}
                />
                <span className="sgs-toggle-slider" />
              </label>
            </div>

            {/* Actions */}
            <div className="sgs-actions">
              <button
                className="sgs-btn sgs-btn-primary"
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

export default SignalSetup;

/* ===================================================================
   Scoped styles (sgs- prefix)
   =================================================================== */

const signalSetupStyles = `
/* Container */
.sgs-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
}

/* Banner */
.sgs-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.sgs-banner-warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* Info banner */
.sgs-info-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  background: rgba(58, 118, 240, 0.1);
  border: 1px solid rgba(58, 118, 240, 0.25);
  color: #7cacf8;
}

/* Progress indicator */
.sgs-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0.5rem 0;
}

.sgs-progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  min-width: 80px;
}

.sgs-progress-dot {
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

.sgs-progress-step.active .sgs-progress-dot {
  background: #3A76F0;
  border-color: #3A76F0;
  color: #fff;
}

.sgs-progress-step.done .sgs-progress-dot {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

.sgs-progress-label {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary, #606080);
  transition: color 0.3s ease;
}

.sgs-progress-step.active .sgs-progress-label {
  color: var(--text-primary, #fff);
}

.sgs-progress-step.done .sgs-progress-label {
  color: #10b981;
}

.sgs-progress-line {
  flex: 1;
  max-width: 60px;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 0.5rem;
  margin-bottom: 1.25rem;
}

/* Step content animation */
.sgs-step-content {
  animation: sgs-slide-in 0.3s ease;
}

.sgs-anim-forward {
  animation-name: sgs-slide-forward;
}

.sgs-anim-backward {
  animation-name: sgs-slide-backward;
}

@keyframes sgs-slide-forward {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes sgs-slide-backward {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Step */
.sgs-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Header */
.sgs-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.sgs-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(58, 118, 240, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3A76F0;
  margin-bottom: 0.5rem;
}

.sgs-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.sgs-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  line-height: 1.5;
  max-width: 480px;
}

.sgs-subtitle strong {
  color: var(--text-primary, #fff);
}

/* Prerequisites checklist */
.sgs-checklist {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.sgs-checklist-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.75rem;
}

.sgs-checklist-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sgs-check-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.sgs-check-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(58, 118, 240, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3A76F0;
  flex-shrink: 0;
  margin-top: 0.0625rem;
}

.sgs-check-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sgs-check-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
  line-height: 1.4;
}

.sgs-install-hints {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sgs-code {
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  color: #c7d2fe;
}

.sgs-hint-divider {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

/* Field */
.sgs-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.sgs-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

.sgs-field-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
}

.sgs-input {
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

.sgs-input:focus {
  border-color: #3A76F0;
}

.sgs-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.sgs-input-error {
  border-color: #ef4444;
}

.sgs-input-error:focus {
  border-color: #ef4444;
}

.sgs-input-code {
  font-family: var(--font-mono, monospace);
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.5em;
  padding: 0.75rem 1rem;
}

.sgs-field-error {
  font-size: 0.75rem;
  color: #ef4444;
}

/* Resend row */
.sgs-resend-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.sgs-resend-text {
  color: var(--text-tertiary, #606080);
}

.sgs-resend-btn {
  background: none;
  border: none;
  color: #3A76F0;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s ease;
}

.sgs-resend-btn:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.sgs-resend-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  text-decoration: none;
}

/* Success icon */
.sgs-success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
  margin-bottom: 0.5rem;
  animation: sgs-success-pop 0.4s ease;
}

@keyframes sgs-success-pop {
  0% { transform: scale(0.5); opacity: 0; }
  70% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

/* Account info card */
.sgs-account-info {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.sgs-account-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sgs-info-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

.sgs-info-value {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.sgs-info-badge-green {
  padding: 0.125rem 0.5rem;
  background: rgba(16, 185, 129, 0.15);
  border-radius: 4px;
  font-size: 0.75rem;
  color: #34d399;
}

/* Section */
.sgs-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sgs-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sgs-section-desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
  line-height: 1.4;
}

/* Tag input area */
.sgs-tag-input-area {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.sgs-tag-input-row {
  display: flex;
  gap: 0.5rem;
}

.sgs-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.sgs-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.375rem 0.25rem 0.625rem;
  background: rgba(58, 118, 240, 0.12);
  border: 1px solid rgba(58, 118, 240, 0.2);
  border-radius: 6px;
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: #93b4f6;
}

.sgs-tag-remove {
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

.sgs-tag-remove:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Setting row */
.sgs-setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.sgs-setting-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sgs-setting-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.sgs-setting-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

/* Toggle */
.sgs-toggle {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  cursor: pointer;
}

.sgs-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.sgs-toggle-slider {
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

.sgs-toggle-slider::before {
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

.sgs-toggle input:checked + .sgs-toggle-slider {
  background: #3A76F0;
}

.sgs-toggle input:checked + .sgs-toggle-slider::before {
  transform: translateX(20px);
}

/* Buttons */
.sgs-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.sgs-btn {
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

.sgs-btn-primary {
  background: #3A76F0;
  color: #fff;
}

.sgs-btn-primary:hover:not(:disabled) {
  background: #2d63d8;
  transform: translateY(-1px);
}

.sgs-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sgs-btn-secondary {
  background: transparent;
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.sgs-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--text-primary, #fff);
}

.sgs-btn-small {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: #3A76F0;
  color: #fff;
  border-radius: 6px;
}

.sgs-btn-small:hover:not(:disabled) {
  background: #2d63d8;
}

.sgs-btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sgs-btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: sgs-spin 0.6s linear infinite;
}

@keyframes sgs-spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 480px) {
  .sgs-container {
    padding: 1rem;
  }

  .sgs-actions {
    flex-direction: column-reverse;
  }

  .sgs-actions .sgs-btn {
    width: 100%;
    justify-content: center;
  }

  .sgs-progress-label {
    font-size: 0.625rem;
  }

  .sgs-progress-step {
    min-width: 60px;
  }

  .sgs-tag-input-row {
    flex-direction: column;
  }

  .sgs-install-hints {
    flex-direction: column;
    align-items: flex-start;
  }
}
`;
