/**
 * Channel Credentials - Configure credentials for communication channels
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './ChannelCredentials.css';

interface ChannelConfig {
  id: string;
  type: 'discord' | 'slack' | 'email' | 'telegram' | 'matrix' | 'custom';
  name: string;
  enabled: boolean;
  configured: boolean;
  credentials: Record<string, string>;
  lastVerified?: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
}

interface ChannelTemplate {
  type: ChannelConfig['type'];
  name: string;
  icon: string;
  description: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'password' | 'url';
    required: boolean;
    placeholder: string;
    hint?: string;
  }[];
}

const CHANNEL_TEMPLATES: ChannelTemplate[] = [
  {
    type: 'discord',
    name: 'Discord',
    icon: '💬',
    description: 'Connect to Discord for messaging and logging',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', required: true, placeholder: 'Your Discord bot token', hint: 'Get from Discord Developer Portal' },
      { key: 'webhookCommands', label: 'Commands Webhook', type: 'url', required: false, placeholder: 'https://discord.com/api/webhooks/...' },
      { key: 'webhookHeartbeat', label: 'Heartbeat Webhook', type: 'url', required: false, placeholder: 'https://discord.com/api/webhooks/...' },
      { key: 'webhookAlerts', label: 'Alerts Webhook', type: 'url', required: false, placeholder: 'https://discord.com/api/webhooks/...' },
      { key: 'webhookHashChain', label: 'Hash Chain Webhook', type: 'url', required: false, placeholder: 'https://discord.com/api/webhooks/...' },
    ],
  },
  {
    type: 'slack',
    name: 'Slack',
    icon: '📱',
    description: 'Connect to Slack workspaces',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', required: true, placeholder: 'xoxb-...', hint: 'Slack Bot User OAuth Token' },
      { key: 'appToken', label: 'App Token', type: 'password', required: false, placeholder: 'xapp-...', hint: 'For Socket Mode connections' },
      { key: 'signingSecret', label: 'Signing Secret', type: 'password', required: false, placeholder: 'Signing secret for verification' },
    ],
  },
  {
    type: 'email',
    name: 'Email (SMTP)',
    icon: '📧',
    description: 'Send and receive emails via SMTP/IMAP',
    fields: [
      { key: 'smtpHost', label: 'SMTP Host', type: 'text', required: true, placeholder: 'smtp.gmail.com' },
      { key: 'smtpPort', label: 'SMTP Port', type: 'text', required: true, placeholder: '587' },
      { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'your@email.com' },
      { key: 'password', label: 'Password', type: 'password', required: true, placeholder: 'App password or SMTP password' },
      { key: 'imapHost', label: 'IMAP Host', type: 'text', required: false, placeholder: 'imap.gmail.com' },
      { key: 'imapPort', label: 'IMAP Port', type: 'text', required: false, placeholder: '993' },
    ],
  },
  {
    type: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    description: 'Connect to Telegram via Bot API',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', required: true, placeholder: '123456789:ABC...', hint: 'Get from @BotFather' },
      { key: 'allowedUsers', label: 'Allowed User IDs', type: 'text', required: false, placeholder: '12345,67890', hint: 'Comma-separated user IDs' },
    ],
  },
  {
    type: 'matrix',
    name: 'Matrix',
    icon: '🔷',
    description: 'Connect to Matrix homeservers',
    fields: [
      { key: 'homeserver', label: 'Homeserver URL', type: 'url', required: true, placeholder: 'https://matrix.org' },
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true, placeholder: 'Your Matrix access token' },
      { key: 'userId', label: 'User ID', type: 'text', required: true, placeholder: '@bot:matrix.org' },
    ],
  },
  {
    type: 'custom',
    name: 'Custom Webhook',
    icon: '🔌',
    description: 'Configure a custom webhook endpoint',
    fields: [
      { key: 'url', label: 'Webhook URL', type: 'url', required: true, placeholder: 'https://...' },
      { key: 'secret', label: 'Signing Secret', type: 'password', required: false, placeholder: 'For payload verification' },
      { key: 'headers', label: 'Custom Headers', type: 'text', required: false, placeholder: 'key1:value1,key2:value2' },
    ],
  },
];

export function ChannelCredentials() {
  const { getClient } = useGateway();
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChannel, setEditingChannel] = useState<ChannelConfig | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('channels.list') as { channels: ChannelConfig[] };
        setChannels(result.channels || []);
      } catch (err) {
        console.error('Failed to load channels:', err);
      }
    } else {
      // Mock data
      setChannels([
        {
          id: '1',
          type: 'discord',
          name: 'Discord',
          enabled: true,
          configured: true,
          credentials: { botToken: '***', webhookCommands: 'https://discord.com/api/webhooks/...' },
          lastVerified: '2026-02-01 15:00',
          status: 'connected',
        },
      ]);
    }
    setLoading(false);
  };

  const openEditor = (channel?: ChannelConfig) => {
    if (channel) {
      setEditingChannel(channel);
      setCredentials({ ...channel.credentials });
    } else {
      setShowAddDialog(true);
    }
    setTestResult(null);
  };

  const selectChannelType = (type: ChannelConfig['type']) => {
    const template = CHANNEL_TEMPLATES.find(t => t.type === type);
    if (!template) return;

    const newChannel: ChannelConfig = {
      id: String(Date.now()),
      type,
      name: template.name,
      enabled: true,
      configured: false,
      credentials: {},
      status: 'pending',
    };

    setEditingChannel(newChannel);
    setCredentials({});
    setShowAddDialog(false);
  };

  const closeEditor = () => {
    setEditingChannel(null);
    setCredentials({});
    setTestResult(null);
  };

  const updateCredential = (key: string, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  };

  const testConnection = async () => {
    if (!editingChannel) return;

    setTesting(true);
    setTestResult(null);

    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('channels.test', {
          type: editingChannel.type,
          credentials,
        }) as { success: boolean; message: string };
        setTestResult(result);
      } catch (err) {
        setTestResult({ success: false, message: (err as Error).message });
      }
    } else {
      // Simulate test
      await new Promise(resolve => setTimeout(resolve, 1500));
      setTestResult({ success: true, message: 'Connection successful!' });
    }

    setTesting(false);
  };

  const saveChannel = async () => {
    if (!editingChannel) return;

    const template = CHANNEL_TEMPLATES.find(t => t.type === editingChannel.type);
    const requiredFields = template?.fields.filter(f => f.required) || [];
    const missingFields = requiredFields.filter(f => !credentials[f.key]?.trim());

    if (missingFields.length > 0) {
      setTestResult({
        success: false,
        message: `Missing required fields: ${missingFields.map(f => f.label).join(', ')}`,
      });
      return;
    }

    const channelData = {
      ...editingChannel,
      credentials,
      configured: true,
      status: 'pending' as const,
    };

    const client = getClient();

    const isNew = !channels.find(c => c.id === editingChannel.id);
    if (client?.connected) {
      try {
        if (isNew) {
          const result = await client.request('channels.add', channelData) as { channel: ChannelConfig };
          channelData.id = result.channel.id;
          (channelData as ChannelConfig).status = result.channel.status;
        } else {
          await client.request('channels.update', channelData);
        }
      } catch (err) {
        console.error('Failed to save channel:', err);
        return;
      }
    }

    if (isNew) {
      setChannels(prev => [...prev, channelData]);
    } else {
      setChannels(prev => prev.map(c => c.id === editingChannel.id ? channelData : c));
    }

    closeEditor();
  };

  const toggleChannel = async (id: string) => {
    const channel = channels.find(c => c.id === id);
    if (!channel) return;

    setChannels(prev => prev.map(c =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    ));

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('channels.update', { id, enabled: !channel.enabled });
      } catch (err) {
        console.error('Failed to toggle channel:', err);
        setChannels(prev => prev.map(c =>
          c.id === id ? { ...c, enabled: channel.enabled } : c
        ));
      }
    }
  };

  const deleteChannel = async (id: string) => {
    if (!confirm('Remove this channel configuration?')) return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('channels.delete', { id });
      } catch (err) {
        console.error('Failed to delete channel:', err);
        return;
      }
    }

    setChannels(prev => prev.filter(c => c.id !== id));
  };

  const getTemplate = (type: ChannelConfig['type']): ChannelTemplate | undefined => {
    return CHANNEL_TEMPLATES.find(t => t.type === type);
  };

  if (loading) {
    return <div className="channels-loading">Loading channels...</div>;
  }

  if (showAddDialog) {
    return (
      <div className="channels-add-dialog">
        <h3>Add Channel</h3>
        <p className="add-subtitle">Choose a channel type to configure</p>

        <div className="channel-types-grid">
          {CHANNEL_TEMPLATES.map(template => (
            <button
              key={template.type}
              className="channel-type-card"
              onClick={() => selectChannelType(template.type)}
            >
              <span className="type-icon">{template.icon}</span>
              <span className="type-name">{template.name}</span>
              <span className="type-description">{template.description}</span>
            </button>
          ))}
        </div>

        <div className="dialog-actions">
          <button className="btn-secondary" onClick={() => setShowAddDialog(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (editingChannel) {
    const template = getTemplate(editingChannel.type);

    return (
      <div className="channel-editor">
        <header className="editor-header">
          <span className="editor-icon">{template?.icon}</span>
          <div className="editor-title">
            <h3>{editingChannel.configured ? 'Edit' : 'Configure'} {template?.name}</h3>
            <p>{template?.description}</p>
          </div>
        </header>

        <div className="editor-fields">
          {template?.fields.map(field => (
            <div key={field.key} className="editor-field">
              <label>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              <input
                type={field.type}
                value={credentials[field.key] || ''}
                onChange={(e) => updateCredential(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
              {field.hint && <span className="field-hint">{field.hint}</span>}
            </div>
          ))}
        </div>

        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            <span className="result-icon">{testResult.success ? '✓' : '✗'}</span>
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="editor-actions">
          <button className="btn-secondary" onClick={closeEditor}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            onClick={testConnection}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button className="btn-primary" onClick={saveChannel}>
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="channel-credentials">
      <header className="channels-header">
        <div>
          <h2>Channels</h2>
          <p className="channels-subtitle">Configure communication channels</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => openEditor()}>
          + Add Channel
        </button>
      </header>

      {channels.length === 0 ? (
        <div className="channels-empty">
          <span className="empty-icon">📡</span>
          <p>No channels configured</p>
          <button className="btn-primary" onClick={() => openEditor()}>
            Add your first channel
          </button>
        </div>
      ) : (
        <div className="channels-list">
          {channels.map(channel => {
            const template = getTemplate(channel.type);
            return (
              <div key={channel.id} className={`channel-card ${channel.enabled ? 'enabled' : 'disabled'}`}>
                <div className="channel-header">
                  <div className="channel-info">
                    <span className="channel-icon">{template?.icon}</span>
                    <div className="channel-details">
                      <span className="channel-name">{channel.name}</span>
                      <span className={`channel-status status-${channel.status}`}>
                        <span className="status-dot" />
                        {channel.status}
                      </span>
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={channel.enabled}
                      onChange={() => toggleChannel(channel.id)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                {channel.lastVerified && (
                  <div className="channel-verified">
                    Last verified: {new Date(channel.lastVerified).toLocaleString()}
                  </div>
                )}

                <div className="channel-actions">
                  <button className="btn-sm btn-secondary" onClick={() => openEditor(channel)}>
                    Configure
                  </button>
                  <button className="btn-sm btn-danger" onClick={() => deleteChannel(channel.id)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
