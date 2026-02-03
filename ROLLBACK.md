# Rollback Procedures - Phase 1A & 1B Security Hardening

This document provides step-by-step procedures for rolling back the Phase 1A & 1B security hardening implementation.

## Quick Reference

| Scenario | Action | Time |
|----------|--------|------|
| Disable all hardening | Set `HELIX_FEATURE_PRELOAD_SECRETS=false` | Immediate |
| Disable log sanitization | Remove `import './lib/safe-console.js'` | 1 min |
| Disable plugin isolation | Set `DISABLE_PLUGIN_ENV_PROXY=true` | 1 min |
| Disable 1Password audit | Set `enableAuditScheduler=false` in initializeHelix() | 1 min |
| Full rollback | Revert git commits | 5 min |

## Level 1: Feature Flags (Immediate, No Code Changes)

All hardening features can be disabled via environment variables without code changes.

### 1. Disable Secrets Preloading

**Impact**: Secrets loaded at runtime instead of startup (original behavior)

```bash
export HELIX_FEATURE_PRELOAD_SECRETS=false
node helix-runtime/openclaw.mjs
```

**Result**:
- Discord webhooks NOT initialized before logging
- Secrets loaded on-demand via loadSecret()
- No EncryptedSecretsCache initialization
- Reverts to original plaintext storage in Map

**Testing**:
```bash
HELIX_FEATURE_PRELOAD_SECRETS=false npm run test
# Should pass - preloadSecrets() is not called
```

### 2. Disable Log Sanitization

**Impact**: Console logs not sanitized (secrets may leak)

**Option A**: Disable safe-console import
```bash
# In helix-runtime/src/entry.ts, comment out:
// import './lib/safe-console.js';
```

**Option B**: Keep import but bypass sanitization
```bash
export NODE_OPTIONS="--disable-warning=ExperimentalWarning"
# safe-console is still imported but logs directly to console.raw
```

**Result**:
- All logs bypass LogSanitizer
- Secrets appear in plaintext in Discord
- Error messages not redacted
- Performance improves slightly (no regex matching)

**Testing**:
```bash
npm run test -- src/lib/log-sanitizer.test.ts
# Tests will pass (logSanitizer still works)
# But it's not used for console output
```

### 3. Disable Plugin Environment Isolation

**Impact**: Plugins have full process.env access

**In helix-runtime/src/plugins/loader.ts**, revert the injection:
```typescript
// OLD: With isolation
const api = createApi(record, {
  config: cfg,
  pluginConfig: validatedConfig.value,
  env: createPluginEnvironment(record.id),  // REMOVE THIS
});

// NEW: Without isolation
const api = createApi(record, {
  config: cfg,
  pluginConfig: validatedConfig.value,
  // env removed - plugins get full process.env
});
```

**Result**:
- Plugins can access DISCORD_WEBHOOK_*, STRIPE_KEY, etc.
- No blocked access attempts
- No logging of plugin access violations
- Plugin environment tests fail (as expected)

**Testing**:
```bash
npm run test -- helix-runtime/src/plugins/environment-proxy.test.ts
# Tests fail (expected - proxy not used)
```

### 4. Disable 1Password Audit Scheduler

**In src/helix/index.ts**, disable in initializeHelix():
```typescript
export async function initializeHelix(options: HelixInitOptions = {}): Promise<void> {
  const {
    // ... other options
    enableAuditScheduler = false,  // CHANGE FROM true TO false
  } = options;

  // ... rest of code unchanged
}
```

**Result**:
- No hourly 1Password access pattern analysis
- No anomaly detection
- No Discord alerts for unusual access
- Audit scheduler never starts

**Testing**:
```bash
npm run test -- src/lib/1password-audit.test.ts
# Tests pass (audit system still works, just not scheduled)
```

## Level 2: Partial Rollback (Individual Components)

### Disable Only Encrypted Cache

Keep all other hardening, but store secrets plaintext in memory:

**In src/lib/secrets-loader.ts**, revert to original Map:
```typescript
// OLD: With encryption
const SECRETS_CACHE = new EncryptedSecretsCache();

// NEW: Without encryption (plaintext)
const SECRETS_CACHE = new Map<string, string>();
```

**Result**:
- Secrets stored plaintext in memory (vulnerable to heap dumps)
- Log sanitization still active
- Plugin isolation still active
- Secret operation logging still active

**Impact**: ⚠️ HIGH - Secrets exposed in memory dumps/heap snapshots

**Testing**:
```bash
# Revert in secrets-loader.ts and run tests:
npm run test -- src/lib/secrets-loader.test.ts
# Tests pass (Map API same as EncryptedSecretsCache)

# But heap snapshots will show plaintext:
node --expose-gc --heapsnapshot-signal=SIGUSR2 helix-runtime/openclaw.mjs &
kill -SIGUSR2 $!
strings heapsnapshot.heapsnapshot | grep "sk_live_"
# Will find plaintext if secrets loaded
```

### Disable Only Log Sanitization

Keep encryption and plugin isolation:

**In src/lib/secrets-loader.ts**, remove sanitization:
```typescript
// Remove this line:
import { logSecretOperation } from '../helix/hash-chain.js';

// Remove all sanitization logging calls (fire-and-forget logSecretOperation)
```

**In src/helix/index.ts**, keep preloadSecrets() but remove logging:
```typescript
// Keep preloadSecrets() function, but remove:
await logSecretOperation({ ... });
```

**Result**:
- Secrets still encrypted in memory
- Plugin isolation still active
- But no audit trail for secret operations
- Secrets still sanitized from console output

**Testing**:
```bash
npm run test -- src/helix/hash-chain.test.ts
# Tests pass (hash chain still works, just not used for secrets)

npm run test -- src/lib/log-sanitizer.test.ts
# Tests pass (sanitizer still works for console)
```

## Level 3: Full Rollback (Git Commits)

Complete rollback to state before security hardening:

### Identify Commits

```bash
git log --oneline --grep="security\|hardening\|encrypt\|sanitize\|audit" | head -20
```

### Revert All Hardening Commits

```bash
# Option 1: Revert specific commits (creates new commits)
git revert <commit-hash-1> <commit-hash-2> ...

# Option 2: Reset to before hardening (loses all commits)
git reset --hard <hash-before-hardening>

# Option 3: Create feature branch to preserve current work
git checkout -b rollback-checkpoint
git reset --hard <hash-before-hardening>
```

### Files to Delete if Using Manual Rollback

```bash
# Core security files
rm src/lib/secrets-cache-encrypted.ts
rm src/lib/secrets-cache-encrypted.test.ts
rm src/lib/log-sanitizer.ts
rm src/lib/log-sanitizer.test.ts
rm src/lib/safe-console.ts
rm src/lib/safe-console.test.ts
rm helix-runtime/src/plugins/environment-proxy.ts
rm helix-runtime/src/plugins/environment-proxy.test.ts
rm src/lib/1password-audit.ts
```

### Revert Modified Files

See git diff for exact changes:
```bash
git diff HEAD~20 -- src/lib/secrets-loader.ts | head -100
git checkout HEAD~20 -- src/lib/secrets-loader.ts

git diff HEAD~20 -- src/helix/index.ts | head -100
git checkout HEAD~20 -- src/helix/index.ts

git diff HEAD~20 -- src/helix/hash-chain.ts | head -100
git checkout HEAD~20 -- src/helix/hash-chain.ts

git diff HEAD~20 -- helix-runtime/src/entry.ts | head -100
git checkout HEAD~20 -- helix-runtime/src/entry.ts

git diff HEAD~20 -- helix-runtime/src/plugins/loader.ts | head -100
git checkout HEAD~20 -- helix-runtime/src/plugins/loader.ts
```

### Verify Rollback

```bash
# Test compilation
npm run typecheck

# Run tests
npm run test

# Check git status
git status
# Should show no unexpected changes

# Verify removed files
git ls-files | grep "secrets-cache-encrypted\|log-sanitizer\|safe-console\|environment-proxy\|1password-audit"
# Should show nothing (files deleted)
```

## Testing Rollback Procedures

### 1. Test Feature Flag Rollback

```bash
#!/bin/bash

# Disable preload, keep everything else
export HELIX_FEATURE_PRELOAD_SECRETS=false

# Run tests
npm run test

# Expected: All tests pass
# Verify preloadSecrets not called in logs
```

### 2. Test Partial Rollback (Encryption Only)

```bash
#!/bin/bash

# Create temporary branch
git checkout -b test-rollback-encryption

# Edit secrets-loader.ts: revert SECRETS_CACHE to Map
# Run tests
npm run test -- src/lib/secrets-loader.test.ts
npm run test -- src/lib/secrets-cache-encrypted.test.ts

# Tests should still pass (interface unchanged)

# Cleanup
git checkout -
git branch -D test-rollback-encryption
```

### 3. Test Full Rollback

```bash
#!/bin/bash

# Stash current work
git stash

# Checkout pre-hardening commit
git checkout <hash-before-hardening>

# Verify builds
npm run typecheck
npm run test

# Expected: All tests pass, no security files present

# Return to current work
git checkout -
git stash pop
```

## Rollback Checklist

- [ ] Identify reason for rollback
- [ ] Choose rollback level (feature flag / partial / full)
- [ ] Backup current state: `git stash` or create branch
- [ ] Apply rollback
- [ ] Verify compilation: `npm run typecheck`
- [ ] Verify tests: `npm run test`
- [ ] Check logs for errors
- [ ] Verify system startup
- [ ] Test with real 1Password secrets
- [ ] Monitor for security issues
- [ ] Document rollback reason in git log

## Rollback Decision Matrix

| Issue | Symptom | Rollback Level | Why |
|-------|---------|-----------------|-----|
| Secrets not loading | preloadSecrets() timeout | Feature flag | Isolate startup issue |
| Log spam | Too much redaction | Partial | Disable sanitization |
| Plugin failures | Blocked env access | Partial | Disable isolation only |
| Memory issues | Encryption overhead | Partial | Revert encryption |
| Audit spam | Too many alerts | Feature flag | Disable scheduler |
| Complete failure | System won't start | Full | Comprehensive problem |

## Post-Rollback Security Considerations

### If Rolling Back Encryption

⚠️ **HIGH RISK** - Secrets now exposed in memory. Mitigations:
- Immediately rotate all secrets (1Password)
- Check Discord logs for leaked secrets in error messages
- Monitor process.env access from plugins
- Schedule full security re-audit

### If Rolling Back Log Sanitization

⚠️ **MEDIUM RISK** - Secrets may appear in console output. Mitigations:
- Check Discord logs for plaintext secrets
- Rotate any exposed API keys
- Keep safe-console.ts for future re-deployment
- Note: Plugin isolation still prevents some leaks

### If Rolling Back Plugin Isolation

⚠️ **MEDIUM RISK** - Plugins can access secrets. Mitigations:
- Audit all plugins for unauthorized access
- Check hash chain for plugin_attempt logs
- Consider disabling untrusted plugins
- Plan re-deployment with better isolation

### If Rolling Back Completely

⚠️ **CRITICAL RISK** - All security hardening removed. Mitigations:
- Rotate ALL secrets immediately
- Perform security audit
- Check Discord logs for leaks
- Consider security re-training
- Plan comprehensive re-deployment

## Re-Deployment After Rollback

Once rollback issue is fixed:

1. Create feature branch: `git checkout -b fix/hardening-issue`
2. Fix the underlying issue
3. Apply minimal rollback level needed (not full)
4. Re-test comprehensively
5. Create PR with detailed explanation
6. Review and merge
7. Re-enable via feature flags gradually

## Contact & Escalation

If rollback is needed:

1. Check CLAUDE.md Security Hardening section for context
2. Review git commit history for implementation details
3. Contact Rodrigo Specter for security decisions
4. Document reason in git commit message
5. Plan re-deployment immediately after rollback

## Success Criteria for Rollback

- [ ] System starts without errors
- [ ] All 1055 tests pass
- [ ] No TypeScript errors
- [ ] No secret leaks in new logs
- [ ] Plugins load correctly
- [ ] Discord logging works
- [ ] Hash chain validates
- [ ] No performance regressions
