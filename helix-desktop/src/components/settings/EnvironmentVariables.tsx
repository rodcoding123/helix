import { useState, useEffect, useCallback } from 'react';
import { getGatewayClient } from '../../lib/gateway-client';
import './EnvironmentVariables.css';

interface EnvVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  description?: string;
  source: 'user' | 'system' | 'inherited';
  lastModified?: number;
}

const PLACEHOLDER_VARIABLES: EnvVariable[] = [
  {
    id: '1',
    key: 'ANTHROPIC_API_KEY',
    value: 'sk-ant-api03-...redacted...',
    isSecret: true,
    description: 'API key for Claude models',
    source: 'user',
    lastModified: Date.now() - 86400000,
  },
  {
    id: '2',
    key: 'OPENAI_API_KEY',
    value: 'sk-...redacted...',
    isSecret: true,
    description: 'API key for OpenAI models',
    source: 'user',
    lastModified: Date.now() - 172800000,
  },
  {
    id: '3',
    key: 'HELIX_HOME',
    value: '/Users/specter/.helix',
    isSecret: false,
    description: 'Helix home directory',
    source: 'system',
  },
  {
    id: '4',
    key: 'HELIX_LOG_LEVEL',
    value: 'debug',
    isSecret: false,
    description: 'Logging verbosity level',
    source: 'user',
    lastModified: Date.now() - 3600000,
  },
  {
    id: '5',
    key: 'DISCORD_WEBHOOK_URL',
    value: 'https://discord.com/api/webhooks/...redacted...',
    isSecret: true,
    description: 'Discord webhook for logging',
    source: 'user',
    lastModified: Date.now() - 604800000,
  },
  {
    id: '6',
    key: 'NODE_ENV',
    value: 'development',
    isSecret: false,
    source: 'inherited',
  },
  {
    id: '7',
    key: 'PATH',
    value: '/usr/local/bin:/usr/bin:/bin',
    isSecret: false,
    source: 'inherited',
  },
];

export function EnvironmentVariables() {
  const [variables, setVariables] = useState<EnvVariable[]>(PLACEHOLDER_VARIABLES);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'user' | 'system' | 'inherited'>('all');
  const [showSecrets, setShowSecrets] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVar, setNewVar] = useState({ key: '', value: '', isSecret: false, description: '' });
  const [hasChanges, setHasChanges] = useState(false);
  const [_loading, setLoading] = useState(true);
  const [_saving, setSaving] = useState(false);

  const loadVariables = useCallback(async () => {
    setLoading(true);
    try {
      const client = getGatewayClient();
      if (client?.connected) {
        const config = await client.getFullConfig();

        // Extract environment variables from config
        const envConfig = config?.environment || {};

        // Transform to EnvVariable[] format
        const vars: EnvVariable[] = Object.entries(envConfig)
          .filter(([_, value]) => typeof value === 'object' && value !== null)
          .map(([key, value]) => {
            const v = value as Record<string, unknown>;
            return {
              id: key,
              key,
              value: (v.value as string) || '',
              isSecret: (v.isSecret as boolean) || false,
              description: v.description as string | undefined,
              source: (v.source as 'user' | 'system' | 'inherited') || 'user',
              lastModified: v.lastModified as number | undefined,
            };
          });

        setVariables(vars);
      } else {
        // Fallback to placeholder data if gateway offline
        setVariables(PLACEHOLDER_VARIABLES);
      }
    } catch (err) {
      console.error('[env-vars] Failed to load:', err);
      setVariables(PLACEHOLDER_VARIABLES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVariables();
  }, [loadVariables]);

  const saveVariables = useCallback(async () => {
    setSaving(true);
    try {
      const client = getGatewayClient();
      if (client?.connected) {
        // Transform to gateway config format
        const envConfig = variables
          .filter(v => v.source === 'user') // Only save user variables
          .reduce((acc, v) => ({
            ...acc,
            [v.key]: {
              value: v.value,
              isSecret: v.isSecret,
              description: v.description,
              source: v.source,
              lastModified: Date.now(),
            }
          }), {} as Record<string, unknown>);

        await client.patchFullConfig({
          patch: {
            environment: envConfig
          }
        });

        setHasChanges(false);
      }
    } catch (err) {
      console.error('[env-vars] Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }, [variables]);

  const addVariable = () => {
    if (!newVar.key.trim()) return;

    const variable: EnvVariable = {
      id: `var-${Date.now()}`,
      key: newVar.key.trim().toUpperCase().replace(/\s+/g, '_'),
      value: newVar.value,
      isSecret: newVar.isSecret,
      description: newVar.description || undefined,
      source: 'user',
      lastModified: Date.now(),
    };

    setVariables(prev => [...prev, variable]);
    setNewVar({ key: '', value: '', isSecret: false, description: '' });
    setShowAddModal(false);
    setHasChanges(true);
  };

  const updateVariable = (id: string, updates: Partial<EnvVariable>) => {
    setVariables(prev => prev.map(v =>
      v.id === id ? { ...v, ...updates, lastModified: Date.now() } : v
    ));
    setHasChanges(true);
  };

  const deleteVariable = useCallback((id: string) => {
    const variable = variables.find(v => v.id === id);
    if (!variable || variable.source !== 'user') return;

    // Optimistic update
    setVariables(prev => prev.filter(v => v.id !== id));
    setHasChanges(true);

    // Sync to gateway
    (async () => {
      try {
        const client = getGatewayClient();
        if (client?.connected) {
          await client.patchFullConfig({
            patch: {
              [`environment.${variable.key}`]: null // null = delete
            }
          });
        }
      } catch (err) {
        console.error('[env-vars] Failed to delete:', err);
        // Revert optimistic update on error
        loadVariables();
      }
    })();
  }, [variables, loadVariables]);

  const copyValue = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  const filteredVariables = variables.filter(v => {
    const matchesSearch = searchQuery === '' ||
      v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSource = filterSource === 'all' || v.source === filterSource;
    return matchesSearch && matchesSource;
  });

  const formatValue = (variable: EnvVariable) => {
    if (variable.isSecret && !showSecrets) {
      return '••••••••••••••••';
    }
    if (variable.value.length > 50) {
      return variable.value.slice(0, 50) + '...';
    }
    return variable.value;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getSourceBadge = (source: EnvVariable['source']) => {
    switch (source) {
      case 'user':
        return <span className="source-badge user">User</span>;
      case 'system':
        return <span className="source-badge system">System</span>;
      case 'inherited':
        return <span className="source-badge inherited">Inherited</span>;
    }
  };

  return (
    <div className="environment-variables">
      <div className="env-header">
        <div className="header-title">
          <span className="header-icon">🔐</span>
          <h2>Environment Variables</h2>
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary btn-sm"
            onClick={saveVariables}
            disabled={!hasChanges}
          >
            Save Changes
          </button>
          <button
            className="btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
          >
            + Add Variable
          </button>
        </div>
      </div>

      <div className="env-toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Search variables..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="toolbar-actions">
          <select
            className="filter-select"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
          >
            <option value="all">All Sources</option>
            <option value="user">User Defined</option>
            <option value="system">System</option>
            <option value="inherited">Inherited</option>
          </select>
          <button
            className={`btn-icon ${showSecrets ? 'active' : ''}`}
            onClick={() => setShowSecrets(!showSecrets)}
            title={showSecrets ? 'Hide secrets' : 'Show secrets'}
          >
            {showSecrets ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      <div className="env-content">
        <div className="env-list">
          {filteredVariables.length === 0 ? (
            <div className="no-variables">
              <p>No variables found</p>
            </div>
          ) : (
            filteredVariables.map(variable => (
              <div
                key={variable.id}
                className={`env-item ${editingId === variable.id ? 'editing' : ''}`}
              >
                <div className="env-main">
                  <div className="env-key-row">
                    <span className="env-key">{variable.key}</span>
                    {variable.isSecret && (
                      <span className="secret-badge">Secret</span>
                    )}
                    {getSourceBadge(variable.source)}
                  </div>
                  {editingId === variable.id ? (
                    <input
                      type={variable.isSecret && !showSecrets ? 'password' : 'text'}
                      className="env-value-input"
                      value={variable.value}
                      onChange={(e) => updateVariable(variable.id, { value: e.target.value })}
                      autoFocus
                    />
                  ) : (
                    <div className="env-value">{formatValue(variable)}</div>
                  )}
                  {variable.description && (
                    <div className="env-description">{variable.description}</div>
                  )}
                </div>
                <div className="env-meta">
                  {variable.lastModified && (
                    <span className="env-date">
                      Modified {formatDate(variable.lastModified)}
                    </span>
                  )}
                  <div className="env-actions">
                    <button
                      className="action-btn"
                      onClick={() => copyValue(variable.value)}
                      title="Copy value"
                    >
                      📋
                    </button>
                    {editingId === variable.id ? (
                      <button
                        className="action-btn save"
                        onClick={() => setEditingId(null)}
                        title="Done editing"
                      >
                        ✓
                      </button>
                    ) : (
                      <button
                        className="action-btn"
                        onClick={() => setEditingId(variable.id)}
                        title="Edit"
                        disabled={variable.source !== 'user'}
                      >
                        ✏️
                      </button>
                    )}
                    {variable.source === 'user' && (
                      <button
                        className="action-btn delete"
                        onClick={() => deleteVariable(variable.id)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="env-footer">
        <div className="footer-stats">
          <span>{variables.filter(v => v.source === 'user').length} user variables</span>
          <span className="separator">•</span>
          <span>{variables.filter(v => v.isSecret).length} secrets</span>
        </div>
        <div className="footer-warning">
          <span className="warning-icon">⚠️</span>
          <span>Never share your API keys or secrets</span>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Environment Variable</h3>
              <button
                className="close-btn"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Variable Name</label>
                <input
                  type="text"
                  value={newVar.key}
                  onChange={(e) => setNewVar({ ...newVar, key: e.target.value })}
                  placeholder="MY_API_KEY"
                  autoFocus
                />
              </div>
              <div className="form-field">
                <label>Value</label>
                <input
                  type={newVar.isSecret ? 'password' : 'text'}
                  value={newVar.value}
                  onChange={(e) => setNewVar({ ...newVar, value: e.target.value })}
                  placeholder="Enter value..."
                />
              </div>
              <div className="form-field">
                <label>Description (optional)</label>
                <input
                  type="text"
                  value={newVar.description}
                  onChange={(e) => setNewVar({ ...newVar, description: e.target.value })}
                  placeholder="What is this variable for?"
                />
              </div>
              <div className="form-field checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={newVar.isSecret}
                    onChange={(e) => setNewVar({ ...newVar, isSecret: e.target.checked })}
                  />
                  <span>This is a secret (hide value by default)</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={addVariable}
                disabled={!newVar.key.trim()}
              >
                Add Variable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
