import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SecretListItem } from '../SecretListItem';
import type { UserApiKey } from '../../../lib/types/secrets';

describe('SecretListItem Component', () => {
  const mockSecret: UserApiKey = {
    id: 'secret-1',
    user_id: 'user-123',
    key_name: 'API Key',
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

  it('should render secret name', () => {
    render(<SecretListItem secret={mockSecret} />);
    expect(screen.getByText('API Key')).toBeInTheDocument();
  });

  it('should show active badge when is_active is true', () => {
    render(<SecretListItem secret={mockSecret} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should show inactive badge when is_active is false', () => {
    const inactiveSecret = { ...mockSecret, is_active: false };
    render(<SecretListItem secret={inactiveSecret} />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('should show expired badge when expiration date has passed', () => {
    const expiredSecret = {
      ...mockSecret,
      expires_at: '2020-01-01T00:00:00Z', // Past date
    };
    render(<SecretListItem secret={expiredSecret} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('should show expiring soon badge when expires within 7 days', () => {
    const now = new Date();
    const soonExpires = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    const soonSecret = {
      ...mockSecret,
      expires_at: soonExpires.toISOString(),
    };
    render(<SecretListItem secret={soonSecret} />);
    expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
  });

  it('should display secret metadata', () => {
    render(<SecretListItem secret={mockSecret} />);
    expect(screen.getByText(/type: STRIPE_SECRET_KEY/i)).toBeInTheDocument();
    expect(screen.getByText(/version: 1/i)).toBeInTheDocument();
  });

  it('should show copy button when onCopy handler is provided', () => {
    const onCopy = vi.fn();
    render(<SecretListItem secret={mockSecret} onCopy={onCopy} />);
    const copyButton = screen.getByRole('button', { name: /copy api key/i });
    expect(copyButton).toBeInTheDocument();
  });

  it('should call onCopy when copy button is clicked', () => {
    const onCopy = vi.fn();
    render(<SecretListItem secret={mockSecret} onCopy={onCopy} />);
    const copyButton = screen.getByRole('button', { name: /copy api key/i });
    fireEvent.click(copyButton);
    expect(onCopy).toHaveBeenCalled();
  });

  it('should show rotate button when onRotate handler is provided', () => {
    const onRotate = vi.fn();
    render(<SecretListItem secret={mockSecret} onRotate={onRotate} />);
    const rotateButton = screen.getByRole('button', { name: /rotate api key/i });
    expect(rotateButton).toBeInTheDocument();
  });

  it('should call onRotate when rotate button is clicked', () => {
    const onRotate = vi.fn();
    render(<SecretListItem secret={mockSecret} onRotate={onRotate} />);
    const rotateButton = screen.getByRole('button', { name: /rotate api key/i });
    fireEvent.click(rotateButton);
    expect(onRotate).toHaveBeenCalled();
  });

  it('should show delete button when onDelete handler is provided', () => {
    const onDelete = vi.fn();
    render(<SecretListItem secret={mockSecret} onDelete={onDelete} />);
    const deleteButton = screen.getByRole('button', { name: /delete api key/i });
    expect(deleteButton).toBeInTheDocument();
  });

  it('should call onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<SecretListItem secret={mockSecret} onDelete={onDelete} />);
    const deleteButton = screen.getByRole('button', { name: /delete api key/i });
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalled();
  });

  it('should not show buttons when no handlers are provided', () => {
    render(<SecretListItem secret={mockSecret} />);
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('should not show expired badge when expiration date is in future', () => {
    const farFuture = new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days from now
    const futureSecret = { ...mockSecret, expires_at: farFuture.toISOString() };
    render(<SecretListItem secret={futureSecret} />);
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
  });

  it('should not show expiring soon badge when expires more than 7 days away', () => {
    const farFuture = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const futureSecret = { ...mockSecret, expires_at: farFuture.toISOString() };
    render(<SecretListItem secret={futureSecret} />);
    expect(screen.queryByText('Expiring Soon')).not.toBeInTheDocument();
  });

  it('should handle secrets without expiration date', () => {
    const noExpiresSecret = { ...mockSecret, expires_at: null };
    render(<SecretListItem secret={noExpiresSecret} />);
    // Should render without crashing
    expect(screen.getByText('API Key')).toBeInTheDocument();
  });
});
