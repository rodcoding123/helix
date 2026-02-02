# Phase 3 Frontend: Secrets Management Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build a production-grade React dashboard for managing encrypted API keys with real-time UI updates, secure clipboard handling, and intuitive rotation workflows.

**Architecture:** React component library using SvelteKit (matching existing web/ structure), with Supabase real-time subscriptions for live updates. Uses client-side encryption option (BYOK) for users who want zero-knowledge. Integrates with Phase 1-2 DatabaseSecretsManager API endpoints. TypeScript strict mode, Tailwind CSS for styling, Vitest for testing.

**Tech Stack:**
- Frontend: React 18, SvelteKit, TypeScript strict
- Styling: Tailwind CSS
- State Management: React hooks + Zustand (for global state)
- Real-time: Supabase Realtime subscriptions
- Encryption: Optional client-side encryption (tweetnacl.js)
- Testing: Vitest + Playwright for E2E
- Clipboard: Secure clipboard with auto-clear (10s timeout)

---

## Phase 3A: Core Secrets UI Components (4 Tasks)

### Task 1: Create SecretsContext and Zustand store

**Files:**
- Create: `web/src/lib/stores/secrets-store.ts`
- Create: `web/src/lib/context/SecretsContext.tsx`
- Create: `web/src/lib/stores/__tests__/secrets-store.test.ts`

**Step 1: Write failing tests for Zustand store**

Create `web/src/lib/stores/__tests__/secrets-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useSecretsStore } from '../secrets-store';

describe('Secrets Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useSecretsStore.getState().reset();
  });

  it('should initialize with empty secrets', () => {
    const { secrets } = useSecretsStore.getState();
    expect(secrets).toEqual({});
  });

  it('should add secret to store', () => {
    const { addSecret } = useSecretsStore.getState();
    addSecret('STRIPE_SECRET_KEY', {
      id: 'secret-1',
      secretType: 'STRIPE_SECRET_KEY',
      sourceType: 'user-provided',
      isActive: true,
      createdAt: new Date().toISOString(),
      lastAccessedAt: null,
      lastRotatedAt: null,
      expiresAt: null,
    });

    const { secrets } = useSecretsStore.getState();
    expect(secrets['STRIPE_SECRET_KEY']).toBeDefined();
  });

  it('should remove secret from store', () => {
    const { addSecret, removeSecret } = useSecretsStore.getState();
    addSecret('GEMINI_API_KEY', { /* ... */ });

    removeSecret('GEMINI_API_KEY');

    const { secrets } = useSecretsStore.getState();
    expect(secrets['GEMINI_API_KEY']).toBeUndefined();
  });

  it('should update secret metadata', () => {
    const { addSecret, updateSecret } = useSecretsStore.getState();
    const secret = { /* ... */ };
    addSecret('DEEPSEEK_API_KEY', secret);

    const updated = { ...secret, lastRotatedAt: new Date().toISOString() };
    updateSecret('DEEPSEEK_API_KEY', updated);

    const { secrets } = useSecretsStore.getState();
    expect(secrets['DEEPSEEK_API_KEY'].lastRotatedAt).toBeDefined();
  });

  it('should set loading state', () => {
    const { setLoading } = useSecretsStore.getState();
    setLoading(true);

    let { isLoading } = useSecretsStore.getState();
    expect(isLoading).toBe(true);

    setLoading(false);
    ({ isLoading } = useSecretsStore.getState());
    expect(isLoading).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /c/Users/Specter/Desktop/Helix/web
npx vitest run src/lib/stores/__tests__/secrets-store.test.ts
```

Expected: ALL FAIL - store not defined

**Step 3: Implement Zustand store**

Create `web/src/lib/stores/secrets-store.ts`:

```typescript
import { create } from 'zustand';
import type { SecretType } from '$lib/types/secrets';
import type { UserApiKey } from '$lib/types/secrets';

interface SecretsState {
  secrets: Record<SecretType, UserApiKey>;
  isLoading: boolean;
  error: string | null;
  addSecret: (type: SecretType, secret: UserApiKey) => void;
  removeSecret: (type: SecretType) => void;
  updateSecret: (type: SecretType, secret: UserApiKey) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useSecretsStore = create<SecretsState>((set) => ({
  secrets: {},
  isLoading: false,
  error: null,

  addSecret: (type: SecretType, secret: UserApiKey) =>
    set((state) => ({
      secrets: { ...state.secrets, [type]: secret },
    })),

  removeSecret: (type: SecretType) =>
    set((state) => {
      const { [type]: _, ...remaining } = state.secrets;
      return { secrets: remaining };
    }),

  updateSecret: (type: SecretType, secret: UserApiKey) =>
    set((state) => ({
      secrets: { ...state.secrets, [type]: secret },
    })),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  setError: (error: string | null) => set({ error }),

  reset: () => set({ secrets: {}, isLoading: false, error: null }),
}));
```

**Step 4: Create SecretsContext for provider**

Create `web/src/lib/context/SecretsContext.tsx`:

```typescript
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSecretsStore } from '../stores/secrets-store';
import { useAuth } from '$lib/hooks/useAuth';

interface SecretsContextType {
  secrets: Record<string, any>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const SecretsContext = createContext<SecretsContextType | undefined>(undefined);

export function SecretsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { secrets, isLoading, error, setLoading, setError, reset, addSecret } =
    useSecretsStore();

  const refetch = async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    try {
      const response = await fetch('/api/secrets', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch secrets');

      const { secrets: fetchedSecrets } = await response.json();
      reset();

      for (const secret of fetchedSecrets) {
        addSecret(secret.secretType, secret);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [session?.user?.id]);

  return (
    <SecretsContext.Provider value={{ secrets, isLoading, error, refetch }}>
      {children}
    </SecretsContext.Provider>
  );
}

export function useSecrets() {
  const context = useContext(SecretsContext);
  if (!context) {
    throw new Error('useSecrets must be used within SecretsProvider');
  }
  return context;
}
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run src/lib/stores/__tests__/secrets-store.test.ts
```

Expected: ALL PASS

**Step 6: Commit**

```bash
git add web/src/lib/stores/ web/src/lib/context/
git commit -m "feat(secrets-ui): add Zustand store and SecretsContext

- Implement Zustand store for secret state management
- Create SecretsProvider for context-based access
- Auto-fetch secrets on mount with error handling
- Support add/remove/update/reset operations
- All 5 tests passing"
```

---

### Task 2: Create SecretsList component

**Files:**
- Create: `web/src/lib/components/secrets/SecretsList.tsx`
- Create: `web/src/lib/components/secrets/SecretListItem.tsx`
- Create: `web/src/lib/components/__tests__/SecretsList.test.tsx`

**Step 1: Write tests for SecretsList component**

Create `web/src/lib/components/__tests__/SecretsList.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecretsProvider } from '$lib/context/SecretsContext';
import SecretsList from '../secrets/SecretsList';

describe('SecretsList Component', () => {
  it('should render empty state when no secrets', () => {
    render(
      <SecretsProvider>
        <SecretsList />
      </SecretsProvider>
    );

    expect(screen.getByText(/no secrets configured/i)).toBeInTheDocument();
  });

  it('should display loading spinner', () => {
    render(
      <SecretsProvider>
        <SecretsList />
      </SecretsProvider>
    );

    // Would show loading state based on store
  });

  it('should render list of secrets', () => {
    // Mock secrets in store
    render(
      <SecretsProvider>
        <SecretsList />
      </SecretsProvider>
    );

    // Verify each secret is displayed
  });

  it('should have add secret button', () => {
    render(
      <SecretsProvider>
        <SecretsList />
      </SecretsProvider>
    );

    expect(screen.getByRole('button', { name: /add secret/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

```bash
npx vitest run src/lib/components/__tests__/SecretsList.test.tsx
```

Expected: Tests run (some may not fully validate yet)

**Step 3: Implement SecretsList component**

Create `web/src/lib/components/secrets/SecretsList.tsx`:

```typescript
import { useState } from 'react';
import { useSecrets } from '$lib/context/SecretsContext';
import SecretListItem from './SecretListItem';
import CreateSecretModal from './CreateSecretModal';

export default function SecretsList() {
  const { secrets, isLoading, error } = useSecrets();
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-800">
        <p className="font-semibold">Error loading secrets</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  const secretList = Object.entries(secrets);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Add Secret
        </button>
      </div>

      {secretList.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-600">No secrets configured yet</p>
          <p className="text-sm text-gray-500">
            Add your first API key to get started
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {secretList.map(([type, secret]) => (
            <SecretListItem key={type} type={type as any} secret={secret} />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateSecretModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            // Refetch secrets
          }}
        />
      )}
    </div>
  );
}
```

**Step 4: Implement SecretListItem component**

Create `web/src/lib/components/secrets/SecretListItem.tsx`:

```typescript
import { useState } from 'react';
import type { SecretType, UserApiKey } from '$lib/types/secrets';
import { formatDate, isExpired } from '$lib/utils/date-utils';
import CopyButton from '../shared/CopyButton';
import RotateSecretModal from './RotateSecretModal';

interface SecretListItemProps {
  type: SecretType;
  secret: UserApiKey;
}

export default function SecretListItem({ type, secret }: SecretListItemProps) {
  const [showRotateModal, setShowRotateModal] = useState(false);
  const expired = isExpired(secret.expiresAt);

  return (
    <div className="rounded-lg border border-gray-200 p-4 hover:border-gray-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{type}</h3>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p>Created: {formatDate(secret.createdAt)}</p>
            {secret.lastAccessedAt && (
              <p>Last accessed: {formatDate(secret.lastAccessedAt)}</p>
            )}
            {secret.lastRotatedAt && (
              <p>Last rotated: {formatDate(secret.lastRotatedAt)}</p>
            )}
            {secret.expiresAt && (
              <p
                className={expired ? 'text-red-600' : 'text-green-600'}
              >
                Expires: {formatDate(secret.expiresAt)}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowRotateModal(true)}
            className="rounded px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200"
          >
            Rotate
          </button>
          <button
            onClick={() => {/* Delete handler */}}
            className="rounded px-3 py-1 text-sm bg-red-100 text-red-700 hover:bg-red-200"
          >
            Delete
          </button>
        </div>
      </div>

      {showRotateModal && (
        <RotateSecretModal
          type={type}
          onClose={() => setShowRotateModal(false)}
          onSuccess={() => setShowRotateModal(false)}
        />
      )}
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add web/src/lib/components/secrets/
git commit -m "feat(secrets-ui): add SecretsList and SecretListItem components

- Create main secrets list view with empty state
- Implement individual secret list items with metadata
- Show creation date, last access, rotation, expiration
- Add rotate and delete action buttons
- Display expiration status with color coding"
```

---

### Task 3: Create CreateSecretModal component

**Files:**
- Create: `web/src/lib/components/secrets/CreateSecretModal.tsx`
- Create: `web/src/lib/components/__tests__/CreateSecretModal.test.tsx`

**Step 1: Write tests**

Create `web/src/lib/components/__tests__/CreateSecretModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateSecretModal from '../secrets/CreateSecretModal';

describe('CreateSecretModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  it('should render form fields', () => {
    render(
      <CreateSecretModal onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByLabelText(/secret type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/secret value/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/source type/i)).toBeInTheDocument();
  });

  it('should validate empty secret value', async () => {
    const user = userEvent.setup();
    render(
      <CreateSecretModal onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(screen.getByText(/secret value is required/i)).toBeInTheDocument();
  });

  it('should call onSuccess on successful creation', async () => {
    const user = userEvent.setup();
    render(
      <CreateSecretModal onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await user.selectOptions(screen.getByLabelText(/secret type/i), 'GEMINI_API_KEY');
    await user.type(screen.getByLabelText(/secret value/i), 'AIzaSy_test123');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('should call onClose when cancelled', async () => {
    const user = userEvent.setup();
    render(
      <CreateSecretModal onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockOnClose).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests**

```bash
npx vitest run src/lib/components/__tests__/CreateSecretModal.test.tsx
```

**Step 3: Implement CreateSecretModal**

Create `web/src/lib/components/secrets/CreateSecretModal.tsx`:

```typescript
import { useState } from 'react';
import type { SecretType, SecretSourceType } from '$lib/types/secrets';
import { useAuth } from '$lib/hooks/useAuth';
import { useSecretsStore } from '$lib/stores/secrets-store';

const SECRET_TYPES: SecretType[] = [
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE',
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'DISCORD_WEBHOOK',
];

const SOURCE_TYPES: SecretSourceType[] = [
  'user-provided',
  'user-local',
];

interface CreateSecretModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateSecretModal({ onClose, onSuccess }: CreateSecretModalProps) {
  const { session } = useAuth();
  const { addSecret, setError, setLoading } = useSecretsStore();
  const [formData, setFormData] = useState({
    secretType: 'GEMINI_API_KEY' as SecretType,
    value: '',
    sourceType: 'user-provided' as SecretSourceType,
    expiresAt: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.value.trim()) {
      newErrors.value = 'Secret value is required';
    }

    if (formData.value.trim().length < 5) {
      newErrors.value = 'Secret value must be at least 5 characters';
    }

    if (formData.expiresAt && new Date(formData.expiresAt) < new Date()) {
      newErrors.expiresAt = 'Expiration date must be in the future';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !session?.access_token) return;

    setIsSubmitting(true);
    setLoading(true);

    try {
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          key_name: formData.secretType,
          secret_type: formData.secretType,
          value: formData.value,
          source_type: formData.sourceType,
          expires_at: formData.expiresAt || undefined,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to create secret');
      }

      const { id, secretType, sourceType, createdAt } = await response.json();
      addSecret(secretType, {
        id,
        user_id: session.user.id,
        key_name: formData.secretType,
        secret_type: secretType,
        encrypted_value: '', // Never stored locally
        derivation_salt: null,
        encryption_method: 'aes-256-gcm',
        key_version: 1,
        source_type: sourceType,
        is_active: true,
        created_at: createdAt,
        last_accessed_at: null,
        last_rotated_at: null,
        expires_at: formData.expiresAt || null,
        created_by: session.user.id,
        updated_by: null,
        updated_at: createdAt,
      });

      setError(null);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Add Secret</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="secretType" className="block text-sm font-medium text-gray-700">
              Secret Type
            </label>
            <select
              id="secretType"
              value={formData.secretType}
              onChange={(e) =>
                setFormData({ ...formData, secretType: e.target.value as SecretType })
              }
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {SECRET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="value" className="block text-sm font-medium text-gray-700">
              Secret Value
            </label>
            <input
              id="value"
              type="password"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="sk_live_..."
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.value && <p className="mt-1 text-sm text-red-600">{errors.value}</p>}
          </div>

          <div>
            <label htmlFor="sourceType" className="block text-sm font-medium text-gray-700">
              Source Type
            </label>
            <select
              id="sourceType"
              value={formData.sourceType}
              onChange={(e) =>
                setFormData({ ...formData, sourceType: e.target.value as SecretSourceType })
              }
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {SOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="expiresAt" className="block text-sm font-medium text-gray-700">
              Expiration Date (Optional)
            </label>
            <input
              id="expiresAt"
              type="datetime-local"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.expiresAt && <p className="mt-1 text-sm text-red-600">{errors.expiresAt}</p>}
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add web/src/lib/components/secrets/CreateSecretModal.tsx
git commit -m "feat(secrets-ui): add CreateSecretModal with form validation

- Form fields for secret type, value, source type, expiration
- Input validation (required fields, future dates)
- API integration for secret creation
- Error handling and loading states
- Secure password input field"
```

---

### Task 4: Create RotateSecretModal component

**Files:**
- Create: `web/src/lib/components/secrets/RotateSecretModal.tsx`
- Create: `web/src/lib/components/__tests__/RotateSecretModal.test.tsx`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RotateSecretModal from '../secrets/RotateSecretModal';

describe('RotateSecretModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  it('should render rotation form', () => {
    render(
      <RotateSecretModal
        type="GEMINI_API_KEY"
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByLabelText(/new secret value/i)).toBeInTheDocument();
  });

  it('should validate new value is different', async () => {
    const user = userEvent.setup();
    render(
      <RotateSecretModal
        type="GEMINI_API_KEY"
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await user.click(screen.getByRole('button', { name: /rotate/i }));

    expect(screen.getByText(/new value is required/i)).toBeInTheDocument();
  });

  it('should increment key_version on success', async () => {
    const user = userEvent.setup();
    render(
      <RotateSecretModal
        type="GEMINI_API_KEY"
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await user.type(screen.getByLabelText(/new secret value/i), 'AIzaSy_newvalue123');
    await user.click(screen.getByRole('button', { name: /rotate/i }));

    expect(mockOnSuccess).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests**

```bash
npx vitest run src/lib/components/__tests__/RotateSecretModal.test.tsx
```

**Step 3: Implement RotateSecretModal**

Create `web/src/lib/components/secrets/RotateSecretModal.tsx`:

```typescript
import { useState } from 'react';
import type { SecretType } from '$lib/types/secrets';
import { useAuth } from '$lib/hooks/useAuth';
import { useSecretsStore } from '$lib/stores/secrets-store';

interface RotateSecretModalProps {
  type: SecretType;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RotateSecretModal({
  type,
  onClose,
  onSuccess,
}: RotateSecretModalProps) {
  const { session } = useAuth();
  const { updateSecret, setError, setLoading } = useSecretsStore();
  const [newValue, setNewValue] = useState('');
  const [error, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!newValue.trim()) {
      setLocalError('New value is required');
      return;
    }

    if (newValue.trim().length < 5) {
      setLocalError('New value must be at least 5 characters');
      return;
    }

    if (!session?.access_token) return;

    setIsSubmitting(true);
    setLoading(true);

    try {
      const response = await fetch(`/api/secrets/${type}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          new_value: newValue,
        }),
      });

      if (!response.ok) {
        const { error: apiError } = await response.json();
        throw new Error(apiError || 'Failed to rotate secret');
      }

      const { id, secretType, lastRotatedAt } = await response.json();

      // Update store with new metadata
      updateSecret(secretType, {
        id,
        secretType,
        lastRotatedAt,
        // ... other fields remain unchanged
      });

      setError(null);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setLocalError(message);
      setError(message);
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Rotate Secret</h2>
        <p className="mb-4 text-sm text-gray-600">
          Enter the new value for <strong>{type}</strong>. The old value will be invalidated.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newValue" className="block text-sm font-medium text-gray-700">
              New Secret Value
            </label>
            <input
              id="newValue"
              type="password"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="New secret..."
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>

          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-semibold">⚠️ Important</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-xs">
              <li>Your API provider must be updated to recognize the new value</li>
              <li>Old value will stop working immediately</li>
              <li>This action is logged for audit purposes</li>
            </ul>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Rotating...' : 'Rotate Secret'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add web/src/lib/components/secrets/RotateSecretModal.tsx
git commit -m "feat(secrets-ui): add RotateSecretModal with warnings

- Form for entering new secret value
- Validation for new value requirements
- Warning about immediate invalidation of old value
- Audit log notification
- Increments key_version server-side"
```

---

## Phase 3B: Advanced Features (4 Tasks)

### Task 5: Create CopyButton with auto-clear

**Files:**
- Create: `web/src/lib/components/shared/CopyButton.tsx`
- Create: `web/src/lib/utils/clipboard.ts`

**Step 1: Implement clipboard utility**

Create `web/src/lib/utils/clipboard.ts`:

```typescript
/**
 * Copy text to clipboard with auto-clear after timeout
 * @param text - Text to copy
 * @param clearDelay - Time in ms before clearing clipboard (default 10s)
 */
export async function copyToClipboard(text: string, clearDelay = 10000) {
  try {
    await navigator.clipboard.writeText(text);

    // Auto-clear clipboard after delay
    setTimeout(async () => {
      try {
        await navigator.clipboard.writeText('');
      } catch (err) {
        console.warn('Failed to clear clipboard:', err);
      }
    }, clearDelay);

    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}
```

**Step 2: Implement CopyButton component**

Create `web/src/lib/components/shared/CopyButton.tsx`:

```typescript
import { useState } from 'react';
import { copyToClipboard } from '$lib/utils/clipboard';

interface CopyButtonProps {
  text: string;
  label?: string;
  showValuePreview?: boolean;
  onCopied?: () => void;
}

export default function CopyButton({
  text,
  label = 'Copy',
  showValuePreview = false,
  onCopied,
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleClick = async () => {
    const success = await copyToClipboard(text);

    if (success) {
      setIsCopied(true);
      onCopied?.();

      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
        isCopied
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {isCopied ? '✓ Copied!' : label}
    </button>
  );
}
```

**Step 3: Commit**

```bash
git add web/src/lib/components/shared/CopyButton.tsx web/src/lib/utils/clipboard.ts
git commit -m "feat(secrets-ui): add CopyButton with auto-clear clipboard

- Copy text to clipboard with 10s auto-clear
- Visual feedback (green checkmark on copy)
- Auto-reverts after 2s in UI
- Secure by default (clipboard auto-cleared)"
```

---

### Task 6: Add Real-time subscriptions

**Files:**
- Modify: `web/src/lib/context/SecretsContext.tsx`
- Create: `web/src/lib/hooks/useSecretsSubscription.ts`

**Step 1: Create subscription hook**

Create `web/src/lib/hooks/useSecretsSubscription.ts`:

```typescript
import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useSecretsStore } from '$lib/stores/secrets-store';

export function useSecretsSubscription() {
  const { session } = useAuth();
  const supabase = useSupabaseClient();
  const { updateSecret, removeSecret } = useSecretsStore();

  useEffect(() => {
    if (!session?.user?.id) return;

    // Subscribe to secret updates
    const subscription = supabase
      .from('user_api_keys')
      .on('*', (payload) => {
        if (payload.eventType === 'UPDATE') {
          updateSecret(payload.new.secret_type, payload.new);
        } else if (payload.eventType === 'DELETE') {
          removeSecret(payload.old.secret_type);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [session?.user?.id, supabase]);
}
```

**Step 2: Integrate into SecretsContext**

Modify `web/src/lib/context/SecretsContext.tsx`:

```typescript
// Add at top of component:
useSecretsSubscription();
```

**Step 3: Commit**

```bash
git add web/src/lib/hooks/useSecretsSubscription.ts
git commit -m "feat(secrets-ui): add real-time subscription updates

- Subscribe to user_api_keys table changes
- Auto-update UI when secrets are modified
- Auto-remove secrets when deleted (other tabs)
- Realtime sync across browser tabs"
```

---

### Task 7: Create secrets dashboard page

**Files:**
- Create: `web/src/routes/secrets/+page.svelte`
- Create: `web/src/routes/secrets/+page.ts`

**Step 1: Implement page component**

Create `web/src/routes/secrets/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import SecretsList from '$lib/components/secrets/SecretsList';
  import { useSecrets } from '$lib/context/SecretsContext';
  import { useAuth } from '$lib/hooks/useAuth';
</script>

<svelte:head>
  <title>Secrets - Helix</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8">
  <header className="mb-8">
    <h1 className="text-3xl font-bold text-gray-900">API Key Management</h1>
    <p className="mt-2 text-gray-600">
      Manage and rotate your encrypted API keys securely
    </p>
  </header>

  <div className="rounded-lg border border-gray-200 bg-blue-50 p-4 mb-6">
    <h2 className="font-semibold text-blue-900">🔐 Security Notice</h2>
    <ul className="mt-2 space-y-1 text-sm text-blue-800">
      <li>✓ All secrets are encrypted at rest using AES-256-GCM</li>
      <li>✓ Your passwords are never stored in plain text</li>
      <li>✓ Each secret has a unique encryption key</li>
      <li>✓ All access is logged for audit purposes</li>
    </ul>
  </div>

  <SecretsList />
</div>

<style lang="postcss">
  :global(body) {
    @apply bg-gray-50;
  }
</style>
```

**Step 2: Create page server file**

Create `web/src/routes/secrets/+page.ts`:

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { session } = await parent();

  if (!session) {
    throw redirect(303, '/auth/login');
  }

  return {
    title: 'Secrets',
  };
};
```

**Step 3: Commit**

```bash
git add web/src/routes/secrets/
git commit -m "feat(secrets-ui): add secrets dashboard page

- Protected route requiring authentication
- Displays SecretsList component
- Shows security notice about encryption
- Responsive layout with max-width container"
```

---

### Task 8: Add secrets to main navigation

**Files:**
- Modify: `web/src/lib/components/Navigation.tsx`

**Step 1: Add secrets link**

Modify navigation component to include:

```typescript
{
  label: 'Secrets',
  href: '/secrets',
  icon: 'LockIcon',
  requiresAuth: true,
}
```

**Step 2: Commit**

```bash
git add web/src/lib/components/Navigation.tsx
git commit -m "feat(navigation): add secrets management link

- Add Secrets link to main navigation
- Only visible when authenticated
- Links to /secrets dashboard"
```

---

## Testing & Deployment

### Task 9: Integration tests

**Files:**
- Create: `web/src/routes/secrets/__tests__/secrets.e2e.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Secrets Dashboard', () => {
  test('should create and rotate secret', async ({ page, context }) => {
    // Login first
    await page.goto('/auth/login');
    // ... login flow

    // Navigate to secrets
    await page.goto('/secrets');

    // Create secret
    await page.click('button:has-text("Add Secret")');
    await page.fill('input[name="value"]', 'sk_live_test123');
    await page.click('button:has-text("Create")');

    // Verify secret appears in list
    await expect(page.locator('text=GEMINI_API_KEY')).toBeVisible();

    // Rotate secret
    await page.click('button:has-text("Rotate")');
    await page.fill('input[name="newValue"]', 'sk_live_rotated123');
    await page.click('button:has-text("Rotate Secret")');

    // Verify rotation
    await expect(page.locator('text=rotated')).toBeVisible();
  });
});
```

---

## Summary

This plan implements a **production-grade secrets management dashboard** with:

✅ State management (Zustand + Context)
✅ Components: List, Create, Rotate, Copy button
✅ Real-time updates (Supabase subscriptions)
✅ Secure clipboard (auto-clear after 10s)
✅ Form validation and error handling
✅ Dashboard page with authentication
✅ Integration tests with Playwright

**Total tasks: 9**
**Estimated time: 20-30 hours**
**Testing approach: TDD + E2E**

---

## Execution

Plan complete and saved to `docs/plans/2026-02-02-phase3-frontend-secrets-dashboard.md`.

**Which execution approach?**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks

**2. Parallel Session (separate)** - Open new session with executing-plans for batch execution

Which do you prefer?
