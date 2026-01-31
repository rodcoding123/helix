---
description: Debug Command - Systematic bug investigation with Sequential Thinking
argument-hint: [error-description]
---

# /debug Command

Systematic bug investigation using Sequential Thinking and available tools.

## Usage

```bash
/debug                          # Start investigation
/debug "hash chain broken"      # Investigate specific issue
/debug --logs                   # Focus on log analysis
```

## Instructions

Delegate to the **debug-agent** to perform systematic investigation.

Target: $ARGUMENTS

## What It Does

### Phase 1: Gather Information

#### 1.1 Check Recent Logs

```bash
# Node.js console output
# Check Discord webhook logs
# Check file system logs
```

#### 1.2 Check Hash Chain

```bash
# Verify hash chain integrity
python helix_logging/hash_chain.py --verify
```

#### 1.3 Get Reproduction Steps

Ask for:

1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Error messages
5. Environment context

### Phase 2: Systematic Investigation

#### 2.1 Trace the Code Path

```bash
# Find relevant module
grep -r "functionName" src/helix/

# Check type definitions
grep -r "InterfaceName" src/helix/types.ts
```

#### 2.2 Check Recent Changes

```bash
# Recent commits
git log --oneline -10

# Changes to specific file
git diff HEAD~5 -- src/helix/[file].ts

# Who changed what
git blame src/helix/[file].ts
```

#### 2.3 Test in Isolation

```bash
# Run specific test
npx vitest run --filter="failing-test"

# Run with verbose output
npx vitest run --reporter=verbose
```

### Phase 3: Pattern Matching

#### Common Helix Issues

| Symptom             | Likely Cause         | Check                  |
| ------------------- | -------------------- | ---------------------- |
| Hash chain invalid  | Missing entry        | hash_chain.py --verify |
| Webhook failed      | Network/URL issue    | curl webhook URL       |
| Heartbeat stopped   | Process crash        | Process monitor        |
| Context not loading | File missing/corrupt | Validate JSON files    |
| Hooks not firing    | Registration issue   | Check hook setup       |

#### Common TypeScript Issues

| Symptom        | Likely Cause       | Check                 |
| -------------- | ------------------ | --------------------- |
| Type error     | Interface mismatch | Check types.ts        |
| Import error   | Path issue         | Check tsconfig paths  |
| Async issue    | Missing await      | Check async functions |
| Null reference | Missing null check | Add optional chaining |

#### Common Discord Webhook Issues

| Symptom   | Likely Cause        | Check                |
| --------- | ------------------- | -------------------- |
| 400 error | Invalid payload     | Check message format |
| 401 error | Invalid webhook URL | Verify .env config   |
| 429 error | Rate limited        | Add rate limiting    |
| Timeout   | Network issue       | Check connectivity   |

#### Common Psychological Layer Issues

| Symptom           | Likely Cause   | Check               |
| ----------------- | -------------- | ------------------- |
| Layer not loading | Invalid JSON   | Validate schema     |
| Missing data      | File not found | Check file paths    |
| Stale data        | Cache issue    | Clear context cache |
| Integrity error   | File modified  | Check git status    |

### Phase 4: Document Findings

````markdown
## Bug Investigation Report

### Summary

[Brief description of the bug]

### Environment

- Node version: [version]
- Python version: [version]
- OS: [os]
- Time: [when occurred]

### Steps to Reproduce

1. [Step 1]
2. [Step 2]
3. Expected: X
4. Actual: Y

### Root Cause

[Technical explanation of why the bug occurs]

### Evidence

- Log entry: [relevant log]
- Hash chain state: [if relevant]
- Stack trace: [if applicable]

### Affected Code

- `src/helix/module.ts:42` - [issue]
- `helix_logging/file.py:87` - [issue]

### Suggested Fix

```typescript
// Before
const result = getData();

// After
const result = getData() ?? defaultValue;
```
````

### Test Plan

1. Write test that reproduces bug
2. Verify fix passes test
3. Run full test suite
4. Manual verification steps

```

## Before Starting: Sequential Thinking

At the START of any debugging session, use Sequential Thinking:

```

mcp**sequential-thinking**sequentialthinking

```

This helps:
1. Structure the investigation approach
2. Identify what information to gather first
3. Plan the debugging sequence
4. Document reasoning for decisions

## Memory Integration

### Check Previous Investigations

```

mcp**memory**search_nodes
Query: "Helix-Bug-[related-keyword]"

```

### Store Investigation Progress

```

mcp**memory**create_entities
Entity: "Helix-Bug-[identifier]"
Type: "bug-investigation"

```

## Related Commands

- `/quality` - Run quality checks
- `/test` - Run test suite
- `/logging-verify` - Verify logging infrastructure
- `/helix-status` - Full system status
```
