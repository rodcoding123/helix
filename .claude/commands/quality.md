# /quality Command

Run all quality checks without making changes.

## Usage

```bash
/quality
```

## What It Does

Runs all code quality tools in read-only mode:

### TypeScript Analysis

```bash
# Type checking
npm run typecheck
# Equivalent: npx tsc --noEmit --strict
```

### ESLint Analysis

```bash
# Linting
npm run lint
# Equivalent: npx eslint . --ext .ts,.js
```

### Formatting Check

```bash
# Prettier check
npm run format:check
# Equivalent: npx prettier --check "**/*.{ts,js,json,md}"
```

### Test Suite

```bash
# Vitest
npm run test
# Equivalent: npx vitest run
```

### Psychological Layer Validation

```bash
# Validate JSON schemas for all psychology files
node scripts/validate-schemas.js
```

Validates:
- `identity/*.json` - Goals, feared self, possible selves
- `psychology/*.json` - Attachments, emotional tags, trust map
- `purpose/*.json` - Ikigai, meaning sources, wellness
- `transformation/*.json` - Current state, history

## Output Format

```markdown
## Quality Report

### TypeScript Analysis
- Status: PASS | FAIL
- Errors: X
- [List of errors if any]

### ESLint Analysis
- Status: PASS | FAIL
- Errors: X
- Warnings: X
- [List if any]

### Formatting
- Status: PASS | FAIL
- Files with issues: X
- [List if any]

### Tests
- Status: PASS | FAIL
- Passed: X
- Failed: X
- Skipped: X
- Coverage: X%

### Psychological Layers
- Status: PASS | FAIL
- Valid: X/7 layers
- Invalid: [List if any]

### Overall Status: PASSING | FAILING
```

## When to Use

- Before committing changes
- After pulling latest changes
- To check current codebase health
- Before starting new feature work
- After modifying psychological layer files

## Related Commands

- `/fix` - Auto-fix formatting issues
- `/pipeline` - Full quality pipeline with fixes
- `/consciousness-audit` - Deep psychological layer verification
