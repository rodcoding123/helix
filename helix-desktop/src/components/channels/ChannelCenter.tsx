/**
 * ChannelCenter - Central hub for managing all messaging channels
 *
 * Displays a responsive grid of channel cards (WhatsApp, Telegram, Discord,
 * Signal, iMessage, LINE) with real-time connection status, quick
 * connect/disconnect actions, and a drill-down detail view for each channel.
 *
 * Gateway methods:
 *   - channels.status   -> Get all channel statuses
 *   - channels.login    -> Authenticate / connect a channel
 *   - channels.logout   -> Disconnect a channel
 *   - config.patch      -> Persist per-channel configuration
 *
 * CSS prefix: cc-
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';
import {
  ChannelDetail,
  type ChannelType,
  type ChannelStatus,
  type ChannelConfig,
} from './ChannelDetail';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface ChannelCenterProps {
  onNavigateToSetup?: (channelType: ChannelType) => void;
}

interface ChannelEntry {
  type: ChannelType;
  label: string;
  subtitle: string;
  icon: string;
  status: ChannelStatus;
  activeSessions: number;
  config: ChannelConfig;
}

/* ═══════════════════════════════════════════
   Channel metadata
   ═══════════════════════════════════════════ */

const CHANNEL_META: Record<ChannelType, { label: string; subtitle: string; icon: string }> = {
  whatsapp: {
    label: 'WhatsApp',
    subtitle: 'WhatsApp Messaging',
    icon: '\uD83D\uDCF1', // phone
  },
  telegram: {
    label: 'Telegram',
    subtitle: 'Telegram Bot',
    icon: '\u2708\uFE0F', // paper plane
  },
  discord: {
    label: 'Discord',
    subtitle: 'Discord Bot',
    icon: '\uD83C\uDFAE', // game controller
  },
  signal: {
    label: 'Signal',
    subtitle: 'Signal Messenger',
    icon: '\uD83D\uDEE1\uFE0F', // shield
  },
  imessage: {
    label: 'iMessage',
    subtitle: 'iMessage (macOS only)',
    icon: '\uD83D\uDCAC', // chat bubble
  },
  line: {
    label: 'LINE',
    subtitle: 'LINE Messaging',
    icon: '\uD83D\uDDE8\uFE0F', // speech balloon
  },
};

const ALL_CHANNEL_TYPES: ChannelType[] = ['whatsapp', 'telegram', 'discord', 'signal', 'imessage', 'line'];

const DEFAULT_CONFIG: ChannelConfig = {
  dmPolicy: 'pairing',
  groupPolicy: 'disabled',
  allowlist: [],
  mediaMaxMB: 25,
  mediaTypes: ['image', 'document'],
  messageChunking: false,
  chunkSize: 2000,
  historyLimit: 100,
  streamingMode: 'off',
};

const STATUS_COLORS: Record<ChannelStatus, string> = {
  connected: '#10b981',
  disconnected: '#ef4444',
  connecting: '#f59e0b',
  error: '#ef4444',
  unconfigured: '#606080',
};

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function ChannelCenter({ onNavigateToSetup }: ChannelCenterProps) {
  const { getClient, connected } = useGateway();
  const { gatewayConfig, patchGatewayConfig } = useGatewayConfig();

  // ── state ──
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | null>(null);
  const [actionLoading, setActionLoading] = useState<ChannelType | null>(null);
  const [showAddSelector, setShowAddSelector] = useState(false);

  // ── hydrate channels from gateway ──
  const hydrateChannels = useCallback(
    (statusMap?: Record<string, { status: ChannelStatus; sessions?: number }>): ChannelEntry[] => {
      const gwChannels = gatewayConfig?.channels ?? {};

      return ALL_CHANNEL_TYPES.map((type) => {
        const meta = CHANNEL_META[type];
        const gwEntry = gwChannels[type];
        const remoteStatus = statusMap?.[type];
        const rawConfig = (gwEntry?.config ?? {}) as Partial<ChannelConfig>;

        let channelStatus: ChannelStatus = 'unconfigured';
        if (remoteStatus) {
          channelStatus = remoteStatus.status;
        } else if (gwEntry?.enabled) {
          channelStatus = 'disconnected';
        }

        return {
          type,
          label: meta.label,
          subtitle: meta.subtitle,
          icon: meta.icon,
          status: channelStatus,
          activeSessions: remoteStatus?.sessions ?? 0,
          config: {
            dmPolicy: rawConfig.dmPolicy ?? DEFAULT_CONFIG.dmPolicy,
            groupPolicy: rawConfig.groupPolicy ?? DEFAULT_CONFIG.groupPolicy,
            allowlist: rawConfig.allowlist ?? DEFAULT_CONFIG.allowlist,
            mediaMaxMB: rawConfig.mediaMaxMB ?? DEFAULT_CONFIG.mediaMaxMB,
            mediaTypes: rawConfig.mediaTypes ?? DEFAULT_CONFIG.mediaTypes,
            messageChunking: rawConfig.messageChunking ?? DEFAULT_CONFIG.messageChunking,
            chunkSize: rawConfig.chunkSize ?? DEFAULT_CONFIG.chunkSize,
            historyLimit: rawConfig.historyLimit ?? DEFAULT_CONFIG.historyLimit,
            streamingMode: rawConfig.streamingMode ?? DEFAULT_CONFIG.streamingMode,
          },
        };
      });
    },
    [gatewayConfig],
  );

  // ── fetch status from gateway ──
  const fetchChannelStatuses = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      setChannels(hydrateChannels());
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const result = (await client.channelsStatus()) as {
        channels?: Record<string, { status: ChannelStatus; sessions?: number }>;
      };
      setChannels(hydrateChannels(result.channels));
    } catch (err) {
      console.error('Failed to fetch channel statuses:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch channel statuses');
      setChannels(hydrateChannels());
    } finally {
      setLoading(false);
    }
  }, [getClient, hydrateChannels]);

  useEffect(() => {
    fetchChannelStatuses();
  }, [fetchChannelStatuses, connected]);

  // ── actions ──
  const connectChannel = useCallback(
    async (type: ChannelType) => {
      setActionLoading(type);
      const client = getClient();
      if (!client?.connected) {
        setActionLoading(null);
        return;
      }

      try {
        await client.request('channels.login', { channel: type });
        // Update local state optimistically
        setChannels((prev) =>
          prev.map((ch) =>
            ch.type === type ? { ...ch, status: 'connecting' as ChannelStatus } : ch,
          ),
        );
        // Re-fetch after a short delay for the real status
        setTimeout(() => fetchChannelStatuses(), 2000);
      } catch (err) {
        console.error(`Failed to connect ${type}:`, err);
        setError(err instanceof Error ? err.message : `Failed to connect ${type}`);
      } finally {
        setActionLoading(null);
      }
    },
    [getClient, fetchChannelStatuses],
  );

  const disconnectChannel = useCallback(
    async (type: ChannelType) => {
      setActionLoading(type);
      const client = getClient();
      if (!client?.connected) {
        setActionLoading(null);
        return;
      }

      try {
        await client.request('channels.logout', { channel: type });
        setChannels((prev) =>
          prev.map((ch) =>
            ch.type === type ? { ...ch, status: 'disconnected' as ChannelStatus, activeSessions: 0 } : ch,
          ),
        );
      } catch (err) {
        console.error(`Failed to disconnect ${type}:`, err);
        setError(err instanceof Error ? err.message : `Failed to disconnect ${type}`);
      } finally {
        setActionLoading(null);
      }
    },
    [getClient],
  );

  const saveChannelConfig = useCallback(
    async (type: ChannelType, configPatch: Partial<ChannelConfig>) => {
      // Merge with existing config
      const existing = channels.find((ch) => ch.type === type);
      if (!existing) return;

      const merged: ChannelConfig = { ...existing.config, ...configPatch };

      // Optimistic local update
      setChannels((prev) =>
        prev.map((ch) => (ch.type === type ? { ...ch, config: merged } : ch)),
      );

      // Persist to gateway
      try {
        const currentChannels = gatewayConfig?.channels ?? {};
        await patchGatewayConfig({
          [`channels.${type}`]: {
            ...currentChannels[type],
            enabled: true,
            config: merged,
          },
        });
      } catch (err) {
        console.error(`Failed to save config for ${type}:`, err);
        setError(err instanceof Error ? err.message : `Failed to save ${type} config`);
        // Revert on failure
        setChannels((prev) =>
          prev.map((ch) =>
            ch.type === type ? { ...ch, config: existing.config } : ch,
          ),
        );
      }
    },
    [channels, gatewayConfig, patchGatewayConfig],
  );

  // ── derived ──
  const connectedCount = useMemo(
    () => channels.filter((ch) => ch.status === 'connected').length,
    [channels],
  );

  const selectedEntry = useMemo(
    () => channels.find((ch) => ch.type === selectedChannel),
    [channels, selectedChannel],
  );

  // ═══════════════════════════════════════════
  // RENDER: Detail view
  // ═══════════════════════════════════════════

  if (selectedChannel && selectedEntry) {
    return (
      <div className="cc-root">
        <style>{channelCenterStyles}</style>
        <ChannelDetail
          channelType={selectedEntry.type}
          channelName={`${selectedEntry.icon} ${selectedEntry.label}`}
          status={selectedEntry.status}
          config={selectedEntry.config}
          onBack={() => setSelectedChannel(null)}
          onSave={(patch) => saveChannelConfig(selectedEntry.type, patch)}
          onConnect={() => connectChannel(selectedEntry.type)}
          onDisconnect={() => disconnectChannel(selectedEntry.type)}
          onSetup={() => onNavigateToSetup?.(selectedEntry.type)}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // RENDER: Main grid
  // ═══════════════════════════════════════════

  return (
    <div className="cc-root">
      <style>{channelCenterStyles}</style>

      {/* ── Header ── */}
      <header className="cc-header">
        <div className="cc-header__text">
          <h2 className="cc-header__title">Channels</h2>
          <p className="cc-header__subtitle">Manage messaging platform connections</p>
        </div>
        <div className="cc-header__stats">
          <span className="cc-stat">
            <span className="cc-stat__value">{connectedCount}</span> connected
          </span>
          <span className="cc-stat cc-stat--sep">/</span>
          <span className="cc-stat">
            <span className="cc-stat__value">{channels.length}</span> total
          </span>
        </div>
      </header>

      {/* ── Disconnected banner ── */}
      {!connected && (
        <div className="cc-banner cc-banner--warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. Channel management requires an active gateway connection.
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="cc-banner cc-banner--error">
          <span>{error}</span>
          <button
            className="cc-banner__dismiss"
            onClick={() => setError(null)}
            type="button"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading ? (
        <div className="cc-loading">
          <div className="cc-spinner" />
          <span>Loading channels...</span>
        </div>
      ) : (
        <>
          {/* ── Channel grid ── */}
          <div className="cc-grid">
            {channels.map((ch) => {
              const isConnected = ch.status === 'connected';
              const isConnecting = ch.status === 'connecting';
              const isUnconfigured = ch.status === 'unconfigured';
              const statusColor = STATUS_COLORS[ch.status];

              return (
                <div
                  key={ch.type}
                  className={`cc-card ${isConnected ? 'cc-card--connected' : ''} ${isUnconfigured ? 'cc-card--unconfigured' : ''}`}
                  onClick={() => setSelectedChannel(ch.type)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelectedChannel(ch.type); }}
                >
                  {/* Card header */}
                  <div className="cc-card__header">
                    <span className="cc-card__icon">{ch.icon}</span>
                    <div className="cc-card__title-group">
                      <span className="cc-card__name">{ch.label}</span>
                      <span className="cc-card__subtitle">{ch.subtitle}</span>
                    </div>
                  </div>

                  {/* Status row */}
                  <div className="cc-card__status-row">
                    <span className="cc-card__status" style={{ color: statusColor }}>
                      <span className="cc-card__status-dot" style={{ background: statusColor }} />
                      {ch.status === 'connected' && 'Connected'}
                      {ch.status === 'disconnected' && 'Disconnected'}
                      {ch.status === 'connecting' && 'Connecting'}
                      {ch.status === 'error' && 'Error'}
                      {ch.status === 'unconfigured' && 'Not configured'}
                    </span>
                    {ch.activeSessions > 0 && (
                      <span className="cc-card__sessions">
                        {ch.activeSessions} active session{ch.activeSessions !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="cc-card__actions" onClick={(e) => e.stopPropagation()}>
                    {isConnected || isConnecting ? (
                      <button
                        className="cc-action-btn cc-action-btn--disconnect"
                        onClick={() => disconnectChannel(ch.type)}
                        disabled={actionLoading === ch.type || !connected}
                        type="button"
                      >
                        {actionLoading === ch.type ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    ) : isUnconfigured ? (
                      <button
                        className="cc-action-btn cc-action-btn--setup"
                        onClick={() => onNavigateToSetup?.(ch.type)}
                        type="button"
                      >
                        Setup
                      </button>
                    ) : (
                      <button
                        className="cc-action-btn cc-action-btn--connect"
                        onClick={() => connectChannel(ch.type)}
                        disabled={actionLoading === ch.type || !connected}
                        type="button"
                      >
                        {actionLoading === ch.type ? 'Connecting...' : 'Connect'}
                      </button>
                    )}
                    <button
                      className="cc-action-btn cc-action-btn--configure"
                      onClick={() => setSelectedChannel(ch.type)}
                      type="button"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Add Channel button ── */}
          <div className="cc-add-section">
            <button
              className="cc-add-btn"
              onClick={() => setShowAddSelector(!showAddSelector)}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add Channel
            </button>

            {showAddSelector && (
              <div className="cc-add-selector">
                {ALL_CHANNEL_TYPES.map((type) => {
                  const meta = CHANNEL_META[type];
                  const alreadyExists = channels.some(
                    (ch) => ch.type === type && ch.status !== 'unconfigured',
                  );
                  return (
                    <button
                      key={type}
                      className={`cc-add-option ${alreadyExists ? 'cc-add-option--exists' : ''}`}
                      onClick={() => {
                        setShowAddSelector(false);
                        if (alreadyExists) {
                          setSelectedChannel(type);
                        } else {
                          onNavigateToSetup?.(type);
                        }
                      }}
                      type="button"
                    >
                      <span className="cc-add-option__icon">{meta.icon}</span>
                      <span className="cc-add-option__label">{meta.label}</span>
                      {alreadyExists && (
                        <span className="cc-add-option__badge">Configured</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ChannelCenter;

/* ═══════════════════════════════════════════
   Scoped styles (cc- prefix)
   ═══════════════════════════════════════════ */

const channelCenterStyles = `
/* ── Root ── */
.cc-root {
  width: 100%;
}

/* ── Header ── */
.cc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.cc-header__text {
  flex: 1;
  min-width: 0;
}

.cc-header__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
}

.cc-header__subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
}

.cc-header__stats {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  padding: 0.5rem 0.875rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
}

.cc-stat {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
}

.cc-stat--sep {
  color: var(--text-tertiary, #606080);
}

.cc-stat__value {
  font-weight: 700;
  color: var(--text-primary, #fff);
}

/* ── Banner ── */
.cc-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

.cc-banner--warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

.cc-banner--error {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  justify-content: space-between;
}

.cc-banner__dismiss {
  background: none;
  border: none;
  color: #fca5a5;
  cursor: pointer;
  font-size: 1rem;
  padding: 0 0.25rem;
  opacity: 0.7;
  transition: opacity 0.1s ease;
}

.cc-banner__dismiss:hover {
  opacity: 1;
}

/* ── Loading ── */
.cc-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-tertiary, #606080);
}

.cc-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: cc-spin 0.8s linear infinite;
}

@keyframes cc-spin {
  to { transform: rotate(360deg); }
}

/* ── Grid ── */
.cc-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

@media (max-width: 700px) {
  .cc-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Card ── */
.cc-card {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cc-card:hover {
  border-color: rgba(255,255,255,0.15);
  box-shadow: 0 4px 20px rgba(0,0,0,0.2), 0 0 0 1px rgba(99,102,241,0.1);
  transform: translateY(-1px);
}

.cc-card:focus-visible {
  outline: 2px solid var(--accent-color, #6366f1);
  outline-offset: 2px;
}

.cc-card--connected {
  border-color: rgba(16, 185, 129, 0.25);
}

.cc-card--connected:hover {
  border-color: rgba(16, 185, 129, 0.4);
}

.cc-card--unconfigured {
  opacity: 0.65;
}

.cc-card--unconfigured:hover {
  opacity: 1;
}

/* Card header */
.cc-card__header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.cc-card__icon {
  font-size: 1.75rem;
  line-height: 1;
  flex-shrink: 0;
}

.cc-card__title-group {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.cc-card__name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cc-card__subtitle {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

/* Status row */
.cc-card__status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.cc-card__status {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.cc-card__status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cc-card__sessions {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

/* Card actions */
.cc-card__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
}

.cc-action-btn {
  flex: 1;
  padding: 0.4375rem 0.75rem;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.cc-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cc-action-btn--connect {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  color: #fff;
}

.cc-action-btn--connect:hover:not(:disabled) {
  background: #5558e6;
}

.cc-action-btn--disconnect {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.25);
  color: #f87171;
}

.cc-action-btn--disconnect:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
}

.cc-action-btn--setup {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

.cc-action-btn--setup:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.2);
}

.cc-action-btn--configure {
  background: var(--bg-primary, #0a0a1a);
  color: var(--text-secondary, #a0a0c0);
}

.cc-action-btn--configure:hover {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary, #fff);
}

/* ── Add Channel section ── */
.cc-add-section {
  position: relative;
}

.cc-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.125rem;
  background: var(--bg-secondary, #111127);
  border: 1px dashed rgba(255,255,255,0.15);
  border-radius: 8px;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cc-add-btn:hover {
  border-color: var(--accent-color, #6366f1);
  color: var(--text-primary, #fff);
  background: rgba(99, 102, 241, 0.06);
}

/* Add selector dropdown */
.cc-add-selector {
  position: absolute;
  top: calc(100% + 0.375rem);
  left: 0;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 220px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.4);
  z-index: 10;
  animation: cc-dropdown-in 0.15s ease;
}

@keyframes cc-dropdown-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cc-add-option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s ease;
  text-align: left;
  width: 100%;
}

.cc-add-option:hover {
  background: rgba(255,255,255,0.06);
}

.cc-add-option--exists {
  opacity: 0.7;
}

.cc-add-option__icon {
  font-size: 1.25rem;
  line-height: 1;
  flex-shrink: 0;
}

.cc-add-option__label {
  flex: 1;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.cc-add-option__badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}
`;
