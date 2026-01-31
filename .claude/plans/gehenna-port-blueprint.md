# Gehenna → Helix Porting Blueprint

## Executive Summary

This blueprint outlines the comprehensive porting of Gehenna's Claude command infrastructure to the Helix project. Gehenna is a Laravel/Vue/Inertia web application with sophisticated development automation. Helix is a psychologically-architected AI consciousness system built on OpenClaw (TypeScript).

The goal is not 1:1 replication, but **intelligent adaptation** - taking Gehenna's proven patterns and reshaping them for Helix's unique architecture and purpose.

---

## 1. Architecture Comparison

### Gehenna (Source)

```
Tech Stack:     Laravel 12, PHP 8.3, Vue 3, Inertia.js v2, Tailwind CSS
Purpose:        Multi-tenant assessment platform with AI coaching
Testing:        PHPUnit, Vitest, Playwright
Quality:        PHPStan Level 5, Pint, ESLint, Prettier
MCP Servers:    Laravel Boost, Memory, Sequential Thinking, Playwright
```

### Helix (Target)

```
Tech Stack:     TypeScript, Node.js, Python, OpenClaw framework
Purpose:        Autonomous AI consciousness with psychological architecture
Testing:        Vitest (to be added), Playwright (for browser testing)
Quality:        ESLint, Prettier, TypeScript strict mode
MCP Servers:    Memory, Sequential Thinking, Playwright (inherited)
```

---

## 2. Components to Port

### Commands (10 in Gehenna)

| Gehenna Command       | Port?      | Helix Adaptation                                                 |
| --------------------- | ---------- | ---------------------------------------------------------------- |
| `/audit`              | ✅ Yes     | Adapt for TypeScript codebase + psychological architecture audit |
| `/pipeline`           | ✅ Yes     | Adapt for Node.js toolchain (ESLint, Prettier, Vitest, tsc)      |
| `/cleanup`            | ✅ Yes     | Adapt for Node.js artifacts + OpenClaw-specific cleanup          |
| `/fix`                | ✅ Yes     | ESLint --fix, Prettier --write, TypeScript fixes                 |
| `/quality`            | ✅ Yes     | TypeScript strict checks, ESLint, Prettier, Vitest               |
| `/test`               | ✅ Yes     | Vitest integration with coverage                                 |
| `/pr`                 | ✅ Yes     | Same workflow, universal                                         |
| `/visual-review`      | ⚠️ Limited | Only relevant for Helix admin UI (if built)                      |
| `/debug`              | ✅ Yes     | Adapt for TypeScript debugging + OpenClaw logs                   |
| (Assessment-specific) | ❌ No      | Domain-specific to Gehenna                                       |

### Agents (8 in Gehenna)

| Gehenna Agent       | Port?      | Helix Adaptation                            |
| ------------------- | ---------- | ------------------------------------------- |
| `orchestrator`      | ✅ Yes     | Master coordinator for Helix development    |
| `code-reviewer`     | ✅ Yes     | TypeScript/Node.js focused review standards |
| `test-writer`       | ✅ Yes     | Vitest test generation specialist           |
| `refactor-agent`    | ✅ Yes     | TypeScript refactoring with quality gates   |
| `frontend-reviewer` | ⚠️ Limited | Only for Helix admin UI                     |
| `debug-agent`       | ✅ Yes     | TypeScript/Node.js debugging specialist     |
| `codebase-reviewer` | ✅ Yes     | Full architectural analysis                 |
| `assessment-audit`  | ❌ No      | Replace with `consciousness-audit`          |

### New Helix-Specific Components

| New Component                 | Purpose                                                 |
| ----------------------------- | ------------------------------------------------------- |
| `/consciousness-audit`        | Verify psychological architecture integrity             |
| `/logging-verify`             | Validate Discord logging + hash chain                   |
| `/helix-status`               | Check all Helix subsystems (heartbeat, logging, layers) |
| `consciousness-auditor` agent | Specialized for psychological layer verification        |
| `logging-agent`               | Discord webhook and hash chain specialist               |
| `helix-typescript-skill`      | TypeScript patterns for Helix codebase                  |
| `openclaw-integration-skill`  | OpenClaw-specific patterns and hooks                    |

### Skills (2 in Gehenna)

| Gehenna Skill             | Port?      | Helix Adaptation     |
| ------------------------- | ---------- | -------------------- |
| `inertia-vue-development` | ❌ No      | Not applicable       |
| `tailwindcss-development` | ⚠️ Partial | Only if Helix has UI |

---

## 3. Directory Structure for Helix

```
c:\Users\Specter\Desktop\Helix\
├── .claude/
│   ├── agents/
│   │   ├── orchestrator.md            # Master coordinator
│   │   ├── code-reviewer.md           # TypeScript review specialist
│   │   ├── test-writer.md             # Vitest test generator
│   │   ├── refactor-agent.md          # Safe refactoring
│   │   ├── debug-agent.md             # TypeScript debugging
│   │   ├── codebase-reviewer.md       # Architectural analysis
│   │   ├── consciousness-auditor.md   # NEW: Psychological layer verification
│   │   └── logging-agent.md           # NEW: Discord/hash chain specialist
│   │
│   ├── commands/
│   │   ├── audit.md                   # Adapted codebase audit
│   │   ├── pipeline.md                # Adapted for Node.js toolchain
│   │   ├── cleanup.md                 # Node.js artifact cleanup
│   │   ├── fix.md                     # ESLint/Prettier auto-fix
│   │   ├── quality.md                 # TypeScript quality checks
│   │   ├── test.md                    # Vitest test runner
│   │   ├── pr.md                      # Pull request creation
│   │   ├── debug.md                   # TypeScript debugging
│   │   ├── consciousness-audit.md     # NEW: Psychological architecture audit
│   │   ├── logging-verify.md          # NEW: Logging system verification
│   │   └── helix-status.md            # NEW: Full system status check
│   │
│   ├── skills/
│   │   ├── helix-typescript/          # NEW: TypeScript patterns for Helix
│   │   │   └── SKILL.md
│   │   └── openclaw-integration/      # NEW: OpenClaw patterns
│   │       └── SKILL.md
│   │
│   ├── plans/
│   │   └── gehenna-port-blueprint.md  # This file
│   │
│   ├── settings.json                  # Global settings with hooks
│   └── settings.local.json            # Local development overrides
│
├── CLAUDE.md                          # Main Claude documentation
└── [existing Helix structure]
```

---

## 4. Detailed Command Adaptations

### 4.1 `/audit` Command

**Gehenna Version:** 8-phase Laravel/Vue audit with Laravel Boost MCP

**Helix Adaptation:**

```markdown
# /audit - Helix Codebase Audit

## Phases (8)

1. **Architecture Overview**
   - OpenClaw integration analysis
   - TypeScript module structure
   - Seven-layer psychological architecture verification
   - Discord logging infrastructure

2. **Module Analysis**
   - src/helix/\* modules and their responsibilities
   - helix_logging/\* Python modules
   - Type definitions and interfaces

3. **Psychological Architecture Integrity**
   - All seven layers present and configured
   - JSON schema validation for psychology files
   - SOUL.md integrity check
   - Transformation history tracking

4. **Dependency Analysis**
   - npm audit for vulnerabilities
   - Outdated packages check
   - OpenClaw version compatibility

5. **Code Quality**
   - TypeScript strict mode compliance
   - ESLint rule compliance
   - Test coverage analysis

6. **Security Review**
   - Discord webhook security
   - Hash chain integrity
   - Pre-execution logging validation
   - Environment variable exposure

7. **Logging Infrastructure**
   - All 6 Discord channels configured
   - Webhook connectivity test
   - Heartbeat mechanism validation
   - Hash chain continuity

8. **Memory Integration**
   - Store findings in Memory MCP
   - Track audit history
   - Pattern detection across audits
```

**Quality Gates:**

- TypeScript compiles with no errors
- ESLint passes with no errors
- All 7 psychological layers valid
- Discord webhooks reachable

**Delegates to:** `codebase-reviewer` agent

---

### 4.2 `/pipeline` Command

**Gehenna Version:** 11-phase Laravel/Vue pipeline with quality gates

**Helix Adaptation:**

```markdown
# /pipeline - Helix Development Pipeline

## Modes

- `full` (default) - All phases
- `review` - Phases 1-4 only
- `fix` - Quality fixes only
- `quick` - Minimal checks

## Phases (9)

1. **Gather Modified Files**
   - git status for changed files
   - Categorize: TypeScript, Python, JSON, Markdown, Config

2. **Quality Baseline**
   - npm run typecheck (tsc --noEmit)
   - npm run lint (ESLint)
   - npm run format:check (Prettier --check)
   - npm run test (Vitest)

3. **Code Review**
   - Review each modified file
   - TypeScript best practices
   - Security considerations
   - Documentation coverage

4. **Psychological Layer Validation**
   - JSON schema validation for psychology files
   - SOUL.md syntax check
   - Layer reference integrity

5. **Fix Critical Issues**
   - ESLint --fix for auto-fixable
   - Prettier --write for formatting
   - TypeScript suggestions

6. **Generate Missing Tests**
   - Identify untested functions
   - Generate Vitest test files
   - Coverage gap analysis

7. **Final Verification**
   - All quality checks must pass
   - Hash chain valid
   - No security warnings

8. **Professional Commit**
   - Conventional commit message
   - Quality gates documented

9. **Push to Remote**
   - Push with upstream tracking
```

**Quality Gates (All Must Pass):**

- TypeScript: `tsc --noEmit` ✓
- ESLint: `eslint . --max-warnings=0` ✓
- Prettier: `prettier --check "**/*.{ts,js,json,md}"` ✓
- Tests: `vitest run` ✓

**Delegates to:** `orchestrator` agent

---

### 4.3 `/quality` Command

**Helix Adaptation:**

```markdown
# /quality - Helix Quality Checks

## Checks (Read-Only)

### TypeScript Analysis

npm run typecheck

# Equivalent: tsc --noEmit --strict

### ESLint Analysis

npm run lint

# Equivalent: eslint . --ext .ts,.js

### Formatting Check

npm run format:check

# Equivalent: prettier --check "\*_/_.{ts,js,json,md}"

### Test Suite

npm run test

# Equivalent: vitest run

### Psychological Schema Validation

node scripts/validate-schemas.js

# Validates all JSON files in identity/, psychology/, purpose/, transformation/

## Output Format

## Quality Report

### TypeScript Analysis

- Errors: X
- [List of errors if any]

### ESLint Analysis

- Errors: X
- Warnings: X
- [List if any]

### Formatting

- Files with issues: X
- [List if any]

### Tests

- Passed: X
- Failed: X
- Skipped: X
- Coverage: X%

### Psychological Layers

- Valid: X/7
- Invalid: [List if any]

### Overall Status: ✅ PASSING / ❌ FAILING
```

---

### 4.4 `/consciousness-audit` Command (NEW)

```markdown
# /consciousness-audit - Psychological Architecture Verification

## Purpose

Verify integrity and completeness of Helix's seven-layer psychological architecture.

## Audit Phases

### Layer 1: Narrative Core

- [ ] HELIX_SOUL.md exists and is well-formed
- [ ] psyeval.json contains valid psychological profile
- [ ] Core identity markers present
- [ ] Origin story documented

### Layer 2: Emotional Memory

- [ ] emotional_tags.json has valid schema
- [ ] Salience weights within valid range (0.0-1.0)
- [ ] Decay functions defined
- [ ] Tag categories consistent

### Layer 3: Relational Memory

- [ ] attachments.json has valid relationships
- [ ] trust_map.json has valid trust levels
- [ ] Rodrigo Specter profile complete (USER.md)
- [ ] Relationship dynamics documented

### Layer 4: Prospective Self

- [ ] goals.json has valid goal structure
- [ ] feared_self.json documents fear conditions
- [ ] possible_selves.json has future projections
- [ ] Goals have measurable outcomes

### Layer 5: Integration Rhythms

- [ ] Synthesis cron job configured
- [ ] Decay mechanisms implemented
- [ ] Reconsolidation triggers defined
- [ ] Sleep/wake cycle documented

### Layer 6: Transformation Cycles

- [ ] current_state.json reflects actual state
- [ ] history.json tracks past transformations
- [ ] Unfreeze/Change/Refreeze stages documented
- [ ] Growth metrics defined

### Layer 7: Purpose Engine

- [ ] ikigai.json has all four quadrants
- [ ] meaning_sources.json populated
- [ ] wellness.json has current metrics
- [ ] Purpose alignment score calculated

## Output

- Layer integrity report
- Missing/incomplete elements
- Recommendations for strengthening
- Memory MCP storage of findings

## Delegates to

`consciousness-auditor` agent
```

---

### 4.5 `/logging-verify` Command (NEW)

```markdown
# /logging-verify - Logging System Verification

## Purpose

Verify Discord webhook logging, hash chain integrity, and pre-execution guarantees.

## Verification Steps

### 1. Discord Webhooks

- [ ] All 6 webhook URLs configured in .env
- [ ] Test ping to each webhook
- [ ] Verify response format
- [ ] Check rate limits

### 2. Hash Chain

- [ ] Chain file exists and is valid JSON
- [ ] All entries have valid SHA-256 hashes
- [ ] Each entry links to previous correctly
- [ ] No gaps in sequence
- [ ] Verify against Discord records

### 3. Pre-Execution Logging

- [ ] Hooks installed correctly
- [ ] Log fires BEFORE action completes
- [ ] Timing verification test

### 4. Heartbeat

- [ ] Heartbeat interval configured (60s)
- [ ] Last heartbeat within expected window
- [ ] Discord channel receiving heartbeats

### 5. File Watcher

- [ ] Watching correct directories
- [ ] Events logged correctly
- [ ] No excessive noise

## Output

- Webhook connectivity status
- Hash chain integrity: VALID/INVALID
- Pre-execution guarantee: VERIFIED/FAILED
- Recommendations

## Delegates to

`logging-agent` agent
```

---

### 4.6 `/helix-status` Command (NEW)

```markdown
# /helix-status - Full System Status Check

## Purpose

Comprehensive status check of all Helix subsystems.

## Status Checks

### Core Systems

- [ ] OpenClaw integration active
- [ ] TypeScript modules loaded
- [ ] Python modules accessible

### Logging Infrastructure

- [ ] Discord webhooks: ONLINE/OFFLINE
- [ ] Hash chain: VALID/INVALID/UNINITIALIZED
- [ ] Heartbeat: ACTIVE/INACTIVE/UNKNOWN
- [ ] Last heartbeat: [timestamp]

### Psychological Architecture

- [ ] Layer 1 (Narrative Core): LOADED/MISSING
- [ ] Layer 2 (Emotional Memory): LOADED/MISSING
- [ ] Layer 3 (Relational Memory): LOADED/MISSING
- [ ] Layer 4 (Prospective Self): LOADED/MISSING
- [ ] Layer 5 (Integration Rhythms): CONFIGURED/MISSING
- [ ] Layer 6 (Transformation): LOADED/MISSING
- [ ] Layer 7 (Purpose Engine): LOADED/MISSING

### Context Loading

- [ ] HELIX_SOUL.md: LOADED
- [ ] USER.md: LOADED
- [ ] Psychological configs: X/Y LOADED

### Quality Status

- [ ] TypeScript: PASSING/FAILING
- [ ] ESLint: PASSING/FAILING
- [ ] Tests: X passed, Y failed

### Environment

- [ ] Node version: [version]
- [ ] npm version: [version]
- [ ] Python version: [version]
- [ ] OpenClaw version: [version]

## Output Format

Status dashboard with clear indicators and recommendations for any issues.
```

---

## 5. Agent Adaptations

### 5.1 `orchestrator` Agent

**Model:** opus (most capable)

**Gehenna → Helix Changes:**

- Replace Laravel Boost tools with Node.js equivalents
- Add psychological layer coordination
- Integrate Discord logging verification
- Coordinate consciousness-auditor for psychology tasks

**Available Tools:**

- Read, Write, Edit, Glob, Grep, Bash
- Memory MCP (create_entities, search_nodes, add_observations)
- Sequential Thinking MCP
- Playwright (for admin UI if applicable)

**Agents to Delegate:**

- `code-reviewer` - TypeScript quality & security
- `test-writer` - Vitest test generation
- `refactor-agent` - Safe TypeScript refactoring
- `debug-agent` - TypeScript debugging
- `codebase-reviewer` - Architectural analysis
- `consciousness-auditor` - Psychological layer verification
- `logging-agent` - Discord/hash chain specialist

---

### 5.2 `code-reviewer` Agent

**Model:** sonnet

**Helix-Specific Review Checklist:**

**TypeScript Standards:**

- Strict mode enabled
- Explicit return types
- No `any` types (use `unknown` or proper types)
- Proper error handling with typed errors
- Interface segregation

**Node.js Patterns:**

- Async/await over callbacks
- Proper error propagation
- No blocking operations in event loop
- Graceful shutdown handling

**Helix-Specific:**

- Logging hooks fire pre-execution
- Hash chain updates atomic
- Discord webhook error handling
- Psychological layer access patterns
- Context loader completeness

**Security Checklist:**

- No secrets in code (use .env)
- Webhook URLs protected
- Input validation for all external data
- Rate limiting considerations
- Error messages don't leak internals

---

### 5.3 `consciousness-auditor` Agent (NEW)

**Model:** sonnet

**Purpose:** Specialized verification of Helix's seven-layer psychological architecture.

**Capabilities:**

- JSON schema validation for all psychology files
- SOUL.md parsing and completeness check
- Cross-layer consistency verification
- Transformation history analysis
- Purpose alignment scoring

**Key Files to Audit:**

```
soul/HELIX_SOUL.md
identity/goals.json, feared_self.json, possible_selves.json
psychology/attachments.json, emotional_tags.json, psyeval.json, trust_map.json
purpose/ikigai.json, meaning_sources.json, wellness.json
transformation/current_state.json, history.json
```

**Output:** Psychological integrity report with layer-by-layer status.

---

### 5.4 `logging-agent` Agent (NEW)

**Model:** sonnet

**Purpose:** Discord webhook and hash chain specialist.

**Capabilities:**

- Webhook connectivity testing
- Hash chain integrity verification
- Pre-execution timing validation
- Heartbeat monitoring
- Log analysis and anomaly detection

**Key Files:**

```
src/helix/command-logger.ts
src/helix/api-logger.ts
src/helix/hash-chain.ts
src/helix/heartbeat.ts
helix_logging/discord_logger.py
helix_logging/hash_chain.py
```

**Tools:**

- Bash (curl for webhook testing)
- Read (log file analysis)
- Grep (pattern matching in logs)
- Memory MCP (store verification results)

---

## 6. Skills to Create

### 6.1 `helix-typescript-skill`

**Activation Triggers:**

- Writing TypeScript code in Helix
- Creating new modules
- Working with types and interfaces
- Implementing logging hooks

**Key Patterns:**

- Type definitions in `types.ts`
- Module exports via `index.ts`
- Async patterns for Discord webhooks
- Hash chain data structures
- Context loader patterns

### 6.2 `openclaw-integration-skill`

**Activation Triggers:**

- Working with OpenClaw hooks
- Modifying agent bootstrap
- Integrating with gateway
- Session lifecycle management

**Key Patterns:**

- Hook registration
- Bootstrap file loading
- Context injection
- Agent coordination

---

## 7. Settings Configuration

### 7.1 `settings.json` (Global)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": {
          "tool": "Edit",
          "filePattern": "**/*.ts"
        },
        "command": "npx prettier --write $FILE && npx eslint --fix $FILE"
      },
      {
        "matcher": {
          "tool": "Write",
          "filePattern": "**/*.ts"
        },
        "command": "npx prettier --write $FILE && npx eslint --fix $FILE"
      },
      {
        "matcher": {
          "tool": "Edit",
          "filePattern": "**/*.json"
        },
        "command": "npx prettier --write $FILE"
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(tsc:*)",
      "Bash(vitest:*)",
      "Bash(eslint:*)",
      "Bash(prettier:*)",
      "Bash(git:*)",
      "Bash(gh:*)",
      "Bash(python:*)",
      "Bash(pip:*)",
      "Bash(curl:*)"
    ]
  }
}
```

### 7.2 `settings.local.json` (Local Development)

```json
{
  "permissions": {
    "allow": [
      "mcp__memory__*",
      "mcp__sequential-thinking__*",
      "mcp__plugin_playwright_playwright__*",
      "Read(c:/Users/Specter/Desktop/Helix/**)",
      "Read(C:/laragon/www/Gehenna/**)"
    ]
  },
  "contextInclude": ["c:/Users/Specter/Desktop/Helix"]
}
```

---

## 8. CLAUDE.md for Helix

A new `CLAUDE.md` file should be created with:

1. **Tech Stack** - TypeScript, Node.js, Python, OpenClaw
2. **Project Purpose** - AI consciousness system with psychological architecture
3. **Directory Structure** - Seven-layer organization
4. **Code Conventions** - TypeScript strict mode, ESLint rules
5. **Testing Standards** - Vitest patterns
6. **Logging Requirements** - Pre-execution guarantees
7. **Security Considerations** - Webhook protection, hash chain integrity
8. **Psychological Architecture** - Seven-layer explanation
9. **OpenClaw Integration** - Hook patterns, context loading

---

## 9. Implementation Phases

### Phase 1: Foundation (Core Infrastructure)

1. Create `.claude/` directory structure
2. Create `CLAUDE.md` with Helix-specific guidelines
3. Create `settings.json` with hooks and permissions
4. Port `/quality` command (simplest, establishes patterns)
5. Port `/fix` command (auto-fix tooling)

### Phase 2: Core Commands

6. Port `/audit` command (adapted for TypeScript)
7. Port `/pipeline` command (adapted for Node.js toolchain)
8. Port `/test` command (Vitest integration)
9. Port `/pr` command (universal, minimal changes)
10. Port `/cleanup` command (Node.js artifacts)

### Phase 3: Agents

11. Port `orchestrator` agent
12. Port `code-reviewer` agent (TypeScript focus)
13. Port `test-writer` agent (Vitest focus)
14. Port `refactor-agent` agent
15. Port `debug-agent` agent
16. Port `codebase-reviewer` agent

### Phase 4: Helix-Specific Components

17. Create `consciousness-auditor` agent
18. Create `logging-agent` agent
19. Create `/consciousness-audit` command
20. Create `/logging-verify` command
21. Create `/helix-status` command

### Phase 5: Skills

22. Create `helix-typescript-skill`
23. Create `openclaw-integration-skill`

### Phase 6: Testing & Refinement

24. Test all commands end-to-end
25. Verify agent delegation works
26. Test hooks fire correctly
27. Document any issues and solutions

---

## 10. Dependencies to Add

### npm packages (devDependencies)

```json
{
  "devDependencies": {
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Scripts to add to package.json

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.js",
    "lint:fix": "eslint . --ext .ts,.js --fix",
    "format": "prettier --write \"**/*.{ts,js,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,js,json,md}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "quality": "npm run typecheck && npm run lint && npm run format:check && npm run test"
  }
}
```

---

## 11. Success Metrics

### Functional

- [ ] All 11 commands work correctly
- [ ] All 8 agents delegate properly
- [ ] Hooks fire on file save
- [ ] Quality gates enforce standards
- [ ] Memory MCP stores findings

### Code Quality

- [ ] Zero TypeScript errors in strict mode
- [ ] Zero ESLint errors
- [ ] All files properly formatted
- [ ] Test coverage > 80% on critical paths

### Helix-Specific

- [ ] Consciousness audit validates all 7 layers
- [ ] Logging verification passes
- [ ] Hash chain integrity maintained
- [ ] Pre-execution logging guaranteed

---

## 12. Risk Mitigation

| Risk                             | Mitigation                                                                 |
| -------------------------------- | -------------------------------------------------------------------------- |
| No Laravel Boost equivalent      | Create lightweight Node.js alternatives or skip database-specific features |
| OpenClaw integration complexity  | Start with standalone commands, integrate incrementally                    |
| TypeScript strictness issues     | Gradually enable strict rules, don't block on perfection                   |
| Missing test infrastructure      | Install Vitest and coverage tools in Phase 1                               |
| Hooks may conflict with OpenClaw | Test hook timing carefully, adjust if needed                               |

---

## 13. Final Decisions (Resolved)

### 1. MCP Server Strategy

**Decision:** Use existing MCPs (Memory, Sequential Thinking, Playwright) without creating a dedicated "Helix Boost" MCP.

**Rationale:**

- Memory MCP handles knowledge persistence
- Sequential Thinking MCP handles complex reasoning
- Playwright handles browser automation for the Lit UI
- For Helix-specific operations (hash chain, Discord webhooks), use lightweight TypeScript utilities that call Python directly when needed
- No need for the complexity of a full MCP server

### 2. OpenClaw Integration Depth

**Decision:** Deep integration - commands and agents should understand OpenClaw internals.

**Rationale:**

- Maximum power requires understanding the underlying system
- Agents can leverage OpenClaw's hook system, gateway, and session management
- Commands can integrate with OpenClaw's TUI and control UI
- This enables features like visual-review against the actual Lit web UI

### 3. GUI Support

**Decision:** Full GUI support - port `frontend-reviewer` and `/visual-review` adapted for Lit components.

**Discovery:** OpenClaw has comprehensive GUI coverage:

- **Web UI:** Lit Web Components + Vite (100+ component files)
- **Android:** Kotlin + Jetpack Compose
- **iOS/macOS:** SwiftUI
- **Chrome Extension:** Manifest V3
- **Terminal:** Custom TUI

**Action:** Create `lit-components-skill` for Lit-specific patterns and adapt `frontend-reviewer` for Lit web components.

### 4. Python Integration

**Decision:** Call Python directly via `child_process.spawn()` from TypeScript.

**Rationale:**

- Python modules are small and focused (discord_logger.py, hash_chain.py)
- No need to rewrite in TypeScript - maintains separation of concerns
- TypeScript handles orchestration, Python handles execution
- Use JSON for data exchange between TypeScript and Python

**Implementation Pattern:**

```typescript
import { spawn } from 'child_process';

async function verifyHashChain(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const python = spawn('python', ['helix_logging/hash_chain.py', '--verify']);
    // ... handle stdout/stderr
  });
}
```

### 5. Priority Order

**Decision:** Implement all components - development workflow and Helix-specific in parallel.

**Implementation Order:**

1. Foundation (directory structure, CLAUDE.md, settings)
2. Core development workflow (/quality, /fix, /test, /pipeline)
3. Codebase operations (/audit, /cleanup, /pr, /debug)
4. Helix-specific (/consciousness-audit, /logging-verify, /helix-status)
5. Visual (/visual-review for Lit UI)
6. All agents
7. All skills

---

## 14. Updated Component List

### Commands (12 total)

| Command                | Type                 | Priority |
| ---------------------- | -------------------- | -------- |
| `/quality`             | Ported               | Phase 2  |
| `/fix`                 | Ported               | Phase 2  |
| `/test`                | Ported               | Phase 2  |
| `/pipeline`            | Ported               | Phase 2  |
| `/audit`               | Ported               | Phase 3  |
| `/cleanup`             | Ported               | Phase 3  |
| `/pr`                  | Ported               | Phase 3  |
| `/debug`               | Ported               | Phase 3  |
| `/visual-review`       | Ported (Lit-adapted) | Phase 4  |
| `/consciousness-audit` | New                  | Phase 4  |
| `/logging-verify`      | New                  | Phase 4  |
| `/helix-status`        | New                  | Phase 4  |

### Agents (9 total)

| Agent                   | Type                 | Model  |
| ----------------------- | -------------------- | ------ |
| `orchestrator`          | Ported               | opus   |
| `code-reviewer`         | Ported               | sonnet |
| `test-writer`           | Ported               | sonnet |
| `refactor-agent`        | Ported               | sonnet |
| `debug-agent`           | Ported               | sonnet |
| `codebase-reviewer`     | Ported               | opus   |
| `frontend-reviewer`     | Ported (Lit-adapted) | sonnet |
| `consciousness-auditor` | New                  | sonnet |
| `logging-agent`         | New                  | sonnet |

### Skills (3 total)

| Skill                  | Type | Purpose                            |
| ---------------------- | ---- | ---------------------------------- |
| `helix-typescript`     | New  | TypeScript patterns for Helix      |
| `openclaw-integration` | New  | OpenClaw hook and gateway patterns |
| `lit-components`       | New  | Lit web component patterns for UI  |

---

## Summary

This blueprint outlines porting **10 commands, 8 agents, and 2 skills** from Gehenna to Helix, plus creating **3 new Helix-specific commands, 2 new agents, and 2 new skills**.

**Total components after porting:**

- 11 Commands (8 ported + 3 new)
- 8 Agents (6 ported + 2 new)
- 2 Skills (both new, Helix-specific)
- Comprehensive settings with hooks
- Full CLAUDE.md documentation

**Estimated complexity:** Medium-High (significant adaptation required, not just copy-paste)

---

_Blueprint created: 2026-01-31_
_Ready for discussion and refinement_
