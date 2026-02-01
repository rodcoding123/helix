/**
 * Plugin Browser - Discover and install plugins/skills
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './PluginBrowser.css';

interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  icon: string;
  category: string;
  downloads: number;
  rating: number;
  tags: string[];
  installed: boolean;
  official: boolean;
  requiresSetup: boolean;
}

interface PluginCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

const CATEGORIES: PluginCategory[] = [
  { id: 'all', name: 'All Plugins', icon: '📦', count: 0 },
  { id: 'productivity', name: 'Productivity', icon: '📊', count: 0 },
  { id: 'communication', name: 'Communication', icon: '💬', count: 0 },
  { id: 'development', name: 'Development', icon: '💻', count: 0 },
  { id: 'media', name: 'Media & Creative', icon: '🎨', count: 0 },
  { id: 'automation', name: 'Automation', icon: '⚡', count: 0 },
  { id: 'utilities', name: 'Utilities', icon: '🔧', count: 0 },
];

const MOCK_PLUGINS: Plugin[] = [
  { id: 'gmail', name: 'Gmail', description: 'Read, compose, and manage Gmail messages', author: 'OpenClaw', version: '1.2.0', icon: '📧', category: 'communication', downloads: 12500, rating: 4.8, tags: ['email', 'google'], installed: false, official: true, requiresSetup: true },
  { id: 'calendar', name: 'Google Calendar', description: 'Manage events, meetings, and scheduling', author: 'OpenClaw', version: '1.1.0', icon: '📅', category: 'productivity', downloads: 9800, rating: 4.7, tags: ['calendar', 'google'], installed: false, official: true, requiresSetup: true },
  { id: 'slack', name: 'Slack', description: 'Send messages, join channels, and manage Slack workspaces', author: 'OpenClaw', version: '2.0.0', icon: '💬', category: 'communication', downloads: 8500, rating: 4.6, tags: ['chat', 'team'], installed: false, official: true, requiresSetup: true },
  { id: 'notion', name: 'Notion', description: 'Create and manage Notion pages and databases', author: 'OpenClaw', version: '1.3.0', icon: '📝', category: 'productivity', downloads: 7200, rating: 4.5, tags: ['notes', 'wiki'], installed: false, official: true, requiresSetup: true },
  { id: 'github', name: 'GitHub', description: 'Manage repos, issues, PRs, and GitHub Actions', author: 'OpenClaw', version: '1.4.0', icon: '🐙', category: 'development', downloads: 15000, rating: 4.9, tags: ['git', 'code'], installed: true, official: true, requiresSetup: true },
  { id: 'linear', name: 'Linear', description: 'Create and manage Linear issues and projects', author: 'OpenClaw', version: '1.0.0', icon: '📋', category: 'productivity', downloads: 4200, rating: 4.4, tags: ['issues', 'project'], installed: false, official: true, requiresSetup: true },
  { id: 'dall-e', name: 'DALL-E', description: 'Generate images with OpenAI DALL-E', author: 'OpenClaw', version: '1.1.0', icon: '🎨', category: 'media', downloads: 11000, rating: 4.8, tags: ['image', 'ai'], installed: false, official: true, requiresSetup: true },
  { id: 'figma', name: 'Figma', description: 'Access and manage Figma designs', author: 'Community', version: '0.8.0', icon: '🎯', category: 'media', downloads: 3100, rating: 4.2, tags: ['design', 'ui'], installed: false, official: false, requiresSetup: true },
  { id: 'jira', name: 'Jira', description: 'Manage Jira issues and projects', author: 'Community', version: '0.9.0', icon: '🎫', category: 'productivity', downloads: 2800, rating: 4.1, tags: ['issues', 'atlassian'], installed: false, official: false, requiresSetup: true },
  { id: 'spotify', name: 'Spotify', description: 'Control music playback and manage playlists', author: 'Community', version: '0.7.0', icon: '🎵', category: 'media', downloads: 5500, rating: 4.3, tags: ['music', 'audio'], installed: false, official: false, requiresSetup: true },
  { id: 'todoist', name: 'Todoist', description: 'Manage tasks and projects in Todoist', author: 'Community', version: '1.0.0', icon: '✅', category: 'productivity', downloads: 4800, rating: 4.5, tags: ['tasks', 'todo'], installed: false, official: false, requiresSetup: true },
  { id: 'playwright', name: 'Playwright', description: 'Browser automation and web scraping', author: 'OpenClaw', version: '1.0.0', icon: '🎭', category: 'automation', downloads: 6200, rating: 4.6, tags: ['browser', 'web'], installed: true, official: true, requiresSetup: false },
  { id: 'filesystem', name: 'File System', description: 'Read, write, and manage local files', author: 'OpenClaw', version: '1.0.0', icon: '📁', category: 'utilities', downloads: 18000, rating: 4.9, tags: ['files', 'system'], installed: true, official: true, requiresSetup: false },
  { id: 'memory', name: 'Long-term Memory', description: 'Store and recall information across sessions', author: 'OpenClaw', version: '2.0.0', icon: '🧠', category: 'utilities', downloads: 14000, rating: 4.8, tags: ['memory', 'knowledge'], installed: true, official: true, requiresSetup: false },
];

export function PluginBrowser() {
  const { getClient } = useGateway();
  const [plugins, setPlugins] = useState<Plugin[]>(MOCK_PLUGINS);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'recent'>('popular');
  const [installingPlugins, setInstallingPlugins] = useState<Set<string>>(new Set());
  const [showInstalled, setShowInstalled] = useState(false);

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('plugins.browse') as { plugins: Plugin[] };
        if (result.plugins) {
          setPlugins(result.plugins);
        }
      } catch (err) {
        console.error('Failed to load plugins:', err);
      }
    }
    setLoading(false);
  };

  const installPlugin = async (pluginId: string) => {
    setInstallingPlugins(prev => new Set(prev).add(pluginId));

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('plugins.install', { pluginId });
        setPlugins(prev => prev.map(p =>
          p.id === pluginId ? { ...p, installed: true } : p
        ));
      } catch (err) {
        console.error('Failed to install plugin:', err);
      }
    } else {
      // Simulate for demo
      await new Promise(resolve => setTimeout(resolve, 1500));
      setPlugins(prev => prev.map(p =>
        p.id === pluginId ? { ...p, installed: true } : p
      ));
    }

    setInstallingPlugins(prev => {
      const next = new Set(prev);
      next.delete(pluginId);
      return next;
    });
  };

  const uninstallPlugin = async (pluginId: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('plugins.uninstall', { pluginId });
      } catch (err) {
        console.error('Failed to uninstall plugin:', err);
        return;
      }
    }

    setPlugins(prev => prev.map(p =>
      p.id === pluginId ? { ...p, installed: false } : p
    ));
  };

  const filteredPlugins = plugins.filter(plugin => {
    // Category filter
    if (selectedCategory !== 'all' && plugin.category !== selectedCategory) {
      return false;
    }

    // Installed filter
    if (showInstalled && !plugin.installed) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        plugin.name.toLowerCase().includes(query) ||
        plugin.description.toLowerCase().includes(query) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return true;
  });

  // Sort plugins
  const sortedPlugins = [...filteredPlugins].sort((a, b) => {
    switch (sortBy) {
      case 'popular':
        return b.downloads - a.downloads;
      case 'rating':
        return b.rating - a.rating;
      case 'recent':
        return 0; // Would sort by date in real implementation
      default:
        return 0;
    }
  });

  // Calculate category counts
  const categoriesWithCounts = CATEGORIES.map(cat => ({
    ...cat,
    count: cat.id === 'all'
      ? plugins.length
      : plugins.filter(p => p.category === cat.id).length,
  }));

  const formatDownloads = (count: number): string => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  };

  const renderStars = (rating: number): string => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  };

  if (loading) {
    return <div className="plugin-browser-loading">Loading plugins...</div>;
  }

  return (
    <div className="plugin-browser">
      <header className="browser-header">
        <h2>Plugin Browser</h2>
        <p className="header-subtitle">Extend Helix with powerful integrations</p>
      </header>

      <div className="browser-layout">
        <aside className="browser-sidebar">
          <div className="sidebar-section">
            <h3>Categories</h3>
            <ul className="category-list">
              {categoriesWithCounts.map(cat => (
                <li key={cat.id}>
                  <button
                    className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <span className="category-icon">{cat.icon}</span>
                    <span className="category-name">{cat.name}</span>
                    <span className="category-count">{cat.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="sidebar-section">
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={showInstalled}
                onChange={(e) => setShowInstalled(e.target.checked)}
              />
              <span>Show installed only</span>
            </label>
          </div>
        </aside>

        <main className="browser-main">
          <div className="browser-toolbar">
            <input
              type="text"
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="sort-select"
            >
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="recent">Recently Added</option>
            </select>
          </div>

          {sortedPlugins.length === 0 ? (
            <div className="no-results">
              <span className="no-results-icon">🔍</span>
              <p>No plugins found matching your criteria</p>
            </div>
          ) : (
            <div className="plugin-grid">
              {sortedPlugins.map(plugin => (
                <div key={plugin.id} className={`plugin-card ${plugin.installed ? 'installed' : ''}`}>
                  <div className="card-header">
                    <span className="plugin-icon">{plugin.icon}</span>
                    <div className="plugin-info">
                      <div className="plugin-title">
                        <span className="plugin-name">{plugin.name}</span>
                        {plugin.official && <span className="badge official">Official</span>}
                        {plugin.installed && <span className="badge installed">Installed</span>}
                      </div>
                      <span className="plugin-author">by {plugin.author}</span>
                    </div>
                  </div>

                  <p className="plugin-description">{plugin.description}</p>

                  <div className="plugin-meta">
                    <span className="meta-item">
                      <span className="stars">{renderStars(plugin.rating)}</span>
                      <span className="rating-value">{plugin.rating.toFixed(1)}</span>
                    </span>
                    <span className="meta-item">
                      <span className="download-icon">⬇</span>
                      {formatDownloads(plugin.downloads)}
                    </span>
                    <span className="meta-item version">v{plugin.version}</span>
                  </div>

                  <div className="plugin-tags">
                    {plugin.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>

                  <div className="card-actions">
                    {plugin.installed ? (
                      <>
                        {plugin.requiresSetup && (
                          <button className="btn-secondary">Configure</button>
                        )}
                        <button
                          className="btn-danger"
                          onClick={() => uninstallPlugin(plugin.id)}
                        >
                          Uninstall
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={() => installPlugin(plugin.id)}
                        disabled={installingPlugins.has(plugin.id)}
                      >
                        {installingPlugins.has(plugin.id) ? (
                          <>
                            <span className="spinner-mini" />
                            Installing...
                          </>
                        ) : (
                          'Install'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
