/**
 * Telegram Bot Setup - Step wizard for connecting a Telegram bot
 *
 * Flow:
 *   Step 1: Bot Token - enter and validate the BotFather token
 *   Step 2: Verification - connecting spinner, bot info on success
 *   Step 3: Configuration - commands editor, stream mode, chunk size
 *
 * Uses gateway `channels.login` (telegram) for token-based auth
 * and `config.patch` for persisting channel configuration.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGateway } from '../../../hooks/useGateway';
import { useGatewayConfig } from '../../../hooks/useGatewayConfig';

/* ===================================================================
   Types
   =================================================================== */

export interface TelegramSetupProps {
  onBack?: () => void;
  onConnected?: () => void;
}

type SetupStep = 'token' | 'verification' | 'configuration';
type StreamMode = 'off' | 'partial' | 'block';

interface BotInfo {
  id?: number;
  name?: string;
  username?: string;
  canJoinGroups?: boolean;
  canReadAllGroupMessages?: boolean;
  supportsInlineQueries?: boolean;
}

interface BotCommand {
  command: string;
  description: string;
}

/* ===================================================================
   Helpers
   =================================================================== */

/**
 * Validate Telegram bot token format.
 * Format: <digits>:<alphanumeric+special>
 * Example: 123456789:ABCdefGHIjklMNOpqrSTUvwxyz_1234567
 */
function isValidBotToken(token: string): boolean {
  return /^\d{8,12}:[A-Za-z0-9_-]{30,50}$/.test(token.trim());
}

/* ===================================================================
   Component
   =================================================================== */

export function TelegramSetup({ onBack, onConnected }: TelegramSetupProps) {
  const { getClient, connected: gatewayConnected } = useGateway();
  const { patchGatewayConfig } = useGatewayConfig();

  // Step wizard state
  const [step, setStep] = useState<SetupStep>('token');
  const [animDirection, setAnimDirection] = useState<'forward' | 'backward'>('forward');

  // Step 1: Bot Token
  const [botToken, setBotToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Verification
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [botInfo, setBotInfo] = useState<BotInfo>({});

  // Step 3: Configuration
  const [commands, setCommands] = useState<BotCommand[]>([
    { command: 'start', description: 'Start interacting with the bot' },
    { command: 'help', description: 'Show available commands' },
  ]);
  const [newCommandName, setNewCommandName] = useState('');
  const [newCommandDesc, setNewCommandDesc] = useState('');
  const [streamMode, setStreamMode] = useState<StreamMode>('block');
  const [chunkSize, setChunkSize] = useState(500);

  // Focus token input on mount
  useEffect(() => {
    if (step === 'token') {
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
     Step 1: Token validation and submission
     --------------------------------------------------------------- */

  const handleTokenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBotToken(e.target.value);
    setTokenError(null);
  }, []);

  const handleConnect = useCallback(async () => {
    const trimmed = botToken.trim();

    if (!trimmed) {
      setTokenError('Please enter a bot token.');
      return;
    }

    if (!isValidBotToken(trimmed)) {
      setTokenError('Invalid token format. Expected format: 123456789:ABCdefGHIjklMNOpqrSTUvwxyz');
      return;
    }

    // Move to verification step
    goToStep('verification');
    setVerifying(true);
    setVerifyError(null);

    const client = getClient();
    if (!client?.connected) {
      setVerifyError('Gateway not connected. Please start the gateway first.');
      setVerifying(false);
      return;
    }

    try {
      const result = await client.request<{
        bot?: BotInfo;
        status?: string;
        error?: string;
      }>('channels.login', {
        channel: 'telegram',
        token: trimmed,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setBotInfo(result.bot ?? {});
      setVerifying(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setVerifyError(
        message.includes('401') || message.includes('Unauthorized')
          ? 'Invalid bot token. Please check your token and try again.'
          : message.includes('network') || message.includes('ECONNREFUSED')
            ? 'Network error. Please check your internet connection.'
            : `Connection failed: ${message}`
      );
      setVerifying(false);
    }
  }, [botToken, getClient, goToStep]);

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
     Step 3: Commands editor
     --------------------------------------------------------------- */

  const handleAddCommand = useCallback(() => {
    const name = newCommandName.trim().toLowerCase().replace(/^\//, '');
    const desc = newCommandDesc.trim();

    if (!name || !desc) return;
    if (commands.some((c) => c.command === name)) return; // Duplicate

    setCommands((prev) => [...prev, { command: name, description: desc }]);
    setNewCommandName('');
    setNewCommandDesc('');
  }, [newCommandName, newCommandDesc, commands]);

  const handleRemoveCommand = useCallback((command: string) => {
    setCommands((prev) => prev.filter((c) => c.command !== command));
  }, []);

  const handleCommandKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCommand();
      }
    },
    [handleAddCommand]
  );

  /* ---------------------------------------------------------------
     Save & finish
     --------------------------------------------------------------- */

  const handleSaveAndDone = useCallback(async () => {
    try {
      await patchGatewayConfig({
        'channels.telegram': {
          enabled: true,
          config: {
            botToken: botToken.trim(),
            botName: botInfo.name,
            botUsername: botInfo.username,
            commands,
            streamMode,
            chunkSize: streamMode === 'partial' ? chunkSize : undefined,
          },
        },
      });
    } catch (err) {
      console.error('Failed to save Telegram config:', err);
      // Continue anyway - settings are best-effort
    }

    onConnected?.();
  }, [patchGatewayConfig, botToken, botInfo, commands, streamMode, chunkSize, onConnected]);

  /* ---------------------------------------------------------------
     Render
     --------------------------------------------------------------- */

  return (
    <div className="tgs-container">
      <style>{telegramSetupStyles}</style>

      {/* Gateway disconnected banner */}
      {!gatewayConnected && (
        <div className="tgs-banner tgs-banner-warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. Telegram setup requires an active gateway connection.
        </div>
      )}

      {/* Step progress indicator */}
      <div className="tgs-progress">
        <div className={`tgs-progress-step ${step === 'token' ? 'active' : 'done'}`}>
          <span className="tgs-progress-dot">
            {step !== 'token' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '1'}
          </span>
          <span className="tgs-progress-label">Bot Token</span>
        </div>
        <div className="tgs-progress-line" />
        <div className={`tgs-progress-step ${step === 'verification' ? 'active' : step === 'configuration' ? 'done' : ''}`}>
          <span className="tgs-progress-dot">
            {step === 'configuration' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '2'}
          </span>
          <span className="tgs-progress-label">Verification</span>
        </div>
        <div className="tgs-progress-line" />
        <div className={`tgs-progress-step ${step === 'configuration' ? 'active' : ''}`}>
          <span className="tgs-progress-dot">3</span>
          <span className="tgs-progress-label">Configuration</span>
        </div>
      </div>

      {/* Step content with animated transitions */}
      <div className={`tgs-step-content tgs-anim-${animDirection}`} key={step}>
        {/* ============================================================
            STEP 1: Bot Token
            ============================================================ */}
        {step === 'token' && (
          <div className="tgs-step">
            <div className="tgs-header">
              <div className="tgs-icon-circle">
                <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </div>
              <h2 className="tgs-title">Connect Telegram Bot</h2>
              <p className="tgs-subtitle">
                Enter your bot token from @BotFather to connect your Telegram bot.
              </p>
            </div>

            {/* Instructions */}
            <div className="tgs-instructions">
              <h4 className="tgs-instructions-title">How to get a bot token</h4>
              <ol className="tgs-instructions-list">
                <li>
                  Open Telegram and search for{' '}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tgs-link"
                  >
                    @BotFather
                  </a>
                </li>
                <li>Send <code className="tgs-code">/newbot</code> to create a new bot, or <code className="tgs-code">/token</code> for an existing one</li>
                <li>Copy the token and paste it below</li>
              </ol>
            </div>

            {/* Token input */}
            <div className="tgs-field">
              <label className="tgs-label" htmlFor="tgs-token-input">Bot Token</label>
              <div className="tgs-token-input-row">
                <input
                  id="tgs-token-input"
                  ref={tokenInputRef}
                  type={showToken ? 'text' : 'password'}
                  className={`tgs-input tgs-input-mono ${tokenError ? 'tgs-input-error' : ''}`}
                  placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxyz"
                  value={botToken}
                  onChange={handleTokenChange}
                  onKeyDown={handleTokenKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  className="tgs-show-toggle"
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
              {tokenError && <span className="tgs-field-error">{tokenError}</span>}
            </div>

            {/* Actions */}
            <div className="tgs-actions">
              {onBack && (
                <button className="tgs-btn tgs-btn-secondary" onClick={onBack} type="button">
                  Back
                </button>
              )}
              <button
                className="tgs-btn tgs-btn-primary"
                onClick={handleConnect}
                disabled={!gatewayConnected || !botToken.trim()}
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
          <div className="tgs-step">
            {verifying ? (
              /* Connecting state */
              <div className="tgs-verifying">
                <div className="tgs-spinner" />
                <h3 className="tgs-verifying-title">Connecting to Telegram...</h3>
                <p className="tgs-verifying-desc">Verifying your bot token with the Telegram API</p>
              </div>
            ) : verifyError ? (
              /* Error state */
              <div className="tgs-verify-error">
                <div className="tgs-error-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h3 className="tgs-error-title">Connection Failed</h3>
                <p className="tgs-error-message">{verifyError}</p>
                <div className="tgs-actions">
                  <button
                    className="tgs-btn tgs-btn-secondary"
                    onClick={() => goToStep('token', 'backward')}
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    className="tgs-btn tgs-btn-primary"
                    onClick={handleConnect}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              /* Success state */
              <div className="tgs-verify-success">
                <div className="tgs-success-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3 className="tgs-success-title">Bot Verified!</h3>

                {/* Bot info card */}
                <div className="tgs-bot-card">
                  <div className="tgs-bot-avatar">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  </div>
                  <div className="tgs-bot-details">
                    <span className="tgs-bot-name">{botInfo.name ?? 'Bot'}</span>
                    <span className="tgs-bot-username">@{botInfo.username ?? 'unknown'}</span>
                  </div>
                  <div className="tgs-bot-badges">
                    {botInfo.canJoinGroups && (
                      <span className="tgs-badge tgs-badge-green">Can join groups</span>
                    )}
                    {botInfo.canJoinGroups === false && (
                      <span className="tgs-badge tgs-badge-gray">No group access</span>
                    )}
                  </div>
                </div>

                {/* Continue */}
                <div className="tgs-actions">
                  <button
                    className="tgs-btn tgs-btn-secondary"
                    onClick={() => goToStep('token', 'backward')}
                    type="button"
                  >
                    Use different token
                  </button>
                  <button
                    className="tgs-btn tgs-btn-primary"
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
          <div className="tgs-step">
            <div className="tgs-header">
              <h2 className="tgs-title">Configure Bot</h2>
              <p className="tgs-subtitle">
                Customize commands and response behavior for your Telegram bot.
              </p>
            </div>

            {/* Bot info summary */}
            <div className="tgs-bot-summary">
              <div className="tgs-bot-avatar-sm">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </div>
              <div>
                <span className="tgs-summary-name">{botInfo.name ?? 'Bot'}</span>
                <span className="tgs-summary-username">@{botInfo.username ?? 'unknown'}</span>
              </div>
            </div>

            {/* Custom Commands Editor */}
            <div className="tgs-section">
              <h3 className="tgs-section-title">Custom Commands</h3>
              <p className="tgs-section-desc">
                Commands will be registered with Telegram via setMyCommands. Users will see these in the commands menu.
              </p>

              {/* Commands table */}
              {commands.length > 0 && (
                <div className="tgs-commands-table">
                  <div className="tgs-commands-header">
                    <span className="tgs-col-command">Command</span>
                    <span className="tgs-col-desc">Description</span>
                    <span className="tgs-col-action" />
                  </div>
                  {commands.map((cmd) => (
                    <div key={cmd.command} className="tgs-commands-row">
                      <span className="tgs-col-command">
                        <code className="tgs-command-name">/{cmd.command}</code>
                      </span>
                      <span className="tgs-col-desc tgs-command-desc">{cmd.description}</span>
                      <span className="tgs-col-action">
                        <button
                          className="tgs-remove-btn"
                          onClick={() => handleRemoveCommand(cmd.command)}
                          type="button"
                          aria-label={`Remove /${cmd.command}`}
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add command row */}
              <div className="tgs-add-command">
                <input
                  type="text"
                  className="tgs-input tgs-input-sm"
                  placeholder="/command"
                  value={newCommandName}
                  onChange={(e) => setNewCommandName(e.target.value)}
                  onKeyDown={handleCommandKeyDown}
                />
                <input
                  type="text"
                  className="tgs-input tgs-input-sm tgs-input-grow"
                  placeholder="Description"
                  value={newCommandDesc}
                  onChange={(e) => setNewCommandDesc(e.target.value)}
                  onKeyDown={handleCommandKeyDown}
                />
                <button
                  className="tgs-btn tgs-btn-small"
                  onClick={handleAddCommand}
                  disabled={!newCommandName.trim() || !newCommandDesc.trim()}
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Stream Mode */}
            <div className="tgs-section">
              <h3 className="tgs-section-title">Stream Mode</h3>
              <p className="tgs-section-desc">
                Choose how the bot sends responses to users.
              </p>

              <div className="tgs-radio-group">
                <label className={`tgs-radio-option ${streamMode === 'off' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="streamMode"
                    value="off"
                    checked={streamMode === 'off'}
                    onChange={() => setStreamMode('off')}
                  />
                  <div className="tgs-radio-content">
                    <span className="tgs-radio-name">Off</span>
                    <span className="tgs-radio-desc">Send complete responses only. Wait until the full response is ready.</span>
                  </div>
                </label>

                <label className={`tgs-radio-option ${streamMode === 'partial' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="streamMode"
                    value="partial"
                    checked={streamMode === 'partial'}
                    onChange={() => setStreamMode('partial')}
                  />
                  <div className="tgs-radio-content">
                    <span className="tgs-radio-name">Partial</span>
                    <span className="tgs-radio-desc">Stream chunks as they arrive. Messages are sent incrementally.</span>
                  </div>
                </label>

                <label className={`tgs-radio-option ${streamMode === 'block' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="streamMode"
                    value="block"
                    checked={streamMode === 'block'}
                    onChange={() => setStreamMode('block')}
                  />
                  <div className="tgs-radio-content">
                    <span className="tgs-radio-name">Block</span>
                    <span className="tgs-radio-desc">Wait for full response, then send as a single message.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Draft Chunk Size (only visible when partial) */}
            {streamMode === 'partial' && (
              <div className="tgs-section tgs-section-slide">
                <h3 className="tgs-section-title">Draft Chunk Size</h3>
                <p className="tgs-section-desc">
                  Maximum number of characters per streamed message chunk.
                </p>
                <div className="tgs-slider-row">
                  <input
                    type="range"
                    className="tgs-slider"
                    min={100}
                    max={2000}
                    step={50}
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                  />
                  <span className="tgs-slider-value">{chunkSize} chars</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="tgs-actions">
              <button
                className="tgs-btn tgs-btn-secondary"
                onClick={() => goToStep('verification', 'backward')}
                type="button"
              >
                Back
              </button>
              <button
                className="tgs-btn tgs-btn-primary"
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

export default TelegramSetup;

/* ===================================================================
   Scoped styles (tgs- prefix)
   =================================================================== */

const telegramSetupStyles = `
/* Container */
.tgs-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
}

/* Banner */
.tgs-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.tgs-banner-warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* Progress indicator */
.tgs-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0.5rem 0;
}

.tgs-progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  min-width: 80px;
}

.tgs-progress-dot {
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

.tgs-progress-step.active .tgs-progress-dot {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  color: #fff;
}

.tgs-progress-step.done .tgs-progress-dot {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

.tgs-progress-label {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary, #606080);
  transition: color 0.3s ease;
}

.tgs-progress-step.active .tgs-progress-label {
  color: var(--text-primary, #fff);
}

.tgs-progress-step.done .tgs-progress-label {
  color: #10b981;
}

.tgs-progress-line {
  flex: 1;
  max-width: 60px;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 0.5rem;
  margin-bottom: 1.25rem;
}

/* Step content animation */
.tgs-step-content {
  animation: tgs-slide-in 0.3s ease;
}

.tgs-anim-forward {
  animation-name: tgs-slide-forward;
}

.tgs-anim-backward {
  animation-name: tgs-slide-backward;
}

@keyframes tgs-slide-forward {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes tgs-slide-backward {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Step */
.tgs-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Header */
.tgs-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.tgs-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(0, 136, 204, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0088cc;
  margin-bottom: 0.5rem;
}

.tgs-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.tgs-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  line-height: 1.5;
  max-width: 480px;
}

/* Instructions */
.tgs-instructions {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.tgs-instructions-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.625rem;
}

.tgs-instructions-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tgs-instructions-list li {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  line-height: 1.4;
}

.tgs-instructions-list strong {
  color: var(--text-primary, #fff);
}

.tgs-link {
  color: #0088cc;
  text-decoration: none;
  font-weight: 500;
}

.tgs-link:hover {
  text-decoration: underline;
}

.tgs-code {
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  color: #c7d2fe;
}

/* Field */
.tgs-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.tgs-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

.tgs-token-input-row {
  display: flex;
  gap: 0;
  position: relative;
}

.tgs-input {
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

.tgs-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.tgs-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.tgs-input-mono {
  font-family: var(--font-mono, monospace);
  font-size: 0.8125rem;
}

.tgs-input-error {
  border-color: #ef4444;
}

.tgs-input-error:focus {
  border-color: #ef4444;
}

.tgs-input-sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
}

.tgs-input-grow {
  flex: 2;
}

.tgs-token-input-row .tgs-input {
  border-radius: 8px 0 0 8px;
}

.tgs-show-toggle {
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

.tgs-show-toggle:hover {
  color: var(--text-secondary, #a0a0c0);
  background: rgba(255, 255, 255, 0.04);
}

.tgs-field-error {
  font-size: 0.75rem;
  color: #ef4444;
}

/* Verifying state */
.tgs-verifying {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  text-align: center;
}

.tgs-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  border-top-color: #0088cc;
  border-radius: 50%;
  animation: tgs-spin 0.8s linear infinite;
}

@keyframes tgs-spin {
  to { transform: rotate(360deg); }
}

.tgs-verifying-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.tgs-verifying-desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
}

/* Verify error */
.tgs-verify-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 2rem;
  text-align: center;
}

.tgs-error-icon {
  color: #ef4444;
}

.tgs-error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.tgs-error-message {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  max-width: 400px;
  line-height: 1.5;
}

/* Verify success */
.tgs-verify-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 2rem;
  text-align: center;
}

.tgs-success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
  animation: tgs-success-pop 0.4s ease;
}

@keyframes tgs-success-pop {
  0% { transform: scale(0.5); opacity: 0; }
  70% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.tgs-success-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

/* Bot card */
.tgs-bot-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 2rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  width: 100%;
  max-width: 320px;
}

.tgs-bot-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 136, 204, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0088cc;
}

.tgs-bot-details {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.tgs-bot-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.tgs-bot-username {
  font-size: 0.8125rem;
  color: #0088cc;
}

.tgs-bot-badges {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  justify-content: center;
}

.tgs-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 500;
  border-radius: 4px;
}

.tgs-badge-green {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.tgs-badge-gray {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-tertiary, #606080);
}

/* Bot summary (step 3 header) */
.tgs-bot-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.tgs-bot-avatar-sm {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 136, 204, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0088cc;
  flex-shrink: 0;
}

.tgs-summary-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  display: block;
}

.tgs-summary-username {
  font-size: 0.75rem;
  color: #0088cc;
}

/* Section */
.tgs-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tgs-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tgs-section-desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
  line-height: 1.4;
}

.tgs-section-slide {
  animation: tgs-slide-down 0.3s ease;
}

@keyframes tgs-slide-down {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 200px; }
}

/* Commands table */
.tgs-commands-table {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;
}

.tgs-commands-header {
  display: flex;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
}

.tgs-commands-row {
  display: flex;
  padding: 0.625rem 0.75rem;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  transition: background 0.15s ease;
}

.tgs-commands-row:last-child {
  border-bottom: none;
}

.tgs-commands-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.tgs-col-command {
  width: 140px;
  flex-shrink: 0;
}

.tgs-col-desc {
  flex: 1;
  min-width: 0;
}

.tgs-col-action {
  width: 36px;
  flex-shrink: 0;
  text-align: right;
}

.tgs-command-name {
  font-family: var(--font-mono, monospace);
  font-size: 0.8125rem;
  color: #c7d2fe;
  background: rgba(99, 102, 241, 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.tgs-command-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tgs-remove-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.tgs-remove-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

/* Add command row */
.tgs-add-command {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* Radio group */
.tgs-radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tgs-radio-option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 2px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tgs-radio-option:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.tgs-radio-option.active {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.06);
}

.tgs-radio-option input[type="radio"] {
  margin-top: 0.125rem;
  accent-color: var(--accent-color, #6366f1);
}

.tgs-radio-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.tgs-radio-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.tgs-radio-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.4;
}

/* Slider */
.tgs-slider-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.tgs-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  outline: none;
}

.tgs-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease;
}

.tgs-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.tgs-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.tgs-slider-value {
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: var(--font-mono, monospace);
  color: var(--text-primary, #fff);
  min-width: 80px;
  text-align: right;
}

/* Buttons */
.tgs-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.tgs-btn {
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

.tgs-btn-primary {
  background: var(--accent-color, #6366f1);
  color: #fff;
}

.tgs-btn-primary:hover:not(:disabled) {
  background: #4f46e5;
  transform: translateY(-1px);
}

.tgs-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tgs-btn-secondary {
  background: transparent;
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.tgs-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--text-primary, #fff);
}

.tgs-btn-small {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--accent-color, #6366f1);
  color: #fff;
  border-radius: 6px;
}

.tgs-btn-small:hover:not(:disabled) {
  background: #4f46e5;
}

.tgs-btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 480px) {
  .tgs-container {
    padding: 1rem;
  }

  .tgs-actions {
    flex-direction: column-reverse;
  }

  .tgs-actions .tgs-btn {
    width: 100%;
    justify-content: center;
  }

  .tgs-progress-label {
    font-size: 0.625rem;
  }

  .tgs-progress-step {
    min-width: 60px;
  }

  .tgs-add-command {
    flex-direction: column;
  }

  .tgs-add-command .tgs-input {
    width: 100%;
  }

  .tgs-col-command {
    width: 100px;
  }
}
`;
