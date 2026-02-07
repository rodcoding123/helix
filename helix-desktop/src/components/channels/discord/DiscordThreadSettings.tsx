/**
 * Discord Thread Settings
 *
 * Configure Discord thread auto-creation, rich embeds, and reactions:
 * - Auto-create threads from keywords
 * - Manage thread archival settings
 * - Rich embed customization
 * - Reaction-based workflows
 */

import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Tag, MessageSquare, Heart, Zap } from 'lucide-react';
import { getGatewayClient } from '../../../lib/gateway-client';

interface ChannelAccount {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface ThreadKeyword {
  id: string;
  keyword: string;
  enabled: boolean;
  autoArchiveMinutes?: number;
  rateLimitPerHour?: number;
}

export interface EmbedColor {
  name: string;
  value: string;
  preview: string;
}

interface DiscordThreadSettingsProps {
  account: ChannelAccount;
  channelId: string;
}

const EMBED_COLORS: EmbedColor[] = [
  { name: 'Default', value: '#000000', preview: '#000000' },
  { name: 'Aqua', value: '#1ABC9C', preview: '#1ABC9C' },
  { name: 'Green', value: '#2ECC71', preview: '#2ECC71' },
  { name: 'Blue', value: '#3498DB', preview: '#3498DB' },
  { name: 'Purple', value: '#9B59B6', preview: '#9B59B6' },
  { name: 'Red', value: '#E74C3C', preview: '#E74C3C' },
  { name: 'Orange', value: '#E67E22', preview: '#E67E22' },
  { name: 'Gold', value: '#F39C12', preview: '#F39C12' },
];

export function DiscordThreadSettings({
  account,
  channelId,
}: DiscordThreadSettingsProps) {
  const [keywords, setKeywords] = useState<ThreadKeyword[]>([]);
  const [embedColor, setEmbedColor] = useState('#3498DB');
  const [newKeyword, setNewKeyword] = useState('');
  const [autoArchiveMinutes, setAutoArchiveMinutes] = useState(60);
  const [rateLimitPerHour, setRateLimitPerHour] = useState(10);
  const [reactionWorkflows, setReactionWorkflows] = useState<
    Array<{ emoji: string; action: string }>
  >([]);
  const [newReaction, setNewReaction] = useState({ emoji: '👍', action: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load thread settings
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      const result = await client.request('channels.discord.threads.settings', {
        accountId: account.id,
      });

      if (result?.ok) {
        setKeywords(result.keywords || []);
        setEmbedColor(result.embedColor || '#3498DB');
        setReactionWorkflows(result.reactions || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  // Add thread keyword
  const handleAddKeyword = useCallback(async () => {
    if (!newKeyword.trim()) {
      setError('Keyword required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      const result = await client.request('channels.discord.threads.addKeyword', {
        accountId: account.id,
        keyword: newKeyword,
        autoArchiveMinutes,
        rateLimitPerHour,
      });

      if (result?.ok) {
        const newKw: ThreadKeyword = {
          id: result.keywordId,
          keyword: newKeyword,
          enabled: true,
          autoArchiveMinutes,
          rateLimitPerHour,
        };

        setKeywords(prev => [...prev, newKw]);
        setNewKeyword('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [newKeyword, autoArchiveMinutes, rateLimitPerHour, account.id]);

  // Delete keyword
  const handleDeleteKeyword = useCallback(async (keywordId: string) => {
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      await client.request('channels.discord.threads.deleteKeyword', {
        accountId: account.id,
        keywordId,
      });

      setKeywords(prev => prev.filter(k => k.id !== keywordId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  // Toggle keyword
  const handleToggleKeyword = useCallback(async (keywordId: string) => {
    const keyword = keywords.find(k => k.id === keywordId);
    if (!keyword) return;

    setLoading(true);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      await client.request('channels.discord.threads.updateKeyword', {
        accountId: account.id,
        keywordId,
        enabled: !keyword.enabled,
      });

      setKeywords(prev =>
        prev.map(k => (k.id === keywordId ? { ...k, enabled: !k.enabled } : k))
      );
    } catch (err) {
      console.error('[discord-threads] Failed to toggle keyword:', err);
    } finally {
      setLoading(false);
    }
  }, [keywords, account.id]);

  // Update embed color
  const handleUpdateEmbedColor = useCallback(async (color: string) => {
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      await client.request('channels.discord.embeds.updateColor', {
        accountId: account.id,
        color,
      });

      setEmbedColor(color);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  // Add reaction workflow
  const handleAddReaction = useCallback(async () => {
    if (!newReaction.emoji.trim() || !newReaction.action.trim()) {
      setError('Emoji and action required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      const result = await client.request('channels.discord.reactions.add', {
        accountId: account.id,
        emoji: newReaction.emoji,
        action: newReaction.action,
      });

      if (result?.ok) {
        setReactionWorkflows(prev => [
          ...prev,
          { emoji: newReaction.emoji, action: newReaction.action },
        ]);
        setNewReaction({ emoji: '👍', action: '' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [newReaction, account.id]);

  // Delete reaction
  const handleDeleteReaction = useCallback(async (emoji: string) => {
    setLoading(true);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      await client.request('channels.discord.reactions.delete', {
        accountId: account.id,
        emoji,
      });

      setReactionWorkflows(prev => prev.filter(r => r.emoji !== emoji));
    } catch (err) {
      console.error('[discord-reactions] Failed to delete:', err);
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="discord-thread-settings">
      <div className="settings-header">
        <h3>Thread & Embed Settings</h3>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="settings-content">
        {/* Thread Keywords Section */}
        <section className="settings-section">
          <div className="section-header">
            <MessageSquare size={18} />
            <h4>Auto-Create Threads</h4>
          </div>

          <p className="section-description">
            Automatically create threads when messages contain these keywords
          </p>

          <div className="keyword-input">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              placeholder="Enter keyword (e.g., bug, feature request)"
              disabled={loading}
            />
            <div className="input-settings">
              <div className="input-group">
                <label>Auto-archive</label>
                <select
                  value={autoArchiveMinutes}
                  onChange={e => setAutoArchiveMinutes(parseInt(e.target.value))}
                  disabled={loading}
                >
                  <option value={60}>1 hour</option>
                  <option value={1440}>1 day</option>
                  <option value={10080}>1 week</option>
                </select>
              </div>
              <div className="input-group">
                <label>Rate limit</label>
                <input
                  type="number"
                  value={rateLimitPerHour}
                  onChange={e => setRateLimitPerHour(parseInt(e.target.value))}
                  min={1}
                  max={100}
                  disabled={loading}
                />
                <span>/hour</span>
              </div>
              <button
                onClick={handleAddKeyword}
                disabled={loading}
                className="add-keyword-btn"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="keywords-list">
            {keywords.length === 0 ? (
              <div className="empty-list">
                <Tag size={24} />
                <p>No keywords configured yet</p>
              </div>
            ) : (
              keywords.map(keyword => (
                <div key={keyword.id} className="keyword-item">
                  <input
                    type="checkbox"
                    checked={keyword.enabled}
                    onChange={() => handleToggleKeyword(keyword.id)}
                    disabled={loading}
                  />
                  <div className="keyword-info">
                    <div className="keyword-text">{keyword.keyword}</div>
                    <div className="keyword-meta">
                      Archive: {keyword.autoArchiveMinutes}min • Limit:{' '}
                      {keyword.rateLimitPerHour}/hour
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteKeyword(keyword.id)}
                    className="delete-btn"
                    disabled={loading}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Embed Color Section */}
        <section className="settings-section">
          <div className="section-header">
            <Zap size={18} />
            <h4>Embed Color</h4>
          </div>

          <p className="section-description">
            Default color for rich embeds sent to Discord
          </p>

          <div className="colors-grid">
            {EMBED_COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => handleUpdateEmbedColor(color.value)}
                className={`color-button ${embedColor === color.value ? 'active' : ''}`}
                title={color.name}
                disabled={loading}
              >
                <div
                  className="color-preview"
                  style={{ backgroundColor: color.value }}
                />
                <span className="color-label">{color.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Reaction Workflows Section */}
        <section className="settings-section">
          <div className="section-header">
            <Heart size={18} />
            <h4>Reaction Workflows</h4>
          </div>

          <p className="section-description">
            Define actions triggered by message reactions
          </p>

          <div className="reaction-input">
            <input
              type="text"
              value={newReaction.emoji}
              onChange={e => setNewReaction({ ...newReaction, emoji: e.target.value })}
              placeholder="Emoji (e.g., 👍, ❌, ⭐)"
              maxLength={2}
              disabled={loading}
              className="emoji-input"
            />
            <input
              type="text"
              value={newReaction.action}
              onChange={e => setNewReaction({ ...newReaction, action: e.target.value })}
              placeholder="Action (e.g., pin, archive, notify)"
              disabled={loading}
            />
            <button
              onClick={handleAddReaction}
              disabled={loading}
              className="add-reaction-btn"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="reactions-list">
            {reactionWorkflows.length === 0 ? (
              <div className="empty-list">
                <Heart size={24} />
                <p>No reaction workflows configured</p>
              </div>
            ) : (
              reactionWorkflows.map(workflow => (
                <div key={workflow.emoji} className="reaction-item">
                  <div className="reaction-emoji">{workflow.emoji}</div>
                  <div className="reaction-action">
                    <span className="action-label">Triggers:</span>
                    <span className="action-name">{workflow.action}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteReaction(workflow.emoji)}
                    className="delete-btn"
                    disabled={loading}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default DiscordThreadSettings;
