/**
 * Channels Settings - Manage messaging platform connections
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { ChannelSetupModal } from '../channels';
import type { ChannelConfig } from '../channels';
import './SettingsSection.css';

interface ChannelStatus {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  accountId?: string;
  lastActivity?: string;
  messageCount?: number;
}

// Channel configuration templates
const CHANNEL_CONFIGS: Record<string, ChannelConfig> = {
  whatsapp: {
    id: 'whatsapp',
    enabled: false,
    name: 'WhatsApp',
    icon: '💬',
    description: 'Personal and business messaging with QR code pairing',
    authType: 'qr',
    authHint: 'Scan QR code with WhatsApp on your phone',
    category: 'builtin',
    features: ['Groups', 'Media', 'Reactions', 'Voice messages'],
  },
  telegram: {
    id: 'telegram',
    enabled: false,
    name: 'Telegram',
    icon: '✈️',
    description: 'Bot API with groups, topics, and inline mode',
    authType: 'bot-token',
    authHint: 'Get your bot token from @BotFather',
    category: 'builtin',
    features: ['Groups', 'Topics', 'Inline mode', 'Webhooks'],
  },
  discord: {
    id: 'discord',
    enabled: false,
    name: 'Discord',
    icon: '🎮',
    description: 'Servers, channels, threads, and DMs',
    authType: 'bot-token',
    authHint: 'Create a bot at discord.com/developers',
    category: 'builtin',
    features: ['Servers', 'Threads', 'Slash commands', 'Voice'],
  },
  slack: {
    id: 'slack',
    enabled: false,
    name: 'Slack',
    icon: '📊',
    description: 'Workspace apps with channels and DMs',
    authType: 'oauth',
    authHint: 'Install via Slack App Directory or custom app',
    category: 'builtin',
    features: ['Channels', 'DMs', 'Threads', 'Slash commands'],
  },
  'google-chat': {
    id: 'google-chat',
    enabled: false,
    name: 'Google Chat',
    icon: '🔷',
    description: 'Google Workspace chat integration',
    authType: 'webhook',
    authHint: 'Configure webhook in Google Chat space settings',
    category: 'builtin',
    features: ['Spaces', 'DMs', 'Cards', 'Dialogs'],
  },
};

export function ChannelsSettings() {
  const { getClient } = useGateway();
  const [channels, setChannels] = useState<ChannelStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<ChannelConfig | null>(null);

  useEffect(() => {
    loadChannelStatus();
  }, []);

  const loadChannelStatus = async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      return;
    }

    try {
      const result = await client.request('channels.status') as { channels: ChannelStatus[] };
      setChannels(result.channels || []);
    } catch (err) {
      console.error('Failed to load channel status:', err);
      // Mock data for display
      setChannels([
        { id: 'whatsapp', name: 'WhatsApp', icon: '💬', connected: false },
        { id: 'telegram', name: 'Telegram', icon: '✈️', connected: false },
        { id: 'discord', name: 'Discord', icon: '🎮', connected: false },
        { id: 'slack', name: 'Slack', icon: '📊', connected: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (channelId: string) => {
    const config = CHANNEL_CONFIGS[channelId];
    if (config) {
      setSelectedChannel(config);
      setSetupModalOpen(true);
    }
  };

  const handleModalSave = async (config: Record<string, unknown>) => {
    if (!selectedChannel) return;

    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('channels.login', {
        channelId: selectedChannel.id,
        config,
      });
      setSetupModalOpen(false);
      setSelectedChannel(null);
      loadChannelStatus();
    } catch (err) {
      console.error('Failed to configure channel:', err);
    }
  };

  const handleDisconnect = async (channelId: string) => {
    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('channels.logout', { channelId });
      loadChannelStatus();
    } catch (err) {
      console.error('Failed to disconnect channel:', err);
    }
  };

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Channels</h1>
        <p className="settings-section-description">
          Connect messaging platforms to communicate through Helix.
        </p>
      </header>

      {loading ? (
        <div className="settings-loading">Loading channels...</div>
      ) : (
        <div className="settings-cards">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`settings-card channel-card ${channel.connected ? 'connected' : ''}`}
            >
              <div className="channel-header">
                <span className="channel-icon">{channel.icon}</span>
                <div className="channel-info">
                  <span className="channel-name">{channel.name}</span>
                  <span className={`channel-status ${channel.connected ? 'online' : 'offline'}`}>
                    {channel.connected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>

              {channel.connected && (
                <div className="channel-details">
                  {channel.accountId && (
                    <div className="channel-detail">
                      <span className="label">Account:</span>
                      <span className="value">{channel.accountId}</span>
                    </div>
                  )}
                  {channel.messageCount !== undefined && (
                    <div className="channel-detail">
                      <span className="label">Messages:</span>
                      <span className="value">{channel.messageCount.toLocaleString()}</span>
                    </div>
                  )}
                  {channel.lastActivity && (
                    <div className="channel-detail">
                      <span className="label">Last activity:</span>
                      <span className="value">{channel.lastActivity}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="channel-actions">
                {channel.connected ? (
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => handleDisconnect(channel.id)}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => handleConnect(channel.id)}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="settings-group">
        <h2>Channel Settings</h2>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">Default Activation</span>
            <span className="settings-item-description">
              How Helix responds in group chats
            </span>
          </div>
          <select className="settings-select">
            <option value="mention">On mention only</option>
            <option value="always">Always respond</option>
            <option value="never">Never (DMs only)</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">Allow List</span>
            <span className="settings-item-description">
              Only respond to specific users or groups
            </span>
          </div>
          <button className="btn-secondary btn-sm">Configure</button>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">Message Types</span>
            <span className="settings-item-description">
              Which message types trigger responses
            </span>
          </div>
          <button className="btn-secondary btn-sm">Configure</button>
        </div>
      </section>

      {/* Channel Setup Modal */}
      {selectedChannel && (
        <ChannelSetupModal
          isOpen={setupModalOpen}
          onClose={() => setSetupModalOpen(false)}
          channel={selectedChannel}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
