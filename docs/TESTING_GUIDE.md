# Helix Desktop Testing Guide

**Version**: 2.0
**Last Updated**: 2026-02-06
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Testing Infrastructure](#testing-infrastructure)
3. [Local Development Setup](#local-development-setup)
4. [Running Tests](#running-tests)
5. [Writing Tests](#writing-tests)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Performance Monitoring](#performance-monitoring)
8. [Troubleshooting](#troubleshooting)
9. [Future Roadmap](#future-roadmap)

---

## Overview

The Helix Desktop testing infrastructure provides comprehensive coverage across:

- **Unit Tests** (190+ tests)
  - Component logic
  - Utility functions
  - Integration logic

- **E2E Tests** (204 test cases)
  - Full user workflows
  - Cross-browser testing (Chromium, Firefox, WebKit)
  - Mobile/tablet responsiveness
  - Accessibility compliance (WCAG AA)

- **Performance Tests**
  - Load time baselines
  - Memory leak detection
  - Scrolling performance
  - Message throughput

- **Security Tests**
  - Data exposure prevention
  - Input validation
  - Authorization checks
  - HTTPS enforcement

### Architecture

```
helix-desktop/
├── src/                          # React + TypeScript source
│   ├── components/               # UI components
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utilities and services
│   ├── __tests__/               # Integration tests
│   └── components/__tests__/    # Component unit tests
├── e2e/                         # Playwright E2E tests
│   ├── full-workflow.spec.ts    # 21 full workflow tests
│   └── secrets.spec.ts          # Fixture tests
├── playwright.config.ts         # Playwright configuration
├── vitest.config.ts             # Vitest unit test configuration
└── test-results/                # Test artifacts
    ├── results.json             # JSON results
    ├── junit.xml                # JUnit format
    └── playwright-report/       # HTML report
```

### Test Execution Timeline

Total test execution time: ~5-10 minutes

- Unit tests: 3-4 seconds
- E2E tests: 40-60 seconds per browser
- Total for all 6 browser configs: 4-6 minutes

---

## Testing Infrastructure

### Frameworks & Tools

| Tool                  | Version | Purpose               |
| --------------------- | ------- | --------------------- |
| Vitest                | 1.x     | Unit testing          |
| Playwright            | 1.58.1  | E2E testing           |
| React Testing Library | Latest  | Component testing     |
| Tauri                 | 2.x     | Desktop app framework |
| TypeScript            | 5.8+    | Type safety           |

### Browser Coverage

**Desktop Browsers:**

- ✅ Chromium (Chrome)
- ✅ Firefox
- ✅ WebKit (Safari)

**Mobile/Tablet:**

- ✅ Pixel 5 (Android Chrome)
- ✅ iPhone 12 (iOS Safari)
- ✅ iPad Pro (Tablet)

### Test Categories

#### 1. Unit Tests (190+ tests)

Location: `src/**/__tests__/*.test.ts`

Coverage:

- Component rendering
- Hook behavior
- Utility functions
- Data transformations
- Error handling

Example:

```typescript
describe('DesktopMemoryPatterns', () => {
  it('should load patterns via Tauri IPC', async () => {
    const result = await mockInvoke('get_memory_patterns', {});
    expect(result).toHaveLength(1);
  });
});
```

#### 2. E2E Tests (204 tests across 6 browsers)

Location: `e2e/*.spec.ts`

Coverage:

- Full user workflows
- Cross-browser compatibility
- Accessibility
- Performance baselines
- Security validation

Example:

```typescript
test('should launch app successfully', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page.locator('text=Helix')).toBeVisible();
});
```

#### 3. Integration Tests

Tests that verify multiple components work together:

- Agent management with routing
- Chat with memory synthesis
- Voice with TTS/STT
- Settings persistence

#### 4. Performance Tests

Measured metrics:

- Chat page load time < 2 seconds
- Smooth scrolling at 100+ messages
- Memory footprint stable
- No memory leaks on long sessions

---

## Local Development Setup

### Prerequisites

```bash
Node.js 20.x or later
npm 10.x or later
Rust (for Tauri desktop builds)
Git
```

### Installation

```bash
# Clone repository
git clone https://github.com/anthropics/helix.git
cd Helix

# Install root dependencies
npm install

# Install helix-desktop dependencies
cd helix-desktop
npm install

# Install Playwright browsers
npx playwright install

# Return to root
cd ..
```

### Environment Setup

Create `.env.local` in `helix-desktop/`:

```bash
# Vite dev server
VITE_API_URL=http://localhost:3001

# Supabase (for tests with fixtures)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-key

# Optional: Discord webhook for local test notifications
# Set in GitHub Secrets, not in .env
# DISCORD_WEBHOOK_TESTS=<your-webhook-url>
```

---

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run specific test file
npm run test -- src/components/__tests__/DesktopMemoryPatterns.test.ts

# Run by test name pattern
npm run test -- --grep "should load patterns"

# Watch mode (auto-rerun on file change)
npm run test -- --watch

# Generate coverage report
npm run test -- --coverage
```

### E2E Tests

```bash
# Terminal 1: Start dev server
cd helix-desktop
npm run dev

# Terminal 2: Run all tests
cd helix-desktop
npx playwright test

# Run specific browser
npx playwright test --project=chromium

# Run specific test file
npx playwright test e2e/full-workflow.spec.ts

# Run specific test by name
npx playwright test -g "should launch app"

# UI mode (interactive debugging)
npx playwright test --ui

# Debug mode (step through)
npx playwright test --debug

# Headed mode (show browser)
npx playwright test --headed
```

### View Reports

```bash
# HTML report
npx playwright show-report

# Performance report (if generated)
cat helix-desktop/performance-report.md

# Failure report (if generated)
open helix-desktop/failure-report.html
```

### Type Checking

```bash
# Check TypeScript errors
npm run typecheck

# Fix ESLint errors
npm run lint:fix

# Format code
npm run format
```

---

## Writing Tests

### Unit Test Template

```typescript
// src/components/__tests__/MyComponent.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from '../myComponent';

describe('MyComponent', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });

  it('should handle errors', () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

### E2E Test Template

```typescript
// e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should complete workflow', async ({ page }) => {
    // Arrange
    await page.goto('http://localhost:5173');

    // Act
    await page.click('button:has-text("Start")');
    await page.fill('input[name="name"]', 'Test User');

    // Assert
    await expect(page.locator('text=Success')).toBeVisible();
  });

  test('should handle errors', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.click('button:has-text("Submit")');
    await expect(page.locator('text=Error')).toBeVisible();
  });
});
```

### Best Practices

1. **Use data-testid attributes**

   ```typescript
   // Component
   <button data-testid="submit-btn">Submit</button>

   // Test
   await page.click('[data-testid="submit-btn"]');
   ```

2. **Test user behavior, not implementation**

   ```typescript
   // ❌ Bad: Testing internal state
   expect(component.state.isLoading).toBe(false);

   // ✅ Good: Testing visible behavior
   await expect(page.locator('[data-testid="loading"]')).not.toBeVisible();
   ```

3. **Use semantic queries**

   ```typescript
   // ✅ Best: semantic selectors
   await page.click('button:has-text("Delete")');

   // ⚠️ Okay: data-testid
   await page.click('[data-testid="delete-btn"]');

   // ❌ Avoid: CSS selectors
   await page.click('button.btn-danger#delete-12345');
   ```

4. **Isolate tests**

   ```typescript
   test.beforeEach(async ({ page }) => {
     // Setup common state
     await page.goto('http://localhost:5173');
   });

   test('should work independently', async ({ page }) => {
     // Test code
   });
   ```

---

## CI/CD Pipeline

### GitHub Actions Workflow

Automatically runs on:

- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Manual trigger via `workflow_dispatch`

**Workflow**: `.github/workflows/test-ci.yml`

### Pipeline Stages

```
1. Unit Tests (parallel)
   ├─ TypeScript check
   ├─ ESLint
   └─ Vitest tests

2. E2E Tests (parallel per browser)
   ├─ Chromium
   ├─ Firefox
   └─ WebKit

3. Accessibility Tests
   └─ WCAG AA compliance

4. Security Check
   ├─ npm audit
   └─ Secrets scan

5. Performance Baseline
   └─ Bundle size analysis

6. Notifications
   ├─ Discord webhook
   └─ GitHub status
```

### Required Secrets

Add to GitHub Repository Settings → Secrets:

```
DISCORD_WEBHOOK_TESTS      # Main test results
DISCORD_WEBHOOK_FAILURES   # Failure reports
DISCORD_WEBHOOK_PERF       # Performance alerts
```

### Status Checks

Tests must pass before merging to main:

- ✅ Unit tests: 100% pass
- ✅ E2E tests: 95%+ pass
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors
- ✅ Accessibility: WCAG AA
- ✅ Security: No vulnerabilities

---

## Performance Monitoring

### Performance Baselines

Located: `helix-desktop/performance-baselines.json`

Tracks metrics by test name:

```json
{
  "should load chat page in < 2 seconds": {
    "avgDuration": 1200,
    "maxDuration": 1800,
    "p95Duration": 1650,
    "threshold": 1440,
    "sampleCount": 15
  }
}
```

### Performance History

Located: `helix-desktop/performance-history.json`

Records 30-day history of all test runs with:

- Timestamp
- All metrics collected
- Regressions detected
- Improvements noted

### Regression Detection

Tests fail if:

- **Duration > baseline × 1.2** (20% threshold)
- Example: Baseline 1000ms, regression at 1200ms+

### Running Performance Analysis

```bash
# Automatically run after E2E tests
# See script: scripts/performance-tracker.mjs

# Manual analysis
node scripts/performance-tracker.mjs helix-desktop/test-results/results.json
```

### Performance Report

Generated after tests: `helix-desktop/performance-report.md`

Contains:

- Summary statistics
- Metrics by category (load, interaction, memory)
- Regressions (with % change)
- Improvements
- Trends over time

---

## Troubleshooting

### Common Issues

#### 1. "Browser not found"

```bash
# Solution: Install Playwright browsers
npx playwright install --with-deps

# Or specific browser
npx playwright install --with-deps chromium
```

#### 2. "Dev server not responding"

```bash
# Terminal 1: Kill existing process
lsof -ti :5173 | xargs kill -9

# Terminal 1: Start fresh
cd helix-desktop
npm run dev

# Terminal 2: Run tests
cd helix-desktop
npx playwright test
```

#### 3. "Timeout waiting for selector"

Increase timeout in test:

```typescript
test('slow test', async ({ page }) => {
  await page.click('button', { timeout: 10000 }); // 10 seconds
});
```

#### 4. "Test fails locally but passes in CI"

Common causes:

- Timing issues (use `waitForLoadState`, `waitForSelector`)
- Missing environment variables
- Different screen sizes (check viewport)
- Flaky network (use `test.retries()`)

Solution:

```typescript
test.describe.configure({ retries: 2 });
test('flaky test', async ({ page }) => {
  // Test code
});
```

#### 5. "Memory issues during tests"

```bash
# Increase Node memory
NODE_OPTIONS=--max_old_space_size=4096 npm run test

# Or limit concurrent tests
npx playwright test --workers=1
```

### Debug Commands

```bash
# Trace failed test
npx playwright show-trace test-results/...trace.zip

# Screenshot of failure
npx playwright show-report  # Interactive report with screenshots

# Live browser debugging
npx playwright test --debug

# Verbose logging
DEBUG=pw:api npx playwright test
```

---

## Future Roadmap

### Q1 2026 (Current)

- [x] Unit test infrastructure (190+ tests)
- [x] E2E test framework (204 tests)
- [x] GitHub Actions CI/CD
- [x] Failure reporting
- [x] Performance tracking
- [ ] Visual regression testing (in progress)
- [ ] Coverage dashboard (in progress)

### Q2 2026 (Next)

- [ ] Visual regression testing with Percy
- [ ] Load testing (concurrent users)
- [ ] Advanced performance profiling
- [ ] Real-time test monitoring dashboard
- [ ] Automated issue creation for failures
- [ ] Test flakiness detection

### Q3 2026

- [ ] Cross-platform testing (Windows, macOS, Linux)
- [ ] Security penetration testing automation
- [ ] API contract testing
- [ ] Database mutation testing
- [ ] Chaos engineering tests

### Q4 2026+

- [ ] Machine learning for test optimization
- [ ] Predictive regression detection
- [ ] Automated test generation
- [ ] Full observability platform
- [ ] Internal testing documentation

---

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Vitest Documentation](https://vitest.dev)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://testingjavascript.com)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## Support

Issues or questions?

- File an issue: [GitHub Issues](https://github.com/anthropics/helix/issues)
- Discord: #testing channel
- Email: support@anthropic.com

---

**Last Updated**: 2026-02-06
**Maintained By**: Helix Engineering Team
