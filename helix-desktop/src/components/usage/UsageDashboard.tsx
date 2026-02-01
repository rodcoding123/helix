/**
 * Usage Dashboard - Track API costs and token usage
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './UsageDashboard.css';

interface UsageStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number;
  apiCalls: number;
}

interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
  calls: number;
}

interface ModelUsage {
  model: string;
  tokens: number;
  cost: number;
  calls: number;
  percentage: number;
}

interface UsageByTool {
  tool: string;
  calls: number;
  avgDuration: number;
  successRate: number;
}

type TimeRange = '24h' | '7d' | '30d' | '90d';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-5-20251101': { input: 15, output: 75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.25, output: 1.25 },
};

export function UsageDashboard() {
  const { getClient } = useGateway();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [toolUsage, setToolUsage] = useState<UsageByTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [budget, setBudget] = useState<number | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  useEffect(() => {
    loadUsageData();
  }, [timeRange]);

  const loadUsageData = async () => {
    setLoading(true);
    const client = getClient();

    if (client?.connected) {
      try {
        const result = await client.request('usage.stats', { timeRange }) as {
          stats: UsageStats;
          daily: DailyUsage[];
          byModel: ModelUsage[];
          byTool: UsageByTool[];
        };
        setStats(result.stats);
        setDailyUsage(result.daily);
        setModelUsage(result.byModel);
        setToolUsage(result.byTool);
      } catch (err) {
        console.error('Failed to load usage data:', err);
      }
    } else {
      // Generate mock data
      const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const mockDaily: DailyUsage[] = [];
      const now = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 86400000);
        mockDaily.push({
          date: date.toISOString().split('T')[0],
          tokens: Math.floor(50000 + Math.random() * 100000),
          cost: parseFloat((2 + Math.random() * 8).toFixed(2)),
          calls: Math.floor(20 + Math.random() * 50),
        });
      }

      const totalTokens = mockDaily.reduce((sum, d) => sum + d.tokens, 0);
      const totalCost = mockDaily.reduce((sum, d) => sum + d.cost, 0);
      const totalCalls = mockDaily.reduce((sum, d) => sum + d.calls, 0);

      setStats({
        totalTokens,
        inputTokens: Math.floor(totalTokens * 0.3),
        outputTokens: Math.floor(totalTokens * 0.5),
        cacheReadTokens: Math.floor(totalTokens * 0.15),
        cacheWriteTokens: Math.floor(totalTokens * 0.05),
        totalCost,
        apiCalls: totalCalls,
      });

      setDailyUsage(mockDaily);

      setModelUsage([
        { model: 'claude-opus-4-5-20251101', tokens: Math.floor(totalTokens * 0.4), cost: totalCost * 0.65, calls: Math.floor(totalCalls * 0.3), percentage: 40 },
        { model: 'claude-sonnet-4-20250514', tokens: Math.floor(totalTokens * 0.45), cost: totalCost * 0.3, calls: Math.floor(totalCalls * 0.5), percentage: 45 },
        { model: 'claude-3-5-haiku-20241022', tokens: Math.floor(totalTokens * 0.15), cost: totalCost * 0.05, calls: Math.floor(totalCalls * 0.2), percentage: 15 },
      ]);

      setToolUsage([
        { tool: 'Read', calls: 245, avgDuration: 45, successRate: 99.2 },
        { tool: 'Write', calls: 89, avgDuration: 120, successRate: 97.8 },
        { tool: 'Bash', calls: 156, avgDuration: 850, successRate: 94.5 },
        { tool: 'Glob', calls: 312, avgDuration: 25, successRate: 100 },
        { tool: 'Grep', calls: 198, avgDuration: 35, successRate: 99.5 },
        { tool: 'Edit', calls: 134, avgDuration: 80, successRate: 98.5 },
        { tool: 'WebFetch', calls: 42, avgDuration: 1200, successRate: 92.3 },
      ]);

      setBudget(100);
    }

    setLoading(false);
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return String(tokens);
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(2)}`;
  };

  const getModelName = (modelId: string): string => {
    if (modelId.includes('opus')) return 'Opus 4.5';
    if (modelId.includes('sonnet')) return 'Sonnet 4';
    if (modelId.includes('haiku')) return 'Haiku 3.5';
    return modelId;
  };

  const maxDailyTokens = Math.max(...dailyUsage.map(d => d.tokens), 1);
  const budgetUsed = stats && budget ? (stats.totalCost / budget) * 100 : 0;

  if (loading) {
    return <div className="usage-loading">Loading usage data...</div>;
  }

  return (
    <div className="usage-dashboard">
      <header className="usage-header">
        <div className="header-left">
          <h2>Usage & Costs</h2>
          <div className="time-range-selector">
            {(['24h', '7d', '30d', '90d'] as TimeRange[]).map(range => (
              <button
                key={range}
                className={`range-btn ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <button className="btn-secondary" onClick={() => setShowBudgetModal(true)}>
          Set Budget
        </button>
      </header>

      {/* Summary Cards */}
      {stats && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-icon">📊</div>
            <div className="card-content">
              <span className="card-value">{formatTokens(stats.totalTokens)}</span>
              <span className="card-label">Total Tokens</span>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon">💰</div>
            <div className="card-content">
              <span className="card-value">{formatCost(stats.totalCost)}</span>
              <span className="card-label">Total Cost</span>
            </div>
            {budget && (
              <div className="budget-indicator">
                <div className="budget-bar">
                  <div
                    className={`budget-fill ${budgetUsed > 80 ? 'warning' : ''} ${budgetUsed > 100 ? 'exceeded' : ''}`}
                    style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                  />
                </div>
                <span className="budget-text">{budgetUsed.toFixed(0)}% of ${budget}</span>
              </div>
            )}
          </div>

          <div className="summary-card">
            <div className="card-icon">🔌</div>
            <div className="card-content">
              <span className="card-value">{stats.apiCalls.toLocaleString()}</span>
              <span className="card-label">API Calls</span>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon">⚡</div>
            <div className="card-content">
              <span className="card-value">{formatCost(stats.totalCost / stats.apiCalls)}</span>
              <span className="card-label">Avg Cost/Call</span>
            </div>
          </div>
        </div>
      )}

      {/* Token Breakdown */}
      {stats && (
        <section className="usage-section">
          <h3>Token Breakdown</h3>
          <div className="token-breakdown">
            <div className="token-type">
              <div className="token-bar-container">
                <div
                  className="token-bar input"
                  style={{ width: `${(stats.inputTokens / stats.totalTokens) * 100}%` }}
                />
              </div>
              <div className="token-info">
                <span className="token-label">Input</span>
                <span className="token-value">{formatTokens(stats.inputTokens)}</span>
              </div>
            </div>
            <div className="token-type">
              <div className="token-bar-container">
                <div
                  className="token-bar output"
                  style={{ width: `${(stats.outputTokens / stats.totalTokens) * 100}%` }}
                />
              </div>
              <div className="token-info">
                <span className="token-label">Output</span>
                <span className="token-value">{formatTokens(stats.outputTokens)}</span>
              </div>
            </div>
            <div className="token-type">
              <div className="token-bar-container">
                <div
                  className="token-bar cache-read"
                  style={{ width: `${(stats.cacheReadTokens / stats.totalTokens) * 100}%` }}
                />
              </div>
              <div className="token-info">
                <span className="token-label">Cache Read</span>
                <span className="token-value">{formatTokens(stats.cacheReadTokens)}</span>
              </div>
            </div>
            <div className="token-type">
              <div className="token-bar-container">
                <div
                  className="token-bar cache-write"
                  style={{ width: `${(stats.cacheWriteTokens / stats.totalTokens) * 100}%` }}
                />
              </div>
              <div className="token-info">
                <span className="token-label">Cache Write</span>
                <span className="token-value">{formatTokens(stats.cacheWriteTokens)}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Daily Usage Chart */}
      <section className="usage-section">
        <h3>Daily Usage</h3>
        <div className="daily-chart">
          <div className="chart-bars">
            {dailyUsage.map((day, index) => (
              <div key={index} className="chart-day">
                <div
                  className="day-bar"
                  style={{ height: `${(day.tokens / maxDailyTokens) * 100}%` }}
                  title={`${formatTokens(day.tokens)} tokens, ${formatCost(day.cost)}`}
                />
                <span className="day-label">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="usage-grid">
        {/* Model Usage */}
        <section className="usage-section">
          <h3>Usage by Model</h3>
          <div className="model-list">
            {modelUsage.map(model => (
              <div key={model.model} className="model-item">
                <div className="model-header">
                  <span className="model-name">{getModelName(model.model)}</span>
                  <span className="model-percentage">{model.percentage}%</span>
                </div>
                <div className="model-bar-container">
                  <div
                    className="model-bar"
                    style={{ width: `${model.percentage}%` }}
                  />
                </div>
                <div className="model-stats">
                  <span>{formatTokens(model.tokens)} tokens</span>
                  <span>{formatCost(model.cost)}</span>
                  <span>{model.calls} calls</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tool Usage */}
        <section className="usage-section">
          <h3>Tool Usage</h3>
          <div className="tool-table">
            <div className="table-header">
              <span>Tool</span>
              <span>Calls</span>
              <span>Avg Time</span>
              <span>Success</span>
            </div>
            {toolUsage.map(tool => (
              <div key={tool.tool} className="table-row">
                <span className="tool-name">{tool.tool}</span>
                <span>{tool.calls}</span>
                <span>{tool.avgDuration}ms</span>
                <span className={`success-rate ${tool.successRate >= 98 ? 'high' : tool.successRate >= 95 ? 'medium' : 'low'}`}>
                  {tool.successRate.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Pricing Reference */}
      <section className="usage-section pricing-section">
        <h3>Pricing Reference</h3>
        <div className="pricing-table">
          <div className="table-header">
            <span>Model</span>
            <span>Input (per 1M)</span>
            <span>Output (per 1M)</span>
          </div>
          {Object.entries(MODEL_PRICING).map(([model, pricing]) => (
            <div key={model} className="table-row">
              <span className="model-name">{getModelName(model)}</span>
              <span>${pricing.input.toFixed(2)}</span>
              <span>${pricing.output.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="modal-overlay" onClick={() => setShowBudgetModal(false)}>
          <div className="budget-modal" onClick={e => e.stopPropagation()}>
            <h3>Set Monthly Budget</h3>
            <div className="modal-field">
              <label>Budget Amount ($)</label>
              <input
                type="number"
                value={budget || ''}
                onChange={(e) => setBudget(parseFloat(e.target.value) || null)}
                placeholder="100"
                min={0}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowBudgetModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => setShowBudgetModal(false)}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
