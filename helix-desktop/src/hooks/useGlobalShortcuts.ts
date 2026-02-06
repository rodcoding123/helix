/**
 * Global Keyboard Shortcuts Hook for Helix Desktop
 *
 * Registers and manages global keyboard shortcuts with support for:
 * - Platform-aware modifiers (Cmd on macOS, Ctrl on Windows/Linux)
 * - Custom keybindings loaded from gateway config
 * - Conflict detection
 * - Recording mode for shortcut reassignment
 * - Event-based action dispatch
 *
 * Phase J, Task J3 - Keyboard Shortcuts System
 */

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface ShortcutDefinition {
  /** Unique identifier for the shortcut (e.g., 'new-chat', 'open-settings') */
  id: string;
  /** The key to press (e.g., 'n', 'k', ',', 't', 'Escape') */
  key: string;
  /** Ctrl on Windows/Linux, maps to Cmd on macOS */
  ctrl?: boolean;
  /** Cmd on macOS (meta key) -- treated symmetrically with ctrl for cross-platform */
  meta?: boolean;
  /** Shift modifier */
  shift?: boolean;
  /** Alt/Option modifier */
  alt?: boolean;
  /** Human-readable description (e.g., "New Chat", "Open Settings") */
  description: string;
  /** Grouping category (e.g., "Navigation", "Actions", "View") */
  category: ShortcutCategory;
  /** Callback to execute when the shortcut is triggered */
  action: () => void;
  /** Whether this shortcut is currently active (default: true) */
  enabled?: boolean;
}

export type ShortcutCategory = 'Navigation' | 'Actions' | 'View';

/** Serializable binding stored in gateway config (no action callback) */
export interface ShortcutBinding {
  id: string;
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/** Map of shortcut id to custom binding overrides */
export type ShortcutOverrides = Record<string, ShortcutBinding>;

/** Event emitted when a shortcut fires (for components that listen via custom events) */
export interface ShortcutEvent {
  shortcutId: string;
  timestamp: number;
}

/** Options for the useGlobalShortcuts hook */
export interface UseGlobalShortcutsOptions {
  /** Array of shortcut definitions to register */
  shortcuts: ShortcutDefinition[];
  /** Global enable/disable toggle (default: true) */
  enabled?: boolean;
  /** Custom binding overrides loaded from config */
  overrides?: ShortcutOverrides;
}

/** Return value of the useGlobalShortcuts hook */
export interface UseGlobalShortcutsReturn {
  /** The currently active shortcut definitions (with overrides applied) */
  activeShortcuts: ShortcutDefinition[];
  /** Whether any shortcut matched the last keydown event */
  lastMatchedId: string | null;
}

/* ═══════════════════════════════════════════
   Platform Detection
   ═══════════════════════════════════════════ */

/** Detect whether the platform uses Meta (Cmd) or Ctrl as the primary modifier */
export function getPlatformModifier(): 'meta' | 'ctrl' {
  if (typeof navigator === 'undefined') return 'ctrl';
  const platform = navigator.platform?.toLowerCase() ?? '';
  const ua = navigator.userAgent?.toLowerCase() ?? '';
  if (platform.includes('mac') || ua.includes('macintosh')) return 'meta';
  return 'ctrl';
}

/** Whether the current platform is macOS */
export function isMacPlatform(): boolean {
  return getPlatformModifier() === 'meta';
}

/* ═══════════════════════════════════════════
   Shortcut Formatting
   ═══════════════════════════════════════════ */

/**
 * Format a shortcut definition for display in the UI.
 *
 * On macOS: symbols like Cmd, Shift, Option, Ctrl
 * On Windows/Linux: text labels like Ctrl+Shift+Alt
 */
export function formatShortcut(shortcut: Pick<ShortcutDefinition, 'key' | 'ctrl' | 'meta' | 'shift' | 'alt'>): string {
  const mac = isMacPlatform();
  const parts: string[] = [];

  if (shortcut.ctrl || shortcut.meta) {
    parts.push(mac ? '\u2318' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(mac ? '\u21E7' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(mac ? '\u2325' : 'Alt');
  }

  // Format the key itself
  const keyDisplay = formatKeyName(shortcut.key);
  parts.push(keyDisplay);

  return mac ? parts.join('') : parts.join('+');
}

/**
 * Format a raw key name into a display-friendly label.
 */
export function formatKeyName(key: string): string {
  const mac = isMacPlatform();

  const KEY_DISPLAY_MAP: Record<string, string> = {
    escape: mac ? '\u238B' : 'Esc',
    enter: mac ? '\u21A9' : 'Enter',
    tab: mac ? '\u21E5' : 'Tab',
    backspace: mac ? '\u232B' : 'Backspace',
    delete: mac ? '\u2326' : 'Del',
    arrowup: mac ? '\u2191' : 'Up',
    arrowdown: mac ? '\u2193' : 'Down',
    arrowleft: mac ? '\u2190' : 'Left',
    arrowright: mac ? '\u2192' : 'Right',
    space: 'Space',
    ',': ',',
    '.': '.',
    '/': '/',
    '[': '[',
    ']': ']',
    '\\': '\\',
    '-': '-',
    '=': '=',
    '`': '`',
    ';': ';',
    "'": "'",
  };

  const lower = key.toLowerCase();
  if (KEY_DISPLAY_MAP[lower]) {
    return KEY_DISPLAY_MAP[lower];
  }

  // Single characters get uppercased
  if (key.length === 1) {
    return key.toUpperCase();
  }

  // Function keys, etc.
  return key;
}

/* ═══════════════════════════════════════════
   Shortcut Matching
   ═══════════════════════════════════════════ */

/**
 * Build a normalized string key for a shortcut binding.
 * Used for conflict detection and fast matching.
 */
export function getShortcutFingerprint(binding: Pick<ShortcutDefinition, 'key' | 'ctrl' | 'meta' | 'shift' | 'alt'>): string {
  const parts: string[] = [];
  if (binding.ctrl || binding.meta) parts.push('mod');
  if (binding.shift) parts.push('shift');
  if (binding.alt) parts.push('alt');
  parts.push(binding.key.toLowerCase());
  return parts.join('+');
}

/**
 * Check whether a keyboard event matches a shortcut definition.
 */
function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  const mac = isMacPlatform();

  // Check modifier keys
  const wantsMod = !!(shortcut.ctrl || shortcut.meta);
  const hasMod = mac ? event.metaKey : event.ctrlKey;
  if (wantsMod !== hasMod) return false;

  const wantsShift = !!shortcut.shift;
  if (wantsShift !== event.shiftKey) return false;

  const wantsAlt = !!shortcut.alt;
  if (wantsAlt !== event.altKey) return false;

  // On Mac, when Cmd is pressed, we should not also require Ctrl to be false
  // unless the shortcut explicitly doesn't want mod. Vice versa on Win.
  if (mac && !wantsMod && event.ctrlKey) {
    // Allow Ctrl to pass through on Mac if shortcut doesn't need mod
    // This handles edge cases like Ctrl+C on Mac
  }
  if (!mac && !wantsMod && event.metaKey) {
    // On Windows, ignore meta (Win key) presses for non-mod shortcuts
  }

  // Check the key
  const eventKey = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();

  // Direct key match
  if (eventKey === shortcutKey) return true;

  // Handle special case: 'escape' vs 'Escape'
  if (shortcutKey === 'escape' && eventKey === 'escape') return true;

  return false;
}

/* ═══════════════════════════════════════════
   Conflict Detection
   ═══════════════════════════════════════════ */

export interface ShortcutConflict {
  shortcutA: string; // id of first shortcut
  shortcutB: string; // id of second shortcut
  fingerprint: string;
}

/**
 * Detect conflicts between shortcut definitions.
 * Returns an array of conflicts (pairs of shortcuts that share the same binding).
 */
export function detectConflicts(shortcuts: ShortcutDefinition[]): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = [];
  const seen = new Map<string, string>(); // fingerprint -> shortcut id

  for (const shortcut of shortcuts) {
    if (shortcut.enabled === false) continue;

    const fp = getShortcutFingerprint(shortcut);
    const existing = seen.get(fp);

    if (existing) {
      conflicts.push({
        shortcutA: existing,
        shortcutB: shortcut.id,
        fingerprint: fp,
      });
    } else {
      seen.set(fp, shortcut.id);
    }
  }

  return conflicts;
}

/* ═══════════════════════════════════════════
   Recording Hook (for shortcut reassignment)
   ═══════════════════════════════════════════ */

export interface RecordedBinding {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

export interface UseShortcutRecorderReturn {
  /** Whether we are currently recording a key combination */
  recording: boolean;
  /** The ID of the shortcut being recorded for */
  recordingForId: string | null;
  /** Start recording for a specific shortcut ID */
  startRecording: (shortcutId: string) => void;
  /** Cancel recording without saving */
  cancelRecording: () => void;
  /** The last recorded binding (set when recording completes) */
  recordedBinding: RecordedBinding | null;
  /** Clear the last recorded binding */
  clearRecorded: () => void;
}

/**
 * Hook for recording a new key combination.
 * Used in the keyboard shortcuts settings panel.
 */
export function useShortcutRecorder(): UseShortcutRecorderReturn {
  const [recording, setRecording] = useState(false);
  const [recordingForId, setRecordingForId] = useState<string | null>(null);
  const [recordedBinding, setRecordedBinding] = useState<RecordedBinding | null>(null);

  const startRecording = useCallback((shortcutId: string) => {
    setRecordingForId(shortcutId);
    setRecording(true);
    setRecordedBinding(null);
  }, []);

  const cancelRecording = useCallback(() => {
    setRecording(false);
    setRecordingForId(null);
  }, []);

  const clearRecorded = useCallback(() => {
    setRecordedBinding(null);
  }, []);

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore bare modifier key presses
      const modifierKeys = new Set(['Control', 'Shift', 'Alt', 'Meta', 'OS']);
      if (modifierKeys.has(event.key)) return;

      event.preventDefault();
      event.stopPropagation();

      // Escape cancels recording
      if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        cancelRecording();
        return;
      }

      const binding: RecordedBinding = {
        key: event.key.length === 1 ? event.key.toLowerCase() : event.key,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
        alt: event.altKey,
      };

      setRecordedBinding(binding);
      setRecording(false);
      // Keep recordingForId so the consumer knows which shortcut was changed
    };

    // Use capture to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [recording, cancelRecording]);

  return {
    recording,
    recordingForId,
    startRecording,
    cancelRecording,
    recordedBinding,
    clearRecorded,
  };
}

/* ═══════════════════════════════════════════
   Custom Event Helpers
   ═══════════════════════════════════════════ */

const SHORTCUT_EVENT_NAME = 'helix:shortcut';

/** Dispatch a custom DOM event when a shortcut fires */
function dispatchShortcutEvent(shortcutId: string): void {
  const detail: ShortcutEvent = {
    shortcutId,
    timestamp: Date.now(),
  };
  window.dispatchEvent(new CustomEvent(SHORTCUT_EVENT_NAME, { detail }));
}

/**
 * Subscribe to shortcut events from anywhere in the app.
 * Returns an unsubscribe function.
 */
export function onShortcut(
  shortcutId: string,
  callback: (event: ShortcutEvent) => void
): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ShortcutEvent>).detail;
    if (detail.shortcutId === shortcutId) {
      callback(detail);
    }
  };

  window.addEventListener(SHORTCUT_EVENT_NAME, handler);
  return () => window.removeEventListener(SHORTCUT_EVENT_NAME, handler);
}

/**
 * React hook to listen for a specific shortcut event.
 */
export function useShortcutListener(
  shortcutId: string,
  callback: () => void,
  deps: React.DependencyList = []
): void {
  // eslint-disable-next-line -- dynamic deps passed by caller
  const stableCallback = useCallback(callback, deps);

  useEffect(() => {
    return onShortcut(shortcutId, () => stableCallback());
  }, [shortcutId, stableCallback]);
}

/* ═══════════════════════════════════════════
   Default Shortcuts Definition
   ═══════════════════════════════════════════ */

/**
 * The default shortcut bindings shipped with Helix Desktop.
 * Actions are not included here -- they are provided at hook registration time.
 */
export const DEFAULT_SHORTCUT_BINDINGS: Omit<ShortcutDefinition, 'action'>[] = [
  {
    id: 'new-chat',
    key: 'n',
    ctrl: true,
    description: 'New Chat',
    category: 'Navigation',
  },
  {
    id: 'command-palette',
    key: 'k',
    ctrl: true,
    description: 'Command Palette',
    category: 'Navigation',
  },
  {
    id: 'open-settings',
    key: ',',
    ctrl: true,
    description: 'Open Settings',
    category: 'Navigation',
  },
  {
    id: 'toggle-talk-mode',
    key: 't',
    ctrl: true,
    description: 'Toggle Talk Mode',
    category: 'Actions',
  },
  {
    id: 'open-approvals',
    key: 'a',
    ctrl: true,
    shift: true,
    description: 'Open Approvals',
    category: 'Actions',
  },
  {
    id: 'toggle-theme',
    key: 'd',
    ctrl: true,
    shift: true,
    description: 'Toggle Theme',
    category: 'View',
  },
  {
    id: 'close-overlay',
    key: 'Escape',
    description: 'Close Overlay',
    category: 'View',
  },
];

/* ═══════════════════════════════════════════
   Apply Overrides
   ═══════════════════════════════════════════ */

/**
 * Merge custom binding overrides into shortcut definitions.
 * Only the key/modifier fields are overridden; description, category, and action remain.
 */
export function applyOverrides(
  shortcuts: ShortcutDefinition[],
  overrides: ShortcutOverrides
): ShortcutDefinition[] {
  return shortcuts.map((shortcut) => {
    const override = overrides[shortcut.id];
    if (!override) return shortcut;

    return {
      ...shortcut,
      key: override.key,
      ctrl: override.ctrl ?? false,
      meta: override.meta ?? false,
      shift: override.shift ?? false,
      alt: override.alt ?? false,
    };
  });
}

/* ═══════════════════════════════════════════
   Main Hook
   ═══════════════════════════════════════════ */

/**
 * Register global keyboard shortcuts.
 *
 * This hook attaches a single keydown listener to the window and dispatches
 * matching shortcuts. It supports custom overrides and can be globally
 * enabled/disabled.
 *
 * @example
 * ```tsx
 * const shortcuts: ShortcutDefinition[] = [
 *   {
 *     id: 'new-chat',
 *     key: 'n',
 *     ctrl: true,
 *     description: 'New Chat',
 *     category: 'Navigation',
 *     action: () => createNewChat(),
 *   },
 * ];
 *
 * const { activeShortcuts } = useGlobalShortcuts({
 *   shortcuts,
 *   enabled: true,
 *   overrides: customBindings,
 * });
 * ```
 */
export function useGlobalShortcuts({
  shortcuts,
  enabled = true,
  overrides = {},
}: UseGlobalShortcutsOptions): UseGlobalShortcutsReturn {
  const [lastMatchedId, setLastMatchedId] = useState<string | null>(null);

  // Apply overrides to build effective shortcut list
  const activeShortcuts = useMemo(
    () => applyOverrides(shortcuts, overrides),
    [shortcuts, overrides]
  );

  // Ref to always have the latest shortcuts without re-registering the listener
  const shortcutsRef = useRef(activeShortcuts);
  shortcutsRef.current = activeShortcuts;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Clear lastMatchedId after a short delay (for visual feedback)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabledRef.current) return;

    // Don't intercept shortcuts when typing in input fields
    // unless the shortcut is Escape (always allowed)
    const target = event.target as HTMLElement;
    const isInputField =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;

    for (const shortcut of shortcutsRef.current) {
      if (shortcut.enabled === false) continue;

      // Skip non-escape shortcuts when focused on input fields
      if (isInputField && shortcut.key.toLowerCase() !== 'escape') continue;

      if (matchesShortcut(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();

        // Execute the action
        shortcut.action();

        // Dispatch custom event for decoupled listeners
        dispatchShortcutEvent(shortcut.id);

        // Track last match for UI feedback
        setLastMatchedId(shortcut.id);

        // Clear after brief visual feedback window
        if (clearTimerRef.current) {
          clearTimeout(clearTimerRef.current);
        }
        clearTimerRef.current = setTimeout(() => {
          setLastMatchedId(null);
        }, 800);

        return; // Only match first shortcut
      }
    }
  }, []);

  // Register the global keydown listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, false);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, false);
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, [handleKeyDown]);

  return {
    activeShortcuts,
    lastMatchedId,
  };
}

/* ═══════════════════════════════════════════
   Serialization Helpers
   ═══════════════════════════════════════════ */

/**
 * Convert a RecordedBinding into a ShortcutBinding for persistence.
 */
export function recordedToBinding(
  shortcutId: string,
  recorded: RecordedBinding
): ShortcutBinding {
  const mac = isMacPlatform();

  return {
    id: shortcutId,
    key: recorded.key,
    // On Mac, metaKey is the primary mod; on Win/Linux, ctrlKey is
    ctrl: mac ? recorded.ctrl : (recorded.ctrl || recorded.meta),
    meta: mac ? (recorded.meta || recorded.ctrl) : recorded.meta,
    shift: recorded.shift,
    alt: recorded.alt,
  };
}

/**
 * Convert ShortcutOverrides to a flat, JSON-safe representation
 * suitable for gateway config storage.
 */
export function serializeOverrides(overrides: ShortcutOverrides): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [id, binding] of Object.entries(overrides)) {
    result[id] = {
      key: binding.key,
      ...(binding.ctrl && { ctrl: true }),
      ...(binding.meta && { meta: true }),
      ...(binding.shift && { shift: true }),
      ...(binding.alt && { alt: true }),
    };
  }
  return result;
}

/**
 * Parse ShortcutOverrides from gateway config data.
 */
export function deserializeOverrides(data: unknown): ShortcutOverrides {
  if (!data || typeof data !== 'object') return {};

  const result: ShortcutOverrides = {};
  const raw = data as Record<string, unknown>;

  for (const [id, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    const binding = value as Record<string, unknown>;

    if (typeof binding.key !== 'string') continue;

    result[id] = {
      id,
      key: binding.key,
      ctrl: binding.ctrl === true,
      meta: binding.meta === true,
      shift: binding.shift === true,
      alt: binding.alt === true,
    };
  }

  return result;
}
