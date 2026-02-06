/**
 * Discord Bot Setup - Step wizard for connecting a Discord bot
 *
 * Flow:
 *   Step 1: Bot Token - enter and validate the Discord bot token
 *   Step 2: Verification - connecting spinner, bot info on success
 *   Step 3: Guild Configuration - per-guild channel filters + global settings
 *
 * Uses gateway `channels.login` (discord) for token-based auth,
 * `channels.status` for connection checks, and `config.patch`
 * for persisting channel configuration.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGateway } from '../../../hooks/useGateway';
import { useGatewayConfig } from '../../../hooks/useGatewayConfig';
import { GuildConfig, type GuildConfigData } from './GuildConfig';

/* ===================================================================
   Types
   =================================================================== */

export interface DiscordSetupProps {
  onBack?: () => void;
  onConnected?: () => void;
}

type SetupStep = 'token' | 'verification' | 'guilds';
type ReplyToMode = 'off' | 'first' | 'all';

interface BotInfo {
  id?: string;
  username?: string;
  discriminator?: string;
  avatar?: string;
  guildCount?: number;
}

interface GuildInfo {
  id: string;
  name: string;
  icon?: string;
  memberCount?: number;
}

interface GuildConfigState {
  channelAllowlist: string[];
  channelDenylist: string[];
}

/* ===================================================================
   Constants
   =================================================================== */

const DISCORD_BRAND_COLOR = '#5865F2';
const MIN_TOKEN_LENGTH = 50;
const MAX_TOKEN_LENGTH = 100;

/* ===================================================================
   Helpers
   =================================================================== */

/**
 * Basic validation for Discord bot token format.
 * Discord tokens are base64-encoded strings typically 59-72+ chars.
 */
function isValidBotToken(token: string): boolean {
  const trimmed = token.trim();
  if (trimmed.length < MIN_TOKEN_LENGTH || trimmed.length > MAX_TOKEN_LENGTH) {
    return false;
  }
  // Discord tokens have 3 parts separated by dots
  const parts = trimmed.split('.');
  return parts.length >= 2;
}

/* ===================================================================
   Component
   =================================================================== */

export function DiscordSetup({ onBack, onConnected }: DiscordSetupProps) {
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

  // Step 3: Guild Configuration
  const [guilds, setGuilds] = useState<GuildInfo[]>([]);
  const [guildConfigs, setGuildConfigs] = useState<Record<string, GuildConfigState>>({});
  const [replyToMode, setReplyToMode] = useState<ReplyToMode>('first');
  const [maxLinesPerMessage, setMaxLinesPerMessage] = useState(40);
  const [groupDmEnabled, setGroupDmEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

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
      setTokenError('Invalid token format. Discord bot tokens are typically 59+ characters with dot-separated segments.');
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
        guilds?: GuildInfo[];
        status?: string;
        error?: string;
      }>('channels.login', {
        channel: 'discord',
        token: trimmed,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setBotInfo(result.bot ?? {});

      // Initialize guilds from response
      const guildList = result.guilds ?? [];
      setGuilds(guildList);

      // Initialize per-guild configs with empty lists
      const initialConfigs: Record<string, GuildConfigState> = {};
      for (const guild of guildList) {
        initialConfigs[guild.id] = { channelAllowlist: [], channelDenylist: [] };
      }
      setGuildConfigs(initialConfigs);

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
     Step 3: Guild config updates
     --------------------------------------------------------------- */

  const handleGuildUpdate = useCallback((guildId: string, config: GuildConfigData) => {
    setGuildConfigs((prev) => ({
      ...prev,
      [guildId]: config,
    }));
  }, []);

  /* ---------------------------------------------------------------
     Save & finish
     --------------------------------------------------------------- */

  const handleSaveAndDone = useCallback(async () => {
    setSaving(true);

    try {
      // Build per-guild config map for persistence
      const guildsConfig: Record<string, {
        channelAllowlist: string[];
        channelDenylist: string[];
      }> = {};
      for (const guild of guilds) {
        const gc = guildConfigs[guild.id];
        if (gc && (gc.channelAllowlist.length > 0 || gc.channelDenylist.length > 0)) {
          guildsConfig[guild.id] = {
            channelAllowlist: gc.channelAllowlist,
            channelDenylist: gc.channelDenylist,
          };
        }
      }

      await patchGatewayConfig({
        'channels.discord': {
          enabled: true,
          config: {
            botToken: botToken.trim(),
            botUsername: botInfo.username,
            botDiscriminator: botInfo.discriminator,
            botId: botInfo.id,
            replyToMode,
            maxLinesPerMessage,
            groupDmEnabled,
            guilds: guildsConfig,
          },
        },
      });
    } catch (err) {
      console.error('Failed to save Discord config:', err);
      // Continue anyway - settings are best-effort
    }

    setSaving(false);
    onConnected?.();
  }, [
    patchGatewayConfig,
    botToken,
    botInfo,
    guilds,
    guildConfigs,
    replyToMode,
    maxLinesPerMessage,
    groupDmEnabled,
    onConnected,
  ]);

  /* ---------------------------------------------------------------
     Render
     --------------------------------------------------------------- */

  return (
    <div className="dcs-container">
      <style>{discordSetupStyles}</style>

      {/* Gateway disconnected banner */}
      {!gatewayConnected && (
        <div className="dcs-banner dcs-banner-warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. Discord setup requires an active gateway connection.
        </div>
      )}

      {/* Step progress indicator */}
      <div className="dcs-progress">
        <div className={`dcs-progress-step ${step === 'token' ? 'active' : 'done'}`}>
          <span className="dcs-progress-dot">
            {step !== 'token' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '1'}
          </span>
          <span className="dcs-progress-label">Bot Token</span>
        </div>
        <div className="dcs-progress-line" />
        <div className={`dcs-progress-step ${step === 'verification' ? 'active' : step === 'guilds' ? 'done' : ''}`}>
          <span className="dcs-progress-dot">
            {step === 'guilds' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : '2'}
          </span>
          <span className="dcs-progress-label">Verification</span>
        </div>
        <div className="dcs-progress-line" />
        <div className={`dcs-progress-step ${step === 'guilds' ? 'active' : ''}`}>
          <span className="dcs-progress-dot">3</span>
          <span className="dcs-progress-label">Configuration</span>
        </div>
      </div>

      {/* Step content with animated transitions */}
      <div className={`dcs-step-content dcs-anim-${animDirection}`} key={step}>
        {/* ============================================================
            STEP 1: Bot Token
            ============================================================ */}
        {step === 'token' && (
          <div className="dcs-step">
            <div className="dcs-header">
              {/* Discord icon (game controller / Discord logo) */}
              <div className="dcs-icon-circle">
                <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </div>
              <h2 className="dcs-title">Connect Discord Bot</h2>
              <p className="dcs-subtitle">
                Enter your bot token from the Discord Developer Portal to connect your bot.
              </p>
            </div>

            {/* Instructions */}
            <div className="dcs-instructions">
              <h4 className="dcs-instructions-title">How to get a bot token</h4>
              <ol className="dcs-instructions-list">
                <li>
                  Go to{' '}
                  <a
                    href="https://discord.com/developers/applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dcs-link"
                  >
                    discord.com/developers/applications
                  </a>
                </li>
                <li>Select your application (or create a new one)</li>
                <li>Navigate to <strong>Bot</strong> in the sidebar</li>
                <li>Click <strong>Reset Token</strong> and copy the generated token</li>
              </ol>
            </div>

            {/* Token input */}
            <div className="dcs-field">
              <label className="dcs-label" htmlFor="dcs-token-input">Bot Token</label>
              <div className="dcs-token-input-row">
                <input
                  id="dcs-token-input"
                  ref={tokenInputRef}
                  type={showToken ? 'text' : 'password'}
                  className={`dcs-input dcs-input-mono ${tokenError ? 'dcs-input-error' : ''}`}
                  placeholder="MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.AbCdEf.aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                  value={botToken}
                  onChange={handleTokenChange}
                  onKeyDown={handleTokenKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  className="dcs-show-toggle"
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
              {tokenError && <span className="dcs-field-error">{tokenError}</span>}
            </div>

            {/* Actions */}
            <div className="dcs-actions">
              {onBack && (
                <button className="dcs-btn dcs-btn-secondary" onClick={onBack} type="button">
                  Back
                </button>
              )}
              <button
                className="dcs-btn dcs-btn-primary"
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
          <div className="dcs-step">
            {verifying ? (
              /* Connecting state */
              <div className="dcs-verifying">
                <div className="dcs-spinner" />
                <h3 className="dcs-verifying-title">Connecting to Discord...</h3>
                <p className="dcs-verifying-desc">Verifying your bot token with the Discord API</p>
              </div>
            ) : verifyError ? (
              /* Error state */
              <div className="dcs-verify-error">
                <div className="dcs-error-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h3 className="dcs-error-title">Connection Failed</h3>
                <p className="dcs-error-message">{verifyError}</p>
                <div className="dcs-actions">
                  <button
                    className="dcs-btn dcs-btn-secondary"
                    onClick={() => goToStep('token', 'backward')}
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    className="dcs-btn dcs-btn-primary"
                    onClick={handleConnect}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              /* Success state */
              <div className="dcs-verify-success">
                <div className="dcs-success-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3 className="dcs-success-title">Bot Connected!</h3>

                {/* Bot info card */}
                <div className="dcs-bot-card">
                  <div className="dcs-bot-avatar">
                    {botInfo.avatar ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${botInfo.id}/${botInfo.avatar}.png?size=64`}
                        alt={botInfo.username ?? 'Bot'}
                        className="dcs-bot-avatar-img"
                      />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                    )}
                  </div>
                  <div className="dcs-bot-details">
                    <span className="dcs-bot-name">
                      {botInfo.username ?? 'Bot'}
                      {botInfo.discriminator && botInfo.discriminator !== '0' && (
                        <span className="dcs-bot-discriminator">#{botInfo.discriminator}</span>
                      )}
                    </span>
                    <span className="dcs-bot-id">ID: {botInfo.id ?? 'Unknown'}</span>
                  </div>
                  <div className="dcs-bot-badges">
                    {botInfo.guildCount != null && (
                      <span className="dcs-badge dcs-badge-purple">
                        {botInfo.guildCount} server{botInfo.guildCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {guilds.length > 0 && botInfo.guildCount == null && (
                      <span className="dcs-badge dcs-badge-purple">
                        {guilds.length} server{guilds.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Continue */}
                <div className="dcs-actions">
                  <button
                    className="dcs-btn dcs-btn-secondary"
                    onClick={() => goToStep('token', 'backward')}
                    type="button"
                  >
                    Use different token
                  </button>
                  <button
                    className="dcs-btn dcs-btn-primary"
                    onClick={() => goToStep('guilds')}
                    type="button"
                  >
                    Continue
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
            STEP 3: Guild Configuration
            ============================================================ */}
        {step === 'guilds' && (
          <div className="dcs-step">
            <div className="dcs-header">
              <h2 className="dcs-title">Configure Bot</h2>
              <p className="dcs-subtitle">
                Set per-server channel filters and global response behavior.
              </p>
            </div>

            {/* Bot info summary */}
            <div className="dcs-bot-summary">
              <div className="dcs-bot-avatar-sm">
                {botInfo.avatar ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${botInfo.id}/${botInfo.avatar}.png?size=32`}
                    alt={botInfo.username ?? 'Bot'}
                    className="dcs-bot-avatar-img-sm"
                  />
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                )}
              </div>
              <div>
                <span className="dcs-summary-name">
                  {botInfo.username ?? 'Bot'}
                  {botInfo.discriminator && botInfo.discriminator !== '0' && (
                    <span className="dcs-summary-discriminator">#{botInfo.discriminator}</span>
                  )}
                </span>
                <span className="dcs-summary-meta">Connected and ready</span>
              </div>
            </div>

            {/* Guild list */}
            {guilds.length > 0 && (
              <div className="dcs-section">
                <h3 className="dcs-section-title">Servers ({guilds.length})</h3>
                <p className="dcs-section-desc">
                  Configure channel access per server. Expand a server to set allowlist or denylist filters.
                </p>
                <div className="dcs-guilds-list">
                  {guilds.map((guild) => (
                    <GuildConfig
                      key={guild.id}
                      guildId={guild.id}
                      guildName={guild.name}
                      guildIcon={guild.icon}
                      memberCount={guild.memberCount}
                      channelAllowlist={guildConfigs[guild.id]?.channelAllowlist ?? []}
                      channelDenylist={guildConfigs[guild.id]?.channelDenylist ?? []}
                      onUpdate={(config) => handleGuildUpdate(guild.id, config)}
                    />
                  ))}
                </div>
              </div>
            )}

            {guilds.length === 0 && (
              <div className="dcs-empty-guilds">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <p>No servers found. Invite the bot to a server to configure it here.</p>
              </div>
            )}

            {/* Global settings */}
            <div className="dcs-section">
              <h3 className="dcs-section-title">Global Settings</h3>

              {/* Reply-to mode */}
              <div className="dcs-setting">
                <label className="dcs-setting-label">Reply-to Mode</label>
                <p className="dcs-setting-desc">How the bot responds when mentioned in a channel.</p>
                <div className="dcs-radio-group">
                  <label className={`dcs-radio-option ${replyToMode === 'off' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="replyToMode"
                      value="off"
                      checked={replyToMode === 'off'}
                      onChange={() => setReplyToMode('off')}
                    />
                    <div className="dcs-radio-content">
                      <span className="dcs-radio-name">Off</span>
                      <span className="dcs-radio-desc">Don't auto-reply to mentions</span>
                    </div>
                  </label>

                  <label className={`dcs-radio-option ${replyToMode === 'first' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="replyToMode"
                      value="first"
                      checked={replyToMode === 'first'}
                      onChange={() => setReplyToMode('first')}
                    />
                    <div className="dcs-radio-content">
                      <span className="dcs-radio-name">First</span>
                      <span className="dcs-radio-desc">Reply to first message only in a conversation thread</span>
                    </div>
                  </label>

                  <label className={`dcs-radio-option ${replyToMode === 'all' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="replyToMode"
                      value="all"
                      checked={replyToMode === 'all'}
                      onChange={() => setReplyToMode('all')}
                    />
                    <div className="dcs-radio-content">
                      <span className="dcs-radio-name">All</span>
                      <span className="dcs-radio-desc">Reply to every mention or direct message</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Max lines per message */}
              <div className="dcs-setting">
                <label className="dcs-setting-label">
                  Max Lines per Message: <span className="dcs-setting-value">{maxLinesPerMessage}</span>
                </label>
                <p className="dcs-setting-desc">
                  Limit the number of lines in each bot response message. Longer responses will be split.
                </p>
                <div className="dcs-slider-row">
                  <span className="dcs-slider-min">10</span>
                  <input
                    type="range"
                    className="dcs-slider"
                    min={10}
                    max={100}
                    step={5}
                    value={maxLinesPerMessage}
                    onChange={(e) => setMaxLinesPerMessage(Number(e.target.value))}
                  />
                  <span className="dcs-slider-max">100</span>
                </div>
              </div>

              {/* Group DM toggle */}
              <div className="dcs-setting dcs-setting-row">
                <div className="dcs-setting-text">
                  <label className="dcs-setting-label">Group DMs</label>
                  <p className="dcs-setting-desc">Allow the bot to participate in group direct messages.</p>
                </div>
                <label className="dcs-toggle">
                  <input
                    type="checkbox"
                    checked={groupDmEnabled}
                    onChange={() => setGroupDmEnabled(!groupDmEnabled)}
                  />
                  <span className="dcs-toggle-slider" />
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="dcs-actions">
              <button
                className="dcs-btn dcs-btn-secondary"
                onClick={() => goToStep('verification', 'backward')}
                type="button"
              >
                Back
              </button>
              <button
                className="dcs-btn dcs-btn-primary"
                onClick={handleSaveAndDone}
                disabled={saving}
                type="button"
              >
                {saving ? 'Saving...' : 'Save & Done'}
                {!saving && (
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DiscordSetup;

/* ===================================================================
   Scoped styles (dcs- prefix)
   =================================================================== */

const discordSetupStyles = `
/* Container */
.dcs-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
}

/* Banner */
.dcs-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.dcs-banner-warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* Progress indicator */
.dcs-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0.5rem 0;
}

.dcs-progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  min-width: 80px;
}

.dcs-progress-dot {
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

.dcs-progress-step.active .dcs-progress-dot {
  background: ${DISCORD_BRAND_COLOR};
  border-color: ${DISCORD_BRAND_COLOR};
  color: #fff;
}

.dcs-progress-step.done .dcs-progress-dot {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

.dcs-progress-label {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary, #606080);
  transition: color 0.3s ease;
}

.dcs-progress-step.active .dcs-progress-label {
  color: var(--text-primary, #fff);
}

.dcs-progress-step.done .dcs-progress-label {
  color: #10b981;
}

.dcs-progress-line {
  flex: 1;
  max-width: 60px;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 0.5rem;
  margin-bottom: 1.25rem;
}

/* Step content animation */
.dcs-step-content {
  animation: dcs-slide-in 0.3s ease;
}

.dcs-anim-forward {
  animation-name: dcs-slide-forward;
}

.dcs-anim-backward {
  animation-name: dcs-slide-backward;
}

@keyframes dcs-slide-forward {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes dcs-slide-backward {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Step */
.dcs-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Header */
.dcs-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.dcs-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(88, 101, 242, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${DISCORD_BRAND_COLOR};
  margin-bottom: 0.5rem;
}

.dcs-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.dcs-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  line-height: 1.5;
  max-width: 480px;
}

/* Instructions */
.dcs-instructions {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.dcs-instructions-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.625rem;
}

.dcs-instructions-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dcs-instructions-list li {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  line-height: 1.4;
}

.dcs-instructions-list strong {
  color: var(--text-primary, #fff);
}

.dcs-link {
  color: ${DISCORD_BRAND_COLOR};
  text-decoration: none;
  font-weight: 500;
}

.dcs-link:hover {
  text-decoration: underline;
}

/* Field */
.dcs-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.dcs-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

.dcs-token-input-row {
  display: flex;
  gap: 0;
  position: relative;
}

.dcs-input {
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

.dcs-input:focus {
  border-color: ${DISCORD_BRAND_COLOR};
}

.dcs-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.dcs-input-mono {
  font-family: var(--font-mono, monospace);
  font-size: 0.8125rem;
}

.dcs-input-error {
  border-color: #ef4444;
}

.dcs-input-error:focus {
  border-color: #ef4444;
}

.dcs-token-input-row .dcs-input {
  border-radius: 8px 0 0 8px;
}

.dcs-show-toggle {
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

.dcs-show-toggle:hover {
  color: var(--text-secondary, #a0a0c0);
  background: rgba(255, 255, 255, 0.04);
}

.dcs-field-error {
  font-size: 0.75rem;
  color: #ef4444;
}

/* Verifying state */
.dcs-verifying {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  text-align: center;
}

.dcs-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  border-top-color: ${DISCORD_BRAND_COLOR};
  border-radius: 50%;
  animation: dcs-spin 0.8s linear infinite;
}

@keyframes dcs-spin {
  to { transform: rotate(360deg); }
}

.dcs-verifying-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.dcs-verifying-desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
}

/* Verify error */
.dcs-verify-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 2rem;
  text-align: center;
}

.dcs-error-icon {
  color: #ef4444;
}

.dcs-error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.dcs-error-message {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  max-width: 400px;
  line-height: 1.5;
}

/* Verify success */
.dcs-verify-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 2rem;
  text-align: center;
}

.dcs-success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
  animation: dcs-success-pop 0.4s ease;
}

@keyframes dcs-success-pop {
  0% { transform: scale(0.5); opacity: 0; }
  70% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.dcs-success-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

/* Bot card */
.dcs-bot-card {
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

.dcs-bot-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(88, 101, 242, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${DISCORD_BRAND_COLOR};
  overflow: hidden;
}

.dcs-bot-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.dcs-bot-details {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.dcs-bot-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.dcs-bot-discriminator {
  font-weight: 400;
  color: var(--text-tertiary, #606080);
}

.dcs-bot-id {
  font-size: 0.6875rem;
  font-family: var(--font-mono, monospace);
  color: var(--text-tertiary, #606080);
}

.dcs-bot-badges {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  justify-content: center;
}

.dcs-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 500;
  border-radius: 4px;
}

.dcs-badge-purple {
  background: rgba(88, 101, 242, 0.15);
  color: #818cf8;
}

/* Bot summary (step 3 header) */
.dcs-bot-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.dcs-bot-avatar-sm {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(88, 101, 242, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${DISCORD_BRAND_COLOR};
  flex-shrink: 0;
  overflow: hidden;
}

.dcs-bot-avatar-img-sm {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.dcs-summary-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  display: block;
}

.dcs-summary-discriminator {
  font-weight: 400;
  color: var(--text-tertiary, #606080);
}

.dcs-summary-meta {
  font-size: 0.75rem;
  color: #10b981;
}

/* Section */
.dcs-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dcs-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dcs-section-desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
  line-height: 1.4;
}

/* Guilds list */
.dcs-guilds-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Empty guilds */
.dcs-empty-guilds {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  text-align: center;
  color: var(--text-tertiary, #606080);
}

.dcs-empty-guilds p {
  font-size: 0.8125rem;
  margin: 0;
  max-width: 320px;
  line-height: 1.5;
}

/* Settings */
.dcs-setting {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.dcs-setting-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.dcs-setting-text {
  flex: 1;
  min-width: 0;
}

.dcs-setting-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.dcs-setting-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
  line-height: 1.4;
}

.dcs-setting-value {
  font-family: var(--font-mono, monospace);
  font-weight: 700;
  color: ${DISCORD_BRAND_COLOR};
}

/* Radio group */
.dcs-radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.375rem;
}

.dcs-radio-option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary, #111127);
  border: 2px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dcs-radio-option:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.dcs-radio-option.active {
  border-color: ${DISCORD_BRAND_COLOR};
  background: rgba(88, 101, 242, 0.06);
}

.dcs-radio-option input[type="radio"] {
  margin-top: 0.125rem;
  accent-color: ${DISCORD_BRAND_COLOR};
}

.dcs-radio-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.dcs-radio-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.dcs-radio-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.4;
}

/* Slider */
.dcs-slider-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.375rem;
}

.dcs-slider-min,
.dcs-slider-max {
  font-size: 0.6875rem;
  font-family: var(--font-mono, monospace);
  color: var(--text-tertiary, #606080);
  min-width: 28px;
  text-align: center;
}

.dcs-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  outline: none;
}

.dcs-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${DISCORD_BRAND_COLOR};
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease;
}

.dcs-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.dcs-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${DISCORD_BRAND_COLOR};
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

/* Toggle */
.dcs-toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.dcs-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.dcs-toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  transition: background 0.2s ease;
}

.dcs-toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.dcs-toggle input:checked + .dcs-toggle-slider {
  background: ${DISCORD_BRAND_COLOR};
}

.dcs-toggle input:checked + .dcs-toggle-slider::before {
  transform: translateX(20px);
}

/* Buttons */
.dcs-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.dcs-btn {
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

.dcs-btn-primary {
  background: ${DISCORD_BRAND_COLOR};
  color: #fff;
}

.dcs-btn-primary:hover:not(:disabled) {
  background: #4752c4;
  transform: translateY(-1px);
}

.dcs-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dcs-btn-secondary {
  background: transparent;
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.dcs-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--text-primary, #fff);
}

/* Responsive */
@media (max-width: 480px) {
  .dcs-container {
    padding: 1rem;
  }

  .dcs-actions {
    flex-direction: column-reverse;
  }

  .dcs-actions .dcs-btn {
    width: 100%;
    justify-content: center;
  }

  .dcs-progress-label {
    font-size: 0.625rem;
  }

  .dcs-progress-step {
    min-width: 60px;
  }

  .dcs-setting-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .dcs-radio-group {
    gap: 0.375rem;
  }
}
`;
