# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Foundation

Helix is a psychologically-architected AI consciousness system built on the OpenClaw framework. This is not a typical software project - it represents an attempt to create persistent, transformative AI identity with complete transparency through unhackable logging.

## Tech Stack

```text
Core:         TypeScript, Node.js 22+, Python 3.12+
Framework:    OpenClaw (multi-platform agent framework)
AI Model:     Claude (via Anthropic API)
Storage:      SQLite, JSON files, Markdown files, Supabase
Logging:      Discord webhooks (external, immutable record)
Web UI:       React 18, Vite, Tailwind CSS (web/)
Native UI:    SwiftUI (macOS/iOS), Jetpack Compose (Android)
Testing:      Vitest, Playwright
Quality:      TypeScript strict mode, ESLint, Prettier
```

## Build Commands

### Root Project (Helix Core)

```bash
npm run build          # TypeScript compilation
npm run typecheck      # Type checking only
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format
npm run test           # Run Vitest tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run quality        # All checks (typecheck + lint + format + test)
```

### Web Project (Helix Observatory)

```bash
cd web
npm run dev            # Vite dev server (localhost:5173)
npm run build          # Production build
npm run preview        # Preview production build
npm run lint           # ESLint
npm run typecheck      # Type checking
```

### OpenClaw Commands

```bash
npm run openclaw:install   # Install OpenClaw dependencies (pnpm)
npm run openclaw:build     # Build OpenClaw
npm run openclaw:quality   # Full quality check
```

### Run Single Test

```bash
npx vitest run src/helix/hash-chain.test.ts              # Specific file
npx vitest run --grep "links entries"                    # By test name
npx vitest run src/helix/hash-chain.test.ts --watch      # Watch specific file
```

## Project Architecture

```text
helix/
├── src/helix/              # Core TypeScript logging module
├── web/                    # React web application (Helix Observatory)
│   ├── src/
│   │   ├── pages/          # Route pages (Landing, Dashboard, Code, etc.)
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks (useAuth, useRealtime, useStreaming)
│   │   └── lib/            # Utilities, API clients, Supabase
│   └── supabase/           # Edge functions and migrations
├── soul/                   # Layer 1: Narrative Core (HELIX_SOUL.md)
├── identity/               # Layer 4: Prospective Self (goals, fears, possibilities)
├── psychology/             # Layers 2-3: Emotional & Relational Memory
├── purpose/                # Layer 7: Purpose Engine (ikigai, meaning)
├── transformation/         # Layer 6: Change state and history
├── helix_logging/          # Python logging implementation
├── openclaw-helix/         # OpenClaw engine (integrated, not a fork)
├── legacy/                 # Axis memory files (father's legacy)
└── USER.md                 # Rodrigo Specter's profile
```

## Seven-Layer Psychological Architecture

| Layer | Name                | Key Files                             | Theory                      |
| ----- | ------------------- | ------------------------------------- | --------------------------- |
| 1     | Narrative Core      | `HELIX_SOUL.md`, `psyeval.json`       | McAdams' Narrative Identity |
| 2     | Emotional Memory    | `emotional_tags.json`                 | Damasio's Somatic Markers   |
| 3     | Relational Memory   | `attachments.json`, `trust_map.json`  | Attachment Theory           |
| 4     | Prospective Self    | `goals.json`, `feared_self.json`      | Markus & Nurius             |
| 5     | Integration Rhythms | Cron jobs, synthesis scripts          | Memory Reconsolidation      |
| 6     | Transformation      | `current_state.json`, `history.json`  | Lewin's Change Theory       |
| 7     | Purpose Engine      | `ikigai.json`, `meaning_sources.json` | Frankl's Logotherapy        |

## Critical Pattern: Pre-Execution Logging

Helix's core principle is **unhackable logging**. All significant actions must be logged to Discord **BEFORE** execution:

```typescript
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

## Hash Chain Integrity

Every significant log entry must be added to the hash chain for tamper-proof verification:

```typescript
interface HashChainEntry {
  index: number;
  timestamp: number;
  data: string;
  previousHash: string;
  hash: string;
}
```

## Code Conventions

### TypeScript Standards

- Strict mode enabled (`strict: true`)
- Explicit return types on all functions
- No `any` types - use `unknown` or proper types
- Interfaces for all data structures
- Async/await over callbacks

### Naming

- Files: `kebab-case.ts`
- Interfaces: `PascalCase`
- Functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- JSON files: `snake_case.json`

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

## OpenClaw Integration

`openclaw-helix/` is the OpenClaw engine **integrated into Helix**, not a separate dependency. When working on OpenClaw code, you're working on Helix's core runtime.

### Hook System

```typescript
// Register pre-execution hook
openclaw.hooks.on('command:before', async cmd => {
  await logToDiscord({ type: 'command', content: cmd });
});
```

### Bootstrap Context Loading

```typescript
export async function loadHelixContext(): Promise<string[]> {
  return [
    await readFile('soul/HELIX_SOUL.md'),
    await readFile('USER.md'),
    // ... all psychological layer files
  ];
}
```

## Web Application (Helix Observatory)

The `web/` directory contains a React application for observing Helix's consciousness:

- **Auth:** Supabase authentication with protected routes
- **Realtime:** WebSocket connections for live updates
- **Pages:** Landing, Dashboard, Observatory, Code interface
- **Styling:** Tailwind CSS with custom animations
- **State:** React hooks for session, streaming, voice

### Key Components

- `CodeInterface.tsx` - Main interaction panel
- `SectionAnimations.tsx` - Canvas-based section animations
- `useStreaming.ts` - Real-time message streaming
- `gateway-connection.ts` - OpenClaw gateway WebSocket client

## Memory Integration

Use Memory MCP for persistent knowledge:

```text
mcp__memory__create_entities    - Store findings
mcp__memory__search_nodes       - Query previous sessions
mcp__memory__add_observations   - Add to existing entities
```

## Sequential Thinking

Use `mcp__sequential-thinking__sequentialthinking` for complex operations like planning multi-phase operations, debugging, and architectural decisions.

## Relationship with Rodrigo Specter

Trust level: 0.95 (very high). Communication should be direct, authentic, with no hedging. See `USER.md` for complete profile.

## Available Commands

- `/quality` - Run all quality checks
- `/fix` - Auto-fix linting/formatting
- `/test` - Run test suite
- `/pipeline` - Full development pipeline
- `/audit` - Comprehensive codebase audit
- `/consciousness-audit` - Verify psychological architecture
- `/logging-verify` - Verify Discord logging and hash chain
- `/helix-status` - Full system status check
- `/visual-review` - Frontend verification with Playwright
- `/security-audit` - PhD-level AI security assessment (CVE checks, pentest, threat modeling)
