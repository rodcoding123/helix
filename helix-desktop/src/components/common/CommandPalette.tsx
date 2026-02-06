/**
 * Command Palette for Helix Desktop
 *
 * A searchable command palette (Ctrl+K / Cmd+K) providing quick navigation
 * and actions across the application. Inspired by VS Code's command palette
 * and macOS Spotlight.
 *
 * Features:
 * - Fuzzy substring search across all commands
 * - Keyboard-driven navigation (Arrow keys, Enter, Escape)
 * - Grouped results by category
 * - Recent commands persisted in localStorage
 * - Keyboard shortcut hints next to each command
 * - Auto-focus search input on open
 *
 * Phase J, Task J5 - Command Palette
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatShortcut } from '../../hooks/useGlobalShortcuts';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export type CommandCategory = 'Recent' | 'Navigation' | 'Settings' | 'Actions';

export interface CommandDefinition {
  /** Unique identifier for the command */
  id: string;
  /** Display name shown in the palette */
  name: string;
  /** Category for grouping */
  category: CommandCategory;
  /** Emoji icon displayed next to the command */
  icon: string;
  /** Optional keyboard shortcut definition for display */
  shortcut?: {
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
  };
  /** Action to execute: either a route path (string) or a custom event name */
  action: CommandAction;
}

export type CommandAction =
  | { type: 'navigate'; path: string }
  | { type: 'event'; eventName: string };

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

const STORAGE_KEY = 'helix-command-palette-recent';
const MAX_RECENT = 5;
const MAX_VISIBLE_RESULTS = 10;

/** Category display order */
const CATEGORY_ORDER: CommandCategory[] = ['Recent', 'Navigation', 'Settings', 'Actions'];

/* ═══════════════════════════════════════════
   Command Registry
   ═══════════════════════════════════════════ */

const COMMANDS: CommandDefinition[] = [
  // ── Navigation ──────────────────────────
  {
    id: 'nav-chat',
    name: 'Go to Chat',
    category: 'Navigation',
    icon: '\u{1F4AC}',
    shortcut: { key: 'n', ctrl: true },
    action: { type: 'navigate', path: '/chat' },
  },
  {
    id: 'nav-settings',
    name: 'Go to Settings',
    category: 'Navigation',
    icon: '\u{2699}',
    shortcut: { key: ',', ctrl: true },
    action: { type: 'navigate', path: '/settings' },
  },
  {
    id: 'nav-agents',
    name: 'Go to Agents',
    category: 'Navigation',
    icon: '\u{1F916}',
    action: { type: 'navigate', path: '/agents' },
  },
  {
    id: 'nav-security',
    name: 'Go to Security & Approvals',
    category: 'Navigation',
    icon: '\u{1F6E1}',
    shortcut: { key: 'a', ctrl: true, shift: true },
    action: { type: 'navigate', path: '/security' },
  },
  {
    id: 'nav-channels',
    name: 'Go to Channels',
    category: 'Navigation',
    icon: '\u{1F4E1}',
    action: { type: 'navigate', path: '/channels' },
  },
  {
    id: 'nav-browser',
    name: 'Go to Browser Automation',
    category: 'Navigation',
    icon: '\u{1F310}',
    action: { type: 'navigate', path: '/browser' },
  },
  {
    id: 'nav-voice',
    name: 'Go to Voice & Talk Mode',
    category: 'Navigation',
    icon: '\u{1F3A4}',
    action: { type: 'navigate', path: '/voice' },
  },
  {
    id: 'nav-devices',
    name: 'Go to Devices',
    category: 'Navigation',
    icon: '\u{1F4F1}',
    action: { type: 'navigate', path: '/devices' },
  },
  {
    id: 'nav-nodes',
    name: 'Go to Nodes',
    category: 'Navigation',
    icon: '\u{1F5A7}',
    action: { type: 'navigate', path: '/nodes' },
  },
  {
    id: 'nav-sessions',
    name: 'Go to Sessions',
    category: 'Navigation',
    icon: '\u{1F4CB}',
    action: { type: 'navigate', path: '/sessions' },
  },
  {
    id: 'nav-memory',
    name: 'Go to Memory',
    category: 'Navigation',
    icon: '\u{1F9E0}',
    action: { type: 'navigate', path: '/memory' },
  },
  {
    id: 'nav-psychology',
    name: 'Go to Psychology',
    category: 'Navigation',
    icon: '\u{1F52E}',
    action: { type: 'navigate', path: '/psychology' },
  },
  {
    id: 'nav-orchestrator',
    name: 'Go to Orchestrator',
    category: 'Navigation',
    icon: '\u{1F3AF}',
    action: { type: 'navigate', path: '/orchestrator' },
  },
  {
    id: 'nav-teams',
    name: 'Go to Teams',
    category: 'Navigation',
    icon: '\u{1F465}',
    action: { type: 'navigate', path: '/teams' },
  },

  // ── Settings ────────────────────────────
  {
    id: 'settings-general',
    name: 'Settings: General',
    category: 'Settings',
    icon: '\u{2699}',
    action: { type: 'navigate', path: '/settings/general' },
  },
  {
    id: 'settings-model',
    name: 'Settings: Model & Provider',
    category: 'Settings',
    icon: '\u{1F9E9}',
    action: { type: 'navigate', path: '/settings/model' },
  },
  {
    id: 'settings-failover',
    name: 'Settings: Model Failover',
    category: 'Settings',
    icon: '\u{1F504}',
    action: { type: 'navigate', path: '/settings/failover' },
  },
  {
    id: 'settings-channels',
    name: 'Settings: Channels',
    category: 'Settings',
    icon: '\u{1F4E1}',
    action: { type: 'navigate', path: '/settings/channels' },
  },
  {
    id: 'settings-voice',
    name: 'Settings: Voice & TTS',
    category: 'Settings',
    icon: '\u{1F50A}',
    action: { type: 'navigate', path: '/settings/voice' },
  },
  {
    id: 'settings-tools',
    name: 'Settings: Tools & Sandbox',
    category: 'Settings',
    icon: '\u{1F527}',
    action: { type: 'navigate', path: '/settings/tools' },
  },
  {
    id: 'settings-skills',
    name: 'Settings: Skills',
    category: 'Settings',
    icon: '\u{26A1}',
    action: { type: 'navigate', path: '/settings/skills' },
  },
  {
    id: 'settings-automation',
    name: 'Settings: Automation',
    category: 'Settings',
    icon: '\u{1F3ED}',
    action: { type: 'navigate', path: '/settings/automation' },
  },
  {
    id: 'settings-agents',
    name: 'Settings: Agents',
    category: 'Settings',
    icon: '\u{1F916}',
    action: { type: 'navigate', path: '/settings/agents' },
  },
  {
    id: 'settings-privacy',
    name: 'Settings: Privacy & Security',
    category: 'Settings',
    icon: '\u{1F512}',
    action: { type: 'navigate', path: '/settings/privacy' },
  },
  {
    id: 'settings-psychology',
    name: 'Settings: Psychology',
    category: 'Settings',
    icon: '\u{1F52E}',
    action: { type: 'navigate', path: '/settings/psychology' },
  },
  {
    id: 'settings-secrets',
    name: 'Settings: Secrets',
    category: 'Settings',
    icon: '\u{1F511}',
    action: { type: 'navigate', path: '/settings/secrets' },
  },
  {
    id: 'settings-hooks',
    name: 'Settings: Hooks',
    category: 'Settings',
    icon: '\u{1FA9D}',
    action: { type: 'navigate', path: '/settings/hooks' },
  },
  {
    id: 'settings-advanced',
    name: 'Settings: Advanced',
    category: 'Settings',
    icon: '\u{1F6E0}',
    action: { type: 'navigate', path: '/settings/advanced' },
  },
  {
    id: 'settings-shortcuts',
    name: 'Settings: Keyboard Shortcuts',
    category: 'Settings',
    icon: '\u{2328}',
    action: { type: 'navigate', path: '/settings/shortcuts' },
  },
  {
    id: 'settings-auth-profiles',
    name: 'Settings: Auth Profiles',
    category: 'Settings',
    icon: '\u{1F464}',
    action: { type: 'navigate', path: '/settings/auth-profiles' },
  },

  // ── Actions ─────────────────────────────
  {
    id: 'action-new-chat',
    name: 'New Chat',
    category: 'Actions',
    icon: '\u{2795}',
    shortcut: { key: 'n', ctrl: true },
    action: { type: 'event', eventName: 'helix:new-chat' },
  },
  {
    id: 'action-toggle-talk',
    name: 'Toggle Talk Mode',
    category: 'Actions',
    icon: '\u{1F3A4}',
    shortcut: { key: 't', ctrl: true },
    action: { type: 'event', eventName: 'helix:toggle-talk-mode' },
  },
  {
    id: 'action-toggle-theme',
    name: 'Toggle Theme',
    category: 'Actions',
    icon: '\u{1F3A8}',
    shortcut: { key: 'd', ctrl: true, shift: true },
    action: { type: 'event', eventName: 'helix:toggle-theme' },
  },
];

/** Lookup table for fast command retrieval by ID */
const COMMANDS_BY_ID = new Map<string, CommandDefinition>(
  COMMANDS.map((cmd) => [cmd.id, cmd])
);

/* ═══════════════════════════════════════════
   Local Storage Helpers
   ═══════════════════════════════════════════ */

function loadRecentCommandIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate: only keep IDs that are strings and exist in the registry
    return parsed
      .filter((item): item is string => typeof item === 'string' && COMMANDS_BY_ID.has(item))
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecentCommandIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {
    // localStorage may be unavailable or full; silently ignore
  }
}

function addToRecent(commandId: string): string[] {
  const current = loadRecentCommandIds();
  // Remove if already present, then prepend
  const filtered = current.filter((id) => id !== commandId);
  const updated = [commandId, ...filtered].slice(0, MAX_RECENT);
  saveRecentCommandIds(updated);
  return updated;
}

/* ═══════════════════════════════════════════
   Search / Filtering
   ═══════════════════════════════════════════ */

interface ScoredCommand {
  command: CommandDefinition;
  /** Position of the first character match (lower = better) */
  matchIndex: number;
}

/**
 * Perform case-insensitive substring matching on command names.
 * Results are sorted by match position (earlier match = higher rank).
 */
function searchCommands(query: string, commands: CommandDefinition[]): CommandDefinition[] {
  if (!query.trim()) return [];

  const normalizedQuery = query.toLowerCase().trim();
  const scored: ScoredCommand[] = [];

  for (const cmd of commands) {
    const normalizedName = cmd.name.toLowerCase();
    const index = normalizedName.indexOf(normalizedQuery);
    if (index !== -1) {
      scored.push({ command: cmd, matchIndex: index });
    }
  }

  // Sort by match position (earlier = better), then alphabetically for ties
  scored.sort((a, b) => {
    if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex;
    return a.command.name.localeCompare(b.command.name);
  });

  return scored.slice(0, MAX_VISIBLE_RESULTS).map((s) => s.command);
}

/**
 * Group commands by category, maintaining the defined category order.
 */
function groupByCategory(
  commands: CommandDefinition[]
): Array<{ category: CommandCategory; commands: CommandDefinition[] }> {
  const groups = new Map<CommandCategory, CommandDefinition[]>();

  for (const cmd of commands) {
    const existing = groups.get(cmd.category);
    if (existing) {
      existing.push(cmd);
    } else {
      groups.set(cmd.category, [cmd]);
    }
  }

  // Return in the defined category order
  const result: Array<{ category: CommandCategory; commands: CommandDefinition[] }> = [];
  for (const category of CATEGORY_ORDER) {
    const cmds = groups.get(category);
    if (cmds && cmds.length > 0) {
      result.push({ category, commands: cmds });
    }
  }

  return result;
}

/**
 * Highlight the matched substring within a command name.
 * Returns an array of React elements with the matched portion wrapped in a <mark>.
 */
function highlightMatch(name: string, query: string): React.ReactNode {
  if (!query.trim()) return name;

  const normalizedQuery = query.toLowerCase().trim();
  const normalizedName = name.toLowerCase();
  const matchIndex = normalizedName.indexOf(normalizedQuery);

  if (matchIndex === -1) return name;

  const before = name.slice(0, matchIndex);
  const match = name.slice(matchIndex, matchIndex + normalizedQuery.length);
  const after = name.slice(matchIndex + normalizedQuery.length);

  return (
    <>
      {before}
      <mark className="cp-highlight">{match}</mark>
      {after}
    </>
  );
}

/* ═══════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════ */

const styles = `
/* ── Overlay ──────────────────────────── */
.cp-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 20vh;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: cp-fade-in 0.12s ease-out;
}

@keyframes cp-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ── Container ────────────────────────── */
.cp-container {
  width: 100%;
  max-width: 500px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  background: rgba(22, 22, 26, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.6),
    0 0 1px rgba(255, 255, 255, 0.1);
  overflow: hidden;
  animation: cp-slide-in 0.15s ease-out;
}

@keyframes cp-slide-in {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ── Search Header ────────────────────── */
.cp-search-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.cp-search-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: #a0a0a0;
  opacity: 0.7;
}

.cp-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 15px;
  font-family: inherit;
  color: #e0e0e0;
  caret-color: #8b5cf6;
  line-height: 1.4;
}

.cp-search-input::placeholder {
  color: #666;
}

.cp-search-shortcut {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: #555;
  user-select: none;
}

.cp-search-shortcut kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  font-family: inherit;
  font-size: 10px;
  color: #666;
}

/* ── Results Area ─────────────────────── */
.cp-results {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.cp-results::-webkit-scrollbar {
  width: 6px;
}

.cp-results::-webkit-scrollbar-track {
  background: transparent;
}

.cp-results::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.cp-results::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.18);
}

/* ── Category Group ───────────────────── */
.cp-category {
  padding: 0 6px;
}

.cp-category + .cp-category {
  margin-top: 2px;
}

.cp-category-label {
  display: flex;
  align-items: center;
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  user-select: none;
}

/* ── Result Item ──────────────────────── */
.cp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  margin: 0 6px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.08s ease;
  user-select: none;
}

.cp-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.cp-item--selected {
  background: rgba(139, 92, 246, 0.15) !important;
}

.cp-item--selected .cp-item-name {
  color: #e8e0ff;
}

.cp-item-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 14px;
  line-height: 1;
}

.cp-item--selected .cp-item-icon {
  background: rgba(139, 92, 246, 0.2);
}

.cp-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cp-item-name {
  flex: 1;
  font-size: 13.5px;
  color: #d0d0d0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.cp-highlight {
  background: rgba(139, 92, 246, 0.3);
  color: #e8e0ff;
  border-radius: 2px;
  padding: 0 1px;
}

.cp-item-badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  color: #777;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.04);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cp-item--selected .cp-item-badge {
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.15);
}

.cp-item-shortcut {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 2px;
}

.cp-item-shortcut kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  font-family: inherit;
  font-size: 10.5px;
  color: #666;
  line-height: 1;
}

.cp-item--selected .cp-item-shortcut kbd {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}

/* ── Empty State ──────────────────────── */
.cp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: #555;
  text-align: center;
  user-select: none;
}

.cp-empty-icon {
  font-size: 28px;
  margin-bottom: 8px;
  opacity: 0.5;
}

.cp-empty-text {
  font-size: 13px;
  line-height: 1.5;
}

.cp-empty-hint {
  font-size: 11px;
  color: #444;
  margin-top: 4px;
}

/* ── Footer ───────────────────────────── */
.cp-footer {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
  color: #555;
  user-select: none;
}

.cp-footer-hint {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cp-footer-hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 3px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  font-family: inherit;
  font-size: 10px;
  color: #555;
  line-height: 1;
}

/* ── Responsive ───────────────────────── */
@media (max-width: 560px) {
  .cp-overlay {
    padding-top: 10vh;
    padding-left: 12px;
    padding-right: 12px;
  }

  .cp-container {
    max-width: 100%;
  }
}
`;

/* ═══════════════════════════════════════════
   Search Icon SVG Component
   ═══════════════════════════════════════════ */

function SearchIcon(): React.ReactElement {
  return (
    <svg
      className="cp-search-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Shortcut Display Component
   ═══════════════════════════════════════════ */

interface ShortcutDisplayProps {
  shortcut: NonNullable<CommandDefinition['shortcut']>;
  className?: string;
}

function ShortcutDisplay({ shortcut, className = '' }: ShortcutDisplayProps): React.ReactElement {
  const formatted = formatShortcut(shortcut);

  // Split the formatted shortcut into individual keys for styled display.
  // On macOS, formatShortcut returns symbols concatenated (e.g., "\u2318N"),
  // so we split each character. On Windows/Linux it returns "Ctrl+N" style.
  const isMac =
    typeof navigator !== 'undefined' &&
    (navigator.platform?.toLowerCase().includes('mac') ||
      navigator.userAgent?.toLowerCase().includes('macintosh'));

  let keys: string[];
  if (isMac) {
    // On Mac, each symbol is its own "key" except the final character
    // which represents the actual key. The string is like "\u2318\u21E7K"
    keys = [];
    for (const char of formatted) {
      keys.push(char);
    }
  } else {
    keys = formatted.split('+');
  }

  return (
    <span className={`cp-item-shortcut ${className}`.trim()}>
      {keys.map((key, idx) => (
        <kbd key={idx}>{key}</kbd>
      ))}
    </span>
  );
}

/* ═══════════════════════════════════════════
   Result Item Component
   ═══════════════════════════════════════════ */

interface ResultItemProps {
  command: CommandDefinition;
  isSelected: boolean;
  query: string;
  showBadge: boolean;
  onSelect: (command: CommandDefinition) => void;
  onHover: (command: CommandDefinition) => void;
  itemRef: (el: HTMLDivElement | null) => void;
}

function ResultItem({
  command,
  isSelected,
  query,
  showBadge,
  onSelect,
  onHover,
  itemRef,
}: ResultItemProps): React.ReactElement {
  const handleClick = useCallback(() => {
    onSelect(command);
  }, [command, onSelect]);

  const handleMouseEnter = useCallback(() => {
    onHover(command);
  }, [command, onHover]);

  const classes = ['cp-item', isSelected ? 'cp-item--selected' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={itemRef}
      className={classes}
      role="option"
      aria-selected={isSelected}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      <div className="cp-item-icon" aria-hidden="true">
        {command.icon}
      </div>
      <div className="cp-item-content">
        <span className="cp-item-name">{highlightMatch(command.name, query)}</span>
        {showBadge && (
          <span className="cp-item-badge">{command.category}</span>
        )}
        {command.shortcut && <ShortcutDisplay shortcut={command.shortcut} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps): React.ReactElement | null {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const styleInjectedRef = useRef(false);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // ── Style Injection ──────────────────────
  useEffect(() => {
    if (styleInjectedRef.current) return;

    const existingStyle = document.getElementById('cp-styles');
    if (existingStyle) {
      styleInjectedRef.current = true;
      return;
    }

    const styleEl = document.createElement('style');
    styleEl.id = 'cp-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
    styleInjectedRef.current = true;

    return () => {
      // Do not remove the style element; it is shared across mounts
    };
  }, []);

  // ── Load Recent Commands on Open ─────────
  useEffect(() => {
    if (isOpen) {
      setRecentIds(loadRecentCommandIds());
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // ── Auto-Focus on Open ───────────────────
  useEffect(() => {
    if (isOpen) {
      // Use a short delay to ensure the DOM has rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ── Prevent Body Scroll When Open ────────
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  // ── Build the Flat Result List ───────────
  const flatResults = useMemo((): CommandDefinition[] => {
    if (query.trim()) {
      // Search mode: return filtered results (no grouping in the flat list, but
      // we'll still group them for display)
      return searchCommands(query, COMMANDS);
    }

    // No query: show recent commands first, then all commands
    const recentCommands: CommandDefinition[] = [];
    for (const id of recentIds) {
      const cmd = COMMANDS_BY_ID.get(id);
      if (cmd) {
        // Create a "Recent" variant of the command for display
        recentCommands.push({ ...cmd, category: 'Recent' as CommandCategory });
      }
    }

    return [...recentCommands, ...COMMANDS];
  }, [query, recentIds]);

  // ── Group Results for Display ────────────
  const groupedResults = useMemo(() => {
    return groupByCategory(flatResults);
  }, [flatResults]);

  // ── Build a flat ordered list of command IDs for keyboard navigation ──
  const flatOrderedIds = useMemo((): string[] => {
    const ids: string[] = [];
    for (const group of groupedResults) {
      for (const cmd of group.commands) {
        // Use a composite key to handle the same command appearing in Recent and its original category
        const key = cmd.category === 'Recent' ? `recent:${cmd.id}` : cmd.id;
        ids.push(key);
      }
    }
    return ids;
  }, [groupedResults]);

  // ── Resolve a flat-ordered key back to a CommandDefinition ──
  const resolveCommand = useCallback(
    (key: string): CommandDefinition | undefined => {
      const actualId = key.startsWith('recent:') ? key.slice(7) : key;
      return COMMANDS_BY_ID.get(actualId);
    },
    []
  );

  // ── Clamp Selected Index ─────────────────
  useEffect(() => {
    if (selectedIndex >= flatOrderedIds.length) {
      setSelectedIndex(Math.max(0, flatOrderedIds.length - 1));
    }
  }, [flatOrderedIds.length, selectedIndex]);

  // ── Scroll Selected Item Into View ───────
  useEffect(() => {
    if (flatOrderedIds.length === 0) return;
    const selectedKey = flatOrderedIds[selectedIndex];
    if (!selectedKey) return;

    const el = itemRefs.current.get(selectedKey);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, flatOrderedIds]);

  // ── Execute Command ──────────────────────
  const executeCommand = useCallback(
    (command: CommandDefinition) => {
      // Record as recent (use the real command ID, not the recent-prefixed key)
      const updatedRecent = addToRecent(command.id);
      setRecentIds(updatedRecent);

      // Close the palette
      onClose();

      // Execute the action
      if (command.action.type === 'navigate') {
        navigate(command.action.path);
      } else if (command.action.type === 'event') {
        window.dispatchEvent(new CustomEvent(command.action.eventName));
      }
    },
    [navigate, onClose]
  );

  // ── Keyboard Navigation ──────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const totalItems = flatOrderedIds.length;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + Math.max(1, totalItems)) % Math.max(1, totalItems));
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (totalItems > 0 && selectedIndex < totalItems) {
            const key = flatOrderedIds[selectedIndex];
            const cmd = resolveCommand(key);
            if (cmd) {
              executeCommand(cmd);
            }
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          onClose();
          break;
        }
        case 'Tab': {
          // Prevent tab from moving focus outside the palette
          e.preventDefault();
          // Treat Tab as ArrowDown for convenience
          setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
          break;
        }
        default:
          break;
      }
    },
    [flatOrderedIds, selectedIndex, resolveCommand, executeCommand, onClose]
  );

  // ── Handle Search Input Change ───────────
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    // Reset selection to first item on any input change
    setSelectedIndex(0);
  }, []);

  // ── Handle Overlay Click (close) ─────────
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // ── Handle Item Selection via Mouse ──────
  const handleItemSelect = useCallback(
    (command: CommandDefinition) => {
      executeCommand(command);
    },
    [executeCommand]
  );

  // ── Handle Item Hover (update selection) ──
  const handleItemHover = useCallback(
    (command: CommandDefinition) => {
      // Find the index of this command in the flat ordered list.
      // We need to check both possible keys (recent-prefixed and plain).
      const recentKey = `recent:${command.id}`;
      let idx = flatOrderedIds.indexOf(recentKey);
      if (idx === -1) {
        idx = flatOrderedIds.indexOf(command.id);
      }
      if (idx !== -1) {
        setSelectedIndex(idx);
      }
    },
    [flatOrderedIds]
  );

  // ── Ref Callback for Items ───────────────
  const makeItemRef = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      if (el) {
        itemRefs.current.set(key, el);
      } else {
        itemRefs.current.delete(key);
      }
    },
    []
  );

  // ── Determine Shortcut Hint for Search Bar ──
  const isMac =
    typeof navigator !== 'undefined' &&
    (navigator.platform?.toLowerCase().includes('mac') ||
      navigator.userAgent?.toLowerCase().includes('macintosh'));

  // ── Render ───────────────────────────────
  if (!isOpen) return null;

  const hasResults = flatOrderedIds.length > 0;
  const isSearching = query.trim().length > 0;

  // Determine if we should show category badges on search results
  // (show badges when searching since results span multiple categories)
  const showBadges = isSearching;

  // Track a running index across groups for mapping to flatOrderedIds
  let runningIndex = 0;

  return (
    <div
      className="cp-overlay"
      onClick={handleOverlayClick}
      role="presentation"
      aria-hidden={!isOpen}
    >
      <div
        className="cp-container"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        {/* ── Search Input ── */}
        <div className="cp-search-wrapper">
          <SearchIcon />
          <input
            ref={inputRef}
            className="cp-search-input"
            type="text"
            placeholder="Type a command..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={hasResults}
            aria-controls="cp-results-list"
            aria-activedescendant={
              hasResults && flatOrderedIds[selectedIndex]
                ? `cp-item-${flatOrderedIds[selectedIndex]}`
                : undefined
            }
          />
          <span className="cp-search-shortcut">
            <kbd>{isMac ? '\u2318' : 'Ctrl'}</kbd>
            <kbd>K</kbd>
          </span>
        </div>

        {/* ── Results ── */}
        <div
          ref={resultsRef}
          className="cp-results"
          id="cp-results-list"
          role="listbox"
          aria-label="Command results"
        >
          {hasResults ? (
            groupedResults.map((group) => {
              const groupStartIndex = runningIndex;

              const items = group.commands.map((cmd, cmdIdx) => {
                const itemIndex = groupStartIndex + cmdIdx;
                const key = flatOrderedIds[itemIndex];
                const isSelected = itemIndex === selectedIndex;

                return (
                  <ResultItem
                    key={key}
                    command={cmd}
                    isSelected={isSelected}
                    query={query}
                    showBadge={showBadges}
                    onSelect={handleItemSelect}
                    onHover={handleItemHover}
                    itemRef={makeItemRef(key)}
                  />
                );
              });

              runningIndex += group.commands.length;

              return (
                <div key={group.category} className="cp-category">
                  <div className="cp-category-label" aria-hidden="true">
                    {group.category}
                  </div>
                  {items}
                </div>
              );
            })
          ) : isSearching ? (
            <div className="cp-empty">
              <div className="cp-empty-icon" aria-hidden="true">
                {'\u{1F50D}'}
              </div>
              <div className="cp-empty-text">
                No commands found for &quot;{query}&quot;
              </div>
              <div className="cp-empty-hint">Try a different search term</div>
            </div>
          ) : (
            <div className="cp-empty">
              <div className="cp-empty-icon" aria-hidden="true">
                {'\u{2328}'}
              </div>
              <div className="cp-empty-text">Start typing to search commands</div>
              <div className="cp-empty-hint">
                Navigate, open settings, or trigger actions
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Hints ── */}
        <div className="cp-footer">
          <span className="cp-footer-hint">
            <kbd>{'\u2191'}</kbd>
            <kbd>{'\u2193'}</kbd>
            navigate
          </span>
          <span className="cp-footer-hint">
            <kbd>{'\u21B5'}</kbd>
            select
          </span>
          <span className="cp-footer-hint">
            <kbd>esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
