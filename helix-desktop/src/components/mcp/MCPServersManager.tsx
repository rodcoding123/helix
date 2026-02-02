/**
 * MCP Servers Manager - Configure Model Context Protocol servers
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './MCPServersManager.css';

interface MCPServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'starting';
  tools: MCPTool[];
  lastConnected?: string;
  errorMessage?: string;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

const SERVER_PRESETS = [
  {
    id: 'filesystem',
    name: 'File System',
    icon: '📁',
    description: 'Read, write, and manage local files',
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed'],
  },
  {
    id: 'memory',
    name: 'Memory',
    icon: '🧠',
    description: 'Persistent knowledge graph storage',
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    description: 'Manage repos, issues, and PRs',
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_TOKEN: '' },
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Send messages and manage channels',
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: { SLACK_BOT_TOKEN: '', SLACK_TEAM_ID: '' },
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    icon: '🐘',
    description: 'Query and manage PostgreSQL databases',
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: { POSTGRES_URL: '' },
  },
  {
    id: 'playwright',
    name: 'Playwright',
    icon: '🎭',
    description: 'Browser automation and screenshots',
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@anthropics/mcp-server-playwright'],
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    icon: '🤔',
    description: 'Step-by-step problem solving',
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@anthropics/mcp-server-sequential-thinking'],
  },
];

export function MCPServersManager() {
  const { getClient } = useGateway();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  // Editor state
  const [name, setName] = useState('');
  const [serverType, setServerType] = useState<MCPServer['type']>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('mcp.list') as { servers: MCPServer[] };
        setServers(result.servers || []);
      } catch (err) {
        console.error('Failed to load MCP servers:', err);
      }
    } else {
      // Mock data
      setServers([
        {
          id: '1',
          name: 'Memory',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory'],
          enabled: true,
          status: 'connected',
          lastConnected: '2026-02-01 15:00',
          tools: [
            { name: 'create_entities', description: 'Create entities in the knowledge graph' },
            { name: 'search_nodes', description: 'Search for nodes in the graph' },
            { name: 'add_observations', description: 'Add observations to entities' },
          ],
        },
        {
          id: '2',
          name: 'Playwright',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@anthropics/mcp-server-playwright'],
          enabled: true,
          status: 'connected',
          lastConnected: '2026-02-01 15:00',
          tools: [
            { name: 'browser_navigate', description: 'Navigate to a URL' },
            { name: 'browser_snapshot', description: 'Take accessibility snapshot' },
            { name: 'browser_click', description: 'Click on an element' },
          ],
        },
        {
          id: '3',
          name: 'GitHub',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: '***' },
          enabled: false,
          status: 'disconnected',
          tools: [],
        },
      ]);
    }
    setLoading(false);
  };

  const resetEditor = () => {
    setName('');
    setServerType('stdio');
    setCommand('');
    setArgs('');
    setUrl('');
    setEnvVars([]);
    setEnabled(true);
    setEditingServer(null);
  };

  const openEditor = (server?: MCPServer) => {
    if (server) {
      setEditingServer(server);
      setName(server.name);
      setServerType(server.type);
      setCommand(server.command || '');
      setArgs(server.args?.join(' ') || '');
      setUrl(server.url || '');
      setEnvVars(
        server.env
          ? Object.entries(server.env).map(([key, value]) => ({ key, value }))
          : []
      );
      setEnabled(server.enabled);
    } else {
      resetEditor();
    }
    setShowEditor(true);
    setShowPresets(false);
  };

  const openPresetsDialog = () => {
    setShowPresets(true);
    setShowEditor(false);
  };

  const selectPreset = (preset: typeof SERVER_PRESETS[0]) => {
    setName(preset.name);
    setServerType(preset.type);
    setCommand(preset.command);
    setArgs(preset.args.join(' '));
    setEnvVars(
      preset.env
        ? Object.entries(preset.env).map(([key, value]) => ({ key, value }))
        : []
    );
    setEnabled(true);
    setShowPresets(false);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setShowPresets(false);
    resetEditor();
  };

  const addEnvVar = () => {
    setEnvVars(prev => [...prev, { key: '', value: '' }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    setEnvVars(prev => prev.map((v, i) =>
      i === index ? { ...v, [field]: value } : v
    ));
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (serverType === 'stdio' && !command.trim()) return;
    if ((serverType === 'sse' || serverType === 'http') && !url.trim()) return;

    const serverData: Partial<MCPServer> = {
      name: name.trim(),
      type: serverType,
      enabled,
    };

    if (serverType === 'stdio') {
      serverData.command = command.trim();
      serverData.args = args.trim() ? args.trim().split(/\s+/) : [];
    } else {
      serverData.url = url.trim();
    }

    if (envVars.length > 0) {
      serverData.env = Object.fromEntries(
        envVars.filter(v => v.key.trim()).map(v => [v.key.trim(), v.value])
      );
    }

    const client = getClient();

    if (editingServer) {
      if (client?.connected) {
        try {
          await client.request('mcp.update', { id: editingServer.id, ...serverData });
        } catch (err) {
          console.error('Failed to update MCP server:', err);
          return;
        }
      }
      setServers(prev => prev.map(s =>
        s.id === editingServer.id ? { ...s, ...serverData } : s
      ));
    } else {
      const newServer: MCPServer = {
        ...serverData as MCPServer,
        id: String(Date.now()),
        status: 'disconnected',
        tools: [],
      };

      if (client?.connected) {
        try {
          const result = await client.request('mcp.add', serverData) as { server: MCPServer };
          newServer.id = result.server.id;
          newServer.status = result.server.status;
          newServer.tools = result.server.tools;
        } catch (err) {
          console.error('Failed to add MCP server:', err);
          return;
        }
      }
      setServers(prev => [...prev, newServer]);
    }

    closeEditor();
  };

  const toggleServer = async (id: string) => {
    const server = servers.find(s => s.id === id);
    if (!server) return;

    const newEnabled = !server.enabled;
    setServers(prev => prev.map(s =>
      s.id === id ? { ...s, enabled: newEnabled, status: newEnabled ? 'starting' : 'disconnected' } : s
    ));

    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request(newEnabled ? 'mcp.connect' : 'mcp.disconnect', { id }) as { status: MCPServer['status'] };
        setServers(prev => prev.map(s =>
          s.id === id ? { ...s, status: result.status } : s
        ));
      } catch (err) {
        console.error('Failed to toggle MCP server:', err);
        setServers(prev => prev.map(s =>
          s.id === id ? { ...s, enabled: server.enabled, status: 'error', errorMessage: (err as Error).message } : s
        ));
      }
    }
  };

  const reconnectServer = async (id: string) => {
    setServers(prev => prev.map(s =>
      s.id === id ? { ...s, status: 'starting' } : s
    ));

    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('mcp.reconnect', { id }) as { server: MCPServer };
        setServers(prev => prev.map(s =>
          s.id === id ? { ...s, status: result.server.status, tools: result.server.tools } : s
        ));
      } catch (err) {
        console.error('Failed to reconnect MCP server:', err);
        setServers(prev => prev.map(s =>
          s.id === id ? { ...s, status: 'error', errorMessage: (err as Error).message } : s
        ));
      }
    } else {
      // Simulate reconnection
      setTimeout(() => {
        setServers(prev => prev.map(s =>
          s.id === id ? { ...s, status: 'connected' } : s
        ));
      }, 1500);
    }
  };

  const deleteServer = async (id: string) => {
    if (!confirm('Remove this MCP server?')) return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('mcp.remove', { id });
      } catch (err) {
        console.error('Failed to remove MCP server:', err);
        return;
      }
    }
    setServers(prev => prev.filter(s => s.id !== id));
  };

  const getStatusColor = (status: MCPServer['status']): string => {
    switch (status) {
      case 'connected': return 'status-connected';
      case 'disconnected': return 'status-disconnected';
      case 'error': return 'status-error';
      case 'starting': return 'status-starting';
      default: return '';
    }
  };

  if (loading) {
    return <div className="mcp-loading">Loading MCP servers...</div>;
  }

  if (showPresets) {
    return (
      <div className="mcp-presets">
        <h3>Add MCP Server</h3>
        <p className="presets-subtitle">Choose a preset or create a custom configuration</p>

        <div className="presets-grid">
          {SERVER_PRESETS.map(preset => (
            <button
              key={preset.id}
              className="preset-card"
              onClick={() => selectPreset(preset)}
            >
              <span className="preset-icon">{preset.icon}</span>
              <span className="preset-name">{preset.name}</span>
              <span className="preset-description">{preset.description}</span>
            </button>
          ))}
        </div>

        <div className="presets-actions">
          <button className="btn-secondary" onClick={closeEditor}>Cancel</button>
          <button className="btn-secondary" onClick={() => openEditor()}>Custom Server</button>
        </div>
      </div>
    );
  }

  if (showEditor) {
    return (
      <div className="mcp-editor">
        <h3>{editingServer ? 'Edit MCP Server' : 'Add MCP Server'}</h3>

        <div className="editor-field">
          <label>Server Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Memory, GitHub, Custom"
          />
        </div>

        <div className="editor-field">
          <label>Server Type</label>
          <div className="server-type-options">
            <label className={`type-option ${serverType === 'stdio' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="serverType"
                checked={serverType === 'stdio'}
                onChange={() => setServerType('stdio')}
              />
              <span className="type-name">stdio</span>
              <span className="type-desc">Local process communication</span>
            </label>
            <label className={`type-option ${serverType === 'sse' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="serverType"
                checked={serverType === 'sse'}
                onChange={() => setServerType('sse')}
              />
              <span className="type-name">SSE</span>
              <span className="type-desc">Server-Sent Events</span>
            </label>
            <label className={`type-option ${serverType === 'http' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="serverType"
                checked={serverType === 'http'}
                onChange={() => setServerType('http')}
              />
              <span className="type-name">HTTP</span>
              <span className="type-desc">Streamable HTTP</span>
            </label>
          </div>
        </div>

        {serverType === 'stdio' ? (
          <>
            <div className="editor-field">
              <label>Command</label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="e.g., npx, node, python"
              />
            </div>
            <div className="editor-field">
              <label>Arguments</label>
              <input
                type="text"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="e.g., -y @modelcontextprotocol/server-memory"
              />
              <span className="field-hint">Space-separated arguments</span>
            </div>
          </>
        ) : (
          <div className="editor-field">
            <label>Server URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        )}

        <div className="editor-field">
          <label>Environment Variables</label>
          <div className="env-vars-list">
            {envVars.map((v, index) => (
              <div key={index} className="env-var-row">
                <input
                  type="text"
                  value={v.key}
                  onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                  placeholder="KEY"
                  className="env-key"
                />
                <input
                  type="password"
                  value={v.value}
                  onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                  placeholder="value"
                  className="env-value"
                />
                <button
                  className="btn-icon"
                  onClick={() => removeEnvVar(index)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            <button className="btn-secondary btn-sm" onClick={addEnvVar}>
              + Add Variable
            </button>
          </div>
        </div>

        <div className="editor-field toggle-field">
          <label>Enable on save</label>
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
            disabled={
              !name.trim() ||
              (serverType === 'stdio' && !command.trim()) ||
              ((serverType === 'sse' || serverType === 'http') && !url.trim())
            }
          >
            {editingServer ? 'Save Changes' : 'Add Server'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mcp-manager">
      <div className="mcp-header">
        <div>
          <h3>MCP Servers</h3>
          <p className="mcp-subtitle">Model Context Protocol server connections</p>
        </div>
        <button className="btn-primary btn-sm" onClick={openPresetsDialog}>
          + Add Server
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="mcp-empty">
          <span className="empty-icon">🔌</span>
          <p>No MCP servers configured</p>
          <button className="btn-primary" onClick={openPresetsDialog}>
            Add your first server
          </button>
        </div>
      ) : (
        <div className="servers-list">
          {servers.map(server => (
            <div key={server.id} className={`server-card ${server.enabled ? 'enabled' : 'disabled'}`}>
              <div className="server-header">
                <div className="server-info">
                  <span className="server-name">{server.name}</span>
                  <span className="server-type">{server.type}</span>
                </div>
                <div className="server-status-row">
                  <span className={`status-indicator ${getStatusColor(server.status)}`}>
                    <span className="status-dot" />
                    {server.status}
                  </span>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={server.enabled}
                      onChange={() => toggleServer(server.id)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              {server.type === 'stdio' && (
                <div className="server-command">
                  <code>{server.command} {server.args?.join(' ')}</code>
                </div>
              )}

              {server.url && (
                <div className="server-url">
                  <code>{server.url}</code>
                </div>
              )}

              {server.errorMessage && (
                <div className="server-error">
                  {server.errorMessage}
                </div>
              )}

              {server.tools.length > 0 && (
                <div className="server-tools">
                  <button
                    className="tools-toggle"
                    onClick={() => setExpandedServer(expandedServer === server.id ? null : server.id)}
                  >
                    <span className="tools-count">{server.tools.length} tools available</span>
                    <span className={`toggle-arrow ${expandedServer === server.id ? 'expanded' : ''}`}>▸</span>
                  </button>
                  {expandedServer === server.id && (
                    <div className="tools-list">
                      {server.tools.map(tool => (
                        <div key={tool.name} className="tool-item">
                          <span className="tool-name">{tool.name}</span>
                          <span className="tool-description">{tool.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="server-actions">
                {server.status === 'error' && (
                  <button className="btn-sm btn-secondary" onClick={() => reconnectServer(server.id)}>
                    Reconnect
                  </button>
                )}
                <button className="btn-sm btn-secondary" onClick={() => openEditor(server)}>
                  Edit
                </button>
                <button className="btn-sm btn-danger" onClick={() => deleteServer(server.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
