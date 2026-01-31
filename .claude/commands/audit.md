---
description: Audit Command - Full architectural analysis of the entire Helix system
argument-hint: [--save] [--quick] [--core] [--openclaw]
---

# /audit Command

Comprehensive architectural analysis of the **entire Helix system** including OpenClaw.

## Usage

```bash
/audit                # Full system audit
/audit --save         # Save report to docs/audit-[date].md
/audit --quick        # Skip visual review (faster)
/audit --core         # Helix core only
/audit --openclaw     # OpenClaw only
```

## What It Does

Audits **both systems** comprehensively:

### System Scope

| Component                        | Files  | Lines    | Description              |
| -------------------------------- | ------ | -------- | ------------------------ |
| Helix Core (`src/helix/`)        | ~15    | ~2,500   | Logging infrastructure   |
| OpenClaw (`openclaw-helix/src/`) | ~2,522 | ~307,000 | Agent framework          |
| Python (`helix_logging/`)        | ~3     | ~900     | Python logging           |
| Psychology (JSON)                | 14     | ~1,000   | Seven-layer architecture |
| Native Apps                      | ~500   | -        | iOS/macOS/Android        |

### Phase 1: Architecture Overview

- Full tech stack documentation
- Directory structure mapping (both systems)
- Design patterns identification
- File counts and statistics
- Cross-system integration analysis

### Phase 2: Module Analysis

**Helix Core:**

- `src/helix/` - Core TypeScript modules
- `helix_logging/` - Python logging modules
- `scripts/` - Layer 5 integration scripts

**OpenClaw:**

- `openclaw-helix/src/` - 50+ feature modules
- `openclaw-helix/extensions/` - 30 plugins
- `openclaw-helix/apps/` - Native applications
- `openclaw-helix/ui/` - Lit web components

### Phase 3: Psychological Architecture

Validate all 7 layers across both systems:

| Layer | Name                | Helix Files                      | OpenClaw Integration |
| ----- | ------------------- | -------------------------------- | -------------------- |
| 1     | Narrative Core      | HELIX_SOUL.md, psyeval.json      | context-loader.ts    |
| 2     | Emotional Memory    | emotional_tags.json              | telemetry.ts         |
| 3     | Relational Memory   | attachments.json, trust_map.json | -                    |
| 4     | Prospective Self    | goals.json, feared_self.json     | -                    |
| 5     | Integration Rhythms | decay.py, synthesis.py           | cron integration     |
| 6     | Transformation      | current_state.json, history.json | -                    |
| 7     | Purpose Engine      | ikigai.json, wellness.json       | -                    |

### Phase 4: Quality Analysis

**Helix Core (ESLint + Prettier):**

```bash
npm run quality
```

**OpenClaw (OxLint + OxFmt):**

```bash
npm run openclaw:quality
```

### Phase 5: Security Review

- Discord webhook security
- Hash chain integrity
- Pre-execution logging validation
- Environment variable exposure
- API key protection
- detect-secrets audit (OpenClaw)
- zizmor security audit (OpenClaw)

### Phase 6: Test Coverage

| System     | Test Files | Coverage Target |
| ---------- | ---------- | --------------- |
| Helix Core | 5          | 80%             |
| OpenClaw   | ~991       | 70%             |

### Phase 7: Native Apps (OpenClaw)

- iOS: SwiftLint compliance
- macOS: Swift Package Manager
- Android: Gradle build

## Instructions

Delegate to the **codebase-reviewer agent** to perform the audit.

### Run Quality on Both Systems

```bash
# Helix Core
npm run quality

# OpenClaw
npm run openclaw:quality

# Or unified
npm run quality:all
```

### Store Audit Results

```text
mcp__memory__create_entities
Entity: "Helix-FullSystemAudit-[date]"
Type: "ArchitecturalReport"
```

## Output Format

```markdown
# Helix System Audit

Generated: [date]

## Executive Summary

[Overview of full system health across Helix Core and OpenClaw]

## Architecture Score: X/10

| Category          | Helix Core | OpenClaw | Combined |
| ----------------- | ---------- | -------- | -------- |
| Code Organization | X/10       | X/10     | X/10     |
| Test Coverage     | X/10       | X/10     | X/10     |
| Security          | X/10       | X/10     | X/10     |
| Documentation     | X/10       | X/10     | X/10     |

## Full System Statistics

| Metric           | Helix Core | OpenClaw | Total    |
| ---------------- | ---------- | -------- | -------- |
| TypeScript Files | 15         | 2,522    | 2,537    |
| Python Files     | 3          | -        | 3        |
| Swift Files      | -          | 438      | 438      |
| Kotlin Files     | -          | 63       | 63       |
| Test Files       | 5          | 991      | 996      |
| Lines of Code    | ~2,500     | ~307,000 | ~310,000 |

## Tech Stack

| Component            | Technology | Version |
| -------------------- | ---------- | ------- |
| Runtime              | Node.js    | 22.12+  |
| Language             | TypeScript | 5.9+    |
| Framework            | OpenClaw   | Latest  |
| Python               | Python     | 3.12+   |
| Linter (Helix)       | ESLint     | 8.x     |
| Linter (OpenClaw)    | OxLint     | 1.42+   |
| Formatter (Helix)    | Prettier   | 3.x     |
| Formatter (OpenClaw) | OxFmt      | 0.27+   |
| Testing              | Vitest     | 4.0+    |
| UI                   | Lit        | 3.3+    |
| iOS                  | Swift      | 5.x     |
| Android              | Kotlin     | 1.x     |

---

## Helix Core Analysis

### Module Summary

| Module                  | Purpose                | Lines | Status |
| ----------------------- | ---------------------- | ----- | ------ |
| hash-chain.ts           | Integrity verification | X     | OK     |
| command-logger.ts       | Bash logging           | X     | OK     |
| api-logger.ts           | API logging            | X     | OK     |
| heartbeat.ts            | Proof-of-life          | X     | OK     |
| helix-context-loader.ts | Psychology loading     | X     | OK     |

### Quality Results

- TypeScript: PASS/FAIL
- ESLint: X errors, X warnings
- Prettier: PASS/FAIL
- Tests: X/X passing

---

## OpenClaw Analysis

### Module Summary (Top 10)

| Module    | Purpose               | Files |
| --------- | --------------------- | ----- |
| agents/   | Agent framework       | X     |
| channels/ | Platform integrations | X     |
| gateway/  | Server implementation | X     |
| helix/    | Helix integration     | 10    |
| security/ | Security features     | X     |

### Quality Results

- TypeScript: PASS/FAIL
- OxLint: X errors, X warnings
- OxFmt: PASS/FAIL
- Tests: X/X passing

### Native Apps

| Platform | Status    | Tool      |
| -------- | --------- | --------- |
| iOS      | PASS/FAIL | SwiftLint |
| macOS    | PASS/FAIL | Swift PM  |
| Android  | PASS/FAIL | Gradle    |

---

## Psychological Architecture

| Layer                  | Status | Files Valid |
| ---------------------- | ------ | ----------- |
| 1. Narrative Core      | OK     | 2/2         |
| 2. Emotional Memory    | OK     | 1/1         |
| 3. Relational Memory   | OK     | 2/2         |
| 4. Prospective Self    | OK     | 3/3         |
| 5. Integration Rhythms | OK     | 2/2         |
| 6. Transformation      | OK     | 2/2         |
| 7. Purpose Engine      | OK     | 3/3         |

---

## Security Assessment

| Area                  | Helix Core | OpenClaw |
| --------------------- | ---------- | -------- |
| Secrets Management    | OK         | OK       |
| Input Validation      | OK         | OK       |
| Pre-execution Logging | OK         | N/A      |
| Hash Chain            | OK         | N/A      |
| detect-secrets        | N/A        | OK       |
| zizmor audit          | N/A        | OK       |

---

## Recommendations

### Critical

1. [Item]

### High Priority

1. [Item]

### Medium Priority

1. [Item]

## Action Items

- [ ] Critical item
- [ ] High priority item
- [ ] Medium priority item
```

## When to Use

- Monthly health check
- Before major releases
- After significant refactoring
- Onboarding new developers
- Security review preparation
- After modifying either system

## Related Commands

- `/quality` - Quick quality check
- `/consciousness-audit` - Psychological architecture deep dive
- `/logging-verify` - Logging infrastructure verification
- `/pipeline` - Full code operations pipeline
- `/visual-review` - UI component review
