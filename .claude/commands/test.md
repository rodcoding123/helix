# /test Command

Run the test suite with optional filtering.

## Usage

```bash
/test                           # Run all tests
/test --filter=HashChain        # Filter by name
/test --coverage                # With coverage report
/test --watch                   # Watch mode
```

## What It Does

### Run Tests

```bash
# Default - run all tests
npm run test
# Equivalent: npx vitest run

# With filter
npx vitest run --filter=TestName

# With coverage
npm run test:coverage
# Equivalent: npx vitest run --coverage

# Watch mode
npm run test:watch
# Equivalent: npx vitest
```

## Test Organization

```
src/helix/
├── __tests__/
│   ├── hash-chain.test.ts      # Hash chain integrity tests
│   ├── command-logger.test.ts  # Discord logging tests
│   ├── heartbeat.test.ts       # Heartbeat mechanism tests
│   └── context-loader.test.ts  # Psychological context loading tests
└── [source files]
```

## Output Format

```markdown
## Test Results

### Summary
- Total: X tests
- Passed: X
- Failed: X
- Skipped: X
- Duration: X.XX seconds

### Failed Tests (if any)
1. **describe > test_name**
   - Error: [message]
   - Location: src/helix/__tests__/file.test.ts:42

### Coverage (if requested)
- Overall: X%
- src/helix/hash-chain.ts: X%
- src/helix/command-logger.ts: X%
- src/helix/heartbeat.ts: X%

### Recommendations
- [suggestions for improving coverage]
```

## Common Filters

```bash
# By test file
--filter=hash-chain
--filter=command-logger
--filter=heartbeat

# By describe block
--filter="HashChain"
--filter="Discord Logger"

# By test name
--filter="should link entries correctly"
```

## Troubleshooting

### Tests Failing Unexpectedly

```bash
# Clear Vitest cache
npx vitest --clearCache

# Run with verbose output
npx vitest run --reporter=verbose
```

### Mock Discord Webhooks

Tests should mock Discord webhooks to avoid actual network calls:

```typescript
import { vi } from 'vitest';

vi.mock('./discord-client', () => ({
  sendWebhook: vi.fn().mockResolvedValue({ success: true })
}));
```

## Related Commands

- `/quality` - All quality checks including tests
- `/pipeline` - Full pipeline with test generation
