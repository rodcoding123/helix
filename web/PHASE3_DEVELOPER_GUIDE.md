# Phase 3 Developer Guide: Custom Tools, Composite Skills & Memory Synthesis

This guide provides technical documentation for developers implementing Phase 3 features.

## Architecture Overview

Phase 3 consists of three interconnected systems:

1. **Custom Tools**: Sandboxed JavaScript execution with capability restrictions
2. **Composite Skills**: Multi-step workflow orchestration with JSONPath data mapping
3. **Memory Synthesis**: Claude-powered pattern detection and analysis

## Data Models

### Custom Tool

```typescript
interface CustomTool {
  id: string; // UUID
  userId: string; // Owner
  name: string;
  description?: string;
  code: string; // JavaScript function
  parameters: ToolParameter[];
  capabilities: string[]; // Allowed APIs
  returnType: string; // Expected output type
  tags?: string[];
  visibility: 'private' | 'public';
  createdAt: string; // ISO 8601
  updatedAt: string;
  version: string; // semver
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required: boolean;
  defaultValue?: any;
}
```

### Composite Skill

```typescript
interface CompositeSkill {
  id: string; // UUID
  userId: string;
  name: string;
  description?: string;
  steps: SkillStep[];
  version: string;
  tags?: string[];
  visibility: 'private' | 'public';
  createdAt: string;
  updatedAt: string;
}

interface SkillStep {
  stepId: string; // Unique within skill
  toolName: string; // Reference to tool
  description?: string;
  inputMapping: Record<string, string>; // { param: "$.path.to.value" }
  outputMapping?: string; // Where to store output
  condition?: string; // JavaScript boolean expression
  errorHandling: 'stop' | 'continue' | 'retry';
  retryCount?: number; // Default 3
}
```

### Memory Pattern

```typescript
interface MemoryPattern {
  id: string;
  userId: string;
  patternType: string; // emotional_trigger, goal, relationship, etc.
  layer: number; // 1-7
  description: string;
  evidence: string[]; // Conversation IDs
  confidence: number; // 0-1
  firstDetected: string; // ISO 8601
  lastObserved: string;
  observationCount: number;
  userConfirmed?: boolean;
  userNotes?: string;
  createdAt: string;
  updatedAt: string;
}
```

## API Reference

### Custom Tools RPC Methods

#### `tools.create`

Create a new custom tool.

**Request:**

```json
{
  "name": "summarizeText",
  "description": "Summarize text to N words",
  "code": "function summarizeText(text, limit) { return text.substring(0, limit); }",
  "parameters": [
    { "name": "text", "type": "string", "required": true },
    { "name": "limit", "type": "number", "required": false, "defaultValue": 100 }
  ],
  "capabilities": ["string"],
  "returnType": "string",
  "tags": ["text", "nlp"],
  "visibility": "private"
}
```

**Response:**

```json
{
  "id": "tool-uuid",
  "userId": "user-uuid",
  "name": "summarizeText",
  ...
}
```

**Authorization**: Requires `WRITE_TOOLS` scope

#### `tools.get`

Retrieve a tool by ID.

**Request:**

```json
{
  "toolId": "tool-uuid"
}
```

**Response:**
Returns full tool object (see data model)

#### `tools.list`

List user's tools with pagination.

**Request:**

```json
{
  "visibility": "private", // Optional filter
  "tags": ["text"], // Optional filter
  "limit": 20,
  "offset": 0
}
```

**Response:**

```json
{
  "tools": [...],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

#### `tools.update`

Update tool code, parameters, or metadata.

**Request:**

```json
{
  "toolId": "tool-uuid",
  "name": "summarizeText v2",
  "code": "function summarizeText(text, limit) { ... }",
  "parameters": [...]
}
```

**Response**: Updated tool object

#### `tools.execute`

Execute a tool with parameters.

**Request:**

```json
{
  "toolId": "tool-uuid",
  "params": {
    "text": "Long text here...",
    "limit": 50
  }
}
```

**Response:**

```json
{
  "success": true,
  "output": "Summarized text...",
  "executionTimeMs": 125,
  "logs": [...]
}
```

**Errors:**

```json
{
  "success": false,
  "error": "Error message",
  "executionTimeMs": 50
}
```

#### `tools.validate`

Check if code is safe without executing.

**Request:**

```json
{
  "code": "function myFunc() { eval('bad'); }"
}
```

**Response:**

```json
{
  "safe": false,
  "violations": ["Dangerous eval function detected"]
}
```

#### `tools.delete`

Delete a tool (owner only).

**Request:**

```json
{
  "toolId": "tool-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Tool deleted"
}
```

### Composite Skills RPC Methods

#### `skills.create`

Create a new composite skill.

**Request:**

```json
{
  "name": "processText",
  "description": "Multi-step text processing",
  "steps": [
    {
      "stepId": "fetch",
      "toolName": "fetchText",
      "inputMapping": { "url": "$.input.sourceUrl" },
      "outputMapping": "$.fetched",
      "errorHandling": "stop"
    },
    {
      "stepId": "summarize",
      "toolName": "summarizeText",
      "inputMapping": { "text": "$.fetched.content" },
      "outputMapping": "$.summary",
      "errorHandling": "stop"
    }
  ]
}
```

**Response**: Created skill object

#### `skills.execute`

Execute a skill with input data.

**Request:**

```json
{
  "skillId": "skill-uuid",
  "input": {
    "sourceUrl": "https://example.com/article"
  }
}
```

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "stepId": "fetch",
      "success": true,
      "output": { "content": "..." },
      "executionTimeMs": 250
    },
    {
      "stepId": "summarize",
      "success": true,
      "output": "Summary...",
      "executionTimeMs": 150
    }
  ],
  "finalOutput": {
    "sourceUrl": "...",
    "fetched": {...},
    "summary": "..."
  },
  "totalTimeMs": 400
}
```

#### `skills.validate`

Validate skill steps and JSONPath mappings.

**Request:**

```json
{
  "steps": [...]
}
```

**Response:**

```json
{
  "valid": true,
  "errors": []
}
```

Or with errors:

```json
{
  "valid": false,
  "errors": [
    "Step 0: Missing toolName",
    "Step 1: Invalid errorHandling value 'invalid'",
    "Step 1: JSONPath '$.missing.field' won't resolve from step 0"
  ]
}
```

#### `skills.update`

Update skill steps or metadata.

**Request:**

```json
{
  "skillId": "skill-uuid",
  "name": "processText v2",
  "steps": [...]
}
```

#### `skills.list`

List user's skills.

**Request:**

```json
{
  "visibility": "private",
  "tags": ["text"],
  "limit": 20,
  "offset": 0
}
```

#### `skills.delete`

Delete a skill.

**Request:**

```json
{
  "skillId": "skill-uuid"
}
```

### Memory Synthesis RPC Methods

#### `memory.startSynthesis`

Start a memory synthesis job.

**Request:**

```json
{
  "synthesisType": "emotional_patterns",
  "timeRangeStart": "2024-01-01T00:00:00Z",
  "timeRangeEnd": "2024-02-01T00:00:00Z",
  "isRecurring": true,
  "cronSchedule": "0 2 * * *"
}
```

**Response:**

```json
{
  "jobId": "job-uuid",
  "status": "pending",
  "progress": 0,
  "createdAt": "2024-02-03T10:00:00Z"
}
```

#### `memory.getJob`

Get status of a synthesis job.

**Request:**

```json
{
  "jobId": "job-uuid"
}
```

**Response:**

```json
{
  "jobId": "job-uuid",
  "status": "completed",
  "progress": 1.0,
  "insights": {
    "patterns": [...],
    "recommendations": [...]
  },
  "memoriesAnalyzed": 125,
  "patternsDetected": 8
}
```

#### `memory.listPatterns`

List detected patterns.

**Request:**

```json
{
  "layer": 2, // Optional
  "patternType": "emotional_trigger", // Optional
  "minConfidence": 0.7,
  "limit": 50,
  "offset": 0
}
```

**Response:**

```json
{
  "patterns": [...],
  "total": 24,
  "limit": 50,
  "offset": 0
}
```

#### `memory.confirmPattern`

Confirm user agrees with a pattern.

**Request:**

```json
{
  "patternId": "pattern-uuid",
  "userNotes": "This matches my experience"
}
```

**Response:**

```json
{
  "id": "pattern-uuid",
  "userConfirmed": true,
  "userNotes": "..."
}
```

## JSONPath Implementation

The implementation supports a subset of JSONPath for data mapping:

### Syntax

```
$.root.path.to.value      // Simple paths
$.array[0]                // Array indexing
$.field.nested.deep       // Arbitrary nesting
```

### Examples

**Input data:**

```json
{
  "input": { "text": "hello" },
  "step1": { "result": 42 }
}
```

**Mappings:**

```
$.input.text        → "hello"
$.step1.result      → 42
$.input            → { "text": "hello" }
```

### Evaluation

```typescript
function extractPathValue(obj: Record<string, any>, path: string): any {
  if (!path.startsWith('$')) return undefined;

  let current = obj;
  const parts = path.substring(2).split('.');

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}
```

## Security & Sandbox

### Code Validation

All custom tool code is scanned for dangerous patterns before execution:

**Forbidden Functions:**

- `eval()` - Dynamic code execution
- `Function()` constructor - Dynamic function creation
- `require()` - Module loading
- `import` - Module importing
- `process` - Node.js process access
- `global` - Global object access
- `__dirname`, `__filename` - File path constants
- `exec()`, `spawn()` - Command execution
- `fs` module - File system access

**Allowed Capabilities:**

- `math`: Math object and operations
- `string`: String methods and manipulation
- `array`: Array methods
- `json`: JSON operations
- `object`: Object operations
- `date`: Date operations
- `crypto`: Crypto operations
- `promise`: Promise handling (but not network calls)

### Validation Functions

```typescript
function validateToolCode(code: string): ValidationResult {
  const violations: string[] = [];

  // Check for dangerous patterns
  const patterns = [
    { pattern: /\beval\s*\(/, name: 'eval function' },
    { pattern: /new\s+Function\s*\(/, name: 'Function constructor' },
    // ... more patterns
  ];

  for (const { pattern, name } of patterns) {
    if (pattern.test(code)) {
      violations.push(`Dangerous ${name} detected`);
    }
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}
```

### Execution Isolation

- Each tool executes in its own JavaScript context
- No access to global state
- No file system, network, or process access
- 30-second timeout per execution
- Memory limited to prevent DoS

## Cron Schedule Format

Cron syntax: `minute hour day month weekday`

**Ranges:**

- Minute: 0-59
- Hour: 0-23
- Day: 1-31
- Month: 1-12
- Weekday: 0-6 (0=Sunday, 6=Saturday)

**Examples:**

```
0 2 * * *       → Daily at 2:00 AM
0 2 * * 0       → Weekly Sunday at 2:00 AM
0 2 1 * *       → Monthly on 1st at 2:00 AM
0/6 * * * *     → Every 6 hours
*/15 * * * *    → Every 15 minutes
0 9-17 * * 1-5  → 9 AM to 5 PM, weekdays only
```

## Error Handling

### Tool Execution Errors

```json
{
  "success": false,
  "error": "TypeError: text.split is not a function",
  "executionTimeMs": 45,
  "stack": "at summarizeText (eval:2:15)"
}
```

### Skill Execution Errors

Each step includes error details:

```json
{
  "stepId": "process",
  "success": false,
  "error": "Tool not found: unknownTool",
  "errorHandling": "stop",
  "executionTimeMs": 10
}
```

## Performance Considerations

### Tool Execution

- **Typical time**: 50-200ms per tool
- **Timeout**: 30 seconds
- **Constraints**: No DOM, network, or file access
- **Optimization**: Pre-compile code, cache results

### Skill Execution

- **Step overhead**: ~10-20ms per step
- **Total time**: Sum of step times + overhead
- **Parallelization**: Steps must run sequentially (for now)
- **Caching**: Results cached for identical inputs

### Memory Synthesis

- **First run**: 5-30s depending on conversation count
- **Subsequent runs**: 2-10s (with caching)
- **Conversation limit**: Practical limit ~10,000 conversations
- **Pattern detection**: Using Claude API (rate-limited)

## Testing

### Unit Testing Custom Tools

```typescript
function testTool(code: string, inputs: any, expected: any) {
  // Validate code
  const validation = validateToolCode(code);
  if (!validation.safe) throw validation.violations;

  // Execute in sandbox
  const result = executeSandboxed(code, inputs);

  // Compare
  expect(result).toEqual(expected);
}
```

### Integration Testing Skills

```typescript
async function testSkill(skillId: string, input: any) {
  const skill = await getSkill(skillId);
  const result = await executeCompositeSkill(skill, input);

  // Verify each step
  for (const stepResult of result.results) {
    expect(stepResult.success).toBe(true);
  }

  // Verify final output
  expect(result.finalOutput).toBeDefined();
}
```

## Best Practices

1. **Code Validation First**: Always validate before execution
2. **JSONPath Testing**: Verify paths resolve correctly
3. **Error Handling**: Plan for failure modes
4. **Performance Monitoring**: Track execution times
5. **Capability Restriction**: Only enable needed APIs
6. **Input Validation**: Don't trust user inputs
7. **Atomic Operations**: Keep tools focused
8. **Documentation**: Comment complex logic

## Troubleshooting

### Tools not executing

- Check for forbidden patterns
- Verify parameters match code
- Test validation first
- Check execution logs

### Skills failing

- Verify JSONPath mappings
- Check tool parameters
- Test steps individually
- Review error handling strategy

### Memory Synthesis issues

- Ensure sufficient conversation history
- Check time range settings
- Review Claude API limits
- Verify cron syntax if recurring

## See Also

- [User Guide](./PHASE3_USER_GUIDE.md)
- [Troubleshooting](./PHASE3_TROUBLESHOOTING.md)
- Integration with Helix's 7-layer psychology architecture
