# Phase 3 Quick Start Guide

**Created**: February 2, 2026
**Phase**: 3 (Custom Tools, Composite Skills, Memory Synthesis)

---

## 🚀 Quick Overview

Phase 3 introduces three powerful Helix capabilities:

1. **Custom Tools** - Write JavaScript code that runs securely in a sandbox
2. **Composite Skills** - Chain multiple tools together into workflows
3. **Memory Synthesis** - Use Claude to analyze conversations and detect patterns

---

## 💻 Custom Tools

### Creating a Custom Tool

```typescript
// 1. In the UI, go to Custom Tools
// 2. Click "Create Tool"
// 3. Write your JavaScript function:

async function main() {
  // Your tool code here
  const result = params.x * 2;
  log(`Computed: ${result}`);
  return { success: true, result };
}

// Return from your tool:
return await main();
```

### Tool Execution Example

```typescript
// Execute via gateway RPC:
const client = getGatewayClient();
const result = await client.request('tools.execute_custom', {
  toolId: 'tool-123',
  code: `
    async function main() {
      return { doubled: params.value * 2 };
    }
    return await main();
  `,
  params: { value: 21 }
});

// Result:
// {
//   success: true,
//   output: { doubled: 42 },
//   executionTimeMs: 145,
//   auditLog: [...]
// }
```

### Allowed Operations

✅ **Allowed in Custom Tools:**
- Math operations
- String manipulation
- Object/array manipulation
- JSON parsing
- Async operations
- Logging via `log()`
- Date operations

❌ **NOT Allowed:**
- `eval()`, `Function()` constructor
- `require()`, dynamic `import()`
- Process access
- File system access
- Child process spawning
- `__proto__` or `constructor.prototype` mutation

### Tool Capabilities

Define what your tool is allowed to do:

```typescript
const capabilities = [
  'filesystem:read',        // Read files (future)
  'network:localhost',      // Local network (future)
  // process:spawn          // NOT allowed for user tools
]
```

---

## 🔗 Composite Skills

### Building a Skill

**Step 1: Create the skill definition**

```typescript
const skill: CompositeSkill = {
  id: 'skill-123',
  name: 'Analyze and Report',
  steps: [
    {
      stepId: 'analyze',
      toolName: 'analyze_text',
      inputMapping: {
        text: '$.input.data'
      },
      errorHandling: 'stop'
    },
    {
      stepId: 'report',
      toolName: 'create_report',
      inputMapping: {
        analysis: '$.analyze.result',
        title: '$.input.title'
      },
      condition: '$.analyze.result.score > 50',
      errorHandling: 'continue'
    }
  ]
};
```

**Step 2: Execute the skill**

```typescript
const result = await client.request('skills.execute_composite', {
  skillId: 'skill-123',
  input: {
    data: 'Some text to analyze',
    title: 'Analysis Report'
  }
});

// Result structure:
// {
//   success: true,
//   skillId: 'skill-123',
//   stepResults: [
//     { stepId: 'analyze', success: true, output: {...} },
//     { stepId: 'report', success: true, output: {...} }
//   ],
//   finalOutput: {...},
//   executionContext: {
//     input: {...},
//     analyze: {...},
//     report: {...}
//   },
//   stepsCompleted: 2,
//   totalSteps: 2
// }
```

### JSONPath Input Mapping

Map data between steps using JSONPath syntax:

```typescript
// Input to skill:
{
  user: { name: 'Alice', age: 30 },
  text: 'Hello world'
}

// Mapping examples:
'$.user.name'           // 'Alice'
'$.user.age'            // 30
'$.text'                // 'Hello world'
'$.user'                // { name: 'Alice', age: 30 }
```

### Conditional Execution

Skip steps based on conditions:

```typescript
{
  stepId: 'send_alert',
  toolName: 'send_email',
  condition: '$.analyze.result.severity === "high"',
  inputMapping: {
    email: '$.user.email',
    message: '$.alert_message'
  }
}
// This step only executes if severity is "high"
```

### Error Handling

Choose how to handle step failures:

```typescript
// Option 1: Stop (default)
{
  stepId: 'critical_step',
  errorHandling: 'stop'
  // If this step fails, entire skill execution stops
}

// Option 2: Continue
{
  stepId: 'optional_step',
  errorHandling: 'continue'
  // If this step fails, continue to next step
}

// Option 3: Retry
{
  stepId: 'retry_step',
  errorHandling: 'retry',
  retryAttempts: 3
  // If this step fails, retry up to 3 times
}
```

---

## 🧠 Memory Synthesis

### Running a Synthesis Job

```typescript
// Submit synthesis job
const result = await client.request('memory.synthesize', {
  synthesisType: 'emotional_patterns',
  conversations: [
    { id: 'conv-1', text: 'I feel anxious about deadlines', timestamp: '2024-01-01T10:00:00Z' },
    { id: 'conv-2', text: 'Work stress is affecting my sleep', timestamp: '2024-01-02T10:00:00Z' },
    // ... more conversations
  ]
});

// Result:
// {
//   status: 'completed',
//   synthesisType: 'emotional_patterns',
//   analysis: {
//     patterns: [
//       {
//         type: 'emotional_trigger',
//         description: 'Gets anxious when discussing deadlines',
//         evidence: ['conv-1', 'conv-2'],
//         confidence: 0.87,
//         recommendations: ['Practice time management', 'Set realistic expectations']
//       }
//     ],
//     summary: 'User shows consistent anxiety around work deadlines...'
//   },
//   executionTimeMs: 2341,
//   conversationCount: 45
// }
```

### Synthesis Types

**1. Emotional Patterns** (Layer 2)
```typescript
synthesisType: 'emotional_patterns'
// Detects emotional triggers, regulation patterns, intensity variations
```

**2. Prospective Self** (Layer 4)
```typescript
synthesisType: 'prospective_self'
// Identifies goals, fears, possible selves, values
```

**3. Relational Memory** (Layer 3)
```typescript
synthesisType: 'relational_memory'
// Analyzes relationships, attachment patterns, trust dynamics
```

**4. Narrative Coherence** (Layer 1)
```typescript
synthesisType: 'narrative_coherence'
// Examines life narrative, sense-making, identity consistency
```

**5. Full Synthesis** (All Layers)
```typescript
synthesisType: 'full_synthesis'
// Comprehensive analysis across all 7 psychological layers
```

### Checking Job Status

```typescript
const status = await client.request('memory.synthesis_status', {
  jobId: 'job-123'
});

// Result:
// {
//   jobId: 'job-123',
//   status: 'running',  // 'pending' | 'running' | 'completed' | 'failed'
//   progress: 0.65      // 0-1 (65% complete)
// }
```

### Listing Patterns

```typescript
const patterns = await client.request('memory.list_patterns', {
  layer: 2,  // Optional: specific layer
  patternType: 'emotional_trigger'  // Optional: specific type
});

// Result:
// {
//   patterns: [
//     {
//       id: 'pattern-1',
//       type: 'emotional_trigger',
//       layer: 2,
//       description: 'Anxiety with deadlines',
//       confidence: 0.87,
//       firstDetected: '2024-01-01T10:00:00Z',
//       observationCount: 5
//     }
//   ],
//   total: 12
// }
```

---

## 📊 Web UI Usage

### Custom Tools Page

**Navigation**: Settings → Custom Tools

**Features:**
- Create new tools with code editor
- Validate code for dangerous patterns
- Set capabilities (filesystem, network, etc.)
- Clone tools from public templates
- View usage history
- Execute tools with parameters
- Track execution time and results

**Actions:**
```
1. Click "Create Tool"
2. Write JavaScript code
3. Test code safety (automatic)
4. Set capabilities
5. Choose public/private
6. Save tool
7. Execute with parameters
8. View audit log
```

### Composite Skills Page

**Navigation**: Skills → Composite Skills

**Features:**
- Drag-and-drop skill builder
- Add steps with tool selection
- Configure input mappings via JSONPath
- Set conditional execution
- Error handling strategies
- Test skill with sample data
- View execution history

**Actions:**
```
1. Click "Create Skill"
2. Add steps one at a time
3. For each step:
   - Select tool
   - Map inputs via JSONPath
   - Set condition (optional)
   - Choose error handling
4. Test with sample input
5. Save skill
6. Share to marketplace (optional)
```

### Memory Synthesis Page

**Navigation**: Observatory → Memory Synthesis

**Features:**
- Submit synthesis jobs
- Monitor job progress
- View detected patterns
- See pattern evidence and confidence
- Read recommendations
- Filter patterns by layer/type
- Schedule recurring synthesis

**Actions:**
```
1. Go to Memory Synthesis
2. Select synthesis type
3. Choose time range (optional)
4. Submit job
5. Monitor progress
6. View results when complete
7. Explore patterns
8. Review recommendations
```

---

## 🔌 API Reference

### Gateway RPC Methods

#### Custom Tools

**Execute Tool**
```typescript
client.request('tools.execute_custom', {
  toolId?: string,
  code: string,
  params?: Record<string, unknown>,
  metadata?: { name, version, author }
})
→ { success, output, executionTimeMs, auditLog }
```

**Get Metadata**
```typescript
client.request('tools.get_metadata', { toolId: string })
→ { id, name, description, parameters, version }
```

**List Tools**
```typescript
client.request('tools.list', {})
→ { tools: [...], total: number }
```

#### Composite Skills

**Execute Skill**
```typescript
client.request('skills.execute_composite', {
  skillId?: string,
  skill?: CompositeSkill,
  input?: Record<string, unknown>
})
→ { success, skillId, stepResults, finalOutput, ... }
```

**Validate Skill**
```typescript
client.request('skills.validate_composite', { skill: CompositeSkill })
→ { valid: boolean, errors: string[] }
```

#### Memory Synthesis

**Run Synthesis**
```typescript
client.request('memory.synthesize', {
  synthesisType: string,
  conversations: Array<{ id, text, timestamp }>
})
→ { status, synthesisType, analysis, executionTimeMs }
```

---

## 🧪 Testing

### Test a Custom Tool

```typescript
// In browser console or via API:
const result = await customToolsService.executeTool({
  code: `
    async function main() {
      log('Starting computation');
      return { doubled: params.value * 2 };
    }
    return await main();
  `,
  params: { value: 21 }
});

console.log(result);  // { success: true, output: {doubled: 42}, ... }
```

### Test a Composite Skill

```typescript
const skillDefinition = {
  id: 'test-skill',
  name: 'Test',
  steps: [
    {
      stepId: 'step1',
      toolName: 'double',
      inputMapping: { x: '$.input.value' }
    }
  ]
};

const result = await compositeSkillsService.executeSkill({
  skill: skillDefinition,
  input: { value: 21 }
});

console.log(result.finalOutput);  // { result: 42 }
```

---

## ⚠️ Common Issues

### "Code contains dangerous function: eval"
**Solution**: Don't use `eval()`, `Function()`, `require()`, or `import()`

### "Execution timeout exceeded"
**Solution**: Your tool took longer than 30 seconds. Optimize logic or break into multiple tools

### "Parameter 'x' has implicit any type"
**Solution**: Make sure your code parameter names match your inputMapping keys

### "JSONPath is invalid"
**Solution**: Check JSONPath syntax. Examples:
- `$.input.value` ✅
- `$.step1.result` ✅
- `$[0].name` ❌ (array access not in this version)

---

## 📖 More Resources

- [Phase 3 Implementation Status](PHASE-3-IMPLEMENTATION-STATUS.md) - Technical deep dive
- [Phase 3 Completion Summary](PHASE-3-COMPLETION-SUMMARY.md) - What's been built
- [Phase 2 Integration Analysis](PHASE-2-INTEGRATION-ANALYSIS.md) - How Phase 2 connects
- [Architecture Roadmap](../web/docs/knowledge-base/extended/future-architecture-roadmap.md) - System design

---

## 🎯 Next Steps

**For End Users:**
- Create your first custom tool
- Chain tools into a skill
- Run memory synthesis on your conversations

**For Developers:**
- Add database integration to complete TODOs
- Build tests for execution engines
- Port components to desktop
- Optimize performance

**For System Admins:**
- Monitor custom tool execution
- Review audit logs
- Manage user capabilities

---

*Phase 3 Quick Start Guide v1.0 | February 2, 2026*