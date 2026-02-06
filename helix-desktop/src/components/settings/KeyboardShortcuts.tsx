/**
 * Keyboard Shortcuts Settings Panel
 *
 * Displays all registered shortcuts grouped by category, allows users to
 * view current bindings, reassign keys via recording mode, detect conflicts,
 * and reset to defaults. Custom bindings are persisted through the gateway
 * config system (config.patch / config.get on path 'desktop.shortcuts').
 *
 * Phase J, Task J3 - Keyboard Shortcuts System
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';
import {
  type ShortcutDefinition,
  type ShortcutCategory,
  type ShortcutOverrides,
  DEFAULT_SHORTCUT_BINDINGS,
  formatShortcut,
  formatKeyName,
  detectConflicts,
  useShortcutRecorder,
  recordedToBinding,
  isMacPlatform,
  deserializeOverrides,
  serializeOverrides,
  applyOverrides,
} from '../../hooks/useGlobalShortcuts';

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

const CATEGORY_ORDER: ShortcutCategory[] = ['Navigation', 'Actions', 'View'];

const CATEGORY_ICONS: Record<ShortcutCategory, string> = {
  Navigation: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4',
  Actions: 'M13 10V3L4 14h7v7l9-11h-7z',
  View: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
};

/* ═══════════════════════════════════════════
   Helper: Build display shortcuts with noop actions
   ═══════════════════════════════════════════ */

function buildDisplayShortcuts(overrides: ShortcutOverrides): ShortcutDefinition[] {
  const base: ShortcutDefinition[] = DEFAULT_SHORTCUT_BINDINGS.map((b) => ({
    ...b,
    action: () => {},
    enabled: true,
  }));
  return applyOverrides(base, overrides);
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function KeyboardShortcuts() {
  const { getClient, connected } = useGateway();
  const recorder = useShortcutRecorder();

  /* ── State ── */
  const [overrides, setOverrides] = useState<ShortcutOverrides>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<ShortcutCategory>>(
    new Set(CATEGORY_ORDER)
  );

  // Timeout ref for success message auto-clear
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Derived data ── */
  const displayShortcuts = useMemo(() => buildDisplayShortcuts(overrides), [overrides]);

  const conflicts = useMemo(() => detectConflicts(displayShortcuts), [displayShortcuts]);

  const conflictMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const conflict of conflicts) {
      map.set(conflict.shortcutA, conflict.shortcutB);
      map.set(conflict.shortcutB, conflict.shortcutA);
    }
    return map;
  }, [conflicts]);

  const filteredShortcuts = useMemo(() => {
    if (!searchQuery) return displayShortcuts;
    const q = searchQuery.toLowerCase();
    return displayShortcuts.filter(
      (s) =>
        s.description.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        formatShortcut(s).toLowerCase().includes(q)
    );
  }, [displayShortcuts, searchQuery]);

  const groupedShortcuts = useMemo(() => {
    const groups = new Map<ShortcutCategory, ShortcutDefinition[]>();
    for (const cat of CATEGORY_ORDER) {
      groups.set(cat, []);
    }
    for (const shortcut of filteredShortcuts) {
      const group = groups.get(shortcut.category);
      if (group) {
        group.push(shortcut);
      }
    }
    return groups;
  }, [filteredShortcuts]);

  const hasCustomBindings = useMemo(
    () => Object.keys(overrides).length > 0,
    [overrides]
  );

  const customCount = Object.keys(overrides).length;

  /* ── Load overrides from gateway config ── */
  const loadOverrides = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      return;
    }

    try {
      const result = (await client.request('config.get', {
        path: 'desktop.shortcuts',
      })) as { value?: unknown };

      if (result.value) {
        setOverrides(deserializeOverrides(result.value));
      }
      setError(null);
    } catch {
      // Config path might not exist yet -- that's fine, use defaults
      console.debug('No custom shortcuts in gateway config');
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  /* ── Save overrides to gateway config ── */
  const saveOverrides = useCallback(
    async (newOverrides: ShortcutOverrides) => {
      const client = getClient();
      if (!client?.connected) {
        setError('Gateway not connected. Changes saved locally only.');
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const serialized = serializeOverrides(newOverrides);
        await client.request('config.patch', {
          path: 'desktop.shortcuts',
          value: serialized,
        });

        setSaveSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        console.error('Failed to save shortcut overrides:', err);
        setError(err instanceof Error ? err.message : 'Failed to save shortcuts');
      } finally {
        setSaving(false);
      }
    },
    [getClient]
  );

  /* ── Load on mount / reconnect ── */
  useEffect(() => {
    loadOverrides();
  }, [loadOverrides, connected]);

  /* ── Handle recorded binding ── */
  useEffect(() => {
    if (!recorder.recordedBinding || !recorder.recordingForId) return;

    const shortcutId = recorder.recordingForId;
    const binding = recordedToBinding(shortcutId, recorder.recordedBinding);

    const newOverrides = { ...overrides, [shortcutId]: binding };
    setOverrides(newOverrides);
    void saveOverrides(newOverrides);

    recorder.clearRecorded();
  }, [recorder.recordedBinding, recorder.recordingForId]);

  /* ── Cleanup ── */
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  /* ── Actions ── */
  const resetShortcut = useCallback(
    (shortcutId: string) => {
      const newOverrides = { ...overrides };
      delete newOverrides[shortcutId];
      setOverrides(newOverrides);
      void saveOverrides(newOverrides);
    },
    [overrides, saveOverrides]
  );

  const resetAllShortcuts = useCallback(() => {
    setOverrides({});
    void saveOverrides({});
  }, [saveOverrides]);

  const toggleCategory = useCallback((category: ShortcutCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const isCustomized = useCallback(
    (shortcutId: string) => shortcutId in overrides,
    [overrides]
  );

  const getDefaultBinding = useCallback(
    (shortcutId: string): Pick<ShortcutDefinition, 'key' | 'ctrl' | 'meta' | 'shift' | 'alt'> | null => {
      const def = DEFAULT_SHORTCUT_BINDINGS.find((b) => b.id === shortcutId);
      return def ?? null;
    },
    []
  );

  /* ═══════════════════════════════════════════
     Render
     ═══════════════════════════════════════════ */

  return (
    <div className="ks-container">
      <style>{keyboardShortcutsStyles}</style>

      {/* Header */}
      <header className="ks-header">
        <div className="ks-header-content">
          <h1 className="ks-title">Keyboard Shortcuts</h1>
          <p className="ks-subtitle">
            View and customize keyboard shortcuts. Click Edit to reassign a binding.
          </p>
        </div>
        <div className="ks-header-badges">
          {hasCustomBindings && (
            <span className="ks-badge ks-badge-custom">
              {customCount} customized
            </span>
          )}
          {conflicts.length > 0 && (
            <span className="ks-badge ks-badge-conflict">
              {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      {/* Search bar */}
      <div className="ks-search-wrapper">
        <svg className="ks-search-icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="text"
          className="ks-search-input"
          placeholder="Search shortcuts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="ks-search-clear" onClick={() => setSearchQuery('')}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div className="ks-banner ks-banner-error">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
          <button className="ks-banner-dismiss" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {saveSuccess && (
        <div className="ks-banner ks-banner-success">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span>Shortcuts saved successfully</span>
        </div>
      )}

      {!connected && (
        <div className="ks-banner ks-banner-warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>Gateway disconnected. Custom shortcuts will not be persisted.</span>
        </div>
      )}

      {/* Conflict warnings */}
      {conflicts.length > 0 && (
        <div className="ks-conflicts-panel">
          <h3 className="ks-conflicts-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Conflicting Shortcuts
          </h3>
          {conflicts.map((conflict, idx) => {
            const nameA = displayShortcuts.find((s) => s.id === conflict.shortcutA)?.description ?? conflict.shortcutA;
            const nameB = displayShortcuts.find((s) => s.id === conflict.shortcutB)?.description ?? conflict.shortcutB;
            return (
              <div key={idx} className="ks-conflict-item">
                <span className="ks-conflict-names">
                  <strong>{nameA}</strong> and <strong>{nameB}</strong>
                </span>
                <span className="ks-conflict-binding">share the same binding</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="ks-loading">
          <div className="ks-spinner" />
          <span>Loading shortcut configuration...</span>
        </div>
      ) : (
        <>
          {/* Platform hint */}
          <div className="ks-platform-hint">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              {isMacPlatform()
                ? 'Using macOS bindings (\u2318 = Command, \u21E7 = Shift, \u2325 = Option)'
                : 'Using Windows/Linux bindings (Ctrl, Shift, Alt)'}
            </span>
          </div>

          {/* Recording overlay */}
          {recorder.recording && (
            <div className="ks-recording-overlay">
              <div className="ks-recording-card">
                <div className="ks-recording-pulse" />
                <h3 className="ks-recording-title">Recording Shortcut</h3>
                <p className="ks-recording-instruction">
                  Press the key combination you want to assign.
                </p>
                <p className="ks-recording-hint">
                  Press <kbd className="ks-kbd">Esc</kbd> to cancel
                </p>
                <button
                  className="ks-recording-cancel"
                  onClick={recorder.cancelRecording}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Shortcut categories */}
          <div className="ks-categories">
            {CATEGORY_ORDER.map((category) => {
              const categoryShortcuts = groupedShortcuts.get(category) ?? [];
              if (searchQuery && categoryShortcuts.length === 0) return null;

              const isExpanded = expandedCategories.has(category);
              const categoryCustomCount = categoryShortcuts.filter((s) => isCustomized(s.id)).length;

              return (
                <div key={category} className="ks-category">
                  <button
                    className="ks-category-header"
                    onClick={() => toggleCategory(category)}
                    aria-expanded={isExpanded}
                  >
                    <div className="ks-category-header-left">
                      <svg
                        className={`ks-category-chevron ${isExpanded ? 'ks-expanded' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        width="16"
                        height="16"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <svg
                        className="ks-category-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        width="18"
                        height="18"
                      >
                        <path d={CATEGORY_ICONS[category]} />
                      </svg>
                      <span className="ks-category-name">{category}</span>
                      <span className="ks-category-count">{categoryShortcuts.length}</span>
                    </div>
                    {categoryCustomCount > 0 && (
                      <span className="ks-badge ks-badge-custom-sm">
                        {categoryCustomCount} custom
                      </span>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="ks-shortcut-list">
                      {categoryShortcuts.length === 0 ? (
                        <div className="ks-empty-category">
                          No shortcuts in this category
                          {searchQuery ? ` matching "${searchQuery}"` : ''}
                        </div>
                      ) : (
                        categoryShortcuts.map((shortcut) => {
                          const hasConflict = conflictMap.has(shortcut.id);
                          const customized = isCustomized(shortcut.id);
                          const isRecordingThis =
                            recorder.recording && recorder.recordingForId === shortcut.id;
                          const defaultBinding = getDefaultBinding(shortcut.id);

                          return (
                            <div
                              key={shortcut.id}
                              className={`ks-shortcut-row ${hasConflict ? 'ks-row-conflict' : ''} ${
                                customized ? 'ks-row-custom' : ''
                              } ${isRecordingThis ? 'ks-row-recording' : ''}`}
                            >
                              <div className="ks-shortcut-info">
                                <span className="ks-shortcut-description">
                                  {shortcut.description}
                                </span>
                                {customized && defaultBinding && (
                                  <span className="ks-shortcut-default-hint">
                                    Default: {formatShortcut(defaultBinding)}
                                  </span>
                                )}
                                {hasConflict && (
                                  <span className="ks-shortcut-conflict-label">
                                    Conflict
                                  </span>
                                )}
                              </div>

                              <div className="ks-shortcut-binding-area">
                                {isRecordingThis ? (
                                  <span className="ks-binding-recording">
                                    Press a key combo...
                                  </span>
                                ) : (
                                  <ShortcutDisplay
                                    shortcut={shortcut}
                                    hasConflict={hasConflict}
                                    customized={customized}
                                  />
                                )}
                              </div>

                              <div className="ks-shortcut-actions">
                                <button
                                  className="ks-btn ks-btn-edit"
                                  onClick={() => recorder.startRecording(shortcut.id)}
                                  disabled={recorder.recording || saving}
                                  title="Edit shortcut binding"
                                >
                                  {isRecordingThis ? (
                                    <span className="ks-btn-recording-dot" />
                                  ) : (
                                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                  )}
                                  <span>Edit</span>
                                </button>

                                {customized && (
                                  <button
                                    className="ks-btn ks-btn-reset"
                                    onClick={() => resetShortcut(shortcut.id)}
                                    disabled={saving}
                                    title="Reset to default binding"
                                  >
                                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                                      <path
                                        fillRule="evenodd"
                                        d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    <span>Reset</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Empty search state */}
          {searchQuery && filteredShortcuts.length === 0 && (
            <div className="ks-empty-search">
              <svg viewBox="0 0 20 20" fill="currentColor" width="32" height="32">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
              <p>No shortcuts matching &quot;{searchQuery}&quot;</p>
              <button className="ks-btn ks-btn-secondary" onClick={() => setSearchQuery('')}>
                Clear search
              </button>
            </div>
          )}

          {/* Footer actions */}
          <div className="ks-footer">
            <div className="ks-footer-info">
              <span className="ks-footer-count">
                {displayShortcuts.length} shortcut{displayShortcuts.length !== 1 ? 's' : ''}
                {customCount > 0 && ` (${customCount} customized)`}
              </span>
              {saving && (
                <span className="ks-footer-saving">
                  <div className="ks-spinner-sm" />
                  Saving...
                </span>
              )}
            </div>
            <div className="ks-footer-actions">
              <button
                className="ks-btn ks-btn-secondary"
                onClick={loadOverrides}
                disabled={loading || !connected}
                title="Reload shortcuts from gateway"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path
                    fillRule="evenodd"
                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                    clipRule="evenodd"
                  />
                </svg>
                Reload
              </button>
              <button
                className="ks-btn ks-btn-danger"
                onClick={resetAllShortcuts}
                disabled={!hasCustomBindings || saving}
                title="Reset all shortcuts to their default bindings"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Reset All to Defaults
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════ */

interface ShortcutDisplayProps {
  shortcut: ShortcutDefinition;
  hasConflict: boolean;
  customized: boolean;
}

/**
 * Renders the key combination display with individual key badges.
 */
function ShortcutDisplay({ shortcut, hasConflict, customized }: ShortcutDisplayProps) {
  const mac = isMacPlatform();
  const keys: string[] = [];

  if (shortcut.ctrl || shortcut.meta) {
    keys.push(mac ? '\u2318' : 'Ctrl');
  }
  if (shortcut.shift) {
    keys.push(mac ? '\u21E7' : 'Shift');
  }
  if (shortcut.alt) {
    keys.push(mac ? '\u2325' : 'Alt');
  }
  keys.push(formatKeyName(shortcut.key));

  return (
    <div className={`ks-binding-keys ${hasConflict ? 'ks-binding-conflict' : ''} ${customized ? 'ks-binding-custom' : ''}`}>
      {keys.map((key, idx) => (
        <span key={idx}>
          <kbd className={`ks-kbd ${hasConflict ? 'ks-kbd-conflict' : ''} ${customized ? 'ks-kbd-custom' : ''}`}>
            {key}
          </kbd>
          {idx < keys.length - 1 && !mac && <span className="ks-kbd-separator">+</span>}
        </span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Styles (ks- prefix)
   ═══════════════════════════════════════════ */

const keyboardShortcutsStyles = `
/* ── Container ── */
.ks-container {
  max-width: 720px;
  padding: 0;
}

/* ── Header ── */
.ks-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.25rem;
  gap: 1rem;
}

.ks-header-content {
  flex: 1;
}

.ks-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0 0 0.375rem;
  letter-spacing: -0.01em;
}

.ks-subtitle {
  font-size: 0.8125rem;
  color: #a0a0a0;
  margin: 0;
  line-height: 1.4;
}

.ks-header-badges {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  padding-top: 0.25rem;
}

/* ── Badges ── */
.ks-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1875rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 4px;
  white-space: nowrap;
}

.ks-badge-custom {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.25);
}

.ks-badge-custom-sm {
  background: rgba(139, 92, 246, 0.1);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.2);
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
}

.ks-badge-conflict {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

/* ── Search ── */
.ks-search-wrapper {
  position: relative;
  margin-bottom: 1rem;
}

.ks-search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #606060;
  pointer-events: none;
}

.ks-search-input {
  width: 100%;
  padding: 0.625rem 2.25rem 0.625rem 2.5rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #e0e0e0;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.ks-search-input:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
}

.ks-search-input::placeholder {
  color: #606060;
}

.ks-search-clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #606060;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.ks-search-clear:hover {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.08);
}

/* ── Banners ── */
.ks-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.875rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-bottom: 0.75rem;
  animation: ks-fade-in 0.2s ease;
}

.ks-banner-error {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.ks-banner-warn {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.ks-banner-success {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.ks-banner span {
  flex: 1;
}

.ks-banner-dismiss {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #a0a0a0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.6875rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ks-banner-dismiss:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #e0e0e0;
}

/* ── Conflicts panel ── */
.ks-conflicts-panel {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 8px;
  padding: 0.875rem;
  margin-bottom: 1rem;
}

.ks-conflicts-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fca5a5;
  margin: 0 0 0.625rem;
}

.ks-conflict-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #a0a0a0;
  padding: 0.25rem 0;
}

.ks-conflict-item + .ks-conflict-item {
  border-top: 1px solid rgba(239, 68, 68, 0.1);
  padding-top: 0.375rem;
  margin-top: 0.125rem;
}

.ks-conflict-names strong {
  color: #e0e0e0;
}

.ks-conflict-binding {
  color: #fca5a5;
  font-style: italic;
}

/* ── Platform hint ── */
.ks-platform-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #606060;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

/* ── Loading ── */
.ks-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: #606060;
}

.ks-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: ks-spin 0.8s linear infinite;
}

.ks-spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: ks-spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes ks-spin {
  to { transform: rotate(360deg); }
}

@keyframes ks-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Recording overlay ── */
.ks-recording-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  animation: ks-fade-in 0.15s ease;
}

.ks-recording-card {
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 16px;
  padding: 2rem 2.5rem;
  text-align: center;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(139, 92, 246, 0.1);
  position: relative;
  overflow: hidden;
  animation: ks-modal-in 0.2s ease;
}

@keyframes ks-modal-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.ks-recording-pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
  animation: ks-pulse 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes ks-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.4; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; }
}

.ks-recording-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0 0 0.5rem;
  position: relative;
}

.ks-recording-instruction {
  font-size: 0.875rem;
  color: #a0a0a0;
  margin: 0 0 1rem;
  position: relative;
}

.ks-recording-hint {
  font-size: 0.75rem;
  color: #606060;
  margin: 0 0 1rem;
  position: relative;
}

.ks-recording-cancel {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a0a0a0;
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.ks-recording-cancel:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
  border-color: rgba(255, 255, 255, 0.2);
}

/* ── Categories ── */
.ks-categories {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ks-category {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.ks-category:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.ks-category-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
  color: inherit;
  text-align: left;
}

.ks-category-header:hover {
  background: rgba(255, 255, 255, 0.03);
}

.ks-category-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ks-category-chevron {
  color: #606060;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.ks-category-chevron.ks-expanded {
  transform: rotate(90deg);
}

.ks-category-icon {
  color: #8b5cf6;
  flex-shrink: 0;
}

.ks-category-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e0e0e0;
}

.ks-category-count {
  font-size: 0.6875rem;
  color: #606060;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
  font-weight: 500;
}

/* ── Shortcut list ── */
.ks-shortcut-list {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.ks-empty-category {
  padding: 1.5rem;
  text-align: center;
  font-size: 0.8125rem;
  color: #606060;
}

/* ── Shortcut row ── */
.ks-shortcut-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.15s ease;
}

.ks-shortcut-row:last-child {
  border-bottom: none;
}

.ks-shortcut-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.ks-shortcut-row.ks-row-conflict {
  background: rgba(239, 68, 68, 0.04);
}

.ks-shortcut-row.ks-row-conflict:hover {
  background: rgba(239, 68, 68, 0.06);
}

.ks-shortcut-row.ks-row-custom {
  background: rgba(139, 92, 246, 0.03);
}

.ks-shortcut-row.ks-row-custom:hover {
  background: rgba(139, 92, 246, 0.05);
}

.ks-shortcut-row.ks-row-recording {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.2);
}

/* ── Shortcut info ── */
.ks-shortcut-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.ks-shortcut-description {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #e0e0e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ks-shortcut-default-hint {
  font-size: 0.6875rem;
  color: #606060;
  font-style: italic;
}

.ks-shortcut-conflict-label {
  display: inline-block;
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.15);
  padding: 0.0625rem 0.3125rem;
  border-radius: 3px;
  width: fit-content;
}

/* ── Binding display ── */
.ks-shortcut-binding-area {
  flex-shrink: 0;
  min-width: 120px;
  display: flex;
  justify-content: flex-end;
}

.ks-binding-keys {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.ks-binding-recording {
  font-size: 0.75rem;
  color: #8b5cf6;
  font-style: italic;
  animation: ks-blink 1.2s ease-in-out infinite;
}

@keyframes ks-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.ks-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  padding: 0.1875rem 0.4375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: inherit;
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  line-height: 1;
  white-space: nowrap;
}

.ks-kbd-conflict {
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.08);
}

.ks-kbd-custom {
  border-color: rgba(139, 92, 246, 0.4);
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.08);
}

.ks-kbd-separator {
  font-size: 0.625rem;
  color: #606060;
  margin: 0 0.0625rem;
}

/* ── Action buttons ── */
.ks-shortcut-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
}

.ks-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  padding: 0.3125rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 500;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  white-space: nowrap;
}

.ks-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ks-btn-edit {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}

.ks-btn-edit:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.35);
  color: #c4b5fd;
}

.ks-btn-recording-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: ks-pulse-dot 1s ease-in-out infinite;
}

@keyframes ks-pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.ks-btn-reset {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  color: #a0a0a0;
}

.ks-btn-reset:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
  color: #e0e0e0;
}

.ks-btn-secondary {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  color: #a0a0a0;
  padding: 0.4375rem 0.875rem;
  font-size: 0.75rem;
}

.ks-btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
  color: #e0e0e0;
}

.ks-btn-danger {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  padding: 0.4375rem 0.875rem;
  font-size: 0.75rem;
}

.ks-btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.35);
  color: #fecaca;
}

.ks-btn-danger:disabled {
  opacity: 0.35;
}

/* ── Empty search ── */
.ks-empty-search {
  text-align: center;
  padding: 3rem 1rem;
  color: #606060;
}

.ks-empty-search svg {
  opacity: 0.3;
  margin-bottom: 0.75rem;
}

.ks-empty-search p {
  font-size: 0.875rem;
  margin: 0 0 1rem;
  color: #a0a0a0;
}

/* ── Footer ── */
.ks-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  gap: 1rem;
  flex-wrap: wrap;
}

.ks-footer-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ks-footer-count {
  font-size: 0.75rem;
  color: #606060;
}

.ks-footer-saving {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #8b5cf6;
}

.ks-footer-actions {
  display: flex;
  gap: 0.5rem;
}

/* ── Responsive adjustments ── */
@media (max-width: 600px) {
  .ks-header {
    flex-direction: column;
    gap: 0.5rem;
  }

  .ks-shortcut-row {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .ks-shortcut-binding-area {
    min-width: auto;
    justify-content: flex-start;
  }

  .ks-shortcut-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .ks-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .ks-footer-actions {
    justify-content: stretch;
  }

  .ks-footer-actions .ks-btn {
    flex: 1;
    justify-content: center;
  }
}
`;
