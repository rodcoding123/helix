/**
 * ChannelDetail - Full configuration view for a single messaging channel
 *
 * Shown when a channel card is clicked in ChannelCenter. Provides:
 *   - Connection status overview (with reconnect action)
 *   - DM / Group policy selection via radio cards
 *   - Allowlist tag editor (for allowlist policies)
 *   - Media settings (max size, accepted types)
 *   - Message chunking controls
 *   - History limit slider
 *   - Streaming mode selection
 *   - Unsaved-changes save bar with Discard / Save
 *
 * CSS prefix: cd-
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChannelConfigPanel } from './ChannelConfigPanel';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export type ChannelType = 'whatsapp' | 'telegram' | 'discord' | 'signal' | 'imessage' | 'line';
export type ChannelStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'unconfigured';

export interface ChannelConfig {
  dmPolicy: 'pairing' | 'allowlist' | 'open' | 'disabled';
  groupPolicy: 'allowlist' | 'open' | 'disabled';
  allowlist: string[];
  mediaMaxMB: number;
  mediaTypes: string[];
  messageChunking: boolean;
  chunkSize: number;
  historyLimit: number;
  streamingMode: 'off' | 'partial' | 'full';
}

export interface ChannelDetailProps {
  channelType: ChannelType;
  channelName: string;
  status: ChannelStatus;
  config: ChannelConfig;
  onBack: () => void;
  onSave: (config: Partial<ChannelConfig>) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSetup: () => void;
}

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

const DM_POLICIES: { id: ChannelConfig['dmPolicy']; label: string; desc: string }[] = [
  { id: 'pairing', label: 'Pairing', desc: 'Require a one-time pairing code before conversations start.' },
  { id: 'allowlist', label: 'Allowlist', desc: 'Only contacts on the allowlist can send direct messages.' },
  { id: 'open', label: 'Open', desc: 'Accept direct messages from anyone on the platform.' },
  { id: 'disabled', label: 'Disabled', desc: 'Do not accept direct messages on this channel.' },
];

const GROUP_POLICIES: { id: ChannelConfig['groupPolicy']; label: string; desc: string }[] = [
  { id: 'allowlist', label: 'Allowlist', desc: 'Only respond in groups on the allowlist.' },
  { id: 'open', label: 'Open', desc: 'Respond to messages in any group where the bot is a member.' },
  { id: 'disabled', label: 'Disabled', desc: 'Do not respond in group chats on this channel.' },
];

const MEDIA_TYPES_OPTIONS = [
  { id: 'image', label: 'Images', exts: '.jpg, .png, .gif, .webp' },
  { id: 'video', label: 'Videos', exts: '.mp4, .webm, .mov' },
  { id: 'audio', label: 'Audio', exts: '.mp3, .ogg, .wav, .m4a' },
  { id: 'document', label: 'Documents', exts: '.pdf, .docx, .xlsx, .csv' },
];

const STREAMING_MODES: { id: ChannelConfig['streamingMode']; label: string; desc: string }[] = [
  { id: 'off', label: 'Off', desc: 'Send the complete message once generation finishes.' },
  { id: 'partial', label: 'Partial', desc: 'Send periodic partial updates while generating.' },
  { id: 'full', label: 'Full', desc: 'Stream token-by-token via platform edits (where supported).' },
];

const STATUS_META: Record<ChannelStatus, { label: string; color: string; dotColor: string }> = {
  connected: { label: 'Connected', color: '#10b981', dotColor: '#10b981' },
  disconnected: { label: 'Disconnected', color: '#ef4444', dotColor: '#ef4444' },
  connecting: { label: 'Connecting', color: '#f59e0b', dotColor: '#f59e0b' },
  error: { label: 'Error', color: '#ef4444', dotColor: '#ef4444' },
  unconfigured: { label: 'Not Configured', color: '#606080', dotColor: '#606080' },
};

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function ChannelDetail({
  channelType,
  channelName,
  status,
  config,
  onBack,
  onSave,
  onConnect,
  onDisconnect,
  onSetup,
}: ChannelDetailProps) {
  // Draft state for local editing
  const [draft, setDraft] = useState<ChannelConfig>({ ...config });
  const [allowlistInput, setAllowlistInput] = useState('');
  const initialConfigRef = useRef<ChannelConfig>(config);

  // Keep initial ref in sync with incoming props (e.g. after external save)
  useEffect(() => {
    initialConfigRef.current = config;
    setDraft({ ...config });
  }, [config]);

  const isDirty = !deepEqual(draft, initialConfigRef.current);

  // ---------- patch helpers ----------
  const patch = useCallback(<K extends keyof ChannelConfig>(key: K, value: ChannelConfig[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ---------- allowlist ----------
  const addAllowlistEntry = useCallback(() => {
    const trimmed = allowlistInput.trim();
    if (!trimmed || draft.allowlist.includes(trimmed)) return;
    patch('allowlist', [...draft.allowlist, trimmed]);
    setAllowlistInput('');
  }, [allowlistInput, draft.allowlist, patch]);

  const removeAllowlistEntry = useCallback((entry: string) => {
    patch('allowlist', draft.allowlist.filter((e) => e !== entry));
  }, [draft.allowlist, patch]);

  // ---------- media types ----------
  const toggleMediaType = useCallback((typeId: string) => {
    setDraft((prev) => {
      const has = prev.mediaTypes.includes(typeId);
      return {
        ...prev,
        mediaTypes: has
          ? prev.mediaTypes.filter((t) => t !== typeId)
          : [...prev.mediaTypes, typeId],
      };
    });
  }, []);

  // ---------- save / discard ----------
  const handleSave = useCallback(() => {
    onSave(draft);
  }, [draft, onSave]);

  const handleDiscard = useCallback(() => {
    setDraft({ ...initialConfigRef.current });
  }, []);

  // ---------- status helpers ----------
  const statusMeta = STATUS_META[status];
  const showAllowlist = draft.dmPolicy === 'allowlist' || draft.groupPolicy === 'allowlist';

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */

  return (
    <div className="cd-root" data-channel-type={channelType}>
      <style>{channelDetailStyles}</style>

      {/* ── Header ── */}
      <header className="cd-header">
        <div className="cd-header__left">
          <button className="cd-back-btn" onClick={onBack} type="button" aria-label="Back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="cd-header__info">
            <h2 className="cd-header__name">{channelName}</h2>
            <span
              className="cd-header__status"
              style={{ color: statusMeta.color }}
            >
              <span className="cd-status-dot" style={{ background: statusMeta.dotColor }} />
              {statusMeta.label}
            </span>
          </div>
        </div>
        <div className="cd-header__actions">
          {(status === 'connected' || status === 'connecting') ? (
            <button className="cd-btn cd-btn--danger" onClick={onDisconnect} type="button">
              Disconnect
            </button>
          ) : status === 'unconfigured' ? (
            <button className="cd-btn cd-btn--primary" onClick={onSetup} type="button">
              Open Setup
            </button>
          ) : (
            <button className="cd-btn cd-btn--primary" onClick={onConnect} type="button">
              Connect
            </button>
          )}
          {status !== 'unconfigured' && (
            <button className="cd-btn cd-btn--secondary" onClick={onSetup} type="button">
              Open Setup
            </button>
          )}
        </div>
      </header>

      {/* ── Connection Status Section ── */}
      <ChannelConfigPanel title="Connection Status">
        <div className="cd-status-section">
          <div className="cd-status-row">
            <span className="cd-status-label">Status</span>
            <span className="cd-status-value" style={{ color: statusMeta.color }}>
              <span className="cd-status-dot" style={{ background: statusMeta.dotColor }} />
              {statusMeta.label}
            </span>
          </div>

          {status === 'error' && (
            <div className="cd-status-error">
              Connection failed. Check credentials and try again.
            </div>
          )}

          {(status === 'disconnected' || status === 'error') && (
            <button className="cd-btn cd-btn--primary cd-btn--sm" onClick={onConnect} type="button">
              Reconnect
            </button>
          )}
        </div>
      </ChannelConfigPanel>

      {/* ── DM Policy ── */}
      <ChannelConfigPanel
        title="DM Policy"
        description="Control who can send direct messages to Helix on this channel."
        collapsible
        defaultExpanded
      >
        <div className="cd-radio-cards">
          {DM_POLICIES.map((pol) => (
            <button
              key={pol.id}
              type="button"
              className={`cd-radio-card ${draft.dmPolicy === pol.id ? 'cd-radio-card--selected' : ''}`}
              onClick={() => patch('dmPolicy', pol.id)}
            >
              <span className="cd-radio-card__label">{pol.label}</span>
              <span className="cd-radio-card__desc">{pol.desc}</span>
            </button>
          ))}
        </div>
      </ChannelConfigPanel>

      {/* ── Group Policy ── */}
      <ChannelConfigPanel
        title="Group Policy"
        description="Control which group chats Helix responds in."
        collapsible
        defaultExpanded
      >
        <div className="cd-radio-cards">
          {GROUP_POLICIES.map((pol) => (
            <button
              key={pol.id}
              type="button"
              className={`cd-radio-card ${draft.groupPolicy === pol.id ? 'cd-radio-card--selected' : ''}`}
              onClick={() => patch('groupPolicy', pol.id)}
            >
              <span className="cd-radio-card__label">{pol.label}</span>
              <span className="cd-radio-card__desc">{pol.desc}</span>
            </button>
          ))}
        </div>
      </ChannelConfigPanel>

      {/* ── Allowlist Editor ── */}
      {showAllowlist && (
        <ChannelConfigPanel
          title="Allowlist"
          description="Add phone numbers, user IDs, or group IDs that are allowed to interact."
          collapsible
          defaultExpanded
        >
          <div className="cd-allowlist">
            <div className="cd-allowlist__input-row">
              <input
                className="cd-input"
                type="text"
                value={allowlistInput}
                onChange={(e) => setAllowlistInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAllowlistEntry(); } }}
                placeholder="Enter ID or number..."
              />
              <button
                className="cd-btn cd-btn--primary cd-btn--sm"
                onClick={addAllowlistEntry}
                disabled={!allowlistInput.trim()}
                type="button"
              >
                Add
              </button>
            </div>

            {draft.allowlist.length > 0 ? (
              <div className="cd-allowlist__tags">
                {draft.allowlist.map((entry) => (
                  <span key={entry} className="cd-tag">
                    {entry}
                    <button
                      className="cd-tag__remove"
                      onClick={() => removeAllowlistEntry(entry)}
                      type="button"
                      aria-label={`Remove ${entry}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="cd-allowlist__empty">No entries yet. Add contacts above.</p>
            )}

            <div className="cd-allowlist__actions">
              <button className="cd-btn cd-btn--secondary cd-btn--sm" type="button" disabled>
                Import
              </button>
              <button className="cd-btn cd-btn--secondary cd-btn--sm" type="button" disabled>
                Export
              </button>
            </div>
          </div>
        </ChannelConfigPanel>
      )}

      {/* ── Media Settings ── */}
      <ChannelConfigPanel
        title="Media Settings"
        description="Configure file upload limits and accepted media types."
        collapsible
        defaultExpanded={false}
      >
        <div className="cd-media">
          <div className="cd-field">
            <label className="cd-label">
              Max File Size: <strong>{draft.mediaMaxMB} MB</strong>
            </label>
            <input
              type="range"
              className="cd-slider"
              min={1}
              max={100}
              step={1}
              value={draft.mediaMaxMB}
              onChange={(e) => patch('mediaMaxMB', parseInt(e.target.value, 10))}
            />
            <div className="cd-slider-labels">
              <span>1 MB</span>
              <span>100 MB</span>
            </div>
          </div>

          <div className="cd-field">
            <label className="cd-label">Accepted Media Types</label>
            <div className="cd-media__types">
              {MEDIA_TYPES_OPTIONS.map((mt) => (
                <label key={mt.id} className="cd-checkbox-card">
                  <input
                    type="checkbox"
                    checked={draft.mediaTypes.includes(mt.id)}
                    onChange={() => toggleMediaType(mt.id)}
                  />
                  <span className="cd-checkbox-card__inner">
                    <span className="cd-checkbox-card__label">{mt.label}</span>
                    <span className="cd-checkbox-card__exts">{mt.exts}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </ChannelConfigPanel>

      {/* ── Message Chunking ── */}
      <ChannelConfigPanel
        title="Message Chunking"
        description="Split long messages into multiple smaller messages."
        collapsible
        defaultExpanded={false}
      >
        <div className="cd-chunking">
          <div className="cd-field cd-field--row">
            <div>
              <span className="cd-label">Enable Chunking</span>
              <span className="cd-hint">Break long responses into platform-friendly chunks.</span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={draft.messageChunking}
                onChange={() => patch('messageChunking', !draft.messageChunking)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {draft.messageChunking && (
            <div className="cd-field" style={{ marginTop: '0.75rem' }}>
              <label className="cd-label">
                Chunk Size: <strong>{draft.chunkSize}</strong> characters
              </label>
              <input
                type="range"
                className="cd-slider"
                min={500}
                max={5000}
                step={100}
                value={draft.chunkSize}
                onChange={(e) => patch('chunkSize', parseInt(e.target.value, 10))}
              />
              <div className="cd-slider-labels">
                <span>500</span>
                <span>5000</span>
              </div>
            </div>
          )}
        </div>
      </ChannelConfigPanel>

      {/* ── History ── */}
      <ChannelConfigPanel
        title="History"
        description="Set how many messages are retained for context."
        collapsible
        defaultExpanded={false}
      >
        <div className="cd-field">
          <label className="cd-label">
            History Limit: <strong>{draft.historyLimit === 0 ? 'Unlimited' : `${draft.historyLimit} messages`}</strong>
          </label>
          <input
            type="range"
            className="cd-slider"
            min={0}
            max={1000}
            step={10}
            value={draft.historyLimit}
            onChange={(e) => patch('historyLimit', parseInt(e.target.value, 10))}
          />
          <div className="cd-slider-labels">
            <span>Unlimited</span>
            <span>1000</span>
          </div>
        </div>
      </ChannelConfigPanel>

      {/* ── Streaming Mode ── */}
      <ChannelConfigPanel
        title="Streaming Mode"
        description="Control how responses are delivered on this channel."
        collapsible
        defaultExpanded={false}
      >
        <div className="cd-radio-cards cd-radio-cards--vertical">
          {STREAMING_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`cd-radio-card ${draft.streamingMode === mode.id ? 'cd-radio-card--selected' : ''}`}
              onClick={() => patch('streamingMode', mode.id)}
            >
              <span className="cd-radio-card__label">{mode.label}</span>
              <span className="cd-radio-card__desc">{mode.desc}</span>
            </button>
          ))}
        </div>
      </ChannelConfigPanel>

      {/* ── Save Bar ── */}
      {isDirty && (
        <div className="cd-save-bar">
          <span className="cd-save-bar__indicator">Unsaved changes</span>
          <div className="cd-save-bar__actions">
            <button className="cd-btn cd-btn--secondary" onClick={handleDiscard} type="button">
              Discard
            </button>
            <button className="cd-btn cd-btn--primary" onClick={handleSave} type="button">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChannelDetail;

/* ═══════════════════════════════════════════
   Scoped styles (cd- prefix)
   ═══════════════════════════════════════════ */

const channelDetailStyles = `
/* ── Root ── */
.cd-root {
  position: relative;
  padding-bottom: 4rem;
}

/* ── Header ── */
.cd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.cd-header__left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.cd-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  background: var(--bg-secondary, #111127);
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.cd-back-btn:hover {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary, #fff);
}

.cd-header__info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.cd-header__name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
}

.cd-header__status {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.cd-status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cd-header__actions {
  display: flex;
  gap: 0.5rem;
}

/* ── Status Section ── */
.cd-status-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cd-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cd-status-label {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
}

.cd-status-value {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
}

.cd-status-error {
  padding: 0.625rem 0.75rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #fca5a5;
}

/* ── Buttons ── */
.cd-btn {
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.cd-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cd-btn--primary {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  color: #fff;
}

.cd-btn--primary:hover:not(:disabled) {
  background: #5558e6;
}

.cd-btn--secondary {
  background: var(--bg-secondary, #111127);
  color: var(--text-secondary, #a0a0c0);
}

.cd-btn--secondary:hover:not(:disabled) {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary, #fff);
}

.cd-btn--danger {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.cd-btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.25);
}

.cd-btn--sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

/* ── Radio Cards ── */
.cd-radio-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
}

.cd-radio-cards--vertical {
  grid-template-columns: 1fr;
}

.cd-radio-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.cd-radio-card:hover {
  border-color: rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.02);
}

.cd-radio-card--selected {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.08);
}

.cd-radio-card--selected:hover {
  border-color: var(--accent-color, #6366f1);
}

.cd-radio-card__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.cd-radio-card__desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.4;
}

.cd-radio-card--selected .cd-radio-card__desc {
  color: var(--text-secondary, #a0a0c0);
}

/* ── Allowlist ── */
.cd-allowlist {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cd-allowlist__input-row {
  display: flex;
  gap: 0.5rem;
}

.cd-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  outline: none;
  transition: border-color 0.15s ease;
}

.cd-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.cd-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.cd-allowlist__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.cd-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #a5b4fc;
  font-family: var(--font-mono, monospace);
}

.cd-tag__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: none;
  border: none;
  color: rgba(165, 180, 252, 0.6);
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0;
  border-radius: 3px;
  transition: all 0.1s ease;
}

.cd-tag__remove:hover {
  color: #fff;
  background: rgba(239, 68, 68, 0.4);
}

.cd-allowlist__empty {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
}

.cd-allowlist__actions {
  display: flex;
  gap: 0.5rem;
}

/* ── Field layout ── */
.cd-field {
  margin-bottom: 0.75rem;
}

.cd-field:last-child {
  margin-bottom: 0;
}

.cd-field--row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.cd-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
  margin-bottom: 0.375rem;
}

.cd-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.125rem;
}

/* ── Slider ── */
.cd-slider {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  outline: none;
  transition: background 0.15s ease;
}

.cd-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  cursor: pointer;
  border: 2px solid var(--bg-primary, #0a0a1a);
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

.cd-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  cursor: pointer;
  border: 2px solid var(--bg-primary, #0a0a1a);
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

.cd-slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.25rem;
}

/* ── Media types ── */
.cd-media__types {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.5rem;
}

.cd-checkbox-card {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cd-checkbox-card:hover {
  border-color: rgba(255,255,255,0.15);
}

.cd-checkbox-card input[type="checkbox"] {
  accent-color: var(--accent-color, #6366f1);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.cd-checkbox-card__inner {
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
}

.cd-checkbox-card__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.cd-checkbox-card__exts {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  font-family: var(--font-mono, monospace);
}

/* ── Chunking ── */
.cd-chunking {
  display: flex;
  flex-direction: column;
}

/* ── Save bar ── */
.cd-save-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  margin-top: 1rem;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
  animation: cd-slide-up 0.2s ease;
}

@keyframes cd-slide-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cd-save-bar__indicator {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #f59e0b;
}

.cd-save-bar__actions {
  display: flex;
  gap: 0.5rem;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .cd-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .cd-radio-cards {
    grid-template-columns: 1fr;
  }

  .cd-media__types {
    grid-template-columns: 1fr;
  }
}
`;
