/**
 * Skills Settings - Manage installed skills and plugins
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './SettingsSection.css';

interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  version: string;
  enabled: boolean;
  builtin: boolean;
  requiresSetup: boolean;
  configured: boolean;
}

const AVAILABLE_SKILLS: Skill[] = [
  { id: 'gmail', name: 'Gmail', icon: '📧', description: 'Read, compose, and manage emails', version: '1.0.0', enabled: false, builtin: false, requiresSetup: true, configured: false },
  { id: 'calendar', name: 'Google Calendar', icon: '📅', description: 'Manage events and scheduling', version: '1.0.0', enabled: false, builtin: false, requiresSetup: true, configured: false },
  { id: 'github', name: 'GitHub', icon: '🐙', description: 'Manage repos, issues, and PRs', version: '1.0.0', enabled: false, builtin: false, requiresSetup: true, configured: false },
  { id: 'notion', name: 'Notion', icon: '📝', description: 'Create and manage Notion pages', version: '1.0.0', enabled: false, builtin: false, requiresSetup: true, configured: false },
  { id: 'browser', name: 'Browser Automation', icon: '🌐', description: 'Control web browsers', version: '1.0.0', enabled: true, builtin: true, requiresSetup: false, configured: true },
  { id: 'exec', name: 'Shell Commands', icon: '💻', description: 'Execute terminal commands', version: '1.0.0', enabled: true, builtin: true, requiresSetup: false, configured: true },
  { id: 'memory', name: 'Long-term Memory', icon: '🧠', description: 'Remember context over time', version: '1.0.0', enabled: true, builtin: true, requiresSetup: false, configured: true },
  { id: 'cron', name: 'Scheduled Tasks', icon: '⏰', description: 'Run automated tasks', version: '1.0.0', enabled: true, builtin: true, requiresSetup: false, configured: true },
  { id: 'image-gen', name: 'Image Generation', icon: '🎨', description: 'Generate images with DALL-E', version: '1.0.0', enabled: false, builtin: false, requiresSetup: true, configured: false },
  { id: 'translation', name: 'Translation', icon: '🌍', description: 'Translate between languages', version: '1.0.0', enabled: true, builtin: true, requiresSetup: false, configured: true },
];

export function SkillsSettings() {
  const { getClient } = useGateway();
  const [skills, setSkills] = useState<Skill[]>(AVAILABLE_SKILLS);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'builtin' | 'plugins'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      return;
    }

    try {
      const result = await client.request('skills.status') as { skills: Skill[] };
      if (result.skills) {
        setSkills(result.skills);
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = async (skillId: string) => {
    const skill = skills.find(s => s.id === skillId);
    if (!skill) return;

    // Update local state
    setSkills(prev => prev.map(s =>
      s.id === skillId ? { ...s, enabled: !s.enabled } : s
    ));

    // Sync with gateway
    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('skills.toggle', { skillId, enabled: !skill.enabled });
      } catch (err) {
        console.error('Failed to toggle skill:', err);
        // Revert on error
        setSkills(prev => prev.map(s =>
          s.id === skillId ? { ...s, enabled: skill.enabled } : s
        ));
      }
    }
  };

  const configureSkill = (skillId: string) => {
    // TODO: Open skill configuration modal
    console.log('Configure skill:', skillId);
  };

  const filteredSkills = skills.filter(skill => {
    if (searchQuery && !skill.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    switch (filter) {
      case 'enabled': return skill.enabled;
      case 'builtin': return skill.builtin;
      case 'plugins': return !skill.builtin;
      default: return true;
    }
  });

  const enabledCount = skills.filter(s => s.enabled).length;
  const builtinCount = skills.filter(s => s.builtin).length;

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Skills</h1>
        <p className="settings-section-description">
          Manage Helix's capabilities through skills and plugins.
        </p>
      </header>

      <div className="skills-toolbar">
        <div className="skills-search">
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="settings-input"
          />
        </div>
        <div className="skills-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({skills.length})
          </button>
          <button
            className={`filter-btn ${filter === 'enabled' ? 'active' : ''}`}
            onClick={() => setFilter('enabled')}
          >
            Enabled ({enabledCount})
          </button>
          <button
            className={`filter-btn ${filter === 'builtin' ? 'active' : ''}`}
            onClick={() => setFilter('builtin')}
          >
            Built-in ({builtinCount})
          </button>
          <button
            className={`filter-btn ${filter === 'plugins' ? 'active' : ''}`}
            onClick={() => setFilter('plugins')}
          >
            Plugins ({skills.length - builtinCount})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="settings-loading">Loading skills...</div>
      ) : (
        <div className="skills-grid">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className={`skill-card ${skill.enabled ? 'enabled' : ''} ${skill.builtin ? 'builtin' : ''}`}
            >
              <div className="skill-header">
                <span className="skill-icon">{skill.icon}</span>
                <div className="skill-info">
                  <span className="skill-name">{skill.name}</span>
                  <div className="skill-badges">
                    {skill.builtin && <span className="badge builtin">Built-in</span>}
                    {skill.requiresSetup && !skill.configured && (
                      <span className="badge setup">Setup required</span>
                    )}
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={() => toggleSkill(skill.id)}
                    disabled={skill.requiresSetup && !skill.configured}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
              <p className="skill-description">{skill.description}</p>
              <div className="skill-footer">
                <span className="skill-version">v{skill.version}</span>
                {skill.requiresSetup && (
                  <button
                    className="btn-sm btn-secondary"
                    onClick={() => configureSkill(skill.id)}
                  >
                    {skill.configured ? 'Configure' : 'Setup'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="settings-group">
        <h2>Install New Skill</h2>
        <div className="install-skill">
          <input
            type="text"
            className="settings-input"
            placeholder="npm package name or path..."
          />
          <button className="btn-primary">Install</button>
        </div>
        <p className="group-description">
          Install skills from npm, local paths, or archives.
        </p>
      </section>
    </div>
  );
}
