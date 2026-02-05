# Phase 2 Execution Plan: Selective Integration

**Status**: Ready to Execute
**Current OpenClaw Version**: 2026.1.30
**Target Version**: 2026.2.3
**Merge Strategy**: Incremental with validation between each step

---

## Overview

Phase 2 merges OpenClaw 2026.2.1, 2026.2.2, and 2026.2.3 into Helix using a **three-step incremental approach** with testing validation between each step. QMD backend is explicitly skipped.

**Total Scope**: ~59 files modified
**Estimated Effort**: 4-6 hours (investigation already complete)
**Risk Level**: LOW (zero blockers, compatible architecture)

---

## Step 1: 2026.2.1 Foundation (Security-First)

**Duration**: ~1-2 hours
**Risk**: LOW

### What We're Merging

Security hardening for plugin isolation and transport:

- System prompt safety guardrails
- TLS 1.3 minimum requirement enforcement
- Plugin path validation
- File path traversal prevention
- Gateway timestamp injection

### What We're NOT Merging

- Environment variable override blocking: No separate action needed (already compatible, applied at runtime)

### Merge Checklist

- [ ] Backup current OpenClaw version
- [ ] Create git branch: `feature/openclaw-2026.2.1`
- [ ] Identify OpenClaw 2026.2.1 changes vs 2026.1.30
  - Check package.json versions
  - Review CHANGELOG for breaking changes
  - Identify files that affect: helix-runtime/src/entry.ts, helix-runtime/src/plugins/, src/helix/
- [ ] Merge in changes:
  - TLS 1.3 enforcement (likely in utils or connection code)
  - Plugin path validation (plugins/loader.ts area)
  - File traversal prevention (likely in utils)
  - System prompt guards (OpenClaw core)
  - Gateway timestamp (gateway-related)
- [ ] **DO NOT** merge QMD backend (skip entirely)
- [ ] Update helix-runtime/package.json OpenClaw version

### Validation

```bash
# Run full test suite
npm run quality

# Verify isolation mode still works
HELIX_DEBUG_ISOLATION=1 node helix-runtime/openclaw.mjs doctor
# Expected: ISOLATED_MODE=1, correct state/plugin dirs, bundled plugins only

# Verify Discord webhooks
npm run test -- --grep "webhook|Discord"
# Expected: All 7 channel tests pass

# Verify security features
npm run test -- --grep "tls|traversal|sanitizer"
# Expected: All security tests pass
```

### Success Criteria

✅ All tests pass
✅ HELIX_ISOLATED_MODE=1 confirmed
✅ Global plugins blocked
✅ All 7 Discord webhooks functional
✅ Security tests passing

---

## Step 2: 2026.2.2 Critical Security (Largest Release)

**Duration**: ~2-3 hours
**Risk**: LOW (SSRF/exec hardening are isolated features)

### What We're Merging

- **SSRF checks** - Critical security fix
- **Windows exec hardening** - Platform protection
- **Matrix allowlists** - Permission framework
- **Healthcheck skill** - System diagnostics
- Agent tool calls repair - Reliability
- Session transcripts repair - Data integrity
- Chat layout refinements - UX

### What We're NOT Merging

- **QMD Backend**: Explicitly skip all QMD-related code
- **Feishu/Lark plugin**: Not using
- **Agents dashboard UI**: Helix has more advanced version

### Merge Checklist

- [ ] Create git branch: `feature/openclaw-2026.2.2` (from 2026.2.1 branch)
- [ ] Merge SSRF checks
  - Identify where exec tool validation occurs
  - Should NOT affect helix-runtime/src/entry.ts (our setup is before exec)
  - Verify validateHostEnv doesn't block process.env setup
- [ ] Merge Windows exec hardening
  - May interact with normalizeWindowsArgv (entry.ts:113-178)
  - Test on Windows specifically
- [ ] Merge Matrix allowlists (permission framework)
  - Likely in plugins/loader.ts
  - Verify doesn't conflict with EnvironmentProxy
- [ ] Merge agent tool call repairs
  - May touch orchestration/ or gateway code
- [ ] Merge session transcript repairs
  - May touch gateway or memory-related code
- [ ] **SKIP**: QMD backend entirely
  - Don't merge memory-related QMD files
  - Don't add QMD configuration
  - Don't update memory initialization for QMD
- [ ] Update helix-runtime/package.json OpenClaw version

### Validation

```bash
# Run full test suite
npm run quality

# Test SSRF checks don't block Discord webhooks
npm run test -- --grep "webhook|Discord"
# Expected: All pass

# Test environment variables still work
npm run test environment-proxy.test.ts
# Expected: 50+ tests pass, secrets blocked, legitimate vars allowed

# Test isolation still functional
HELIX_DEBUG_ISOLATION=1 node helix-runtime/openclaw.mjs doctor
# Expected: Previous checks still pass

# Test Windows compatibility (if on Windows)
npm run test -- --grep "windows|win32"
# Expected: Platform-specific tests pass

# Test exec tool doesn't block legitimate commands
# (Create simple test: echo hello with no dangerous env vars)
npm run test -- --grep "exec|command"
# Expected: Safe commands execute
```

### Success Criteria

✅ All tests pass (including 2026.2.1 tests)
✅ SSRF checks don't interfere with Discord webhooks
✅ EnvironmentProxy still blocks secrets
✅ Isolation mode functional
✅ Windows exec hardening doesn't break commands
✅ Healths checks/matrix allowlists working

---

## Step 3: 2026.2.3 New Features (Minor Release)

**Duration**: ~1-2 hours
**Risk**: LOW (mostly new/isolated features)

### What We're Merging

- **Cloudflare AI Gateway Provider** - New provider option
- **Telegram TypeScript Plugin** - Type-safe messaging
- **Gateway credential handling improvements** - Security
- **Message attachment security** - File upload protection
- Chinese (zh-CN) translations - Optional, skip if not needed

### What We're NOT Merging

- **QMD Backend**: Still don't merge (confirmed in Step 2)

### Merge Checklist

- [ ] Create git branch: `feature/openclaw-2026.2.3` (from 2026.2.2 branch)
- [ ] Merge Cloudflare AI Gateway provider
  - Likely additive code in gateway/providers or similar
  - Verify doesn't conflict with existing providers
- [ ] Merge Telegram TypeScript plugin
  - Check plugin structure, type safety improvements
  - Verify loads with EnvironmentProxy
- [ ] Merge gateway credential handling improvements
  - May interact with EncryptedSecretsCache
  - Verify credentials aren't duplicated/conflicted
  - Check gateway-connection.ts compatibility
- [ ] Merge message attachment security
  - Verify LogSanitizer handles attachments
  - Test file upload paths
- [ ] Skip Chinese translations (optional, can add later)
- [ ] Update helix-runtime/package.json OpenClaw version

### Validation

```bash
# Run full test suite
npm run quality

# Verify previous steps still pass
HELIX_DEBUG_ISOLATION=1 node helix-runtime/openclaw.mjs doctor
npm run test -- --grep "webhook|Discord|environment|windows"
# Expected: All 2026.2.1 + 2026.2.2 tests pass

# Test Cloudflare Gateway provider
# (If integrated into inference, test that provider selection works)
npm run test -- --grep "gateway|provider|cloudflare"
# Expected: New provider loads, doesn't break existing ones

# Test Telegram plugin loads
# (Check if plugin discovery finds and loads Telegram plugin)
npm run test -- --grep "telegram|plugin"
# Expected: Plugin loads, types correct

# Test gateway credentials
npm run test -- --grep "credential|gateway"
# Expected: EncryptedSecretsCache integration works

# Test attachment security
npm run test -- --grep "attachment|file|security"
# Expected: Attachments validated, blocked patterns rejected
```

### Success Criteria

✅ All tests pass (including 2026.2.1 + 2026.2.2)
✅ Cloudflare provider available and functional
✅ Telegram plugin loads and works
✅ Gateway credentials handled securely
✅ Attachment validation working
✅ Full integration test passes

---

## Phase 3: Comprehensive Testing (3 days)

**Duration**: ~8 hours across 3 days
**Risk**: LOW (validation phase, no new changes)

### Day 1: Core System Validation

| System    | Test                   | Command                                       | Expected            |
| --------- | ---------------------- | --------------------------------------------- | ------------------- |
| Isolation | Mode enabled           | `HELIX_DEBUG_ISOLATION=1 openclaw.mjs doctor` | ISOLATED_MODE=1     |
| Isolation | No global plugins      | `openclaw.mjs doctor`                         | Only bundled        |
| Security  | Discord webhooks       | `npm run test -- --grep "webhook"`            | All 7 channels pass |
| Security  | SSRF blocked           | Attempt internal request                      | Blocked with error  |
| Security  | Path traversal blocked | Attempt parent dir access                     | Blocked with error  |
| Process   | EnvironmentProxy       | `npm run test environment-proxy.test.ts`      | 50+ tests pass      |

### Day 2: Feature Validation

| Feature             | Test            | Expected                    |
| ------------------- | --------------- | --------------------------- |
| Telegram Plugin     | Load plugin     | Plugin loads, types correct |
| Cloudflare Gateway  | Select provider | Provider available in list  |
| System Prompts      | Apply guardrail | Prompt limits enforced      |
| Message Security    | Upload file     | Attachment validated        |
| Agent Tools         | Invoke tool     | Tool executes reliably      |
| Session Transcripts | Query history   | History intact              |

### Day 3: E2E & Regression

| Test        | Command           | Expected                    |
| ----------- | ----------------- | --------------------------- |
| Full E2E    | `npm run quality` | All checks pass             |
| Regression  | Previous features | All existing tests pass     |
| Windows     | Windows tests     | Windows-specific tests pass |
| Discord Log | Send test message | All 7 channels receive it   |

---

## Phase 4: Feature Enablement & Documentation (1 day)

- [ ] Update CLAUDE.md with OpenClaw 2026.2.3 integration notes
- [ ] Document Cloudflare Gateway setup/config
- [ ] Document Telegram plugin usage
- [ ] Document system prompt guardrails
- [ ] Note: Agents dashboard enhances (not replaces) existing AgentEditor
- [ ] Update version numbers in package.json
- [ ] Create release notes: "OpenClaw 2026.2.3 integration - security hardening + new features"

---

## Phase 5: Production Deployment (1 day)

- [ ] Merge all feature branches to main
- [ ] Tag release: `2026.2.3-helix-integrated`
- [ ] Deploy to production with gradual rollout
- [ ] Monitor Discord logs (#helix-alerts) for 24 hours
- [ ] Verify all 7 Discord channels active
- [ ] Confirm isolation mode still blocking global plugins
- [ ] Have rollback plan ready (previous OpenClaw version tagged)

---

## Risk Mitigation Checklist

| Risk                              | Mitigation                                  | Owner                |
| --------------------------------- | ------------------------------------------- | -------------------- |
| SSRF checks break webhooks        | Test Discord immediately in Step 2          | Step 2 validation    |
| Windows hardening breaks commands | Test on Windows platform                    | Step 2 validation    |
| Isolation mode breaks             | Test isolation at each step                 | Each step validation |
| Plugin conflicts                  | Test plugin loading after each step         | Each step validation |
| Credential handling conflict      | Verify EncryptedSecretsCache integration    | Step 3 validation    |
| Rollback needed                   | Tagged previous version, clear instructions | Phase 5              |

---

## File Change Summary

**Expected modifications** (guide only - actual will vary):

| Area               | Files                              | Change Type            |
| ------------------ | ---------------------------------- | ---------------------- |
| helix-runtime/src/ | entry.ts, plugins/, gateway/       | Merge OpenClaw updates |
| src/helix/         | index.ts, logging-hooks.ts         | Verify compatibility   |
| web/src/           | gateway-connection.ts, components/ | Verify compatibility   |
| Root               | package.json                       | Version update         |

---

## Success Definition

✅ **Phase 2 Complete** when:

- All 3 releases (2026.2.1, 2026.2.2, 2026.2.3) merged except QMD
- Zero test failures
- Isolation mode verified working
- All Discord webhooks functional
- Security hardening in place
- New features (Telegram, Cloudflare) available
- Ready for Phase 3 testing

---

**Next Step**: Begin Step 1 - 2026.2.1 Security Foundation Merge

**Materials Available**:

- ✅ [MERGE-GUIDE-STEP1.md](MERGE-GUIDE-STEP1.md) - Complete merge strategy with all Helix customizations identified
- ✅ Helix-specific code inventory (31 files in helix/ directory, 5 critical integration points)
- ✅ Conflict resolution patterns documented

**To Execute Step 1, You Will Need**:

- Access to OpenClaw repository (github.com/openclaw/openclaw)
- Ability to compare v2026.1.30 vs v2026.2.1 source code
- OR: Release notes/changelog detailed enough to identify file changes

_Generated: 2026-02-05_
_Phase 1 Status_: COMPLETE ✅ (No blockers, ready to merge)
_Phase 2 Status_: READY FOR EXECUTION 🚀
