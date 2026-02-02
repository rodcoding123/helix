# /cleanup Command

Safe cleanup of build artifacts and detection of debug code.

## Usage

```bash
/cleanup                # Full cleanup + detection
/cleanup --report-only  # Just report, no changes
/cleanup --yes          # Skip confirmation prompts
```

## What It Does

### Build Artifact Cleanup

```bash
# Remove build outputs
rm -rf dist/
rm -rf build/
rm -rf .cache/

# Remove dependency caches
rm -rf node_modules/.cache/
rm -rf .vitest/
rm -rf coverage/

# Remove temporary files
rm -rf *.log
rm -rf .DS_Store
```

### Debug Code Detection

Searches for debug statements that should not be committed:

**TypeScript/JavaScript:**

- `console.log(`
- `console.debug(`
- `console.warn(` (unless intentional)
- `debugger;`
- `// TODO:`
- `// FIXME:`
- `// HACK:`
- `// XXX:`

**Python:**

- `print(`
- `breakpoint()`
- `pdb.set_trace()`
- `# TODO:`
- `# FIXME:`

### Hash Chain Cleanup (Optional)

```bash
# Archive old hash chain entries (keeps last 1000)
node scripts/archive-hash-chain.js
```

## Safety

**Never touches:**

- `.git/` directory
- `node_modules/` (except cache)
- `.env` files
- Psychological layer files (`soul/`, `identity/`, `psychology/`, `purpose/`, `transformation/`)
- `helix_logging/` Python modules
- `helix-runtime/` source

## Output Format

```markdown
## Cleanup Report

### Artifacts Removed

- dist/ (15 MB)
- coverage/ (2 MB)
- .vitest/ (500 KB)
- Total: 17.5 MB freed

### Debug Code Found

#### TypeScript

- src/helix/command-logger.ts:45 - `console.log('debug')`
- src/helix/hash-chain.ts:89 - `// TODO: optimize`

#### Python

- helix_logging/discord_logger.py:23 - `print(f"debug: {data}")`

### TODO/FIXME Comments

- src/helix/heartbeat.ts:12 - `// TODO: add retry logic`
- src/helix/types.ts:45 - `// FIXME: type definition`

### Summary

- Artifacts removed: X
- Space freed: X MB
- Debug statements found: X
- TODO comments found: X

### Recommendations

1. Remove debug statements before commit
2. Address TODO comments or create issues
```

## When to Use

- Before committing changes
- After major development session
- When disk space is low
- Before creating releases

## Related Commands

- `/quality` - Full quality check
- `/pipeline` - Full development pipeline
