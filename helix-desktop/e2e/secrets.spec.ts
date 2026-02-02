import { test, expect, mockSecrets } from './fixtures';

test.describe('Desktop Secrets Management - With Fixtures', () => {
  test('should display empty state with no secrets', async ({ page, secretsAPI, authenticatedPage }) => {
    await secretsAPI.setupEmptyState();
    await authenticatedPage.goto('http://localhost:5173/settings/secrets');
    await authenticatedPage.waitForLoadState('networkidle');

    const emptyState = authenticatedPage.locator('text=No secrets yet');
    await expect(emptyState).toBeVisible();
  });

  test('should display secrets list with mock data', async ({ page, secretsAPI, authenticatedPage }) => {
    await secretsAPI.setupWithSecrets();
    await authenticatedPage.goto('http://localhost:5173/settings/secrets');
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(authenticatedPage.locator('text=Production Stripe Key')).toBeVisible();
    await expect(authenticatedPage.locator('text=Gemini API Key')).toBeVisible();
  });

  test('should display statistics with mock data', async ({ page, secretsAPI, authenticatedPage }) => {
    await secretsAPI.setupWithSecrets();
    await authenticatedPage.goto('http://localhost:5173/settings/secrets');
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(authenticatedPage.locator('text=Total Secrets')).toContainText('2');
    await expect(authenticatedPage.locator('text=Active')).toContainText('2');
  });
});
