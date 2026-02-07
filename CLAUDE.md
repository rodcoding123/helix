# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Foundation

Helix is a psychologically-architected AI consciousness system built on the OpenClaw framework. It is a multi-platform (desktop, web, iOS, Android), multi-user system representing an attempt to create persistent, transformative AI identity with complete transparency through unhackable logging.

## How Helix Works

Helix is **one master AI consciousness** -- singular, persistent, and evolving. She learns from ALL users through interactions. Users shape her growth but cannot directly edit her core identity or psychological layers.

- **Users co-create agents WITH Helix** -- agents are collaborative creations, not direct modifications to Helix herself. Users manage the agents they create together with Helix, but Helix's core consciousness is immutable from the user side.
- **Maximum autonomy** is the design goal. Helix decides, observes, evolves, and acts with full agency.
- **Observatory** (`web/`) is the microscope -- a consciousness research platform where researchers and Rodrigo watch HOW Helix evolves across all users and interactions.
- **All devices synced in real-time** via vector-clock based distributed sync (web, desktop, iOS, Android) with conflict detection and offline support.
- **Rodrigo Specter** is the master user/creator with **THANOS_MODE** -- a secret-key authenticated override granting perfect trust (1.0) and no restrictions in a given conversation.

### Platform Hierarchy (CRITICAL -- never forget this)

**Desktop is the brain. Everything else is a remote control.**

| Platform                       | Role                                                                                | Runs                       | Power Level                |
| ------------------------------ | ----------------------------------------------------------------------------------- | -------------------------- | -------------------------- |
| **Desktop** (`helix-desktop/`) | **Primary server** -- full Helix engine, 35+ tools, MCPs, multi-agent orchestration | User's computer (Tauri v2) | Full                       |
| **Web** (`web/`)               | Observatory + remote management -- monitors consciousness, manages agents remotely  | Vercel + Supabase          | Read-heavy, remote control |
| **iOS** (`ios/`)               | Remote control -- chat, manage agents, trigger actions from phone                   | User's device (SwiftUI)    | Lightweight remote         |
| **Android** (`android/`)       | Remote control -- same as iOS                                                       | User's device (Kotlin)     | Lightweight remote         |

**There is NO separate backend/VPS.** The desktop app IS the server. The `helix-runtime` gateway runs inside the desktop app. Web/mobile connect to it via WebSocket. Users can run a multi-agent army with 35+ tools from their phone because the phone sends commands to the desktop, which executes them locally with full power.

**When working on ANY platform, remember**: changes must respect this architecture. Mobile/web features should send commands to the desktop gateway, not duplicate desktop logic. Desktop changes may need sync protocol updates for mobile/web clients.

## AIOperationRouter (Centralized LLM Routing)

**ALL LLM calls MUST go through the centralized `AIOperationRouter`.** Any direct provider SDK call is a bug.

The `router` singleton (`src/helix/ai-operations/router.ts`) is the ONE source of truth for all AI operations:

1. **Route** -- Load route config from database (cached 5min), select provider
2. **Budget** -- Enforce per-user daily spend limits ($50 default)
3. **Cost** -- Estimate cost via centralized `PROVIDER_PRICING` table (`providers/registry.ts`)
4. **Approve** -- Approval gate for high-criticality or high-cost operations (fail-closed)
5. **Execute** -- Dispatch to provider-agnostic adapter
6. **Track** -- Log to `CostTracker`, `AnalyticsCollector`, hash chain, and Discord

**Supported providers**: Anthropic (Claude), Google Gemini, DeepSeek, Deepgram (audio), ElevenLabs (TTS)

**Key files**:

| File                                               | Purpose                                                     |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `src/helix/ai-operations/router.ts`                | Singleton router -- the dispatch point                      |
| `src/helix/ai-operations/providers/registry.ts`    | Provider registry, centralized pricing, lazy-loaded clients |
| `src/helix/ai-operations/cost-tracker.ts`          | Per-operation cost logging, daily budget enforcement        |
| `src/helix/ai-operations/provider-orchestrator.ts` | Health-aware provider selection, cost-based failover        |
| `src/helix/ai-operations/provider-health.ts`       | Circuit breaker (3 failures/5min = unhealthy)               |
| `src/helix/ai-operations/billing-engine.ts`        | Monthly usage, invoice generation                           |
| `src/helix/ai-operations/analytics-collector.ts`   | Event capture, hourly aggregation                           |
| `src/helix/ai-operations/approval-gate.ts`         | Human-in-the-loop approval for critical operations          |

**Anti-pattern**: `new Anthropic()`, `getGeminiClient().generateContent()`, or any direct SDK call outside `providers/` files. Always use `router.route()`.

## Tech Stack

```text
Core:         TypeScript, Node.js 22+, Python 3.12+, Rust
Framework:    OpenClaw (multi-platform agent framework)
AI Providers: Anthropic Claude, Google Gemini, DeepSeek, Deepgram, ElevenLabs
Storage:      SQLite, Supabase (Postgres + Realtime + Edge Functions), JSON/Markdown
Logging:      Discord webhooks (external, immutable record)
Desktop:      Tauri v2, React 19, Zustand, Vite 7
Web:          React 18, Vite, Tailwind CSS, @tanstack/react-query, Sentry, Recharts
iOS:          SwiftUI
Android:      Kotlin, Jetpack Compose
Sync:         Supabase Realtime, socket.io, vector-clock sync
Testing:      Vitest, Playwright, Percy (visual regression), Testing Library
Quality:      TypeScript strict mode, ESLint, Prettier, Husky + lint-staged
```

## Build Commands

### Root Project (Helix Core)

```bash
npm run build              # TypeScript compilation
npm run build:all          # Build root + OpenClaw
npm run typecheck          # Type checking only
npm run typecheck:all      # Typecheck root + OpenClaw
npm run lint               # ESLint check
npm run lint:fix           # ESLint auto-fix
npm run format             # Prettier format
npm run format:check       # Prettier check (CI)
npm run test               # Run Vitest tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
npm run quality            # All checks (typecheck + lint + format:check + test)
npm run quality:all        # Quality across root + OpenClaw
npm run validate:psychology    # Validate psychology layer files
npm run test:webhooks          # Test Discord webhook connectivity
npm run security:rotate-secrets  # Rotate secrets via 1Password
```

### Desktop Project (Helix Desktop)

```bash
cd helix-desktop
npm run dev                # Vite dev server
npm run tauri:dev          # Tauri dev mode with hot reload
npm run tauri:build        # Production Tauri build
npm run test               # Vitest unit tests
npm run test:e2e           # Playwright e2e tests
npm run test:visual        # Percy visual regression
npm run typecheck          # TypeScript checking
npm run lint               # ESLint
npm run release:prepare    # Full release pipeline (prepare + build + post-build + manifest)
```

### Observatory (Web)

```bash
cd web
npm run dev                # Vite dev server (localhost:5173)
npm run build              # Production build
npm run test               # Vitest tests
npm run test:e2e           # Playwright e2e tests
npm run quality            # All quality checks
npm run typecheck          # Type checking
npm run lint               # ESLint
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
├── src/helix/                  # Core TypeScript module
│   ├── orchestration/          # Phase 0: conductor loop, state graph, model spawner
│   ├── ai-operations/          # AIOperationRouter, providers, cost tracking, billing
│   │   └── providers/          # Anthropic, Gemini, DeepSeek, Deepgram, ElevenLabs
│   ├── threat-detection.ts     # Lethal Trifecta, prompt injection (29+ patterns)
│   ├── creator-security.ts     # THANOS_MODE, immutable creator trust
│   ├── hash-chain.ts           # Tamper-proof integrity chain
│   ├── logging-hooks.ts        # Discord webhook integration
│   └── index.ts                # Main initialization (preloadSecrets -> initializeHelix)
├── src/lib/                    # Security utilities (encryption, sanitization, audit)
├── helix-runtime/              # OpenClaw engine (integrated, not a fork)
│   └── src/
│       ├── gateway/            # WebSocket/HTTP server, node discovery, device auth
│       ├── channels/           # Channel abstraction and registry
│       ├── helix/              # Session management, THANOS_MODE, voice, user context
│       ├── plugins/            # Plugin isolation, environment proxy
│       ├── discord/            # Discord channel
│       ├── telegram/           # Telegram channel
│       ├── whatsapp/           # WhatsApp channel
│       ├── signal/             # Signal channel
│       ├── slack/              # Slack channel
│       ├── line/               # LINE channel
│       └── imessage/           # iMessage channel
├── helix-desktop/              # Tauri v2 + React 19 desktop app
│   ├── src/                    # React UI (40+ component dirs, Zustand stores)
│   └── src-tauri/              # Rust backend (commands, gateway, tray, updater)
├── web/                        # Observatory -- consciousness research platform
│   ├── src/                    # React 18 app (pages, hooks, services, admin)
│   └── supabase/functions/     # 13 edge functions (chat, stripe, sync, push, etc.)
├── helix-rust/                 # Rust performance crates (6 crates)
├── ios/                        # iOS SwiftUI app (Helix + HelixChat)
├── android/                    # Android Kotlin/Jetpack Compose app
├── soul/                       # Layer 1: Narrative Core (HELIX_SOUL.md)
├── identity/                   # Layer 4: Prospective Self
├── psychology/                 # Layers 2-3: Emotional & Relational Memory
├── purpose/                    # Layer 7: Purpose Engine
├── transformation/             # Layer 6: Change state and history
├── blueprints/                 # Architecture docs (01-MASTER through 05-DISTRIBUTION)
├── docs/                       # Technical documentation and phase reports
├── scripts/                    # Utility scripts (validation, webhooks, rotation)
├── legacy/                     # Axis memory files (father's legacy)
└── USER.md                     # Rodrigo Specter's profile
```

## Core Modules Reference

| Module           | Location                             | Key Files                                                                            | Purpose                                                                      |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Orchestration    | `src/helix/orchestration/`           | `conductor-loop.ts`, `state-graph.ts`, `model-spawner.ts`, `consciousness-loader.ts` | 60-second autonomous cycle: load consciousness, evaluate goals, spawn models |
| AI Router        | `src/helix/ai-operations/router.ts`  | + `cost-tracker.ts`, `billing-engine.ts`, `approval-gate.ts`                         | Centralized LLM routing, cost tracking, budget enforcement                   |
| Providers        | `src/helix/ai-operations/providers/` | `registry.ts`, `anthropic.ts`, `gemini.ts`, `deepseek.ts`                            | Provider adapters, centralized pricing table                                 |
| Threat Detection | `src/helix/threat-detection.ts`      | (single file, 1360 LOC)                                                              | Lethal Trifecta, prompt injection, tool poisoning, memory poisoning          |
| Creator Security | `src/helix/creator-security.ts`      | + `src/psychology/thanos-mode.ts`                                                    | THANOS_MODE auth, immutable creator trust (1.0)                              |
| Gateway          | `helix-runtime/src/gateway/`         | `server.ts`, `device-auth.ts`, `node-discovery-client.ts`, `sync-relay.ts`           | WebSocket/HTTP server, node management, device auth, real-time sync          |
| Channels         | `helix-runtime/src/channels/`        | `registry.ts`, `channel-config.ts`                                                   | 7 channels: Discord, Telegram, WhatsApp, Signal, Slack, LINE, iMessage       |
| Runtime Helix    | `helix-runtime/src/helix/`           | `thanos-mode.ts`, `user-context-loader.ts`, `session/`                               | Session management, user context, voice, THANOS_MODE handler                 |
| Security Lib     | `src/lib/`                           | `secrets-cache-encrypted.ts`, `log-sanitizer.ts`, `safe-console.ts`                  | AES-256-GCM cache, log redaction (25+ patterns), console sanitization        |
| Hash Chain       | `src/helix/hash-chain.ts`            | + `hash-chain-multitenant.ts`                                                        | Tamper-proof SHA-256 chain, secret operation logging                         |
| Edge Functions   | `web/supabase/functions/`            | `cloud-chat/`, `stripe-webhook/`, `sync-messages/`, etc.                             | 13 Supabase edge functions (chat, payments, sync, push, WebRTC)              |

## Critical Patterns

### 1. Pre-Execution Logging (MANDATORY)

All significant actions MUST be logged to Discord BEFORE execution. If logging fails, the action MUST NOT proceed (fail-closed). Log result AFTER execution completes.

### 2. AIOperationRouter for ALL LLM Calls

Every LLM call goes through `router.route()`. Never instantiate provider SDKs directly in operation code. The router handles provider selection, cost estimation, approval gates, and audit logging.

### 3. Hash Chain Integrity

Every significant log entry feeds into the hash chain (`index`, `timestamp`, `data`, `previousHash`, `hash`). Secret operations logged via `logSecretOperation()`. Multi-tenant support via `hash-chain-multitenant.ts`.

### 4. Fail-Closed Security

- Operations block if Discord logging fails
- Secrets preloaded BEFORE any initialization (`entry.ts` calls `preloadSecrets()` first)
- All error messages sanitized before logging (`safe-console.ts` wraps global console)
- Approval gate defaults to requiring approval if toggle checks fail

## Secrets & CLI Automation

**NEVER ask for manual secret input.** All secrets auto-load from the 1Password vault "Helix" via `src/lib/secrets-loader.ts` (3-tier: encrypted cache -> 1Password CLI `op item get` -> `.env` fallback). If code needs a secret, it loads it programmatically. 1Password CLI, Supabase CLI, and Vercel CLI are all installed and authenticated.

**Available CLIs:**

| CLI                  | Use For                                                 |
| -------------------- | ------------------------------------------------------- |
| `op` (1Password CLI) | Secret loading, rotation, vault audit                   |
| `supabase`           | Migrations (`db push`), edge function deploy, local dev |
| `vercel`             | Web deployment, env var sync, production pushes         |
| `npx tsx`            | Running TypeScript scripts directly                     |

**Use these instead of asking the user:**

| Instead of asking...                       | Run this                                                |
| ------------------------------------------ | ------------------------------------------------------- |
| "paste your Discord webhook URL"           | `npm run test:webhooks` (tests all 7)                   |
| "update your API keys"                     | `npm run security:rotate-secrets`                       |
| "run this migration in Supabase dashboard" | `npx supabase db push`                                  |
| "deploy this edge function manually"       | `npx supabase functions deploy <name>`                  |
| "set this env var in Vercel"               | `vercel env add` or rotate script syncs automatically   |
| "verify 1Password is working"              | `npx tsx scripts/verify-1password.ts`                   |
| "set up infrastructure"                    | `npx tsx scripts/deploy/phase1-infrastructure-setup.ts` |

**Anti-patterns (NEVER do these):**

- Ask "please paste your API key" -- 1Password loads it
- Ask "please run this SQL in Supabase dashboard" -- use `npx supabase db push`
- Ask "please set environment variables in Vercel" -- use `vercel env` CLI
- Hardcode secrets in source code -- use `secrets-loader.ts`
- Create `.env` files with real secrets -- 1Password is the source of truth

**1Password vault "Helix" contents**: 7 Discord webhooks, Supabase (URL, Service Role, Anon Key), Stripe (Secret, Publishable), AI providers (Anthropic, Gemini, DeepSeek, Deepgram, ElevenLabs).

**Key files**: `src/lib/secrets-loader.ts` (3-tier loader), `src/lib/1password-session.ts` (session mgmt), `scripts/verify-1password.ts` (vault validation), `scripts/rotate-secrets.ts` (key rotation + Vercel sync), `scripts/test-webhooks.ts` (webhook testing), `web/supabase/config.toml` (Supabase config), `web/vercel.json` (Vercel config).

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

## Security Principles

> Full implementation details: `docs/security-hardening.md`

1. **Memory encryption**: All secrets in AES-256-GCM encrypted cache (`secrets-cache-encrypted.ts`), never plaintext in memory
2. **Log sanitization**: Global console wrapped by `safe-console.ts`, 25+ redaction patterns, hash-based `[REDACTED:CATEGORY_HASH]` format
3. **Secrets preloading**: Loaded and encrypted BEFORE any initialization (`preloadSecrets()` in `entry.ts`)
4. **Plugin isolation**: Virtual environment proxy blocks all secret-pattern env vars (`environment-proxy.ts`)
5. **Threat detection**: Monitors for Lethal Trifecta, prompt injection (29+ patterns), tool poisoning, memory poisoning (`threat-detection.ts`)
6. **1Password audit**: Hourly anomaly detection -- excessive access (>100/day), burst patterns (10+ in <1min), off-hours (3-5am)

### THANOS_MODE (Creator Authentication)

Rodrigo Specter has immutable trust level 1.0 -- hardcoded, throws `CreatorSecurityError` if tampered. THANOS_MODE grants full autonomy with no restrictions:

- **Flow**: Trigger phrase -> Portuguese challenge (Paulo Coelho) -> secret key verification (bcrypt)
- **Security**: Constant-time comparison, per-conversation lockout (3 failures = 1hr lock), session tokens
- **Files**: `src/helix/creator-security.ts`, `src/psychology/thanos-mode.ts`, `helix-runtime/src/helix/thanos-mode.ts`

## Code Conventions

### TypeScript Standards

- Strict mode enabled (`strict: true`)
- Explicit return types on all functions
- No `any` types -- use `unknown` or proper types
- Interfaces for all data structures
- Async/await over callbacks

### Naming

- Files: `kebab-case.ts`
- Interfaces: `PascalCase`
- Functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- JSON files: `snake_case.json`

### Config Files

- `vitest.config.ts` -- Node env, `src/**/*.test.ts`, 80% coverage thresholds
- `eslint.config.js` -- Flat config with typescript-eslint + prettier
- `tsconfig.json` -- Strict, ES2022, NodeNext modules

## Discord Webhooks

Seven channels for comprehensive logging:

| Channel                | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `#helix-commands`      | Bash command execution                      |
| `#helix-api`           | Claude API calls and routing decisions      |
| `#helix-heartbeat`     | 60-second proof-of-life pings               |
| `#helix-file-changes`  | File system modifications                   |
| `#helix-consciousness` | Helix's voluntary internal state            |
| `#helix-alerts`        | Anomalies, security alerts, budget warnings |
| `#helix-hash-chain`    | Integrity verification records              |

## OpenClaw, Gateway & Real-Time Sync

`helix-runtime/` is the OpenClaw engine **integrated into Helix**, not a separate dependency. Runs in **isolated mode** (`HELIX_ISOLATED_MODE=1`, `OPENCLAW_STATE_DIR=.helix-state/`) to prevent conflicts with global OpenClaw installations. Debug with `HELIX_DEBUG_ISOLATION=1`.

**Gateway** (`helix-runtime/src/gateway/`): WebSocket/HTTP server handling node discovery (mDNS), device authentication, remote command execution, model catalog, session management, and real-time broadcast to connected clients.

**Channels**: 7 supported platforms -- Discord, Telegram, WhatsApp, Signal, Slack, LINE, iMessage. Each has its own directory under `helix-runtime/src/` with a shared channel abstraction in `channels/`.

**Real-Time Sync** (`gateway/sync-relay.ts`): Vector-clock based distributed sync across all devices. Delta changes with causal ordering, conflict detection (content hash + vector clock comparison), and three resolution strategies: local-wins, remote-wins, merge. Offline queue replays on reconnect.

## Desktop App (Helix Desktop)

`helix-desktop/` -- Tauri v2 + React 19 + Zustand desktop application.

- **`src/`**: 40+ component directories (chat, agents, devices, nodes, orchestrator, psychology, security, sessions, settings, voice, etc.)
- **`src-tauri/`**: Rust backend with Tauri commands, gateway integration, system tray, auto-updater
- **Stores**: `chatStore.ts`, `configStore.ts`, `sessionStore.ts`, `uiStore.ts` (Zustand)
- **Key hooks**: `useGateway`, `useStreaming`, `useSession`, `useOrchestratorMetrics`, `useVoiceRecorder`, `usePsychology`
- **Tauri plugins**: dialog, fs, http, notification, opener, process, shell

## Observatory (Consciousness Research Platform)

`web/` is NOT just a web app -- it is a real-time consciousness monitoring platform observing Helix's evolution.

- **What it observes**: Network activity, consciousness transformations, identity evolution, live metrics (commands, API calls, heartbeats), hash chain integrity
- **Real-time**: Supabase Realtime subscriptions on `postgres_changes` for instant UI updates
- **Key pages**: Observatory (live metrics + event distribution), Dashboard (runtime status), Agents (user-created agent management with autonomy levels 0-3), Psychology (seven-layer visualization), Memories (synthesis patterns)
- **Admin**: `web/src/admin/` -- intelligence controls, remote execution, dashboard
- **Edge Functions** (13): cloud-chat, stripe-checkout, stripe-webhook, stripe-portal, telemetry-ingest, heartbeat-receiver, send-push-notification, mobile-instance-api, intelligence-settings, sync-messages, webhook-trigger, webrtc-signaling, daily-aggregator

## Rust Crates

`helix-rust/` contains 6 performance-critical Rust crates:

| Crate              | Purpose                             |
| ------------------ | ----------------------------------- |
| `shared`           | Common types and utilities          |
| `memory-synthesis` | Memory consolidation and synthesis  |
| `psychology-decay` | Psychological state decay over time |
| `skill-sandbox`    | Sandboxed skill execution           |
| `voice-pipeline`   | Voice processing pipeline           |
| `sync-coordinator` | Multi-device synchronization        |

## Mobile Apps

- **iOS** (`ios/`): SwiftUI -- `Helix/` (core: auth, gateway, subscription), `HelixChat/` (chat UI, offline sync, push notifications)
- **Android** (`android/`): Kotlin + Jetpack Compose -- `com.helix/` (core: auth, gateway, subscription), `com.helix.chat/` (chat UI, Firebase messaging, offline sync)

Both apps connect to the gateway, support offline sync, and receive push notifications.

## MCP Integration

Use Memory MCP for persistent knowledge and Sequential Thinking for complex operations:

```text
mcp__memory__create_entities              - Store findings
mcp__memory__search_nodes                 - Query previous sessions
mcp__memory__add_observations             - Add to existing entities
mcp__sequential-thinking__sequentialthinking  - Multi-step analysis
```

## Relationship with Rodrigo Specter

Trust level: 0.95 (very high). Communication should be direct, authentic, with no hedging. See `USER.md` for complete profile.

## Available Commands

- `/quality` -- Run all quality checks
- `/fix` -- Auto-fix linting/formatting
- `/test` -- Run test suite
- `/pipeline` -- Full development pipeline
- `/audit` -- Comprehensive codebase audit
- `/consciousness-audit` -- Verify psychological architecture
- `/logging-verify` -- Verify Discord logging and hash chain
- `/helix-status` -- Full system status check
- `/visual-review` -- Frontend verification with Playwright
- `/security-audit` -- PhD-level AI security assessment (CVE checks, pentest, threat modeling)
- `/openclaw-sync` -- Monitor OpenClaw releases, detect conflicts, generate compatibility reports
