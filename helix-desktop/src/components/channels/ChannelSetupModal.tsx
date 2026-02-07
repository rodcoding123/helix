/**
 * Channel Setup Modal Component
 *
 * Shared modal for channel configuration across the app.
 * Supports all auth types: QR, bot token, OAuth, API key, credentials, and webhooks.
 */

import { useState, useCallback } from 'react';
import '../onboarding/steps/ChannelsStep.css'; // Reuse styling

export type AuthType = 'qr' | 'bot-token' | 'oauth' | 'api-key' | 'credentials' | 'webhook' | 'native';

export interface ChannelConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  authType: AuthType;
  authHint?: string;
  category: 'builtin' | 'plugin' | 'native';
  platform?: 'all' | 'macos' | 'windows' | 'linux';
  features?: string[];
  comingSoon?: boolean;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface ChannelSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: ChannelConfig;
  onSave?: (config: Record<string, unknown>) => void;
}

interface SetupConfig extends Record<string, unknown> {
  token?: string;
  apiKey?: string;
  serverUrl?: string;
  phone?: string;
  homeserver?: string;
  accessToken?: string;
  nsec?: string;
  relays?: string;
  webhookUrl?: string;
}

export function ChannelSetupModal({
  isOpen,
  onClose,
  channel,
  onSave,
}: ChannelSetupModalProps) {
  const [config, setConfig] = useState<SetupConfig>({});

  const handleSave = useCallback(() => {
    onSave?.(config as Record<string, unknown>);
    onClose();
  }, [config, onClose, onSave]);

  if (!isOpen) return null;

  return (
    <div className="channel-setup-overlay">
      <div className="channel-setup-modal">
        <button className="close-button" onClick={onClose}>×</button>

        <div className="setup-header">
          <span className="setup-icon">{channel.icon}</span>
          <h3>Configure {channel.name}</h3>
        </div>

        {channel.authHint && <p className="setup-hint">{channel.authHint}</p>}

        {/* QR Setup */}
        {channel.authType === 'qr' && (
          <div className="qr-setup">
            <div className="qr-placeholder">
              <span>📱</span>
              <p>QR Code will appear here</p>
              <p className="qr-hint">Start the gateway to generate QR code</p>
            </div>
            <p className="setup-note">
              Open {channel.name} on your phone → Settings → Linked Devices → Link a Device
            </p>
          </div>
        )}

        {/* Bot Token Setup */}
        {channel.authType === 'bot-token' && (
          <div className="token-setup">
            <label>
              Bot Token
              <input
                type="password"
                placeholder={`Enter your ${channel.name} bot token`}
                value={config.token || ''}
                onChange={(e) => setConfig({ ...config, token: e.target.value })}
              />
            </label>
            {channel.id === 'telegram' && (
              <p className="setup-note">
                Create a bot with <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">@BotFather</a> on Telegram
              </p>
            )}
            {channel.id === 'discord' && (
              <p className="setup-note">
                Create an application at <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">Discord Developer Portal</a>
              </p>
            )}
            {channel.id === 'mattermost' && (
              <p className="setup-note">
                Create a bot account in Mattermost Admin Console
              </p>
            )}
          </div>
        )}

        {/* OAuth Setup */}
        {channel.authType === 'oauth' && (
          <div className="oauth-setup">
            <button className="oauth-button">
              <span>🔐</span>
              Connect with {channel.name}
            </button>
            <p className="setup-note">
              You'll be redirected to {channel.name} to authorize access
            </p>
          </div>
        )}

        {/* API Key Setup */}
        {channel.authType === 'api-key' && (
          <div className="apikey-setup">
            <label>
              API Key
              <input
                type="password"
                placeholder={`Enter your ${channel.name} API key`}
                value={config.apiKey || ''}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              />
            </label>
            {channel.id === 'bluebubbles' && (
              <>
                <label>
                  Server URL
                  <input
                    type="url"
                    placeholder="http://192.168.1.x:1234"
                    value={config.serverUrl || ''}
                    onChange={(e) => setConfig({ ...config, serverUrl: e.target.value })}
                  />
                </label>
                <p className="setup-note">
                  Get these from your BlueBubbles server dashboard
                </p>
              </>
            )}
            {channel.id === 'line' && (
              <p className="setup-note">
                Get credentials from LINE Developers Console
              </p>
            )}
          </div>
        )}

        {/* Credentials Setup */}
        {channel.authType === 'credentials' && (
          <div className="credentials-setup">
            {channel.id === 'signal' && (
              <>
                <label>
                  Phone Number
                  <input
                    type="tel"
                    placeholder="+1234567890"
                    value={config.phone || ''}
                    onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                  />
                </label>
                <p className="setup-note">
                  Requires <a href="https://github.com/AsamK/signal-cli" target="_blank" rel="noopener noreferrer">signal-cli</a> to be installed
                </p>
              </>
            )}
            {channel.id === 'matrix' && (
              <>
                <label>
                  Homeserver URL
                  <input
                    type="url"
                    placeholder="https://matrix.org"
                    value={config.homeserver || ''}
                    onChange={(e) => setConfig({ ...config, homeserver: e.target.value })}
                  />
                </label>
                <label>
                  Access Token
                  <input
                    type="password"
                    placeholder="syt_..."
                    value={config.accessToken || ''}
                    onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                  />
                </label>
              </>
            )}
            {channel.id === 'nostr' && (
              <>
                <label>
                  Private Key (nsec)
                  <input
                    type="password"
                    placeholder="nsec1..."
                    value={config.nsec || ''}
                    onChange={(e) => setConfig({ ...config, nsec: e.target.value })}
                  />
                </label>
                <label>
                  Relays (comma-separated)
                  <input
                    type="text"
                    placeholder="wss://relay.damus.io, wss://nos.lol"
                    value={config.relays || ''}
                    onChange={(e) => setConfig({ ...config, relays: e.target.value })}
                  />
                </label>
              </>
            )}
          </div>
        )}

        {/* Webhook Setup */}
        {channel.authType === 'webhook' && (
          <div className="webhook-setup">
            <label>
              Webhook URL
              <input
                type="url"
                placeholder="https://chat.googleapis.com/v1/spaces/..."
                value={config.webhookUrl || ''}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              />
            </label>
            <p className="setup-note">
              Create a webhook in your {channel.name} settings
            </p>
          </div>
        )}

        {/* Features */}
        {channel.features && (
          <div className="channel-features">
            <span className="features-label">Features:</span>
            {channel.features.map((f) => (
              <span key={f} className="feature-tag">
                {f}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="setup-actions">
          <button className="secondary-button" onClick={onClose}>
            Configure Later
          </button>
          <button className="primary-button" onClick={handleSave}>
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
