/**
 * Skills Dashboard - Comprehensive skill management with ClawHub integration
 *
 * Two tabs:
 *   1. Installed - Skills from the gateway (skills.list), with enable/disable, configure, update, uninstall
 *   2. ClawHub   - Browse the community registry (mock data for now), install new skills
 *
 * Clicking any skill card opens a detail modal with full information and actions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './SettingsSection.css';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

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
  gating?: string[];
  hasUpdate?: boolean;
  latestVersion?: string;
  icon?: string;
}

interface ClawHubSkill {
  name: string;
  description: string;
  author: string;
  version: string;
  rating: number;
  downloads: number;
  category: ClawHubCategory;
  installed: boolean;
}

type Tab = 'installed' | 'clawhub';
type InstalledFilter = 'all' | 'enabled' | 'builtin' | 'plugins';
type ClawHubCategory = 'Development' | 'Communication' | 'Productivity' | 'Automation' | 'AI';

const CLAWHUB_CATEGORIES: ClawHubCategory[] = [
  'Development',
  'Communication',
  'Productivity',
  'Automation',
  'AI',
];

/* ═══════════════════════════════════════════
   Icon helper
   ═══════════════════════════════════════════ */

const SKILL_ICONS: Record<string, string> = {
  commit: '\uD83D\uDD27',
  'code-review': '\uD83D\uDCDD',
  gmail: '\uD83D\uDCE7',
  browser: '\uD83C\uDF10',
  exec: '\uD83D\uDCBB',
  memory: '\uD83E\uDDE0',
  cron: '\u23F0',
  'image-gen': '\uD83C\uDFA8',
  translation: '\uD83C\uDF0D',
  calendar: '\uD83D\uDCC5',
  github: '\uD83D\uDC19',
  notion: '\uD83D\uDCDD',
  'github-pr': '\uD83D\uDC19',
  'linear-issues': '\uD83D\uDCCB',
  'slack-notify': '\uD83D\uDCE2',
  'jira-sync': '\uD83D\uDCCA',
  'analytics-report': '\uD83D\uDCCA',
  'docker-manage': '\uD83D\uDC33',
  'pdf-reader': '\uD83D\uDCC4',
};

function getSkillIcon(name: string, icon?: string): string {
  if (icon) return icon;
  return SKILL_ICONS[name] ?? '\u2699\uFE0F';
}

/* ═══════════════════════════════════════════
   ClawHub mock registry
   ═══════════════════════════════════════════ */

const CLAWHUB_SKILLS: ClawHubSkill[] = [
  {
    name: 'github-pr',
    description: 'Create and manage GitHub pull requests with auto-review support',
    author: 'openclaw',
    version: '2.1.0',
    rating: 4.8,
    downloads: 12500,
    category: 'Development',
    installed: false,
  },
  {
    name: 'linear-issues',
    description: 'Create and track Linear issues directly from conversations',
    author: 'openclaw',
    version: '1.3.0',
    rating: 4.6,
    downloads: 8200,
    category: 'Development',
    installed: false,
  },
  {
    name: 'slack-notify',
    description: 'Send notifications to Slack channels and DMs',
    author: 'community',
    version: '1.1.0',
    rating: 4.4,
    downloads: 5600,
    category: 'Communication',
    installed: false,
  },
  {
    name: 'jira-sync',
    description: 'Sync with Jira projects, boards, and sprint planning',
    author: 'atlassian',
    version: '1.0.0',
    rating: 4.2,
    downloads: 3400,
    category: 'Development',
    installed: false,
  },
  {
    name: 'analytics-report',
    description: 'Generate analytics dashboards and usage reports',
    author: 'specterops',
    version: '1.5.0',
    rating: 4.5,
    downloads: 4500,
    category: 'Productivity',
    installed: false,
  },
  {
    name: 'docker-manage',
    description: 'Manage Docker containers, images, and compose stacks',
    author: 'openclaw',
    version: '1.2.0',
    rating: 4.7,
    downloads: 9800,
    category: 'Automation',
    installed: false,
  },
  {
    name: 'pdf-reader',
    description: 'Read, extract text, and summarize PDF documents',
    author: 'community',
    version: '2.0.0',
    rating: 4.3,
    downloads: 7100,
    category: 'Productivity',
    installed: false,
  },
  {
    name: 'image-gen',
    description: 'Generate images with DALL-E 3 and Stable Diffusion XL',
    author: 'openclaw',
    version: '1.4.0',
    rating: 4.9,
    downloads: 15000,
    category: 'AI',
    installed: false,
  },
];

/* ═══════════════════════════════════════════
   Formatting helpers
   ═══════════════════════════════════════════ */

function formatDownloads(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let s = '\u2605'.repeat(full);
  if (half) s += '\u00BD';
  return s;
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function SkillsSettings() {
  const { getClient, connected } = useGateway();

  // ── state ──
  const [activeTab, setActiveTab] = useState<Tab>('installed');
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [installedFilter, setInstalledFilter] = useState<InstalledFilter>('all');
  const [clawHubCategory, setClawHubCategory] = useState<ClawHubCategory | 'all'>('all');
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [selectedClawHubSkill, setSelectedClawHubSkill] = useState<ClawHubSkill | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── load skills from gateway ──
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

  // ── gateway actions ──
  const toggleSkill = useCallback(
    async (name: string, currentEnabled: boolean) => {
      setActionLoading(name);
      // optimistic
      setSkills((prev) =>
        prev.map((s) => (s.name === name ? { ...s, enabled: !currentEnabled } : s))
      );

      const client = getClient();
      if (client?.connected) {
        try {
          await client.request('skills.toggle', { name, enabled: !currentEnabled });
        } catch {
          // revert
          setSkills((prev) =>
            prev.map((s) => (s.name === name ? { ...s, enabled: currentEnabled } : s))
          );
        }
      }
      setActionLoading(null);
    },
    [getClient]
  );

  const uninstallSkill = useCallback(
    async (name: string) => {
      setActionLoading(name);
      const client = getClient();
      if (client?.connected) {
        try {
          await client.request('skills.uninstall', { name });
          setSkills((prev) => prev.filter((s) => s.name !== name));
          setSelectedSkill(null);
        } catch (err) {
          console.error('Failed to uninstall skill:', err);
        }
      }
      setActionLoading(null);
    },
    [getClient]
  );

  const updateSkill = useCallback(
    async (name: string) => {
      setActionLoading(name);
      const client = getClient();
      if (client?.connected) {
        try {
          await client.request('skills.update', { name });
          await loadSkills();
          setSelectedSkill(null);
        } catch (err) {
          console.error('Failed to update skill:', err);
        }
      }
      setActionLoading(null);
    },
    [getClient, loadSkills]
  );

  const installSkill = useCallback(
    async (name: string, version?: string) => {
      setActionLoading(name);
      const client = getClient();
      if (client?.connected) {
        try {
          await client.request('skills.install', { name, version });
          await loadSkills();
          setSelectedClawHubSkill(null);
        } catch (err) {
          console.error('Failed to install skill:', err);
        }
      }
      setActionLoading(null);
    },
    [getClient, loadSkills]
  );

  // ── derived data ──
  const installedNames = useMemo(() => new Set(skills.map((s) => s.name)), [skills]);

  const filteredSkills = useMemo(() => {
    let list = skills;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q)
      );
    }
    switch (installedFilter) {
      case 'enabled':
        return list.filter((s) => s.enabled);
      case 'builtin':
        return list.filter((s) => s.builtin);
      case 'plugins':
        return list.filter((s) => !s.builtin);
      default:
        return list;
    }
  }, [skills, searchQuery, installedFilter]);

  const filteredClawHub = useMemo(() => {
    let list = CLAWHUB_SKILLS.map((s) => ({
      ...s,
      installed: installedNames.has(s.name),
    }));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.author.toLowerCase().includes(q)
      );
    }
    if (clawHubCategory !== 'all') {
      list = list.filter((s) => s.category === clawHubCategory);
    }
    return list;
  }, [searchQuery, clawHubCategory, installedNames]);

  const enabledCount = skills.filter((s) => s.enabled).length;
  const builtinCount = skills.filter((s) => s.builtin).length;

  // ── status helpers ──
  function getStatusLabel(skill: SkillInfo): { text: string; cls: string } {
    if (!skill.requirementsMet) return { text: 'Needs setup', cls: 'sk-status-warn' };
    if (skill.enabled) return { text: 'Enabled', cls: 'sk-status-ok' };
    return { text: 'Disabled', cls: 'sk-status-off' };
  }

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  return (
    <div className="settings-section">
      {/* ── Inline styles ── */}
      <style>{skillsDashboardStyles}</style>

      {/* ── Header ── */}
      <header className="settings-section-header">
        <h1>Skills</h1>
        <p className="settings-section-description">
          Manage capabilities, install from ClawHub
        </p>
      </header>

      {/* ── Tab bar + search ── */}
      <div className="sk-toolbar">
        <div className="sk-tabs">
          <button
            className={`sk-tab ${activeTab === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            Installed
            {skills.length > 0 && <span className="sk-tab-count">{skills.length}</span>}
          </button>
          <button
            className={`sk-tab ${activeTab === 'clawhub' ? 'active' : ''}`}
            onClick={() => setActiveTab('clawhub')}
          >
            ClawHub
          </button>
        </div>
        <div className="sk-search">
          <svg className="sk-search-icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            placeholder={activeTab === 'installed' ? 'Search installed skills...' : 'Search ClawHub...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sk-search-input"
          />
          {searchQuery && (
            <button className="sk-search-clear" onClick={() => setSearchQuery('')}>
              x
            </button>
          )}
        </div>
      </div>

      {/* ── Disconnected banner ── */}
      {!connected && (
        <div className="sk-banner sk-banner-warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. Skill management requires an active gateway connection.
        </div>
      )}

      {/* ═══ INSTALLED TAB ═══ */}
      {activeTab === 'installed' && (
        <>
          {/* Filters */}
          <div className="sk-filters">
            {(
              [
                ['all', `All (${skills.length})`],
                ['enabled', `Enabled (${enabledCount})`],
                ['builtin', `Built-in (${builtinCount})`],
                ['plugins', `Plugins (${skills.length - builtinCount})`],
              ] as [InstalledFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                className={`sk-filter-btn ${installedFilter === key ? 'active' : ''}`}
                onClick={() => setInstalledFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="sk-loading">
              <div className="sk-spinner" />
              <span>Loading skills...</span>
            </div>
          ) : error ? (
            <div className="sk-error">
              <span>Failed to load skills: {error}</span>
              <button className="btn-sm btn-secondary" onClick={loadSkills}>
                Retry
              </button>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="sk-empty">
              <span className="sk-empty-icon">{searchQuery ? '\uD83D\uDD0D' : '\uD83D\uDCE6'}</span>
              <p>
                {searchQuery
                  ? `No skills matching "${searchQuery}"`
                  : installedFilter !== 'all'
                    ? 'No skills in this category'
                    : 'No skills installed. Browse ClawHub to get started.'}
              </p>
              {!searchQuery && installedFilter === 'all' && (
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setActiveTab('clawhub')}
                >
                  Browse ClawHub
                </button>
              )}
            </div>
          ) : (
            <div className="sk-grid">
              {filteredSkills.map((skill) => {
                const status = getStatusLabel(skill);
                return (
                  <div
                    key={skill.name}
                    className={`sk-card ${skill.enabled ? 'sk-card-enabled' : ''}`}
                    onClick={() => setSelectedSkill(skill)}
                  >
                    <div className="sk-card-head">
                      <span className="sk-card-icon">{getSkillIcon(skill.name, skill.icon)}</span>
                      <div className="sk-card-info">
                        <span className="sk-card-name">{skill.name}</span>
                        <div className="sk-card-meta">
                          {skill.version && (
                            <span className="sk-card-version">v{skill.version}</span>
                          )}
                          <span className={`sk-card-status ${status.cls}`}>{status.text}</span>
                        </div>
                      </div>
                      <label
                        className="toggle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={skill.enabled}
                          disabled={!skill.requirementsMet}
                          onChange={() => toggleSkill(skill.name, skill.enabled)}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                    <p className="sk-card-desc">
                      {skill.description ?? 'No description available'}
                    </p>
                    <div className="sk-card-foot">
                      <div className="sk-card-badges">
                        {skill.builtin && <span className="badge builtin">Built-in</span>}
                        {skill.hasUpdate && (
                          <span className="sk-badge-update">Update available</span>
                        )}
                        {!skill.requirementsMet && (
                          <span className="badge setup">Setup required</span>
                        )}
                      </div>
                      <button
                        className="btn-sm btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSkill(skill);
                        }}
                      >
                        {skill.requirementsMet ? 'Configure' : 'Setup'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ CLAWHUB TAB ═══ */}
      {activeTab === 'clawhub' && (
        <>
          <p className="sk-clawhub-intro">
            Browse and install skills from the OpenClaw community registry.
          </p>

          {/* Category filter */}
          <div className="sk-filters">
            <button
              className={`sk-filter-btn ${clawHubCategory === 'all' ? 'active' : ''}`}
              onClick={() => setClawHubCategory('all')}
            >
              All
            </button>
            {CLAWHUB_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`sk-filter-btn ${clawHubCategory === cat ? 'active' : ''}`}
                onClick={() => setClawHubCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {filteredClawHub.length === 0 ? (
            <div className="sk-empty">
              <span className="sk-empty-icon">{'\uD83D\uDD0D'}</span>
              <p>No skills found matching your search.</p>
            </div>
          ) : (
            <div className="sk-grid">
              {filteredClawHub.map((skill) => (
                <div
                  key={skill.name}
                  className={`sk-card sk-card-hub ${skill.installed ? 'sk-card-installed' : ''}`}
                  onClick={() => setSelectedClawHubSkill(skill)}
                >
                  <div className="sk-card-head">
                    <span className="sk-card-icon">{getSkillIcon(skill.name)}</span>
                    <div className="sk-card-info">
                      <span className="sk-card-name">{skill.name}</span>
                      <span className="sk-card-author">by @{skill.author}</span>
                    </div>
                  </div>
                  <p className="sk-card-desc">{skill.description}</p>
                  <div className="sk-card-foot">
                    <div className="sk-card-stats">
                      <span className="sk-card-rating" title={`${skill.rating}/5`}>
                        {renderStars(skill.rating)} {skill.rating}
                      </span>
                      <span className="sk-card-downloads">
                        {formatDownloads(skill.downloads)} downloads
                      </span>
                    </div>
                    {skill.installed ? (
                      <span className="sk-badge-installed">Installed</span>
                    ) : (
                      <button
                        className="btn-sm btn-primary"
                        disabled={!connected || actionLoading === skill.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          installSkill(skill.name, skill.version);
                        }}
                      >
                        {actionLoading === skill.name ? 'Installing...' : 'Install'}
                      </button>
                    )}
                  </div>
                  <span className="sk-card-category">{skill.category}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ SKILL DETAIL MODAL (installed) ═══ */}
      {selectedSkill && (
        <div className="sk-modal-overlay" onClick={() => setSelectedSkill(null)}>
          <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sk-modal-header">
              <div className="sk-modal-title-row">
                <span className="sk-modal-icon">{getSkillIcon(selectedSkill.name, selectedSkill.icon)}</span>
                <div>
                  <h3 className="sk-modal-name">{selectedSkill.name}</h3>
                  <div className="sk-modal-version-row">
                    {selectedSkill.version && (
                      <span className="sk-modal-version">v{selectedSkill.version}</span>
                    )}
                    {selectedSkill.hasUpdate && selectedSkill.latestVersion && (
                      <span className="sk-badge-update">
                        v{selectedSkill.latestVersion} available
                      </span>
                    )}
                    {selectedSkill.builtin && <span className="badge builtin">Built-in</span>}
                  </div>
                </div>
              </div>
              <button className="sk-modal-close" onClick={() => setSelectedSkill(null)}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <p className="sk-modal-desc">
              {selectedSkill.description ?? 'No description available.'}
            </p>

            {/* Status toggle */}
            <div className="sk-modal-section">
              <div className="sk-modal-row">
                <span className="sk-modal-label">Enabled</span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={selectedSkill.enabled}
                    disabled={!selectedSkill.requirementsMet}
                    onChange={() => {
                      toggleSkill(selectedSkill.name, selectedSkill.enabled);
                      setSelectedSkill((prev) =>
                        prev ? { ...prev, enabled: !prev.enabled } : null
                      );
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            {/* Requirements */}
            {selectedSkill.requirements && (
              <div className="sk-modal-section">
                <h4 className="sk-modal-section-title">Requirements</h4>
                {selectedSkill.requirements.bins && selectedSkill.requirements.bins.length > 0 && (
                  <div className="sk-modal-req">
                    <span className="sk-modal-req-label">Binaries</span>
                    <div className="sk-modal-req-items">
                      {selectedSkill.requirements.bins.map((bin) => (
                        <code key={bin} className="sk-modal-req-item">{bin}</code>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSkill.requirements.env && selectedSkill.requirements.env.length > 0 && (
                  <div className="sk-modal-req">
                    <span className="sk-modal-req-label">Environment Variables</span>
                    <div className="sk-modal-req-items">
                      {selectedSkill.requirements.env.map((v) => (
                        <code key={v} className="sk-modal-req-item">{v}</code>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSkill.requirements.os && selectedSkill.requirements.os.length > 0 && (
                  <div className="sk-modal-req">
                    <span className="sk-modal-req-label">Operating Systems</span>
                    <div className="sk-modal-req-items">
                      {selectedSkill.requirements.os.map((o) => (
                        <code key={o} className="sk-modal-req-item">{o}</code>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSkill.requirements.config && selectedSkill.requirements.config.length > 0 && (
                  <div className="sk-modal-req">
                    <span className="sk-modal-req-label">Configuration</span>
                    <div className="sk-modal-req-items">
                      {selectedSkill.requirements.config.map((c) => (
                        <code key={c} className="sk-modal-req-item">{c}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Gating status */}
            {selectedSkill.gating && selectedSkill.gating.length > 0 && (
              <div className="sk-modal-section">
                <h4 className="sk-modal-section-title">Gating</h4>
                <div className="sk-modal-gating">
                  {selectedSkill.gating.map((g) => (
                    <div key={g} className="sk-modal-gating-item">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="sk-modal-actions">
              {selectedSkill.hasUpdate && (
                <button
                  className="btn-primary btn-sm"
                  disabled={actionLoading === selectedSkill.name}
                  onClick={() => updateSkill(selectedSkill.name)}
                >
                  {actionLoading === selectedSkill.name ? 'Updating...' : 'Update'}
                </button>
              )}
              {!selectedSkill.builtin && (
                <button
                  className="btn-danger btn-sm"
                  disabled={actionLoading === selectedSkill.name}
                  onClick={() => uninstallSkill(selectedSkill.name)}
                >
                  {actionLoading === selectedSkill.name ? 'Removing...' : 'Uninstall'}
                </button>
              )}
              <button
                className="btn-secondary btn-sm"
                onClick={() => setSelectedSkill(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CLAWHUB DETAIL MODAL ═══ */}
      {selectedClawHubSkill && (
        <div className="sk-modal-overlay" onClick={() => setSelectedClawHubSkill(null)}>
          <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sk-modal-header">
              <div className="sk-modal-title-row">
                <span className="sk-modal-icon">{getSkillIcon(selectedClawHubSkill.name)}</span>
                <div>
                  <h3 className="sk-modal-name">{selectedClawHubSkill.name}</h3>
                  <div className="sk-modal-version-row">
                    <span className="sk-modal-version">v{selectedClawHubSkill.version}</span>
                    <span className="sk-card-author">by @{selectedClawHubSkill.author}</span>
                  </div>
                </div>
              </div>
              <button
                className="sk-modal-close"
                onClick={() => setSelectedClawHubSkill(null)}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <p className="sk-modal-desc">{selectedClawHubSkill.description}</p>

            <div className="sk-modal-section">
              <div className="sk-modal-stats-grid">
                <div className="sk-modal-stat">
                  <span className="sk-modal-stat-label">Rating</span>
                  <span className="sk-modal-stat-value">
                    {renderStars(selectedClawHubSkill.rating)} {selectedClawHubSkill.rating}/5
                  </span>
                </div>
                <div className="sk-modal-stat">
                  <span className="sk-modal-stat-label">Downloads</span>
                  <span className="sk-modal-stat-value">
                    {selectedClawHubSkill.downloads.toLocaleString()}
                  </span>
                </div>
                <div className="sk-modal-stat">
                  <span className="sk-modal-stat-label">Category</span>
                  <span className="sk-modal-stat-value">{selectedClawHubSkill.category}</span>
                </div>
                <div className="sk-modal-stat">
                  <span className="sk-modal-stat-label">Author</span>
                  <span className="sk-modal-stat-value">@{selectedClawHubSkill.author}</span>
                </div>
              </div>
            </div>

            <div className="sk-modal-actions">
              {selectedClawHubSkill.installed ? (
                <span className="sk-badge-installed">Already installed</span>
              ) : (
                <button
                  className="btn-primary btn-sm"
                  disabled={!connected || actionLoading === selectedClawHubSkill.name}
                  onClick={() =>
                    installSkill(selectedClawHubSkill.name, selectedClawHubSkill.version)
                  }
                >
                  {actionLoading === selectedClawHubSkill.name ? 'Installing...' : 'Install'}
                </button>
              )}
              <button
                className="btn-secondary btn-sm"
                onClick={() => setSelectedClawHubSkill(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Scoped styles (sk- prefix)
   ═══════════════════════════════════════════ */

const skillsDashboardStyles = `
/* ── Toolbar ── */
.sk-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.sk-tabs {
  display: flex;
  gap: 0;
  background: var(--bg-primary, #0a0a1a);
  border-radius: 8px;
  padding: 3px;
  border: 1px solid rgba(255,255,255,0.08);
}

.sk-tab {
  padding: 0.5rem 1.125rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sk-tab:hover {
  color: var(--text-primary, #fff);
}

.sk-tab.active {
  background: var(--accent-color, #6366f1);
  color: white;
}

.sk-tab-count {
  font-size: 0.6875rem;
  background: rgba(255,255,255,0.15);
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
  font-weight: 600;
}

.sk-tab.active .sk-tab-count {
  background: rgba(255,255,255,0.25);
}

/* ── Search ── */
.sk-search {
  flex: 1;
  min-width: 200px;
  position: relative;
}

.sk-search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary, #606080);
  pointer-events: none;
}

.sk-search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  outline: none;
  transition: border-color 0.15s ease;
}

.sk-search-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.sk-search-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.sk-search-clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.sk-search-clear:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

/* ── Filters ── */
.sk-filters {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.sk-filter-btn {
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sk-filter-btn:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.12);
}

.sk-filter-btn.active {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  color: white;
}

/* ── Banner ── */
.sk-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

.sk-banner-warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* ── Grid ── */
.sk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

/* ── Card ── */
.sk-card {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.sk-card:hover {
  border-color: rgba(255,255,255,0.15);
  box-shadow: 0 4px 20px rgba(0,0,0,0.2), 0 0 0 1px rgba(99,102,241,0.1);
  transform: translateY(-1px);
}

.sk-card-enabled {
  border-color: rgba(99, 102, 241, 0.3);
}

.sk-card-enabled:hover {
  border-color: rgba(99, 102, 241, 0.5);
}

.sk-card-installed {
  border-color: rgba(16, 185, 129, 0.3);
}

.sk-card-head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
}

.sk-card-icon {
  font-size: 1.75rem;
  line-height: 1;
  flex-shrink: 0;
}

.sk-card-info {
  flex: 1;
  min-width: 0;
}

.sk-card-name {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--text-primary, #fff);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sk-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.125rem;
}

.sk-card-version {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  font-family: var(--font-mono, monospace);
}

.sk-card-status {
  font-size: 0.6875rem;
  font-weight: 600;
}

.sk-status-ok {
  color: var(--success, #10b981);
}

.sk-status-warn {
  color: var(--warning, #f59e0b);
}

.sk-status-off {
  color: var(--text-tertiary, #606080);
}

.sk-card-author {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.sk-card-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0 0.75rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sk-card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sk-card-badges {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.sk-badge-update {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
  border-radius: 3px;
  text-transform: uppercase;
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
}

.sk-badge-installed {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.sk-card-stats {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sk-card-rating {
  font-size: 0.75rem;
  color: #fbbf24;
}

.sk-card-downloads {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

.sk-card-category {
  position: absolute;
  top: 0.625rem;
  right: 0.625rem;
  font-size: 0.5625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  background: rgba(255,255,255,0.04);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

/* ── ClawHub intro ── */
.sk-clawhub-intro {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0 1rem;
}

/* ── Loading / Error / Empty ── */
.sk-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-tertiary, #606080);
}

.sk-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: sk-spin 0.8s linear infinite;
}

@keyframes sk-spin {
  to { transform: rotate(360deg); }
}

.sk-error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 0.8125rem;
}

.sk-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-tertiary, #606080);
}

.sk-empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.75rem;
  opacity: 0.5;
}

.sk-empty p {
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

/* ═══ Modal ═══ */
.sk-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 1000);
  animation: sk-fade-in 0.15s ease;
}

@keyframes sk-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.sk-modal {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 1.5rem;
  width: 90%;
  max-width: 520px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99,102,241,0.1);
  animation: sk-modal-in 0.2s ease;
}

@keyframes sk-modal-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.sk-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.sk-modal-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sk-modal-icon {
  font-size: 2rem;
  line-height: 1;
}

.sk-modal-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.sk-modal-version-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.sk-modal-version {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  font-family: var(--font-mono, monospace);
}

.sk-modal-close {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.sk-modal-close:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

.sk-modal-desc {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  line-height: 1.5;
  margin: 0 0 1.25rem;
}

/* ── Modal sections ── */
.sk-modal-section {
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  margin-bottom: 0.75rem;
}

.sk-modal-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  margin: 0 0 0.75rem;
}

.sk-modal-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sk-modal-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

/* Requirements */
.sk-modal-req {
  margin-bottom: 0.75rem;
}

.sk-modal-req:last-child {
  margin-bottom: 0;
}

.sk-modal-req-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
  margin-bottom: 0.375rem;
}

.sk-modal-req-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.sk-modal-req-item {
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  padding: 0.1875rem 0.5rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  color: var(--text-secondary, #a0a0c0);
}

/* Gating */
.sk-modal-gating {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sk-modal-gating-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #fbbf24;
}

/* Stats grid (ClawHub modal) */
.sk-modal-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.sk-modal-stat {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sk-modal-stat-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
}

.sk-modal-stat-value {
  font-size: 0.875rem;
  color: var(--text-primary, #fff);
}

/* Actions */
.sk-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255,255,255,0.06);
}
`;
