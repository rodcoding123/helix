/**
 * Token Budget Manager
 *
 * High-level session token budget management with auto-compaction controls
 * Phase G.1 - Session Configuration & Token Management
 */

import { useState, useEffect, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';

interface TokenBudgetConfig {
  sessionKey: string;
  totalTokens: number;
  budgetLimit: number;
  remainingTokens: number;
  percentageUsed: number;
  autoCompactThreshold: number;
  autoCompactEnabled: boolean;
  lastCompactedAt?: string;
}

export function TokenBudgetManager() {
  const { getClient, connected } = useGateway();
  const [sessions, setSessions] = useState<TokenBudgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [autoCompactSettings, setAutoCompactSettings] = useState({
    enabled: true,
    threshold: 0.85, // 85% of budget
  });

  // Load session token budgets
  useEffect(() => {
    loadSessionBudgets();
  }, [connected]);

  const loadSessionBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const client = getClient();
      if (!client?.connected) {
        setLoading(false);
        return;
      }

      // Fetch all active sessions
      const sessionsResult = (await client.request('sessions.list', {})) as any;
      if (sessionsResult?.sessions) {
        const budgetConfigs: TokenBudgetConfig[] = [];

        for (const session of sessionsResult.sessions) {
          try {
            // Get token budget for each session
            const budgetResult = (await client.request('sessions.token_budget', {
              sessionKey: session.key,
            })) as any;

            if (budgetResult) {
              const remainingTokens = Math.max(
                0,
                (session.budgetLimit || 100000) - (budgetResult.totalTokens || 0)
              );
              const percentageUsed = (budgetResult.totalTokens || 0) / (session.budgetLimit || 100000);

              budgetConfigs.push({
                sessionKey: session.key,
                totalTokens: budgetResult.totalTokens || 0,
                budgetLimit: session.budgetLimit || 100000,
                remainingTokens,
                percentageUsed,
                autoCompactThreshold: session.autoCompactThreshold || 0.85,
                autoCompactEnabled: session.autoCompactEnabled !== false,
                lastCompactedAt: budgetResult.lastCompactedAt,
              });
            }
          } catch (err) {
            console.error(`Failed to get budget for session ${session.key}:`, err);
          }
        }

        setSessions(budgetConfigs);
      }
    } catch (err) {
      console.error('Failed to load session budgets:', err);
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  const handleAutoCompact = useCallback(async (sessionKey: string) => {
    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('sessions.intelligent_compact', {
        sessionKey,
        mode: 'default',
        targetTokens: 8000,
        memoryFlush: false,
      });

      // Reload budgets
      await loadSessionBudgets();
    } catch (err) {
      console.error('Failed to auto-compact session:', err);
    }
  }, [getClient, loadSessionBudgets]);

  const handleUpdateAutoCompactSetting = useCallback(async (enabled: boolean, threshold: number) => {
    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('config.patch', {
        patch: {
          'session.autoCompactEnabled': enabled,
          'session.autoCompactThreshold': threshold,
        },
      });

      setAutoCompactSettings({ enabled, threshold });
    } catch (err) {
      console.error('Failed to update auto-compact settings:', err);
    }
  }, [getClient]);

  const selectedSessionData = sessions.find(s => s.sessionKey === selectedSession);

  if (loading) {
    return <div className="token-budget-manager loading">Loading token budgets...</div>;
  }

  return (
    <div className="token-budget-manager">
      <style>{tokenBudgetManagerStyles}</style>

      {/* Header */}
      <div className="budget-manager-header">
        <h3>Session Token Budget Management</h3>
        <button
          className="refresh-btn"
          onClick={loadSessionBudgets}
          title="Refresh budget data"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Auto-Compact Settings */}
      <div className="auto-compact-settings">
        <div className="setting-card">
          <div className="setting-label">Auto-Compaction</div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoCompactSettings.enabled}
              onChange={(e) =>
                handleUpdateAutoCompactSetting(e.target.checked, autoCompactSettings.threshold)
              }
            />
            <span>Enable automatic session compaction</span>
          </label>
          <div className="threshold-control">
            <label>Threshold: {Math.round(autoCompactSettings.threshold * 100)}%</label>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={Math.round(autoCompactSettings.threshold * 100)}
              onChange={(e) =>
                handleUpdateAutoCompactSetting(autoCompactSettings.enabled, parseInt(e.target.value) / 100)
              }
            />
          </div>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="sessions-grid">
        {sessions.length === 0 ? (
          <div className="empty-state">No active sessions</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.sessionKey}
              className={`session-card ${selectedSession === session.sessionKey ? 'selected' : ''}`}
              onClick={() => setSelectedSession(session.sessionKey)}
            >
              <div className="card-header">
                <div className="session-name">{session.sessionKey}</div>
                <div
                  className={`usage-percentage ${
                    session.percentageUsed > 0.9 ? 'critical' : session.percentageUsed > 0.7 ? 'warning' : 'normal'
                  }`}
                >
                  {Math.round(session.percentageUsed * 100)}%
                </div>
              </div>

              <div className="budget-bar-container">
                <div
                  className="budget-bar-fill"
                  style={{ width: `${Math.min(100, session.percentageUsed * 100)}%` }}
                />
              </div>

              <div className="budget-stats">
                <span className="stat">
                  {session.totalTokens.toLocaleString()} / {session.budgetLimit.toLocaleString()} tokens
                </span>
                <span className="stat">
                  {session.remainingTokens.toLocaleString()} remaining
                </span>
              </div>

              {session.autoCompactEnabled && session.percentageUsed > session.autoCompactThreshold && (
                <button
                  className="compact-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAutoCompact(session.sessionKey);
                  }}
                >
                  🔄 Compact Now
                </button>
              )}

              {session.lastCompactedAt && (
                <div className="last-compacted">
                  Last compacted: {new Date(session.lastCompactedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Session Detail */}
      {selectedSessionData && (
        <div className="session-detail">
          <div className="detail-header">
            <h4>{selectedSessionData.sessionKey} - Details</h4>
            <button
              className="close-button"
              onClick={() => setSelectedSession(null)}
            >
              ✕
            </button>
          </div>

          <div className="detail-content">
            <div className="detail-row">
              <label>Total Tokens Used</label>
              <span className="value">{selectedSessionData.totalTokens.toLocaleString()}</span>
            </div>

            <div className="detail-row">
              <label>Budget Limit</label>
              <span className="value">{selectedSessionData.budgetLimit.toLocaleString()}</span>
            </div>

            <div className="detail-row">
              <label>Remaining Tokens</label>
              <span className={`value ${selectedSessionData.percentageUsed > 0.8 ? 'warning' : ''}`}>
                {selectedSessionData.remainingTokens.toLocaleString()}
              </span>
            </div>

            <div className="detail-row">
              <label>Usage</label>
              <span className="value">{Math.round(selectedSessionData.percentageUsed * 100)}%</span>
            </div>

            <div className="detail-row">
              <label>Auto-Compact Enabled</label>
              <span className="value">{selectedSessionData.autoCompactEnabled ? 'Yes' : 'No'}</span>
            </div>

            <div className="detail-row">
              <label>Auto-Compact Threshold</label>
              <span className="value">{Math.round(selectedSessionData.autoCompactThreshold * 100)}%</span>
            </div>

            {selectedSessionData.percentageUsed > 0.85 && (
              <div className="warning-box">
                <strong>⚠️ Warning:</strong> Session is approaching budget limit. Consider compacting or increasing budget.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const tokenBudgetManagerStyles = `
.token-budget-manager {
  padding: 1.5rem;
  background: var(--bg-primary, #0a0a1a);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.token-budget-manager.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-tertiary, #606080);
}

.budget-manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.budget-manager-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.refresh-btn {
  padding: 0.5rem 1rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 6px;
  color: #818cf8;
  cursor: pointer;
  font-size: 0.8125rem;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
}

.auto-compact-settings {
  margin-bottom: 2rem;
}

.setting-card {
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
  padding: 1rem;
}

.setting-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.75rem;
  display: block;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.checkbox-label input {
  cursor: pointer;
}

.threshold-control {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.threshold-control label {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
}

.threshold-control input[type='range'] {
  width: 100%;
}

.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.session-card {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.session-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.session-card.selected {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.session-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
  word-break: break-word;
}

.usage-percentage {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
}

.usage-percentage.normal {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.usage-percentage.warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.usage-percentage.critical {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.budget-bar-container {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.budget-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #818cf8);
  transition: width 0.3s ease;
}

.budget-stats {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.stat {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.compact-button {
  width: 100%;
  padding: 0.5rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 4px;
  color: #10b981;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 0.5rem;
}

.compact-button:hover {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.5);
}

.last-compacted {
  font-size: 0.7rem;
  color: var(--text-tertiary, #606080);
}

.session-detail {
  margin-top: 2rem;
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.detail-header h4 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: color 0.2s ease;
}

.close-button:hover {
  color: var(--text-primary, #fff);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.detail-row label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

.detail-row .value {
  font-size: 0.8125rem;
  color: #818cf8;
  font-weight: 600;
}

.detail-row .value.warning {
  color: #f59e0b;
}

.warning-box {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 4px;
  color: #fcd34d;
  font-size: 0.8125rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary, #606080);
}
`;
