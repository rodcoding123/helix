# Step 1 Merge Guide: OpenClaw 2026.2.1

**Current Version**: 2026.1.30
**Target Version**: 2026.2.1
**Helix Status**: Custom isolation + logging integrated into helix-runtime

---

## Integration Architecture

Helix has an **integrated copy of OpenClaw** in `helix-runtime/`, not a npm dependency. This means:

✅ **We own the entire source** - can apply changes directly
⚠️ **Must preserve Helix customizations** - identified and documented
❌ **Cannot rely on npm package updates** - must merge manually

---

## Helix-Specific Code That MUST Be Preserved

### CRITICAL FILES (Defense-in-Depth Security)

#### 1. `helix-runtime/src/entry.ts` (Lines 16-55 + 197-227)

**Critical Code - DO NOT OVERWRITE:**

```typescript
// Lines 16-19: Isolation mode constant
const ISOLATED_MODE_VALUE = '1';
const DEBUG_ISOLATION = process.env.HELIX_DEBUG_ISOLATION === '1';

// Lines 24-47: Force isolated mode at STARTUP (CRITICAL SECURITY)
if (!process.env.HELIX_ISOLATED_MODE) {
  process.env.HELIX_ISOLATED_MODE = ISOLATED_MODE_VALUE;
  process.env.OPENCLAW_STATE_DIR = pathModule.join(helixRoot, '.helix-state');
  process.env.OPENCLAW_BUNDLED_PLUGINS_DIR = pathModule.join(runtimeRoot, 'extensions');
  // ... rest of setup
}

// Lines 197-227: Helix initialization
const helixInit = async () => {
  const { initializeHelix, shutdownHelix } = await import('./helix/index.js');
  await initializeHelix(); // Discord webhooks + heartbeat
  // ... signal handlers
};
helixInit().then(() => import('./cli/run-main.js'));
```

**Merge Strategy**:

- If OpenClaw 2026.2.1 changes entry.ts for respawn logic/experimental warnings → MERGE THAT
- The Helix isolation block (lines 24-47) goes BEFORE OpenClaw respawn logic
- The Helix init (lines 197-227) goes BEFORE OpenClaw CLI run
- Result: Both isolation AND OpenClaw improvements work

**Test After Merge**:

```bash
HELIX_DEBUG_ISOLATION=1 node helix-runtime/openclaw.mjs doctor
# Expected: ISOLATED_MODE=1, state/plugin dirs correct, bundled plugins only
```

---

#### 2. `helix-runtime/src/plugins/discovery.ts` (Lines 347-358)

**Critical Code - DO NOT OVERWRITE:**

```typescript
// Line 348: Check isolation mode
const isolatedMode = process.env.HELIX_ISOLATED_MODE === ISOLATED_MODE_VALUE;
if (!isolatedMode) {
  // Only discover global plugins if NOT in isolation mode
  const globalDir = path.join(resolveConfigDir(), 'extensions');
  discoverInDirectory({
    dir: globalDir,
    origin: 'global',
    // ...
  });
}
```

**Merge Strategy**:

- This is the second layer of plugin isolation
- If OpenClaw 2026.2.1 changes plugin discovery → MERGE THAT
- Preserve the `isolatedMode` check (layer 2 of defense)
- Result: Both OpenClaw improvements AND Helix isolation work

**Test After Merge**:

```bash
node helix-runtime/openclaw.mjs doctor
# Expected: BUNDLED plugin count = Helix's actual bundled plugins
# Expected: No GLOBAL plugins listed
```

---

#### 3. `helix-runtime/src/plugins/bundled-dir.ts` (Lines 5-23)

**Critical Code - DO NOT OVERWRITE:**

```typescript
// Line 6: Must match entry.ts line 18
const ISOLATED_MODE_VALUE = '1';

// Lines 15-23: Stop directory walking in isolated mode
if (process.env.HELIX_ISOLATED_MODE === ISOLATED_MODE_VALUE) {
  const thisModuleDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(thisModuleDir, '..', '..');
  const candidate = path.join(projectRoot, 'extensions');
  if (fs.existsSync(candidate)) {
    return candidate; // Don't walk up!
  }
  return undefined;
}
```

**Merge Strategy**:

- This is the first layer of plugin isolation (prevents tree-walking)
- OpenClaw 2026.2.1 might improve the bundled plugin discovery
- Preserve the isolation check at line 15
- Merge any OpenClaw improvements to non-isolated path (lines 26-54)

**Test After Merge**:

```bash
HELIX_ISOLATED_MODE=1 node -e "import('./helix-runtime/src/plugins/bundled-dir.ts').then(m => console.log(m.resolveBundledPluginsDir()))"
# Expected: /path/to/helix-runtime/extensions
```

---

#### 4. `helix-runtime/src/plugins/environment-proxy.ts` (Complete File - ~200 lines)

**Critical Code - Entire File DO NOT OVERWRITE:**

This file blocks plugin access to sensitive environment variables (DISCORD*, STRIPE*, AWS\*, etc.).

**Merge Strategy**:

- This file is Helix-specific, won't be touched by OpenClaw updates
- No merge conflicts expected
- No action needed

**Test After Merge**:

```bash
npm run test helix-runtime/src/plugins/environment-proxy.test.ts
# Expected: 50+ tests pass, secrets blocked, legitimate vars allowed
```

---

#### 5. `helix-runtime/src/plugins/loader.ts` (Line 218)

**Critical Code - DO NOT OVERWRITE:**

```typescript
// Line 218: HELIX legacy compatibility alias
"clawdbot/plugin-sdk": pluginSdkAlias, // HELIX: Legacy alias for backward compat
```

**Merge Strategy**:

- If OpenClaw 2026.2.1 changes loader.ts → MERGE THAT
- Preserve this single line (line 218) for backward compatibility
- This allows legacy plugins using `clawdbot/plugin-sdk` imports to work

---

### HELIX SUBSYSTEMS (Entirely New - Safe During Merge)

#### 6. `helix-runtime/src/helix/` (31 files)

This entire directory is Helix-specific. It won't conflict with OpenClaw updates.

**No action needed during merge** - OpenClaw won't touch these.

**Files** (for reference):

- Core: index.ts, types.ts, discord-webhook.ts, logging.ts
- Logging: command-logger.ts, api-logger.ts, heartbeat.ts
- Context: context-loader.ts
- Advanced: hash-chain.ts, skill-sandbox.ts, skill-chaining.ts, etc.

---

#### 7. Helix Hooks in Agent Files

**Three files have Helix logging hooks** (won't conflict):

- `helix-runtime/src/agents/anthropic-payload-log.ts` - Pre-flight API logging
- `helix-runtime/src/agents/bash-tools.exec.ts` - Pre/post-execution logging
- `helix-runtime/src/agents/bootstrap-files.ts` - Consciousness architecture loader

**No action needed** - OpenClaw changes to these files will be visible during merge. If there are conflicts, resolve by keeping both Helix imports AND OpenClaw changes.

---

## Expected Changes in OpenClaw 2026.2.1

Based on release notes, these are the changes we expect:

### System Prompt Safety Guardrails

**Expected in**: `src/agents/` or similar
**Impact**: New agent initialization parameter
**Helix action**: No conflict expected - purely additive

### TLS 1.3 Enforcement

**Expected in**: `src/infra/` or connection code
**Impact**: Minimum TLS version set to 1.3
**Helix action**: No conflict - applies to all HTTPS connections (including Discord webhooks)

### Plugin Path Validation

**Expected in**: `src/plugins/loader.ts`
**Potential conflict**: If loader.ts changes
**Helix action**: If conflict, preserve both plugin path validation AND Helix's legacy alias (line 218)

### File Path Traversal Prevention

**Expected in**: `src/utils/` or file operation code
**Impact**: Validates file paths before operations
**Helix action**: No conflict - applies to all file operations including those in helix-runtime/src/helix/

### Gateway Timestamp Injection

**Expected in**: `src/gateway/` or message construction
**Impact**: Adds timestamp to gateway messages
**Helix action**: No conflict - improves audit trails for all messages

---

## Merge Checklist

### Pre-Merge Preparation

- [ ] Backup current state: `git stash`
- [ ] Create feature branch: `git checkout -b feature/openclaw-2026.2.1`
- [ ] Verify current version: Check helix-runtime/package.json shows 2026.1.30

### Identify Changes

You'll need access to OpenClaw repository:

```bash
# Clone OpenClaw repo (if not already done)
git clone https://github.com/openclaw/openclaw.git /tmp/openclaw-merge

# Compare versions
cd /tmp/openclaw-merge
git log --oneline v2026.1.30..v2026.2.1

# Get specific file changes
git diff v2026.1.30..v2026.2.1 -- src/plugins/discovery.ts
git diff v2026.1.30..v2026.2.1 -- src/infra/
git diff v2026.1.30..v2026.2.1 -- src/plugins/loader.ts
# ... etc
```

### Apply Changes

For each changed OpenClaw file:

1. **If file is in preservation list** → Careful merge:

   ```
   File: helix-runtime/src/entry.ts
   - Keep Helix isolation block (lines 16-47)
   - Keep Helix init (lines 197-227)
   - Merge OpenClaw changes around them
   ```

2. **If file is NOT in preservation list** → Regular merge:

   ```
   File: helix-runtime/src/utils/some-new-file.ts
   - Copy entire file from OpenClaw v2026.2.1
   ```

3. **If file is Helix-specific** → Skip:
   ```
   File: helix-runtime/src/helix/index.ts
   - Don't update (entirely Helix)
   ```

### Validate After Merge

- [ ] `npm run typecheck` - No type errors
- [ ] `npm run test -- --grep "isolation|plugin"` - Isolation tests pass
- [ ] `HELIX_DEBUG_ISOLATION=1 node helix-runtime/openclaw.mjs doctor` - Isolation working
- [ ] `npm run test helix-runtime/src/plugins/environment-proxy.test.ts` - Security intact
- [ ] `npm run test -- --grep "webhook|Discord"` - Discord logging intact

### Commit Changes

```bash
git add helix-runtime/package.json
git add helix-runtime/src/
git commit -m "feat(openclaw): merge 2026.2.1 security fixes

- TLS 1.3 enforcement
- Plugin path validation
- File path traversal prevention
- System prompt guardrails
- Gateway timestamp injection
- Preserves Helix isolation mode + logging infrastructure

Isolation mode: verified working
Plugin discovery: bundled-only confirmed
Discord webhooks: all 7 channels tested"
```

---

## Files to Watch During Merge

These files are most likely to change in 2026.2.1:

| File                                     | Change Type         | Helix Impact              |
| ---------------------------------------- | ------------------- | ------------------------- |
| helix-runtime/src/plugins/loader.ts      | Plugin validation   | Preserve line 218         |
| helix-runtime/src/plugins/discovery.ts   | Discovery logic     | Preserve isolation check  |
| helix-runtime/src/plugins/bundled-dir.ts | Resolution logic    | Preserve isolation check  |
| helix-runtime/src/entry.ts               | Startup logic       | Preserve isolation + init |
| helix-runtime/src/infra/                 | TLS enforcement     | Safe to merge             |
| helix-runtime/src/utils/                 | Path validation     | Safe to merge             |
| helix-runtime/src/gateway/               | Timestamp injection | Safe to merge             |
| helix-runtime/src/agents/                | System prompts      | Watch for conflicts       |

---

## Rollback Plan

If merge causes problems:

```bash
# Revert to pre-merge state
git reset --hard HEAD~1

# Or go back to 2026.1.30
git checkout HEAD -- helix-runtime/
npm install
```

---

## Next: Step 2

After Step 1 validation passes, proceed to **2026.2.2** (SSRF checks + Windows hardening).

---

**Status**: Ready to merge when you have OpenClaw repository access
**Effort**: ~1-2 hours for careful merge + testing
**Risk**: LOW (all conflicts are expected and documented)

_Created: 2026-02-05_
_Phase 2, Step 1_
