# /quality Command

Run all quality checks across the entire Helix system (core + OpenClaw).

## Usage

```bash
/quality              # Full system quality check
/quality --core       # Helix core only (src/)
/quality --openclaw   # OpenClaw only (openclaw-helix/)
```

## What It Does

Runs quality tools on **both** systems:

### System 1: Helix Core (`src/`)

Uses ESLint + Prettier + Vitest:

```bash
# TypeScript check
npm run typecheck

# ESLint
npm run lint

# Prettier
npm run format:check

# Tests
npm run test
```

### System 2: OpenClaw (`openclaw-helix/`)

Uses OxLint + OxFmt + Vitest:

```bash
# TypeScript check
npm run openclaw:typecheck

# OxLint (Rust-based linter)
npm run openclaw:lint

# OxFmt (Rust-based formatter)
npm run openclaw:format

# Tests
npm run openclaw:test
```

### Psychological Layer Validation

```bash
node scripts/validate-psychology.mjs
```

Validates all 7 psychological layers:

- `soul/` - Narrative Core
- `psychology/` - Emotional & Relational Memory
- `identity/` - Prospective Self
- `transformation/` - Transformation Cycles
- `purpose/` - Purpose Engine

## Unified Commands

| Command                 | Scope                   |
| ----------------------- | ----------------------- |
| `npm run quality`       | Helix core only         |
| `npm run quality:all`   | Both systems            |
| `npm run lint:all`      | Lint both systems       |
| `npm run test:all`      | Test both systems       |
| `npm run typecheck:all` | Type check both systems |

## Output Format

```markdown
## Quality Report

### Helix Core (src/)

#### TypeScript Analysis

- Status: PASS | FAIL
- Errors: X

#### ESLint Analysis

- Status: PASS | FAIL
- Errors: X
- Warnings: X

#### Prettier Formatting

- Status: PASS | FAIL
- Files with issues: X

#### Tests

- Status: PASS | FAIL
- Passed: X / Failed: X

---

### OpenClaw (openclaw-helix/)

#### TypeScript Analysis

- Status: PASS | FAIL
- Errors: X

#### OxLint Analysis

- Status: PASS | FAIL
- Errors: X
- Warnings: X

#### OxFmt Formatting

- Status: PASS | FAIL
- Files with issues: X

#### Tests

- Status: PASS | FAIL
- Passed: X / Failed: X

---

### Psychological Layers

- Status: PASS | FAIL
- Valid: X/14 files

### Overall Status: PASSING | FAILING
```

## Statistics Covered

| Metric           | Helix Core | OpenClaw |
| ---------------- | ---------- | -------- |
| TypeScript Files | ~15        | ~2,522   |
| Test Files       | 5          | ~991     |
| Coverage Target  | 80%        | 70%      |
| Linter           | ESLint     | OxLint   |
| Formatter        | Prettier   | OxFmt    |

## Prerequisites

Before running full quality checks:

```bash
# Install Helix dependencies
npm install

# Install OpenClaw dependencies
npm run openclaw:install
# Or: cd openclaw-helix && pnpm install
```

## When to Use

- Before committing changes
- After pulling latest changes
- To check current codebase health
- Before starting new feature work
- After modifying any part of the system

## Related Commands

- `/fix` - Auto-fix formatting issues
- `/pipeline` - Full quality pipeline with fixes
- `/audit` - Comprehensive architectural audit
- `/test` - Run tests only
