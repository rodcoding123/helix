import { useState, useEffect } from 'react';
import { getGatewayClient } from '../../lib/gateway-client';
import './ToolAnalytics.css';

interface ToolStat {
  name: string;
  category: string;
  invocations: number;
  successRate: number;
  avgDuration: number;
  lastUsed: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

interface DailyUsage {
  date: string;
  tools: number;
  successful: number;
  failed: number;
}

interface CategoryStat {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

const PLACEHOLDER_TOOLS: ToolStat[] = [
  { name: 'Read', category: 'File Operations', invocations: 1542, successRate: 99.2, avgDuration: 45, lastUsed: Date.now() - 60000, trend: 'up', trendPercent: 12 },
  { name: 'Edit', category: 'File Operations', invocations: 876, successRate: 97.8, avgDuration: 120, lastUsed: Date.now() - 300000, trend: 'up', trendPercent: 8 },
  { name: 'Write', category: 'File Operations', invocations: 234, successRate: 98.7, avgDuration: 85, lastUsed: Date.now() - 900000, trend: 'stable', trendPercent: 0 },
  { name: 'Bash', category: 'System', invocations: 654, successRate: 94.5, avgDuration: 2340, lastUsed: Date.now() - 120000, trend: 'down', trendPercent: 5 },
  { name: 'Grep', category: 'Search', invocations: 432, successRate: 100, avgDuration: 180, lastUsed: Date.now() - 600000, trend: 'up', trendPercent: 22 },
  { name: 'Glob', category: 'Search', invocations: 321, successRate: 100, avgDuration: 95, lastUsed: Date.now() - 1800000, trend: 'stable', trendPercent: 2 },
  { name: 'WebFetch', category: 'Network', invocations: 89, successRate: 87.6, avgDuration: 3200, lastUsed: Date.now() - 3600000, trend: 'down', trendPercent: 15 },
  { name: 'Task', category: 'Agents', invocations: 56, successRate: 92.8, avgDuration: 45000, lastUsed: Date.now() - 7200000, trend: 'up', trendPercent: 45 },
  { name: 'mcp__memory__search_nodes', category: 'MCP', invocations: 128, successRate: 96.1, avgDuration: 520, lastUsed: Date.now() - 1200000, trend: 'up', trendPercent: 18 },
  { name: 'mcp__memory__create_entities', category: 'MCP', invocations: 67, successRate: 100, avgDuration: 340, lastUsed: Date.now() - 5400000, trend: 'stable', trendPercent: 3 },
];

const PLACEHOLDER_DAILY: DailyUsage[] = [
  { date: '2024-01-25', tools: 156, successful: 148, failed: 8 },
  { date: '2024-01-26', tools: 234, successful: 225, failed: 9 },
  { date: '2024-01-27', tools: 189, successful: 182, failed: 7 },
  { date: '2024-01-28', tools: 312, successful: 301, failed: 11 },
  { date: '2024-01-29', tools: 278, successful: 270, failed: 8 },
  { date: '2024-01-30', tools: 445, successful: 432, failed: 13 },
  { date: '2024-01-31', tools: 521, successful: 508, failed: 13 },
];

const CATEGORY_COLORS: Record<string, string> = {
  'File Operations': '#6366f1',
  'System': '#f59e0b',
  'Search': '#10b981',
  'Network': '#3b82f6',
  'Agents': '#8b5cf6',
  'MCP': '#ec4899',
};

export function ToolAnalytics() {
  const [tools, setTools] = useState<ToolStat[]>(PLACEHOLDER_TOOLS);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>(PLACEHOLDER_DAILY);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
  const [sortBy, setSortBy] = useState<'invocations' | 'successRate' | 'avgDuration' | 'lastUsed'>('invocations');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [usingPlaceholder, setUsingPlaceholder] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    const client = getGatewayClient();
    if (client?.connected) {
      try {
        const result = await client.request('analytics.tools', { timeRange }) as {
          tools: ToolStat[];
          daily: DailyUsage[];
        };
        setTools(result.tools);
        setDailyUsage(result.daily);
        setUsingPlaceholder(false);
      } catch (err) {
        console.debug('[analytics] Gateway API not yet implemented, using placeholder data:', err);
        setTools(PLACEHOLDER_TOOLS);
        setDailyUsage(PLACEHOLDER_DAILY);
        setUsingPlaceholder(true);
      }
    } else {
      setTools(PLACEHOLDER_TOOLS);
      setDailyUsage(PLACEHOLDER_DAILY);
      setUsingPlaceholder(true);
    }
    setLoading(false);
  };

  const categories = Array.from(new Set(tools.map(t => t.category)));

  const categoryStats: CategoryStat[] = categories.map(cat => {
    const count = tools.filter(t => t.category === cat).reduce((sum, t) => sum + t.invocations, 0);
    const total = tools.reduce((sum, t) => sum + t.invocations, 0);
    return {
      name: cat,
      count,
      percentage: (count / total) * 100,
      color: CATEGORY_COLORS[cat] || '#6b7280',
    };
  }).sort((a, b) => b.count - a.count);

  const filteredTools = tools
    .filter(t => selectedCategory === 'all' || t.category === selectedCategory)
    .sort((a, b) => {
      const modifier = sortDir === 'desc' ? -1 : 1;
      return (a[sortBy] - b[sortBy]) * modifier;
    });

  const totalInvocations = tools.reduce((sum, t) => sum + t.invocations, 0);
  const avgSuccessRate = tools.reduce((sum, t) => sum + t.successRate, 0) / tools.length;
  const totalDuration = tools.reduce((sum, t) => sum + (t.invocations * t.avgDuration), 0);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatLastUsed = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  const getTrendIcon = (trend: ToolStat['trend']) => {
    switch (trend) {
      case 'up': return '↑';
      case 'down': return '↓';
      default: return '→';
    }
  };

  const maxDaily = Math.max(...dailyUsage.map(d => d.tools));

  return (
    <div className="tool-analytics">
      <div className="analytics-header">
        <div className="header-title">
          <span className="header-icon">📊</span>
          <h2>Tool Analytics</h2>
        </div>
        <div className="time-range-selector">
          {(['24h', '7d', '30d', '90d'] as const).map(range => (
            <button
              key={range}
              className={`range-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
              disabled={loading}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {usingPlaceholder && (
        <div className="data-source-banner info">
          💡 Showing demo data - Real-time analytics require gateway implementation
        </div>
      )}

      {loading && (
        <div className="loading-banner">
          ⏳ Loading analytics...
        </div>
      )}

      <div className="analytics-content">
        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <span className="card-icon">🔧</span>
            <div className="card-content">
              <span className="card-value">{totalInvocations.toLocaleString()}</span>
              <span className="card-label">Total Invocations</span>
            </div>
          </div>
          <div className="summary-card">
            <span className="card-icon">✅</span>
            <div className="card-content">
              <span className="card-value">{avgSuccessRate.toFixed(1)}%</span>
              <span className="card-label">Avg Success Rate</span>
            </div>
          </div>
          <div className="summary-card">
            <span className="card-icon">⏱️</span>
            <div className="card-content">
              <span className="card-value">{formatDuration(totalDuration)}</span>
              <span className="card-label">Total Execution Time</span>
            </div>
          </div>
          <div className="summary-card">
            <span className="card-icon">🏆</span>
            <div className="card-content">
              <span className="card-value">{tools[0]?.name || '-'}</span>
              <span className="card-label">Most Used Tool</span>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="charts-row">
          {/* Daily Usage Chart */}
          <div className="chart-card">
            <h3>Daily Usage</h3>
            <div className="bar-chart">
              {dailyUsage.map((day, i) => (
                <div key={i} className="bar-group">
                  <div className="bar-wrapper">
                    <div
                      className="bar success"
                      style={{ height: `${(day.successful / maxDaily) * 100}%` }}
                      title={`${day.successful} successful`}
                    />
                    <div
                      className="bar failed"
                      style={{ height: `${(day.failed / maxDaily) * 100}%` }}
                      title={`${day.failed} failed`}
                    />
                  </div>
                  <span className="bar-label">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-dot success" />
                Successful
              </span>
              <span className="legend-item">
                <span className="legend-dot failed" />
                Failed
              </span>
            </div>
          </div>

          {/* Category Distribution */}
          <div className="chart-card">
            <h3>By Category</h3>
            <div className="category-chart">
              {categoryStats.map((cat, i) => (
                <div
                  key={i}
                  className={`category-row ${selectedCategory === cat.name ? 'selected' : ''}`}
                  onClick={() => setSelectedCategory(selectedCategory === cat.name ? 'all' : cat.name)}
                >
                  <div className="category-info">
                    <span
                      className="category-dot"
                      style={{ background: cat.color }}
                    />
                    <span className="category-name">{cat.name}</span>
                  </div>
                  <div className="category-bar-wrapper">
                    <div
                      className="category-bar"
                      style={{
                        width: `${cat.percentage}%`,
                        background: cat.color,
                      }}
                    />
                  </div>
                  <span className="category-value">{cat.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tools Table */}
        <div className="tools-table-card">
          <div className="table-header">
            <h3>Tool Details</h3>
            {selectedCategory !== 'all' && (
              <button
                className="clear-filter"
                onClick={() => setSelectedCategory('all')}
              >
                Clear filter: {selectedCategory}
              </button>
            )}
          </div>
          <div className="table-wrapper">
            <table className="tools-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Category</th>
                  <th
                    className={`sortable ${sortBy === 'invocations' ? 'active' : ''}`}
                    onClick={() => handleSort('invocations')}
                  >
                    Invocations {sortBy === 'invocations' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className={`sortable ${sortBy === 'successRate' ? 'active' : ''}`}
                    onClick={() => handleSort('successRate')}
                  >
                    Success Rate {sortBy === 'successRate' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className={`sortable ${sortBy === 'avgDuration' ? 'active' : ''}`}
                    onClick={() => handleSort('avgDuration')}
                  >
                    Avg Duration {sortBy === 'avgDuration' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className={`sortable ${sortBy === 'lastUsed' ? 'active' : ''}`}
                    onClick={() => handleSort('lastUsed')}
                  >
                    Last Used {sortBy === 'lastUsed' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {filteredTools.map((tool, i) => (
                  <tr key={i}>
                    <td className="tool-name">
                      <code>{tool.name}</code>
                    </td>
                    <td>
                      <span
                        className="category-badge"
                        style={{ background: CATEGORY_COLORS[tool.category] || '#6b7280' }}
                      >
                        {tool.category}
                      </span>
                    </td>
                    <td className="numeric">{tool.invocations.toLocaleString()}</td>
                    <td className="numeric">
                      <span className={`success-rate ${tool.successRate >= 95 ? 'high' : tool.successRate >= 80 ? 'medium' : 'low'}`}>
                        {tool.successRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="numeric">{formatDuration(tool.avgDuration)}</td>
                    <td className="numeric">{formatLastUsed(tool.lastUsed)}</td>
                    <td>
                      <span className={`trend ${tool.trend}`}>
                        {getTrendIcon(tool.trend)}
                        <span className="trend-percent">{tool.trendPercent}%</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
