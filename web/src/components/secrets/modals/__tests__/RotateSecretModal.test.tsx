import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RotateSecretModal } from '../RotateSecretModal';
import type { UserApiKey } from '@/lib/types/secrets';

describe('RotateSecretModal Component', () => {
  const mockSecret: UserApiKey = {
    id: 'secret-1',
    user_id: 'user-123',
    key_name: 'Production API Key',
    secret_type: 'STRIPE_SECRET_KEY' as const,
    source_type: 'user-provided' as const,
    created_at: '2025-01-01',
    last_accessed_at: null,
    last_rotated_at: null,
    expires_at: '2026-01-01',
    is_active: true,
    key_version: 5,
    encryption_method: 'aes-256-gcm' as const,
    encrypted_value: 'encrypted-value',
    derivation_salt: null,
    created_by: null,
    updated_by: null,
    updated_at: '2025-01-01',
  };

  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnConfirm.mockClear();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <RotateSecretModal
        isOpen={false}
        secret={mockSecret}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeInTheDocument();
  });

  it('should render modal when isOpen is true', () => {
    render(
      <RotateSecretModal
        isOpen={true}
        secret={mockSecret}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );
    expect(screen.getByText(/rotate secret/i)).toBeInTheDocument();
  });

  it('should display secret name and current version', () => {
    render(
      <RotateSecretModal
        isOpen={true}
        secret={mockSecret}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );
    expect(screen.getByText(/production api key/i)).toBeInTheDocument();
    expect(screen.getByText(/current version: 5/i)).toBeInTheDocument();
    expect(screen.getByText(/new version: 6/i)).toBeInTheDocument();
  });

  it('should call onConfirm when rotate button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RotateSecretModal
        isOpen={true}
        secret={mockSecret}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const rotateButton = screen.getByRole('button', { name: /rotate secret/i });
    await user.click(rotateButton);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith(mockSecret.id);
    });
  });

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RotateSecretModal
        isOpen={true}
        secret={mockSecret}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
