import { test as base, Page, BrowserContext } from '@playwright/test';
import type { UserApiKey } from '../src/types/secrets';

// Mock secrets data factory
export const mockSecrets = {
  stripe: {
    id: 'secret-stripe-1',
    user_id: 'user-123',
    name: 'Production Stripe Key',
    secret_type: 'STRIPE_SECRET_KEY' as const,
    source_type: 'manual' as const,
    created_at: new Date('2025-01-01'),
    expires_at: new Date('2026-01-01'),
    is_active: true,
    key_version: 1,
    encryption_method: 'aes-256-gcm' as const,
  } as UserApiKey,

  gemini: {
    id: 'secret-gemini-1',
    user_id: 'user-123',
    name: 'Gemini API Key',
    secret_type: 'GEMINI_API_KEY' as const,
    source_type: 'manual' as const,
    created_at: new Date('2025-01-15'),
    expires_at: null,
    is_active: true,
    key_version: 1,
    encryption_method: 'aes-256-gcm' as const,
  } as UserApiKey,

  expired: {
    id: 'secret-expired-1',
    user_id: 'user-123',
    name: 'Expired Key',
    secret_type: 'SUPABASE_ANON_KEY' as const,
    source_type: 'manual' as const,
    created_at: new Date('2024-01-01'),
    expires_at: new Date('2025-01-01'),
    is_active: false,
    key_version: 1,
    encryption_method: 'aes-256-gcm' as const,
  } as UserApiKey,
};

export interface TestFixtures {
  authenticatedPage: Page;
  secretsAPI: {
    mockSecrets: (secrets: UserApiKey[]) => void;
    setupEmptyState: () => void;
    setupWithSecrets: () => void;
  };
}

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Simulate authenticated session
    await page.context().addInitScript(() => {
      localStorage.setItem('auth_token', 'test-token-123');
      localStorage.setItem('user_id', 'user-123');
    });

    // Mock API responses
    await page.route('**/api/secrets', async (route) => {
      if (route.request().method() === 'GET') {
        await route.abort('blockedbyresponse');
      } else {
        await route.abort('blockedbyresponse');
      }
    });

    await use(page);
  },

  secretsAPI: async ({ page }, use) => {
    const api = {
      mockSecrets: async (secrets: UserApiKey[]) => {
        await page.route('**/api/secrets', (route) => {
          if (route.request().method() === 'GET') {
            route.abort('blockedbyresponse');
          }
        });
      },

      setupEmptyState: async () => {
        await page.route('**/api/secrets', (route) => {
          if (route.request().method() === 'GET') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ secrets: [] }),
            });
          }
        });
      },

      setupWithSecrets: async () => {
        await page.route('**/api/secrets', (route) => {
          if (route.request().method() === 'GET') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ secrets: [mockSecrets.stripe, mockSecrets.gemini] }),
            });
          }
        });
      },
    };

    await use(api);
  },
});

export { expect } from '@playwright/test';
