/**
 * Tools Settings - Tool permissions, profiles, and sandbox configuration
 */

import { useState } from 'react';
import './SettingsSection.css';

type ToolProfile = 'minimal' | 'coding' | 'messaging' | 'full' | 'custom';
type ElevatedMode = 'off' | 'ask' | 'on' | 'full';

interface ToolConfig {
  profile: ToolProfile;
  elevated: ElevatedMode;
  sandboxEnabled: boolean;
  execTimeout: number;
  backgroundExec: boolean;
  allowedTools: string[];
  deniedTools: string[];
}

const TOOL_PROFILES = [
  {
    id: 'minimal' as const,
    name: 'Minimal',
    description: 'Basic chat only - no file or system access',
    tools: ['chat', 'memory'],
  },
  {
    id: 'coding' as const,
    name: 'Coding',
    description: 'Full development tools - file editing, terminal, git',
    tools: ['chat', 'memory', 'read', 'write', 'edit', 'exec', 'browser'],
  },
  {
    id: 'messaging' as const,
    name: 'Messaging',
    description: 'Channel messaging and media handling',
    tools: ['chat', 'memory', 'message', 'media', 'link-preview'],
  },
  {
    id: 'full' as const,
    name: 'Full Access',
    description: 'All tools enabled - maximum capability',
    tools: ['*'],
  },
  {
    id: 'custom' as const,
    name: 'Custom',
    description: 'Configure individual tool permissions',
    tools: [],
  },
];

const ELEVATED_MODES = [
  { id: 'off' as const, label: 'Disabled', description: 'Never allow elevated operations' },
  { id: 'ask' as const, label: 'Ask First', description: 'Prompt before elevated operations' },
  { id: 'on' as const, label: 'Auto-approve', description: 'Automatically approve elevated ops' },
  { id: 'full' as const, label: 'Full Access', description: 'No restrictions on operations' },
];

const ALL_TOOLS = [
  { id: 'read', name: 'Read Files', category: 'files', risk: 'low' },
  { id: 'write', name: 'Write Files', category: 'files', risk: 'medium' },
  { id: 'edit', name: 'Edit Files', category: 'files', risk: 'medium' },
  { id: 'exec', name: 'Execute Commands', category: 'system', risk: 'high' },
  { id: 'browser', name: 'Browser Automation', category: 'web', risk: 'medium' },
  { id: 'message', name: 'Send Messages', category: 'communication', risk: 'low' },
  { id: 'media', name: 'Media Processing', category: 'media', risk: 'low' },
  { id: 'link-preview', name: 'Link Preview', category: 'web', risk: 'low' },
  { id: 'image-gen', name: 'Image Generation', category: 'media', risk: 'low' },
  { id: 'memory', name: 'Long-term Memory', category: 'data', risk: 'low' },
  { id: 'cron', name: 'Scheduled Tasks', category: 'automation', risk: 'medium' },
  { id: 'webhook', name: 'Webhooks', category: 'automation', risk: 'medium' },
];

export function ToolsSettings() {
  const [config, setConfig] = useState<ToolConfig>({
    profile: 'coding',
    elevated: 'ask',
    sandboxEnabled: true,
    execTimeout: 120,
    backgroundExec: true,
    allowedTools: [],
    deniedTools: [],
  });

  const updateConfig = (updates: Partial<ToolConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const currentProfile = TOOL_PROFILES.find(p => p.id === config.profile);

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Tools & Sandbox</h1>
        <p className="settings-section-description">
          Configure which tools Helix can use and how they're secured.
        </p>
      </header>

      <section className="settings-group">
        <h2>Tool Profile</h2>
        <div className="profile-grid">
          {TOOL_PROFILES.map((profile) => (
            <button
              key={profile.id}
              className={`profile-option ${config.profile === profile.id ? 'selected' : ''}`}
              onClick={() => updateConfig({ profile: profile.id })}
            >
              <span className="profile-name">{profile.name}</span>
              <span className="profile-description">{profile.description}</span>
            </button>
          ))}
        </div>
        {currentProfile && config.profile !== 'custom' && (
          <div className="profile-tools">
            <span className="label">Enabled tools:</span>
            <span className="tools-list">
              {currentProfile.tools.join(', ')}
            </span>
          </div>
        )}
      </section>

      {config.profile === 'custom' && (
        <section className="settings-group">
          <h2>Custom Tool Permissions</h2>
          <div className="tools-grid">
            {ALL_TOOLS.map((tool) => (
              <div key={tool.id} className="tool-item">
                <div className="tool-info">
                  <span className="tool-name">{tool.name}</span>
                  <span className={`tool-risk risk-${tool.risk}`}>{tool.risk}</span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!config.deniedTools.includes(tool.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateConfig({ deniedTools: config.deniedTools.filter(t => t !== tool.id) });
                      } else {
                        updateConfig({ deniedTools: [...config.deniedTools, tool.id] });
                      }
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="settings-group">
        <h2>Elevated Mode</h2>
        <p className="group-description">
          Control how Helix handles operations that require elevated permissions.
        </p>
        <div className="elevated-grid">
          {ELEVATED_MODES.map((mode) => (
            <button
              key={mode.id}
              className={`elevated-option ${config.elevated === mode.id ? 'selected' : ''}`}
              onClick={() => updateConfig({ elevated: mode.id })}
            >
              <span className="mode-label">{mode.label}</span>
              <span className="mode-description">{mode.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2>Sandbox</h2>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">Enable Sandbox</span>
            <span className="settings-item-description">
              Run commands in isolated environment
            </span>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.sandboxEnabled}
              onChange={(e) => updateConfig({ sandboxEnabled: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">Command Timeout</span>
            <span className="settings-item-description">
              Maximum execution time in seconds
            </span>
          </div>
          <input
            type="number"
            className="settings-input settings-input-sm"
            value={config.execTimeout}
            onChange={(e) => updateConfig({ execTimeout: parseInt(e.target.value) || 120 })}
            min={10}
            max={600}
          />
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">Background Execution</span>
            <span className="settings-item-description">
              Allow commands to run in background
            </span>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.backgroundExec}
              onChange={(e) => updateConfig({ backgroundExec: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </section>

      <section className="settings-group">
        <h2>Safe Binaries</h2>
        <p className="group-description">
          Commands that can be executed without sandbox restrictions.
        </p>
        <textarea
          className="settings-textarea"
          placeholder="git&#10;npm&#10;node&#10;python"
          rows={4}
        />
      </section>
    </div>
  );
}
