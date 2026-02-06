/**
 * Hook Editor - Modal for creating and editing custom hooks
 *
 * Fields:
 *   - Hook name (text input, validated for uniqueness)
 *   - Hook type: before (pre-execution) or after (post-execution)
 *   - Event trigger: dropdown with lifecycle events
 *   - Script path: file path input with browse button placeholder
 *   - Timeout (ms): number input with slider (100-30000ms, default 5000)
 *   - Enabled: toggle
 *   - Description: textarea
 *   - Environment variables: key-value pair editor
 *
 * Actions:
 *   - Save (validates and calls parent callback)
 *   - Cancel
 *   - Delete (existing custom hooks only, with confirmation)
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { HookConfig } from './HooksManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HookEditorProps {
  /** Existing hook to edit (null = create mode) */
  hook: HookConfig | null;
  /** Names of all existing hooks (for uniqueness validation) */
  existingNames: string[];
  /** Save callback */
  onSave: (config: HookConfig) => void;
  /** Delete callback (only available for custom hooks) */
  onDelete?: () => void;
  /** Cancel/close callback */
  onCancel: () => void;
}

interface EnvVar {
  id: string;
  key: string;
  value: string;
}

interface ValidationErrors {
  name?: string;
  event?: string;
  scriptPath?: string;
  timeout?: string;
  description?: string;
  env?: string;
}

type HookPhase = 'before' | 'after';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_OPTIONS: { value: string; label: string; phase: HookPhase; description: string }[] = [
  {
    value: 'command:before',
    label: 'command:before',
    phase: 'before',
    description: 'Fires before any shell command is executed',
  },
  {
    value: 'command:after',
    label: 'command:after',
    phase: 'after',
    description: 'Fires after a shell command completes',
  },
  {
    value: 'message:before',
    label: 'message:before',
    phase: 'before',
    description: 'Fires before processing an inbound message',
  },
  {
    value: 'message:after',
    label: 'message:after',
    phase: 'after',
    description: 'Fires after a response is generated',
  },
  {
    value: 'session:start',
    label: 'session:start',
    phase: 'before',
    description: 'Fires when a new session is initialized',
  },
  {
    value: 'session:end',
    label: 'session:end',
    phase: 'after',
    description: 'Fires when a session is terminated or compacted',
  },
  {
    value: 'file:change',
    label: 'file:change',
    phase: 'after',
    description: 'Fires when a watched file is created, modified, or deleted',
  },
];

const TIMEOUT_MIN = 100;
const TIMEOUT_MAX = 30000;
const TIMEOUT_DEFAULT = 5000;
const TIMEOUT_STEP = 100;

/** Reserved names that cannot be used for custom hooks. */
const RESERVED_NAMES = new Set([
  'boot-md', 'command-logger', 'session-memory', 'context-pruner',
  'message-queue', 'heartbeat', 'file-watcher', 'auto-compact',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeHookName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function getPhaseFromEvent(event: string): HookPhase {
  const match = EVENT_OPTIONS.find((e) => e.value === event);
  return match?.phase ?? 'after';
}

function formatTimeout(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Key-value pair editor for environment variables. */
function EnvVarEditor({
  vars,
  onAdd,
  onRemove,
  onChange,
}: {
  vars: EnvVar[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, field: 'key' | 'value', newValue: string) => void;
}) {
  return (
    <div className="he-env-editor">
      {vars.length === 0 ? (
        <div className="he-env-empty">
          <span>No environment variables defined.</span>
        </div>
      ) : (
        <div className="he-env-list">
          <div className="he-env-header-row">
            <span className="he-env-col-key">Key</span>
            <span className="he-env-col-value">Value</span>
            <span className="he-env-col-action" />
          </div>
          {vars.map((v) => (
            <div key={v.id} className="he-env-row">
              <input
                className="he-env-input"
                value={v.key}
                onChange={(e) => onChange(v.id, 'key', e.target.value)}
                placeholder="VARIABLE_NAME"
                spellCheck={false}
              />
              <input
                className="he-env-input"
                value={v.value}
                onChange={(e) => onChange(v.id, 'value', e.target.value)}
                placeholder="value"
                spellCheck={false}
              />
              <button
                className="he-env-remove-btn"
                onClick={() => onRemove(v.id)}
                title="Remove variable"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="he-env-add-btn" onClick={onAdd} type="button">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M8 3v10M3 8h10" />
        </svg>
        Add Variable
      </button>
    </div>
  );
}

/** Delete confirmation dialog (inline within the modal). */
function DeleteConfirmation({
  hookName,
  onConfirm,
  onCancel,
}: {
  hookName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="he-delete-confirm">
      <div className="he-delete-confirm__icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </div>
      <p className="he-delete-confirm__text">
        Are you sure you want to delete <strong>{hookName}</strong>? This action cannot be undone.
      </p>
      <div className="he-delete-confirm__actions">
        <button className="he-btn he-btn--secondary" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="he-btn he-btn--danger" onClick={onConfirm} type="button">
          Delete Hook
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HookEditor({ hook, existingNames, onSave, onDelete, onCancel }: HookEditorProps) {
  const isEditMode = hook !== null;
  const overlayRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState(hook?.name ?? '');
  const [description, setDescription] = useState(hook?.description ?? '');
  const [phase, setPhase] = useState<HookPhase>(
    hook ? getPhaseFromEvent(hook.event) : 'after'
  );
  const [event, setEvent] = useState(hook?.event ?? 'command:after');
  const [scriptPath, setScriptPath] = useState(hook?.scriptPath ?? '');
  const [timeout, setTimeout_] = useState(hook?.timeout ?? TIMEOUT_DEFAULT);
  const [enabled, setEnabled] = useState(hook?.enabled ?? true);
  const [envVars, setEnvVars] = useState<EnvVar[]>(() => {
    if (hook?.env && Object.keys(hook.env).length > 0) {
      return Object.entries(hook.env).map(([key, value]) => ({
        id: generateId(),
        key,
        value,
      }));
    }
    return [];
  });

  // UI state
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Focus name input on mount (create mode only)
  useEffect(() => {
    if (!isEditMode && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditMode]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Filter events based on selected phase
  const filteredEvents = useMemo(() => {
    return EVENT_OPTIONS.filter((e) => e.phase === phase);
  }, [phase]);

  // When phase changes, auto-select first matching event
  useEffect(() => {
    const currentEventPhase = EVENT_OPTIONS.find((e) => e.value === event)?.phase;
    if (currentEventPhase !== phase) {
      const firstMatch = EVENT_OPTIONS.find((e) => e.phase === phase);
      if (firstMatch) {
        setEvent(firstMatch.value);
      }
    }
  }, [phase, event]);

  // Selected event description
  const selectedEventDesc = useMemo(() => {
    return EVENT_OPTIONS.find((e) => e.value === event)?.description ?? '';
  }, [event]);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const validate = useCallback((): ValidationErrors => {
    const errs: ValidationErrors = {};

    // Name validation
    const sanitized = sanitizeHookName(name);
    if (!name.trim()) {
      errs.name = 'Hook name is required';
    } else if (sanitized.length < 2) {
      errs.name = 'Name must be at least 2 characters';
    } else if (RESERVED_NAMES.has(sanitized) && !isEditMode) {
      errs.name = 'This name is reserved for a bundled hook';
    } else if (!isEditMode && existingNames.includes(sanitized)) {
      errs.name = 'A hook with this name already exists';
    } else if (isEditMode && sanitized !== hook.name && existingNames.includes(sanitized)) {
      errs.name = 'A hook with this name already exists';
    }

    // Event validation
    if (!event) {
      errs.event = 'An event trigger must be selected';
    }

    // Script path validation
    if (!scriptPath.trim()) {
      errs.scriptPath = 'Script path is required for custom hooks';
    } else if (!scriptPath.match(/\.(js|ts|mjs|cjs|py|sh|bash|zsh)$/i)) {
      errs.scriptPath = 'Script must be a .js, .ts, .mjs, .cjs, .py, .sh, .bash, or .zsh file';
    }

    // Timeout validation
    if (timeout < TIMEOUT_MIN || timeout > TIMEOUT_MAX) {
      errs.timeout = `Timeout must be between ${TIMEOUT_MIN}ms and ${TIMEOUT_MAX}ms`;
    }

    // Env var validation
    const envKeys = envVars.filter((v) => v.key.trim()).map((v) => v.key.trim());
    const duplicateKeys = envKeys.filter((k, i) => envKeys.indexOf(k) !== i);
    if (duplicateKeys.length > 0) {
      errs.env = `Duplicate variable names: ${duplicateKeys.join(', ')}`;
    }
    const invalidKeys = envVars.filter((v) => v.key.trim() && !/^[A-Z_][A-Z0-9_]*$/i.test(v.key.trim()));
    if (invalidKeys.length > 0) {
      errs.env = 'Variable names must contain only letters, numbers, and underscores';
    }

    return errs;
  }, [name, event, scriptPath, timeout, envVars, isEditMode, existingNames, hook]);

  // Validate on field change (but only show for touched fields)
  useEffect(() => {
    const errs = validate();
    setErrors(errs);
  }, [validate]);

  // ---------------------------------------------------------------------------
  // Env var handlers
  // ---------------------------------------------------------------------------

  const addEnvVar = useCallback(() => {
    setEnvVars((prev) => [...prev, { id: generateId(), key: '', value: '' }]);
  }, []);

  const removeEnvVar = useCallback((id: string) => {
    setEnvVars((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const updateEnvVar = useCallback((id: string, field: 'key' | 'value', newValue: string) => {
    setEnvVars((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: newValue } : v))
    );
    setTouched((prev) => ({ ...prev, env: true }));
  }, []);

  // ---------------------------------------------------------------------------
  // Form handlers
  // ---------------------------------------------------------------------------

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setName(raw);
    setTouched((prev) => ({ ...prev, name: true }));
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    setTouched((prev) => ({ ...prev, description: true }));
  }, []);

  const handleScriptPathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setScriptPath(e.target.value);
    setTouched((prev) => ({ ...prev, scriptPath: true }));
  }, []);

  const handleTimeoutChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setTimeout_(Math.max(TIMEOUT_MIN, Math.min(TIMEOUT_MAX, val)));
    }
  }, []);

  const handleTimeoutSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeout_(parseInt(e.target.value, 10));
  }, []);

  const handlePhaseChange = useCallback((newPhase: HookPhase) => {
    setPhase(newPhase);
    setTouched((prev) => ({ ...prev, event: true }));
  }, []);

  const handleEventChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setEvent(e.target.value);
    setTouched((prev) => ({ ...prev, event: true }));
  }, []);

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    // Mark all fields as touched to show errors
    setTouched({
      name: true,
      description: true,
      event: true,
      scriptPath: true,
      timeout: true,
      env: true,
    });

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);

    // Build env object from vars
    const env: Record<string, string> = {};
    envVars
      .filter((v) => v.key.trim())
      .forEach((v) => {
        env[v.key.trim()] = v.value;
      });

    const hookConfig: HookConfig = {
      name: isEditMode ? hook.name : sanitizeHookName(name),
      description: description.trim() || `Custom hook: ${sanitizeHookName(name)}`,
      type: 'custom',
      enabled,
      event,
      scriptPath: scriptPath.trim(),
      timeout,
      triggerCount: hook?.triggerCount ?? 0,
      lastTriggered: hook?.lastTriggered,
      config: hook?.config ?? {},
      env: Object.keys(env).length > 0 ? env : undefined,
    };

    onSave(hookConfig);
    setSaving(false);
  }, [validate, name, description, event, scriptPath, timeout, enabled, envVars, isEditMode, hook, onSave]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <style>{hookEditorStyles}</style>
      <div
        className="he-overlay"
        ref={overlayRef}
        onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}
      >
        <div className="he-modal">
          {/* Header */}
          <div className="he-modal__header">
            <div className="he-modal__title-row">
              <div className="he-modal__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isEditMode ? (
                    <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
                  ) : (
                    <>
                      <path d="M12 5v14M5 12h14" />
                    </>
                  )}
                </svg>
              </div>
              <div>
                <h3 className="he-modal__title">
                  {isEditMode ? `Edit Hook: ${hook.name}` : 'Create Custom Hook'}
                </h3>
                <p className="he-modal__subtitle">
                  {isEditMode
                    ? 'Modify the hook configuration below'
                    : 'Define a new hook to extend the agent lifecycle'}
                </p>
              </div>
            </div>
            <button className="he-modal__close" onClick={onCancel} title="Close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Delete confirmation overlay */}
          {showDeleteConfirm && onDelete && (
            <DeleteConfirmation
              hookName={hook?.name ?? ''}
              onConfirm={onDelete}
              onCancel={() => setShowDeleteConfirm(false)}
            />
          )}

          {/* Form body */}
          {!showDeleteConfirm && (
            <div className="he-modal__body">
              {/* Section 1: Identity */}
              <div className="he-section">
                <h4 className="he-section__title">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4h12M2 8h8M2 12h10" />
                  </svg>
                  Identity
                </h4>

                {/* Name */}
                <div className="he-field">
                  <label className="he-label">
                    Hook Name
                    <span className="he-required">*</span>
                  </label>
                  <div className="he-input-wrapper">
                    <input
                      ref={nameInputRef}
                      className={`he-input ${touched.name && errors.name ? 'he-input--error' : ''}`}
                      value={name}
                      onChange={handleNameChange}
                      onBlur={() => markTouched('name')}
                      placeholder="e.g. my-custom-hook"
                      disabled={isEditMode}
                      spellCheck={false}
                      maxLength={48}
                    />
                    {name && !isEditMode && (
                      <span className="he-input-preview">
                        Will be saved as: <code>{sanitizeHookName(name)}</code>
                      </span>
                    )}
                  </div>
                  {touched.name && errors.name && (
                    <span className="he-field-error">{errors.name}</span>
                  )}
                  <span className="he-hint">
                    Lowercase letters, numbers, and hyphens. 2-48 characters.
                  </span>
                </div>

                {/* Description */}
                <div className="he-field">
                  <label className="he-label">Description</label>
                  <textarea
                    className="he-textarea"
                    value={description}
                    onChange={handleDescriptionChange}
                    onBlur={() => markTouched('description')}
                    placeholder="Describe what this hook does and when it runs..."
                    rows={3}
                    maxLength={500}
                  />
                  <span className="he-hint">
                    {description.length}/500 characters
                  </span>
                </div>

                {/* Enabled toggle */}
                <div className="he-field he-field--row">
                  <div>
                    <span className="he-label">Enabled</span>
                    <span className="he-hint">Hook will be active immediately after saving</span>
                  </div>
                  <label className="he-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => setEnabled(!enabled)}
                    />
                    <span className="he-toggle__slider" />
                  </label>
                </div>
              </div>

              {/* Section 2: Trigger */}
              <div className="he-section">
                <h4 className="he-section__title">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 2L4 9h4l-1 5 5-7H8l1-5z" />
                  </svg>
                  Trigger
                </h4>

                {/* Hook phase */}
                <div className="he-field">
                  <label className="he-label">
                    Hook Phase
                    <span className="he-required">*</span>
                  </label>
                  <div className="he-phase-row">
                    <button
                      className={`he-phase-btn ${phase === 'before' ? 'he-phase-btn--active' : ''}`}
                      onClick={() => handlePhaseChange('before')}
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 8H4M4 8l3-3M4 8l3 3" />
                      </svg>
                      <div className="he-phase-btn__text">
                        <span className="he-phase-btn__label">Before</span>
                        <span className="he-phase-btn__desc">Pre-execution hook</span>
                      </div>
                    </button>
                    <button
                      className={`he-phase-btn ${phase === 'after' ? 'he-phase-btn--active' : ''}`}
                      onClick={() => handlePhaseChange('after')}
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 8h8M12 8l-3-3M12 8l-3 3" />
                      </svg>
                      <div className="he-phase-btn__text">
                        <span className="he-phase-btn__label">After</span>
                        <span className="he-phase-btn__desc">Post-execution hook</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Event trigger */}
                <div className="he-field">
                  <label className="he-label">
                    Event Trigger
                    <span className="he-required">*</span>
                  </label>
                  <select
                    className={`he-select ${touched.event && errors.event ? 'he-select--error' : ''}`}
                    value={event}
                    onChange={handleEventChange}
                    onBlur={() => markTouched('event')}
                  >
                    {filteredEvents.map((evt) => (
                      <option key={evt.value} value={evt.value}>
                        {evt.label}
                      </option>
                    ))}
                  </select>
                  {selectedEventDesc && (
                    <span className="he-hint he-hint--event">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="8" cy="8" r="6" />
                        <path d="M8 7v3M8 5h.01" />
                      </svg>
                      {selectedEventDesc}
                    </span>
                  )}
                  {touched.event && errors.event && (
                    <span className="he-field-error">{errors.event}</span>
                  )}
                </div>
              </div>

              {/* Section 3: Execution */}
              <div className="he-section">
                <h4 className="he-section__title">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="12" height="12" rx="2" />
                    <path d="M6 6l4 2-4 2V6z" />
                  </svg>
                  Execution
                </h4>

                {/* Script path */}
                <div className="he-field">
                  <label className="he-label">
                    Script Path
                    <span className="he-required">*</span>
                  </label>
                  <div className="he-script-row">
                    <input
                      className={`he-input he-input--script ${touched.scriptPath && errors.scriptPath ? 'he-input--error' : ''}`}
                      value={scriptPath}
                      onChange={handleScriptPathChange}
                      onBlur={() => markTouched('scriptPath')}
                      placeholder="/path/to/hook-script.ts"
                      spellCheck={false}
                    />
                    <button
                      className="he-btn he-btn--outline"
                      type="button"
                      title="Browse for script file (coming soon)"
                      disabled
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 13h12M8 3v7M4.5 6.5L8 3l3.5 3.5" />
                      </svg>
                      Browse
                    </button>
                  </div>
                  {touched.scriptPath && errors.scriptPath && (
                    <span className="he-field-error">{errors.scriptPath}</span>
                  )}
                  <span className="he-hint">
                    Supported: .js, .ts, .mjs, .cjs, .py, .sh, .bash, .zsh
                  </span>
                </div>

                {/* Timeout */}
                <div className="he-field">
                  <label className="he-label">
                    Timeout
                    <span className="he-timeout-value">{formatTimeout(timeout)}</span>
                  </label>
                  <div className="he-timeout-row">
                    <input
                      type="range"
                      className="he-slider"
                      min={TIMEOUT_MIN}
                      max={TIMEOUT_MAX}
                      step={TIMEOUT_STEP}
                      value={timeout}
                      onChange={handleTimeoutSlider}
                    />
                    <input
                      type="number"
                      className="he-input he-input--number"
                      value={timeout}
                      onChange={handleTimeoutChange}
                      min={TIMEOUT_MIN}
                      max={TIMEOUT_MAX}
                      step={TIMEOUT_STEP}
                    />
                    <span className="he-timeout-unit">ms</span>
                  </div>
                  <div className="he-slider-labels">
                    <span>{TIMEOUT_MIN}ms</span>
                    <span>{formatTimeout(TIMEOUT_DEFAULT)} (default)</span>
                    <span>{formatTimeout(TIMEOUT_MAX)}</span>
                  </div>
                  {touched.timeout && errors.timeout && (
                    <span className="he-field-error">{errors.timeout}</span>
                  )}
                </div>
              </div>

              {/* Section 4: Environment */}
              <div className="he-section">
                <h4 className="he-section__title">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4l6-2 6 2M2 4v8l6 2 6-2V4M2 4l6 2 6-2M8 6v8" />
                  </svg>
                  Environment Variables
                </h4>

                <EnvVarEditor
                  vars={envVars}
                  onAdd={addEnvVar}
                  onRemove={removeEnvVar}
                  onChange={updateEnvVar}
                />
                {touched.env && errors.env && (
                  <span className="he-field-error">{errors.env}</span>
                )}
                <span className="he-hint">
                  These variables will be available in the hook script's environment. Avoid storing secrets here.
                </span>
              </div>
            </div>
          )}

          {/* Footer actions */}
          {!showDeleteConfirm && (
            <div className="he-modal__footer">
              {/* Delete button (custom hooks only) */}
              {isEditMode && onDelete && hook?.type === 'custom' && (
                <button
                  className="he-btn he-btn--danger-outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4h12M10 4V2H6v2M4 4v9a1 1 0 001 1h6a1 1 0 001-1V4" />
                  </svg>
                  Delete
                </button>
              )}

              <div className="he-modal__footer-right">
                <button className="he-btn he-btn--secondary" onClick={onCancel} type="button">
                  Cancel
                </button>
                <button
                  className="he-btn he-btn--primary"
                  onClick={handleSave}
                  disabled={saving}
                  type="button"
                >
                  {saving ? (
                    <>
                      <span className="he-btn-spinner" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 8l3 3 5-5" />
                      </svg>
                      {isEditMode ? 'Save Changes' : 'Create Hook'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles (he- prefix)
// ---------------------------------------------------------------------------

const hookEditorStyles = `
/* ============================================
   Overlay & Modal
   ============================================ */

.he-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: he-fade-in 0.15s ease;
}

@keyframes he-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.he-modal {
  background: #131320;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  width: 94%;
  max-width: 640px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(139, 92, 246, 0.1);
  animation: he-modal-in 0.2s ease;
}

@keyframes he-modal-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ── Header ── */
.he-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.he-modal__title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.he-modal__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
  flex-shrink: 0;
}

.he-modal__title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0;
}

.he-modal__subtitle {
  font-size: 0.75rem;
  color: #a0a0a0;
  margin: 0.125rem 0 0;
}

.he-modal__close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  padding: 0.375rem;
  border-radius: 6px;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.he-modal__close:hover {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.08);
}

/* ── Body (scrollable) ── */
.he-modal__body {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  flex: 1;
}

/* ── Footer ── */
.he-modal__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.he-modal__footer-right {
  display: flex;
  gap: 0.625rem;
  margin-left: auto;
}

/* ============================================
   Sections
   ============================================ */

.he-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.he-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.he-section__title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a0a0a0;
  margin: 0 0 1rem;
}

.he-section__title svg {
  color: rgba(139, 92, 246, 0.6);
}

/* ============================================
   Form Fields
   ============================================ */

.he-field {
  margin-bottom: 1rem;
}

.he-field:last-child {
  margin-bottom: 0;
}

.he-field--row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.he-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #e0e0e0;
  margin-bottom: 0.375rem;
}

.he-required {
  color: #ef4444;
  font-size: 0.875rem;
}

.he-hint {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 0.25rem;
}

.he-hint--event {
  color: rgba(139, 92, 246, 0.5);
  margin-top: 0.375rem;
}

.he-hint--event svg {
  flex-shrink: 0;
}

.he-field-error {
  display: block;
  font-size: 0.6875rem;
  color: #f87171;
  margin-top: 0.25rem;
}

/* ── Input ── */
.he-input-wrapper {
  position: relative;
}

.he-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #e0e0e0;
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.he-input:focus {
  border-color: rgba(139, 92, 246, 0.5);
}

.he-input::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

.he-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.he-input--error {
  border-color: rgba(239, 68, 68, 0.5);
}

.he-input--error:focus {
  border-color: rgba(239, 68, 68, 0.7);
}

.he-input--script {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.75rem;
}

.he-input--number {
  width: 90px;
  text-align: right;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.he-input-preview {
  display: block;
  font-size: 0.625rem;
  color: rgba(255, 255, 255, 0.25);
  margin-top: 0.25rem;
}

.he-input-preview code {
  color: #8b5cf6;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}

/* ── Textarea ── */
.he-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #e0e0e0;
  outline: none;
  resize: vertical;
  min-height: 64px;
  max-height: 200px;
  font-family: inherit;
  line-height: 1.5;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.he-textarea:focus {
  border-color: rgba(139, 92, 246, 0.5);
}

.he-textarea::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

/* ── Select ── */
.he-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #e0e0e0;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 16 16' fill='none' stroke='%23a0a0a0' stroke-width='2' stroke-linecap='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2rem;
}

.he-select:focus {
  border-color: rgba(139, 92, 246, 0.5);
}

.he-select option {
  background: #1a1a2e;
  color: #e0e0e0;
}

.he-select--error {
  border-color: rgba(239, 68, 68, 0.5);
}

/* ── Toggle ── */
.he-toggle {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  cursor: pointer;
  flex-shrink: 0;
}

.he-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.he-toggle__slider {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.he-toggle__slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  bottom: 2px;
  background: #e0e0e0;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.he-toggle input:checked + .he-toggle__slider {
  background: #8b5cf6;
}

.he-toggle input:checked + .he-toggle__slider::before {
  transform: translateX(16px);
  background: #fff;
}

/* ── Phase selector ── */
.he-phase-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.he-phase-btn {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: #a0a0a0;
}

.he-phase-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.he-phase-btn--active {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.4);
  color: #e0e0e0;
}

.he-phase-btn--active:hover {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.5);
}

.he-phase-btn svg {
  flex-shrink: 0;
  color: inherit;
}

.he-phase-btn--active svg {
  color: #8b5cf6;
}

.he-phase-btn__text {
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
  text-align: left;
}

.he-phase-btn__label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.he-phase-btn__desc {
  font-size: 0.625rem;
  opacity: 0.6;
}

/* ── Script row ── */
.he-script-row {
  display: flex;
  gap: 0.5rem;
}

.he-script-row .he-input--script {
  flex: 1;
}

/* ── Timeout ── */
.he-timeout-value {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.75rem;
  color: #8b5cf6;
  margin-left: 0.5rem;
  font-weight: 400;
}

.he-timeout-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.he-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  outline: none;
}

.he-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #8b5cf6;
  cursor: pointer;
  border: 2px solid #131320;
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.3);
}

.he-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #8b5cf6;
  cursor: pointer;
  border: 2px solid #131320;
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.3);
}

.he-timeout-unit {
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.he-slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.5625rem;
  color: rgba(255, 255, 255, 0.2);
  margin-top: 0.25rem;
}

/* ============================================
   Environment Variable Editor
   ============================================ */

.he-env-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.he-env-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.25);
  font-style: italic;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border: 1px dashed rgba(255, 255, 255, 0.06);
}

.he-env-list {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  overflow: hidden;
}

.he-env-header-row {
  display: grid;
  grid-template-columns: 1fr 1fr 32px;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.5625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.3);
}

.he-env-row {
  display: grid;
  grid-template-columns: 1fr 1fr 32px;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  align-items: center;
}

.he-env-row:last-child {
  border-bottom: none;
}

.he-env-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  color: #e0e0e0;
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.he-env-input:focus {
  border-color: rgba(139, 92, 246, 0.4);
}

.he-env-input::placeholder {
  color: rgba(255, 255, 255, 0.15);
  font-family: inherit;
}

.he-env-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid transparent;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.15s ease;
}

.he-env-remove-btn:hover {
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

.he-env-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #a0a0a0;
  cursor: pointer;
  transition: all 0.15s ease;
  align-self: flex-start;
}

.he-env-add-btn:hover {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.3);
  color: #c084fc;
}

/* ============================================
   Buttons
   ============================================ */

.he-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  border: none;
}

.he-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.he-btn--primary {
  background: #8b5cf6;
  color: #fff;
}

.he-btn--primary:hover:not(:disabled) {
  background: #7c3aed;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.he-btn--secondary {
  background: rgba(255, 255, 255, 0.06);
  color: #a0a0a0;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.he-btn--secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
  border-color: rgba(255, 255, 255, 0.15);
}

.he-btn--outline {
  background: transparent;
  color: #a0a0a0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.he-btn--outline:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.04);
  color: #e0e0e0;
  border-color: rgba(255, 255, 255, 0.15);
}

.he-btn--outline:disabled {
  opacity: 0.3;
}

.he-btn--danger {
  background: #dc2626;
  color: #fff;
}

.he-btn--danger:hover:not(:disabled) {
  background: #b91c1c;
}

.he-btn--danger-outline {
  background: transparent;
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.he-btn--danger-outline:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.4);
}

.he-btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: he-spin 0.6s linear infinite;
}

@keyframes he-spin {
  to { transform: rotate(360deg); }
}

/* ============================================
   Delete Confirmation
   ============================================ */

.he-delete-confirm {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2rem 1.5rem;
}

.he-delete-confirm__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  margin-bottom: 1rem;
}

.he-delete-confirm__text {
  font-size: 0.875rem;
  color: #a0a0a0;
  margin: 0 0 1.5rem;
  max-width: 360px;
  line-height: 1.5;
}

.he-delete-confirm__text strong {
  color: #e0e0e0;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}

.he-delete-confirm__actions {
  display: flex;
  gap: 0.75rem;
}
`;
