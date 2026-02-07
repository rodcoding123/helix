/**
 * WhatsApp Broadcast Management
 *
 * UI for creating and managing WhatsApp broadcast lists:
 * - Create/delete broadcast lists
 * - Manage recipients
 * - Send broadcast messages
 * - View delivery status
 */

import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Send, Phone, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getClient } from '../../../lib/gateway-client';
import type { ChannelAccount } from '../ChannelAccountTabs';

export interface BroadcastList {
  id: string;
  name: string;
  recipients: string[];
  createdAt: number;
  lastUsed?: number;
}

export interface BroadcastMessage {
  id: string;
  broadcastId: string;
  content: string;
  sentAt: number;
  status: 'pending' | 'sent' | 'failed';
  recipientStatus: Record<string, 'pending' | 'sent' | 'failed' | 'delivery_ack'>;
}

interface WhatsAppBroadcastsProps {
  account: ChannelAccount;
  channelId: string;
}

export function WhatsAppBroadcasts({
  account,
  channelId,
}: WhatsAppBroadcastsProps) {
  const [broadcasts, setBroadcasts] = useState<BroadcastList[]>([]);
  const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastList | null>(null);
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [newBroadcastName, setNewBroadcastName] = useState('');
  const [newRecipients, setNewRecipients] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load broadcasts for this account
  const loadBroadcasts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const client = getClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      const result = await client.request('channels.whatsapp.broadcasts.list', {
        accountId: account.id,
      });

      if (result?.ok) {
        setBroadcasts(result.broadcasts || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('[whatsapp-broadcasts] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  // Load messages for selected broadcast
  const loadMessages = useCallback(
    async (broadcastId: string) => {
      setLoading(true);

      try {
        const client = getClient();
        if (!client?.connected) {
          throw new Error('Gateway not connected');
        }

        const result = await client.request('channels.whatsapp.broadcasts.messages', {
          accountId: account.id,
          broadcastId,
        });

        if (result?.ok) {
          setMessages(result.messages || []);
        }
      } catch (err) {
        console.error('[whatsapp-broadcasts] Failed to load messages:', err);
      } finally {
        setLoading(false);
      }
    },
    [account.id]
  );

  // Create new broadcast list
  const handleCreateBroadcast = useCallback(async () => {
    if (!newBroadcastName.trim() || !newRecipients.trim()) {
      setError('Name and recipients required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      const recipients = newRecipients
        .split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 0);

      const result = await client.request('channels.whatsapp.broadcasts.create', {
        accountId: account.id,
        name: newBroadcastName,
        recipients,
      });

      if (result?.ok) {
        const newBroadcast = result.broadcast;
        setBroadcasts(prev => [...prev, newBroadcast]);
        setSelectedBroadcast(newBroadcast);
        setNewBroadcastName('');
        setNewRecipients('');
        setShowCreateModal(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [newBroadcastName, newRecipients, account.id]);

  // Send broadcast message
  const handleSendMessage = useCallback(async () => {
    if (!selectedBroadcast || !messageContent.trim()) {
      setError('Select broadcast and enter message');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      const result = await client.request('channels.whatsapp.broadcasts.send', {
        accountId: account.id,
        broadcastId: selectedBroadcast.id,
        content: messageContent,
      });

      if (result?.ok) {
        // Add to messages list
        const newMessage: BroadcastMessage = {
          id: result.messageId,
          broadcastId: selectedBroadcast.id,
          content: messageContent,
          sentAt: Date.now(),
          status: 'sent',
          recipientStatus: result.recipientStatus || {},
        };

        setMessages(prev => [newMessage, ...prev]);
        setMessageContent('');
        setShowMessageModal(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedBroadcast, messageContent, account.id]);

  // Delete broadcast list
  const handleDeleteBroadcast = useCallback(
    async (broadcastId: string) => {
      if (!confirm('Delete this broadcast list? This cannot be undone.')) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const client = getClient();
        if (!client?.connected) {
          throw new Error('Gateway not connected');
        }

        await client.request('channels.whatsapp.broadcasts.delete', {
          accountId: account.id,
          broadcastId,
        });

        setBroadcasts(prev => prev.filter(b => b.id !== broadcastId));
        if (selectedBroadcast?.id === broadcastId) {
          setSelectedBroadcast(null);
          setMessages([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [selectedBroadcast, account.id]
  );

  // Load broadcasts on mount
  useEffect(() => {
    loadBroadcasts();
  }, [loadBroadcasts]);

  // Load messages when broadcast is selected
  useEffect(() => {
    if (selectedBroadcast) {
      loadMessages(selectedBroadcast.id);
    }
  }, [selectedBroadcast, loadMessages]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      default:
        return '#9ca3af';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivery_ack':
        return <CheckCircle size={16} style={{ color: '#10b981' }} />;
      case 'pending':
        return <Clock size={16} style={{ color: '#f59e0b' }} />;
      case 'failed':
        return <AlertCircle size={16} style={{ color: '#ef4444' }} />;
      default:
        return null;
    }
  };

  return (
    <div className="whatsapp-broadcasts-container">
      <div className="broadcasts-header">
        <h3>Broadcast Lists</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={loading}
          className="create-button"
          title="Create new broadcast list"
        >
          <Plus size={16} />
          New List
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="broadcasts-layout">
        {/* Broadcast Lists Sidebar */}
        <div className="broadcasts-list">
          {broadcasts.length === 0 ? (
            <div className="empty-state">
              <p>No broadcast lists yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="empty-cta"
              >
                Create your first list
              </button>
            </div>
          ) : (
            broadcasts.map(broadcast => (
              <div
                key={broadcast.id}
                className={`broadcast-item ${
                  selectedBroadcast?.id === broadcast.id ? 'active' : ''
                }`}
                onClick={() => setSelectedBroadcast(broadcast)}
              >
                <div className="broadcast-info">
                  <div className="broadcast-name">{broadcast.name}</div>
                  <div className="broadcast-meta">
                    {broadcast.recipients.length} recipients
                  </div>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteBroadcast(broadcast.id);
                  }}
                  className="delete-button"
                  title="Delete broadcast"
                  disabled={loading}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Messages View */}
        {selectedBroadcast && (
          <div className="broadcast-detail">
            <div className="broadcast-header-detail">
              <div>
                <h4>{selectedBroadcast.name}</h4>
                <p className="detail-meta">
                  {selectedBroadcast.recipients.length} recipients
                </p>
              </div>
              <button
                onClick={() => setShowMessageModal(true)}
                disabled={loading || account.status !== 'connected'}
                className="send-button"
                title="Send broadcast message"
              >
                <Send size={16} />
                Send
              </button>
            </div>

            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <p>No messages sent yet</p>
                </div>
              ) : (
                messages.map(message => (
                  <div key={message.id} className="message-card">
                    <div className="message-header">
                      <div className="message-time">
                        {new Date(message.sentAt).toLocaleString()}
                      </div>
                      <div className={`message-status ${message.status}`}>
                        {getStatusIcon(message.status)}
                        {message.status}
                      </div>
                    </div>

                    <div className="message-content">{message.content}</div>

                    {Object.keys(message.recipientStatus).length > 0 && (
                      <div className="recipient-status">
                        <div className="status-header">Delivery Status:</div>
                        <div className="status-list">
                          {Object.entries(message.recipientStatus).map(
                            ([recipient, status]) => (
                              <div key={recipient} className="status-item">
                                <div className="recipient-number">
                                  <Phone size={12} />
                                  {recipient}
                                </div>
                                <div className="status-badge" style={{ color: getStatusColor(status) }}>
                                  {getStatusIcon(status)}
                                  {status}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Broadcast Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Create Broadcast List</h3>

            <div className="form-group">
              <label>List Name</label>
              <input
                type="text"
                value={newBroadcastName}
                onChange={e => setNewBroadcastName(e.target.value)}
                placeholder="e.g., Friends, Family, Work"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Recipients (one per line)</label>
              <textarea
                value={newRecipients}
                onChange={e => setNewRecipients(e.target.value)}
                placeholder="1234567890&#10;9876543210&#10;5555555555"
                rows={6}
                disabled={loading}
              />
              <div className="helper-text">
                Enter phone numbers without formatting (e.g., 1234567890)
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={loading}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBroadcast}
                disabled={loading}
                className="primary-button"
              >
                {loading ? 'Creating...' : 'Create List'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {showMessageModal && (
        <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Send Broadcast Message</h3>

            <div className="form-group">
              <label>Message Content</label>
              <textarea
                value={messageContent}
                onChange={e => setMessageContent(e.target.value)}
                placeholder="Enter message..."
                rows={6}
                disabled={loading}
              />
              <div className="helper-text">
                Will be sent to {selectedBroadcast?.recipients.length || 0} recipients
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowMessageModal(false)}
                disabled={loading}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={loading}
                className="primary-button"
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatsAppBroadcasts;
