/**
 * AgentSkillConfig - Per-agent skill configuration panel
 *
 * Shows all available skills (from gateway skills.list) and allows:
 *   - Three-state override per skill: Default / Enabled / Disabled
 *   - Per-skill environment variable overrides for this agent
 *   - Persists via patchGatewayConfig into the agent's skill config
 *
 * Reads current agent skill config from gatewayConfig._raw?.agents?.list
 * Saves to: agents.list[].skills.{enabled, disabled, env}
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';

/* =====================================================================
   Types
   ===================================================================== */

interface AgentSkillConfigProps {
  agentId: string;
  agentName: string;
  onClose?: () => void;
}

interface SkillInfo {
  name: string;
  description?: string;
  version?: string;
  enabled: boolean;
  builtin: boolean;
  requirements?: {
    bins?: string[];
    env?: string[];
    os?: string[];
    config?: string[];
  };
  requirementsMet: boolean;
  icon?: string;
}

/** The three possible override states for a skill on a given agent. */
type SkillOverride = 'default' | 'enabled' | 'disabled';

/** Shape of a single agent's persisted skill config. */
interface AgentSkillsConfig {
  enabled?: string[];
  disabled?: string[];
  env?: Record<string, Record<string, string>>;
}

/* =====================================================================
   Icon helper (mirrors SkillsSettings)
   ===================================================================== */

const SKILL_ICONS: Record<string, string> = {
  commit: '\u{1F527}',
  'code-review': '\u{1F4DD}',
  gmail: '\u{1F4E7}',
  browser: '\u{1F310}',
  exec: '\u{1F4BB}',
  memory: '\u{1F9E0}',
  cron: '\u23F0',
  'image-gen': '\u{1F3A8}',
  translation: '\u{1F30D}',
  calendar: '\u{1F4C5}',
  github: '\u{1F419}',
  notion: '\u{1F4DD}',
  'github-pr': '\u{1F419}',
  'linear-issues': '\u{1F4CB}',
  'slack-notify': '\u{1F4E2}',
  'jira-sync': '\u{1F4CA}',
  'analytics-report': '\u{1F4CA}',
  'docker-manage': '\u{1F433}',
  'pdf-reader': '\u{1F4C4}',
};

function getSkillIcon(name: string, icon?: string): string {
  if (icon) return icon;
  return SKILL_ICONS[name] ?? '\u2699\uFE0F';
}

/* =====================================================================
   Helpers
   ===================================================================== */

/**
 * Resolve the current override state for a skill given the persisted config.
 */
function resolveOverride(skillName: string, config: AgentSkillsConfig | undefined): SkillOverride {
  if (config?.enabled?.includes(skillName)) return 'enabled';
  if (config?.disabled?.includes(skillName)) return 'disabled';
  return 'default';
}

/**
 * Build a clean AgentSkillsConfig from the working state maps.
 */
function buildAgentSkillsConfig(
  overrides: Record<string, SkillOverride>,
  envOverrides: Record<string, Record<string, string>>
): AgentSkillsConfig {
  const enabled: string[] = [];
  const disabled: string[] = [];

  for (const [name, state] of Object.entries(overrides)) {
    if (state === 'enabled') enabled.push(name);
    if (state === 'disabled') disabled.push(name);
  }

  // Only include env entries that have at least one non-empty value
  const env: Record<string, Record<string, string>> = {};
  for (const [skillName, vars] of Object.entries(envOverrides)) {
    const cleaned: Record<string, string> = {};
    let hasValue = false;
    for (const [key, val] of Object.entries(vars)) {
      if (val.trim()) {
        cleaned[key] = val;
        hasValue = true;
      }
    }
    if (hasValue) {
      env[skillName] = cleaned;
    }
  }

  const result: AgentSkillsConfig = {};
  if (enabled.length > 0) result.enabled = enabled;
  if (disabled.length > 0) result.disabled = disabled;
  if (Object.keys(env).length > 0) result.env = env;
  return result;
}

/**
 * Extract the current agent's skill config from the raw gateway config.
 */
function extractAgentSkillsConfig(
  rawConfig: Record<string, unknown> | undefined,
  agentId: string
): AgentSkillsConfig | undefined {
  if (!rawConfig) return undefined;

  const agents = rawConfig.agents as
    | { list?: Array<{ id: string; skills?: AgentSkillsConfig }> }
    | undefined;

  if (!agents?.list) return undefined;

  const agentEntry = agents.list.find(a => a.id === agentId);
  return agentEntry?.skills;
}

/* =====================================================================
   Component
   ===================================================================== */

export function AgentSkillConfig({ agentId, agentName, onClose }: AgentSkillConfigProps) {
  const { getClient, connected } = useGateway();
  const { gatewayConfig, patchGatewayConfig } = useGatewayConfig();

  // -- State --
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // Per-skill override state: skillName -> 'default' | 'enabled' | 'disabled'
  const [overrides, setOverrides] = useState<Record<string, SkillOverride>>({});

  // Per-skill env var overrides: skillName -> { VAR_NAME: value }
  const [envOverrides, setEnvOverrides] = useState<Record<string, Record<string, string>>>({});

  // Track which skills have their env section expanded
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());

  // Track which env values are unmasked
  const [visibleEnvKeys, setVisibleEnvKeys] = useState<Set<string>>(new Set());

  // -- Load skills from gateway --
  const loadSkills = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const result = (await client.request('skills.list')) as {
        skills?: SkillInfo[];
      };
      if (result.skills) {
        setSkills(result.skills);
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills, connected]);

  // -- Initialize overrides from existing agent config --
  useEffect(() => {
    const existingConfig = extractAgentSkillsConfig(gatewayConfig._raw, agentId);

    if (existingConfig && skills.length > 0) {
      const initialOverrides: Record<string, SkillOverride> = {};
      for (const skill of skills) {
        initialOverrides[skill.name] = resolveOverride(skill.name, existingConfig);
      }
      setOverrides(initialOverrides);

      // Initialize env overrides from existing config
      if (existingConfig.env) {
        setEnvOverrides({ ...existingConfig.env });
      }
    }
  }, [gatewayConfig._raw, agentId, skills]);

  // -- Toggle expanded env section --
  const toggleExpanded = useCallback((skillName: string) => {
    setExpandedSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillName)) {
        next.delete(skillName);
      } else {
        next.add(skillName);
      }
      return next;
    });
  }, []);

  // -- Toggle env value visibility --
  const toggleEnvVisibility = useCallback((compositeKey: string) => {
    setVisibleEnvKeys(prev => {
      const next = new Set(prev);
      if (next.has(compositeKey)) {
        next.delete(compositeKey);
      } else {
        next.add(compositeKey);
      }
      return next;
    });
  }, []);

  // -- Update an env var override --
  const updateEnvVar = useCallback((skillName: string, varName: string, value: string) => {
    setEnvOverrides(prev => ({
      ...prev,
      [skillName]: {
        ...(prev[skillName] ?? {}),
        [varName]: value,
      },
    }));
  }, []);

  // -- Save --
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus('idle');
    setSaveMessage('');

    try {
      const agentSkillsConfig = buildAgentSkillsConfig(overrides, envOverrides);

      // Read the current agents list from raw config
      const rawAgents = gatewayConfig._raw?.agents as
        | { list?: Array<Record<string, unknown>> }
        | undefined;

      const currentList: Array<Record<string, unknown>> = rawAgents?.list ?? [];

      // Update or append the agent entry with the new skills config
      let found = false;
      const updatedList = currentList.map(entry => {
        if ((entry as { id: string }).id === agentId) {
          found = true;
          return { ...entry, skills: agentSkillsConfig };
        }
        return entry;
      });

      if (!found) {
        updatedList.push({ id: agentId, skills: agentSkillsConfig });
      }

      await patchGatewayConfig({
        agents: {
          ...((gatewayConfig._raw?.agents as Record<string, unknown>) ?? {}),
          list: updatedList,
        },
      });

      setSaveStatus('saved');
      setSaveMessage('Skill configuration saved successfully');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveMessage('');
      }, 3000);
    } catch (err) {
      console.error('Failed to save agent skill config:', err);
      setSaveStatus('error');
      setSaveMessage(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }, [overrides, envOverrides, agentId, gatewayConfig._raw, patchGatewayConfig]);

  // -- Summary statistics --
  const summary = useMemo(() => {
    let enabledCount = 0;
    let overriddenCount = 0;
    let envVarCount = 0;

    for (const skill of skills) {
      const override = overrides[skill.name] ?? 'default';

      // Count skills that are effectively enabled for this agent
      if (override === 'enabled') {
        enabledCount++;
        overriddenCount++;
      } else if (override === 'disabled') {
        overriddenCount++;
      } else {
        // default: follows global
        if (skill.enabled) {
          enabledCount++;
        }
      }
    }

    for (const vars of Object.values(envOverrides)) {
      for (const val of Object.values(vars)) {
        if (val.trim()) envVarCount++;
      }
    }

    return { enabledCount, overriddenCount, envVarCount };
  }, [skills, overrides, envOverrides]);

  // -- Effective status label --
  const getEffectiveStatus = useCallback(
    (skill: SkillInfo): { text: string; cls: string } => {
      const override = overrides[skill.name] ?? 'default';
      if (override === 'enabled') return { text: 'Force Enabled', cls: 'asc-status-force-on' };
      if (override === 'disabled') return { text: 'Force Disabled', cls: 'asc-status-force-off' };
      // default follows global
      if (skill.enabled) return { text: 'Enabled (global)', cls: 'asc-status-global-on' };
      return { text: 'Disabled (global)', cls: 'asc-status-global-off' };
    },
    [overrides]
  );

  // =====================================================================
  // RENDER
  // =====================================================================

  return (
    <div className="asc-root">
      <style>{agentSkillConfigStyles}</style>

      {/* -- Header -- */}
      <header className="asc-header">
        <div className="asc-header-left">
          <h2 className="asc-title">Skills for {agentName}</h2>
          <span className="asc-agent-id">{agentId}</span>
        </div>
        {onClose && (
          <button className="asc-close-btn" onClick={onClose} title="Close" type="button">
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </header>

      {/* -- Disconnected banner -- */}
      {!connected && (
        <div className="asc-banner asc-banner-warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. Skill configuration requires an active connection.
        </div>
      )}

      {/* -- Content -- */}
      <div className="asc-content">
        {loading ? (
          <div className="asc-loading">
            <div className="asc-spinner" />
            <span>Loading skills...</span>
          </div>
        ) : error ? (
          <div className="asc-error">
            <span>Failed to load skills: {error}</span>
            <button
              className="asc-btn asc-btn-secondary asc-btn-sm"
              onClick={loadSkills}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : skills.length === 0 ? (
          <div className="asc-empty">
            <span className="asc-empty-icon">{'\u{1F4E6}'}</span>
            <p>No skills available. Install skills from the Skills Dashboard.</p>
          </div>
        ) : (
          <div className="asc-skills-list">
            {skills.map(skill => {
              const override = overrides[skill.name] ?? 'default';
              const effectiveStatus = getEffectiveStatus(skill);
              const isExpanded = expandedSkills.has(skill.name);
              const hasEnvRequirements =
                skill.requirements?.env && skill.requirements.env.length > 0;

              return (
                <div
                  key={skill.name}
                  className={`asc-skill-row ${isExpanded ? 'asc-skill-row-expanded' : ''}`}
                >
                  {/* Main row */}
                  <div
                    className="asc-skill-main"
                    onClick={() => {
                      if (hasEnvRequirements) {
                        toggleExpanded(skill.name);
                      }
                    }}
                  >
                    {/* Icon + name */}
                    <div className="asc-skill-identity">
                      <span className="asc-skill-icon">{getSkillIcon(skill.name, skill.icon)}</span>
                      <div className="asc-skill-info">
                        <span className="asc-skill-name">{skill.name}</span>
                        {skill.description && (
                          <span className="asc-skill-desc">{skill.description}</span>
                        )}
                      </div>
                    </div>

                    {/* Global status indicator */}
                    <div className="asc-skill-global-status">
                      <span
                        className={`asc-skill-global-dot ${skill.enabled ? 'asc-dot-on' : 'asc-dot-off'}`}
                      />
                      <span className="asc-skill-global-label">
                        {skill.enabled ? 'Global: On' : 'Global: Off'}
                      </span>
                    </div>

                    {/* Three-state override toggle */}
                    <div className="asc-override-toggle" onClick={e => e.stopPropagation()}>
                      <button
                        className={`asc-override-btn ${override === 'default' ? 'asc-override-active' : ''}`}
                        onClick={() =>
                          setOverrides(prev => ({
                            ...prev,
                            [skill.name]: 'default',
                          }))
                        }
                        title="Follow global setting"
                        type="button"
                      >
                        Default
                      </button>
                      <button
                        className={`asc-override-btn asc-override-on ${override === 'enabled' ? 'asc-override-active' : ''}`}
                        onClick={() =>
                          setOverrides(prev => ({
                            ...prev,
                            [skill.name]: 'enabled',
                          }))
                        }
                        title="Force enable for this agent"
                        type="button"
                      >
                        Enabled
                      </button>
                      <button
                        className={`asc-override-btn asc-override-off ${override === 'disabled' ? 'asc-override-active' : ''}`}
                        onClick={() =>
                          setOverrides(prev => ({
                            ...prev,
                            [skill.name]: 'disabled',
                          }))
                        }
                        title="Force disable for this agent"
                        type="button"
                      >
                        Disabled
                      </button>
                    </div>

                    {/* Effective status */}
                    <span className={`asc-effective-status ${effectiveStatus.cls}`}>
                      {effectiveStatus.text}
                    </span>

                    {/* Expand chevron (only if has env) */}
                    {hasEnvRequirements && (
                      <button
                        className={`asc-expand-btn ${isExpanded ? 'asc-expand-btn-open' : ''}`}
                        onClick={e => {
                          e.stopPropagation();
                          toggleExpanded(skill.name);
                        }}
                        title="Environment variables"
                        type="button"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Expanded env section */}
                  {isExpanded && hasEnvRequirements && (
                    <div className="asc-env-section">
                      <div className="asc-env-header">
                        <span className="asc-env-title">Environment Variable Overrides</span>
                        <span className="asc-env-hint">
                          Override env vars for this agent only. Leave empty to use the global
                          value.
                        </span>
                      </div>
                      <div className="asc-env-fields">
                        {skill.requirements!.env!.map(varName => {
                          const compositeKey = `${skill.name}:${varName}`;
                          const currentValue = envOverrides[skill.name]?.[varName] ?? '';
                          const isVisible = visibleEnvKeys.has(compositeKey);

                          return (
                            <div key={varName} className="asc-env-field">
                              <label className="asc-env-label">{varName}</label>
                              <div className="asc-env-input-wrapper">
                                <input
                                  type={isVisible ? 'text' : 'password'}
                                  className="asc-env-input"
                                  value={currentValue}
                                  onChange={e => updateEnvVar(skill.name, varName, e.target.value)}
                                  placeholder={`Override ${varName} for this agent`}
                                  spellCheck={false}
                                  autoComplete="off"
                                />
                                <button
                                  className="asc-env-toggle-vis"
                                  onClick={() => toggleEnvVisibility(compositeKey)}
                                  title={isVisible ? 'Hide value' : 'Show value'}
                                  type="button"
                                >
                                  {isVisible ? (
                                    <svg
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      width="14"
                                      height="14"
                                    >
                                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                      <path
                                        fillRule="evenodd"
                                        d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  ) : (
                                    <svg
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      width="14"
                                      height="14"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                                        clipRule="evenodd"
                                      />
                                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -- Save bar + summary footer -- */}
      <footer className="asc-footer">
        <div className="asc-footer-left">
          <span className="asc-summary">
            {summary.enabledCount} skill{summary.enabledCount !== 1 ? 's' : ''} enabled,{' '}
            {summary.overriddenCount} overridden, {summary.envVarCount} env var
            {summary.envVarCount !== 1 ? 's' : ''} configured
          </span>
          {saveStatus === 'saved' && (
            <span className="asc-save-ok">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {saveMessage}
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="asc-save-err">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {saveMessage}
            </span>
          )}
        </div>
        <div className="asc-footer-right">
          {!connected && <span className="asc-gateway-badge">Gateway offline</span>}
          <button
            className="asc-btn asc-btn-primary"
            onClick={handleSave}
            disabled={saving || !connected}
            type="button"
          >
            {saving ? (
              <>
                <div className="asc-btn-spinner" />
                Saving...
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                </svg>
                Save Configuration
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default AgentSkillConfig;

/* =====================================================================
   Scoped styles (asc- prefix)
   ===================================================================== */

const agentSkillConfigStyles = `
/* -- Root -- */
.asc-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary, #0a0a1a);
  color: var(--text-primary, #fff);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  overflow: hidden;
}

/* -- Header -- */
.asc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--bg-secondary, #111127);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.asc-header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.asc-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.asc-agent-id {
  font-size: 11px;
  color: var(--text-tertiary, #606080);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
}

.asc-close-btn {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.asc-close-btn:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

/* -- Banner -- */
.asc-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  font-size: 12px;
  flex-shrink: 0;
}

.asc-banner-warn {
  background: rgba(245, 158, 11, 0.1);
  border-bottom: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* -- Content -- */
.asc-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.asc-content::-webkit-scrollbar {
  width: 6px;
}

.asc-content::-webkit-scrollbar-track {
  background: transparent;
}

.asc-content::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
}

.asc-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.2);
}

/* -- Loading / Error / Empty -- */
.asc-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: var(--text-tertiary, #606080);
}

.asc-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: asc-spin 0.8s linear infinite;
}

@keyframes asc-spin {
  to { transform: rotate(360deg); }
}

.asc-error {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  margin: 16px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 13px;
}

.asc-empty {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-tertiary, #606080);
}

.asc-empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 12px;
  opacity: 0.5;
}

.asc-empty p {
  font-size: 13px;
  margin: 0;
}

/* -- Skills list -- */
.asc-skills-list {
  display: flex;
  flex-direction: column;
}

/* -- Skill row -- */
.asc-skill-row {
  border-bottom: 1px solid rgba(255,255,255,0.06);
  transition: background 0.15s ease;
}

.asc-skill-row:hover {
  background: rgba(255,255,255,0.02);
}

.asc-skill-row-expanded {
  background: rgba(99, 102, 241, 0.03);
}

.asc-skill-main {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: default;
  min-height: 52px;
}

/* -- Skill identity (icon + name + desc) -- */
.asc-skill-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.asc-skill-icon {
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
  width: 28px;
  text-align: center;
}

.asc-skill-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.asc-skill-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asc-skill-desc {
  font-size: 11px;
  color: var(--text-tertiary, #606080);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

/* -- Global status indicator -- */
.asc-skill-global-status {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  min-width: 90px;
}

.asc-skill-global-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.asc-dot-on {
  background: #10b981;
}

.asc-dot-off {
  background: #606080;
}

.asc-skill-global-label {
  font-size: 11px;
  color: var(--text-tertiary, #606080);
  white-space: nowrap;
}

/* -- Three-state override toggle -- */
.asc-override-toggle {
  display: flex;
  gap: 0;
  background: var(--bg-primary, #0a0a1a);
  border-radius: 6px;
  padding: 2px;
  border: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.asc-override-btn {
  padding: 4px 10px;
  background: transparent;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  font-family: inherit;
}

.asc-override-btn:hover {
  color: var(--text-secondary, #a0a0c0);
  background: rgba(255,255,255,0.04);
}

.asc-override-active {
  color: #fff !important;
  background: var(--accent-color, #6366f1) !important;
}

.asc-override-on.asc-override-active {
  background: #10b981 !important;
}

.asc-override-off.asc-override-active {
  background: #ef4444 !important;
}

/* -- Effective status badge -- */
.asc-effective-status {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 100px;
  text-align: center;
}

.asc-status-force-on {
  color: #34d399;
  background: rgba(16, 185, 129, 0.15);
}

.asc-status-force-off {
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
}

.asc-status-global-on {
  color: var(--text-secondary, #a0a0c0);
  background: rgba(255, 255, 255, 0.04);
}

.asc-status-global-off {
  color: var(--text-tertiary, #606080);
  background: rgba(255, 255, 255, 0.02);
}

/* -- Expand chevron -- */
.asc-expand-btn {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.asc-expand-btn:hover {
  color: var(--text-secondary, #a0a0c0);
  background: rgba(255,255,255,0.06);
}

.asc-expand-btn svg {
  transition: transform 0.2s ease;
}

.asc-expand-btn-open svg {
  transform: rotate(180deg);
}

/* -- Env section (expanded) -- */
.asc-env-section {
  padding: 0 20px 16px 58px;
  animation: asc-slide-down 0.2s ease;
}

@keyframes asc-slide-down {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.asc-env-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 10px;
}

.asc-env-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary, #606080);
}

.asc-env-hint {
  font-size: 10px;
  color: var(--text-tertiary, #606080);
  opacity: 0.7;
}

.asc-env-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.asc-env-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.asc-env-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
}

.asc-env-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.asc-env-input-wrapper:focus-within {
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
}

.asc-env-input {
  flex: 1;
  padding: 6px 10px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--text-primary, #fff);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  outline: none;
}

.asc-env-input::placeholder {
  color: var(--text-tertiary, #606080);
  font-family: inherit;
}

.asc-env-toggle-vis {
  background: none;
  border: none;
  border-left: 1px solid rgba(255,255,255,0.08);
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background 0.15s ease;
}

.asc-env-toggle-vis:hover {
  color: var(--text-secondary, #a0a0c0);
  background: rgba(255,255,255,0.04);
}

/* -- Footer -- */
.asc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-secondary, #111127);
  border-top: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
  gap: 12px;
}

.asc-footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
}

.asc-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.asc-summary {
  font-size: 11px;
  color: var(--text-tertiary, #606080);
}

.asc-save-ok {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #34d399;
}

.asc-save-err {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #f87171;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asc-gateway-badge {
  font-size: 10px;
  color: var(--text-tertiary, #606080);
  padding: 2px 6px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 3px;
  white-space: nowrap;
}

/* -- Buttons -- */
.asc-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  font-family: inherit;
  line-height: 1;
}

.asc-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.asc-btn-primary {
  background: var(--accent-color, #6366f1);
  color: #fff;
}

.asc-btn-primary:hover:not(:disabled) {
  background: #818cf8;
  box-shadow: 0 2px 8px rgba(99,102,241,0.35);
}

.asc-btn-secondary {
  background: rgba(255,255,255,0.06);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255,255,255,0.08);
}

.asc-btn-secondary:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
  color: var(--text-primary, #fff);
}

.asc-btn-sm {
  padding: 5px 10px;
  font-size: 11px;
}

.asc-btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: asc-spin 0.6s linear infinite;
}

/* -- Responsive -- */
@media (max-width: 768px) {
  .asc-skill-main {
    flex-wrap: wrap;
    gap: 8px;
  }

  .asc-skill-identity {
    flex-basis: 100%;
  }

  .asc-skill-global-status {
    min-width: auto;
  }

  .asc-effective-status {
    min-width: auto;
  }

  .asc-env-section {
    padding-left: 20px;
  }

  .asc-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .asc-footer-right {
    justify-content: flex-end;
  }
}
`;
