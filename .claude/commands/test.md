# /test Command

Run the test suite across the entire Helix system.

## Usage

```bash
/test                           # Run all tests (both systems)
/test --core                    # Helix core only
/test --openclaw                # OpenClaw only
/test --filter=HashChain        # Filter by name
/test --coverage                # With coverage report
/test --watch                   # Watch mode
```

## What It Does

Runs tests on **both** systems using Vitest:

### Helix Core Tests

```bash
# Run Helix core tests
npm run test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### OpenClaw Tests

```bash
# Run OpenClaw tests
npm run openclaw:test

# Or directly
cd helix-runtime && pnpm run test
```

### Run All Tests

```bash
# Both systems
npm run test:all
```

## Test Statistics

| System     | Test Files | Tests   | Coverage Target |
| ---------- | ---------- | ------- | --------------- |
| Helix Core | 5          | 66      | 80%             |
| OpenClaw   | ~991       | ~5,000+ | 70%             |

## Test Organization

### Helix Core

```
src/helix/
├── hash-chain.test.ts       # Hash chain integrity (11 tests)
├── command-logger.test.ts   # Discord logging (16 tests)
├── api-logger.test.ts       # API logging (17 tests)
├── heartbeat.test.ts        # Heartbeat mechanism (13 tests)
└── types.test.ts            # Type definitions (9 tests)
```

### OpenClaw

```
helix-runtime/
├── src/**/*.test.ts         # Unit tests (~500 files)
├── test/                    # Integration tests
└── vitest configs:
    ├── vitest.config.ts     # Default config
    ├── vitest.unit.config.ts
    ├── vitest.e2e.config.ts
    ├── vitest.gateway.config.ts
    └── vitest.live.config.ts
```

## Output Format

```markdown
## Test Results

### Helix Core

- Total: 66 tests
- Passed: 66
- Failed: 0
- Duration: 0.27s

### OpenClaw

- Total: X tests
- Passed: X
- Failed: X
- Duration: X.XXs

### Combined

- Total: X tests
- Passed: X
- Failed: X
- Overall Status: PASS | FAIL

### Coverage (if requested)

**Helix Core:**

- Overall: X%
- hash-chain.ts: X%
- command-logger.ts: X%
- api-logger.ts: X%

**OpenClaw:**

- Overall: X%
- Lines: 70% threshold
- Branches: 55% threshold
```

## Common Filters

```bash
# Helix core filters
npm run test -- --filter=hash-chain
npm run test -- --filter=command-logger
npm run test -- --filter="HashChain"

# OpenClaw filters
cd helix-runtime && pnpm run test -- --filter=agents
cd helix-runtime && pnpm run test -- --filter=gateway
```

## OpenClaw Test Variants

```bash
# Unit tests only
cd helix-runtime && pnpm run test:unit

# E2E tests
cd helix-runtime && pnpm run test:e2e

# Gateway tests
cd helix-runtime && pnpm run test:gateway

# Live tests (requires running services)
cd helix-runtime && pnpm run test:live
```

## Troubleshooting

### Clear Cache

```bash
# Helix
npx vitest --clearCache

# OpenClaw
cd helix-runtime && pnpm exec vitest --clearCache
```

### Verbose Output

```bash
# Helix
npx vitest run --reporter=verbose

# OpenClaw
cd helix-runtime && pnpm run test -- --reporter=verbose
```

### Mock Discord Webhooks

Tests should mock Discord webhooks:

```typescript
import { vi } from 'vitest';

vi.mock('./discord-client', () => ({
  sendWebhook: vi.fn().mockResolvedValue({ success: true }),
}));
```

## Related Commands

- `/quality` - All quality checks including tests
- `/pipeline` - Full pipeline with test generation
- `/audit` - Comprehensive codebase audit
