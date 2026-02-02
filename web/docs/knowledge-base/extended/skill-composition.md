# Skill Composition User Guide

## Overview

Skill Composition lets you chain multiple tools together into powerful multi-step workflows. Instead of running tools one at a time, create automated pipelines:

**Example Workflows:**

- **Content Pipeline**
  1. Take article text
  2. Extract key points
  3. Generate summary
  4. Create social media posts
  5. Save to file

- **Data Processing**
  1. Load CSV file
  2. Clean invalid records
  3. Analyze statistics
  4. Generate report

- **Email Management**
  1. Receive incoming email
  2. Classify by category
  3. Extract action items
  4. Create calendar events
  5. Send confirmation

Think of it like building a recipe: combine steps (tools) in the right order to get the final result.

## When to Use Skill Composition

Create a skill when you:

**Repeat the same sequence**
- "Every day, collect → analyze → report"
- "Always validate → transform → export"
- You do these steps in the same order repeatedly

**Need conditional logic**
- "Only process if validation passes"
- "Skip step 2 if data is empty"
- Different paths based on results

**Want to automate workflows**
- "Run this pipeline every morning"
- "Trigger when new files arrive"
- Automation options coming soon

**Examples of useful skills:**
- ✓ Daily standup generator (meetings → notes → summary)
- ✓ Code review workflow (lint → test → review)
- ✓ Invoice processor (parse → validate → file)
- ✓ Research assistant (search → summarize → organize)

## Creating a Skill

### Step 1: Start the Skill Builder

1. Click **Composite Skills** in the sidebar
2. Click **Create Skill**
3. You'll see the skill builder interface

### Step 2: Basic Information

Fill in:

**Name** (required)
- What is this workflow called?
- Examples: "Daily Report", "Email Processor", "Code Review"
- ✓ Good: "Invoice Processing Workflow"
- ✗ Bad: "skill1" or "workflow"

**Description** (required)
- What does this skill do?
- What's the end result?
- Example: "Processes invoices: validates format, extracts data, files by customer"

**Icon** (optional)
- Single emoji for quick identification
- 📋 for document workflows
- 🔄 for processing pipelines
- 🤖 for automation

**Visibility** (required)
- **Private** - Only you
- **Public** - Share in Marketplace

### Step 3: Build the Workflow

Click **Add Step** to add tools to your workflow.

**For each step, configure:**

**Tool Selection**
```
Tool Name: "Email Validator"
Tool Type: Custom (your tools)
           Built-in (system tools)
           MCP (external integrations)
```

**Input Mapping**
```
Where does this step get its input?

Option 1: From workflow input
  → Use the original input passed to the workflow

Option 2: From a previous step's output
  → Use output from step1, step2, etc.

Example:
  Step 1: Receives user email
  Step 2: Validates it (uses Step 1 output)
  Step 3: Stores it (uses Step 2 output)
```

**Error Handling**
```
What happens if this step fails?

- Continue: Skip this step, move to next
  (Good when optional steps might fail)

- Stop: Halt the entire workflow
  (Good when failure blocks everything)

- Retry: Try again up to 3 times
  (Good for flaky external APIs)
```

### Step 4: Connect Steps

Steps flow from top to bottom. Data flows between them:

```
Step 1: Get Text Input
    ↓ (output: "Hello World")
Step 2: Uppercase It
    ↓ (output: "HELLO WORLD")
Step 3: Count Characters
    ↓ (output: 11)
Step 4: Save Result
```

**Input Mapping** tells each step where to get its data:

```
Step 2 Input Mapping:
  "text_to_process" → "$.step1.output"
  (Get the output from step 1)

Step 3 Input Mapping:
  "text" → "$.step2.output"
  (Get the output from step 2)
```

### Step 5: Add Conditionals (Optional)

Make steps conditional - only run if conditions are met:

```
Step 2: Validate Email
  ↓ (returns { isValid: true/false })

Step 3: Send Confirmation
  Condition: Only if isValid == true
  ↓
  (Confirmation only sent if valid)
```

**Supported conditions:**
- **equals** - Value equals something
  ```
  If status == "approved" → Continue
  ```
- **contains** - Text contains substring
  ```
  If email contains "@company.com" → Continue
  ```
- **greater than** - Number is larger
  ```
  If score > 80 → Continue
  ```
- **less than** - Number is smaller
  ```
  If attempts < 3 → Retry
  ```
- **exists** - Field has a value
  ```
  If data exists → Process
  ```

### Step 6: Test Your Skill

Before saving:

1. Click **Test Skill**
2. Provide test input
3. Watch it execute step-by-step
4. See output from each step
5. Check final result

**Testing Output:**
```
Step 1: Receive text "hello"
  Status: ✓ Success
  Output: { text: "hello" }

Step 2: Uppercase
  Status: ✓ Success
  Output: { result: "HELLO" }

Step 3: Count
  Status: ✓ Success
  Output: { count: 5 }

Final Result: "HELLO" (5 characters)
```

Keep refining until results look correct.

### Step 7: Save Your Skill

Click **Save Skill**

Your skill is now:
- ✓ Saved to your account
- ✓ Ready to execute
- ✓ Available in Marketplace (if public)
- ✓ Repeatable anytime

## Using Your Skills

### Execute a Skill

1. Click **Composite Skills**
2. Find your skill
3. Click **Execute**
4. Provide the input (if needed)
5. Watch it run
6. See the final result

### In Conversations

Ask your AI agent to use a skill:

```
You: "Run my email processing skill on these emails"
Agent: "I'll run your Email Processor skill"
Skill: Step 1 → Step 2 → Step 3 → Done
Agent: "Processed 15 emails, filed 12, flagged 3"
```

### View Execution History

1. Open the skill
2. Click **Execution History**
3. See past runs:
   - When it ran
   - How long it took
   - Success/failure status
   - Final output

## Skill Examples

### Email to Calendar Workflow

Converts email messages into calendar events:

```
Step 1: Parse Email
  Tool: Email Parser (custom)
  Input: $.input.email
  Output: { subject, date, attendees }
  Error handling: Stop

Step 2: Extract Date
  Tool: Date Extractor (custom)
  Input: $.step1.subject
  Output: { eventDate, startTime, endTime }
  Error handling: Continue

Step 3: Create Event
  Tool: Google Calendar (MCP)
  Input: $.step1.output + $.step2.output
  Output: { eventId, link }
  Error handling: Retry

Step 4: Send Confirmation
  Tool: Email Sender (custom)
  Input: $.step3.output
  Output: { sent: true }
  Error handling: Continue
```

### Daily Standup Generator

Creates standup notes from meetings and commits:

```
Step 1: Fetch Commits
  Tool: Git Commit Fetcher (custom)
  Input: $.input.since (time)
  Output: { commits: [...] }

Step 2: Summarize Commits
  Tool: Text Summarizer (builtin)
  Input: $.step1.commits
  Output: { summary: "..." }

Step 3: Fetch Meeting Notes
  Tool: Meeting Fetcher (custom)
  Input: $.input.meetingIds
  Output: { notes: [...] }

Step 4: Format Standup
  Tool: Standup Formatter (custom)
  Input: $.step2.output + $.step3.output
  Output: { standup: "..." }

Step 5: Post to Slack
  Tool: Slack Poster (MCP)
  Input: $.step4.output
  Output: { posted: true }
```

### Invoice Processing

Processes scanned invoices:

```
Step 1: Extract Text
  Tool: OCR (MCP)
  Input: $.input.imageFile
  Output: { text: "..." }

Step 2: Parse Invoice
  Tool: Invoice Parser (custom)
  Input: $.step1.text
  Output: { vendor, amount, date, items }

Step 3: Validate
  Tool: Invoice Validator (custom)
  Input: $.step2.output
  Condition: Only if amount > $0
  Output: { valid: true/false }

Step 4: File Invoice
  Tool: Document Filer (custom)
  Input: $.step2.output + $.step3.output
  Output: { filePath: "..." }

Step 5: Send Receipt
  Tool: Email Sender (custom)
  Input: $.step4.output
  Error handling: Continue
  Output: { sent: true }
```

### Research Workflow

Automates research and report generation:

```
Step 1: Search Web
  Tool: Web Search (MCP)
  Input: $.input.topic
  Output: { results: [...] }

Step 2: Summarize Results
  Tool: Text Summarizer (builtin)
  Input: $.step1.results
  Output: { summary: "..." }

Step 3: Extract Key Points
  Tool: Key Point Extractor (custom)
  Input: $.step1.results
  Output: { keyPoints: [...] }

Step 4: Generate Report
  Tool: Report Generator (custom)
  Input: $.step2.output + $.step3.output
  Output: { reportHtml: "..." }

Step 5: Save to File
  Tool: File Writer (custom)
  Input: $.step4.output
  Output: { filePath: "..." }
```

## Advanced Features

### Conditional Branches

Different paths based on conditions:

```
Step 1: Check Data Quality
  Output: { isValid: true/false }

Step 2 (Conditional):
  If isValid == true:
    Tool: Process Data
  Else:
    Tool: Alert User

Step 3: Continue with result
```

### Error Recovery

Handle failures gracefully:

```
Step 1: Fetch from API
  Error handling: Retry (max 3 times)

Step 2: Use cached data
  Error handling: Continue (if Step 1 fails)

Step 3: Process something
  Error handling: Stop (critical step)
```

### Data Transformation

Transform data as it flows:

```
Workflow Input:
  { data: "a,b,c" }
    ↓
Step 1: Split by comma
  Input mapping: "$.input.data" → split
  Output: { items: ["a", "b", "c"] }
    ↓
Step 2: Process each item
  Input mapping: "$.step1.items" → process
  Output: { processed: ["A", "B", "C"] }
    ↓
Step 3: Join back
  Input mapping: "$.step2.processed" → join
  Output: "A,B,C"
```

## Managing Skills

### Edit Existing Skill

1. Click the skill
2. Click **Edit**
3. Modify steps, conditions, or handlers
4. Click **Update Skill**

Changes apply to future executions.

### Clone a Skill

1. Find the skill
2. Click **Clone**
3. Give it a new name
4. Modify as needed
5. Save as variation

Great for creating related workflows.

### Delete a Skill

1. Click the skill
2. Click **Delete**
3. Confirm deletion

Note: This doesn't affect past execution records.

### Share a Skill

1. Set visibility to **Public**
2. Skill appears in Marketplace
3. Others can view and clone it
4. You get credit as creator

## Best Practices

### Keep Steps Simple

**✓ Good workflow:**
- Each step does one thing
- Clear input/output
- Easy to debug
- Easy to modify

**✗ Bad workflow:**
- Steps do multiple things
- Complex transformations
- Hard to understand
- Hard to fix when broken

### Use Clear Step Names

**✓ Good:**
```
Step 1: Parse Email
Step 2: Extract Date
Step 3: Create Calendar Event
```

**✗ Bad:**
```
Step 1: Tool1
Step 2: Processor
Step 3: Output
```

### Test Each Step

Before saving, test:
1. Test with valid input
2. Test with invalid input
3. Test edge cases
4. Watch each step's output

### Plan the Flow

Before building:
```
Input → Step A → Step B → Step C → Output
        (Check)  (Check)  (Check)
```

Sketch it out first!

### Use Meaningful Error Handling

```
✓ Good:
  Critical step → Stop (fail fast)
  Optional step → Continue (skip if fails)
  Flaky API → Retry (try again)

✗ Bad:
  Everything → Continue (hide problems)
  Everything → Stop (too fragile)
  Nothing → Retry (wastes time)
```

## Troubleshooting

### Skill Won't Start

**Problem:** Getting "invalid workflow" error
**Solution:**
- Check all steps have tool selected
- Verify input mappings are valid
- Test with simple input first
- Check tool requirements (capabilities)

### Step Fails Silently

**Problem:** Step fails but workflow continues
**Solution:**
- Check error handling isn't "Continue"
- Change to "Stop" for debugging
- Look at step output in execution history
- Check input to failing step

### Wrong Data Flowing

**Problem:** Step gets wrong input
**Solution:**
- Click step to see input mapping
- Verify path is correct: `$.step1.output`
- Check previous step's actual output
- Use step results to verify paths

### Skill Too Slow

**Problem:** Workflow takes too long
**Solution:**
- Remove unnecessary steps
- Check for long-running tools
- Look for retry loops (keep retrying)
- Consider breaking into smaller skills

### Data Transformation Issues

**Problem:** Output format doesn't match next step's input
**Solution:**
- Check what Step A outputs
- Check what Step B expects
- Use intermediate tool to transform
- Test manually with that data

## Execution Modes

### Manual Execution

Run skill on demand:
```
You: "Execute my report skill"
Skill runs immediately
Result displayed
```

### Scheduled Execution

Run on a schedule (coming soon):
```
Every day at 9 AM:
  → Run Daily Report skill
  → Save results to file
```

### Triggered Execution

Run when events happen (coming soon):
```
When email arrives:
  → Run Email Processor skill
  → File the email
```

## Performance

### Execution Time

Skills show how long each step took:

```
Step 1: Email Parser    45ms
Step 2: Date Extractor  23ms
Step 3: Calendar API   1200ms
Step 4: Confirmation    78ms
─────────────────────
Total:                 1346ms
```

Optimize the slowest steps first!

### Resource Usage

Each tool uses resources:
- File I/O (filesystem steps)
- Network (API calls)
- Computation (transformations)
- Memory (data processing)

Monitor and optimize:
- Avoid large file operations
- Cache results when possible
- Use batch operations
- Clean up intermediate data

## Advanced Patterns

### Parallel Steps

Execute independent steps at the same time (coming soon):

```
Step 1: Fetch Data
  ├─→ Step 2a: Analyze
  ├─→ Step 2b: Visualize
  └─→ Step 2c: Archive
       ↓
Step 3: Combine Results
```

### Dynamic Steps

Repeat steps for each item (coming soon):

```
Step 1: Get list of files
Step 2: For each file:
          → Process
          → Store result
Step 3: Combine all results
```

### Error Handling Chains

Fallback strategies:

```
Step 1: Try API
  If fails → Step 2: Use cached data
    If fails → Step 3: Use defaults
      If fails → Alert user
```

## Summary

Skill Composition lets you:

✓ Automate multi-step processes
✓ Chain tools together
✓ Handle failures gracefully
✓ Create reusable workflows
✓ Share automation knowledge

**Workflow:**
1. Plan the steps
2. Add tools in order
3. Configure input mapping
4. Set error handling
5. Add conditions if needed
6. Test thoroughly
7. Save and execute
8. Share if helpful

**Next steps:**
1. Identify a process you repeat
2. Break it into steps
3. Create a skill for it
4. Test with real data
5. Execute regularly
6. Consider sharing

Happy workflow building! ⚙️
