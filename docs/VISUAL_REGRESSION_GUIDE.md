# Visual Regression Testing Guide - Percy Integration

**Version**: 1.0
**Last Updated**: 2026-02-06
**Status**: Production Ready

---

## Overview

Visual regression testing automatically detects UI changes by comparing screenshots across browser sessions. This guide covers Percy integration with Helix Desktop's Playwright E2E tests.

### What is Percy?

Percy is a visual regression testing platform that:

- Captures full-page screenshots across all browsers and devices
- Automatically detects visual changes (pixel-level diffing)
- Provides interactive diff reviews for approvals
- Integrates directly with GitHub for PR workflows
- Maintains 30-day snapshot history

### Why Visual Regression Testing?

**Before**: Manual review of changes

- Screenshots taken manually
- Changes hard to detect visually
- No historical baseline for comparison
- False positives in testing

**After**: Automated regression detection

- Every E2E test captures snapshots automatically
- Pixel-level diffs identify visual regressions
- Historical baselines prevent false positives
- Team reviews changes directly in GitHub

---

## Quick Start

### 1. Prerequisites

```bash
# Node.js 20.x
node --version

# Playwright installed
cd helix-desktop
npx playwright install --with-deps
```

### 2. Install Percy Dependencies

```bash
# Install Percy CLI and Playwright plugin
npm install --save-dev @percy/cli @percy/playwright
```

### 3. Create Percy Account

1. Visit https://app.percy.io
2. Sign up with GitHub account (recommended for seamless CI/CD)
3. Create a new project: "Helix Desktop"
4. Copy project token

### 4. Configure GitHub Secrets

In your GitHub repository settings, add:

```
PERCY_TOKEN: <your-project-token-from-percy-app>
```

### 5. Run Visual Tests Locally

```bash
# Terminal 1: Start dev server
cd helix-desktop
npm run dev

# Terminal 2: Run with Percy
npx percy exec -- npx playwright test e2e/visual-regression.spec.ts
```

---

## Visual Regression Test Structure

### Test Organization

Located in: `helix-desktop/e2e/visual-regression.spec.ts`

**Test Categories**:

#### 1. Full Page Snapshots

Tests complete page layouts at multiple viewport sizes:

- Landing/Auth page
- Chat interface
- Settings panel
- Agent management
- Skills marketplace
- Tools dashboard
- Memory browser
- Approval dashboard

```typescript
test('should match chat interface snapshot', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  // Capture at all viewport widths
  await percySnapshot(page, 'Chat Interface - Message Display', {
    widths: [375, 768, 1280, 1920],
    minHeight: 800,
  });
});
```

**Captured Viewports**:

- Mobile: 375px (Pixel 5, iPhone 12)
- Tablet: 768px (iPad)
- Desktop: 1280px (typical)
- Wide: 1920px (4K monitors)

#### 2. Mobile Responsiveness Tests

Specific tests for mobile and tablet layouts:

- Mobile chat interface (375px)
- Mobile settings (375px)
- Tablet full interface (768px)

#### 3. Component Tests

Individual UI component snapshots:

- Button states (default, hover, active, disabled)
- Form components (inputs, dropdowns, checkboxes)
- Modal dialogs
- Loading indicators

#### 4. Accessibility Variants

Tests for accessibility-related visual changes:

- High contrast mode
- Font scaling (120%)
- Reduced motion enabled

#### 5. Theme Tests

- Dark theme appearance
- Light theme appearance
- Theme switching consistency

### Percy Snapshot API

```typescript
import { percySnapshot } from '@percy/playwright';

// Basic snapshot
await percySnapshot(page, 'Component Name');

// With responsive breakpoints
await percySnapshot(page, 'Component Name', {
  widths: [375, 768, 1280, 1920],
  minHeight: 800,
  enableJavaScript: true,
  percentDifference: 0.5,
});

// Mobile-specific
await percySnapshot(page, 'Mobile Component', {
  widths: [375],
  minHeight: 667,
});
```

### Configuration: .percyrc.json

Located at: `.percyrc.json`

Key settings:

```json
{
  "snapshot": {
    "widths": [375, 768, 1280, 1920],
    "minHeight": 1024,
    "percentDifference": 0.5,
    "enableJavaScript": true
  },
  "discovery": {
    "allowed-hosts": ["localhost", "127.0.0.1"],
    "network-idle-timeout": 750
  }
}
```

**Configuration Explanation**:

| Setting              | Value                  | Purpose                        |
| -------------------- | ---------------------- | ------------------------------ |
| widths               | [375, 768, 1280, 1920] | Responsive breakpoints         |
| minHeight            | 1024                   | Minimum snapshot height        |
| percentDifference    | 0.5%                   | Threshold for flagging changes |
| enableJavaScript     | true                   | Allow JS execution             |
| network-idle-timeout | 750ms                  | Wait for network activity      |

---

## Running Visual Tests

### Local Development

```bash
# Start dev server
cd helix-desktop
npm run dev

# In another terminal: Run visual tests
npx percy exec -- npx playwright test e2e/visual-regression.spec.ts

# Run single test
npx percy exec -- npx playwright test e2e/visual-regression.spec.ts -g "chat interface"

# Run with debug
npx percy exec -- npx playwright test e2e/visual-regression.spec.ts --debug

# Headed mode (see browser)
npx percy exec -- npx playwright test e2e/visual-regression.spec.ts --headed
```

### CI/CD Pipeline

Tests run automatically on:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual `workflow_dispatch` trigger

**Workflow**: `.github/workflows/test-ci.yml` (Visual Regression Tests job)

Visual regression results are:

- Captured in Percy dashboard
- Linked in GitHub PR comments
- Compared against baseline snapshots
- Require approval before merge

### GitHub PR Workflow

1. **Create PR**: Push feature branch
2. **Tests Run**: GitHub Actions executes visual regression tests
3. **Snapshots Captured**: Percy saves screenshots for all viewports
4. **Comparison**: Percy compares against baseline snapshots
5. **PR Comment**: Bot posts Percy build link with comparison UI
6. **Review**: Team reviews diffs in Percy dashboard
7. **Approve**: Review and approve visual changes
8. **Merge**: PR can be merged after approval

---

## Percy Dashboard Workflow

### Reviewing Changes

1. **Visit Percy App**: https://app.percy.io
2. **Open Project**: Click "Helix Desktop"
3. **View Build**: Latest build from GitHub PR
4. **Review Diffs**: Click each changed snapshot
5. **Compare**: Side-by-side pixel diff view
6. **Approve**: Click "Approve Changes" or "Reject"

### Change Types

**New Snapshot**:

- First time screenshot is captured
- Must be approved as baseline

**Approved Snapshot**:

- Visual change matches approved revision
- No action needed

**Approved with Changes**:

- Snapshot matches existing baseline
- No visual regression detected

**Unapproved Changes**:

- Visual diff exceeds threshold (0.5%)
- Requires manual review and approval
- Blocks PR merge until approved

### Approval Process

```
1. Snapshot captured → Pending review
2. Visual diff > 0.5% → Flagged for review
3. Team reviews in Percy dashboard
4. Approve if intended change
5. Build marked as "Approved"
6. GitHub PR shows green checkmark
```

---

## Best Practices

### 1. Wait for Full Page Load

Always wait for page stability before snapshots:

```typescript
test('snapshot', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Wait for all resources
  await page.waitForLoadState('networkidle');

  // Wait for animations
  await page.waitForTimeout(300);

  // THEN snapshot
  await percySnapshot(page, 'Page Name');
});
```

### 2. Avoid Timing-Sensitive Content

Don't snapshot dynamic content:

```typescript
// ❌ Bad: Timestamps change every run
await percySnapshot(page, 'Chat', {
  // Content includes "12:34 PM" - will fail
});

// ✅ Good: Remove dynamic content
await page.evaluate(() => {
  document.querySelectorAll('[data-timestamp]').forEach(el => (el.textContent = '12:00 PM'));
});
await percySnapshot(page, 'Chat');
```

### 3. Test Responsive Breakpoints

Include multiple viewports:

```typescript
await percySnapshot(page, 'Component', {
  widths: [375, 768, 1280, 1920], // Mobile, tablet, desktop, wide
});
```

### 4. Use Semantic Snapshot Names

Clear names for easy navigation:

```typescript
// ✅ Good names
'Chat Interface - Message Display';
'Settings Panel - Layout & Navigation';
'Mobile - Chat (Pixel 5)';

// ❌ Bad names
'snapshot-1';
'page-test';
'desktop-ui';
```

### 5. Isolate Component State

Test components in known states:

```typescript
test('button states', async ({ page }) => {
  // Hover state
  await page.hover('[data-testid="button"]');
  await percySnapshot(page, 'Buttons - Hover State');

  // Active state
  await page.click('[data-testid="button"]');
  await percySnapshot(page, 'Buttons - Active State');

  // Disabled state
  await page.evaluate(() => {
    document.querySelector('[data-testid="button"]').disabled = true;
  });
  await percySnapshot(page, 'Buttons - Disabled State');
});
```

### 6. Handle Flaky Selectors

Use explicit waits:

```typescript
const element = page.locator('[data-testid="modal"]');
await element.waitFor({ state: 'visible', timeout: 5000 });
await percySnapshot(page, 'Modal Dialog');
```

### 7. Document Visual Expectations

Use comments for context:

```typescript
test('should match dark theme snapshot', async ({ page }) => {
  // Enable dark theme via localStorage
  await page.evaluate(() => {
    localStorage.setItem('theme', 'dark');
    document.documentElement.classList.add('dark');
  });

  // Verify background color changed
  const bgColor = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).backgroundColor;
  });

  expect(bgColor).toContain('rgb');

  // Capture dark theme appearance
  await percySnapshot(page, 'Theme - Dark Mode');
});
```

---

## Troubleshooting

### Issue 1: "PERCY_TOKEN not set"

**Error**: `Error: PERCY_TOKEN not set`

**Solution**:

```bash
# Set token in environment
export PERCY_TOKEN=<your-token>
npx percy exec -- npx playwright test

# Or in CI/CD (GitHub Actions)
# Add PERCY_TOKEN to repository secrets
```

### Issue 2: "Snapshots not uploading"

**Error**: Snapshots captured locally but not in Percy

**Possible causes**:

- Invalid PERCY_TOKEN
- Network connectivity issue
- Percy account limit reached

**Solution**:

```bash
# Verify token
echo $PERCY_TOKEN

# Check Percy status
npx percy --version

# Run with verbose logging
PERCY_DEBUG=* npx percy exec -- npx playwright test
```

### Issue 3: "Timeout waiting for snapshot"

**Error**: `Error: Timeout waiting for Percy snapshot`

**Cause**: Page taking too long to load

**Solution**:

```typescript
// Increase timeout
await page.goto('http://localhost:5173', {
  waitUntil: 'networkidle',
});

// Increase network idle threshold
await page.waitForLoadState('networkidle');

// Add explicit wait
await page.waitForTimeout(1000);

// Then snapshot
await percySnapshot(page, 'Page');
```

### Issue 4: "False positive changes"

**Problem**: Snapshot differs but code didn't change

**Causes**:

- Timing variations (animations, load times)
- Random content (timestamps, IDs)
- Font rendering differences

**Solution**:

```typescript
// Disable animations
await page.evaluate(() => {
  const style = document.createElement('style');
  style.textContent = '* { animation-duration: 0s !important; }';
  document.head.appendChild(style);
});

// Mock dynamic content
await page.evaluate(() => {
  Date.prototype.toLocaleTimeString = () => '12:00:00 PM';
});

// Use consistent locale
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'language', {
    value: 'en-US',
  });
});
```

---

## Integration with GitHub

### PR Comments

Percy automatically comments on PRs with build status:

```
📸 Visual Regression Tests
Visual snapshots have been captured with Percy.
View comparison: https://app.percy.io/builds/...
```

### PR Checks

Visual regression tests appear as GitHub status checks:

```
✓ Visual Regression Tests - 42 snapshots approved
  12 new, 30 changed, 0 rejected
```

### Blocking Merges

Configure Percy to block merges on unapproved changes:

1. Percy Settings → Project
2. GitHub Integration → Require changes approval
3. Save

Now PRs cannot merge until visual changes are approved in Percy.

---

## Performance Considerations

### Snapshot Capture Time

- **Per snapshot**: 2-5 seconds
- **Per test**: 5-15 seconds (multiple widths)
- **Full suite**: 2-3 minutes (all tests, all widths)

### Storage

- **Percy free tier**: 50 snapshots/month
- **Per-snapshot size**: ~1-5 MB
- **History**: 30-day rolling window

### CI/CD Impact

Visual regression tests add ~3-5 minutes to pipeline:

```
Unit Tests:           3 min
E2E Tests:            8 min
Visual Regression:    3 min (NEW)
Accessibility:        2 min
Security:             2 min
────────────────────────
Total:               18 min
```

---

## Maintenance & Cleanup

### Baseline Management

Baselines are stored in Percy cloud (not in git):

1. First snapshot → Becomes baseline
2. Future snapshots → Compared to baseline
3. Approved changes → New baseline established

### Removing Obsolete Snapshots

When tests are deleted or renamed:

1. Percy auto-detects unused snapshots
2. Mark as "Archived" in Percy dashboard
3. Removes from baseline comparisons

### Updating Baselines

To reset a baseline (e.g., after UI redesign):

```bash
# Option 1: Approve all changes in Percy dashboard
# Select "Approve All"

# Option 2: Use Percy CLI
npx percy changes approve

# Option 3: Re-baseline via GitHub
# Rerun workflow → Percy captures new baseline
```

---

## Advanced Features

### Cross-Browser Testing

Percy automatically captures across browsers:

- Chrome (Chromium)
- Firefox
- Safari (WebKit)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)
- Safari Tablet (iPad Pro)

No extra configuration needed - Playwright matrix handles it.

### Parallel Testing

Percy supports parallel snapshot uploads:

```bash
# Run multiple test files in parallel
npx percy exec -- npx playwright test e2e/visual-regression.spec.ts e2e/other-tests.spec.ts
```

### Custom Assertions

Add visual assertions to tests:

```typescript
test('visual correctness', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Assert element is visible before snapshot
  await expect(page.locator('.logo')).toBeVisible();

  // Snapshot
  await percySnapshot(page, 'Logo Component');

  // Further assertions
  const width = await page.locator('.logo').boundingBox();
  expect(width?.width).toBeGreaterThan(0);
});
```

---

## Cost Analysis

| Plan       | Price  | Features                              |
| ---------- | ------ | ------------------------------------- |
| Free       | $0/mo  | 50 snapshots, basic builds            |
| Team       | $29/mo | Unlimited snapshots, 5 users          |
| Enterprise | Custom | SLA, support, dedicated build minutes |

**For Helix**: Estimate ~400 snapshots/month across all tests

- Recommendation: **Team plan** ($29/mo)
- Includes unlimited snapshots
- Includes 5 team members
- Includes full integration features

---

## Related Resources

- [Percy Documentation](https://docs.percy.io)
- [Playwright Visual Testing](https://playwright.dev/docs/test-snapshots)
- [Visual Regression Best Practices](https://docs.percy.io/docs/visual-regression-testing-best-practices)
- [Percy GitHub Integration](https://docs.percy.io/docs/github)
- [Helix Testing Guide](./TESTING_GUIDE.md)
- [Helix Testing Roadmap](./TESTING_ROADMAP.md)

---

## Next Steps

### Short-term (This Week)

- [ ] Create Percy account and project
- [ ] Add PERCY_TOKEN to GitHub secrets
- [ ] Run visual tests locally: `percy exec -- npx playwright test e2e/visual-regression.spec.ts`
- [ ] Review captured snapshots in Percy dashboard
- [ ] Approve baseline snapshots

### Mid-term (Week 2-3)

- [ ] Integrate visual regression into CI/CD
- [ ] Set up GitHub PR comments and checks
- [ ] Train team on Percy review workflow
- [ ] Establish visual change review SLA

### Long-term (Month 2+)

- [ ] Add visual regression to all E2E tests
- [ ] Integrate with design system documentation
- [ ] Set up performance budgeting for visual changes
- [ ] Automated visual diff reports

---

## Support

Issues or questions?

- **Percy Support**: https://support.percy.io
- **GitHub Issues**: [Link to repository]
- **Slack**: #testing-infrastructure
- **Email**: qa-team@helix.local

---

**Document Version**: 1.0
**Last Updated**: 2026-02-06
**Maintained By**: QA & Engineering Teams
**Status**: Production Ready
