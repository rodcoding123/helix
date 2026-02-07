/**
 * Channel Configuration Center
 *
 * Main hub for managing channels with overview, configuration, and monitoring.
 */

import { useState, useEffect, useCallback } from 'react';
import { getGatewayClient } from '../../lib/gateway-client';
import { ChannelDetail } from './ChannelDetail';

interface ChannelInfo {
  id: string;
  name: string;
  icon: string;
  color?: string;
  enabled: boolean;
  connected: boolean;
  accounts: number;
}

const CHANNEL_METADATA: Record<string, { name: string; icon: string; color: string }> = {
  whatsapp: { name: 'WhatsApp', icon: '💬', color: '#25D366' },
  telegram: { name: 'Telegram', icon: '✈️', color: '#0088cc' },
  discord: { name: 'Discord', icon: '🎮', color: '#5865F2' },
  signal: { name: 'Signal', icon: '🔐', color: '#3A76F0' },
  imessage: { name: 'iMessage', icon: '💌', color: '#00B4EB' },
  slack: { name: 'Slack', icon: '⚡', color: '#E01E5A' },
  teams: { name: 'Teams', icon: '👥', color: '#6264A7' },
  line: { name: 'LINE', icon: '📱', color: '#00B900' },
};

export function ChannelCenter() {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      const result = await client.request('channels.status', {}) as {
        channels?: Record<string, { enabled: boolean; connected: boolean; accounts?: unknown[] }>;
      };
      const channels: ChannelInfo[] = Object.entries(result.channels || {}).map(([id, config]) => {
        const meta = CHANNEL_METADATA[id] || { name: id, icon: '📱', color: '#999999' };
        return {
          id,
          ...meta,
          enabled: config.enabled,
          connected: config.connected,
          accounts: (config.accounts as unknown[] | undefined)?.length || 1,
        };
      });

      setChannels(channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const filteredChannels = channels.filter(
    (ch) =>
      ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedChannel) {
    return (
      <ChannelDetail
        channelId={selectedChannel.id}
        channelName={selectedChannel.name}
        onClose={() => setSelectedChannel(null)}
      />
    );
  }

  if (loading) return <div className="loading">Loading channels...</div>;

  return (
    <div className="channel-center">
      <div className="center-header">
        <h2>Channel Configuration</h2>
        <input
          type="text"
          placeholder="Search channels..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="channels-grid">
        {filteredChannels.length === 0 ? (
          <div className="empty-state">
            <p>No channels found</p>
          </div>
        ) : (
          filteredChannels.map((channel) => (
            <div
              key={channel.id}
              className={`channel-card ${channel.enabled ? 'enabled' : 'disabled'}`}
            >
              <div className="card-header">
                <span className="channel-icon">{channel.icon}</span>
                <span className="channel-name">{channel.name}</span>
                <span className={`status-indicator ${channel.connected ? 'connected' : 'disconnected'}`}>
                  {channel.connected ? '🟢' : '⚫'}
                </span>
              </div>

              <div className="card-details">
                <div className="detail-row">
                  <span className="label">Status:</span>
                  <span className="value">
                    {channel.enabled ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Accounts:</span>
                  <span className="value">{channel.accounts}</span>
                </div>
              </div>

              <div className="card-actions">
                <button
                  onClick={() => setSelectedChannel(channel)}
                  className="btn-primary btn-sm"
                >
                  Configure
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="center-info">
        <div className="info-section">
          <h3>Quick Stats</h3>
          <div className="stats">
            <div className="stat">
              <span className="label">Total Channels:</span>
              <span className="value">{channels.length}</span>
            </div>
            <div className="stat">
              <span className="label">Connected:</span>
              <span className="value">{channels.filter((c) => c.connected).length}</span>
            </div>
            <div className="stat">
              <span className="label">Enabled:</span>
              <span className="value">{channels.filter((c) => c.enabled).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
