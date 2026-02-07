/**
 * Skills Dashboard
 *
 * Unified view for managing installed skills, browsing ClawHub marketplace,
 * and configuring per-agent skill overrides.
 *
 * Features:
 * - Installed skills grid with enable/disable toggles
 * - ClawHub marketplace browser with search/filter
 * - Quick install/uninstall/update actions
 * - Category filtering and search
 * - Skill detail view with configuration
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, RefreshCw, Package, Store, Settings2 } from 'lucide-react';
import { getGatewayClient } from '../../lib/gateway-client';
import { getClawHubClient } from '../../lib/clawhub-client';
import type { ClawHubSkill } from '../../lib/clawhub-client';
import { SkillCard, type SkillCardSkill } from './SkillCard';

type Tab = 'installed' | 'marketplace';
type InstalledFilter = 'all' | 'enabled' | 'disabled' | 'builtin' | 'plugins';

interface InstalledSkill {
  name: string;
  description?: string;
  version?: string;
  enabled: boolean;
  builtin: boolean;
  icon?: string;
  requirementsMet?: boolean;
  hasUpdate?: boolean;
  latestVersion?: string;
}

export function SkillsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('installed');
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [marketplaceSkills, setMarketplaceSkills] = useState<ClawHubSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [installedFilter, setInstalledFilter] = useState<InstalledFilter>('all');
  const [marketplaceCategory, setMarketplaceCategory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  // Load installed skills from gateway
  const loadInstalledSkills = useCallback(async () => {
    try {
      const client = getGatewayClient();
      if (!client?.connected) return;

      const result = (await client.request('skills.status', {})) as {
        skills?: Array<{
          name: string;
          description?: string;
          version?: string;
          enabled: boolean;
          builtin?: boolean;
          icon?: string;
          requirementsMet?: boolean;
        }>;
      };

      if (result?.skills) {
        setInstalledSkills(
          result.skills.map((s) => ({
            name: s.name,
            description: s.description,
            version: s.version,
            enabled: s.enabled,
            builtin: s.builtin ?? false,
            icon: s.icon,
            requirementsMet: s.requirementsMet,
          }))
        );
      }
    } catch (err) {
      console.error('[skills-dashboard] Failed to load installed skills:', err);
    }
  }, []);

  // Load marketplace skills from ClawHub
  const loadMarketplaceSkills = useCallback(async () => {
    try {
      const clawhub = getClawHubClient();
      const result = await clawhub.search({
        query: searchQuery || undefined,
        category: marketplaceCategory !== 'all' ? (marketplaceCategory as any) : undefined,
        limit: 50,
      });

      if (result?.skills) {
        setMarketplaceSkills(result.skills);
      }
    } catch (err) {
      console.error('[skills-dashboard] Failed to load marketplace:', err);
    }
  }, [searchQuery, marketplaceCategory]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([loadInstalledSkills(), loadMarketplaceSkills()])
      .finally(() => setLoading(false));
  }, [loadInstalledSkills, loadMarketplaceSkills]);

  // Toggle skill enabled state
  const handleToggle = useCallback(async (name: string, enabled: boolean) => {
    try {
      const client = getGatewayClient();
      if (!client?.connected) return;

      await client.request('config.patch', {
        patch: { [`skills.${name}.enabled`]: enabled },
      });

      setInstalledSkills((prev) =>
        prev.map((s) => (s.name === name ? { ...s, enabled } : s))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle skill');
    }
  }, []);

  // Install skill from marketplace
  const handleInstall = useCallback(async (name: string) => {
    const client = getGatewayClient();
    if (!client?.connected) throw new Error('Gateway not connected');

    await client.request('skills.install', { name });
    await loadInstalledSkills();
  }, [loadInstalledSkills]);

  // Uninstall skill
  const handleUninstall = useCallback(async (name: string) => {
    const client = getGatewayClient();
    if (!client?.connected) throw new Error('Gateway not connected');

    await client.request('skills.uninstall', { name });
    setInstalledSkills((prev) => prev.filter((s) => s.name !== name));
  }, []);

  // Update skill
  const handleUpdate = useCallback(async (name: string) => {
    const client = getGatewayClient();
    if (!client?.connected) throw new Error('Gateway not connected');

    await client.request('skills.update', { name });
    await loadInstalledSkills();
  }, [loadInstalledSkills]);

  // Filter installed skills
  const filteredInstalled = useMemo(() => {
    let filtered = installedSkills;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      );
    }

    switch (installedFilter) {
      case 'enabled':
        return filtered.filter((s) => s.enabled);
      case 'disabled':
        return filtered.filter((s) => !s.enabled);
      case 'builtin':
        return filtered.filter((s) => s.builtin);
      case 'plugins':
        return filtered.filter((s) => !s.builtin);
      default:
        return filtered;
    }
  }, [installedSkills, searchQuery, installedFilter]);

  // Map marketplace skills with install status
  const marketplaceWithStatus = useMemo(() => {
    const installedNames = new Set(installedSkills.map((s) => s.name));
    return marketplaceSkills.map((s) => ({
      ...s,
      installed: installedNames.has(s.name),
    }));
  }, [marketplaceSkills, installedSkills]);

  const installedCount = installedSkills.length;
  const enabledCount = installedSkills.filter((s) => s.enabled).length;

  return (
    <div className="skills-dashboard">
      <style>{skillsDashboardStyles}</style>

      {/* Header */}
      <div className="sd-header">
        <div className="sd-header-info">
          <h2>Skills</h2>
          <p className="sd-stats">
            {enabledCount} enabled / {installedCount} installed
          </p>
        </div>
        <button
          className="sd-refresh"
          onClick={() => {
            setLoading(true);
            Promise.all([loadInstalledSkills(), loadMarketplaceSkills()])
              .finally(() => setLoading(false));
          }}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="sd-tabs">
        <button
          className={`sd-tab ${activeTab === 'installed' ? 'active' : ''}`}
          onClick={() => setActiveTab('installed')}
        >
          <Package className="w-4 h-4" />
          Installed ({installedCount})
        </button>
        <button
          className={`sd-tab ${activeTab === 'marketplace' ? 'active' : ''}`}
          onClick={() => setActiveTab('marketplace')}
        >
          <Store className="w-4 h-4" />
          ClawHub Marketplace
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="sd-toolbar">
        <div className="sd-search">
          <Search className="w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'installed' ? 'Search installed skills...' : 'Search ClawHub...'}
          />
        </div>

        {activeTab === 'installed' ? (
          <div className="sd-filters">
            <Filter className="w-3.5 h-3.5" />
            {(['all', 'enabled', 'disabled', 'builtin', 'plugins'] as InstalledFilter[]).map(
              (filter) => (
                <button
                  key={filter}
                  className={`sd-filter-btn ${installedFilter === filter ? 'active' : ''}`}
                  onClick={() => setInstalledFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              )
            )}
          </div>
        ) : (
          <div className="sd-filters">
            <Filter className="w-3.5 h-3.5" />
            {['all', 'Development', 'Communication', 'Productivity', 'Automation', 'AI', 'Integration'].map(
              (cat) => (
                <button
                  key={cat}
                  className={`sd-filter-btn ${marketplaceCategory === cat ? 'active' : ''}`}
                  onClick={() => setMarketplaceCategory(cat)}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              )
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="sd-error">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Skills Grid */}
      <div className="sd-grid">
        {activeTab === 'installed' ? (
          filteredInstalled.length === 0 ? (
            <div className="sd-empty">
              <Settings2 className="w-8 h-8" />
              <p>No skills match your filter</p>
            </div>
          ) : (
            filteredInstalled.map((skill) => (
              <SkillCard
                key={skill.name}
                skill={skill as SkillCardSkill}
                variant="installed"
                onToggle={handleToggle}
                onUninstall={handleUninstall}
                onUpdate={skill.hasUpdate ? handleUpdate : undefined}
              />
            ))
          )
        ) : marketplaceWithStatus.length === 0 ? (
          <div className="sd-empty">
            <Store className="w-8 h-8" />
            <p>{loading ? 'Loading marketplace...' : 'No skills found'}</p>
          </div>
        ) : (
          marketplaceWithStatus.map((skill) => (
            <SkillCard
              key={skill.name}
              skill={{
                name: skill.name,
                description: skill.description,
                version: skill.version,
                enabled: false,
                builtin: false,
                icon: skill.icon,
                author: skill.author,
                rating: skill.rating,
                downloads: skill.downloads,
                category: skill.category,
                tags: skill.tags,
                installed: skill.installed,
              }}
              variant="marketplace"
              onInstall={!skill.installed ? handleInstall : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}

const skillsDashboardStyles = `
.skills-dashboard {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.sd-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.sd-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
}

.sd-stats {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  margin: 0.25rem 0 0;
}

.sd-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 6px;
  color: #818cf8;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;
}

.sd-refresh:hover { background: rgba(99, 102, 241, 0.2); }
.sd-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

.sd-tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 1rem;
}

.sd-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-tertiary, #606080);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.sd-tab:hover { color: var(--text-secondary, #a0a0c0); }
.sd-tab.active {
  color: #818cf8;
  border-bottom-color: #6366f1;
}

.sd-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.sd-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  flex: 1;
  min-width: 200px;
  color: var(--text-tertiary, #606080);
}

.sd-search input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary, #fff);
  font-size: 0.8125rem;
}

.sd-search input::placeholder {
  color: var(--text-tertiary, #606080);
}

.sd-filters {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--text-tertiary, #606080);
  flex-wrap: wrap;
}

.sd-filter-btn {
  padding: 0.25rem 0.625rem;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 99px;
  color: var(--text-tertiary, #606080);
  font-size: 0.6875rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.sd-filter-btn:hover {
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-secondary, #a0a0c0);
}

.sd-filter-btn.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
  color: #818cf8;
}

.sd-error {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

.sd-error button {
  background: none;
  border: none;
  color: #fca5a5;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.75rem;
}

.sd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.sd-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-tertiary, #606080);
  font-size: 0.875rem;
}
`;
