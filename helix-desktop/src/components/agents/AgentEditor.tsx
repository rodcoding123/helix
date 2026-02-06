/**
 * Agent Management Center - Comprehensive multi-agent management system
 *
 * Three views:
 *   1. Agent List (default) - Grid of agent cards with quick actions
 *   2. Agent Detail - Full configuration editor for a selected agent
 *   3. Create Agent - Modal wizard for provisioning new agents
 *
 * Gateway methods used:
 *   - agents.list    -> Fetch all agents
 *   - agents.add     -> Create a new agent
 *   - agents.delete  -> Remove an agent
 *   - config.patch   -> Persist agent configuration changes
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';
import type { GatewayConfig } from '../../stores/configStore';
import './AgentEditor.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentIdentity {
  displayName?: string;
  persona?: string;
}

interface AgentModelConfig {
  provider: string;
  model: string;
  thinkingLevel: 'off' | 'low' | 'high';
  timeout: number;
}

interface AgentToolsPolicy {
  profile: 'minimal' | 'coding' | 'messaging' | 'full';
  allow: string[];
  deny: string[];
}

interface Agent {
  id: string;
  name: string;
  description?: string;
  identity?: AgentIdentity;
  modelConfig: AgentModelConfig;
  workspace?: string;
  toolsPolicy: AgentToolsPolicy;
  isActive: boolean;
  isDefault?: boolean;
  sessionCount?: number;
  toolsCount?: number;
  createdAt?: string;
  lastUsed?: string;
}

type View = 'list' | 'detail' | 'create';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'google', label: 'Google' },
  { id: 'local', label: 'Local' },
] as const;

const MODELS: Record<string, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  ],
  google: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-pro', label: 'Gemini 2.0 Pro' },
  ],
  local: [
    { id: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
  ],
};

const THINKING_LEVELS = [
  { id: 'off', label: 'Off', desc: 'No extended thinking' },
  { id: 'low', label: 'Low', desc: 'Quick reasoning' },
  { id: 'high', label: 'High', desc: 'Deep analysis' },
] as const;

const TOOLS_PROFILES = [
  { id: 'minimal', label: 'Minimal', desc: 'Read-only tools (Glob, Grep, Read)' },
  { id: 'coding', label: 'Coding', desc: 'Full file system + shell access' },
  { id: 'messaging', label: 'Messaging', desc: 'Channel tools + web access' },
  { id: 'full', label: 'Full', desc: 'All tools enabled' },
] as const;

const ALL_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
  'WebFetch', 'WebSearch', 'Task', 'Skill',
  'mcp__memory', 'mcp__playwright',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a deterministic hue from a string (agent name/id). */
function hashHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/** Friendly model name from model id. */
function friendlyModel(provider: string, modelId: string): string {
  const entry = MODELS[provider]?.find((m) => m.id === modelId);
  if (entry) return entry.label;
  // Fallback: capitalise first portion
  return modelId
    .split('-')
    .slice(0, 3)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

/** Build an Agent from the GatewayConfig agent list entries, falling back to defaults. */
function hydrateAgentsFromConfig(gwConfig: GatewayConfig): Agent[] {
  const defaults = gwConfig.agents?.defaults;
  const list = gwConfig.agents?.list;
  if (!list || list.length === 0) return [];

  return list.map((raw, idx) => ({
    id: raw.id,
    name: raw.name ?? raw.id,
    description: undefined,
    identity: undefined,
    modelConfig: {
      provider: defaults?.provider ?? 'anthropic',
      model: raw.model ?? defaults?.model ?? 'claude-sonnet-4-20250514',
      thinkingLevel: (defaults?.thinkingLevel as 'off' | 'low' | 'high') ?? 'off',
      timeout: defaults?.timeout ?? 120,
    },
    workspace: raw.workspace,
    toolsPolicy: {
      profile: (gwConfig.tools?.profile as AgentToolsPolicy['profile']) ?? 'coding',
      allow: gwConfig.tools?.allow ?? [],
      deny: gwConfig.tools?.deny ?? [],
    },
    isActive: true,
    isDefault: idx === 0,
    sessionCount: 0,
    toolsCount: gwConfig.tools?.allow?.length ?? ALL_TOOLS.length,
    createdAt: undefined,
    lastUsed: undefined,
  }));
}

const defaultAgent = (): Omit<Agent, 'id'> => ({
  name: '',
  description: '',
  identity: { displayName: '', persona: '' },
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    thinkingLevel: 'off',
    timeout: 120,
  },
  workspace: '',
  toolsPolicy: { profile: 'coding', allow: [], deny: [] },
  isActive: true,
  isDefault: false,
  sessionCount: 0,
  toolsCount: 0,
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single agent card displayed in the list grid. */
function AgentCard({
  agent,
  onSelect,
  onToggleActive,
  onDelete,
}: {
  agent: Agent;
  onSelect: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const hue = useMemo(() => hashHue(agent.id + agent.name), [agent.id, agent.name]);
  const avatarGradient = `linear-gradient(135deg, hsl(${hue}, 70%, 45%), hsl(${(hue + 40) % 360}, 60%, 35%))`;

  return (
    <div
      className={`am-card ${agent.isActive ? 'am-card--active' : 'am-card--idle'}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
    >
      {/* Top row: avatar + toggle */}
      <div className="am-card__header">
        <div className="am-card__avatar" style={{ background: avatarGradient }}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="am-card__title-group">
          <span className="am-card__name">{agent.name}</span>
          <span className={`am-card__status ${agent.isActive ? 'am-card__status--active' : 'am-card__status--idle'}`}>
            <span className="am-card__status-dot" />
            {agent.isActive ? 'Active' : 'Idle'}
          </span>
        </div>
        <label
          className="toggle am-card__toggle"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={agent.isActive}
            onChange={(e) => { e.stopPropagation(); onToggleActive(); }}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {/* Model badge */}
      <span className="am-card__model">
        {friendlyModel(agent.modelConfig.provider, agent.modelConfig.model)}
      </span>

      {/* Description */}
      {agent.description && (
        <p className="am-card__desc">{agent.description}</p>
      )}

      {/* Meta row */}
      <div className="am-card__meta">
        {agent.toolsCount != null && (
          <span className="am-card__meta-badge">
            {agent.toolsCount} tools
          </span>
        )}
        {agent.sessionCount != null && agent.sessionCount > 0 && (
          <span className="am-card__meta-badge">
            {agent.sessionCount} sessions
          </span>
        )}
        {agent.workspace && (
          <span className="am-card__meta-badge am-card__meta-badge--path" title={agent.workspace}>
            {agent.workspace.split(/[\\/]/).pop()}
          </span>
        )}
        {agent.isDefault && (
          <span className="am-card__meta-badge am-card__meta-badge--default">Default</span>
        )}
      </div>

      {/* Actions */}
      <div className="am-card__actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn-sm btn-secondary" onClick={onSelect}>Edit</button>
        {!agent.isDefault && (
          <button className="btn-sm btn-danger" onClick={onDelete}>Delete</button>
        )}
      </div>
    </div>
  );
}

/** Agent detail / editor view. */
function AgentDetailView({
  agent,
  onSave,
  onBack,
  onDelete,
  saving,
}: {
  agent: Agent;
  onSave: (updated: Agent) => void;
  onBack: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<Agent>({ ...agent });

  // Keep draft in sync if agent prop changes (e.g. after reload)
  useEffect(() => {
    setDraft({ ...agent });
  }, [agent]);

  const patch = <K extends keyof Agent>(key: K, value: Agent[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };
  const patchModel = <K extends keyof AgentModelConfig>(key: K, value: AgentModelConfig[K]) => {
    setDraft((prev) => ({
      ...prev,
      modelConfig: { ...prev.modelConfig, [key]: value },
    }));
  };
  const patchIdentity = <K extends keyof AgentIdentity>(key: K, value: AgentIdentity[K]) => {
    setDraft((prev) => ({
      ...prev,
      identity: { ...prev.identity, [key]: value },
    }));
  };
  const patchTools = <K extends keyof AgentToolsPolicy>(key: K, value: AgentToolsPolicy[K]) => {
    setDraft((prev) => ({
      ...prev,
      toolsPolicy: { ...prev.toolsPolicy, [key]: value },
    }));
  };

  const currentModels = MODELS[draft.modelConfig.provider] ?? [];
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Allow / deny tag management
  const addAllow = (tool: string) => {
    if (!draft.toolsPolicy.allow.includes(tool)) {
      patchTools('allow', [...draft.toolsPolicy.allow, tool]);
    }
  };
  const removeAllow = (tool: string) => {
    patchTools('allow', draft.toolsPolicy.allow.filter((t) => t !== tool));
  };
  const addDeny = (tool: string) => {
    if (!draft.toolsPolicy.deny.includes(tool)) {
      patchTools('deny', [...draft.toolsPolicy.deny, tool]);
    }
  };
  const removeDeny = (tool: string) => {
    patchTools('deny', draft.toolsPolicy.deny.filter((t) => t !== tool));
  };

  return (
    <div className="am-detail">
      {/* Back bar */}
      <button className="am-detail__back" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to Agents
      </button>

      <div className="am-detail__layout">
        {/* ---- Left column: Identity + Model ---- */}
        <div className="am-detail__col">
          {/* Identity */}
          <section className="am-detail__section">
            <h3 className="am-detail__section-title">Identity</h3>

            <div className="am-detail__field">
              <label className="am-detail__label">Agent Name</label>
              <input
                className="am-detail__input"
                value={draft.name}
                onChange={(e) => patch('name', e.target.value)}
                placeholder="Agent name"
              />
            </div>

            <div className="am-detail__field">
              <label className="am-detail__label">Display Name</label>
              <input
                className="am-detail__input"
                value={draft.identity?.displayName ?? ''}
                onChange={(e) => patchIdentity('displayName', e.target.value)}
                placeholder="Public-facing name"
              />
            </div>

            <div className="am-detail__field">
              <label className="am-detail__label">Persona Description</label>
              <textarea
                className="am-detail__textarea"
                value={draft.identity?.persona ?? ''}
                onChange={(e) => patchIdentity('persona', e.target.value)}
                placeholder="Describe this agent's personality, tone, and behavior..."
                rows={4}
              />
            </div>

            <div className="am-detail__field">
              <label className="am-detail__label">Description</label>
              <input
                className="am-detail__input"
                value={draft.description ?? ''}
                onChange={(e) => patch('description', e.target.value)}
                placeholder="Brief purpose description"
              />
            </div>
          </section>

          {/* Model Configuration */}
          <section className="am-detail__section">
            <h3 className="am-detail__section-title">Model Configuration</h3>

            <div className="am-detail__field">
              <label className="am-detail__label">Provider</label>
              <select
                className="am-detail__select"
                value={draft.modelConfig.provider}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  const firstModel = MODELS[newProvider]?.[0]?.id ?? '';
                  patchModel('provider', newProvider);
                  patchModel('model', firstModel);
                }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="am-detail__field">
              <label className="am-detail__label">Model</label>
              <select
                className="am-detail__select"
                value={draft.modelConfig.model}
                onChange={(e) => patchModel('model', e.target.value)}
              >
                {currentModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="am-detail__field">
              <label className="am-detail__label">Thinking Level</label>
              <div className="am-detail__radio-row">
                {THINKING_LEVELS.map((tl) => (
                  <button
                    key={tl.id}
                    className={`am-detail__radio-btn ${draft.modelConfig.thinkingLevel === tl.id ? 'am-detail__radio-btn--selected' : ''}`}
                    onClick={() => patchModel('thinkingLevel', tl.id)}
                    type="button"
                  >
                    <span className="am-detail__radio-label">{tl.label}</span>
                    <span className="am-detail__radio-desc">{tl.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="am-detail__field">
              <label className="am-detail__label">
                Timeout: {draft.modelConfig.timeout}s
              </label>
              <input
                type="range"
                className="am-detail__slider"
                min={30}
                max={600}
                step={10}
                value={draft.modelConfig.timeout}
                onChange={(e) => patchModel('timeout', parseInt(e.target.value, 10))}
              />
              <div className="am-detail__slider-labels">
                <span>30s</span>
                <span>600s</span>
              </div>
            </div>
          </section>
        </div>

        {/* ---- Right column: Workspace + Tools + Danger ---- */}
        <div className="am-detail__col">
          {/* Workspace */}
          <section className="am-detail__section">
            <h3 className="am-detail__section-title">Workspace</h3>

            <div className="am-detail__field">
              <label className="am-detail__label">Workspace Path</label>
              <input
                className="am-detail__input"
                value={draft.workspace ?? ''}
                onChange={(e) => patch('workspace', e.target.value)}
                placeholder="/path/to/project"
              />
              <span className="am-detail__hint">
                Root directory this agent operates in. Leave empty for unrestricted.
              </span>
            </div>
          </section>

          {/* Tools Policy */}
          <section className="am-detail__section">
            <h3 className="am-detail__section-title">Tools Policy</h3>

            <div className="am-detail__field">
              <label className="am-detail__label">Profile</label>
              <div className="am-detail__profile-grid">
                {TOOLS_PROFILES.map((tp) => (
                  <button
                    key={tp.id}
                    className={`am-detail__profile-btn ${draft.toolsPolicy.profile === tp.id ? 'am-detail__profile-btn--selected' : ''}`}
                    onClick={() => patchTools('profile', tp.id)}
                    type="button"
                  >
                    <span className="am-detail__profile-name">{tp.label}</span>
                    <span className="am-detail__profile-desc">{tp.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom allow list */}
            <div className="am-detail__field">
              <label className="am-detail__label">Allow List</label>
              <div className="am-detail__tag-list">
                {draft.toolsPolicy.allow.map((t) => (
                  <span key={t} className="am-detail__tag am-detail__tag--allow">
                    {t}
                    <button className="am-detail__tag-rm" onClick={() => removeAllow(t)} type="button">&times;</button>
                  </span>
                ))}
                <select
                  className="am-detail__tag-add"
                  value=""
                  onChange={(e) => { if (e.target.value) addAllow(e.target.value); }}
                >
                  <option value="">+ Add tool</option>
                  {ALL_TOOLS.filter((t) => !draft.toolsPolicy.allow.includes(t)).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom deny list */}
            <div className="am-detail__field">
              <label className="am-detail__label">Deny List</label>
              <div className="am-detail__tag-list">
                {draft.toolsPolicy.deny.map((t) => (
                  <span key={t} className="am-detail__tag am-detail__tag--deny">
                    {t}
                    <button className="am-detail__tag-rm" onClick={() => removeDeny(t)} type="button">&times;</button>
                  </span>
                ))}
                <select
                  className="am-detail__tag-add"
                  value=""
                  onChange={(e) => { if (e.target.value) addDeny(e.target.value); }}
                >
                  <option value="">+ Add tool</option>
                  {ALL_TOOLS.filter((t) => !draft.toolsPolicy.deny.includes(t)).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Status + Danger zone */}
          <section className="am-detail__section">
            <h3 className="am-detail__section-title">Status</h3>

            <div className="am-detail__field am-detail__field--row">
              <div>
                <span className="am-detail__label">Active</span>
                <span className="am-detail__hint">Enable or disable this agent</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={() => patch('isActive', !draft.isActive)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {!agent.isDefault && (
              <div className="am-detail__danger-zone">
                {!showDeleteConfirm ? (
                  <button
                    className="btn-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    type="button"
                  >
                    Delete Agent
                  </button>
                ) : (
                  <div className="am-detail__delete-confirm">
                    <span className="am-detail__delete-warn">
                      Are you sure? This cannot be undone.
                    </span>
                    <div className="am-detail__delete-btns">
                      <button
                        className="btn-sm btn-secondary"
                        onClick={() => setShowDeleteConfirm(false)}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-sm btn-danger"
                        onClick={onDelete}
                        type="button"
                      >
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="am-detail__save-bar">
        <button className="btn-secondary" onClick={onBack} type="button">Cancel</button>
        <button
          className="btn-primary"
          onClick={() => onSave(draft)}
          disabled={!draft.name.trim() || saving}
          type="button"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

/** Create Agent modal / wizard. */
function CreateAgentModal({
  onSubmit,
  onClose,
  submitting,
}: {
  onSubmit: (data: { name: string; model: string; workspace: string; description: string }) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [workspace, setWorkspace] = useState('');
  const [description, setDescription] = useState('');

  const currentModels = MODELS[provider] ?? [];

  return (
    <div className="am-modal-overlay" onClick={onClose}>
      <div className="am-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="am-modal__title">Create New Agent</h3>

        <div className="am-modal__field">
          <label className="am-detail__label">
            Name <span className="am-modal__required">*</span>
          </label>
          <input
            className="am-detail__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Code Reviewer"
            autoFocus
          />
        </div>

        <div className="am-modal__field">
          <label className="am-detail__label">Provider</label>
          <select
            className="am-detail__select"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setModel(MODELS[e.target.value]?.[0]?.id ?? '');
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="am-modal__field">
          <label className="am-detail__label">Model</label>
          <select
            className="am-detail__select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {currentModels.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="am-modal__field">
          <label className="am-detail__label">Workspace Directory</label>
          <input
            className="am-detail__input"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            placeholder="/path/to/project (optional)"
          />
        </div>

        <div className="am-modal__field">
          <label className="am-detail__label">Description</label>
          <textarea
            className="am-detail__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this agent's purpose?"
            rows={3}
          />
        </div>

        <div className="am-modal__actions">
          <button className="btn-secondary" onClick={onClose} type="button">Cancel</button>
          <button
            className="btn-primary"
            onClick={() => onSubmit({ name, model, workspace, description })}
            disabled={!name.trim() || submitting}
            type="button"
          >
            {submitting ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main: AgentManager (default view)
// ---------------------------------------------------------------------------

export function AgentManager() {
  const { getClient, connected } = useGateway();
  const { gatewayConfig, patchGatewayConfig, fetchConfig } = useGatewayConfig();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ------ Load agents ------
  const loadAgents = useCallback(async () => {
    setError(null);
    const client = getClient();

    if (client?.connected) {
      try {
        const result = await client.request<{ agents: Agent[] }>('agents.list');
        if (result.agents && result.agents.length > 0) {
          setAgents(result.agents);
          setLoading(false);
          return;
        }
      } catch {
        // Fall through to config-based hydration
      }
    }

    // Hydrate from gatewayConfig if available
    if (gatewayConfig?.agents) {
      const hydrated = hydrateAgentsFromConfig(gatewayConfig);
      if (hydrated.length > 0) {
        setAgents(hydrated);
        setLoading(false);
        return;
      }
    }

    // Empty state
    setAgents([]);
    setLoading(false);
  }, [getClient, gatewayConfig]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // ------ Actions ------
  const toggleActive = useCallback(async (id: string) => {
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;

    const newState = !agent.isActive;
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, isActive: newState } : a)));

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('config.patch', {
          patch: { agents: { list: agents.map((a) => (a.id === id ? { ...a, isActive: newState } : a)) } },
        });
      } catch {
        // Revert optimistic update
        setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, isActive: !newState } : a)));
      }
    }
  }, [agents, getClient]);

  const deleteAgent = useCallback(async (id: string) => {
    const agent = agents.find((a) => a.id === id);
    if (!agent || agent.isDefault) return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('agents.delete', { agentId: id });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete agent');
        return;
      }
    }

    setAgents((prev) => prev.filter((a) => a.id !== id));
    if (view === 'detail' && selectedAgentId === id) {
      setView('list');
      setSelectedAgentId(null);
    }
  }, [agents, getClient, view, selectedAgentId]);

  const saveAgent = useCallback(async (updated: Agent) => {
    setSaving(true);
    setError(null);

    const client = getClient();
    if (client?.connected) {
      try {
        await patchGatewayConfig({
          agents: {
            ...gatewayConfig.agents,
            list: agents.map((a) =>
              a.id === updated.id
                ? { id: updated.id, name: updated.name, model: updated.modelConfig.model, workspace: updated.workspace }
                : { id: a.id, name: a.name, model: a.modelConfig.model, workspace: a.workspace }
            ),
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save agent');
        setSaving(false);
        return;
      }
    }

    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSaving(false);
    setView('list');
    setSelectedAgentId(null);
  }, [agents, getClient, gatewayConfig, patchGatewayConfig]);

  const createAgent = useCallback(async (data: { name: string; model: string; workspace: string; description: string }) => {
    if (!data.name.trim()) return;
    setSubmitting(true);
    setError(null);

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('agents.add', {
          name: data.name,
          model: data.model,
          workspace: data.workspace || undefined,
        });
        setShowCreate(false);
        await fetchConfig();
        await loadAgents();
        setSubmitting(false);
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create agent');
        setSubmitting(false);
        return;
      }
    }

    // Offline local-only creation
    const newAgent: Agent = {
      ...defaultAgent(),
      id: `agent-${Date.now()}`,
      name: data.name,
      description: data.description,
      modelConfig: {
        provider: 'anthropic',
        model: data.model,
        thinkingLevel: 'off',
        timeout: 120,
      },
      workspace: data.workspace || undefined,
    };
    setAgents((prev) => [...prev, newAgent]);
    setShowCreate(false);
    setSubmitting(false);
  }, [getClient, fetchConfig, loadAgents]);

  // ------ Derived ------
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  // ------ Not connected ------
  if (!connected && agents.length === 0 && !loading) {
    return (
      <div className="am-disconnected">
        <div className="am-disconnected__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
          </svg>
        </div>
        <h3 className="am-disconnected__title">Gateway Not Connected</h3>
        <p className="am-disconnected__desc">
          Start the gateway to manage your agents. Agent configuration requires an active gateway connection.
        </p>
      </div>
    );
  }

  // ------ Loading ------
  if (loading) {
    return (
      <div className="am-loading">
        <div className="am-loading__spinner" />
        <span>Loading agents...</span>
      </div>
    );
  }

  // ------ Detail view ------
  if (view === 'detail' && selectedAgent) {
    return (
      <div className="agent-manager">
        {error && <div className="am-error">{error}</div>}
        <AgentDetailView
          agent={selectedAgent}
          onSave={saveAgent}
          onBack={() => { setView('list'); setSelectedAgentId(null); }}
          onDelete={() => deleteAgent(selectedAgent.id)}
          saving={saving}
        />
      </div>
    );
  }

  // ------ List view (default) ------
  return (
    <div className="agent-manager">
      <header className="am-header">
        <div className="am-header__text">
          <h2 className="am-header__title">Agents</h2>
          <p className="am-header__subtitle">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          + Add Agent
        </button>
      </header>

      {error && <div className="am-error">{error}</div>}

      {agents.length === 0 ? (
        <div className="am-empty">
          <div className="am-empty__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 014 4v2a4 4 0 01-8 0V6a4 4 0 014-4z"/>
              <path d="M16 14H8a4 4 0 00-4 4v2h16v-2a4 4 0 00-4-4z"/>
            </svg>
          </div>
          <h3 className="am-empty__title">No Agents Configured</h3>
          <p className="am-empty__desc">Create your first agent to get started with multi-agent workflows.</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            Create Your First Agent
          </button>
        </div>
      ) : (
        <div className="am-grid">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onSelect={() => {
                setSelectedAgentId(agent.id);
                setView('detail');
              }}
              onToggleActive={() => toggleActive(agent.id)}
              onDelete={() => deleteAgent(agent.id)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAgentModal
          onSubmit={createAgent}
          onClose={() => setShowCreate(false)}
          submitting={submitting}
        />
      )}
    </div>
  );
}

// Backwards compatibility alias
export const AgentEditor = AgentManager;
