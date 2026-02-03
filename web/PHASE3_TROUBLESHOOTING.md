# Phase 3 Troubleshooting Guide

Comprehensive solutions for common Phase 3 issues.

## Table of Contents

1. [Custom Tools Troubleshooting](#custom-tools-troubleshooting)
2. [Composite Skills Troubleshooting](#composite-skills-troubleshooting)
3. [Memory Synthesis Troubleshooting](#memory-synthesis-troubleshooting)
4. [General Issues](#general-issues)
5. [Performance & Optimization](#performance--optimization)

---

## Custom Tools Troubleshooting

### "Dangerous pattern detected" Error

**Problem**: Your code is blocked for security reasons.

**Common Causes:**

- Using `eval()`, `Function()`, `require()`, `import`
- Accessing `process`, `global`, `__dirname`, `__filename`
- Attempting file system or network access
- Using `exec()` or `spawn()`

**Solutions:**

❌ **Don't do this:**

```javascript
// BAD: Using eval
function process(data) {
  return eval(data); // BLOCKED
}

// BAD: Using require
const fs = require('fs'); // BLOCKED

// BAD: Using Function constructor
new Function('return malicious code')(); // BLOCKED
```

✅ **Do this instead:**

```javascript
// GOOD: Use built-in methods
function process(data) {
  return data.split(',').map(x => x.trim());
}

// GOOD: Use standard library
function calculateHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
  }
  return Math.abs(hash).toString(16);
}

// GOOD: Use allowed capabilities
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
```

**Prevention:**

- Stick to string, array, object, math, date operations
- Use methods like `.split()`, `.map()`, `.filter()`, `.reduce()`
- Build complex logic with simple, allowed operations
- Test with the "Validate" button before saving

---

### Code Syntax Error

**Problem**: "SyntaxError: unexpected token"

**Common Causes:**

- Missing parentheses or brackets
- Wrong quotes (using `'` and `"` inconsistently)
- Missing semicolons
- Typos in function/variable names

**Example:**

```javascript
// WRONG: Missing closing parenthesis
function uppercase(text) {
  return text.toUpperCase(  // ← Missing )
}

// WRONG: Incorrect quote type
const msg = 'hello"world";  // ← Mixed quotes

// CORRECT:
function uppercase(text) {
  return text.toUpperCase();
}

const msg = "hello world";
```

**Solution:**

- Use the code editor's syntax highlighting
- Check for red squiggly lines
- Ensure balanced parentheses: `(`, `{`, `[`
- Use consistent quote style throughout

---

### "Tool not found" Error When Using Tool

**Problem**: Error when executing a tool you just created.

**Causes:**

- Tool name mismatch (case-sensitive)
- Tool deleted or not saved
- Wrong tool ID referenced
- Network delay in tool availability

**Solutions:**

1. **Verify Tool Name:**
   - Open your tool list
   - Copy exact tool name
   - Check for typos and case sensitivity

2. **Ensure Tool is Saved:**
   - Look for green checkmark next to tool name
   - If red ✗ or ⏳, click Save again
   - Wait for save confirmation

3. **Clear Cache:**
   - Refresh page (Ctrl+R or Cmd+R)
   - Try again in 10 seconds
   - Check browser console for errors (F12)

---

### Parameters Not Being Passed

**Problem**: Tool executes but parameters are undefined/null.

**Causes:**

- Parameter names don't match definition
- Wrong data type provided
- Missing required parameters
- Incorrect parameter mapping in skills

**Example:**

```javascript
// Tool definition
function myTool(firstName, lastName) {
  return firstName + ' ' + lastName;
}

// ✅ CORRECT usage:
/tool myTool
firstName: "John"
lastName: "Doe"

// ❌ WRONG: Parameter name mismatch
/tool myTool
first_name: "John"     // Should be "firstName"
last_name: "Doe"       // Should be "lastName"

// ❌ WRONG: Missing required parameter
/tool myTool
firstName: "John"
// lastName missing!
```

**Solutions:**

1. Match parameter names exactly (case-sensitive)
2. Provide all required parameters
3. Use correct data types
4. Test with "Test" button first
5. Check parameter definitions in tool settings

---

### Timeout / Tool Takes Too Long

**Problem**: "Tool exceeded 30-second timeout"

**Causes:**

- Processing very large inputs
- Inefficient algorithm (nested loops)
- Infinite loop in code
- Many network operations (not allowed anyway)

**Solutions:**

❌ **Inefficient code:**

```javascript
// BAD: O(n²) complexity
function slow(array) {
  for (let i = 0; i < array.length; i++) {
    for (let j = 0; j < array.length; j++) {
      // Process each pair
    }
  }
}

// BAD: Infinite loop
function broken(n) {
  while (true) {
    // ← Never stops!
    n++;
  }
}
```

✅ **Optimized code:**

```javascript
// GOOD: O(n) complexity
function fast(array) {
  return array.map(item => process(item));
}

// GOOD: Proper termination
function factorial(n) {
  if (n <= 1) return 1; // ← Base case
  return n * factorial(n - 1);
}
```

**Prevention:**

- Keep processing simple
- Use built-in methods (faster than manual loops)
- Limit input size expectations
- Add base cases to recursion
- Set reasonable tool expectations

---

### Incorrect Output

**Problem**: Tool returns wrong result or unexpected format.

**Causes:**

- Logic error in code
- Unexpected input format
- Type conversion issues
- Floating-point precision

**Solutions:**

1. **Debug with Test Button:**
   - Click "Test" on the tool
   - Provide sample inputs
   - Check output carefully
   - Look for error messages

2. **Add Debug Output:**

   ```javascript
   function debug(data) {
     // Log intermediate values
     console.log('Input:', data);
     const processed = data.split(',');
     console.log('After split:', processed);
     return processed;
   }
   ```

3. **Validate Inputs:**

   ```javascript
   function safe(text) {
     if (!text || typeof text !== 'string') {
       return 'Error: text must be a string';
     }
     return text.toUpperCase();
   }
   ```

4. **Check Data Types:**
   ```javascript
   function convert(value) {
     // Ensure correct type
     const num = Number(value);
     if (isNaN(num)) return 'Invalid number';
     return num * 2;
   }
   ```

---

## Composite Skills Troubleshooting

### Steps Not Running in Correct Order

**Problem**: Steps execute in wrong order or skip.

**Cause:** Skills always run top-to-bottom as written.

**Solutions:**

1. Check step order in UI
2. Verify no steps are disabled (✓ checkbox)
3. Review error handling - `stop` halts execution
4. Check conditions - might skip a step

**Order verification:**

```
Step 1: Fetch data    ✓ (must run first)
Step 2: Process       ✓ (depends on Step 1)
Step 3: Save          ✓ (depends on Step 2)
```

---

### "JSONPath not found" Error

**Problem**: Step complains about missing JSONPath.

**Causes:**

- Previous step didn't execute (failed/skipped)
- Wrong JSONPath syntax
- Output from previous step named differently
- Typo in step ID

**Example:**

```
Step 1: "fetch" outputs to $.fetched
  ✓ Runs successfully

Step 2: Try to access "$.fetch.data"
  ✗ WRONG: Should be "$.fetched" not "$.fetch"
```

**Solutions:**

1. **Verify Previous Step Succeeds:**
   - Check step completed with ✓
   - View actual output
   - Note exact variable names

2. **Check JSONPath Syntax:**

   ```
   ✅ $.input.text         (correct)
   ✅ $.step1.result       (correct)
   ✅ $.array[0].value     (correct)

   ❌ $input.text          (missing .)
   ❌ $.step1[result]      (should be .result)
   ❌ $[0]                 (invalid syntax)
   ```

3. **Match Output Names:**
   - If Step 1 outputs to `$.fetched`, use `$.fetched`
   - If Step 1 outputs to `$.data`, use `$.data`
   - Check exact variable name in output mapping

4. **Test Step by Step:**
   - Run steps individually
   - Verify outputs
   - Then build the full skill

---

### Skill Fails at a Specific Step

**Problem**: Skill works until step 4, then fails.

**Solutions:**

1. **Check Error Details:**
   - View error message for that step
   - Understand why it failed

2. **Verify Inputs to That Step:**
   - Do previous steps produce the right data?
   - Are JSONPath references correct?
   - Check data types match tool expectations

3. **Test That Tool Alone:**

   ```
   /tool myTool
   param1: "..."
   param2: "..."
   ```

   Does it work in isolation?

4. **Review Error Handling:**

   ```
   Step 4:
   - Error Handling: "stop" (whole skill stops)
   - Should be: "continue" (skip and keep going)
   - Or: "retry" (try again up to 3 times)
   ```

5. **Check Tool Parameters:**
   - Are parameter names correct?
   - Are types matching (string, number, etc.)?
   - Are required parameters present?

---

### Skill Produces Wrong Output

**Problem**: Skill runs successfully but result is wrong.

**Solutions:**

1. **Verify Each Step's Output:**
   - Run skill with `debug` mode (if available)
   - Check intermediate results
   - Trace data flow through steps

2. **Check Data Transformations:**
   - Each step should transform data correctly
   - Verify JSONPath extractions get right values
   - Check for type mismatches

3. **Review Final Output Mapping:**
   - Which step's output is the final result?
   - Is output mapping correct?
   - Check for unexpected field nesting

**Example:**

```
Step 1: fetch
  Output: { content: "...", metadata: {...} }
  Maps to: $.fetched

Step 2: process
  Takes: $.fetched.content
  Output: { processed: "..." }
  Maps to: $.result

Final output should use: $.result
```

---

### Condition Not Working

**Problem**: Step should execute conditionally but doesn't/does.

**Causes:**

- Condition syntax error
- JSONPath in condition wrong
- Condition logic incorrect
- Step still disabled even if condition true

**Example:**

```
❌ WRONG condition:
if ($.step1.status === "success")    // Missing return

✅ CORRECT condition:
$.step1.status === "success"

❌ WRONG syntax:
$.step1.result > 10 AND $.step2.valid
// Should be &&, not AND

✅ CORRECT syntax:
$.step1.result > 10 && $.step2.valid
```

**Solutions:**

1. **Verify Condition Syntax:**
   - Use `===`, `!==`, `>`, `<`, `>=`, `<=`
   - Use `&&` (AND) and `||` (OR)
   - No need for `if` statement

2. **Test Condition:**
   - Check that referenced steps execute
   - Verify JSONPaths resolve
   - Test condition in isolation

3. **Use Simple Conditions First:**

   ```
   ✅ START SIMPLE:
   $.step1.success === true

   ✅ THEN BUILD UP:
   $.step1.success === true && $.step2.count > 0

   ✅ COMPLEX BUT CLEAR:
   ($.step1.status === "ready") && ($.step2.items.length > 0)
   ```

---

### Invalid Cron Schedule Error

**Problem**: "Invalid cron schedule" when trying to set recurring skill.

**Causes:**

- Wrong number of fields
- Values out of range
- Invalid range syntax

**Format:** `minute hour day month weekday`

**Valid Ranges:**

- Minute: 0-59
- Hour: 0-23
- Day: 1-31
- Month: 1-12
- Weekday: 0-6 (0=Sunday, 6=Saturday)

**Examples:**

```
❌ WRONG:
"0 2" (only 2 fields, need 5)
"0 25 * * *" (hour 25 out of range)
"60 * * * *" (minute 60 out of range)
"0 2 * 13 *" (month 13 out of range)
"5-2 * * * *" (range backwards: 5 > 2)

✅ CORRECT:
"0 2 * * *"        Daily at 2 AM
"0 2 * * 0"        Every Sunday at 2 AM
"0 2 1 * *"        First day of month at 2 AM
"0/6 * * * *"      Every 6 hours
"0 9-17 * * 1-5"   9 AM-5 PM, Monday-Friday
```

---

## Memory Synthesis Troubleshooting

### No Patterns Detected

**Problem**: Synthesis completes but finds no patterns.

**Causes:**

- Not enough conversation history
- Conversations too recent (no patterns yet)
- Analysis type doesn't match conversation content
- Insufficient pattern confidence

**Solutions:**

1. **Increase Conversation Sample:**
   - Use longer time range (3 months vs 1 week)
   - Let more conversations accumulate
   - Add more varied topics

2. **Check Synthesis Type:**
   - "Emotional Patterns" needs emotional topics
   - "Prospective Self" needs goal discussions
   - "Relational Memory" needs people mentions
   - Try "Full Synthesis" to check all layers

3. **Verify Content:**
   - Are conversations detailed enough?
   - Are patterns actually present?
   - Check confidence threshold (default 0.5)

4. **Try Later:**
   - Patterns need multiple occurrences
   - More data = better detection
   - Run synthesis again in a few days

---

### Patterns Have Low Confidence

**Problem**: Detected patterns show 0.3 confidence but you expect higher.

**Causes:**

- Patterns are subtle or inconsistent
- Need more evidence
- Might not be strong patterns

**Solutions:**

1. Lower confidence threshold in filter
2. Look for multiple related patterns (stronger together)
3. Add more conversations for stronger detection
4. Confirm patterns manually if you see them

---

### Synthesis Takes Too Long

**Problem**: Synthesis job stuck or taking 10+ minutes.

**Causes:**

- Large conversation history (1000+ conversations)
- Complex analysis type
- Claude API latency
- Large time range selected

**Solutions:**

1. **Reduce Scope:**
   - Use shorter time range (last month instead of year)
   - Start with single layer analysis
   - Try specific synthesis type first

2. **Wait for Completion:**
   - Large datasets need time
   - Check progress bar
   - Estimated time shown

3. **Check System Status:**
   - Is Claude API responsive?
   - Any network issues?
   - Try again in 5 minutes if stuck

4. **Cancel and Retry:**
   - If stuck 15+ minutes, cancel
   - Reduce time range
   - Try again with smaller scope

---

### Can't Confirm a Pattern

**Problem**: Pattern feels inaccurate or doesn't apply.

**Solutions:**

1. You don't have to confirm every pattern
2. Unconfirmed patterns still useful for analysis
3. Add notes explaining why you disagree
4. Ignore patterns that don't apply
5. Focus on confirmed patterns for action

---

### Synthesis Recommendations Not Helpful

**Problem**: Suggestions don't match your situation.

**Causes:**

- Patterns detected but recommendations generic
- Synthesis might need better conversation data
- Recommendations might not match your goals

**Solutions:**

1. Review the patterns themselves
2. Add your own notes and goals
3. Run synthesis again with new conversations
4. Cross-reference with your journal/notes
5. Use recommendations as inspiration, not rules

---

## General Issues

### Can't Find My Tool/Skill

**Problem**: Tool/Skill disappeared from list.

**Causes:**

- Filter active (visibility, tags)
- Pagination - on wrong page
- Tool deleted accidentally
- Sorting - might not be first

**Solutions:**

1. Clear all filters
2. Reset pagination
3. Search by name
4. Sort by "Recently Updated"
5. Check if it's public vs private

---

### Permission Denied Error

**Problem**: "You don't have permission to modify this tool/skill"

**Causes:**

- Trying to edit someone else's tool
- Tool is read-only
- Not the owner

**Solutions:**

1. Clone the tool if public
2. Create your own version
3. Ask original creator to share edit access
4. Check visibility settings

---

### Changes Not Saving

**Problem**: Tool/Skill edits don't persist.

**Causes:**

- Network error
- Validation failed silently
- Page closed before save completed

**Solutions:**

1. Check for validation errors
2. Use Save button (not auto-save)
3. Check browser console (F12) for errors
4. Refresh page and check if saved
5. Try again in 10 seconds

---

## Performance & Optimization

### Tool Execution is Slow

**Typical Performance:**

- Simple tools: 50-100ms
- Complex tools: 200-500ms
- Timeout: 30 seconds

**Optimization:**

1. **Use built-in methods** (faster than manual)
2. **Avoid nested loops** (use map/filter instead)
3. **Limit input size** (don't process 100MB files)
4. **Cache results** (if same input, reuse output)

### Skill Execution is Slow

**Components:**

- Network latency: 50-200ms per request
- Tool execution: varies by tool
- Skill overhead: ~10ms per step

**Optimization:**

1. **Reduce number of steps** if possible
2. **Parallel execution** (future feature)
3. **Optimize individual tools**
4. **Cache intermediate results**

### Memory Usage Issues

**Limits:**

- Per-tool: 256MB available
- Per-skill: No hard limit but practical ~1GB
- Conversations: ~10,000 practical limit

**Solutions:**

1. Process data in chunks
2. Don't load entire large files
3. Clean up old results
4. Archive old conversations

---

## Getting Help

1. **Check these docs first**
2. **Test with sample data**
3. **Use Test/Debug buttons**
4. **Check browser console** (F12 → Console)
5. **Report bugs with details:**
   - Tool/Skill name
   - Exact error message
   - Steps to reproduce
   - Sample inputs/outputs

---

## Common Error Messages

| Error                        | Cause                   | Solution                    |
| ---------------------------- | ----------------------- | --------------------------- |
| "Tool not found"             | Wrong name/tool deleted | Verify tool exists          |
| "Dangerous pattern detected" | Forbidden function used | Remove eval/require/etc     |
| "Parameter mismatch"         | Wrong param name/type   | Check tool definition       |
| "JSONPath not found"         | Previous step failed    | Verify data flows           |
| "Timeout"                    | Too slow/infinite loop  | Optimize code               |
| "Permission denied"          | Not owner               | Clone instead               |
| "Invalid cron"               | Wrong syntax            | Use correct format          |
| "No patterns found"          | Need more data          | Wait/use more conversations |
| "Synthesis failed"           | API error               | Try again in 5 min          |

---

**Last Updated:** February 2026

For more help, see:

- [User Guide](./PHASE3_USER_GUIDE.md)
- [Developer Guide](./PHASE3_DEVELOPER_GUIDE.md)
