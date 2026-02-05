# Ralph Loop Configuration & Testing Guide

**Updated:** February 4, 2026
**System:** Windows 11, VSCode with Claude Code extension

## Executive Summary

Ralph Loop (Ralph Wiggum technique) is a built-in Claude Code feature for iterative autonomous development. This document provides:
1. **Configuration verification** for your Windows VSCode setup
2. **Critical bug information** (equals-sign syntax issue)
3. **Correct usage patterns** (space-separated syntax)
4. **Testing procedures** to validate functionality
5. **Windows-specific troubleshooting**

---

## Part 1: Configuration Verification

### 1.1 Prerequisites

✅ **Installed:**
- VSCode (latest)
- Claude Code extension (built-in)
- Node.js 22+
- npm (for testing)

✅ **Configuration Files:**
- `.claude/settings.json` - Hooks configured for auto-formatting
- `.claude/settings.local.json` - Permissions configured

### 1.2 Ralph Loop State File

Ralph Loop uses a **local state file** for tracking loop progress:

**Expected Location:**
```
.claude/.ralph-loop.local.md
```

**What it contains:**
```markdown
# Ralph Loop State

- **Started:** [ISO timestamp]
- **Iterations:** [counter]
- **Max Iterations:** [limit]
- **Status:** active|completed|cancelled
- **Prompt:** [original prompt text]
- **Completion Promise:** [signal phrase]
```

**Verification:**
```bash
# Check if state file exists (it only exists during active loops)
ls -la .claude/.ralph-loop.local.md

# After loop completes, file is removed
# If stuck, manually remove:
rm .claude/.ralph-loop.local.md
```

### 1.3 Available Commands in VSCode

Test that these commands work in the VSCode command palette:

| Command | Syntax | Purpose |
|---------|--------|---------|
| Ralph Loop | `/ralph-loop "prompt" [options]` | Start a new loop |
| Cancel Ralph | `/cancel-ralph` | Stop active loop |
| Ralph Help | `/ralph-loop:help` | Show help text |

---

## Part 2: Critical Bug - Equals-Sign Syntax Issue

### ⚠️ Known Bug

The Ralph Loop plugin has a **critical parsing bug** where arguments with equals-sign syntax are silently ignored.

**Affected:**
- `--max-iterations=N`
- `--completion-promise="TEXT"`

### Bug Behavior

```bash
# ❌ BROKEN - Silently ignored, loops infinitely
/ralph-loop "Fix bug" --max-iterations=10 --completion-promise="DONE"
# Result: MAX_ITERATIONS stays at 0 (unlimited)
# Result: COMPLETION_PROMISE stays at empty
# Outcome: Loop runs until token limit or manual cancellation

# ✅ CORRECT - Uses space-separated syntax
/ralph-loop "Fix bug" --max-iterations 10 --completion-promise "DONE"
# Result: MAX_ITERATIONS=10
# Result: COMPLETION_PROMISE="DONE"
# Outcome: Loop stops after 10 iterations or when "DONE" appears
```

### Root Cause

The argument parser in Claude Code's Ralph Loop implementation only handles **space-separated arguments**:

```bash
case $1 in
  --max-iterations)
    MAX_ITERATIONS="$2"  # Looks for next argument
    shift 2
    ;;
esac
```

When `--max-iterations=5` is passed as a single argument, it doesn't match the pattern and gets treated as part of the prompt.

### Impact

- **Critical Severity**: Leads to runaway loops consuming massive API credits
- Reported case: Loop ran 494+ iterations before hitting stack limit
- Silent failure makes debugging difficult

### Solution

**Always use space-separated syntax:**
```bash
/ralph-loop "Your task" --max-iterations 10 --completion-promise "COMPLETE"
```

---

## Part 3: Correct Usage Patterns

### 3.1 Basic Usage (No Limits)

```bash
/ralph-loop "Add TypeScript tests to src/lib/api.ts"
```

- Runs indefinitely until you manually exit with `/cancel-ralph`
- Each iteration sees your previous work in the files
- Use when task naturally converges to completion

### 3.2 With Max Iterations (Recommended)

```bash
/ralph-loop "Refactor caching layer" --max-iterations 5
```

- Stops automatically after 5 iterations
- Use for tasks where you want bounded exploration
- Helps avoid runaway loops

### 3.3 With Completion Promise (Recommended)

```bash
/ralph-loop "Fix authentication bug" --completion-promise "AUTH_FIXED"
```

- Stops when Claude outputs `<promise>AUTH_FIXED</promise>`
- Use when task has clear success criteria
- Claude learns when to stop

### 3.4 With Both Limits (Best Practice)

```bash
/ralph-loop "Implement new API endpoint" --max-iterations 10 --completion-promise "ENDPOINT_COMPLETE"
```

- Stops after 10 iterations OR when promise is output
- Whichever comes first
- Maximum safety and control

---

## Part 4: Testing Procedures

### Test 1: Basic Loop Startup (5 minutes)

```bash
/ralph-loop "Add a console.log statement to src/helix/index.ts" --max-iterations 2 --completion-promise "LOGGED"
```

**Expected behavior:**
1. Creates `.claude/.ralph-loop.local.md` state file
2. Runs iteration 1: Adds console.log to file
3. Detects you're done (assumes task complete)
4. Asks if you want to continue
5. Stops after iteration 2 (max-iterations limit)
6. Removes state file

**Pass criteria:**
- ✅ State file created and deleted
- ✅ File was modified
- ✅ Loop stopped at iteration 2
- ✅ No syntax errors in output

---

### Test 2: Completion Promise Recognition (5 minutes)

```bash
/ralph-loop "Create a test file at src/test-ralph.test.ts with content: export const testPasses = true; Output <promise>TEST_CREATED</promise> when done" --max-iterations 5 --completion-promise "TEST_CREATED"
```

**Expected behavior:**
1. Creates test file with specified content
2. Outputs the completion promise tag
3. Loop detects promise and stops (before hitting max-iterations)
4. State file removed

**Pass criteria:**
- ✅ Loop stopped before max-iterations (stopped at promise)
- ✅ Test file created with correct content
- ✅ State file cleaned up

---

### Test 3: Max Iterations Enforcement (5 minutes)

```bash
/ralph-loop "List all TypeScript files in src/" --max-iterations 3 --completion-promise "NEVER_OUTPUT_THIS"
```

**Expected behavior:**
1. Runs iteration 1, 2, 3
2. Never outputs the completion promise
3. Stops after iteration 3 (max-iterations reached first)
4. State file removed

**Pass criteria:**
- ✅ Loop ran exactly 3 times
- ✅ Loop stopped even though promise not output
- ✅ State file cleaned up

---

### Test 4: Cancel Command (2 minutes)

```bash
# Start a loop
/ralph-loop "Infinite task" --max-iterations 100

# After first iteration, cancel it
/cancel-ralph
```

**Expected behavior:**
1. Loop starts normally
2. `/cancel-ralph` removes state file immediately
3. Reports cancellation with iteration count
4. No more iterations occur

**Pass criteria:**
- ✅ `/cancel-ralph` works immediately
- ✅ State file removed
- ✅ No more iterations triggered

---

### Test 5: Syntax Variations (To Understand Current Bug)

**Test 5a: Space-separated (CORRECT)**
```bash
/ralph-loop "Test space syntax" --max-iterations 2 --completion-promise "DONE"
```

**Expected:** Should work correctly, stop at iteration 2

---

**Test 5b: Equals-sign (KNOWN BROKEN)**
```bash
/ralph-loop "Test equals syntax" --max-iterations=2 --completion-promise="DONE"
```

**Expected:** Bug - will ignore both parameters and run indefinitely
**Action:** Cancel with `/cancel-ralph`

---

### Test 6: Windows Path Handling (5 minutes)

```bash
/ralph-loop "Create file at web/src/test-ralph-windows.ts with content: const test = true;" --max-iterations 2 --completion-promise "CREATED"
```

**Expected behavior:**
1. Uses forward slashes (Helix convention)
2. Creates file in correct Windows location
3. Loop completes successfully

**Pass criteria:**
- ✅ File created in correct location
- ✅ No path-related errors
- ✅ Loop completes normally

---

## Part 5: Troubleshooting Matrix

| Symptom | Cause | Solution |
|---------|-------|----------|
| `/ralph-loop` not recognized | VSCode extension not loaded | Restart VSCode, check Command Palette |
| Loop runs infinitely | Using `--max-iterations=N` syntax | Use `--max-iterations N` (space-separated) |
| Loop doesn't stop at promise | Promise tag format wrong | Must be exactly `<promise>TEXT</promise>` |
| State file stuck (.ralph-loop.local.md) | Previous loop didn't exit cleanly | Run `/cancel-ralph` to remove it |
| File modifications don't persist | Working directory issue | Check that files are in git repo |
| "Loop state conflict" error | Another loop is running | Run `/cancel-ralph` first |
| Windows path errors | Backslashes in paths | Use forward slashes: `src/file.ts` |

---

## Part 6: Windows-Specific Configuration

### 6.1 Path Handling

Ralph Loop on Windows requires **forward slashes** for paths:

```bash
# ✅ Correct for Windows
/ralph-loop "Create src/utils/test.ts" --max-iterations 2

# ❌ Incorrect - backslashes may cause issues
/ralph-loop "Create src\utils\test.ts" --max-iterations 2
```

### 6.2 PowerShell Integration

Your hooks are configured to run PowerShell commands. Verify they work:

```bash
# Test PowerShell hooks
npx eslint src/helix/index.ts --fix

# Should auto-format without error
```

### 6.3 jq Dependency (Optional)

Some Ralph Loop advanced features require `jq`. If you see warnings:

```bash
# Install via Chocolatey
choco install jq

# Or via Windows Subsystem for Linux (WSL)
wsl sudo apt install jq
```

---

## Part 7: Best Practices

### ✅ DO

1. **Always use space-separated syntax:**
   ```bash
   /ralph-loop "Task" --max-iterations 10 --completion-promise "DONE"
   ```

2. **Set reasonable iteration limits:**
   ```bash
   /ralph-loop "Task" --max-iterations 5  # Start small
   ```

3. **Define clear completion criteria:**
   ```bash
   /ralph-loop "Fix bug" --completion-promise "TESTS_PASS"
   ```

4. **Use for well-defined tasks:**
   - Implement specific features
   - Fix specific bugs
   - Write tests
   - Refactor code

5. **Monitor the first iteration:**
   - Verify it's doing what you expect
   - Cancel early if wrong direction

### ❌ DON'T

1. **Use equals-sign syntax:**
   ```bash
   # ❌ Don't do this
   /ralph-loop "Task" --max-iterations=10 --completion-promise="DONE"
   ```

2. **Run infinite loops without supervision:**
   ```bash
   # ❌ Don't do this
   /ralph-loop "Vague task"  # No limits, no promise
   ```

3. **Use for subjective tasks:**
   - Design decisions (needs human judgment)
   - Code review feedback
   - Architecture choices

4. **Leave loops running unattended:**
   - Monitor progress
   - Be ready to `/cancel-ralph` if off-track

5. **Mix multiple tasks:**
   ```bash
   # ❌ Don't do this
   /ralph-loop "Fix bug AND refactor AND add tests"  # Too broad
   ```

---

## Part 8: Validation Checklist

Before considering Ralph Loop "100% working", verify:

### Configuration ✅
- [ ] `.claude/.settings.json` exists with hooks
- [ ] `.claude/.settings.local.json` exists with permissions
- [ ] `/ralph-loop` command recognized in VSCode Command Palette
- [ ] `/cancel-ralph` command recognized in VSCode Command Palette

### Functionality ✅
- [ ] Basic loop starts and completes (Test 1)
- [ ] Completion promise stops loop early (Test 2)
- [ ] Max iterations enforced (Test 3)
- [ ] Cancel command works (Test 4)
- [ ] Space-separated syntax works (Test 5a)
- [ ] Equals-sign syntax fails as expected (Test 5b - known bug)
- [ ] Windows paths handled correctly (Test 6)

### Bug Documentation ✅
- [ ] Team aware of equals-sign syntax bug
- [ ] Always use space-separated syntax in documentation
- [ ] Known limitation documented (see Part 2)

### Production Readiness ✅
- [ ] Ralph Loop tested with real Helix tasks
- [ ] Team trained on correct usage
- [ ] Fallback plan if loops run too long
- [ ] Cost monitoring for API usage

---

## Quick Reference

### Commands
```bash
/ralph-loop "Your task" --max-iterations 5 --completion-promise "DONE"
/cancel-ralph
```

### Correct Syntax (Space-Separated)
```bash
--max-iterations 10
--completion-promise "COMPLETE"
```

### Incorrect Syntax (Equals-Sign - BROKEN)
```bash
--max-iterations=10        # ❌ Ignored
--completion-promise="COMPLETE"  # ❌ Ignored
```

### State File
```bash
# During active loop:
cat .claude/.ralph-loop.local.md

# If stuck:
rm .claude/.ralph-loop.local.md
/cancel-ralph
```

---

## Completion Criteria

Ralph Loop is **100% working** when:

1. ✅ All tests (1-6) pass
2. ✅ Space-separated syntax works correctly
3. ✅ Known equals-sign bug is documented
4. ✅ Windows paths handled correctly
5. ✅ Team understands proper usage
6. ✅ No errors in state file management
7. ✅ Completion promise recognition works
8. ✅ Cancel command works reliably

---

## References

- **Official Ralph Wiggum Technique:** https://ghuntley.com/ralph/
- **GitHub Issue (Bug Report):** https://github.com/anthropics/claude-code/issues/18646
- **Helix Documentation:** See `docs/` directory

---

**Document Status:** READY FOR TESTING
**Last Updated:** 2026-02-04
**Author:** Claude Code
**System:** Windows 11, VSCode
