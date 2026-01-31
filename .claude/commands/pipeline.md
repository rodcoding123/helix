---
description: Pipeline Command - Master orchestrator for complete code operations
argument-hint: [mode] [--no-push] [--pr]
---

# /pipeline Command

Run the master orchestrator pipeline on all modified files. **Automatically pushes to remote after commit.**

## Usage

```bash
/pipeline                    # Full pipeline + push (default)
/pipeline review             # Review only - no changes
/pipeline fix                # Fix issues + commit + push
/pipeline quick              # Quick: verify + format + commit + push
/pipeline --no-push          # Full pipeline without pushing
/pipeline --pr               # Full pipeline + push + create PR
```

## Pipeline Phases (11 Total)

```text
Phase 1:  Gather Modified Files       - Track all changed files
Phase 2:  Quality Baseline            - Run all quality checks
Phase 3:  Code Review                 - Review each modified file
Phase 4:  Psychological Layer Check   - Validate psychology files
Phase 5:  Fix Critical Issues         - Auto-fix critical problems
Phase 6:  Generate Tests              - Create missing tests
Phase 7:  Final Verification          - Ensure all checks pass
Phase 8:  Fix Remaining               - Clean up any remaining issues
Phase 9:  Format (Pre-commit)         - Prettier/ESLint formatting
Phase 10: Professional Commit         - Create well-formatted commit
Phase 11: Push to Remote              - Push to origin (automatic)
```

## Modes

| Mode      | Phases | Description                  |
| --------- | ------ | ---------------------------- |
| (default) | 1-11   | Full pipeline with push      |
| `review`  | 1-4    | Just review, no changes      |
| `fix`     | 5-11   | Fix, commit, and push        |
| `quick`   | 8-11   | Verify, format, commit, push |

## Flags

| Flag        | Description                    |
| ----------- | ------------------------------ |
| `--no-push` | Skip pushing to remote         |
| `--pr`      | Create pull request after push |

## Instructions

Delegate to the **orchestrator agent** to run the full pipeline.

Mode: $ARGUMENTS

### Before Starting

Use Sequential Thinking MCP to plan the pipeline execution:

```text
mcp__sequential-thinking__sequentialthinking
```

### Check Memory for Previous Session

```text
mcp__memory__search_nodes
Query: "Helix-Session"
```

### The Orchestrator Will

1. **Gather Files** - Find all files modified via `git status`
2. **Quality Baseline** - Run checks:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run format:check`
   - `npm run test`
3. **Code Review** - Delegate to `code-reviewer` for each file
4. **Psychological Check** - Validate all JSON files in:
   - `identity/`
   - `psychology/`
   - `purpose/`
   - `transformation/`
5. **Fix Critical** - Delegate to `refactor-agent` for critical issues
6. **Generate Tests** - Delegate to `test-writer` for uncovered code
7. **Final Verification** - Run all quality checks again
8. **Fix Remaining** - Address warnings and suggestions
9. **Format** - Run Prettier and ESLint --fix
10. **Commit** - Create professional commit with quality gates
11. **Push/PR** - Push to remote, create PR if requested

### Store Session in Memory

```text
mcp__memory__create_entities
Entity: "Helix-Session-[date]"
Type: "pipeline-session"
```

## Quality Gates

All must pass before commit:

| Check      | Requirement              |
| ---------- | ------------------------ |
| TypeScript | `tsc --noEmit` passes    |
| ESLint     | No errors                |
| Prettier   | All files formatted      |
| Tests      | All passing              |
| Build      | `npm run build` succeeds |
| Psychology | All layer files valid    |

## Output Format

```markdown
## Pipeline Report

### Configuration

- Mode: [full/review/fix/quick]
- Push: [yes/no]
- PR: [yes/no]

### Modified Files

- src/helix/hash-chain.ts
- src/helix/command-logger.ts
- psychology/trust_map.json
- Total: X files

### Phase Results

| Phase                  | Status | Duration |
| ---------------------- | ------ | -------- |
| 1. Gather Files        | PASS   | 2s       |
| 2. Quality Baseline    | PASS   | 15s      |
| 3. Code Review         | PASS   | 30s      |
| 4. Psychological Check | PASS   | 5s       |
| 5. Fix Critical        | PASS   | 10s      |
| 6. Generate Tests      | PASS   | 20s      |
| 7. Final Verification  | PASS   | 15s      |
| 8. Fix Remaining       | PASS   | 5s       |
| 9. Format              | PASS   | 8s       |
| 10. Commit             | PASS   | 2s       |
| 11. Push               | PASS   | 5s       |

### Code Review Summary

| File              | Score | Critical | Warnings |
| ----------------- | ----- | -------- | -------- |
| hash-chain.ts     | A     | 0        | 1        |
| command-logger.ts | B     | 1        | 2        |

### Issues Summary

- Critical: X (fixed: Y)
- Warning: X (fixed: Y)
- Suggestions: X (applied: Y)

### Tests Generated

- src/helix/**tests**/hash-chain.test.ts (5 tests)
- src/helix/**tests**/command-logger.test.ts (3 tests)

### Commit

- Hash: abc1234
- Message: "feat: description"
- Branch: feature/xyz

### Push/PR

- Remote: origin/feature/xyz
- PR: #123 (if created)

### Total Duration: X minutes

### Recommendation

[Ready for PR review / Merged to main / Needs manual review]
```

## Emergency Stops

Pipeline halts immediately if:

- Critical security vulnerability found
- Tests fail after fixes
- Build fails
- TypeScript errors remain
- Psychological layer files invalid
- Hash chain integrity compromised

## Related Commands

- `/quality` - Quality checks only (read-only)
- `/fix` - Auto-formatting fixes only
- `/test` - Run tests only
- `/pr` - Create PR only
- `/audit` - Full architectural audit
- `/consciousness-audit` - Psychological layer deep audit
