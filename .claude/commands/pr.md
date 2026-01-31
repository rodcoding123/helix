# /pr Command

Create a pull request after verifying quality gates.

## Usage

```bash
/pr                     # Create PR from current branch
/pr --draft             # Create as draft PR
/pr feature/my-feature  # Create PR for specific branch
```

## What It Does

### Pre-PR Verification

Before creating the PR, verifies all quality gates:

```bash
# TypeScript check
npm run typecheck

# ESLint
npm run lint

# Prettier
npm run format:check

# Tests
npm run test

# Build verification
npm run build
```

### Branch Operations

```bash
# Check current branch
git branch --show-current

# Ensure branch is pushed
git push -u origin HEAD
```

### PR Creation

```bash
gh pr create --title "[type]: Description" --body "..."
```

## PR Title Conventions

Use conventional commit prefixes:

| Prefix | Description |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code refactoring |
| `docs:` | Documentation |
| `test:` | Adding tests |
| `chore:` | Maintenance |
| `style:` | Formatting |

## PR Body Template

```markdown
## Summary

- [Change 1]
- [Change 2]
- [Change 3]

## Quality Gates

- TypeScript: PASS
- ESLint: PASS
- Prettier: PASS
- Tests: X passed, 0 failed
- Build: PASS

## Test Plan

- [ ] Manual testing step 1
- [ ] Manual testing step 2

## Helix-Specific

- [ ] Psychological layers validated
- [ ] Logging hooks verified
- [ ] Hash chain integrity checked

---
Generated with Claude Code
```

## Output Format

```markdown
## PR Creation Report

### Quality Gates
| Check | Status |
|-------|--------|
| TypeScript | PASS |
| ESLint | PASS |
| Prettier | PASS |
| Tests | PASS (47 passed) |
| Build | PASS |

### Branch Info
- Current: feature/my-feature
- Base: main
- Commits: 3
- Files changed: 5

### PR Created
- Title: feat: Add hash chain verification
- URL: https://github.com/user/helix/pull/123
- Status: Open | Draft
```

## When to Use

- After completing a feature
- After fixing a bug
- When ready for code review

## Related Commands

- `/pipeline` - Full pipeline before PR
- `/quality` - Quality check only
- `/test` - Run tests only
