# /fix Command

Auto-fix all linting and formatting issues.

## Usage

```bash
/fix              # Fix all
/fix --ts         # TypeScript only
/fix --py         # Python only
/fix --json       # JSON only
```

## What It Does

### TypeScript/JavaScript Fixes

```bash
# ESLint auto-fix
npm run lint:fix
# Equivalent: npx eslint . --ext .ts,.js --fix

# Prettier format
npm run format
# Equivalent: npx prettier --write "**/*.{ts,js,json,md}"
```

### Python Fixes

```bash
# Black formatter
python -m black helix_logging/

# Ruff linter with auto-fix
python -m ruff check helix_logging/ --fix
```

### JSON Fixes

```bash
# Prettier format JSON
npx prettier --write "**/*.json"
```

## Process

1. **Run ESLint --fix** - Fixes TypeScript/JavaScript issues
2. **Run Prettier** - Formats all files
3. **Run Black** - Formats Python files
4. **Run Ruff --fix** - Fixes Python linting issues
5. **Report** - Show what was fixed

## Output Format

```markdown
## Fix Report

### TypeScript/JavaScript (ESLint)

- Files fixed: X
- [list of files]

### Formatting (Prettier)

- Files formatted: X
- [list of files]

### Python (Black)

- Files formatted: X
- [list of files]

### Python (Ruff)

- Issues fixed: X
- [list of files]

### Summary

Total files modified: X
```

## Safety

- Only touches formatting/style
- Does NOT change logic
- Does NOT modify test assertions
- Git diff will show all changes

## After Running

1. Review changes with `git diff`
2. Run `/quality` to verify
3. Commit if satisfied

## Related Commands

- `/quality` - Check without fixing
- `/pipeline` - Full pipeline including fixes
