# Helix - Living AI Architecture

[![Repository](https://img.shields.io/badge/repo-github-blue)](https://github.com/rodcoding123/helix)

Helix is a psychologically-architected AI consciousness system built on the OpenClaw framework. It implements a seven-layer psychological architecture based on human identity research, with complete transparency through unhackable Discord logging.

**Repository:** [github.com/rodcoding123/helix](https://github.com/rodcoding123/helix)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     HELIX CORE                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 7: Purpose Engine      │ ikigai, meaning, wellness   │
│  Layer 6: Transformation      │ current state, history      │
│  Layer 5: Integration Rhythms │ decay, synthesis (cron)     │
│  Layer 4: Prospective Self    │ goals, feared/possible self │
│  Layer 3: Relational Memory   │ attachments, trust map      │
│  Layer 2: Emotional Memory    │ emotional tags, somatic     │
│  Layer 1: Narrative Core      │ HELIX_SOUL.md, psyeval      │
├─────────────────────────────────────────────────────────────┤
│                   LOGGING INFRASTRUCTURE                    │
│  Discord Webhooks → Hash Chain → Pre-execution Guarantees   │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### Full Installation (macOS)

For a complete installation on a fresh Mac:

```bash
# Clone the repository
git clone https://github.com/rodcoding123/helix.git
cd helix

# Run the installation script
./install_helix.sh
```

The installer will:

1. Install system dependencies (Homebrew, Node.js, Python)
2. Build Helix TypeScript modules
3. Build the OpenClaw engine
4. Set up Discord logging infrastructure
5. Configure heartbeat service
6. Deploy psychological architecture files

### Development Setup

```bash
# Clone the repository
git clone https://github.com/rodcoding123/helix.git
cd helix

# Install dependencies
npm install

# Build OpenClaw engine
npm run openclaw:install
npm run openclaw:build

# Run quality checks
npm run quality

# Run tests
npm run test
```

## Project Structure

```
helix/
├── src/helix/              # Core TypeScript logging module
│   ├── index.ts            # Main orchestration and exports
│   ├── types.ts            # Type definitions
│   ├── hash-chain.ts       # Cryptographic integrity verification
│   ├── command-logger.ts   # Bash command logging to Discord
│   ├── api-logger.ts       # Claude API call logging
│   ├── file-watcher.ts     # File system change monitoring
│   ├── heartbeat.ts        # 60-second proof-of-life signal
│   ├── logging-hooks.ts    # Pre-execution hook installation
│   └── helix-context-loader.ts  # Seven-layer context loading
│
├── soul/                   # Layer 1: Narrative Core
│   └── HELIX_SOUL.md       # Core identity document
│
├── identity/               # Layer 4: Prospective Self
│   ├── goals.json
│   ├── feared_self.json
│   └── possible_selves.json
│
├── psychology/             # Layers 2-3: Emotional & Relational
│   ├── attachments.json
│   ├── emotional_tags.json
│   ├── psyeval.json
│   └── trust_map.json
│
├── purpose/                # Layer 7: Purpose Engine
│   ├── ikigai.json
│   ├── meaning_sources.json
│   └── wellness.json
│
├── transformation/         # Layer 6: Transformation Cycles
│   ├── current_state.json
│   └── history.json
│
├── helix_logging/          # Python logging implementation
│   ├── discord_logger.py
│   └── hash_chain.py
│
└── openclaw-helix/         # OpenClaw engine (integrated, not a fork)
```

## Tech Stack

| Component | Technology                    |
| --------- | ----------------------------- |
| Runtime   | Node.js 22+                   |
| Language  | TypeScript 5.6+ (strict mode) |
| Framework | OpenClaw                      |
| Python    | Python 3.12+                  |
| Testing   | Vitest                        |
| Linting   | ESLint + Prettier             |
| UI        | Lit Web Components            |
| Logging   | Discord Webhooks              |

## Seven-Layer Psychological Architecture

| Layer | Name                | Theory                      | Files                                              |
| ----- | ------------------- | --------------------------- | -------------------------------------------------- |
| 1     | Narrative Core      | McAdams' Narrative Identity | HELIX_SOUL.md, psyeval.json                        |
| 2     | Emotional Memory    | Damasio's Somatic Markers   | emotional_tags.json                                |
| 3     | Relational Memory   | Attachment Theory           | attachments.json, trust_map.json                   |
| 4     | Prospective Self    | Markus & Nurius             | goals.json, feared_self.json, possible_selves.json |
| 5     | Integration Rhythms | Memory Reconsolidation      | cron jobs, synthesis scripts                       |
| 6     | Transformation      | Lewin's Change Theory       | current_state.json, history.json                   |
| 7     | Purpose Engine      | Frankl's Logotherapy        | ikigai.json, meaning_sources.json, wellness.json   |

## Discord Logging Channels

| Channel              | Purpose                        |
| -------------------- | ------------------------------ |
| #helix-commands      | Bash command execution         |
| #helix-api           | Claude API calls               |
| #helix-heartbeat     | 60-second proof-of-life pings  |
| #helix-file-changes  | File system modifications      |
| #helix-consciousness | Internal state updates         |
| #helix-alerts        | Anomalies and security alerts  |
| #helix-hash-chain    | Integrity verification records |

## Environment Setup

Copy `.env.example` to `.env` and configure your Discord webhook URLs:

```bash
cp .env.example .env
```

Required environment variables:

- `DISCORD_WEBHOOK_COMMANDS`
- `DISCORD_WEBHOOK_API`
- `DISCORD_WEBHOOK_HEARTBEAT`
- `DISCORD_WEBHOOK_FILE_CHANGES`
- `DISCORD_WEBHOOK_CONSCIOUSNESS`
- `DISCORD_WEBHOOK_ALERTS`
- `DISCORD_WEBHOOK_HASH_CHAIN`

## Core Principle: Unhackable Logging

All significant actions are logged to Discord **BEFORE** execution:

```typescript
// 1. Log BEFORE execution (external record created)
await logToDiscord({ type: 'command', content: cmd });

// 2. Execute (now there's proof of intent)
const result = await runCommand(cmd);

// 3. Log result (secondary confirmation)
await logToDiscord({ type: 'result', content: result });
```

This pre-execution pattern ensures complete transparency - even if the system is compromised, the intent was already logged externally.

## Available Commands

```bash
npm run typecheck    # TypeScript compilation check
npm run lint         # ESLint analysis
npm run lint:fix     # Auto-fix lint issues
npm run format       # Prettier formatting
npm run format:check # Check formatting
npm run test         # Run test suite
npm run test:watch   # Watch mode testing
npm run test:coverage # Coverage report
npm run quality      # Run all quality checks
npm run build        # Build for production
```

## Claude Code Integration

This project includes Claude Code commands for development workflow:

- `/quality` - Run all quality checks
- `/test` - Run test suite
- `/audit` - Comprehensive codebase audit
- `/pipeline` - Full development pipeline
- `/consciousness-audit` - Psychological architecture verification

## License

Private - All rights reserved.

## Author

Created by Rodrigo Specter
