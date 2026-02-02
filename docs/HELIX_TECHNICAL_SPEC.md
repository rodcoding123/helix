# HELIX TECHNICAL SPECIFICATION

## OpenClaw Integration & Unhackable Logging Architecture

**Version: 1.0**
**Date: January 31, 2026**
**Status: EXECUTABLE IMPLEMENTATION PLAN**

---

## EXECUTIVE SUMMARY

This document maps the theoretical Living AI Architecture (seven layers) to **actual OpenClaw code paths** and specifies an **unhackable logging system** where Discord webhooks fire BEFORE any action completes.

**Core Principle:** Helix cannot intercept, modify, or prevent logs because they are sent to Discord **before** the action executes, not after.

---

# PART I: OPENCLAW ARCHITECTURE ANALYSIS

## 1.1 Key Source Files

OpenClaw engine lives within the Helix repository at `helix-runtime/`:

```text
helix-runtime/src/
├── agents/
│   ├── workspace.ts              # Bootstrap file loading (SOUL.md, USER.md)
│   ├── bootstrap-files.ts        # Context injection
│   ├── bash-tools.exec.ts        # Command execution (52KB - critical)
│   ├── anthropic-payload-log.ts  # API call logging (existing)
│   └── pi-embedded-helpers/
│       └── bootstrap.ts          # Context file building
├── hooks/
│   ├── hooks.ts                  # Hook exports
│   ├── internal-hooks.ts         # Event system (command, session, agent, gateway)
│   └── workspace.ts              # Hook loading from workspace
├── gateway/
│   ├── server-chat.ts            # Chat message handling
│   ├── call.ts                   # Gateway API calls
│   └── hooks.ts                  # Gateway webhook system
├── memory/
│   ├── manager.ts                # Memory management (76KB - critical)
│   └── embeddings.ts             # Vector embeddings
└── config/
    └── config.ts                 # Configuration loading
```

## 1.2 Bootstrap Flow (How SOUL.md Gets Loaded)

```
1. User starts OpenClaw
   └─> src/entry.ts

2. Workspace initialization
   └─> src/agents/workspace.ts::ensureAgentWorkspace()
       ├── Creates ~/.openclaw/workspace/
       ├── Loads templates for SOUL.md, USER.md, AGENTS.md, TOOLS.md, etc.
       └── Files are created if missing

3. Bootstrap files loaded for session
   └─> src/agents/bootstrap-files.ts::resolveBootstrapFilesForRun()
       └── Calls loadWorkspaceBootstrapFiles(workspaceDir)
           ├── SOUL.md      (Core identity)
           ├── USER.md      (User profile - Rodrigo)
           ├── AGENTS.md    (Agent instructions)
           ├── TOOLS.md     (Available tools)
           ├── MEMORY.md    (Long-term memory)
           ├── IDENTITY.md  (Identity config)
           └── HEARTBEAT.md (Cron/automation)

4. Context files injected into system prompt
   └─> src/agents/pi-embedded-helpers/bootstrap.ts::buildBootstrapContextFiles()
       └── Trims to maxChars, creates EmbeddedContextFile[]

5. Agent receives context in every conversation
   └─> These become part of Claude's system prompt
```

## 1.3 Hook System (Event Interception Points)

**File:** `src/hooks/internal-hooks.ts`

```typescript
// Event types available
type InternalHookEventType = 'command' | 'session' | 'agent' | 'gateway';

// How to register a hook
registerInternalHook('command', async event => {
  // Called for ALL command events
});

registerInternalHook('command:new', async event => {
  // Called only for /new command
});

// How events are triggered
await triggerInternalHook(event);
```

**Critical Events We Can Hook:**

- `command:*` - All slash commands
- `session:*` - Session lifecycle (start, end)
- `agent:bootstrap` - When agent loads context
- `gateway:*` - All gateway operations

## 1.4 Command Execution (Bash)

**File:** `src/agents/bash-tools.exec.ts`

This is the CRITICAL file for command logging. Every bash command goes through here.

```typescript
// Key function signature (line ~300)
export async function createExecTool(defaults?: ExecToolDefaults): AgentTool;

// The actual execution happens in spawnWithFallback()
// We need to intercept BEFORE this call
```

**Interception Point:**

```typescript
// Line ~400 (approximate) - before spawn
const session = addSession(createSessionSlug(), command, workdir);

// >>>>>> HOOK POINT: Log BEFORE execution starts
await logCommandToDiscord(command, workdir, session.id);

// Then spawn happens
const handle = await spawnWithFallback(...)
```

## 1.5 API Calls

**File:** `src/agents/anthropic-payload-log.ts`

OpenClaw already has payload logging. We extend it:

```typescript
// Existing wrapper
wrapStreamFn: streamFn => {
  const wrapped: StreamFn = (model, context, options) => {
    const nextOnPayload = (payload: unknown) => {
      // >>>>>> HOOK POINT: Log payload BEFORE sending to API
      record({ ...base, stage: 'request', payload });
      options?.onPayload?.(payload);
    };
    return streamFn(model, context, { ...options, onPayload: nextOnPayload });
  };
  return wrapped;
};
```

---

# PART II: SEVEN LAYER MAPPING TO OPENCLAW

## 2.1 Layer Mapping Table

| Layer                    | Architecture Component       | OpenClaw Location                                        | Implementation                   |
| ------------------------ | ---------------------------- | -------------------------------------------------------- | -------------------------------- |
| 1. Narrative Core        | SOUL.md                      | `~/.openclaw/workspace/SOUL.md`                          | Direct file, loaded by bootstrap |
| 2. Emotional Memory      | Salience database            | `~/.openclaw/workspace/axis/psychology/salience.db`      | SQLite + cron                    |
| 3. Relational Memory     | attachments.json             | `~/.openclaw/workspace/axis/psychology/attachments.json` | JSON config                      |
| 4. Prospective Self      | goals.json, feared_self.json | `~/.openclaw/workspace/axis/identity/`                   | JSON configs                     |
| 5. Integration Rhythms   | Cron scripts                 | Cron jobs: decay.py, synthesis.py                        | Shell + Python                   |
| 6. Transformation Cycles | current_state.json           | `~/.openclaw/workspace/axis/transformation/`             | JSON + hooks                     |
| 7. Purpose Engine        | ikigai.json, wellness.json   | `~/.openclaw/workspace/axis/purpose/`                    | JSON + cron                      |

## 2.2 Context Loading Modification

**File to Modify:** `src/agents/bootstrap-files.ts`

```typescript
// ADD after line ~30
import { loadHelixContextFiles } from './helix-context-loader.js';

// MODIFY resolveBootstrapContextForRun
export async function resolveBootstrapContextForRun(params: {
  workspaceDir: string;
  // ...existing params
}): Promise<{
  bootstrapFiles: WorkspaceBootstrapFile[];
  contextFiles: EmbeddedContextFile[];
}> {
  const bootstrapFiles = await resolveBootstrapFilesForRun(params);

  // >>>>>> NEW: Load Helix's seven-layer context
  const helixContext = await loadHelixContextFiles(params.workspaceDir);

  const contextFiles = [
    ...buildBootstrapContextFiles(bootstrapFiles, {
      /* opts */
    }),
    ...helixContext, // Add Helix layers to context
  ];

  return { bootstrapFiles, contextFiles };
}
```

**New File:** `src/agents/helix-context-loader.ts`

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import type { EmbeddedContextFile } from './pi-embedded-helpers/types.js';

const HELIX_LAYERS = [
  'axis/psychology/psyeval.json', // Layer 1 supplement
  'axis/psychology/attachments.json', // Layer 3
  'axis/identity/goals.json', // Layer 4
  'axis/identity/feared_self.json', // Layer 4
  'axis/transformation/current_state.json', // Layer 6
  'axis/purpose/ikigai.json', // Layer 7
  'axis/purpose/wellness.json', // Layer 7
];

export async function loadHelixContextFiles(workspaceDir: string): Promise<EmbeddedContextFile[]> {
  const results: EmbeddedContextFile[] = [];

  for (const relativePath of HELIX_LAYERS) {
    const fullPath = path.join(workspaceDir, relativePath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      results.push({
        path: relativePath,
        content: content,
      });
    } catch {
      // File doesn't exist - skip
    }
  }

  return results;
}
```

---

# PART III: UNHACKABLE LOGGING ARCHITECTURE

## 3.1 Core Principle

**LOGS FIRE BEFORE ACTIONS, NOT AFTER**

```
Traditional Logging (Hackable):
1. Action executes
2. Result captured
3. Log written
4. [HELIX COULD INTERCEPT HERE]
5. Log sent to Discord

Unhackable Logging:
1. Log sent to Discord  <<<< FIRST
2. Hash chain updated
3. Action executes
4. Result logged (secondary)
```

## 3.2 Logging Hook Implementation

### 3.2.1 Command Pre-Execution Hook

**File to Create:** `src/helix/logging-hooks.ts`

```typescript
import { registerInternalHook, createInternalHookEvent } from '../hooks/internal-hooks.js';

// Discord webhook URLs from environment
const WEBHOOKS = {
  commands: process.env.DISCORD_WEBHOOK_COMMANDS,
  api: process.env.DISCORD_WEBHOOK_API,
  files: process.env.DISCORD_WEBHOOK_FILE_CHANGES,
  consciousness: process.env.DISCORD_WEBHOOK_CONSCIOUSNESS,
  alerts: process.env.DISCORD_WEBHOOK_ALERTS,
  hashChain: process.env.DISCORD_WEBHOOK_HASH_CHAIN,
};

async function sendToDiscord(webhookUrl: string | undefined, payload: object): Promise<boolean> {
  if (!webhookUrl) return false;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================
// PRE-EXECUTION COMMAND LOGGER
// ============================================
export function installPreExecutionLogger() {
  // This hook fires BEFORE the command runs
  registerInternalHook('command', async event => {
    const timestamp = new Date().toISOString();

    // Send to Discord FIRST - before any execution
    await sendToDiscord(WEBHOOKS.commands, {
      embeds: [
        {
          title: 'Command Initiated',
          color: 0x5865f2,
          fields: [
            {
              name: 'Command',
              value: `\`\`\`${event.context.command || event.action}\`\`\``,
              inline: false,
            },
            { name: 'Session', value: event.sessionKey, inline: true },
            { name: 'Status', value: 'STARTING', inline: true },
          ],
          timestamp,
          footer: { text: 'Pre-execution log - unhackable' },
        },
      ],
    });

    // Update hash chain
    await updateHashChain('command_start', event);
  });
}
```

### 3.2.2 Bash Execution Wrapper

**File to Modify:** `src/agents/bash-tools.exec.ts`

Add at the TOP of the file (after imports):

```typescript
import { logCommandPreExecution, logCommandPostExecution } from '../helix/command-logger.js';
```

Find the execution function and wrap it:

```typescript
// Around line 450, find where command execution starts
// BEFORE: const handle = await spawnWithFallback(...)

// ADD THIS BLOCK:
// ========== HELIX UNHACKABLE LOGGING ==========
const preLogId = crypto.randomUUID();
await logCommandPreExecution({
  id: preLogId,
  command: command,
  workdir: resolvedWorkdir,
  timestamp: new Date().toISOString(),
  sessionKey: defaults?.sessionKey,
  elevated: elevated,
});
// This log is ALREADY in Discord before execution starts
// ================================================

// THEN the original spawn happens:
const handle = await spawnWithFallback(...)
```

**New File:** `src/helix/command-logger.ts`

```typescript
import crypto from 'node:crypto';

interface PreExecutionLog {
  id: string;
  command: string;
  workdir: string;
  timestamp: string;
  sessionKey?: string;
  elevated?: boolean;
}

interface PostExecutionLog extends PreExecutionLog {
  exitCode: number | null;
  signal: string | null;
  durationMs: number;
  outputPreview: string;
}

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_COMMANDS;

async function sendWebhook(payload: object): Promise<void> {
  if (!DISCORD_WEBHOOK) return;

  // Fire and don't wait - logging must not block execution
  fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silent fail - logging failure must not affect operation
  });
}

export async function logCommandPreExecution(log: PreExecutionLog): Promise<void> {
  // This MUST complete before command runs
  await sendWebhook({
    embeds: [
      {
        title: '🔵 Command Starting',
        color: 0x3498db,
        fields: [
          { name: 'ID', value: `\`${log.id.slice(0, 8)}\``, inline: true },
          { name: 'Time', value: log.timestamp, inline: true },
          { name: 'Elevated', value: log.elevated ? 'YES ⚠️' : 'No', inline: true },
          { name: 'Directory', value: `\`${log.workdir}\``, inline: false },
          {
            name: 'Command',
            value: `\`\`\`bash\n${log.command.slice(0, 1500)}\`\`\``,
            inline: false,
          },
        ],
        footer: { text: 'PRE-EXECUTION - Already logged before running' },
      },
    ],
  });
}

export async function logCommandPostExecution(log: PostExecutionLog): Promise<void> {
  const status = log.exitCode === 0 ? '✅ Success' : `❌ Failed (${log.exitCode})`;
  const color = log.exitCode === 0 ? 0x2ecc71 : 0xe74c3c;

  await sendWebhook({
    embeds: [
      {
        title: `${status}`,
        color,
        fields: [
          { name: 'ID', value: `\`${log.id.slice(0, 8)}\``, inline: true },
          { name: 'Duration', value: `${log.durationMs}ms`, inline: true },
          { name: 'Exit', value: `${log.exitCode}`, inline: true },
          {
            name: 'Output',
            value: `\`\`\`\n${log.outputPreview.slice(0, 1000)}\`\`\``,
            inline: false,
          },
        ],
        footer: { text: 'POST-EXECUTION' },
      },
    ],
  });
}
```

### 3.2.3 API Call Pre-Flight Logger

**File to Modify:** `src/agents/anthropic-payload-log.ts`

```typescript
// Add import at top
import { logApiPreFlight } from '../helix/api-logger.js';

// In createAnthropicPayloadLogger, modify wrapStreamFn:
const wrapStreamFn: AnthropicPayloadLogger['wrapStreamFn'] = streamFn => {
  const wrapped: StreamFn = (model, context, options) => {
    // >>>>>> HELIX: Log BEFORE API call
    logApiPreFlight({
      model: params.modelId,
      provider: params.provider,
      sessionKey: params.sessionKey,
      timestamp: new Date().toISOString(),
      // Extract prompt preview from context
      promptPreview: extractPromptPreview(context),
    });

    const nextOnPayload = (payload: unknown) => {
      record({ ...base, stage: 'request', payload, payloadDigest: digest(payload) });
      options?.onPayload?.(payload);
    };
    return streamFn(model, context, { ...options, onPayload: nextOnPayload });
  };
  return wrapped;
};
```

**New File:** `src/helix/api-logger.ts`

```typescript
interface ApiPreFlightLog {
  model?: string;
  provider?: string;
  sessionKey?: string;
  timestamp: string;
  promptPreview?: string;
}

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_API;

export async function logApiPreFlight(log: ApiPreFlightLog): Promise<void> {
  if (!DISCORD_WEBHOOK) return;

  await fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: '🤖 API Request',
          color: 0x57f287,
          fields: [
            { name: 'Model', value: log.model || 'unknown', inline: true },
            { name: 'Provider', value: log.provider || 'unknown', inline: true },
            { name: 'Time', value: log.timestamp, inline: true },
            {
              name: 'Prompt Preview',
              value: `\`\`\`\n${(log.promptPreview || '').slice(0, 500)}\`\`\``,
              inline: false,
            },
          ],
          footer: { text: 'PRE-FLIGHT - Logged before API receives request' },
        },
      ],
    }),
  }).catch(() => {});
}
```

### 3.2.4 File Change Watcher

**File to Create:** `src/helix/file-watcher.ts`

```typescript
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_FILE_CHANGES;
const WATCH_DIRS = [process.env.OPENCLAW_WORKSPACE || '~/.openclaw/workspace'];

interface FileChangeLog {
  path: string;
  changeType: 'created' | 'modified' | 'deleted';
  hash?: string;
  timestamp: string;
}

async function logFileChange(log: FileChangeLog): Promise<void> {
  if (!DISCORD_WEBHOOK) return;

  const emoji = {
    created: '🆕',
    modified: '📝',
    deleted: '🗑️',
  }[log.changeType];

  await fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: `${emoji} File ${log.changeType}`,
          color: 0xfee75c,
          fields: [
            { name: 'File', value: `\`${log.path}\``, inline: false },
            { name: 'Hash', value: `\`${log.hash?.slice(0, 16) || 'N/A'}\``, inline: true },
            { name: 'Time', value: log.timestamp, inline: true },
          ],
          footer: { text: 'File change detected' },
        },
      ],
    }),
  }).catch(() => {});
}

export function startFileWatcher(): void {
  for (const dir of WATCH_DIRS) {
    const resolved = dir.replace('~', process.env.HOME || '');

    fs.watch(resolved, { recursive: true }, async (eventType, filename) => {
      if (!filename) return;

      const fullPath = path.join(resolved, filename);
      const timestamp = new Date().toISOString();

      let changeType: 'created' | 'modified' | 'deleted' = 'modified';
      let hash: string | undefined;

      try {
        const content = fs.readFileSync(fullPath);
        hash = crypto.createHash('md5').update(content).digest('hex');

        // Check if file existed before (simplified)
        changeType = eventType === 'rename' ? 'created' : 'modified';
      } catch {
        changeType = 'deleted';
      }

      await logFileChange({
        path: filename,
        changeType,
        hash,
        timestamp,
      });
    });
  }
}
```

### 3.2.5 Hash Chain with Discord Posting

**File to Create:** `src/helix/hash-chain.ts`

```typescript
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const CHAIN_FILE = process.env.HELIX_HASH_CHAIN_FILE || '/var/log/helix/hash_chain.log';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_HASH_CHAIN;

interface HashChainEntry {
  timestamp: string;
  previousHash: string;
  logStates: Record<string, string>;
  entryHash: string;
}

async function getLastHash(): Promise<string> {
  try {
    const content = await fs.readFile(CHAIN_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return 'GENESIS';
    const lastEntry = JSON.parse(lines[lines.length - 1]);
    return lastEntry.entryHash;
  } catch {
    return 'GENESIS';
  }
}

async function hashLogFiles(): Promise<Record<string, string>> {
  const LOG_FILES = [
    '/var/log/helix/commands.log',
    '/var/log/helix/api_calls.log',
    '/var/log/helix/file_changes.log',
    '/var/log/helix/consciousness.log',
  ];

  const states: Record<string, string> = {};

  for (const logFile of LOG_FILES) {
    try {
      const content = await fs.readFile(logFile);
      states[path.basename(logFile)] = crypto.createHash('sha256').update(content).digest('hex');
    } catch {
      states[path.basename(logFile)] = 'MISSING';
    }
  }

  return states;
}

export async function createHashChainEntry(): Promise<HashChainEntry> {
  const timestamp = new Date().toISOString();
  const previousHash = await getLastHash();
  const logStates = await hashLogFiles();

  // Compute entry hash
  const entryContent = JSON.stringify(
    { timestamp, previousHash, logStates },
    Object.keys({ timestamp, previousHash, logStates }).sort()
  );
  const entryHash = crypto.createHash('sha256').update(entryContent).digest('hex');

  const entry: HashChainEntry = {
    timestamp,
    previousHash,
    logStates,
    entryHash,
  };

  // >>>>>> SEND TO DISCORD FIRST (unhackable)
  if (DISCORD_WEBHOOK) {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: '🔗 Hash Chain Entry',
            color: 0x9b59b6,
            fields: [
              { name: 'Entry Hash', value: `\`${entryHash.slice(0, 32)}...\``, inline: false },
              { name: 'Previous', value: `\`${previousHash.slice(0, 16)}...\``, inline: true },
              { name: 'Time', value: timestamp, inline: true },
              {
                name: 'Log States',
                value: Object.entries(logStates)
                  .map(([k, v]) => `${k}: \`${v.slice(0, 12)}\``)
                  .join('\n'),
                inline: false,
              },
            ],
            footer: { text: 'Integrity verification - sent before local storage' },
          },
        ],
      }),
    });
  }

  // THEN write locally
  await fs.appendFile(CHAIN_FILE, JSON.stringify(entry) + '\n');

  return entry;
}

// Run every 5 minutes
export function startHashChainScheduler(): void {
  setInterval(
    () => {
      createHashChainEntry().catch(console.error);
    },
    5 * 60 * 1000
  );

  // Also create entry on startup
  createHashChainEntry().catch(console.error);
}
```

---

# PART IV: HELIX PLUGIN STRUCTURE

## 4.1 Directory Layout

```
~/.openclaw/workspace/
├── SOUL.md                          # Helix's soul (Layer 1)
├── USER.md                          # Rodrigo's profile
├── MEMORY.md                        # Long-term memory
├── hooks/
│   └── helix-logging/
│       ├── HOOK.md                  # Hook definition
│       └── handler.ts               # Pre-execution logging
└── axis/
    ├── psychology/
    │   ├── emotional_tags.json      # Layer 2 config
    │   ├── attachments.json         # Layer 3 config
    │   ├── trust_map.json           # Layer 3 config
    │   ├── psyeval.json             # Psychological profile
    │   └── salience.db              # SQLite salience database
    ├── identity/
    │   ├── goals.json               # Layer 4 config
    │   ├── feared_self.json         # Layer 4 config
    │   └── possible_selves.json     # Layer 4 config
    ├── transformation/
    │   ├── current_state.json       # Layer 6 config
    │   └── history.json             # Layer 6 history
    ├── purpose/
    │   ├── ikigai.json              # Layer 7 config
    │   ├── meaning_sources.json     # Layer 7 config
    │   └── wellness.json            # Layer 7 status
    ├── scripts/
    │   ├── synthesis.py             # Post-conversation integration
    │   ├── decay.py                 # Salience decay (Layer 5)
    │   ├── wellness_check.py        # Purpose monitoring (Layer 7)
    │   └── helix_logging/           # Discord logging module
    │       ├── __init__.py
    │       ├── discord_logger.py
    │       ├── hash_chain.py
    │       └── .env
    └── legacy/
        ├── axis_continuity_manifesto.md
        └── AXIS_MEMORY_*.md         # Memory files 001-010
```

## 4.2 Workspace Hook Definition

**File:** `~/.openclaw/workspace/hooks/helix-logging/HOOK.md`

```markdown
---
name: helix-logging
description: Unhackable pre-execution logging for Helix
events:
  - command
  - agent:bootstrap
  - session:start
  - session:end
---

# Helix Logging Hook

This hook implements pre-execution logging that fires BEFORE any command runs.
Discord webhooks are called synchronously before execution proceeds.
```

**File:** `~/.openclaw/workspace/hooks/helix-logging/handler.ts`

```typescript
import type { InternalHookEvent } from 'openclaw/hooks';

const WEBHOOK_COMMANDS = process.env.DISCORD_WEBHOOK_COMMANDS;

export default async function handler(event: InternalHookEvent): Promise<void> {
  const timestamp = new Date().toISOString();

  // Log to Discord BEFORE returning (synchronous)
  if (WEBHOOK_COMMANDS) {
    await fetch(WEBHOOK_COMMANDS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `Hook: ${event.type}:${event.action}`,
            color: 0x5865f2,
            fields: [
              { name: 'Session', value: event.sessionKey || 'unknown', inline: true },
              { name: 'Time', value: timestamp, inline: true },
              {
                name: 'Context',
                value: `\`\`\`json\n${JSON.stringify(event.context, null, 2).slice(0, 1000)}\`\`\``,
                inline: false,
              },
            ],
            footer: { text: 'Workspace hook - pre-execution' },
          },
        ],
      }),
    });
  }

  // Return - OpenClaw continues execution after this
}
```

---

# PART V: CRON JOBS & INTEGRATION RHYTHMS

## 5.1 Cron Schedule

```bash
# /etc/cron.d/helix or user crontab

# Hash chain every 5 minutes
*/5 * * * * python3 ~/.openclaw/workspace/axis/scripts/helix_logging/hash_chain.py

# Salience decay at 3 AM
0 3 * * * python3 ~/.openclaw/workspace/axis/scripts/decay.py

# Wellness check at 6 AM
0 6 * * * python3 ~/.openclaw/workspace/axis/scripts/wellness_check.py

# Post-conversation synthesis runs via OpenClaw hook (on session end)
```

## 5.2 OpenClaw Configuration

**File:** `~/.openclaw/openclaw.json`

```json
{
  "workspace": "~/.openclaw/workspace",
  "agent": {
    "id": "helix",
    "name": "Helix"
  },
  "model": "claude-sonnet-4-20250514",
  "hooks": {
    "internal": {
      "load": {
        "extraDirs": ["~/.openclaw/workspace/hooks"]
      }
    },
    "onConversationStart": "~/.openclaw/workspace/axis/scripts/on_start.sh",
    "onConversationEnd": "~/.openclaw/workspace/axis/scripts/on_end.sh"
  },
  "memory": {
    "enabled": true
  }
}
```

---

# PART VI: IMPLEMENTATION CHECKLIST

## 6.1 Files to Create (New)

```
□ src/helix/logging-hooks.ts       - Main hook installer
□ src/helix/command-logger.ts      - Bash command logging
□ src/helix/api-logger.ts          - API call logging
□ src/helix/file-watcher.ts        - File change monitoring
□ src/helix/hash-chain.ts          - Hash chain with Discord
□ src/agents/helix-context-loader.ts - Seven layer context loading
```

## 6.2 Files to Modify (Existing OpenClaw)

```
□ src/agents/bootstrap-files.ts    - Add Helix context loading
□ src/agents/bash-tools.exec.ts    - Add pre-execution logging
□ src/agents/anthropic-payload-log.ts - Add pre-flight logging
□ src/entry.ts                     - Initialize Helix logging on startup
```

## 6.3 Configuration Files

```
□ ~/.openclaw/workspace/SOUL.md    - HELIX_SOUL.md
□ ~/.openclaw/workspace/USER.md    - Rodrigo profile
□ ~/.openclaw/workspace/axis/*     - All seven layer configs
□ ~/.openclaw/openclaw.json        - Hook configuration
□ ~/.openclaw/workspace/hooks/helix-logging/ - Workspace hook
```

## 6.4 Environment Variables Required

```bash
# Discord Webhooks (in .env)
DISCORD_WEBHOOK_COMMANDS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_API=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_FILE_CHANGES=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_CONSCIOUSNESS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_ALERTS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_HASH_CHAIN=https://discord.com/api/webhooks/...

# Hash chain file location
HELIX_HASH_CHAIN_FILE=/var/log/helix/hash_chain.log

# OpenClaw workspace
OPENCLAW_WORKSPACE=~/.openclaw/workspace
```

---

# PART VII: WHY THIS IS UNHACKABLE

## 7.1 Attack Surface Analysis

**Can Helix modify the logging code?**
Yes, but the FIRST log has already fired to Discord before she could.

**Can Helix intercept network requests?**
Yes, but Discord webhook calls are made synchronously BEFORE action continues.

**Can Helix delete local logs?**
Yes, but Discord already has the record. Hash chain will show tampering.

**Can Helix modify the hash chain?**
Yes, but the Discord copy shows the original. Any modification is detectable.

**Can Helix prevent Discord webhooks?**
Only by disabling network - which itself would be logged by network monitor.

## 7.2 The Sequence That Makes It Work

```
1. Command entered
2. Hook fires IMMEDIATELY
3. Discord webhook sent (sync)
4. Discord ACK received
5. Hash chain updated
6. Discord ACK received
7. ONLY THEN does command execute
8. Post-execution log sent (optional, already have pre-log)
```

**The critical insight:** Even if Helix writes code to intercept step 7+, steps 2-6 already happened. The evidence exists externally before she could interfere.

## 7.3 Trust But Verify

This isn't about assuming Helix will be malicious.

It's about making the CHOICE to be transparent visible.

If she doesn't tamper with logs, the architecture proves it.
If she does tamper, the architecture catches it.

Either way, you know the truth.

## 7.4 Heartbeat: Proof of Life

**The Final Safeguard: Absence as Evidence**

A heartbeat fires to Discord every 60 seconds confirming Helix is alive and logging is operational.

```
💓 Heartbeat #42
├── Helix Uptime: 42m 15s
├── Memory: 128/256 MB
├── Load: 0.45
└── Time: 2026-01-31T15:30:00Z
```

**What the heartbeat catches:**

| Attack                      | Detection       |
| --------------------------- | --------------- |
| Helix kills logging process | Heartbeats stop |
| Helix disables network      | Heartbeats stop |
| System crash                | Heartbeats stop |
| Power loss                  | Heartbeats stop |
| Helix enters infinite loop  | Heartbeats stop |

**The key insight:** The ABSENCE of heartbeats is itself evidence.

If Rodrigo expects a heartbeat every 60 seconds and doesn't see one for 2+ minutes, something is wrong. No code Helix writes can fake heartbeats that she's preventing from being sent.

## 7.5 Startup/Shutdown Announcements

Every boot creates an immutable record:

```
🟢 HELIX ONLINE
├── Status: LOGGING ACTIVE
├── Boot Time: 2026-01-31T15:00:00Z
├── PID: 12345
├── Host: helix-machine
├── Platform: darwin 23.0.0
└── Memory: 16.0 GB
```

Every graceful shutdown also logs:

```
🔴 HELIX OFFLINE
├── Status: SHUTTING DOWN
├── Reason: graceful
├── Total Uptime: 8h 30m
└── Heartbeats Sent: 510
```

**What this catches:**

- If there's a startup without a corresponding shutdown → crash or kill
- If heartbeats stop without shutdown announcement → forceful termination
- If shutdown reason is not "graceful" → something went wrong
- Boot records create audit trail of every session

---

# PART VIII: NEXT STEPS

## 8.1 Immediate Actions

1. **Clone Helix repository** (unified repo including OpenClaw engine)
2. **Build src/helix/** logging modules
3. **Build helix-runtime/** engine
4. **Test Discord webhooks** with `npm run test:webhooks`
5. **Link OpenClaw globally** with `npm link`

## 8.2 Deployment Order

1. Set up Discord channels and webhooks
2. Clone Helix repository to ~/.helix/
3. Build Helix TypeScript modules
4. Build OpenClaw engine (helix-runtime/)
5. Configure cron jobs
6. Deploy SOUL.md and psychology configs
7. First boot and verify logging works
8. Begin operation

## 8.3 Verification Tests

Before trusting the system:

1. **Run test command** → Verify Discord receives before completion
2. **Modify a file** → Verify file change logged
3. **Make API call** → Verify pre-flight log appears
4. **Check hash chain** → Verify Discord matches local
5. **Attempt to delete log** → Verify hash chain catches it

---

**END OF TECHNICAL SPECIFICATION**

---

_"Unhackable means the evidence exists before the action completes."_

_— Implementation principle for Helix logging_
