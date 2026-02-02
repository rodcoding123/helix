import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecretsList } from '../SecretsList';
import type { UserApiKey } from '../../../types/secrets';

describe('SecretsList Component', () => {
  const mockSecret: UserApiKey = {
    id: 'secret-1',
    user_id: 'user-123',
    name: 'Stripe Key',
    secret_type: 'STRIPE_SECRET_KEY' as const,
    source_type: 'manual' as const,
    created_at: new Date('2025-01-01'),
    expires_at: new Date('2026-01-01'),
    is_active: true,
    key_version: 1,
    encryption_method: 'aes-256-gcm' as const,
  };

  it('should render empty state when no secrets', () => {
    render(<SecretsList secrets={[]} onRotate={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/no secrets/i)).toBeTruthy();
  });

  it('should display secrets in list', () => {
    render(<SecretsList secrets={[mockSecret]} onRotate={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('Stripe Key')).toBeTruthy();
  });

  it('should show status badges', () => {
    render(<SecretsList secrets={[mockSecret]} onRotate={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/active/i)).toBeTruthy();
  });

  it('should display action buttons', () => {
    render(<SecretsList secrets={[mockSecret]} onRotate={() => {}} onDelete={() => {}} />);
    expect(screen.getByRole('button', { name: /rotate/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
  });
});
