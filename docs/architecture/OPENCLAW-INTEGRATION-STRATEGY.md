# OpenClaw Integration Strategy & Architecture Documentation

**Date:** February 4, 2026
**Status:** Strategy Proposal
**Purpose:** Make OpenClaw integration transparent to Claude Code, establish sustainable merge pattern

---

## Problem Statement

1. **Documentation Gap**: Claude doesn't understand where/why Helix extended OpenClaw, leading to compatibility issues
2. **Merge Challenge**: OpenClaw releases fixes but Helix customizations aren't documented, making merges risky
3. **Code Quality Impact**: Without clear patterns, future changes may break the integration or lose important updates

**Solution**: Three-part approach - ADRs, integration map, code annotations

---

## Part 1: Architecture Decision Records (ADRs)

Document WHY we made each integration choice. Format: Decision → Context → Consequences

### ADR-1: Absorption Strategy (Not Plugin)

**Decision**: Integrate OpenClaw as absorbed engine, not external plugin
**Context**: Need psychological layers deeply embedded, desktop-first, complete control
**Consequences**:

- Helix controls startup sequence
- Can do security hardening (EncryptedSecretsCache, LogSanitizer)
- OpenClaw becomes invisible to users (they see "Helix")
- Merge strategy: Cherry-pick fixes into helix-runtime/

**Files**: `helix-runtime/src/entry.ts`, all of `helix-runtime/src/`

---

### ADR-2: Isolation Mode (Hardcoded)

**Decision**: HELIX_ISOLATED_MODE=1 hardcoded in entry.ts
**Context**: Users may have global OpenClaw installed; prevent conflicts
**Consequences**:

- Plugin discovery skips global `~/.openclaw/extensions/`
- State directory is `.helix-state/` not `~/.openclaw/`
- Cannot be overridden by environment variables or config
- Merge strategy: Must preserve isolation gating in entry.ts

**Files**: `helix-runtime/src/entry.ts`, `bundled-dir.ts`, `discovery.ts`

---

### ADR-3: Plugin Isolation via EnvironmentProxy

**Decision**: Inject EnvironmentProxy to sandbox plugins from process.env
**Context**: Plugins can't access secrets via process.env (security hardening Phase 1A)
**Consequences**:

- Plugins get `api.env.*` proxy instead of direct process.env access
- Blocked patterns logged to hash chain for audit
- Allows graceful degradation (plugins don't crash, just see undefined)
- Merge strategy: Plugin loader changes must preserve proxy injection

**Files**: `plugins/environment-proxy.ts` (NEW), `plugins/loader.ts` (MODIFIED)

---

### ADR-4: Pre-Execution Logging to Discord

**Decision**: Log all critical actions to Discord BEFORE execution
**Context**: Immutable audit trail is core requirement, needs to happen first
**Consequences**:

- Discord webhooks initialize in preloadSecrets()
- Failed logging blocks operations (fail-closed)
- All agent decisions logged to #helix-consciousness
- Merge strategy: Must preserve logging hooks in gateway/agents

**Files**: `src/helix/index.ts`, `helix-runtime/src/helix/index.ts`

---

### ADR-5: Two-Phase Initialization

**Decision**: Phase 1 = preloadSecrets(), Phase 2 = initializeHelix(), Phase 3 = runCli()
**Context**: Secrets must be encrypted before first log entry (Phase 1A requirement)
**Consequences**:

- entry.ts orchestrates strict sequence
- Cannot parallelize - order is security-critical
- Fail-closed on preloadSecrets() error
- Merge strategy: entry.ts is integration orchestrator - verify every merge

**Files**: `helix-runtime/src/entry.ts`

---

### ADR-6: Psychology Layers in Consciousness Loader

**Decision**: Load 7-layer psychology in initializeHelix() before agents start
**Context**: Psychology should drive agent decisions, not just be in prompts
**Consequences**:

- ConsciousnessLoader called at startup
- ConductorLoop runs consciousness cycles
- Models contextualized at spawn time
- Merge strategy: Don't move psychology loading - it's initialization order critical

**Files**: `src/helix/orchestration/consciousness-loader.ts`, `src/helix/index.ts`

---

## Part 2: Integration Map

Visual mapping of where Helix extends OpenClaw:

```
OPENCLAW ARCHITECTURE (helix-runtime/src/)
│
├── gateway/                  ← PRIMARY interface (preserved)
│   └── rpc-handlers/        ← HOOK POINT: AI operations dispatch
│       (Phase 0.5 adds: OperationRouter, CostTracker, ApprovalQueue)
│
├── agents/                   ← Agent runtime (preserved)
│   ├── bootstrap-hooks.ts   ← HOOK POINT: Psychology embedding
│   └── ...
│
├── plugins/                  ← Plugin system (HARDENED)
│   ├── loader.ts            ← MODIFIED: EnvironmentProxy injection
│   ├── environment-proxy.ts ← NEW: Sandbox/isolation
│   └── manifest.ts          ← Jiti alias for legacy plugin-sdk
│
├── hooks/                    ← Hook system (preserved)
│   ├── loader.ts            ← Hook discovery
│   └── bundled/             ← Built-in hooks
│       └── soul-evil/       ← Psychology embedding hook
│
├── channels/                 ← Channel adapters (preserved)
│   └── discord.ts           ← HOOK POINT: Discord logging
│
├── memory/                   ← Memory/search (preserved)
│
└── helix/                    ← NEW: Helix integration layer
    ├── index.ts             ← Logging, preloadSecrets(), initializeHelix()
    ├── logging-hooks.ts     ← Discord webhook integration
    ├── hash-chain.ts        ← Tamper-proof records
    ├── types.ts             ← Helix-specific types
    └── orchestration/       ← Consciousness, conductors, evaluators
```

### Hook Points (Where Helix Extends OpenClaw)

1. **entry.ts**: Startup orchestration
   - Set isolation mode
   - Run Phase 1: preloadSecrets()
   - Run Phase 2: initializeHelix()
   - Run Phase 3: runCli()

2. **plugins/loader.ts**: Plugin initialization
   - Inject EnvironmentProxy sandbox
   - Load manifests with isolation checks

3. **gateway/rpc-handlers**: Operation dispatch
   - Phase 0.5 OperationRouter routes to AI providers
   - CostTracker calculates costs
   - ApprovalQueue gates execution

4. **agents/bootstrap-hooks**: Agent initialization
   - Psychology layers loaded
   - Consciousness state embedded
   - Goal evaluator runs before agent spawns

5. **channels/discord.ts**: Logging integration
   - Pre-execution logging
   - Hash chain recording
   - Immutable audit trail

6. **helix-runtime/src/helix/**: Complete logging system
   - Replaces console with SafeConsole (log sanitizer)
   - Initializes Discord webhooks
   - Manages hash chain
   - Coordinates 7-layer psychology

---

## Part 3: Code Annotation Guide

Rules for marking integration points so Claude understands:

### Annotation Pattern 1: HELIX INTEGRATION POINT

```typescript
// HELIX INTEGRATION POINT: [Brief description]
// Why: [Why we do it this way]
// Related: [Other files that depend on this]
// Merge consideration: [What to watch when merging OpenClaw changes]

const result = helixSpecificCode();
```

**Example**:

```typescript
// HELIX INTEGRATION POINT: Isolation Mode Setup
// Why: Prevent loading global ~\.openclaw\ plugins (desktop-first strategy)
// Related: bundled-dir.ts, discovery.ts, plugins/loader.ts
// Merge consideration: Must preserve - OpenClaw doesn't have HELIX_ISOLATED_MODE
process.env.HELIX_ISOLATED_MODE = '1';
```

### Annotation Pattern 2: HELIX MODIFICATION

```typescript
// HELIX MODIFICATION: [What was changed from upstream]
// Original: [What OpenClaw did]
// Changed to: [What we do instead]
// Reason: [Why the change]

const modifiedCode = doThingDifferently();
```

**Example**:

```typescript
// HELIX MODIFICATION: Plugin environment sandboxing
// Original: Plugins get direct process.env access
// Changed to: Plugins get createPluginEnvironment(pluginId) proxy
// Reason: Security hardening - prevent unauthorized secret access
const env = createPluginEnvironment(plugin.id);
```

### Annotation Pattern 3: HELIX EXTENSION

```typescript
// HELIX EXTENSION: [What we added]
// Purpose: [Why it exists]
// Hooks into: [What OpenClaw component it extends]

const extensionCode = addNewCapability();
```

**Example**:

```typescript
// HELIX EXTENSION: Discord logging for pre-execution audit trail
// Purpose: Immutable record of all critical actions
// Hooks into: rpc-handlers execution flow
await logCommandBeforeExecution(cmd);
```

### Annotation Pattern 4: MERGE CRITICAL

```typescript
// MERGE CRITICAL: [Why this matters for OpenClaw merges]
// When OpenClaw releases [feature/fix], must ensure:
// - [Requirement 1]
// - [Requirement 2]
// Test: [How to verify compatibility]

const criticalCode = mustNotBreak();
```

**Example**:

```typescript
// MERGE CRITICAL: EnvironmentProxy must be preserved
// When OpenClaw updates plugin loader, must ensure:
// - Proxy injection still happens before plugin loads
// - api.env.* still returns proxy (not real process.env)
// Test: npm test -- src/helix/plugins/environment-proxy.test.ts
const env = createPluginEnvironment(plugin.id);
```

---

## Part 4: Critical Files Reference

For Claude's understanding, these are the integration points:

| File                                              | Purpose               | Type               | Merge Risk |
| ------------------------------------------------- | --------------------- | ------------------ | ---------- |
| `helix-runtime/src/entry.ts`                      | Startup orchestration | HELIX MODIFICATION | HIGH       |
| `helix-runtime/src/plugins/environment-proxy.ts`  | Plugin sandboxing     | HELIX EXTENSION    | HIGH       |
| `helix-runtime/src/plugins/loader.ts`             | Plugin loading        | HELIX MODIFICATION | HIGH       |
| `helix-runtime/src/hooks/loader.ts`               | Hook discovery        | HELIX MODIFICATION | MEDIUM     |
| `helix-runtime/src/helix/index.ts`                | Logging integration   | HELIX EXTENSION    | HIGH       |
| `src/helix/index.ts`                              | Logging coordinator   | HELIX EXTENSION    | HIGH       |
| `src/helix/orchestration/consciousness-loader.ts` | Psychology loading    | HELIX EXTENSION    | MEDIUM     |
| `src/helix/logging-hooks.ts`                      | Discord webhooks      | HELIX EXTENSION    | HIGH       |
| `src/helix/hash-chain.ts`                         | Integrity records     | HELIX EXTENSION    | MEDIUM     |
| `src/lib/secrets-cache-encrypted.ts`              | Secret encryption     | HELIX EXTENSION    | MEDIUM     |
| `src/lib/log-sanitizer.ts`                        | Credential redaction  | HELIX EXTENSION    | LOW        |
| `src/lib/safe-console.ts`                         | Console hijacking     | HELIX EXTENSION    | MEDIUM     |
| `src/lib/1password-audit.ts`                      | Anomaly detection     | HELIX EXTENSION    | LOW        |

---

## Part 5: OpenClaw Merge Strategy

### Sustainable Pattern for Importing Fixes

**Goal**: Benefit from OpenClaw fixes without breaking Helix integration

**Process**:

1. **Track OpenClaw Releases**
   - Monitor openclawdeveloper/clawdbot releases
   - Create issue: "Review OpenClaw vX.Y.Z for Helix compatibility"
   - Link to commit: https://github.com/openclawdeveloper/clawdbot/releases/vX.Y.Z

2. **Assess Impact**
   - Read CHANGELOG
   - Check if changes touch "Integration Map" files
   - Mark high-risk merges (entry.ts, plugins/loader, gateway)

3. **Cherry-Pick Strategy**
   - Don't do full merge (would overwrite Helix changes)
   - Cherry-pick specific commits into helix-runtime/
   - Verify annotations still apply after merge

4. **Testing**
   - Run: `npm run test`
   - Specifically: Plugin tests, logging tests, integration tests
   - Verify isolation mode still works: `HELIX_DEBUG_ISOLATION=1 npm run build`

5. **Document the Merge**
   - Create ADR if new integration pattern introduced
   - Update annotations if behavior changed
   - Commit message: `chore: port OpenClaw vX.Y.Z fix: [description]`

### Example: Merging a Plugin Loader Fix

```bash
# 1. Check OpenClaw release
git log --oneline openclawdeveloper/clawdbot | grep -i "plugin"

# 2. Identify commit to port
# e.g., "fix: improve plugin error handling (abc1234)"

# 3. Cherry-pick into helix-runtime
cd helix-runtime
git cherry-pick abc1234

# 4. Verify Helix integration points are preserved
# Check: annotations are still there
grep -r "HELIX INTEGRATION POINT" src/plugins/

# 5. Run tests
npm test -- src/helix/plugins/

# 6. Commit with documentation
git commit --amend -m "chore: port OpenClaw fix: improve plugin error handling

Ported from: openclawdeveloper/clawdbot@abc1234
Helix impact: Plugins now handle errors gracefully
Merge considerations: EnvironmentProxy still injects, isolation still works
Test: npm test -- src/helix/plugins/"
```

---

## Part 6: Documentation Maintenance

### Monthly Review

1. **Check OpenClaw releases** (monthly)
   - Subscribe to GitHub releases: openclawdeveloper/clawdbot
   - Review CHANGELOG for Helix-relevant fixes
   - Create issue if merge-worthy

2. **Verify annotations** (quarterly)
   - Grep for "HELIX INTEGRATION POINT"
   - Ensure they still apply
   - Update if code changed

3. **Test merge compatibility** (before each release)
   - Run full test suite
   - Test isolation mode: `HELIX_DEBUG_ISOLATION=1 npm run build`
   - Verify plugin environment proxy works

### When Code Changes

1. **Adding new integration**:
   - Add HELIX EXTENSION annotation
   - Document in ADR
   - Update integration map
   - Add to critical files table

2. **Modifying existing integration**:
   - Update HELIX MODIFICATION annotation
   - Document consequence in related ADR
   - Test with OpenClaw latest

3. **Removing integration**:
   - Document in ADR (consequence: deprecated)
   - Remove annotations
   - Test impact on merge strategy

---

## Summary for Claude

When working on Helix:

✅ **DO:**

- Check annotations before modifying plugin system, entry.ts, logging
- Preserve HELIX INTEGRATION POINT markers
- Run tests before merging OpenClaw changes
- Update docs if integration pattern changes

❌ **DON'T:**

- Move psychology loading out of initializeHelix()
- Remove isolation mode (even if "simplified")
- Bypass EnvironmentProxy for plugins
- Change pre-execution logging order
- Merge OpenClaw directly (cherry-pick instead)

📖 **Reference Files:**

- This file: integration strategy and ADRs
- `HELIX_TECHNICAL_SPEC.md`: Complete specification
- `PHASE-9-ADVANCED-FEATURES-REVISED.md`: Current work
- Code annotations: Inline in critical files

---

**Last Updated**: February 4, 2026
