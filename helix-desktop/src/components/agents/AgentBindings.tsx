/**
 * Agent Bindings - Visual routing editor for mapping channels/peers to agents
 *
 * A binding maps: { channel, accountId, peer } -> agentId
 * More specific bindings take priority (peer > account > channel > default).
 *
 * Gateway integration:
 *   - Read bindings from gatewayConfig._raw?.bindings or gatewayConfig._raw?.agents?.bindings
 *   - Write bindings via patchGatewayConfig({ bindings: [...] })
 *   - Read agents list from gatewayConfig.agents?.list for dropdown options
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';
import './AgentEditor.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Binding {
  channel?: string;   // * = any channel
  accountId?: string; // * = any account
  peer?: string;      // * = any peer
  agentId: string;    // target agent
}

interface AgentOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNELS = [
  { id: '*', name: 'Any Channel' },
  { id: 'discord', name: 'Discord' },
  { id: 'telegram', name: 'Telegram' },
  { id: 'whatsapp', name: 'WhatsApp' },
  { id: 'slack', name: 'Slack' },
  { id: 'signal', name: 'Signal' },
  { id: 'web', name: 'Web' },
  { id: 'imessage', name: 'iMessage' },
  { id: 'line', name: 'LINE' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute a specificity score for a binding (higher = more specific). */
function computeSpecificity(binding: Binding): number {
  let score = 0;
  if (binding.channel && binding.channel !== '*') score += 1;
  if (binding.accountId && binding.accountId !== '*') score += 2;
  if (binding.peer && binding.peer !== '*') score += 4;
  return score;
}

/** Label for a specificity score. */
function specificityLabel(score: number): string {
  if (score === 0) return 'Default';
  if (score <= 1) return 'Channel';
  if (score <= 3) return 'Account';
  return 'Peer';
}

/** Find the best-matching binding for a given channel/account/peer tuple. */
function resolveBinding(
  bindings: Binding[],
  defaultAgentId: string,
  channel: string,
  accountId: string,
  peer: string,
): { agentId: string; matchType: string; specificity: number } {
  let bestMatch: Binding | null = null;
  let bestScore = -1;

  for (const b of bindings) {
    const bChannel = b.channel ?? '*';
    const bAccount = b.accountId ?? '*';
    const bPeer = b.peer ?? '*';

    // Check if binding matches
    const channelMatch = bChannel === '*' || bChannel === channel;
    const accountMatch = bAccount === '*' || bAccount === accountId;
    const peerMatch = bPeer === '*' || bPeer === peer;

    if (channelMatch && accountMatch && peerMatch) {
      const score = computeSpecificity(b);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = b;
      }
    }
  }

  if (bestMatch) {
    return {
      agentId: bestMatch.agentId,
      matchType: specificityLabel(bestScore),
      specificity: bestScore,
    };
  }

  return {
    agentId: defaultAgentId,
    matchType: 'Default',
    specificity: 0,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Inline-editable cell for text values (account / peer). */
function EditableCell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (!editing) {
    return (
      <span
        className="ab-cell ab-cell--text"
        onClick={() => setEditing(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true); }}
        title="Click to edit"
      >
        {value === '*' ? (
          <span className="ab-cell__wildcard">*</span>
        ) : (
          value || <span className="ab-cell__placeholder">{placeholder ?? 'any'}</span>
        )}
      </span>
    );
  }

  return (
    <input
      className="ab-cell__input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const trimmed = draft.trim() || '*';
        onChange(trimmed);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          setEditing(false);
          const trimmed = draft.trim() || '*';
          onChange(trimmed);
        }
        if (e.key === 'Escape') {
          setEditing(false);
          setDraft(value);
        }
      }}
      placeholder={placeholder ?? '*'}
      autoFocus
    />
  );
}

/** Inline-editable dropdown cell for channel / agent. */
function DropdownCell({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; name: string }[];
  onChange: (val: string) => void;
}) {
  return (
    <select
      className="ab-cell__select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>{opt.name}</option>
      ))}
    </select>
  );
}

/** Priority badge showing binding specificity. */
function PriorityBadge({ score }: { score: number }) {
  const level = specificityLabel(score);
  const cls =
    score >= 4 ? 'ab-priority--high' :
    score >= 2 ? 'ab-priority--medium' :
    score >= 1 ? 'ab-priority--low' :
    'ab-priority--default';

  return (
    <span className={`ab-priority ${cls}`} title={`Specificity: ${score}`}>
      {level}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AgentBindings() {
  const { connected } = useGateway();
  const { gatewayConfig, patchGatewayConfig } = useGatewayConfig();

  // State
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [defaultAgentId, setDefaultAgentId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test routing state
  const [testChannel, setTestChannel] = useState('discord');
  const [testAccount, setTestAccount] = useState('');
  const [testPeer, setTestPeer] = useState('');

  // Derive agents list from gateway config
  const agents: AgentOption[] = useMemo(() => {
    const list = gatewayConfig?.agents?.list;
    if (!list || list.length === 0) return [];
    return list.map((a) => ({
      id: a.id,
      name: a.name ?? a.id,
    }));
  }, [gatewayConfig?.agents?.list]);

  // Load bindings from gateway config
  useEffect(() => {
    if (!gatewayConfig) return;

    // Try multiple locations for bindings
    const raw = gatewayConfig._raw;
    let loadedBindings: Binding[] = [];
    let loadedDefault = '';

    if (raw) {
      // Check top-level bindings
      if (Array.isArray(raw.bindings)) {
        loadedBindings = raw.bindings as Binding[];
      }
      // Check agents.bindings
      else if (
        raw.agents &&
        typeof raw.agents === 'object' &&
        Array.isArray((raw.agents as Record<string, unknown>).bindings)
      ) {
        loadedBindings = (raw.agents as Record<string, unknown>).bindings as Binding[];
      }

      // Check for default agent
      if (typeof raw.defaultAgent === 'string') {
        loadedDefault = raw.defaultAgent;
      } else if (
        raw.agents &&
        typeof raw.agents === 'object' &&
        typeof (raw.agents as Record<string, unknown>).defaultAgent === 'string'
      ) {
        loadedDefault = (raw.agents as Record<string, unknown>).defaultAgent as string;
      }
    }

    // Fallback default to first agent
    if (!loadedDefault && agents.length > 0) {
      loadedDefault = agents[0].id;
    }

    setBindings(loadedBindings);
    setDefaultAgentId(loadedDefault);
  }, [gatewayConfig, agents]);

  // Persist bindings to gateway
  const persistBindings = useCallback(async (
    newBindings: Binding[],
    newDefaultAgentId: string,
  ) => {
    if (!connected) return;

    setSaving(true);
    setError(null);

    try {
      await patchGatewayConfig({
        bindings: newBindings,
        defaultAgent: newDefaultAgentId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bindings');
    } finally {
      setSaving(false);
    }
  }, [connected, patchGatewayConfig]);

  // Add a new binding row
  const addBinding = useCallback(() => {
    const firstAgent = agents.length > 0 ? agents[0].id : '';
    const updated = [...bindings, { channel: '*', accountId: '*', peer: '*', agentId: firstAgent }];
    setBindings(updated);
    void persistBindings(updated, defaultAgentId);
  }, [bindings, agents, defaultAgentId, persistBindings]);

  // Update a binding at a specific index
  const updateBinding = useCallback((index: number, patch: Partial<Binding>) => {
    const updated = bindings.map((b, i) => (i === index ? { ...b, ...patch } : b));
    setBindings(updated);
    void persistBindings(updated, defaultAgentId);
  }, [bindings, defaultAgentId, persistBindings]);

  // Delete a binding at a specific index
  const deleteBinding = useCallback((index: number) => {
    const updated = bindings.filter((_, i) => i !== index);
    setBindings(updated);
    void persistBindings(updated, defaultAgentId);
  }, [bindings, defaultAgentId, persistBindings]);

  // Update default agent
  const updateDefaultAgent = useCallback((agentId: string) => {
    setDefaultAgentId(agentId);
    void persistBindings(bindings, agentId);
  }, [bindings, persistBindings]);

  // Compute test routing result
  const testResult = useMemo(() => {
    return resolveBinding(
      bindings,
      defaultAgentId,
      testChannel,
      testAccount || '*',
      testPeer || '*',
    );
  }, [bindings, defaultAgentId, testChannel, testAccount, testPeer]);

  // Resolve agent name from id
  const agentName = useCallback((id: string): string => {
    const agent = agents.find((a) => a.id === id);
    return agent ? agent.name : id || 'Unknown';
  }, [agents]);

  // Agent options for dropdown (including * wildcard for channel only)
  const agentOptions = useMemo((): { id: string; name: string }[] => {
    if (agents.length === 0) {
      return [{ id: '', name: 'No agents' }];
    }
    return agents;
  }, [agents]);

  // ---------------------------------------------------------------------------
  // Disconnected state
  // ---------------------------------------------------------------------------
  if (!connected) {
    return (
      <div className="ab-container">
        <div className="am-disconnected">
          <div className="am-disconnected__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
            </svg>
          </div>
          <h3 className="am-disconnected__title">Gateway Not Connected</h3>
          <p className="am-disconnected__desc">
            Start the gateway to configure agent routing. Binding configuration requires an active gateway connection.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="ab-container">
      {/* Header */}
      <div className="ab-header">
        <div className="ab-header__text">
          <h2 className="ab-header__title">Agent Routing</h2>
          <p className="ab-header__subtitle">
            Configure which agent handles each channel, account, and contact
          </p>
        </div>
        {saving && <span className="ab-saving">Saving...</span>}
      </div>

      {error && <div className="am-error">{error}</div>}

      {/* Default Agent */}
      <section className="ab-section">
        <div className="ab-section__header">
          <h3 className="ab-section__title">Default Agent</h3>
        </div>
        <p className="ab-section__desc">
          The fallback agent used when no specific binding matches.
        </p>
        <div className="ab-default-select">
          <select
            className="am-detail__select"
            value={defaultAgentId}
            onChange={(e) => updateDefaultAgent(e.target.value)}
            disabled={agents.length === 0}
          >
            {agents.length === 0 ? (
              <option value="">No agents configured</option>
            ) : (
              agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))
            )}
          </select>
        </div>
      </section>

      {/* Bindings Table */}
      <section className="ab-section">
        <div className="ab-section__header">
          <h3 className="ab-section__title">Bindings</h3>
          <button
            className="ab-add-btn"
            onClick={addBinding}
            disabled={agents.length === 0}
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M7 1v12M1 7h12" />
            </svg>
            Add Rule
          </button>
        </div>

        {bindings.length === 0 ? (
          <div className="ab-empty">
            <p className="ab-empty__text">
              No routing rules configured. All messages will be handled by the default agent.
            </p>
            <button
              className="ab-empty__add"
              onClick={addBinding}
              disabled={agents.length === 0}
              type="button"
            >
              Add your first routing rule
            </button>
          </div>
        ) : (
          <div className="ab-table-wrapper">
            <table className="ab-table">
              <thead>
                <tr>
                  <th className="ab-th">Channel</th>
                  <th className="ab-th">Account</th>
                  <th className="ab-th">Peer</th>
                  <th className="ab-th">Agent</th>
                  <th className="ab-th ab-th--priority">Priority</th>
                  <th className="ab-th ab-th--actions" />
                </tr>
              </thead>
              <tbody>
                {bindings.map((binding, idx) => {
                  const specificity = computeSpecificity(binding);
                  return (
                    <tr key={idx} className="ab-row">
                      <td className="ab-td">
                        <DropdownCell
                          value={binding.channel ?? '*'}
                          options={CHANNELS.map((c) => ({ id: c.id, name: c.name }))}
                          onChange={(val) => updateBinding(idx, { channel: val })}
                        />
                      </td>
                      <td className="ab-td">
                        <EditableCell
                          value={binding.accountId ?? '*'}
                          onChange={(val) => updateBinding(idx, { accountId: val })}
                          placeholder="any"
                        />
                      </td>
                      <td className="ab-td">
                        <EditableCell
                          value={binding.peer ?? '*'}
                          onChange={(val) => updateBinding(idx, { peer: val })}
                          placeholder="any"
                        />
                      </td>
                      <td className="ab-td">
                        <DropdownCell
                          value={binding.agentId}
                          options={agentOptions}
                          onChange={(val) => updateBinding(idx, { agentId: val })}
                        />
                      </td>
                      <td className="ab-td ab-td--priority">
                        <PriorityBadge score={specificity} />
                      </td>
                      <td className="ab-td ab-td--actions">
                        <button
                          className="ab-delete-btn"
                          onClick={() => deleteBinding(idx)}
                          type="button"
                          title="Delete rule"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1.75 3.5h10.5M4.67 3.5V2.33a1.17 1.17 0 011.16-1.16h2.34a1.17 1.17 0 011.16 1.16V3.5m1.75 0v8.17a1.17 1.17 0 01-1.16 1.16H4.08a1.17 1.17 0 01-1.16-1.16V3.5h8.16z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Test Routing */}
      <section className="ab-section">
        <div className="ab-section__header">
          <h3 className="ab-section__title">Test Routing</h3>
        </div>
        <p className="ab-section__desc">
          Simulate a message to see which agent would handle it.
        </p>

        <div className="ab-test-grid">
          <div className="ab-test-field">
            <label className="ab-test-label">Channel</label>
            <select
              className="am-detail__select"
              value={testChannel}
              onChange={(e) => setTestChannel(e.target.value)}
            >
              {CHANNELS.filter((c) => c.id !== '*').map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="ab-test-field">
            <label className="ab-test-label">Account</label>
            <input
              className="am-detail__input"
              value={testAccount}
              onChange={(e) => setTestAccount(e.target.value)}
              placeholder="e.g. guild-123"
            />
          </div>
          <div className="ab-test-field">
            <label className="ab-test-label">Peer</label>
            <input
              className="am-detail__input"
              value={testPeer}
              onChange={(e) => setTestPeer(e.target.value)}
              placeholder="e.g. john"
            />
          </div>
        </div>

        <div className="ab-test-result">
          <div className="ab-test-result__arrow">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10h12M12 6l4 4-4 4" />
            </svg>
          </div>
          <div className="ab-test-result__body">
            <span className="ab-test-result__label">Routes to:</span>
            <span className="ab-test-result__agent">{agentName(testResult.agentId)}</span>
            <span className={`ab-test-result__match ab-test-result__match--${testResult.matchType.toLowerCase()}`}>
              ({testResult.matchType} match)
            </span>
          </div>
        </div>
      </section>

      {/* Inline styles scoped to this component */}
      <style>{`
        /* =====================================================================
           Agent Bindings - Scoped styles
           ===================================================================== */

        .ab-container {
          padding: 1.5rem;
          height: 100%;
          overflow-y: auto;
        }

        .ab-container::-webkit-scrollbar {
          width: 6px;
        }
        .ab-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .ab-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
        }
        .ab-container::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        /* Header */
        .ab-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1.75rem;
        }

        .ab-header__title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #ffffff;
          margin: 0 0 0.25rem;
        }

        .ab-header__subtitle {
          font-size: 0.875rem;
          color: #a0a0c0;
          margin: 0;
        }

        .ab-saving {
          font-size: 0.75rem;
          color: #6366f1;
          padding: 0.375rem 0.75rem;
          background: rgba(99, 102, 241, 0.1);
          border-radius: 6px;
          animation: ab-pulse 1s ease-in-out infinite;
        }

        @keyframes ab-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Sections */
        .ab-section {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1.25rem;
          transition: border-color 0.2s ease;
        }

        .ab-section:hover {
          border-color: rgba(255, 255, 255, 0.12);
        }

        .ab-section__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .ab-section__title {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #606080;
          margin: 0;
        }

        .ab-section__desc {
          font-size: 0.8125rem;
          color: #a0a0c0;
          margin: 0 0 1rem;
          line-height: 1.5;
        }

        /* Default agent selector */
        .ab-default-select {
          max-width: 320px;
        }

        /* Add rule button */
        .ab-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #6366f1;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }

        .ab-add-btn:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.18);
          border-color: rgba(99, 102, 241, 0.45);
        }

        .ab-add-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Empty state */
        .ab-empty {
          text-align: center;
          padding: 2rem 1rem;
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.01);
        }

        .ab-empty__text {
          font-size: 0.8125rem;
          color: #606080;
          margin: 0 0 1rem;
        }

        .ab-empty__add {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #6366f1;
          background: none;
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 6px;
          padding: 0.5rem 1rem;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }

        .ab-empty__add:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.1);
        }

        .ab-empty__add:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Table */
        .ab-table-wrapper {
          overflow-x: auto;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .ab-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8125rem;
        }

        .ab-th {
          text-align: left;
          padding: 0.625rem 0.75rem;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #606080;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          white-space: nowrap;
        }

        .ab-th--priority {
          width: 90px;
          text-align: center;
        }

        .ab-th--actions {
          width: 40px;
        }

        .ab-row {
          transition: background 0.15s ease;
        }

        .ab-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .ab-td {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          vertical-align: middle;
        }

        .ab-td--priority {
          text-align: center;
        }

        .ab-td--actions {
          text-align: center;
        }

        .ab-row:last-child .ab-td {
          border-bottom: none;
        }

        /* Editable cell */
        .ab-cell {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s ease;
          min-width: 50px;
        }

        .ab-cell:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .ab-cell--text {
          color: #ffffff;
          font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
          font-size: 0.8125rem;
        }

        .ab-cell__wildcard {
          color: #606080;
          font-weight: 600;
        }

        .ab-cell__placeholder {
          color: #606080;
          font-style: italic;
        }

        .ab-cell__input {
          width: 100%;
          min-width: 80px;
          padding: 0.25rem 0.5rem;
          background: #0a0a1a;
          border: 1px solid #6366f1;
          border-radius: 4px;
          font-size: 0.8125rem;
          color: #ffffff;
          font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
          outline: none;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .ab-cell__select {
          padding: 0.25rem 0.5rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          font-size: 0.8125rem;
          color: #ffffff;
          cursor: pointer;
          transition: border-color 0.15s ease;
          font-family: inherit;
          -webkit-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23606080' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.5rem center;
          padding-right: 1.75rem;
        }

        .ab-cell__select:hover {
          border-color: rgba(99, 102, 241, 0.35);
        }

        .ab-cell__select:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
        }

        .ab-cell__select option {
          background: #111127;
          color: #ffffff;
        }

        /* Delete button */
        .ab-delete-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          background: none;
          border: 1px solid transparent;
          border-radius: 6px;
          color: #606080;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ab-delete-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.25);
        }

        /* Priority badge */
        .ab-priority {
          display: inline-block;
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          white-space: nowrap;
        }

        .ab-priority--default {
          background: rgba(255, 255, 255, 0.05);
          color: #606080;
        }

        .ab-priority--low {
          background: rgba(99, 102, 241, 0.1);
          color: #818cf8;
        }

        .ab-priority--medium {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
        }

        .ab-priority--high {
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
        }

        /* Test routing */
        .ab-test-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        @media (max-width: 700px) {
          .ab-test-grid {
            grid-template-columns: 1fr;
          }
        }

        .ab-test-field {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .ab-test-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #ffffff;
        }

        /* Test result */
        .ab-test-result {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 1rem 1.25rem;
          background: rgba(99, 102, 241, 0.06);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 8px;
        }

        .ab-test-result__arrow {
          color: #6366f1;
          flex-shrink: 0;
        }

        .ab-test-result__body {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .ab-test-result__label {
          font-size: 0.8125rem;
          color: #a0a0c0;
        }

        .ab-test-result__agent {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #ffffff;
        }

        .ab-test-result__match {
          font-size: 0.75rem;
          font-weight: 500;
        }

        .ab-test-result__match--default {
          color: #606080;
        }

        .ab-test-result__match--channel {
          color: #818cf8;
        }

        .ab-test-result__match--account {
          color: #fbbf24;
        }

        .ab-test-result__match--peer {
          color: #4ade80;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .ab-container {
            padding: 1rem;
          }

          .ab-table {
            font-size: 0.75rem;
          }

          .ab-th,
          .ab-td {
            padding: 0.375rem 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
