import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecretsPage } from '../SecretsPage';
import { SecretsProvider } from '../../lib/context/SecretsContext';
import { useSecretsStore } from '../../lib/stores/secrets-store';

describe('SecretsPage Component', () => {
  beforeEach(() => {
    useSecretsStore.setState({
      secrets: [],
      loading: false,
      error: null,
    });
  });

  it('should render page heading', () => {
    render(
      <SecretsProvider>
        <SecretsPage />
      </SecretsProvider>
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/secrets/i);
  });

  it('should render create secret button', () => {
    render(
      <SecretsProvider>
        <SecretsPage />
      </SecretsProvider>
    );
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('should render secrets list component', () => {
    render(
      <SecretsProvider>
        <SecretsPage />
      </SecretsProvider>
    );
    // The SecretsList component is rendered (shows empty state)
    expect(screen.getByText(/no secrets yet/i)).toBeInTheDocument();
  });
});
