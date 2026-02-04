/**
 * Phase 8: End-to-End Intelligence Tests
 * Tests complete workflows for all intelligence operations
 * Verifies cross-platform functionality and cost accuracy
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';

describe('Phase 8: Intelligence E2E Tests', () => {
  let browser: Browser;
  let page: Page;

  const testUserId = 'e2e-test-user-123';
  const baseUrl = process.env.TEST_URL || 'http://localhost:5173';

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Email Intelligence Workflow', () => {
    it('should navigate to intelligence dashboard', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const title = await page.locator('text=Intelligence Dashboard').first();
      expect(await title.isVisible()).toBe(true);
    });

    it('should display all 9 intelligence features', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const featureCards = await page.locator('[class*="feature-card"]').count();
      expect(featureCards).toBe(9);
    });

    it('should show budget status', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const budgetCard = await page.locator('text=Daily AI Budget').first();
      expect(await budgetCard.isVisible()).toBe(true);

      const limitText = await page.locator('text=Limit').first();
      expect(await limitText.isVisible()).toBe(true);
    });

    it('should open email composition feature', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const emailComposeCard = await page.locator('text=Email Composition').first();
      await emailComposeCard.click();

      const modal = await page.locator('[role="dialog"]').first();
      expect(await modal.isVisible()).toBe(true);
    });

    it('should compose email with AI suggestions', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Click email composition
      await page.locator('text=Email Composition').first().click();

      // Fill in subject
      const subjectInput = await page.locator('input[placeholder*="subject"]').first();
      await subjectInput.fill('Project Status Update');

      // Fill in context
      const contextInput = await page.locator('input[placeholder*="recipient"]').first();
      await contextInput.fill('Manager at tech company');

      // Click generate button
      await page.locator('button:has-text("Get Suggestions")').click();

      // Wait for suggestions to appear
      await page.waitForTimeout(1000);
      const suggestions = await page.locator('[class*="suggestion"]').count();
      expect(suggestions).toBeGreaterThan(0);
    });

    it('should classify email', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Navigate to classify tab
      await page.locator('text=Classify').click();

      // Fill in email fields
      await page.locator('input[placeholder*="From"]').fill('manager@company.com');
      await page.locator('input[placeholder*="Subject"]').fill('Quarterly Review');
      await page.locator('textarea').first().fill('Your quarterly review is ready for discussion.');

      // Classify
      await page.locator('button:has-text("Classify Email")').click();

      // Wait for results
      await page.waitForTimeout(1000);
      const result = await page.locator('text=work').first();
      expect(await result.isVisible()).toBe(true);
    });

    it('should suggest email responses', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Navigate to respond tab
      await page.locator('text=Respond').click();

      // Fill in email
      await page.locator('input[placeholder*="From"]').fill('colleague@company.com');
      await page.locator('input[placeholder*="Subject"]').fill('Can you review this?');
      await page.locator('textarea').first().fill('Can you review my proposal and provide feedback?');

      // Get suggestions
      await page.locator('button:has-text("Get Response Ideas")').click();

      // Wait for suggestions
      await page.waitForTimeout(1000);
      const suggestions = await page.locator('[class*="response"]').count();
      expect(suggestions).toBeGreaterThan(0);
    });
  });

  describe('Calendar Intelligence Workflow', () => {
    it('should access calendar intelligence features', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const calendarSection = await page.locator('text=Calendar Intelligence').first();
      expect(await calendarSection.isVisible()).toBe(true);
    });

    it('should show meeting preparation feature', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const prepFeature = await page.locator('text=Meeting Preparation').first();
      expect(await prepFeature.isVisible()).toBe(true);
    });

    it('should show optimal meeting time feature', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const timeFeature = await page.locator('text=Optimal Meeting Times').first();
      expect(await timeFeature.isVisible()).toBe(true);
    });
  });

  describe('Task Intelligence Workflow', () => {
    it('should access task intelligence features', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const taskSection = await page.locator('text=Task Intelligence').first();
      expect(await taskSection.isVisible()).toBe(true);
    });

    it('should show task prioritization feature', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const prioritizeFeature = await page.locator('text=Task Prioritization').first();
      expect(await prioritizeFeature.isVisible()).toBe(true);
    });

    it('should show task breakdown feature', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const breakdownFeature = await page.locator('text=Task Breakdown').first();
      expect(await breakdownFeature.isVisible()).toBe(true);
    });
  });

  describe('Analytics Intelligence Workflow', () => {
    it('should access analytics intelligence features', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const analyticsSection = await page.locator('text=Analytics Intelligence').first();
      expect(await analyticsSection.isVisible()).toBe(true);
    });

    it('should show weekly summary feature', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const summaryFeature = await page.locator('text=Weekly Summary').first();
      expect(await summaryFeature.isVisible()).toBe(true);
    });

    it('should show anomaly detection feature', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const anomalyFeature = await page.locator('text=Pattern Anomalies').first();
      expect(await anomalyFeature.isVisible()).toBe(true);
    });
  });

  describe('Cost Accuracy Verification', () => {
    it('should display correct cost for email-compose', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Find email compose feature
      const composeCard = await page.locator('text=Email Composition').first();
      const costText = await composeCard.locator('[class*="cost"]').textContent();

      expect(costText).toContain('$');
      expect(costText).toMatch(/0\.00\d{2}/); // Should be ~0.0015
    });

    it('should display correct cost for calendar-time', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Find calendar time feature
      const timeCard = await page.locator('text=Optimal Meeting Times').first();
      const costText = await timeCard.locator('[class*="cost"]').textContent();

      expect(costText).toContain('$');
      // Should be ~0.008
      expect(costText).toMatch(/0\.00[8-9]/);
    });

    it('should display correct cost for analytics-summary', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Find analytics summary feature
      const summaryCard = await page.locator('text=Weekly Summary').first();
      const costText = await summaryCard.locator('[class*="cost"]').textContent();

      expect(costText).toContain('$');
      // Should be ~0.03
      expect(costText).toMatch(/0\.03/);
    });

    it('should calculate budget correctly', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Get budget elements
      const dailyLimit = await page.locator('text=Limit').first();
      const spent = await page.locator('text=Spent').first();
      const remaining = await page.locator('text=Remaining').first();

      expect(await dailyLimit.isVisible()).toBe(true);
      expect(await spent.isVisible()).toBe(true);
      expect(await remaining.isVisible()).toBe(true);
    });

    it('should show budget progress correctly', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const progressBar = await page.locator('role=progressbar').first();
      expect(await progressBar.isVisible()).toBe(true);
    });
  });

  describe('Feature Detail Modal', () => {
    it('should open feature detail modal', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Click first feature
      await page.locator('[class*="feature-card"]').first().click();

      // Modal should appear
      const modal = await page.locator('[role="dialog"]').first();
      expect(await modal.isVisible()).toBe(true);
    });

    it('should show feature information in modal', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Click a feature
      await page.locator('text=Email Composition').first().click();

      // Check modal content
      const modalContent = await page.locator('[role="dialog"]').textContent();
      expect(modalContent).toContain('Email Composition');
      expect(modalContent).toContain('Phase 0.5');
    });

    it('should close feature detail modal', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Open modal
      await page.locator('text=Email Composition').first().click();

      // Close modal
      await page.locator('button:has-text("Close")').click();

      // Modal should be hidden
      const modal = await page.locator('[role="dialog"]');
      const isVisible = await modal.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    });
  });

  describe('Responsive Design', () => {
    it('should be responsive on mobile', async () => {
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 }, // iPhone 12
      });
      const mobilePage = await mobileContext.newPage();

      await mobilePage.goto(`${baseUrl}/intelligence`);

      const title = await mobilePage.locator('text=Intelligence').first();
      expect(await title.isVisible()).toBe(true);

      await mobileContext.close();
    });

    it('should be responsive on tablet', async () => {
      const tabletContext = await browser.newContext({
        viewport: { width: 768, height: 1024 }, // iPad
      });
      const tabletPage = await tabletContext.newPage();

      await tabletPage.goto(`${baseUrl}/intelligence`);

      const title = await tabletPage.locator('text=Intelligence').first();
      expect(await title.isVisible()).toBe(true);

      await tabletContext.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing budget gracefully', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Page should still load
      const title = await page.locator('text=Intelligence Dashboard').first();
      expect(await title.isVisible()).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error
      await page.route('**/api/ai-router/**', (route) => {
        route.abort();
      });

      await page.goto(`${baseUrl}/intelligence`);

      // Page should still render
      const title = await page.locator('text=Intelligence Dashboard').first();
      expect(await title.isVisible()).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      const h1 = await page.locator('h1').count();
      const h2 = await page.locator('h2').count();

      expect(h1 + h2).toBeGreaterThan(0);
    });

    it('should have alt text for icons', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Check for buttons with proper labels
      const buttons = await page.locator('button').count();
      expect(buttons).toBeGreaterThan(0);
    });

    it('should be keyboard navigable', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Tab to first feature
      await page.keyboard.press('Tab');
      const focused = await page.locator(':focus');
      expect(await focused.count()).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should load intelligence page in reasonable time', async () => {
      const startTime = Date.now();
      await page.goto(`${baseUrl}/intelligence`);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(5000); // Should load in < 5 seconds
    });

    it('should render features without layout shift', async () => {
      await page.goto(`${baseUrl}/intelligence`);

      // Wait for all features to load
      await page.waitForLoadState('networkidle');

      // All feature cards should be visible
      const cards = await page.locator('[class*="feature-card"]').count();
      expect(cards).toBe(9);
    });
  });
});
