import { test, expect } from '@playwright/test';

test.describe('Desktop Secrets Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');

    // Wait for app to load
    await page.waitForLoadState('networkidle');

    // Navigate to secrets settings
    // Assuming you're already logged in in dev mode
    await page.goto('http://localhost:5173/settings/secrets');
    await page.waitForLoadState('networkidle');
  });

  test('should display secrets settings page', async ({ page }) => {
    // Check page heading
    const heading = page.locator('h1');
    await expect(heading).toContainText('Secrets');

    // Check description
    await expect(page.locator('text=Manage your API keys')).toBeVisible();
  });

  test('should open create secret modal', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create Secret")');
    await expect(createButton).toBeVisible();

    await createButton.click();

    // Modal should be visible
    const modalHeading = page.locator('dialog h2');
    await expect(modalHeading).toContainText('Create New Secret');

    // Form fields should be visible
    await expect(page.locator('label:has-text("Secret Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Secret Type")')).toBeVisible();
  });

  test('should display empty state when no secrets', async ({ page }) => {
    // Check for empty state message
    const emptyState = page.locator('text=No secrets yet');
    await expect(emptyState).toBeVisible();

    const emptyDescription = page.locator('text=Create your first secret');
    await expect(emptyDescription).toBeVisible();
  });

  test('should display statistics cards', async ({ page }) => {
    // Check for stats labels
    await expect(page.locator('text=Total Secrets')).toBeVisible();
    await expect(page.locator('text=Active')).toBeVisible();
    await expect(page.locator('text=Expiring Soon')).toBeVisible();
  });
});
