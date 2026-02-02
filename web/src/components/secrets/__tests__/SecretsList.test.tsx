import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecretsList } from '../SecretsList';
import { SecretsProvider } from '../../../lib/context/SecretsContext';
import { useSecretsStore } from '../../../lib/stores/secrets-store';
import type { UserApiKey } from '../../../lib/types/secrets';

describe('SecretsList Component', () => {
  const mockSecret: UserApiKey = {
    id: 'secret-1',
    user_id: 'user-123',
    key_name: 'Stripe API Key',
    secret_type: 'STRIPE_SECRET_KEY',
    source_type: 'user-provided',
    created_at: '2025-01-01T00:00:00Z',
    expires_at: '2026-01-01T00:00:00Z',
    is_active: true,
    key_version: 1,
    encryption_method: 'aes-256-gcm',
    encrypted_value: 'encrypted_test_value',
    derivation_salt: null,
    last_accessed_at: null,
    last_rotated_at: null,
    created_by: 'system',
    updated_by: null,
    updated_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    useSecretsStore.setState({
      secrets: [],
      loading: false,
      error: null,
    });
  });

  it('should render empty state when no secrets', () => {
    render(
      <SecretsProvider>
        <SecretsList />
      </SecretsProvider>
    );
    expect(screen.getByText(/no secrets/i)).toBeInTheDocument();
  });

  it('should render secrets list with items', () => {
    useSecretsStore.setState({
      secrets: [mockSecret],
      loading: false,
      error: null,
    });

    render(
      <SecretsProvider>
        <SecretsList />
      </SecretsProvider>
    );
    expect(screen.getByText('Stripe API Key')).toBeInTheDocument();
  });

  it('should display secret metadata', () => {
    useSecretsStore.setState({
      secrets: [mockSecret],
      loading: false,
      error: null,
    });

    render(
      <SecretsProvider>
        <SecretsList />
      </SecretsProvider>
    );
    expect(screen.getByText(/STRIPE_SECRET_KEY/i)).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('should show loading state', () => {
    useSecretsStore.setState({
      secrets: [],
      loading: true,
      error: null,
    });

    render(
      <SecretsProvider>
        <SecretsList />
      </SecretsProvider>
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should show error message when error is set', () => {
    useSecretsStore.setState({
      secrets: [],
      loading: false,
      error: 'Failed to load secrets',
    });

    render(
      <SecretsProvider>
        <SecretsList />
      </SecretsProvider>
    );
    expect(screen.getByText(/error loading secrets/i)).toBeInTheDocument();
    expect(screen.getByText('Failed to load secrets')).toBeInTheDocument();
  });
});
