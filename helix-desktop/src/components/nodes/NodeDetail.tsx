/**
 * NodeDetail - Individual node detail and control panel
 *
 * Displays node information, capabilities with invoke buttons,
 * invocation results, and permission management.
 *
 * CSS prefix: ndt-
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeDetailProps {
  nodeId: string;
  name: string;
  platform?: string;
  status: 'online' | 'offline' | 'busy';
  capabilities: string[];
  permissions?: string[];
  onRename?: (id: string, name: string) => void;
  onInvoke?: (id: string, capability: string, params?: Record<string, unknown>) => void;
  onClose?: () => void;
}

interface InvokeResult {
  capability: string;
  timestamp: number;
  success: boolean;
  data?: unknown;
  error?: string;
  type?: 'image' | 'text' | 'json';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = `
/* ── Container ── */
.ndt-container {
  padding-bottom: 2rem;
}

/* ── Back button ── */
.ndt-back {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0.375rem 0;
  margin-bottom: 1.5rem;
  transition: color 0.15s ease;
}

.ndt-back:hover {
  color: var(--text-primary, #fff);
}

/* ── Header ── */
.ndt-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.ndt-header__icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  flex-shrink: 0;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.ndt-header__info {
  flex: 1;
  min-width: 0;
}

.ndt-header__name {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0 0 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ndt-header__name-text {
  cursor: default;
}

.ndt-header__name-text--editable {
  cursor: text;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
  padding-bottom: 1px;
}

.ndt-header__name-text--editable:hover {
  border-bottom-color: var(--accent-color, #6366f1);
}

.ndt-header__name-input {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid var(--accent-color, #6366f1);
  border-radius: 6px;
  padding: 0.125rem 0.5rem;
  outline: none;
  font-family: inherit;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.ndt-header__edit-hint {
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
  font-weight: 400;
}

.ndt-header__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.ndt-header__platform {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
}

.ndt-header__status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.ndt-header__status--online {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.ndt-header__status--offline {
  color: var(--text-tertiary, #606080);
  background: rgba(255, 255, 255, 0.04);
}

.ndt-header__status--busy {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.ndt-header__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.ndt-header__status--online .ndt-header__status-dot {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
}

.ndt-header__status--offline .ndt-header__status-dot {
  background: var(--text-tertiary, #606080);
}

.ndt-header__status--busy .ndt-header__status-dot {
  background: #f59e0b;
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
}

.ndt-header__id {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  font-family: 'SF Mono', 'Consolas', monospace;
}

/* ── Layout ── */
.ndt-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 900px) {
  .ndt-layout {
    grid-template-columns: 1fr;
  }
}

.ndt-col {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Section ── */
.ndt-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.25rem;
}

.ndt-section__title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary, #606080);
  margin: 0 0 1rem;
}

/* ── Capabilities Grid ── */
.ndt-caps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.5rem;
}

.ndt-cap-card {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: all 0.15s ease;
}

.ndt-cap-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.ndt-cap-card__name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  font-family: 'SF Mono', 'Consolas', monospace;
}

.ndt-cap-card__desc {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.3;
}

.ndt-cap-card__invoke-btn {
  padding: 0.35rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  background: rgba(99, 102, 241, 0.1);
  color: var(--accent-color, #6366f1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  align-self: flex-start;
}

.ndt-cap-card__invoke-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.4);
}

.ndt-cap-card__invoke-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── System.run input ── */
.ndt-run-input-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.ndt-run-input {
  flex: 1;
  padding: 0.4rem 0.625rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-primary, #fff);
  font-family: 'SF Mono', 'Consolas', monospace;
  outline: none;
  transition: border-color 0.15s ease;
}

.ndt-run-input:focus {
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.ndt-run-input::placeholder {
  color: var(--text-tertiary, #606080);
}

/* ── Notify input ── */
.ndt-notify-input {
  width: 100%;
  padding: 0.4rem 0.625rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-primary, #fff);
  font-family: inherit;
  outline: none;
  margin-bottom: 0.5rem;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.ndt-notify-input:focus {
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.ndt-notify-input::placeholder {
  color: var(--text-tertiary, #606080);
}

/* ── Result area ── */
.ndt-result {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1rem;
  margin-top: 0.5rem;
}

.ndt-result__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.ndt-result__capability {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent-color, #6366f1);
  font-family: 'SF Mono', 'Consolas', monospace;
}

.ndt-result__timestamp {
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
}

.ndt-result__status {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.ndt-result__status--success {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.ndt-result__status--error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.ndt-result__content {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  line-height: 1.5;
  word-break: break-all;
}

.ndt-result__text {
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 0.75rem;
  white-space: pre-wrap;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  padding: 0.75rem;
  max-height: 300px;
  overflow-y: auto;
  color: var(--text-secondary, #a0a0c0);
}

.ndt-result__text::-webkit-scrollbar {
  width: 4px;
}

.ndt-result__text::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.ndt-result__image {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ndt-result__error {
  color: #fca5a5;
  font-size: 0.8125rem;
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 6px;
}

/* ── Permissions ── */
.ndt-perm-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ndt-perm-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  transition: border-color 0.15s ease;
}

.ndt-perm-item:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.ndt-perm-item__name {
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  font-family: 'SF Mono', 'Consolas', monospace;
}

.ndt-perm-toggle {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
}

.ndt-perm-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.ndt-perm-toggle__slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #1a1a3a;
  border-radius: 20px;
  transition: background 0.2s ease;
}

.ndt-perm-toggle__slider::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 3px;
  bottom: 3px;
  background: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.ndt-perm-toggle input:checked + .ndt-perm-toggle__slider {
  background: var(--accent-color, #6366f1);
}

.ndt-perm-toggle input:checked + .ndt-perm-toggle__slider::before {
  transform: translateX(16px);
}

/* ── Empty perms ── */
.ndt-perms-empty {
  text-align: center;
  padding: 1.5rem;
  color: var(--text-tertiary, #606080);
  font-size: 0.8125rem;
}

/* ── Invoking spinner ── */
.ndt-invoking {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--accent-color, #6366f1);
}

.ndt-invoking__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(99, 102, 241, 0.2);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: ndt-spin 0.7s linear infinite;
}

@keyframes ndt-spin {
  to { transform: rotate(360deg); }
}
`;

// ---------------------------------------------------------------------------
// Capability metadata
// ---------------------------------------------------------------------------

interface CapabilityMeta {
  label: string;
  description: string;
  buttonText: string;
  hasInput?: boolean;
  inputPlaceholder?: string;
}

const CAPABILITY_META: Record<string, CapabilityMeta> = {
  'camera.snap': {
    label: 'Camera',
    description: 'Capture a photo from the device camera',
    buttonText: 'Take Photo',
  },
  'screen.capture': {
    label: 'Screen Capture',
    description: 'Take a screenshot of the device screen',
    buttonText: 'Screenshot',
  },
  clipboard: {
    label: 'Clipboard',
    description: 'Read the current clipboard contents',
    buttonText: 'Read Clipboard',
  },
  'system.run': {
    label: 'Shell Command',
    description: 'Execute a shell command on the node',
    buttonText: 'Execute',
    hasInput: true,
    inputPlaceholder: 'Enter command...',
  },
  notify: {
    label: 'Notification',
    description: 'Send a notification to the device',
    buttonText: 'Send Notification',
    hasInput: true,
    inputPlaceholder: 'Notification message...',
  },
  system: {
    label: 'System Info',
    description: 'Get system information from the node',
    buttonText: 'Get Info',
  },
  'fs.read': {
    label: 'File Read',
    description: 'Read files from the node filesystem',
    buttonText: 'Browse',
  },
  'fs.write': {
    label: 'File Write',
    description: 'Write files to the node filesystem',
    buttonText: 'Write',
  },
  audio: {
    label: 'Audio',
    description: 'Play or record audio on the device',
    buttonText: 'Record',
  },
  location: {
    label: 'Location',
    description: 'Get the device location',
    buttonText: 'Get Location',
  },
};

function getCapabilityMeta(cap: string): CapabilityMeta {
  return CAPABILITY_META[cap] ?? {
    label: cap,
    description: `Invoke the ${cap} capability`,
    buttonText: 'Invoke',
  };
}

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

function inferResultType(capability: string, data: unknown): 'image' | 'text' | 'json' {
  if (capability === 'camera.snap' || capability === 'screen.capture') return 'image';
  if (typeof data === 'string') return 'text';
  return 'json';
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NodeDetail({
  nodeId,
  name,
  platform,
  status,
  capabilities,
  permissions,
  onRename,
  onInvoke,
  onClose,
}: NodeDetailProps) {
  const { getClient, connected } = useGateway();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [lastResult, setLastResult] = useState<InvokeResult | null>(null);
  const [invoking, setInvoking] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [notifyInput, setNotifyInput] = useState('');
  const [permStates, setPermStates] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    if (permissions) {
      permissions.forEach((p) => { map[p] = true; });
    }
    return map;
  });

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditing]);

  // ------ Rename ------
  const startRename = useCallback(() => {
    if (!onRename) return;
    setEditName(name);
    setIsEditing(true);
  }, [name, onRename]);

  const commitRename = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== name && onRename) {
      onRename(nodeId, trimmed);
    }
    setIsEditing(false);
  }, [editName, name, nodeId, onRename]);

  const cancelRename = useCallback(() => {
    setEditName(name);
    setIsEditing(false);
  }, [name]);

  // ------ Invoke ------
  const handleInvoke = useCallback(async (capability: string, params?: Record<string, unknown>) => {
    const client = getClient();
    if (!client?.connected) return;

    setInvoking(capability);

    try {
      const result = await client.request<{ data?: unknown }>('nodes.invoke', {
        nodeId,
        capability,
        params,
      });

      const resultType = inferResultType(capability, result.data);
      setLastResult({
        capability,
        timestamp: Date.now(),
        success: true,
        data: result.data,
        type: resultType,
      });

      // Also call parent handler
      onInvoke?.(nodeId, capability, params);
    } catch (err) {
      setLastResult({
        capability,
        timestamp: Date.now(),
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setInvoking(null);
    }
  }, [getClient, nodeId, onInvoke]);

  // ------ Permission toggle ------
  const togglePermission = useCallback((perm: string) => {
    setPermStates((prev) => ({ ...prev, [perm]: !prev[perm] }));
    // In a real implementation, this would call a gateway method
  }, []);

  const isDisabled = !connected || status === 'offline';

  // ------ All known permissions ------
  const allPermissions = capabilities.length > 0 ? capabilities : ['system', 'clipboard'];

  return (
    <div className="ndt-container">
      <style>{styles}</style>

      {/* Back button */}
      <button className="ndt-back" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Nodes
      </button>

      {/* Header */}
      <div className="ndt-header">
        <div className="ndt-header__icon">
          {getPlatformIcon(platform)}
        </div>
        <div className="ndt-header__info">
          <h2 className="ndt-header__name">
            {isEditing ? (
              <input
                ref={nameInputRef}
                className="ndt-header__name-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') cancelRename();
                }}
              />
            ) : (
              <span
                className={`ndt-header__name-text ${onRename ? 'ndt-header__name-text--editable' : ''}`}
                onDoubleClick={startRename}
                title={onRename ? 'Double-click to rename' : undefined}
              >
                {name}
              </span>
            )}
            {onRename && !isEditing && (
              <span className="ndt-header__edit-hint">double-click to rename</span>
            )}
          </h2>
          <div className="ndt-header__meta">
            {platform && <span className="ndt-header__platform">{platform}</span>}
            <span className={`ndt-header__status ndt-header__status--${status}`}>
              <span className="ndt-header__status-dot" />
              {status}
            </span>
            <span className="ndt-header__id">{nodeId}</span>
          </div>
        </div>
      </div>

      <div className="ndt-layout">
        {/* ---- Left column: Capabilities ---- */}
        <div className="ndt-col">
          <section className="ndt-section">
            <h3 className="ndt-section__title">Capabilities</h3>
            {capabilities.length === 0 ? (
              <div className="ndt-perms-empty">
                No capabilities reported by this node.
              </div>
            ) : (
              <div className="ndt-caps-grid">
                {capabilities.map((cap) => {
                  const meta = getCapabilityMeta(cap);
                  const isCapInvoking = invoking === cap;

                  return (
                    <div key={cap} className="ndt-cap-card">
                      <span className="ndt-cap-card__name">{meta.label}</span>
                      <span className="ndt-cap-card__desc">{meta.description}</span>

                      {/* system.run - command input */}
                      {cap === 'system.run' && (
                        <div className="ndt-run-input-row">
                          <input
                            className="ndt-run-input"
                            value={commandInput}
                            onChange={(e) => setCommandInput(e.target.value)}
                            placeholder={meta.inputPlaceholder}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && commandInput.trim()) {
                                handleInvoke(cap, { command: commandInput.trim() });
                              }
                            }}
                            disabled={isDisabled}
                          />
                          <button
                            className="ndt-cap-card__invoke-btn"
                            onClick={() => {
                              if (commandInput.trim()) {
                                handleInvoke(cap, { command: commandInput.trim() });
                              }
                            }}
                            disabled={isDisabled || isCapInvoking || !commandInput.trim()}
                          >
                            {isCapInvoking ? (
                              <span className="ndt-invoking">
                                <span className="ndt-invoking__spinner" />
                              </span>
                            ) : (
                              meta.buttonText
                            )}
                          </button>
                        </div>
                      )}

                      {/* notify - message input */}
                      {cap === 'notify' && (
                        <>
                          <input
                            className="ndt-notify-input"
                            value={notifyInput}
                            onChange={(e) => setNotifyInput(e.target.value)}
                            placeholder={meta.inputPlaceholder}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && notifyInput.trim()) {
                                handleInvoke(cap, { message: notifyInput.trim() });
                              }
                            }}
                            disabled={isDisabled}
                          />
                          <button
                            className="ndt-cap-card__invoke-btn"
                            onClick={() => {
                              if (notifyInput.trim()) {
                                handleInvoke(cap, { message: notifyInput.trim() });
                              }
                            }}
                            disabled={isDisabled || isCapInvoking || !notifyInput.trim()}
                          >
                            {isCapInvoking ? (
                              <span className="ndt-invoking">
                                <span className="ndt-invoking__spinner" />
                              </span>
                            ) : (
                              meta.buttonText
                            )}
                          </button>
                        </>
                      )}

                      {/* Other capabilities - simple invoke button */}
                      {cap !== 'system.run' && cap !== 'notify' && (
                        <button
                          className="ndt-cap-card__invoke-btn"
                          onClick={() => handleInvoke(cap)}
                          disabled={isDisabled || isCapInvoking}
                        >
                          {isCapInvoking ? (
                            <span className="ndt-invoking">
                              <span className="ndt-invoking__spinner" />
                              Invoking...
                            </span>
                          ) : (
                            meta.buttonText
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Last invocation result */}
          {lastResult && (
            <section className="ndt-section">
              <h3 className="ndt-section__title">Last Invocation Result</h3>
              <div className="ndt-result">
                <div className="ndt-result__header">
                  <span className="ndt-result__capability">{lastResult.capability}</span>
                  <span className={`ndt-result__status ndt-result__status--${lastResult.success ? 'success' : 'error'}`}>
                    {lastResult.success ? 'Success' : 'Failed'}
                  </span>
                  <span className="ndt-result__timestamp">{formatTime(lastResult.timestamp)}</span>
                </div>
                <div className="ndt-result__content">
                  {lastResult.error ? (
                    <div className="ndt-result__error">{lastResult.error}</div>
                  ) : lastResult.type === 'image' && typeof lastResult.data === 'string' ? (
                    <img
                      src={lastResult.data.startsWith('data:') ? lastResult.data : `data:image/png;base64,${lastResult.data}`}
                      alt={`${lastResult.capability} result`}
                      className="ndt-result__image"
                    />
                  ) : lastResult.type === 'text' ? (
                    <pre className="ndt-result__text">{String(lastResult.data)}</pre>
                  ) : (
                    <pre className="ndt-result__text">{JSON.stringify(lastResult.data, null, 2)}</pre>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ---- Right column: Permissions ---- */}
        <div className="ndt-col">
          <section className="ndt-section">
            <h3 className="ndt-section__title">Permissions</h3>
            {allPermissions.length === 0 ? (
              <div className="ndt-perms-empty">
                No permissions configured for this node.
              </div>
            ) : (
              <div className="ndt-perm-list">
                {allPermissions.map((perm) => (
                  <div key={perm} className="ndt-perm-item">
                    <span className="ndt-perm-item__name">{perm}</span>
                    <label className="ndt-perm-toggle">
                      <input
                        type="checkbox"
                        checked={permStates[perm] ?? true}
                        onChange={() => togglePermission(perm)}
                      />
                      <span className="ndt-perm-toggle__slider" />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Node info summary */}
          <section className="ndt-section">
            <h3 className="ndt-section__title">Node Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #a0a0c0)' }}>Node ID</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #606080)', fontFamily: "'SF Mono', 'Consolas', monospace" }}>{nodeId}</span>
              </div>
              {platform && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #a0a0c0)' }}>Platform</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-primary, #fff)' }}>{platform}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #a0a0c0)' }}>Status</span>
                <span className={`ndt-header__status ndt-header__status--${status}`}>
                  <span className="ndt-header__status-dot" />
                  {status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #a0a0c0)' }}>Capabilities</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-primary, #fff)' }}>{capabilities.length}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default NodeDetail;
