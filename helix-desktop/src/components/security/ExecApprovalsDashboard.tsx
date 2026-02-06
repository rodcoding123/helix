/**
 * ExecApprovalsDashboard - Main exec approvals management page
 *
 * Three sections:
 *   1. Pending Approvals (top, prominent) - real-time approval requests
 *   2. Approval Policies (middle) - global deny/allow lists, per-agent overrides, timeout
 *   3. Approval History (bottom, collapsible) - recent approval decisions
 *
 * Uses gateway methods:
 *   - exec.approval.snapshot   : fetch pending approvals
 *   - exec.approval.resolve    : approve or deny a request
 *   - config.patch             : persist approval policies
 *
 * Subscribes to gateway events:
 *   - exec.approval.requested  : real-time new approval requests
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';
import { ApprovalRequestCard } from './ApprovalRequestCard';
import { ApprovalHistory, type ApprovalHistoryEntry } from './ApprovalHistory';
import type { GatewayEventFrame } from '../../lib/gateway-client';

/* ===================================================================
   Types
   =================================================================== */

export interface ExecApprovalsDashboardProps {
  onNavigateToAgent?: (agentId: string) => void;
}

interface PendingApproval {
  id: string;
  command: string;
  args?: string[];
  agentId: string;
  agentName?: string;
  requestedAt: number;
  timeoutAt?: number;
}

interface ApprovalPolicies {
  globalDeny: string[];
  globalAllow: string[];
  perAgent: Record<string, { allow: string[]; deny: string[] }>;
  timeoutSeconds: number;
  defaultTimeoutAction: 'deny' | 'approve' | 'escalate';
}

const DEFAULT_POLICIES: ApprovalPolicies = {
  globalDeny: ['rm -rf *', 'sudo *', 'shutdown', 'reboot', 'mkfs *', 'dd if=*'],
  globalAllow: ['ls *', 'cat *', 'git status', 'git log *', 'git diff *', 'pwd', 'whoami'],
  perAgent: {},
  timeoutSeconds: 120,
  defaultTimeoutAction: 'deny',
};

/* ===================================================================
   Tag Input Sub-Component
   =================================================================== */

interface TagInputProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  variant: 'deny' | 'allow';
}

function TagInput({ tags, onAdd, onRemove, placeholder, variant }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onRemove(tags.length - 1);
    }
  };

  return (
    <div
      className={`ead-tag-input-wrapper ead-tag-input-${variant}`}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="ead-tags">
        {tags.map((tag, i) => (
          <span key={`${tag}-${i}`} className={`ead-tag ead-tag-${variant}`}>
            <code className="ead-tag-text">{tag}</code>
            <button
              className="ead-tag-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(i);
              }}
              aria-label={`Remove ${tag}`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="ead-tag-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleAdd}
          placeholder={tags.length === 0 ? placeholder : ''}
          aria-label={placeholder}
        />
      </div>
    </div>
  );
}

/* ===================================================================
   Per-Agent Policy Sub-Component
   =================================================================== */

interface PerAgentSectionProps {
  agentId: string;
  policies: { allow: string[]; deny: string[] };
  onUpdate: (agentId: string, policies: { allow: string[]; deny: string[] }) => void;
  onRemoveAgent: (agentId: string) => void;
  onNavigate?: (agentId: string) => void;
}

function PerAgentSection({
  agentId,
  policies,
  onUpdate,
  onRemoveAgent,
  onNavigate,
}: PerAgentSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const policyCount = policies.allow.length + policies.deny.length;

  return (
    <div className="ead-per-agent-item">
      <button className="ead-per-agent-header" onClick={() => setExpanded(!expanded)}>
        <div className="ead-per-agent-left">
          <svg
            className={`ead-per-agent-chevron ${expanded ? 'ead-per-agent-chevron-open' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            width="14"
            height="14"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="ead-per-agent-name">{agentId}</span>
          <span className="ead-per-agent-count">
            {policyCount} rule{policyCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="ead-per-agent-right">
          {onNavigate && (
            <button
              className="ead-btn-link"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(agentId);
              }}
              title="Go to agent"
            >
              View Agent
            </button>
          )}
          <button
            className="ead-btn-icon-danger"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveAgent(agentId);
            }}
            title="Remove agent policies"
            aria-label={`Remove policies for ${agentId}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </button>

      {expanded && (
        <div className="ead-per-agent-body">
          <div className="ead-per-agent-section">
            <label className="ead-label">Allow patterns</label>
            <TagInput
              tags={policies.allow}
              onAdd={(tag) =>
                onUpdate(agentId, { ...policies, allow: [...policies.allow, tag] })
              }
              onRemove={(i) =>
                onUpdate(agentId, {
                  ...policies,
                  allow: policies.allow.filter((_, idx) => idx !== i),
                })
              }
              placeholder="Add allow pattern (e.g. npm test)"
              variant="allow"
            />
          </div>
          <div className="ead-per-agent-section">
            <label className="ead-label">Deny patterns</label>
            <TagInput
              tags={policies.deny}
              onAdd={(tag) =>
                onUpdate(agentId, { ...policies, deny: [...policies.deny, tag] })
              }
              onRemove={(i) =>
                onUpdate(agentId, {
                  ...policies,
                  deny: policies.deny.filter((_, idx) => idx !== i),
                })
              }
              placeholder="Add deny pattern (e.g. rm -rf *)"
              variant="deny"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================================================================
   Main Component
   =================================================================== */

export function ExecApprovalsDashboard({ onNavigateToAgent }: ExecApprovalsDashboardProps) {
  const { getClient, connected } = useGateway();
  const { gatewayConfig, patchGatewayConfig } = useGatewayConfig();

  // -- State --
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [policies, setPolicies] = useState<ApprovalPolicies>(DEFAULT_POLICIES);
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [newAgentId, setNewAgentId] = useState('');

  const eventListenerRef = useRef<boolean>(false);

  // -- Load pending approvals from gateway --
  const loadPendingApprovals = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      return;
    }

    try {
      const result = (await client.request('exec.approval.snapshot')) as {
        pending?: PendingApproval[];
        history?: ApprovalHistoryEntry[];
      };

      if (result.pending) {
        setPendingApprovals(result.pending);
      }
      if (result.history) {
        setHistory(result.history);
      }
    } catch (err) {
      console.error('Failed to load approval snapshot:', err);
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  // -- Load policies from gateway config --
  useEffect(() => {
    if (gatewayConfig._raw) {
      const execPolicies = gatewayConfig._raw.execApproval as
        | Partial<ApprovalPolicies>
        | undefined;
      if (execPolicies) {
        setPolicies((prev) => ({
          globalDeny: execPolicies.globalDeny ?? prev.globalDeny,
          globalAllow: execPolicies.globalAllow ?? prev.globalAllow,
          perAgent: (execPolicies.perAgent as Record<string, { allow: string[]; deny: string[] }>) ?? prev.perAgent,
          timeoutSeconds: execPolicies.timeoutSeconds ?? prev.timeoutSeconds,
          defaultTimeoutAction: execPolicies.defaultTimeoutAction ?? prev.defaultTimeoutAction,
        }));
      }
    }
  }, [gatewayConfig._raw]);

  // -- Subscribe to real-time approval events --
  useEffect(() => {
    if (!connected || eventListenerRef.current) return;

    const client = getClient();
    if (!client) return;

    eventListenerRef.current = true;

    // The onEvent handler is already set up in useGateway.
    // We need to add a handler for exec.approval.requested events.
    // We'll rely on the gateway client's event system through a polling approach
    // since the onEvent callback is registered at client creation.
    // Instead, we listen to events via the existing client setup.

    return () => {
      eventListenerRef.current = false;
    };
  }, [connected, getClient]);

  // -- Handle gateway events for real-time approval requests --
  useEffect(() => {
    const client = getClient();
    if (!client?.connected) return;

    const originalOnEvent = (client as unknown as { opts: { onEvent?: (evt: GatewayEventFrame) => void } }).opts?.onEvent;

    // We intercept events by patching the client's event handler
    // This is done because the gateway client doesn't expose an addEventListener API
    const patchedHandler = (evt: GatewayEventFrame) => {
      // Handle exec approval events
      if (evt.event === 'exec.approval.requested') {
        const payload = evt.payload as PendingApproval | undefined;
        if (payload) {
          setPendingApprovals((prev) => {
            // Avoid duplicates
            if (prev.some((p) => p.id === payload.id)) return prev;
            return [...prev, payload];
          });
        }
      }

      if (evt.event === 'exec.approval.resolved') {
        const payload = evt.payload as { id: string; decision: string } | undefined;
        if (payload) {
          setPendingApprovals((prev) => prev.filter((p) => p.id !== payload.id));
        }
      }

      // Forward to original handler
      originalOnEvent?.(evt);
    };

    // Patch the event handler on the client options
    const clientAny = client as unknown as { opts: { onEvent?: (evt: GatewayEventFrame) => void } };
    clientAny.opts.onEvent = patchedHandler;

    return () => {
      // Restore original handler
      if (clientAny.opts) {
        clientAny.opts.onEvent = originalOnEvent;
      }
    };
  }, [connected, getClient]);

  // -- Initial load --
  useEffect(() => {
    loadPendingApprovals();
  }, [loadPendingApprovals, connected]);

  // -- Refresh pending on an interval --
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(loadPendingApprovals, 30000);
    return () => clearInterval(interval);
  }, [connected, loadPendingApprovals]);

  // -- Approve handler --
  const handleApprove = useCallback(
    async (id: string) => {
      const client = getClient();
      if (!client?.connected) return;

      try {
        await client.request('exec.approval.resolve', {
          id,
          decision: 'approved',
        });

        // Optimistic update
        const approved = pendingApprovals.find((p) => p.id === id);
        setPendingApprovals((prev) => prev.filter((p) => p.id !== id));

        if (approved) {
          setHistory((prev) => [
            {
              id: approved.id,
              command: approved.command,
              agentId: approved.agentId,
              agentName: approved.agentName,
              decision: 'approved',
              resolvedBy: 'user',
              timestamp: Date.now(),
            },
            ...prev,
          ]);
        }
      } catch (err) {
        console.error('Failed to approve request:', err);
      }
    },
    [getClient, pendingApprovals]
  );

  // -- Deny handler --
  const handleDeny = useCallback(
    async (id: string) => {
      const client = getClient();
      if (!client?.connected) return;

      try {
        await client.request('exec.approval.resolve', {
          id,
          decision: 'denied',
        });

        const denied = pendingApprovals.find((p) => p.id === id);
        setPendingApprovals((prev) => prev.filter((p) => p.id !== id));

        if (denied) {
          setHistory((prev) => [
            {
              id: denied.id,
              command: denied.command,
              agentId: denied.agentId,
              agentName: denied.agentName,
              decision: 'denied',
              resolvedBy: 'user',
              timestamp: Date.now(),
            },
            ...prev,
          ]);
        }
      } catch (err) {
        console.error('Failed to deny request:', err);
      }
    },
    [getClient, pendingApprovals]
  );

  // -- Always allow handler --
  const handleAlwaysAllow = useCallback(
    async (id: string, pattern: string) => {
      // Add pattern to global allow list
      setPolicies((prev) => ({
        ...prev,
        globalAllow: prev.globalAllow.includes(pattern)
          ? prev.globalAllow
          : [...prev.globalAllow, pattern],
      }));

      // Also approve this specific request
      await handleApprove(id);
    },
    [handleApprove]
  );

  // -- Save policies --
  const handleSavePolicies = useCallback(async () => {
    setSaving(true);
    setSaveStatus('idle');

    try {
      await patchGatewayConfig({
        execApproval: {
          globalDeny: policies.globalDeny,
          globalAllow: policies.globalAllow,
          perAgent: policies.perAgent,
          timeoutSeconds: policies.timeoutSeconds,
          defaultTimeoutAction: policies.defaultTimeoutAction,
        },
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Failed to save policies:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }, [patchGatewayConfig, policies]);

  // -- Policy update helpers --
  const addGlobalDeny = (pattern: string) => {
    setPolicies((prev) => ({ ...prev, globalDeny: [...prev.globalDeny, pattern] }));
  };

  const removeGlobalDeny = (index: number) => {
    setPolicies((prev) => ({
      ...prev,
      globalDeny: prev.globalDeny.filter((_, i) => i !== index),
    }));
  };

  const addGlobalAllow = (pattern: string) => {
    setPolicies((prev) => ({ ...prev, globalAllow: [...prev.globalAllow, pattern] }));
  };

  const removeGlobalAllow = (index: number) => {
    setPolicies((prev) => ({
      ...prev,
      globalAllow: prev.globalAllow.filter((_, i) => i !== index),
    }));
  };

  const updatePerAgentPolicy = (
    agentId: string,
    agentPolicies: { allow: string[]; deny: string[] }
  ) => {
    setPolicies((prev) => ({
      ...prev,
      perAgent: { ...prev.perAgent, [agentId]: agentPolicies },
    }));
  };

  const removePerAgentPolicy = (agentId: string) => {
    setPolicies((prev) => {
      const { [agentId]: _, ...rest } = prev.perAgent;
      return { ...prev, perAgent: rest };
    });
  };

  const addPerAgent = () => {
    const trimmed = newAgentId.trim();
    if (trimmed && !policies.perAgent[trimmed]) {
      setPolicies((prev) => ({
        ...prev,
        perAgent: { ...prev.perAgent, [trimmed]: { allow: [], deny: [] } },
      }));
      setNewAgentId('');
    }
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="ead-container">
      <style>{execApprovalStyles}</style>

      {/* ---- Header ---- */}
      <header className="ead-page-header">
        <div className="ead-page-title-row">
          <svg
            className="ead-page-icon"
            viewBox="0 0 20 20"
            fill="currentColor"
            width="24"
            height="24"
          >
            <path
              fillRule="evenodd"
              d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5C17.944 5.652 18 6.32 18 7c0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.68.056-1.348.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <h1 className="ead-page-title">Exec Approvals</h1>
            <p className="ead-page-subtitle">
              Review and manage command execution approval requests
            </p>
          </div>
        </div>
        {!connected && (
          <div className="ead-disconnected-banner">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Gateway disconnected. Approval management requires an active connection.
          </div>
        )}
      </header>

      {/* ============================================
          Section 1: Pending Approvals
          ============================================ */}
      <section className="ead-section">
        <div className="ead-section-header">
          <h2 className="ead-section-title">Pending Approvals</h2>
          {pendingApprovals.length > 0 && (
            <span className="ead-pending-badge">
              {pendingApprovals.length}
            </span>
          )}
          <button
            className="ead-btn-ghost"
            onClick={loadPendingApprovals}
            disabled={!connected}
            title="Refresh pending approvals"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="ead-loading">
            <div className="ead-spinner" />
            <span>Loading approvals...</span>
          </div>
        ) : pendingApprovals.length === 0 ? (
          <div className="ead-empty">
            <svg
              className="ead-empty-icon"
              viewBox="0 0 20 20"
              fill="currentColor"
              width="40"
              height="40"
            >
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5C17.944 5.652 18 6.32 18 7c0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.68.056-1.348.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ead-empty-text">No pending approvals</p>
            <p className="ead-empty-subtext">
              All clear. New requests will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="ead-approvals-list">
            {pendingApprovals.map((approval) => (
              <ApprovalRequestCard
                key={approval.id}
                id={approval.id}
                command={approval.command}
                args={approval.args}
                agentId={approval.agentId}
                agentName={approval.agentName}
                requestedAt={approval.requestedAt}
                timeoutAt={approval.timeoutAt}
                onApprove={handleApprove}
                onDeny={handleDeny}
                onAlwaysAllow={handleAlwaysAllow}
              />
            ))}
          </div>
        )}
      </section>

      {/* ============================================
          Section 2: Approval Policies
          ============================================ */}
      <section className="ead-section">
        <div className="ead-section-header">
          <h2 className="ead-section-title">Approval Policies</h2>
        </div>

        {/* Global deny list */}
        <div className="ead-policy-block">
          <div className="ead-policy-label-row">
            <label className="ead-label">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="ead-label-icon ead-label-icon-deny">
                <path
                  fillRule="evenodd"
                  d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                  clipRule="evenodd"
                />
              </svg>
              Global Deny List
            </label>
            <span className="ead-policy-hint">
              Commands matching these patterns are ALWAYS denied
            </span>
          </div>
          <TagInput
            tags={policies.globalDeny}
            onAdd={addGlobalDeny}
            onRemove={removeGlobalDeny}
            placeholder="Add deny pattern (e.g. rm -rf *, sudo *)"
            variant="deny"
          />
        </div>

        {/* Global allow list */}
        <div className="ead-policy-block">
          <div className="ead-policy-label-row">
            <label className="ead-label">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="ead-label-icon ead-label-icon-allow">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Global Allow List
            </label>
            <span className="ead-policy-hint">
              Commands matching these patterns are auto-approved
            </span>
          </div>
          <TagInput
            tags={policies.globalAllow}
            onAdd={addGlobalAllow}
            onRemove={removeGlobalAllow}
            placeholder="Add allow pattern (e.g. ls *, cat *, git status)"
            variant="allow"
          />
        </div>

        {/* Per-agent policies */}
        <div className="ead-policy-block">
          <div className="ead-policy-label-row">
            <label className="ead-label">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="ead-label-icon">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              Per-Agent Policies
            </label>
            <span className="ead-policy-hint">
              Override global policies for specific agents
            </span>
          </div>

          <div className="ead-per-agent-list">
            {Object.entries(policies.perAgent).map(([agentId, agentPolicies]) => (
              <PerAgentSection
                key={agentId}
                agentId={agentId}
                policies={agentPolicies}
                onUpdate={updatePerAgentPolicy}
                onRemoveAgent={removePerAgentPolicy}
                onNavigate={onNavigateToAgent}
              />
            ))}
          </div>

          <div className="ead-add-agent-row">
            <input
              type="text"
              className="ead-add-agent-input"
              value={newAgentId}
              onChange={(e) => setNewAgentId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPerAgent();
                }
              }}
              placeholder="Enter agent ID to add policies..."
              aria-label="New agent ID"
            />
            <button
              className="ead-btn-sm ead-btn-secondary"
              onClick={addPerAgent}
              disabled={!newAgentId.trim()}
            >
              Add Agent
            </button>
          </div>
        </div>

        {/* Timeout settings */}
        <div className="ead-policy-block">
          <div className="ead-policy-label-row">
            <label className="ead-label">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="ead-label-icon">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              Timeout Settings
            </label>
          </div>

          <div className="ead-timeout-controls">
            <div className="ead-timeout-slider-row">
              <label className="ead-timeout-label">
                Approval timeout: <strong>{policies.timeoutSeconds}s</strong>
              </label>
              <input
                type="range"
                className="ead-slider"
                min={30}
                max={600}
                step={10}
                value={policies.timeoutSeconds}
                onChange={(e) =>
                  setPolicies((prev) => ({
                    ...prev,
                    timeoutSeconds: parseInt(e.target.value),
                  }))
                }
                aria-label="Timeout seconds"
              />
              <div className="ead-slider-labels">
                <span>30s</span>
                <span>600s</span>
              </div>
            </div>

            <div className="ead-timeout-action-row">
              <label className="ead-timeout-label">Default action on timeout:</label>
              <select
                className="ead-select"
                value={policies.defaultTimeoutAction}
                onChange={(e) =>
                  setPolicies((prev) => ({
                    ...prev,
                    defaultTimeoutAction: e.target.value as 'deny' | 'approve' | 'escalate',
                  }))
                }
                aria-label="Default timeout action"
              >
                <option value="deny">Deny</option>
                <option value="approve">Approve</option>
                <option value="escalate">Escalate</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="ead-save-row">
          <button
            className={`ead-btn-primary ${saveStatus === 'success' ? 'ead-btn-success' : ''} ${saveStatus === 'error' ? 'ead-btn-error' : ''}`}
            onClick={handleSavePolicies}
            disabled={saving || !connected}
          >
            {saving
              ? 'Saving...'
              : saveStatus === 'success'
                ? 'Saved'
                : saveStatus === 'error'
                  ? 'Save Failed'
                  : 'Save Policies'}
          </button>
        </div>
      </section>

      {/* ============================================
          Section 3: Approval History
          ============================================ */}
      <ApprovalHistory
        entries={history}
        expanded={historyExpanded}
        onToggle={() => setHistoryExpanded(!historyExpanded)}
      />
    </div>
  );
}

/* ===================================================================
   Scoped styles (ead- prefix)
   =================================================================== */

const execApprovalStyles = `
/* ---- Container ---- */
.ead-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 900px;
  padding: 0.5rem 0;
}

/* ---- Page header ---- */
.ead-page-header {
  margin-bottom: 0.25rem;
}

.ead-page-title-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.ead-page-icon {
  color: var(--accent-color, #6366f1);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.ead-page-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
  line-height: 1.2;
}

.ead-page-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0.25rem 0 0;
}

.ead-disconnected-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  margin-top: 0.75rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* ---- Section ---- */
.ead-section {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 1.25rem;
}

.ead-section-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 1rem;
}

.ead-section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

/* ---- Pending badge (pulsing) ---- */
.ead-pending-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 0.375rem;
  font-size: 0.6875rem;
  font-weight: 700;
  border-radius: 9999px;
  background: #ef4444;
  color: white;
  animation: ead-pulse 2s ease-in-out infinite;
}

@keyframes ead-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.1); }
}

/* ---- Ghost button (refresh) ---- */
.ead-btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  transition: all 0.15s ease;
  margin-left: auto;
}

.ead-btn-ghost:hover:not(:disabled) {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.06);
}

.ead-btn-ghost:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ---- Loading ---- */
.ead-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem;
  color: var(--text-tertiary, #606080);
  font-size: 0.8125rem;
}

.ead-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: ead-spin 0.8s linear infinite;
}

@keyframes ead-spin {
  to { transform: rotate(360deg); }
}

/* ---- Empty state ---- */
.ead-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1rem;
  text-align: center;
}

.ead-empty-icon {
  color: var(--text-tertiary, #606080);
  opacity: 0.3;
  margin-bottom: 0.75rem;
}

.ead-empty-text {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0 0.25rem;
}

.ead-empty-subtext {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
}

/* ---- Approvals list ---- */
.ead-approvals-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ---- Policy blocks ---- */
.ead-policy-block {
  margin-bottom: 1.25rem;
}

.ead-policy-block:last-of-type {
  margin-bottom: 0;
}

.ead-policy-label-row {
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.ead-label {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.ead-label-icon {
  flex-shrink: 0;
  color: var(--text-tertiary, #606080);
}

.ead-label-icon-deny {
  color: #f87171;
}

.ead-label-icon-allow {
  color: #34d399;
}

.ead-policy-hint {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

/* ---- Tag input ---- */
.ead-tag-input-wrapper {
  min-height: 42px;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 0.375rem;
  cursor: text;
  transition: border-color 0.15s ease;
}

.ead-tag-input-wrapper:focus-within {
  border-color: var(--accent-color, #6366f1);
}

.ead-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
}

.ead-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.375rem;
  border-radius: 4px;
  font-size: 0.75rem;
  max-width: 280px;
  overflow: hidden;
}

.ead-tag-deny {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #f87171;
}

.ead-tag-allow {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #34d399;
}

.ead-tag-text {
  font-family: var(--font-mono, monospace);
  font-size: 0.6875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ead-tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0.0625rem;
  cursor: pointer;
  border-radius: 2px;
  opacity: 0.5;
  transition: opacity 0.1s ease;
  color: inherit;
  flex-shrink: 0;
}

.ead-tag-remove:hover {
  opacity: 1;
}

.ead-tag-input {
  flex: 1;
  min-width: 140px;
  padding: 0.25rem 0.375rem;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  font-family: var(--font-mono, monospace);
}

.ead-tag-input::placeholder {
  color: var(--text-tertiary, #606080);
  font-family: var(--font-sans, system-ui, sans-serif);
}

/* ---- Per-agent policies ---- */
.ead-per-agent-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.ead-per-agent-item {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  overflow: hidden;
}

.ead-per-agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.625rem 0.75rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.1s ease;
  text-align: left;
}

.ead-per-agent-header:hover {
  background: rgba(255,255,255,0.02);
}

.ead-per-agent-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ead-per-agent-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ead-per-agent-chevron {
  color: var(--text-tertiary, #606080);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.ead-per-agent-chevron-open {
  transform: rotate(90deg);
}

.ead-per-agent-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #818cf8;
}

.ead-per-agent-count {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

.ead-per-agent-body {
  padding: 0.75rem;
  border-top: 1px solid rgba(255,255,255,0.04);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ead-per-agent-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.ead-per-agent-section .ead-label {
  font-size: 0.75rem;
}

.ead-btn-link {
  background: none;
  border: none;
  font-size: 0.6875rem;
  color: var(--accent-color, #6366f1);
  cursor: pointer;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  transition: background 0.1s ease;
}

.ead-btn-link:hover {
  background: rgba(99, 102, 241, 0.1);
}

.ead-btn-icon-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  transition: all 0.1s ease;
}

.ead-btn-icon-danger:hover {
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
}

.ead-add-agent-row {
  display: flex;
  gap: 0.5rem;
}

.ead-add-agent-input {
  flex: 1;
  padding: 0.4375rem 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  outline: none;
  transition: border-color 0.15s ease;
}

.ead-add-agent-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.ead-add-agent-input::placeholder {
  color: var(--text-tertiary, #606080);
}

/* ---- Timeout controls ---- */
.ead-timeout-controls {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ead-timeout-slider-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.ead-timeout-label {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
}

.ead-timeout-label strong {
  color: var(--text-primary, #fff);
}

.ead-slider {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.ead-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  border: 2px solid var(--bg-secondary, #111127);
  cursor: pointer;
  transition: transform 0.1s ease;
}

.ead-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.ead-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  border: 2px solid var(--bg-secondary, #111127);
  cursor: pointer;
}

.ead-slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
}

.ead-timeout-action-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ead-select {
  padding: 0.4375rem 2rem 0.4375rem 0.75rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23606080' d='M3 4.5L6 8l3-3.5H3z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.625rem center;
  transition: border-color 0.15s ease;
}

.ead-select:focus {
  border-color: var(--accent-color, #6366f1);
}

.ead-select option {
  background: var(--bg-secondary, #111127);
  color: var(--text-primary, #fff);
}

/* ---- Save row ---- */
.ead-save-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255,255,255,0.06);
}

/* ---- Buttons ---- */
.ead-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: var(--accent-color, #6366f1);
  color: white;
}

.ead-btn-primary:hover:not(:disabled) {
  background: #4f46e5;
}

.ead-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ead-btn-success {
  background: #10b981 !important;
}

.ead-btn-error {
  background: #ef4444 !important;
}

.ead-btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ead-btn-secondary {
  background: rgba(255,255,255,0.06);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255,255,255,0.08);
}

.ead-btn-secondary:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
  color: var(--text-primary, #fff);
}

.ead-btn-secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
`;
