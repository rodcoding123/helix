/**
 * ToolsPolicyEditor - Comprehensive tools policy management
 *
 * Three-section layout:
 *   1. Profile Selector  - Quick presets (minimal, coding, messaging, full)
 *   2. Tool Group Toggles - Per-group enable/disable with tool counts
 *   3. Allow / Deny Lists - Fine-grained tool-level control with wildcards
 *
 * When `agentId` is provided, edits per-agent tool policy overrides
 * instead of the global tools configuration.
 *
 * Gateway integration:
 *   - Reads from gatewayConfig._raw?.tools (global) or agents.list[].toolsPolicy (agent)
 *   - Saves via patchGatewayConfig()
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';
import { ToolGroupToggle } from './ToolGroupToggle';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolsPolicyEditorProps {
  agentId?: string;
  agentName?: string;
  onBack?: () => void;
}

type ProfileId = 'minimal' | 'coding' | 'messaging' | 'full';

interface ProfileDef {
  id: ProfileId;
  label: string;
  icon: string;
  description: string;
  toolCount: number;
  allow: string[];
  deny: string[];
}

interface ToolGroupDef {
  name: string;
  label: string;
  description: string;
  icon: string;
  tools: string[];
}

// ---------------------------------------------------------------------------
// Constants - Tool Groups
// ---------------------------------------------------------------------------

const TOOL_GROUPS: ToolGroupDef[] = [
  {
    name: 'group:runtime',
    label: 'Runtime',
    description: 'Process control, exec, eval',
    icon: '\u{1F4BB}',
    tools: ['Bash', 'exec.*', 'eval.*', 'process.*'],
  },
  {
    name: 'group:fs',
    label: 'File System',
    description: 'File read/write/search/glob',
    icon: '\u{1F4C1}',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'NotebookEdit'],
  },
  {
    name: 'group:sessions',
    label: 'Sessions',
    description: 'Session management, history',
    icon: '\u{1F4AC}',
    tools: ['session.*', 'history.*', 'session.list', 'session.create', 'session.switch'],
  },
  {
    name: 'group:memory',
    label: 'Memory',
    description: 'Memory search, create, observe',
    icon: '\u{1F9E0}',
    tools: [
      'mcp__memory__create_entities',
      'mcp__memory__create_relations',
      'mcp__memory__add_observations',
      'mcp__memory__search_nodes',
      'mcp__memory__open_nodes',
      'mcp__memory__read_graph',
      'mcp__memory__delete_entities',
      'mcp__memory__delete_relations',
      'mcp__memory__delete_observations',
    ],
  },
  {
    name: 'group:web',
    label: 'Web',
    description: 'Browser, fetch, navigate',
    icon: '\u{1F310}',
    tools: [
      'WebFetch',
      'WebSearch',
      'mcp__plugin_playwright_playwright__browser_navigate',
      'mcp__plugin_playwright_playwright__browser_click',
      'mcp__plugin_playwright_playwright__browser_snapshot',
      'mcp__plugin_playwright_playwright__browser_take_screenshot',
      'mcp__plugin_playwright_playwright__browser_type',
      'mcp__plugin_playwright_playwright__browser_evaluate',
    ],
  },
  {
    name: 'group:ui',
    label: 'UI',
    description: 'Screenshots, notifications, clipboard',
    icon: '\u{1F5BC}\uFE0F',
    tools: [
      'mcp__plugin_playwright_playwright__browser_take_screenshot',
      'mcp__plugin_playwright_playwright__browser_snapshot',
      'mcp__plugin_playwright_playwright__browser_console_messages',
      'clipboard.*',
      'notification.*',
    ],
  },
  {
    name: 'group:automation',
    label: 'Automation',
    description: 'Cron, schedules, workflows',
    icon: '\u{2699}\uFE0F',
    tools: ['cron.*', 'schedule.*', 'workflow.*', 'Task'],
  },
  {
    name: 'group:messaging',
    label: 'Messaging',
    description: 'Channel send, DM, group',
    icon: '\u{1F4E8}',
    tools: [
      'channel.*',
      'message.*',
      'dm.*',
      'group.*',
      'discord.*',
      'telegram.*',
      'slack.*',
      'whatsapp.*',
    ],
  },
  {
    name: 'group:nodes',
    label: 'Nodes',
    description: 'Node invoke, status, capabilities',
    icon: '\u{1F5A7}',
    tools: ['node.*', 'nodes.*', 'node.invoke', 'node.status', 'node.capabilities'],
  },
  {
    name: 'group:openclaw',
    label: 'OpenClaw',
    description: 'Config, plugins, skills',
    icon: '\u{1F43E}',
    tools: ['Skill', 'config.*', 'plugin.*', 'skills.*'],
  },
];

// Flat set of all known tools across all groups
const ALL_GROUP_TOOLS = TOOL_GROUPS.flatMap((g) => g.tools);
const ALL_UNIQUE_TOOLS = [...new Set(ALL_GROUP_TOOLS)];

// ---------------------------------------------------------------------------
// Constants - Profiles
// ---------------------------------------------------------------------------

const PROFILES: ProfileDef[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    icon: '\u{1F512}',
    description: 'Basic conversation only. No tools.',
    toolCount: 0,
    allow: [],
    deny: ['*'],
  },
  {
    id: 'coding',
    label: 'Coding',
    icon: '\u{1F4BB}',
    description: 'Code editing, file operations, git, exec.',
    toolCount: 25,
    allow: [
      'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'NotebookEdit',
      'exec.*', 'eval.*', 'process.*',
      'Task', 'Skill',
      'WebFetch', 'WebSearch',
      'mcp__memory__create_entities',
      'mcp__memory__create_relations',
      'mcp__memory__add_observations',
      'mcp__memory__search_nodes',
      'mcp__memory__open_nodes',
      'mcp__memory__read_graph',
      'mcp__memory__delete_entities',
      'mcp__memory__delete_relations',
      'mcp__memory__delete_observations',
    ],
    deny: [],
  },
  {
    id: 'messaging',
    label: 'Messaging',
    icon: '\u{1F4E8}',
    description: 'Channel management, message sending.',
    toolCount: 15,
    allow: [
      'channel.*', 'message.*', 'dm.*', 'group.*',
      'discord.*', 'telegram.*', 'slack.*', 'whatsapp.*',
      'WebFetch', 'WebSearch',
      'mcp__memory__search_nodes',
      'mcp__memory__open_nodes',
      'mcp__memory__read_graph',
    ],
    deny: [],
  },
  {
    id: 'full',
    label: 'Full',
    icon: '\u{1F680}',
    description: 'All tools enabled. Maximum capability.',
    toolCount: ALL_UNIQUE_TOOLS.length,
    allow: ['*'],
    deny: [],
  },
];

// ---------------------------------------------------------------------------
// Helper: check if a group is fully covered by allow list
// ---------------------------------------------------------------------------

function isGroupEnabled(groupTools: string[], allowList: string[]): boolean {
  if (allowList.includes('*')) return true;
  return groupTools.every((tool) => {
    // Check direct match
    if (allowList.includes(tool)) return true;
    // Check wildcard matches, e.g. allow "mcp__memory*" covers "mcp__memory__search_nodes"
    return allowList.some((pattern) => {
      if (!pattern.includes('*')) return false;
      const prefix = pattern.replace(/\*$/, '');
      return tool.startsWith(prefix);
    });
  });
}

// ---------------------------------------------------------------------------
// Styles (inline, tpe- prefix)
// ---------------------------------------------------------------------------

const tpeStyles = `
/* ── Container ── */
.tpe-container {
  padding: 1.5rem;
  height: 100%;
  overflow-y: auto;
  padding-bottom: 6rem;
}

.tpe-container::-webkit-scrollbar {
  width: 6px;
}

.tpe-container::-webkit-scrollbar-track {
  background: transparent;
}

.tpe-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.tpe-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* ── Back button ── */
.tpe-back {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0.375rem 0;
  margin-bottom: 1.25rem;
  transition: color 0.15s ease;
}

.tpe-back:hover {
  color: var(--text-primary, #fff);
}

.tpe-back svg {
  flex-shrink: 0;
}

/* ── Header ── */
.tpe-header {
  margin-bottom: 1.75rem;
}

.tpe-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.25rem;
}

.tpe-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
}

/* ── Section titles ── */
.tpe-section-title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary, #606080);
  margin: 0 0 1rem;
}

/* ── Profile Selector ── */
.tpe-profiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 2rem;
}

@media (max-width: 900px) {
  .tpe-profiles {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .tpe-profiles {
    grid-template-columns: 1fr;
  }
}

.tpe-profile-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  position: relative;
}

.tpe-profile-card:hover {
  border-color: rgba(99, 102, 241, 0.35);
  background: rgba(255, 255, 255, 0.04);
}

.tpe-profile-card:focus-visible {
  outline: 2px solid var(--accent-color, #6366f1);
  outline-offset: 2px;
}

.tpe-profile-card--active {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.08);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.12), inset 0 0 12px rgba(99, 102, 241, 0.04);
}

.tpe-profile-card--active:hover {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.12);
}

.tpe-profile-icon {
  font-size: 1.75rem;
  line-height: 1;
}

.tpe-profile-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.tpe-profile-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.35;
}

.tpe-profile-card--active .tpe-profile-desc {
  color: var(--text-secondary, #a0a0c0);
}

.tpe-profile-count {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  margin-top: auto;
}

.tpe-profile-card--active .tpe-profile-count {
  color: #818cf8;
}

/* ── Tool Group Toggles Grid ── */
.tpe-groups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.625rem;
  margin-bottom: 2rem;
}

@media (max-width: 600px) {
  .tpe-groups {
    grid-template-columns: 1fr;
  }
}

/* ── Allow / Deny Lists ── */
.tpe-lists {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-bottom: 2rem;
}

@media (max-width: 700px) {
  .tpe-lists {
    grid-template-columns: 1fr;
  }
}

.tpe-list-panel {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.25rem;
}

.tpe-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.tpe-list-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tpe-list-title-dot--allow {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
}

.tpe-list-title-dot--deny {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
}

.tpe-clear-btn {
  background: none;
  border: none;
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.tpe-clear-btn:hover {
  color: var(--text-primary, #fff);
  background: rgba(255, 255, 255, 0.06);
}

/* Tag input */
.tpe-tag-input-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.tpe-tag-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
  font-family: 'SF Mono', 'Consolas', monospace;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.tpe-tag-input:focus {
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.tpe-tag-input::placeholder {
  color: var(--text-tertiary, #606080);
  font-family: inherit;
}

.tpe-tag-add-btn {
  padding: 0.5rem 0.875rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.tpe-tag-add-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #fff);
}

/* Wildcard hint */
.tpe-hint {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.tpe-hint code {
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 0.625rem;
  padding: 0.0625rem 0.3125rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 3px;
  color: var(--text-secondary, #a0a0c0);
}

/* Tags */
.tpe-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  min-height: 2rem;
}

.tpe-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: 'SF Mono', 'Consolas', monospace;
  padding: 0.25rem 0.5rem;
  border-radius: 5px;
  transition: opacity 0.15s ease;
}

.tpe-tag--allow {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}

.tpe-tag--deny {
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
}

.tpe-tag-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.125rem;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.tpe-tag-remove:hover {
  opacity: 1;
}

.tpe-tags-empty {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  font-style: italic;
  padding: 0.5rem 0;
}

/* ── Info note ── */
.tpe-info-note {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  margin-bottom: 2rem;
}

.tpe-info-note svg {
  flex-shrink: 0;
  color: var(--accent-color, #6366f1);
}

/* ── Agent Override Banner ── */
.tpe-agent-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.125rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 10px;
  margin-bottom: 1.5rem;
}

.tpe-agent-banner-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.tpe-agent-banner-text {
  flex: 1;
}

.tpe-agent-banner-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #fbbf24;
  display: block;
  margin-bottom: 0.125rem;
}

.tpe-agent-banner-desc {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
}

.tpe-agent-reset-btn {
  padding: 0.375rem 0.75rem;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #fbbf24;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.tpe-agent-reset-btn:hover {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.5);
}

/* ── Save Bar ── */
.tpe-save-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: rgba(10, 10, 26, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 0 -1.5rem -1.5rem;
}

.tpe-save-bar--dirty {
  border-top-color: rgba(99, 102, 241, 0.25);
}

.tpe-unsaved {
  font-size: 0.8125rem;
  color: #fbbf24;
  margin-right: auto;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.tpe-unsaved-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fbbf24;
  animation: tpe-pulse 1.5s ease-in-out infinite;
}

@keyframes tpe-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.tpe-btn-discard {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.tpe-btn-discard:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #fff);
}

.tpe-btn-save {
  padding: 0.5rem 1.25rem;
  background: var(--accent-color, #6366f1);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.tpe-btn-save:hover:not(:disabled) {
  background: #4f46e5;
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.35);
}

.tpe-btn-save:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Disconnected state ── */
.tpe-disconnected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 3rem;
  color: var(--text-tertiary, #606080);
}

.tpe-disconnected-icon {
  margin-bottom: 1.5rem;
  opacity: 0.5;
}

.tpe-disconnected-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0 0.5rem;
}

.tpe-disconnected-desc {
  font-size: 0.875rem;
  color: var(--text-tertiary, #606080);
  max-width: 360px;
  line-height: 1.5;
  margin: 0;
}

/* ── Responsive save bar ── */
@media (max-width: 600px) {
  .tpe-save-bar {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tpe-unsaved {
    width: 100%;
  }

  .tpe-btn-discard,
  .tpe-btn-save {
    flex: 1;
    text-align: center;
  }
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolsPolicyEditor({ agentId, agentName, onBack }: ToolsPolicyEditorProps) {
  const { connected } = useGateway();
  const { gatewayConfig, patchGatewayConfig } = useGatewayConfig();

  // ---- Draft state ----
  const [profile, setProfile] = useState<ProfileId>('coding');
  const [allowList, setAllowList] = useState<string[]>([]);
  const [denyList, setDenyList] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Tag input refs
  const allowInputRef = useRef<HTMLInputElement>(null);
  const denyInputRef = useRef<HTMLInputElement>(null);
  const [allowInput, setAllowInput] = useState('');
  const [denyInput, setDenyInput] = useState('');

  // ---- Snapshot of initial values (for dirty detection and discard) ----
  const initialRef = useRef<{ profile: ProfileId; allow: string[]; deny: string[] }>({
    profile: 'coding',
    allow: [],
    deny: [],
  });

  // ---- Load config from gateway ----
  useEffect(() => {
    if (!gatewayConfig?._raw) return;

    let toolsConfig: { profile?: string; allow?: string[]; deny?: string[] } | undefined;

    if (agentId) {
      // Per-agent override: look up the agent in the list
      const agents = gatewayConfig.agents?.list;
      if (agents) {
        const agentRaw = gatewayConfig._raw?.agents as
          | { list?: Array<{ id: string; toolsPolicy?: { profile?: string; allow?: string[]; deny?: string[] } }> }
          | undefined;
        const agentEntry = agentRaw?.list?.find((a) => a.id === agentId);
        if (agentEntry?.toolsPolicy) {
          toolsConfig = agentEntry.toolsPolicy;
        }
      }
    } else {
      // Global tools config
      const raw = gatewayConfig._raw?.tools as
        | { profile?: string; allow?: string[]; deny?: string[] }
        | undefined;
      if (raw) {
        toolsConfig = raw;
      }
    }

    if (toolsConfig) {
      const p = (toolsConfig.profile ?? 'coding') as ProfileId;
      const a = toolsConfig.allow ?? [];
      const d = toolsConfig.deny ?? [];

      setProfile(p);
      setAllowList(a);
      setDenyList(d);
      initialRef.current = { profile: p, allow: [...a], deny: [...d] };
      setIsDirty(false);
    }
  }, [gatewayConfig, agentId]);

  // ---- Dirty detection ----
  useEffect(() => {
    const init = initialRef.current;
    const dirty =
      profile !== init.profile ||
      JSON.stringify(allowList) !== JSON.stringify(init.allow) ||
      JSON.stringify(denyList) !== JSON.stringify(init.deny);
    setIsDirty(dirty);
  }, [profile, allowList, denyList]);

  // ---- Profile selection ----
  const handleProfileSelect = useCallback((p: ProfileDef) => {
    setProfile(p.id);
    setAllowList([...p.allow]);
    setDenyList([...p.deny]);
  }, []);

  // ---- Group toggles ----
  const enabledGroups = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const group of TOOL_GROUPS) {
      map.set(group.name, isGroupEnabled(group.tools, allowList));
    }
    return map;
  }, [allowList]);

  const handleGroupToggle = useCallback(
    (groupName: string, enabled: boolean) => {
      const group = TOOL_GROUPS.find((g) => g.name === groupName);
      if (!group) return;

      if (enabled) {
        // Add all group tools to allow list (dedup)
        setAllowList((prev) => {
          const existing = new Set(prev);
          const additions = group.tools.filter((t) => !existing.has(t));
          if (additions.length === 0) return prev;
          return [...prev, ...additions];
        });
        // Remove group tools from deny list
        const toolSet = new Set(group.tools);
        setDenyList((prev) => prev.filter((t) => !toolSet.has(t)));
      } else {
        // Remove all group tools from allow list
        const toolSet = new Set(group.tools);
        setAllowList((prev) => {
          const filtered = prev.filter((t) => !toolSet.has(t));
          // If we had wildcard, remove it too
          if (prev.includes('*')) {
            return filtered.filter((t) => t !== '*');
          }
          return filtered;
        });
      }
    },
    []
  );

  // ---- Allow / Deny list management ----
  const addToAllow = useCallback((tool: string) => {
    const trimmed = tool.trim();
    if (!trimmed) return;
    setAllowList((prev) => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed];
    });
  }, []);

  const removeFromAllow = useCallback((tool: string) => {
    setAllowList((prev) => prev.filter((t) => t !== tool));
  }, []);

  const clearAllow = useCallback(() => {
    setAllowList([]);
  }, []);

  const addToDeny = useCallback((tool: string) => {
    const trimmed = tool.trim();
    if (!trimmed) return;
    setDenyList((prev) => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed];
    });
  }, []);

  const removeFromDeny = useCallback((tool: string) => {
    setDenyList((prev) => prev.filter((t) => t !== tool));
  }, []);

  const clearDeny = useCallback(() => {
    setDenyList([]);
  }, []);

  // ---- Tag input handlers ----
  const handleAllowKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addToAllow(allowInput);
        setAllowInput('');
      }
    },
    [allowInput, addToAllow]
  );

  const handleDenyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addToDeny(denyInput);
        setDenyInput('');
      }
    },
    [denyInput, addToDeny]
  );

  const handleAllowAddClick = useCallback(() => {
    addToAllow(allowInput);
    setAllowInput('');
    allowInputRef.current?.focus();
  }, [allowInput, addToAllow]);

  const handleDenyAddClick = useCallback(() => {
    addToDeny(denyInput);
    setDenyInput('');
    denyInputRef.current?.focus();
  }, [denyInput, addToDeny]);

  // ---- Reset to defaults (for per-agent overrides) ----
  const resetToDefaults = useCallback(() => {
    const codingProfile = PROFILES.find((p) => p.id === 'coding');
    if (codingProfile) {
      setProfile(codingProfile.id);
      setAllowList([...codingProfile.allow]);
      setDenyList([...codingProfile.deny]);
    }
  }, []);

  // ---- Discard ----
  const handleDiscard = useCallback(() => {
    const init = initialRef.current;
    setProfile(init.profile);
    setAllowList([...init.allow]);
    setDenyList([...init.deny]);
    setSaveError(null);
  }, []);

  // ---- Save ----
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    try {
      if (agentId) {
        // Per-agent override: patch the agent's toolsPolicy
        const agents = gatewayConfig._raw?.agents as
          | { list?: Array<Record<string, unknown>> }
          | undefined;
        const updatedList = (agents?.list ?? []).map((a) => {
          if ((a as { id?: string }).id === agentId) {
            return {
              ...a,
              toolsPolicy: { profile, allow: allowList, deny: denyList },
            };
          }
          return a;
        });

        await patchGatewayConfig({
          agents: {
            ...gatewayConfig.agents,
            list: updatedList as Array<{ id: string; name?: string; model?: string; workspace?: string }>,
          },
        });
      } else {
        // Global tools config
        await patchGatewayConfig({
          tools: { profile, allow: allowList, deny: denyList },
        });
      }

      // Update initial snapshot to new values
      initialRef.current = {
        profile,
        allow: [...allowList],
        deny: [...denyList],
      };
      setIsDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save tools policy');
    } finally {
      setSaving(false);
    }
  }, [agentId, profile, allowList, denyList, gatewayConfig, patchGatewayConfig]);

  // ---- Disconnected state ----
  if (!connected) {
    return (
      <div className="tpe-disconnected">
        <style>{tpeStyles}</style>
        {onBack && (
          <button className="tpe-back" onClick={onBack} type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        )}
        <div className="tpe-disconnected-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
          </svg>
        </div>
        <h3 className="tpe-disconnected-title">Gateway Not Connected</h3>
        <p className="tpe-disconnected-desc">
          Start the gateway to manage tools policy. Configuration requires an active gateway connection.
        </p>
      </div>
    );
  }

  // ---- Render ----
  return (
    <div className="tpe-container">
      <style>{tpeStyles}</style>

      {/* Back button */}
      {onBack && (
        <button className="tpe-back" onClick={onBack} type="button">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      )}

      {/* Header */}
      <header className="tpe-header">
        <h2 className="tpe-title">Tools Policy</h2>
        <p className="tpe-subtitle">
          Configure which tools are available{agentId ? ` for ${agentName ?? agentId}` : ' globally'}
        </p>
      </header>

      {/* Agent Override Banner */}
      {agentId && (
        <div className="tpe-agent-banner">
          <span className="tpe-agent-banner-icon">{'\u{1F464}'}</span>
          <div className="tpe-agent-banner-text">
            <span className="tpe-agent-banner-label">
              Overrides for agent: {agentName ?? agentId}
            </span>
            <span className="tpe-agent-banner-desc">
              These settings override the global tools policy for this agent only.
            </span>
          </div>
          <button
            className="tpe-agent-reset-btn"
            onClick={resetToDefaults}
            type="button"
          >
            Reset to defaults
          </button>
        </div>
      )}

      {/* Error banner */}
      {saveError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            padding: '0.625rem 1rem',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            marginBottom: '1rem',
          }}
        >
          {saveError}
        </div>
      )}

      {/* ════════════════════════════════════════════
          Section 1: Profile Selector
          ════════════════════════════════════════════ */}
      <h3 className="tpe-section-title">Profile</h3>
      <div className="tpe-profiles">
        {PROFILES.map((p) => (
          <div
            key={p.id}
            className={`tpe-profile-card ${profile === p.id ? 'tpe-profile-card--active' : ''}`}
            onClick={() => handleProfileSelect(p)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleProfileSelect(p);
              }
            }}
            role="radio"
            aria-checked={profile === p.id}
            tabIndex={0}
          >
            <span className="tpe-profile-icon">{p.icon}</span>
            <span className="tpe-profile-name">{p.label}</span>
            <span className="tpe-profile-desc">{p.description}</span>
            <span className="tpe-profile-count">
              {p.toolCount === 0 ? 'No tools' : `${p.toolCount} tools`}
            </span>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          Section 2: Tool Group Toggles
          ════════════════════════════════════════════ */}
      <h3 className="tpe-section-title">Tool Groups</h3>
      <div className="tpe-groups">
        {TOOL_GROUPS.map((group) => (
          <ToolGroupToggle
            key={group.name}
            name={group.name}
            label={group.label}
            description={group.description}
            icon={group.icon}
            toolCount={group.tools.length}
            enabled={enabledGroups.get(group.name) ?? false}
            onChange={(enabled) => handleGroupToggle(group.name, enabled)}
          />
        ))}
      </div>

      {/* ════════════════════════════════════════════
          Section 3: Allow / Deny Lists
          ════════════════════════════════════════════ */}
      <h3 className="tpe-section-title">Allow / Deny Lists</h3>

      <div className="tpe-info-note">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        Deny takes priority over allow. A tool in both lists will be denied.
      </div>

      <div className="tpe-lists">
        {/* Allow List */}
        <div className="tpe-list-panel">
          <div className="tpe-list-header">
            <span className="tpe-list-title">
              <span className="tpe-list-title-dot--allow" />
              Allow List
            </span>
            {allowList.length > 0 && (
              <button className="tpe-clear-btn" onClick={clearAllow} type="button">
                Clear all
              </button>
            )}
          </div>

          <div className="tpe-tag-input-row">
            <input
              ref={allowInputRef}
              className="tpe-tag-input"
              type="text"
              placeholder="Tool name or pattern..."
              value={allowInput}
              onChange={(e) => setAllowInput(e.target.value)}
              onKeyDown={handleAllowKeyDown}
              aria-label="Add tool to allow list"
            />
            <button
              className="tpe-tag-add-btn"
              onClick={handleAllowAddClick}
              type="button"
              disabled={!allowInput.trim()}
            >
              Add
            </button>
          </div>

          <div className="tpe-hint">
            Supports wildcards: <code>fs.*</code>, <code>exec.*</code>, <code>*</code>
          </div>

          <div className="tpe-tags">
            {allowList.length === 0 ? (
              <span className="tpe-tags-empty">No tools in allow list</span>
            ) : (
              allowList.map((tool) => (
                <span key={tool} className="tpe-tag tpe-tag--allow">
                  {tool}
                  <button
                    className="tpe-tag-remove"
                    onClick={() => removeFromAllow(tool)}
                    type="button"
                    aria-label={`Remove ${tool} from allow list`}
                  >
                    &times;
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Deny List */}
        <div className="tpe-list-panel">
          <div className="tpe-list-header">
            <span className="tpe-list-title">
              <span className="tpe-list-title-dot--deny" />
              Deny List
            </span>
            {denyList.length > 0 && (
              <button className="tpe-clear-btn" onClick={clearDeny} type="button">
                Clear all
              </button>
            )}
          </div>

          <div className="tpe-tag-input-row">
            <input
              ref={denyInputRef}
              className="tpe-tag-input"
              type="text"
              placeholder="Tool name or pattern..."
              value={denyInput}
              onChange={(e) => setDenyInput(e.target.value)}
              onKeyDown={handleDenyKeyDown}
              aria-label="Add tool to deny list"
            />
            <button
              className="tpe-tag-add-btn"
              onClick={handleDenyAddClick}
              type="button"
              disabled={!denyInput.trim()}
            >
              Add
            </button>
          </div>

          <div className="tpe-hint">
            Supports wildcards: <code>fs.*</code>, <code>exec.*</code>, <code>*</code>
          </div>

          <div className="tpe-tags">
            {denyList.length === 0 ? (
              <span className="tpe-tags-empty">No tools in deny list</span>
            ) : (
              denyList.map((tool) => (
                <span key={tool} className="tpe-tag tpe-tag--deny">
                  {tool}
                  <button
                    className="tpe-tag-remove"
                    onClick={() => removeFromDeny(tool)}
                    type="button"
                    aria-label={`Remove ${tool} from deny list`}
                  >
                    &times;
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          Sticky Save Bar
          ════════════════════════════════════════════ */}
      <div className={`tpe-save-bar ${isDirty ? 'tpe-save-bar--dirty' : ''}`}>
        {isDirty && (
          <span className="tpe-unsaved">
            <span className="tpe-unsaved-dot" />
            Unsaved changes
          </span>
        )}
        <button
          className="tpe-btn-discard"
          onClick={handleDiscard}
          disabled={!isDirty || saving}
          type="button"
        >
          Discard
        </button>
        <button
          className="tpe-btn-save"
          onClick={handleSave}
          disabled={!isDirty || saving}
          type="button"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default ToolsPolicyEditor;
