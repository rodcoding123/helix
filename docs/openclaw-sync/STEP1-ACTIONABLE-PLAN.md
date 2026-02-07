# Step 1 - Actionable Merge Plan: OpenClaw 2026.2.1

**Objective**: Merge OpenClaw v2026.2.1 security features into Helix while preserving isolation & logging
**Current Version**: 2026.1.30 (helix-runtime/package.json line 3)
**Target**: 2026.2.3
**This Step**: Merge 2026.2.1 (first release of 3)

---

## What's Actually Changing in OpenClaw 2026.2.1

Based on detailed source analysis, here are the **actual files** that changed:

### Priority 1: CRITICAL - Environment Variable Blocking (PR #4896)

**File**: `src/agents/bash-tools.exec.ts`
**Change**: Added `validateHostEnv()` to block dangerous env vars during command execution
**Blocked Vars**: LD*PRELOAD, LD_AUDIT, GCONV_PATH, SSLKEYLOGFILE, DYLD*\*, NODE_OPTIONS, PYTHONPATH, PATH (on gateway/node hosts)

**Helix Action**: ✅ ALREADY COMPATIBLE

- Helix's EnvironmentProxy (environment-proxy.ts) blocks at plugin level
- OpenClaw's blocking validates at exec level
- Both layers work together → Defense in depth
- **NO CODE CHANGE NEEDED** - Just merge as-is

**Merge Steps**:

```bash
# Copy src/agents/bash-tools.exec.ts from OpenClaw v2026.2.1
cp /tmp/openclaw-merge/src/agents/bash-tools.exec.ts helix-runtime/src/agents/bash-tools.exec.ts

# Verify Helix imports still present:
# - Line 8-11: logCommandPreExecution import
# - Line 402-405: logCommandPostExecution import
# - Helix logging should fire BEFORE validateHostEnv
```

**Test**:

```bash
npm run test -- --grep "exec|command|bash"
# Expected: All tests pass, Helix pre-execution logging works
```

---

### Priority 2: CRITICAL - Message Tool Path Validation (PR #6398)

**Files**:

- `src/agents/tools/message-tool.ts` (main change)
- `src/agents/openclaw-tools.ts` (tool registration)
- `src/agents/tools/message-tool.test.ts` (tests)

**Change**: Validates file paths against sandbox root, prevents `../` traversal

**Helix Impact**: HIGH

- Helix uses message tools in agent conversations
- Path validation adds security layer
- **May conflict** if Helix has custom message tool handling

**Merge Steps**:

1. Check if Helix customizes message-tool.ts:

   ```bash
   grep -r "message-tool\|messageToString\|createMessageTool" helix-runtime/src/agents/
   ```

2. If NO customizations found:

   ```bash
   # Copy files from OpenClaw v2026.2.1
   cp /tmp/openclaw-merge/src/agents/tools/message-tool.ts helix-runtime/src/agents/tools/
   cp /tmp/openclaw-merge/src/agents/openclaw-tools.ts helix-runtime/src/agents/
   cp /tmp/openclaw-merge/src/agents/tools/message-tool.test.ts helix-runtime/src/agents/tools/
   ```

3. If Helix HAS customizations:
   ```bash
   # Manual merge required
   # Find the assertSandboxPath() calls in OpenClaw version
   # Integrate into Helix's custom implementation
   # Preserve all Helix-specific logging/behavior
   ```

**Test**:

```bash
npm run test -- --grep "message|tool|sandbox"
# Expected: Path validation tests pass, no unauthorized paths allowed
```

---

### Priority 3: MEDIUM - Gateway Timestamp Injection (PR #3705)

**Files**:

- `src/server-methods/agent.ts`
- `src/server-methods/chat.ts`
- `src/auto-reply/envelope.ts` (exports formatZonedTimestamp)

**Change**: Injects formatted timestamps into messages for audit trail

**Helix Impact**: MEDIUM

- Helix gateway uses OpenClaw server methods
- Timestamps improve audit trail quality
- Coordinates with Helix's Discord logging timestamps

**Merge Steps**:

1. Check for Helix customizations:

   ```bash
   grep -r "formatZonedTimestamp\|injectTimestamp\|envelope" helix-runtime/src/
   ```

2. If NO customizations:

   ```bash
   # Copy files
   cp /tmp/openclaw-merge/src/server-methods/agent.ts helix-runtime/src/server-methods/
   cp /tmp/openclaw-merge/src/server-methods/chat.ts helix-runtime/src/server-methods/
   cp /tmp/openclaw-merge/src/auto-reply/envelope.ts helix-runtime/src/auto-reply/
   ```

3. If Helix HAS customizations:
   ```bash
   # Merge timestamp logic while preserving Helix extensions
   # Ensure Helix logging timestamps align with injected timestamps
   ```

**Test**:

```bash
npm run test -- --grep "timestamp|gateway"
# Expected: Timestamps injected, formatted correctly
```

---

### Priority 4: LOW - Plugin Installation Path Validation (PR #5335 concept)

**Files**: `src/cli/plugins.ts`, `src/cli/hooks.ts`, `src/plugins/installer.ts`

**Change**: Validates install paths, prevents `../` traversal in plugin names

**Helix Impact**: LOW

- Helix uses bundled plugins only (isolation mode)
- Plugin installation validation is a CLI feature
- Won't break Helix's isolated mode

**Merge Steps**:

1. Determine if Helix needs custom plugin installation:

   ```bash
   # If Helix users never install plugins (bundled only), can skip this
   # If Helix exposes plugin installation UI, merge it
   ```

2. If merging:
   ```bash
   cp /tmp/openclaw-merge/src/cli/plugins.ts helix-runtime/src/cli/
   cp /tmp/openclaw-merge/src/plugins/installer.ts helix-runtime/src/plugins/
   ```

**Test**:

```bash
npm run test -- --grep "plugin|install|validation"
# Expected: Plugin paths validated, traversal prevented
```

---

### Skip These (Not Applicable to Helix)

**TLS 1.3 Enforcement** (`src/infra/tls/gateway.ts`)

- Reason: Helix gateway uses WebSocket (ws://) not TLS
- Action: Skip

**System Prompt Guardrails** (`src/agents/system-prompt.ts`)

- Reason: Helix has own HELIX_SOUL.md psychological system
- Action: Skip

**WhatsApp Path Sanitization** (`src/web/accounts.ts`)

- Reason: Helix doesn't use WhatsApp channel
- Action: Skip

**Lobster Tool Protection** (`extensions/lobster/src/lobster-tool.ts`)

- Reason: Helix doesn't use Lobster
- Action: Skip

**MEDIA Path Validation** (`src/media/parse.ts`)

- Reason: Check if Helix processes media - if yes, merge; if no, skip
- Action: Review, likely skip

---

## Helix-Specific Code - Verification Checklist

Before and after merge, verify these critical Helix components still work:

### Critical Isolation Components

```bash
# 1. Verify HELIX_ISOLATED_MODE is still set
HELIX_DEBUG_ISOLATION=1 node helix-runtime/openclaw.mjs doctor
# Expected output contains:
# [helix-isolation] Enabled - preventing global plugin discovery
# ISOLATED_MODE=1

# 2. Verify bundled plugins are discovered
node helix-runtime/openclaw.mjs doctor | grep -A 20 "Bundled"
# Expected: Shows helix-runtime/extensions plugins

# 3. Verify NO global plugins discovered
node helix-runtime/openclaw.mjs doctor | grep "~/.openclaw/extensions" || echo "✓ Global plugins blocked"
# Expected: Line NOT found (plugins blocked)

# 4. Verify environment proxy still works
npm run test helix-runtime/src/plugins/environment-proxy.test.ts
# Expected: 50+ tests pass
```

### Critical Logging Components

```bash
# 1. Verify pre-execution logging still fires
npm run test -- --grep "command|api|log"
# Expected: All logging tests pass

# 2. Verify Discord webhooks work
npm run test -- --grep "webhook|discord"
# Expected: All 7 channels functional

# 3. Verify heartbeat still pings
npm run test -- --grep "heartbeat"
# Expected: Heartbeat tests pass
```

### Preserved Helix Files

```bash
# These should NOT change during merge
git diff helix-runtime/src/helix/
git diff helix-runtime/src/plugins/environment-proxy.ts
git diff helix-runtime/src/plugins/bundled-dir.ts
git diff helix-runtime/src/plugins/discovery.ts (just isolation check)
git diff helix-runtime/src/entry.ts (just preservation lines)
# Expected: No diff (only additions, no modifications to Helix code)
```

---

## Actual Merge Commands

### Step 1: Create Feature Branch

```bash
cd /path/to/helix
git checkout -b feature/openclaw-2026.2.1
```

### Step 2: Get OpenClaw Source

```bash
# If you don't have OpenClaw repo cloned
git clone https://github.com/openclaw/openclaw.git /tmp/openclaw-2026
cd /tmp/openclaw-2026
git checkout v2026.2.1

# Or if already cloned
cd /tmp/openclaw-2026
git fetch origin
git checkout v2026.2.1
```

### Step 3: Merge Key Files

```bash
# CRITICAL: Environment variable blocking (align with EnvironmentProxy)
cp /tmp/openclaw-2026/src/agents/bash-tools.exec.ts helix-runtime/src/agents/bash-tools.exec.ts

# CRITICAL: Message tool path validation
cp /tmp/openclaw-2026/src/agents/tools/message-tool.ts helix-runtime/src/agents/tools/
cp /tmp/openclaw-2026/src/agents/openclaw-tools.ts helix-runtime/src/agents/
cp /tmp/openclaw-2026/src/agents/tools/message-tool.test.ts helix-runtime/src/agents/tools/

# MEDIUM: Gateway timestamp injection
cp /tmp/openclaw-2026/src/server-methods/agent.ts helix-runtime/src/server-methods/
cp /tmp/openclaw-2026/src/server-methods/chat.ts helix-runtime/src/server-methods/
cp /tmp/openclaw-2026/src/auto-reply/envelope.ts helix-runtime/src/auto-reply/

# Update version
sed -i 's/"version": "2026.1.30"/"version": "2026.2.1"/' helix-runtime/package.json
```

### Step 4: Validate Helix Preservation

```bash
cd /path/to/helix

# Check that Helix code is preserved
git diff helix-runtime/src/entry.ts
# Should show ONLY additions, isolation lines untouched

git diff helix-runtime/src/plugins/discovery.ts
# Should show ONLY additions, isolation check untouched

git diff helix-runtime/src/plugins/bundled-dir.ts
# Should show ONLY additions, isolation check untouched

git diff helix-runtime/src/helix/
# Should show NO changes (all new files or no changes)
```

### Step 5: Run Tests

```bash
# Build
npm run build

# Type check
npm run typecheck

# Test critical systems
npm run test -- --grep "isolation|plugin|environment|webhook|discord"

# Full suite
npm run quality
```

### Step 6: Verify Isolation

```bash
# Test isolation mode
HELIX_DEBUG_ISOLATION=1 node helix-runtime/openclaw.mjs doctor

# Verify output
# Expected lines:
# [helix-isolation] Enabled - preventing global plugin discovery
# Helix root: /path/to/helix
# State dir: /path/to/helix/.helix-state
# Plugins dir: /path/to/helix/helix-runtime/extensions
```

### Step 7: Commit

```bash
git add helix-runtime/

git commit -m "feat(openclaw): merge 2026.2.1 security foundation

Security improvements:
- Environment variable hardening (LD*, DYLD* blocking)
- Message tool path traversal prevention
- Gateway timestamp injection for audit trails

Helix preservation:
- Isolation mode (HELIX_ISOLATED_MODE) intact
- Bundled plugin discovery working
- Global plugin blocking confirmed
- Pre-execution logging preserved
- All 7 Discord webhooks functional

Testing:
- All security tests pass
- Isolation verified with HELIX_DEBUG_ISOLATION=1
- EnvironmentProxy still blocks 50+ secret patterns
- No regressions in existing functionality"
```

---

## Troubleshooting

### If bash-tools.exec.ts fails to merge

**Issue**: Helix logging imports might be in different location

**Solution**:

1. Check import location in current file
2. Merge validateHostEnv() function separately
3. Preserve Helix imports (logCommandPreExecution, logCommandPostExecution)

### If message-tool.ts conflicts

**Issue**: Helix might have custom message tool implementation

**Solution**:

1. Check for assertSandboxPath() usage pattern
2. Apply same validation to Helix's custom version
3. Test with `npm run test -- --grep "message"`

### If isolation mode breaks

**Issue**: Entry.ts or discovery.ts may have changed unexpectedly

**Solution**:

1. Revert to previous version
2. Check git diff for unexpected changes to isolation blocks
3. Manually re-apply only OpenClaw improvements (non-isolation)

---

## Success Criteria for Step 1

✅ All of the following must pass:

```bash
# 1. Build succeeds
npm run build

# 2. Isolation mode enabled
HELIX_DEBUG_ISOLATION=1 node helix-runtime/openclaw.mjs doctor | grep "Enabled"

# 3. No global plugins
! (node helix-runtime/openclaw.mjs doctor | grep "~/.openclaw/extensions")

# 4. Tests pass
npm run test -- --grep "isolation|plugin|environment|webhook"

# 5. Discord logging works
npm run test -- --grep "discord|webhook|channel"

# 6. Pre-execution logging works
npm run test -- --grep "command|api|log"

# 7. Environment proxy active
npm run test helix-runtime/src/plugins/environment-proxy.test.ts

# 8. Full quality check
npm run quality
```

---

## Next: Step 2

After Step 1 passes all tests:

- **2026.2.2** merge (SSRF checks + Windows hardening)
- **2026.2.3** merge (Telegram + Cloudflare)
- **Phase 3** comprehensive testing

---

**Status**: Ready to execute
**Effort**: 1-2 hours (careful merge + testing)
**Risk**: LOW (all Helix preservation documented & tested)

_Phase 2, Step 1 Actionable Plan_
_Updated: 2026-02-05_
