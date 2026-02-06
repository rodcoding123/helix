/**
 * NodeExecPolicy - Execution policy configuration per node
 *
 * Configures default exec node, security policy (deny/allow by default),
 * per-node command rules (allowlist/denylist with glob patterns),
 * and a test command facility.
 *
 * Gateway methods used:
 *   - config.patch (tools.exec.node) -> Set default exec node
 *   - nodes.status                   -> Get available nodes
 *
 * CSS prefix: nep-
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeExecPolicyProps {
  onBack?: () => void;
}

type SecurityPolicy = 'deny' | 'allow';

interface NodeRule {
  nodeId: string;
  nodeName: string;
  allowPatterns: string[];
  denyPatterns: string[];
  overrideDefault: boolean;
}

interface TestResult {
  command: string;
  nodeId: string;
  outcome: 'approved' | 'denied' | 'require-approval';
  reason: string;
}

interface NodeInfo {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = `
/* ── Container ── */
.nep-container {
  padding: 1.5rem;
  height: 100%;
  overflow-y: auto;
}

/* ── Back button ── */
.nep-back {
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

.nep-back:hover {
  color: var(--text-primary, #fff);
}

/* ── Header ── */
.nep-header {
  margin-bottom: 1.75rem;
}

.nep-header__title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.25rem;
}

.nep-header__subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
}

/* ── Section ── */
.nep-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}

.nep-section__title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary, #606080);
  margin: 0 0 1rem;
}

.nep-section__desc {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0 1rem;
  line-height: 1.4;
}

/* ── Field ── */
.nep-field {
  margin-bottom: 1rem;
}

.nep-field:last-child {
  margin-bottom: 0;
}

.nep-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
  margin-bottom: 0.375rem;
}

.nep-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.25rem;
}

/* ── Select ── */
.nep-select {
  width: 100%;
  max-width: 400px;
  padding: 0.625rem 0.875rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text-primary, #fff);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23606080' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}

.nep-select:focus {
  outline: none;
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.nep-select option {
  background: var(--bg-secondary, #111127);
  color: var(--text-primary, #fff);
}

/* ── Radio cards ── */
.nep-radio-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 600px) {
  .nep-radio-row {
    grid-template-columns: 1fr;
  }
}

.nep-radio-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nep-radio-card:hover {
  border-color: rgba(99, 102, 241, 0.35);
}

.nep-radio-card--selected {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.06);
}

.nep-radio-card__indicator {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  transition: all 0.15s ease;
}

.nep-radio-card--selected .nep-radio-card__indicator {
  border-color: var(--accent-color, #6366f1);
  background: var(--accent-color, #6366f1);
  box-shadow: inset 0 0 0 3px var(--bg-primary, #0a0a1a);
}

.nep-radio-card__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.nep-radio-card__desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.4;
}

.nep-radio-card--selected .nep-radio-card__desc {
  color: var(--text-secondary, #a0a0c0);
}

.nep-radio-card__icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

/* ── Per-node rules ── */
.nep-node-rules {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.nep-node-rule {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.nep-node-rule:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.nep-node-rule__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.nep-node-rule__header:hover {
  background: rgba(255, 255, 255, 0.02);
}

.nep-node-rule__name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nep-node-rule__chevron {
  color: var(--text-tertiary, #606080);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.nep-node-rule__chevron--open {
  transform: rotate(90deg);
}

.nep-node-rule__body {
  padding: 0 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

/* ── Tag input ── */
.nep-tag-section {
  margin-bottom: 0;
}

.nep-tag-section__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
  margin-bottom: 0.375rem;
  display: block;
}

.nep-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
  min-height: 32px;
}

.nep-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-family: 'SF Mono', 'Consolas', monospace;
}

.nep-tag--allow {
  background: rgba(16, 185, 129, 0.12);
  color: #4ade80;
}

.nep-tag--deny {
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
}

.nep-tag__remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.875rem;
  line-height: 1;
  padding: 0 0.1rem;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.nep-tag__remove:hover {
  opacity: 1;
}

.nep-tag-input {
  padding: 0.2rem 0.5rem;
  font-size: 0.6875rem;
  font-family: 'SF Mono', 'Consolas', monospace;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  outline: none;
  min-width: 100px;
  transition: border-color 0.15s ease;
}

.nep-tag-input:focus {
  border-color: var(--accent-color, #6366f1);
  border-style: solid;
}

.nep-tag-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.nep-tag-examples {
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.25rem;
}

/* ── Override toggle row ── */
.nep-override-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0;
}

.nep-override-row__text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.nep-override-row__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.nep-override-row__hint {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

.nep-toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.nep-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.nep-toggle__slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #1a1a3a;
  border-radius: 22px;
  transition: background 0.2s ease;
}

.nep-toggle__slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 3px;
  bottom: 3px;
  background: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.nep-toggle input:checked + .nep-toggle__slider {
  background: var(--accent-color, #6366f1);
}

.nep-toggle input:checked + .nep-toggle__slider::before {
  transform: translateX(18px);
}

/* ── Test Command section ── */
.nep-test {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.nep-test__row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.nep-test__input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nep-test__input {
  padding: 0.625rem 0.875rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  font-family: 'SF Mono', 'Consolas', monospace;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.nep-test__input:focus {
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.nep-test__input::placeholder {
  color: var(--text-tertiary, #606080);
}

.nep-test__select {
  padding: 0.625rem 0.875rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23606080' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
  min-width: 140px;
}

.nep-test__select:focus {
  outline: none;
  border-color: var(--accent-color, #6366f1);
}

.nep-test__select option {
  background: var(--bg-secondary, #111127);
  color: var(--text-primary, #fff);
}

.nep-test__btn {
  padding: 0.625rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  background: var(--accent-color, #6366f1);
  color: #fff;
  border: none;
  white-space: nowrap;
}

.nep-test__btn:hover:not(:disabled) {
  background: #4f46e5;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
}

.nep-test__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Test result ── */
.nep-test-result {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.nep-test-result--approved {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #34d399;
}

.nep-test-result--denied {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #fca5a5;
}

.nep-test-result--require-approval {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

.nep-test-result__icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.nep-test-result__text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.nep-test-result__outcome {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
}

.nep-test-result__reason {
  font-size: 0.75rem;
  opacity: 0.8;
}

/* ── Save bar ── */
.nep-save-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: rgba(10, 10, 26, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 1.5rem -1.5rem -1.5rem;
}

.nep-save-bar__status {
  font-size: 0.8125rem;
  color: #f59e0b;
  font-weight: 500;
}

.nep-save-bar__actions {
  display: flex;
  gap: 0.75rem;
}

.nep-save-bar__btn {
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.nep-save-bar__btn--discard {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.nep-save-bar__btn--discard:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #fff);
}

.nep-save-bar__btn--save {
  background: var(--accent-color, #6366f1);
  color: #fff;
  border: none;
}

.nep-save-bar__btn--save:hover:not(:disabled) {
  background: #4f46e5;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
}

.nep-save-bar__btn--save:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Disconnected ── */
.nep-disconnected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 3rem;
  color: var(--text-tertiary, #606080);
}

.nep-disconnected__icon {
  margin-bottom: 1.5rem;
  opacity: 0.5;
}

.nep-disconnected__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0 0.5rem;
}

.nep-disconnected__desc {
  font-size: 0.875rem;
  color: var(--text-tertiary, #606080);
  max-width: 360px;
  line-height: 1.5;
  margin: 0;
}

/* ── Error banner ── */
.nep-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

/* ── Scrollbar ── */
.nep-container::-webkit-scrollbar {
  width: 6px;
}

.nep-container::-webkit-scrollbar-track {
  background: transparent;
}

.nep-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.nep-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .nep-container {
    padding: 1rem;
  }
  .nep-test__row {
    flex-direction: column;
    align-items: stretch;
  }
  .nep-save-bar {
    flex-direction: column;
    gap: 0.5rem;
  }
  .nep-save-bar__actions {
    width: 100%;
  }
  .nep-save-bar__btn {
    flex: 1;
    text-align: center;
  }
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple glob-to-regex converter for testing command patterns.
 * Supports: * (any chars), ? (single char)
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function testCommandAgainstPolicy(
  command: string,
  nodeId: string,
  defaultPolicy: SecurityPolicy,
  nodeRules: NodeRule[]
): TestResult {
  const rule = nodeRules.find((r) => r.nodeId === nodeId);
  const effectivePolicy = rule?.overrideDefault ? defaultPolicy : defaultPolicy;

  // Check denylist first (always blocks)
  const denyPatterns = rule?.denyPatterns ?? [];
  for (const pattern of denyPatterns) {
    try {
      if (globToRegex(pattern).test(command)) {
        return {
          command,
          nodeId,
          outcome: 'denied',
          reason: `Matched deny pattern: ${pattern}`,
        };
      }
    } catch {
      // Skip invalid patterns
    }
  }

  // Check allowlist
  const allowPatterns = rule?.allowPatterns ?? [];
  for (const pattern of allowPatterns) {
    try {
      if (globToRegex(pattern).test(command)) {
        return {
          command,
          nodeId,
          outcome: 'approved',
          reason: `Matched allow pattern: ${pattern}`,
        };
      }
    } catch {
      // Skip invalid patterns
    }
  }

  // Apply default policy
  if (effectivePolicy === 'deny') {
    return {
      command,
      nodeId,
      outcome: 'require-approval',
      reason: 'No matching rule. Default policy: deny (requires approval)',
    };
  }

  return {
    command,
    nodeId,
    outcome: 'approved',
    reason: 'No matching rule. Default policy: allow',
  };
}

// ---------------------------------------------------------------------------
// Tag Input sub-component
// ---------------------------------------------------------------------------

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
  variant,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder: string;
  variant: 'allow' | 'deny';
}) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      const trimmed = input.trim();
      if (!tags.includes(trimmed)) {
        onAdd(trimmed);
      }
      setInput('');
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onRemove(tags[tags.length - 1]);
    }
  };

  return (
    <div className="nep-tag-list">
      {tags.map((tag) => (
        <span key={tag} className={`nep-tag nep-tag--${variant}`}>
          {tag}
          <button
            className="nep-tag__remove"
            onClick={() => onRemove(tag)}
            type="button"
          >
            &times;
          </button>
        </span>
      ))}
      <input
        className="nep-tag-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NodeExecPolicy({ onBack }: NodeExecPolicyProps) {
  const { getClient, connected } = useGateway();
  const { gatewayConfig, patchGatewayConfig } = useGatewayConfig();

  // ── State ──
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Policy config
  const [defaultExecNode, setDefaultExecNode] = useState('local');
  const [securityPolicy, setSecurityPolicy] = useState<SecurityPolicy>('deny');
  const [nodeRules, setNodeRules] = useState<NodeRule[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Test command
  const [testCommand, setTestCommand] = useState('');
  const [testNodeId, setTestNodeId] = useState('local');
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Track unsaved changes
  const [isDirty, setIsDirty] = useState(false);

  // Snapshot of original values for dirty tracking
  const [originalState, setOriginalState] = useState({
    defaultExecNode: 'local',
    securityPolicy: 'deny' as SecurityPolicy,
    nodeRules: [] as NodeRule[],
  });

  // ── Load initial data ──
  const loadData = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      return;
    }

    setError(null);

    try {
      // Fetch nodes
      const nodesResult = await client.request<{ nodes: NodeInfo[] }>('nodes.status').catch(() => ({ nodes: [] }));
      setNodes(nodesResult.nodes ?? []);

      // Extract policy from gateway config
      const rawTools = gatewayConfig?._raw?.tools as Record<string, unknown> | undefined;
      const execNode = (rawTools?.exec as Record<string, unknown>)?.node as string | undefined;
      const policy = (rawTools?.exec as Record<string, unknown>)?.policy as string | undefined;

      if (execNode) setDefaultExecNode(execNode);
      if (policy === 'allow' || policy === 'deny') setSecurityPolicy(policy);

      // Build initial rules from available nodes
      const initialRules: NodeRule[] = (nodesResult.nodes ?? []).map((n) => ({
        nodeId: n.id,
        nodeName: n.name,
        allowPatterns: [],
        denyPatterns: [],
        overrideDefault: false,
      }));
      setNodeRules(initialRules);

      // Store snapshot for dirty tracking
      setOriginalState({
        defaultExecNode: execNode ?? 'local',
        securityPolicy: (policy as SecurityPolicy) ?? 'deny',
        nodeRules: initialRules.map((r) => ({ ...r })),
      });
    } catch (err) {
      console.debug('Failed to load exec policy data:', err);
    } finally {
      setLoading(false);
    }
  }, [getClient, gatewayConfig]);

  useEffect(() => {
    loadData();
  }, [loadData, connected]);

  // ── Dirty tracking ──
  useEffect(() => {
    const dirty =
      defaultExecNode !== originalState.defaultExecNode ||
      securityPolicy !== originalState.securityPolicy ||
      JSON.stringify(nodeRules) !== JSON.stringify(originalState.nodeRules);
    setIsDirty(dirty);
  }, [defaultExecNode, securityPolicy, nodeRules, originalState]);

  // ── Node rule mutations ──
  const updateNodeRule = useCallback((nodeId: string, updates: Partial<NodeRule>) => {
    setNodeRules((prev) =>
      prev.map((r) => (r.nodeId === nodeId ? { ...r, ...updates } : r))
    );
  }, []);

  const addAllowPattern = useCallback((nodeId: string, pattern: string) => {
    setNodeRules((prev) =>
      prev.map((r) =>
        r.nodeId === nodeId
          ? { ...r, allowPatterns: [...r.allowPatterns, pattern] }
          : r
      )
    );
  }, []);

  const removeAllowPattern = useCallback((nodeId: string, pattern: string) => {
    setNodeRules((prev) =>
      prev.map((r) =>
        r.nodeId === nodeId
          ? { ...r, allowPatterns: r.allowPatterns.filter((p) => p !== pattern) }
          : r
      )
    );
  }, []);

  const addDenyPattern = useCallback((nodeId: string, pattern: string) => {
    setNodeRules((prev) =>
      prev.map((r) =>
        r.nodeId === nodeId
          ? { ...r, denyPatterns: [...r.denyPatterns, pattern] }
          : r
      )
    );
  }, []);

  const removeDenyPattern = useCallback((nodeId: string, pattern: string) => {
    setNodeRules((prev) =>
      prev.map((r) =>
        r.nodeId === nodeId
          ? { ...r, denyPatterns: r.denyPatterns.filter((p) => p !== pattern) }
          : r
      )
    );
  }, []);

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // ── Test command ──
  const runTest = useCallback(() => {
    if (!testCommand.trim()) return;
    const result = testCommandAgainstPolicy(
      testCommand.trim(),
      testNodeId,
      securityPolicy,
      nodeRules
    );
    setTestResult(result);
  }, [testCommand, testNodeId, securityPolicy, nodeRules]);

  // ── Save ──
  const save = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      await patchGatewayConfig({
        tools: {
          ...(gatewayConfig?.tools ?? {}),
          exec: {
            node: defaultExecNode,
            policy: securityPolicy,
            nodeRules: nodeRules.map((r) => ({
              nodeId: r.nodeId,
              allow: r.allowPatterns,
              deny: r.denyPatterns,
              overrideDefault: r.overrideDefault,
            })),
          },
        },
      });

      // Update snapshot
      setOriginalState({
        defaultExecNode,
        securityPolicy,
        nodeRules: nodeRules.map((r) => ({ ...r })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  }, [defaultExecNode, securityPolicy, nodeRules, gatewayConfig, patchGatewayConfig]);

  // ── Discard ──
  const discard = useCallback(() => {
    setDefaultExecNode(originalState.defaultExecNode);
    setSecurityPolicy(originalState.securityPolicy);
    setNodeRules(originalState.nodeRules.map((r) => ({ ...r })));
    setTestResult(null);
  }, [originalState]);

  // ── All node options for selects ──
  const nodeOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [{ id: 'local', label: 'Local (this machine)' }];
    nodes.forEach((n) => {
      opts.push({ id: n.id, label: `${n.name} (${n.status})` });
    });
    return opts;
  }, [nodes]);

  // ── Not connected ──
  if (!connected && !loading) {
    return (
      <div className="nep-container">
        <style>{styles}</style>
        {onBack && (
          <button className="nep-back" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        )}
        <div className="nep-disconnected">
          <div className="nep-disconnected__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h3 className="nep-disconnected__title">Gateway Not Connected</h3>
          <p className="nep-disconnected__desc">
            Exec policy configuration requires an active gateway connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="nep-container">
      <style>{styles}</style>

      {onBack && (
        <button className="nep-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      )}

      <header className="nep-header">
        <h2 className="nep-header__title">Execution Policy</h2>
        <p className="nep-header__subtitle">
          Configure command execution rules and default node for running commands
        </p>
      </header>

      {error && <div className="nep-error">{error}</div>}

      {/* Section 1 - Default Exec Node */}
      <section className="nep-section">
        <h3 className="nep-section__title">Default Execution Node</h3>
        <p className="nep-section__desc">
          Which node should execute commands by default when no specific target is provided.
        </p>
        <div className="nep-field">
          <label className="nep-label">Default Node</label>
          <select
            className="nep-select"
            value={defaultExecNode}
            onChange={(e) => setDefaultExecNode(e.target.value)}
          >
            {nodeOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <span className="nep-hint">
            The "local" option always runs commands on this machine.
          </span>
        </div>
      </section>

      {/* Section 2 - Security Policy */}
      <section className="nep-section">
        <h3 className="nep-section__title">Security Policy</h3>
        <p className="nep-section__desc">
          Choose the default behavior for commands that do not match any explicit rule.
        </p>
        <div className="nep-radio-row">
          <div
            className={`nep-radio-card ${securityPolicy === 'deny' ? 'nep-radio-card--selected' : ''}`}
            onClick={() => setSecurityPolicy('deny')}
            role="radio"
            aria-checked={securityPolicy === 'deny'}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSecurityPolicy('deny'); }}
          >
            <span className="nep-radio-card__indicator" />
            <span className="nep-radio-card__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span className="nep-radio-card__title">Deny by Default</span>
            <span className="nep-radio-card__desc">
              All commands require approval unless explicitly allowed in the allowlist. Most secure option.
            </span>
          </div>
          <div
            className={`nep-radio-card ${securityPolicy === 'allow' ? 'nep-radio-card--selected' : ''}`}
            onClick={() => setSecurityPolicy('allow')}
            role="radio"
            aria-checked={securityPolicy === 'allow'}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSecurityPolicy('allow'); }}
          >
            <span className="nep-radio-card__indicator" />
            <span className="nep-radio-card__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className="nep-radio-card__title">Allow by Default</span>
            <span className="nep-radio-card__desc">
              All commands are allowed unless explicitly blocked in the denylist. More permissive.
            </span>
          </div>
        </div>
      </section>

      {/* Section 3 - Per-Node Command Rules */}
      <section className="nep-section">
        <h3 className="nep-section__title">Per-Node Command Rules</h3>
        <p className="nep-section__desc">
          Configure specific allow and deny patterns for each node. Deny rules always take priority.
        </p>

        {nodeRules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-tertiary, #606080)', fontSize: '0.8125rem' }}>
            No remote nodes available. Connect nodes to configure per-node rules.
          </div>
        ) : (
          <div className="nep-node-rules">
            {nodeRules.map((rule) => {
              const isExpanded = expandedNodes.has(rule.nodeId);
              return (
                <div key={rule.nodeId} className="nep-node-rule">
                  <div
                    className="nep-node-rule__header"
                    onClick={() => toggleExpanded(rule.nodeId)}
                  >
                    <span className="nep-node-rule__name">
                      <svg
                        className={`nep-node-rule__chevron ${isExpanded ? 'nep-node-rule__chevron--open' : ''}`}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {rule.nodeName}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary, #606080)' }}>
                      {rule.allowPatterns.length} allow, {rule.denyPatterns.length} deny
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="nep-node-rule__body">
                      {/* Allowlist */}
                      <div className="nep-tag-section">
                        <span className="nep-tag-section__label">Allowlist (auto-approved commands)</span>
                        <TagInput
                          tags={rule.allowPatterns}
                          onAdd={(tag) => addAllowPattern(rule.nodeId, tag)}
                          onRemove={(tag) => removeAllowPattern(rule.nodeId, tag)}
                          placeholder="Add glob pattern..."
                          variant="allow"
                        />
                        <span className="nep-tag-examples">
                          Examples: ls *, git *, npm run *, cat *
                        </span>
                      </div>

                      {/* Denylist */}
                      <div className="nep-tag-section">
                        <span className="nep-tag-section__label">Denylist (always denied commands)</span>
                        <TagInput
                          tags={rule.denyPatterns}
                          onAdd={(tag) => addDenyPattern(rule.nodeId, tag)}
                          onRemove={(tag) => removeDenyPattern(rule.nodeId, tag)}
                          placeholder="Add glob pattern..."
                          variant="deny"
                        />
                        <span className="nep-tag-examples">
                          Examples: rm -rf *, sudo *, shutdown *, format *
                        </span>
                      </div>

                      {/* Override toggle */}
                      <div className="nep-override-row">
                        <div className="nep-override-row__text">
                          <span className="nep-override-row__label">Override default policy</span>
                          <span className="nep-override-row__hint">
                            Use this node's rules instead of the global security policy
                          </span>
                        </div>
                        <label className="nep-toggle">
                          <input
                            type="checkbox"
                            checked={rule.overrideDefault}
                            onChange={() =>
                              updateNodeRule(rule.nodeId, { overrideDefault: !rule.overrideDefault })
                            }
                          />
                          <span className="nep-toggle__slider" />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 4 - Test Command */}
      <section className="nep-section">
        <h3 className="nep-section__title">Test Command</h3>
        <p className="nep-section__desc">
          Test whether a command would be approved, denied, or require manual approval.
        </p>
        <div className="nep-test">
          <div className="nep-test__row">
            <div className="nep-test__input-group">
              <label className="nep-label">Command</label>
              <input
                className="nep-test__input"
                value={testCommand}
                onChange={(e) => setTestCommand(e.target.value)}
                placeholder="e.g. git push origin main"
                onKeyDown={(e) => { if (e.key === 'Enter') runTest(); }}
              />
            </div>
            <div className="nep-test__input-group" style={{ maxWidth: '200px' }}>
              <label className="nep-label">Node</label>
              <select
                className="nep-test__select"
                value={testNodeId}
                onChange={(e) => setTestNodeId(e.target.value)}
              >
                {nodeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="nep-test__input-group" style={{ maxWidth: '100px', justifyContent: 'flex-end' }}>
              <label className="nep-label" style={{ visibility: 'hidden' }}>Action</label>
              <button
                className="nep-test__btn"
                onClick={runTest}
                disabled={!testCommand.trim()}
              >
                Test
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`nep-test-result nep-test-result--${testResult.outcome}`}>
              <span className="nep-test-result__icon">
                {testResult.outcome === 'approved' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {testResult.outcome === 'denied' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
                {testResult.outcome === 'require-approval' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
              </span>
              <div className="nep-test-result__text">
                <span className="nep-test-result__outcome">
                  {testResult.outcome === 'approved' && 'Approved'}
                  {testResult.outcome === 'denied' && 'Denied'}
                  {testResult.outcome === 'require-approval' && 'Requires Approval'}
                </span>
                <span className="nep-test-result__reason">{testResult.reason}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Save bar */}
      {isDirty && (
        <div className="nep-save-bar">
          <span className="nep-save-bar__status">Unsaved changes</span>
          <div className="nep-save-bar__actions">
            <button
              className="nep-save-bar__btn nep-save-bar__btn--discard"
              onClick={discard}
              type="button"
            >
              Discard
            </button>
            <button
              className="nep-save-bar__btn nep-save-bar__btn--save"
              onClick={save}
              disabled={saving}
              type="button"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NodeExecPolicy;
