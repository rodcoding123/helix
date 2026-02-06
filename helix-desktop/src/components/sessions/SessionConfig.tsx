/**
 * Session Configuration Panel
 *
 * Manages session scope, reset policies, compaction settings, identity links,
 * and active session monitoring. All config changes go through `config.patch`
 * on the gateway; compaction is triggered via `sessions.compact`.
 *
 * Gateway methods:
 *   - sessions.list    -> Fetch active sessions
 *   - sessions.compact -> Trigger compaction on one or all sessions
 *   - config.patch     -> Persist session.* settings
 *
 * CSS prefix: ssc-
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';
import { CompactionSettings } from './CompactionSettings';

/* -----------------------------------------------------------------------
   Types
   ----------------------------------------------------------------------- */

export interface SessionConfigProps {
  onBack?: () => void;
}

type SessionScope = 'per-sender' | 'per-channel' | 'per-channel-peer';
type ResetMode = 'daily' | 'idle' | 'manual';

interface IdentityLink {
  id: string;
  sourceChannel: string;
  sourceId: string;
  canonicalId: string;
}

interface ActiveSession {
  id: string;
  channel: string;
  sender: string;
  messageCount: number;
  created: string;
  lastActive: string;
}

interface SessionDraft {
  scope: SessionScope;
  resetMode: ResetMode;
  resetTimeHour: number;
  idleTimeoutMinutes: number;
  compactionMode: 'default' | 'safeguard';
  memoryFlush: boolean;
  compactThreshold: number;
  identityLinks: IdentityLink[];
}

/* -----------------------------------------------------------------------
   Constants
   ----------------------------------------------------------------------- */

const SCOPE_OPTIONS: Array<{
  id: SessionScope;
  title: string;
  desc: string;
}> = [
  {
    id: 'per-sender',
    title: 'Per Sender',
    desc: 'One session per unique sender across all channels. Default behavior.',
  },
  {
    id: 'per-channel',
    title: 'Per Channel',
    desc: 'One session per channel. All senders in a channel share a single session.',
  },
  {
    id: 'per-channel-peer',
    title: 'Per Channel + Sender',
    desc: 'One session per channel and sender pair. Most granular isolation.',
  },
];

const RESET_OPTIONS: Array<{
  id: ResetMode;
  label: string;
}> = [
  { id: 'daily', label: 'Daily' },
  { id: 'idle', label: 'After Idle' },
  { id: 'manual', label: 'Manual' },
];

const CHANNEL_OPTIONS = [
  'whatsapp',
  'telegram',
  'discord',
  'slack',
  'web',
  'desktop',
  'api',
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/* -----------------------------------------------------------------------
   Helpers
   ----------------------------------------------------------------------- */

function generateLinkId(): string {
  return `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

function padHour(h: number): string {
  return String(h).padStart(2, '0') + ':00';
}

/* -----------------------------------------------------------------------
   Component
   ----------------------------------------------------------------------- */

export function SessionConfig({ onBack }: SessionConfigProps) {
  const { getClient, connected } = useGateway();
  const { gatewayConfig, patchGatewayConfig } = useGatewayConfig();

  // Draft state for unsaved changes
  const [draft, setDraft] = useState<SessionDraft>({
    scope: 'per-sender',
    resetMode: 'manual',
    resetTimeHour: 4,
    idleTimeoutMinutes: 30,
    compactionMode: 'default',
    memoryFlush: false,
    compactThreshold: 8000,
    identityLinks: [],
  });

  const [original, setOriginal] = useState<SessionDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Active sessions
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Compaction
  const [compacting, setCompacting] = useState(false);

  // Identity link form
  const [newLinkChannel, setNewLinkChannel] = useState('');
  const [newLinkSourceId, setNewLinkSourceId] = useState('');
  const [newLinkCanonicalId, setNewLinkCanonicalId] = useState('');

  // ── Hydrate draft from gateway config ──
  useEffect(() => {
    const sess = gatewayConfig?.session;
    if (!sess) return;

    const raw = gatewayConfig._raw ?? {};
    const identityLinksRaw = (raw['session.identityLinks'] ?? raw.identityLinks ?? []) as Array<{
      sourceChannel?: string;
      sourceId?: string;
      canonicalId?: string;
    }>;

    const hydrated: SessionDraft = {
      scope: (sess.scope as SessionScope) ?? 'per-sender',
      resetMode: (sess.reset?.mode as ResetMode) ?? 'manual',
      resetTimeHour: typeof sess.reset?.time === 'number' ? sess.reset.time : 4,
      idleTimeoutMinutes: typeof sess.reset?.idleMinutes === 'number' ? sess.reset.idleMinutes : 30,
      compactionMode: (sess.compaction?.mode as 'default' | 'safeguard') ?? 'default',
      memoryFlush: Boolean(raw['session.compaction.memoryFlush'] ?? false),
      compactThreshold: typeof raw['session.compaction.threshold'] === 'number'
        ? (raw['session.compaction.threshold'] as number)
        : 8000,
      identityLinks: identityLinksRaw.map((link) => ({
        id: generateLinkId(),
        sourceChannel: link.sourceChannel ?? '',
        sourceId: link.sourceId ?? '',
        canonicalId: link.canonicalId ?? '',
      })),
    };

    setDraft(hydrated);
    setOriginal(hydrated);
  }, [gatewayConfig]);

  // ── Load active sessions ──
  const loadSessions = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) return;

    setSessionsLoading(true);
    try {
      const result = (await client.request('sessions.list')) as {
        sessions?: Array<{
          id: string;
          channel?: string;
          sender?: string;
          messageCount?: number;
          created?: string;
          lastActive?: string;
          createdAt?: string;
          updatedAt?: string;
        }>;
      };

      const list = (result.sessions ?? []).map((s) => ({
        id: s.id,
        channel: s.channel ?? 'unknown',
        sender: s.sender ?? 'unknown',
        messageCount: s.messageCount ?? 0,
        created: s.created ?? s.createdAt ?? '',
        lastActive: s.lastActive ?? s.updatedAt ?? '',
      }));
      setSessions(list);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    if (connected) {
      loadSessions();
    }
  }, [connected, loadSessions]);

  // ── Dirty check ──
  const isDirty = useMemo(() => {
    if (!original) return false;
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // ── Patchers ──
  const patchDraft = <K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaveError(null);
    setSaveSuccess(false);
  };

  // ── Save ──
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const patch: Record<string, unknown> = {
        session: {
          scope: draft.scope,
          reset: {
            mode: draft.resetMode,
            ...(draft.resetMode === 'daily' ? { time: draft.resetTimeHour } : {}),
            ...(draft.resetMode === 'idle' ? { idleMinutes: draft.idleTimeoutMinutes } : {}),
          },
          compaction: {
            mode: draft.compactionMode,
          },
        },
        'session.compaction.memoryFlush': draft.memoryFlush,
        'session.compaction.threshold': draft.compactThreshold,
        identityLinks: draft.identityLinks.map((link) => ({
          sourceChannel: link.sourceChannel,
          sourceId: link.sourceId,
          canonicalId: link.canonicalId,
        })),
      };

      await patchGatewayConfig(patch);
      setOriginal({ ...draft });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }, [draft, patchGatewayConfig]);

  // ── Discard ──
  const handleDiscard = useCallback(() => {
    if (original) {
      setDraft({ ...original });
    }
    setSaveError(null);
    setSaveSuccess(false);
  }, [original]);

  // ── Compaction actions ──
  const handleCompactAll = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) return;

    setCompacting(true);
    try {
      await client.request('sessions.compact', { all: true });
      await loadSessions();
    } catch (err) {
      console.error('Failed to compact all sessions:', err);
    } finally {
      setCompacting(false);
    }
  }, [getClient, loadSessions]);

  const handleCompactSession = useCallback(
    async (sessionId: string) => {
      const client = getClient();
      if (!client?.connected) return;

      setCompacting(true);
      try {
        await client.request('sessions.compact', { sessionId });
        await loadSessions();
      } catch (err) {
        console.error('Failed to compact session:', err);
      } finally {
        setCompacting(false);
      }
    },
    [getClient, loadSessions]
  );

  // ── Identity link actions ──
  const addIdentityLink = () => {
    if (!newLinkChannel || !newLinkSourceId.trim() || !newLinkCanonicalId.trim()) return;

    const link: IdentityLink = {
      id: generateLinkId(),
      sourceChannel: newLinkChannel,
      sourceId: newLinkSourceId.trim(),
      canonicalId: newLinkCanonicalId.trim(),
    };

    patchDraft('identityLinks', [...draft.identityLinks, link]);
    setNewLinkChannel('');
    setNewLinkSourceId('');
    setNewLinkCanonicalId('');
  };

  const removeIdentityLink = (linkId: string) => {
    patchDraft(
      'identityLinks',
      draft.identityLinks.filter((l) => l.id !== linkId)
    );
  };

  // ── Session actions ──
  const handleResetSession = useCallback(
    async (sessionId: string) => {
      const client = getClient();
      if (!client?.connected) return;

      try {
        await client.request('sessions.delete', { id: sessionId });
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } catch (err) {
        console.error('Failed to reset session:', err);
      }
    },
    [getClient]
  );

  // Compact session options for the CompactionSettings sub-component
  const compactionSessionOptions = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id,
        label: `${s.channel} / ${s.sender} (${s.messageCount} msgs)`,
      })),
    [sessions]
  );

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  return (
    <div className="ssc-root">
      <style>{sessionConfigStyles}</style>

      {/* ── Header ── */}
      <header className="ssc-header">
        {onBack && (
          <button className="ssc-back" onClick={onBack} type="button">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M10 12L6 8l4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back
          </button>
        )}
        <div className="ssc-header__text">
          <h2 className="ssc-header__title">Session Configuration</h2>
          <p className="ssc-header__desc">
            Control how sessions are scoped, when they reset, and how compaction works.
          </p>
        </div>
      </header>

      {/* ── Disconnected banner ── */}
      {!connected && (
        <div className="ssc-banner ssc-banner--warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. Session settings require an active gateway connection.
        </div>
      )}

      <div className="ssc-sections">
        {/* ═══ Section 1: Session Scope ═══ */}
        <section className="ssc-section">
          <h3 className="ssc-section__title">Session Scope</h3>
          <p className="ssc-section__desc">
            Determines how sessions are partitioned across channels and senders.
          </p>

          <div className="ssc-scope-cards">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`ssc-scope-card ${draft.scope === opt.id ? 'ssc-scope-card--selected' : ''}`}
                onClick={() => patchDraft('scope', opt.id)}
              >
                <span className="ssc-scope-card__radio">
                  <span
                    className={`ssc-scope-card__dot ${draft.scope === opt.id ? 'ssc-scope-card__dot--active' : ''}`}
                  />
                </span>
                <div className="ssc-scope-card__text">
                  <span className="ssc-scope-card__title">{opt.title}</span>
                  <span className="ssc-scope-card__desc">{opt.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ═══ Section 2: Reset Policy ═══ */}
        <section className="ssc-section">
          <h3 className="ssc-section__title">Reset Policy</h3>
          <p className="ssc-section__desc">
            When should sessions be automatically reset?
          </p>

          <div className="ssc-reset-modes">
            {RESET_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`ssc-reset-btn ${draft.resetMode === opt.id ? 'ssc-reset-btn--selected' : ''}`}
                onClick={() => patchDraft('resetMode', opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Daily: hour picker */}
          {draft.resetMode === 'daily' && (
            <div className="ssc-reset-detail">
              <label className="ssc-field-label">Reset hour (server time)</label>
              <select
                className="ssc-select"
                value={draft.resetTimeHour}
                onChange={(e) => patchDraft('resetTimeHour', parseInt(e.target.value, 10))}
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {padHour(h)}
                  </option>
                ))}
              </select>
              <span className="ssc-hint">
                All active sessions will be cleared daily at this hour.
              </span>
            </div>
          )}

          {/* Idle: timeout slider */}
          {draft.resetMode === 'idle' && (
            <div className="ssc-reset-detail">
              <label className="ssc-field-label">
                Idle timeout:{' '}
                <span className="ssc-field-value">{draft.idleTimeoutMinutes} min</span>
              </label>
              <input
                type="range"
                className="ssc-slider"
                min={5}
                max={120}
                step={5}
                value={draft.idleTimeoutMinutes}
                onChange={(e) => patchDraft('idleTimeoutMinutes', parseInt(e.target.value, 10))}
              />
              <div className="ssc-slider__labels">
                <span>5 min</span>
                <span>60 min</span>
                <span>120 min</span>
              </div>
            </div>
          )}

          {/* Manual: note */}
          {draft.resetMode === 'manual' && (
            <div className="ssc-reset-detail">
              <div className="ssc-note">
                Sessions persist until manually reset. No automatic cleanup will occur.
              </div>
            </div>
          )}
        </section>

        {/* ═══ Section 3: Compaction Settings ═══ */}
        <section className="ssc-section">
          <h3 className="ssc-section__title">Compaction</h3>
          <p className="ssc-section__desc">
            Control how sessions are compacted when they reach the token threshold.
          </p>

          <CompactionSettings
            mode={draft.compactionMode}
            memoryFlush={draft.memoryFlush}
            threshold={draft.compactThreshold}
            onModeChange={(mode) => patchDraft('compactionMode', mode)}
            onMemoryFlushChange={(flush) => patchDraft('memoryFlush', flush)}
            onThresholdChange={(threshold) => patchDraft('compactThreshold', threshold)}
            onCompactAll={connected ? handleCompactAll : undefined}
            onCompactSession={connected ? handleCompactSession : undefined}
            sessions={compactionSessionOptions}
            compacting={compacting}
          />
        </section>

        {/* ═══ Section 4: Identity Links ═══ */}
        <section className="ssc-section">
          <h3 className="ssc-section__title">Identity Links</h3>
          <p className="ssc-section__desc">
            Map the same person across WhatsApp, Telegram, Discord to a single identity.
          </p>

          {/* Existing links table */}
          {draft.identityLinks.length > 0 && (
            <div className="ssc-links-table-wrap">
              <table className="ssc-links-table">
                <thead>
                  <tr>
                    <th>Source Channel</th>
                    <th>Source ID</th>
                    <th>Canonical ID</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.identityLinks.map((link) => (
                    <tr key={link.id}>
                      <td>
                        <span className="ssc-links-channel">{link.sourceChannel}</span>
                      </td>
                      <td>
                        <code className="ssc-links-code">{link.sourceId}</code>
                      </td>
                      <td>
                        <code className="ssc-links-code">{link.canonicalId}</code>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ssc-links-remove"
                          onClick={() => removeIdentityLink(link.id)}
                          title="Remove link"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {draft.identityLinks.length === 0 && (
            <div className="ssc-links-empty">
              No identity links configured. Add a link below to unify users across channels.
            </div>
          )}

          {/* Add new link form */}
          <div className="ssc-links-form">
            <div className="ssc-links-form__row">
              <div className="ssc-links-form__field">
                <label className="ssc-links-form__label">Channel</label>
                <select
                  className="ssc-select"
                  value={newLinkChannel}
                  onChange={(e) => setNewLinkChannel(e.target.value)}
                >
                  <option value="">Select...</option>
                  {CHANNEL_OPTIONS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ssc-links-form__field">
                <label className="ssc-links-form__label">Source ID</label>
                <input
                  type="text"
                  className="ssc-input"
                  placeholder="e.g. +1234567890"
                  value={newLinkSourceId}
                  onChange={(e) => setNewLinkSourceId(e.target.value)}
                />
              </div>
              <div className="ssc-links-form__field">
                <label className="ssc-links-form__label">Canonical ID</label>
                <input
                  type="text"
                  className="ssc-input"
                  placeholder="e.g. rodrigo"
                  value={newLinkCanonicalId}
                  onChange={(e) => setNewLinkCanonicalId(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="ssc-links-form__add"
                onClick={addIdentityLink}
                disabled={!newLinkChannel || !newLinkSourceId.trim() || !newLinkCanonicalId.trim()}
              >
                Add Link
              </button>
            </div>
          </div>
        </section>

        {/* ═══ Section 5: Active Sessions ═══ */}
        <section className="ssc-section">
          <div className="ssc-section__header-row">
            <div>
              <h3 className="ssc-section__title">Active Sessions</h3>
              <p className="ssc-section__desc">
                Currently active sessions from the gateway.
              </p>
            </div>
            <button
              type="button"
              className="ssc-refresh-btn"
              onClick={loadSessions}
              disabled={!connected || sessionsLoading}
              title="Refresh sessions"
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                width="14"
                height="14"
                className={sessionsLoading ? 'ssc-spin' : ''}
              >
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
              Refresh
            </button>
          </div>

          {!connected ? (
            <div className="ssc-sessions-empty">
              Connect to the gateway to view active sessions.
            </div>
          ) : sessionsLoading ? (
            <div className="ssc-sessions-loading">
              <span className="ssc-spinner" />
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="ssc-sessions-empty">
              No active sessions found.
            </div>
          ) : (
            <div className="ssc-sessions-table-wrap">
              <table className="ssc-sessions-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Channel</th>
                    <th>Sender</th>
                    <th>Messages</th>
                    <th>Created</th>
                    <th>Last Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((sess) => (
                    <tr key={sess.id}>
                      <td>
                        <code className="ssc-session-id">{sess.id}</code>
                      </td>
                      <td>
                        <span className="ssc-session-channel">{sess.channel}</span>
                      </td>
                      <td className="ssc-session-sender">{sess.sender}</td>
                      <td className="ssc-session-count">{sess.messageCount}</td>
                      <td className="ssc-session-date">{formatDate(sess.created)}</td>
                      <td className="ssc-session-date">{formatDate(sess.lastActive)}</td>
                      <td>
                        <div className="ssc-session-actions">
                          <button
                            type="button"
                            className="ssc-session-action"
                            onClick={() => handleCompactSession(sess.id)}
                            disabled={compacting}
                            title="Compact this session"
                          >
                            Compact
                          </button>
                          <button
                            type="button"
                            className="ssc-session-action ssc-session-action--danger"
                            onClick={() => handleResetSession(sess.id)}
                            title="Reset (delete) this session"
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ── Save bar ── */}
      {isDirty && (
        <div className="ssc-save-bar">
          <div className="ssc-save-bar__status">
            {saveError && (
              <span className="ssc-save-bar__error">{saveError}</span>
            )}
            {saveSuccess && (
              <span className="ssc-save-bar__success">Configuration saved.</span>
            )}
            {!saveError && !saveSuccess && (
              <span className="ssc-save-bar__dirty">You have unsaved changes</span>
            )}
          </div>
          <div className="ssc-save-bar__actions">
            <button
              type="button"
              className="ssc-btn ssc-btn--secondary"
              onClick={handleDiscard}
              disabled={saving}
            >
              Discard
            </button>
            <button
              type="button"
              className="ssc-btn ssc-btn--primary"
              onClick={handleSave}
              disabled={saving || !connected}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Non-dirty success flash */}
      {!isDirty && saveSuccess && (
        <div className="ssc-save-bar ssc-save-bar--success">
          <span className="ssc-save-bar__success">Configuration saved successfully.</span>
        </div>
      )}
    </div>
  );
}

export default SessionConfig;

/* -----------------------------------------------------------------------
   Scoped Styles (ssc- prefix)
   ----------------------------------------------------------------------- */

const sessionConfigStyles = `
/* ── Root ── */
.ssc-root {
  padding: 1.5rem;
  height: 100%;
  overflow-y: auto;
  position: relative;
  padding-bottom: 5rem;
}

/* ── Header ── */
.ssc-header {
  margin-bottom: 1.75rem;
}

.ssc-back {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0.25rem 0;
  margin-bottom: 0.75rem;
  transition: color 0.15s ease;
}

.ssc-back:hover {
  color: var(--text-primary, #fff);
}

.ssc-header__title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.25rem;
}

.ssc-header__desc {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
}

/* ── Banner ── */
.ssc-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-bottom: 1.25rem;
}

.ssc-banner--warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* ── Sections ── */
.ssc-sections {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.ssc-section {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.25rem;
}

.ssc-section__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.25rem;
}

.ssc-section__desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0 0 1rem;
  line-height: 1.4;
}

.ssc-section__header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

/* ── Scope Cards ── */
.ssc-scope-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ssc-scope-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.ssc-scope-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.02);
}

.ssc-scope-card--selected {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.06);
}

.ssc-scope-card--selected:hover {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.08);
}

.ssc-scope-card__radio {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 1px;
  transition: border-color 0.15s ease;
}

.ssc-scope-card--selected .ssc-scope-card__radio {
  border-color: var(--accent-color, #6366f1);
}

.ssc-scope-card__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: transparent;
  transition: background 0.15s ease;
}

.ssc-scope-card__dot--active {
  background: var(--accent-color, #6366f1);
}

.ssc-scope-card__text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;
}

.ssc-scope-card__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.ssc-scope-card--selected .ssc-scope-card__title {
  color: var(--accent-color, #6366f1);
}

.ssc-scope-card__desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.4;
}

/* ── Reset Policy ── */
.ssc-reset-modes {
  display: flex;
  gap: 0;
  background: var(--bg-primary, #0a0a1a);
  border-radius: 8px;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 1rem;
}

.ssc-reset-btn {
  flex: 1;
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
}

.ssc-reset-btn:hover {
  color: var(--text-primary, #fff);
}

.ssc-reset-btn--selected {
  background: var(--accent-color, #6366f1);
  color: #fff;
}

.ssc-reset-detail {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

/* ── Field / input shared ── */
.ssc-field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.ssc-field-value {
  font-family: var(--font-mono, monospace);
  font-weight: 600;
  color: var(--accent-color, #6366f1);
}

.ssc-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.4;
}

.ssc-note {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  padding: 0.625rem 0.875rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  border-left: 3px solid rgba(255, 255, 255, 0.1);
}

.ssc-select {
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.ssc-select:focus {
  border-color: var(--accent-color, #6366f1);
}

.ssc-input {
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  outline: none;
  width: 100%;
  transition: border-color 0.15s ease;
}

.ssc-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.ssc-input::placeholder {
  color: var(--text-tertiary, #606080);
}

/* ── Slider ── */
.ssc-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.ssc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  border: 2px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.ssc-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
}

.ssc-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  border: 2px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
}

.ssc-slider__labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.125rem;
}

/* ── Identity Links ── */
.ssc-links-table-wrap {
  overflow-x: auto;
  margin-bottom: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.ssc-links-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.ssc-links-table th {
  text-align: left;
  padding: 0.625rem 0.75rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  background: var(--bg-primary, #0a0a1a);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.ssc-links-table td {
  padding: 0.625rem 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.ssc-links-table tbody tr:last-child td {
  border-bottom: none;
}

.ssc-links-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.ssc-links-channel {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: capitalize;
  background: rgba(99, 102, 241, 0.12);
  color: #818cf8;
  border-radius: 4px;
}

.ssc-links-code {
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 3px;
}

.ssc-links-remove {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.ssc-links-remove:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.ssc-links-empty {
  text-align: center;
  padding: 1.25rem;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  background: var(--bg-primary, #0a0a1a);
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.ssc-links-form {
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.ssc-links-form__row {
  display: flex;
  gap: 0.625rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.ssc-links-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 120px;
}

.ssc-links-form__label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
}

.ssc-links-form__add {
  padding: 0.5rem 1rem;
  background: var(--accent-color, #6366f1);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.ssc-links-form__add:hover:not(:disabled) {
  background: #5558e6;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.ssc-links-form__add:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Active Sessions ── */
.ssc-sessions-table-wrap {
  overflow-x: auto;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.ssc-sessions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.ssc-sessions-table th {
  text-align: left;
  padding: 0.625rem 0.75rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  background: var(--bg-primary, #0a0a1a);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  white-space: nowrap;
}

.ssc-sessions-table td {
  padding: 0.625rem 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.ssc-sessions-table tbody tr:last-child td {
  border-bottom: none;
}

.ssc-sessions-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.ssc-session-id {
  font-family: var(--font-mono, monospace);
  font-size: 0.6875rem;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  padding: 0.125rem 0.375rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 3px;
}

.ssc-session-channel {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: capitalize;
  background: rgba(99, 102, 241, 0.12);
  color: #818cf8;
  border-radius: 4px;
}

.ssc-session-sender {
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
}

.ssc-session-count {
  font-family: var(--font-mono, monospace);
  text-align: center;
}

.ssc-session-date {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  white-space: nowrap;
}

.ssc-session-actions {
  display: flex;
  gap: 0.375rem;
}

.ssc-session-action {
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.ssc-session-action:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #fff);
}

.ssc-session-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ssc-session-action--danger {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.ssc-session-action--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}

.ssc-sessions-empty {
  text-align: center;
  padding: 1.5rem;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  background: var(--bg-primary, #0a0a1a);
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.ssc-sessions-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
}

.ssc-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.ssc-refresh-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #fff);
}

.ssc-refresh-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Save Bar ── */
.ssc-save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.5rem;
  background: var(--bg-secondary, #111127);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  z-index: 100;
  animation: ssc-slide-up 0.2s ease;
}

.ssc-save-bar--success {
  justify-content: center;
}

@keyframes ssc-slide-up {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ssc-save-bar__status {
  flex: 1;
  min-width: 0;
}

.ssc-save-bar__dirty {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
}

.ssc-save-bar__error {
  font-size: 0.8125rem;
  color: #ef4444;
}

.ssc-save-bar__success {
  font-size: 0.8125rem;
  color: #10b981;
}

.ssc-save-bar__actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* ── Buttons ── */
.ssc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1.125rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  white-space: nowrap;
}

.ssc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ssc-btn--primary {
  background: var(--accent-color, #6366f1);
  color: #fff;
}

.ssc-btn--primary:hover:not(:disabled) {
  background: #5558e6;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.ssc-btn--secondary {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ssc-btn--secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #fff);
  border-color: rgba(255, 255, 255, 0.15);
}

/* ── Spinner ── */
.ssc-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: ssc-spin 0.7s linear infinite;
}

@keyframes ssc-spin {
  to { transform: rotate(360deg); }
}

.ssc-spin {
  animation: ssc-spin 0.7s linear infinite;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .ssc-root {
    padding: 1rem;
    padding-bottom: 5rem;
  }

  .ssc-scope-cards {
    gap: 0.375rem;
  }

  .ssc-links-form__row {
    flex-direction: column;
    align-items: stretch;
  }

  .ssc-links-form__field {
    min-width: 100%;
  }

  .ssc-save-bar {
    padding: 0.75rem 1rem;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ssc-save-bar__actions {
    width: 100%;
    justify-content: flex-end;
  }

  .ssc-sessions-table {
    font-size: 0.75rem;
  }

  .ssc-sessions-table th,
  .ssc-sessions-table td {
    padding: 0.5rem;
  }
}

@media (max-width: 480px) {
  .ssc-reset-modes {
    flex-direction: column;
  }

  .ssc-session-actions {
    flex-direction: column;
    gap: 0.25rem;
  }
}
`;
