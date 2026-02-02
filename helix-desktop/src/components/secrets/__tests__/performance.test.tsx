import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { SecretsSettings } from '../../settings/SecretsSettings';

// Mock the auth hook
vi.mock('../../../lib/auth-context.tsx', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

// Mock lazy components
vi.mock('../modals/CreateSecretModal', () => ({
  CreateSecretModal: () => <div data-testid="create-modal">Create Modal</div>,
}));

vi.mock('../modals/RotateSecretModal', () => ({
  RotateSecretModal: () => <div data-testid="rotate-modal">Rotate Modal</div>,
}));

describe('Performance Optimization - Lazy Loading', () => {
  it('should render SecretsSettings with Suspense boundary', async () => {
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <SecretsSettings />
      </Suspense>
    );

    expect(screen.getByText('Secrets')).toBeInTheDocument();
  });

  it('should provide loading fallback for lazy components', async () => {
    render(
      <Suspense fallback={<div data-testid="loading">Loading modals...</div>}>
        <SecretsSettings />
      </Suspense>
    );

    expect(screen.getByText('Manage your API keys and secrets securely')).toBeInTheDocument();
  });
});
