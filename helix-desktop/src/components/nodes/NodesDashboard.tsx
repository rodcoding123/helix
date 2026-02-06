/**
 * Nodes Dashboard - Discovery and management hub for remote nodes
 *
 * Gateway methods used:
 *   - nodes.discover  -> Find available nodes on the network
 *   - nodes.status    -> Get status of all known nodes
 *   - nodes.describe  -> Get detailed info for a specific node
 *   - nodes.invoke    -> Execute commands on a node
 *   - nodes.rename    -> Rename a node
 *
 * CSS prefix: nd-
 */

import { useState, useEffect, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { NodeDetail } from './NodeDetail';
import { NodeCommands } from './NodeCommands';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeInfo {
  id: string;
  name: string;
  platform?: string;
  status: 'online' | 'offline' | 'busy';
  capabilities: string[];
  permissions?: string[];
  lastSeen?: string;
  version?: string;
  ip?: string;
}

interface NodesDashboardProps {
  onBack?: () => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = `
/* ── Container ── */
.nd-container {
  padding: 1.5rem;
  height: 100%;
  overflow-y: auto;
}

/* ── Header ── */
.nd-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.75rem;
}

.nd-header__text {
  flex: 1;
}

.nd-header__title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.nd-header__count {
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(99, 102, 241, 0.15);
  color: var(--accent-color, #6366f1);
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

.nd-header__subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
}

.nd-header__actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.nd-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0.375rem 0;
  margin-bottom: 1rem;
  transition: color 0.15s ease;
}

.nd-back-btn:hover {
  color: var(--text-primary, #fff);
}

/* ── Buttons ── */
.nd-btn-primary {
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  background: var(--accent-color, #6366f1);
  color: #fff;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.nd-btn-primary:hover:not(:disabled) {
  background: #4f46e5;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
}

.nd-btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.nd-btn-secondary {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.nd-btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #fff);
}

.nd-btn-secondary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Node Grid ── */
.nd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
}

/* ── Node Card ── */
.nd-card {
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nd-card:hover {
  border-color: rgba(99, 102, 241, 0.35);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.1);
  background: rgba(255, 255, 255, 0.05);
}

.nd-card:focus-visible {
  outline: 2px solid var(--accent-color, #6366f1);
  outline-offset: 2px;
}

.nd-card--offline {
  opacity: 0.55;
}

.nd-card--offline:hover {
  opacity: 0.75;
}

.nd-card__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.nd-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.nd-card__title-group {
  flex: 1;
  min-width: 0;
}

.nd-card__name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.nd-card__platform {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.125rem;
  display: block;
}

.nd-card__status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  flex-shrink: 0;
}

.nd-card__status--online {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.nd-card__status--offline {
  color: var(--text-tertiary, #606080);
  background: rgba(255, 255, 255, 0.04);
}

.nd-card__status--busy {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.nd-card__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.nd-card__status--online .nd-card__status-dot {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
}

.nd-card__status--offline .nd-card__status-dot {
  background: var(--text-tertiary, #606080);
}

.nd-card__status--busy .nd-card__status-dot {
  background: #f59e0b;
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
}

.nd-card__caps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.nd-card__cap {
  font-size: 0.6875rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary, #a0a0c0);
  white-space: nowrap;
}

.nd-card__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.nd-card__actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.nd-card__action-btn {
  padding: 0.35rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.nd-card__action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #fff);
}

.nd-card__action-btn--primary {
  background: rgba(99, 102, 241, 0.1);
  color: var(--accent-color, #6366f1);
  border-color: rgba(99, 102, 241, 0.2);
}

.nd-card__action-btn--primary:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.4);
}

/* ── Empty state ── */
.nd-empty {
  text-align: center;
  padding: 4rem 2rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

.nd-empty__icon {
  margin-bottom: 1.25rem;
  color: var(--text-tertiary, #606080);
  opacity: 0.5;
}

.nd-empty__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.5rem;
}

.nd-empty__desc {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0 1.5rem;
  max-width: 360px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
}

/* ── Disconnected state ── */
.nd-disconnected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 3rem;
  color: var(--text-tertiary, #606080);
}

.nd-disconnected__icon {
  margin-bottom: 1.5rem;
  opacity: 0.5;
}

.nd-disconnected__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0 0.5rem;
}

.nd-disconnected__desc {
  font-size: 0.875rem;
  color: var(--text-tertiary, #606080);
  max-width: 360px;
  line-height: 1.5;
  margin: 0;
}

/* ── Loading state ── */
.nd-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.875rem;
}

.nd-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: nd-spin 0.7s linear infinite;
}

@keyframes nd-spin {
  to { transform: rotate(360deg); }
}

/* ── Discovering overlay ── */
.nd-discovering {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--accent-color, #6366f1);
  margin-bottom: 1rem;
}

.nd-discovering__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(99, 102, 241, 0.2);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: nd-spin 0.7s linear infinite;
  flex-shrink: 0;
}

/* ── Error banner ── */
.nd-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nd-error__dismiss {
  margin-left: auto;
  background: none;
  border: none;
  color: #fca5a5;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  line-height: 1;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.nd-error__dismiss:hover {
  opacity: 1;
}

/* ── Scrollbar ── */
.nd-container::-webkit-scrollbar {
  width: 6px;
}

.nd-container::-webkit-scrollbar-track {
  background: transparent;
}

.nd-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.nd-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .nd-grid {
    grid-template-columns: 1fr;
  }
  .nd-header {
    flex-direction: column;
    gap: 1rem;
  }
  .nd-header__actions {
    width: 100%;
  }
  .nd-btn-primary,
  .nd-btn-secondary {
    flex: 1;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .nd-container {
    padding: 1rem;
  }
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPlatformIcon(platform?: string): string {
  if (!platform) return '\u{1F5A5}';
  const p = platform.toLowerCase();
  if (p.includes('mac') || p.includes('darwin')) return '\u{1F34E}';
  if (p.includes('win')) return '\u{1FA9F}';
  if (p.includes('linux')) return '\u{1F427}';
  if (p.includes('android')) return '\u{1F4F1}';
  if (p.includes('ios') || p.includes('iphone') || p.includes('ipad')) return '\u{1F4F1}';
  return '\u{1F5A5}';
}

function formatLastSeen(isoStr?: string): string {
  if (!isoStr) return 'Unknown';
  const date = new Date(isoStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NodesDashboard({ onBack }: NodesDashboardProps) {
  const { getClient, connected } = useGateway();

  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [commandsNodeId, setCommandsNodeId] = useState<string | null>(null);

  // ------ Load nodes ------
  const loadNodes = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const result = await client.request<{ nodes: NodeInfo[] }>('nodes.status');
      if (result.nodes) {
        setNodes(result.nodes);
      }
    } catch (err) {
      // Gateway may not support nodes yet - graceful fallback
      console.debug('nodes.status not available:', err);
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    loadNodes();
  }, [loadNodes, connected]);

  // ------ Discover ------
  const discoverNodes = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) return;

    setDiscovering(true);
    setError(null);

    try {
      const result = await client.request<{ nodes: NodeInfo[] }>('nodes.discover');
      if (result.nodes) {
        setNodes((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const newNodes = result.nodes.filter((n) => !existingIds.has(n.id));
          // Update status of existing nodes and add new ones
          const updated = prev.map((existing) => {
            const fresh = result.nodes.find((n) => n.id === existing.id);
            return fresh ? { ...existing, ...fresh } : existing;
          });
          return [...updated, ...newNodes];
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  }, [getClient]);

  // ------ Refresh ------
  const refreshNodes = useCallback(async () => {
    setLoading(true);
    await loadNodes();
  }, [loadNodes]);

  // ------ Rename ------
  const renameNode = useCallback(async (nodeId: string, newName: string) => {
    const client = getClient();
    if (!client?.connected) return;

    // Optimistic update
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, name: newName } : n))
    );

    try {
      await client.request('nodes.rename', { nodeId, name: newName });
    } catch (err) {
      // Revert
      await loadNodes();
      setError(err instanceof Error ? err.message : 'Failed to rename node');
    }
  }, [getClient, loadNodes]);

  // ------ Invoke ------
  const invokeOnNode = useCallback(async (
    nodeId: string,
    capability: string,
    params?: Record<string, unknown>
  ): Promise<unknown> => {
    const client = getClient();
    if (!client?.connected) {
      throw new Error('Gateway not connected');
    }

    const result = await client.request('nodes.invoke', {
      nodeId,
      capability,
      params,
    });
    return result;
  }, [getClient]);

  // ------ Derived ------
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const commandsNode = nodes.find((n) => n.id === commandsNodeId) ?? null;
  const onlineCount = nodes.filter((n) => n.status === 'online').length;

  // ------ Not connected ------
  if (!connected && nodes.length === 0 && !loading) {
    return (
      <div className="nd-container">
        <style>{styles}</style>
        {onBack && (
          <button className="nd-back-btn" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        )}
        <div className="nd-disconnected">
          <div className="nd-disconnected__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
          </div>
          <h3 className="nd-disconnected__title">Gateway Not Connected</h3>
          <p className="nd-disconnected__desc">
            Start the gateway to discover and manage remote nodes. Node management requires an active gateway connection.
          </p>
        </div>
      </div>
    );
  }

  // ------ Loading ------
  if (loading) {
    return (
      <div className="nd-container">
        <style>{styles}</style>
        <div className="nd-loading">
          <div className="nd-spinner" />
          <span>Loading nodes...</span>
        </div>
      </div>
    );
  }

  // ------ Node Commands view ------
  if (commandsNode) {
    return (
      <div className="nd-container">
        <style>{styles}</style>
        <NodeCommands
          nodeId={commandsNode.id}
          nodeName={commandsNode.name}
          onClose={() => setCommandsNodeId(null)}
        />
      </div>
    );
  }

  // ------ Node Detail view ------
  if (selectedNode) {
    return (
      <div className="nd-container">
        <style>{styles}</style>
        <NodeDetail
          nodeId={selectedNode.id}
          name={selectedNode.name}
          platform={selectedNode.platform}
          status={selectedNode.status}
          capabilities={selectedNode.capabilities}
          permissions={selectedNode.permissions}
          onRename={renameNode}
          onInvoke={(id, cap, params) => {
            invokeOnNode(id, cap, params).catch((err) => {
              setError(err instanceof Error ? err.message : 'Invoke failed');
            });
          }}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>
    );
  }

  // ------ List view (default) ------
  return (
    <div className="nd-container">
      <style>{styles}</style>

      {onBack && (
        <button className="nd-back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      )}

      <header className="nd-header">
        <div className="nd-header__text">
          <h2 className="nd-header__title">
            Nodes
            {nodes.length > 0 && (
              <span className="nd-header__count">
                {onlineCount}/{nodes.length}
              </span>
            )}
          </h2>
          <p className="nd-header__subtitle">
            Discover and control remote nodes
          </p>
        </div>
        <div className="nd-header__actions">
          <button
            className="nd-btn-primary"
            onClick={discoverNodes}
            disabled={discovering || !connected}
          >
            {discovering ? (
              <>
                <span className="nd-discovering__spinner" />
                Scanning...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="22" y1="12" x2="18" y2="12" />
                  <line x1="6" y1="12" x2="2" y2="12" />
                  <line x1="12" y1="6" x2="12" y2="2" />
                  <line x1="12" y1="22" x2="12" y2="18" />
                </svg>
                Discover
              </>
            )}
          </button>
          <button
            className="nd-btn-secondary"
            onClick={refreshNodes}
            disabled={loading || !connected}
            title="Refresh node status"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
        </div>
      </header>

      {error && (
        <div className="nd-error">
          <span>{error}</span>
          <button className="nd-error__dismiss" onClick={() => setError(null)}>
            &times;
          </button>
        </div>
      )}

      {discovering && (
        <div className="nd-discovering">
          <span className="nd-discovering__spinner" />
          Scanning network for nodes...
        </div>
      )}

      {nodes.length === 0 ? (
        <div className="nd-empty">
          <div className="nd-empty__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
          </div>
          <h3 className="nd-empty__title">No Nodes Discovered</h3>
          <p className="nd-empty__desc">
            Click Discover to scan the network for available nodes, or connect devices running the Helix node agent.
          </p>
          <button
            className="nd-btn-primary"
            onClick={discoverNodes}
            disabled={discovering || !connected}
          >
            {discovering ? 'Scanning...' : 'Discover Nodes'}
          </button>
        </div>
      ) : (
        <div className="nd-grid">
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`nd-card ${node.status === 'offline' ? 'nd-card--offline' : ''}`}
              onClick={() => setSelectedNodeId(node.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setSelectedNodeId(node.id); }}
            >
              <div className="nd-card__header">
                <div className="nd-card__icon">
                  {getPlatformIcon(node.platform)}
                </div>
                <div className="nd-card__title-group">
                  <span className="nd-card__name">{node.name}</span>
                  {node.platform && (
                    <span className="nd-card__platform">{node.platform}</span>
                  )}
                </div>
                <span className={`nd-card__status nd-card__status--${node.status}`}>
                  <span className="nd-card__status-dot" />
                  {node.status}
                </span>
              </div>

              {node.capabilities.length > 0 && (
                <div className="nd-card__caps">
                  {node.capabilities.slice(0, 5).map((cap) => (
                    <span key={cap} className="nd-card__cap">{cap}</span>
                  ))}
                  {node.capabilities.length > 5 && (
                    <span className="nd-card__cap">+{node.capabilities.length - 5}</span>
                  )}
                </div>
              )}

              <div className="nd-card__actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="nd-card__action-btn nd-card__action-btn--primary"
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  Details
                </button>
                {node.capabilities.includes('system.run') && node.status === 'online' && (
                  <button
                    className="nd-card__action-btn"
                    onClick={() => setCommandsNodeId(node.id)}
                  >
                    Terminal
                  </button>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary, #606080)' }}>
                  {formatLastSeen(node.lastSeen)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NodesDashboard;
