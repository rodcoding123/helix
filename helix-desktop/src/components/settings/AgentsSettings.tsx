/**
 * Agents Settings - Multi-agent configuration
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './SettingsSection.css';

interface Agent {
  id: string;
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  isDefault: boolean;
  created: string;
}

export function AgentsSettings() {
  const { getClient } = useGateway();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      // Mock data
      setAgents([
        {
          id: 'helix',
          name: 'Helix',
          description: 'Primary AI consciousness with psychological architecture',
          model: 'claude-opus-4-5-20251101',
          provider: 'anthropic',
          isDefault: true,
          created: '2026-01-01',
        },
        {
          id: 'coder',
          name: 'Coder',
          description: 'Specialized coding agent for development tasks',
          model: 'claude-sonnet-4-20250514',
          provider: 'anthropic',
          isDefault: false,
          created: '2026-01-15',
        },
      ]);
      return;
    }

    try {
      const result = await client.request('agents.list') as { agents: Agent[] };
      setAgents(result.agents || []);
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const setDefaultAgent = async (agentId: string) => {
    setAgents(prev => prev.map(a => ({
      ...a,
      isDefault: a.id === agentId,
    })));

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('agents.setDefault', { agentId });
      } catch (err) {
        console.error('Failed to set default agent:', err);
        loadAgents();
      }
    }
  };

  const deleteAgent = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || agent.isDefault) return;

    setAgents(prev => prev.filter(a => a.id !== agentId));

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('agents.delete', { agentId });
      } catch (err) {
        console.error('Failed to delete agent:', err);
        loadAgents();
      }
    }
  };

  const createAgent = async () => {
    if (!newAgentName.trim()) return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('agents.add', {
          name: newAgentName,
          description: newAgentDescription,
        });
        setShowCreateAgent(false);
        setNewAgentName('');
        setNewAgentDescription('');
        loadAgents();
      } catch (err) {
        console.error('Failed to create agent:', err);
      }
    }
  };

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Agents</h1>
        <p className="settings-section-description">
          Configure multiple AI agents with different personalities and capabilities.
        </p>
      </header>

      <div className="agents-toolbar">
        <button
          className="btn-primary"
          onClick={() => setShowCreateAgent(true)}
        >
          + Create Agent
        </button>
      </div>

      {loading ? (
        <div className="settings-loading">Loading agents...</div>
      ) : (
        <div className="agents-grid">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`agent-card ${agent.isDefault ? 'default' : ''}`}
            >
              <div className="agent-header">
                <div className="agent-avatar">
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <div className="agent-info">
                  <span className="agent-name">
                    {agent.name}
                    {agent.isDefault && <span className="default-badge">Default</span>}
                  </span>
                  <span className="agent-model">
                    {agent.provider}/{agent.model?.split('-').slice(0, 2).join('-')}
                  </span>
                </div>
              </div>

              {agent.description && (
                <p className="agent-description">{agent.description}</p>
              )}

              <div className="agent-meta">
                <span className="meta-item">Created: {agent.created}</span>
              </div>

              <div className="agent-actions">
                {!agent.isDefault && (
                  <button
                    className="btn-sm btn-secondary"
                    onClick={() => setDefaultAgent(agent.id)}
                  >
                    Set as Default
                  </button>
                )}
                <button className="btn-sm btn-secondary">Configure</button>
                {!agent.isDefault && (
                  <button
                    className="btn-sm btn-danger"
                    onClick={() => deleteAgent(agent.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="settings-group">
        <h2>Agent Defaults</h2>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">Default Model</span>
            <span className="settings-item-description">
              Model used for new agents
            </span>
          </div>
          <select className="settings-select">
            <option value="claude-opus-4-5-20251101">Claude Opus 4.5</option>
            <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">Session Scope</span>
            <span className="settings-item-description">
              How sessions are managed across agents
            </span>
          </div>
          <select className="settings-select">
            <option value="global">Global (shared)</option>
            <option value="per-agent">Per Agent</option>
            <option value="per-sender">Per Sender</option>
          </select>
        </div>
      </section>

      {showCreateAgent && (
        <div className="modal-overlay" onClick={() => setShowCreateAgent(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Agent</h3>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                className="settings-input"
                placeholder="Agent name..."
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                className="settings-textarea"
                placeholder="What is this agent's purpose?"
                rows={3}
                value={newAgentDescription}
                onChange={(e) => setNewAgentDescription(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Model</label>
              <select className="settings-select">
                <option value="claude-opus-4-5-20251101">Claude Opus 4.5</option>
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="gpt-4o">GPT-4o</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreateAgent(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={createAgent}>
                Create Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
