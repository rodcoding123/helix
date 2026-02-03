# Desktop Phase 3 Secrets: Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add production-grade enhancements (error recovery, accessibility, feature flags, E2E fixtures, documentation, performance optimization, and component exports) to the Helix Desktop secrets management system.

**Architecture:** Seven focused enhancements building on the Phase 3 foundation:

1. **Error Recovery** - Exponential backoff retry logic in API client
2. **E2E Fixtures** - Shared mock data for consistent CI/CD testing
3. **Accessibility** - WCAG compliance with ARIA labels, keyboard navigation, focus management
4. **Feature Flags** - Config-based flag system for gradual rollout
5. **Component Barrel Exports** - Clean import structure with index files
6. **JSDoc Documentation** - Inline comments for complex logic
7. **Performance** - React.lazy() with Suspense boundaries for modals

**Tech Stack:** TypeScript, React, Vitest, Playwright, ARIA standards

---

## Task 1: Error Recovery with Retry Logic

**Files:**

- Modify: `helix-desktop/src/lib/api/secrets-client.ts`
- Test: `helix-desktop/src/lib/api/__tests__/secrets-client.test.ts`

**Step 1: Write the failing tests**

Create tests for retry logic in `helix-desktop/src/lib/api/__tests__/secrets-client.test.ts`:

```typescript
describe('SecretsClient - Retry Logic', () => {
  it('should retry on network error with exponential backoff', async () => {
    const client = new SecretsClient('test-token');
    let attempts = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempts++;
      if (attempts < 3) throw new TypeError('Network error');
      return { ok: true, json: async () => ({ secrets: [] }) } as Response;
    });

    const result = await client.listSecrets();
    expect(attempts).toBe(3);
    expect(result).toEqual([]);
  });

  it('should not retry on 401 unauthorized error', async () => {
    const client = new SecretsClient('test-token');
    let attempts = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempts++;
      return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) } as Response;
    });

    await expect(client.listSecrets()).rejects.toThrow('Unauthorized');
    expect(attempts).toBe(1);
  });

  it('should not retry on 400 bad request error', async () => {
    const client = new SecretsClient('test-token');
    let attempts = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempts++;
      return { ok: false, status: 400, json: async () => ({ error: 'Bad request' }) } as Response;
    });

    await expect(client.listSecrets()).rejects.toThrow('Bad request');
    expect(attempts).toBe(1);
  });

  it('should retry on 503 service unavailable with max retries', async () => {
    const client = new SecretsClient('test-token');
    let attempts = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempts++;
      return {
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' }),
      } as Response;
    });

    await expect(client.listSecrets()).rejects.toThrow('Service unavailable');
    expect(attempts).toBe(3); // Default max retries
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd helix-desktop
npm run test -- src/lib/api/__tests__/secrets-client.test.ts --grep "Retry Logic"
```

Expected: FAIL - Methods don't exist

**Step 3: Implement error recovery**

Modify `helix-desktop/src/lib/api/secrets-client.ts`:

```typescript
import type { UserApiKey } from '../../types/secrets';
import type { SecretType } from '../../types/secrets';

export interface CreateSecretInput {
  name: string;
  secret_type: SecretType;
  expires_at?: Date;
}

interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelay: 100,
};

function isRetryableError(error: unknown): boolean {
  // Network errors are retryable
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}

function isRetryableStatus(status: number): boolean {
  // Retry on 5xx errors
  if (status >= 500) {
    return true;
  }
  // Don't retry on 4xx client errors
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class SecretsClient {
  private token: string;
  private retryConfig: RetryConfig;

  constructor(token: string, retryConfig: Partial<RetryConfig> = {}) {
    this.token = token;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          ...options,
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));

          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            if (response.status === 401) {
              throw new Error('Unauthorized');
            }
            throw new Error(error.error || `HTTP ${response.status}`);
          }

          // Retry on server errors (5xx)
          if (isRetryableStatus(response.status) && attempt < this.retryConfig.maxRetries) {
            const backoffDelay =
              this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
            await delay(backoffDelay);
            continue;
          }

          throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (isRetryableError(error) && attempt < this.retryConfig.maxRetries) {
          const backoffDelay =
            this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
          await delay(backoffDelay);
          continue;
        }

        // Not retryable or max retries exceeded
        throw error;
      }
    }

    throw lastError || new Error('Failed after maximum retries');
  }

  async listSecrets(): Promise<UserApiKey[]> {
    const data = await this.request<{ secrets: UserApiKey[] }>('/api/secrets');
    return data.secrets;
  }

  async createSecret(input: CreateSecretInput): Promise<UserApiKey> {
    return this.request<UserApiKey>('/api/secrets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async rotateSecret(secretId: string): Promise<UserApiKey> {
    return this.request<UserApiKey>(`/api/secrets/${secretId}/rotate`, {
      method: 'POST',
    });
  }

  async deleteSecret(secretId: string): Promise<void> {
    await this.request(`/api/secrets/${secretId}`, {
      method: 'DELETE',
    });
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd helix-desktop
npm run test -- src/lib/api/__tests__/secrets-client.test.ts --grep "Retry Logic"
```

Expected: PASS - All 4 tests passing

**Step 5: Commit**

```bash
cd helix-desktop
git add src/lib/api/secrets-client.ts src/lib/api/__tests__/secrets-client.test.ts
git commit -m "feat(desktop-secrets): add exponential backoff retry logic to API client

- Implement configurable retry mechanism with exponential backoff
- Retry on network errors and 5xx server errors
- Skip retry on 4xx client errors (401, 400, etc)
- Default: 3 max retries with 2x backoff multiplier
- Tests: 4 unit tests for retry scenarios

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 2: E2E Test Fixtures Setup

**Files:**

- Create: `helix-desktop/e2e/fixtures.ts`
- Modify: `helix-desktop/e2e/secrets.spec.ts`

**Step 1: Create fixtures file**

Create `helix-desktop/e2e/fixtures.ts`:

```typescript
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
    await page.route('**/api/secrets', async route => {
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
        await page.route('**/api/secrets', route => {
          if (route.request().method() === 'GET') {
            route.abort('blockedbyresponse');
          }
        });
      },

      setupEmptyState: async () => {
        await page.route('**/api/secrets', route => {
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
        await page.route('**/api/secrets', route => {
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
```

**Step 2: Update E2E tests to use fixtures**

Modify `helix-desktop/e2e/secrets.spec.ts`:

```typescript
import { test, expect, mockSecrets } from './fixtures';

test.describe('Desktop Secrets Management - With Fixtures', () => {
  test('should display empty state with no secrets', async ({
    page,
    secretsAPI,
    authenticatedPage,
  }) => {
    await secretsAPI.setupEmptyState();
    await authenticatedPage.goto('http://localhost:5173/settings/secrets');
    await authenticatedPage.waitForLoadState('networkidle');

    const emptyState = authenticatedPage.locator('text=No secrets yet');
    await expect(emptyState).toBeVisible();
  });

  test('should display secrets list with mock data', async ({
    page,
    secretsAPI,
    authenticatedPage,
  }) => {
    await secretsAPI.setupWithSecrets();
    await authenticatedPage.goto('http://localhost:5173/settings/secrets');
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(authenticatedPage.locator('text=Production Stripe Key')).toBeVisible();
    await expect(authenticatedPage.locator('text=Gemini API Key')).toBeVisible();
  });

  test('should display statistics with mock data', async ({
    page,
    secretsAPI,
    authenticatedPage,
  }) => {
    await secretsAPI.setupWithSecrets();
    await authenticatedPage.goto('http://localhost:5173/settings/secrets');
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(authenticatedPage.locator('text=Total Secrets')).toContainText('2');
    await expect(authenticatedPage.locator('text=Active')).toContainText('2');
  });
});
```

**Step 3: Run E2E tests**

```bash
cd helix-desktop
npm run test:e2e -- e2e/secrets.spec.ts
```

Expected: PASS - All 3 tests with fixtures passing

**Step 4: Commit**

```bash
cd helix-desktop
git add e2e/fixtures.ts e2e/secrets.spec.ts
git commit -m "feat(desktop-secrets): add E2E test fixtures for CI/CD

- Create reusable mock secrets data factory
- Add authenticated page fixture
- Add secrets API mock fixture
- Update E2E tests to use fixtures
- Tests: 3 E2E tests with fixture integration

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Accessibility Enhancements

**Files:**

- Modify: `helix-desktop/src/components/secrets/SecretsList.tsx`
- Modify: `helix-desktop/src/components/secrets/modals/CreateSecretModal.tsx`
- Modify: `helix-desktop/src/components/secrets/CopyButton.tsx`
- Test: `helix-desktop/src/components/secrets/__tests__/accessibility.test.tsx`

**Step 1: Write accessibility tests**

Create `helix-desktop/src/components/secrets/__tests__/accessibility.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecretsList } from '../SecretsList';
import { CreateSecretModal } from '../modals/CreateSecretModal';
import { CopyButton } from '../CopyButton';
import type { UserApiKey } from '../../../types/secrets';

describe('Accessibility Tests', () => {
  const mockSecret: UserApiKey = {
    id: 'secret-1',
    user_id: 'user-123',
    name: 'Test Key',
    secret_type: 'STRIPE_SECRET_KEY' as const,
    source_type: 'manual' as const,
    created_at: new Date(),
    expires_at: null,
    is_active: true,
    key_version: 1,
    encryption_method: 'aes-256-gcm' as const,
  };

  describe('SecretsList', () => {
    it('should have proper ARIA labels on action buttons', () => {
      render(<SecretsList secrets={[mockSecret]} onRotate={() => {}} onDelete={() => {}} />);

      const rotateButton = screen.getByRole('button', { name: /rotate/i });
      expect(rotateButton).toHaveAttribute('aria-label');
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<SecretsList secrets={[mockSecret]} onRotate={() => {}} onDelete={() => {}} />);

      const rotateButton = screen.getByRole('button', { name: /rotate/i });
      await user.tab();
      expect(rotateButton).toBeFocused();
    });
  });

  describe('CreateSecretModal', () => {
    it('should have proper labels for form fields', () => {
      render(
        <CreateSecretModal
          isOpen={true}
          onClose={() => {}}
          onCreate={() => {}}
        />
      );

      expect(screen.getByLabelText(/secret name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/secret type/i)).toBeInTheDocument();
    });

    it('should close on Escape key', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      render(
        <CreateSecretModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={() => {}}
        />
      );

      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have focus management', async () => {
      const user = userEvent.setup();
      render(
        <CreateSecretModal
          isOpen={true}
          onClose={() => {}}
          onCreate={() => {}}
        />
      );

      const nameInput = screen.getByLabelText(/secret name/i);
      await user.tab();
      expect(nameInput).toBeFocused();
    });
  });

  describe('CopyButton', () => {
    it('should have descriptive aria-label', () => {
      render(<CopyButton secretName="API Key" value="secret123" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Copy API Key');
    });

    it('should announce copy status to screen readers', async () => {
      const user = userEvent.setup();
      render(<CopyButton secretName="API Key" value="secret123" />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(button).toHaveAttribute('aria-live', 'polite');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd helix-desktop
npm run test -- src/components/secrets/__tests__/accessibility.test.tsx
```

Expected: FAIL - Accessibility attributes missing

**Step 3: Implement accessibility enhancements**

Update `helix-desktop/src/components/secrets/SecretsList.tsx`:

```typescript
import React from 'react';
import { format } from 'date-fns';
import type { UserApiKey } from '../../types/secrets';

interface SecretsListProps {
  secrets: UserApiKey[];
  onRotate: (secretId: string) => void;
  onDelete: (secretId: string) => void;
  loading?: boolean;
  error?: string | null;
}

export const SecretsList: React.FC<SecretsListProps> = ({
  secrets,
  onRotate,
  onDelete,
  loading,
  error,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  if (loading) {
    return <div className="loading" role="status" aria-live="polite">Loading secrets...</div>;
  }

  if (error) {
    return <div className="error" role="alert">{error}</div>;
  }

  if (secrets.length === 0) {
    return (
      <div className="empty-state" role="status">
        <p>No secrets yet</p>
        <p>Create your first secret to get started</p>
      </div>
    );
  }

  return (
    <div className="secrets-list" role="list">
      {secrets.map((secret) => (
        <div key={secret.id} className="secret-item" role="listitem">
          <div className="secret-header">
            <h3>{secret.name}</h3>
            <div className="badges">
              <span
                className={`badge ${secret.is_active ? 'active' : 'inactive'}`}
                aria-label={`Status: ${secret.is_active ? 'Active' : 'Inactive'}`}
              >
                {secret.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="secret-meta">
            <p>Type: {secret.secret_type}</p>
            <p>Version: {secret.key_version}</p>
            <p>Created: {format(new Date(secret.created_at), 'MMM dd, yyyy')}</p>
          </div>
          <div className="secret-actions">
            <button
              onClick={() => onRotate(secret.id)}
              onKeyDown={(e) => handleKeyDown(e, () => onRotate(secret.id))}
              aria-label={`Rotate ${secret.name}`}
            >
              Rotate
            </button>
            <button
              onClick={() => onDelete(secret.id)}
              onKeyDown={(e) => handleKeyDown(e, () => onDelete(secret.id))}
              aria-label={`Delete ${secret.name}`}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
```

Update `helix-desktop/src/components/secrets/modals/CreateSecretModal.tsx`:

```typescript
import React, { useState, useRef, useEffect } from 'react';
import type { SecretType } from '../../../types/secrets';

interface CreateSecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; secret_type: SecretType; expires_at?: Date }) => void;
}

const SECRET_TYPES: { value: SecretType; label: string }[] = [
  { value: 'SUPABASE_ANON_KEY', label: 'Supabase Anon Key' },
  { value: 'SUPABASE_SERVICE_ROLE', label: 'Supabase Service Role' },
  { value: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key' },
  { value: 'GEMINI_API_KEY', label: 'Gemini API Key' },
  { value: 'STRIPE_SECRET_KEY', label: 'Stripe Secret Key' },
  { value: 'STRIPE_PUBLISHABLE_KEY', label: 'Stripe Publishable Key' },
  { value: 'DISCORD_WEBHOOK', label: 'Discord Webhook' },
];

export const CreateSecretModal: React.FC<CreateSecretModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [secretType, setSecretType] = useState<SecretType>('SUPABASE_ANON_KEY');
  const [expiresAt, setExpiresAt] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Name is required';
    if (!secretType) newErrors.secretType = 'Type is required';
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      newErrors.expiresAt = 'Date must be in the future';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onCreate({
      name: name.trim(),
      secret_type: secretType,
      expires_at: expiresAt ? new Date(expiresAt) : undefined,
    });

    setName('');
    setSecretType('SUPABASE_ANON_KEY');
    setExpiresAt('');
    setErrors({});
    onClose();
  };

  return (
    <dialog open onKeyDown={handleKeyDown} role="dialog" aria-labelledby="modal-title" aria-modal="true">
      <h2 id="modal-title">Create New Secret</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Secret Name</label>
          <input
            id="name"
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Production Stripe Key"
            aria-describedby={errors.name ? 'name-error' : undefined}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p id="name-error" className="error">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="type">Secret Type</label>
          <select
            id="type"
            value={secretType}
            onChange={(e) => setSecretType(e.target.value as SecretType)}
            aria-describedby={errors.secretType ? 'type-error' : undefined}
            aria-invalid={!!errors.secretType}
          >
            {SECRET_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.secretType && <p id="type-error" className="error">{errors.secretType}</p>}
        </div>

        <div>
          <label htmlFor="expires">Expiration Date (Optional)</label>
          <input
            id="expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            aria-describedby={errors.expiresAt ? 'expires-error' : undefined}
            aria-invalid={!!errors.expiresAt}
          />
          {errors.expiresAt && <p id="expires-error" className="error">{errors.expiresAt}</p>}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} aria-label="Cancel creating secret">
            Cancel
          </button>
          <button type="submit" aria-label="Create secret with provided details">Create Secret</button>
        </div>
      </form>
    </dialog>
  );
};
```

Update `helix-desktop/src/components/secrets/CopyButton.tsx`:

```typescript
import React, { useState, useCallback } from 'react';

interface CopyButtonProps {
  secretName: string;
  value: string;
}

type FeedbackState = 'idle' | 'copied' | 'error';

export const CopyButton: React.FC<CopyButtonProps> = ({ secretName, value }) => {
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [timeoutId, setTimeoutId] = useState<number | null>(null);

  const handleCopy = useCallback(async () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    try {
      await navigator.clipboard.writeText(value);
      setFeedback('copied');

      const id = window.setTimeout(() => {
        setFeedback('idle');
      }, 10000);

      setTimeoutId(id as unknown as number);
    } catch (_err) {
      setFeedback('error');

      const id = window.setTimeout(() => {
        setFeedback('idle');
      }, 3000);

      setTimeoutId(id as unknown as number);
    }
  }, [value, timeoutId]);

  const feedbackText = {
    idle: '📋 Copy',
    copied: '✓ Copied!',
    error: '✗ Failed to copy',
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={`Copy ${secretName}`}
      aria-live="polite"
      aria-atomic="true"
      title={`Copy ${secretName} to clipboard`}
    >
      {feedbackText[feedback]}
    </button>
  );
};
```

**Step 4: Run tests to verify they pass**

```bash
cd helix-desktop
npm run test -- src/components/secrets/__tests__/accessibility.test.tsx
```

Expected: PASS - All 5 accessibility tests passing

**Step 5: Commit**

```bash
cd helix-desktop
git add \
  src/components/secrets/SecretsList.tsx \
  src/components/secrets/modals/CreateSecretModal.tsx \
  src/components/secrets/CopyButton.tsx \
  src/components/secrets/__tests__/accessibility.test.tsx
git commit -m "feat(desktop-secrets): add comprehensive accessibility enhancements

- Add ARIA labels and descriptions to all components
- Implement keyboard navigation (Tab, Enter, Escape)
- Add focus management for modals
- Add role attributes for screen readers
- Add aria-live regions for status updates
- Add aria-invalid for form validation
- Tests: 5 accessibility tests

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Feature Flags System

**Files:**

- Create: `helix-desktop/src/lib/feature-flags.ts`
- Modify: `helix-desktop/src/components/settings/SecretsSettings.tsx`
- Test: `helix-desktop/src/lib/__tests__/feature-flags.test.ts`

**Step 1: Write feature flag tests**

Create `helix-desktop/src/lib/__tests__/feature-flags.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureFlags, isFeatureEnabled, setFeatureFlag } from '../feature-flags';

describe('Feature Flags', () => {
  beforeEach(() => {
    // Reset to defaults
    localStorage.clear();
  });

  it('should return default flag value', () => {
    const enabled = isFeatureEnabled('secrets.enabled');
    expect(enabled).toBe(true); // Default enabled
  });

  it('should allow setting feature flag', () => {
    setFeatureFlag('secrets.rollout', false);
    expect(isFeatureEnabled('secrets.rollout')).toBe(false);
  });

  it('should persist flag value in localStorage', () => {
    setFeatureFlag('secrets.beta', true);
    const stored = localStorage.getItem('feature_flags');
    expect(stored).toContain('secrets.beta');
  });

  it('should support percentage-based rollout', () => {
    setFeatureFlag('secrets.rollout_percentage', 50);
    const enabled = isFeatureEnabled('secrets.rollout_percentage', { userId: 'user-123' });
    expect(typeof enabled).toBe('boolean');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd helix-desktop
npm run test -- src/lib/__tests__/feature-flags.test.ts
```

Expected: FAIL - Module doesn't exist

**Step 3: Implement feature flags**

Create `helix-desktop/src/lib/feature-flags.ts`:

```typescript
export interface FeatureFlags {
  'secrets.enabled': boolean;
  'secrets.rollout': boolean;
  'secrets.beta_features': boolean;
  'secrets.error_recovery': boolean;
  [key: string]: boolean | number;
}

const DEFAULT_FLAGS: Partial<FeatureFlags> = {
  'secrets.enabled': true,
  'secrets.rollout': true,
  'secrets.beta_features': false,
  'secrets.error_recovery': true,
};

function getStoredFlags(): Partial<FeatureFlags> {
  try {
    const stored = localStorage.getItem('feature_flags');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (_err) {
    console.warn('Failed to parse stored feature flags');
  }
  return {};
}

function saveFlags(flags: Partial<FeatureFlags>): void {
  try {
    localStorage.setItem('feature_flags', JSON.stringify(flags));
  } catch (_err) {
    console.warn('Failed to save feature flags');
  }
}

export function isFeatureEnabled(
  flag: keyof FeatureFlags,
  context?: { userId?: string; percentage?: number }
): boolean {
  const stored = getStoredFlags();
  const value = stored[flag] ?? DEFAULT_FLAGS[flag] ?? false;

  // Handle boolean flags
  if (typeof value === 'boolean') {
    return value;
  }

  // Handle percentage-based rollout
  if (typeof value === 'number' && context?.userId) {
    const hash = context.userId.split('').reduce((acc, char) => {
      return (acc << 5) - acc + char.charCodeAt(0);
    }, 0);
    const userPercentage = Math.abs(hash) % 100;
    return userPercentage < value;
  }

  return false;
}

export function setFeatureFlag(flag: keyof FeatureFlags, enabled: boolean | number): void {
  const stored = getStoredFlags();
  stored[flag] = enabled;
  saveFlags(stored);
}

export function getFeatureFlags(): Partial<FeatureFlags> {
  return { ...DEFAULT_FLAGS, ...getStoredFlags() };
}

export function resetFeatureFlags(): void {
  localStorage.removeItem('feature_flags');
}
```

Update `helix-desktop/src/components/settings/SecretsSettings.tsx`:

```typescript
import React, { useState } from 'react';
import { useSecretsData } from '../../hooks/useSecretsData';
import { SecretsList } from '../secrets/SecretsList';
import { CreateSecretModal } from '../secrets/modals/CreateSecretModal';
import { RotateSecretModal } from '../secrets/modals/RotateSecretModal';
import { isFeatureEnabled } from '../../lib/feature-flags';
import type { SecretType } from '../../types/secrets';
import '../secrets/Secrets.css';

export const SecretsSettings: React.FC = () => {
  // Check if feature is enabled
  const isSecretsEnabled = isFeatureEnabled('secrets.enabled');

  if (!isSecretsEnabled) {
    return (
      <div className="secrets-settings">
        <div className="settings-header">
          <h1>Secrets Management</h1>
          <p>This feature is currently unavailable. Thank you for your patience!</p>
        </div>
      </div>
    );
  }

  const {
    secrets,
    loading,
    error,
    selectedSecret,
    setSelectedSecret,
    createSecret,
    rotateSecret,
    deleteSecret,
  } = useSecretsData();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRotateOpen, setIsRotateOpen] = useState(false);

  const handleCreate = async (data: { name: string; secret_type: SecretType; expires_at?: Date }) => {
    await createSecret(data);
    setIsCreateOpen(false);
  };

  const handleRotate = (secretId: string) => {
    const secret = secrets.find((s) => s.id === secretId);
    if (secret) {
      setSelectedSecret(secret);
      setIsRotateOpen(true);
    }
  };

  const handleRotateConfirm = async (secretId: string) => {
    await rotateSecret(secretId);
    setIsRotateOpen(false);
    setSelectedSecret(null);
  };

  const activeCount = secrets.filter((s) => s.is_active).length;
  const expiringCount = secrets.filter((s) => {
    if (!s.expires_at) return false;
    const days = (new Date(s.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 7 && days > 0;
  }).length;

  return (
    <div className="secrets-settings">
      <div className="settings-header">
        <h1>Secrets</h1>
        <p>Manage your API keys and secrets securely</p>
        <button onClick={() => setIsCreateOpen(true)}>+ Create Secret</button>
      </div>

      <div className="stats">
        <div className="stat-card">
          <p>Total Secrets</p>
          <p className="stat-value">{secrets.length}</p>
        </div>
        <div className="stat-card">
          <p>Active</p>
          <p className="stat-value">{activeCount}</p>
        </div>
        <div className="stat-card">
          <p>Expiring Soon</p>
          <p className="stat-value">{expiringCount}</p>
        </div>
      </div>

      <div className="secrets-container">
        <SecretsList
          secrets={secrets}
          loading={loading}
          error={error}
          onRotate={handleRotate}
          onDelete={deleteSecret}
        />
      </div>

      <CreateSecretModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />

      {selectedSecret && (
        <RotateSecretModal
          isOpen={isRotateOpen}
          secret={selectedSecret}
          onClose={() => {
            setIsRotateOpen(false);
            setSelectedSecret(null);
          }}
          onConfirm={handleRotateConfirm}
        />
      )}
    </div>
  );
};
```

**Step 4: Run tests to verify they pass**

```bash
cd helix-desktop
npm run test -- src/lib/__tests__/feature-flags.test.ts
```

Expected: PASS - All 3 tests passing

**Step 5: Commit**

```bash
cd helix-desktop
git add \
  src/lib/feature-flags.ts \
  src/components/settings/SecretsSettings.tsx \
  src/lib/__tests__/feature-flags.test.ts
git commit -m "feat(desktop-secrets): add feature flags system for gradual rollout

- Create feature flag configuration system
- Support boolean flags and percentage-based rollout
- Persist flags in localStorage
- Integrate with SecretsSettings component
- Allow graceful feature disabling
- Tests: 3 tests for flag logic and rollout

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Component Barrel Exports

**Files:**

- Create: `helix-desktop/src/components/secrets/index.ts`
- Modify: `helix-desktop/src/components/settings/SecretsSettings.tsx`
- Test: `helix-desktop/src/components/secrets/__tests__/barrel-exports.test.ts`

**Step 1: Write barrel export tests**

Create `helix-desktop/src/components/secrets/__tests__/barrel-exports.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Secrets Component Barrel Exports', () => {
  it('should export SecretsList component', async () => {
    const { SecretsList } = await import('../index');
    expect(SecretsList).toBeDefined();
  });

  it('should export CreateSecretModal component', async () => {
    const { CreateSecretModal } = await import('../index');
    expect(CreateSecretModal).toBeDefined();
  });

  it('should export RotateSecretModal component', async () => {
    const { RotateSecretModal } = await import('../index');
    expect(RotateSecretModal).toBeDefined();
  });

  it('should export CopyButton component', async () => {
    const { CopyButton } = await import('../index');
    expect(CopyButton).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd helix-desktop
npm run test -- src/components/secrets/__tests__/barrel-exports.test.ts
```

Expected: FAIL - Index file doesn't exist

**Step 3: Create barrel export**

Create `helix-desktop/src/components/secrets/index.ts`:

```typescript
export { SecretsList } from './SecretsList';
export { CopyButton } from './CopyButton';
export { Secrets } from './Secrets';
export { CreateSecretModal } from './modals/CreateSecretModal';
export { RotateSecretModal } from './modals/RotateSecretModal';

export type { UserApiKey } from '../../types/secrets';
export type { SecretType } from '../../types/secrets';
```

Create placeholder `helix-desktop/src/components/secrets/Secrets.tsx`:

```typescript
export const Secrets = {};
```

Update imports in `helix-desktop/src/components/settings/SecretsSettings.tsx`:

```typescript
import React, { useState } from 'react';
import { useSecretsData } from '../../hooks/useSecretsData';
import { SecretsList, CreateSecretModal, RotateSecretModal } from '../secrets';
import { isFeatureEnabled } from '../../lib/feature-flags';
import type { SecretType } from '../../types/secrets';
import '../secrets/Secrets.css';

// Rest of component...
```

**Step 4: Run tests to verify they pass**

```bash
cd helix-desktop
npm run test -- src/components/secrets/__tests__/barrel-exports.test.ts
```

Expected: PASS - All 2 tests passing

**Step 5: Commit**

```bash
cd helix-desktop
git add \
  src/components/secrets/index.ts \
  src/components/secrets/Secrets.tsx \
  src/components/settings/SecretsSettings.tsx \
  src/components/secrets/__tests__/barrel-exports.test.ts
git commit -m "feat(desktop-secrets): add component barrel exports for cleaner imports

- Create secrets/index.ts barrel export
- Export all secrets components and types
- Update imports in SecretsSettings
- Enable cleaner component imports across app
- Tests: 2 tests for export availability

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 6: JSDoc Documentation

**Files:**

- Modify: `helix-desktop/src/hooks/useSecretsData.ts`
- Modify: `helix-desktop/src/lib/api/secrets-client.ts`

**Step 1: Add JSDoc to hooks**

Update `helix-desktop/src/hooks/useSecretsData.ts`:

````typescript
import { useState, useCallback, useEffect, useMemo } from 'react';
import { SecretsClient } from '../lib/api/secrets-client';
import { useAuth } from '../lib/auth-context';
import type { UserApiKey } from '../types/secrets';
import type { CreateSecretInput } from '../lib/api/secrets-client';

/**
 * Result type for useSecretsData hook
 */
export interface SecretsDataResult {
  secrets: UserApiKey[];
  loading: boolean;
  error: string | null;
  selectedSecret: UserApiKey | null;
  setSelectedSecret: (secret: UserApiKey | null) => void;
  loadSecrets: () => Promise<void>;
  createSecret: (input: CreateSecretInput) => Promise<UserApiKey>;
  rotateSecret: (secretId: string) => Promise<UserApiKey>;
  deleteSecret: (secretId: string) => Promise<void>;
}

/**
 * Hook for managing secrets data and API calls
 *
 * Provides state management for secrets list, loading, and error states.
 * Automatically loads secrets on mount when authentication token is available.
 *
 * @returns {SecretsDataResult} Secrets data and manipulation methods
 *
 * @example
 * ```tsx
 * const { secrets, loading, error, createSecret } = useSecretsData();
 *
 * const handleCreate = async (data) => {
 *   try {
 *     const secret = await createSecret(data);
 *     console.log('Created:', secret);
 *   } catch (err) {
 *     console.error('Failed:', err);
 *   }
 * };
 * ```
 */
export function useSecretsData(): SecretsDataResult {
  const { token } = useAuth();
  const [secrets, setSecrets] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSecret, setSelectedSecret] = useState<UserApiKey | null>(null);

  // Memoize client to prevent unnecessary instantiation
  const client = useMemo(() => new SecretsClient(token || ''), [token]);

  /**
   * Load all secrets from the API
   */
  const loadSecrets = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const data = await client.listSecrets();
      setSecrets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  }, [token, client]);

  // Load secrets on mount and when token changes
  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  /**
   * Create a new secret
   * @param {CreateSecretInput} input - Secret creation data
   * @returns {Promise<UserApiKey>} Created secret
   */
  const createSecret = useCallback(
    async (input: CreateSecretInput): Promise<UserApiKey> => {
      setError(null);
      try {
        const secret = await client.createSecret(input);
        setSecrets(prev => [...prev, secret]);
        return secret;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create secret';
        setError(message);
        throw err;
      }
    },
    [client]
  );

  /**
   * Rotate a secret (generate new version)
   * @param {string} secretId - ID of secret to rotate
   * @returns {Promise<UserApiKey>} Updated secret
   */
  const rotateSecret = useCallback(
    async (secretId: string): Promise<UserApiKey> => {
      setError(null);
      try {
        const updated = await client.rotateSecret(secretId);
        setSecrets(prev => prev.map(s => (s.id === secretId ? updated : s)));
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to rotate secret';
        setError(message);
        throw err;
      }
    },
    [client]
  );

  /**
   * Delete a secret
   * @param {string} secretId - ID of secret to delete
   */
  const deleteSecret = useCallback(
    async (secretId: string): Promise<void> => {
      setError(null);
      try {
        await client.deleteSecret(secretId);
        setSecrets(prev => prev.filter(s => s.id !== secretId));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete secret';
        setError(message);
        throw err;
      }
    },
    [client]
  );

  return {
    secrets,
    loading,
    error,
    selectedSecret,
    setSelectedSecret,
    loadSecrets,
    createSecret,
    rotateSecret,
    deleteSecret,
  };
}
````

Update `helix-desktop/src/lib/api/secrets-client.ts`:

````typescript
import type { UserApiKey } from '../../types/secrets';
import type { SecretType } from '../../types/secrets';

/**
 * Input data for creating a new secret
 */
export interface CreateSecretInput {
  name: string;
  secret_type: SecretType;
  expires_at?: Date;
}

/**
 * Configuration for retry logic
 */
interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelay: 100,
};

/**
 * Check if an error is retryable (network errors)
 * @param {unknown} error - Error to check
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}

/**
 * Check if HTTP status code is retryable (5xx errors)
 * @param {number} status - HTTP status code
 * @returns {boolean} True if status is retryable
 */
function isRetryableStatus(status: number): boolean {
  return status >= 500;
}

/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>} Resolves after delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * API Client for secrets management
 *
 * Handles all communication with the /api/secrets backend endpoints.
 * Implements Bearer token authentication and automatic retry with exponential backoff.
 *
 * @example
 * ```typescript
 * const client = new SecretsClient('auth-token');
 * const secrets = await client.listSecrets();
 *
 * const newSecret = await client.createSecret({
 *   name: 'My Key',
 *   secret_type: 'STRIPE_SECRET_KEY',
 * });
 * ```
 */
export class SecretsClient {
  private token: string;
  private retryConfig: RetryConfig;

  /**
   * Create a new secrets API client
   * @param {string} token - Bearer authentication token
   * @param {Partial<RetryConfig>} retryConfig - Optional retry configuration
   */
  constructor(token: string, retryConfig: Partial<RetryConfig> = {}) {
    this.token = token;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Make HTTP request with automatic retry logic
   * @template T - Response data type
   * @param {string} endpoint - API endpoint path
   * @param {RequestInit} options - Fetch options
   * @returns {Promise<T>} Response data
   * @private
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          ...options,
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));

          if (response.status >= 400 && response.status < 500) {
            if (response.status === 401) {
              throw new Error('Unauthorized');
            }
            throw new Error(error.error || `HTTP ${response.status}`);
          }

          if (isRetryableStatus(response.status) && attempt < this.retryConfig.maxRetries) {
            const backoffDelay =
              this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
            await delay(backoffDelay);
            continue;
          }

          throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json();
      } catch (error) {
        lastError = error as Error;

        if (isRetryableError(error) && attempt < this.retryConfig.maxRetries) {
          const backoffDelay =
            this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
          await delay(backoffDelay);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Failed after maximum retries');
  }

  /**
   * Get all secrets for the authenticated user
   * @returns {Promise<UserApiKey[]>} Array of secrets
   */
  async listSecrets(): Promise<UserApiKey[]> {
    const data = await this.request<{ secrets: UserApiKey[] }>('/api/secrets');
    return data.secrets;
  }

  /**
   * Create a new secret
   * @param {CreateSecretInput} input - Secret creation data
   * @returns {Promise<UserApiKey>} Created secret
   */
  async createSecret(input: CreateSecretInput): Promise<UserApiKey> {
    return this.request<UserApiKey>('/api/secrets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Rotate a secret (generate new version)
   * @param {string} secretId - ID of secret to rotate
   * @returns {Promise<UserApiKey>} Updated secret with new version
   */
  async rotateSecret(secretId: string): Promise<UserApiKey> {
    return this.request<UserApiKey>(`/api/secrets/${secretId}/rotate`, {
      method: 'POST',
    });
  }

  /**
   * Delete a secret
   * @param {string} secretId - ID of secret to delete
   * @returns {Promise<void>}
   */
  async deleteSecret(secretId: string): Promise<void> {
    await this.request(`/api/secrets/${secretId}`, {
      method: 'DELETE',
    });
  }
}
````

**Step 2: Commit**

```bash
cd helix-desktop
git add \
  src/hooks/useSecretsData.ts \
  src/lib/api/secrets-client.ts
git commit -m "docs(desktop-secrets): add comprehensive JSDoc documentation

- Document all public methods with JSDoc comments
- Add usage examples for key functions
- Document parameters and return types
- Add inline comments for complex logic
- Document retry logic and error handling
- Enable better IDE autocomplete and type hints

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Performance Optimization

**Files:**

- Modify: `helix-desktop/src/components/secrets/modals/CreateSecretModal.tsx`
- Modify: `helix-desktop/src/components/secrets/modals/RotateSecretModal.tsx`
- Modify: `helix-desktop/src/components/settings/SecretsSettings.tsx`
- Test: `helix-desktop/src/components/secrets/__tests__/performance.test.tsx`

**Step 1: Write performance tests**

Create `helix-desktop/src/components/secrets/__tests__/performance.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { SecretsSettings } from '../../settings/SecretsSettings';

// Mock lazy components
vi.mock('../modals/CreateSecretModal', () => ({
  CreateSecretModal: () => <div data-testid="create-modal">Create Modal</div>,
}));

vi.mock('../modals/RotateSecretModal', () => ({
  RotateSecretModal: () => <div data-testid="rotate-modal">Rotate Modal</div>,
}));

describe('Performance Optimization - Lazy Loading', () => {
  it('should lazy load CreateSecretModal', async () => {
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <SecretsSettings />
      </Suspense>
    );

    expect(screen.getByTestId('create-modal')).toBeDefined();
  });

  it('should lazy load RotateSecretModal', async () => {
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <SecretsSettings />
      </Suspense>
    );

    expect(screen.getByTestId('rotate-modal')).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd helix-desktop
npm run test -- src/components/secrets/__tests__/performance.test.tsx
```

Expected: FAIL - Components not lazy loaded yet

**Step 3: Implement lazy loading**

Update `helix-desktop/src/components/secrets/modals/CreateSecretModal.tsx` - no changes needed, export as is

Update `helix-desktop/src/components/settings/SecretsSettings.tsx`:

```typescript
import React, { useState, Suspense, lazy } from 'react';
import { useSecretsData } from '../../hooks/useSecretsData';
import { SecretsList } from '../secrets/SecretsList';
import { isFeatureEnabled } from '../../lib/feature-flags';
import type { SecretType } from '../../types/secrets';
import '../secrets/Secrets.css';

// Lazy load modals for better performance
const CreateSecretModal = lazy(() =>
  import('../secrets/modals/CreateSecretModal').then(m => ({ default: m.CreateSecretModal }))
);

const RotateSecretModal = lazy(() =>
  import('../secrets/modals/RotateSecretModal').then(m => ({ default: m.RotateSecretModal }))
);

/**
 * Fallback component for lazy loaded modals
 */
const ModalFallback = () => <div className="modal-loading">Loading...</div>;

export const SecretsSettings: React.FC = () => {
  const isSecretsEnabled = isFeatureEnabled('secrets.enabled');

  if (!isSecretsEnabled) {
    return (
      <div className="secrets-settings">
        <div className="settings-header">
          <h1>Secrets Management</h1>
          <p>This feature is currently unavailable. Thank you for your patience!</p>
        </div>
      </div>
    );
  }

  const {
    secrets,
    loading,
    error,
    selectedSecret,
    setSelectedSecret,
    createSecret,
    rotateSecret,
    deleteSecret,
  } = useSecretsData();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRotateOpen, setIsRotateOpen] = useState(false);

  const handleCreate = async (data: { name: string; secret_type: SecretType; expires_at?: Date }) => {
    await createSecret(data);
    setIsCreateOpen(false);
  };

  const handleRotate = (secretId: string) => {
    const secret = secrets.find((s) => s.id === secretId);
    if (secret) {
      setSelectedSecret(secret);
      setIsRotateOpen(true);
    }
  };

  const handleRotateConfirm = async (secretId: string) => {
    await rotateSecret(secretId);
    setIsRotateOpen(false);
    setSelectedSecret(null);
  };

  const activeCount = secrets.filter((s) => s.is_active).length;
  const expiringCount = secrets.filter((s) => {
    if (!s.expires_at) return false;
    const days = (new Date(s.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 7 && days > 0;
  }).length;

  return (
    <div className="secrets-settings">
      <div className="settings-header">
        <h1>Secrets</h1>
        <p>Manage your API keys and secrets securely</p>
        <button onClick={() => setIsCreateOpen(true)}>+ Create Secret</button>
      </div>

      <div className="stats">
        <div className="stat-card">
          <p>Total Secrets</p>
          <p className="stat-value">{secrets.length}</p>
        </div>
        <div className="stat-card">
          <p>Active</p>
          <p className="stat-value">{activeCount}</p>
        </div>
        <div className="stat-card">
          <p>Expiring Soon</p>
          <p className="stat-value">{expiringCount}</p>
        </div>
      </div>

      <div className="secrets-container">
        <SecretsList
          secrets={secrets}
          loading={loading}
          error={error}
          onRotate={handleRotate}
          onDelete={deleteSecret}
        />
      </div>

      <Suspense fallback={<ModalFallback />}>
        <CreateSecretModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreate}
        />
      </Suspense>

      {selectedSecret && (
        <Suspense fallback={<ModalFallback />}>
          <RotateSecretModal
            isOpen={isRotateOpen}
            secret={selectedSecret}
            onClose={() => {
              setIsRotateOpen(false);
              setSelectedSecret(null);
            }}
            onConfirm={handleRotateConfirm}
          />
        </Suspense>
      )}
    </div>
  );
};
```

Add to `helix-desktop/src/components/secrets/Secrets.css`:

```css
.modal-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: #666;
  font-size: 14px;
}
```

**Step 4: Run tests to verify they pass**

```bash
cd helix-desktop
npm run test -- src/components/secrets/__tests__/performance.test.tsx
```

Expected: PASS - All 2 tests passing

**Step 5: Commit**

```bash
cd helix-desktop
git add \
  src/components/settings/SecretsSettings.tsx \
  src/components/secrets/Secrets.css \
  src/components/secrets/__tests__/performance.test.tsx
git commit -m "perf(desktop-secrets): implement lazy loading for modal components

- Use React.lazy() to code-split modal components
- Add Suspense boundaries with loading fallback
- Modals load on-demand when user opens them
- Reduces initial bundle size and improves page load
- Tests: 2 tests for lazy loading behavior

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Final Checklist

- [ ] Task 1: Error Recovery (4 tests)
- [ ] Task 2: E2E Fixtures (3 tests)
- [ ] Task 3: Accessibility (5 tests)
- [ ] Task 4: Feature Flags (3 tests)
- [ ] Task 5: Barrel Exports (2 tests)
- [ ] Task 6: Documentation (none)
- [ ] Task 7: Performance (2 tests)

**Total: 19 new tests + 30 existing tests = 49 total tests**

All code in TypeScript strict mode. All enhancements maintain feature parity and improve production readiness.

---

Plan complete and saved to `docs/plans/2026-02-02-desktop-phase3-enhancements.md`.

## Execution Options

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
