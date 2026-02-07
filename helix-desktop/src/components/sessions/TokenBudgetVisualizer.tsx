/**
 * Token Budget Visualizer
 *
 * Real-time token usage and cost tracking for sessions
 * Phase G.3 - Integration with AIOperationRouter cost tracking
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './TokenBudgetVisualizer.css';

interface TokenBudgetData {
  sessionKey: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  lastCompactedAt?: string;
  compactionCount: number;
  projectedCostDaily: number;
}

interface UsageBreakdown {
  category: string;
  tokens: number;
  percentage: number;
  costUsd: number;
}

export function TokenBudgetVisualizer({ sessionKey }: { sessionKey?: string }) {
  const { getClient, connected } = useGateway();
  const [budgetData, setBudgetData] = useState<TokenBudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [compacting, setCompacting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (sessionKey) {
      loadBudgetData();
    }
  }, [sessionKey, connected]);

  const loadBudgetData = async () => {
    if (!sessionKey) return;

    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      return;
    }

    try {
      const result = (await client.request('sessions.token_budget', {
        sessionKey,
      })) as any;

      if (result) {
        setBudgetData(result as TokenBudgetData);
      }
    } catch (err) {
      console.error('Failed to load token budget:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompact = async () => {
    if (!sessionKey) return;

    setCompacting(true);
    const client = getClient();

    try {
      const result = (await client?.request('sessions.intelligent_compact', {
        sessionKey,
        mode: 'default',
        targetTokens: 8000,
        memoryFlush: false,
      })) as any;

      if (result?.compacted) {
        // Reload budget data after compaction
        await loadBudgetData();
      }
    } catch (err) {
      console.error('Failed to compact session:', err);
    } finally {
      setCompacting(false);
    }
  };

  if (loading) {
    return <div className="token-budget loading">Loading token budget...</div>;
  }

  if (!budgetData) {
    return <div className="token-budget empty">No session selected</div>;
  }

  const usageBreakdown: UsageBreakdown[] = [
    {
      category: 'Input Tokens',
      tokens: budgetData.inputTokens,
      percentage: (budgetData.inputTokens / budgetData.totalTokens) * 100,
      costUsd: (budgetData.estimatedCostUsd * budgetData.inputTokens) / budgetData.totalTokens,
    },
    {
      category: 'Output Tokens',
      tokens: budgetData.outputTokens,
      percentage: (budgetData.outputTokens / budgetData.totalTokens) * 100,
      costUsd: (budgetData.estimatedCostUsd * budgetData.outputTokens) / budgetData.totalTokens,
    },
  ];

  const costPerThousandTokens = (budgetData.estimatedCostUsd / budgetData.totalTokens) * 1000;
  const compactionPotential = Math.round((budgetData.totalTokens / 12000) * 100); // Estimate

  return (
    <div className="token-budget">
      <style>{tokenBudgetStyles}</style>

      {/* Header */}
      <div className="budget-header">
        <h3>Token Budget: {sessionKey}</h3>
        <button
          className="compact-btn"
          onClick={handleCompact}
          disabled={compacting}
          title="Intelligently compress session context"
        >
          {compacting ? 'Compacting...' : '⚡ Compact'}
        </button>
      </div>

      {/* Key Metrics */}
      <div className="budget-metrics">
        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <div className="metric-label">Total Tokens</div>
            <div className="metric-value">{budgetData.totalTokens.toLocaleString()}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <div className="metric-label">Estimated Cost</div>
            <div className="metric-value">${budgetData.estimatedCostUsd.toFixed(6)}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <div className="metric-label">Daily Projection</div>
            <div className="metric-value">${budgetData.projectedCostDaily.toFixed(4)}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⚙️</div>
          <div className="metric-content">
            <div className="metric-label">Compactions</div>
            <div className="metric-value">{budgetData.compactionCount}</div>
          </div>
        </div>
      </div>

      {/* Usage Breakdown Chart */}
      <div className="budget-section">
        <h4>Token Usage Breakdown</h4>
        <div className="usage-chart">
          {usageBreakdown.map(item => (
            <div key={item.category} className="usage-item">
              <div className="usage-header">
                <span className="usage-label">{item.category}</span>
                <span className="usage-stats">
                  {item.tokens.toLocaleString()} tokens ({item.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="usage-bar-container">
                <div
                  className="usage-bar"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.category === 'Input Tokens' ? '#6366f1' : '#818cf8',
                  }}
                />
              </div>
              <div className="usage-cost">${item.costUsd.toFixed(6)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Analysis */}
      <div className="budget-section">
        <h4>Cost Analysis</h4>
        <div className="cost-analysis">
          <div className="analysis-item">
            <span className="analysis-label">Cost per 1K tokens</span>
            <span className="analysis-value">${costPerThousandTokens.toFixed(6)}</span>
          </div>
          <div className="analysis-item">
            <span className="analysis-label">Compaction Potential</span>
            <span className="analysis-value">{compactionPotential}%</span>
          </div>
          <div className="analysis-item">
            <span className="analysis-label">Potential Savings</span>
            <span className="analysis-value">
              ${(budgetData.estimatedCostUsd * (compactionPotential / 100)).toFixed(6)}
            </span>
          </div>
        </div>
      </div>

      {/* Compaction History */}
      {budgetData.compactionCount > 0 && (
        <div className="budget-section">
          <h4>Recent Compaction</h4>
          <div className="compaction-info">
            <p>
              Last compacted{' '}
              {budgetData.lastCompactedAt
                ? new Date(budgetData.lastCompactedAt).toLocaleDateString()
                : 'never'}
            </p>
            <p>
              Total compactions performed: <strong>{budgetData.compactionCount}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Toggle Details */}
      <div className="budget-section">
        <button
          className="details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '▼' : '▶'} Advanced Details
        </button>

        {showDetails && (
          <div className="advanced-details">
            <div className="detail-row">
              <span>Input Tokens</span>
              <span>{budgetData.inputTokens.toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span>Output Tokens</span>
              <span>{budgetData.outputTokens.toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span>Session Key</span>
              <code>{budgetData.sessionKey}</code>
            </div>
            <div className="detail-row">
              <span>Estimated Cost</span>
              <span>${budgetData.estimatedCostUsd.toFixed(8)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const tokenBudgetStyles = `
.token-budget {
  padding: 1.5rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.token-budget.loading,
.token-budget.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-tertiary, #606080);
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.budget-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.compact-btn {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.compact-btn:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.compact-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Metrics Grid */
.budget-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

@media (max-width: 1024px) {
  .budget-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .budget-metrics {
    grid-template-columns: 1fr;
  }
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
}

.metric-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.metric-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.metric-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
}

.metric-value {
  font-size: 1rem;
  font-weight: 600;
  color: #818cf8;
  word-break: break-word;
}

/* Sections */
.budget-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.budget-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.budget-section h4 {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary, #a0a0c0);
}

/* Usage Chart */
.usage-chart {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.usage-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.usage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
}

.usage-label {
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.usage-stats {
  color: var(--text-tertiary, #606080);
  font-size: 0.75rem;
}

.usage-bar-container {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
}

.usage-bar {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.usage-cost {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

/* Cost Analysis */
.cost-analysis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

@media (max-width: 640px) {
  .cost-analysis {
    grid-template-columns: 1fr;
  }
}

.analysis-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}

.analysis-label {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
}

.analysis-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #818cf8;
}

/* Compaction Info */
.compaction-info {
  background: rgba(16, 185, 129, 0.04);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 6px;
  padding: 0.875rem;
}

.compaction-info p {
  margin: 0.25rem 0;
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
}

/* Details Toggle */
.details-toggle {
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 6px;
  color: #818cf8;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.details-toggle:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
}

/* Advanced Details */
.advanced-details {
  margin-top: 0.75rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.8125rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row span {
  color: var(--text-secondary, #a0a0c0);
}

.detail-row code {
  font-family: var(--font-mono, monospace);
  color: #818cf8;
  font-size: 0.75rem;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`;
