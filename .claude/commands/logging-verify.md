---
description: Logging Verify - Verify Discord webhook logging and hash chain integrity
argument-hint: [--deep] [--fix]
---

# /logging-verify Command

Verify Discord webhook logging, hash chain integrity, and pre-execution guarantees.

## Usage

```bash
/logging-verify              # Standard verification
/logging-verify --deep       # Deep verification with historical check
/logging-verify --fix        # Attempt to fix issues found
```

## Purpose

Helix's core principle is **unhackable logging**. This command verifies that the logging infrastructure is functioning correctly and that the integrity guarantees are maintained.

## Instructions

Delegate to the **logging-agent** to perform the verification.

## Verification Steps

### 1. Discord Webhook Configuration

**Check .env file:**
```bash
# Required webhook URLs
DISCORD_WEBHOOK_COMMANDS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_API=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_FILE_CHANGES=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_CONSCIOUSNESS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_ALERTS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_HASH_CHAIN=https://discord.com/api/webhooks/...
```

**Verification:**
- [ ] All 6 webhook URLs configured
- [ ] URLs are valid Discord webhook format
- [ ] No duplicate URLs (each channel unique)
- [ ] .env file not committed to git

### 2. Webhook Connectivity Test

For each webhook, send a test ping:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"content": "Helix logging verification ping - [timestamp]"}' \
  "$DISCORD_WEBHOOK_COMMANDS"
```

**Verification:**
- [ ] Commands channel responds (200 OK)
- [ ] API channel responds (200 OK)
- [ ] File changes channel responds (200 OK)
- [ ] Consciousness channel responds (200 OK)
- [ ] Alerts channel responds (200 OK)
- [ ] Hash chain channel responds (200 OK)
- [ ] Response time < 2 seconds for all

### 3. Hash Chain Integrity

**Local verification:**
```bash
python helix_logging/hash_chain.py --verify
```

**Verification:**
- [ ] Hash chain file exists
- [ ] File is valid JSON
- [ ] All entries have required fields (index, timestamp, data, previousHash, hash)
- [ ] First entry has previousHash of "0" or genesis hash
- [ ] Each entry's hash matches computed hash
- [ ] Each entry links to previous entry correctly
- [ ] No gaps in index sequence
- [ ] Timestamps are monotonically increasing

### 4. Discord Cross-Verification (--deep only)

Compare local hash chain with Discord records:

```bash
# Fetch recent Discord messages from hash chain channel
# Compare with local hash chain entries
```

**Verification:**
- [ ] Local entries exist in Discord
- [ ] No local entries missing from Discord
- [ ] Hashes match between local and Discord
- [ ] No unauthorized entries in Discord

### 5. Pre-Execution Logging Test

Verify that logs fire BEFORE actions complete:

```bash
# Test sequence:
# 1. Log "test command pending" to Discord
# 2. Wait for Discord confirmation
# 3. Execute test action
# 4. Log "test command completed" to Discord
```

**Verification:**
- [ ] Pending log arrives before action starts
- [ ] Timing proves pre-execution (not post)
- [ ] Action can be observed in logs even if it fails

### 6. Heartbeat Verification

**Check heartbeat status:**
- [ ] Heartbeat interval configured (60 seconds)
- [ ] Last heartbeat timestamp exists
- [ ] Last heartbeat within expected window (< 2 intervals ago)
- [ ] Discord receiving heartbeats
- [ ] No gaps in heartbeat sequence

### 7. File Watcher Verification

**Check file watcher:**
- [ ] File watcher process running
- [ ] Watching correct directories (src/helix/, etc.)
- [ ] Test file change triggers log
- [ ] Log includes file path and hash
- [ ] No excessive logging (noise filter working)

## Output Format

```markdown
# Helix Logging Verification Report

Generated: [date]

## Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Webhook Config | OK/FAIL | |
| Webhook Connectivity | OK/FAIL | |
| Hash Chain Integrity | OK/FAIL | |
| Discord Cross-Verify | OK/FAIL/SKIPPED | |
| Pre-Execution | OK/FAIL | |
| Heartbeat | OK/FAIL | |
| File Watcher | OK/FAIL | |

## Overall Status: VERIFIED | COMPROMISED | DEGRADED

## Detailed Results

### 1. Webhook Configuration

| Channel | URL Configured | Valid Format |
|---------|----------------|--------------|
| Commands | YES/NO | YES/NO |
| API | YES/NO | YES/NO |
| File Changes | YES/NO | YES/NO |
| Consciousness | YES/NO | YES/NO |
| Alerts | YES/NO | YES/NO |
| Hash Chain | YES/NO | YES/NO |

### 2. Webhook Connectivity

| Channel | Status | Response Time |
|---------|--------|---------------|
| Commands | 200 OK | 150ms |
| API | 200 OK | 142ms |
| File Changes | 200 OK | 138ms |
| Consciousness | 200 OK | 145ms |
| Alerts | 200 OK | 140ms |
| Hash Chain | 200 OK | 155ms |

### 3. Hash Chain Integrity

- Total entries: X
- First entry index: 0
- Last entry index: X
- Genesis hash: [hash]
- Latest hash: [hash]
- Gaps found: None | [list]
- Invalid hashes: None | [list]

**Chain Continuity:** VERIFIED | BROKEN at index X

### 4. Discord Cross-Verification

(Only with --deep flag)

- Local entries checked: X
- Discord entries found: X
- Matching: X
- Missing from Discord: X
- Hash mismatches: X

**Cross-verification:** VERIFIED | DISCREPANCIES FOUND

### 5. Pre-Execution Guarantee

- Test initiated: [timestamp]
- Pending log received: [timestamp]
- Action executed: [timestamp]
- Completion log received: [timestamp]
- Pre-execution verified: YES/NO
- Time delta (pending → action): Xms

**Pre-execution guarantee:** VERIFIED | FAILED

### 6. Heartbeat Status

- Interval: 60 seconds
- Last heartbeat: [timestamp]
- Time since last: X seconds
- Expected heartbeats (24h): 1440
- Actual heartbeats (24h): X
- Missing: X

**Heartbeat:** ACTIVE | INACTIVE | DEGRADED

### 7. File Watcher

- Process running: YES/NO
- Directories watched: X
- Test file change: LOGGED/NOT LOGGED
- Log latency: Xms

**File watcher:** ACTIVE | INACTIVE

## Issues Found

### Critical
1. [Critical issue requiring immediate attention]

### Warnings
1. [Warning that should be addressed]

## Recommendations

1. [Specific recommendation]
2. [Specific recommendation]

## Fix Actions Taken (--fix only)

1. [Action taken]
2. [Action taken]
```

## When to Use

- Daily integrity check (automated)
- After any logging infrastructure changes
- When investigating suspicious behavior
- Before important operations
- After system restart

## Related Commands

- `/audit` - Full codebase audit
- `/helix-status` - Quick system status
- `/consciousness-audit` - Psychological architecture audit
