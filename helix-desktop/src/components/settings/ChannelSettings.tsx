import { useState } from 'react';
import { useConfigStore } from '../../stores/configStore';

interface Channel {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  connected: boolean;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  description: string;
}

const CHANNELS: Channel[] = [
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    enabled: false,
    connected: false,
    status: 'disconnected',
    description: 'Chat with Helix through Discord bot',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    enabled: false,
    connected: false,
    status: 'disconnected',
    description: 'Chat with Helix via Telegram bot',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💼',
    enabled: false,
    connected: false,
    status: 'disconnected',
    description: 'Integrate Helix with your Slack workspace',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '💬',
    enabled: false,
    connected: false,
    status: 'disconnected',
    description: 'Chat with Helix through WhatsApp',
  },
];

export function ChannelSettings() {
  const { config, updateConfig } = useConfigStore();
  const [channels, setChannels] = useState<Channel[]>(CHANNELS);
  const [connectingChannel, setConnectingChannel] = useState<string | null>(null);

  const handleToggleChannel = (channelId: string) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId ? { ...ch, enabled: !ch.enabled } : ch
      )
    );

    // Update config
    updateConfig('channels', {
      [channelId]: { enabled: !channels.find((c) => c.id === channelId)?.enabled },
    });
  };

  const handleConnect = async (channelId: string) => {
    setConnectingChannel(channelId);

    // Update status to connecting
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId ? { ...ch, status: 'connecting' } : ch
      )
    );

    // Simulate connection (replace with actual auth flow)
    setTimeout(() => {
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === channelId
            ? { ...ch, connected: true, status: 'connected' }
            : ch
        )
      );
      setConnectingChannel(null);
    }, 2000);
  };

  const handleDisconnect = (channelId: string) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId
          ? { ...ch, connected: false, status: 'disconnected' }
          : ch
      )
    );
  };

  const getStatusColor = (status: Channel['status']) => {
    switch (status) {
      case 'connected':
        return 'var(--color-success)';
      case 'connecting':
        return 'var(--color-warning)';
      case 'error':
        return 'var(--color-error)';
      default:
        return 'var(--color-text-secondary)';
    }
  };

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Messaging Channels</h1>
        <p>Connect Helix to your favorite messaging platforms</p>
      </header>

      <div className="settings-group">
        <h3>Available Channels</h3>

        {channels.map((channel) => (
          <div key={channel.id} className="settings-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>{channel.icon}</span>
                <div className="settings-item-info" style={{ margin: 0 }}>
                  <div className="settings-item-label">{channel.name}</div>
                  <div className="settings-item-description">{channel.description}</div>
                </div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={channel.enabled}
                  onChange={() => handleToggleChannel(channel.id)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {channel.enabled && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: getStatusColor(channel.status),
                    }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {channel.status === 'connected' && 'Connected'}
                    {channel.status === 'disconnected' && 'Not connected'}
                    {channel.status === 'connecting' && 'Connecting...'}
                    {channel.status === 'error' && 'Connection error'}
                  </span>
                </div>

                {channel.connected ? (
                  <button
                    className="settings-button secondary"
                    onClick={() => handleDisconnect(channel.id)}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    className="settings-button primary"
                    onClick={() => handleConnect(channel.id)}
                    disabled={connectingChannel === channel.id}
                  >
                    {connectingChannel === channel.id ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="settings-group">
        <h3>Integration Settings</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Auto-respond</div>
            <div className="settings-item-description">
              Automatically respond to messages when Helix is running
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.channels?.autoRespond ?? true}
              onChange={(e) => updateConfig('channels', { autoRespond: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Notification sound</div>
            <div className="settings-item-description">
              Play a sound when receiving messages from channels
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.channels?.notificationSound ?? true}
              onChange={(e) => updateConfig('channels', { notificationSound: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>
    </div>
  );
}
