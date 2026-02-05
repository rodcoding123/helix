# Helix Integration Points - Critical Files Reference

**Source**: OPENCLAW-INTEGRATION-STRATEGY.md (ADRs 1-6)
**Purpose**: Guide sub-agents in detecting Helix conflicts with OpenClaw changes
**Last Updated**: February 5, 2026

---

## HIGH RISK Files (Merge Risk: RED 🔴)

These files implement core Helix innovations that MUST be preserved.

### 1. `helix-runtime/src/entry.ts`

**Why Critical**:

- Orchestrates two-phase initialization (ADR-5)
- Hardcodes `HELIX_ISOLATED_MODE=1` (ADR-2)
- Calls `preloadSecrets()` BEFORE `initializeHelix()` (ADR-5)
- Entry point for entire system

**Helix Modifications**:

```
HELIX_ISOLATED_MODE=1         # ADR-2: Hardcoded, not overridable
HELIX_STATE_DIR=.helix-state/ # ADR-2: Isolation specific
preloadSecrets()              # ADR-5: Must run first
initializeHelix()             # ADR-5: Runs after secrets loaded
```

**Merge Risk**: If OpenClaw changes startup sequence, isolation mode may break
**Action**: Manual review required for any entry.ts changes

---

### 2. `helix-runtime/src/plugins/loader.ts`

**Why Critical**:

- Loads plugins from bundled directory (ADR-2)
- Injects EnvironmentProxy into each plugin (ADR-3)
- Skips global `~/.openclaw/extensions/` due to isolation (ADR-2)
- Pre-execution logging hooks called here (ADR-4)

**Helix Modifications**:

```
createJiti({ isolated: true })           # ADR-2: Isolation gating
createPluginEnvironment()                # ADR-3: Inject proxy
api.env = new EnvironmentProxy()         # ADR-3: Sandbox plugins
logCommandPreExecution()                 # ADR-4: Discord logging
```

**Merge Risk**: Plugin discovery refactors will conflict
**Action**: Verify proxy injection preserved after merge

---

### 3. `helix-runtime/src/plugins/environment-proxy.ts`

**Why Critical**:

- NEW FILE in Helix (doesn't exist in upstream OpenClaw!)
- Blocks plugins from accessing process.env (security hardening)
- Allows graceful degradation (plugins see undefined, don't crash)
- Part of Phase 1A Security Hardening

**Helix Modifications**:

```
class EnvironmentProxy {
  get(target, prop) {
    // Block patterns: API_KEY, SECRET, TOKEN, etc.
    if (isSecretPattern(prop)) {
      logToDiscord(`Blocked: ${prop}`)
      return undefined
    }
    return process.env[prop]
  }
}
```

**Merge Risk**: Cannot be deleted; critical for security
**Action**: Must always be present after any merge

---

## MEDIUM RISK Files (Merge Risk: YELLOW 🟡)

Important integrations but less critical than HIGH RISK files.

### 4. `helix-runtime/src/hooks/loader.ts`

**Helix Modification**: Pre-execution logging hooks (ADR-4)
**Merge Risk**: MEDIUM - If hook system changes, logging may fail
**Action**: Verify hooks still register after merge

### 5. `helix-runtime/src/gateway/rpc-handlers/*`

**Helix Modification**: Discord logging integration (ADR-4)
**Merge Risk**: MEDIUM - If RPC signatures change, logging integration breaks
**Action**: Test RPC handlers after merge

### 6. `helix-runtime/src/agents/bash-tools.exec.ts`

**Helix Modification**: Pre-execution logging for bash commands (ADR-4)
**Merge Risk**: MEDIUM - If bash tool signature changes, logging hooks break
**Action**: Verify bash tools logging still fires

---

## LOW RISK Files (Merge Risk: GREEN 🟢)

These can usually be merged directly.

### 7. `helix-runtime/src/plugins/discovery.ts`

**Why Safe**: Plugin discovery is independent, no Helix modifications

### 8. `helix-runtime/src/channels/discord.ts`

**Why Safe**: Channel implementation, used by Helix but not modified

---

## Helix-Unique (NEVER in Upstream)

These files don't exist in OpenClaw, so no merge conflicts:

```
src/helix/                      # All Helix modules
src/lib/secrets-cache-encrypted.ts
src/lib/log-sanitizer.ts
src/lib/1password-audit.ts
helix-desktop/                  # Desktop app
web/                            # Web app (React)
ios/                            # iOS app (SwiftUI)
android/                        # Android app (Jetpack Compose)
```

---

## Architectural Decision Records (ADRs)

These guide conflict detection:

| ADR   | Decision                   | Files                                      | Impact                   |
| ----- | -------------------------- | ------------------------------------------ | ------------------------ |
| ADR-2 | Isolation Mode Hardcoded   | entry.ts, discovery.ts                     | Cannot be overridden     |
| ADR-3 | EnvironmentProxy Injection | plugins/loader.ts, environment-proxy.ts    | Must be preserved        |
| ADR-4 | Pre-Execution Logging      | hooks/loader.ts, agents/bash-tools.exec.ts | Must not break           |
| ADR-5 | Two-Phase Init             | entry.ts, index.ts                         | Strict sequence required |

---

## Conflict Detection Rules

When analyzing OpenClaw changes:

1. **If touches entry.ts** → Check isolation mode preserved → Mark HIGH
2. **If touches plugins/loader.ts** → Check proxy injection preserved → Mark HIGH
3. **If creates plugin API changes** → Check environment-proxy still injects → Mark HIGH
4. **If changes hook system** → Check pre-execution hooks still fire → Mark MEDIUM
5. **If touches RPC handlers** → Check Discord logging still works → Mark MEDIUM
6. **If changes are to unmodified files** → Mark LOW (usually safe)

---

## Questions for Sub-Agents

When analyzing a release:

1. **Does it touch any HIGH RISK file?** → Mark risk level RED
2. **Does it touch any MEDIUM RISK file?** → Mark risk level YELLOW
3. **Does it mention "breaking" or "API change"?** → Review carefully
4. **Does it touch isolation, plugins, or logging?** → Manual review required
5. **When unsure?** → Mark HIGH risk (fail-closed)

---

## Example Analysis

**OpenClaw Release: v2026.2.10 - Plugin Discovery Refactor**

Changelog excerpt: "Complete rewrite of plugin discovery system for improved performance"

**Analysis**:

1. Touches: `helix-runtime/src/plugins/loader.ts` (HIGH RISK) ✗
2. Mentions: "plugin discovery" (ADR-2 related) ✗
3. Contains: Breaking changes likely (refactor) ✗
4. Risk: 🔴 HIGH (automatic)
5. Action: Manual review - verify isolation mode not broken

**Recommendation**: PARTIAL_MERGE or SKIP depending on exact changes

---

**Reference**: See docs/architecture/OPENCLAW-INTEGRATION-STRATEGY.md for full ADRs
