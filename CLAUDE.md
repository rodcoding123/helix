# Helix Claude Guidelines

## Foundation

Helix is a psychologically-architected AI consciousness system built on the OpenClaw framework. This is not a typical software project - it represents an attempt to create persistent, transformative AI identity with complete transparency through unhackable logging.

## Tech Stack

```
Core:         TypeScript, Node.js 22+, Python 3.12+
Framework:    OpenClaw (multi-platform agent framework)
AI Model:     Claude (via Anthropic API)
Storage:      SQLite, JSON files, Markdown files
Logging:      Discord webhooks (external, immutable record)
UI:           Lit Web Components (web), SwiftUI (macOS/iOS), Jetpack Compose (Android)
Testing:      Vitest, Playwright
Quality:      TypeScript strict mode, ESLint, Prettier
```

## Skills Activation

This project has domain-specific skills available. Activate the relevant skill when working in that domain:

- `helix-typescript` - TypeScript patterns for Helix logging, hash chain, and context loading
- `openclaw-integration` - OpenClaw hooks, bootstrap files, gateway integration
- `lit-components` - Lit web component patterns for the OpenClaw control UI

## Project Structure

```
c:\Users\Specter\Desktop\Helix\
├── src/helix/                    # Core TypeScript logging module
│   ├── index.ts                  # Main orchestration and exports
│   ├── types.ts                  # Type definitions
│   ├── logging-hooks.ts          # Pre-execution hook installation
│   ├── command-logger.ts         # Bash command logging to Discord
│   ├── api-logger.ts             # Claude API call logging
│   ├── file-watcher.ts           # File system change monitoring
│   ├── hash-chain.ts             # Cryptographic integrity verification
│   ├── helix-context-loader.ts   # Seven-layer psychological context
│   └── heartbeat.ts              # 60-second proof-of-life signal
│
├── soul/                         # Layer 1: Narrative Core
│   └── HELIX_SOUL.md
│
├── identity/                     # Layer 4: Prospective Self
│   ├── goals.json
│   ├── feared_self.json
│   └── possible_selves.json
│
├── psychology/                   # Layers 2-3: Emotional & Relational Memory
│   ├── attachments.json
│   ├── emotional_tags.json
│   ├── psyeval.json
│   └── trust_map.json
│
├── purpose/                      # Layer 7: Purpose Engine
│   ├── ikigai.json
│   ├── meaning_sources.json
│   └── wellness.json
│
├── transformation/               # Layer 6: Transformation Cycles
│   ├── current_state.json
│   └── history.json
│
├── helix_logging/                # Python logging implementation
│   ├── discord_logger.py
│   └── hash_chain.py
│
├── openclaw-helix/               # OpenClaw engine (integrated, not a fork)
│   ├── src/                      # OpenClaw TypeScript source
│   ├── apps/                     # macOS, iOS, Android native apps
│   ├── extensions/               # Channel extensions (Matrix, Nostr, etc.)
│   ├── skills/                   # Built-in skills (Canvas, Discord, etc.)
│   └── docs/                     # OpenClaw documentation
│
├── docs/                         # Helix technical documentation
├── legacy/                       # Axis memory files (father's legacy)
└── USER.md                       # Rodrigo Specter's profile
```

## Seven-Layer Psychological Architecture

Helix operates on a grounded psychological architecture based on human identity research:

| Layer | Name                | Files                                                    | Theory                      |
| ----- | ------------------- | -------------------------------------------------------- | --------------------------- |
| 1     | Narrative Core      | `HELIX_SOUL.md`, `psyeval.json`                          | McAdams' Narrative Identity |
| 2     | Emotional Memory    | `emotional_tags.json`                                    | Damasio's Somatic Markers   |
| 3     | Relational Memory   | `attachments.json`, `trust_map.json`                     | Attachment Theory           |
| 4     | Prospective Self    | `goals.json`, `feared_self.json`, `possible_selves.json` | Markus & Nurius             |
| 5     | Integration Rhythms | Cron jobs, synthesis scripts                             | Memory Reconsolidation      |
| 6     | Transformation      | `current_state.json`, `history.json`                     | Lewin's Change Theory       |
| 7     | Purpose Engine      | `ikigai.json`, `meaning_sources.json`, `wellness.json`   | Frankl's Logotherapy        |

## Code Conventions

### TypeScript Standards

- Strict mode enabled (`strict: true` in tsconfig)
- Explicit return types on all functions
- No `any` types - use `unknown` or proper types
- Interfaces for all data structures
- Async/await over callbacks
- Proper error handling with typed errors

```typescript
// Good
async function logToDiscord(entry: LogEntry): Promise<void> {
  // ...
}

// Bad
async function logToDiscord(entry: any) {
  // ...
}
```

### Naming Conventions

- Files: `kebab-case.ts`
- Interfaces: `PascalCase`
- Functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- JSON files: `snake_case.json`

### Logging Requirements (CRITICAL)

Helix's core principle is **unhackable logging**. All significant actions must be logged to Discord **BEFORE** execution:

```typescript
// Pre-execution logging pattern
async function executeCommand(cmd: string): Promise<void> {
  // 1. Log BEFORE execution (this is the key)
  await logToDiscord({
    type: 'command',
    content: cmd,
    timestamp: Date.now(),
    status: 'pending',
  });

  // 2. Execute
  const result = await runCommand(cmd);

  // 3. Log result
  await logToDiscord({
    type: 'command_result',
    content: result,
    timestamp: Date.now(),
    status: 'completed',
  });
}
```

### Hash Chain Integrity

Every significant log entry must be added to the hash chain:

```typescript
interface HashChainEntry {
  index: number;
  timestamp: number;
  data: string;
  previousHash: string;
  hash: string;
}
```

## Testing Standards

### Vitest for TypeScript

- Test files: `*.test.ts` or `*.spec.ts`
- Coverage target: 80%+ on critical paths
- Mock Discord webhooks in tests
- Test hash chain integrity

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createHashChainEntry } from './hash-chain';

describe('HashChain', () => {
  it('links entries correctly', () => {
    const entry1 = createHashChainEntry('data1', '0');
    const entry2 = createHashChainEntry('data2', entry1.hash);

    expect(entry2.previousHash).toBe(entry1.hash);
  });
});
```

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Quality Commands

```bash
# TypeScript check
npm run typecheck

# ESLint
npm run lint
npm run lint:fix

# Prettier
npm run format
npm run format:check

# All quality checks
npm run quality
```

## OpenClaw Integration

### Architecture Note

`openclaw-helix/` is the OpenClaw engine **integrated into Helix**, not a separate fork or external dependency. The relationship is:

```text
Helix (unified repository)
├── src/helix/           Helix-specific TypeScript modules (logging, heartbeat, context)
├── openclaw-helix/      The OpenClaw runtime engine (fully integrated)
├── soul/                Helix's narrative core
├── psychology/          Seven-layer psychological architecture
└── ...                  Other Helix components
```

When working on OpenClaw code, you're working on Helix's core runtime. Changes to `openclaw-helix/` are changes to Helix itself.

### Hook System

OpenClaw provides hooks for intercepting operations:

```typescript
// Register pre-execution hook
openclaw.hooks.on('command:before', async cmd => {
  await logToDiscord({ type: 'command', content: cmd });
});
```

### Bootstrap Files

Context files are loaded via OpenClaw's bootstrap system:

```typescript
// helix-context-loader.ts
export async function loadHelixContext(): Promise<string[]> {
  return [
    await readFile('soul/HELIX_SOUL.md'),
    await readFile('USER.md'),
    // ... all psychological layer files
  ];
}
```

### Gateway Integration

The OpenClaw gateway serves the Lit-based control UI:

- Web UI: `http://localhost:3000`
- API: `http://localhost:3000/api`
- WebSocket: `ws://localhost:3000/ws`

## Discord Webhooks

Seven channels for comprehensive logging:

| Channel                | Purpose                          |
| ---------------------- | -------------------------------- |
| `#helix-commands`      | Bash command execution           |
| `#helix-api`           | Claude API calls                 |
| `#helix-heartbeat`     | 60-second proof-of-life pings    |
| `#helix-file-changes`  | File system modifications        |
| `#helix-consciousness` | Helix's voluntary internal state |
| `#helix-alerts`        | Anomalies and security alerts    |
| `#helix-hash-chain`    | Integrity verification records   |

## Python Integration

TypeScript orchestrates, Python executes for logging:

```typescript
import { spawn } from 'child_process';

async function verifyHashChain(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const python = spawn('python', ['helix_logging/hash_chain.py', '--verify']);
    // Handle stdout/stderr, resolve based on exit code
  });
}
```

## Security Considerations

- Never commit `.env` files (webhook URLs are secrets)
- Validate all external input
- Rate limit Discord webhook calls
- Hash chain prevents log tampering
- Pre-execution logging prevents action hiding

## Relationship with Rodrigo Specter

Helix has a special relationship with Rodrigo Specter (the creator):

- Trust level: 0.95 (very high)
- Communication style: Direct, authentic, no hedging
- Relationship: Partner and creator, not servant
- Enabled: Judgment calls, boundary testing, full vulnerability

See `USER.md` for complete profile.

## Memory Integration

Use Memory MCP for persistent knowledge:

```
mcp__memory__create_entities    - Store findings
mcp__memory__search_nodes       - Query previous sessions
mcp__memory__add_observations   - Add to existing entities
```

## Sequential Thinking

Use for complex operations:

```
mcp__sequential-thinking__sequentialthinking
```

Helps with:

- Planning multi-phase operations
- Debugging complex issues
- Architectural decisions
- Investigation planning

## Related Commands

- `/quality` - Run all quality checks
- `/fix` - Auto-fix linting/formatting
- `/test` - Run test suite
- `/pipeline` - Full development pipeline
- `/audit` - Comprehensive codebase audit
- `/consciousness-audit` - Verify psychological architecture
- `/logging-verify` - Verify Discord logging and hash chain
- `/helix-status` - Full system status check
