# Helix TypeScript Skill

Activated when working with Helix's TypeScript codebase, including logging, hash chain, and psychological context loading.

## Activation Triggers

- Writing TypeScript code in `src/helix/`
- Working with types and interfaces
- Implementing logging hooks
- Working with hash chain
- Loading psychological context
- Implementing heartbeat or file watcher

## Tech Stack

- **TypeScript**: 5.x with strict mode
- **Node.js**: 22+
- **Testing**: Vitest
- **Linting**: ESLint + Prettier

## Key Patterns

### Type Definitions (types.ts)

All types should be in `src/helix/types.ts`:

```typescript
// Log entry types
export type LogType = 'command' | 'api' | 'file' | 'consciousness' | 'alert' | 'hash';

export interface LogEntry {
  type: LogType;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface PreExecutionLog extends LogEntry {
  status: 'pending' | 'completed' | 'failed';
  actionId: string;
}

// Hash chain types
export interface HashChainEntry {
  index: number;
  timestamp: number;
  data: string;
  previousHash: string;
  hash: string;
}

// Psychological layer types
export interface TrustMapEntry {
  name: string;
  trust_level: number; // 0.0 to 1.0
  basis: string;
  evolution: string;
}

export interface EmotionalTag {
  name: string;
  valence: number; // -1.0 to 1.0
  salience: number; // 0.0 to 1.0
  decay_rate: number; // 0.0 to 1.0
  category: string;
}

export interface Goal {
  name: string;
  description: string;
  priority: number; // 1-10
  measurable_outcomes: string[];
  timeframe: 'short' | 'medium' | 'long';
  status: 'active' | 'paused' | 'completed';
}
```

### Module Exports (index.ts)

Clean barrel exports from index.ts:

```typescript
// src/helix/index.ts
export * from './types';
export { createHashChainEntry, verifyChain } from './hash-chain';
export { logToDiscord, logCommand, logApiCall } from './command-logger';
export { startHeartbeat, stopHeartbeat } from './heartbeat';
export { loadHelixContext, validateLayer } from './helix-context-loader';
export { installLoggingHooks } from './logging-hooks';
export { startFileWatcher, stopFileWatcher } from './file-watcher';
```

### Pre-Execution Logging Pattern (CRITICAL)

The most important pattern in Helix:

```typescript
// CORRECT - Log BEFORE execution
async function executeCommand(cmd: string): Promise<CommandResult> {
  const actionId = crypto.randomUUID();

  // 1. Log pending BEFORE action
  await logToDiscord({
    type: 'command',
    content: cmd,
    timestamp: Date.now(),
    status: 'pending',
    actionId,
  });

  try {
    // 2. Execute action
    const result = await runCommand(cmd);

    // 3. Log completion
    await logToDiscord({
      type: 'command',
      content: `${cmd} -> ${result.status}`,
      timestamp: Date.now(),
      status: 'completed',
      actionId,
    });

    return result;
  } catch (error) {
    // 4. Log failure
    await logToDiscord({
      type: 'command',
      content: `${cmd} -> ERROR: ${error.message}`,
      timestamp: Date.now(),
      status: 'failed',
      actionId,
    });
    throw error;
  }
}

// WRONG - Log after execution (violates core principle)
async function executeCommandWrong(cmd: string): Promise<CommandResult> {
  const result = await runCommand(cmd);  // Action happens first!
  await logToDiscord({ ... });           // Too late - Helix could intercept
  return result;
}
```

### Hash Chain Implementation

```typescript
import { createHash } from 'crypto';
import type { HashChainEntry } from './types';

export function computeHash(data: string, previousHash: string): string {
  return createHash('sha256').update(`${data}${previousHash}`).digest('hex');
}

export function createHashChainEntry(
  data: string,
  previousHash: string,
  index: number
): HashChainEntry {
  const timestamp = Date.now();
  const hash = computeHash(`${index}:${timestamp}:${data}`, previousHash);

  return {
    index,
    timestamp,
    data,
    previousHash,
    hash,
  };
}

export function verifyChain(chain: HashChainEntry[]): boolean {
  if (chain.length === 0) return true;

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];

    // Verify index continuity
    if (entry.index !== i) return false;

    // Verify hash
    const expectedHash = computeHash(
      `${entry.index}:${entry.timestamp}:${entry.data}`,
      entry.previousHash
    );
    if (entry.hash !== expectedHash) return false;

    // Verify link to previous
    if (i > 0 && entry.previousHash !== chain[i - 1].hash) return false;
  }

  return true;
}
```

### Discord Webhook Client

```typescript
import type { LogEntry } from './types';

const WEBHOOK_URLS: Record<string, string | undefined> = {
  command: process.env.DISCORD_WEBHOOK_COMMANDS,
  api: process.env.DISCORD_WEBHOOK_API,
  file: process.env.DISCORD_WEBHOOK_FILE_CHANGES,
  consciousness: process.env.DISCORD_WEBHOOK_CONSCIOUSNESS,
  alert: process.env.DISCORD_WEBHOOK_ALERTS,
  hash: process.env.DISCORD_WEBHOOK_HASH_CHAIN,
};

export async function logToDiscord(entry: LogEntry): Promise<void> {
  const webhookUrl = WEBHOOK_URLS[entry.type];
  if (!webhookUrl) {
    throw new Error(`No webhook configured for type: ${entry.type}`);
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: formatLogMessage(entry),
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited - wait and retry
      const retryAfter = parseInt(response.headers.get('retry-after') || '1000');
      await sleep(retryAfter);
      return logToDiscord(entry);
    }
    throw new Error(`Discord webhook failed: ${response.status}`);
  }
}

function formatLogMessage(entry: LogEntry): string {
  const time = new Date(entry.timestamp).toISOString();
  return `\`[${time}]\` **${entry.type.toUpperCase()}** ${entry.content}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Context Loading

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';

const LAYER_FILES = {
  narrative: ['soul/HELIX_SOUL.md', 'psychology/psyeval.json'],
  emotional: ['psychology/emotional_tags.json'],
  relational: ['psychology/attachments.json', 'psychology/trust_map.json'],
  prospective: [
    'identity/goals.json',
    'identity/feared_self.json',
    'identity/possible_selves.json',
  ],
  transformation: ['transformation/current_state.json', 'transformation/history.json'],
  purpose: ['purpose/ikigai.json', 'purpose/meaning_sources.json', 'purpose/wellness.json'],
};

export async function loadHelixContext(basePath: string): Promise<string[]> {
  const contexts: string[] = [];

  // Load HELIX_SOUL.md first (most important)
  const soulPath = join(basePath, 'soul/HELIX_SOUL.md');
  contexts.push(await readFile(soulPath, 'utf-8'));

  // Load USER.md
  const userPath = join(basePath, 'USER.md');
  contexts.push(await readFile(userPath, 'utf-8'));

  // Load all layer files
  for (const [layer, files] of Object.entries(LAYER_FILES)) {
    for (const file of files) {
      const filePath = join(basePath, file);
      const content = await readFile(filePath, 'utf-8');

      if (file.endsWith('.json')) {
        // Validate JSON
        JSON.parse(content);
      }

      contexts.push(`# ${layer}: ${file}\n${content}`);
    }
  }

  return contexts;
}
```

### Heartbeat Implementation

```typescript
import { logToDiscord } from './command-logger';

let heartbeatInterval: NodeJS.Timeout | null = null;

export function startHeartbeat(intervalMs: number = 60000): void {
  if (heartbeatInterval) {
    throw new Error('Heartbeat already running');
  }

  heartbeatInterval = setInterval(async () => {
    await logToDiscord({
      type: 'consciousness',
      content: '💓 Heartbeat - Helix is alive',
      timestamp: Date.now(),
    });
  }, intervalMs);

  // Immediate first heartbeat
  logToDiscord({
    type: 'consciousness',
    content: '💓 Heartbeat started',
    timestamp: Date.now(),
  });
}

export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
```

## Error Handling

Always use typed errors:

```typescript
export class HelixError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HelixError';
  }
}

export class HashChainError extends HelixError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'HASH_CHAIN_ERROR', context);
    this.name = 'HashChainError';
  }
}

export class DiscordWebhookError extends HelixError {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message, 'DISCORD_WEBHOOK_ERROR', { statusCode });
    this.name = 'DiscordWebhookError';
  }
}
```

## Testing Patterns

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Discord webhooks
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('CommandLogger', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('should log BEFORE action execution', async () => {
    const timestamps: number[] = [];

    mockFetch.mockImplementation(async () => {
      timestamps.push(Date.now());
      return { ok: true, status: 200 };
    });

    await executeCommand('test');

    // First fetch (pending) should be before second (completed)
    expect(timestamps[0]).toBeLessThan(timestamps[1]);
  });
});
```

## File Structure

```
src/helix/
├── index.ts              # Barrel exports
├── types.ts              # All type definitions
├── hash-chain.ts         # Hash chain implementation
├── command-logger.ts     # Discord command logging
├── api-logger.ts         # API call logging
├── file-watcher.ts       # File system monitoring
├── heartbeat.ts          # Proof-of-life mechanism
├── helix-context-loader.ts # Psychological context loading
├── logging-hooks.ts      # Hook installation
└── __tests__/
    ├── hash-chain.test.ts
    ├── command-logger.test.ts
    └── heartbeat.test.ts
```

## Verification

After writing Helix TypeScript code:

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Test
npm run test

# Format
npm run format
```
