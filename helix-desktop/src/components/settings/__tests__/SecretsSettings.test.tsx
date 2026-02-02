import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecretsSettings } from '../SecretsSettings';

// Mock the hooks
vi.mock('../../../hooks/useSecretsData', () => ({
  useSecretsData: () => ({
    secrets: [],
    loading: false,
    error: null,
    selectedSecret: null,
    setSelectedSecret: vi.fn(),
    createSecret: vi.fn(),
    rotateSecret: vi.fn(),
    deleteSecret: vi.fn(),
  }),
}));

describe('SecretsSettings Component', () => {
  it('should render page heading', () => {
    render(<SecretsSettings />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(/secrets/i);
  });

  it('should render create button', () => {
    render(<SecretsSettings />);
    expect(screen.getByRole('button', { name: /create/i })).toBeTruthy();
  });

  it('should display statistics cards', () => {
    render(<SecretsSettings />);
    expect(screen.getByText(/total secrets/i)).toBeTruthy();
    expect(screen.getByText(/active/i)).toBeTruthy();
  });
});
