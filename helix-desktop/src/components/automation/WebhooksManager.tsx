/**
 * Webhooks Manager - Create and manage webhook endpoints
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './WebhooksManager.css';

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  lastTriggered?: string;
  triggerCount?: number;
  status: 'active' | 'error' | 'pending';
}

const AVAILABLE_EVENTS = [
  { id: 'message.received', name: 'Message Received', description: 'When a new message is received' },
  { id: 'message.sent', name: 'Message Sent', description: 'When a message is sent' },
  { id: 'task.started', name: 'Task Started', description: 'When a scheduled task begins' },
  { id: 'task.completed', name: 'Task Completed', description: 'When a scheduled task finishes' },
  { id: 'task.failed', name: 'Task Failed', description: 'When a scheduled task fails' },
  { id: 'tool.called', name: 'Tool Called', description: 'When a tool is invoked' },
  { id: 'error.occurred', name: 'Error Occurred', description: 'When an error happens' },
  { id: 'session.started', name: 'Session Started', description: 'When a new session begins' },
  { id: 'session.ended', name: 'Session Ended', description: 'When a session ends' },
  { id: 'agent.switched', name: 'Agent Switched', description: 'When the active agent changes' },
];

export function WebhooksManager() {
  const { getClient } = useGateway();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);

  // Editor state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('webhooks.list') as { webhooks: Webhook[] };
        setWebhooks(result.webhooks || []);
      } catch (err) {
        console.error('Failed to load webhooks:', err);
      }
    } else {
      // Mock data
      setWebhooks([
        {
          id: '1',
          name: 'Slack Notifications',
          url: 'https://hooks.slack.com/services/xxx/yyy/zzz',
          events: ['message.received', 'task.completed', 'error.occurred'],
          enabled: true,
          lastTriggered: '2026-02-01 14:30',
          triggerCount: 156,
          status: 'active',
        },
        {
          id: '2',
          name: 'Analytics Tracker',
          url: 'https://api.analytics.example.com/webhook',
          events: ['session.started', 'session.ended'],
          enabled: true,
          lastTriggered: '2026-02-01 15:00',
          triggerCount: 42,
          status: 'active',
        },
      ]);
    }
    setLoading(false);
  };

  const resetEditor = () => {
    setName('');
    setUrl('');
    setSecret('');
    setSelectedEvents([]);
    setEnabled(true);
    setEditingWebhook(null);
  };

  const openEditor = (webhook?: Webhook) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setName(webhook.name);
      setUrl(webhook.url);
      setSecret(webhook.secret || '');
      setSelectedEvents(webhook.events);
      setEnabled(webhook.enabled);
    } else {
      resetEditor();
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    resetEditor();
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !url.trim() || selectedEvents.length === 0) return;

    const webhookData = {
      name: name.trim(),
      url: url.trim(),
      secret: secret.trim() || undefined,
      events: selectedEvents,
      enabled,
    };

    const client = getClient();

    if (editingWebhook) {
      if (client?.connected) {
        try {
          await client.request('webhooks.update', { id: editingWebhook.id, ...webhookData });
        } catch (err) {
          console.error('Failed to update webhook:', err);
          return;
        }
      }
      setWebhooks(prev => prev.map(w =>
        w.id === editingWebhook.id ? { ...w, ...webhookData } : w
      ));
    } else {
      const newWebhook: Webhook = {
        ...webhookData,
        id: String(Date.now()),
        status: 'pending',
        triggerCount: 0,
      };

      if (client?.connected) {
        try {
          const result = await client.request('webhooks.create', webhookData) as { webhook: Webhook };
          newWebhook.id = result.webhook.id;
        } catch (err) {
          console.error('Failed to create webhook:', err);
          return;
        }
      }
      setWebhooks(prev => [...prev, newWebhook]);
    }

    closeEditor();
  };

  const toggleWebhook = async (id: string) => {
    const webhook = webhooks.find(w => w.id === id);
    if (!webhook) return;

    setWebhooks(prev => prev.map(w =>
      w.id === id ? { ...w, enabled: !w.enabled } : w
    ));

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('webhooks.update', { id, enabled: !webhook.enabled });
      } catch (err) {
        console.error('Failed to toggle webhook:', err);
        setWebhooks(prev => prev.map(w =>
          w.id === id ? { ...w, enabled: webhook.enabled } : w
        ));
      }
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('webhooks.delete', { id });
      } catch (err) {
        console.error('Failed to delete webhook:', err);
        return;
      }
    }
    setWebhooks(prev => prev.filter(w => w.id !== id));
  };

  const testWebhook = async (id: string) => {
    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('webhooks.test', { id });
        alert('Test webhook sent!');
      } catch (err) {
        console.error('Failed to test webhook:', err);
        alert('Test failed: ' + (err as Error).message);
      }
    } else {
      alert('Test webhook sent! (simulated)');
    }
  };

  if (loading) {
    return <div className="webhooks-loading">Loading webhooks...</div>;
  }

  if (showEditor) {
    return (
      <div className="webhooks-editor">
        <h3>{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</h3>

        <div className="editor-field">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Slack Notifications"
          />
        </div>

        <div className="editor-field">
          <label>Webhook URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="editor-field">
          <label>Secret (optional)</label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="For signature verification"
          />
          <span className="field-hint">Used to sign webhook payloads for verification</span>
        </div>

        <div className="editor-field">
          <label>Events to trigger on</label>
          <div className="events-grid">
            {AVAILABLE_EVENTS.map(event => (
              <label key={event.id} className="event-checkbox">
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event.id)}
                  onChange={() => toggleEvent(event.id)}
                />
                <div className="event-info">
                  <span className="event-name">{event.name}</span>
                  <span className="event-description">{event.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="editor-field toggle-field">
          <label>Enabled</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="editor-actions">
          <button className="btn-secondary" onClick={closeEditor}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!name.trim() || !url.trim() || selectedEvents.length === 0}
          >
            {editingWebhook ? 'Save Changes' : 'Create Webhook'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="webhooks-manager">
      <div className="webhooks-header">
        <h3>Webhooks</h3>
        <button className="btn-primary btn-sm" onClick={() => openEditor()}>
          + Add Webhook
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="webhooks-empty">
          <span className="empty-icon">🪝</span>
          <p>No webhooks configured</p>
          <button className="btn-primary" onClick={() => openEditor()}>
            Create your first webhook
          </button>
        </div>
      ) : (
        <div className="webhooks-list">
          {webhooks.map(webhook => (
            <div key={webhook.id} className={`webhook-card ${webhook.enabled ? 'enabled' : 'disabled'}`}>
              <div className="webhook-header">
                <div className="webhook-info">
                  <span className="webhook-name">{webhook.name}</span>
                  <code className="webhook-url">{webhook.url}</code>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={webhook.enabled}
                    onChange={() => toggleWebhook(webhook.id)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="webhook-events">
                {webhook.events.map(eventId => {
                  const event = AVAILABLE_EVENTS.find(e => e.id === eventId);
                  return (
                    <span key={eventId} className="event-tag">
                      {event?.name || eventId}
                    </span>
                  );
                })}
              </div>

              <div className="webhook-stats">
                {webhook.lastTriggered && (
                  <span className="stat">Last triggered: {webhook.lastTriggered}</span>
                )}
                {webhook.triggerCount !== undefined && (
                  <span className="stat">Triggers: {webhook.triggerCount}</span>
                )}
                <span className={`status-badge ${webhook.status}`}>
                  {webhook.status}
                </span>
              </div>

              <div className="webhook-actions">
                <button className="btn-sm btn-secondary" onClick={() => testWebhook(webhook.id)}>
                  Test
                </button>
                <button className="btn-sm btn-secondary" onClick={() => openEditor(webhook)}>
                  Edit
                </button>
                <button className="btn-sm btn-danger" onClick={() => deleteWebhook(webhook.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
