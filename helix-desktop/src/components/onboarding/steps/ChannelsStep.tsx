/**
 * Channels Step - Configure messaging platform integrations
 * Supports 20+ channels from OpenClaw with per-channel setup flows
 */

import { useState, useCallback } from 'react';
import type { OnboardingState } from '../Onboarding';
import './ChannelsStep.css';

interface ChannelsStepProps {
  state: OnboardingState;
  onUpdate: (updates: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

type AuthType = 'qr' | 'bot-token' | 'oauth' | 'api-key' | 'credentials' | 'webhook' | 'native';

interface ChannelConfig {
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
}

// All OpenClaw channels organized by category
const CHANNELS: ChannelConfig[] = [
  // === BUILT-IN CHANNELS ===
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '💬',
    description: 'Personal and business messaging with QR code pairing',
    authType: 'qr',
    authHint: 'Scan QR code with WhatsApp on your phone',
    category: 'builtin',
    features: ['Groups', 'Media', 'Reactions', 'Voice messages'],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    description: 'Bot API with groups, topics, and inline mode',
    authType: 'bot-token',
    authHint: 'Get your bot token from @BotFather',
    category: 'builtin',
    features: ['Groups', 'Topics', 'Inline mode', 'Webhooks'],
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    description: 'Servers, channels, threads, and DMs',
    authType: 'bot-token',
    authHint: 'Create a bot at discord.com/developers',
    category: 'builtin',
    features: ['Servers', 'Threads', 'Slash commands', 'Voice'],
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '📊',
    description: 'Workspace apps with channels and DMs',
    authType: 'oauth',
    authHint: 'Install via Slack App Directory or custom app',
    category: 'builtin',
    features: ['Channels', 'DMs', 'Threads', 'Slash commands'],
  },
  {
    id: 'google-chat',
    name: 'Google Chat',
    icon: '🔷',
    description: 'Google Workspace chat integration',
    authType: 'webhook',
    authHint: 'Configure webhook in Google Chat space settings',
    category: 'builtin',
    features: ['Spaces', 'DMs', 'Cards', 'Dialogs'],
  },
  {
    id: 'signal',
    name: 'Signal',
    icon: '🔒',
    description: 'Privacy-focused encrypted messaging',
    authType: 'credentials',
    authHint: 'Requires signal-cli setup with phone number',
    category: 'builtin',
    features: ['E2E encryption', 'Groups', 'Disappearing messages'],
  },
  {
    id: 'imessage',
    name: 'iMessage',
    icon: '🍎',
    description: 'Native macOS Messages integration',
    authType: 'native',
    authHint: 'Requires macOS with Messages app signed in',
    category: 'native',
    platform: 'macos',
    features: ['iMessage', 'SMS', 'Tapbacks', 'Effects'],
  },
  {
    id: 'bluebubbles',
    name: 'BlueBubbles',
    icon: '💙',
    description: 'iMessage via BlueBubbles server (cross-platform)',
    authType: 'api-key',
    authHint: 'Connect to your BlueBubbles server',
    category: 'builtin',
    features: ['iMessage', 'SMS', 'Read receipts', 'Typing'],
  },

  // === PLUGIN-BASED CHANNELS ===
  {
    id: 'mattermost',
    name: 'Mattermost',
    icon: '🔵',
    description: 'Self-hosted team collaboration',
    authType: 'bot-token',
    authHint: 'Create bot account in Mattermost settings',
    category: 'plugin',
    features: ['Channels', 'DMs', 'Threads'],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    icon: '🟣',
    description: 'Enterprise chat and collaboration',
    authType: 'oauth',
    authHint: 'Register app in Azure AD',
    category: 'plugin',
    features: ['Teams', 'Channels', 'Meetings'],
  },
  {
    id: 'line',
    name: 'LINE',
    icon: '🟢',
    description: 'Popular messaging in Japan and Asia',
    authType: 'api-key',
    authHint: 'Get credentials from LINE Developers Console',
    category: 'plugin',
    features: ['Groups', 'Stickers', 'Rich menus'],
  },
  {
    id: 'matrix',
    name: 'Matrix',
    icon: '🌐',
    description: 'Decentralized federation protocol',
    authType: 'credentials',
    authHint: 'Connect to any Matrix homeserver',
    category: 'plugin',
    features: ['E2E encryption', 'Bridges', 'Spaces'],
  },
  {
    id: 'nextcloud-talk',
    name: 'Nextcloud Talk',
    icon: '☁️',
    description: 'Self-hosted Nextcloud chat',
    authType: 'api-key',
    authHint: 'Generate app password in Nextcloud',
    category: 'plugin',
    features: ['Conversations', 'Calls', 'File sharing'],
  },
  {
    id: 'nostr',
    name: 'Nostr',
    icon: '🟡',
    description: 'Decentralized social protocol DMs',
    authType: 'credentials',
    authHint: 'Enter your Nostr private key (nsec)',
    category: 'plugin',
    features: ['DMs (NIP-04)', 'Relays', 'Zaps'],
  },
  {
    id: 'twitch',
    name: 'Twitch',
    icon: '🟣',
    description: 'Twitch chat via IRC',
    authType: 'oauth',
    authHint: 'Authorize via Twitch OAuth',
    category: 'plugin',
    features: ['Chat', 'Commands', 'Bits', 'Subs'],
  },
  {
    id: 'zalo',
    name: 'Zalo',
    icon: '🔵',
    description: 'Popular messenger in Vietnam',
    authType: 'qr',
    authHint: 'Scan QR code with Zalo app',
    category: 'plugin',
    features: ['Messages', 'Groups', 'Stickers'],
  },
  {
    id: 'tlon',
    name: 'Tlon (Urbit)',
    icon: '⚫',
    description: 'Urbit-based decentralized messaging',
    authType: 'credentials',
    authHint: 'Connect to your Urbit ship',
    category: 'plugin',
    features: ['Groups', 'DMs', 'Notebooks'],
    comingSoon: true,
  },
];

// Group channels by category
const CHANNEL_CATEGORIES = {
  builtin: { label: 'Built-in Channels', hint: 'Ready to use, no plugins needed' },
  native: { label: 'Native Integrations', hint: 'Platform-specific features' },
  plugin: { label: 'Plugin Channels', hint: 'Install via plugin manager' },
};

interface ChannelSetupState {
  channelId: string;
  step: 'select' | 'configure' | 'verify';
  config: Record<string, string>;
}

export function ChannelsStep({ state, onUpdate, onNext, onBack, onSkip }: ChannelsStepProps) {
  const [enabledChannels, setEnabledChannels] = useState<Set<string>>(
    new Set(state.enabledChannels || [])
  );
  const [setupState, setSetupState] = useState<ChannelSetupState | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string>('builtin');

  const toggleChannel = useCallback((channelId: string) => {
    const channel = CHANNELS.find(c => c.id === channelId);
    if (channel?.comingSoon) return;

    setEnabledChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
        // Open setup for channels that need configuration
        if (channel && channel.authType !== 'native') {
          setSetupState({
            channelId,
            step: 'configure',
            config: {},
          });
        }
      }
      return next;
    });
  }, []);

  const closeSetup = useCallback(() => {
    setSetupState(null);
  }, []);

  const handleContinue = () => {
    onUpdate({ enabledChannels: Array.from(enabledChannels) });
    onNext();
  };

  const handleSkip = () => {
    onUpdate({ enabledChannels: [] });
    onSkip();
  };

  const getChannelsByCategory = (category: string) => {
    return CHANNELS.filter(c => c.category === category);
  };

  const getAuthTypeLabel = (authType: AuthType): string => {
    switch (authType) {
      case 'qr': return 'QR Code';
      case 'bot-token': return 'Bot Token';
      case 'oauth': return 'OAuth';
      case 'api-key': return 'API Key';
      case 'credentials': return 'Credentials';
      case 'webhook': return 'Webhook';
      case 'native': return 'Native';
      default: return authType;
    }
  };

  const renderChannelSetup = () => {
    if (!setupState) return null;

    const channel = CHANNELS.find(c => c.id === setupState.channelId);
    if (!channel) return null;

    return (
      <div className="channel-setup-overlay">
        <div className="channel-setup-modal">
          <button className="close-button" onClick={closeSetup}>×</button>

          <div className="setup-header">
            <span className="setup-icon">{channel.icon}</span>
            <h3>Configure {channel.name}</h3>
          </div>

          <p className="setup-hint">{channel.authHint}</p>

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

          {channel.authType === 'bot-token' && (
            <div className="token-setup">
              <label>
                Bot Token
                <input
                  type="password"
                  placeholder={`Enter your ${channel.name} bot token`}
                  value={setupState.config.token || ''}
                  onChange={(e) => setSetupState(prev => prev ? {
                    ...prev,
                    config: { ...prev.config, token: e.target.value }
                  } : null)}
                />
              </label>
              {channel.id === 'telegram' && (
                <p className="setup-note">
                  Create a bot with <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a> on Telegram
                </p>
              )}
              {channel.id === 'discord' && (
                <p className="setup-note">
                  Create an application at <a href="https://discord.com/developers/applications" target="_blank" rel="noopener">Discord Developer Portal</a>
                </p>
              )}
            </div>
          )}

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

          {channel.authType === 'api-key' && (
            <div className="apikey-setup">
              <label>
                API Key
                <input
                  type="password"
                  placeholder={`Enter your ${channel.name} API key`}
                  value={setupState.config.apiKey || ''}
                  onChange={(e) => setSetupState(prev => prev ? {
                    ...prev,
                    config: { ...prev.config, apiKey: e.target.value }
                  } : null)}
                />
              </label>
              {channel.id === 'bluebubbles' && (
                <>
                  <label>
                    Server URL
                    <input
                      type="url"
                      placeholder="http://192.168.1.x:1234"
                      value={setupState.config.serverUrl || ''}
                      onChange={(e) => setSetupState(prev => prev ? {
                        ...prev,
                        config: { ...prev.config, serverUrl: e.target.value }
                      } : null)}
                    />
                  </label>
                  <p className="setup-note">
                    Get these from your BlueBubbles server dashboard
                  </p>
                </>
              )}
            </div>
          )}

          {channel.authType === 'credentials' && (
            <div className="credentials-setup">
              {channel.id === 'signal' && (
                <>
                  <label>
                    Phone Number
                    <input
                      type="tel"
                      placeholder="+1234567890"
                      value={setupState.config.phone || ''}
                      onChange={(e) => setSetupState(prev => prev ? {
                        ...prev,
                        config: { ...prev.config, phone: e.target.value }
                      } : null)}
                    />
                  </label>
                  <p className="setup-note">
                    Requires <a href="https://github.com/AsamK/signal-cli" target="_blank" rel="noopener">signal-cli</a> to be installed
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
                      value={setupState.config.homeserver || ''}
                      onChange={(e) => setSetupState(prev => prev ? {
                        ...prev,
                        config: { ...prev.config, homeserver: e.target.value }
                      } : null)}
                    />
                  </label>
                  <label>
                    Access Token
                    <input
                      type="password"
                      placeholder="syt_..."
                      value={setupState.config.accessToken || ''}
                      onChange={(e) => setSetupState(prev => prev ? {
                        ...prev,
                        config: { ...prev.config, accessToken: e.target.value }
                      } : null)}
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
                      value={setupState.config.nsec || ''}
                      onChange={(e) => setSetupState(prev => prev ? {
                        ...prev,
                        config: { ...prev.config, nsec: e.target.value }
                      } : null)}
                    />
                  </label>
                  <label>
                    Relays (comma-separated)
                    <input
                      type="text"
                      placeholder="wss://relay.damus.io, wss://nos.lol"
                      value={setupState.config.relays || ''}
                      onChange={(e) => setSetupState(prev => prev ? {
                        ...prev,
                        config: { ...prev.config, relays: e.target.value }
                      } : null)}
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {channel.authType === 'webhook' && (
            <div className="webhook-setup">
              <label>
                Webhook URL
                <input
                  type="url"
                  placeholder="https://chat.googleapis.com/v1/spaces/..."
                  value={setupState.config.webhookUrl || ''}
                  onChange={(e) => setSetupState(prev => prev ? {
                    ...prev,
                    config: { ...prev.config, webhookUrl: e.target.value }
                  } : null)}
                />
              </label>
              <p className="setup-note">
                Create a webhook in your Google Chat space settings
              </p>
            </div>
          )}

          {channel.features && (
            <div className="channel-features">
              <span className="features-label">Features:</span>
              {channel.features.map(f => (
                <span key={f} className="feature-tag">{f}</span>
              ))}
            </div>
          )}

          <div className="setup-actions">
            <button className="secondary-button" onClick={closeSetup}>
              Configure Later
            </button>
            <button className="primary-button" onClick={closeSetup}>
              Save & Continue
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="onboarding-step channels-step-v2">
      <h1>Connect Your Channels</h1>
      <p className="step-description">
        Helix can communicate through 20+ messaging platforms. Select the channels
        you want to enable—you can always add more later.
      </p>

      <div className="channels-container">
        {Object.entries(CHANNEL_CATEGORIES).map(([categoryId, category]) => {
          const channels = getChannelsByCategory(categoryId);
          if (channels.length === 0) return null;

          return (
            <div key={categoryId} className={`channel-category ${expandedCategory === categoryId ? 'expanded' : ''}`}>
              <button
                className="category-header"
                onClick={() => setExpandedCategory(expandedCategory === categoryId ? '' : categoryId)}
              >
                <span className="category-label">{category.label}</span>
                <span className="category-hint">{category.hint}</span>
                <span className="category-count">
                  {channels.filter(c => enabledChannels.has(c.id)).length}/{channels.length}
                </span>
                <span className="expand-icon">{expandedCategory === categoryId ? '−' : '+'}</span>
              </button>

              {expandedCategory === categoryId && (
                <div className="category-channels">
                  {channels.map(channel => (
                    <button
                      key={channel.id}
                      className={`channel-card ${enabledChannels.has(channel.id) ? 'enabled' : ''} ${channel.comingSoon ? 'coming-soon' : ''}`}
                      onClick={() => toggleChannel(channel.id)}
                      disabled={channel.comingSoon}
                    >
                      <div className="channel-icon">{channel.icon}</div>
                      <div className="channel-info">
                        <div className="channel-name-row">
                          <span className="channel-name">{channel.name}</span>
                          <span className={`auth-badge ${channel.authType}`}>
                            {getAuthTypeLabel(channel.authType)}
                          </span>
                          {channel.platform && channel.platform !== 'all' && (
                            <span className="platform-badge">{channel.platform}</span>
                          )}
                          {channel.comingSoon && (
                            <span className="soon-badge">Soon</span>
                          )}
                        </div>
                        <p className="channel-description">{channel.description}</p>
                      </div>
                      <div className="channel-toggle">
                        <span className={`toggle-indicator ${enabledChannels.has(channel.id) ? 'on' : 'off'}`}>
                          {enabledChannels.has(channel.id) ? '✓' : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="selection-summary">
        {enabledChannels.size === 0 ? (
          <p>No channels selected. You can enable them later in Settings.</p>
        ) : (
          <p>
            <strong>{enabledChannels.size}</strong> channel{enabledChannels.size !== 1 ? 's' : ''} selected:
            {' '}
            {Array.from(enabledChannels).map(id => {
              const ch = CHANNELS.find(c => c.id === id);
              return ch ? `${ch.icon} ${ch.name}` : id;
            }).join(', ')}
          </p>
        )}
      </div>

      <div className="step-actions">
        <button className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <div className="action-group">
          <button className="btn-text" onClick={handleSkip}>
            Skip for now
          </button>
          <button className="btn-primary" onClick={handleContinue}>
            Continue
          </button>
        </div>
      </div>

      {renderChannelSetup()}
    </div>
  );
}

export { CHANNELS };
