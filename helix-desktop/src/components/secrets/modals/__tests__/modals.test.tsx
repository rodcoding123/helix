import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSecretModal } from '../CreateSecretModal';
import { RotateSecretModal } from '../RotateSecretModal';
import type { UserApiKey } from '../../../../types/secrets';

describe('CreateSecretModal', () => {
  const mockOnCreate = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form when open', () => {
    render(
      <CreateSecretModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
    );
    expect(screen.getByLabelText(/secret name/i)).toBeTruthy();
  });

  it('should not render when closed', () => {
    const { container } = render(
      <CreateSecretModal isOpen={false} onClose={mockOnClose} onCreate={mockOnCreate} />
    );
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('should call onCreate with form data', async () => {
    const user = userEvent.setup();
    render(
      <CreateSecretModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
    );

    await user.type(screen.getByLabelText(/secret name/i), 'My Secret');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(mockOnCreate).toHaveBeenCalled();
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();
    render(
      <CreateSecretModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
    );

    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(screen.getByText(/name is required/i)).toBeTruthy();
  });

  it('should call onClose when cancelled', async () => {
    const user = userEvent.setup();
    render(
      <CreateSecretModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockOnClose).toHaveBeenCalled();
  });
});

describe('RotateSecretModal', () => {
  const mockSecret: UserApiKey = {
    id: 'secret-1',
    user_id: 'user-123',
    name: 'Stripe Key',
    secret_type: 'STRIPE_SECRET_KEY' as const,
    source_type: 'manual' as const,
    created_at: new Date(),
    expires_at: null,
    is_active: true,
    key_version: 5,
    encryption_method: 'aes-256-gcm' as const,
  };

  const mockOnConfirm = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display version information', () => {
    render(
      <RotateSecretModal
        isOpen={true}
        secret={mockSecret}
        onConfirm={mockOnConfirm}
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText(/current version:/i)).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText(/new version:/i)).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('should call onConfirm when confirmed', async () => {
    const user = userEvent.setup();
    render(
      <RotateSecretModal
        isOpen={true}
        secret={mockSecret}
        onConfirm={mockOnConfirm}
        onClose={mockOnClose}
      />
    );

    await user.click(screen.getByRole('button', { name: /rotate/i }));

    expect(mockOnConfirm).toHaveBeenCalledWith('secret-1');
  });

  it('should show warning message', () => {
    render(
      <RotateSecretModal
        isOpen={true}
        secret={mockSecret}
        onConfirm={mockOnConfirm}
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText(/generate a new version/i)).toBeTruthy();
  });
});
