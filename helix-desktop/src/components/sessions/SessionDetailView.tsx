/**
 * Session Detail View
 *
 * Consolidated view of all session intelligence (config, tokens, context, history)
 * Phase G.4 - Context Visualization & Integration
 */

import { useState } from 'react';
import { TokenBudgetVisualizer } from './TokenBudgetVisualizer';
import { ResetModeSelector } from './ResetModeSelector';
import { ContextWindowVisualizer } from './ContextWindowVisualizer';

type TabType = 'overview' | 'config' | 'tokens' | 'context' | 'history';

interface SessionDetailViewProps {
  sessionKey: string;
  onClose: () => void;
}

export function SessionDetailView({ sessionKey, onClose }: SessionDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'config', label: 'Configuration', icon: '⚙️' },
    { id: 'tokens', label: 'Token Budget', icon: '💰' },
    { id: 'context', label: 'Context Window', icon: '📊' },
    { id: 'history', label: 'History', icon: '📜' },
  ];

  return (
    <div className="session-detail-view">
      <style>{sessionDetailViewStyles}</style>

      {/* Header */}
      <div className="detail-view-header">
        <div className="header-left">
          <h2>Session Details</h2>
          <span className="session-key">{sessionKey}</span>
        </div>
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="tab-pane">
            <h3>Session Overview</h3>
            <div className="overview-grid">
              <div className="overview-card">
                <div className="card-icon">🆔</div>
                <div className="card-content">
                  <div className="card-label">Session Key</div>
                  <div className="card-value code">{sessionKey}</div>
                </div>
              </div>

              <div className="overview-card">
                <div className="card-icon">📅</div>
                <div className="card-content">
                  <div className="card-label">Created</div>
                  <div className="card-value">{new Date().toLocaleDateString()}</div>
                </div>
              </div>

              <div className="overview-card">
                <div className="card-icon">💭</div>
                <div className="card-content">
                  <div className="card-label">Message Count</div>
                  <div className="card-value">-</div>
                </div>
              </div>

              <div className="overview-card">
                <div className="card-icon">⏰</div>
                <div className="card-content">
                  <div className="card-label">Last Activity</div>
                  <div className="card-value">Just now</div>
                </div>
              </div>
            </div>

            <div className="info-section">
              <h4>Quick Actions</h4>
              <div className="action-buttons">
                <button className="action-btn">Export Session</button>
                <button className="action-btn">Reset Session</button>
                <button className="action-btn danger">Delete Session</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="tab-pane">
            <ResetModeSelector sessionKey={sessionKey} />
          </div>
        )}

        {activeTab === 'tokens' && (
          <div className="tab-pane">
            <TokenBudgetVisualizer />
          </div>
        )}

        {activeTab === 'context' && (
          <div className="tab-pane">
            <ContextWindowVisualizer sessionKey={sessionKey} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="tab-pane">
            <h3>Session History</h3>
            <div className="history-section">
              <p>Session history and analytics coming soon.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const sessionDetailViewStyles = `
.session-detail-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.detail-view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: rgba(99, 102, 241, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.detail-view-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.session-key {
  padding: 0.375rem 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 4px;
  font-size: 0.75rem;
  color: #818cf8;
  font-family: monospace;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: color 0.2s ease;
}

.close-button:hover {
  color: var(--text-primary, #fff);
}

.tab-navigation {
  display: flex;
  gap: 0;
  padding: 0 1.5rem;
  background: var(--bg-secondary, #111127);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  overflow-x: auto;
  flex-shrink: 0;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  white-space: nowrap;
}

.tab-button:hover {
  color: var(--text-primary, #fff);
  border-bottom-color: rgba(99, 102, 241, 0.3);
}

.tab-button.active {
  color: #818cf8;
  border-bottom-color: #818cf8;
}

.tab-icon {
  font-size: 1rem;
}

.tab-label {
  font-size: 0.875rem;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tab-pane h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.tab-pane h4 {
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.overview-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
}

.card-icon {
  font-size: 1.75rem;
  flex-shrink: 0;
}

.card-content {
  flex: 1;
}

.card-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.25rem;
}

.card-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.card-value.code {
  font-family: monospace;
  color: #818cf8;
  font-size: 0.8125rem;
}

.info-section {
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
}

.info-section h4 {
  margin: 0 0 1rem 0;
}

.action-buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.action-btn {
  padding: 0.75rem 1rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 6px;
  color: #818cf8;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.action-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
}

.action-btn.danger {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.history-section {
  padding: 2rem;
  text-align: center;
  color: var(--text-tertiary, #606080);
}

/* Scrollbar styling */
.tab-content::-webkit-scrollbar {
  width: 8px;
}

.tab-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
}

.tab-content::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.3);
  border-radius: 4px;
}

.tab-content::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.5);
}
`;
