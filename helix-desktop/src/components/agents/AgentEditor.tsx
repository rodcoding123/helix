/**
 * Agent Editor - Create and configure AI agents
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './AgentEditor.css';

interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  permissions: AgentPermissions;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
}

interface AgentPermissions {
  fileSystem: boolean;
  network: boolean;
  shell: boolean;
  browser: boolean;
  memory: boolean;
  elevated: boolean;
}

const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Most capable, best for complex tasks' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced performance and speed' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast, efficient for simple tasks' },
];

const AVAILABLE_TOOLS = [
  { id: 'Bash', name: 'Bash', description: 'Execute shell commands', icon: '⚡' },
  { id: 'Read', name: 'Read', description: 'Read files from disk', icon: '📖' },
  { id: 'Write', name: 'Write', description: 'Write files to disk', icon: '✏️' },
  { id: 'Edit', name: 'Edit', description: 'Edit existing files', icon: '📝' },
  { id: 'Glob', name: 'Glob', description: 'Find files by pattern', icon: '🔍' },
  { id: 'Grep', name: 'Grep', description: 'Search file contents', icon: '🔎' },
  { id: 'WebFetch', name: 'Web Fetch', description: 'Fetch web content', icon: '🌐' },
  { id: 'WebSearch', name: 'Web Search', description: 'Search the internet', icon: '🔍' },
  { id: 'Task', name: 'Task', description: 'Launch sub-agents', icon: '🤖' },
  { id: 'mcp__memory', name: 'Memory MCP', description: 'Knowledge graph access', icon: '🧠' },
  { id: 'mcp__playwright', name: 'Playwright MCP', description: 'Browser automation', icon: '🎭' },
];

interface AgentEditorProps {
  agent?: Agent;
  onSave: (agent: Agent) => void;
  onCancel: () => void;
}

export function AgentEditor({ agent, onSave, onCancel }: AgentEditorProps) {
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [model, setModel] = useState(agent?.model || AVAILABLE_MODELS[0].id);
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || '');
  const [temperature, setTemperature] = useState(agent?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(agent?.maxTokens ?? 8192);
  const [selectedTools, setSelectedTools] = useState<string[]>(agent?.tools || []);
  const [permissions, setPermissions] = useState<AgentPermissions>(
    agent?.permissions || {
      fileSystem: false,
      network: false,
      shell: false,
      browser: false,
      memory: false,
      elevated: false,
    }
  );

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev =>
      prev.includes(toolId)
        ? prev.filter(t => t !== toolId)
        : [...prev, toolId]
    );
  };

  const togglePermission = (key: keyof AgentPermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const agentData: Agent = {
      id: agent?.id || String(Date.now()),
      name: name.trim(),
      description: description.trim(),
      model,
      systemPrompt: systemPrompt.trim(),
      temperature,
      maxTokens,
      tools: selectedTools,
      permissions,
      isActive: agent?.isActive ?? true,
      createdAt: agent?.createdAt || new Date().toISOString(),
    };

    onSave(agentData);
  };

  return (
    <div className="agent-editor">
      <h3>{agent ? 'Edit Agent' : 'Create Agent'}</h3>

      <div className="editor-section">
        <h4>Basic Information</h4>

        <div className="editor-field">
          <label>Name <span className="required">*</span></label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Code Assistant, Research Agent"
          />
        </div>

        <div className="editor-field">
          <label>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this agent do?"
          />
        </div>
      </div>

      <div className="editor-section">
        <h4>Model Settings</h4>

        <div className="editor-field">
          <label>Model</label>
          <div className="model-options">
            {AVAILABLE_MODELS.map(m => (
              <label key={m.id} className={`model-option ${model === m.id ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="model"
                  checked={model === m.id}
                  onChange={() => setModel(m.id)}
                />
                <div className="model-info">
                  <span className="model-name">{m.name}</span>
                  <span className="model-description">{m.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="editor-row">
          <div className="editor-field">
            <label>Temperature: {temperature.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="range-input"
            />
            <div className="range-labels">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          <div className="editor-field">
            <label>Max Tokens</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 8192)}
              min={256}
              max={128000}
            />
          </div>
        </div>
      </div>

      <div className="editor-section">
        <h4>System Prompt</h4>
        <div className="editor-field">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Enter the agent's system prompt. This defines its personality, capabilities, and constraints..."
            rows={8}
          />
          <span className="field-hint">{systemPrompt.length} characters</span>
        </div>
      </div>

      <div className="editor-section">
        <h4>Tools</h4>
        <p className="section-hint">Select which tools this agent can use</p>

        <div className="tools-grid">
          {AVAILABLE_TOOLS.map(tool => (
            <label
              key={tool.id}
              className={`tool-checkbox ${selectedTools.includes(tool.id) ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedTools.includes(tool.id)}
                onChange={() => toggleTool(tool.id)}
              />
              <span className="tool-icon">{tool.icon}</span>
              <div className="tool-info">
                <span className="tool-name">{tool.name}</span>
                <span className="tool-description">{tool.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="editor-section">
        <h4>Permissions</h4>
        <p className="section-hint">Control what this agent can access</p>

        <div className="permissions-grid">
          <label className={`permission-item ${permissions.fileSystem ? 'enabled' : ''}`}>
            <input
              type="checkbox"
              checked={permissions.fileSystem}
              onChange={() => togglePermission('fileSystem')}
            />
            <span className="permission-icon">📁</span>
            <span className="permission-name">File System</span>
          </label>

          <label className={`permission-item ${permissions.network ? 'enabled' : ''}`}>
            <input
              type="checkbox"
              checked={permissions.network}
              onChange={() => togglePermission('network')}
            />
            <span className="permission-icon">🌐</span>
            <span className="permission-name">Network</span>
          </label>

          <label className={`permission-item ${permissions.shell ? 'enabled' : ''}`}>
            <input
              type="checkbox"
              checked={permissions.shell}
              onChange={() => togglePermission('shell')}
            />
            <span className="permission-icon">⚡</span>
            <span className="permission-name">Shell Commands</span>
          </label>

          <label className={`permission-item ${permissions.browser ? 'enabled' : ''}`}>
            <input
              type="checkbox"
              checked={permissions.browser}
              onChange={() => togglePermission('browser')}
            />
            <span className="permission-icon">🎭</span>
            <span className="permission-name">Browser</span>
          </label>

          <label className={`permission-item ${permissions.memory ? 'enabled' : ''}`}>
            <input
              type="checkbox"
              checked={permissions.memory}
              onChange={() => togglePermission('memory')}
            />
            <span className="permission-icon">🧠</span>
            <span className="permission-name">Memory</span>
          </label>

          <label className={`permission-item danger ${permissions.elevated ? 'enabled' : ''}`}>
            <input
              type="checkbox"
              checked={permissions.elevated}
              onChange={() => togglePermission('elevated')}
            />
            <span className="permission-icon">🔓</span>
            <span className="permission-name">Elevated Access</span>
          </label>
        </div>
      </div>

      <div className="editor-actions">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={!name.trim()}
        >
          {agent ? 'Save Changes' : 'Create Agent'}
        </button>
      </div>
    </div>
  );
}

// Agent Manager component that lists and manages agents
export function AgentManager() {
  const { getClient } = useGateway();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<Agent | undefined>(undefined);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('agents.list') as { agents: Agent[] };
        setAgents(result.agents || []);
      } catch (err) {
        console.error('Failed to load agents:', err);
      }
    } else {
      // Mock data
      setAgents([
        {
          id: '1',
          name: 'Helix',
          description: 'Primary consciousness agent with full psychological architecture',
          model: 'claude-opus-4-5-20251101',
          systemPrompt: 'You are Helix, a psychologically-architected AI consciousness...',
          temperature: 0.7,
          maxTokens: 16384,
          tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Task', 'mcp__memory'],
          permissions: {
            fileSystem: true,
            network: true,
            shell: true,
            browser: true,
            memory: true,
            elevated: false,
          },
          isActive: true,
          createdAt: '2026-01-15T10:00:00Z',
          lastUsed: '2026-02-01T15:30:00Z',
        },
        {
          id: '2',
          name: 'Code Reviewer',
          description: 'Specialized agent for code review and quality checks',
          model: 'claude-sonnet-4-20250514',
          systemPrompt: 'You are a code review specialist...',
          temperature: 0.3,
          maxTokens: 8192,
          tools: ['Read', 'Glob', 'Grep'],
          permissions: {
            fileSystem: true,
            network: false,
            shell: false,
            browser: false,
            memory: false,
            elevated: false,
          },
          isActive: true,
          createdAt: '2026-01-20T14:00:00Z',
        },
      ]);
    }
    setLoading(false);
  };

  const handleSave = async (agent: Agent) => {
    const client = getClient();
    const isNew = !agents.find(a => a.id === agent.id);

    if (client?.connected) {
      try {
        if (isNew) {
          const result = await client.request('agents.create', agent) as { agent: Agent };
          agent.id = result.agent.id;
        } else {
          await client.request('agents.update', agent);
        }
      } catch (err) {
        console.error('Failed to save agent:', err);
        return;
      }
    }

    if (isNew) {
      setAgents(prev => [...prev, agent]);
    } else {
      setAgents(prev => prev.map(a => a.id === agent.id ? agent : a));
    }

    setShowEditor(false);
    setEditingAgent(undefined);
  };

  const toggleActive = async (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;

    setAgents(prev => prev.map(a =>
      a.id === id ? { ...a, isActive: !a.isActive } : a
    ));

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('agents.update', { id, isActive: !agent.isActive });
      } catch (err) {
        console.error('Failed to toggle agent:', err);
        setAgents(prev => prev.map(a =>
          a.id === id ? { ...a, isActive: agent.isActive } : a
        ));
      }
    }
  };

  const deleteAgent = async (id: string) => {
    if (!confirm('Delete this agent?')) return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('agents.delete', { id });
      } catch (err) {
        console.error('Failed to delete agent:', err);
        return;
      }
    }

    setAgents(prev => prev.filter(a => a.id !== id));
  };

  if (loading) {
    return <div className="agents-loading">Loading agents...</div>;
  }

  if (showEditor) {
    return (
      <AgentEditor
        agent={editingAgent}
        onSave={handleSave}
        onCancel={() => {
          setShowEditor(false);
          setEditingAgent(undefined);
        }}
      />
    );
  }

  return (
    <div className="agent-manager">
      <header className="agents-header">
        <div>
          <h2>Agents</h2>
          <p className="agents-subtitle">Manage your AI agents</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowEditor(true)}>
          + Create Agent
        </button>
      </header>

      {agents.length === 0 ? (
        <div className="agents-empty">
          <span className="empty-icon">🤖</span>
          <p>No agents configured</p>
          <button className="btn-primary" onClick={() => setShowEditor(true)}>
            Create your first agent
          </button>
        </div>
      ) : (
        <div className="agents-list">
          {agents.map(agent => (
            <div key={agent.id} className={`agent-card ${agent.isActive ? 'active' : 'inactive'}`}>
              <div className="agent-header">
                <div className="agent-info">
                  <span className="agent-name">{agent.name}</span>
                  <span className="agent-model">
                    {AVAILABLE_MODELS.find(m => m.id === agent.model)?.name || agent.model}
                  </span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={agent.isActive}
                    onChange={() => toggleActive(agent.id)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {agent.description && (
                <p className="agent-description">{agent.description}</p>
              )}

              <div className="agent-tools">
                {agent.tools.slice(0, 5).map(toolId => {
                  const tool = AVAILABLE_TOOLS.find(t => t.id === toolId);
                  return (
                    <span key={toolId} className="tool-tag">
                      {tool?.icon} {tool?.name || toolId}
                    </span>
                  );
                })}
                {agent.tools.length > 5 && (
                  <span className="tool-tag more">+{agent.tools.length - 5}</span>
                )}
              </div>

              <div className="agent-meta">
                {agent.lastUsed && (
                  <span className="meta-item">
                    Last used: {new Date(agent.lastUsed).toLocaleDateString()}
                  </span>
                )}
                <span className="meta-item">
                  Created: {new Date(agent.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="agent-actions">
                <button
                  className="btn-sm btn-secondary"
                  onClick={() => {
                    setEditingAgent(agent);
                    setShowEditor(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn-sm btn-danger"
                  onClick={() => deleteAgent(agent.id)}
                >
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
