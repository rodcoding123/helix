import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Helix Desktop
 *
 * Run tests with:
 *   npx playwright test                    # All tests
 *   npx playwright test --ui               # UI mode (interactive)
 *   npx playwright test --debug            # Debug mode
 *   npx playwright test --headed           # Show browser
 *   npx playwright test -g "keyword"       # Filter by test name
 */

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30 * 1000, // 30 seconds per test
  globalTimeout: 30 * 60 * 1000, // 30 minutes total
  fullyParallel: false, // Run tests sequentially (safer for desktop app)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid conflicts

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    // Browser context options
    baseURL: 'http://localhost:5173', // Vite dev server
    trace: 'on-first-retry', // Trace failed tests
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    },
  ],

  // Web server configuration - auto-start dev server for tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
  },
});
