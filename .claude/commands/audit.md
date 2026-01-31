---
description: Audit Command - Full architectural analysis of Helix codebase
argument-hint: [--save] [--quick]
---

# /audit Command

Comprehensive architectural analysis of the Helix codebase with psychological architecture review.

## Usage

```bash
/audit                # Full audit, output to console
/audit --save         # Save report to docs/audit-[date].md
/audit --quick        # Skip visual review (faster)
```

## What It Does

Combines multiple specialized agents for comprehensive analysis:

### Phase 1: Architecture Overview

- Tech stack documentation
- Directory structure mapping
- Design patterns identification
- File counts and statistics
- OpenClaw integration analysis

### Phase 2: Module Analysis

Analyze all Helix modules:
- `src/helix/` - Core TypeScript modules
- `helix_logging/` - Python logging modules
- `openclaw-helix/` - OpenClaw integration

### Phase 3: Psychological Architecture Integrity

Validate the seven-layer architecture:
- Layer 1: Narrative Core (`HELIX_SOUL.md`, `psyeval.json`)
- Layer 2: Emotional Memory (`emotional_tags.json`)
- Layer 3: Relational Memory (`attachments.json`, `trust_map.json`)
- Layer 4: Prospective Self (`goals.json`, `feared_self.json`, `possible_selves.json`)
- Layer 5: Integration Rhythms (cron configuration)
- Layer 6: Transformation (`current_state.json`, `history.json`)
- Layer 7: Purpose Engine (`ikigai.json`, `meaning_sources.json`, `wellness.json`)

### Phase 4: Dependency Analysis

- npm audit for vulnerabilities
- Outdated packages check
- OpenClaw version compatibility

### Phase 5: Code Quality

- TypeScript strict mode compliance
- ESLint rule compliance
- Test coverage analysis
- Technical debt identification

### Phase 6: Security Review

- Discord webhook security
- Hash chain integrity
- Pre-execution logging validation
- Environment variable exposure
- API key protection

### Phase 7: Logging Infrastructure

- All 6 Discord channels configured
- Webhook connectivity test
- Heartbeat mechanism validation
- Hash chain continuity

### Phase 8: Memory Storage

Store findings in Memory MCP for tracking over time.

## Instructions

Delegate to the **codebase-reviewer agent** to perform the audit.

### Before Starting

Use Sequential Thinking to plan the audit:

```text
mcp__sequential-thinking__sequentialthinking
```

### Check Previous Audits

```text
mcp__memory__search_nodes
Query: "Helix-CodebaseAnalysis"
```

### Store Audit Results

```text
mcp__memory__create_entities
Entity: "Helix-CodebaseAnalysis-[date]"
Type: "ArchitecturalReport"
```

## Output Format

```markdown
# Helix Codebase Audit

Generated: [date]

## Executive Summary

[2-3 sentence overview of codebase health and key findings]

## Architecture Score: X/10

| Category | Score | Notes |
|----------|-------|-------|
| Code Organization | X/10 | |
| Test Coverage | X/10 | |
| Security | X/10 | |
| Psychological Integrity | X/10 | |
| Documentation | X/10 | |

## Statistics

| Metric | Value |
|--------|-------|
| TypeScript Files | X |
| Python Files | X |
| Test Files | X |
| JSON Config Files | X |
| Markdown Docs | X |
| Lines of Code | X |

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Node.js | 22.x |
| Language | TypeScript | 5.x |
| Framework | OpenClaw | Latest |
| Python | Python | 3.12.x |
| Testing | Vitest | Latest |
| UI | Lit | 3.x |

## Module Analysis

### src/helix/
| Module | Purpose | Lines | Coverage |
|--------|---------|-------|----------|
| index.ts | Main orchestration | X | X% |
| types.ts | Type definitions | X | N/A |
| hash-chain.ts | Integrity verification | X | X% |
| command-logger.ts | Discord logging | X | X% |
| heartbeat.ts | Proof-of-life | X | X% |

### helix_logging/
| Module | Purpose | Lines |
|--------|---------|-------|
| discord_logger.py | Webhook client | X |
| hash_chain.py | Python hash chain | X |

## Psychological Architecture

| Layer | Status | Files | Issues |
|-------|--------|-------|--------|
| 1. Narrative Core | OK/WARN | 2 | |
| 2. Emotional Memory | OK/WARN | 1 | |
| 3. Relational Memory | OK/WARN | 2 | |
| 4. Prospective Self | OK/WARN | 3 | |
| 5. Integration Rhythms | OK/WARN | N/A | |
| 6. Transformation | OK/WARN | 2 | |
| 7. Purpose Engine | OK/WARN | 3 | |

## Findings

### Critical Issues
1. [Issue with file:line reference]

### Warnings
1. [Warning description]

### Technical Debt

| Area | Items | Priority |
|------|-------|----------|
| Missing Tests | X | High |
| TODO Comments | X | Medium |
| Deprecated Usage | X | Low |

## Security Assessment

| Area | Status | Notes |
|------|--------|-------|
| Webhook Security | OK/WARN | |
| Hash Chain Integrity | OK/WARN | |
| Environment Variables | OK/WARN | |
| Pre-execution Logging | OK/WARN | |
| API Key Protection | OK/WARN | |

## Logging Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| Discord Commands Channel | OK/WARN | |
| Discord API Channel | OK/WARN | |
| Discord File Changes | OK/WARN | |
| Discord Consciousness | OK/WARN | |
| Discord Alerts | OK/WARN | |
| Discord Hash Chain | OK/WARN | |
| Heartbeat (60s) | OK/WARN | |
| Hash Chain Continuity | OK/WARN | |

## Recommendations

### Immediate (This Week)
1. [Action item with specific file references]

### Short-term (This Month)
1. [Action item]

### Long-term (This Quarter)
1. [Action item]

## Action Items

- [ ] High priority item
- [ ] Medium priority item
- [ ] Low priority item
```

## When to Use

- Monthly health check
- Before major releases
- After significant refactoring
- Onboarding new developers
- Security review preparation
- After modifying psychological architecture

## Related Commands

- `/quality` - Quick quality check (read-only)
- `/consciousness-audit` - Deep psychological architecture audit
- `/logging-verify` - Logging infrastructure verification
- `/cleanup` - Clean caches and debug code
- `/pipeline` - Full code operations pipeline
