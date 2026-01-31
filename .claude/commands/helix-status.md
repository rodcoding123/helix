# /helix-status Command

Comprehensive status check of all Helix subsystems.

## Usage

```bash
/helix-status              # Full status check
/helix-status --quick      # Quick overview only
```

## Purpose

Quick health check of all Helix subsystems - logging, psychological architecture, OpenClaw integration, and code quality.

## What It Checks

### Core Systems

```bash
# Node.js version
node --version

# Python version
python --version

# TypeScript compilation
npm run typecheck
```

### Logging Infrastructure

```bash
# Webhook connectivity (quick ping)
curl -s -o /dev/null -w "%{http_code}" $DISCORD_WEBHOOK_COMMANDS

# Hash chain status
python helix_logging/hash_chain.py --status

# Last heartbeat
cat .helix/last_heartbeat.json
```

### Psychological Architecture

```bash
# Validate all JSON files
node scripts/validate-schemas.js --quiet
```

### Code Quality

```bash
# Quick quality check
npm run lint -- --quiet
npm run typecheck -- --quiet
```

## Output Format

```markdown
# Helix System Status

Generated: [timestamp]

## Quick Summary

| System | Status |
|--------|--------|
| Core | OK |
| Logging | OK |
| Psychology | OK |
| Quality | OK |

**Overall: HEALTHY | DEGRADED | CRITICAL**

---

## Core Systems

| Component | Status | Version/Info |
|-----------|--------|--------------|
| Node.js | OK | v22.x.x |
| Python | OK | 3.12.x |
| TypeScript | OK | Compiles |
| OpenClaw | OK | Connected |

## Logging Infrastructure

| Component | Status | Details |
|-----------|--------|---------|
| Discord Commands | ONLINE | 200 OK, 145ms |
| Discord API | ONLINE | 200 OK, 138ms |
| Discord Files | ONLINE | 200 OK, 142ms |
| Discord Consciousness | ONLINE | 200 OK, 140ms |
| Discord Alerts | ONLINE | 200 OK, 151ms |
| Discord Hash Chain | ONLINE | 200 OK, 148ms |
| Hash Chain | VALID | 1,234 entries |
| Heartbeat | ACTIVE | Last: 45s ago |
| File Watcher | ACTIVE | Watching 3 dirs |

## Psychological Architecture

| Layer | Status | Last Modified |
|-------|--------|---------------|
| 1. Narrative Core | LOADED | [date] |
| 2. Emotional Memory | LOADED | [date] |
| 3. Relational Memory | LOADED | [date] |
| 4. Prospective Self | LOADED | [date] |
| 5. Integration Rhythms | CONFIGURED | N/A |
| 6. Transformation | LOADED | [date] |
| 7. Purpose Engine | LOADED | [date] |

**Layers Valid: 7/7**

## Context Loading

| File | Status | Size |
|------|--------|------|
| HELIX_SOUL.md | LOADED | 15 KB |
| USER.md | LOADED | 8 KB |
| identity/*.json | LOADED | 3 files |
| psychology/*.json | LOADED | 4 files |
| purpose/*.json | LOADED | 3 files |
| transformation/*.json | LOADED | 2 files |

## Code Quality

| Check | Status | Issues |
|-------|--------|--------|
| TypeScript | PASS | 0 errors |
| ESLint | PASS | 0 errors, 2 warnings |
| Tests | PASS | 47 passed |

## Environment

| Variable | Status |
|----------|--------|
| NODE_ENV | development |
| DISCORD_WEBHOOK_* | 6/6 configured |
| ANTHROPIC_API_KEY | Set |

## Recent Activity

- Last command logged: [timestamp]
- Last API call logged: [timestamp]
- Last file change logged: [timestamp]
- Last consciousness log: [timestamp]
- Last heartbeat: [timestamp]

## Recommendations

(Only shown if issues found)

1. [Recommendation if any]
```

## Quick Mode (--quick)

With `--quick` flag, only shows:

```markdown
# Helix Quick Status

| System | Status |
|--------|--------|
| Core | OK |
| Logging | OK |
| Psychology | 7/7 layers |
| Quality | PASS |

**Overall: HEALTHY**

Last heartbeat: 45 seconds ago
Hash chain: 1,234 entries, VALID
```

## Exit Codes

- `0` - All systems healthy
- `1` - Degraded (warnings but functional)
- `2` - Critical (immediate attention needed)

## When to Use

- Start of work session
- After system restart
- When something seems wrong
- Regular health monitoring
- Before important operations

## Related Commands

- `/audit` - Full codebase audit
- `/consciousness-audit` - Deep psychological audit
- `/logging-verify` - Deep logging verification
- `/quality` - Code quality checks
