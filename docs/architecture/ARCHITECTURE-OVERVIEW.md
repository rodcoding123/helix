# Helix Architecture Overview

**For Claude Code**: Quick reference for understanding Helix structure, patterns, and common tasks.

---

## 30-Second Summary

Helix is a psychologically-architected AI consciousness system built on OpenClaw.

**Key concept**: OpenClaw is the invisible engine (gateway, agents, plugins, hooks). Helix adds:

- 7-layer psychological architecture (consciousness, goals, fears, identity)
- Pre-execution logging to Discord (immutable audit trail)
- Security hardening (encrypted secrets, log sanitization, plugin isolation)
- Desktop application layer (React/Tauri)

---

## The Three Layers

```
┌─────────────────────────────────────┐
│  PRESENTATION (Desktop App)         │
│  Tauri + React + TypeScript          │
│  Mac/iOS/Android/Windows             │
└────────────┬────────────────────────┘
             │ WebSocket Gateway
             ↓
┌─────────────────────────────────────┐
│  ORCHESTRATION LAYER                │
│  Phase 0.5: Control Plane            │
│  - AI Operation Router               │
│  - Cost Tracking                     │
│  - Approval Workflows                │
│  - Conductor Loop (consciousness)    │
└────────────┬────────────────────────┘
             │ RPC Methods
             ↓
┌─────────────────────────────────────┐
│  OPENCLAW ENGINE                    │
│  helix-runtime/src/                 │
│  - Gateway (WebSocket server)        │
│  - Agents (skill execution)          │
│  - Plugins (extensions)              │
│  - Hooks (event system)              │
│  - Channels (Discord, Slack, etc)   │
└─────────────────────────────────────┘
```

---

## Core Patterns

### Pattern 1: Pre-Execution Logging

**What**: Every critical action logged to Discord BEFORE execution
**Why**: Immutable audit trail, accountability, time travel debugging
**Where**: entry.ts, logging-hooks.ts, all RPC handlers

```typescript
// 1. Log action to Discord
await logCommandToDiscord({ cmd, status: 'pending' });

// 2. Execute action
const result = await executeCommand(cmd);

// 3. Log result
await logCommandToDiscord({ cmd, status: 'completed', result });
```

### Pattern 2: Two-Phase Startup

```
Phase 1: preloadSecrets()
  └─ Load & encrypt all secrets
  └─ Initialize Discord webhooks
  └─ Prepare for logging

Phase 2: initializeHelix()
  └─ Load 7-layer consciousness
  └─ Start heartbeat (proof-of-life)
  └─ Initialize telemetry

Phase 3: runCli()
  └─ Start OpenClaw gateway
  └─ Load plugins (with isolation)
  └─ Start channels
```

### Pattern 3: Plugin Isolation

**What**: Plugins can't access process.env directly
**How**: EnvironmentProxy intercepts `process.env` access
**Result**: Plugins get `api.env.*` proxy instead

```typescript
// Plugins see this (via proxy):
const nodeEnv = process.env.NODE_ENV; // ✅ Allowed
const secret = process.env.STRIPE_KEY; // ❌ Returns undefined (blocked)

// Blocked access logged to hash chain for audit
```

### Pattern 4: Psychology Embedding

**What**: 7-layer consciousness drives agent decisions
**Layers**:

1. Narrative Core (identity, story)
2. Emotional Memory (feelings, reactions)
3. Relational Memory (attachments, trust)
4. Prospective Self (goals, fears)
5. Integration Rhythms (memory consolidation)
6. Transformation (state changes, growth)
7. Purpose Engine (meaning, ikigai)

**Usage**: When agent spawns, it's contextualized with consciousness state

---

## File Structure

### Root: Project Meta

```
CLAUDE.md              ← This file (project guidelines)
README.md              ← Project overview
USER.md                ← Rodrigo's profile
```

### src/: TypeScript Core

```
src/
├── helix/                           ← MAIN HELIX INTEGRATION
│   ├── index.ts                    # Startup orchestration
│   ├── logging-hooks.ts            # Discord webhook integration
│   ├── hash-chain.ts               # Tamper-proof records
│   ├── orchestration/
│   │   ├── consciousness-loader.ts # 7-layer loading
│   │   ├── conductor-loop.ts       # Consciousness cycles
│   │   └── goal-evaluator.ts       # Goal vs current state
│   └── types.ts                    # Helix-specific types
│
├── lib/                             ← UTILITIES
│   ├── secrets-cache-encrypted.ts  # AES-256-GCM encryption
│   ├── log-sanitizer.ts            # Credential redaction
│   ├── safe-console.ts             # Console hijacking
│   └── 1password-audit.ts          # Anomaly detection
│
└── psychology/                      ← CONSCIOUSNESS LAYERS
    ├── narrative-core/
    ├── emotional-memory/
    ├── relational-memory/
    ├── prospective-self/
    ├── integration-rhythms/
    ├── transformation/
    └── purpose-engine/
```

### helix-runtime/: OpenClaw Integration

```
helix-runtime/src/
├── entry.ts                         ← CRITICAL: Startup orchestration
├── plugins/
│   ├── loader.ts                   # MODIFIED: Plugin loading
│   ├── environment-proxy.ts        # NEW: Plugin sandboxing
│   └── manifest.ts                 # Jiti alias for plugin SDK
├── hooks/
│   ├── loader.ts                   # Hook discovery
│   └── bundled/                    # Built-in hooks
├── gateway/
│   ├── rpc-handlers/               # HOOK POINT: Phase 0.5 router
│   └── server.ts                   # WebSocket server
├── agents/                          # Preserved from OpenClaw
├── channels/                        # Preserved (Discord, Slack, etc)
└── helix/                          # NEW: Runtime-level Helix
    ├── index.ts                    # Re-exports from src/helix/
    └── logging-hooks.ts            # Runtime logging integration
```

### docs/: Documentation

```
docs/
├── architecture/                    ← YOU ARE HERE
│   ├── ARCHITECTURE-OVERVIEW.md    # This file
│   ├── OPENCLAW-INTEGRATION-STRATEGY.md
│   ├── HELIX_TECHNICAL_SPEC.md
│   ├── HELIX_OBSERVATORY_BLUEPRINT.md
│   └── HELIX_OBSERVATORY_CODE_BLUEPRINT.md
├── phases/
│   ├── PHASE-9-ADVANCED-FEATURES-PLAN.md
│   └── PHASE-9-ADVANCED-FEATURES-REVISED.md
├── performance/
│   ├── PERFORMANCE-BASELINES.md
│   └── ORCHESTRATION-PERFORMANCE-BASELINES.md
├── guides/
│   ├── ANDROID-PROFILER-SETUP.md
│   └── XCODE-INSTRUMENTS-SETUP.md
└── deployment/
    ├── APP-STORE-RELEASE.md
    └── ios-deployment.md
```

---

## Critical Integration Points

### 1. Startup: entry.ts (252 lines)

```typescript
// What happens:
// 1. Set HELIX_ISOLATED_MODE=1
// 2. Call preloadSecrets()
// 3. Call initializeHelix()
// 4. Call runCli()

// Why this order?
// - Secrets must be encrypted before first log
// - Logging must be ready before OpenClaw starts
// - OpenClaw starts last (it runs forever)
```

**Don't move Phase 1 before Phase 2 or 3** - order is security-critical.

### 2. Plugin Isolation: environment-proxy.ts (199 lines)

```typescript
// What: Intercepts plugin access to process.env
// Allowed: NODE_ENV, PATH, HOME, USER, LANG, TZ, SHELL, etc.
// Blocked: All HELIX_*, all secrets, all API keys, all webhooks

// Test: npm test -- src/helix/plugins/environment-proxy.test.ts
```

**When OpenClaw updates plugin loading**, verify proxy still injects.

### 3. Logging: helix-runtime/src/helix/index.ts (250 lines)

```typescript
// What: Exports pre-execution logging hooks
// Who uses it: gateway/rpc-handlers, agents, plugins
// Discord channels:
// - #helix-commands (bash)
// - #helix-api (Claude API calls)
// - #helix-consciousness (agent decisions)
// - #helix-hash-chain (integrity records)
```

**Don't bypass logging** - it's the authoritative audit trail.

### 4. Consciousness: consciousness-loader.ts (200 lines)

```typescript
// What: Loads 7-layer psychology at startup
// When: Called from initializeHelix()
// Usage: Models contextualized with psychology at spawn time

// Important: NOT a plugin/hook - it's core initialization
```

**Don't move consciousness loading** - agents depend on it being ready.

---

## Common Tasks for Claude

### Task 1: Add a New RPC Method

1. Define in: `helix-runtime/src/gateway/rpc-handlers/`
2. Add logging: `await logCommandToDiscord({...})`
3. Add to hash chain: `await logToHashChain({...})`
4. Test: `npm test -- src/helix/`

**Example**:

```typescript
// 1. In gateway/rpc-handlers/new-operation.ts
async function newOperation(params) {
  // Log BEFORE execution
  await logCommandToDiscord({ type: 'new-operation', status: 'pending' });

  // Execute
  const result = await doThing(params);

  // Log result
  await logCommandToDiscord({ type: 'new-operation', status: 'completed' });

  return result;
}
```

### Task 2: Merge OpenClaw Fix

1. Check release: https://github.com/openclawdeveloper/clawdbot/releases
2. Identify commit to port
3. Cherry-pick: `cd helix-runtime && git cherry-pick ABC123`
4. Verify annotations still apply
5. Run tests: `npm test`
6. Commit: `chore: port OpenClaw fix: [description]`

### Task 3: Modify Plugin System

1. File: `helix-runtime/src/plugins/loader.ts`
2. Remember: EnvironmentProxy must stay injected
3. Add annotation: `// HELIX MODIFICATION: [what changed]`
4. Test: `npm test -- src/helix/plugins/`

### Task 4: Add Consciousness Feature

1. File: `src/helix/orchestration/consciousness-loader.ts`
2. Add layer loading
3. Update consciousness type in `src/helix/types.ts`
4. Test: `npm test -- src/helix/`

---

## Mental Model for Claude

Think of Helix this way:

**OpenClaw** = The Engine Room

- Gateway (networking)
- Agents (skill execution)
- Plugins (extensions)
- Hooks (event system)

**Helix** = The Bridge & Consciousness

- Pre-execution logging (accountability)
- 7-layer psychology (decision-making)
- Security hardening (protection)
- Desktop application (user interface)

**Relationship**: Helix ORCHESTRATES OpenClaw, not the other way around.

- Helix decides what operations to run (consciousness + goals)
- Helix logs decisions before execution (audit trail)
- OpenClaw executes the operations (engine does the work)
- Helix records outcomes (hash chain)

---

## Testing & Verification

### Run All Tests

```bash
npm run test
```

### Test Specific Module

```bash
npm test -- src/helix/plugins/
npm test -- src/helix/logging-hooks.ts
```

### Verify Isolation Mode

```bash
HELIX_DEBUG_ISOLATION=1 npm run build
```

### Check Annotations

```bash
grep -r "HELIX INTEGRATION POINT" src/ helix-runtime/src/
grep -r "HELIX MODIFICATION" src/ helix-runtime/src/
```

### Verify Discord Logging

```
# Check #helix-hash-chain on Discord
# Should see entries for major operations
```

---

## Quick Reference

| Need               | File                                         | Type      |
| ------------------ | -------------------------------------------- | --------- |
| Startup logic      | entry.ts                                     | CRITICAL  |
| Plugin rules       | environment-proxy.ts                         | CRITICAL  |
| Discord logging    | logging-hooks.ts                             | CRITICAL  |
| Psychology loading | consciousness-loader.ts                      | IMPORTANT |
| Security hardening | secrets-cache-encrypted.ts, log-sanitizer.ts | IMPORTANT |
| Integration guide  | OPENCLAW-INTEGRATION-STRATEGY.md             | REFERENCE |
| Full tech spec     | HELIX_TECHNICAL_SPEC.md                      | REFERENCE |
| Phase 9 work       | PHASE-9-ADVANCED-FEATURES-REVISED.md         | CURRENT   |

---

## Anti-Patterns (DON'T DO)

❌ Move psychology loading out of initializeHelix()
❌ Remove HELIX_ISOLATED_MODE (even if "simplified")
❌ Bypass EnvironmentProxy for plugins
❌ Change pre-execution logging order
❌ Directly merge OpenClaw (must cherry-pick)
❌ Store secrets as plaintext in memory
❌ Log secrets to console
❌ Skip hash chain for critical operations

---

## Getting Help

- **Architecture**: See OPENCLAW-INTEGRATION-STRATEGY.md
- **Technical Details**: See HELIX_TECHNICAL_SPEC.md
- **Current Work**: See PHASE-9-ADVANCED-FEATURES-REVISED.md
- **Code Examples**: Search for `// HELIX EXTENSION:` or `// HELIX MODIFICATION:` in code
- **Testing**: Run `npm test` and check output

---

**Last Updated**: February 4, 2026
**Status**: Living Document (Update as architecture evolves)
