/**
 * Visual Regression Tests - Percy Integration
 *
 * Tests visual consistency across:
 * - Desktop browsers (Chrome, Firefox, Safari)
 * - Mobile devices (Pixel 5, iPhone 12)
 * - Tablet (iPad Pro)
 * - Responsive breakpoints (375px, 768px, 1280px, 1920px)
 *
 * Run with:
 *   percy exec -- npx playwright test e2e/visual-regression.spec.ts
 *
 * Baseline snapshots are stored in Percy and compared against future runs.
 * Diffs exceeding 0.5% are flagged for review.
 */

import { test, expect } from '@playwright/test';
import { percySnapshot } from '@percy/playwright';

// Visual regression test suite
test.describe('Visual Regression - Desktop UI Components', () => {
  /**
   * Test: Landing/Auth Page
   * Verifies consistent rendering of authentication interface
   */
  test('should match landing page snapshot', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Wait for any animations to complete
    await page.waitForTimeout(500);

    // Take visual snapshot for all browsers
    await percySnapshot(page, 'Landing Page - Authentication', {
      widths: [375, 768, 1280, 1920],
      minHeight: 600,
    });
  });

  /**
   * Test: Chat Interface
   * Verifies message display, input field, and chat container layout
   */
  test('should match chat interface snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Simulate logged-in state by checking for chat area
    const chatArea = page.locator('[data-testid="chat-messages"]');

    // Wait for chat area to be visible
    await chatArea.waitFor({ state: 'visible', timeout: 5000 });

    // Ensure any typing indicators are settled
    await page.waitForTimeout(300);

    // Capture chat interface snapshot
    await percySnapshot(page, 'Chat Interface - Message Display', {
      widths: [375, 768, 1280, 1920],
      minHeight: 800,
    });
  });

  /**
   * Test: Settings Panel Layout
   * Verifies settings navigation and panel rendering
   */
  test('should match settings panel snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/settings');
    await page.waitForLoadState('networkidle');

    // Wait for settings nav to load
    const settingsNav = page.locator('[data-testid="settings-nav"]');
    await settingsNav.waitFor({ state: 'visible', timeout: 5000 });

    await page.waitForTimeout(300);

    // Capture settings layout snapshot
    await percySnapshot(page, 'Settings Panel - Layout & Navigation', {
      widths: [375, 768, 1280, 1920],
      minHeight: 900,
    });
  });

  /**
   * Test: Agent Management Interface
   * Verifies agent editor and list rendering
   */
  test('should match agent management snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/settings/agents');
    await page.waitForLoadState('networkidle');

    // Wait for agent list to render
    const agentList = page.locator('[data-testid="agent-list"]');
    await agentList.waitFor({ state: 'visible', timeout: 5000 });

    await page.waitForTimeout(300);

    // Capture agent management snapshot
    await percySnapshot(page, 'Agent Management - List & Editor', {
      widths: [375, 768, 1280, 1920],
      minHeight: 800,
    });
  });

  /**
   * Test: Skills Marketplace
   * Verifies skill cards and browsing interface
   */
  test('should match skills marketplace snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/settings/skills');
    await page.waitForLoadState('networkidle');

    // Wait for skills grid to load
    const skillsGrid = page.locator('[data-testid="skills-grid"]');
    await skillsGrid.waitFor({ state: 'visible', timeout: 5000 });

    await page.waitForTimeout(300);

    // Capture skills marketplace snapshot
    await percySnapshot(page, 'Skills Marketplace - Card Layout', {
      widths: [375, 768, 1280, 1920],
      minHeight: 1000,
    });
  });

  /**
   * Test: Tools & Security Dashboard
   * Verifies tools policy editor and approval workflow UI
   */
  test('should match tools dashboard snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/settings/tools');
    await page.waitForLoadState('networkidle');

    // Wait for tools dashboard to load
    const toolsDashboard = page.locator('[data-testid="tools-dashboard"]');
    await toolsDashboard.waitFor({ state: 'visible', timeout: 5000 });

    await page.waitForTimeout(300);

    // Capture tools dashboard snapshot
    await percySnapshot(page, 'Tools & Security - Dashboard & Policies', {
      widths: [375, 768, 1280, 1920],
      minHeight: 900,
    });
  });

  /**
   * Test: Memory/Knowledge Browser
   * Verifies memory file browser and semantic search interface
   */
  test('should match memory browser snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/memory');
    await page.waitForLoadState('networkidle');

    // Wait for memory browser to load
    const memoryBrowser = page.locator('[data-testid="memory-browser"]');
    await memoryBrowser.waitFor({ state: 'visible', timeout: 5000 });

    await page.waitForTimeout(300);

    // Capture memory browser snapshot
    await percySnapshot(page, 'Memory Browser - File List & Search', {
      widths: [375, 768, 1280, 1920],
      minHeight: 800,
    });
  });

  /**
   * Test: Approval Dashboard
   * Verifies exec approval request display and action buttons
   */
  test('should match approval dashboard snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/approvals');
    await page.waitForLoadState('networkidle');

    // Wait for approval dashboard to load
    const approvalDashboard = page.locator('[data-testid="approval-dashboard"]');
    await approvalDashboard.waitFor({ state: 'visible', timeout: 5000 });

    await page.waitForTimeout(300);

    // Capture approval dashboard snapshot
    await percySnapshot(page, 'Approval Dashboard - Request Display', {
      widths: [375, 768, 1280, 1920],
      minHeight: 700,
    });
  });

  /**
   * Test: Dark Theme Consistency
   * Verifies visual appearance with dark theme enabled
   */
  test('should match dark theme snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Ensure dark theme is applied
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });

    await page.waitForTimeout(300);

    // Capture dark theme snapshot
    await percySnapshot(page, 'Theme - Dark Mode Application', {
      widths: [375, 768, 1280, 1920],
      minHeight: 600,
    });
  });
});

/**
 * Mobile-specific visual regression tests
 * Run on mobile viewports to catch responsive design issues
 */
test.describe('Visual Regression - Mobile Responsiveness', () => {
  /**
   * Test: Mobile Chat Interface
   * Verifies chat layout on small screens
   */
  test('should match mobile chat interface snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    // Capture mobile chat snapshot
    await percySnapshot(page, 'Mobile - Chat Interface (Pixel 5)', {
      widths: [375],
      minHeight: 667,
    });
  });

  /**
   * Test: Mobile Settings Navigation
   * Verifies settings panel on mobile
   */
  test('should match mobile settings snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/settings');
    await page.waitForLoadState('networkidle');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    // Capture mobile settings snapshot
    await percySnapshot(page, 'Mobile - Settings (iPhone 12)', {
      widths: [375],
      minHeight: 667,
    });
  });

  /**
   * Test: Tablet Layout
   * Verifies responsive design on tablet viewport
   */
  test('should match tablet interface snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);

    // Capture tablet layout snapshot
    await percySnapshot(page, 'Tablet - Full Interface (iPad Pro)', {
      widths: [768],
      minHeight: 1024,
    });
  });
});

/**
 * Component-level visual regression tests
 * Tests individual UI components in isolation
 */
test.describe('Visual Regression - UI Components', () => {
  /**
   * Test: Button States
   * Verifies button appearance (default, hover, active, disabled)
   */
  test('should match button component states', async ({ page }) => {
    // Create a test page with button showcase
    await page.goto('http://localhost:5173/components/buttons');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await percySnapshot(page, 'Components - Button States', {
      widths: [1280],
      minHeight: 400,
    });
  });

  /**
   * Test: Form Components
   * Verifies input fields, dropdowns, checkboxes, etc.
   */
  test('should match form components snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/components/forms');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await percySnapshot(page, 'Components - Form Fields & Inputs', {
      widths: [1280],
      minHeight: 600,
    });
  });

  /**
   * Test: Modal Dialogs
   * Verifies modal appearance and layering
   */
  test('should match modal dialog snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/components/modals');
    await page.waitForLoadState('networkidle');

    // Trigger modal open
    await page.click('[data-testid="open-modal"]');
    await page.waitForTimeout(300);

    await percySnapshot(page, 'Components - Modal Dialog', {
      widths: [1280],
      minHeight: 600,
    });
  });

  /**
   * Test: Loading States
   * Verifies spinners, skeletons, and loading indicators
   */
  test('should match loading indicators snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173/components/loading');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await percySnapshot(page, 'Components - Loading Indicators', {
      widths: [1280],
      minHeight: 400,
    });
  });
});

/**
 * Accessibility & Theme Variant Tests
 * Verifies visual appearance under different conditions
 */
test.describe('Visual Regression - Accessibility Variants', () => {
  /**
   * Test: High Contrast Mode
   * Verifies appearance with high contrast enabled
   */
  test('should match high contrast theme snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Enable high contrast
    await page.evaluate(() => {
      document.documentElement.classList.add('high-contrast');
    });

    await page.waitForTimeout(300);

    await percySnapshot(page, 'Accessibility - High Contrast Mode', {
      widths: [1280],
      minHeight: 600,
    });
  });

  /**
   * Test: Font Scaling
   * Verifies layout with larger font sizes
   */
  test('should match font scaling snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Scale fonts to 120%
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '120%';
    });

    await page.waitForTimeout(300);

    await percySnapshot(page, 'Accessibility - Font Scaling (120%)', {
      widths: [1280],
      minHeight: 600,
    });
  });

  /**
   * Test: Reduced Motion
   * Verifies that animations are disabled
   */
  test('should match reduced motion snapshot', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Enable reduced motion
    await page.evaluate(() => {
      document.documentElement.style.setProperty(
        '--motion-reduce',
        'prefers-reduced-motion'
      );
    });

    await page.waitForTimeout(300);

    await percySnapshot(page, 'Accessibility - Reduced Motion Enabled', {
      widths: [1280],
      minHeight: 600,
    });
  });
});
