/**
 * Session Templates Manager
 *
 * System and user-defined session configuration templates
 * Phase G.3 - Synthesis Monitoring & Templates
 */

import { useState, useEffect, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';

interface SessionTemplate {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  config: {
    scope?: 'per-sender' | 'per-channel' | 'per-channel-peer';
    resetMode?: 'daily' | 'idle' | 'manual';
    resetHour?: number;
    idleTimeoutMinutes?: number;
    budgetLimit?: number;
    autoCompact?: boolean;
    toolsPolicy?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

const SYSTEM_TEMPLATES: SessionTemplate[] = [
  {
    id: 'quick-chat',
    name: 'Quick Chat',
    description: 'Short conversations with low overhead',
    isSystem: true,
    config: {
      scope: 'per-sender',
      resetMode: 'idle',
      idleTimeoutMinutes: 30,
      budgetLimit: 8000,
      autoCompact: true,
    },
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    description: 'Extended conversations with retention',
    isSystem: true,
    config: {
      scope: 'per-channel-peer',
      resetMode: 'daily',
      resetHour: 0,
      budgetLimit: 200000,
      autoCompact: true,
    },
  },
  {
    id: 'development',
    name: 'Development',
    description: 'Long-running coding sessions',
    isSystem: true,
    config: {
      scope: 'per-channel',
      resetMode: 'manual',
      budgetLimit: 500000,
      autoCompact: false,
    },
  },
  {
    id: 'analysis',
    name: 'Deep Analysis',
    description: 'Comprehensive analysis with full context',
    isSystem: true,
    config: {
      scope: 'per-sender',
      resetMode: 'manual',
      budgetLimit: 1000000,
      autoCompact: false,
    },
  },
];

export function SessionTemplatesManager() {
  const { getClient, connected } = useGateway();
  const [templates, _setTemplates] = useState<SessionTemplate[]>(SYSTEM_TEMPLATES);
  const [userTemplates, setUserTemplates] = useState<SessionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SessionTemplate | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Partial<SessionTemplate>>({
    name: '',
    description: '',
    config: {},
  });
  const [loading, setLoading] = useState(true);

  // Load user templates
  useEffect(() => {
    loadUserTemplates();
  }, [connected]);

  const loadUserTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const client = getClient();
      if (!client?.connected) {
        setLoading(false);
        return;
      }

      const result = (await client.request('templates.list', {})) as any;
      if (result?.templates) {
        setUserTemplates(result.templates as SessionTemplate[]);
      }
    } catch (err) {
      console.error('Failed to load user templates:', err);
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  const handleSaveTemplate = useCallback(async () => {
    if (!newTemplate.name) {
      alert('Template name is required');
      return;
    }

    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('templates.create', {
        template: {
          name: newTemplate.name,
          description: newTemplate.description,
          config: newTemplate.config,
        },
      });

      setShowCreateForm(false);
      setNewTemplate({ name: '', description: '', config: {} });
      await loadUserTemplates();
    } catch (err) {
      console.error('Failed to save template:', err);
    }
  }, [newTemplate, getClient, loadUserTemplates]);

  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      if (!confirm('Delete this template?')) return;

      const client = getClient();
      if (!client?.connected) return;

      try {
        await client.request('templates.delete', { templateId });
        await loadUserTemplates();
        setSelectedTemplate(null);
      } catch (err) {
        console.error('Failed to delete template:', err);
      }
    },
    [getClient, loadUserTemplates]
  );

  const handleApplyTemplate = useCallback(
    async (template: SessionTemplate) => {
      const client = getClient();
      if (!client?.connected) return;

      try {
        await client.request('config.patch', {
          patch: {
            'session.defaults': template.config,
          },
        });

        alert(`Template "${template.name}" applied to new sessions`);
      } catch (err) {
        console.error('Failed to apply template:', err);
      }
    },
    [getClient]
  );

  const allTemplates = [...templates, ...userTemplates];

  if (loading) {
    return <div className="templates-manager loading">Loading templates...</div>;
  }

  return (
    <div className="templates-manager">
      <style>{templatesManagerStyles}</style>

      {/* Header */}
      <div className="manager-header">
        <h3>Session Templates</h3>
        <button
          className="create-btn"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? '✕ Cancel' : '+ Create Template'}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="create-form">
          <div className="form-group">
            <label>Template Name</label>
            <input
              type="text"
              value={newTemplate.name || ''}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              placeholder="e.g., Research Session"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={newTemplate.description || ''}
              onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
              placeholder="Describe this template's purpose..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Session Scope</label>
            <select
              value={newTemplate.config?.scope || 'per-sender'}
              onChange={(e) =>
                setNewTemplate({
                  ...newTemplate,
                  config: { ...newTemplate.config, scope: e.target.value as any },
                })
              }
            >
              <option value="per-sender">Per Sender</option>
              <option value="per-channel">Per Channel</option>
              <option value="per-channel-peer">Per Channel + Peer</option>
            </select>
          </div>

          <div className="form-group">
            <label>Budget Limit (tokens)</label>
            <input
              type="number"
              value={newTemplate.config?.budgetLimit || 100000}
              onChange={(e) =>
                setNewTemplate({
                  ...newTemplate,
                  config: { ...newTemplate.config, budgetLimit: parseInt(e.target.value) },
                })
              }
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSaveTemplate}>
              Save Template
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      <div className="templates-grid">
        {allTemplates.length === 0 ? (
          <div className="empty-state">No templates available</div>
        ) : (
          allTemplates.map((template) => (
            <div
              key={template.id}
              className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
              onClick={() => setSelectedTemplate(template)}
            >
              <div className="card-header">
                <h4>{template.name}</h4>
                {template.isSystem && (
                  <span className="system-badge">System</span>
                )}
              </div>

              <p className="card-description">{template.description}</p>

              <div className="config-summary">
                {template.config.scope && (
                  <div className="config-item">
                    <span className="label">Scope:</span>
                    <span className="value">{template.config.scope}</span>
                  </div>
                )}
                {template.config.budgetLimit && (
                  <div className="config-item">
                    <span className="label">Budget:</span>
                    <span className="value">{template.config.budgetLimit.toLocaleString()} tokens</span>
                  </div>
                )}
              </div>

              <div className="card-actions">
                <button
                  className="action-btn apply"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApplyTemplate(template);
                  }}
                >
                  Apply
                </button>
                {!template.isSystem && (
                  <button
                    className="action-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id);
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail View */}
      {selectedTemplate && (
        <div className="template-detail">
          <div className="detail-header">
            <h4>{selectedTemplate.name}</h4>
            <button
              className="close-btn"
              onClick={() => setSelectedTemplate(null)}
            >
              ✕
            </button>
          </div>

          <div className="detail-content">
            {selectedTemplate.description && (
              <div className="detail-section">
                <label>Description</label>
                <p>{selectedTemplate.description}</p>
              </div>
            )}

            <div className="detail-section">
              <label>Configuration</label>
              <div className="config-details">
                {Object.entries(selectedTemplate.config).map(([key, value]) => (
                  <div key={key} className="detail-row">
                    <span className="key">{key}:</span>
                    <span className="value">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="detail-actions">
              <button
                className="btn btn-primary"
                onClick={() => handleApplyTemplate(selectedTemplate)}
              >
                Apply This Template
              </button>
              {!selectedTemplate.isSystem && (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    handleDeleteTemplate(selectedTemplate.id);
                  }}
                >
                  Delete Template
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const templatesManagerStyles = `
.templates-manager {
  padding: 1.5rem;
  background: var(--bg-primary, #0a0a1a);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.templates-manager.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-tertiary, #606080);
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.manager-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.create-btn {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.create-btn:hover {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.create-form {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
  margin-bottom: 0.5rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  font-family: inherit;
  font-size: 0.875rem;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.1);
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
}

.btn-primary:hover {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #fff);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.template-card {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.template-card.selected {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.card-header h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.system-badge {
  padding: 0.25rem 0.5rem;
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
  font-size: 0.65rem;
  border-radius: 3px;
  font-weight: 600;
}

.card-description {
  margin: 0 0 0.75rem 0;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
}

.config-summary {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
  font-size: 0.75rem;
}

.config-item {
  display: flex;
  gap: 0.5rem;
}

.config-item .label {
  color: var(--text-tertiary, #606080);
  font-weight: 500;
}

.config-item .value {
  color: #818cf8;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  flex: 1;
  padding: 0.5rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 4px;
  color: #818cf8;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
}

.action-btn.delete {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary, #606080);
}

.template-detail {
  margin-top: 2rem;
  padding: 1.5rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.detail-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: color 0.2s ease;
}

.close-btn:hover {
  color: var(--text-primary, #fff);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.detail-section label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-tertiary, #606080);
  display: block;
  margin-bottom: 0.75rem;
}

.detail-section p {
  margin: 0;
  color: var(--text-secondary, #a0a0c0);
}

.config-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  font-size: 0.8125rem;
}

.detail-row .key {
  color: var(--text-secondary, #a0a0c0);
  font-weight: 500;
}

.detail-row .value {
  color: #818cf8;
  font-family: monospace;
}

.detail-actions {
  display: flex;
  gap: 1rem;
}
`;
