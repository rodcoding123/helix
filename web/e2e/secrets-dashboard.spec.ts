import { test, expect } from '@playwright/test';

test.describe('Secrets Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to secrets page
    await page.goto('/secrets');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display secrets dashboard page', async ({ page }) => {
    // Check page heading
    const heading = page.locator('h1');
    await expect(heading).toContainText('Secrets');

    // Check description
    const description = page.locator('text=Manage your API keys');
    await expect(description).toBeVisible();
  });

  test('should display create secret button', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create Secret")');
    await expect(createButton).toBeVisible();
  });

  test('should open create secret modal on button click', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create Secret")');
    await createButton.click();

    // Modal should be visible
    const modalTitle = page.locator('h2:has-text("Create New Secret")');
    await expect(modalTitle).toBeVisible();

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
    // Check for stats section
    const totalSecretsLabel = page.locator('text=Total Secrets');
    await expect(totalSecretsLabel).toBeVisible();

    const activeLabel = page.locator('text=Active');
    await expect(activeLabel).toBeVisible();

    const expiringSoonLabel = page.locator('text=Expiring Soon');
    await expect(expiringSoonLabel).toBeVisible();
  });
});
